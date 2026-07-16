import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "../vendor/opencode-acp/lib/logger";
import {
  drainSessionStateWrites,
  ensureStorageDir,
  loadSessionState,
  saveSessionState,
} from "../vendor/opencode-acp/lib/state/persistence";
import { createSessionState } from "../vendor/opencode-acp/lib/state/state";
import { createKeyedWriteQueue } from "../vendor/opencode-acp/lib/state/write-queue";

const temporaryRoots: string[] = [];
const originalDataHome = process.env.XDG_DATA_HOME;

afterEach(async () => {
  await drainSessionStateWrites().catch(() => undefined);

  if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalDataHome;

  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("ACP persistence write queue", () => {
  test("serializes one key while keeping different keys concurrent", async () => {
    const queue = createKeyedWriteQueue();
    const calls: string[] = [];
    let releaseFirst!: () => void;
    let startOther!: () => void;
    const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
    const otherStarted = new Promise<void>((resolve) => (startOther = resolve));

    const first = queue.run("session-a", async () => {
      calls.push("a1:start");
      await firstGate;
      calls.push("a1:end");
    });
    const second = queue.run("session-a", async () => {
      calls.push("a2");
    });
    const other = queue.run("session-b", async () => {
      calls.push("b");
      startOther();
    });

    await otherStarted;
    expect(calls).toEqual(["a1:start", "b"]);
    releaseFirst();
    await Promise.all([first, second, other]);
    expect(calls).toEqual(["a1:start", "b", "a1:end", "a2"]);
  });

  test("continues after a failed write and drains the latest tail", async () => {
    const queue = createKeyedWriteQueue();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
    let secondFinished = false;

    const first = queue.run("session-a", async () => {
      await firstGate;
      throw new Error("first write failed");
    });
    const second = queue.run("session-a", async () => {
      secondFinished = true;
    });
    const drain = queue.drain("session-a");

    await Promise.resolve();
    expect(secondFinished).toBe(false);
    releaseFirst();
    await expect(first).rejects.toThrow("first write failed");
    await drain;
    await second;
    expect(secondFinished).toBe(true);
  });

  test("reports a terminal write failure through drain and then consumes it", async () => {
    const queue = createKeyedWriteQueue();
    const write = queue.run("session-a", async () => {
      throw new Error("terminal write failed");
    });

    await expect(write).rejects.toThrow("terminal write failed");
    await expect(queue.drain("session-a")).rejects.toThrow(
      "terminal write failed",
    );
    await expect(queue.drain("session-a")).resolves.toBeUndefined();
  });

  test("captures mutable state before the first await and leaves no temporary file", async () => {
    const dataHome = await mkdtemp(join(tmpdir(), "opencode-acp-persistence-"));
    temporaryRoots.push(dataHome);
    process.env.XDG_DATA_HOME = dataHome;

    const state = createSessionState();
    state.sessionId = "session-snapshot";
    state.stats.totalPruneTokens = 10;

    const save = saveSessionState(state, new Logger(false));
    state.stats.totalPruneTokens = 99;
    await save;
    await drainSessionStateWrites();

    const storageDir = join(dataHome, "opencode", "storage", "plugin", "acp");
    const persisted = JSON.parse(
      await readFile(join(storageDir, "session-snapshot.json"), "utf8"),
    );
    expect(persisted.stats.totalPruneTokens).toBe(10);
    expect(
      (await readdir(storageDir)).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
  });

  test("surfaces the last persistence failure during session drain", async () => {
    const dataHome = await mkdtemp(
      join(tmpdir(), "opencode-acp-persistence-failure-"),
    );
    temporaryRoots.push(dataHome);
    const blockedDataHome = join(dataHome, "blocked-file");
    await writeFile(blockedDataHome, "not a directory", "utf8");
    process.env.XDG_DATA_HOME = blockedDataHome;

    const state = createSessionState();
    state.sessionId = "session-failure";
    const save = saveSessionState(state, new Logger(false));

    await expect(save).rejects.toThrow();
    await expect(drainSessionStateWrites(state.sessionId)).rejects.toThrow(
      "Failed to persist ACP session state: session-failure",
    );
  });

  test("migrates legacy state through a temporary directory without leftovers", async () => {
    const dataHome = await mkdtemp(join(tmpdir(), "opencode-acp-migration-"));
    temporaryRoots.push(dataHome);
    process.env.XDG_DATA_HOME = dataHome;

    const pluginDir = join(dataHome, "opencode", "storage", "plugin");
    const legacyDir = join(pluginDir, "dcp");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      join(legacyDir, "legacy-marker.json"),
      '{"legacy":true}',
      "utf8",
    );

    const state = createSessionState();
    state.sessionId = "session-migrated";
    await saveSessionState(state, new Logger(false));
    await drainSessionStateWrites(state.sessionId);

    expect(
      await readFile(join(pluginDir, "acp", "legacy-marker.json"), "utf8"),
    ).toBe('{"legacy":true}');
    expect(
      (await readdir(pluginDir)).filter((name) => name.includes(".migration.")),
    ).toEqual([]);
  });

  test("loads a same-session legacy snapshot before any fresh write", async () => {
    const dataHome = await mkdtemp(
      join(tmpdir(), "opencode-acp-migration-read-"),
    );
    temporaryRoots.push(dataHome);
    process.env.XDG_DATA_HOME = dataHome;

    const pluginDir = join(dataHome, "opencode", "storage", "plugin");
    const legacyDir = join(pluginDir, "dcp");
    await mkdir(legacyDir, { recursive: true });
    const legacyState = {
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
      nudges: { contextLimitAnchors: [] },
      stats: { totalPruneTokens: 123 },
      lastUpdated: "2026-07-16T00:00:00.000Z",
    };
    await writeFile(
      join(legacyDir, "same-session.json"),
      JSON.stringify(legacyState),
      "utf8",
    );

    const loaded = await loadSessionState("same-session", new Logger(false));

    expect(loaded?.stats.totalPruneTokens).toBe(123);
    expect(
      JSON.parse(
        await readFile(join(pluginDir, "acp", "same-session.json"), "utf8"),
      ).stats.totalPruneTokens,
    ).toBe(123);
  });

  test("keeps legacy migration retryable after a transient copy failure", async () => {
    const dataHome = await mkdtemp(
      join(tmpdir(), "opencode-acp-migration-retry-"),
    );
    temporaryRoots.push(dataHome);
    process.env.XDG_DATA_HOME = dataHome;

    const pluginDir = join(dataHome, "opencode", "storage", "plugin");
    const legacyDir = join(pluginDir, "dcp");
    const storageDir = join(pluginDir, "acp");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, "legacy-marker.json"), "legacy", "utf8");

    await expect(
      ensureStorageDir(storageDir, legacyDir, new Logger(false), {
        cp: async () => {
          throw new Error("transient copy failure");
        },
        mkdir,
        rename,
        rm,
      } as any),
    ).rejects.toThrow("transient copy failure");
    await expect(readdir(storageDir)).rejects.toThrow();

    await ensureStorageDir(storageDir, legacyDir, new Logger(false));
    expect(await readFile(join(storageDir, "legacy-marker.json"), "utf8")).toBe(
      "legacy",
    );
  });
});
