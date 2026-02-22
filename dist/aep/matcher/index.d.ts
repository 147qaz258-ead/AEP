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
 * Request for matching signals against experiences
 */
export interface MatchRequest {
    signals: Signal[];
    limit: number;
    include_candidates?: boolean;
    status_filter?: ExperienceStatus[];
}
/**
 * Result of matching signals against experiences
 */
export interface MatchResult {
    experience: Experience;
    match_score: number;
    match_type: MatchType;
    signals_matched: string[];
}
/**
 * Options for configuring the matcher
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
export declare function computeMatchScore(signals: Signal[], experience: Experience, jaccardThreshold?: number): number;
/**
 * Deduplicates match results by experience ID.
 * When duplicates are found, keeps the one with the higher match score.
 *
 * @param results - Array of match results to deduplicate
 * @returns Deduplicated array
 */
export declare function deduplicateResults(results: MatchResult[]): MatchResult[];
/**
 * Converts a signal to a searchable key for index lookup.
 *
 * @param signal - Signal to convert
 * @returns Searchable key string
 */
export declare function signalToKey(signal: Signal): string;
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
export declare class ExperienceMatcher {
    private readonly options;
    private readonly store;
    private readonly vectorStore;
    /**
     * Creates a new ExperienceMatcher instance.
     *
     * @param store - Experience store for data retrieval
     * @param vectorStore - Vector store for semantic search
     * @param options - Matcher configuration options
     */
    constructor(store?: ExperienceStore | null, vectorStore?: VectorStore | null, options?: MatcherOptions);
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
    match(request: MatchRequest): Promise<MatchResult[]>;
    /**
     * Synchronous version of match for in-memory experiences.
     *
     * @param request - Match request with signals and parameters
     * @param experiences - Array of experiences to search
     * @returns Array of match results ranked by GDI score
     */
    matchSync(request: MatchRequest, experiences: Experience[]): MatchResult[];
    /**
     * Performs exact signal matching via inverted index.
     *
     * @param signals - Signals to match
     * @returns Array of exact match results
     */
    private exactMatch;
    /**
     * Performs exact matching from a provided list of experiences.
     *
     * @param signals - Signals to match
     * @param experiences - List of experiences to search
     * @returns Array of exact match results
     */
    private exactMatchFromList;
    /**
     * Performs semantic matching via vector similarity.
     *
     * @param signals - Signals to build query from
     * @returns Array of semantic match results
     */
    private semanticMatch;
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
 * In-memory implementation of ExperienceStore for testing.
 */
export declare class InMemoryExperienceStore implements ExperienceStore {
    private experiences;
    private signalIndex;
    /**
     * Adds an experience to the store.
     *
     * @param experience - Experience to add
     */
    add(experience: Experience): void;
    /**
     * Gets an experience by ID.
     *
     * @param id - Experience ID
     * @returns Experience or undefined
     */
    get(id: string): Experience | undefined;
    /**
     * Gets experiences matching any of the signal keys.
     *
     * @param keys - Signal keys to match
     * @param status - Optional status filter
     * @returns Array of matching experiences
     */
    getBySignalKeys(keys: string[], status?: ExperienceStatus[]): Experience[];
    /**
     * Gets all experiences.
     *
     * @returns All experiences in the store
     */
    getAll(): Experience[];
    /**
     * Clears all experiences from the store.
     */
    clear(): void;
}
export declare const experienceMatcher: ExperienceMatcher;
export { ThreeTierMatcher, threeTierMatcher, jaccardSimilarity, createSignalKey, type ThreeTierMatchRequest, type ThreeTierMatchResult, type MatchContext, type ThreeTierMatcherOptions, type ExperienceWithContext, } from './threeTierMatcher';
export default ExperienceMatcher;
//# sourceMappingURL=index.d.ts.map