import type { Plugin } from "@opencode-ai/plugin"
import { dirname, join } from "node:path"

const files = ["devenv.nix", "devenv.yaml", "devenv.yml"]
const cache = new Map<string, Promise<Record<string, string>>>()

function devenvEnv(baseEnv: Record<string, string>) {
  return {
    ...baseEnv,
    DEVENV_DIRENVRC_ROLLING_UPGRADE: "1",
    DEVENV_DIRENVRC_VERSION: "2",
    DEVENV_NO_DIRENVRC_OUTDATED_WARNING: "1",
  }
}

async function hasDevenvConfig(dir: string) {
  const hits = await Promise.all(files.map((x) => Bun.file(join(dir, x)).exists()))
  return hits.some(Boolean)
}

async function findDevenvRoot(dir: string) {
  let cur = dir

  while (true) {
    if (await hasDevenvConfig(cur)) return cur

    const up = dirname(cur)
    if (up === cur) return
    cur = up
  }
}

async function loadDirenvExport(dir: string, baseEnv: Record<string, string>) {
  const run = Bun.spawn(["devenv", "direnv-export"], {
    cwd: dir,
    env: devenvEnv(baseEnv),
    stdout: "pipe",
    stderr: "pipe",
  })

  const txt = await new Response(run.stdout).text()
  const err = await new Response(run.stderr).text()
  const code = await run.exited

  if (code !== 0) throw new Error(err || `devenv failed in ${dir}`)

  return txt
}

function direnvExportUnavailable(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes("unrecognized subcommand 'direnv-export'")
}

function parseEnv(txt: string) {
  const keyPattern = /[A-Za-z_][A-Za-z0-9_]*=/

  return Object.fromEntries(
    txt
      .split("\u0000")
      .filter(Boolean)
      .flatMap((entry) => {
        const normalized = keyPattern.test(entry) ? entry.slice(entry.search(keyPattern)) : entry
        const idx = normalized.indexOf("=")
        return idx === -1 ? [] : [[normalized.slice(0, idx), normalized.slice(idx + 1)]]
      }),
  )
}

async function loadQuietShellEnv(dir: string, baseEnv: Record<string, string>) {
  const run = Bun.spawn(["devenv", "--quiet", "shell", "env", "-0"], {
    cwd: dir,
    env: devenvEnv(baseEnv),
    stdout: "pipe",
    stderr: "pipe",
  })

  const txt = await new Response(run.stdout).text()
  const err = await new Response(run.stderr).text()
  const code = await run.exited

  if (code !== 0) throw new Error(err || `failed to load devenv shell environment in ${dir}`)

  return parseEnv(txt)
}

function shellEnv(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      return typeof value === "string" ? [[key, value]] : []
    }),
  )
}

function cacheKey(dir: string, baseEnv: Record<string, string>) {
  const env = Object.entries(baseEnv).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([dir, env])
}

