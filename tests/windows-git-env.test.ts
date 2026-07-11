import { describe, expect, test } from "bun:test"

import {
  applyPreferredPath,
  detectWindowsGitEnvironment,
  prioritizeWindowsPath,
} from "../lib/windows-git-env"

function fakeFileSystem(paths: string[]): (candidate: string) => boolean {
  const existing = new Set(paths.map((candidate) => candidate.toLowerCase()))
  return (candidate) => existing.has(candidate.toLowerCase())
}

describe("Windows Git environment", () => {
  test("does nothing outside Windows", () => {
    const detected = detectWindowsGitEnvironment({
      platform: "linux",
      env: { GIT_HOME: "C:\\Git" },
      exists: () => true,
    })

    expect(detected).toBeUndefined()
  })

  test("detects Scoop Git and keeps Git Bash bin first", () => {
    const home = "C:\\Users\\tester\\scoop\\apps\\git\\current"
    const detected = detectWindowsGitEnvironment({
      platform: "win32",
      env: { USERPROFILE: "C:\\Users\\tester" },
      exists: fakeFileSystem([
        `${home}\\bin`,
        `${home}\\bin\\bash.exe`,
        `${home}\\bin\\git.exe`,
        `${home}\\cmd`,
        `${home}\\mingw64\\bin`,
        `${home}\\usr\\bin`,
      ]),
    })

    expect(detected).toEqual({
      home,
      bash: `${home}\\bin\\bash.exe`,
      pathEntries: [`${home}\\bin`, `${home}\\cmd`, `${home}\\mingw64\\bin`, `${home}\\usr\\bin`],
    })
  })

  test("infers Git home from an existing Path entry", () => {
    const home = "D:\\Portable\\Git"
    const detected = detectWindowsGitEnvironment({
      platform: "win32",
      env: { Path: `C:\\Windows\\System32;${home}\\cmd` },
      exists: fakeFileSystem([
        `${home}\\bin`,
        `${home}\\bin\\bash.exe`,
        `${home}\\cmd`,
        `${home}\\cmd\\git.exe`,
      ]),
    })

    expect(detected?.home).toBe(home)
    expect(detected?.bash).toBe(`${home}\\bin\\bash.exe`)
  })

  test("moves preferred entries ahead of System32 and removes duplicates", () => {
    const result = prioritizeWindowsPath(
      "C:\\Windows\\System32;C:\\Git\\BIN;C:\\Tools;",
      ["C:\\Git\\bin", "C:\\Git\\cmd"],
    )

    expect(result.split(";")).toEqual([
      "C:\\Git\\bin",
      "C:\\Git\\cmd",
      "C:\\Windows\\System32",
      "C:\\Tools",
    ])
  })

  test("preserves a Path supplied by an earlier shell environment hook", () => {
    const processEnv = {
      Path: "C:\\Windows\\System32;C:\\ParentTools",
      TEMP: "C:\\ParentTemp",
    }
    const shellEnv = {
      PATH: "C:\\DirenvTools;C:\\Windows\\System32",
      PROJECT_TOKEN: "temporary",
    }

    applyPreferredPath(processEnv, shellEnv, ["C:\\Git\\bin", "C:\\Git\\cmd"])

    expect(shellEnv).toEqual({
      PATH: "C:\\Git\\bin;C:\\Git\\cmd;C:\\DirenvTools;C:\\Windows\\System32",
      PROJECT_TOKEN: "temporary",
    })
    expect(processEnv).toEqual({
      Path: "C:\\Windows\\System32;C:\\ParentTools",
      TEMP: "C:\\ParentTemp",
    })
  })

  test("falls back to the inherited process Path without copying unrelated variables", () => {
    const processEnv = {
      Path: "C:\\Windows\\System32;C:\\ParentTools",
      TEMP: "C:\\ParentTemp",
    }
    const shellEnv: Record<string, string> = {}

    applyPreferredPath(processEnv, shellEnv, ["C:\\Git\\bin"])

    expect(shellEnv).toEqual({
      Path: "C:\\Git\\bin;C:\\Windows\\System32;C:\\ParentTools",
    })
  })
})
