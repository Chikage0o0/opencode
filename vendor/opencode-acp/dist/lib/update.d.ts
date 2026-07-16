import type { PluginInput } from "@opencode-ai/plugin";
export declare function startAutoUpdate(ctx: PluginInput, enabled: boolean): void;
export declare function updateRemoveDir(packageDir: string, name: string): Promise<string | undefined>;
export declare function isAutoUpdatableSpec(spec: string): boolean;
export declare function isVersionNewer(latest: string, current: string): boolean;
//# sourceMappingURL=update.d.ts.map