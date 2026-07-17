/**
 * State persistence module for ACP plugin.
 * Persists pruned tool IDs across sessions so they survive OpenCode restarts.
 * Storage location: ~/.local/share/opencode/storage/plugin/acp/{sessionId}.json
 */
import * as fs from "fs/promises";
import type { CompressionBlock, PrunedMessageEntry, SessionState, SessionStats } from "./types";
import type { Logger } from "../logger";
type StorageFileSystem = Pick<typeof fs, "cp" | "mkdir" | "rename" | "rm">;
/** Prune state as stored on disk */
export interface PersistedPruneMessagesState {
    byMessageId: Record<string, PrunedMessageEntry>;
    blocksById: Record<string, CompressionBlock>;
    activeBlockIds: number[];
    activeByAnchorMessageId: Record<string, number>;
    nextBlockId: number;
    nextRunId: number;
    markedForCleanup?: number[];
}
export interface PersistedPrune {
    tools?: Record<string, number>;
    messages?: PersistedPruneMessagesState;
}
export interface PersistedNudges {
    contextLimitAnchors: string[];
    turnNudgeAnchors?: string[];
    iterationNudgeAnchors?: string[];
}
export interface PersistedMessageIds {
    byRawId: Record<string, string>;
    byRef: Record<string, string>;
    nextRef: number;
}
export interface PersistedSessionState {
    sessionName?: string;
    prune: PersistedPrune;
    nudges: PersistedNudges;
    stats: SessionStats;
    lastUpdated: string;
    messageIds?: PersistedMessageIds;
    lastCompaction?: number;
    modelContextLimit?: number;
}
/** One-time migration: copy plugin/dcp/ → plugin/acp/ if ACP dir doesn't exist yet */
export declare function migrateFromLegacyIfNeeded(storageDir: string, legacyDir: string, logger: Logger, storageFileSystem?: StorageFileSystem): Promise<void>;
export declare function ensureStorageDir(storageDir: string, legacyDir: string, logger: Logger, storageFileSystem?: StorageFileSystem): Promise<void>;
/** Waits until queued state writes for one session, or every session, have settled. */
export declare function drainSessionStateWrites(sessionId?: string): Promise<void>;
export declare function saveSessionState(sessionState: SessionState, logger: Logger, sessionName?: string): Promise<void>;
export declare function loadSessionState(sessionId: string, logger: Logger): Promise<PersistedSessionState | null>;
export interface AggregatedStats {
    totalTokens: number;
    totalTools: number;
    totalMessages: number;
    sessionCount: number;
}
export declare function loadAllSessionStats(logger: Logger): Promise<AggregatedStats>;
export {};
//# sourceMappingURL=persistence.d.ts.map