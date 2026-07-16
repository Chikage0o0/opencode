import type { SessionState } from "../state/types";
export interface PendingCompressionDuration {
    messageId: string;
    callId: string;
    durationMs: number;
}
export interface CompressionTimingState {
    startsByCallId: Map<string, number>;
    pendingByCallId: Map<string, PendingCompressionDuration>;
}
export declare function buildCompressionTimingKey(messageId: string, callId: string): string;
export declare function consumeCompressionStart(state: SessionState, messageId: string, callId: string): number | undefined;
export declare function resolveCompressionDuration(startedAt: number | undefined, eventTime: number | undefined, partTime: {
    start?: unknown;
    end?: unknown;
} | undefined): number | undefined;
export declare function applyPendingCompressionDurations(state: SessionState): number;
//# sourceMappingURL=timing.d.ts.map