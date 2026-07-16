export interface KeyedWriteQueue {
    run<T>(key: string, operation: () => Promise<T>): Promise<T>;
    drain(key?: string): Promise<void>;
}
/**
 * Creates a failure-tolerant per-key queue.
 *
 * A rejected operation is returned to its caller but never poisons the tail used by later
 * operations. Different keys do not share a tail and therefore remain concurrent.
 */
export declare function createKeyedWriteQueue(): KeyedWriteQueue;
//# sourceMappingURL=write-queue.d.ts.map