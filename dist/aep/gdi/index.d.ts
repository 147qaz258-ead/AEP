/**
 * GDI Scoring Engine for AEP Protocol
 *
 * Calculates Global Desirability Index using multi-dimensional
 * geometric mean with weighted formula.
 *
 * @module aep/gdi
 */
/**
 * Represents the blast radius of an experience's changes
 */
export interface BlastRadius {
    files: number;
    lines: number;
}
/**
 * Represents an experience in the AEP system
 */
export interface Experience {
    id: string;
    confidence: number;
    success_rate?: number;
    total_uses: number;
    total_success: number;
    total_feedback: number;
    positive_feedback: number;
    updated_at: Date;
    category?: string;
    blast_radius: BlastRadius;
}
/**
 * Individual dimension scores for GDI calculation
 */
export interface GDIDimensions {
    quality: number;
    usage: number;
    social: number;
    freshness: number;
    confidence: number;
}
/**
 * Result of GDI calculation
 */
export interface GDIResult {
    score: number;
    dimensions: GDIDimensions;
    calculated_at: Date;
}
/**
 * Default weights for each dimension in the GDI formula
 */
declare const DEFAULT_WEIGHTS: {
    readonly quality: 0.35;
    readonly usage: 0.25;
    readonly social: 0.15;
    readonly freshness: 0.15;
    readonly confidence: 0.1;
};
/**
 * Weights type for configuration
 */
export type GDIWeights = typeof DEFAULT_WEIGHTS;
/**
 * Legacy export for backward compatibility
 */
declare const WEIGHTS: {
    readonly quality: 0.35;
    readonly usage: 0.25;
    readonly social: 0.15;
    readonly freshness: 0.15;
    readonly confidence: 0.1;
};
/**
 * Calculates the blast radius safety score.
 * Higher score means safer (smaller blast radius).
 *
 * @param blastRadius - The blast radius of changes
 * @returns Safety score [0, 1]
 */
export declare function computeBlastSafety(blastRadius: BlastRadius): number;
/**
 * GDI Calculator class for computing Global Desirability Index.
 *
 * The GDI uses geometric mean with weights to prevent one high
 * dimension from masking problems in other dimensions.
 *
 * Formula:
 * GDI = (Quality^w_q) * (Usage^w_u) * (Social^w_s) * (Freshness^w_f) * (Confidence^w_c)
 */
export declare class GDICalculator {
    private maxUsesByCategory;
    private globalMaxUses;
    private weights;
    /**
     * Creates a new GDI Calculator with optional custom weights.
     *
     * @param customWeights - Optional custom weights (must sum to 1.0)
     * @throws Error if weights do not sum to 1.0
     */
    constructor(customWeights?: Partial<GDIWeights>);
    /**
     * Validates that weights sum to approximately 1.0.
     *
     * @throws Error if weights do not sum to 1.0
     */
    private validateWeights;
    /**
     * Gets the current weights configuration.
     *
     * @returns Copy of current weights
     */
    getWeights(): GDIWeights;
    /**
     * Updates weights configuration.
     *
     * @param newWeights - Partial weights to update
     * @throws Error if resulting weights do not sum to 1.0
     */
    updateWeights(newWeights: Partial<GDIWeights>): void;
    /**
     * Sets the maximum uses for a category (for usage normalization).
     *
     * @param category - Category name
     * @param maxUses - Maximum uses in this category
     */
    setCategoryMaxUses(category: string, maxUses: number): void;
    /**
     * Sets the global maximum uses (fallback when no category specified).
     *
     * @param maxUses - Global maximum uses
     */
    setGlobalMaxUses(maxUses: number): void;
    /**
     * Gets the maximum uses for a category.
     *
     * @param category - Category name (optional)
     * @returns Maximum uses for normalization
     */
    private getMaxUses;
    /**
     * Computes the quality dimension score.
     * Quality = confidence * success_rate * blast_safety
     *
     * @param exp - Experience to compute quality for
     * @returns Quality score [0, 1]
     */
    computeQuality(exp: Experience): number;
    /**
     * Computes the usage dimension score with log normalization.
     * Usage = log(total_uses + 1) / log(max_uses + 1)
     *
     * @param exp - Experience to compute usage for
     * @returns Usage score [0, 1]
     */
    computeUsage(exp: Experience): number;
    /**
     * Computes the social dimension score using Wilson score interval.
     * Provides stable estimation for small sample sizes.
     *
     * @param exp - Experience to compute social score for
     * @returns Social score [0, 1]
     */
    computeSocial(exp: Experience): number;
    /**
     * Computes the freshness dimension score with exponential decay.
     * Freshness = 0.5^(age_days / half_life_days)
     *
     * @param exp - Experience to compute freshness for
     * @param halfLifeDays - Half-life in days (default: 30)
     * @returns Freshness score [0, 1]
     */
    computeFreshness(exp: Experience, halfLifeDays?: number): number;
    /**
     * Computes the confidence dimension score.
     * Simply returns the experience's confidence value.
     *
     * @param exp - Experience to get confidence for
     * @returns Confidence score [0, 1]
     */
    computeConfidence(exp: Experience): number;
    /**
     * Computes the full GDI (Global Desirability Index) for an experience.
     *
     * Uses geometric mean with weighted dimensions:
     * GDI = (Quality^0.35) * (Usage^0.25) * (Social^0.15) * (Freshness^0.15) * (Confidence^0.10)
     *
     * @param exp - Experience to compute GDI for
     * @returns GDI result with score and dimension breakdown
     */
    computeGDI(exp: Experience): GDIResult;
    /**
     * Validates that all dimension values are in the valid range [0, 1].
     *
     * @param dimensions - Dimensions to validate
     * @returns true if all dimensions are valid, false otherwise
     */
    validateDimensions(dimensions: GDIDimensions): boolean;
    /**
     * Computes the initial GDI for a newly published experience.
     *
     * Initial GDI = 0.5 * confidence
     *
     * This provides a conservative starting point that:
     * - Uses publisher's confidence as a baseline
     * - Scales down to avoid over-ranking unvalidated experiences
     * - Awaits community feedback for true GDI calculation
     *
     * @param confidence - Publisher's confidence in the experience
     * @returns Initial GDI score rounded to 4 decimal places
     *
     * @example
     * // confidence = 1.0 -> initial GDI = 0.50
     * // confidence = 0.8 -> initial GDI = 0.40
     * // confidence = 0.5 -> initial GDI = 0.25
     */
    computeInitialGDI(confidence: number): number;
}
export declare const gdiCalculator: GDICalculator;
export { WEIGHTS };
export default GDICalculator;
//# sourceMappingURL=index.d.ts.map