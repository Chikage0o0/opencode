import type { WithParts } from "../state";
import type { SessionState } from "../state";
import type { PluginConfig } from "../config";
export interface KeepMarkerResult {
    summary: string;
    expandedCount: number;
    refCount: number;
    unresolvedRefs: string[];
}
export declare function resolveKeepMarkers(summary: string, messages: WithParts[], state: SessionState, config: PluginConfig): KeepMarkerResult;
//# sourceMappingURL=keep-markers.d.ts.map