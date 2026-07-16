/**
 * DCP Stats command handler.
 * Shows pruning statistics for the current session and all-time totals.
 */
import type { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
export interface StatsCommandContext {
    client: any;
    state: SessionState;
    logger: Logger;
    sessionId: string;
    messages: WithParts[];
}
export declare function handleStatsCommand(ctx: StatsCommandContext): Promise<void>;
//# sourceMappingURL=stats.d.ts.map