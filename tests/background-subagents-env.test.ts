import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const flagName = "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS"

describe("background subagents experimental flag", () => {
  test("is enabled in the local development environment", () => {
    const devenv = readFileSync("devenv.nix", "utf8")

    expect(devenv).toContain(`env.${flagName} = "true"`)
  })

  test("is documented as a user environment variable", () => {
    const readme = readFileSync("README.md", "utf8")

    expect(readme).toContain(flagName)
    expect(readme).toContain("用户环境变量")
    expect(readme.toLowerCase()).toContain("background subagent")
  })
})
