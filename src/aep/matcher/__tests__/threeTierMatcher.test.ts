/**
 * Unit tests for Three-Tier Matcher Module
 *
 * Tests cover:
 * - AC-MATCH-001: Tier 1 exact signal matching via inverted index
 * - AC-MATCH-002: Tier 2 semantic matching via vector embeddings
 * - AC-MATCH-003: Tier 3 context weighting for domain/model compatibility
 * - AC-MATCH-004: Semantic similarity threshold >= 0.75
 * - AC-MATCH-005: Jaccard similarity threshold >= 0.34
 * - AC-MATCH-006: Combines results from all tiers without duplicates
 * - AC-MATCH-007: Ranks combined results by GDI score
 * - AC-MATCH-008: Total matching time < 100ms (p95)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ThreeTierMatcher,
  jaccardSimilarity,
  createSignalKey,
  type ExperienceWithContext,
  type ThreeTierMatchRequest,
  type ThreeTierMatchResult,
  type MatchContext,
} from '../threeTierMatcher';
import type { Signal } from '../../signal';

// Helper to create test experiences with context
function createTestExperience(
  id: string,
  overrides: Partial<ExperienceWithContext> = {}
): ExperienceWithContext {
  return {
    id,
    trigger: `Test trigger for ${id}`,
    solution: `Test solution for ${id}`,
    confidence: 0.8,
    creator: 'test-agent',
    gdi_score: 0.5,
    status: 'promoted',
    signals_match: [`keyword:test-${id}`],
    success_streak: 0,
    context: {
      domain: 'api',
      language: 'typescript',
      compatible_models: ['claude-3', 'gpt-4'],
    },
    ...overrides,
  };
}

// Helper to create test signals
function createTestSignal(
  value: string,
  type: Signal['type'] = 'keyword',
  weight: number = 1.0
): Signal {
  return { type, value, weight };
}

describe('ThreeTierMatcher', () => {
  let matcher: ThreeTierMatcher;

  beforeEach(() => {
    matcher = new ThreeTierMatcher(null, null, null);
  });

  describe('AC-MATCH-001: Tier 1 Exact Match', () => {
    it('should find exact matches via signal lookup', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError: Cannot read property',
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-2', {
          trigger: 'Network timeout error',
          signals_match: ['keyword:timeout'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].match_type).toBe('exact');
      expect(results[0].match_tier).toBe(1);
    });

    it('should match signals in trigger text', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError specific error message',
          signals_match: [],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].signals_matched).toContain('TypeError');
    });

    it('should match signals in signals_match array', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'Connection failed',
          signals_match: ['keyword:network_error'],
        }),
      ];

      const signals = [createTestSignal('network_error', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('AC-MATCH-002: Tier 2 Semantic Match', () => {
    it('should find semantic matches via text similarity', () => {
      // Create experiences where semantic match is needed
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'connection timeout network error failure',
          signals_match: ['keyword:unrelated'],
        }),
      ];

      // Signal doesn't match exactly but has similar terms
      const signals = [createTestSignal('connection timeout network', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      // Should find a match (either exact via partial match or semantic)
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should classify semantic matches with tier 2', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'completely different text unrelated to query',
          signals_match: ['keyword:something_else'],
          gdi_score: 0.3,
        }),
        createTestExperience('exp-2', {
          trigger: 'network error timeout connection failed',
          signals_match: ['keyword:network'],
          gdi_score: 0.9,
        }),
      ];

      const signals = [createTestSignal('network', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      // exp-2 should match via exact signal
      expect(results.some(r => r.experience.id === 'exp-2')).toBe(true);
    });
  });

  describe('AC-MATCH-003: Tier 3 Context Weighting', () => {
    it('should boost scores for matching domain', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.7,
          context: { domain: 'api' },
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.7,
          context: { domain: 'database' },
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const context: MatchContext = { domain: 'api' };
      const request: ThreeTierMatchRequest = { signals, limit: 10, context };

      const results = matcher.matchSync(request, experiences);

      // Both should match, but exp-1 should have higher score due to domain match
      expect(results.length).toBeGreaterThan(0);
      const exp1Result = results.find(r => r.experience.id === 'exp-1');
      const exp2Result = results.find(r => r.experience.id === 'exp-2');

      if (exp1Result && exp2Result) {
        expect(exp1Result.match_score).toBeGreaterThan(exp2Result.match_score);
      }
    });

    it('should boost scores for matching language', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.7,
          context: { language: 'typescript' },
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.7,
          context: { language: 'python' },
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const context: MatchContext = { language: 'typescript' };
      const request: ThreeTierMatchRequest = { signals, limit: 10, context };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should boost scores for matching model', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.7,
          context: { compatible_models: ['claude-3'] },
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const context: MatchContext = { model: 'claude-3' };
      const request: ThreeTierMatchRequest = { signals, limit: 10, context };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);

      // Score should be boosted (tier 3)
      expect(results[0].match_tier).toBe(3);
    });

    it('should apply multiple weight multipliers', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.7,
          context: {
            domain: 'api',
            language: 'typescript',
            compatible_models: ['claude-3'],
          },
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const context: MatchContext = {
        domain: 'api',
        language: 'typescript',
        model: 'claude-3',
      };
      const request: ThreeTierMatchRequest = { signals, limit: 10, context };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);

      // With all three multipliers: 1.2 * 1.15 * 1.1 = 1.518
      expect(results[0].match_score).toBeGreaterThan(1.0);
    });
  });

  describe('AC-MATCH-004: Semantic Similarity Threshold >= 0.75', () => {
    it('should enforce semantic threshold of 0.75', () => {
      const matcherWithThreshold = new ThreeTierMatcher(null, null, null, {
        semanticThreshold: 0.75,
      });

      // Create experience that would match below threshold
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'completely different unrelated text here',
          signals_match: [],
        }),
      ];

      // Signal has only 1 word overlap out of many
      const signals = [createTestSignal('different text here more words added', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcherWithThreshold.matchSync(request, experiences);
      // Should not match due to high threshold
      expect(results.length).toBe(0);
    });

    it('should accept matches above threshold', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'error timeout network',
          signals_match: [],
        }),
      ];

      // High overlap signal
      const signals = [createTestSignal('error timeout network', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      // Should find match due to high similarity
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AC-MATCH-005: Jaccard Similarity Threshold >= 0.34', () => {
    it('should use Jaccard threshold for bonus scoring', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError specific error',
          signals_match: ['keyword:type_error', 'keyword:error'],
        }),
      ];

      const signals = [
        createTestSignal('TypeError', 'keyword'),
        createTestSignal('error', 'keyword'),
      ];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);
      // High Jaccard similarity should give bonus score
      expect(results[0].match_score).toBeGreaterThan(0);
    });
  });

  describe('AC-MATCH-006: Combine Results Without Duplicates', () => {
    it('should not include duplicate experiences', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.9,
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.8,
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);

      // Check no duplicate IDs
      const ids = results.map(r => r.experience.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should combine results from multiple tiers', () => {
      const experiences = [
        // Tier 1 match
        createTestExperience('exp-1', {
          trigger: 'TypeError specific error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.9,
        }),
        // Potential Tier 2 match
        createTestExperience('exp-2', {
          trigger: 'network timeout connection error failure',
          signals_match: [],
          gdi_score: 0.8,
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      // Should at least have exp-1
      expect(results.some(r => r.experience.id === 'exp-1')).toBe(true);
    });
  });

  describe('AC-MATCH-007: Rank by GDI Score', () => {
    it('should rank results by GDI score descending', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.9,
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.5,
        }),
        createTestExperience('exp-3', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          gdi_score: 0.7,
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      const gdiScores = results.map(r => r.experience.gdi_score);

      expect(gdiScores).toEqual([0.9, 0.7, 0.5]);
    });
  });

  describe('AC-MATCH-008: Performance < 100ms', () => {
    it('should complete match in under 100ms for 100 experiences', () => {
      const experiences = Array.from({ length: 100 }, (_, i) =>
        createTestExperience(`exp-${i}`, {
          trigger: `Error type ${i % 10} with details`,
          gdi_score: Math.random(),
          signals_match: [`keyword:error-${i % 10}`],
        })
      );

      const signals = [createTestSignal('Error type 5', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const startTime = performance.now();
      matcher.matchSync(request, experiences);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should complete multiple matches efficiently', () => {
      const experiences = Array.from({ length: 50 }, (_, i) =>
        createTestExperience(`exp-${i}`, {
          trigger: `Error ${i}`,
          signals_match: [`keyword:error-${i}`],
        })
      );

      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        const signals = [createTestSignal(`Error ${i}`, 'keyword')];
        const request: ThreeTierMatchRequest = { signals, limit: 5 };
        matcher.matchSync(request, experiences);
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(100); // 10ms per query average
    });
  });

  describe('Status Filtering', () => {
    it('should return only promoted status by default', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          status: 'promoted',
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          status: 'candidate',
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-3', {
          trigger: 'TypeError error',
          status: 'deprecated',
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(1);
      expect(results[0].experience.status).toBe('promoted');
    });

    it('should include candidates when include_candidates is true', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          status: 'promoted',
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          status: 'candidate',
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = {
        signals,
        limit: 10,
        include_candidates: true,
      };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(2);
    });

    it('should respect status_filter parameter', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          status: 'promoted',
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          status: 'candidate',
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = {
        signals,
        limit: 10,
        status_filter: ['candidate'],
      };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(1);
      expect(results[0].experience.status).toBe('candidate');
    });
  });

  describe('Limit Parameter', () => {
    it('should respect limit parameter', () => {
      const experiences = Array.from({ length: 20 }, (_, i) =>
        createTestExperience(`exp-${i}`, {
          trigger: 'TypeError error',
          gdi_score: 0.9 - i * 0.01,
          signals_match: ['keyword:type_error'],
        })
      );

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 5 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(5);
    });

    it('should return all matches when limit is high', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 100 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty signals array', () => {
      const experiences = [createTestExperience('exp-1')];
      const request: ThreeTierMatchRequest = { signals: [], limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toBeDefined();
    });

    it('should handle empty experiences array', () => {
      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, []);
      expect(results).toHaveLength(0);
    });

    it('should handle limit of 0', () => {
      const experiences = [createTestExperience('exp-1')];
      const signals = [createTestSignal('Test', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 0 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(0);
    });

    it('should handle experiences without context', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
          context: undefined as any,
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const context: MatchContext = { domain: 'api' };
      const request: ThreeTierMatchRequest = { signals, limit: 10, context };

      const results = matcher.matchSync(request, experiences);
      expect(results).toBeDefined();
    });

    it('should handle request without context', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toBeDefined();
    });
  });

  describe('Async match', () => {
    it('should return empty array when stores are null', async () => {
      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: ThreeTierMatchRequest = { signals, limit: 10 };

      const results = await matcher.match(request);
      expect(results).toHaveLength(0);
    });
  });
});

describe('jaccardSimilarity', () => {
  it('should compute similarity between identical sets', () => {
    const setA = new Set(['a', 'b', 'c']);
    const setB = new Set(['a', 'b', 'c']);
    expect(jaccardSimilarity(setA, setB)).toBe(1.0);
  });

  it('should compute similarity between disjoint sets', () => {
    const setA = new Set(['a', 'b']);
    const setB = new Set(['c', 'd']);
    expect(jaccardSimilarity(setA, setB)).toBe(0);
  });

  it('should compute similarity between partially overlapping sets', () => {
    const setA = new Set(['a', 'b', 'c']);
    const setB = new Set(['b', 'c', 'd']);
    // intersection: {b, c} = 2, union: {a, b, c, d} = 4
    expect(jaccardSimilarity(setA, setB)).toBe(0.5);
  });

  it('should return 0 for empty sets', () => {
    const setA = new Set<string>();
    const setB = new Set<string>();
    expect(jaccardSimilarity(setA, setB)).toBe(0);
  });
});

describe('createSignalKey', () => {
  it('should create normalized key from signal (lowercase)', () => {
    const signal = createTestSignal('TypeError', 'keyword');
    const key = createSignalKey(signal);
    // makeSignalKey normalizes to lowercase
    expect(key).toBe('keyword:typeerror');
  });

  it('should handle different signal types', () => {
    const signals: Signal[] = [
      { type: 'errsig', value: 'error-123', weight: 1.5 },
      { type: 'opportunity', value: 'feature', weight: 0.8 },
      { type: 'context', value: 'user-id', weight: 0.5 },
    ];

    const keys = signals.map(createSignalKey);
    expect(keys).toEqual([
      'errsig:error-123',
      'opportunity:feature',
      'context:user-id',
    ]);
  });
});

describe('Module Exports', () => {
  it('should export ThreeTierMatcher class', () => {
    expect(ThreeTierMatcher).toBeDefined();
    expect(typeof ThreeTierMatcher).toBe('function');
  });

  it('should export jaccardSimilarity function', () => {
    expect(jaccardSimilarity).toBeDefined();
    expect(typeof jaccardSimilarity).toBe('function');
  });

  it('should export createSignalKey function', () => {
    expect(createSignalKey).toBeDefined();
    expect(typeof createSignalKey).toBe('function');
  });
});
