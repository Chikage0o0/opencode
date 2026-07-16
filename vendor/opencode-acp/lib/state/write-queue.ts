export interface KeyedWriteQueue {
    run<T>(key: string, operation: () => Promise<T>): Promise<T>
    drain(key?: string): Promise<void>
}

/**
 * Creates a failure-tolerant per-key queue.
 *
 * A rejected operation is returned to its caller but never poisons the tail used by later
 * operations. Different keys do not share a tail and therefore remain concurrent.
 */
export function createKeyedWriteQueue(): KeyedWriteQueue {
    const tails = new Map<string, Promise<void>>()
    const failures = new Map<string, unknown>()

    const run = <T>(key: string, operation: () => Promise<T>): Promise<T> => {
        const previous = tails.get(key) ?? Promise.resolve()
        const result = previous.then(operation, operation)
        const tail = result.then(
            () => {
                failures.delete(key)
            },
            (error) => {
                failures.set(key, error)
            },
        )

        // Reserve the tail before returning so a second caller cannot overtake this operation.
        tails.set(key, tail)
        void tail.then(() => {
            if (tails.get(key) === tail) tails.delete(key)
        })

        return result
    }

    const drain = async (key?: string): Promise<void> => {
        if (key !== undefined) {
            while (true) {
                const tail = tails.get(key)
                if (!tail) break
                await tail
                if (!tails.has(key)) break
            }

            const failure = failures.get(key)
            const failed = failures.has(key)
            failures.delete(key)
            if (failed) throw failure
            return
        }

        while (tails.size > 0) {
            await Promise.all([...tails.values()])
        }

        const terminalFailures = [...failures.values()]
        failures.clear()
        if (terminalFailures.length > 0) {
            throw new AggregateError(terminalFailures, "One or more queued writes failed")
        }
    }

    return { run, drain }
}
