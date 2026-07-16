import type { Logger } from "../logger";
import type { CompressionBlock, SessionState } from "../state";
import type { BoundaryReference, CompressRangeToolArgs, InjectedSummaryResult, ParsedBlockPlaceholder, ResolvedRangeCompression, SearchContext } from "./types";
export declare function validateArgs(args: CompressRangeToolArgs): void;
export declare function resolveRanges(args: CompressRangeToolArgs, searchContext: SearchContext, state: SessionState): ResolvedRangeCompression[];
export declare function validateNonOverlapping(plans: ResolvedRangeCompression[]): void;
export declare function parseBlockPlaceholders(summary: string): ParsedBlockPlaceholder[];
export declare function validateSummaryPlaceholders(placeholders: ParsedBlockPlaceholder[], requiredBlockIds: number[], startReference: BoundaryReference, endReference: BoundaryReference, summaryByBlockId: Map<number, CompressionBlock>, logger: Logger): number[];
export declare function injectBlockPlaceholders(summary: string, _placeholders: ParsedBlockPlaceholder[], _summaryByBlockId: Map<number, CompressionBlock>, _startReference: BoundaryReference, _endReference: BoundaryReference): InjectedSummaryResult;
export declare function appendMissingBlockSummaries(summary: string, _missingBlockIds: number[], _summaryByBlockId: Map<number, CompressionBlock>, consumedBlockIds: number[]): InjectedSummaryResult;
//# sourceMappingURL=range-utils.d.ts.map