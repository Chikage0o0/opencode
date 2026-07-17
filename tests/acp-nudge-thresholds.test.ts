import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PluginConfig } from "../vendor/opencode-acp/lib/config";
import { VALID_CONFIG_KEYS } from "../vendor/opencode-acp/lib/config-validation";
import { Logger } from "../vendor/opencode-acp/lib/logger";
import { injectCompressNudges } from "../vendor/opencode-acp/lib/messages/inject/inject";
import type { RuntimePrompts } from "../vendor/opencode-acp/lib/prompts/store";
import {
  drainSessionStateWrites,
  saveSessionState,
} from "../vendor/opencode-acp/lib/state/persistence";
import {
  createSessionState,
  ensureSessionInitialized,
} from "../vendor/opencode-acp/lib/state/state";
import type { WithParts } from "../vendor/opencode-acp/lib/state/types";

const SESSION_ID = "ses-nudge-thresholds";
const logger = new Logger(false);

const prompts: RuntimePrompts = {
  system: "",
  compressRange: "",
  compressMessage: "",
  contextLimitNudge: "CTX_LIMIT_MARKER",
  turnNudge: "TURN_NUDGE_MARKER",
  iterationNudge: "ITERATION_NUDGE_MARKER",
  manualExtension: "",
  subagentExtension: "",
  decompressExtension: "",
};

function buildConfig(mode: "range" | "message" = "range"): PluginConfig {
  return {
    enabled: true,
    autoUpdate: false,
    debug: false,
    pruneNotification: "off",
    pruneNotificationType: "chat",
    commands: { enabled: true, protectedTools: [] },
    manualMode: { enabled: false, automaticStrategies: true },
    turnProtection: { enabled: false, turns: 4 },
    experimental: { allowSubAgents: false, customPrompts: false },
    protectedFilePatterns: [],
    compress: {
      mode,
      permission: "allow",
      showCompression: false,
      summaryBuffer: false,
      maxContextLimit: 160_000,
      minContextLimit: 80_000,
      nudgeFrequency: 5,
      iterationNudgeThreshold: 15,
      nudgeForce: "soft",
      protectedTools: [],
      protectTags: false,
      protectUserMessages: false,
      maxSummaryLengthHard: 10_000,
      minCompressRange: 5_000,
      maxVisibleSegments: 50,
      keepEmbedMaxChars: 2_000,
    },
    strategies: {
      deduplication: { enabled: true, protectedTools: [] },
      purgeErrors: { enabled: true, turns: 4, protectedTools: [] },
    },
    gc: {
      algorithm: "truncate",
      promotionThreshold: 5,
      maxBlockAge: 15,
      maxOldGenSummaryLength: 3_000,
      majorGcThresholdPercent: "100%",
      batchCleanup: {
        lowThreshold: "55%",
        highThreshold: "75%",
        forceThreshold: "90%",
      },
    },
  };
}

function textPart(messageId: string, text: string) {
  return {
    id: `${messageId}-part`,
    messageID: messageId,
    sessionID: SESSION_ID,
    type: "text" as const,
    text,
  };
}

function userMessage(id: string, text: string, created: number): WithParts {
  return {
    info: {
      id,
      role: "user",
      sessionID: SESSION_ID,
      agent: "build",
      model: { providerID: "test", modelID: "test-model" },
      time: { created },
    } as WithParts["info"],
    parts: [textPart(id, text)],
  };
}

function assistantMessage(
  id: string,
  currentTokens: number,
  created: number,
): WithParts {
  return {
    info: {
      id,
      role: "assistant",
      sessionID: SESSION_ID,
      agent: "build",
      time: { created },
      tokens: { input: currentTokens, output: 0 },
    } as WithParts["info"],
    parts: [textPart(id, "done")],
  };
}

function turnAt(currentTokens: number, idSuffix = ""): WithParts[] {
  return [
    userMessage(`u1${idSuffix}`, "work", 1),
    assistantMessage(`a1${idSuffix}`, currentTokens, 2),
    userMessage(`u2${idSuffix}`, "continue", 3),
  ];
}

function completedTurnsAt(
  currentTokens: number,
  assistantCount: number,
): WithParts[] {
  const messages: WithParts[] = [userMessage("u1", "work", 1)];
  for (let index = 1; index <= assistantCount; index++) {
    messages.push(assistantMessage(`a${index}`, currentTokens, index * 2));
    messages.push(userMessage(`u${index + 1}`, "continue", index * 2 + 1));
  }
  return messages;
}

function assistantIterationAt(currentTokens: number): WithParts[] {
  return assistantIterationsAt(currentTokens, 1);
}

function assistantIterationsAt(
  currentTokens: number,
  assistantCount: number,
): WithParts[] {
  return [
    userMessage("u1", "work", 1),
    ...Array.from({ length: assistantCount }, (_, index) =>
      assistantMessage(`a${index + 1}`, currentTokens, index + 2),
    ),
  ];
}

