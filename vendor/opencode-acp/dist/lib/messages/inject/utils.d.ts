import type { SessionState, WithParts } from "../../state";
import type { PluginConfig } from "../../config";
import type { RuntimePrompts } from "../../prompts/store";
import { type CompressionPriorityMap } from "../priority";
export interface LastUserModelContext {
    providerId: string | undefined;
    modelId: string | undefined;
}
export interface LastNonIgnoredMessage {
    message: WithParts;
    index: number;
}
interface ModelLimit {
    context: number;
    input?: number;
    output?: number;
}
export declare function computeInputBudget(limit: ModelLimit): number | undefined;
export declare function getNudgeFrequency(config: PluginConfig): number;
export declare function getIterationNudgeThreshold(config: PluginConfig): number;
export declare function findLastNonIgnoredMessage(messages: WithParts[]): LastNonIgnoredMessage | null;
export declare function countMessagesAfterIndex(messages: WithParts[], index: number): number;
export declare function getModelInfo(messages: WithParts[]): LastUserModelContext;
export declare function isContextOverLimits(config: PluginConfig, state: SessionState, providerId: string | undefined, modelId: string | undefined, messages: WithParts[]): {
    overMaxLimit: boolean;
    overMinLimit: boolean;
    currentTokens: number;
    modelContextLimit: number | undefined;
};
export declare function addAnchor(anchorMessageIds: Set<string>, anchorMessageId: string, anchorMessageIndex: number, messages: WithParts[], interval: number): boolean;
/**
 * Build tiered context usage guidance based on actual config thresholds.
 * Shared by inject.ts (suffix message) and utils.ts (anchored nudges).
 */
export declare function buildContextUsageGuidance(config: PluginConfig, currentTokens?: number, modelContextLimit?: number): string;
export declare function applyAnchoredNudges(state: SessionState, config: PluginConfig, messages: WithParts[], prompts: RuntimePrompts, compressionPriorities?: CompressionPriorityMap, suffixMessage?: WithParts | null): void;
export interface ContextComposition {
    toolTokens: number;
    codeTokens: number;
    summaryTokens: number;
    messageTokens: number;
    textTokens: number;
    protectedTokens: number;
    total: number;
    largestRanges: {
        ref: string;
        tokens: number;
    }[];
    largestToolRanges: {
        ref: string;
        tokens: number;
        tool?: string;
    }[];
    largestCodeRanges: {
        ref: string;
        tokens: number;
    }[];
    largestMessageRanges: {
        ref: string;
        tokens: number;
    }[];
    toolTypeBreakdown: {
        tool: string;
        tokens: number;
    }[];
}
export declare function estimateContextComposition(messages: WithParts[], state?: SessionState, protectedTools?: string[], protectedFilePatterns?: string[]): ContextComposition;
export interface CompressibleRange {
    startRef: string;
    endRef: string;
    count: number;
    tokens: number;
    toolPct: number;
    textPct: number;
}
export interface ProtectedRange {
    startRef: string;
    endRef: string;
    count: number;
    tokens: number;
    tools: string[];
}
export interface ContextRanges {
    compressible: CompressibleRange[];
    protected: ProtectedRange[];
}
export declare function buildCompressibleRanges(messages: WithParts[], state: SessionState, protectedTools?: string[], protectedFilePatterns?: string[]): ContextRanges;
export declare function formatCompressibleRanges(ranges: CompressibleRange[], protectedRanges?: ProtectedRange[]): string;
export {};
//# sourceMappingURL=utils.d.ts.map