import type { Plugin, PluginInput, ToolContext } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

export type BackgroundJobState =
  | "running"
  | "cancel_requested"
  | "completed"
  | "error"
  | "cancelled"

export type BackgroundJobRecord = {
  taskID: string
  parentSessionID: string
  agent: string
  alias: string
  objective: string
  dependencies: string[]
  writeScopes: string[]
  state: BackgroundJobState
  launchedAt: number
  updatedAt: number
  completedAt?: number
  resultSummary?: string
  cancellationRequested: boolean
  statusUncertain: boolean
  reconciled: boolean
}

type TaskStatus = {
  taskID: string
  state: Exclude<BackgroundJobState, "cancel_requested">
  result?: string
}

type TaskCallArgs = {
  description?: unknown
  prompt?: unknown
  subagent_type?: unknown
  task_id?: unknown
  background?: unknown
}

type PendingTaskCall = {
  parentSessionID: string
  agent: string
  objective: string
  dependencies: string[]
  writeScopes: string[]
  background: boolean
}

type BackgroundJobBoardOptions = {
  now?: () => number
  maxReusablePerAgent?: number
}

type BackgroundJobsPluginOptions = {
  board?: BackgroundJobBoard
  abortTimeoutMs?: number
}

const JOB_META_PATTERN = /<job-meta>\s*([\s\S]*?)\s*<\/job-meta>/i
const TASK_ID_PATTERN = /^ses_[A-Za-z0-9_-]+$/
const BOARD_SENTINEL = "local-background-job-board-v1"
const TERMINAL_STATES = new Set<BackgroundJobState>(["completed", "error", "cancelled"])
const READ_ONLY_AGENTS = new Set(["explorer", "librarian", "oracle"])

const AGENT_PREFIX: Record<string, string> = {
  designer: "des",
  explorer: "exp",
  fixer: "fix",
  librarian: "lib",
  oracle: "ora",
}

export function parseTaskStatus(output: string): TaskStatus | undefined {
  const taskID =
    /<task\s+[^>]*\bid=["']([^"']+)["'][^>]*>/i.exec(output)?.[1] ??
    output
      .split(/\r?\n/)
      .map((line) => /^task_id:\s*([^\s()]+)/i.exec(line.trim())?.[1])
      .find((value): value is string => Boolean(value))

  const state =
    /<task\s+[^>]*\bstate=["'](running|completed|error|cancelled)["'][^>]*>/i.exec(output)?.[1] ??
    output
      .split(/\r?\n/)
      .map((line) => /^state:\s*(running|completed|error|cancelled)\s*$/i.exec(line.trim())?.[1])
      .find((value): value is string => Boolean(value))

  if (!taskID || !state) return

  const result = /<task_(?:result|error)>\s*([\s\S]*?)\s*<\/task_(?:result|error)>/i
    .exec(output)?.[1]
    ?.trim()

  return {
    taskID,
    state: state.toLowerCase() as TaskStatus["state"],
    result: result || undefined,
  }
}

export function parseJobMetadata(prompt: unknown): {
  dependencies: string[]
  writeScopes: string[]
} {
  if (typeof prompt !== "string") return { dependencies: [], writeScopes: [] }

  const raw = JOB_META_PATTERN.exec(prompt)?.[1]
  if (!raw) return { dependencies: [], writeScopes: [] }

  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    return {
      dependencies: normalizeStringList(value.dependencies),
      writeScopes: normalizeStringList(value.writeScopes),
    }
  } catch {
    return { dependencies: [], writeScopes: [] }
  }
}

export class BackgroundJobBoard {
  private readonly jobs = new Map<string, BackgroundJobRecord>()
  private readonly counters = new Map<string, number>()
  private readonly now: () => number
  private readonly maxReusablePerAgent: number

  constructor(options: BackgroundJobBoardOptions = {}) {
    this.now = options.now ?? Date.now
    this.maxReusablePerAgent = options.maxReusablePerAgent ?? 2
  }

