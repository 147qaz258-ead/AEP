/**
 * GDI Update Service for AEP Protocol
 *
 * Handles GDI score updates on feedback submission with:
 * - Bayesian confidence update
 * - Status transition (candidate -> promoted -> deprecated)
 * - Promotion and deprecation criteria checking
 *
 * @module aep-hub/services/gdi-update
 */

import { GDICalculator, Experience, GDIResult, BlastRadius } from '../utils/gdi';
import { ExperienceWithStats, ExperienceStats, FeedbackOutcome } from '../types';

/**
 * Constants for promotion and deprecation criteria
 */
export const PROMOTION_CRITERIA = {
  MIN_SUCCESS_STREAK: 2,
  MIN_CONFIDENCE: 0.70,
  MIN_GDI_SCORE: 0.65,
  MIN_TOTAL_USES: 3,
  BLAST_RADIUS: {
    MAX_FILES: 5,
    MAX_LINES: 200,
  },
} as const;

export const DEPRECATION_CRITERIA = {
  MIN_CONSECUTIVE_FAILURES: 3,
  LOW_GDI: {
    MIN_TOTAL_USES: 10,
    MAX_GDI_SCORE: 0.30,
  },
  LOW_SUCCESS_RATE: {
    MIN_TOTAL_USES: 5,
    MIN_SUCCESS_RATE: 0.20,
  },
  INACTIVITY_DAYS: 90,
} as const;

/**
 * Result of GDI update operation
 */
export interface GDIUpdateResult {
  previous_gdi: number;
  new_gdi: number;
  dimensions: GDIResult['dimensions'];
  status_changed: boolean;
  new_status: 'candidate' | 'promoted' | 'deprecated' | null;
  previous_status: 'candidate' | 'promoted' | 'deprecated';
}

/**
 * Input for GDI update on feedback
 */
export interface GDIUpdateInput {
  experience: ExperienceWithStats;
  outcome: FeedbackOutcome;
  score?: number;
}

/**
 * Check if blast radius is within safe limits
 */
export function isBlastRadiusSafe(blastRadius: BlastRadius | null): boolean {
  if (!blastRadius) {
    return true; // No blast radius = safe
  }

  const files = blastRadius.files ?? 0;
  const lines = blastRadius.lines ?? 0;

  return (
    files <= PROMOTION_CRITERIA.BLAST_RADIUS.MAX_FILES &&
    lines <= PROMOTION_CRITERIA.BLAST_RADIUS.MAX_LINES
  );
}

/**
 * Convert ExperienceWithStats to GDI Experience type
 */
export function toGDIExperience(exp: ExperienceWithStats): Experience {
  return {
    id: exp.id,
    confidence: exp.confidence,
    success_rate: exp.total_uses > 0 ? exp.total_success / exp.total_uses : undefined,
    total_uses: exp.total_uses,
    total_success: exp.total_success,
    total_feedback: exp.total_feedback,
    positive_feedback: exp.positive_feedback,
    updated_at: exp.updated_at,
    category: exp.gene_id ?? undefined,
    blast_radius: exp.blast_radius ?? { files: 0, lines: 0 },
  };
}

/**
 * Calculate expected stats after feedback submission
 */
export function calculateExpectedStats(
  currentStats: ExperienceStats,
  outcome: FeedbackOutcome,
  score?: number
): ExperienceStats {
  const isPositive =
    outcome === 'success' || (outcome === 'partial' && (score ?? 0) >= 0.5);

  return {
    total_uses: currentStats.total_uses + 1,
    total_success: currentStats.total_success + (outcome === 'success' ? 1 : 0),
    total_feedback: currentStats.total_feedback + 1,
    positive_feedback: currentStats.positive_feedback + (isPositive ? 1 : 0),
    success_streak:
      outcome === 'success'
        ? currentStats.success_streak + 1
        : outcome === 'failure'
        ? 0
        : currentStats.success_streak,
    consecutive_failures:
      outcome === 'failure'
        ? currentStats.consecutive_failures + 1
        : outcome === 'success'
        ? 0
        : currentStats.consecutive_failures,
  };
}

/**
 * GDI Update Service
 *
 * Encapsulates logic for updating GDI scores and triggering status transitions.
 */
export class GDIUpdateService {
  private gdiCalculator: GDICalculator;

  constructor(gdiCalculator?: GDICalculator) {
    this.gdiCalculator = gdiCalculator ?? new GDICalculator();
  }

