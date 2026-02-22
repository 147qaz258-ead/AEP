/**
 * Three-Tier Matcher Module for AEP Protocol
 *
 * Implements the three-tier matching strategy:
 * 1. Tier 1: Exact signal matching via inverted index
 * 2. Tier 2: Semantic matching via vector embeddings
 * 3. Tier 3: Context-based weighting for domain/model compatibility
 *
 * Results are combined, deduplicated, and ranked by GDI score.
 *
 * @module aep/matcher/three-tier
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
 */
function computeMatchScore(signals, experience, jaccardThreshold = DEFAULT_OPTIONS.jaccardThreshold) {
    let score = 0.0;
    for (const signal of signals) {
        const triggerLower = experience.trigger.toLowerCase();
        const signalLower = signal.value.toLowerCase();
        if (triggerLower.includes(signalLower)) {
            score += signal.weight;
        }
        const isInSignalsMatch = experience.signals_match.some((s) => s.toLowerCase() === signalLower ||
            s.toLowerCase() === `${signal.type}:${signalLower}`.toLowerCase());
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
 * Converts a signal to a searchable key for index lookup.
 */
function signalToKey(signal) {
    return `${signal.type}:${signal.value}`;
}
import { makeSignalKey } from '../signal/index-builder';
/**
 * Default options for three-tier matcher
 */
const THREE_TIER_DEFAULT_OPTIONS = {
    ...DEFAULT_OPTIONS,
    domainWeight: 1.2,
    languageWeight: 1.15,
    modelWeight: 1.1,
};
/**
 * Three-Tier Matcher Class
 *
 * Implements comprehensive three-tier matching:
 * - Tier 1: Fast inverted index lookup for exact signal matches
 * - Tier 2: Vector similarity search for semantic matches
 * - Tier 3: Context-based weighting for domain/model compatibility
 *
 * Results are combined, deduplicated, and ranked by GDI score.
 */
export class ThreeTierMatcher {
    /**
     * Creates a new ThreeTierMatcher instance.
     *
     * @param store - Experience store for data retrieval
     * @param vectorStore - Vector store for semantic search
     * @param _indexQuerier - Signal index querier (reserved for future use)
     * @param options - Matcher configuration options
     */
    constructor(store = null, vectorStore = null, _indexQuerier, options = {}) {
        this.store = store;
        this.vectorStore = vectorStore;
        this.options = { ...THREE_TIER_DEFAULT_OPTIONS, ...options };
    }
    /**
     * Main matching method that combines all three tiers.
     *
     * Strategy:
     * 1. Tier 1 (Exact): Fast inverted index lookup
     * 2. Tier 2 (Semantic): Vector similarity if Tier 1 insufficient
     * 3. Tier 3 (Context): Apply domain/model weighting
     * 4. Combine, deduplicate, rank by GDI
     *
     * @param request - Match request with signals and parameters
     * @returns Array of match results ranked by GDI score
     */
    async match(request) {
        const candidates = [];
        // Tier 1: Exact match (highest priority)
        const exactResults = await this.exactMatch(request.signals);
        candidates.push(...exactResults);
        // Tier 2: Semantic match (if not enough results)
        let semanticResults = [];
        if (candidates.length < request.limit) {
            semanticResults = await this.semanticMatch(request.signals);
            candidates.push(...semanticResults);
        }
        // Combine and deduplicate
        const combined = this.combineResults(exactResults, semanticResults.length > 0 ? semanticResults : []);
        // Apply tier 3 weighting to combined results
        let finalResults = combined;
        if (request.context) {
            finalResults = this.contextWeight(combined, request.context);
        }
        // Rank by GDI score
        const ranked = finalResults.sort((a, b) => b.experience.gdi_score - a.experience.gdi_score);
        // Apply status filter
        const statusFilter = this.getStatusFilter(request);
        const filtered = ranked.filter((r) => statusFilter.includes(r.experience.status));
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
        // Tier 1: Exact match on provided experiences
        const exactResults = this.exactMatchFromList(request.signals, experiences);
        candidates.push(...exactResults);
        // Tier 2: Semantic-like match using text similarity
        let semanticResults = [];
        if (candidates.length < request.limit) {
            const unmatchedExperiences = experiences.filter((e) => !candidates.some((c) => c.experience.id === e.id));
            semanticResults = this.textSimilarityMatch(request.signals, unmatchedExperiences);
            candidates.push(...semanticResults);
        }
        // Combine and deduplicate
        const combined = this.combineResults(exactResults, semanticResults);
        // Tier 3: Context weighting
        let finalResults = combined;
        if (request.context) {
            finalResults = this.contextWeight(combined, request.context);
        }
        // Rank by GDI score
        const ranked = finalResults.sort((a, b) => b.experience.gdi_score - a.experience.gdi_score);
        // Apply status filter
        const statusFilter = this.getStatusFilter(request);
        const filtered = ranked.filter((r) => statusFilter.includes(r.experience.status));
        return filtered.slice(0, request.limit);
    }
    /**
     * Tier 1: Exact signal matching via inverted index.
     *
     * Uses inverted index for O(1) signal lookup.
     * Most reliable matching method.
     *
     * @param signals - Signals to match
     * @returns Array of exact match results (tier 1)
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
                match_tier: 1,
                signals_matched: signalsMatched,
            };
        });
    }
    /**
     * Tier 2: Semantic matching via vector embeddings.
     *
     * Uses vector similarity for matching conceptually similar experiences.
     * Catches conceptually similar but textually different errors.
     *
     * @param signals - Signals to build query from
     * @returns Array of semantic match results (tier 2)
     */
    async semanticMatch(signals) {
        if (!this.vectorStore) {
            return [];
        }
        // Build query text from signals
        const queryText = signals.map((s) => s.value).join(' ');
        // Get query embedding (mock for now)
        const queryEmbedding = this.generateMockEmbedding(queryText);
        // Query vector store
        const results = await this.vectorStore.query(queryEmbedding, this.options.semanticThreshold, this.options.maxSemanticResults);
        return results
            .filter((r) => r.similarity >= this.options.semanticThreshold)
            .map((r) => ({
            experience: r.experience,
            match_score: r.similarity,
            match_type: 'semantic',
            match_tier: 2,
            signals_matched: [],
        }));
    }
    /**
     * Tier 3: Apply context-based weighting.
     *
     * Boosts scores for experiences matching the request context.
     * - Domain match: 1.2x multiplier
     * - Language match: 1.15x multiplier
     * - Model match: 1.1x multiplier
     *
     * @param results - Results to weight
     * @param context - Match context
     * @returns Weighted results
     */
    contextWeight(results, context) {
        return results.map((result) => {
            let weight = 1.0;
            const exp = result.experience;
            const expContext = exp.context;
            if (expContext) {
                // Domain matching
                if (context.domain && expContext.domain === context.domain) {
                    weight *= this.options.domainWeight;
                }
                // Language matching
                if (context.language && expContext.language === context.language) {
                    weight *= this.options.languageWeight;
                }
                // Model compatibility
                if (context.model &&
                    expContext.compatible_models?.includes(context.model)) {
                    weight *= this.options.modelWeight;
                }
            }
            return {
                ...result,
                match_score: result.match_score * weight,
                // Update tier to 3 if weighting was applied (weight > 1.0)
                match_tier: weight > 1.0 ? 3 : result.match_tier,
            };
        });
    }
    /**
     * Combines and deduplicates results from multiple tiers.
     *
     * @param exact - Results from Tier 1 (exact matching)
     * @param semantic - Results from Tier 2 (semantic matching)
     * @returns Combined and deduplicated results
     */
    combineResults(exact, semantic) {
        const seen = new Set();
        const combined = [];
        // Add exact matches first (higher priority)
        for (const result of exact) {
            if (!seen.has(result.experience.id)) {
                seen.add(result.experience.id);
                combined.push(result);
            }
        }
        // Add semantic matches
        for (const result of semantic) {
            if (!seen.has(result.experience.id)) {
                seen.add(result.experience.id);
                combined.push(result);
            }
        }
        return combined;
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
                    match_tier: 1,
                    signals_matched: signalsMatched,
                });
            }
        }
        return results;
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
            // Calculate Jaccard similarity
            const intersection = new Set([...queryTerms].filter((t) => triggerTerms.has(t)));
            const union = new Set([...queryTerms, ...triggerTerms]);
            const similarity = union.size > 0 ? intersection.size / union.size : 0;
            // Use semantic threshold for consistency with AC-MATCH-004
            if (similarity >= this.options.semanticThreshold) {
                results.push({
                    experience: exp,
                    match_score: similarity,
                    match_type: 'semantic',
                    match_tier: 2,
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
            const signalKey = makeSignalKey(signal).toLowerCase();
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
 * Computes Jaccard similarity between two sets of strings.
 *
 * @param setA - First set of strings
 * @param setB - Second set of strings
 * @returns Jaccard similarity (0-1)
 */
export function jaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0) {
        return 0;
    }
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}
/**
 * Creates a normalized signal key from a signal.
 *
 * @param signal - Signal to create key for
 * @returns Normalized signal key
 */
export function createSignalKey(signal) {
    return makeSignalKey(signal);
}
// Export singleton instance for convenience
export const threeTierMatcher = new ThreeTierMatcher();
// Default export
export default ThreeTierMatcher;
//# sourceMappingURL=threeTierMatcher.js.map