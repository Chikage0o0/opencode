/**
 * DCP Manual mode command handler.
 * Handles toggling manual mode and triggering individual tool executions.
 *
 * Usage:
 *   /acp manual [on|off]  - Toggle manual mode or set explicit state
 *   /acp compress [focus]  - Trigger manual compress execution
 */
import type { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
import type { PluginConfig } from "../config";
export interface ManualCommandContext {
    client: any;
    state: SessionState;
    config: PluginConfig;
    logger: Logger;
    sessionId: string;
    messages: WithParts[];
}
export declare function handleManualToggleCommand(ctx: ManualCommandContext, modeArg?: string): Promise<void>;
export declare function handleManualTriggerCommand(ctx: ManualCommandContext, tool: "compress", userFocus?: string): Promise<string | null>;
export declare function applyPendingManualTrigger(state: SessionState, messages: WithParts[], logger: Logger): void;
//# sourceMappingURL=manual.d.ts.map