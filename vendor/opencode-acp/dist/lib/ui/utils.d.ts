import { SessionState, ToolParameterEntry, WithParts } from "../state";
export declare function formatStatsHeader(totalTokensSaved: number, pruneTokenCounter: number): string;
export declare function formatAge(createdAt: number): string;
export declare function formatTokenCount(tokens: number, compact?: boolean): string;
export declare function formatProgressBar(messageIds: string[], prunedMessages: Map<string, number>, recentMessageIds: string[], width?: number): string;
export declare function cacheSystemPromptTokens(state: SessionState, messages: WithParts[]): void;
export declare function formatPrunedItemsList(pruneToolIds: string[], toolMetadata: Map<string, ToolParameterEntry>, workingDirectory?: string): string[];
//# sourceMappingURL=utils.d.ts.map