function resolvedEnvScript() {
  return [
    "set -euo pipefail",
    "",
    "nix_restore_var() {",
    '  local key=$1 was_set=$2 value=$3',
    '  if [[ -n "$was_set" ]]; then',
    '    export "$key=$value"',
    "  else",
    '    unset "$key"',
    "  fi",
    "}",
    "",
    'if [[ ! "${DIRENV_ACTIVE-}" =~ (^|:)"$PWD"(:|$) ]]; then',
    '  export DIRENV_ACTIVE="$PWD:${DIRENV_ACTIVE-}"',
    "fi",
    "",
    'old_nix_build_top_set=${NIX_BUILD_TOP+x}',
    'old_tmp_set=${TMP+x}',
    'old_tmpdir_set=${TMPDIR+x}',
    'old_temp_set=${TEMP+x}',
    'old_tempdir_set=${TEMPDIR+x}',
    'old_nix_build_top=${NIX_BUILD_TOP-}',
    'old_tmp=${TMP-}',
    'old_tmpdir=${TMPDIR-}',
    'old_temp=${TEMP-}',
    'old_tempdir=${TEMPDIR-}',
    'old_path=${PATH:-}',
    'old_xdg_data_dirs=${XDG_DATA_DIRS:-}',
    "",
    'eval_stderr=$(mktemp)',
    'if ! eval "$DEVENV_EXPORT" >/dev/null 2>"$eval_stderr"; then',
    '  cat "$eval_stderr" >&2',
    '  rm -f "$eval_stderr"',
    '  exit 1',
    'fi',
    'rm -f "$eval_stderr"',
    'unset DEVENV_EXPORT',
    "",
    'current_nix_build_top=${NIX_BUILD_TOP-}',
    'if [[ -n "${NIX_BUILD_TOP+x}" && "$current_nix_build_top" == */nix-shell.* && -d "$current_nix_build_top" ]]; then',
    '  rm -rf "$current_nix_build_top"',
    "fi",
    "",
    'nix_restore_var NIX_BUILD_TOP "$old_nix_build_top_set" "$old_nix_build_top"',
    'nix_restore_var TMP "$old_tmp_set" "$old_tmp"',
    'nix_restore_var TMPDIR "$old_tmpdir_set" "$old_tmpdir"',
    'nix_restore_var TEMP "$old_temp_set" "$old_temp"',
    'nix_restore_var TEMPDIR "$old_tempdir_set" "$old_tempdir"',
    "",
    'new_path=${PATH:-}',
    'export PATH=',
    'IFS=:',
    'for entry in $new_path${old_path:+:}$old_path; do',
    '  entry="${entry%/}"',
    '  if [[ -z "$entry" || :$PATH: == *:$entry:* ]]; then',
    '    continue',
    '  fi',
    '  PATH="$PATH${PATH:+:}$entry"',
    'done',
    "",
    'new_xdg_data_dirs=${XDG_DATA_DIRS:-}',
    'export XDG_DATA_DIRS=',
    'for entry in $new_xdg_data_dirs${old_xdg_data_dirs:+:}$old_xdg_data_dirs; do',
    '  entry="${entry%/}"',
    '  if [[ -z "$entry" || :$XDG_DATA_DIRS: == *:$entry:* ]]; then',
    '    continue',
    '  fi',
    '  XDG_DATA_DIRS="$XDG_DATA_DIRS${XDG_DATA_DIRS:+:}$entry"',
    'done',
    "",
    'command -p env -0',
  ].join("\n")
}

async function resolveEnv(dir: string, exported: string, baseEnv: Record<string, string>) {
  const run = Bun.spawn(["bash", "-c", resolvedEnvScript()], {
    cwd: dir,
    env: { ...devenvEnv(baseEnv), DEVENV_EXPORT: exported },
    stdout: "pipe",
    stderr: "pipe",
  })

  const txt = await new Response(run.stdout).text()
  const err = await new Response(run.stderr).text()
  const code = await run.exited

  if (code !== 0) throw new Error(err || `failed to resolve devenv environment in ${dir}`)

  return parseEnv(txt)
}

async function loadResolvedEnv(dir: string, baseEnv: Record<string, string>) {
  try {
    return await resolveEnv(dir, await loadDirenvExport(dir, baseEnv), baseEnv)
  } catch (err) {
    if (!direnvExportUnavailable(err)) throw err
    return await loadQuietShellEnv(dir, baseEnv)
  }
}

function applyLoadedEnv(outputEnv: Record<string, string>, loaded: Record<string, string>) {
  for (const key of Object.keys(outputEnv)) {
    if (!(key in loaded)) delete outputEnv[key]
  }

  Object.assign(outputEnv, loaded)
}

export const DevenvPlugin: Plugin = async () => {
  return {
    "shell.env": async (input, output) => {
      const dir = await findDevenvRoot(input.cwd)
      if (!dir) return

      const baseEnv = shellEnv({ ...process.env, ...output.env })

      const key = cacheKey(dir, baseEnv)
      const env =
        cache.get(key) ??
        loadResolvedEnv(dir, baseEnv).catch((err) => {
          cache.delete(key)
          throw err
        })

      cache.set(key, env)
      const loaded = await env

      applyLoadedEnv(output.env, loaded)
    },
  }
}
