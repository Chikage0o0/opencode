import type { SessionState, WithParts } from "../state";
/** Tool name used for synthetic compression-recap injection. */
export declare const ACP_RECAP_TOOL_NAME = "acp_context_recap";
export declare const createSyntheticMessage: (baseMessage: WithParts, content: string, stableSeed?: string, role?: "user" | "assistant") => WithParts;
export declare const createSyntheticUserMessage: (baseMessage: WithParts, content: string, stableSeed?: string) => WithParts;
export declare const createSyntheticToolRecap: (baseMessage: WithParts, summary: string, blockId: number | string, range: string | undefined, stableSeed: string) => WithParts;
export declare const createSyntheticTextPart: (baseMessage: WithParts, content: string, stableSeed?: string) => {
    id: string;
    sessionID: string;
    messageID: string;
    type: "text";
    text: string;
};
type MessagePart = WithParts["parts"][number];
type TextPart = Extract<MessagePart, {
    type: "text";
}>;
export declare const appendToLastTextPart: (message: WithParts, injection: string) => boolean;
export declare const appendToTextPart: (part: TextPart, injection: string) => boolean;
export declare const appendToAllToolParts: (message: WithParts, tag: string) => boolean;
export declare const hasContent: (message: WithParts) => boolean;
export declare function buildToolIdList(state: SessionState, messages: WithParts[]): string[];
export declare const replaceBlockIdsWithBlocked: (text: string) => string;
export declare const stripStaleMessageRefs: (text: string) => string;
export declare const stripHallucinationsFromString: (text: string) => string;
export declare const stripHallucinations: (messages: WithParts[]) => void;
export declare const dropEmptyMessages: (messages: WithParts[]) => number;
export {};
//# sourceMappingURL=utils.d.ts.map