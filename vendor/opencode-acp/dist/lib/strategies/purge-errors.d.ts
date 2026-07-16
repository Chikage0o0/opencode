import { PluginConfig } from "../config";
import { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
/**
 * Purge Errors strategy - prunes tool inputs for tools that errored
 * after they are older than a configurable number of turns.
 * The error message is preserved, but the (potentially large) inputs
 * are removed to save context.
 *
 * Modifies the session state in place to add pruned tool call IDs.
 */
export declare const purgeErrors: (state: SessionState, logger: Logger, config: PluginConfig, messages: WithParts[]) => void;
//# sourceMappingURL=purge-errors.d.ts.map