/**
 * GDI Types and Calculator for AEP Hub
 *
 * Calculates Global Desirability Index using multi-dimensional
 * geometric mean with weighted formula.
 *
 * This is a copy for use within the aep-hub project.
 */

/**
 * Represents the blast radius of an experience's changes
 */
export interface BlastRadius {
  files: number;
  lines: number;
}

/**
 * Represents an experience for GDI calculation
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
 * Default weights for each dimension in the GDI formula
 */
const DEFAULT_WEIGHTS = {
  quality: 0.35,
  usage: 0.25,
  social: 0.15,
  freshness: 0.15,
  confidence: 0.10,
} as const;

/**
 * Weights type for configuration
 */
export type GDIWeights = typeof DEFAULT_WEIGHTS;

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
 */
export class GDICalculator {
  private maxUsesByCategory: Map<string, number> = new Map();
  private globalMaxUses: number = 100;
  private weights: GDIWeights;

  constructor(customWeights?: Partial<GDIWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    this.validateWeights();
  }

  private validateWeights(): void {
    const total = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(total - 1.0) > 0.001) {
      throw new Error(`Weights must sum to 1.0, got ${total}`);
    }
  }

  getWeights(): GDIWeights {
    return { ...this.weights };
  }

  updateWeights(newWeights: Partial<GDIWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    this.validateWeights();
  }

  setCategoryMaxUses(category: string, maxUses: number): void {
    this.maxUsesByCategory.set(category, maxUses);
  }

  setGlobalMaxUses(maxUses: number): void {
    this.globalMaxUses = maxUses;
  }

  private getMaxUses(category?: string): number {
    if (category && this.maxUsesByCategory.has(category)) {
      return this.maxUsesByCategory.get(category)!;
    }
    return this.globalMaxUses;
  }

  /**
   * Computes the quality dimension score.
   * Quality = confidence * success_rate * blast_safety
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
   */
  computeUsage(exp: Experience): number {
    const maxUses = this.getMaxUses(exp.category);
    const usage = Math.log(exp.total_uses + 1) / Math.log(maxUses + 1);
    return Math.min(usage, 1.0);
  }

  /**
   * Computes the social dimension score using Wilson score interval.
   */
  computeSocial(exp: Experience): number {
    if (exp.total_feedback === 0) {
      return 0.5;
    }

    return wilsonScoreLowerBound(exp.positive_feedback, exp.total_feedback);
  }

  /**
   * Computes the freshness dimension score with exponential decay.
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
   */
  computeConfidence(exp: Experience): number {
    return exp.confidence;
  }

  /**
   * Computes the full GDI for an experience.
   */
  computeGDI(exp: Experience): GDIResult {
    const dimensions: GDIDimensions = {
      quality: this.computeQuality(exp),
      usage: this.computeUsage(exp),
      social: this.computeSocial(exp),
      freshness: this.computeFreshness(exp),
      confidence: this.computeConfidence(exp),
    };

    const epsilon = 1e-10;
    const safeQuality = Math.max(dimensions.quality, epsilon);
    const safeUsage = Math.max(dimensions.usage, epsilon);
    const safeSocial = Math.max(dimensions.social, epsilon);
    const safeFreshness = Math.max(dimensions.freshness, epsilon);
    const safeConfidence = Math.max(dimensions.confidence, epsilon);

    const gdi =
      Math.pow(safeQuality, this.weights.quality) *
      Math.pow(safeUsage, this.weights.usage) *
      Math.pow(safeSocial, this.weights.social) *
      Math.pow(safeFreshness, this.weights.freshness) *
      Math.pow(safeConfidence, this.weights.confidence);

    const clampedGDI = Math.max(0.0, Math.min(1.0, gdi));

    return {
      score: Math.round(clampedGDI * 10000) / 10000,
      dimensions,
      calculated_at: new Date(),
    };
  }

  /**
   * Computes the initial GDI for a newly published experience.
   */
  computeInitialGDI(confidence: number): number {
    const initialGDI = 0.5 * confidence;
    return Math.round(initialGDI * 10000) / 10000;
  }
}

// Export singleton instance
export const gdiCalculator = new GDICalculator();

export default GDICalculator;
