/**
 * Tests for Experience Validator Module
 *
 * @module aep/validator/__tests__/validator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExperienceValidator,
  validateTrigger,
  validateSolution,
  validateConfidence,
  validateSignalsMatch,
  validateContext,
  validateBlastRadius,
  generateContentHash,
  createValidationErrorResponse,
  VALIDATION_CONSTANTS,
} from '../index';

describe('ExperienceValidator', () => {
  let validator: ExperienceValidator;

  beforeEach(() => {
    validator = new ExperienceValidator();
  });

  describe('validateTrigger', () => {
    it('AC-VAL-001: should reject trigger shorter than 10 characters', () => {
      const errors = validateTrigger('short');
      expect(errors).toContain('trigger must be at least 10 characters');
    });

    it('AC-VAL-001: should reject trigger longer than 500 characters', () => {
      const longTrigger = 'a'.repeat(501);
      const errors = validateTrigger(longTrigger);
      expect(errors).toContain('trigger must be at most 500 characters');
    });

    it('AC-VAL-001: should accept trigger with valid length [10, 500]', () => {
      const validTrigger = 'This is a valid trigger description';
      const errors = validateTrigger(validTrigger);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty trigger', () => {
      const errors = validateTrigger('');
      expect(errors).toContain('trigger is required');
    });

    it('should reject null/undefined trigger', () => {
      const errors = validateTrigger(null as unknown as string);
      expect(errors).toContain('trigger is required');
    });

    it('should accept trigger with exactly 10 characters', () => {
      const minTrigger = '0123456789';
      const errors = validateTrigger(minTrigger);
      expect(errors).toHaveLength(0);
    });

    it('should accept trigger with exactly 500 characters', () => {
      const maxTrigger = 'a'.repeat(500);
      const errors = validateTrigger(maxTrigger);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateSolution', () => {
    it('AC-VAL-002: should reject solution shorter than 20 characters', () => {
      const errors = validateSolution('too short');
      expect(errors).toContain('solution must be at least 20 characters');
    });

    it('AC-VAL-002: should reject solution longer than 10000 characters', () => {
      const longSolution = 'a'.repeat(10001);
      const errors = validateSolution(longSolution);
      expect(errors).toContain('solution must be at most 10000 characters');
    });

    it('AC-VAL-002: should accept solution with valid length [20, 10000]', () => {
      const validSolution = 'This is a valid solution description that helps resolve the issue.';
      const errors = validateSolution(validSolution);
      expect(errors).toHaveLength(0);
    });

    it('AC-VAL-008: should detect script-injection attempts with <script> tag', () => {
      const maliciousSolution = 'This is a solution<script>alert("xss")</script>';
      const errors = validateSolution(maliciousSolution);
      expect(errors).toContain('solution contains potentially unsafe content');
    });

    it('AC-VAL-008: should detect javascript: URLs', () => {
      const maliciousSolution = 'Click here: javascript:alert("xss") for the solution.';
      const errors = validateSolution(maliciousSolution);
      expect(errors).toContain('solution contains potentially unsafe content');
    });

    it('AC-VAL-008: should detect event handlers (onclick, etc.)', () => {
      const maliciousSolution = 'Solution with onclick="doSomething()" attribute';
      const errors = validateSolution(maliciousSolution);
      expect(errors).toContain('solution contains potentially unsafe content');
    });

    it('AC-VAL-008: should detect data:text/html URLs', () => {
      const maliciousSolution = 'Link: data:text/html,<script>alert(1)</script> for solution.';
      const errors = validateSolution(maliciousSolution);
      expect(errors).toContain('solution contains potentially unsafe content');
    });

    it('should reject empty solution', () => {
      const errors = validateSolution('');
      expect(errors).toContain('solution is required');
    });

    it('should accept solution with exactly 20 characters', () => {
      const minSolution = '01234567890123456789';
      const errors = validateSolution(minSolution);
      expect(errors).toHaveLength(0);
    });

    it('should accept solution with exactly 10000 characters', () => {
      const maxSolution = 'a'.repeat(10000);
      const errors = validateSolution(maxSolution);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateConfidence', () => {
    it('AC-VAL-003: should reject confidence below 0.0', () => {
      const errors = validateConfidence(-0.1);
      expect(errors).toContain('confidence must be between 0.0 and 1.0');
    });

    it('AC-VAL-003: should reject confidence above 1.0', () => {
      const errors = validateConfidence(1.1);
      expect(errors).toContain('confidence must be between 0.0 and 1.0');
    });

    it('AC-VAL-003: should accept confidence in range [0.0, 1.0]', () => {
      const validValues = [0.0, 0.5, 0.75, 1.0];
      for (const val of validValues) {
        const errors = validateConfidence(val);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject NaN', () => {
      const errors = validateConfidence(NaN);
      expect(errors).toContain('confidence must be a number');
    });

    it('should reject non-numeric values', () => {
      const errors = validateConfidence('high' as unknown as number);
      expect(errors).toContain('confidence must be a number');
    });
  });

  describe('validateSignalsMatch', () => {
    it('AC-VAL-004: should reject signals_match with more than 20 items', () => {
      const tooManySignals = Array(21).fill('signal');
      const errors = validateSignalsMatch(tooManySignals);
      expect(errors).toContain('signals_match must have at most 20 items');
    });

    it('AC-VAL-004: should accept signals_match with up to 20 items', () => {
      const validSignals = Array(20).fill('valid_signal');
      const errors = validateSignalsMatch(validSignals);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array signals_match', () => {
      const errors = validateSignalsMatch({ not: 'array' });
      expect(errors).toContain('signals_match must be an array');
    });

    it('should reject empty strings in signals', () => {
      const signals = ['valid', '', 'also_valid'];
      const errors = validateSignalsMatch(signals);
      expect(errors).toContain('signals_match[1] cannot be empty');
    });

    it('should reject non-string items in signals', () => {
      const signals = ['valid', 123, 'also_valid'];
      const errors = validateSignalsMatch(signals);
      expect(errors).toContain('signals_match[1] must be a string');
    });

    it('should accept undefined/null signals_match', () => {
      expect(validateSignalsMatch(undefined)).toHaveLength(0);
      expect(validateSignalsMatch(null)).toHaveLength(0);
    });
  });

  describe('validateContext', () => {
    it('AC-VAL-006: should reject context with more than 10 keys', () => {
      const tooManyKeys: Record<string, string> = {};
      for (let i = 0; i < 11; i++) {
        tooManyKeys[`key${i}`] = `value${i}`;
      }
      const errors = validateContext(tooManyKeys);
      expect(errors).toContain('context must have at most 10 keys');
    });

    it('AC-VAL-006: should accept context with up to 10 keys', () => {
      const validContext: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        validContext[`key${i}`] = `value${i}`;
      }
      const errors = validateContext(validContext);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-object context', () => {
      const errors = validateContext('string');
      expect(errors).toContain('context must be an object');
    });

    it('should reject array context', () => {
      const errors = validateContext(['item1', 'item2']);
      expect(errors).toContain('context must be an object');
    });

    it('should accept undefined/null context', () => {
      expect(validateContext(undefined)).toHaveLength(0);
      expect(validateContext(null)).toHaveLength(0);
    });
  });

  describe('validateBlastRadius', () => {
    it('AC-VAL-007: should require files field', () => {
      const blastRadius = { lines: 100 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toContain("blast_radius must contain 'files' field");
    });

    it('AC-VAL-007: should require lines field', () => {
      const blastRadius = { files: 5 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toContain("blast_radius must contain 'lines' field");
    });

    it('AC-VAL-007: should accept valid blast_radius with non-negative integers', () => {
      const validBlastRadius = { files: 3, lines: 50 };
      const errors = validateBlastRadius(validBlastRadius);
      expect(errors).toHaveLength(0);
    });

    it('AC-VAL-007: should reject negative files', () => {
      const blastRadius = { files: -1, lines: 50 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toContain('blast_radius.files must be a non-negative integer');
    });

    it('AC-VAL-007: should reject negative lines', () => {
      const blastRadius = { files: 5, lines: -10 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toContain('blast_radius.lines must be a non-negative integer');
    });

    it('AC-VAL-007: should reject non-integer files', () => {
      const blastRadius = { files: 3.5, lines: 50 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toContain('blast_radius.files must be a non-negative integer');
    });

    it('AC-VAL-007: should reject non-integer lines', () => {
      const blastRadius = { files: 5, lines: 50.5 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toContain('blast_radius.lines must be a non-negative integer');
    });

    it('should accept zero values', () => {
      const blastRadius = { files: 0, lines: 0 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-object blast_radius', () => {
      const errors = validateBlastRadius('invalid');
      expect(errors).toContain('blast_radius must be an object');
    });

    it('should accept undefined/null blast_radius', () => {
      expect(validateBlastRadius(undefined)).toHaveLength(0);
      expect(validateBlastRadius(null)).toHaveLength(0);
    });
  });

  describe('generateContentHash', () => {
    it('AC-VAL-009: should generate consistent hash for same content', () => {
      const hash1 = generateContentHash('trigger', 'solution');
      const hash2 = generateContentHash('trigger', 'solution');
      expect(hash1).toBe(hash2);
    });

    it('AC-VAL-009: should generate different hashes for different content', () => {
      const hash1 = generateContentHash('trigger1', 'solution');
      const hash2 = generateContentHash('trigger2', 'solution');
      expect(hash1).not.toBe(hash2);
    });

    it('AC-VAL-009: should normalize content (case-insensitive)', () => {
      const hash1 = generateContentHash('Trigger', 'Solution');
      const hash2 = generateContentHash('trigger', 'solution');
      expect(hash1).toBe(hash2);
    });

    it('AC-VAL-009: should normalize whitespace', () => {
      const hash1 = generateContentHash('trigger  text', 'solution  text');
      const hash2 = generateContentHash('trigger text', 'solution text');
      expect(hash1).toBe(hash2);
    });

    it('should return SHA-256 hash (64 hex characters)', () => {
      const hash = generateContentHash('trigger', 'solution');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('validatePublishRequest', () => {
    it('should reject request without payload', async () => {
      const result = await validator.validatePublishRequest({} as any);
      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('request payload is required');
    });

    it('should reject request with null payload', async () => {
      const result = await validator.validatePublishRequest({ payload: null } as any);
      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('request payload is required');
    });

    it('should accept valid publish request', async () => {
      const request = {
        payload: {
          trigger: 'This is a valid trigger description',
          solution: 'This is a valid solution that resolves the issue completely.',
          confidence: 0.85,
        },
      };
      const result = await validator.validatePublishRequest(request);
      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', async () => {
      const request = {
        payload: {
          trigger: 'short', // too short
          solution: 'too short', // too short
          confidence: 2.0, // out of range
        },
      };
      const result = await validator.validatePublishRequest(request);
      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should validate optional signals_match', async () => {
      const request = {
        payload: {
          trigger: 'This is a valid trigger description',
          solution: 'This is a valid solution that resolves the issue.',
          confidence: 0.85,
          signals_match: Array(21).fill('signal'), // too many
        },
      };
      const result = await validator.validatePublishRequest(request);
      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('signals_match must have at most 20 items');
    });

    it('should validate optional context', async () => {
      const context: Record<string, string> = {};
      for (let i = 0; i < 11; i++) {
        context[`key${i}`] = `value${i}`;
      }
      const request = {
        payload: {
          trigger: 'This is a valid trigger description',
          solution: 'This is a valid solution that resolves the issue.',
          confidence: 0.85,
          context,
        },
      };
      const result = await validator.validatePublishRequest(request);
      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('context must have at most 10 keys');
    });

    it('should validate optional blast_radius', async () => {
      const request = {
        payload: {
          trigger: 'This is a valid trigger description',
          solution: 'This is a valid solution that resolves the issue.',
          confidence: 0.85,
          blast_radius: { files: -1 }, // invalid
        },
      };
      const result = await validator.validatePublishRequest(request);
      expect(result.is_valid).toBe(false);
    });
  });

  describe('validateGeneReference (async)', () => {
    it('AC-VAL-005: should accept undefined/null gene', async () => {
      const validatorWithLookup = new ExperienceValidator({
        geneLookup: async () => false,
      });

      const errorsUndefined = await validatorWithLookup.validateGeneReference(undefined);
      expect(errorsUndefined).toHaveLength(0);

      const errorsNull = await validatorWithLookup.validateGeneReference(null);
      expect(errorsNull).toHaveLength(0);
    });

    it('AC-VAL-005: should accept gene that exists', async () => {
      const validatorWithLookup = new ExperienceValidator({
        geneLookup: async (id: string) => id === 'gene_123',
      });

      const errors = await validatorWithLookup.validateGeneReference('gene_123');
      expect(errors).toHaveLength(0);
    });

    it('AC-VAL-005: should reject gene that does not exist', async () => {
      const validatorWithLookup = new ExperienceValidator({
        geneLookup: async (id: string) => id === 'gene_123',
      });

      const errors = await validatorWithLookup.validateGeneReference('nonexistent');
      expect(errors).toContain("gene 'nonexistent' does not exist");
    });

    it('should reject non-string gene', async () => {
      const errors = await validator.validateGeneReference(123 as any);
      expect(errors).toContain('gene must be a string');
    });

    it('should reject empty gene string', async () => {
      const errors = await validator.validateGeneReference('');
      expect(errors).toContain('gene cannot be empty');
    });
  });

  describe('checkDuplicate (async)', () => {
    it('AC-VAL-009: should return null when no duplicate found', async () => {
      const validatorWithLookup = new ExperienceValidator({
        experienceLookup: async () => null,
      });

      const duplicateId = await validatorWithLookup.checkDuplicate('trigger', 'solution');
      expect(duplicateId).toBeNull();
    });

    it('AC-VAL-009: should return experience ID when duplicate found', async () => {
      const validatorWithLookup = new ExperienceValidator({
        experienceLookup: async () => 'exp_123',
      });

      const duplicateId = await validatorWithLookup.checkDuplicate('trigger', 'solution');
      expect(duplicateId).toBe('exp_123');
    });

    it('should add warning for duplicate experience', async () => {
      const validatorWithLookup = new ExperienceValidator({
        experienceLookup: async () => 'exp_123',
      });

      const request = {
        payload: {
          trigger: 'This is a valid trigger description',
          solution: 'This is a valid solution that resolves the issue.',
          confidence: 0.85,
        },
      };
      const result = await validatorWithLookup.validatePublishRequest(request);
      expect(result.warnings).toContain('Duplicate experience exists: exp_123');
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should group errors by field', () => {
      const errors = [
        'trigger must be at least 10 characters',
        'solution must be at least 20 characters',
        'trigger contains invalid characters',
      ];
      const response = createValidationErrorResponse(errors);

      expect(response.error).toBe('validation_error');
      expect(response.message).toBe('Validation failed');
      expect(response.field_errors.trigger).toHaveLength(2);
      expect(response.field_errors.solution).toHaveLength(1);
    });

    it('should include warnings', () => {
      const response = createValidationErrorResponse(
        ['trigger is required'],
        ['Duplicate experience exists: exp_123']
      );
      expect(response.warnings).toContain('Duplicate experience exists: exp_123');
    });

    it('should handle empty errors', () => {
      const response = createValidationErrorResponse([]);
      expect(response.field_errors).toEqual({});
    });
  });

  describe('Performance', () => {
    it('should complete validation within 5ms', async () => {
      const request = {
        payload: {
          trigger: 'This is a valid trigger description',
          solution: 'This is a valid solution that resolves the issue completely.',
          confidence: 0.85,
          signals_match: ['signal1', 'signal2', 'signal3'],
          context: { key1: 'value1', key2: 'value2' },
          blast_radius: { files: 5, lines: 100 },
        },
      };

      const start = performance.now();
      await validator.validatePublishRequest(request);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trigger with only whitespace', () => {
      const errors = validateTrigger('          ');
      // Should pass length check but be considered valid content-wise
      expect(errors).not.toContain('trigger must be at least 10 characters');
    });

    it('should handle solution with unicode characters', () => {
      const unicodeSolution = 'This is a solution with unicode: 你好世界 🎉 こんにちは';
      const errors = validateSolution(unicodeSolution);
      expect(errors).toHaveLength(0);
    });

    it('should handle blast_radius with zero values', () => {
      const blastRadius = { files: 0, lines: 0 };
      const errors = validateBlastRadius(blastRadius);
      expect(errors).toHaveLength(0);
    });

    it('should handle confidence at boundaries', () => {
      expect(validateConfidence(0.0)).toHaveLength(0);
      expect(validateConfidence(1.0)).toHaveLength(0);
    });

    it('should handle very long signals_match values', () => {
      const signals = Array(20).fill('a'.repeat(1000)); // Long strings
      const errors = validateSignalsMatch(signals);
      expect(errors).toHaveLength(0);
    });
  });
});
