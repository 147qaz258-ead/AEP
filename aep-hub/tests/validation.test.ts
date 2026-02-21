import { describe, it, expect } from 'vitest';
import { 
  validateHelloRequest, 
  validateCapabilities,
  ValidationErrorCodes 
} from '../src/utils/validation';
import { HelloRequest, Capability } from '../src/types';

describe('Validation Utils', () => {
  describe('validateCapabilities', () => {
    it('should accept valid capabilities', () => {
      const result = validateCapabilities(['fetch', 'publish']);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.capabilities).toEqual(['fetch', 'publish']);
      }
    });

    it('should accept all valid capabilities', () => {
      const result = validateCapabilities(['fetch', 'publish', 'feedback']);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.capabilities).toEqual(['fetch', 'publish', 'feedback']);
      }
    });

    it('should reject non-array capabilities', () => {
      const result = validateCapabilities('not-an-array');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_CAPABILITIES);
        expect(result.error.valid_capabilities).toBeDefined();
      }
    });

    it('should reject empty capabilities array', () => {
      const result = validateCapabilities([]);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_CAPABILITIES);
      }
    });

    it('should reject invalid capability value', () => {
      const result = validateCapabilities(['fetch', 'invalid_cap']);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_CAPABILITIES);
        expect(result.error.message).toContain('invalid_cap');
      }
    });

    it('should remove duplicates', () => {
      const result = validateCapabilities(['fetch', 'fetch', 'publish']);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.capabilities).toEqual(['fetch', 'publish']);
      }
    });
  });

  describe('validateHelloRequest', () => {
    const validRequest = {
      protocol: 'aep' as const,
      version: '1.0.0',
      type: 'hello' as const,
      sender: null,
      timestamp: new Date().toISOString(),
      payload: {
        capabilities: ['fetch', 'publish'] as Capability[],
        version: '1.0.0',
      },
    };

    it('should accept valid hello request', () => {
      const result = validateHelloRequest(validRequest);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.request.protocol).toBe('aep');
        expect(result.request.type).toBe('hello');
        expect(result.request.payload.capabilities).toEqual(['fetch', 'publish']);
      }
    });

    it('should reject request with invalid protocol', () => {
      const result = validateHelloRequest({
        ...validRequest,
        protocol: 'invalid',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_PROTOCOL);
      }
    });

    it('should reject request with invalid type', () => {
      const result = validateHelloRequest({
        ...validRequest,
        type: 'fetch',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_TYPE);
      }
    });

    it('should reject request with non-null sender', () => {
      const result = validateHelloRequest({
        ...validRequest,
        sender: 'agent_0x1234567890abcdef',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_TYPE);
      }
    });

    it('should reject request with invalid envelope version', () => {
      const result = validateHelloRequest({
        ...validRequest,
        version: 'invalid',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_VERSION);
      }
    });

    it('should reject request with invalid payload version', () => {
      const result = validateHelloRequest({
        ...validRequest,
        payload: {
          ...validRequest.payload,
          version: 'not-semver',
        },
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.INVALID_VERSION);
      }
    });

    it('should reject request with missing payload', () => {
      const result = validateHelloRequest({
        ...validRequest,
        payload: undefined,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.MISSING_FIELD);
      }
    });

    it('should reject request with invalid timestamp', () => {
      const result = validateHelloRequest({
        ...validRequest,
        timestamp: 'not-a-date',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.MISSING_FIELD);
      }
    });

    it('should reject null body', () => {
      const result = validateHelloRequest(null);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.error).toBe(ValidationErrorCodes.MISSING_FIELD);
      }
    });
  });
});
