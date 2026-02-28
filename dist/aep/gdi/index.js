/**
 * GDI Scoring Engine for AEP Protocol
 *
 * Calculates Global Desirability Index using multi-dimensional
 * geometric mean with weighted formula.
 *
 * @module aep/gdi
 */
/**
 * Default weights for each dimension in the GDI formula
 */
const DEFAULT_WEIGHTS = {
    quality: 0.35,
    usage: 0.25,
    social: 0.15,
    freshness: 0.15,
    confidence: 0.10,
};
/**
 * Legacy export for backward compatibility
 */
const WEIGHTS = DEFAULT_WEIGHTS;
/**
 * Constants for blast radius safety calculation
 */
const BLAST_RADIUS_CONSTANTS = {
    MAX_FILES: 5,
    MAX_LINES: 200,
};
/**
 * Z-score for 95% confidence interval (Wilson score)
 */
const Z_95 = 1.96;
/**
 * Calculates the Wilson score interval lower bound.
 * Used for stable small-sample proportion estimation.
 *
 * @param positive - Number of positive feedback
 * @param total - Total number of feedback
 * @param zScore - Z-score for confidence level (default: 1.96 for 95%)
 * @returns Wilson score lower bound [0, 1]
 */
function wilsonScoreLowerBound(positive, total, zScore = Z_95) {
    if (total === 0) {
        return 0.0;
    }
    const p = positive / total;
    const z2 = zScore * zScore;
    const denominator = 1 + z2 / total;
    const center = p + z2 / (2 * total);
    const width = zScore * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
    const lowerBound = (center - width) / denominator;
    return Math.max(0.0, lowerBound);
}
/**
 * Calculates the blast radius safety score.
 * Higher score means safer (smaller blast radius).
 *
 * @param blastRadius - The blast radius of changes
 * @returns Safety score [0, 1]
 */
export function computeBlastSafety(blastRadius) {
    const fileSafety = Math.max(0, 1 - blastRadius.files / BLAST_RADIUS_CONSTANTS.MAX_FILES);
    const lineSafety = Math.max(0, 1 - blastRadius.lines / BLAST_RADIUS_CONSTANTS.MAX_LINES);
    return (fileSafety + lineSafety) / 2;
}
/**
 * GDI Calculator class for computing Global Desirability Index.
 *
 * The GDI uses geometric mean with weights to prevent one high
 * dimension from masking problems in other dimensions.
 *
 * Formula:
 * GDI = (Quality^w_q) * (Usage^w_u) * (Social^w_s) * (Freshness^w_f) * (Confidence^w_c)
 */
