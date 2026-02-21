/**
 * Unit tests for Signal Extraction Module
 *
 * Tests cover:
 * - Error signature normalization (AC-SIG-001, AC-SIG-005)
 * - Keyword extraction (AC-SIG-002)
 * - Hash generation (AC-SIG-003)
 * - Signal structure (AC-SIG-004)
 * - Performance (AC-SIG-006)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalExtractor,
  normalizeErrorSignature,
  generateStableHash,
  type Signal,
  type ExtractionResult,
} from '../index';

describe('SignalExtractor', () => {
  let extractor: SignalExtractor;

  beforeEach(() => {
    extractor = new SignalExtractor();
  });

  describe('normalizeErrorSignature', () => {
    it('should normalize Windows paths', () => {
      const input = 'Error at C:\\Users\\test\\project\\file.js:123';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('error at <path>');
    });

    it('should normalize Unix paths', () => {
      const input = 'Error at /usr/local/lib/app.js:45';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('error at <path>');
    });

    it('should normalize hex values', () => {
      const input = 'Error 0x1a2b3c4d at line 42';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('error <hex> at line <n>');
    });

    it('should normalize line numbers', () => {
      const input = 'Failed at line 123 in module';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('failed at line <n> in module');
    });

    it('should normalize UUIDs', () => {
      const input = 'Request 550e8400-e29b-41d4-a716-446655440000 failed';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('request <uuid> failed');
    });

    it('should normalize IP addresses', () => {
      const input = 'Connection to 192.168.1.100 failed';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('connection to <ip> failed');
    });

    it('should normalize timestamps', () => {
      const input = 'Error at 2024-01-15T10:30:45 in service';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('error at <time> in service');
    });

    it('should truncate to 220 characters', () => {
      const longInput = 'Error: ' + 'a'.repeat(300);
      const result = normalizeErrorSignature(longInput);
      expect(result.length).toBeLessThanOrEqual(220);
    });

    it('should collapse multiple spaces', () => {
      const input = 'Error   with    multiple     spaces';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('error with multiple spaces');
    });

    it('should handle mixed normalization', () => {
      const input = 'Error at C:\\project\\file.js:123 with code 0xABCDEF from 192.168.1.1';
      const result = normalizeErrorSignature(input);
      expect(result).toBe('error at <path> with code <hex> from <ip>');
    });
  });

  describe('generateStableHash', () => {
    it('should generate consistent hash for same input', () => {
      const input = 'test error message';
      const hash1 = generateStableHash(input);
      const hash2 = generateStableHash(input);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = generateStableHash('error one');
      const hash2 = generateStableHash('error two');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 16-character hex string', () => {
      const hash = generateStableHash('any input');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be case-sensitive', () => {
      const hash1 = generateStableHash('Error');
      const hash2 = generateStableHash('error');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('extractSignals', () => {
    it('should extract keyword signals for TypeError', () => {
      const result = extractor.extractSignals('TypeError: Cannot read property');
      const keywordSignals = result.signals.filter(s => s.type === 'keyword');
      expect(keywordSignals.length).toBeGreaterThan(0);
      expect(keywordSignals.some(s => s.value === 'type_error')).toBe(true);
    });

    it('should extract keyword signals for timeout errors', () => {
      const result = extractor.extractSignals('Request timeout after 30s');
      const keywordSignals = result.signals.filter(s => s.type === 'keyword');
      expect(keywordSignals.some(s => s.value === 'timeout')).toBe(true);
    });

    it('should extract keyword signals for network errors', () => {
      const result = extractor.extractSignals('ECONNREFUSED connection failed');
      const keywordSignals = result.signals.filter(s => s.type === 'keyword');
      expect(keywordSignals.some(s => s.value === 'network_error')).toBe(true);
    });

    it('should extract keyword signals for auth errors', () => {
      const result = extractor.extractSignals('401 Unauthorized access');
      const keywordSignals = result.signals.filter(s => s.type === 'keyword');
      expect(keywordSignals.some(s => s.value === 'auth_error')).toBe(true);
    });

    it('should extract errsig signals with hash', () => {
      const result = extractor.extractSignals('Error: Something failed at line 10');
      const errsigSignals = result.signals.filter(s => s.type === 'errsig');
      expect(errsigSignals.length).toBeGreaterThan(0);
      expect(errsigSignals[0].hash).toBeDefined();
      expect(errsigSignals[0].hash).toHaveLength(16);
    });

    it('should extract opportunity signals', () => {
      const result = extractor.extractSignals('Please add feature to support export');
      const oppSignals = result.signals.filter(s => s.type === 'opportunity');
      expect(oppSignals.length).toBeGreaterThan(0);
    });

    it('should deduplicate signals', () => {
      const result = extractor.extractSignals('TypeError TypeError TypeError');
      const typeErrorSignals = result.signals.filter(
        s => s.type === 'keyword' && s.value === 'type_error'
      );
      expect(typeErrorSignals.length).toBe(1);
    });

    it('should return signals with correct weight range', () => {
      const result = extractor.extractSignals('TypeError error');
      for (const signal of result.signals) {
        expect(signal.weight).toBeGreaterThanOrEqual(0);
        expect(signal.weight).toBeLessThanOrEqual(1.5);
      }
    });

    it('should include normalized_input in result', () => {
      const result = extractor.extractSignals('Error at C:\\test\\file.js:123');
      expect(result.normalized_input).toBeDefined();
      expect(result.normalized_input).not.toContain('C:\\');
    });

    it('should include processing_time_ms in result', () => {
      const result = extractor.extractSignals('Some error text');
      expect(result.processing_time_ms).toBeDefined();
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should extract multiple signal types from complex input', () => {
      const input = `
        TypeError: Cannot read property 'x' of undefined
        at C:\\project\\app.js:123
        Please improve error handling
      `;
      const result = extractor.extractSignals(input);

      const types = new Set(result.signals.map(s => s.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('should add errsig_norm signal', () => {
      const result = extractor.extractSignals('Some input text');
      const normSignals = result.signals.filter(s => s.type === 'errsig_norm');
      expect(normSignals.length).toBe(1);
    });
  });

  describe('Performance (AC-SIG-006)', () => {
    it('should process simple input in under 5ms', () => {
      const input = 'TypeError: Simple error message';
      const result = extractor.extractSignals(input);
      expect(result.processing_time_ms).toBeLessThan(5);
    });

    it('should process complex input in under 5ms', () => {
      const input = `
        Error: Complex error with many details
        at C:\\very\\long\\path\\to\\some\\module\\file.js:12345
        Error code: 0x1A2B3C4D5E6F
        Timestamp: 2024-01-15T10:30:45
        UUID: 550e8400-e29b-41d4-a716-446655440000
        IP: 192.168.1.100
        `.repeat(5);
      const result = extractor.extractSignals(input);
      expect(result.processing_time_ms).toBeLessThan(5);
    });

    it('should handle repeated calls efficiently', () => {
      const inputs = [
        'TypeError: Error 1',
        'Network error ECONNREFUSED',
        'Timeout after 30 seconds',
        'Auth error 401',
        'Null pointer exception',
      ];

      const startTime = performance.now();
      for (const input of inputs) {
        extractor.extractSignals(input);
      }
      const totalTime = performance.now() - startTime;

      // All 5 calls should complete in under 25ms total (5ms each)
      expect(totalTime).toBeLessThan(25);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = extractor.extractSignals('');
      expect(result.signals).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
    });

    it('should handle very long string', () => {
      const input = 'Error: ' + 'x'.repeat(10000);
      const result = extractor.extractSignals(input);
      expect(result.signals).toBeDefined();
    });

    it('should handle special characters', () => {
      const input = 'Error: <script>alert("xss")</script>';
      const result = extractor.extractSignals(input);
      expect(result.signals).toBeDefined();
    });

    it('should handle unicode characters', () => {
      const input = 'Error: \u4e2d\u6587\u9519\u8bef'; // Chinese error message
      const result = extractor.extractSignals(input);
      expect(result.signals).toBeDefined();
    });

    it('should handle multiline stack traces', () => {
      const input = `
        TypeError: Cannot read property 'x' of undefined
            at Object.<anonymous> (C:\\project\\app.js:10:15)
            at Module._compile (internal/modules/cjs/loader.js:1063:30)
            at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)
      `;
      const result = extractor.extractSignals(input);
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });

  describe('Signal Structure (AC-SIG-004)', () => {
    it('should return signals with type property', () => {
      const result = extractor.extractSignals('TypeError');
      for (const signal of result.signals) {
        expect(signal).toHaveProperty('type');
        expect(typeof signal.type).toBe('string');
      }
    });

    it('should return signals with value property', () => {
      const result = extractor.extractSignals('TypeError');
      for (const signal of result.signals) {
        expect(signal).toHaveProperty('value');
        expect(typeof signal.value).toBe('string');
      }
    });

    it('should return signals with weight property', () => {
      const result = extractor.extractSignals('TypeError');
      for (const signal of result.signals) {
        expect(signal).toHaveProperty('weight');
        expect(typeof signal.weight).toBe('number');
      }
    });

    it('should include hash for errsig type signals', () => {
      const result = extractor.extractSignals('Error: Something failed');
      const errsigSignals = result.signals.filter(s => s.type === 'errsig');
      for (const signal of errsigSignals) {
        expect(signal.hash).toBeDefined();
        expect(typeof signal.hash).toBe('string');
      }
    });
  });

  describe('Instance Methods', () => {
    it('should expose normalizeErrorSignature as instance method', () => {
      const result = extractor.normalizeErrorSignature('Error at C:\\test.js:1');
      expect(result).toBe('error at <path>');
    });

    it('should expose generateStableHash as instance method', () => {
      const hash = extractor.generateStableHash('test');
      expect(hash).toHaveLength(16);
    });
  });
});

describe('Module Exports', () => {
  it('should export SignalExtractor class', () => {
    expect(SignalExtractor).toBeDefined();
    expect(typeof SignalExtractor).toBe('function');
  });

  it('should export normalizeErrorSignature function', () => {
    expect(normalizeErrorSignature).toBeDefined();
    expect(typeof normalizeErrorSignature).toBe('function');
  });

  it('should export generateStableHash function', () => {
    expect(generateStableHash).toBeDefined();
    expect(typeof generateStableHash).toBe('function');
  });
});
