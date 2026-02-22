/**
 * Signal Index Builder Module for AEP Protocol
 *
 * Builds and maintains the inverted index for fast signal-to-experience lookups.
 * Supports indexing new experiences, updating weights, and bulk rebuilds.
 *
 * @module aep/signal/index-builder
 */
/**
 * Creates a normalized signal key from a signal.
 *
 * Format: "type:value" (lowercase)
 *
 * @param signal - Signal to create key for
 * @returns Normalized signal key
 */
export function makeSignalKey(signal) {
    return `${signal.type}:${signal.value.toLowerCase()}`;
}
/**
 * Creates a normalized signal key from a string.
 * Assumes the string is either already in "type:value" format or a plain value.
 *
 * @param signalStr - Signal string to create key for
 * @param defaultType - Default signal type to use if not in string
 * @returns Normalized signal key
 */
export function makeSignalKeyFromString(signalStr, defaultType = 'keyword') {
    const lower = signalStr.toLowerCase();
    // Check if already has type prefix
    if (lower.includes(':')) {
        return lower;
    }
    return `${defaultType}:${lower}`;
}
/**
 * Converts an internal entry to external IndexEntry format.
 *
 * @param signalKey - Signal key for this entry
 * @param internal - Internal entry structure
 * @returns IndexEntry
 */
function toExternalEntry(signalKey, internal) {
    return {
        signal_key: signalKey,
        experience_id: internal.experienceId,
        weight: internal.weight,
        created_at: internal.createdAt,
    };
}
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
export class SignalIndexBuilder {
    constructor() {
        /**
         * Inverted index: signal_key -> array of {experienceId, weight, createdAt}
         * @private
         */
        this.index = new Map();
        /**
         * Reverse index: experience_id -> set of signal_keys
         * Used for efficient removal of experience entries
         * @private
         */
        this.experienceSignals = new Map();
    }
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
    indexExperience(experienceId, signals) {
        // Initialize signal set for this experience if not exists
        if (!this.experienceSignals.has(experienceId)) {
            this.experienceSignals.set(experienceId, new Set());
        }
        const expSignals = this.experienceSignals.get(experienceId);
        for (const signal of signals) {
            const signalKey = makeSignalKey(signal);
            const now = new Date();
            // Get or create entry list for this signal
            let entries = this.index.get(signalKey);
            if (!entries) {
                entries = [];
                this.index.set(signalKey, entries);
            }
            // Check if entry already exists for this experience
            const existingIdx = entries.findIndex((e) => e.experienceId === experienceId);
            if (existingIdx >= 0) {
                // Update weight if changed
                if (entries[existingIdx].weight !== signal.weight) {
                    entries[existingIdx].weight = signal.weight;
                }
            }
            else {
                // Insert new entry
                entries.push({
                    experienceId,
                    weight: signal.weight,
                    createdAt: now,
                });
            }
            // Track signal for this experience
            expSignals.add(signalKey);
        }
    }
    /**
     * Bulk index signals for multiple experiences.
     *
     * @param experiences - Array of experiences to index
     * @returns Number of experiences indexed
     */
    indexBatch(experiences) {
        let count = 0;
        for (const experience of experiences) {
            // Skip deprecated experiences
            if (experience.status === 'deprecated') {
                continue;
            }
            // Convert signals_match to Signal array
            const signals = experience.signals_match.map((s) => {
                if (typeof s === 'string') {
                    // Parse string - could be "type:value" or just "value"
                    const lower = s.toLowerCase();
                    if (lower.includes(':')) {
                        const [type, ...valueParts] = lower.split(':');
                        return {
                            type: type,
                            value: valueParts.join(':'),
                            weight: 1.0,
                        };
                    }
                    return {
                        type: 'keyword',
                        value: lower,
                        weight: 1.0,
                    };
                }
                return s;
            });
            this.indexExperience(experience.id, signals);
            count++;
        }
        return count;
    }
    /**
     * Remove all index entries for an experience.
     *
     * @param experienceId - ID of experience to remove
     * @returns Number of entries removed
     */
    removeExperience(experienceId) {
        const signalKeys = this.experienceSignals.get(experienceId);
        if (!signalKeys) {
            return 0;
        }
        let removedCount = 0;
        for (const signalKey of signalKeys) {
            const entries = this.index.get(signalKey);
            if (entries) {
                const initialLength = entries.length;
                const filtered = entries.filter((e) => e.experienceId !== experienceId);
                if (filtered.length === 0) {
                    // Remove signal key if no more entries
                    this.index.delete(signalKey);
                }
                else {
                    this.index.set(signalKey, filtered);
                }
                removedCount += initialLength - filtered.length;
            }
        }
        // Remove experience from reverse index
        this.experienceSignals.delete(experienceId);
        return removedCount;
    }
    /**
     * Update signal weight for an experience.
     *
     * @param signalKey - Signal key to update
     * @param experienceId - Experience ID
     * @param weight - New weight value
     */
    updateWeight(signalKey, experienceId, weight) {
        const normalizedKey = signalKey.toLowerCase();
        const entries = this.index.get(normalizedKey);
        if (entries) {
            const entry = entries.find((e) => e.experienceId === experienceId);
            if (entry) {
                entry.weight = weight;
            }
        }
    }
    /**
     * Rebuild entire index from experiences table.
     *
     * Clears existing index and rebuilds from scratch.
     *
     * @param experiences - Array of experiences to index
     * @returns Number of experiences indexed
     */
    rebuildIndex(experiences) {
        // Clear existing index
        this.index.clear();
        this.experienceSignals.clear();
        // Filter out deprecated experiences
        const activeExperiences = experiences.filter((e) => e.status !== 'deprecated');
        return this.indexBatch(activeExperiences);
    }
    /**
     * Get all entries for a signal key.
     *
     * @param signalKey - Signal key to look up
     * @returns Array of index entries
     */
    getEntries(signalKey) {
        const normalizedKey = signalKey.toLowerCase();
        const entries = this.index.get(normalizedKey);
        if (!entries) {
            return [];
        }
        return entries.map((e) => toExternalEntry(normalizedKey, e));
    }
    /**
     * Check if a signal exists in the index.
     *
     * @param signalKey - Signal key to check
     * @returns True if signal exists
     */
    hasSignal(signalKey) {
        return this.index.has(signalKey.toLowerCase());
    }
    /**
     * Get all signal keys in the index.
     *
     * @returns Array of signal keys
     */
    getAllSignalKeys() {
        return Array.from(this.index.keys());
    }
    /**
     * Clear the entire index.
     */
    clear() {
        this.index.clear();
        this.experienceSignals.clear();
    }
}
/**
 * Signal Index Querier
 *
 * Queries the signal index for matching experiences.
 */
