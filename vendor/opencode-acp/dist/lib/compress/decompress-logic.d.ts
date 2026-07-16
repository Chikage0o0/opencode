import type { CompressionBlock, PruneMessagesState, WithParts } from "../state";
import type { CompressionTarget } from "../commands/compression-targets";
export declare function parseBlockIdArg(arg: string): number | null;
export declare function findActiveParentBlockId(messagesState: PruneMessagesState, block: CompressionBlock): number | null;
export declare function findActiveAncestorBlockId(messagesState: PruneMessagesState, target: CompressionTarget): number | null;
export declare function snapshotActiveMessages(messagesState: PruneMessagesState): Map<string, number>;
export declare function deactivateCompressionTarget(messagesState: PruneMessagesState, target: CompressionTarget): void;
export interface RestoredMessagesResult {
    restoredMessageCount: number;
    restoredTokens: number;
}
export declare function computeRestoredMessages(messagesState: PruneMessagesState, activeMessagesBefore: Map<string, number>): RestoredMessagesResult;
export declare function computeReactivatedBlockIds(messagesState: PruneMessagesState, activeBlockIdsBefore: Set<number>): number[];
export declare function buildRestoredContentPreview(messages: WithParts[], activeMessagesBefore: Map<string, number>, messagesState: PruneMessagesState): string;
//# sourceMappingURL=decompress-logic.d.ts.map