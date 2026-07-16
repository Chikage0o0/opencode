/**
 * ACP Help command handler.
 * Shows available ACP commands and their descriptions.
 */
import type { Logger } from "../logger";
import type { PluginConfig } from "../config";
import type { SessionState, WithParts } from "../state";
export interface HelpCommandContext {
    client: any;
    state: SessionState;
    config: PluginConfig;
    logger: Logger;
    sessionId: string;
    messages: WithParts[];
}
export declare function handleHelpCommand(ctx: HelpCommandContext): Promise<void>;
//# sourceMappingURL=help.d.ts.map