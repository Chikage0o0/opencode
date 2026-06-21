import type { Hooks, Plugin } from "@opencode-ai/plugin"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { posix, win32 } from "node:path"
import { homedir } from "node:os"

type BrowserID = "chrome" | "chromium" | "edge" | "brave" | "vivaldi" | "default-browser"

type BrowserCandidate = {
  id: BrowserID
  path: string
}

type ChromeDevtoolsBrowserOptions = {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  home?: string
  exists?: (path: string) => boolean
  execFileSync?: (file: string, args: string[], options?: { encoding: "utf8"; timeout?: number }) => string
}

type ChromeDevtoolsMcp = {
  command?: string[]
  [key: string]: unknown
}

type ConfigOutput = {
  mcp?: Record<string, ChromeDevtoolsMcp | undefined>
}

const baseCommand = ["bunx", "-y", "chrome-devtools-mcp@latest"]

function envValue(env: NodeJS.ProcessEnv, key: string) {
  return Object.keys(env).find((candidate) => candidate.toLowerCase() === key.toLowerCase())
}

function pathEntries(env: NodeJS.ProcessEnv, platform: NodeJS.Platform) {
  const key = envValue(env, "PATH")
  return (key ? env[key] : undefined)?.split(platform === "win32" ? ";" : ":").filter(Boolean) ?? []
}

function commandFromBrowserEnvEntry(entry: string) {
  const trimmed = entry.trim()
  if (!trimmed) return

  if (trimmed.startsWith('"')) return trimmed.slice(1).split('"')[0]

  return trimmed.split(/\s+/)[0]
}

function browserIDFromValue(value: string): BrowserID | undefined {
  const normalized = value.toLowerCase()

  if (normalized.includes("msedge") || normalized.includes("microsoft-edge") || normalized.includes("microsoft edge")) return "edge"
  if (normalized.includes("brave")) return "brave"
  if (normalized.includes("vivaldi")) return "vivaldi"
  if (normalized.includes("chromium")) return "chromium"
  if (normalized.includes("chrome")) return "chrome"
}

function executableNamesFor(browserID: BrowserID) {
  switch (browserID) {
    case "chrome":
      return ["google-chrome", "google-chrome-stable", "chrome"]
    case "chromium":
      return ["chromium", "chromium-browser"]
    case "edge":
      return ["microsoft-edge", "microsoft-edge-stable", "msedge"]
    case "brave":
      return ["brave-browser", "brave"]
    case "vivaldi":
      return ["vivaldi", "vivaldi-stable"]
    default:
      return []
  }
}

function candidatesFromPathEntries(browserID: BrowserID, env: NodeJS.ProcessEnv, platform: NodeJS.Platform) {
  const join = platform === "win32" ? win32.join : posix.join

  return pathEntries(env, platform).flatMap((entry) =>
    executableNamesFor(browserID).map((name) => ({ id: browserID, path: join(entry, platform === "win32" && !name.endsWith(".exe") ? `${name}.exe` : name) })),
  )
}

function pathJoin(platform: NodeJS.Platform, ...parts: string[]) {
  return platform === "win32" ? win32.join(...parts) : posix.join(...parts)
}

function uniqueCandidates(candidates: BrowserCandidate[]) {
  const seen = new Set<string>()
  const result: BrowserCandidate[] = []

  for (const candidate of candidates) {
    const key = candidate.path.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(candidate)
  }

  return result
}

