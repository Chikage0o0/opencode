import type { PluginInput } from "@opencode-ai/plugin";
type Permission = "ask" | "allow" | "deny";
type CompressMode = "range" | "message";
export interface Deduplication {
    enabled: boolean;
    protectedTools: string[];
}
export interface CompressConfig {
    mode: CompressMode;
    permission: Permission;
    showCompression: boolean;
    summaryBuffer: boolean;
    maxContextLimit: number | `${number}%`;
    minContextLimit: number | `${number}%`;
    modelMaxLimits?: Record<string, number | `${number}%`>;
    modelMinLimits?: Record<string, number | `${number}%`>;
    nudgeFrequency: number;
    iterationNudgeThreshold: number;
    nudgeForce: "strong" | "soft";
    protectedTools: string[];
    protectTags: boolean;
    protectUserMessages: boolean;
    maxSummaryLengthHard: number;
    minCompressRange: number;
    maxVisibleSegments: number;
    keepEmbedMaxChars: number;
}
export interface Commands {
    enabled: boolean;
    protectedTools: string[];
}
export interface ManualModeConfig {
    enabled: boolean;
    automaticStrategies: boolean;
}
export interface PurgeErrors {
    enabled: boolean;
    turns: number;
    protectedTools: string[];
}
export interface TurnProtection {
    enabled: boolean;
    turns: number;
}
export interface ExperimentalConfig {
    allowSubAgents: boolean;
    customPrompts: boolean;
}
export interface BatchCleanupConfig {
    lowThreshold: number | `${number}%`;
    highThreshold: number | `${number}%`;
    forceThreshold: number | `${number}%`;
}
export interface GCConfig {
    algorithm: "truncate";
    promotionThreshold: number;
    maxBlockAge: number;
    maxOldGenSummaryLength: number;
    majorGcThresholdPercent: number | `${number}%`;
    batchCleanup: BatchCleanupConfig;
}
export interface PluginConfig {
    enabled: boolean;
    autoUpdate: boolean;
    debug: boolean;
    pruneNotification: "off" | "minimal" | "detailed";
    pruneNotificationType: "chat" | "toast";
    commands: Commands;
    manualMode: ManualModeConfig;
    turnProtection: TurnProtection;
    experimental: ExperimentalConfig;
    protectedFilePatterns: string[];
    compress: CompressConfig;
    gc: GCConfig;
    strategies: {
        deduplication: Deduplication;
        purgeErrors: PurgeErrors;
    };
}
export { VALID_CONFIG_KEYS, getInvalidConfigKeys, validateConfigTypes, type ValidationError } from "./config-validation";
export declare function getConfig(ctx: PluginInput): PluginConfig;
//# sourceMappingURL=config.d.ts.map