import type { Plugin } from "@opencode-ai/plugin"

type ResolveExecutable = (command: string) => string | null

export function createRtkOpenCodePlugin(
  resolveExecutable: ResolveExecutable = Bun.which,
): Plugin {
  return async ({ $ }) => {
    // Bun.which 同时识别 Windows 的 PATHEXT 和 Unix 可执行文件，避免依赖外部 `which`。
    if (!resolveExecutable("rtk")) {
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

        try {
          const result = await $`rtk rewrite ${command}`.quiet().nothrow()
          const rewritten = String(result.stdout).trim()
          if (rewritten && rewritten !== command) {
            (args as Record<string, unknown>).command = rewritten
          }
        } catch {
          // rtk rewrite failed — pass through unchanged
        }
      },
    }
  }
}