  register(input: {
    taskID: string
    parentSessionID: string
    agent: string
    objective: string
    dependencies?: string[]
    writeScopes?: string[]
  }): BackgroundJobRecord {
    const now = this.now()
    const existing = this.jobs.get(input.taskID)
    const record: BackgroundJobRecord = {
      taskID: input.taskID,
      parentSessionID: input.parentSessionID,
      agent: input.agent,
      alias: existing?.alias ?? this.nextAlias(input.parentSessionID, input.agent),
      objective: cleanSingleLine(input.objective || `background ${input.agent} task`, 240),
      dependencies: normalizeStringList(input.dependencies),
      writeScopes: normalizeStringList(input.writeScopes),
      state: "running",
      launchedAt: now,
      updatedAt: now,
      cancellationRequested: false,
      statusUncertain: false,
      reconciled: false,
    }

    this.jobs.set(record.taskID, record)
    return record
  }

  updateStatus(taskID: string, state: TaskStatus["state"], result?: string): BackgroundJobRecord | undefined {
    const existing = this.jobs.get(taskID)
    if (!existing) return

    // cancel 已请求后到达的 late error 是取消结果，不应把任务重新标为失败。
    const effectiveState = existing.cancellationRequested && state === "error" ? "cancelled" : state
    if (TERMINAL_STATES.has(existing.state) && effectiveState === "running") return existing

    const now = this.now()
    const record: BackgroundJobRecord = {
      ...existing,
      state: effectiveState,
      updatedAt: now,
      completedAt: TERMINAL_STATES.has(effectiveState) ? (existing.completedAt ?? now) : undefined,
      resultSummary: result ? cleanSingleLine(result, 320) : existing.resultSummary,
      cancellationRequested: existing.cancellationRequested || effectiveState === "cancelled",
      statusUncertain: false,
      reconciled: TERMINAL_STATES.has(effectiveState) ? false : existing.reconciled,
    }

    this.jobs.set(taskID, record)
    this.trimReusable(record)
    return record
  }

  markCancelRequested(taskID: string, reason?: string): BackgroundJobRecord | undefined {
    const existing = this.jobs.get(taskID)
    if (!existing || existing.state !== "running") return

    const record: BackgroundJobRecord = {
      ...existing,
      state: "cancel_requested",
      updatedAt: this.now(),
      cancellationRequested: true,
      statusUncertain: false,
      resultSummary: reason ? `cancel requested: ${cleanSingleLine(reason, 200)}` : "cancel requested",
      reconciled: false,
    }
    this.jobs.set(taskID, record)
    return record
  }

  markCancellationFailed(taskID: string, error: unknown): BackgroundJobRecord | undefined {
    const existing = this.jobs.get(taskID)
    if (!existing) return

    const record: BackgroundJobRecord = {
      ...existing,
      state: "running",
      updatedAt: this.now(),
      cancellationRequested: false,
      statusUncertain: true,
      resultSummary: `cancel failed: ${cleanSingleLine(errorMessage(error), 240)}`,
      reconciled: false,
    }
    this.jobs.set(taskID, record)
    return record
  }

  markCancelled(taskID: string, reason?: string): BackgroundJobRecord | undefined {
    return this.updateStatus(taskID, "cancelled", reason ? `cancelled: ${reason}` : "cancelled")
  }

  markReconciled(taskID: string): BackgroundJobRecord | undefined {
    const existing = this.jobs.get(taskID)
    if (!existing || !TERMINAL_STATES.has(existing.state)) return existing

    const record = { ...existing, reconciled: true, updatedAt: this.now() }
    this.jobs.set(taskID, record)
    this.trimReusable(record)
    return record
  }

  markParentTerminalReconciled(parentSessionID: string): void {
    for (const job of this.list(parentSessionID)) {
      if (TERMINAL_STATES.has(job.state) && !job.reconciled) this.markReconciled(job.taskID)
    }
  }

  get(taskID: string): BackgroundJobRecord | undefined {
    return this.jobs.get(taskID)
  }

  resolve(parentSessionID: string, taskIDOrAlias: string): BackgroundJobRecord | undefined {
    const key = taskIDOrAlias.trim()
    return this.list(parentSessionID).find((job) => job.taskID === key || job.alias === key)
  }

  list(parentSessionID?: string): BackgroundJobRecord[] {
    return [...this.jobs.values()]
      .filter((job) => !parentSessionID || job.parentSessionID === parentSessionID)
      .sort((left, right) => left.launchedAt - right.launchedAt)
  }

