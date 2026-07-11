import { existsSync } from "node:fs"
import { win32 as path } from "node:path"

export type Environment = Record<string, string | undefined>

export type WindowsGitEnvironment = {
  home: string
  bash: string
  pathEntries: string[]
}

export type WindowsGitDetectionOptions = {
  platform?: string
  env?: Environment
  exists?: (candidate: string) => boolean
}

export function environmentKey(env: Environment, name: string): string | undefined {
  return Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
}

export function environmentValue(env: Environment, name: string): string | undefined {
  const key = environmentKey(env, name)
  return key ? env[key] : undefined
}

function cleanPathEntry(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const unquoted = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed
  return path.normalize(unquoted)
}

function inferGitHome(candidate: string): string {
  let current = cleanPathEntry(candidate)
  if (path.extname(current).toLowerCase() === ".exe") current = path.dirname(current)

  const leaf = path.basename(current).toLowerCase()
  const parent = path.basename(path.dirname(current)).toLowerCase()
  if (leaf === "bin" && ["mingw32", "mingw64", "usr"].includes(parent)) {
    return path.dirname(path.dirname(current))
  }
  if (leaf === "bin" || leaf === "cmd") return path.dirname(current)
  return current
}

function candidateHomes(env: Environment): string[] {
  const candidates: string[] = []
  const gitHome = environmentValue(env, "GIT_HOME")
  if (gitHome) candidates.push(gitHome)

  const currentPath = environmentValue(env, "PATH")
  if (currentPath) candidates.push(...currentPath.split(";").filter(Boolean))

  const userProfile = environmentValue(env, "USERPROFILE")
  const scoop = environmentValue(env, "SCOOP") ?? (userProfile ? path.join(userProfile, "scoop") : undefined)
  const programFiles = environmentValue(env, "ProgramFiles")
  const programFilesX86 = environmentValue(env, "ProgramFiles(x86)")
  const localAppData = environmentValue(env, "LocalAppData")

  if (scoop) candidates.push(path.join(scoop, "apps", "git", "current"))
  if (localAppData) candidates.push(path.join(localAppData, "Programs", "Git"))
  if (programFiles) candidates.push(path.join(programFiles, "Git"))
  if (programFilesX86) candidates.push(path.join(programFilesX86, "Git"))

  return candidates.map(inferGitHome)
}

function uniquePaths(candidates: string[]): string[] {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = candidate.replace(/[\\/]+$/, "").toLowerCase()
    if (!candidate || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function inspectGitHome(home: string, exists: (candidate: string) => boolean): WindowsGitEnvironment | undefined {
  const bash = path.join(home, "bin", "bash.exe")
  const hasGit = [path.join(home, "bin", "git.exe"), path.join(home, "cmd", "git.exe")].some(exists)
  if (!exists(bash) || !hasGit) return undefined

  const pathEntries = [
    path.join(home, "bin"),
    path.join(home, "cmd"),
    path.join(home, "mingw64", "bin"),
    path.join(home, "mingw32", "bin"),
    path.join(home, "usr", "bin"),
  ].filter(exists)

  return { home, bash, pathEntries }
}

export function detectWindowsGitEnvironment(
  options: WindowsGitDetectionOptions = {},
): WindowsGitEnvironment | undefined {
  const platform = options.platform ?? process.platform
  if (platform !== "win32") return undefined

  const env = options.env ?? process.env
  const exists = options.exists ?? existsSync
  for (const home of uniquePaths(candidateHomes(env))) {
    const detected = inspectGitHome(home, exists)
    if (detected) return detected
  }
  return undefined
}

export function prioritizeWindowsPath(currentPath: string | undefined, preferred: string[]): string {
  const entries = [...preferred, ...(currentPath?.split(";") ?? [])]
  return uniquePaths(entries.map(cleanPathEntry).filter(Boolean)).join(";")
}

export function applyPreferredPath(
  processEnv: Environment,
  shellEnv: Record<string, string>,
  preferred: string[],
): void {
  const shellPathKey = environmentKey(shellEnv, "PATH")
  const processPathKey = environmentKey(processEnv, "PATH")
  const pathKey = shellPathKey ?? processPathKey ?? "PATH"
  const inheritedPath = shellPathKey ? shellEnv[shellPathKey] : environmentValue(processEnv, "PATH")

  shellEnv[pathKey] = prioritizeWindowsPath(inheritedPath, preferred)
}
