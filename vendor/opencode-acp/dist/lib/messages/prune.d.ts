import type { SessionState, WithParts } from "../state";
import type { Logger } from "../logger";
import type { PluginConfig } from "../config";
export declare const prune: (state: SessionState, logger: Logger, config: PluginConfig, messages: WithParts[]) => void;
export declare function stripStaleCompressCalls(messages: WithParts[]): number;
//# sourceMappingURL=prune.d.ts.map