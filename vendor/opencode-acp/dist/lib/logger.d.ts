export declare class Logger {
    private logDir;
    enabled: boolean;
    constructor(enabled: boolean);
    private ensureLogDir;
    private formatData;
    private getCallerFile;
    private write;
    info(message: string, data?: any): Promise<void> | undefined;
    debug(message: string, data?: any): Promise<void> | undefined;
    warn(message: string, data?: any): Promise<void> | undefined;
    error(message: string, data?: any): Promise<void> | undefined;
    /**
     * Strips unnecessary metadata from messages for cleaner debug logs.
     *
     * Removed:
     * - All IDs (id, sessionID, messageID, parentID)
     * - summary, path, cost, model, agent, mode, finish, providerID, modelID
     * - step-start and step-finish parts entirely
     * - snapshot fields
     * - ignored text parts
     *
     * Kept:
     * - role, time (created only), tokens (input, output, reasoning, cache)
     * - text, reasoning, tool parts with content
     * - tool calls with: tool, callID, input, output, metadata
     */
    private minimizeForDebug;
    saveContext(sessionId: string, messages: any[]): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map