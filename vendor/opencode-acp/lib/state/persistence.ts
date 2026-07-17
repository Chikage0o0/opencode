/**
 * State persistence module for ACP plugin.
 * Persists pruned tool IDs across sessions so they survive OpenCode restarts.
 * Storage location: ~/.local/share/opencode/storage/plugin/acp/{sessionId}.json
 */

import * as fs from "fs/promises"
import { existsSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import type { CompressionBlock, PrunedMessageEntry, SessionState, SessionStats } from "./types"
import type { Logger } from "../logger"
import { serializePruneMessagesState } from "./utils"
import { createKeyedWriteQueue } from "./write-queue"

const persistedStateWrites = createKeyedWriteQueue()
const storageInitializations = new Map<string, Promise<void>>()
const sessionWritePaths = new Map<string, Set<string>>()
let nextTemporaryFileId = 0

type StorageFileSystem = Pick<typeof fs, "cp" | "mkdir" | "rename" | "rm">

function getLegacyStorageDir(): string {
    return join(
        process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
        "opencode",
        "storage",
        "plugin",
        "dcp",
    )
}

/** Prune state as stored on disk */
export interface PersistedPruneMessagesState {
    byMessageId: Record<string, PrunedMessageEntry>
    blocksById: Record<string, CompressionBlock>
    activeBlockIds: number[]
    activeByAnchorMessageId: Record<string, number>
    nextBlockId: number
    nextRunId: number
    markedForCleanup?: number[]
}

export interface PersistedPrune {
    tools?: Record<string, number>
    messages?: PersistedPruneMessagesState
}

export interface PersistedNudges {
    contextLimitAnchors: string[]
    turnNudgeAnchors?: string[]
    iterationNudgeAnchors?: string[]
}

export interface PersistedMessageIds {
    byRawId: Record<string, string>
    byRef: Record<string, string>
    nextRef: number
}

export interface PersistedSessionState {
    sessionName?: string
    prune: PersistedPrune
    nudges: PersistedNudges
    stats: SessionStats
    lastUpdated: string
    messageIds?: PersistedMessageIds
    lastCompaction?: number
    modelContextLimit?: number
}

function getStorageDir(): string {
    return join(
        process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
        "opencode",
        "storage",
        "plugin",
        "acp",
    )
}

/** One-time migration: copy plugin/dcp/ → plugin/acp/ if ACP dir doesn't exist yet */
export async function migrateFromLegacyIfNeeded(
    storageDir: string,
    legacyDir: string,
    logger: Logger,
    storageFileSystem: StorageFileSystem = fs,
): Promise<void> {
    if (existsSync(storageDir)) return
    if (!existsSync(legacyDir)) return

    const migrationPath = `${storageDir}.migration.${process.pid}.${nextTemporaryFileId++}.tmp`
    let installed = false
    try {
        await storageFileSystem.rm(migrationPath, { recursive: true, force: true })
        await storageFileSystem.cp(legacyDir, migrationPath, { recursive: true })

        try {
            await storageFileSystem.rename(migrationPath, storageDir)
            installed = true
        } catch (error) {
            // Another process may have installed the same migration or created fresh ACP state.
            // Never replace that final directory with a stale legacy snapshot.
            if (!existsSync(storageDir)) throw error
        }

        if (installed) logger.info(`[ACP] Migrated storage from ${legacyDir} → ${storageDir}`)
    } catch (e: any) {
        logger.warn(`[ACP] Storage migration failed: ${e.message}`)
        // Do not create an empty ACP directory after a transient migration failure. Without a
        // separate completion marker, the directory itself is the only signal that migration
        // finished and future reads would permanently skip the legacy state.
        if (!existsSync(storageDir)) throw e
    } finally {
        await storageFileSystem
            .rm(migrationPath, { recursive: true, force: true })
            .catch(() => undefined)
    }
}

export function ensureStorageDir(
    storageDir: string,
    legacyDir: string,
    logger: Logger,
    storageFileSystem: StorageFileSystem = fs,
): Promise<void> {
    if (existsSync(storageDir)) return Promise.resolve()

    const existing = storageInitializations.get(storageDir)
    if (existing) return existing

    const initialization = (async () => {
        if (existsSync(storageDir)) return
        await migrateFromLegacyIfNeeded(storageDir, legacyDir, logger, storageFileSystem)
        await storageFileSystem.mkdir(storageDir, { recursive: true })
    })()

    storageInitializations.set(storageDir, initialization)
    void initialization.then(
        () => {
            if (storageInitializations.get(storageDir) === initialization) {
                storageInitializations.delete(storageDir)
            }
        },
        () => {
            if (storageInitializations.get(storageDir) === initialization) {
                storageInitializations.delete(storageDir)
            }
        },
    )

    return initialization
}

function getSessionFilePath(sessionId: string): string {
    return join(getStorageDir(), `${sessionId}.json`)
}

async function writePersistedSessionState(
    sessionId: string,
    state: PersistedSessionState,
    logger: Logger,
): Promise<void> {
    // Capture paths and content before queueing. Persisted snapshots contain shallow references
    // that later ACP operations may mutate while this write waits behind an older one.
    const filePath = getSessionFilePath(sessionId)
    const storageDir = getStorageDir()
    const legacyDir = getLegacyStorageDir()
    const content = JSON.stringify(state, null, 2)
    const totalTokensSaved = state.stats.totalPruneTokens
    const temporaryFileId = nextTemporaryFileId++
    const paths = sessionWritePaths.get(sessionId) ?? new Set<string>()
    paths.add(filePath)
    sessionWritePaths.set(sessionId, paths)

    await persistedStateWrites.run(filePath, async () => {
        await ensureStorageDir(storageDir, legacyDir, logger)

        // The queue prevents same-process reordering. Rename keeps readers from observing a
        // partially written JSON file if OpenCode exits during the write.
        const temporaryPath = `${filePath}.${process.pid}.${temporaryFileId}.tmp`
        try {
            await fs.writeFile(temporaryPath, content, "utf-8")
            await fs.rename(temporaryPath, filePath)
        } catch (error) {
            await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
            throw error
        }

        logger.info("Saved session state to disk", {
            sessionId,
            totalTokensSaved,
        })
    })
}

/** Waits until queued state writes for one session, or every session, have settled. */
export async function drainSessionStateWrites(sessionId?: string): Promise<void> {
    if (sessionId === undefined) {
        try {
            await persistedStateWrites.drain()
        } finally {
            sessionWritePaths.clear()
        }
        return
    }

    const paths = [...(sessionWritePaths.get(sessionId) ?? [])]
    try {
        const results = await Promise.allSettled(
            paths.map((path) => persistedStateWrites.drain(path)),
        )
        const failures = results.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
        )
        if (failures.length > 0) {
            throw new AggregateError(failures, `Failed to persist ACP session state: ${sessionId}`)
        }
    } finally {
        sessionWritePaths.delete(sessionId)
    }
}

