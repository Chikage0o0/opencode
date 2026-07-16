/**
 * DCP Context Command
 * Shows a visual breakdown of token usage in the current session.
 *
 * TOKEN CALCULATION STRATEGY
 * ==========================
 * We minimize tokenizer estimation by leveraging API-reported values wherever possible.
 *
 * WHAT WE GET FROM THE API (exact):
 *   - tokens.input    : Input tokens for each assistant response
 *   - tokens.output   : Output tokens generated (includes text + tool calls)
 *   - tokens.reasoning: Reasoning tokens used
 *   - tokens.cache    : Cache read/write tokens
 *
 * HOW WE CALCULATE EACH CATEGORY:
 *
 *   SYSTEM = firstAssistant.input + cache.read + cache.write - tokenizer(firstUserMessage)
 *            The first response's total input (input + cache.read + cache.write)
 *            contains system + first user message. On the first request of a
 *            session, the system prompt appears in cache.write (cache creation),
 *            not cache.read.
 *
 *   TOOLS  = tokenizer(toolInputs + toolOutputs) - prunedTokens
 *            We must tokenize tools anyway for pruning decisions.
 *
 *   USER   = tokenizer(all user messages)
 *            User messages are typically small, so estimation is acceptable.
 *
 *   ASSISTANT = total - system - user - tools
 *               Calculated as residual. This absorbs:
 *               - Assistant text output tokens
 *               - Reasoning tokens (if persisted by the model)
 *               - Any estimation errors
 *
 *   TOTAL  = input + output + reasoning + cache.read + cache.write
 *            Matches opencode's UI display.
 *
 * WHY ASSISTANT IS THE RESIDUAL:
 *   If reasoning tokens persist in context (model-dependent), they semantically
 *   belong with "Assistant" since reasoning IS assistant-generated content.
 */
import type { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
export interface ContextCommandContext {
    client: any;
    state: SessionState;
    logger: Logger;
    sessionId: string;
    messages: WithParts[];
}
export declare function handleContextCommand(ctx: ContextCommandContext): Promise<void>;
//# sourceMappingURL=context.d.ts.map