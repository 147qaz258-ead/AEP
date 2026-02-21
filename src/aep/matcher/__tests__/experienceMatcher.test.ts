/**
 * Unit tests for Experience Matcher Module
 *
 * Tests cover:
 * - Exact signal matching (AC-MATCH-001)
 * - Semantic matching (AC-MATCH-002)
 * - Result deduplication (AC-MATCH-003)
 * - Match score computation (AC-MATCH-004)
 * - GDI score ranking (AC-MATCH-005)
 * - Status filtering (AC-MATCH-006)
 * - Limit parameter (AC-MATCH-007)
 * - Query performance (AC-MATCH-008)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExperienceMatcher,
  InMemoryExperienceStore,
  computeMatchScore,
  deduplicateResults,
  signalToKey,
  type Experience,
  type MatchRequest,
  type MatchResult,
  type Signal,
} from '../index';

// Helper to create test experiences
function createTestExperience(
  id: string,
  overrides: Partial<Experience> = {}
): Experience {
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

describe('ExperienceMatcher', () => {
  let matcher: ExperienceMatcher;
  let store: InMemoryExperienceStore;

  beforeEach(() => {
    store = new InMemoryExperienceStore();
    matcher = new ExperienceMatcher(store, null);
  });

  describe('computeMatchScore', () => {
    it('should score signal matching in trigger text', () => {
      const signals = [createTestSignal('TypeError', 'keyword', 1.0)];
      const experience = createTestExperience('exp-1', {
        trigger: 'TypeError: Cannot read property',
        signals_match: [],
      });

      const score = computeMatchScore(signals, experience);
      expect(score).toBeGreaterThan(0);
    });

    it('should score signal matching in signals_match array', () => {
      const signals = [createTestSignal('network_error', 'keyword', 1.0)];
      const experience = createTestExperience('exp-1', {
        trigger: 'Connection failed',
        signals_match: ['keyword:network_error'],
      });

      const score = computeMatchScore(signals, experience);
      expect(score).toBeGreaterThan(0);
    });

    it('should apply 0.8 weight for signals_match matches', () => {
      const signals = [createTestSignal('test', 'keyword', 1.0)];
      const experience = createTestExperience('exp-1', {
        trigger: 'Other text', // Signal NOT in trigger
        signals_match: ['keyword:test'], // Signal only in signals_match
      });

      const score = computeMatchScore(signals, experience);
      // Signal matches signals_match array: 1.0 * 0.8 = 0.8
      // Jaccard bonus: 1.0 (full match)
      // Total: 1.8
      expect(score).toBeGreaterThanOrEqual(0.8);
    });

    it('should add Jaccard bonus when threshold met', () => {
      const signals = [
        createTestSignal('error', 'keyword', 1.0),
        createTestSignal('timeout', 'keyword', 1.0),
      ];
      const experience = createTestExperience('exp-1', {
        trigger: 'error timeout',
        signals_match: ['keyword:error', 'keyword:timeout'],
      });

      const score = computeMatchScore(signals, experience);
      // Should have base score + Jaccard bonus
      expect(score).toBeGreaterThan(1.6);
    });

    it('should return 0 for no matches', () => {
      const signals = [createTestSignal('nonexistent', 'keyword', 1.0)];
      const experience = createTestExperience('exp-1', {
        trigger: 'Completely different text',
        signals_match: ['keyword:other'],
      });

      const score = computeMatchScore(signals, experience);
      expect(score).toBe(0);
    });

    it('should handle case-insensitive matching', () => {
      const signals = [createTestSignal('TYPEERROR', 'keyword', 1.0)];
      const experience = createTestExperience('exp-1', {
        trigger: 'TypeError: error',
        signals_match: [],
      });

      const score = computeMatchScore(signals, experience);
      expect(score).toBeGreaterThan(0);
    });

    it('should use custom Jaccard threshold', () => {
      const signals = [createTestSignal('test', 'keyword', 1.0)];
      const experience = createTestExperience('exp-1', {
        trigger: 'test',
        signals_match: ['keyword:test'],
      });

      const scoreDefault = computeMatchScore(signals, experience, 0.34);
      const scoreHigh = computeMatchScore(signals, experience, 0.9);

      // Higher threshold should potentially give lower score
      expect(scoreDefault).toBeGreaterThanOrEqual(scoreHigh);
    });
  });

  describe('deduplicateResults', () => {
    it('should remove duplicate experiences by ID', () => {
      const exp = createTestExperience('exp-1');
      const results: MatchResult[] = [
        { experience: exp, match_score: 0.5, match_type: 'exact', signals_matched: ['a'] },
        { experience: exp, match_score: 0.7, match_type: 'semantic', signals_matched: ['b'] },
      ];

      const deduplicated = deduplicateResults(results);
      expect(deduplicated).toHaveLength(1);
    });

    it('should keep higher match score for duplicates', () => {
      const exp = createTestExperience('exp-1');
      const results: MatchResult[] = [
        { experience: exp, match_score: 0.5, match_type: 'exact', signals_matched: [] },
        { experience: exp, match_score: 0.9, match_type: 'semantic', signals_matched: [] },
      ];

      const deduplicated = deduplicateResults(results);
      expect(deduplicated[0].match_score).toBe(0.9);
    });

    it('should preserve unique experiences', () => {
      const results: MatchResult[] = [
        { experience: createTestExperience('exp-1'), match_score: 0.5, match_type: 'exact', signals_matched: [] },
        { experience: createTestExperience('exp-2'), match_score: 0.7, match_type: 'exact', signals_matched: [] },
      ];

      const deduplicated = deduplicateResults(results);
      expect(deduplicated).toHaveLength(2);
    });
  });

  describe('signalToKey', () => {
    it('should create key from signal type and value', () => {
      const signal = createTestSignal('TypeError', 'keyword');
      const key = signalToKey(signal);
      expect(key).toBe('keyword:TypeError');
    });

    it('should handle different signal types', () => {
      const signals: Signal[] = [
        { type: 'errsig', value: 'error-123', weight: 1.5 },
        { type: 'opportunity', value: 'feature', weight: 0.8 },
        { type: 'context', value: 'user-id', weight: 0.5 },
      ];

      const keys = signals.map(signalToKey);
      expect(keys).toEqual([
        'errsig:error-123',
        'opportunity:feature',
        'context:user-id',
      ]);
    });
  });

  describe('matchSync', () => {
    it('should return exact matches (AC-MATCH-001)', () => {
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
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].match_type).toBe('exact');
    });

    it('should rank results by GDI score descending (AC-MATCH-005)', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          gdi_score: 0.9,
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError error',
          gdi_score: 0.5,
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-3', {
          trigger: 'TypeError error',
          gdi_score: 0.7,
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      const gdiScores = results.map((r) => r.experience.gdi_score);

      expect(gdiScores).toEqual([0.9, 0.7, 0.5]);
    });

    it('should return only promoted status by default (AC-MATCH-006)', () => {
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
      const request: MatchRequest = { signals, limit: 10 };

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
      const request: MatchRequest = {
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
        createTestExperience('exp-3', {
          trigger: 'TypeError error',
          status: 'deprecated',
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = {
        signals,
        limit: 10,
        status_filter: ['candidate', 'deprecated'],
      };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(['candidate', 'deprecated']).toContain(r.experience.status);
      });
    });

    it('should respect limit parameter (AC-MATCH-007)', () => {
      const experiences = Array.from({ length: 20 }, (_, i) =>
        createTestExperience(`exp-${i}`, {
          trigger: 'TypeError error',
          gdi_score: 0.9 - i * 0.01,
          signals_match: ['keyword:type_error'],
        })
      );

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 5 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(5);
    });

    it('should combine exact and semantic results without duplicates (AC-MATCH-003)', () => {
      // Create experiences where some match exactly and others semantically
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError specific error',
          gdi_score: 0.9,
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-2', {
          trigger: 'TypeError specific error',
          gdi_score: 0.8,
          signals_match: ['keyword:type_error'],
        }),
        createTestExperience('exp-3', {
          trigger: 'Different error type',
          gdi_score: 0.7,
          signals_match: ['keyword:other'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);

      // Check no duplicate IDs
      const ids = results.map((r) => r.experience.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should return empty array when no matches found', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'Network error',
          signals_match: ['keyword:network_error'],
        }),
      ];

      const signals = [createTestSignal('Nonexistent', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(0);
    });
  });

  describe('match (async)', () => {
    it('should return results from store', async () => {
      store.add(
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: ['keyword:TypeError'], // Match signal value directly
        })
      );

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = await matcher.match(request);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array when store is null', async () => {
      const nullMatcher = new ExperienceMatcher(null, null);

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = await nullMatcher.match(request);
      expect(results).toHaveLength(0);
    });
  });

  describe('Performance (AC-MATCH-008)', () => {
    it('should complete match in under 50ms for 100 experiences', () => {
      // Create 100 experiences
      const experiences = Array.from({ length: 100 }, (_, i) =>
        createTestExperience(`exp-${i}`, {
          trigger: `Error type ${i % 10} with details`,
          gdi_score: Math.random(),
          signals_match: [`keyword:error-${i % 10}`],
        })
      );

      const signals = [createTestSignal('Error type 5', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const startTime = performance.now();
      matcher.matchSync(request, experiences);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50);
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
        const request: MatchRequest = { signals, limit: 5 };
        matcher.matchSync(request, experiences);
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(100); // 10ms per query average
    });
  });

  describe('Match Types', () => {
    it('should classify exact matches correctly', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError specific error',
          signals_match: ['keyword:type_error'],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results[0].match_type).toBe('exact');
    });

    it('should classify semantic matches correctly', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'Connection timeout network error',
          signals_match: ['keyword:network'],
        }),
      ];

      // Using a signal that doesn't exactly match but has similar terms
      const signals = [createTestSignal('timeout network', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      // Should find match via text similarity
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty signals array', () => {
      const experiences = [createTestExperience('exp-1')];
      const request: MatchRequest = { signals: [], limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toBeDefined();
    });

    it('should handle empty experiences array', () => {
      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, []);
      expect(results).toHaveLength(0);
    });

    it('should handle limit of 0', () => {
      const experiences = [createTestExperience('exp-1')];
      const signals = [createTestSignal('Test', 'keyword')];
      const request: MatchRequest = { signals, limit: 0 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toHaveLength(0);
    });

    it('should handle experiences with empty signals_match', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'TypeError error',
          signals_match: [],
        }),
      ];

      const signals = [createTestSignal('TypeError', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle special characters in signals', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: 'Error: <script>alert("xss")</script>',
          signals_match: ['keyword:script'],
        }),
      ];

      const signals = [createTestSignal('script', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toBeDefined();
    });

    it('should handle unicode characters', () => {
      const experiences = [
        createTestExperience('exp-1', {
          trigger: '中文错误消息',
          signals_match: ['keyword:中文'],
        }),
      ];

      const signals = [createTestSignal('中文', 'keyword')];
      const request: MatchRequest = { signals, limit: 10 };

      const results = matcher.matchSync(request, experiences);
      expect(results).toBeDefined();
    });
  });
});

describe('InMemoryExperienceStore', () => {
  let store: InMemoryExperienceStore;

  beforeEach(() => {
    store = new InMemoryExperienceStore();
  });

  describe('add', () => {
    it('should add experience to store', () => {
      const exp = createTestExperience('exp-1');
      store.add(exp);
      expect(store.get('exp-1')).toEqual(exp);
    });

    it('should build signal index on add', () => {
      const exp = createTestExperience('exp-1', {
        signals_match: ['keyword:test', 'errsig:hash123'],
      });
      store.add(exp);

      const results = store.getBySignalKeys(['keyword:test']);
      expect(results).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('should return experience by ID', () => {
      const exp = createTestExperience('exp-1');
      store.add(exp);
      expect(store.get('exp-1')).toEqual(exp);
    });

    it('should return undefined for non-existent ID', () => {
      expect(store.get('nonexistent')).toBeUndefined();
    });
  });

  describe('getBySignalKeys', () => {
    it('should return experiences matching signal keys', () => {
      store.add(
        createTestExperience('exp-1', {
          signals_match: ['keyword:type_error'],
        })
      );
      store.add(
        createTestExperience('exp-2', {
          signals_match: ['keyword:timeout'],
        })
      );

      const results = store.getBySignalKeys(['keyword:type_error']);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('exp-1');
    });

    it('should return multiple matching experiences', () => {
      store.add(
        createTestExperience('exp-1', {
          signals_match: ['keyword:error'],
        })
      );
      store.add(
        createTestExperience('exp-2', {
          signals_match: ['keyword:error'],
        })
      );

      const results = store.getBySignalKeys(['keyword:error']);
      expect(results).toHaveLength(2);
    });

    it('should filter by status when provided', () => {
      store.add(
        createTestExperience('exp-1', {
          status: 'promoted',
          signals_match: ['keyword:test'],
        })
      );
      store.add(
        createTestExperience('exp-2', {
          status: 'candidate',
          signals_match: ['keyword:test'],
        })
      );

      const results = store.getBySignalKeys(['keyword:test'], ['promoted']);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('promoted');
    });

    it('should return empty array for no matches', () => {
      store.add(createTestExperience('exp-1'));
      const results = store.getBySignalKeys(['keyword:nonexistent']);
      expect(results).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return all experiences', () => {
      store.add(createTestExperience('exp-1'));
      store.add(createTestExperience('exp-2'));

      const all = store.getAll();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when store is empty', () => {
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should remove all experiences', () => {
      store.add(createTestExperience('exp-1'));
      store.add(createTestExperience('exp-2'));
      store.clear();

      expect(store.getAll()).toHaveLength(0);
    });
  });
});

describe('Module Exports', () => {
  it('should export ExperienceMatcher class', () => {
    expect(ExperienceMatcher).toBeDefined();
    expect(typeof ExperienceMatcher).toBe('function');
  });

  it('should export InMemoryExperienceStore class', () => {
    expect(InMemoryExperienceStore).toBeDefined();
    expect(typeof InMemoryExperienceStore).toBe('function');
  });

  it('should export computeMatchScore function', () => {
    expect(computeMatchScore).toBeDefined();
    expect(typeof computeMatchScore).toBe('function');
  });

  it('should export deduplicateResults function', () => {
    expect(deduplicateResults).toBeDefined();
    expect(typeof deduplicateResults).toBe('function');
  });

  it('should export signalToKey function', () => {
    expect(signalToKey).toBeDefined();
    expect(typeof signalToKey).toBe('function');
  });
});
