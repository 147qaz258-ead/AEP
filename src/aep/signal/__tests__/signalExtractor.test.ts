/**
 * Unit tests for Signal Extraction Module
 *
 * Tests cover:
 * - Error signature normalization (AC-SIG-001, AC-SIG-005)
 * - Keyword extraction (AC-SIG-002)
 * - Hash generation (AC-SIG-003)
 * - Signal structure (AC-SIG-004)
 * - Performance (AC-SIG-006)
 * - Error Signature Normalizer class (TASK-E-001-SIG-001)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalExtractor,
  ErrorSignatureNormalizer,
  normalizeErrorSignature,
  generateStableHash,
  errorSignatureNormalizer,
  type Signal,
  type ExtractionResult,
  type NormalizationResult,
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

  it('should export ErrorSignatureNormalizer class', () => {
    expect(ErrorSignatureNormalizer).toBeDefined();
    expect(typeof ErrorSignatureNormalizer).toBe('function');
  });

  it('should export errorSignatureNormalizer singleton', () => {
    expect(errorSignatureNormalizer).toBeDefined();
    expect(errorSignatureNormalizer).toBeInstanceOf(ErrorSignatureNormalizer);
  });
});

/**
 * Tests for ErrorSignatureNormalizer class (TASK-E-001-SIG-001)
 *
 * Acceptance Criteria:
 * - AC-NORM-001: Removes Windows paths (C:\...) -> <path>
 * - AC-NORM-002: Removes Unix paths (/...) -> <path>
 * - AC-NORM-003: Removes hex values (0x...) -> <hex>
 * - AC-NORM-004: Removes line numbers -> <n>
 * - AC-NORM-005: Converts to lowercase
 * - AC-NORM-006: Truncates to 220 characters
 * - AC-NORM-007: Generates SHA-256 hash (first 16 chars) for stable identification
 * - AC-NORM-008: Same normalized input always produces same hash
 */
