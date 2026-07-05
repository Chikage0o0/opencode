import type { Hooks, Plugin } from "@opencode-ai/plugin"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"

type WindowsGitEnvOptions = {
  gitHome?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  exists?: (path: string) => boolean
  execFileSync?: (file: string, args: string[], options: { encoding: "utf8"; timeout: number }) => string
}

type EnvironmentRegistryScope = "system" | "user"

type RegistryEnvironmentValue = {
  name: string
  type: string
  value: string
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

function envKey(env: Record<string, string | undefined>, name: string) {
  return Object.keys(env).find((key) => key.toLowerCase() === name.toLowerCase())
}

function setEnvValue(env: Record<string, string | undefined>, name: string, value: string | undefined) {
  env[envKey(env, name) ?? name] = value
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

function windowsEnvironmentRegistryKey(scope: EnvironmentRegistryScope) {
  return scope === "system" ? "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" : "HKCU\\Environment"
}

function parseRegistryEnvironment(output: string) {
  const values: RegistryEnvironmentValue[] = []

  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*([^\s]+)\s+(REG_[A-Z_]+)\s*(.*)$/.exec(line)
    if (!match) continue

    values.push({ name: match[1], type: match[2], value: match[3] ?? "" })
  }

  return values
}

function expandWindowsEnvironmentValue(value: string, env: Record<string, string | undefined>) {
  return value.replace(/%([^%]+)%/g, (match, name: string) => env[envKey(env, name) ?? name] ?? match)
}

function windowsRegCommands(options: WindowsGitEnvOptions) {
  const env = options.env ?? process.env
  const exists = options.exists ?? existsSync
  const commands: string[] = []

  for (const root of [env.SystemRoot, env.WINDIR]) {
    if (!root) continue

    const command = `${cleanWindowsPath(root)}\\System32\\reg.exe`
    if (exists(command) && !commands.some((item) => normalizePath(item) === normalizePath(command))) commands.push(command)
  }

  commands.push("reg")

  return commands
}

function readWindowsRegistryEnvironment(options: WindowsGitEnvOptions = {}) {
  const run = options.execFileSync ?? execFileSync
  const result: Record<string, string> = {}
  const commands = windowsRegCommands(options)

  for (const scope of ["system", "user"] as const) {
    let output = ""
    let read = false

    for (const command of commands) {
      try {
        output = run(command, ["query", windowsEnvironmentRegistryKey(scope)], { encoding: "utf8", timeout: 1000 })
        read = true
        break
      } catch {
        continue
      }
    }

    if (!read) continue

    for (const item of parseRegistryEnvironment(output)) {
      const baseEnv = { ...(options.env ?? process.env), ...result }
      const value = item.type === "REG_EXPAND_SZ" ? expandWindowsEnvironmentValue(item.value, baseEnv) : item.value
      const existingKey = envKey(result, item.name)

      if (item.name.toLowerCase() === "path" && existingKey) {
        result[existingKey] = prependPathEntries(result[existingKey], value.split(";"))
      } else {
        result[existingKey ?? item.name] = value
      }
    }
  }

  return result
}

function mergeWindowsRegistryEnvironment(env: Record<string, string | undefined>, registryEnv: Record<string, string>) {
  const registryPath = registryEnv[envKey(registryEnv, "Path") ?? "Path"]

  for (const [name, value] of Object.entries(registryEnv)) {
    if (name.toLowerCase() === "path") continue

    setEnvValue(env, name, value)
  }

  if (registryPath) {
    const key = pathKey(env)
    env[key] = prependPathEntries(env[key], registryPath.split(";"))
  }
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
    const registryEnv = platform === "win32" ? readWindowsRegistryEnvironment(options) : undefined
    const discoveryEnv = registryEnv ? ({ ...(options.env ?? process.env), ...registryEnv } as NodeJS.ProcessEnv) : options.env
    const gitHome = platform === "win32" ? findGitForWindowsHome({ ...options, env: discoveryEnv }) : undefined
    const gitPaths = gitHome ? gitForWindowsPaths(gitHome) : undefined

    return {
      config: async (cfg: ConfigOutput) => {
        if (!gitPaths) return

        cfg.shell = gitPaths.bash
      },

      "shell.env": async (_input, output: ShellEnvOutput) => {
        if (registryEnv) mergeWindowsRegistryEnvironment(output.env, registryEnv)
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
