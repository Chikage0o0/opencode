import type { Logger } from "../logger";
import type { SessionState, WithParts } from "../state";
export interface DecompressCommandContext {
    client: any;
    state: SessionState;
    logger: Logger;
    sessionId: string;
    messages: WithParts[];
    args: string[];
}
export declare function handleDecompressCommand(ctx: DecompressCommandContext): Promise<void>;
//# sourceMappingURL=decompress.d.ts.map