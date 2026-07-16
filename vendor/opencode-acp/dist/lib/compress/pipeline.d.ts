import type { PruneMessagesState, SessionState, SessionStats, WithParts } from "../state";
import type { ToolContext } from "./types";
import type { SearchContext } from "./types";
export interface CompressionSnapshot {
    messages: PruneMessagesState;
    stats: SessionStats;
    manualMode: SessionState["manualMode"];
}
export declare function snapshotCompressionState(state: SessionState): CompressionSnapshot;
export declare function restoreCompressionState(state: SessionState, snapshot: CompressionSnapshot): void;
interface RunContext {
    ask(input: {
        permission: string;
        patterns: string[];
        always: string[];
        metadata: Record<string, unknown>;
    }): Promise<void>;
    metadata(input: {
        title: string;
    }): void;
    sessionID: string;
}
export interface NotificationEntry {
    blockId: number;
    runId: number;
    summary: string;
    summaryTokens: number;
}
export interface PreparedSession {
    rawMessages: WithParts[];
    searchContext: SearchContext;
}
export declare function prepareSession(ctx: ToolContext, toolCtx: RunContext, title: string): Promise<PreparedSession>;
export declare function finalizeSession(ctx: ToolContext, toolCtx: RunContext, rawMessages: WithParts[], entries: NotificationEntry[], batchTopic: string | undefined): Promise<void>;
export {};
//# sourceMappingURL=pipeline.d.ts.map