function windowsCandidates(env: NodeJS.ProcessEnv): BrowserCandidate[] {
  const local = env.LOCALAPPDATA
  const programFiles = env.ProgramFiles
  const programFilesX86 = env["ProgramFiles(x86)"]

  return uniqueCandidates([
    ...(local ? [{ id: "chrome" as const, path: `${local}\\Google\\Chrome\\Application\\chrome.exe` }] : []),
    ...(programFiles ? [{ id: "chrome" as const, path: `${programFiles}\\Google\\Chrome\\Application\\chrome.exe` }] : []),
    ...(programFilesX86 ? [{ id: "chrome" as const, path: `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe` }] : []),
    ...(local ? [{ id: "chromium" as const, path: `${local}\\Chromium\\Application\\chrome.exe` }] : []),
    ...(programFiles ? [{ id: "chromium" as const, path: `${programFiles}\\Chromium\\Application\\chrome.exe` }] : []),
    ...(programFilesX86 ? [{ id: "chromium" as const, path: `${programFilesX86}\\Chromium\\Application\\chrome.exe` }] : []),
    ...(local ? [{ id: "edge" as const, path: `${local}\\Microsoft\\Edge\\Application\\msedge.exe` }] : []),
    ...(programFiles ? [{ id: "edge" as const, path: `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe` }] : []),
    ...(programFilesX86 ? [{ id: "edge" as const, path: `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe` }] : []),
    ...(local ? [{ id: "brave" as const, path: `${local}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe` }] : []),
    ...(programFiles ? [{ id: "brave" as const, path: `${programFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe` }] : []),
    ...(programFilesX86 ? [{ id: "brave" as const, path: `${programFilesX86}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe` }] : []),
    ...(local ? [{ id: "vivaldi" as const, path: `${local}\\Vivaldi\\Application\\vivaldi.exe` }] : []),
    ...(programFiles ? [{ id: "vivaldi" as const, path: `${programFiles}\\Vivaldi\\Application\\vivaldi.exe` }] : []),
    ...(programFilesX86 ? [{ id: "vivaldi" as const, path: `${programFilesX86}\\Vivaldi\\Application\\vivaldi.exe` }] : []),
  ])
}

function macCandidates(): BrowserCandidate[] {
  return [
    { id: "chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
    { id: "chromium", path: "/Applications/Chromium.app/Contents/MacOS/Chromium" },
    { id: "edge", path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" },
    { id: "brave", path: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" },
    { id: "vivaldi", path: "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi" },
  ]
}

function linuxCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): BrowserCandidate[] {
  const names: BrowserCandidate[] = [
    { id: "chrome", path: "google-chrome" },
    { id: "chrome", path: "google-chrome-stable" },
    { id: "chromium", path: "chromium" },
    { id: "chromium", path: "chromium-browser" },
    { id: "edge", path: "microsoft-edge" },
    { id: "edge", path: "microsoft-edge-stable" },
    { id: "brave", path: "brave-browser" },
    { id: "brave", path: "brave" },
    { id: "vivaldi", path: "vivaldi" },
    { id: "vivaldi", path: "vivaldi-stable" },
  ]
  const absolute: BrowserCandidate[] = names.flatMap((candidate) => [
    { ...candidate, path: `/usr/bin/${candidate.path}` },
    { ...candidate, path: `/usr/local/bin/${candidate.path}` },
    { ...candidate, path: `/opt/google/chrome/${candidate.path}` },
    { ...candidate, path: `/opt/microsoft/msedge/${candidate.path}` },
  ])
  const fromPath = pathEntries(env, platform).flatMap((entry) => names.map((candidate) => ({ ...candidate, path: posix.join(entry, candidate.path) })))

  return uniqueCandidates([...absolute, ...fromPath])
}

function defaultBrowserIDFromWindowsRegistry(options: ChromeDevtoolsBrowserOptions) {
  const run = options.execFileSync ?? execFileSync

  try {
    const output = run(
      "reg",
      ["query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice", "/v", "ProgId"],
      { encoding: "utf8", timeout: 1000 },
    )

    return browserIDFromValue(output)
  } catch {
    return undefined
  }
}

function defaultBrowserIDFromLinuxDesktop(options: ChromeDevtoolsBrowserOptions) {
  const run = options.execFileSync ?? execFileSync

  try {
    return browserIDFromValue(run("xdg-settings", ["get", "default-web-browser"], { encoding: "utf8", timeout: 1000 }))
  } catch {
    return undefined
  }
}

function defaultBrowserCandidates(options: ChromeDevtoolsBrowserOptions) {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const fromEnv = [env.OPENCODE_BROWSER_EXECUTABLE, env.BROWSER]
    .flatMap((value) => value?.split(platform === "win32" ? ";" : ":") ?? [])
    .map(commandFromBrowserEnvEntry)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((path) => ({ id: browserIDFromValue(path) ?? "default-browser", path }))

  const defaultBrowserID =
    platform === "win32" ? defaultBrowserIDFromWindowsRegistry(options) : platform === "linux" ? defaultBrowserIDFromLinuxDesktop(options) : undefined
  const fromSystemDefault = defaultBrowserID ? candidatesFromPathEntries(defaultBrowserID, env, platform) : []

  return uniqueCandidates([...fromEnv, ...fromSystemDefault])
}

function orderBySystemDefault(candidates: BrowserCandidate[], options: ChromeDevtoolsBrowserOptions) {
  const defaultCandidates = defaultBrowserCandidates(options)
  const defaultIDs = new Set(defaultCandidates.map((candidate) => candidate.id))

  return uniqueCandidates([
    ...candidates.filter((candidate) => candidate.id === "chrome"),
    ...defaultCandidates,
    ...candidates.filter((candidate) => candidate.id !== "chrome" && defaultIDs.has(candidate.id)),
    ...candidates.filter((candidate) => candidate.id !== "chrome" && !defaultIDs.has(candidate.id)),
  ])
}

export function findBrowserExecutable(options: ChromeDevtoolsBrowserOptions = {}) {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const exists = options.exists ?? existsSync
  const baseCandidates = platform === "win32" ? windowsCandidates(env) : platform === "darwin" ? macCandidates() : linuxCandidates(env, platform)
  const candidates = orderBySystemDefault(baseCandidates, options)

  return candidates.find((candidate) => exists(candidate.path))
}

function truthyEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase())
}