  clearParent(parentSessionID: string): void {
    for (const job of this.list(parentSessionID)) this.jobs.delete(job.taskID)
  }

  formatForPrompt(parentSessionID: string): string | undefined {
    const jobs = this.list(parentSessionID)
    const active = jobs.filter((job) => job.state === "running" || job.state === "cancel_requested" || !job.reconciled)
    const reusable = jobs
      .filter((job) => job.state === "completed" && job.reconciled)
      .slice(-this.maxReusablePerAgent * Math.max(1, new Set(jobs.map((job) => job.agent)).size))

    if (active.length === 0 && reusable.length === 0) return

    return [
      "<system-reminder>",
      "### Background Job Board",
      `SENTINEL: ${BOARD_SENTINEL}`,
      "Do not poll running jobs. Reconcile terminal jobs before final response. Use cancel_task only for explicit, obsolete, wrong, or conflicting work. Cancellation does not roll back partial writes.",
      "Dependencies and write scopes are advisory metadata; verify conflicts before dispatching another writer.",
      "",
      "#### Active / Unreconciled",
      ...(active.length ? active.map((job) => this.formatJob(job)) : ["- none"]),
      "",
      "#### Reusable Sessions",
      ...(reusable.length ? reusable.map((job) => this.formatJob(job)) : ["- none"]),
      "</system-reminder>",
    ].join("\n")
  }

  private formatJob(job: BackgroundJobRecord): string {
    const ageSeconds = Math.max(0, Math.floor((this.now() - job.launchedAt) / 1000))
    const dependencies = job.dependencies.length ? job.dependencies.join(", ") : "none"
    const writeScopes = job.writeScopes.length
      ? job.writeScopes.join(", ")
      : READ_ONLY_AGENTS.has(job.agent)
        ? "read-only"
        : "unspecified"
    const summary = job.resultSummary ? ` | result=${escapePromptValue(job.resultSummary)}` : ""

    return `- ${escapePromptValue(job.alias)} | task_id=${escapePromptValue(job.taskID)} | agent=${escapePromptValue(job.agent)} | state=${job.state} | age=${ageSeconds}s | dependencies=${escapePromptValue(dependencies)} | write_scopes=${escapePromptValue(writeScopes)} | objective=${escapePromptValue(job.objective)}${summary}`
  }

  private nextAlias(parentSessionID: string, agent: string): string {
    const prefix = AGENT_PREFIX[agent] ?? (cleanSingleLine(agent, 3).toLowerCase() || "job")
    const key = `${parentSessionID}:${prefix}`
    const next = (this.counters.get(key) ?? 0) + 1
    this.counters.set(key, next)
    return `${prefix}-${next}`
  }

  private trimReusable(record: BackgroundJobRecord): void {
    if (record.state !== "completed" || !record.reconciled) return

    const completed = this.list(record.parentSessionID)
      .filter((job) => job.agent === record.agent && job.state === "completed" && job.reconciled)
      .sort((left, right) => right.updatedAt - left.updatedAt)

    for (const job of completed.slice(this.maxReusablePerAgent)) this.jobs.delete(job.taskID)
  }
}