// [FIX Bug 6] Removed try/catch — errors now propagate to callers so they know save failed
export async function saveSessionState(
    sessionState: SessionState,
    logger: Logger,
    sessionName?: string,
): Promise<void> {
    if (!sessionState.sessionId) {
        return
    }

    const state: PersistedSessionState = {
        sessionName: sessionName,
        prune: {
            tools: Object.fromEntries(sessionState.prune.tools),
            messages: serializePruneMessagesState(sessionState.prune.messages),
        },
        nudges: {
            contextLimitAnchors: Array.from(sessionState.nudges.contextLimitAnchors),
            turnNudgeAnchors: Array.from(sessionState.nudges.turnNudgeAnchors),
            iterationNudgeAnchors: Array.from(sessionState.nudges.iterationNudgeAnchors),
        },
        stats: sessionState.stats,
        lastUpdated: new Date().toISOString(),
        messageIds: {
            byRawId: Object.fromEntries(sessionState.messageIds.byRawId),
            byRef: Object.fromEntries(sessionState.messageIds.byRef),
            nextRef: sessionState.messageIds.nextRef,
        },
        lastCompaction: sessionState.lastCompaction,
        modelContextLimit: sessionState.modelContextLimit,
    }

    await writePersistedSessionState(sessionState.sessionId, state, logger)
}

