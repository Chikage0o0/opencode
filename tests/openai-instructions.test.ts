import { describe, expect, test } from "bun:test"

import { createOpenAIInstructionsPlugin } from "../lib/openai-instructions"

const openAIModel = {
  id: "gpt-5.5",
  providerID: "myprovider",
  api: { id: "gpt-5.5", npm: "@ai-sdk/openai" },
} as never

const openAIGPT4Model = {
  id: "gpt-4.1",
  providerID: "myprovider",
  api: { id: "gpt-4.1", npm: "@ai-sdk/openai" },
} as never

const anthropicModel = {
  id: "claude-sonnet-4-6",
  providerID: "anthropic",
  api: { id: "claude-sonnet-4-6", npm: "@ai-sdk/anthropic" },
} as never

async function hooks() {
  return await createOpenAIInstructionsPlugin()({} as never)
}

describe("openai instructions plugin", () => {
  test("passes the transformed system prompt as OpenAI instructions", async () => {
    const plugin = await hooks()
    const system = ["agent prompt", "project instructions"]
    const output = { temperature: 0.3, topP: 1, topK: undefined, maxOutputTokens: 32000, options: {} }

    await plugin["experimental.chat.system.transform"]?.({ sessionID: "s1", model: openAIModel }, { system })
    await plugin["chat.params"]?.(
      { sessionID: "s1", agent: "orchestrator", model: openAIModel, provider: {} as never, message: {} as never },
      output,
    )

    expect(output.options).toEqual({ instructions: "agent prompt\nproject instructions" })
    expect(system).toEqual([])
  })

  test("does not override explicit instructions", async () => {
    const plugin = await hooks()
    const output = {
      temperature: 0.3,
      topP: 1,
      topK: undefined,
      maxOutputTokens: 32000,
      options: { instructions: "explicit" },
    }

    await plugin["experimental.chat.system.transform"]?.(
      { sessionID: "s1", model: openAIModel },
      { system: ["derived"] },
    )
    await plugin["chat.params"]?.(
      { sessionID: "s1", agent: "orchestrator", model: openAIModel, provider: {} as never, message: {} as never },
      output,
    )

    expect(output.options.instructions).toBe("explicit")
  })

  test("only injects instructions for @ai-sdk/openai gpt-5 or newer models", async () => {
    const plugin = await hooks()
    const gpt4Output = { temperature: 0.3, topP: 1, topK: undefined, maxOutputTokens: 32000, options: {} }
    const anthropicOutput = { temperature: 0.3, topP: 1, topK: undefined, maxOutputTokens: 32000, options: {} }

    await plugin["experimental.chat.system.transform"]?.(
      { sessionID: "s1", model: openAIGPT4Model },
      { system: ["gpt-4 prompt"] },
    )
    await plugin["chat.params"]?.(
      { sessionID: "s1", agent: "orchestrator", model: openAIGPT4Model, provider: {} as never, message: {} as never },
      gpt4Output,
    )

    await plugin["experimental.chat.system.transform"]?.(
      { sessionID: "s2", model: anthropicModel },
      { system: ["anthropic prompt"] },
    )
    await plugin["chat.params"]?.(
      { sessionID: "s2", agent: "orchestrator", model: anthropicModel, provider: {} as never, message: {} as never },
      anthropicOutput,
    )

    expect(gpt4Output.options).toEqual({})
    expect(anthropicOutput.options).toEqual({})
  })
})
