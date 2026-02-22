/**
 * Feedback Validation Tests
 *
 * Tests for feedback request validation according to AEP protocol
 */

import { describe, it, expect } from 'vitest';
import {
  validateFeedbackRequest,
  validateFeedbackPayload,
  validateFeedbackPayloadOnly,
} from '../src/utils/feedbackValidation';
import { FeedbackPayload } from '../src/types';

describe('Feedback Validation', () => {
  describe('validateFeedbackRequest', () => {
    it('should validate a valid feedback request', () => {
      const request = {
        protocol: 'aep',
        version: '1.0.0',
        type: 'feedback',
        sender: 'agent_123',
        timestamp: new Date().toISOString(),
        payload: {
          experience_id: 'exp_123',
          outcome: 'success',
          score: 0.9,
          notes: 'Great experience!',
        },
      };

      const result = validateFeedbackRequest(request);
      expect(result.valid).toBe(true);
      expect(result.request).toBeDefined();
    });

    it('should reject request with invalid protocol', () => {
      const request = {
        protocol: 'invalid',
        version: '1.0.0',
        type: 'feedback',
        sender: 'agent_123',
        timestamp: new Date().toISOString(),
        payload: {
          experience_id: 'exp_123',
          outcome: 'success',
        },
      };

      const result = validateFeedbackRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error?.field_errors.protocol).toBeDefined();
    });

    it('should reject request with missing sender', () => {
      const request = {
        protocol: 'aep',
        version: '1.0.0',
        type: 'feedback',
        sender: '',
        timestamp: new Date().toISOString(),
        payload: {
          experience_id: 'exp_123',
          outcome: 'success',
        },
      };

      const result = validateFeedbackRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error?.field_errors.sender).toBeDefined();
    });

    it('should reject request with invalid timestamp', () => {
      const request = {
        protocol: 'aep',
        version: '1.0.0',
        type: 'feedback',
        sender: 'agent_123',
        timestamp: 'invalid-date',
        payload: {
          experience_id: 'exp_123',
          outcome: 'success',
        },
      };

      const result = validateFeedbackRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error?.field_errors.timestamp).toBeDefined();
    });

    it('should reject request with missing payload', () => {
      const request = {
        protocol: 'aep',
        version: '1.0.0',
        type: 'feedback',
        sender: 'agent_123',
        timestamp: new Date().toISOString(),
      };

      const result = validateFeedbackRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error?.field_errors.payload).toBeDefined();
    });

    it('should reject request with non-object body', () => {
      const result = validateFeedbackRequest('not an object');
      expect(result.valid).toBe(false);
      expect(result.error?.field_errors._body).toBeDefined();
    });
  });

  describe('validateFeedbackPayload', () => {
    it('should accept valid success outcome', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'success',
      });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('should accept valid failure outcome', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'failure',
      });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('should accept valid partial outcome', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'partial',
      });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('should reject invalid outcome', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'invalid',
      });
      expect(errors.outcome).toBeDefined();
    });

    it('should reject missing experience_id', () => {
      const errors = validateFeedbackPayload({
        outcome: 'success',
      });
      expect(errors.experience_id).toBeDefined();
    });

    it('should accept valid score 0.0', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'partial',
        score: 0.0,
      });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('should accept valid score 1.0', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'partial',
        score: 1.0,
      });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('should reject score < 0.0', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'partial',
        score: -0.1,
      });
      expect(errors.score).toBeDefined();
    });

    it('should reject score > 1.0', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'partial',
        score: 1.1,
      });
      expect(errors.score).toBeDefined();
    });

    it('should reject non-number score', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'partial',
        score: 'high',
      });
      expect(errors.score).toBeDefined();
    });

    it('should accept optional notes', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'success',
        notes: 'This is a detailed feedback note.',
      });
      expect(Object.keys(errors).length).toBe(0);
    });

    it('should reject non-string notes', () => {
      const errors = validateFeedbackPayload({
        experience_id: 'exp_123',
        outcome: 'success',
        notes: 123,
      });
      expect(errors.notes).toBeDefined();
    });

    it('should reject non-object payload', () => {
      const errors = validateFeedbackPayload('not an object');
      expect(errors._payload).toBeDefined();
    });
  });

  describe('validateFeedbackPayloadOnly', () => {
    it('should return empty array for valid payload', () => {
      const payload: FeedbackPayload = {
        experience_id: 'exp_123',
        outcome: 'success',
      };
      const errors = validateFeedbackPayloadOnly(payload);
      expect(errors.length).toBe(0);
    });

    it('should return errors for missing experience_id', () => {
      const payload = {
        outcome: 'success',
      } as FeedbackPayload;
      const errors = validateFeedbackPayloadOnly(payload);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('experience_id'))).toBe(true);
    });

    it('should return errors for invalid outcome', () => {
      const payload = {
        experience_id: 'exp_123',
        outcome: 'invalid',
      } as FeedbackPayload;
      const errors = validateFeedbackPayloadOnly(payload);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('outcome'))).toBe(true);
    });

    it('should return errors for invalid score', () => {
      const payload: FeedbackPayload = {
        experience_id: 'exp_123',
        outcome: 'partial',
        score: 1.5,
      };
      const errors = validateFeedbackPayloadOnly(payload);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('score'))).toBe(true);
    });
  });
});
