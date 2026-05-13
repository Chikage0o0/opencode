#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$script_dir/.." && pwd)
test_file=$(mktemp "${TMPDIR:-/tmp}/devenv-plugin.XXXXXX.test.ts")

cleanup() {
  rm -f "$test_file"
}
trap cleanup EXIT

cat >"$test_file" <<'BUN_TEST'
import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const repoRoot = process.env.REPO_ROOT
if (!repoRoot) throw new Error("REPO_ROOT is required")

const { DevenvPlugin } = await import(pathToFileURL(join(repoRoot, "plugins/devenv.ts")).href)
const originalSpawn = Bun.spawn
const tempDirs: string[] = []

afterEach(() => {
  Bun.spawn = originalSpawn
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

function stream(text: string) {
  return new Response(text).body
}

function fakeProcess(stdout: string, stderr = "", code = 0) {
  return {
    stdout: stream(stdout),
    stderr: stream(stderr),
    exited: Promise.resolve(code),
  }
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "devenv-plugin-"))
  tempDirs.push(root)
  const nested = join(root, "nested", "worktree")
  mkdirSync(nested, { recursive: true })
  writeFileSync(join(root, "devenv.nix"), "{}\n")
  return { root, nested }
}

function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

test("restores temporary variables even when the original value matches legacy sentinel text", async () => {
  const { nested } = project()
  const exportScript = [
    "export NIX_BUILD_TOP=/tmp/nix-shell.devenv-plugin-test",
    "export TMP=/tmp/devenv-tmp",
    "export TMPDIR=/tmp/devenv-tmpdir",
    "export TEMP=/tmp/devenv-temp",
    "export TEMPDIR=/tmp/devenv-tempdir",
  ].join("\n")

  Bun.spawn = ((cmd: string[], options: Parameters<typeof Bun.spawn>[1]) => {
    if (cmd[0] === "devenv") return fakeProcess(exportScript) as never
    return originalSpawn(cmd, options)
  }) as typeof Bun.spawn

  const plugin = await DevenvPlugin()
  const originalTmpdir = tempDir("devenv-plugin-tmpdir-")
  const output = {
    env: {
      NIX_BUILD_TOP: "__UNSET__",
      TMP: "__UNSET__",
      TMPDIR: originalTmpdir,
      TEMP: "/tmp/devenv-original-temp",
      TEMPDIR: "/tmp/devenv-original-tempdir",
    },
  }

  await plugin["shell.env"]({ cwd: nested } as never, output as never)

  expect(output.env.NIX_BUILD_TOP).toBe("__UNSET__")
  expect(output.env.TMP).toBe("__UNSET__")
  expect(output.env.TMPDIR).toBe(originalTmpdir)
  expect(output.env.TEMP).toBe("/tmp/devenv-original-temp")
  expect(output.env.TEMPDIR).toBe("/tmp/devenv-original-tempdir")
})

test("restores empty temporary variable values after evaluating direnv export", async () => {
  const { nested } = project()
  const exportScript = [
    "export TMP=/tmp/devenv-tmp",
    "export TMPDIR=/tmp/devenv-tmpdir",
    "export TEMP=/tmp/devenv-temp",
    "export TEMPDIR=/tmp/devenv-tempdir",
  ].join("\n")

  Bun.spawn = ((cmd: string[], options: Parameters<typeof Bun.spawn>[1]) => {
    if (cmd[0] === "devenv") return fakeProcess(exportScript) as never
    return originalSpawn(cmd, options)
  }) as typeof Bun.spawn

  const plugin = await DevenvPlugin()
  const originalTmpdir = tempDir("devenv-plugin-empty-tmpdir-")
  const output = { env: { TMP: "", TMPDIR: originalTmpdir, TEMP: "", TEMPDIR: "" } }

  await plugin["shell.env"]({ cwd: nested } as never, output as never)

  expect(output.env.TMP).toBe("")
  expect(output.env.TMPDIR).toBe(originalTmpdir)
  expect(output.env.TEMP).toBe("")
  expect(output.env.TEMPDIR).toBe("")
})

test("falls back to quiet shell env when direnv-export is unavailable", async () => {
  const { nested } = project()
  const calls: string[][] = []

  Bun.spawn = ((cmd: string[], _options: Parameters<typeof Bun.spawn>[1]) => {
    calls.push(cmd)
    if (cmd[1] === "direnv-export") return fakeProcess("", "error: unrecognized subcommand 'direnv-export'", 1) as never
    return fakeProcess("FALLBACK=ok\u0000PATH=/fallback/bin\u0000") as never
  }) as typeof Bun.spawn

  const plugin = await DevenvPlugin()
  const output = { env: {} as Record<string, string> }

  await plugin["shell.env"]({ cwd: nested } as never, output as never)

  expect(calls).toEqual([
    ["devenv", "direnv-export"],
    ["devenv", "--quiet", "shell", "env", "-0"],
  ])
  expect(output.env.FALLBACK).toBe("ok")
  expect(output.env.PATH).toBe("/fallback/bin")
})
BUN_TEST

REPO_ROOT="$repo_root" bun test "$test_file"
