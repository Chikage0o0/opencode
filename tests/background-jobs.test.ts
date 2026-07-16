import { describe, expect, test } from "bun:test"

import {
  BackgroundJobBoard,
  createBackgroundJobsPlugin,
  parseJobMetadata,
  parseTaskStatus,
} from "../lib/background-jobs"

function createToolContext(agent = "orchestrator", sessionID = "ses_parent") {
  return {
    sessionID,
    messageID: "msg_1",
    agent,
    directory: "C:\\workspace",
    worktree: "C:\\workspace",
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => {},
  }
}

describe("background job board", () => {
  test("parses native task text and structured job metadata", () => {
    expect(
      parseTaskStatus([
        "task_id: ses_child",
        "state: completed",
        "",
        "<task_result>",
        "Mapped the auth flow",
        "</task_result>",
      ].join("\n")),
    ).toEqual({
      taskID: "ses_child",
      state: "completed",
      result: "Mapped the auth flow",
    })

    expect(
      parseJobMetadata(
        '<job-meta>{"dependencies":["exp-1"],"writeScopes":["src/auth/**"]}</job-meta>\nImplement auth',
      ),
    ).toEqual({ dependencies: ["exp-1"], writeScopes: ["src/auth/**"] })
  })

  test("formats parent-scoped state and marks terminal jobs reconciled", () => {
    let now = 1_000
    const board = new BackgroundJobBoard({ now: () => now })
    const job = board.register({
      taskID: "ses_child",
      parentSessionID: "ses_parent",
      agent: "fixer",
      objective: "Implement auth validation",
      dependencies: ["exp-1"],
      writeScopes: ["src/auth/**"],
    })

    now = 4_000
    expect(board.formatForPrompt("ses_parent")).toContain(
      "fix-1 | task_id=ses_child | agent=fixer | state=running | age=3s | dependencies=exp-1 | write_scopes=src/auth/**",
    )
    expect(board.formatForPrompt("another_parent")).toBeUndefined()

    board.updateStatus(job.taskID, "completed", "implemented and tested")
    expect(board.get(job.taskID)?.reconciled).toBe(false)

    board.markParentTerminalReconciled("ses_parent")
    expect(board.get(job.taskID)?.reconciled).toBe(true)
    expect(board.formatForPrompt("ses_parent")).toContain("#### Reusable Sessions")
  })
})

