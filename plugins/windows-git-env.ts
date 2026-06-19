import type { Hooks, Plugin } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"

type WindowsGitEnvOptions = {
  gitHome?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  exists?: (path: string) => boolean
}

type ShellEnvOutput = {
  env: Record<string, string | undefined>
}

type ConfigOutput = {
  shell?: string
}

function normalizePath(path: string) {
  return path.replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase()
}

function prependPathEntries(currentPath: string | undefined, entries: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const entry of [...entries, ...(currentPath ?? "").split(";")]) {
    const trimmed = entry.trim()
    if (!trimmed) continue

    const key = normalizePath(trimmed)
    if (seen.has(key)) continue


    seen.add(key)
    result.push(trimmed)
  }

  return result.join(";")
}

function pathKey(env: Record<string, string | undefined>) {
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path"
}

function cleanWindowsPath(path: string) {
  return path.replaceAll("/", "\\").replace(/\\+$/, "")
}

function parentOf(path: string) {
  return cleanWindowsPath(path).split("\\").slice(0, -1).join("\\")
}

function candidateHomesFromPath(pathValue: string | undefined) {
  const homes: string[] = []

  for (const entry of pathValue?.split(";") ?? []) {
    const normalized = cleanWindowsPath(entry.trim())
    if (!normalized) continue

    const comparable = normalized.toLowerCase()
    if (comparable.endsWith("\\cmd")) homes.push(parentOf(normalized))
    if (comparable.endsWith("\\bin")) homes.push(parentOf(normalized))
    if (comparable.endsWith("\\mingw64\\bin")) homes.push(parentOf(parentOf(normalized)))
    if (comparable.endsWith("\\usr\\bin")) homes.push(parentOf(parentOf(normalized)))
  }

  return homes
}

function commonGitHomes(env: NodeJS.ProcessEnv) {
  return [
    env.GIT_HOME,
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Programs\\Git` : undefined,
    env.ProgramFiles ? `${env.ProgramFiles}\\Git` : undefined,
    env["ProgramFiles(x86)"] ? `${env["ProgramFiles(x86)"]}\\Git` : undefined,
    env.USERPROFILE ? `${env.USERPROFILE}\\scoop\\apps\\git\\current` : undefined,
  ].filter((path): path is string => typeof path === "string" && path.trim().length > 0)
}

export function gitForWindowsPaths(gitHome: string) {
  return {
    bash: `${gitHome}\\bin\\bash.exe`,
    execPath: `${gitHome}\\mingw64\\libexec\\git-core`,
    pathEntries: [`${gitHome}\\cmd`, `${gitHome}\\mingw64\\bin`, `${gitHome}\\usr\\bin`, `${gitHome}\\bin`],
  }
}

export function findGitForWindowsHome(options: WindowsGitEnvOptions = {}) {
  const env = options.env ?? process.env
  const exists = options.exists ?? existsSync
  const pathValue = env.Path ?? env.PATH
  const candidates = [options.gitHome, ...candidateHomesFromPath(pathValue), ...commonGitHomes(env)].filter(
    (path): path is string => typeof path === "string" && path.trim().length > 0,
  )

  for (const candidate of candidates) {
    const home = cleanWindowsPath(candidate)
    const paths = gitForWindowsPaths(home)

    if (exists(paths.bash) && (exists(`${home}\\cmd\\git.exe`) || exists(`${home}\\mingw64\\bin\\git.exe`))) {
      return home
    }
  }
}

export function createWindowsGitEnvPlugin(defaultOptions: WindowsGitEnvOptions = {}): Plugin {
  return async (_input, runtimeOptions?: WindowsGitEnvOptions): Promise<Hooks> => {
    const options = { ...defaultOptions, ...runtimeOptions }
    const platform = options.platform ?? process.platform
    const gitHome = platform === "win32" ? findGitForWindowsHome(options) : undefined
    const gitPaths = gitHome ? gitForWindowsPaths(gitHome) : undefined

    return {
      config: async (cfg: ConfigOutput) => {
        if (!gitPaths) return

        cfg.shell = gitPaths.bash
      },

      "shell.env": async (_input, output: ShellEnvOutput) => {
        if (!gitPaths) return

        const key = pathKey(output.env)

        output.env[key] = prependPathEntries(output.env[key], gitPaths.pathEntries)
        output.env.GIT_EXEC_PATH = gitPaths.execPath
      },
    }
  }
}

export const WindowsGitEnvPlugin: Plugin = createWindowsGitEnvPlugin()

export default WindowsGitEnvPlugin
