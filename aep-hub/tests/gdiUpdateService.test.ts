/**
 * Tests for GDI Update Service
 *
 * Tests cover:
 * - GDI recalculation on feedback
 * - Promotion criteria checking
 * - Deprecation criteria checking
 * - Status transitions
 * - Bayesian confidence update
 */

import {
  GDIUpdateService,
  GDIUpdateInput,
  GDIUpdateResult,
  isBlastRadiusSafe,
  toGDIExperience,
  calculateExpectedStats,
  PROMOTION_CRITERIA,
  DEPRECATION_CRITERIA,
  resetGDIUpdateService,
} from '../src/services/gdiUpdateService';
import { GDICalculator } from '../src/utils/gdi';
import { ExperienceWithStats, FeedbackOutcome } from '../src/types';

// Helper to create mock experience
function createMockExperience(overrides: Partial<ExperienceWithStats> = {}): ExperienceWithStats {
  return {
    id: 'exp_test_001',
    trigger: 'Test trigger',
    solution: 'Test solution',
    confidence: 0.8,
    creator_id: 'agent_test',
    status: 'candidate',
    gdi_score: 0.5,
    signals_match: ['signal1', 'signal2'],
    gene_id: null,
    context: null,
    blast_radius: { files: 2, lines: 50 },
    content_hash: 'abc123',
    created_at: new Date(),
    updated_at: new Date(),
    total_uses: 5,
    total_success: 4,
    total_feedback: 3,
    positive_feedback: 2,
    success_streak: 2,
    consecutive_failures: 0,
    last_used_at: new Date(),
    last_gdi_update: new Date(),
    ...overrides,
  };
}

