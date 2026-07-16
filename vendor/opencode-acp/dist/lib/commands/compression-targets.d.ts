import type { CompressionBlock, PruneMessagesState } from "../state";
export interface CompressionTarget {
    displayId: number;
    runId: number;
    topic: string;
    compressedTokens: number;
    durationMs: number;
    grouped: boolean;
    blocks: CompressionBlock[];
}
export declare function getActiveCompressionTargets(messagesState: PruneMessagesState): CompressionTarget[];
export declare function getRecompressibleCompressionTargets(messagesState: PruneMessagesState, availableMessageIds: Set<string>): CompressionTarget[];
export declare function resolveCompressionTarget(messagesState: PruneMessagesState, blockId: number): CompressionTarget | null;
//# sourceMappingURL=compression-targets.d.ts.map