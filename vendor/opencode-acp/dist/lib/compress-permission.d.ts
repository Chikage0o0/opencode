import type { PluginConfig } from "./config";
import { type HostPermissionSnapshot } from "./host-permissions";
import type { SessionState, WithParts } from "./state";
export declare const compressPermission: (state: SessionState, config: PluginConfig) => "ask" | "allow" | "deny";
export declare const syncCompressPermissionState: (state: SessionState, config: PluginConfig, hostPermissions: HostPermissionSnapshot, messages: WithParts[]) => void;
//# sourceMappingURL=compress-permission.d.ts.map