import type { WithParts } from "../state";
/**
 * Mirrors opencode's differentModel handling by preserving part content while
 * dropping provider metadata on assistant parts that came from a different
 * model/provider than the current turn's user message.
 */
export declare function stripStaleMetadata(messages: WithParts[]): void;
//# sourceMappingURL=reasoning-strip.d.ts.map