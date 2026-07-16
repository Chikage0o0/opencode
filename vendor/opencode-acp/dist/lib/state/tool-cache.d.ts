import type { SessionState, WithParts } from "./index";
import type { Logger } from "../logger";
import { PluginConfig } from "../config";
/**
 * Sync tool parameters from session messages.
 */
export declare function syncToolCache(state: SessionState, config: PluginConfig, logger: Logger, messages: WithParts[]): void;
/**
 * Trim the tool parameters cache to prevent unbounded memory growth.
 * Uses FIFO eviction - removes oldest entries first.
 */
export declare function trimToolParametersCache(state: SessionState): void;
//# sourceMappingURL=tool-cache.d.ts.map