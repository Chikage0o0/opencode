export type PermissionAction = "ask" | "allow" | "deny";
export type PermissionValue = PermissionAction | Record<string, PermissionAction>;
export type PermissionConfig = Record<string, PermissionValue> | undefined;
export interface HostPermissionSnapshot {
    global: PermissionConfig;
    agents: Record<string, PermissionConfig>;
}
export declare const compressDisabledByOpencode: (...permissionConfigs: PermissionConfig[]) => boolean;
export declare const resolveEffectiveCompressPermission: (basePermission: PermissionAction, hostPermissions: HostPermissionSnapshot, agentName?: string) => PermissionAction;
export declare const hasExplicitToolPermission: (permissionConfig: PermissionConfig, tool: string) => boolean;
//# sourceMappingURL=host-permissions.d.ts.map