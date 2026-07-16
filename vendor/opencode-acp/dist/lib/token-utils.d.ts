import { SessionState, WithParts } from "./state";
import { Logger } from "./logger";
export declare function getCurrentTokenUsage(state: SessionState, messages: WithParts[]): number;
export declare function getCurrentParams(state: SessionState, messages: WithParts[], logger: Logger): {
    providerId: string | undefined;
    modelId: string | undefined;
    agent: string | undefined;
    variant: string | undefined;
};
export declare function countTokens(text: string): number;
export declare function estimateTokensBatch(texts: string[]): number;
export declare const COMPACTED_TOOL_OUTPUT_PLACEHOLDER = "[Old tool result content cleared]";
export declare function extractCompletedToolOutput(part: any): string | undefined;
export declare function extractToolContent(part: any): string[];
export declare function countToolTokens(part: any): number;
export declare function getTotalToolTokens(state: SessionState, toolIds: string[]): number;
export declare function countMessageTextTokens(msg: WithParts): number;
export declare function countAllMessageTokens(msg: WithParts): number;
export declare function countMessageCharacters(msg: WithParts): number;
//# sourceMappingURL=token-utils.d.ts.map