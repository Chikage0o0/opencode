import type { PruneMessagesState, SessionState } from "../state";
import type { AppliedCompressionResult, CompressionStateInput, SelectionResolution } from "./types";
import type { GCConfig } from "../config";
export declare const COMPRESSED_BLOCK_HEADER = "[Compressed conversation section]";
export declare function allocateBlockId(state: SessionState): number;
export declare function allocateRunId(state: SessionState): number;
export declare function attachCompressionDuration(messagesState: PruneMessagesState, messageId: string, callId: string, durationMs: number): number;
export declare function wrapCompressedSummary(blockId: number, summary: string): string;
export declare function applyCompressionState(state: SessionState, input: CompressionStateInput, selection: SelectionResolution, anchorMessageId: string, blockId: number, summary: string, consumedBlockIds: number[], gcConfig?: GCConfig): AppliedCompressionResult;
//# sourceMappingURL=state.d.ts.map