export class SignalIndexQuerier {
    /**
     * Creates a new querier instance.
     *
     * @param builder - SignalIndexBuilder instance to query
     */
    constructor(builder) {
        this.builder = builder;
    }
    /**
     * Query experiences matching a single signal.
     *
     * Returns experience IDs sorted by weight (descending).
     *
     * @param signalKey - Signal key to query
     * @returns Array of experience IDs
     */
    query(signalKey) {
        const entries = this.builder.getEntries(signalKey);
        // Sort by weight descending
        entries.sort((a, b) => b.weight - a.weight);
        return entries.map((e) => e.experience_id);
    }
    /**
     * Query experiences matching any of the signals.
     *
     * Returns unique experience IDs sorted by combined weight (descending).
     * An experience matching multiple signals will have higher combined weight.
     *
     * @param signalKeys - Array of signal keys to query
     * @returns Array of experience IDs
     */
    multiQuery(signalKeys) {
        if (signalKeys.length === 0) {
            return [];
        }
        // Aggregate weights per experience
        const weightMap = new Map();
        for (const key of signalKeys) {
            const entries = this.builder.getEntries(key);
            for (const entry of entries) {
                const current = weightMap.get(entry.experience_id) || 0;
                weightMap.set(entry.experience_id, current + entry.weight);
            }
        }
        // Sort by combined weight descending
        const sorted = Array.from(weightMap.entries()).sort((a, b) => b[1] - a[1]);
        return sorted.map(([id]) => id);
    }
    /**
     * Get index statistics.
     *
     * @returns Index statistics
     */
    getStats() {
        // Count total entries
        let totalEntries = 0;
        for (const entries of this.builder['index'].values()) {
            totalEntries += entries.length;
        }
        // Count unique signals
        const uniqueSignals = this.builder['index'].size;
        // Count indexed experiences
        const indexedExperiences = this.builder['experienceSignals'].size;
        return {
            total_entries: totalEntries,
            unique_signals: uniqueSignals,
            indexed_experiences: indexedExperiences,
        };
    }
    /**
     * Get the underlying builder for direct access.
     *
     * @returns SignalIndexBuilder instance
     */
    getBuilder() {
        return this.builder;
    }
}
/**
 * Creates a new SignalIndexBuilder instance.
 *
 * @returns SignalIndexBuilder instance
 */
export function createSignalIndexBuilder() {
    return new SignalIndexBuilder();
}
/**
 * Creates a new SignalIndexQuerier instance.
 *
 * @param builder - SignalIndexBuilder to query
 * @returns SignalIndexQuerier instance
 */
export function createSignalIndexQuerier(builder) {
    return new SignalIndexQuerier(builder);
}
// Default singleton instances
export const signalIndexBuilder = new SignalIndexBuilder();
export const signalIndexQuerier = new SignalIndexQuerier(signalIndexBuilder);
// Default export
export default SignalIndexBuilder;
//# sourceMappingURL=index-builder.js.map