export function createBackgroundJobsPlugin(options: BackgroundJobsPluginOptions = {}): Plugin {
  return async (ctx) => {
    const board = options.board ?? new BackgroundJobBoard()
    const pendingCalls = new Map<string, PendingTaskCall>()
    const agentsBySession = new Map<string, string>()

    return {
      tool: {
        cancel_task: createCancelTaskTool(ctx, board, agentsBySession, options.abortTimeoutMs),
      },

      "chat.message": async (input, output) => {
        const agent = input.agent ?? output.message.agent
        if (agent) agentsBySession.set(input.sessionID, agent)
      },

      "tool.execute.before": async (input, output) => {
        if (input.tool.toLowerCase() !== "task") return
        const args = output.args as TaskCallArgs
        if (!args || typeof args !== "object") return

        const agent = typeof args.subagent_type === "string" ? args.subagent_type.trim() : ""
        if (!agent) return

        const prompt = typeof args.prompt === "string" ? args.prompt : ""
        const objective =
          typeof args.description === "string" && args.description.trim()
            ? args.description.trim()
            : firstContentLine(prompt) || `background ${agent} task`
        const metadata = parseJobMetadata(prompt)

        pendingCalls.set(pendingCallKey(input.sessionID, input.callID), {
          parentSessionID: input.sessionID,
          agent,
          objective,
          dependencies: metadata.dependencies,
          writeScopes: metadata.writeScopes,
          background: args.background === true,
        })
        while (pendingCalls.size > 100) {
          const oldest = pendingCalls.keys().next().value
          if (typeof oldest !== "string") break
          pendingCalls.delete(oldest)
        }
      },

      "tool.execute.after": async (input, output) => {
        if (input.tool.toLowerCase() !== "task") return
        const key = pendingCallKey(input.sessionID, input.callID)
        const pending = pendingCalls.get(key)
        pendingCalls.delete(key)
        if (!pending) return

        const status = statusFromToolResult(output.output, output.metadata)
        if (!status) return

        const existing = board.get(status.taskID)
        if (!existing && !pending.background && status.state !== "running") return
        if (!existing || status.state === "running") {
          board.register({
            taskID: status.taskID,
            parentSessionID: pending.parentSessionID,
            agent: pending.agent,
            objective: pending.objective,
            dependencies: pending.dependencies,
            writeScopes: pending.writeScopes,
          })
        }

        if (status.state !== "running") board.updateStatus(status.taskID, status.state, status.result)
      },

      "experimental.chat.messages.transform": async (_input, output) => {
        const messages = Array.isArray(output.messages) ? (output.messages as MessageWithParts[]) : []

        for (const message of messages) {
          if (!isMessageWithParts(message) || message.info.role !== "user") continue
          for (const part of message.parts) {
            if (part.type !== "text" || part.synthetic !== true || typeof part.text !== "string") continue
            if (part.text.includes(BOARD_SENTINEL)) continue
            const status = parseTaskStatus(part.text)
            if (status && board.get(status.taskID)) board.updateStatus(status.taskID, status.state, status.result)
          }
        }

        for (let index = messages.length - 1; index >= 0; index -= 1) {
          const message = messages[index]
          if (!isMessageWithParts(message) || message.info.role !== "user") continue

          const sessionID = message.info.sessionID
          const agent = message.info.agent ?? (sessionID ? agentsBySession.get(sessionID) : undefined)
          if (!sessionID || agent !== "orchestrator") continue
          if (message.parts.some((part) => part.type === "text" && part.text?.includes(BOARD_SENTINEL))) return

          const prompt = board.formatForPrompt(sessionID)
          if (!prompt) return

          message.parts.unshift({
            type: "text",
            synthetic: true,
            text: prompt,
            metadata: { backgroundJobBoard: true },
          })
          board.markParentTerminalReconciled(sessionID)
          return
        }
      },

      event: async ({ event }) => {
        const properties = event.properties as EventProperties
        const sessionID = sessionIDFromProperties(properties)

        if (event.type === "session.error" && sessionID) {
          const job = board.get(sessionID)
          if (job?.state === "running") board.updateStatus(sessionID, "error", errorMessage(properties.error))
          return
        }

        if (event.type === "session.deleted" && sessionID) {
          const child = board.get(sessionID)
          if (child?.state === "running" || child?.state === "cancel_requested") {
            board.markCancelled(sessionID, "session deleted")
          }
          board.clearParent(sessionID)
          agentsBySession.delete(sessionID)
          for (const [callID, pending] of pendingCalls) {
            if (pending.parentSessionID === sessionID) pendingCalls.delete(callID)
          }
        }
      },

      dispose: async () => {
        pendingCalls.clear()
        agentsBySession.clear()
      },
    }
  }
}