describe("background jobs plugin", () => {
  test("tracks task hooks, consumes synthetic completion, and injects the board", async () => {
    const board = new BackgroundJobBoard()
    const plugin = createBackgroundJobsPlugin({ board })
    const hooks = await plugin({
      client: { session: { abort: async () => ({ data: true }) } },
    } as never)

    await hooks["chat.message"]?.(
      { sessionID: "ses_parent", agent: "orchestrator" } as never,
      { message: { agent: "orchestrator" }, parts: [] } as never,
    )

    const beforeOutput = {
      args: {
        description: "Map authentication",
        subagent_type: "explorer",
        background: true,
        prompt:
          '<job-meta>{"dependencies":[],"writeScopes":[]}</job-meta>\nLocate authentication entry points.',
      },
    }
    await hooks["tool.execute.before"]?.(
      { tool: "task", sessionID: "ses_parent", callID: "call_1" },
      beforeOutput,
    )
    await hooks["tool.execute.after"]?.(
      { tool: "task", sessionID: "ses_parent", callID: "call_1", args: beforeOutput.args },
      {
        title: "Background task started",
        output: "task_id: ses_child\nstate: running",
        metadata: {},
      },
    )

    expect(board.get("ses_child")).toMatchObject({
      parentSessionID: "ses_parent",
      agent: "explorer",
      alias: "exp-1",
      state: "running",
    })

    await hooks.event?.({
      event: { type: "session.idle", properties: { sessionID: "ses_child" } },
    } as never)
    expect(board.get("ses_child")?.state).toBe("running")

    const runningTurn = {
      messages: [
        {
          info: { role: "user", sessionID: "ses_parent", agent: "orchestrator" },
          parts: [{ type: "text", text: "Continue" }],
        },
      ],
    }
    await hooks["experimental.chat.messages.transform"]?.({}, runningTurn as never)
    expect(runningTurn.messages[0].parts[0].text).toContain("### Background Job Board")
    expect(runningTurn.messages[0].parts[0].text).toContain("state=running")
    expect(runningTurn.messages[0].parts[0].text).toContain("write_scopes=read-only")

    const completionTurn = {
      messages: [
        {
          info: { role: "user", sessionID: "ses_parent", agent: "orchestrator" },
          parts: [
            {
              type: "text",
              synthetic: true,
              text: '<task id="ses_child" state="completed">\n<task_result>Mapped auth</task_result>\n</task>',
            },
          ],
        },
      ],
    }
    await hooks["experimental.chat.messages.transform"]?.({}, completionTurn as never)

    expect(completionTurn.messages[0].parts[0].text).toContain("state=completed")
    expect(board.get("ses_child")).toMatchObject({
      state: "completed",
      resultSummary: "Mapped auth",
      reconciled: true,
    })
  })

  test("cancels only an owned running task and does not delete its session", async () => {
    const abortCalls: unknown[] = []
    const board = new BackgroundJobBoard()
    board.register({
      taskID: "ses_child",
      parentSessionID: "ses_parent",
      agent: "fixer",
      objective: "Implement auth",
      writeScopes: ["src/auth/**"],
    })

    const plugin = createBackgroundJobsPlugin({ board })
    const hooks = await plugin({
      client: {
        session: {
          abort: async (input: unknown) => {
            abortCalls.push(input)
            return { data: true }
          },
        },
      },
    } as never)

    const result = await hooks.tool?.cancel_task.execute(
      { task_id: "fix-1", reason: "scope changed" },
      createToolContext() as never,
    )

    expect(abortCalls).toEqual([
      {
        path: { id: "ses_child" },
        query: { directory: "C:\\workspace" },
        throwOnError: true,
      },
    ])
    expect(result).toContain("state: cancelled")
    expect(result).toContain("partial file writes are not rolled back")
    expect(board.get("ses_child")?.state).toBe("cancelled")
  })

  test("reopens a completed session when task_id is reused and allows cancellation", async () => {
    const board = new BackgroundJobBoard()
    const first = board.register({
      taskID: "ses_child",
      parentSessionID: "ses_parent",
      agent: "fixer",
      objective: "First implementation",
      writeScopes: ["src/old/**"],
    })
    board.updateStatus(first.taskID, "completed", "first run done")
    board.markReconciled(first.taskID)

    const hooks = await createBackgroundJobsPlugin({ board })({
      client: { session: { abort: async () => ({ data: true }) } },
    } as never)
    const beforeOutput = {
      args: {
        description: "Follow-up implementation",
        subagent_type: "fixer",
        task_id: "ses_child",
        background: true,
        prompt:
          '<job-meta>{"dependencies":["exp-2"],"writeScopes":["src/new/**"]}</job-meta>\nContinue implementation.',
      },
    }

    await hooks["tool.execute.before"]?.(
      { tool: "task", sessionID: "ses_parent", callID: "call_reuse" },
      beforeOutput,
    )
    await hooks["tool.execute.after"]?.(
      { tool: "task", sessionID: "ses_parent", callID: "call_reuse", args: beforeOutput.args },
      {
        title: "Background task resumed",
        output: "task_id: ses_child\nstate: running",
        metadata: {},
      },
    )

    expect(board.get("ses_child")).toMatchObject({
      alias: "fix-1",
      state: "running",
      objective: "Follow-up implementation",
      dependencies: ["exp-2"],
      writeScopes: ["src/new/**"],
      reconciled: false,
    })

    const result = await hooks.tool?.cancel_task.execute(
      { task_id: "fix-1", reason: "follow-up obsolete" },
      createToolContext() as never,
    )
    expect(result).toContain("state: cancelled")
  })
https://github.com/ranxianglei/opencode-acp
  test("isolates identical tool call IDs across concurrent parent sessions", async () => {
    const board = new BackgroundJobBoard()
    const hooks = await createBackgroundJobsPlugin({ board })({
      client: { session: { abort: async () => ({ data: true }) } },
    } as never)
    const firstArgs = {
      description: "Map auth",
      subagent_type: "explorer",
      background: true,
      prompt: '<job-meta>{"dependencies":[],"writeScopes":[]}</job-meta>\nMap auth.',
    }
    const secondArgs = {
      description: "Implement billing",
      subagent_type: "fixer",
      background: true,
      prompt:
        '<job-meta>{"dependencies":[],"writeScopes":["src/billing/**"]}</job-meta>\nImplement billing.',
    }

    await hooks["tool.execute.before"]?.(
      { tool: "task", sessionID: "ses_parent_a", callID: "call_1" },
      { args: firstArgs },
    )
    await hooks["tool.execute.before"]?.(
      { tool: "task", sessionID: "ses_parent_b", callID: "call_1" },
      { args: secondArgs },
    )
    await hooks["tool.execute.after"]?.(
      { tool: "task", sessionID: "ses_parent_a", callID: "call_1", args: firstArgs },
      { title: "started", output: "task_id: ses_child_a\nstate: running", metadata: {} },
    )
    await hooks["tool.execute.after"]?.(
      { tool: "task", sessionID: "ses_parent_b", callID: "call_1", args: secondArgs },
      { title: "started", output: "task_id: ses_child_b\nstate: running", metadata: {} },
    )

    expect(board.get("ses_child_a")).toMatchObject({
      parentSessionID: "ses_parent_a",
      agent: "explorer",
      objective: "Map auth",
    })
    expect(board.get("ses_child_b")).toMatchObject({
      parentSessionID: "ses_parent_b",
      agent: "fixer",
      objective: "Implement billing",
      writeScopes: ["src/billing/**"],
    })
  })

  test("rejects non-orchestrator and unowned cancellation", async () => {
    const board = new BackgroundJobBoard()
    board.register({
      taskID: "ses_child",
      parentSessionID: "ses_parent",
      agent: "explorer",
      objective: "Map auth",
    })
    const hooks = await createBackgroundJobsPlugin({ board })({
      client: { session: { abort: async () => ({ data: true }) } },
    } as never)

    await expect(
      hooks.tool?.cancel_task.execute({ task_id: "exp-1" }, createToolContext("fixer") as never),
    ).rejects.toThrow("only be used by orchestrator")

    await expect(
      hooks.tool?.cancel_task.execute(
        { task_id: "ses_child" },
        createToolContext("orchestrator", "ses_other_parent") as never,
      ),
    ).rejects.toThrow("unknown or unowned")
  })

  test("keeps a task running with uncertain status when abort fails", async () => {
    const board = new BackgroundJobBoard()
    board.register({
      taskID: "ses_child",
      parentSessionID: "ses_parent",
      agent: "fixer",
      objective: "Implement auth",
    })
    const hooks = await createBackgroundJobsPlugin({ board })({
      client: {
        session: {
          abort: async () => {
            throw new Error("abort unavailable")
          },
        },
      },
    } as never)

    const result = await hooks.tool?.cancel_task.execute(
      { task_id: "ses_child" },
      createToolContext() as never,
    )

    expect(result).toContain("state: running")
    expect(board.get("ses_child")).toMatchObject({
      state: "running",
      statusUncertain: true,
      cancellationRequested: false,
    })
  })
})