describe('GDIUpdateService', () => {
  let service: GDIUpdateService;
  let calculator: GDICalculator;

  beforeEach(() => {
    calculator = new GDICalculator();
    service = new GDIUpdateService(calculator);
    resetGDIUpdateService();
  });

  describe('updateOnFeedback', () => {
    it('should recalculate GDI on feedback submission', () => {
      const experience = createMockExperience({
        total_uses: 5,
        total_success: 4,
        positive_feedback: 3,
        total_feedback: 4,
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      expect(result.previous_gdi).toBe(experience.gdi_score);
      expect(result.new_gdi).toBeGreaterThanOrEqual(0);
      expect(result.new_gdi).toBeLessThanOrEqual(1);
      expect(result.dimensions).toBeDefined();
    });

    it('should update Quality dimension based on success_rate and blast_safety', () => {
      const experience = createMockExperience({
        confidence: 0.9,
        total_uses: 10,
        total_success: 9,
        blast_radius: { files: 1, lines: 10 },
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      // High success rate + safe blast radius should result in high quality
      expect(result.dimensions.quality).toBeGreaterThan(0.5);
    });

    it('should update Usage dimension based on total_uses', () => {
      const lowUsageExp = createMockExperience({ total_uses: 1 });
      const highUsageExp = createMockExperience({ total_uses: 50 });

      const lowResult = service.updateOnFeedback({
        experience: lowUsageExp,
        outcome: 'success',
      });
      const highResult = service.updateOnFeedback({
        experience: highUsageExp,
        outcome: 'success',
      });

      // Higher usage should result in higher usage dimension
      expect(highResult.dimensions.usage).toBeGreaterThan(lowResult.dimensions.usage);
    });

    it('should update Social dimension based on positive/total feedback ratio', () => {
      const lowSocialExp = createMockExperience({
        total_feedback: 10,
        positive_feedback: 2,
      });
      const highSocialExp = createMockExperience({
        total_feedback: 10,
        positive_feedback: 9,
      });

      const lowResult = service.updateOnFeedback({
        experience: lowSocialExp,
        outcome: 'success',
      });
      const highResult = service.updateOnFeedback({
        experience: highSocialExp,
        outcome: 'success',
      });

      // Higher positive ratio should result in higher social dimension
      expect(highResult.dimensions.social).toBeGreaterThan(lowResult.dimensions.social);
    });

    it('should update Freshness dimension based on age', () => {
      // The freshness is calculated based on the experience's updated_at
      // We test this by comparing experiences with different original update times
      const freshExp = createMockExperience({
        updated_at: new Date(), // Just updated
      });
      const staleExp = createMockExperience({
        updated_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      });

      // Convert to GDI experience to test the calculator directly
      const freshGdiExp = toGDIExperience(freshExp);
      const staleGdiExp = toGDIExperience(staleExp);

      const freshFreshness = calculator.computeFreshness(freshGdiExp);
      const staleFreshness = calculator.computeFreshness(staleGdiExp);

      // Stale experience should have lower freshness
      expect(freshFreshness).toBeGreaterThan(staleFreshness);
      expect(freshFreshness).toBeCloseTo(1.0, 5); // Fresh experience has ~1.0 freshness (floating point)
    });

    it('should store new GDI score with timestamp (via result)', () => {
      const experience = createMockExperience();
      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      expect(result.new_gdi).toBeDefined();
      expect(result.dimensions).toHaveProperty('quality');
      expect(result.dimensions).toHaveProperty('usage');
      expect(result.dimensions).toHaveProperty('social');
      expect(result.dimensions).toHaveProperty('freshness');
      expect(result.dimensions).toHaveProperty('confidence');
    });
  });

  describe('Promotion Criteria', () => {
    it('should check promotion criteria after GDI update', () => {
      const experience = createMockExperience({
        status: 'candidate',
        confidence: 0.75,
        success_streak: 3,
        total_uses: 5,
        blast_radius: { files: 2, lines: 50 },
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      // Should have checked promotion criteria (result indicates if status changed)
      expect(result.status_changed).toBeDefined();
    });

    it('should promote when all criteria are met', () => {
      // Create experience that will meet all promotion criteria after a success
      // Note: The GDI formula uses geometric mean, so all dimensions need to be reasonably high
      // to reach the 0.65 threshold
      const experience = createMockExperience({
        status: 'candidate',
        confidence: 0.95, // Very high confidence
        total_uses: 50, // High usage to boost usage dimension
        total_success: 48, // 96% success rate
        positive_feedback: 45,
        total_feedback: 48,
        success_streak: 1, // Will become 2 after success
        consecutive_failures: 0,
        blast_radius: { files: 1, lines: 10 }, // Very safe blast radius
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      // With high confidence, high success rate, safe blast radius, should be promoted
      expect(result.status_changed).toBe(true);
      expect(result.new_status).toBe('promoted');
    });

    it('should NOT promote when confidence is too low', () => {
      const experience = createMockExperience({
        status: 'candidate',
        confidence: 0.5, // Below MIN_CONFIDENCE (0.70)
        total_uses: 5,
        success_streak: 3,
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      expect(result.status_changed).toBe(false);
      expect(result.new_status).toBeNull();
    });

    it('should NOT promote when blast radius is unsafe', () => {
      const experience = createMockExperience({
        status: 'candidate',
        confidence: 0.80,
        total_uses: 5,
        success_streak: 3,
        blast_radius: { files: 10, lines: 500 }, // Exceeds limits
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      expect(result.status_changed).toBe(false);
      expect(result.new_status).toBeNull();
    });

    it('should update experience status when criteria met', () => {
      // Similar to the promotion test - need high total_uses for good GDI score
      const experience = createMockExperience({
        status: 'candidate',
        confidence: 0.95,
        total_uses: 50,
        total_success: 48, // 96% success rate
        success_streak: 1, // Will become 2 after success
        positive_feedback: 45,
        total_feedback: 48,
        blast_radius: { files: 1, lines: 10 }, // Safe blast radius
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      expect(result.previous_status).toBe('candidate');
      expect(result.new_status).toBe('promoted');
    });
  });

  describe('Deprecation Criteria', () => {
    it('should deprecate on consecutive failures >= 3', () => {
      const experience = createMockExperience({
        status: 'promoted',
        consecutive_failures: 2, // Will become 3 after this failure
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'failure',
      };

      const result = service.updateOnFeedback(input);

      expect(result.status_changed).toBe(true);
      expect(result.new_status).toBe('deprecated');
    });

    it('should deprecate on sustained low GDI (10+ uses)', () => {
      const experience = createMockExperience({
        status: 'promoted',
        total_uses: 11,
        total_success: 1, // Very low success rate -> low GDI
        positive_feedback: 1,
        total_feedback: 10,
        confidence: 0.3,
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'failure',
      };

      const result = service.updateOnFeedback(input);

      // Should be deprecated due to low GDI with sufficient uses
      expect(result.status_changed).toBe(true);
      expect(result.new_status).toBe('deprecated');
    });

    it('should deprecate on low success rate (5+ uses)', () => {
      const experience = createMockExperience({
        status: 'candidate',
        total_uses: 5,
        total_success: 0, // 0% success rate
        confidence: 0.5,
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'failure',
      };

      const result = service.updateOnFeedback(input);

      expect(result.status_changed).toBe(true);
      expect(result.new_status).toBe('deprecated');
    });

    it('should deprecate on inactivity (90+ days)', () => {
      const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      const experience = createMockExperience({
        status: 'promoted',
        last_used_at: ninetyOneDaysAgo,
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      expect(result.status_changed).toBe(true);
      expect(result.new_status).toBe('deprecated');
    });

    it('should NOT deprecate recently used experience', () => {
      const experience = createMockExperience({
        status: 'promoted',
        last_used_at: new Date(), // Recently used
        total_uses: 20,
        total_success: 15,
        confidence: 0.8,
      });

      const input: GDIUpdateInput = {
        experience,
        outcome: 'success',
      };

      const result = service.updateOnFeedback(input);

      expect(result.status_changed).toBe(false);
    });
  });
});

describe('isBlastRadiusSafe', () => {
  it('should return true for null blast radius', () => {
    expect(isBlastRadiusSafe(null)).toBe(true);
  });

  it('should return true for safe blast radius', () => {
    expect(isBlastRadiusSafe({ files: 3, lines: 100 })).toBe(true);
  });

  it('should return false for unsafe files count', () => {
    expect(isBlastRadiusSafe({ files: 10, lines: 50 })).toBe(false);
  });

  it('should return false for unsafe lines count', () => {
    expect(isBlastRadiusSafe({ files: 2, lines: 300 })).toBe(false);
  });

  it('should return false when both exceed limits', () => {
    expect(isBlastRadiusSafe({ files: 10, lines: 300 })).toBe(false);
  });
});

describe('toGDIExperience', () => {
  it('should convert ExperienceWithStats to GDI Experience', () => {
    const exp = createMockExperience({
      total_uses: 10,
      total_success: 8,
    });

    const gdiExp = toGDIExperience(exp);

    expect(gdiExp.id).toBe(exp.id);
    expect(gdiExp.confidence).toBe(exp.confidence);
    expect(gdiExp.success_rate).toBe(0.8);
    expect(gdiExp.total_uses).toBe(exp.total_uses);
    expect(gdiExp.blast_radius).toEqual(exp.blast_radius);
  });

  it('should handle zero total_uses for success_rate', () => {
    const exp = createMockExperience({
      total_uses: 0,
      total_success: 0,
    });

    const gdiExp = toGDIExperience(exp);

    expect(gdiExp.success_rate).toBeUndefined();
  });

  it('should handle null blast_radius', () => {
    const exp = createMockExperience({
      blast_radius: null,
    });

    const gdiExp = toGDIExperience(exp);

    expect(gdiExp.blast_radius).toEqual({ files: 0, lines: 0 });
  });
});

describe('calculateExpectedStats', () => {
  it('should calculate stats for success outcome', () => {
    const currentStats = {
      total_uses: 5,
      total_success: 3,
      total_feedback: 4,
      positive_feedback: 2,
      success_streak: 1,
      consecutive_failures: 0,
    };

    const result = calculateExpectedStats(currentStats, 'success');

    expect(result.total_uses).toBe(6);
    expect(result.total_success).toBe(4);
    expect(result.total_feedback).toBe(5);
    expect(result.positive_feedback).toBe(3);
    expect(result.success_streak).toBe(2);
    expect(result.consecutive_failures).toBe(0);
  });

  it('should calculate stats for failure outcome', () => {
    const currentStats = {
      total_uses: 5,
      total_success: 3,
      total_feedback: 4,
      positive_feedback: 2,
      success_streak: 2,
      consecutive_failures: 0,
    };

    const result = calculateExpectedStats(currentStats, 'failure');

    expect(result.total_uses).toBe(6);
    expect(result.total_success).toBe(3);
    expect(result.positive_feedback).toBe(2);
    expect(result.success_streak).toBe(0);
    expect(result.consecutive_failures).toBe(1);
  });

  it('should calculate stats for partial outcome with high score', () => {
    const currentStats = {
      total_uses: 5,
      total_success: 3,
      total_feedback: 4,
      positive_feedback: 2,
      success_streak: 1,
      consecutive_failures: 0,
    };

    const result = calculateExpectedStats(currentStats, 'partial', 0.7);

    expect(result.positive_feedback).toBe(3); // score >= 0.5 is positive
    expect(result.success_streak).toBe(1); // Partial doesn't affect streak
  });

  it('should calculate stats for partial outcome with low score', () => {
    const currentStats = {
      total_uses: 5,
      total_success: 3,
      total_feedback: 4,
      positive_feedback: 2,
      success_streak: 1,
      consecutive_failures: 0,
    };

    const result = calculateExpectedStats(currentStats, 'partial', 0.3);

    expect(result.positive_feedback).toBe(2); // score < 0.5 is not positive
  });
});

describe('updateConfidence', () => {
  it('should update confidence on success', () => {
    const service = new GDIUpdateService();
    const newConfidence = service.updateConfidence(0.5, 'success');

    // With evidence weight of 5, success (1.0) should increase confidence
    expect(newConfidence).toBeGreaterThan(0.5);
  });

  it('should update confidence on failure', () => {
    const service = new GDIUpdateService();
    const newConfidence = service.updateConfidence(0.5, 'failure');

    // Failure (0.0) should decrease confidence
    expect(newConfidence).toBeLessThan(0.5);
  });

  it('should update confidence on partial with score', () => {
    const service = new GDIUpdateService();
    const newConfidence = service.updateConfidence(0.5, 'partial', 0.7);

    // Partial with high score should slightly increase confidence
    expect(newConfidence).toBeGreaterThan(0.5);
  });

  it('should clamp confidence to [0, 1]', () => {
    const service = new GDIUpdateService();

    const highConf = service.updateConfidence(0.99, 'success');
    const lowConf = service.updateConfidence(0.01, 'failure');

    expect(highConf).toBeLessThanOrEqual(1.0);
    expect(lowConf).toBeGreaterThanOrEqual(0.0);
  });
});

describe('Promotion Criteria Constants', () => {
  it('should have correct promotion criteria values', () => {
    expect(PROMOTION_CRITERIA.MIN_SUCCESS_STREAK).toBe(2);
    expect(PROMOTION_CRITERIA.MIN_CONFIDENCE).toBe(0.70);
    expect(PROMOTION_CRITERIA.MIN_GDI_SCORE).toBe(0.65);
    expect(PROMOTION_CRITERIA.MIN_TOTAL_USES).toBe(3);
    expect(PROMOTION_CRITERIA.BLAST_RADIUS.MAX_FILES).toBe(5);
    expect(PROMOTION_CRITERIA.BLAST_RADIUS.MAX_LINES).toBe(200);
  });
});

describe('Deprecation Criteria Constants', () => {
  it('should have correct deprecation criteria values', () => {
    expect(DEPRECATION_CRITERIA.MIN_CONSECUTIVE_FAILURES).toBe(3);
    expect(DEPRECATION_CRITERIA.LOW_GDI.MIN_TOTAL_USES).toBe(10);
    expect(DEPRECATION_CRITERIA.LOW_GDI.MAX_GDI_SCORE).toBe(0.30);
    expect(DEPRECATION_CRITERIA.LOW_SUCCESS_RATE.MIN_TOTAL_USES).toBe(5);
    expect(DEPRECATION_CRITERIA.LOW_SUCCESS_RATE.MIN_SUCCESS_RATE).toBe(0.20);
    expect(DEPRECATION_CRITERIA.INACTIVITY_DAYS).toBe(90);
  });
});
