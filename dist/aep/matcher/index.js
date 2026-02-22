/**
 * Experience Matcher Module for AEP Protocol
 *
 * Matches signals against experience database using three-tier matching:
 * 1. Exact match via inverted index
 * 2. Semantic match via vector similarity (pgvector)
 * 3. Context-aware matching
 *
 * Results are ranked by GDI score (descending).
 *
 * @module aep/matcher
 */
/**
 * Default matcher options
 */
const DEFAULT_OPTIONS = {
    semanticThreshold: 0.75,
    jaccardThreshold: 0.34,
    maxSemanticResults: 50,
    embeddingDimension: 1536,
};
/**
 * Computes match score based on signal overlap with experience.
 *
 * Scoring factors:
 * - Signal matches in trigger text: full signal weight
 * - Signal matches in signals_match array: 0.8 * signal weight
 * - Jaccard similarity bonus: if >= threshold
 *
 * @param signals - Input signals to match
 * @param experience - Experience to match against
 * @param jaccardThreshold - Threshold for Jaccard bonus
 * @returns Computed match score
 */
export function computeMatchScore(signals, experience, jaccardThreshold = DEFAULT_OPTIONS.jaccardThreshold) {
    let score = 0.0;
    for (const signal of signals) {
        // Check if signal value matches trigger text (case-insensitive)
        const triggerLower = experience.trigger.toLowerCase();
        const signalLower = signal.value.toLowerCase();
        if (triggerLower.includes(signalLower)) {
            score += signal.weight;
        }
        // Check if signal is in signals_match array
        const signalKey = `${signal.type}:${signal.value}`;
        const isInSignalsMatch = experience.signals_match.some((s) => s.toLowerCase() === signalKey.toLowerCase() ||
            s.toLowerCase() === signal.value.toLowerCase());
        if (isInSignalsMatch) {
            score += signal.weight * 0.8;
        }
    }
    // Jaccard similarity bonus
    const signalSet = new Set(signals.map((s) => `${s.type}:${s.value.toLowerCase()}`));
    const expSet = new Set(experience.signals_match.map((s) => s.toLowerCase()));
    if (signalSet.size > 0 || expSet.size > 0) {
        const intersection = new Set([...signalSet].filter((x) => [...expSet].some((e) => e.includes(x.split(':')[1]) || x.includes(e))));
        const union = new Set([...signalSet, ...expSet]);
        const jaccard = intersection.size / union.size;
        if (jaccard >= jaccardThreshold) {
            score += jaccard;
        }
    }
    return score;
}
/**
 * Deduplicates match results by experience ID.
 * When duplicates are found, keeps the one with the higher match score.
 *
 * @param results - Array of match results to deduplicate
 * @returns Deduplicated array
 */
export function deduplicateResults(results) {
    const resultMap = new Map();
    for (const result of results) {
        const existing = resultMap.get(result.experience.id);
        if (!existing || result.match_score > existing.match_score) {
            resultMap.set(result.experience.id, result);
        }
    }
    return Array.from(resultMap.values());
}
/**
 * Converts a signal to a searchable key for index lookup.
 *
 * @param signal - Signal to convert
 * @returns Searchable key string
 */
export function signalToKey(signal) {
    return `${signal.type}:${signal.value}`;
}
/**
 * Experience Matcher class for matching signals against experiences.
 *
 * Implements three-tier matching:
 * 1. Exact matching via inverted index
 * 2. Semantic matching via vector similarity
 * 3. Combined hybrid matching with deduplication
 *
 * Results are ranked by GDI score (descending).
 */
