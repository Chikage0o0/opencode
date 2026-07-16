import type { SessionState, WithParts } from "../state";
import type { PluginConfig } from "../config";
import type { Logger } from "../logger";
export interface MergeMarkedResult {
    mergedCount: number;
    savedTokens: number;
}
export interface BatchCleanupResult {
    tier: 0 | 1 | 2 | 3;
    action: "none" | "nudge" | "merge";
    mergedCount: number;
    savedTokens: number;
    nudgeText?: string;
}
export declare function mergeMarkedBlocks(state: SessionState, markedIds: number[], maxMergedLength: number): MergeMarkedResult;
export declare function runBatchCleanup(state: SessionState, config: PluginConfig, logger: Logger, messages: WithParts[]): BatchCleanupResult;
//# sourceMappingURL=merge.d.ts.map