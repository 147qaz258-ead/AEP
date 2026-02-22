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
import type { Signal } from '../signal';
/**
 * Status of an experience in the system
 */
export type ExperienceStatus = 'candidate' | 'promoted' | 'deprecated';
/**
 * Type of match that was found
 */
export type MatchType = 'exact' | 'semantic' | 'hybrid';
/**
 * Represents an experience in the AEP system
 */
export interface Experience {
    id: string;
    trigger: string;
    solution: string;
    confidence: number;
    creator: string;
    gdi_score: number;
    status: ExperienceStatus;
    signals_match: string[];
    success_streak: number;
    trigger_embedding?: number[];
}
/**
 * Matcher options interface
 */
export interface MatcherOptions {
    /** Similarity threshold for semantic matching (0-1) */
    semanticThreshold?: number;
    /** Jaccard similarity threshold for bonus scoring (0-1) */
    jaccardThreshold?: number;
    /** Maximum semantic results to retrieve */
    maxSemanticResults?: number;
    /** Embedding dimension for vector similarity */
    embeddingDimension?: number;
}
/**
 * Interface for vector store operations
 */
export interface VectorStore {
    query(embedding: number[], threshold: number, limit: number): Promise<SemanticSearchResult[]>;
}
/**
 * Interface for experience store operations
 */
export interface ExperienceStore {
    get(id: string): Experience | undefined;
    getBySignalKeys(keys: string[], status?: ExperienceStatus[]): Experience[];
}
/**
 * Result from semantic search
 */
export interface SemanticSearchResult {
    experience: Experience;
    similarity: number;
}
import type { SignalIndexQuerier as SignalIndexQuerierType } from '../signal/index-builder';
/**
 * Context information for matching
 */
export interface MatchContext {
    /** Domain context (e.g., "api", "database", "frontend") */
    domain?: string;
    /** Model context (e.g., "claude-3", "gpt-4") */
    model?: string;
    /** Language context (e.g., "python", "javascript") */
    language?: string;
}
/**
 * Extended match result with tier information
 */
export interface ThreeTierMatchResult {
    /** The matched experience */
    experience: Experience;
    /** Match score (0-1) */
    match_score: number;
    /** Type of match */
    match_type: MatchType;
    /** Which tier produced this match (1, 2, or 3) */
    match_tier: 1 | 2 | 3;
    /** Signals that matched */
    signals_matched: string[];
}
/**
 * Request for three-tier matching
 */
export interface ThreeTierMatchRequest {
    /** Signals to match against */
    signals: Signal[];
    /** Maximum number of results to return */
    limit: number;
    /** Optional context for tier 3 weighting */
    context?: MatchContext;
    /** Whether to include candidate experiences */
    include_candidates?: boolean;
    /** Optional status filter */
    status_filter?: ExperienceStatus[];
}
/**
 * Options for Three-Tier Matcher
 */
export interface ThreeTierMatcherOptions extends MatcherOptions {
    /** Weight multiplier for domain match (default: 1.2) */
    domainWeight?: number;
    /** Weight multiplier for language match (default: 1.15) */
    languageWeight?: number;
    /** Weight multiplier for model match (default: 1.1) */
    modelWeight?: number;
}
/**
 * Experience with context metadata
 */
export interface ExperienceWithContext extends Experience {
    context?: {
        domain?: string;
        language?: string;
        compatible_models?: string[];
    };
}
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
export declare class ThreeTierMatcher {
    private readonly options;
    private readonly store;
    private readonly vectorStore;
    /**
     * Creates a new ThreeTierMatcher instance.
     *
     * @param store - Experience store for data retrieval
     * @param vectorStore - Vector store for semantic search
     * @param _indexQuerier - Signal index querier (reserved for future use)
     * @param options - Matcher configuration options
     */
    constructor(store?: ExperienceStore | null, vectorStore?: VectorStore | null, _indexQuerier?: SignalIndexQuerierType | null, options?: ThreeTierMatcherOptions);
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
    match(request: ThreeTierMatchRequest): Promise<ThreeTierMatchResult[]>;
    /**
     * Synchronous version of match for in-memory experiences.
     *
     * @param request - Match request with signals and parameters
     * @param experiences - Array of experiences to search
     * @returns Array of match results ranked by GDI score
     */
    matchSync(request: ThreeTierMatchRequest, experiences: ExperienceWithContext[]): ThreeTierMatchResult[];
    /**
     * Tier 1: Exact signal matching via inverted index.
     *
     * Uses inverted index for O(1) signal lookup.
     * Most reliable matching method.
     *
     * @param signals - Signals to match
     * @returns Array of exact match results (tier 1)
     */
    exactMatch(signals: Signal[]): Promise<ThreeTierMatchResult[]>;
    /**
     * Tier 2: Semantic matching via vector embeddings.
     *
     * Uses vector similarity for matching conceptually similar experiences.
     * Catches conceptually similar but textually different errors.
     *
     * @param signals - Signals to build query from
     * @returns Array of semantic match results (tier 2)
     */
    semanticMatch(signals: Signal[]): Promise<ThreeTierMatchResult[]>;
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
    contextWeight(results: ThreeTierMatchResult[], context: MatchContext): ThreeTierMatchResult[];
    /**
     * Combines and deduplicates results from multiple tiers.
     *
     * @param exact - Results from Tier 1 (exact matching)
     * @param semantic - Results from Tier 2 (semantic matching)
     * @returns Combined and deduplicated results
     */
    combineResults(exact: ThreeTierMatchResult[], semantic: ThreeTierMatchResult[]): ThreeTierMatchResult[];
    /**
     * Performs exact matching from a provided list of experiences.
     *
     * @param signals - Signals to match
     * @param experiences - List of experiences to search
     * @returns Array of exact match results
     */
    private exactMatchFromList;
    /**
     * Performs text similarity matching for synchronous operations.
     *
     * @param signals - Signals to match
     * @param experiences - Experiences to search
     * @returns Array of text similarity match results
     */
    private textSimilarityMatch;
    /**
     * Gets the list of matched signal values for an experience.
     *
     * @param signals - Input signals
     * @param experience - Experience to check against
     * @returns Array of matched signal values
     */
    private getMatchedSignals;
    /**
     * Gets the status filter based on request parameters.
     *
     * @param request - Match request
     * @returns Array of statuses to include
     */
    private getStatusFilter;
    /**
     * Generates a mock embedding for testing purposes.
     * In production, this would call an embedding model.
     *
     * @param text - Text to generate embedding for
     * @returns Mock embedding vector
     */
    private generateMockEmbedding;
}
/**
 * Computes Jaccard similarity between two sets of strings.
 *
 * @param setA - First set of strings
 * @param setB - Second set of strings
 * @returns Jaccard similarity (0-1)
 */
export declare function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number;
/**
 * Creates a normalized signal key from a signal.
 *
 * @param signal - Signal to create key for
 * @returns Normalized signal key
 */
export declare function createSignalKey(signal: Signal): string;
export declare const threeTierMatcher: ThreeTierMatcher;
export default ThreeTierMatcher;
//# sourceMappingURL=threeTierMatcher.d.ts.map