import { describe, expect, test } from "bun:test"

import { createWindowsGitEnvPlugin, findGitForWindowsHome } from "../lib/windows-git-env"

const gitHome = "C:\\Users\\me\\scoop\\apps\\git\\current"
const existingPaths = new Set([`${gitHome}\\bin\\bash.exe`, `${gitHome}\\cmd\\git.exe`].map((path) => path.toLowerCase()))
const exists = (path: string) => existingPaths.has(path.toLowerCase())

async function hooks() {
  return await createWindowsGitEnvPlugin({
    platform: "win32",
    env: { Path: `C:\\Users\\me\\scoop\\shims;${gitHome}\\cmd;C:\\Windows\\System32` },
    exists,
  })({} as never)
}

describe("Windows Git environment", () => {
  test("discovers Git for Windows from PATH on Windows", () => {
    expect(
      findGitForWindowsHome({
        env: { Path: `C:\\Users\\me\\scoop\\shims;${gitHome}\\cmd;C:\\Windows\\System32` },
        exists,
      }),
    ).toBe(gitHome)
  })

  test("makes Git for Windows executables win PATH lookup before shims and WSL bash", async () => {
    const plugin = await hooks()
    const output = {
      env: {
        Path: "C:\\Users\\chika\\scoop\\shims;C:\\Windows\\System32",
      },
    }

    await plugin["shell.env"]?.({ cwd: process.cwd() }, output)

    const pathEntries = output.env.Path.split(";")

    expect(pathEntries.slice(0, 4)).toEqual([
      `${gitHome}\\cmd`,
      `${gitHome}\\mingw64\\bin`,
      `${gitHome}\\usr\\bin`,
      `${gitHome}\\bin`,
    ])
    expect(pathEntries.indexOf(`${gitHome}\\cmd`)).toBeLessThan(pathEntries.indexOf("C:\\Users\\chika\\scoop\\shims"))
    expect(pathEntries.indexOf(`${gitHome}\\bin`)).toBeLessThan(pathEntries.indexOf("C:\\Windows\\System32"))
    expect(output.env.GIT_EXEC_PATH).toBe(`${gitHome}\\mingw64\\libexec\\git-core`)
  })

  test("sets opencode default shell to discovered Git Bash without opencode.json hardcoding", async () => {
    const plugin = await hooks()
    const config = (await Bun.file("opencode.json").json()) as { shell?: string }
    const output: { shell?: string } = {}

    await plugin.config?.(output)

    expect(config.shell).toBeUndefined()
    expect(output.shell).toBe(`${gitHome}\\bin\\bash.exe`)
  })
})