export function shouldUseHeadless(options: ChromeDevtoolsBrowserOptions = {}) {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env

  if (truthyEnv(env.CI) || truthyEnv(env.HEADLESS) || truthyEnv(env.OPENCODE_HEADLESS)) return true
  if (platform === "win32" || platform === "darwin") return false

  return !env.DISPLAY && !env.WAYLAND_DISPLAY && !env.MIR_SOCKET
}

export function defaultUserDataDir(browserID: BrowserID | "default-browser" = "default-browser", options: ChromeDevtoolsBrowserOptions = {}) {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const home = options.home ?? env.HOME ?? env.USERPROFILE ?? homedir()
  const base =
    platform === "win32"
      ? env.LOCALAPPDATA ?? pathJoin(platform, home, "AppData", "Local")
      : platform === "darwin"
        ? pathJoin(platform, home, "Library", "Caches")
        : env.XDG_CACHE_HOME ?? pathJoin(platform, home, ".cache")

  return pathJoin(platform, base, "chrome-devtools-mcp", `${browserID}-profile`)
}

export function buildChromeDevtoolsCommand(options: ChromeDevtoolsBrowserOptions = {}) {
  const browser = findBrowserExecutable(options)
  const command = [...baseCommand]

  if (browser) command.push(`--executablePath=${browser.path}`)

  command.push(`--userDataDir=${defaultUserDataDir(browser?.id ?? "default-browser", options)}`)

  if (shouldUseHeadless(options)) command.push("--headless=true")

  return command
}

export function createChromeDevtoolsBrowserPlugin(defaultOptions: ChromeDevtoolsBrowserOptions = {}): Plugin {
  return async (_input, runtimeOptions?: ChromeDevtoolsBrowserOptions): Promise<Hooks> => {
    const options = { ...defaultOptions, ...runtimeOptions }

    return {
      config: async (cfg: ConfigOutput) => {
        const chromeDevtools = cfg.mcp?.["chrome-devtools"]
        if (!chromeDevtools) return

        chromeDevtools.command = buildChromeDevtoolsCommand(options)
      },
    }
  }
}

export const ChromeDevtoolsBrowserPlugin: Plugin = createChromeDevtoolsBrowserPlugin()

export default ChromeDevtoolsBrowserPlugin
