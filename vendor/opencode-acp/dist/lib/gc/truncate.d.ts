import type { CompressionBlock } from "../state";
import type { GCConfig } from "../config";
export interface CompactionResult {
    compactedBlocks: number;
    savedTokens: number;
}
export interface GCParams {
    maxOldGenSummaryLength: number;
    modelContextLimit: number;
    currentTokens: number;
}
export declare function runTruncateGC(blocks: CompressionBlock[], params: GCParams): CompactionResult;
export declare function shouldRunMajorGC(currentTokens: number, modelContextLimit: number | undefined, gcConfig: GCConfig): boolean;
export declare function getGCParams(gcConfig: GCConfig, modelContextLimit: number, currentTokens: number): GCParams;
//# sourceMappingURL=truncate.d.ts.map