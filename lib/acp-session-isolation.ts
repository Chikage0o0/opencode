import type { Hooks, Plugin } from "@opencode-ai/plugin";
import type { ToolDefinition } from "@opencode-ai/plugin/tool";

export const ACP_TOOL_NAMES = [
  "compress",
  "decompress",
  "prune",
  "search_context",
  "acp_status",
  "acp_context_recap",
] as const;

type HookBundle = Awaited<ReturnType<Plugin>>;
type ConfigInput = Parameters<NonNullable<Hooks["config"]>>[0];
type EventInput = Parameters<NonNullable<Hooks["event"]>>[0];
const BOOTSTRAP_LOCK_ID = "\0acp-bootstrap";

function sessionIDFromMessages(output: {
  messages?: Array<{ info?: { sessionID?: unknown } }>;
}): string | undefined {
  for (let index = (output.messages?.length ?? 0) - 1; index >= 0; index -= 1) {
    const sessionID = output.messages?.[index]?.info?.sessionID;
    if (typeof sessionID === "string" && sessionID.length > 0) return sessionID;
  }
  return undefined;
}

function sessionIDFromEvent(input: {
  event?: { type?: string; properties?: Record<string, any> };
}): string | undefined {
  const properties = input.event?.properties;
  const candidates = [
    properties?.part?.sessionID,
    properties?.message?.sessionID,
    properties?.info?.sessionID,
    properties?.sessionID,
  ];

  const direct = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
  );
  if (direct) return direct;

  const sessionInfoID = input.event?.type?.startsWith("session.")
    ? properties?.info?.id
    : undefined;
  return typeof sessionInfoID === "string" && sessionInfoID.length > 0
    ? sessionInfoID
    : undefined;
}

function createSessionLock() {
  const tails = new Map<string, Promise<void>>();

  const runExclusive = async <T>(
    sessionID: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const previous = tails.get(sessionID) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => gate);
    tails.set(sessionID, tail);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (tails.get(sessionID) === tail) tails.delete(sessionID);
    }
  };

  const drain = async (): Promise<void> => {
    while (tails.size > 0) await Promise.all([...tails.values()]);
  };

  return { runExclusive, drain };
}

/**
 * createSessionIsolatedAcp 为每个 OpenCode session 创建独立 ACP 实例。
 *
 * ACP 1.12.6 的插件工厂只创建一个可变 SessionState；OpenCode 则按 project
 * 复用同一插件实例。并发 parent/child session 会交错切换该状态。本适配层按
 * sessionID 路由全部有状态 hook 和 tool，并串行化同一 session 的变更；不同
 * session 仍可并行执行。
 */
