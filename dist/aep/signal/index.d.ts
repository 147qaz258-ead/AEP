/**
 * Signal Extraction Module for AEP Protocol
 *
 * Extracts structured signals from raw error text for matching
 * against the experience database.
 *
 * @module aep/signal
 */
/**
 * Signal types supported by the AEP protocol
 */
export type SignalType = "keyword" | "errsig" | "errsig_norm" | "opportunity" | "context" | "semantic";
/**
 * Represents a single extracted signal
 */
export interface Signal {
    type: SignalType;
    value: string;
    hash?: string;
    weight: number;
}
/**
 * Result of signal extraction
 */
export interface ExtractionResult {
    signals: Signal[];
    normalized_input: string;
    processing_time_ms: number;
}
/**
 * Result of error signature normalization.
 * Tracks original input, normalized output, hash, and transformations applied.
 */
export interface NormalizationResult {
    /** Original input text */
    original: string;
    /** Normalized error signature (max 220 chars) */
    normalized: string;
    /** Stable SHA-256 hash (first 16 chars) for deduplication */
    hash: string;
    /** List of transformations applied during normalization */
    transformations: string[];
}
/**
 * Generates a stable SHA-256 hash for signal deduplication.
 * Uses first 16 characters of hex digest for compact representation.
 *
 * @param text - Text to hash
 * @returns 16-character hex string
 */
export declare function generateStableHash(text: string): string;
/**
 * Normalizes error signature by removing noise elements.
 *
 * Examples:
 *   "Error at C:\\project\\file.js:123" -> "error at <path>:<n>"
 *   "Error at /usr/local/app.js:45" -> "error at <path>:<n>"
 *   "Error 0x1a2b3c4d at line 42" -> "error <hex> at line <n>"
 *
 * @param text - Raw error text to normalize
 * @returns Normalized error signature (max 220 chars)
 */
export declare function normalizeErrorSignature(text: string): string;
/**
 * Error Signature Normalizer class.
 *
 * Normalizes error messages by removing platform-specific paths, hex IDs,
 * timestamps, and other noise to generate stable hashes for error signature matching.
 *
 * Implements the interface defined in TASK-E-001-SIG-001.
 */
export declare class ErrorSignatureNormalizer {
    /** Maximum length for normalized signatures */
    static readonly MAX_LENGTH = 220;
    /** Length of hash to generate */
    static readonly HASH_LENGTH = 16;
    /**
     * Normalize error signature by removing noise.
     *
     * Steps:
     * 1. Convert to lowercase
     * 2. Remove Windows paths (C:\...)
     * 3. Remove Unix paths (/...)
     * 4. Remove hex values (0x...)
     * 5. Remove standalone numbers
     * 6. Truncate to MAX_LENGTH
     * 7. Generate hash
     *
     * @param text - Raw error text to normalize
     * @returns NormalizationResult with original, normalized, hash, and transformations
     */
    normalize(text: string): NormalizationResult;
    /**
     * Generate stable SHA-256 hash (first 16 chars).
     *
     * @param normalizedText - Normalized text to hash
     * @returns 16-character hex string
     */
    generateHash(normalizedText: string): string;
    /**
     * Replace Windows paths with <path>.
     *
     * @param text - Text to process
     * @returns Object with processed text and count of replacements
     */
    removeWindowsPaths(text: string): {
        text: string;
        count: number;
    };
    /**
     * Replace Unix paths with <path>.
     *
     * @param text - Text to process
     * @returns Object with processed text and count of replacements
     */
    removeUnixPaths(text: string): {
        text: string;
        count: number;
    };
    /**
     * Replace hex values with <hex>.
     *
     * @param text - Text to process
     * @returns Object with processed text and count of replacements
     */
    removeHexValues(text: string): {
        text: string;
        count: number;
    };
    /**
     * Replace standalone numbers with <n>.
     *
     * @param text - Text to process
     * @returns Object with processed text and count of replacements
     */
    removeNumbers(text: string): {
        text: string;
        count: number;
    };
}
/**
 * Main class for extracting structured signals from text.
 */
export declare class SignalExtractor {
    /**
     * Extracts structured signals from raw text.
     *
     * @param text - Raw text to extract signals from
     * @returns Extraction result with signals and metadata
     */
    extractSignals(text: string): ExtractionResult;
    /**
     * Normalizes error signature by removing noise.
     * Alias for module-level function.
     *
     * @param text - Text to normalize
     * @returns Normalized signature
     */
    normalizeErrorSignature(text: string): string;
    /**
     * Generates SHA-256 hash for signal deduplication.
     * Alias for module-level function.
     *
     * @param text - Text to hash
     * @returns 16-character hex string
     */
    generateStableHash(text: string): string;
}
export declare const signalExtractor: SignalExtractor;
export declare const errorSignatureNormalizer: ErrorSignatureNormalizer;
export { SignalIndexBuilder, SignalIndexQuerier, makeSignalKey, makeSignalKeyFromString, createSignalIndexBuilder, createSignalIndexQuerier, signalIndexBuilder, signalIndexQuerier, type IndexEntry, type IndexableExperience, type IndexStats, } from './index-builder';
export default SignalExtractor;
//# sourceMappingURL=index.d.ts.map