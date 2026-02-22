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
 * Internal entry structure stored in the index
 */
interface InternalIndexEntry {
  experienceId: string;
  weight: number;
  createdAt: Date;
}

/**
 * Creates a normalized signal key from a signal.
 *
 * Format: "type:value" (lowercase)
 *
 * @param signal - Signal to create key for
 * @returns Normalized signal key
 */
export function makeSignalKey(signal: Signal): string {
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
export function makeSignalKeyFromString(
  signalStr: string,
  defaultType: SignalType = 'keyword'
): string {
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
function toExternalEntry(signalKey: string, internal: InternalIndexEntry): IndexEntry {
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
  /**
   * Inverted index: signal_key -> array of {experienceId, weight, createdAt}
   * @private
   */
  private index: Map<string, InternalIndexEntry[]> = new Map();

  /**
   * Reverse index: experience_id -> set of signal_keys
   * Used for efficient removal of experience entries
   * @private
   */
  private experienceSignals: Map<string, Set<string>> = new Map();

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
  indexExperience(experienceId: string, signals: Signal[]): void {
    // Initialize signal set for this experience if not exists
    if (!this.experienceSignals.has(experienceId)) {
      this.experienceSignals.set(experienceId, new Set());
    }
    const expSignals = this.experienceSignals.get(experienceId)!;

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
      } else {
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
  indexBatch(experiences: IndexableExperience[]): number {
    let count = 0;

    for (const experience of experiences) {
      // Skip deprecated experiences
      if (experience.status === 'deprecated') {
        continue;
      }

      // Convert signals_match to Signal array
      const signals: Signal[] = experience.signals_match.map((s) => {
        if (typeof s === 'string') {
          // Parse string - could be "type:value" or just "value"
          const lower = s.toLowerCase();
          if (lower.includes(':')) {
            const [type, ...valueParts] = lower.split(':');
            return {
              type: type as SignalType,
              value: valueParts.join(':'),
              weight: 1.0,
            };
          }
          return {
            type: 'keyword' as SignalType,
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
  removeExperience(experienceId: string): number {
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
        } else {
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
  updateWeight(signalKey: string, experienceId: string, weight: number): void {
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
  rebuildIndex(experiences: IndexableExperience[]): number {
    // Clear existing index
    this.index.clear();
    this.experienceSignals.clear();

    // Filter out deprecated experiences
    const activeExperiences = experiences.filter(
      (e) => e.status !== 'deprecated'
    );

    return this.indexBatch(activeExperiences);
  }

  /**
   * Get all entries for a signal key.
   *
   * @param signalKey - Signal key to look up
   * @returns Array of index entries
   */
  getEntries(signalKey: string): IndexEntry[] {
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
  hasSignal(signalKey: string): boolean {
    return this.index.has(signalKey.toLowerCase());
  }

  /**
   * Get all signal keys in the index.
   *
   * @returns Array of signal keys
   */
  getAllSignalKeys(): string[] {
    return Array.from(this.index.keys());
  }

  /**
   * Clear the entire index.
   */
  clear(): void {
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
  private builder: SignalIndexBuilder;

  /**
   * Creates a new querier instance.
   *
   * @param builder - SignalIndexBuilder instance to query
   */
  constructor(builder: SignalIndexBuilder) {
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
  query(signalKey: string): string[] {
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
  multiQuery(signalKeys: string[]): string[] {
    if (signalKeys.length === 0) {
      return [];
    }

    // Aggregate weights per experience
    const weightMap = new Map<string, number>();

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
  getStats(): IndexStats {
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
  getBuilder(): SignalIndexBuilder {
    return this.builder;
  }
}

/**
 * Creates a new SignalIndexBuilder instance.
 *
 * @returns SignalIndexBuilder instance
 */
export function createSignalIndexBuilder(): SignalIndexBuilder {
  return new SignalIndexBuilder();
}

/**
 * Creates a new SignalIndexQuerier instance.
 *
 * @param builder - SignalIndexBuilder to query
 * @returns SignalIndexQuerier instance
 */
export function createSignalIndexQuerier(builder: SignalIndexBuilder): SignalIndexQuerier {
  return new SignalIndexQuerier(builder);
}

// Default singleton instances
export const signalIndexBuilder = new SignalIndexBuilder();
export const signalIndexQuerier = new SignalIndexQuerier(signalIndexBuilder);

// Default export
export default SignalIndexBuilder;