  /**
   * Update GDI after feedback submission.
   *
   * This method:
   * 1. Recalculates GDI with updated stats
   * 2. Checks promotion criteria (candidate -> promoted)
   * 3. Checks deprecation criteria (candidate/promoted -> deprecated)
   * 4. Returns the update result with new GDI and status
   */
  updateOnFeedback(input: GDIUpdateInput): GDIUpdateResult {
    const { experience, outcome, score } = input;
    const previousGdi = experience.gdi_score;
    const previousStatus = experience.status;

    // Calculate expected stats after this feedback
    const currentStats: ExperienceStats = {
      total_uses: experience.total_uses,
      total_success: experience.total_success,
      total_feedback: experience.total_feedback,
      positive_feedback: experience.positive_feedback,
      success_streak: experience.success_streak,
      consecutive_failures: experience.consecutive_failures,
    };

    const expectedStats = calculateExpectedStats(currentStats, outcome, score);

    // Create updated experience for GDI calculation
    const updatedExperience: ExperienceWithStats = {
      ...experience,
      total_uses: expectedStats.total_uses,
      total_success: expectedStats.total_success,
      total_feedback: expectedStats.total_feedback,
      positive_feedback: expectedStats.positive_feedback,
      success_streak: expectedStats.success_streak,
      consecutive_failures: expectedStats.consecutive_failures,
      updated_at: new Date(),
    };

    // Recalculate GDI with updated stats
    const gdiExp = toGDIExperience(updatedExperience);
    const gdiResult = this.gdiCalculator.computeGDI(gdiExp);
    const newGdi = gdiResult.score;

    // Check for status change
    let newStatus: 'candidate' | 'promoted' | 'deprecated' | null = null;
    let statusChanged = false;

    // Check promotion (candidate -> promoted)
    if (previousStatus === 'candidate') {
      if (this.checkPromotionCriteria(updatedExperience, expectedStats, newGdi)) {
        newStatus = 'promoted';
        statusChanged = true;
      }
    }

    // Check deprecation (candidate or promoted -> deprecated)
    if (!statusChanged && (previousStatus === 'candidate' || previousStatus === 'promoted')) {
      if (this.checkDeprecationCriteria(updatedExperience, expectedStats, newGdi)) {
        newStatus = 'deprecated';
        statusChanged = true;
      }
    }

    return {
      previous_gdi: previousGdi,
      new_gdi: newGdi,
      dimensions: gdiResult.dimensions,
      status_changed: statusChanged,
      new_status: newStatus,
      previous_status: previousStatus,
    };
  }

  /**
   * Check if experience should be promoted (candidate -> promoted).
   *
   * Promotion criteria:
   * - success_streak >= 2
   * - confidence >= 0.70
   * - gdi_score >= 0.65
   * - total_uses >= 3
   * - blast_radius_safe (files <= 5, lines <= 200)
   */
  checkPromotionCriteria(
    experience: ExperienceWithStats,
    stats: ExperienceStats,
    newGdi: number
  ): boolean {
    const checks = {
      success_streak: stats.success_streak >= PROMOTION_CRITERIA.MIN_SUCCESS_STREAK,
      confidence: experience.confidence >= PROMOTION_CRITERIA.MIN_CONFIDENCE,
      gdi_score: newGdi >= PROMOTION_CRITERIA.MIN_GDI_SCORE,
      total_uses: stats.total_uses >= PROMOTION_CRITERIA.MIN_TOTAL_USES,
      blast_radius_safe: isBlastRadiusSafe(experience.blast_radius),
    };

    return Object.values(checks).every((v) => v === true);
  }

  /**
   * Check if experience should be deprecated (candidate/promoted -> deprecated).
   *
   * Deprecation criteria (any one triggers deprecation):
   * - consecutive_failures >= 3
   * - OR (total_uses >= 10 AND gdi_score < 0.30)
   * - OR (total_uses >= 5 AND success_rate < 0.20)
   * - OR last_used_at > 90 days ago
   */
  checkDeprecationCriteria(
    experience: ExperienceWithStats,
    stats: ExperienceStats,
    newGdi: number
  ): boolean {
    // Rule 1: Consecutive failures
    if (stats.consecutive_failures >= DEPRECATION_CRITERIA.MIN_CONSECUTIVE_FAILURES) {
      return true;
    }

    // Rule 2: Sustained low GDI (after 10+ uses)
    if (
      stats.total_uses >= DEPRECATION_CRITERIA.LOW_GDI.MIN_TOTAL_USES &&
      newGdi < DEPRECATION_CRITERIA.LOW_GDI.MAX_GDI_SCORE
    ) {
      return true;
    }

    // Rule 3: Low success rate (after 5+ uses)
    if (stats.total_uses >= DEPRECATION_CRITERIA.LOW_SUCCESS_RATE.MIN_TOTAL_USES) {
      const successRate = stats.total_success / stats.total_uses;
      if (successRate < DEPRECATION_CRITERIA.LOW_SUCCESS_RATE.MIN_SUCCESS_RATE) {
        return true;
      }
    }

    // Rule 4: No recent usage (90+ days)
    if (experience.last_used_at) {
      const lastUsed = new Date(experience.last_used_at);
      const now = new Date();
      const ageDays = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > DEPRECATION_CRITERIA.INACTIVITY_DAYS) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update Bayesian confidence based on feedback.
   *
   * Uses a simple Bayesian update formula:
   * new_confidence = (prior * evidence_weight + feedback_evidence) / (evidence_weight + 1)
   *
   * Where feedback_evidence is:
   * - 1.0 for success
   * - 0.0 for failure
   * - score (or 0.5) for partial
   */
  updateConfidence(
    currentConfidence: number,
    outcome: FeedbackOutcome,
    score?: number,
    evidenceWeight: number = 5.0
  ): number {
    let feedbackEvidence: number;

    switch (outcome) {
      case 'success':
        feedbackEvidence = 1.0;
        break;
      case 'failure':
        feedbackEvidence = 0.0;
        break;
      case 'partial':
        feedbackEvidence = score ?? 0.5;
        break;
    }

    const newConfidence =
      (currentConfidence * evidenceWeight + feedbackEvidence) / (evidenceWeight + 1);

    // Clamp to [0, 1]
    return Math.max(0.0, Math.min(1.0, newConfidence));
  }

  /**
   * Get the calculator instance
   */
  getCalculator(): GDICalculator {
    return this.gdiCalculator;
  }
}

// Singleton instance
let serviceInstance: GDIUpdateService | null = null;

/**
 * Get the singleton GDI update service instance
 */
export function getGDIUpdateService(calculator?: GDICalculator): GDIUpdateService {
  if (!serviceInstance) {
    serviceInstance = new GDIUpdateService(calculator);
  }
  return serviceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetGDIUpdateService(): void {
  serviceInstance = null;
}

export default GDIUpdateService;
