import type { Event, Permission } from "@opencode-ai/sdk"
import type { Plugin } from "@opencode-ai/plugin"

type AlertState = "default" | "question" | "permission" | "done"
type AlertTimer = unknown

type PermissionAskOutput = { status: "ask" | "deny" | "allow" }
type SessionInfo = { id?: unknown; parentID?: unknown; title?: unknown }

type TitleAlertOptions = {
  enabled?: boolean
  write?: (value: string) => void
  setInterval?: (callback: () => void, delay: number) => AlertTimer
  clearInterval?: (timer: AlertTimer) => void
  intervalMs?: number
}

const prefixByState: Record<AlertState, string> = {
  default: "OC",
  question: "OC?",
  permission: "! OC",
  done: "✓ OC",
}

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function sessionIDOf(event: Event) {
  const properties = event.properties as { sessionID?: unknown }
  if (typeof properties.sessionID === "string") return properties.sessionID

  const info = (event.properties as { info?: SessionInfo }).info
  return typeof info?.id === "string" ? info.id : undefined
}

function sessionInfoOf(event: Event) {
  if (event.type !== "session.created" && event.type !== "session.updated") return

  const info = event.properties.info as SessionInfo
  return info && typeof info === "object" ? info : undefined
}

function sessionTitleOf(event: Event) {
  const info = sessionInfoOf(event)
  return typeof info?.title === "string" && info.title.trim() ? info.title.trim() : undefined
}

function isSubagentSessionInfo(info: SessionInfo | undefined) {
  return typeof info?.parentID === "string" && info.parentID.trim().length > 0
}

export function isOpencodeServeMode(argv = process.argv) {
  return argv.some((arg) => arg === "serve")
}

function sanitizeTitle(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim()
}

export function terminalTitleSequence(title: string) {
  return `\u001b]0;${sanitizeTitle(title)}\u0007`
}

export function createTitleAlert(options: TitleAlertOptions = {}) {
  const enabled = options.enabled ?? true
  const write = options.write ?? ((value: string) => process.stdout.write(value))
  const startTimer = options.setInterval ?? ((callback: () => void, delay: number) => setInterval(callback, delay))
  const stopTimer = options.clearInterval ?? ((timer: AlertTimer) => clearInterval(timer as ReturnType<typeof setInterval>))
  const intervalMs = options.intervalMs ?? 250
  const titles = new Map<string, string>()
  const subagentSessionIDs = new Set<string>()
  const runningSessionIDs = new Set<string>()
  let activeSessionID: string | undefined
  let lastSequence: string | undefined
  let spinnerIndex = 0
  let spinnerTimer: AlertTimer | undefined

  function currentTitle() {
    return (activeSessionID && titles.get(activeSessionID)) || "opencode"
  }

  function setTitlePrefix(prefix: string) {
    if (!enabled) return

    const sequence = terminalTitleSequence(`${prefix} | ${currentTitle()}`)
    if (sequence === lastSequence) return

    lastSequence = sequence
    write(sequence)
  }

  function setTitle(state: AlertState) {
    stopSpinner()
    setTitlePrefix(prefixByState[state])
  }

  function setSpinnerTitle() {
    setTitlePrefix(`${spinnerFrames[spinnerIndex]} OC`)
  }

  function startSpinner() {
    if (!enabled) return

    spinnerIndex = 0
    setSpinnerTitle()
    if (spinnerTimer !== undefined) return

    spinnerTimer = startTimer(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
      setSpinnerTitle()
    }, intervalMs)
  }

  function stopSpinner() {
    if (spinnerTimer === undefined) return

    stopTimer(spinnerTimer)
    spinnerTimer = undefined
  }

  function resumeRunningOrSetDefault() {
    if (runningSessionIDs.size > 0) {
      startSpinner()
      return
    }

    setTitle("default")
  }

  async function onEvent(event: Event) {
    const sessionID = sessionIDOf(event)
    const sessionInfo = sessionInfoOf(event)

    if (sessionID && isSubagentSessionInfo(sessionInfo)) subagentSessionIDs.add(sessionID)
    const isSubagentSession = sessionID !== undefined && subagentSessionIDs.has(sessionID)

    if (sessionID && !subagentSessionIDs.has(sessionID)) activeSessionID = sessionID

    const sessionTitle = sessionTitleOf(event)
    if (sessionID && sessionTitle && !subagentSessionIDs.has(sessionID)) titles.set(sessionID, sessionTitle)

    const isRunningStateEvent =
      event.type === "session.idle" || event.type === "session.next.step.started" || event.type === "session.status"
    if (isSubagentSession && !isRunningStateEvent) return

    function markRunning() {
      if (sessionID) runningSessionIDs.add(sessionID)
      startSpinner()
    }

    function markIdle() {
      if (sessionID) runningSessionIDs.delete(sessionID)
      if (runningSessionIDs.size > 0) {
        startSpinner()
        return
      }

      setTitle("done")
    }

    switch (event.type) {
      case "question.asked":
        setTitle("question")
        break
      case "permission.asked":
        setTitle("permission")
        break
      case "session.idle":
        markIdle()
        break
      case "session.status":
        if (event.properties.status.type === "busy") {
          markRunning()
          break
        }

        if (event.properties.status.type === "idle") {
          markIdle()
          break
        }

        break
      case "question.replied":
      case "question.rejected":
      case "permission.replied":
        resumeRunningOrSetDefault()
        break
      case "session.next.step.started":
        markRunning()
        break
    }
  }

  async function onPermissionAsk(input: Permission, output: PermissionAskOutput) {
    if (!enabled) return

    if (typeof input.sessionID === "string") activeSessionID = input.sessionID
    setTitle("permission")

    // 只提醒，不改变 opencode 原本的权限决策流程。
    output.status = output.status === "deny" || output.status === "allow" ? output.status : "ask"
  }

  return { onEvent, onPermissionAsk }
}

export const TitleAlertPlugin: Plugin = async () => {
  const alert = createTitleAlert({ enabled: !isOpencodeServeMode() })

  return {
    event: async ({ event }) => {
      await alert.onEvent(event)
    },
    "permission.ask": async (input, output) => {
      await alert.onPermissionAsk(input, output)
    },
  }
}

export default TitleAlertPlugin
