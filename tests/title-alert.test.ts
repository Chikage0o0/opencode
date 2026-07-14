import { describe, expect, test } from "bun:test"

import {
  createTitleAlert,
  isOpencodeServeMode,
  shouldEnableTitleAlert,
  terminalTitleSequence,
} from "../lib/title-alert-core"

describe("title alert renderer", () => {
  test("uses OSC terminal title escape and strips controls", () => {
    expect(terminalTitleSequence("OC? | hello\u001b]0;bad\u0007")).toBe("\u001b]0;OC? | hello]0;bad\u0007")
  })

  test("detects opencode serve mode from process arguments", () => {
    expect(isOpencodeServeMode(["node", "opencode", "serve"])).toBe(true)
    expect(isOpencodeServeMode(["node", "opencode"])).toBe(false)
  })

  test("disables terminal title output for non-interactive commands", () => {
    expect(shouldEnableTitleAlert(["node", "opencode", "run"])).toBe(false)
    expect(shouldEnableTitleAlert(["node", "opencode", "serve"])).toBe(false)
    expect(shouldEnableTitleAlert(["node", "opencode"])).toBe(true)
  })

  test("uses the spinner marker slot for permission and done states", async () => {
    const writes: string[] = []
    const alert = createTitleAlert({ write: (value) => writes.push(value) })

    await alert.onEvent({
      id: "session",
      type: "session.updated",
      properties: { sessionID: "s1", info: { title: "实现插件" } },
    })

    await alert.onEvent({
      id: "question",
      type: "question.asked",
      properties: { sessionID: "s1" },
    })
    await alert.onEvent({
      id: "permission",
      type: "permission.asked",
      properties: { sessionID: "s1" },
    })
    await alert.onEvent({
      id: "idle",
      type: "session.idle",
      properties: { sessionID: "s1" },
    })

    expect(writes).toEqual([
      "\u001b]0;OC? | 实现插件\u0007",
      "\u001b]0;! OC | 实现插件\u0007",
      "\u001b]0;✓ OC | 实现插件\u0007",
    ])
  })

  test("permission.ask hook triggers the permission title without auto-allowing", async () => {
    const writes: string[] = []
    const alert = createTitleAlert({ write: (value) => writes.push(value) })
    const output = { status: "ask" as const }

    await alert.onPermissionAsk({ id: "p1", sessionID: "s1" }, output)

    expect(output.status).toBe("ask")
    expect(writes).toEqual(["\u001b]0;! OC | opencode\u0007"])
  })

  test("does not change terminal title when disabled for opencode serve", async () => {
    const writes: string[] = []
    const timers = new Map<number, () => void>()
    const alert = createTitleAlert({
      enabled: false,
      write: (value) => writes.push(value),
      setInterval: (callback) => {
        timers.set(1, callback)
        return 1
      },
      clearInterval: (timerID) => {
        timers.delete(timerID as number)
      },
    })
    const output = { status: "ask" as const }

    await alert.onEvent({
      id: "busy",
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "busy" } },
    })
    await alert.onPermissionAsk({ id: "p1", sessionID: "s1" }, output)
    timers.get(1)?.()

    expect(output.status).toBe("ask")
    expect(writes).toEqual([])
    expect(timers.size).toBe(0)
  })

  test("animates the OC prefix with a spinner while a session step is running", async () => {
    const writes: string[] = []
    const timers = new Map<number, () => void>()
    let nextTimerID = 1
    const alert = createTitleAlert({
      write: (value) => writes.push(value),
      setInterval: (callback) => {
        const timerID = nextTimerID++
        timers.set(timerID, callback)
        return timerID
      },
      clearInterval: (timerID) => {
        timers.delete(timerID as number)
      },
    })

    await alert.onEvent({
      id: "session",
      type: "session.updated",
      properties: { sessionID: "s1", info: { title: "实现插件" } },
    })
    await alert.onEvent({
      id: "step-started",
      type: "session.next.step.started",
      properties: { sessionID: "s1" },
    })
    timers.get(1)?.()
    timers.get(1)?.()

    expect(writes).toEqual([
      "\u001b]0;⠋ OC | 实现插件\u0007",
      "\u001b]0;⠙ OC | 实现插件\u0007",
      "\u001b]0;⠹ OC | 实现插件\u0007",
    ])

    await alert.onEvent({
      id: "idle",
      type: "session.idle",
      properties: { sessionID: "s1" },
    })

    expect(timers.size).toBe(0)
    expect(writes.at(-1)).toBe("\u001b]0;✓ OC | 实现插件\u0007")
  })

  test("animates while the session status is busy", async () => {
    const writes: string[] = []
    const timers = new Map<number, () => void>()
    let nextTimerID = 1
    const alert = createTitleAlert({
      write: (value) => writes.push(value),
      setInterval: (callback) => {
        const timerID = nextTimerID++
        timers.set(timerID, callback)
        return timerID
      },
      clearInterval: (timerID) => {
        timers.delete(timerID as number)
      },
    })

    await alert.onEvent({
      id: "session",
      type: "session.updated",
      properties: { sessionID: "s1", info: { title: "实现插件" } },
    })
    await alert.onEvent({
      id: "busy",
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "busy" } },
    })
    timers.get(1)?.()

    expect(writes).toEqual([
      "\u001b]0;⠋ OC | 实现插件\u0007",
      "\u001b]0;⠙ OC | 实现插件\u0007",
    ])

    await alert.onEvent({
      id: "idle-status",
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "idle" } },
    })

    expect(timers.size).toBe(0)
    expect(writes.at(-1)).toBe("\u001b]0;✓ OC | 实现插件\u0007")
  })

  test("keeps spinning while a background subagent session is busy", async () => {
    const writes: string[] = []
    const timers = new Map<number, () => void>()
    let nextTimerID = 1
    const alert = createTitleAlert({
      write: (value) => writes.push(value),
      setInterval: (callback) => {
        const timerID = nextTimerID++
        timers.set(timerID, callback)
        return timerID
      },
      clearInterval: (timerID) => {
        timers.delete(timerID as number)
      },
    })

    await alert.onEvent({
      id: "parent-session",
      type: "session.updated",
      properties: { sessionID: "parent", info: { title: "主任务" } },
    })
    await alert.onEvent({
      id: "subagent-session",
      type: "session.updated",
      properties: { sessionID: "child", info: { title: "子任务", parentID: "parent" } },
    })
    await alert.onEvent({
      id: "subagent-busy",
      type: "session.status",
      properties: { sessionID: "child", status: { type: "busy" } },
    })

    timers.get(1)?.()

    expect(writes).toEqual(["\u001b]0;⠋ OC | 主任务\u0007", "\u001b]0;⠙ OC | 主任务\u0007"])
    expect(timers.size).toBe(1)

    await alert.onEvent({
      id: "subagent-idle",
      type: "session.status",
      properties: { sessionID: "child", status: { type: "idle" } },
    })

    expect(timers.size).toBe(0)
    expect(writes.at(-1)).toBe("\u001b]0;✓ OC | 主任务\u0007")
  })
})
