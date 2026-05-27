import { describe, expect, test } from "bun:test"

import { createDevenvPlugin } from "../plugins/devenv"

describe("devenv plugin", () => {
  test("skips all hooks when devenv is unavailable", async () => {
    const plugin = createDevenvPlugin({ hasDevenv: () => false })

    expect(await plugin({} as never)).toEqual({})
  })

  test("registers shell.env hook when devenv is available", async () => {
    const plugin = createDevenvPlugin({ hasDevenv: () => true })

    const hooks = await plugin({} as never)

    expect(hooks["shell.env"]).toBeFunction()
  })
})
