import type { Model } from "@opencode-ai/sdk"
import type { Hooks, Plugin } from "@opencode-ai/plugin"

type SessionID = string
type InstructionsBySession = Map<SessionID, string>

type OpenAIInstructionsOptions = Record<string, never>

function isOpenAIProviderModel(model: Model) {
  return model.api.npm === "@ai-sdk/openai"
}

function isGPT5OrNewerModel(model: Model) {
  const modelID = model.api.id || model.id
  const match = /^gpt-(\d+)(?:[.-]|$)/i.exec(modelID)

  return match ? Number.parseInt(match[1], 10) >= 5 : false
}

function existingInstructions(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function systemInstructions(system: string[]) {
  return system.filter((item) => item.trim().length > 0).join("\n")
}

export function createOpenAIInstructionsPlugin(defaultOptions: OpenAIInstructionsOptions = {}): Plugin {
  return async (_input, runtimeOptions?: OpenAIInstructionsOptions): Promise<Hooks> => {
    void defaultOptions
    void runtimeOptions

    const instructionsBySession: InstructionsBySession = new Map()

    function shouldInject(model: Model) {
      return isOpenAIProviderModel(model) && isGPT5OrNewerModel(model)
    }

    return {
      "experimental.chat.system.transform": async (input, output) => {
        if (!input.sessionID || !shouldInject(input.model)) return

        const instructions = systemInstructions(output.system)
        if (!instructions) return

        instructionsBySession.set(input.sessionID, instructions)

        // Codex/Responses-style OpenAI endpoints expect system content in the
        // provider-level `instructions` field. Clearing the system array mirrors
        // opencode's built-in OpenAI OAuth workaround and avoids sending the same
        // prompt twice: once as `instructions` and once as system messages.
        output.system.length = 0
      },

      "chat.params": async (input, output) => {
        if (!shouldInject(input.model)) return
        if (existingInstructions(output.options.instructions)) return

        const instructions = instructionsBySession.get(input.sessionID)
        if (!instructions) return

        output.options.instructions = instructions
      },
    }
  }
}

export const OpenAIInstructionsPlugin: Plugin = createOpenAIInstructionsPlugin()

export default OpenAIInstructionsPlugin
