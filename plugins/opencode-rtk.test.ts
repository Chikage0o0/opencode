import { describe, expect, test } from "bun:test"

import { shouldSkipRtkRewrite } from "./opencode-rtk"

describe("shouldSkipRtkRewrite", () => {
  test("skips git commit commands that rely on raw git behavior", () => {
    expect(shouldSkipRtkRewrite('git commit -F "$tmp"')).toBe(true)
    expect(shouldSkipRtkRewrite('git -C "$repo" commit -F "$tmp"')).toBe(true)
  })

  test("skips git status commands that require machine-readable output", () => {
    expect(shouldSkipRtkRewrite("git status --short")).toBe(true)
    expect(shouldSkipRtkRewrite("git status --porcelain=v1")).toBe(true)
    expect(shouldSkipRtkRewrite("git status -s")).toBe(true)
    expect(shouldSkipRtkRewrite("git status -sb")).toBe(true)
  })

  test("skips git diff and formatted git log commands", () => {
    expect(shouldSkipRtkRewrite("git diff --cached")).toBe(true)
    expect(shouldSkipRtkRewrite("git diff --name-only --diff-filter=U")).toBe(true)
    expect(shouldSkipRtkRewrite("git log --format=%B%n----END---- -n 10")).toBe(true)
    expect(shouldSkipRtkRewrite("git log -1 --stat")).toBe(true)
    expect(shouldSkipRtkRewrite("git log --pretty=format:%H -n 1")).toBe(true)
    expect(shouldSkipRtkRewrite("git log --pretty=%B -n 1")).toBe(true)
  })

  test("skips compound commands that contain sensitive git invocations", () => {
    expect(shouldSkipRtkRewrite("git status && git diff --cached")).toBe(true)
    expect(shouldSkipRtkRewrite('print ready; git commit -F "$tmp"')).toBe(true)
  })

  test("keeps ordinary commands eligible for rewrite", () => {
    expect(shouldSkipRtkRewrite("git status")).toBe(false)
    expect(shouldSkipRtkRewrite("ls -la")).toBe(false)
  })

  test("keeps rg passthrough behavior", () => {
    expect(shouldSkipRtkRewrite("rg TODO plugins")).toBe(true)
  })
})
