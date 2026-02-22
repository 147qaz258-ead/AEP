/**
 * Signal Index Builder Module for AEP Protocol
 *
 * Builds and maintains the inverted index for fast signal-to-experience lookups.
 * Supports indexing new experiences, updating weights, and bulk rebuilds.
 *
 * @module aep/signal/index-builder
 */
import type { Signal, SignalType } from './index';
/**
 * Represents a single entry in the signal index
 */
export interface IndexEntry {
    /** Normalized signal key (type:value format) */
    signal_key: string;
    /** ID of the experience this signal maps to */
    experience_id: string;
    /** Weight of this signal for ranking (0.0 - 1.5) */
    weight: number;
    /** Timestamp when this entry was created */
    created_at: Date;
}
/**
 * Experience data structure for batch indexing
 */
export interface IndexableExperience {
    /** Unique experience identifier */
    id: string;
    /** Array of signals to match (can be strings or Signal objects) */
    signals_match: string[] | Signal[];
    /** Status of the experience (for filtering during rebuild) */
    status?: 'candidate' | 'promoted' | 'deprecated';
}
/**
 * Statistics about the signal index
 */
export interface IndexStats {
    /** Total number of index entries */
    total_entries: number;
    /** Number of unique signals in the index */
    unique_signals: number;
    /** Number of indexed experiences */
    indexed_experiences: number;
}
/**
 * Creates a normalized signal key from a signal.
 *
 * Format: "type:value" (lowercase)
 *
 * @param signal - Signal to create key for
 * @returns Normalized signal key
 */
export declare function makeSignalKey(signal: Signal): string;
/**
 * Creates a normalized signal key from a string.
 * Assumes the string is either already in "type:value" format or a plain value.
 *
 * @param signalStr - Signal string to create key for
 * @param defaultType - Default signal type to use if not in string
 * @returns Normalized signal key
 */
export declare function makeSignalKeyFromString(signalStr: string, defaultType?: SignalType): string;
/**
 * Signal Index Builder
 *
 * Builds and maintains an inverted index mapping signals to experience IDs.
 * Uses an in-memory Map structure for fast lookups.
 *
 * Key features:
 * - Creates inverted index entries for signal-to-experience mapping
 * - Supports multiple signals per experience
 * - Stores signal weight for ranking
 * - Supports bulk index rebuild for all experiences
 * - Supports incremental index for new experiences
 * - Removes index entries when experience is deprecated
 */
export declare class SignalIndexBuilder {
    /**
     * Inverted index: signal_key -> array of {experienceId, weight, createdAt}
     * @private
     */
    private index;
    /**
     * Reverse index: experience_id -> set of signal_keys
     * Used for efficient removal of experience entries
     * @private
     */
    private experienceSignals;
    /**
     * Index signals for a single experience.
     *
     * For each signal:
     * - Creates normalized signal key
     * - Checks if entry already exists
     * - Updates weight if changed, or inserts new entry
     *
     * @param experienceId - Unique experience identifier
     * @param signals - Array of signals to index
     */
    indexExperience(experienceId: string, signals: Signal[]): void;
    /**
     * Bulk index signals for multiple experiences.
     *
     * @param experiences - Array of experiences to index
     * @returns Number of experiences indexed
     */
    indexBatch(experiences: IndexableExperience[]): number;
    /**
     * Remove all index entries for an experience.
     *
     * @param experienceId - ID of experience to remove
     * @returns Number of entries removed
     */
    removeExperience(experienceId: string): number;
    /**
     * Update signal weight for an experience.
     *
     * @param signalKey - Signal key to update
     * @param experienceId - Experience ID
     * @param weight - New weight value
     */
    updateWeight(signalKey: string, experienceId: string, weight: number): void;
    /**
     * Rebuild entire index from experiences table.
     *
     * Clears existing index and rebuilds from scratch.
     *
     * @param experiences - Array of experiences to index
     * @returns Number of experiences indexed
     */
    rebuildIndex(experiences: IndexableExperience[]): number;
    /**
     * Get all entries for a signal key.
     *
     * @param signalKey - Signal key to look up
     * @returns Array of index entries
     */
    getEntries(signalKey: string): IndexEntry[];
    /**
     * Check if a signal exists in the index.
     *
     * @param signalKey - Signal key to check
     * @returns True if signal exists
     */
    hasSignal(signalKey: string): boolean;
    /**
     * Get all signal keys in the index.
     *
     * @returns Array of signal keys
     */
    getAllSignalKeys(): string[];
    /**
     * Clear the entire index.
     */
    clear(): void;
}
/**
 * Signal Index Querier
 *
 * Queries the signal index for matching experiences.
 */
export declare class SignalIndexQuerier {
    private builder;
    /**
     * Creates a new querier instance.
     *
     * @param builder - SignalIndexBuilder instance to query
     */
    constructor(builder: SignalIndexBuilder);
    /**
     * Query experiences matching a single signal.
     *
     * Returns experience IDs sorted by weight (descending).
     *
     * @param signalKey - Signal key to query
     * @returns Array of experience IDs
     */
    query(signalKey: string): string[];
    /**
     * Query experiences matching any of the signals.
     *
     * Returns unique experience IDs sorted by combined weight (descending).
     * An experience matching multiple signals will have higher combined weight.
     *
     * @param signalKeys - Array of signal keys to query
     * @returns Array of experience IDs
     */
    multiQuery(signalKeys: string[]): string[];
    /**
     * Get index statistics.
     *
     * @returns Index statistics
     */
    getStats(): IndexStats;
    /**
     * Get the underlying builder for direct access.
     *
     * @returns SignalIndexBuilder instance
     */
    getBuilder(): SignalIndexBuilder;
}
/**
 * Creates a new SignalIndexBuilder instance.
 *
 * @returns SignalIndexBuilder instance
 */
export declare function createSignalIndexBuilder(): SignalIndexBuilder;
/**
 * Creates a new SignalIndexQuerier instance.
 *
 * @param builder - SignalIndexBuilder to query
 * @returns SignalIndexQuerier instance
 */
export declare function createSignalIndexQuerier(builder: SignalIndexBuilder): SignalIndexQuerier;
export declare const signalIndexBuilder: SignalIndexBuilder;
export declare const signalIndexQuerier: SignalIndexQuerier;
export default SignalIndexBuilder;
//# sourceMappingURL=index-builder.d.ts.map