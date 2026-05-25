import { describe, expect, test } from "bun:test"

import { createTitleAlert, terminalTitleSequence } from "../plugins/title-alert"

describe("title alert renderer", () => {
  test("uses OSC terminal title escape and strips controls", () => {
    expect(terminalTitleSequence("OC? | hello\u001b]0;bad\u0007")).toBe("\u001b]0;OC? | hello]0;bad\u0007")
  })

  test("updates only the OC prefix for question, permission and idle states", async () => {
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
      "\u001b]0;OC! | 实现插件\u0007",
      "\u001b]0;OC✓ | 实现插件\u0007",
    ])
  })

  test("permission.ask hook triggers the permission title without auto-allowing", async () => {
    const writes: string[] = []
    const alert = createTitleAlert({ write: (value) => writes.push(value) })
    const output = { status: "ask" as const }

    await alert.onPermissionAsk({ id: "p1", sessionID: "s1" }, output)

    expect(output.status).toBe("ask")
    expect(writes).toEqual(["\u001b]0;OC! | opencode\u0007"])
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
      "\u001b]0;OC⠋ | 实现插件\u0007",
      "\u001b]0;OC⠙ | 实现插件\u0007",
      "\u001b]0;OC⠹ | 实现插件\u0007",
    ])

    await alert.onEvent({
      id: "idle",
      type: "session.idle",
      properties: { sessionID: "s1" },
    })

    expect(timers.size).toBe(0)
    expect(writes.at(-1)).toBe("\u001b]0;OC✓ | 实现插件\u0007")
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
      "\u001b]0;OC⠋ | 实现插件\u0007",
      "\u001b]0;OC⠙ | 实现插件\u0007",
    ])

    await alert.onEvent({
      id: "idle-status",
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "idle" } },
    })

    expect(timers.size).toBe(0)
    expect(writes.at(-1)).toBe("\u001b]0;OC✓ | 实现插件\u0007")
  })
})
