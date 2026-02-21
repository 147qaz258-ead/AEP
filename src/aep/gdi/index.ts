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
  quality: number;      // 0.0 - 1.0
  usage: number;        // 0.0 - 1.0
  social: number;       // 0.0 - 1.0
  freshness: number;    // 0.0 - 1.0
  confidence: number;   // 0.0 - 1.0
}

/**
 * Result of GDI calculation
 */
export interface GDIResult {
  score: number;              // Final GDI: 0.0 - 1.0
  dimensions: GDIDimensions;
  calculated_at: Date;
}

/**
 * Weights for each dimension in the GDI formula
 */
const WEIGHTS = {
  quality: 0.35,
  usage: 0.25,
  social: 0.15,
  freshness: 0.15,
  confidence: 0.10,
} as const;

/**
 * Constants for blast radius safety calculation
 */
const BLAST_RADIUS_CONSTANTS = {
  MAX_FILES: 5,
  MAX_LINES: 200,
} as const;

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
function wilsonScoreLowerBound(
  positive: number,
  total: number,
  zScore: number = Z_95
): number {
  if (total === 0) {
    return 0.0;
  }

  const p = positive / total;
  const z2 = zScore * zScore;

  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const width =
    zScore * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);

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
export function computeBlastSafety(blastRadius: BlastRadius): number {
  const fileSafety = Math.max(
    0,
    1 - blastRadius.files / BLAST_RADIUS_CONSTANTS.MAX_FILES
  );
  const lineSafety = Math.max(
    0,
    1 - blastRadius.lines / BLAST_RADIUS_CONSTANTS.MAX_LINES
  );

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
  private maxUsesByCategory: Map<string, number> = new Map();
  private globalMaxUses: number = 100; // Default max uses

  /**
   * Sets the maximum uses for a category (for usage normalization).
   *
   * @param category - Category name
   * @param maxUses - Maximum uses in this category
   */
  setCategoryMaxUses(category: string, maxUses: number): void {
    this.maxUsesByCategory.set(category, maxUses);
  }

  /**
   * Sets the global maximum uses (fallback when no category specified).
   *
   * @param maxUses - Global maximum uses
   */
  setGlobalMaxUses(maxUses: number): void {
    this.globalMaxUses = maxUses;
  }

  /**
   * Gets the maximum uses for a category.
   *
   * @param category - Category name (optional)
   * @returns Maximum uses for normalization
   */
  private getMaxUses(category?: string): number {
    if (category && this.maxUsesByCategory.has(category)) {
      return this.maxUsesByCategory.get(category)!;
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
  computeQuality(exp: Experience): number {
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
  computeUsage(exp: Experience): number {
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
  computeSocial(exp: Experience): number {
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
  computeFreshness(exp: Experience, halfLifeDays: number = 30.0): number {
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
  computeConfidence(exp: Experience): number {
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
  computeGDI(exp: Experience): GDIResult {
    const dimensions: GDIDimensions = {
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

    const gdi =
      Math.pow(safeQuality, WEIGHTS.quality) *
      Math.pow(safeUsage, WEIGHTS.usage) *
      Math.pow(safeSocial, WEIGHTS.social) *
      Math.pow(safeFreshness, WEIGHTS.freshness) *
      Math.pow(safeConfidence, WEIGHTS.confidence);

    // Ensure range [0, 1]
    const clampedGDI = Math.max(0.0, Math.min(1.0, gdi));

    return {
      score: Math.round(clampedGDI * 10000) / 10000, // Round to 4 decimal places
      dimensions,
      calculated_at: new Date(),
    };
  }
}

// Export singleton instance for convenience
export const gdiCalculator = new GDICalculator();

// Export weights for external reference
export { WEIGHTS };

// Default export
export default GDICalculator;
