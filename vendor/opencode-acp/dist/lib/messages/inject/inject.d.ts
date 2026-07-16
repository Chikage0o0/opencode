import type { SessionState, WithParts } from "../../state";
import type { Logger } from "../../logger";
import type { PluginConfig } from "../../config";
import type { RuntimePrompts } from "../../prompts/store";
import type { CompressionPriorityMap } from "../priority";
export declare const injectCompressNudges: (state: SessionState, config: PluginConfig, logger: Logger, messages: WithParts[], prompts: RuntimePrompts, compressionPriorities?: CompressionPriorityMap, debugNotify?: (text: string) => void, preCompressTokens?: number) => void;
export interface VisibleSegment {
    startRef: string;
    endRef: string;
    count: number;
    tokens: number;
    hasTool: boolean;
}
/**
 * Build disjoint visible-id segments from the surviving messages.
 *
 * Each segment is a maximal run of contiguous refs (e.g. m00003–m00007).
 * Holes between segments correspond to messages already consumed by a
 * compression block — those refs are NOT safe to target. Surfacing the
 * segments (instead of a single `first–last` span) stops the model from
 * picking a ref that lives inside a compressed hole.
 */
export declare function buildVisibleSegments(state: SessionState, messages: WithParts[]): VisibleSegment[];
export declare function formatVisibleGuidance(segments: VisibleSegment[], maxSegs: number): string;
export declare const injectMessageIds: (state: SessionState, config: PluginConfig, messages: WithParts[], compressionPriorities?: CompressionPriorityMap) => void;
//# sourceMappingURL=inject.d.ts.map