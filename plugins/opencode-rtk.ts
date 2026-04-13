import type { Plugin } from "@opencode-ai/plugin"

const gitGlobalOptionsWithValue = new Set([
  "-c",
  "-C",
  "--exec-path",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--super-prefix",
  "--config-env",
])

function tokenizeShellCommand(command: string) {
  const tokens: string[] = []
  let current = ""
  let quote: '"' | "'" | "" = ""
  let escaping = false
  let index = 0

  const trimmed = command.trim()

  while (index < trimmed.length) {
    const char = trimmed[index]

    if (escaping) {
      current += char
      escaping = false
      index += 1
      continue
    }

    if (char === "\\" && quote !== "'") {
      escaping = true
      index += 1
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = ""
      } else {
        current += char
      }
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      index += 1
      continue
    }

    if (char === ";" || char === "|") {
      if (current) {
        tokens.push(current)
        current = ""
      }

      if (char === "|" && trimmed[index + 1] === "|") {
        tokens.push("||")
        index += 2
        continue
      }

      tokens.push(char)
      index += 1
      continue
    }

    if (char === "&") {
      if (current) {
        tokens.push(current)
        current = ""
      }

      if (trimmed[index + 1] === "&") {
        tokens.push("&&")
        index += 2
        continue
      }

      tokens.push(char)
      index += 1
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      index += 1
      continue
    }

    current += char
    index += 1
  }

  if (current) tokens.push(current)
  return tokens
}

function splitShellCommands(tokens: string[]) {
  const commands: string[][] = []
  let current: string[] = []

  for (const token of tokens) {
    if (token === "&&" || token === "||" || token === ";" || token === "|" || token === "&") {
      if (current.length > 0) commands.push(current)
      current = []
      continue
    }

    current.push(token)
  }

  if (current.length > 0) commands.push(current)
  return commands
}

function parseGitCommand(tokens: string[]) {
  let index = tokens[0] === "command" ? 1 : 0

  if (tokens[index] !== "git") return
  index += 1

  while (index < tokens.length) {
    const token = tokens[index]
    if (!token.startsWith("-")) {
      return {
        subcommand: token,
        args: tokens.slice(index + 1),
      }
    }

    if (gitGlobalOptionsWithValue.has(token)) {
      index += 2
      continue
    }

    if (
      Array.from(gitGlobalOptionsWithValue).some((option) => token.startsWith(`${option}=`))
    ) {
      index += 1
      continue
    }

    index += 1
  }
}

function hasShortOption(args: string[], shortOption: string) {
  return args.some(
    (arg) =>
      arg.startsWith("-") && !arg.startsWith("--") && arg.slice(1).includes(shortOption),
  )
}

export function shouldSkipRtkRewrite(command: string) {
  if (/^\s*rg(?:\s|$)/.test(command)) return true

  for (const shellCommand of splitShellCommands(tokenizeShellCommand(command))) {
    const gitCommand = parseGitCommand(shellCommand)
    if (!gitCommand) continue

    const { subcommand, args } = gitCommand

    if (subcommand === "commit" || subcommand === "diff") return true

    if (subcommand === "status") {
      if (
        hasShortOption(args, "s") ||
        args.some((arg) => arg === "--short" || arg === "--porcelain" || arg.startsWith("--porcelain="))
      ) {
        return true
      }
      continue
    }

    if (subcommand === "log") {
      if (
        args.some(
          (arg) =>
            arg === "--stat" ||
            arg === "--format" ||
            arg.startsWith("--format=") ||
            arg === "--pretty" ||
            arg.startsWith("--pretty="),
        )
      ) {
        return true
      }
    }
  }

  return false
}

// RTK OpenCode plugin — rewrites commands to use rtk for token savings.
// Requires: rtk >= 0.23.0 in PATH.
//
// This is a thin delegating plugin: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.

export const RtkOpenCodePlugin: Plugin = async ({ $ }) => {
  try {
    await $`which rtk`.quiet()
  } catch {
    console.warn("[rtk] rtk binary not found in PATH — plugin disabled")
    return {}
  }

  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input?.tool ?? "").toLowerCase()
      if (tool !== "bash" && tool !== "shell") return
      const args = output?.args
      if (!args || typeof args !== "object") return

      const command = (args as Record<string, unknown>).command
      if (typeof command !== "string" || !command) return
      if (shouldSkipRtkRewrite(command)) return

      try {
        const result = await $`rtk rewrite ${command}`.quiet().nothrow()
        const rewritten = String(result.stdout).trim()
        if (rewritten && rewritten !== command) {
          ;(args as Record<string, unknown>).command = rewritten
        }
      } catch {
        // rtk rewrite failed — pass through unchanged
      }
    },
  }
}