function messageText(messages: WithParts[]): string {
  return messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

describe("ACP threshold-only compression reminders", () => {
  test("does not inject a reminder below minContextLimit", () => {
    const state = createSessionState();
    state.modelContextLimit = 500_000;
    const baselineMessages = turnAt(1_000, "-baseline");
    injectCompressNudges(
      state,
      buildConfig(),
      logger,
      baselineMessages,
      prompts,
    );

    state.nudges.contextLimitAnchors.add("old-context");
    state.nudges.turnNudgeAnchors.add("old-turn");
    state.nudges.iterationNudgeAnchors.add("old-iteration");
    const messages = turnAt(79_999);

    injectCompressNudges(state, buildConfig(), logger, messages, prompts);

    expect(messages).toHaveLength(3);
    expect(messageText(messages)).not.toContain("NUDGE_MARKER");
    expect(state.nudges.contextLimitAnchors.size).toBe(0);
    expect(state.nudges.turnNudgeAnchors.size).toBe(0);
    expect(state.nudges.iterationNudgeAnchors.size).toBe(0);
  });

  test("keeps message-mode turn reminders constant instead of replaying all anchors", () => {
    const state = createSessionState();
    state.modelContextLimit = 500_000;

    for (let turnCount = 1; turnCount <= 3; turnCount++) {
      const messages = completedTurnsAt(80_000, turnCount);
      injectCompressNudges(
        state,
        buildConfig("message"),
        logger,
        messages,
        prompts,
      );
      const markerCount =
        messageText(messages).split("TURN_NUDGE_MARKER").length - 1;
      expect(markerCount).toBe(1);
    }

    expect(state.nudges.turnNudgeAnchors.size).toBe(6);
  });

  test("injects a turn reminder exactly at minContextLimit without a growth baseline", () => {
    const state = createSessionState();
    state.modelContextLimit = 500_000;
    const messages = turnAt(80_000);

    injectCompressNudges(state, buildConfig(), logger, messages, prompts);

    expect(messageText(messages)).toContain("TURN_NUDGE_MARKER");
    expect(messageText(messages)).not.toContain("CTX_LIMIT_MARKER");
    expect(state.nudges.turnNudgeAnchors.size).toBe(2);

    const repeatedMessages = turnAt(80_000);
    injectCompressNudges(
      state,
      buildConfig(),
      logger,
      repeatedMessages,
      prompts,
    );
    expect(messageText(repeatedMessages)).not.toContain("NUDGE_MARKER");
  });

  test("does not pre-mark the current threshold turn during session initialization", async () => {
    const originalDataHome = process.env.XDG_DATA_HOME;
    const temporaryDataHome = await mkdtemp(
      join(tmpdir(), "acp-nudge-thresholds-"),
    );

    try {
      process.env.XDG_DATA_HOME = temporaryDataHome;
      const state = createSessionState();
      state.modelContextLimit = 500_000;
      const messages = turnAt(80_000);
      const client = { session: { get: async () => ({ data: {} }) } };

      await ensureSessionInitialized(
        client,
        state,
        SESSION_ID,
        logger,
        messages,
        false,
        buildConfig(),
      );

      expect(state.nudges.turnNudgeAnchors.size).toBe(0);
      state.sessionId = null;
      injectCompressNudges(state, buildConfig(), logger, messages, prompts);
      expect(messageText(messages)).toContain("TURN_NUDGE_MARKER");
    } finally {
      if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
      else process.env.XDG_DATA_HOME = originalDataHome;
      await rm(temporaryDataHome, { recursive: true, force: true });
    }
  });

  test("loads old growth state safely and strips it on the next save", async () => {
    const originalDataHome = process.env.XDG_DATA_HOME;
    const temporaryDataHome = await mkdtemp(
      join(tmpdir(), "acp-old-growth-state-"),
    );
    const sessionId = `${SESSION_ID}-old-state`;

    try {
      process.env.XDG_DATA_HOME = temporaryDataHome;
      const storageDirectory = join(
        temporaryDataHome,
        "opencode",
        "storage",
        "plugin",
        "acp",
      );
      const statePath = join(storageDirectory, `${sessionId}.json`);
      await mkdir(storageDirectory, { recursive: true });
      await writeFile(
        statePath,
        JSON.stringify({
          prune: {
            tools: {},
            messages: {
              byMessageId: {},
              blocksById: {},
              activeBlockIds: [],
              activeByAnchorMessageId: {},
              nextBlockId: 1,
              nextRunId: 1,
            },
          },
          nudges: {
            contextLimitAnchors: [],
            turnNudgeAnchors: [],
            iterationNudgeAnchors: [],
            lastPerMessageNudgeTurn: 3,
            lastPerMessageNudgeTokens: 42_000,
            lastNudgeShownTokens: 41_000,
            lastToolOutputNudgeTokens: 40_000,
            compressBaselineSet: true,
          },
          stats: { pruneTokenCounter: 0, totalPruneTokens: 0 },
        }),
      );

      const state = createSessionState();
      const client = { session: { get: async () => ({ data: {} }) } };
      await ensureSessionInitialized(
        client,
        state,
        sessionId,
        logger,
        assistantIterationAt(1_000),
        false,
        buildConfig(),
      );

      expect(Object.keys(state.nudges).sort()).toEqual([
        "contextLimitAnchors",
        "iterationNudgeAnchors",
        "turnNudgeAnchors",
      ]);

      await saveSessionState(state, logger);
      await drainSessionStateWrites(sessionId);
      const persisted = JSON.parse(await readFile(statePath, "utf8"));
      expect(Object.keys(persisted.nudges).sort()).toEqual([
        "contextLimitAnchors",
        "iterationNudgeAnchors",
        "turnNudgeAnchors",
      ]);
    } finally {
      await drainSessionStateWrites(sessionId).catch(() => undefined);
      if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
      else process.env.XDG_DATA_HOME = originalDataHome;
      await rm(temporaryDataHome, { recursive: true, force: true });
    }
  });

  test("does not treat maxContextLimit itself as over the maximum", () => {
    const state = createSessionState();
    state.modelContextLimit = 500_000;
    const messages = assistantIterationAt(160_000);

    injectCompressNudges(state, buildConfig(), logger, messages, prompts);

    expect(messageText(messages)).not.toContain("CTX_LIMIT_MARKER");
    expect(state.nudges.contextLimitAnchors.size).toBe(0);
  });

  test("injects the strong reminder above maxContextLimit only when its anchor is due", () => {
    const state = createSessionState();
    state.modelContextLimit = 500_000;
    const messages = assistantIterationAt(160_001);

    injectCompressNudges(state, buildConfig(), logger, messages, prompts);

    expect(messageText(messages)).toContain("CTX_LIMIT_MARKER");
    expect(messageText(messages)).toContain(
      "Context limit reached — compress now",
    );
    expect(state.nudges.contextLimitAnchors.size).toBe(1);

    const repeatedMessages = assistantIterationAt(160_001);
    injectCompressNudges(
      state,
      buildConfig(),
      logger,
      repeatedMessages,
      prompts,
    );
    expect(messageText(repeatedMessages)).not.toContain("CTX_LIMIT_MARKER");
    expect(messageText(repeatedMessages)).not.toContain(
      "Context limit reached — compress now",
    );
  });

  test("repeats the max reminder only after nudgeFrequency new messages", () => {
    const state = createSessionState();
    state.modelContextLimit = 500_000;

    const firstMessages = assistantIterationsAt(160_001, 1);
    injectCompressNudges(state, buildConfig(), logger, firstMessages, prompts);
    expect(messageText(firstMessages)).toContain("CTX_LIMIT_MARKER");

    const beforeInterval = assistantIterationsAt(160_001, 5);
    injectCompressNudges(state, buildConfig(), logger, beforeInterval, prompts);
    expect(messageText(beforeInterval)).not.toContain("CTX_LIMIT_MARKER");

    const atInterval = assistantIterationsAt(160_001, 6);
    injectCompressNudges(state, buildConfig(), logger, atInterval, prompts);
    expect(messageText(atInterval)).toContain("CTX_LIMIT_MARKER");
    expect(state.nudges.contextLimitAnchors.size).toBe(2);
  });

  test("uses iteration cadence above minContextLimit without token growth state", () => {
    const state = createSessionState();
    state.modelContextLimit = 500_000;

    const firstMessages = assistantIterationsAt(80_000, 15);
    injectCompressNudges(state, buildConfig(), logger, firstMessages, prompts);
    expect(messageText(firstMessages)).toContain("ITERATION_NUDGE_MARKER");

    const beforeInterval = assistantIterationsAt(80_000, 19);
    injectCompressNudges(state, buildConfig(), logger, beforeInterval, prompts);
    expect(messageText(beforeInterval)).not.toContain("ITERATION_NUDGE_MARKER");

    const atInterval = assistantIterationsAt(80_000, 20);
    injectCompressNudges(state, buildConfig(), logger, atInterval, prompts);
    expect(messageText(atInterval)).toContain("ITERATION_NUDGE_MARKER");
    expect(state.nudges.iterationNudgeAnchors.size).toBe(2);
  });

  test("removes all growth-only configuration and state fields", () => {
    const removedKeys = [
      "compress.minNudgeContextPercent",
      "compress.nudgeGrowthTokens",
      "compress.toolOutputNudgeThreshold",
      "compress.minNudgeGrowthRatio",
      "compress.minNudgeGrowthFloor",
      "compress.emergencyThresholdPercent",
    ];

    for (const key of removedKeys) {
      expect(VALID_CONFIG_KEYS.has(key)).toBe(false);
    }

    expect(Object.keys(createSessionState().nudges).sort()).toEqual([
      "contextLimitAnchors",
      "iterationNudgeAnchors",
      "turnNudgeAnchors",
    ]);
  });
});
