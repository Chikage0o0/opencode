import type { PluginConfig } from "../config";
import type { SessionState, WithParts } from "../state";
export type MessagePriority = "low" | "medium" | "high";
export interface CompressionPriorityEntry {
    ref: string;
    tokenCount: number;
    priority: MessagePriority;
}
export type CompressionPriorityMap = Map<string, CompressionPriorityEntry>;
export declare function buildPriorityMap(config: PluginConfig, state: SessionState, messages: WithParts[]): CompressionPriorityMap;
export declare function classifyMessagePriority(tokenCount: number): MessagePriority;
export declare function listPriorityRefsBeforeIndex(messages: WithParts[], priorities: CompressionPriorityMap, anchorIndex: number, priority: MessagePriority): string[];
//# sourceMappingURL=priority.d.ts.map