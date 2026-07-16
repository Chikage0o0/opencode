import type { SessionState } from "../../state";
import type { GCConfig } from "../../config";
export interface BlockGuidanceContext {
    currentTokens?: number;
    modelContextLimit?: number;
    includeHint?: boolean;
    /**
     * Raw message IDs currently visible in the model's context window.
     * When provided, the directive nudge only suggests ranges whose anchor
     * messages are still visible, preventing stale-ID and backwards-range bugs.
     */
    visibleMessageIds?: Set<string>;
}
export declare function buildCompressedBlockGuidance(state: SessionState, gcConfig?: GCConfig, context?: BlockGuidanceContext): string;
export declare function renderMessagePriorityGuidance(priorityLabel: string, refs: string[]): string;
export declare function appendGuidanceToDcpTag(nudgeText: string, guidance: string): string;
//# sourceMappingURL=nudge.d.ts.map