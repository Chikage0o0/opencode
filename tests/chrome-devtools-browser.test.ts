import { describe, expect, test } from "bun:test"

import {
  buildChromeDevtoolsCommand,
  createChromeDevtoolsBrowserPlugin,
  findBrowserExecutable,
  shouldUseHeadless,
} from "../plugins/chrome-devtools-browser"

describe("Chrome DevTools browser plugin", () => {
  test("finds Chrome before Edge on Windows", () => {
    const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    const edge = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    const existing = new Set([chrome.toLowerCase(), edge.toLowerCase()])

    expect(
      findBrowserExecutable({
        platform: "win32",
        env: { ProgramFiles: "C:\\Program Files" },
        exists: (path) => existing.has(path.toLowerCase()),
      }),
    ).toEqual({ id: "chrome", path: chrome })
  })

  test("falls back to Edge on Windows when Chrome is missing", () => {
    const edge = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"

    expect(
      findBrowserExecutable({
        platform: "win32",
        env: { ProgramFiles: "C:\\Program Files" },
        exists: (path) => path.toLowerCase() === edge.toLowerCase(),
      }),
    ).toEqual({ id: "edge", path: edge })
  })

  test("prefers the detected default browser after Chrome is missing", () => {
    const chromium = "/usr/bin/chromium"
    const edge = "/usr/bin/microsoft-edge-stable"
    const existing = new Set([chromium, edge])

    expect(
      findBrowserExecutable({
        platform: "linux",
        env: { PATH: "/usr/bin" },
        exists: (path) => existing.has(path),
        execFileSync: () => "microsoft-edge.desktop",
      }),
    ).toEqual({ id: "edge", path: edge })
  })

  test("uses explicit browser env as the default-browser fallback", () => {
    const browser = "/opt/custom-browser/browser"

    expect(
      findBrowserExecutable({
        platform: "linux",
        env: { BROWSER: browser },
        exists: (path) => path === browser,
        execFileSync: () => {
          throw new Error("xdg-settings unavailable")
        },
      }),
    ).toEqual({ id: "default-browser", path: browser })
  })

  test("uses headless automatically on Linux without a display", () => {
    expect(shouldUseHeadless({ platform: "linux", env: {} })).toBe(true)
  })

  test("keeps default command and userDataDir when no browser is found", () => {
    const command = buildChromeDevtoolsCommand({
      platform: "linux",
      env: { HOME: "/home/me", DISPLAY: ":0" },
      exists: () => false,
    })

    expect(command).toEqual(["bunx", "-y", "chrome-devtools-mcp@latest", "--userDataDir=/home/me/.cache/chrome-devtools-mcp/default-browser-profile"])
  })

  test("config hook rewrites chrome-devtools mcp only", async () => {
    const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    const hooks = await createChromeDevtoolsBrowserPlugin({
      platform: "win32",
      env: { ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" },
      exists: (path) => path.toLowerCase() === chrome.toLowerCase(),
    })({} as never)
    const cfg = {
      mcp: {
        "chrome-devtools": { type: "local", command: ["bunx", "-y", "chrome-devtools-mcp@latest"] },
        other: { type: "local", command: ["other"] },
      },
    }

    await hooks.config?.(cfg)

    expect(cfg.mcp["chrome-devtools"].command).toEqual([
      "bunx",
      "-y",
      "chrome-devtools-mcp@latest",
      `--executablePath=${chrome}`,
      "--userDataDir=C:\\Users\\me\\AppData\\Local\\chrome-devtools-mcp\\chrome-profile",
    ])
    expect(cfg.mcp.other.command).toEqual(["other"])
  })
})
