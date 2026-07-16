/**
 * Fork-recovery: reconstruct ACP compression state from message history.
 *
 * When a session is forked, OpenCode copies all messages (including completed
 * `compress` tool parts) but regenerates message IDs. ACP's persisted state is
 * keyed off the original session ID and original raw message IDs, so the fork
 * session starts with empty prune state → no pruning → context overflow.
 *
 * This module replays historical `compress` tool invocations in chronological
 * order, rebuilding `CompressionBlock`s / `byMessageId` / `activeByAnchorMessageId`
 * using the fork's NEW raw IDs. Because message refs (mNNNNN) are assigned
 * sequentially by message order, they are fork-stable: a ref in a compress
 * input points to the same logical message in both original and fork.
 *
 * The rebuilt state is an approximation: protected-content enrichments that
 * were appended to summaries at original-compress-time are not re-derived
 * (only the raw model summary from the tool input is available). This is
 * acceptable — protected tool outputs survive in visible context anyway, and
 * the primary goal (pruning compressed messages to avoid overflow) is met.
 */
import type { PluginConfig } from "../config";
import type { Logger } from "../logger";
import type { SessionState, WithParts } from "./types";
/**
 * Reconstruct compression state by replaying historical `compress` tool
 * invocations from message history. Called when no persisted state exists
 * (fork scenario).
 *
 * @returns number of compression blocks reconstructed.
 */
export declare function rebuildCompressionState(state: SessionState, messages: WithParts[], config: PluginConfig, logger: Logger): number;
//# sourceMappingURL=rebuild.d.ts.map