import { tool } from "@opencode-ai/plugin";
import type { SessionState, WithParts } from "../state";
import type { BoundaryReference, SearchContext, SelectionResolution, ToolContext } from "./types";
export declare function fetchSessionMessages(client: any, sessionId: string): Promise<WithParts[]>;
export declare function buildSearchContext(state: SessionState, rawMessages: WithParts[]): SearchContext;
export declare function resolveBoundaryIds(context: SearchContext, state: SessionState, startId: string, endId: string): {
    startReference: BoundaryReference;
    endReference: BoundaryReference;
};
export declare function resolveSelection(context: SearchContext, startReference: BoundaryReference, endReference: BoundaryReference): SelectionResolution;
export declare function resolveAnchorMessageId(startReference: BoundaryReference): string;
export declare function createSearchContextTool(ctx: ToolContext): ReturnType<typeof tool>;
//# sourceMappingURL=search.d.ts.map