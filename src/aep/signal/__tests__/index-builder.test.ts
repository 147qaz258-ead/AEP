/**
 * Unit tests for Signal Index Builder Module
 *
 * Tests cover:
 * - AC-IDX-001: Creates inverted index entries for signal-to-experience mapping
 * - AC-IDX-002: Supports multiple signals per experience
 * - AC-IDX-003: Stores signal weight for ranking
 * - AC-IDX-004: Supports bulk index rebuild for all experiences
 * - AC-IDX-005: Supports incremental index for new experiences
 * - AC-IDX-006: Removes index entries when experience is deprecated
 * - AC-IDX-007: Query by signal returns all matching experience IDs
 * - AC-IDX-008: Multi-signal query returns combined results
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalIndexBuilder,
  SignalIndexQuerier,
  makeSignalKey,
  makeSignalKeyFromString,
  createSignalIndexBuilder,
  createSignalIndexQuerier,
  signalIndexBuilder,
  signalIndexQuerier,
  type IndexEntry,
  type IndexableExperience,
  type IndexStats,
} from '../index-builder';
import type { Signal } from '../index';

describe('makeSignalKey', () => {
  it('should create normalized signal key from signal', () => {
    const signal: Signal = { type: 'keyword', value: 'TypeError', weight: 1.0 };
    const key = makeSignalKey(signal);
    expect(key).toBe('keyword:typeerror');
  });

  it('should convert value to lowercase', () => {
    const signal: Signal = { type: 'errsig', value: 'Error: TEST', weight: 1.5 };
    const key = makeSignalKey(signal);
    expect(key).toBe('errsig:error: test');
  });

  it('should handle all signal types', () => {
    const types = ['keyword', 'errsig', 'errsig_norm', 'opportunity', 'context', 'semantic'];
    for (const type of types) {
      const signal: Signal = { type: type as any, value: 'test', weight: 1.0 };
      const key = makeSignalKey(signal);
      expect(key).toBe(`${type}:test`);
    }
  });
});

describe('makeSignalKeyFromString', () => {
  it('should use default type when no colon in string', () => {
    const key = makeSignalKeyFromString('TypeError');
    expect(key).toBe('keyword:typeerror');
  });

  it('should preserve existing type:value format', () => {
    const key = makeSignalKeyFromString('errsig:test value');
    expect(key).toBe('errsig:test value');
  });

  it('should convert to lowercase', () => {
    const key = makeSignalKeyFromString('TYPEERROR');
    expect(key).toBe('keyword:typeerror');
  });

  it('should allow custom default type', () => {
    const key = makeSignalKeyFromString('test', 'errsig');
    expect(key).toBe('errsig:test');
  });
});

describe('SignalIndexBuilder', () => {
  let builder: SignalIndexBuilder;

  beforeEach(() => {
    builder = new SignalIndexBuilder();
  });

  describe('AC-IDX-001: Creates inverted index entries', () => {
    it('should create index entry for single signal', () => {
      const signals: Signal[] = [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ];

      builder.indexExperience('exp-001', signals);

      const entries = builder.getEntries('keyword:TypeError');
      expect(entries).toHaveLength(1);
      expect(entries[0].experience_id).toBe('exp-001');
      expect(entries[0].weight).toBe(1.0);
    });

    it('should create index entries with correct structure', () => {
      const signals: Signal[] = [
        { type: 'errsig', value: 'error at <path>', weight: 1.5 },
      ];

      builder.indexExperience('exp-002', signals);

      const entries = builder.getEntries('errsig:error at <path>');
      const entry = entries[0];

      expect(entry.signal_key).toBe('errsig:error at <path>');
      expect(entry.experience_id).toBe('exp-002');
      expect(entry.weight).toBe(1.5);
      expect(entry.created_at).toBeInstanceOf(Date);
    });

    it('should handle case-insensitive signal lookup', () => {
      const signals: Signal[] = [
        { type: 'keyword', value: 'TYPEERROR', weight: 1.0 },
      ];

      builder.indexExperience('exp-001', signals);

      // Should find with lowercase query
      const entries = builder.getEntries('keyword:typeerror');
      expect(entries).toHaveLength(1);
    });
  });

  describe('AC-IDX-002: Supports multiple signals per experience', () => {
    it('should index multiple signals for single experience', () => {
      const signals: Signal[] = [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
        { type: 'keyword', value: 'network_error', weight: 1.0 },
        { type: 'errsig', value: 'connection refused', weight: 1.5 },
      ];

      builder.indexExperience('exp-001', signals);

      expect(builder.getEntries('keyword:typeerror')).toHaveLength(1);
      expect(builder.getEntries('keyword:network_error')).toHaveLength(1);
      expect(builder.getEntries('errsig:connection refused')).toHaveLength(1);
    });

    it('should map same signal to multiple experiences', () => {
      const signal: Signal = { type: 'keyword', value: 'TypeError', weight: 1.0 };

      builder.indexExperience('exp-001', [signal]);
      builder.indexExperience('exp-002', [signal]);
      builder.indexExperience('exp-003', [signal]);

      const entries = builder.getEntries('keyword:typeerror');
      expect(entries).toHaveLength(3);

      const ids = entries.map((e) => e.experience_id);
      expect(ids).toContain('exp-001');
      expect(ids).toContain('exp-002');
      expect(ids).toContain('exp-003');
    });
  });

  describe('AC-IDX-003: Stores signal weight for ranking', () => {
    it('should store weight for each entry', () => {
      const signals: Signal[] = [
        { type: 'keyword', value: 'error1', weight: 0.8 },
        { type: 'errsig', value: 'error2', weight: 1.5 },
        { type: 'opportunity', value: 'error3', weight: 0.5 },
      ];

      builder.indexExperience('exp-001', signals);

      expect(builder.getEntries('keyword:error1')[0].weight).toBe(0.8);
      expect(builder.getEntries('errsig:error2')[0].weight).toBe(1.5);
      expect(builder.getEntries('opportunity:error3')[0].weight).toBe(0.5);
    });

    it('should update weight if experience is re-indexed', () => {
      const signal: Signal = { type: 'keyword', value: 'TypeError', weight: 1.0 };
      builder.indexExperience('exp-001', [signal]);

      // Re-index with different weight
      const updatedSignal: Signal = { type: 'keyword', value: 'TypeError', weight: 1.5 };
      builder.indexExperience('exp-001', [updatedSignal]);

      const entries = builder.getEntries('keyword:typeerror');
      expect(entries).toHaveLength(1);
      expect(entries[0].weight).toBe(1.5);
    });

    it('should use updateWeight method', () => {
      const signal: Signal = { type: 'keyword', value: 'TypeError', weight: 1.0 };
      builder.indexExperience('exp-001', [signal]);

      builder.updateWeight('keyword:TypeError', 'exp-001', 1.5);

      const entries = builder.getEntries('keyword:typeerror');
      expect(entries[0].weight).toBe(1.5);
    });
  });

  describe('AC-IDX-004: Supports bulk index rebuild', () => {
    it('should index multiple experiences in batch', () => {
      const experiences: IndexableExperience[] = [
        {
          id: 'exp-001',
          signals_match: ['keyword:TypeError', 'keyword:network_error'],
        },
        {
          id: 'exp-002',
          signals_match: ['keyword:SyntaxError'],
        },
        {
          id: 'exp-003',
          signals_match: ['errsig:connection timeout'],
        },
      ];

      const count = builder.indexBatch(experiences);

      expect(count).toBe(3);
      expect(builder.getEntries('keyword:typeerror')).toHaveLength(1);
      expect(builder.getEntries('keyword:network_error')).toHaveLength(1);
      expect(builder.getEntries('keyword:syntaxerror')).toHaveLength(1);
      expect(builder.getEntries('errsig:connection timeout')).toHaveLength(1);
    });

    it('should skip deprecated experiences during batch index', () => {
      const experiences: IndexableExperience[] = [
        {
          id: 'exp-001',
          signals_match: ['keyword:TypeError'],
          status: 'promoted',
        },
        {
          id: 'exp-002',
          signals_match: ['keyword:SyntaxError'],
          status: 'deprecated',
        },
        {
          id: 'exp-003',
          signals_match: ['keyword:RangeError'],
          status: 'candidate',
        },
      ];

      const count = builder.indexBatch(experiences);

      expect(count).toBe(2);
      expect(builder.getEntries('keyword:typeerror')).toHaveLength(1);
      expect(builder.getEntries('keyword:syntaxerror')).toHaveLength(0);
      expect(builder.getEntries('keyword:rangeerror')).toHaveLength(1);
    });

    it('should rebuild index from scratch', () => {
      // Initial index
      builder.indexExperience('exp-old', [
        { type: 'keyword', value: 'OldError', weight: 1.0 },
      ]);

      // Rebuild with new experiences
      const experiences: IndexableExperience[] = [
        {
          id: 'exp-001',
          signals_match: ['keyword:TypeError'],
        },
        {
          id: 'exp-002',
          signals_match: ['keyword:SyntaxError'],
        },
      ];

      const count = builder.rebuildIndex(experiences);

      expect(count).toBe(2);
      expect(builder.getEntries('keyword:olderror')).toHaveLength(0);
      expect(builder.getEntries('keyword:typeerror')).toHaveLength(1);
      expect(builder.getEntries('keyword:syntaxerror')).toHaveLength(1);
    });
  });

  describe('AC-IDX-005: Supports incremental index', () => {
    it('should add new experience to existing index', () => {
      // Initial batch
      builder.indexBatch([
        { id: 'exp-001', signals_match: ['keyword:TypeError'] },
      ]);

      // Incremental add
      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'SyntaxError', weight: 1.0 },
      ]);

      expect(builder.getEntries('keyword:typeerror')).toHaveLength(1);
      expect(builder.getEntries('keyword:syntaxerror')).toHaveLength(1);
    });

    it('should preserve existing entries when adding new', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'TypeError', weight: 1.5 },
      ]);

      const entries = builder.getEntries('keyword:typeerror');
      expect(entries).toHaveLength(2);
    });
  });

  describe('AC-IDX-006: Removes index entries', () => {
    it('should remove all entries for an experience', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
        { type: 'keyword', value: 'network_error', weight: 1.0 },
        { type: 'errsig', value: 'connection refused', weight: 1.5 },
      ]);

      const removed = builder.removeExperience('exp-001');

      expect(removed).toBe(3);
      expect(builder.getEntries('keyword:typeerror')).toHaveLength(0);
      expect(builder.getEntries('keyword:network_error')).toHaveLength(0);
      expect(builder.getEntries('errsig:connection refused')).toHaveLength(0);
    });

    it('should return 0 if experience not found', () => {
      const removed = builder.removeExperience('nonexistent');
      expect(removed).toBe(0);
    });

    it('should not affect other experiences when removing', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);
      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      builder.removeExperience('exp-001');

      const entries = builder.getEntries('keyword:typeerror');
      expect(entries).toHaveLength(1);
      expect(entries[0].experience_id).toBe('exp-002');
    });

    it('should clean up empty signal keys', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'UniqueError', weight: 1.0 },
      ]);

      builder.removeExperience('exp-001');

      expect(builder.hasSignal('keyword:uniqueerror')).toBe(false);
    });
  });

  describe('Utility methods', () => {
    it('should check if signal exists', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      expect(builder.hasSignal('keyword:TypeError')).toBe(true);
      expect(builder.hasSignal('keyword:nonexistent')).toBe(false);
    });

    it('should get all signal keys', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
        { type: 'keyword', value: 'SyntaxError', weight: 1.0 },
      ]);

      const keys = builder.getAllSignalKeys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('keyword:typeerror');
      expect(keys).toContain('keyword:syntaxerror');
    });

    it('should clear entire index', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      builder.clear();

      expect(builder.getEntries('keyword:typeerror')).toHaveLength(0);
      expect(builder.getAllSignalKeys()).toHaveLength(0);
    });
  });

  describe('String signal parsing', () => {
    it('should parse "type:value" format strings', () => {
      const experiences: IndexableExperience[] = [
        {
          id: 'exp-001',
          signals_match: ['keyword:TypeError', 'errsig:connection failed'],
        },
      ];

      builder.indexBatch(experiences);

      expect(builder.getEntries('keyword:typeerror')).toHaveLength(1);
      expect(builder.getEntries('errsig:connection failed')).toHaveLength(1);
    });

    it('should parse plain value strings with default type', () => {
      const experiences: IndexableExperience[] = [
        {
          id: 'exp-001',
          signals_match: ['TypeError', 'SyntaxError'],
        },
      ];

      builder.indexBatch(experiences);

      expect(builder.getEntries('keyword:typeerror')).toHaveLength(1);
      expect(builder.getEntries('keyword:syntaxerror')).toHaveLength(1);
    });
  });
});

describe('SignalIndexQuerier', () => {
  let builder: SignalIndexBuilder;
  let querier: SignalIndexQuerier;

  beforeEach(() => {
    builder = new SignalIndexBuilder();
    querier = new SignalIndexQuerier(builder);
  });

  describe('AC-IDX-007: Query by signal returns all matching IDs', () => {
    it('should return experience IDs for matching signal', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);
      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      const results = querier.query('keyword:TypeError');

      expect(results).toHaveLength(2);
      expect(results).toContain('exp-001');
      expect(results).toContain('exp-002');
    });

    it('should return empty array for non-existent signal', () => {
      const results = querier.query('keyword:nonexistent');
      expect(results).toEqual([]);
    });

    it('should return results sorted by weight descending', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 0.5 },
      ]);
      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'TypeError', weight: 1.5 },
      ]);
      builder.indexExperience('exp-003', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      const results = querier.query('keyword:TypeError');

      expect(results).toEqual(['exp-002', 'exp-003', 'exp-001']);
    });

    it('should handle case-insensitive query', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      const results = querier.query('KEYWORD:TYPEERROR');
      expect(results).toEqual(['exp-001']);
    });
  });

  describe('AC-IDX-008: Multi-signal query returns combined results', () => {
    it('should return unique experience IDs from multiple signals', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);
      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'SyntaxError', weight: 1.0 },
      ]);
      builder.indexExperience('exp-003', [
        { type: 'keyword', value: 'RangeError', weight: 1.0 },
      ]);

      const results = querier.multiQuery([
        'keyword:TypeError',
        'keyword:SyntaxError',
      ]);

      expect(results).toHaveLength(2);
      expect(results).toContain('exp-001');
      expect(results).toContain('exp-002');
      expect(results).not.toContain('exp-003');
    });

    it('should return empty array for empty signal list', () => {
      const results = querier.multiQuery([]);
      expect(results).toEqual([]);
    });

    it('should rank by combined weight when experience matches multiple signals', () => {
      // exp-001 matches both signals
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
        { type: 'keyword', value: 'network_error', weight: 1.0 },
      ]);
      // exp-002 matches only one signal
      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'TypeError', weight: 1.5 },
      ]);

      const results = querier.multiQuery([
        'keyword:TypeError',
        'keyword:network_error',
      ]);

      // exp-001 has combined weight 2.0, exp-002 has weight 1.5
      expect(results).toEqual(['exp-001', 'exp-002']);
    });

    it('should handle experiences matching same signal multiple times', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      const results = querier.multiQuery([
        'keyword:TypeError',
        'keyword:TypeError', // duplicate
      ]);

      // Should still only return each experience once
      expect(results).toEqual(['exp-001']);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      builder.indexExperience('exp-001', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
        { type: 'keyword', value: 'network_error', weight: 1.0 },
      ]);
      builder.indexExperience('exp-002', [
        { type: 'keyword', value: 'TypeError', weight: 1.0 },
      ]);

      const stats = querier.getStats();

      expect(stats.total_entries).toBe(3); // 2 + 1 entries
      expect(stats.unique_signals).toBe(2); // TypeError, network_error
      expect(stats.indexed_experiences).toBe(2);
    });

    it('should return zero stats for empty index', () => {
      const stats = querier.getStats();

      expect(stats.total_entries).toBe(0);
      expect(stats.unique_signals).toBe(0);
      expect(stats.indexed_experiences).toBe(0);
    });
  });

  describe('getBuilder', () => {
    it('should return the underlying builder', () => {
      const returnedBuilder = querier.getBuilder();
      expect(returnedBuilder).toBe(builder);
    });
  });
});

describe('Factory Functions', () => {
  it('should create builder with createSignalIndexBuilder', () => {
    const builder = createSignalIndexBuilder();
    expect(builder).toBeInstanceOf(SignalIndexBuilder);
  });

  it('should create querier with createSignalIndexQuerier', () => {
    const builder = createSignalIndexBuilder();
    const querier = createSignalIndexQuerier(builder);
    expect(querier).toBeInstanceOf(SignalIndexQuerier);
  });
});

describe('Singleton Instances', () => {
  it('should export signalIndexBuilder singleton', () => {
    expect(signalIndexBuilder).toBeInstanceOf(SignalIndexBuilder);
  });

  it('should export signalIndexQuerier singleton', () => {
    expect(signalIndexQuerier).toBeInstanceOf(SignalIndexQuerier);
  });

  it('singleton querier should use singleton builder', () => {
    const stats = signalIndexQuerier.getStats();
    expect(stats).toBeDefined();
  });
});

describe('Integration Tests', () => {
  it('should handle typical workflow', () => {
    const builder = new SignalIndexBuilder();
    const querier = new SignalIndexQuerier(builder);

    // Initial batch index
    const experiences: IndexableExperience[] = [
      {
        id: 'exp-001',
        signals_match: ['keyword:TypeError', 'keyword:network_error'],
        status: 'promoted',
      },
      {
        id: 'exp-002',
        signals_match: ['keyword:TypeError', 'errsig:connection refused'],
        status: 'promoted',
      },
      {
        id: 'exp-003',
        signals_match: ['keyword:SyntaxError'],
        status: 'deprecated',
      },
    ];

    builder.indexBatch(experiences);

    // Query for TypeError
    let results = querier.query('keyword:TypeError');
    expect(results).toHaveLength(2);

    // Multi-signal query
    results = querier.multiQuery(['keyword:TypeError', 'keyword:network_error']);
    expect(results[0]).toBe('exp-001'); // matches both signals

    // Stats
    const stats = querier.getStats();
    expect(stats.indexed_experiences).toBe(2); // deprecated not included

    // Remove experience
    builder.removeExperience('exp-001');
    results = querier.query('keyword:TypeError');
    expect(results).toHaveLength(1);

    // Rebuild
    builder.rebuildIndex([
      {
        id: 'exp-004',
        signals_match: ['keyword:RangeError'],
        status: 'candidate',
      },
    ]);

    expect(querier.query('keyword:RangeError')).toHaveLength(1);
    expect(querier.query('keyword:TypeError')).toHaveLength(0);
  });

  it('should handle signal extraction and indexing workflow', () => {
    const builder = new SignalIndexBuilder();
    const querier = new SignalIndexQuerier(builder);

    // Simulate signals extracted from error text
    const signals: Signal[] = [
      { type: 'keyword', value: 'type_error', weight: 1.0 },
      { type: 'errsig', value: 'error at <path>', weight: 1.5 },
      { type: 'opportunity', value: 'improvement', weight: 0.8 },
    ];

    // Index the experience
    builder.indexExperience('exp-error-001', signals);

    // Query should work
    expect(querier.query('keyword:type_error')).toEqual(['exp-error-001']);
    expect(querier.query('errsig:error at <path>')).toEqual(['exp-error-001']);

    // Multi-query should rank by combined weight
    const results = querier.multiQuery([
      'keyword:type_error',
      'errsig:error at <path>',
    ]);
    expect(results).toEqual(['exp-error-001']);
  });
});

describe('Performance Tests', () => {
  it('should handle large number of experiences', () => {
    const builder = new SignalIndexBuilder();
    const startTime = performance.now();

    // Index 1000 experiences with 5 signals each
    for (let i = 0; i < 1000; i++) {
      const signals: Signal[] = [];
      for (let j = 0; j < 5; j++) {
        signals.push({
          type: 'keyword',
          value: `signal-${j}`,
          weight: 1.0,
        });
      }
      builder.indexExperience(`exp-${i}`, signals);
    }

    const indexTime = performance.now() - startTime;

    // Index should be reasonably fast
    expect(indexTime).toBeLessThan(1000); // 1 second for 1000 experiences

    // Query should be fast
    const queryStart = performance.now();
    const querier = new SignalIndexQuerier(builder);
    const results = querier.query('keyword:signal-0');
    const queryTime = performance.now() - queryStart;

    expect(results).toHaveLength(1000);
    expect(queryTime).toBeLessThan(5); // < 5ms as per spec
  });

  it('should handle multi-signal query efficiently', () => {
    const builder = new SignalIndexBuilder();

    // Index experiences
    for (let i = 0; i < 100; i++) {
      builder.indexExperience(`exp-${i}`, [
        { type: 'keyword', value: `error-${i % 10}`, weight: 1.0 },
      ]);
    }

    const querier = new SignalIndexQuerier(builder);
    const startTime = performance.now();

    // Query with 5 signals
    const results = querier.multiQuery([
      'keyword:error-0',
      'keyword:error-1',
      'keyword:error-2',
      'keyword:error-3',
      'keyword:error-4',
    ]);

    const queryTime = performance.now() - startTime;

    expect(results.length).toBeGreaterThan(0);
    expect(queryTime).toBeLessThan(20); // < 20ms for multi-signal query as per spec
  });
});
