import type { SessionState, WithParts } from "./state";
import type { Logger } from "./logger";
import type { PluginConfig } from "./config";
import { type PromptStore } from "./prompts";
import { type HostPermissionSnapshot } from "./host-permissions";
export declare function createSystemPromptHandler(state: SessionState, logger: Logger, config: PluginConfig, prompts: PromptStore): (input: {
    sessionID?: string;
    model: {
        limit: {
            context: number;
            input?: number;
            output?: number;
        };
    };
}, output: {
    system: string[];
}) => Promise<void>;
export declare function createChatMessageTransformHandler(client: any, state: SessionState, logger: Logger, config: PluginConfig, prompts: PromptStore, hostPermissions: HostPermissionSnapshot): (input: {}, output: {
    messages: WithParts[];
}) => Promise<void>;
export declare function createCommandExecuteHandler(client: any, state: SessionState, logger: Logger, config: PluginConfig, workingDirectory: string, hostPermissions: HostPermissionSnapshot): (input: {
    command: string;
    sessionID: string;
    arguments: string;
}, output: {
    parts: any[];
}) => Promise<void>;
export declare function createTextCompleteHandler(): (_input: {
    sessionID: string;
    messageID: string;
    partID: string;
}, output: {
    text: string;
}) => Promise<void>;
export declare function createEventHandler(state: SessionState, logger: Logger): (input: {
    event: any;
}) => Promise<void>;
//# sourceMappingURL=hooks.d.ts.map