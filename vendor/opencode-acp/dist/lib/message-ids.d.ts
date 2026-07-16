import type { SessionState, WithParts } from "./state";
export type ParsedBoundaryId = {
    kind: "message";
    ref: string;
    index: number;
} | {
    kind: "compressed-block";
    ref: string;
    blockId: number;
};
export declare function formatMessageRef(index: number): string;
export declare function formatBlockRef(blockId: number): string;
export declare function parseMessageRef(ref: string): number | null;
export declare function parseBlockRef(ref: string): number | null;
export declare function parseBoundaryId(id: string): ParsedBoundaryId | null;
export declare function formatMessageIdTag(ref: string, attributes?: Record<string, string | undefined>): string;
export declare function formatTokenSize(tokens: number): string;
export declare function classifyMessageType(parts: WithParts["parts"]): string;
export declare function assignMessageRefs(state: SessionState, messages: WithParts[]): number;
//# sourceMappingURL=message-ids.d.ts.map