describe('ErrorSignatureNormalizer', () => {
  let normalizer: ErrorSignatureNormalizer;

  beforeEach(() => {
    normalizer = new ErrorSignatureNormalizer();
  });

  describe('NormalizationResult Structure', () => {
    it('should return NormalizationResult with all required fields', () => {
      const result = normalizer.normalize('Error at line 10');

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('normalized');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('transformations');

      expect(typeof result.original).toBe('string');
      expect(typeof result.normalized).toBe('string');
      expect(typeof result.hash).toBe('string');
      expect(Array.isArray(result.transformations)).toBe(true);
    });

    it('should preserve original input', () => {
      const input = 'Error at C:\\Users\\test\\file.js:123';
      const result = normalizer.normalize(input);

      expect(result.original).toBe(input);
    });
  });

  describe('AC-NORM-001: Remove Windows Paths', () => {
    it('should replace Windows absolute paths with <path>', () => {
      const input = 'Error at C:\\Users\\John\\project\\file.js:123';
      const result = normalizer.normalize(input);

      expect(result.normalized).not.toContain('C:');
      expect(result.normalized).not.toContain('Users');
      expect(result.normalized).toContain('<path>');
      expect(result.transformations).toContain('windows_paths:1');
    });

    it('should handle multiple Windows paths', () => {
      const input = 'Error in C:\\project\\src\\a.js and D:\\lib\\b.js';
      const result = normalizer.normalize(input);

      expect(result.transformations).toContain('windows_paths:2');
    });

    it('should handle different drive letters', () => {
      const input = 'Error at D:\\data\\file.txt';
      const result = normalizer.normalize(input);

      expect(result.normalized).toContain('<path>');
      expect(result.normalized).not.toContain('D:');
    });

    it('removeWindowsPaths should return count', () => {
      const result = normalizer.removeWindowsPaths('Error at C:\\test\\a.js and D:\\lib\\b.js');

      expect(result.count).toBe(2);
      expect(result.text).not.toContain('C:');
      expect(result.text).not.toContain('D:');
    });
  });

  describe('AC-NORM-002: Remove Unix Paths', () => {
    it('should replace Unix paths with <path>', () => {
      const input = 'Error at /usr/local/app.js:45';
      const result = normalizer.normalize(input);

      expect(result.normalized).not.toContain('/usr');
      expect(result.normalized).toContain('<path>');
      expect(result.transformations).toContain('unix_paths:1');
    });

    it('should handle multiple Unix paths', () => {
      const input = 'Error in /home/user/src/a.js and /var/lib/b.js';
      const result = normalizer.normalize(input);

      expect(result.transformations).toContain('unix_paths:2');
    });

    it('removeUnixPaths should return count', () => {
      const result = normalizer.removeUnixPaths('Error at /usr/local/a.js and /home/user/b.js');

      expect(result.count).toBe(2);
      expect(result.text).not.toContain('/usr');
      expect(result.text).not.toContain('/home');
    });
  });

  describe('AC-NORM-003: Remove Hex Values', () => {
    it('should replace hex values with <hex>', () => {
      const input = 'Exception with id 0x1a2b3c4d';
      const result = normalizer.normalize(input);

      expect(result.normalized).not.toContain('0x1a2b');
      expect(result.normalized).toContain('<hex>');
      expect(result.transformations).toContain('hex_values:1');
    });

    it('should handle multiple hex values', () => {
      const input = 'Error 0xABCD at address 0x1234 with code 0x5678';
      const result = normalizer.normalize(input);

      expect(result.transformations).toContain('hex_values:3');
    });

    it('should handle uppercase and lowercase hex', () => {
      const input = 'Error 0xABCD and 0xabcd';
      const result = normalizer.normalize(input);

      expect(result.normalized).not.toContain('0x');
    });

    it('removeHexValues should return count', () => {
      const result = normalizer.removeHexValues('Error 0xABCD and 0x1234');

      expect(result.count).toBe(2);
      expect(result.text).not.toContain('0x');
    });
  });

  describe('AC-NORM-004: Remove Line Numbers', () => {
    it('should replace standalone numbers with <n>', () => {
      const input = 'Failed at line 123 in module';
      const result = normalizer.normalize(input);

      expect(result.normalized).not.toMatch(/\b123\b/);
      expect(result.normalized).toContain('<n>');
      expect(result.transformations).toContain('numbers:1');
    });

    it('should handle multiple numbers', () => {
      const input = 'Error 404 at line 123 column 456';
      const result = normalizer.normalize(input);

      expect(result.transformations).toContain('numbers:3');
    });

    it('removeNumbers should return count', () => {
      const result = normalizer.removeNumbers('Error at line 10 and column 20');

      expect(result.count).toBe(2);
      expect(result.text).not.toMatch(/\b\d+\b/);
    });
  });

  describe('AC-NORM-005: Convert to Lowercase', () => {
    it('should convert to lowercase', () => {
      const input = 'TypeError: Cannot Read Property';
      const result = normalizer.normalize(input);

      expect(result.normalized).toBe('typeerror: cannot read property');
      expect(result.transformations).toContain('lowercase');
    });

    it('should track lowercase transformation only when needed', () => {
      const input = 'error message already lowercase';
      const result = normalizer.normalize(input);

      expect(result.transformations).not.toContain('lowercase');
    });
  });

  describe('AC-NORM-006: Truncate to 220 Characters', () => {
    it('should truncate to 220 characters max', () => {
      const input = 'Error: ' + 'x'.repeat(300);
      const result = normalizer.normalize(input);

      expect(result.normalized.length).toBeLessThanOrEqual(220);
      expect(result.transformations).toContain('truncated');
    });

    it('should not truncate short strings', () => {
      const input = 'Short error';
      const result = normalizer.normalize(input);

      expect(result.normalized.length).toBeLessThanOrEqual(220);
      expect(result.transformations).not.toContain('truncated');
    });

    it('should have MAX_LENGTH constant set to 220', () => {
      expect(ErrorSignatureNormalizer.MAX_LENGTH).toBe(220);
    });
  });

  describe('AC-NORM-007: Generate SHA-256 Hash', () => {
    it('should generate 16-character hash', () => {
      const result = normalizer.normalize('Some error');

      expect(result.hash).toHaveLength(16);
    });

    it('should generate hex string', () => {
      const result = normalizer.normalize('Some error');

      expect(result.hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should have HASH_LENGTH constant set to 16', () => {
      expect(ErrorSignatureNormalizer.HASH_LENGTH).toBe(16);
    });

    it('generateHash should return 16-character hex string', () => {
      const hash = normalizer.generateHash('normalized text');

      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('AC-NORM-008: Hash Stability', () => {
    it('should produce same hash for same normalized input', () => {
      const input = 'Error at C:\\test\\file.js:123';

      const result1 = normalizer.normalize(input);
      const result2 = normalizer.normalize(input);

      expect(result1.hash).toBe(result2.hash);
    });

    it('should produce same hash for equivalent inputs (after normalization)', () => {
      // Different paths but same structure -> same normalized -> same hash
      const input1 = 'Error at C:\\path1\\file.js:123';
      const input2 = 'Error at D:\\path2\\file.js:456';

      const result1 = normalizer.normalize(input1);
      const result2 = normalizer.normalize(input2);

      expect(result1.normalized).toBe(result2.normalized);
      expect(result1.hash).toBe(result2.hash);
    });

    it('should produce different hashes for different normalized outputs', () => {
      const input1 = 'TypeError: Cannot read property';
      const input2 = 'SyntaxError: Unexpected token';

      const result1 = normalizer.normalize(input1);
      const result2 = normalizer.normalize(input2);

      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('Integration: Full Normalization Examples', () => {
    it('should handle example from spec: Windows path', () => {
      const input = "Error at C:\\Users\\John\\project\\file.js:123";
      const result = normalizer.normalize(input);

      // Note: The path pattern captures the entire path including :123
      // because there's no space between the path and the line number
      expect(result.normalized).toBe('error at <path>');
      expect(result.hash).toHaveLength(16);
    });

    it('should handle example from spec: TypeError', () => {
      const input = "TypeError: Cannot read property 'foo' of undefined";
      const result = normalizer.normalize(input);

      expect(result.normalized).toBe("typeerror: cannot read property 'foo' of undefined");
    });

    it('should handle example from spec: Unix path with hex', () => {
      const input = "Exception at /usr/local/app.js:45 with id 0x1a2b";
      const result = normalizer.normalize(input);

      // Note: The path pattern captures the entire path including :45
      expect(result.normalized).toBe('exception at <path> with id <hex>');
    });

    it('should handle example from spec: Database connection', () => {
      const input = "Failed to connect to database at localhost:5432";
      const result = normalizer.normalize(input);

      expect(result.normalized).toBe('failed to connect to database at localhost:<n>');
    });

    it('should handle example from spec: Timeout with IP', () => {
      const input = "Timeout after 30000ms waiting for response from 192.168.1.1";
      const result = normalizer.normalize(input);

      // Note: 30000ms is not replaced because it's not a standalone number
      // (it's attached to 'ms'). This is intentional to preserve context.
      expect(result.normalized).toBe('timeout after 30000ms waiting for response from <n>.<n>.<n>.<n>');
    });

    it('should handle mixed normalization with all transformations', () => {
      const input = 'ERROR at C:\\project\\file.js:123 with code 0xABCD from 192.168.1.1';
      const result = normalizer.normalize(input);

      // Note: The path pattern captures the entire path including :123
      expect(result.normalized).toBe('error at <path> with code <hex> from <n>.<n>.<n>.<n>');
      expect(result.transformations).toContain('lowercase');
      expect(result.transformations).toContain('windows_paths:1');
      expect(result.transformations).toContain('hex_values:1');
    });
  });

  describe('Idempotency', () => {
    it('should be idempotent: normalizing twice produces same result', () => {
      const input = 'Error at C:\\test\\file.js:123';

      const result1 = normalizer.normalize(input);
      const result2 = normalizer.normalize(result1.normalized);

      expect(result1.normalized).toBe(result2.normalized);
      expect(result1.hash).toBe(result2.hash);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = normalizer.normalize('');

      expect(result.original).toBe('');
      expect(result.normalized).toBe('');
      expect(result.hash).toBeDefined();
    });

    it('should handle string with only spaces', () => {
      const result = normalizer.normalize('   ');

      expect(result.normalized).toBe('');
    });

    it('should handle very long string', () => {
      const input = 'Error: ' + 'x'.repeat(10000);
      const result = normalizer.normalize(input);

      expect(result.normalized.length).toBeLessThanOrEqual(220);
    });

    it('should handle special characters', () => {
      const input = 'Error: <script>alert("xss")</script>';
      const result = normalizer.normalize(input);

      expect(result.normalized).toBeDefined();
      expect(result.hash).toBeDefined();
    });

    it('should handle unicode characters', () => {
      const input = 'Error: \u4e2d\u6587\u9519\u8bef'; // Chinese error message
      const result = normalizer.normalize(input);

      expect(result.normalized).toBeDefined();
      expect(result.hash).toBeDefined();
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(errorSignatureNormalizer).toBeInstanceOf(ErrorSignatureNormalizer);
    });

    it('singleton should work correctly', () => {
      const result = errorSignatureNormalizer.normalize('Test error');

      expect(result.normalized).toBe('test error');
      expect(result.hash).toBeDefined();
    });
  });
});
