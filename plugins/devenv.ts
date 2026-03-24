import type { Plugin } from "@opencode-ai/plugin"
import { dirname, join } from "node:path"

const files = ["devenv.nix", "devenv.yaml", "devenv.yml"]
const cache = new Map<string, Promise<string>>()

function devenvEnv(baseEnv: Record<string, string>) {
  return {
    ...baseEnv,
    DEVENV_DIRENVRC_ROLLING_UPGRADE: "1",
    DEVENV_DIRENVRC_VERSION: "2",
    DEVENV_NO_DIRENVRC_OUTDATED_WARNING: "1",
  }
}

async function match(dir: string) {
  const hits = await Promise.all(files.map((x) => Bun.file(join(dir, x)).exists()))
  return hits.some(Boolean)
}

async function root(dir: string) {
  let cur = dir

  while (true) {
    if (await match(cur)) return cur

    const up = dirname(cur)
    if (up === cur) return
    cur = up
  }
}

async function load(dir: string, baseEnv: Record<string, string>) {
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

function shellEnv(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      return typeof value === "string" ? [[key, value]] : []
    }),
  )
}

async function resolveEnv(dir: string, exported: string, baseEnv: Record<string, string>) {
  const script = [
    "set -euo pipefail",
    "",
    "nix_export_or_unset() {",
    '  local key=$1 value=$2',
    '  if [[ "$value" == __UNSET__ ]]; then',
    '    unset "$key"',
    "  else",
    '    export "$key=$value"',
    "  fi",
    "}",
    "",
    'if [[ ! "${DIRENV_ACTIVE-}" =~ (^|:)"$PWD"(:|$) ]]; then',
    '  export DIRENV_ACTIVE="$PWD:${DIRENV_ACTIVE-}"',
    "fi",
    "",
    'old_nix_build_top=${NIX_BUILD_TOP:-__UNSET__}',
    'old_tmp=${TMP:-__UNSET__}',
    'old_tmpdir=${TMPDIR:-__UNSET__}',
    'old_temp=${TEMP:-__UNSET__}',
    'old_tempdir=${TEMPDIR:-__UNSET__}',
    'old_path=${PATH:-}',
    'old_xdg_data_dirs=${XDG_DATA_DIRS:-}',
    "",
    'eval "$DEVENV_EXPORT"',
    'unset DEVENV_EXPORT',
    "",
    'current_nix_build_top=${NIX_BUILD_TOP-}',
    'if [[ -n "${NIX_BUILD_TOP+x}" && "$current_nix_build_top" == */nix-shell.* && -d "$current_nix_build_top" ]]; then',
    '  rm -rf "$current_nix_build_top"',
    "fi",
    "",
    'nix_export_or_unset NIX_BUILD_TOP "$old_nix_build_top"',
    'nix_export_or_unset TMP "$old_tmp"',
    'nix_export_or_unset TMPDIR "$old_tmpdir"',
    'nix_export_or_unset TEMP "$old_temp"',
    'nix_export_or_unset TEMPDIR "$old_tempdir"',
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

  const run = Bun.spawn(["bash", "-c", script], {
    cwd: dir,
    env: { ...devenvEnv(baseEnv), DEVENV_EXPORT: exported },
    stdout: "pipe",
    stderr: "pipe",
  })

  const txt = await new Response(run.stdout).text()
  const err = await new Response(run.stderr).text()
  const code = await run.exited

  if (code !== 0) throw new Error(err || `failed to resolve devenv environment in ${dir}`)

  return Object.fromEntries(
    txt
      .split("\u0000")
      .filter(Boolean)
      .flatMap((entry) => {
        const idx = entry.indexOf("=")
        return idx === -1 ? [] : [[entry.slice(0, idx), entry.slice(idx + 1)]]
      }),
  )
}

export const DevenvPlugin: Plugin = async () => {
  return {
    "shell.env": async (input, output) => {
      const dir = await root(input.cwd)
      if (!dir) return

      const baseEnv = shellEnv({ ...process.env, ...output.env })

      const env =
        cache.get(dir) ??
        load(dir, baseEnv).catch((err) => {
          cache.delete(dir)
          throw err
        })

      cache.set(dir, env)

      const loaded = await resolveEnv(dir, await env, baseEnv)

      for (const key of Object.keys(output.env)) {
        if (!(key in loaded)) delete output.env[key]
      }

      Object.assign(output.env, loaded)
    },
  }
}
