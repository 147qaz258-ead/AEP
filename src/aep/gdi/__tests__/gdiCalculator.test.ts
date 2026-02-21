/**
 * Tests for GDI Scoring Engine
 *
 * @module aep/gdi/__tests__
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GDICalculator,
  computeBlastSafety,
  WEIGHTS,
  type Experience,
  type BlastRadius,
} from '../index';

describe('GDICalculator', () => {
  let calculator: GDICalculator;

  beforeEach(() => {
    calculator = new GDICalculator();
  });

  /**
   * Helper to create a mock experience
   */
  function createMockExperience(overrides: Partial<Experience> = {}): Experience {
    return {
      id: 'test-exp-001',
      confidence: 0.8,
      total_uses: 100,
      total_success: 90,
      total_feedback: 50,
      positive_feedback: 40,
      updated_at: new Date(),
      blast_radius: { files: 2, lines: 50 },
      ...overrides,
    };
  }

  describe('AC-GDI-001: GDI using geometric mean with 5 dimensions', () => {
    it('should compute GDI with all 5 dimensions', () => {
      const exp = createMockExperience();
      const result = calculator.computeGDI(exp);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('dimensions');
      expect(result).toHaveProperty('calculated_at');

      expect(result.dimensions).toHaveProperty('quality');
      expect(result.dimensions).toHaveProperty('usage');
      expect(result.dimensions).toHaveProperty('social');
      expect(result.dimensions).toHaveProperty('freshness');
      expect(result.dimensions).toHaveProperty('confidence');
    });

    it('should use weighted geometric mean formula', () => {
      const exp = createMockExperience({
        confidence: 1.0,
        total_uses: 100,
        total_success: 100,
        total_feedback: 100,
        positive_feedback: 100,
        updated_at: new Date(),
        blast_radius: { files: 0, lines: 0 },
      });

      const result = calculator.computeGDI(exp);

      // With perfect scores, GDI should be close to 1.0
      expect(result.score).toBeGreaterThan(0.9);
      expect(result.score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('AC-GDI-002: Quality dimension formula', () => {
    it('should compute quality as confidence * success_rate * blast_safety', () => {
      const exp = createMockExperience({
        confidence: 0.8,
        total_uses: 98,
        total_success: 88, // Success rate with Laplace: (88+1)/(98+2) = 0.89
        blast_radius: { files: 0, lines: 0 }, // Blast safety = 1.0
      });

      const quality = calculator.computeQuality(exp);

      // Quality = 0.8 * 0.89 * 1.0 = 0.712
      expect(quality).toBeCloseTo(0.712, 2);
    });

    it('should use Laplace smoothing for success rate', () => {
      // Zero uses case: (0+1)/(0+2) = 0.5
      const exp = createMockExperience({
        total_uses: 0,
        total_success: 0,
        confidence: 1.0,
        blast_radius: { files: 0, lines: 0 },
      });

      const quality = calculator.computeQuality(exp);
      expect(quality).toBeCloseTo(0.5, 2);
    });

    it('should cap quality at 1.0', () => {
      const exp = createMockExperience({
        confidence: 1.0,
        total_uses: 1000,
        total_success: 1000,
        blast_radius: { files: 0, lines: 0 },
      });

      const quality = calculator.computeQuality(exp);
      expect(quality).toBeLessThanOrEqual(1.0);
    });
  });

  describe('AC-GDI-003: Usage dimension formula', () => {
    it('should compute usage with log normalization', () => {
      calculator.setGlobalMaxUses(100);

      const exp = createMockExperience({
        total_uses: 100,
      });

      const usage = calculator.computeUsage(exp);

      // log(100+1) / log(100+1) = 1.0
      expect(usage).toBeCloseTo(1.0, 2);
    });

    it('should return 0 for zero uses', () => {
      calculator.setGlobalMaxUses(100);

      const exp = createMockExperience({
        total_uses: 0,
      });

      const usage = calculator.computeUsage(exp);

      // log(0+1) / log(100+1) = 0 / log(101) = 0
      expect(usage).toBeCloseTo(0, 2);
    });

    it('should return 0.5 when uses is roughly half of max', () => {
      calculator.setGlobalMaxUses(100);

      // log(x+1) / log(101) = 0.5
      // x+1 = sqrt(101) ≈ 10
      // x ≈ 9
      const exp = createMockExperience({
        total_uses: 9,
      });

      const usage = calculator.computeUsage(exp);
      expect(usage).toBeCloseTo(0.5, 1);
    });

    it('should cap usage at 1.0 even if total_uses exceeds max', () => {
      calculator.setGlobalMaxUses(100);

      const exp = createMockExperience({
        total_uses: 200,
      });

      const usage = calculator.computeUsage(exp);
      expect(usage).toBeLessThanOrEqual(1.0);
    });

    it('should use category-specific max uses when available', () => {
      calculator.setCategoryMaxUses('typescript', 50);
      calculator.setGlobalMaxUses(100);

      const exp = createMockExperience({
        total_uses: 50,
        category: 'typescript',
      });

      const usage = calculator.computeUsage(exp);
      expect(usage).toBeCloseTo(1.0, 2);
    });
  });

  describe('AC-GDI-004: Social dimension with Wilson score interval', () => {
    it('should return 0.5 for zero feedback (neutral)', () => {
      const exp = createMockExperience({
        total_feedback: 0,
        positive_feedback: 0,
      });

      const social = calculator.computeSocial(exp);
      expect(social).toBe(0.5);
    });

    it('should use Wilson score interval for positive ratio', () => {
      // With 40/50 positive feedback, Wilson lower bound should be around 0.71
      const exp = createMockExperience({
        total_feedback: 50,
        positive_feedback: 40,
      });

      const social = calculator.computeSocial(exp);

      // Wilson score lower bound at 95% confidence
      // Should be lower than 0.8 (80%) due to uncertainty
      expect(social).toBeLessThan(0.8);
      expect(social).toBeGreaterThan(0.6);
    });

    it('should return 0 for all negative feedback', () => {
      const exp = createMockExperience({
        total_feedback: 10,
        positive_feedback: 0,
      });

      const social = calculator.computeSocial(exp);
      expect(social).toBeCloseTo(0, 2);
    });

    it('should return high value for all positive feedback with large sample', () => {
      const exp = createMockExperience({
        total_feedback: 1000,
        positive_feedback: 950,
      });

      const social = calculator.computeSocial(exp);
      expect(social).toBeGreaterThan(0.9);
    });

    it('should be conservative with small sample sizes', () => {
      // Small sample: 1/1 = 100%, but Wilson should be conservative
      const exp = createMockExperience({
        total_feedback: 1,
        positive_feedback: 1,
      });

      const social = calculator.computeSocial(exp);

      // Wilson score should be much lower than 1.0 due to small sample
      expect(social).toBeLessThan(0.8);
    });
  });

  describe('AC-GDI-005: Freshness dimension with half-life decay', () => {
    it('should return 1.0 for fresh experience (today)', () => {
      const exp = createMockExperience({
        updated_at: new Date(),
      });

      const freshness = calculator.computeFreshness(exp);
      expect(freshness).toBeCloseTo(1.0, 2);
    });

    it('should return 0.5 for 30-day-old experience (default half-life)', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const exp = createMockExperience({
        updated_at: thirtyDaysAgo,
      });

      const freshness = calculator.computeFreshness(exp);
      expect(freshness).toBeCloseTo(0.5, 2);
    });

    it('should return 0.25 for 60-day-old experience', () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const exp = createMockExperience({
        updated_at: sixtyDaysAgo,
      });

      const freshness = calculator.computeFreshness(exp);
      expect(freshness).toBeCloseTo(0.25, 2);
    });

    it('should support custom half-life parameter', () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const exp = createMockExperience({
        updated_at: fifteenDaysAgo,
      });

      const freshness = calculator.computeFreshness(exp, 15); // 15-day half-life
      expect(freshness).toBeCloseTo(0.5, 2);
    });
  });

  describe('AC-GDI-006: Confidence dimension', () => {
    it('should return the experience confidence value', () => {
      const exp = createMockExperience({
        confidence: 0.75,
      });

      const confidence = calculator.computeConfidence(exp);
      expect(confidence).toBe(0.75);
    });

    it('should handle zero confidence', () => {
      const exp = createMockExperience({
        confidence: 0,
      });

      const confidence = calculator.computeConfidence(exp);
      expect(confidence).toBe(0);
    });

    it('should handle maximum confidence', () => {
      const exp = createMockExperience({
        confidence: 1.0,
      });

      const confidence = calculator.computeConfidence(exp);
      expect(confidence).toBe(1.0);
    });
  });

  describe('AC-GDI-007: Dimension weights', () => {
    it('should have correct weights', () => {
      expect(WEIGHTS.quality).toBe(0.35);
      expect(WEIGHTS.usage).toBe(0.25);
      expect(WEIGHTS.social).toBe(0.15);
      expect(WEIGHTS.freshness).toBe(0.15);
      expect(WEIGHTS.confidence).toBe(0.10);
    });

    it('weights should sum to 1.0', () => {
      const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe('AC-GDI-008: GDI always in range [0, 1]', () => {
    it('should return score in [0, 1] for normal experience', () => {
      const exp = createMockExperience();
      const result = calculator.computeGDI(exp);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should return score in [0, 1] for perfect experience', () => {
      const exp = createMockExperience({
        confidence: 1.0,
        total_uses: 100,
        total_success: 100,
        total_feedback: 100,
        positive_feedback: 100,
        blast_radius: { files: 0, lines: 0 },
      });

      const result = calculator.computeGDI(exp);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should return score in [0, 1] for poor experience', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 1);

      const exp = createMockExperience({
        confidence: 0,
        total_uses: 0,
        total_success: 0,
        total_feedback: 10,
        positive_feedback: 0,
        blast_radius: { files: 5, lines: 200 },
        updated_at: oldDate,
      });

      const result = calculator.computeGDI(exp);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should round score to 4 decimal places', () => {
      const exp = createMockExperience();
      const result = calculator.computeGDI(exp);

      const scoreStr = result.score.toString();
      const decimalPart = scoreStr.split('.')[1] || '';

      expect(decimalPart.length).toBeLessThanOrEqual(4);
    });
  });

  describe('AC-GDI-009: Calculation time < 10ms', () => {
    it('should compute GDI in under 10ms', () => {
      const exp = createMockExperience();

      const start = performance.now();
      calculator.computeGDI(exp);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    it('should compute 1000 GDIs in under 1 second (avg < 1ms each)', () => {
      const experiences: Experience[] = [];
      for (let i = 0; i < 1000; i++) {
        experiences.push(createMockExperience({
          id: `exp-${i}`,
          total_uses: Math.floor(Math.random() * 1000),
          total_success: Math.floor(Math.random() * 1000),
        }));
      }

      const start = performance.now();
      for (const exp of experiences) {
        calculator.computeGDI(exp);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000); // 1 second for 1000 calculations
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero confidence without NaN', () => {
      const exp = createMockExperience({
        confidence: 0,
      });

      const result = calculator.computeGDI(exp);

      expect(result.score).not.toBeNaN();
      expect(result.score).toBe(0); // Zero confidence should result in zero GDI
    });

    it('should handle all zeros gracefully', () => {
      const exp = createMockExperience({
        confidence: 0,
        total_uses: 0,
        total_success: 0,
        total_feedback: 0,
        positive_feedback: 0,
        blast_radius: { files: 5, lines: 200 },
      });

      const result = calculator.computeGDI(exp);

      expect(result.score).not.toBeNaN();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle future updated_at date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const exp = createMockExperience({
        updated_at: futureDate,
      });

      const freshness = calculator.computeFreshness(exp);
      expect(freshness).toBe(1.0); // Future dates should return 1.0
    });
  });
});

describe('computeBlastSafety', () => {
  it('should return 1.0 for zero blast radius', () => {
    const safety = computeBlastSafety({ files: 0, lines: 0 });
    expect(safety).toBe(1.0);
  });

  it('should return 0 for maximum blast radius', () => {
    const safety = computeBlastSafety({ files: 5, lines: 200 });
    expect(safety).toBe(0);
  });

  it('should return 0.5 for moderate blast radius', () => {
    const safety = computeBlastSafety({ files: 2.5, lines: 100 });
    expect(safety).toBeCloseTo(0.5, 2);
  });

  it('should handle file-only changes', () => {
    const safety = computeBlastSafety({ files: 2, lines: 0 });
    // File safety: (1 - 2/5) = 0.6, Line safety: 1.0
    // Average: 0.8
    expect(safety).toBeCloseTo(0.8, 2);
  });

  it('should handle line-only changes', () => {
    const safety = computeBlastSafety({ files: 0, lines: 100 });
    // File safety: 1.0, Line safety: (1 - 100/200) = 0.5
    // Average: 0.75
    expect(safety).toBeCloseTo(0.75, 2);
  });

  it('should return 0 for exceeding max values', () => {
    const safety = computeBlastSafety({ files: 10, lines: 500 });
    expect(safety).toBe(0);
  });
});
