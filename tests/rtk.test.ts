import { describe, expect, test } from "bun:test"

import { createRtkOpenCodePlugin } from "../lib/rtk"

describe("RTK plugin", () => {
  test("disables itself when Bun cannot resolve rtk", async () => {
    const originalWarn = console.warn
    const warnings: unknown[][] = []
    console.warn = (...values: unknown[]) => warnings.push(values)
    const plugin = createRtkOpenCodePlugin(() => null)
    try {
      const hooks = await plugin({ $: undefined } as never)

      expect(hooks).toEqual({})
      expect(warnings).toEqual([["[rtk] rtk binary not found in PATH — plugin disabled"]])
    } finally {
      console.warn = originalWarn
    }
  })

  test("checks availability without fixing the resolved executable path", async () => {
    const calls: Array<{ command: string; values: unknown[] }> = []
    const shell = (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ command: strings.join("${}"), values })
      return {
        quiet: () => ({
          nothrow: async () => ({ stdout: "rtk git status" }),
        }),
      }
    }
    const plugin = createRtkOpenCodePlugin(() => "resolved-rtk-path")
    const hooks = await plugin({ $: shell } as never)
    const output = { args: { command: "git status" } }

    await hooks["tool.execute.before"]?.({ tool: "shell" } as never, output as never)

    expect(calls).toEqual([{ command: "rtk rewrite ${}", values: ["git status"] }])
    expect(output.args.command).toBe("rtk git status")
  })
})