export class ExperienceMatcher {
    /**
     * Creates a new ExperienceMatcher instance.
     *
     * @param store - Experience store for data retrieval
     * @param vectorStore - Vector store for semantic search
     * @param options - Matcher configuration options
     */
    constructor(store = null, vectorStore = null, options = {}) {
        this.store = store;
        this.vectorStore = vectorStore;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Finds matching experiences and ranks by GDI score.
     *
     * Matching algorithm:
     * 1. Query exact matches via inverted index
     * 2. If not enough results, query semantic matches via vector similarity
     * 3. Deduplicate by experience ID
     * 4. Rank by GDI score (descending)
     * 5. Apply status filter
     * 6. Return up to limit results
     *
     * @param request - Match request with signals and parameters
     * @returns Array of match results ranked by GDI score
     */
    async match(request) {
        const candidates = [];
        // 1. Exact match via inverted index
        const exactMatches = await this.exactMatch(request.signals);
        candidates.push(...exactMatches);
        // 2. Semantic match via vector similarity (if not enough results)
        if (candidates.length < request.limit && this.vectorStore) {
            const semanticMatches = await this.semanticMatch(request.signals);
            candidates.push(...semanticMatches);
        }
        // 3. Deduplicate by experience ID
        const deduplicated = deduplicateResults(candidates);
        // 4. Rank by GDI score (descending)
        const ranked = deduplicated.sort((a, b) => b.experience.gdi_score - a.experience.gdi_score);
        // 5. Apply status filter
        const statusFilter = this.getStatusFilter(request);
        const filtered = ranked.filter((r) => statusFilter.includes(r.experience.status));
        // 6. Return up to limit results
        return filtered.slice(0, request.limit);
    }
    /**
     * Synchronous version of match for in-memory experiences.
     *
     * @param request - Match request with signals and parameters
     * @param experiences - Array of experiences to search
     * @returns Array of match results ranked by GDI score
     */
    matchSync(request, experiences) {
        const candidates = [];
        // 1. Exact match on provided experiences
        const exactMatches = this.exactMatchFromList(request.signals, experiences);
        candidates.push(...exactMatches);
        // 2. Semantic-like match using text similarity (no vector store)
        if (candidates.length < request.limit) {
            const textMatches = this.textSimilarityMatch(request.signals, experiences.filter((e) => !candidates.some((c) => c.experience.id === e.id)));
            candidates.push(...textMatches);
        }
        // 3. Deduplicate by experience ID
        const deduplicated = deduplicateResults(candidates);
        // 4. Rank by GDI score (descending)
        const ranked = deduplicated.sort((a, b) => b.experience.gdi_score - a.experience.gdi_score);
        // 5. Apply status filter
        const statusFilter = this.getStatusFilter(request);
        const filtered = ranked.filter((r) => statusFilter.includes(r.experience.status));
        // 6. Return up to limit results
        return filtered.slice(0, request.limit);
    }
    /**
     * Performs exact signal matching via inverted index.
     *
     * @param signals - Signals to match
     * @returns Array of exact match results
     */
    async exactMatch(signals) {
        if (!this.store) {
            return [];
        }
        const signalKeys = signals.map(signalToKey);
        const experiences = this.store.getBySignalKeys(signalKeys);
        return experiences.map((exp) => {
            const score = computeMatchScore(signals, exp, this.options.jaccardThreshold);
            const signalsMatched = this.getMatchedSignals(signals, exp);
            return {
                experience: exp,
                match_score: score,
                match_type: 'exact',
                signals_matched: signalsMatched,
            };
        });
    }
    /**
     * Performs exact matching from a provided list of experiences.
     *
     * @param signals - Signals to match
     * @param experiences - List of experiences to search
     * @returns Array of exact match results
     */
    exactMatchFromList(signals, experiences) {
        const results = [];
        for (const exp of experiences) {
            const signalsMatched = this.getMatchedSignals(signals, exp);
            if (signalsMatched.length > 0) {
                const score = computeMatchScore(signals, exp, this.options.jaccardThreshold);
                results.push({
                    experience: exp,
                    match_score: score,
                    match_type: 'exact',
                    signals_matched: signalsMatched,
                });
            }
        }
        return results;
    }
    /**
     * Performs semantic matching via vector similarity.
     *
     * @param signals - Signals to build query from
     * @returns Array of semantic match results
     */
    async semanticMatch(signals) {
        if (!this.vectorStore) {
            return [];
        }
        // Build query text from signals
        const queryText = signals.map((s) => s.value).join(' ');
        // Get query embedding (mock for now - in real implementation would call embedding model)
        const queryEmbedding = this.generateMockEmbedding(queryText);
        // Query vector store
        const results = await this.vectorStore.query(queryEmbedding, this.options.semanticThreshold, this.options.maxSemanticResults);
        return results.map((r) => ({
            experience: r.experience,
            match_score: r.similarity,
            match_type: 'semantic',
            signals_matched: [],
        }));
    }
    /**
     * Performs text similarity matching for synchronous operations.
     *
     * @param signals - Signals to match
     * @param experiences - Experiences to search
     * @returns Array of text similarity match results
     */
    textSimilarityMatch(signals, experiences) {
        const results = [];
        const queryTerms = new Set(signals.flatMap((s) => s.value.toLowerCase().split(/\s+/)));
        for (const exp of experiences) {
            const triggerTerms = new Set(exp.trigger.toLowerCase().split(/\s+/));
            // Calculate simple Jaccard similarity
            const intersection = new Set([...queryTerms].filter((t) => triggerTerms.has(t)));
            const union = new Set([...queryTerms, ...triggerTerms]);
            const similarity = union.size > 0 ? intersection.size / union.size : 0;
            if (similarity >= 0.1) {
                // Lower threshold for fallback matching
                results.push({
                    experience: exp,
                    match_score: similarity,
                    match_type: 'semantic',
                    signals_matched: [],
                });
            }
        }
        return results.sort((a, b) => b.match_score - a.match_score);
    }
    /**
     * Gets the list of matched signal values for an experience.
     *
     * @param signals - Input signals
     * @param experience - Experience to check against
     * @returns Array of matched signal values
     */
    getMatchedSignals(signals, experience) {
        const matched = [];
        const triggerLower = experience.trigger.toLowerCase();
        const signalsMatchLower = experience.signals_match.map((s) => s.toLowerCase());
        for (const signal of signals) {
            const signalLower = signal.value.toLowerCase();
            const signalKey = `${signal.type}:${signal.value}`.toLowerCase();
            // Check trigger text
            if (triggerLower.includes(signalLower)) {
                matched.push(signal.value);
                continue;
            }
            // Check signals_match array
            if (signalsMatchLower.some((s) => s === signalLower || s === signalKey)) {
                matched.push(signal.value);
            }
        }
        return matched;
    }
    /**
     * Gets the status filter based on request parameters.
     *
     * @param request - Match request
     * @returns Array of statuses to include
     */
    getStatusFilter(request) {
        if (request.status_filter && request.status_filter.length > 0) {
            return request.status_filter;
        }
        if (request.include_candidates) {
            return ['promoted', 'candidate'];
        }
        // Default: only promoted
        return ['promoted'];
    }
    /**
     * Generates a mock embedding for testing purposes.
     * In production, this would call an embedding model.
     *
     * @param text - Text to generate embedding for
     * @returns Mock embedding vector
     */
    generateMockEmbedding(text) {
        const embedding = [];
        for (let i = 0; i < this.options.embeddingDimension; i++) {
            // Simple hash-based mock embedding
            const charCode = text.charCodeAt(i % text.length) || 0;
            embedding.push(Math.sin(charCode * (i + 1)) * 0.5 + 0.5);
        }
        return embedding;
    }
}
/**
 * In-memory implementation of ExperienceStore for testing.
 */
export class InMemoryExperienceStore {
    constructor() {
        this.experiences = new Map();
        this.signalIndex = new Map();
    }
    /**
     * Adds an experience to the store.
     *
     * @param experience - Experience to add
     */
    add(experience) {
        this.experiences.set(experience.id, experience);
        // Build signal index
        for (const signalMatch of experience.signals_match) {
            if (!this.signalIndex.has(signalMatch)) {
                this.signalIndex.set(signalMatch, new Set());
            }
            this.signalIndex.get(signalMatch).add(experience.id);
        }
    }
    /**
     * Gets an experience by ID.
     *
     * @param id - Experience ID
     * @returns Experience or undefined
     */
    get(id) {
        return this.experiences.get(id);
    }
    /**
     * Gets experiences matching any of the signal keys.
     *
     * @param keys - Signal keys to match
     * @param status - Optional status filter
     * @returns Array of matching experiences
     */
    getBySignalKeys(keys, status) {
        const matchedIds = new Set();
        for (const key of keys) {
            const ids = this.signalIndex.get(key);
            if (ids) {
                ids.forEach((id) => matchedIds.add(id));
            }
            // Also try matching just the value part
            const valuePart = key.split(':')[1]?.toLowerCase();
            if (valuePart) {
                for (const [idxKey, idxIds] of this.signalIndex) {
                    if (idxKey.toLowerCase().includes(valuePart)) {
                        idxIds.forEach((id) => matchedIds.add(id));
                    }
                }
            }
        }
        let results = Array.from(matchedIds)
            .map((id) => this.experiences.get(id))
            .filter((e) => e !== undefined);
        if (status && status.length > 0) {
            results = results.filter((e) => status.includes(e.status));
        }
        return results;
    }
    /**
     * Gets all experiences.
     *
     * @returns All experiences in the store
     */
    getAll() {
        return Array.from(this.experiences.values());
    }
    /**
     * Clears all experiences from the store.
     */
    clear() {
        this.experiences.clear();
        this.signalIndex.clear();
    }
}
// Export singleton instance for convenience (with null stores)
export const experienceMatcher = new ExperienceMatcher();
// Re-export Three-Tier Matcher
export { ThreeTierMatcher, threeTierMatcher, jaccardSimilarity, createSignalKey, } from './threeTierMatcher';
// Default export
export default ExperienceMatcher;
//# sourceMappingURL=index.js.map