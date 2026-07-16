/**
 * DCP Sweep command handler.
 * Prunes tool outputs since the last user message, or the last N tools.
 *
 * Usage:
 *   /acp sweep        - Prune all tools since the previous user message
 *   /acp sweep 10     - Prune the last 10 tools
 */
import type { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
import type { PluginConfig } from "../config";
export interface SweepCommandContext {
    client: any;
    state: SessionState;
    config: PluginConfig;
    logger: Logger;
    sessionId: string;
    messages: WithParts[];
    args: string[];
    workingDirectory: string;
}
export declare function handleSweepCommand(ctx: SweepCommandContext): Promise<void>;
//# sourceMappingURL=sweep.d.ts.map