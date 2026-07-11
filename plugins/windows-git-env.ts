import type { Plugin } from "@opencode-ai/plugin"

import {
  applyPreferredPath,
  detectWindowsGitEnvironment,
} from "../lib/windows-git-env"

const WindowsGitEnvironmentPlugin: Plugin = async () => {
  const git = detectWindowsGitEnvironment()
  if (!git) return {}

  return {
    config: async (config) => {
      if (!config.shell) config.shell = git.bash
    },
    "shell.env": async (_input, output) => {
      applyPreferredPath(process.env, output.env, git.pathEntries)
    },
  }
}

export default WindowsGitEnvironmentPlugin
