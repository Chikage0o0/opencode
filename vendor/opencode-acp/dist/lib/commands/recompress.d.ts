import type { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
export interface RecompressCommandContext {
    client: any;
    state: SessionState;
    logger: Logger;
    sessionId: string;
    messages: WithParts[];
    args: string[];
}
export declare function handleRecompressCommand(ctx: RecompressCommandContext): Promise<void>;
//# sourceMappingURL=recompress.d.ts.map