export class GDICalculator {
    /**
     * Creates a new GDI Calculator with optional custom weights.
     *
     * @param customWeights - Optional custom weights (must sum to 1.0)
     * @throws Error if weights do not sum to 1.0
     */
    constructor(customWeights) {
        this.maxUsesByCategory = new Map();
        this.globalMaxUses = 100; // Default max uses
        this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
        this.validateWeights();
    }
    /**
     * Validates that weights sum to approximately 1.0.
     *
     * @throws Error if weights do not sum to 1.0
     */
    validateWeights() {
        const total = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
        if (Math.abs(total - 1.0) > 0.001) {
            throw new Error(`Weights must sum to 1.0, got ${total}`);
        }
    }
    /**
     * Gets the current weights configuration.
     *
     * @returns Copy of current weights
     */
    getWeights() {
        return { ...this.weights };
    }
    /**
     * Updates weights configuration.
     *
     * @param newWeights - Partial weights to update
     * @throws Error if resulting weights do not sum to 1.0
     */
    updateWeights(newWeights) {
        this.weights = { ...this.weights, ...newWeights };
        this.validateWeights();
    }
    /**
     * Sets the maximum uses for a category (for usage normalization).
     *
     * @param category - Category name
     * @param maxUses - Maximum uses in this category
     */
    setCategoryMaxUses(category, maxUses) {
        this.maxUsesByCategory.set(category, maxUses);
    }
    /**
     * Sets the global maximum uses (fallback when no category specified).
     *
     * @param maxUses - Global maximum uses
     */
    setGlobalMaxUses(maxUses) {
        this.globalMaxUses = maxUses;
    }
    /**
     * Gets the maximum uses for a category.
     *
     * @param category - Category name (optional)
     * @returns Maximum uses for normalization
     */
    getMaxUses(category) {
        if (category && this.maxUsesByCategory.has(category)) {
            return this.maxUsesByCategory.get(category);
        }
        return this.globalMaxUses;
    }
    /**
     * Computes the quality dimension score.
     * Quality = confidence * success_rate * blast_safety
     *
     * @param exp - Experience to compute quality for
     * @returns Quality score [0, 1]
     */
    computeQuality(exp) {
        const baseConfidence = exp.confidence;
        // Success rate with Laplace smoothing
        const successRate = (exp.total_success + 1) / (exp.total_uses + 2);
        // Blast radius safety
        const blastSafety = computeBlastSafety(exp.blast_radius);
        const quality = baseConfidence * successRate * blastSafety;
        return Math.min(quality, 1.0);
    }
    /**
     * Computes the usage dimension score with log normalization.
     * Usage = log(total_uses + 1) / log(max_uses + 1)
     *
     * @param exp - Experience to compute usage for
     * @returns Usage score [0, 1]
     */
    computeUsage(exp) {
        const maxUses = this.getMaxUses(exp.category);
        const usage = Math.log(exp.total_uses + 1) / Math.log(maxUses + 1);
        return Math.min(usage, 1.0);
    }
    /**
     * Computes the social dimension score using Wilson score interval.
     * Provides stable estimation for small sample sizes.
     *
     * @param exp - Experience to compute social score for
     * @returns Social score [0, 1]
     */
    computeSocial(exp) {
        if (exp.total_feedback === 0) {
            return 0.5; // Neutral if no feedback
        }
        return wilsonScoreLowerBound(exp.positive_feedback, exp.total_feedback);
    }
    /**
     * Computes the freshness dimension score with exponential decay.
     * Freshness = 0.5^(age_days / half_life_days)
     *
     * @param exp - Experience to compute freshness for
     * @param halfLifeDays - Half-life in days (default: 30)
     * @returns Freshness score [0, 1]
     */
    computeFreshness(exp, halfLifeDays = 30.0) {
        const now = new Date();
        const ageMs = now.getTime() - exp.updated_at.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays <= 0) {
            return 1.0;
        }
        const freshness = Math.pow(0.5, ageDays / halfLifeDays);
        return freshness;
    }
    /**
     * Computes the confidence dimension score.
     * Simply returns the experience's confidence value.
     *
     * @param exp - Experience to get confidence for
     * @returns Confidence score [0, 1]
     */
    computeConfidence(exp) {
        return exp.confidence;
    }
    /**
     * Computes the full GDI (Global Desirability Index) for an experience.
     *
     * Uses geometric mean with weighted dimensions:
     * GDI = (Quality^0.35) * (Usage^0.25) * (Social^0.15) * (Freshness^0.15) * (Confidence^0.10)
     *
     * @param exp - Experience to compute GDI for
     * @returns GDI result with score and dimension breakdown
     */
    computeGDI(exp) {
        const dimensions = {
            quality: this.computeQuality(exp),
            usage: this.computeUsage(exp),
            social: this.computeSocial(exp),
            freshness: this.computeFreshness(exp),
            confidence: this.computeConfidence(exp),
        };
        // Geometric mean with weights
        // Handle zero values by using a small epsilon to avoid NaN
        const epsilon = 1e-10;
        const safeQuality = Math.max(dimensions.quality, epsilon);
        const safeUsage = Math.max(dimensions.usage, epsilon);
        const safeSocial = Math.max(dimensions.social, epsilon);
        const safeFreshness = Math.max(dimensions.freshness, epsilon);
        const safeConfidence = Math.max(dimensions.confidence, epsilon);
        const gdi = Math.pow(safeQuality, this.weights.quality) *
            Math.pow(safeUsage, this.weights.usage) *
            Math.pow(safeSocial, this.weights.social) *
            Math.pow(safeFreshness, this.weights.freshness) *
            Math.pow(safeConfidence, this.weights.confidence);
        // Ensure range [0, 1]
        const clampedGDI = Math.max(0.0, Math.min(1.0, gdi));
        return {
            score: Math.round(clampedGDI * 10000) / 10000, // Round to 4 decimal places
            dimensions,
            calculated_at: new Date(),
        };
    }
    /**
     * Validates that all dimension values are in the valid range [0, 1].
     *
     * @param dimensions - Dimensions to validate
     * @returns true if all dimensions are valid, false otherwise
     */
    validateDimensions(dimensions) {
        const dimensionEntries = [
            ['quality', dimensions.quality],
            ['usage', dimensions.usage],
            ['social', dimensions.social],
            ['freshness', dimensions.freshness],
            ['confidence', dimensions.confidence],
        ];
        for (const [_name, value] of dimensionEntries) {
            if (value < 0.0 || value > 1.0) {
                return false;
            }
        }
        return true;
    }
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
    computeInitialGDI(confidence) {
        const initialGDI = 0.5 * confidence;
        return Math.round(initialGDI * 10000) / 10000;
    }
}
// Export singleton instance for convenience
export const gdiCalculator = new GDICalculator();
// Export weights for external reference
export { WEIGHTS };
// Default export
export default GDICalculator;
//# sourceMappingURL=index.js.map