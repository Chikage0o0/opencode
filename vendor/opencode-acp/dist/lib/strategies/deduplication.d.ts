import { PluginConfig } from "../config";
import { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
/**
 * Deduplication strategy - prunes older tool calls that have identical
 * tool name and parameters, keeping only the most recent occurrence.
 * Modifies the session state in place to add pruned tool call IDs.
 */
export declare const deduplicate: (state: SessionState, logger: Logger, config: PluginConfig, messages: WithParts[]) => void;
//# sourceMappingURL=deduplication.d.ts.map