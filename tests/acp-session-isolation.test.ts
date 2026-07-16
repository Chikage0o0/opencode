import { describe, expect, test } from "bun:test";
import type { Hooks, Plugin } from "@opencode-ai/plugin";
import {
  ACP_TOOL_NAMES,
  createSessionIsolatedAcp,
} from "../lib/acp-session-isolation";

function messageOutput(sessionID: string) {
  return {
    messages: [
      {
        info: { sessionID },
        parts: [],
      },
    ],
  } as any;
}

function toolContext(sessionID: string) {
  return {
    sessionID,
    messageID: `message-${sessionID}`,
    agent: "test",
    directory: "C:\\workspace",
    worktree: "C:\\workspace",
    abort: new AbortController().signal,
    metadata() {},
    async ask() {},
  };
}

describe("ACP session isolation", () => {
  test("uses one upstream instance per session and keeps different sessions concurrent", async () => {
    let nextInstance = 0;
    const calls: Array<{ instance: number; sessionID: string }> = [];
    let startA!: () => void;
    let releaseA!: () => void;
    let startB!: () => void;
    const startedA = new Promise<void>((resolve) => (startA = resolve));
    const gateA = new Promise<void>((resolve) => (releaseA = resolve));
    const startedB = new Promise<void>((resolve) => (startB = resolve));

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        "experimental.chat.messages.transform": async (_input, output) => {
          const sessionID = String(output.messages.at(-1)?.info.sessionID);
          calls.push({ instance, sessionID });
          if (sessionID === "session-a") {
            startA();
            await gateA;
          }
          if (sessionID === "session-b") startB();
        },
      };
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    const transform = plugin["experimental.chat.messages.transform"]!;
    const taskA = transform({}, messageOutput("session-a"));
    await startedA;
    const taskB = transform({}, messageOutput("session-b"));
    await startedB;
    releaseA();
    await Promise.all([taskA, taskB]);

    const callA = calls.find((call) => call.sessionID === "session-a")!;
    const callB = calls.find((call) => call.sessionID === "session-b")!;
    expect(callA.instance).not.toBe(callB.instance);
  });

  test("serializes hooks within the same session", async () => {
    let executions = 0;
    let startFirst!: () => void;
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => (startFirst = resolve));
    const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));

    const upstream: Plugin = async () => ({
      "experimental.chat.messages.transform": async () => {
        executions += 1;
        if (executions === 1) {
          startFirst();
          await firstGate;
        }
      },
    });

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    const transform = plugin["experimental.chat.messages.transform"]!;
    const first = transform({}, messageOutput("same-session"));
    await firstStarted;
    const second = transform({}, messageOutput("same-session"));
    await Promise.resolve();
    await Promise.resolve();
    expect(executions).toBe(1);

    releaseFirst();
    await Promise.all([first, second]);
    expect(executions).toBe(2);
  });

  test("routes all ACP tools and applies host config to late session instances", async () => {
    let nextInstance = 0;
    const configured = new Set<number>();

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      const tools = Object.fromEntries(
        ACP_TOOL_NAMES.map((toolName) => [
          toolName,
          {
            description: toolName,
            args: {},
            async execute(_args: unknown, context: { sessionID: string }) {
              return `${toolName}:${context.sessionID}:instance-${instance}:configured-${configured.has(instance)}`;
            },
          },
        ]),
      );

      return {
        config: async () => {
          configured.add(instance);
        },
        tool: tools,
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.config?.({} as any);

    expect(Object.keys(plugin.tool ?? {}).sort()).toEqual(
      [...ACP_TOOL_NAMES].sort(),
    );
    const sessionAToolResults = await Promise.all(
      ACP_TOOL_NAMES.map((toolName) =>
        plugin.tool![toolName]!.execute({}, toolContext("session-a") as any),
      ),
    );
    const status = await plugin.tool!.acp_status!.execute(
      {},
      toolContext("session-b") as any,
    );

    expect(sessionAToolResults).toEqual(
      ACP_TOOL_NAMES.map(
        (toolName) => `${toolName}:session-a:instance-1:configured-true`,
      ),
    );
    expect(status).toBe("acp_status:session-b:instance-2:configured-true");
  });

  test("routes compression events by sessionID without treating message IDs as sessions", async () => {
    let nextInstance = 0;
    const eventInstances: number[] = [];

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        event: async () => {
          eventInstances.push(instance);
        },
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.event?.({
      event: {
        type: "message.part.updated",
        properties: {
          info: { id: "message-1" },
          part: {
            type: "tool",
            tool: "compress",
            sessionID: "session-a",
            messageID: "message-1",
            callID: "call-1",
            state: { status: "pending" },
          },
        },
      },
    } as any);
    const result = await plugin.tool!.compress!.execute(
      {},
      toolContext("session-a") as any,
    );

    expect(eventInstances).toEqual([1]);
    expect(result).toBe("1");
    expect(nextInstance).toBe(2);
  });

  test("routes system, command, and text hooks to the same session instance", async () => {
    let nextInstance = 0;
    const calls: string[] = [];

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        "experimental.chat.system.transform": async () => {
          calls.push(`system:${instance}`);
        },
        "command.execute.before": async () => {
          calls.push(`command:${instance}`);
        },
        "experimental.text.complete": async () => {
          calls.push(`text:${instance}`);
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin["experimental.chat.system.transform"]?.(
      { sessionID: "session-a" } as any,
      { system: [] } as any,
    );
    await plugin["command.execute.before"]?.(
      { sessionID: "session-a" } as any,
      {} as any,
    );
    await plugin["experimental.text.complete"]?.(
      { sessionID: "session-a" } as any,
      { text: "done" },
    );

    expect(calls).toEqual(["system:1", "command:1", "text:1"]);
    expect(nextInstance).toBe(2);
  });

  test("shares one session lock between hooks and tools", async () => {
    let hookStarted!: () => void;
    let releaseHook!: () => void;
    const started = new Promise<void>((resolve) => (hookStarted = resolve));
    const gate = new Promise<void>((resolve) => (releaseHook = resolve));
    let toolExecutions = 0;

    const upstream: Plugin = async () => ({
      "experimental.chat.messages.transform": async () => {
        hookStarted();
        await gate;
      },
      tool: {
        compress: {
          description: "compress",
          args: {},
          async execute() {
            toolExecutions += 1;
            return "done";
          },
        },
      },
    });

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    const hook = plugin["experimental.chat.messages.transform"]!(
      {},
      messageOutput("session-a"),
    );
    await started;
    const tool = plugin.tool!.compress!.execute(
      {},
      toolContext("session-a") as any,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(toolExecutions).toBe(0);

    releaseHook();
    await Promise.all([hook, tool]);
    expect(toolExecutions).toBe(1);
  });

  test("ignores unrelated events without allocating session instances", async () => {
    let nextInstance = 0;
    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        event: async () => {},
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.event?.({
      event: {
        type: "session.created",
        properties: { info: { id: "session-a" } },
      },
    } as any);
    const result = await plugin.tool!.compress!.execute(
      {},
      toolContext("session-a") as any,
    );

    expect(result).toBe("1");
    expect(nextInstance).toBe(2);
  });

  test("disposes and tombstones a session instance after session.deleted", async () => {
    let nextInstance = 0;
    const disposedInstances: number[] = [];
    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        event: async () => {},
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
        dispose: async () => {
          disposedInstances.push(instance);
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    const first = await plugin.tool!.compress!.execute(
      {},
      toolContext("session-a") as any,
    );
    await plugin.event?.({
      event: {
        type: "session.deleted",
        properties: { info: { id: "session-a" } },
      },
    } as any);
    expect(first).toBe("1");
    await expect(
      plugin.tool!.compress!.execute({}, toolContext("session-a") as any),
    ).rejects.toThrow("ACP session is deleted: session-a");
    expect(disposedInstances).toEqual([1]);
    expect(nextInstance).toBe(2);
  });

  test("dispose is idempotent, waits for active hooks, and rejects new work", async () => {
    let nextInstance = 0;
    let hookStarted!: () => void;
    let releaseHook!: () => void;
    const started = new Promise<void>((resolve) => (hookStarted = resolve));
    const gate = new Promise<void>((resolve) => (releaseHook = resolve));
    const disposedInstances: number[] = [];

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        "experimental.chat.messages.transform": async () => {
          if (instance === 1) {
            hookStarted();
            await gate;
          }
        },
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return "unexpected";
            },
          },
        },
        dispose: async () => {
          disposedInstances.push(instance);
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    const hook = plugin["experimental.chat.messages.transform"]!(
      {},
      messageOutput("session-a"),
    );
    await started;

    const firstDispose = plugin.dispose!();
    const secondDispose = plugin.dispose!();
    expect(firstDispose).toBe(secondDispose);
    await expect(
      plugin.tool!.compress!.execute({}, toolContext("session-a") as any),
    ).rejects.toThrow("ACP session adapter is disposed");
    expect(disposedInstances).toEqual([]);

    releaseHook();
    await Promise.all([hook, firstDispose]);
    expect(disposedInstances.sort()).toEqual([0, 1]);
  });

  test("dispose attempts every instance and reports failures", async () => {
    let nextInstance = 0;
    const disposedInstances: number[] = [];

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
        dispose: async () => {
          disposedInstances.push(instance);
          if (instance === 0) throw new Error("bootstrap dispose failed");
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.tool!.compress!.execute({}, toolContext("session-a") as any);

    await expect(plugin.dispose!()).rejects.toThrow(
      "Failed to dispose one or more ACP session instances",
    );
    expect(disposedInstances.sort()).toEqual([0, 1]);
  });

  test("dispose waits for an active config hook before disposing bootstrap", async () => {
    let configStarted!: () => void;
    let releaseConfig!: () => void;
    const started = new Promise<void>((resolve) => (configStarted = resolve));
    const gate = new Promise<void>((resolve) => (releaseConfig = resolve));
    let disposed = false;

    const upstream: Plugin = async () => ({
      config: async () => {
        configStarted();
        await gate;
      },
      dispose: async () => {
        disposed = true;
      },
    });

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    const config = plugin.config!({} as any);
    await started;
    const dispose = plugin.dispose!();
    await Promise.resolve();
    await Promise.resolve();
    expect(disposed).toBe(false);

    releaseConfig();
    await Promise.all([config, dispose]);
    expect(disposed).toBe(true);
  });

  test("serializes config updates and applies each generation once per instance", async () => {
    let nextInstance = 0;
    let firstConfigStarted!: () => void;
    let releaseFirstConfig!: () => void;
    const started = new Promise<void>(
      (resolve) => (firstConfigStarted = resolve),
    );
    const gate = new Promise<void>((resolve) => (releaseFirstConfig = resolve));
    const calls = new Map<number, string[]>();

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        config: async (config) => {
          const marker = String((config as any).marker);
          if (instance === 0 && marker === "A") {
            firstConfigStarted();
            await gate;
          }
          const instanceCalls = calls.get(instance) ?? [];
          instanceCalls.push(marker);
          calls.set(instance, instanceCalls);
        },
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.tool!.compress!.execute({}, toolContext("session-a") as any);

    const first = plugin.config!({ marker: "A" } as any);
    await started;
    const second = plugin.config!({ marker: "B" } as any);
    releaseFirstConfig();
    await Promise.all([first, second]);

    expect(calls.get(0)).toEqual(["A", "B"]);
    expect(calls.get(1)).toEqual(["A", "B"]);
  });

  test("waits for every instance config before reporting sibling failures", async () => {
    let nextInstance = 0;
    let slowConfigRunning = false;
    let slowConfigStarted!: () => void;
    let releaseSlowConfig!: () => void;
    const started = new Promise<void>((resolve) => (slowConfigStarted = resolve));
    const gate = new Promise<void>((resolve) => (releaseSlowConfig = resolve));
    let disposedWhileConfig = false;

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        config: async () => {
          if (instance === 1) throw new Error("fast config failure");
          if (instance === 2) {
            slowConfigRunning = true;
            slowConfigStarted();
            await gate;
            slowConfigRunning = false;
          }
        },
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
        dispose: async () => {
          if (slowConfigRunning) disposedWhileConfig = true;
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.tool!.compress!.execute({}, toolContext("session-a") as any);
    await plugin.tool!.compress!.execute({}, toolContext("session-b") as any);

    let configSettled = false;
    const configResult = plugin
      .config!({ marker: "A" } as any)
      .then(
        () => undefined,
        (error) => error,
      )
      .finally(() => {
        configSettled = true;
      });
    await started;
    await Promise.resolve();
    await Promise.resolve();

    const dispose = plugin.dispose!();
    await Promise.resolve();
    await Promise.resolve();
    const settledBeforeRelease = configSettled;
    const disposedBeforeRelease = disposedWhileConfig;

    releaseSlowConfig();
    const [configError] = await Promise.all([configResult, dispose]);

    expect(settledBeforeRelease).toBe(false);
    expect(disposedBeforeRelease).toBe(false);
    expect(configError).toBeInstanceOf(AggregateError);
    expect((configError as AggregateError).message).toBe(
      "Failed to configure one or more ACP session instances",
    );
    expect(disposedWhileConfig).toBe(false);
  });

  test("serializes session deletion behind an active instance config", async () => {
    let nextInstance = 0;
    let configRunning = false;
    let configStarted!: () => void;
    let releaseConfig!: () => void;
    const started = new Promise<void>((resolve) => (configStarted = resolve));
    const gate = new Promise<void>((resolve) => (releaseConfig = resolve));
    let disposedWhileConfig = false;

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        config: async () => {
          if (instance !== 1) return;
          configRunning = true;
          configStarted();
          await gate;
          configRunning = false;
        },
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
        event: async () => {},
        dispose: async () => {
          if (configRunning) disposedWhileConfig = true;
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.tool!.compress!.execute({}, toolContext("session-a") as any);

    const config = plugin.config!({ marker: "A" } as any);
    await started;
    let deletionSettled = false;
    const deletion = plugin
      .event!({
        event: {
          type: "session.deleted",
          properties: { info: { id: "session-a" } },
        },
      } as any)
      .finally(() => {
        deletionSettled = true;
      });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const settledBeforeRelease = deletionSettled;

    releaseConfig();
    await Promise.all([config, deletion]);

    expect(settledBeforeRelease).toBe(false);
    expect(disposedWhileConfig).toBe(false);
  });

  test("disposes a late instance when initial config synchronization fails", async () => {
    let nextInstance = 0;
    const disposedInstances: number[] = [];

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        config: async () => {
          if (instance === 1) throw new Error("late config failure");
        },
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
        dispose: async () => {
          disposedInstances.push(instance);
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.config!({ marker: "A" } as any);
    await expect(
      plugin.tool!.compress!.execute({}, toolContext("session-a") as any),
    ).rejects.toThrow("late config failure");
    expect(disposedInstances).toEqual([1]);

    await plugin.dispose!();
    expect(disposedInstances.sort()).toEqual([0, 1]);
  });

  test("retries failed cleanup of an initially misconfigured instance", async () => {
    let nextInstance = 0;
    let failedInstanceDisposeAttempts = 0;

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        config: async () => {
          if (instance === 1) throw new Error("late config failure");
        },
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
        dispose: async () => {
          if (instance !== 1) return;
          failedInstanceDisposeAttempts += 1;
          if (failedInstanceDisposeAttempts === 1)
            throw new Error("initial cleanup failure");
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.config!({ marker: "A" } as any);
    await expect(
      plugin.tool!.compress!.execute({}, toolContext("session-a") as any),
    ).rejects.toThrow("Failed to configure and dispose an ACP session instance");
    expect(failedInstanceDisposeAttempts).toBe(1);

    await plugin.dispose!();
    expect(failedInstanceDisposeAttempts).toBe(2);
  });

  test("retries a failed session deletion dispose during global disposal", async () => {
    let nextInstance = 0;
    let sessionDisposeAttempts = 0;

    const upstream: Plugin = async () => {
      const instance = nextInstance++;
      return {
        tool: {
          compress: {
            description: "compress",
            args: {},
            async execute() {
              return String(instance);
            },
          },
        },
        event: async () => {},
        dispose: async () => {
          if (instance !== 1) return;
          sessionDisposeAttempts += 1;
          if (sessionDisposeAttempts === 1)
            throw new Error("first dispose failed");
        },
      } as Hooks;
    };

    const plugin = await createSessionIsolatedAcp(upstream)({} as any);
    await plugin.tool!.compress!.execute({}, toolContext("session-a") as any);

    await expect(
      plugin.event!({
        event: {
          type: "session.deleted",
          properties: { info: { id: "session-a" } },
        },
      } as any),
    ).rejects.toThrow("first dispose failed");
    expect(sessionDisposeAttempts).toBe(1);

    await plugin.dispose!();
    expect(sessionDisposeAttempts).toBe(2);
  });
});