export async function loadSessionState(
    sessionId: string,
    logger: Logger,
): Promise<PersistedSessionState | null> {
    try {
        const storageDir = getStorageDir()
        await ensureStorageDir(storageDir, getLegacyStorageDir(), logger)
        const filePath = join(storageDir, `${sessionId}.json`)

        if (!existsSync(filePath)) {
            return null
        }

        const content = await fs.readFile(filePath, "utf-8")
        const state = JSON.parse(content) as PersistedSessionState

        const hasPruneTools = state?.prune?.tools && typeof state.prune.tools === "object"
        const hasPruneMessages = state?.prune?.messages && typeof state.prune.messages === "object"
        const hasNudgeFormat = state?.nudges && typeof state.nudges === "object"
        if (
            !state ||
            !state.prune ||
            !hasPruneTools ||
            !hasPruneMessages ||
            !state.stats ||
            !hasNudgeFormat
        ) {
            logger.warn("Invalid session state file, ignoring", {
                sessionId: sessionId,
            })
            return null
        }

        const rawContextLimitAnchors = Array.isArray(state.nudges.contextLimitAnchors)
            ? state.nudges.contextLimitAnchors
            : []
        const validAnchors = rawContextLimitAnchors.filter(
            (entry): entry is string => typeof entry === "string",
        )
        const dedupedAnchors = [...new Set(validAnchors)]
        if (validAnchors.length !== rawContextLimitAnchors.length) {
            logger.warn("Filtered out malformed contextLimitAnchors entries", {
                sessionId: sessionId,
                original: rawContextLimitAnchors.length,
                valid: validAnchors.length,
            })
        }
        state.nudges.contextLimitAnchors = dedupedAnchors

        const rawTurnNudgeAnchors = Array.isArray(state.nudges.turnNudgeAnchors)
            ? state.nudges.turnNudgeAnchors
            : []
        const validSoftAnchors = rawTurnNudgeAnchors.filter(
            (entry): entry is string => typeof entry === "string",
        )
        const dedupedSoftAnchors = [...new Set(validSoftAnchors)]
        if (validSoftAnchors.length !== rawTurnNudgeAnchors.length) {
            logger.warn("Filtered out malformed turnNudgeAnchors entries", {
                sessionId: sessionId,
                original: rawTurnNudgeAnchors.length,
                valid: validSoftAnchors.length,
            })
        }
        state.nudges.turnNudgeAnchors = dedupedSoftAnchors

        const rawIterationNudgeAnchors = Array.isArray(state.nudges.iterationNudgeAnchors)
            ? state.nudges.iterationNudgeAnchors
            : []
        const validIterationAnchors = rawIterationNudgeAnchors.filter(
            (entry): entry is string => typeof entry === "string",
        )
        const dedupedIterationAnchors = [...new Set(validIterationAnchors)]
        if (validIterationAnchors.length !== rawIterationNudgeAnchors.length) {
            logger.warn("Filtered out malformed iterationNudgeAnchors entries", {
                sessionId: sessionId,
                original: rawIterationNudgeAnchors.length,
                valid: validIterationAnchors.length,
            })
        }
        state.nudges.iterationNudgeAnchors = dedupedIterationAnchors

        const persistedMessageIds = (state as any).messageIds as PersistedMessageIds | undefined
        if (persistedMessageIds) {
            ;(state as any)._persistedMessageIds = persistedMessageIds
        }
        const persistedLastCompaction = (state as any).lastCompaction as number | undefined
        if (persistedLastCompaction !== undefined) {
            ;(state as any)._persistedLastCompaction = persistedLastCompaction
        }

        logger.info("Loaded session state from disk", {
            sessionId: sessionId,
        })

        return state
    } catch (error: any) {
        logger.warn("Failed to load session state", {
            sessionId: sessionId,
            error: error?.message,
        })
        return null
    }
}

export interface AggregatedStats {
    totalTokens: number
    totalTools: number
    totalMessages: number
    sessionCount: number
}

export async function loadAllSessionStats(logger: Logger): Promise<AggregatedStats> {
    const result: AggregatedStats = {
        totalTokens: 0,
        totalTools: 0,
        totalMessages: 0,
        sessionCount: 0,
    }

    try {
        const storageDir = getStorageDir()
        await ensureStorageDir(storageDir, getLegacyStorageDir(), logger)

        const files = await fs.readdir(storageDir)
        const jsonFiles = files.filter((f) => f.endsWith(".json"))

        for (const file of jsonFiles) {
            try {
                const filePath = join(storageDir, file)
                const content = await fs.readFile(filePath, "utf-8")
                const state = JSON.parse(content) as PersistedSessionState

                if (state?.stats?.totalPruneTokens && state?.prune) {
                    result.totalTokens += state.stats.totalPruneTokens
                    result.totalTools += state.prune.tools
                        ? Object.keys(state.prune.tools).length
                        : 0
                    result.totalMessages += state.prune.messages?.byMessageId
                        ? Object.keys(state.prune.messages.byMessageId).length
                        : 0
                    result.sessionCount++
                }
            } catch {
                // Skip invalid files
            }
        }

        logger.debug("Loaded all-time stats", result)
    } catch (error: any) {
        logger.warn("Failed to load all-time stats", { error: error?.message })
    }

    return result
}
