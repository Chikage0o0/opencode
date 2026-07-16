import type { PluginConfig } from "../config";
import type { WithParts } from "../state";
export declare function isSyntheticMessage(message: WithParts): boolean;
export declare const getLastUserMessage: (messages: WithParts[], startIndex?: number) => WithParts | null;
export declare const messageHasCompress: (message: WithParts) => boolean;
export declare const isIgnoredUserMessage: (message: WithParts) => boolean;
export declare function isProtectedUserMessage(config: PluginConfig, message: WithParts): boolean;
//# sourceMappingURL=query.d.ts.map