export function createSessionIsolatedAcp(upstream: Plugin): Plugin {
  return async (input, options) => {
    const bootstrap = await upstream(input, options);
    const instances = new Map<string, Promise<HookBundle>>();
    const orphanedInstances = new Set<HookBundle>();
    const closedSessions = new Set<string>();
    const activeOperations = new Set<Promise<unknown>>();
    const instanceConfigGenerations = new WeakMap<HookBundle, number>();
    const sessionLock = createSessionLock();
    let hostConfig: ConfigInput | undefined;
    let hostConfigGeneration = 0;
    let disposed = false;
    let disposePromise: Promise<void> | undefined;

    const trackOperation = <T>(operation: () => Promise<T>): Promise<T> => {
      if (disposed)
        return Promise.reject(new Error("ACP session adapter is disposed"));

      const result = Promise.resolve().then(operation);
      activeOperations.add(result);
      void result.then(
        () => activeOperations.delete(result),
        () => activeOperations.delete(result),
      );
      return result;
    };

    const runSessionOperation = <T>(
      sessionID: string,
      operation: () => Promise<T>,
      allowClosed = false,
    ): Promise<T> => {
      if (!allowClosed && closedSessions.has(sessionID)) {
        return Promise.reject(
          new Error(`ACP session is deleted: ${sessionID}`),
        );
      }
      return trackOperation(() =>
        sessionLock.runExclusive(sessionID, operation),
      );
    };

    const drainActiveOperations = async (): Promise<void> => {
      while (activeOperations.size > 0) {
        await Promise.allSettled([...activeOperations]);
      }
    };

    const createInstance = async (): Promise<HookBundle> => {
      const hooks = await upstream(input, options);
      const config = hostConfig;
      const generation = hostConfigGeneration;
      try {
        if (config && hooks.config) await hooks.config(config);
        instanceConfigGenerations.set(hooks, generation);
        return hooks;
      } catch (error) {
        try {
          await hooks.dispose?.();
        } catch (disposeError) {
          orphanedInstances.add(hooks);
          throw new AggregateError(
            [error, disposeError],
            "Failed to configure and dispose an ACP session instance",
          );
        }
        throw error;
      }
    };

    const getInstance = (sessionID: string): Promise<HookBundle> => {
      const existing = instances.get(sessionID);
      if (existing) return existing;

      const created = createInstance();
      instances.set(sessionID, created);
      void created.catch(() => {
        if (instances.get(sessionID) === created) instances.delete(sessionID);
      });
      return created;
    };

    const invoke = async (
      sessionID: string | undefined,
      hookName: keyof Hooks,
      ...args: any[]
    ): Promise<any> => {
      if (!sessionID) {
        const handler = bootstrap[hookName] as
          | ((...handlerArgs: any[]) => Promise<any>)
          | undefined;
        return runSessionOperation(BOOTSTRAP_LOCK_ID, async () =>
          handler?.(...args),
        );
      }

      return runSessionOperation(sessionID, async () => {
        const hooks = await getInstance(sessionID);
        const handler = hooks[hookName] as
          | ((...handlerArgs: any[]) => Promise<any>)
          | undefined;
        return handler?.(...args);
      });
    };

    const tools = Object.fromEntries(
      ACP_TOOL_NAMES.flatMap((toolName) => {
        const template = bootstrap.tool?.[toolName];
        if (!template) return [];

        const routed: ToolDefinition = {
          ...template,
          execute: async (args, toolContext) =>
            runSessionOperation(toolContext.sessionID, async () => {
              const hooks = await getInstance(toolContext.sessionID);
              const implementation = hooks.tool?.[toolName];
              if (!implementation) {
                throw new Error(
                  `ACP session instance did not register tool: ${toolName}`,
                );
              }
              return implementation.execute(args, toolContext);
            }),
        };
        return [[toolName, routed] as const];
      }),
    );

    const handleEvent = async (hookInput: EventInput): Promise<void> => {
      const eventType = hookInput.event?.type;
      const sessionID = sessionIDFromEvent(hookInput);

      if (eventType === "session.deleted") {
        if (!sessionID) return;
        closedSessions.add(sessionID);
        return runSessionOperation(
          sessionID,
          async () => {
            const instance = instances.get(sessionID);
            if (!instance) return;

            const hooks = await instance;
            await hooks.dispose?.();
            if (instances.get(sessionID) === instance)
              instances.delete(sessionID);
          },
          true,
        );
      }

      // ACP 1.12.6 only consumes compression timing events. Ignoring other events avoids
      // allocating a full SessionState for every session lifecycle notification.
      const properties = hookInput.event?.properties as
        | Record<string, any>
        | undefined;
      const part = properties?.part;
      if (
        eventType !== "message.part.updated" ||
        part?.type !== "tool" ||
        part.tool !== "compress"
      ) {
        return;
      }

      await invoke(sessionID, "event", hookInput);
    };

    const dispose = (): Promise<void> => {
      if (disposePromise) return disposePromise;
      disposed = true;

      disposePromise = (async () => {
        await drainActiveOperations();
        await sessionLock.drain();

        const instanceResults = await Promise.allSettled([
          ...instances.values(),
        ]);
        const bundles = [
          bootstrap,
          ...instanceResults.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : [],
          ),
          ...orphanedInstances,
        ];
        const disposalResults = await Promise.allSettled(
          bundles.map(async (hooks) => hooks.dispose?.()),
        );
        instances.clear();
        orphanedInstances.clear();
        closedSessions.clear();

        const failures = [
          ...instanceResults.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
          ...disposalResults.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        ];
        if (failures.length > 0) {
          throw new AggregateError(
            failures,
            "Failed to dispose one or more ACP session instances",
          );
        }
      })();

      return disposePromise;
    };

    return {
      config: (config) =>
        runSessionOperation(BOOTSTRAP_LOCK_ID, async () => {
          hostConfig = config;
          hostConfigGeneration += 1;
          const generation = hostConfigGeneration;
          await bootstrap.config?.(config);
          const results = await Promise.allSettled(
            [...instances.entries()].map(([sessionID, instance]) =>
              sessionLock.runExclusive(sessionID, async () => {
                if (
                  closedSessions.has(sessionID) ||
                  instances.get(sessionID) !== instance
                ) {
                  return;
                }
                const hooks = await instance;
                if (
                  closedSessions.has(sessionID) ||
                  instances.get(sessionID) !== instance ||
                  instanceConfigGenerations.get(hooks) === generation
                ) {
                  return;
                }
                await hooks.config?.(config);
                instanceConfigGenerations.set(hooks, generation);
              }),
            ),
          );
          const failures = results.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          );
          if (failures.length > 0) {
            throw new AggregateError(
              failures,
              "Failed to configure one or more ACP session instances",
            );
          }
        }),
      tool: tools,
      ...(bootstrap["experimental.chat.messages.transform"] && {
        "experimental.chat.messages.transform": async (hookInput, output) =>
          invoke(
            sessionIDFromMessages(output),
            "experimental.chat.messages.transform",
            hookInput,
            output,
          ),
      }),
      ...(bootstrap["experimental.chat.system.transform"] && {
        "experimental.chat.system.transform": async (hookInput, output) =>
          invoke(
            hookInput.sessionID,
            "experimental.chat.system.transform",
            hookInput,
            output,
          ),
      }),
      ...(bootstrap["command.execute.before"] && {
        "command.execute.before": async (hookInput, output) =>
          invoke(
            hookInput.sessionID,
            "command.execute.before",
            hookInput,
            output,
          ),
      }),
      ...(bootstrap["experimental.text.complete"] && {
        "experimental.text.complete": async (hookInput, output) =>
          invoke(
            hookInput.sessionID,
            "experimental.text.complete",
            hookInput,
            output,
          ),
      }),
      ...(bootstrap.event && {
        event: handleEvent,
      }),
      dispose,
    } satisfies Hooks;
  };
}
