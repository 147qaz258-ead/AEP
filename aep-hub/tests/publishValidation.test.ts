import { describe, it, expect } from 'vitest';
import {
  validatePublishRequest,
  validatePublishAuthorization,
  extractAgentId,
  PUBLISH_CONSTRAINTS,
} from '../src/utils/publishValidation';

describe('Publish Validation Utilities', () => {
  const validPublishRequest = {
    protocol: 'aep',
    version: '1.0.0',
    type: 'publish',
    sender: 'agent_0x1234567890abcdef',
    timestamp: new Date().toISOString(),
    payload: {
      trigger: 'Test trigger with enough length',
      solution: 'Test solution with enough length for validation requirements.',
      confidence: 0.85,
    },
  };

  describe('extractAgentId', () => {
    it('should extract agent ID from Bearer token', () => {
      const result = extractAgentId('Bearer agent_0x123');
      expect(result).toBe('agent_0x123');
    });

    it('should extract agent ID from plain token', () => {
      const result = extractAgentId('agent_0x123');
      expect(result).toBe('agent_0x123');
    });

    it('should return null for undefined header', () => {
      const result = extractAgentId(undefined);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = extractAgentId('');
      expect(result).toBeNull();
    });

    it('should handle whitespace', () => {
      // Leading whitespace is trimmed, then "Bearer " is detected
      const result = extractAgentId('   Bearer agent_0x123');
      expect(result).toBe('agent_0x123');
    });
  });

  describe('validatePublishRequest', () => {
    it('should validate a correct request', () => {
      const result = validatePublishRequest(validPublishRequest);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.request.type).toBe('publish');
        expect(result.request.sender).toBe('agent_0x1234567890abcdef');
      }
    });

    describe('protocol validation', () => {
      it('should reject invalid protocol', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          protocol: 'invalid',
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.error).toBe('invalid_protocol');
        }
      });
    });

    describe('type validation', () => {
      it('should reject invalid type', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          type: 'hello',
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.error).toBe('invalid_type');
        }
      });
    });

    describe('version validation', () => {
      it('should reject invalid version format', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          version: 'invalid',
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.error).toBe('invalid_version');
        }
      });
    });

    describe('sender validation', () => {
      it('should reject missing sender', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          sender: null,
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.error).toBe('missing_field');
        }
      });

      it('should reject empty sender', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          sender: '',
        });
        expect(result.valid).toBe(false);
      });
    });

    describe('trigger validation', () => {
      it('should reject missing trigger', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, trigger: '' },
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.error).toBe('validation_error');
        }
      });

      it('should reject trigger too short', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            trigger: 'short',
          },
        });
        expect(result.valid).toBe(false);
      });

      it('should reject trigger too long', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            trigger: 'x'.repeat(PUBLISH_CONSTRAINTS.TRIGGER_MAX_LEN + 1),
          },
        });
        expect(result.valid).toBe(false);
      });
    });

    describe('solution validation', () => {
      it('should reject missing solution', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, solution: '' },
        });
        expect(result.valid).toBe(false);
      });

      it('should reject solution too short', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            solution: 'too short',
          },
        });
        expect(result.valid).toBe(false);
      });

      it('should reject unsafe script content', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            solution: 'This has <script>alert(1)</script> and enough length.',
          },
        });
        expect(result.valid).toBe(false);
      });
    });

    describe('confidence validation', () => {
      it('should reject confidence below range', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, confidence: -0.1 },
        });
        expect(result.valid).toBe(false);
      });

      it('should reject confidence above range', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, confidence: 1.5 },
        });
        expect(result.valid).toBe(false);
      });

      it('should accept confidence at boundaries', () => {
        const resultMin = validatePublishRequest({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, confidence: 0.0 },
        });
        const resultMax = validatePublishRequest({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, confidence: 1.0 },
        });
        expect(resultMin.valid).toBe(true);
        expect(resultMax.valid).toBe(true);
      });
    });

    describe('signals_match validation', () => {
      it('should accept valid signals array', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            signals_match: ['error', 'timeout', 'api'],
          },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject signals with too many items', () => {
        const signals = Array(25).fill('signal');
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            signals_match: signals,
          },
        });
        expect(result.valid).toBe(false);
      });

      it('should reject non-string signals', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            signals_match: ['valid', 123, 'also valid'] as any,
          },
        });
        expect(result.valid).toBe(false);
      });
    });

    describe('context validation', () => {
      it('should accept valid context object', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            context: { env: 'prod', version: '1.0' },
          },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject context with too many keys', () => {
        const context: Record<string, string> = {};
        for (let i = 0; i < 15; i++) {
          context[`key${i}`] = `value${i}`;
        }
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            context,
          },
        });
        expect(result.valid).toBe(false);
      });
    });

    describe('blast_radius validation', () => {
      it('should accept valid blast_radius', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            blast_radius: { files: 3, lines: 50 },
          },
        });
        expect(result.valid).toBe(true);
      });

      it('should reject blast_radius missing files', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            blast_radius: { lines: 50 } as any,
          },
        });
        expect(result.valid).toBe(false);
      });

      it('should reject negative values', () => {
        const result = validatePublishRequest({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            blast_radius: { files: -1, lines: 50 },
          },
        });
        expect(result.valid).toBe(false);
      });
    });
  });
});