function createCancelTaskTool(
  ctx: PluginInput,
  board: BackgroundJobBoard,
  agentsBySession: Map<string, string>,
  abortTimeoutMs = 10_000,
) {
  return tool({
    description:
      "Cancel a running background specialist task owned by the current Orchestrator session. Accepts the native task/session ID or Job Board alias. Cancellation stops queued and ongoing work for that task and its descendants, but does not roll back files already written.",
    args: {
      task_id: tool.schema.string().describe("Tracked task/session ID or Background Job Board alias"),
      reason: tool.schema.string().optional().describe("Short cancellation reason"),
    },
    async execute(args, toolContext) {
      assertOrchestrator(toolContext, agentsBySession)

      const parentSessionID = toolContext.sessionID
      const requested = args.task_id.trim()
      if (!requested) throw new Error("cancel_task requires task_id")
      if (requested === parentSessionID) throw new Error("cancel_task cannot cancel the parent session")

      const job = board.resolve(parentSessionID, requested)
      if (!job) throw new Error("cancel_task rejected an unknown or unowned background task")
      if (!TASK_ID_PATTERN.test(job.taskID)) throw new Error("cancel_task rejected an invalid task/session ID")
      if (job.state !== "running") {
        return taskOutput(job.taskID, job.state, `task is not running (state: ${job.state})`)
      }

      board.markCancelRequested(job.taskID, args.reason)

      try {
        const response = await withTimeout(
          ctx.client.session.abort({
            path: { id: job.taskID },
            query: { directory: toolContext.directory },
            throwOnError: true,
          }),
          abortTimeoutMs,
          `session abort timed out after ${abortTimeoutMs}ms`,
        )

        if ((response as { data?: unknown }).data !== true) {
          throw new Error("OpenCode session abort did not confirm cancellation")
        }
      } catch (error) {
        board.markCancellationFailed(job.taskID, error)
        return taskOutput(job.taskID, "running", `cancel failed: ${errorMessage(error)}`)
      }

      const cancelled = board.markCancelled(job.taskID, args.reason)
      return taskOutput(
        job.taskID,
        cancelled?.state ?? "cancelled",
        `${cancelled?.resultSummary ?? "cancelled"}; partial file writes are not rolled back`,
      )
    },
  })
}

function assertOrchestrator(context: ToolContext, agentsBySession: Map<string, string>): void {
  if (context.agent !== "orchestrator") throw new Error("cancel_task can only be used by orchestrator")

  const registered = agentsBySession.get(context.sessionID)
  if (registered && registered !== "orchestrator") {
    throw new Error("cancel_task can only be used in an orchestrator session")
  }
  agentsBySession.set(context.sessionID, "orchestrator")
}

function statusFromToolResult(output: unknown, metadata: unknown): TaskStatus | undefined {
  const meta = asRecord(metadata)
  const taskID = stringField(meta, "jobId") ?? stringField(meta, "sessionId")
  if (taskID && meta.background === true) return { taskID, state: "running" }
  return typeof output === "string" ? parseTaskStatus(output) : undefined
}

function pendingCallKey(sessionID: string, callID: string): string {
  return `${sessionID}:${callID}`
}

function taskOutput(taskID: string, state: BackgroundJobState, result: string): string {
  const tag = state === "completed" ? "task_result" : "task_error"
  return [`task_id: ${taskID}`, `state: ${state}`, "", `<${tag}>`, result, `</${tag}>`].join("\n")
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => cleanSingleLine(item, 160)).filter(Boolean))].slice(0, 20)
}

function cleanSingleLine(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function escapePromptValue(value: string): string {
  return cleanSingleLine(value, 320).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function firstContentLine(prompt: string): string | undefined {
  return prompt
    .replace(JOB_META_PATTERN, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" && value[key].trim() ? value[key].trim() : undefined
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "unknown error"
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

type MessagePart = {
  type: string
  text?: string
  synthetic?: boolean
  metadata?: Record<string, unknown>
}

type MessageWithParts = {
  info: { role?: string; sessionID?: string; agent?: string }
  parts: MessagePart[]
}

type EventProperties = {
  sessionID?: unknown
  info?: { id?: unknown }
  error?: unknown
}

function isMessageWithParts(value: unknown): value is MessageWithParts {
  const record = asRecord(value)
  return Boolean(record.info && typeof record.info === "object" && Array.isArray(record.parts))
}

function sessionIDFromProperties(properties: EventProperties): string | undefined {
  if (typeof properties.sessionID === "string") return properties.sessionID
  return typeof properties.info?.id === "string" ? properties.info.id : undefined
}

export const BackgroundJobsPlugin = createBackgroundJobsPlugin()

export default BackgroundJobsPlugin
