import type { Logger } from "../logger";
import type { SessionState } from "../state";
import { PluginConfig } from "../config";
export type PruneReason = "completion" | "noise" | "extraction";
export declare const PRUNE_REASON_LABELS: Record<PruneReason, string>;
interface CompressionNotificationEntry {
    blockId: number;
    runId: number;
    summary: string;
    summaryTokens: number;
}
export declare function sendCompressNotification(client: any, logger: Logger, config: PluginConfig, state: SessionState, sessionId: string, entries: CompressionNotificationEntry[], batchTopic: string | undefined, sessionMessageIds: string[], params: any, contextTokensBefore: number): Promise<boolean>;
export declare function sendIgnoredMessage(client: any, sessionID: string, text: string, params: any, logger: Logger): Promise<void>;
export {};
//# sourceMappingURL=notification.d.ts.map