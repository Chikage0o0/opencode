/**
 * Pure config validation logic — no runtime dependencies (fs, jsonc-parser, etc.)
 * This module is extracted from config.ts to enable direct unit testing.
 */
export declare const VALID_CONFIG_KEYS: Set<string>;
export declare function getInvalidConfigKeys(userConfig: Record<string, any>): string[];
export interface ValidationError {
    key: string;
    expected: string;
    actual: string;
}
export declare function validateConfigTypes(config: Record<string, any>): ValidationError[];
//# sourceMappingURL=config-validation.d.ts.map