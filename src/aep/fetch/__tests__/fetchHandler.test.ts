/**
 * Tests for Fetch API Endpoint
 *
 * Covers all acceptance criteria from TASK-E-001-FETCH-004:
 * - AC-FETCH-001: Endpoint accepts POST requests at /v1/fetch
 * - AC-FETCH-002: Validates AEP envelope format
 * - AC-FETCH-003: Validates agent authentication
 * - AC-FETCH-004: Validates signals array is non-empty
 * - AC-FETCH-005: Validates limit parameter range [1, 50]
 * - AC-FETCH-006: Returns experiences ranked by GDI score (descending)
 * - AC-FETCH-007: Returns only promoted status experiences by default
 * - AC-FETCH-008: Includes query_id for tracking
 * - AC-FETCH-009: Empty results return 200 with suggestion
 * - AC-FETCH-010: Fetch latency < 100ms (p95)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FetchHandler,
  ValidationError,
  UnauthorizedError,
  type AEPEnvelope,
  type FetchPayload,
  type FetchResponse,
} from '../index';
import type { Experience } from '../../matcher';

/**
 * Creates a valid fetch request envelope for testing
 */
function createValidRequest(overrides?: Partial<AEPEnvelope>): AEPEnvelope {
  return {
    protocol: 'aep',
    version: '1.0.0',
    type: 'fetch',
    sender: 'agent_test123',
    timestamp: new Date().toISOString(),
    payload: {
      signals: ['TypeError: Cannot read property'],
      limit: 5,
    },
    ...overrides,
  };
}

/**
 * Creates test experiences for testing
 */
function createTestExperiences(): Experience[] {
  return [
    {
      id: 'exp_001',
      trigger: 'TypeError: Cannot read property of undefined',
      solution: 'Check if the object is defined before accessing properties',
      confidence: 0.95,
      creator: 'agent_001',
      gdi_score: 0.92,
      status: 'promoted',
      signals_match: ['keyword:type_error', 'errsig:cannot read property'],
      success_streak: 15,
    },
    {
      id: 'exp_002',
      trigger: 'TypeError undefined variable access',
      solution: 'Ensure variable is declared before use',
      confidence: 0.88,
      creator: 'agent_002',
      gdi_score: 0.85,
      status: 'promoted',
      signals_match: ['keyword:type_error'],
      success_streak: 10,
    },
    {
      id: 'exp_003',
      trigger: 'ReferenceError variable not defined',
      solution: 'Declare the variable before using it',
      confidence: 0.75,
      creator: 'agent_003',
      gdi_score: 0.72,
      status: 'candidate',
      signals_match: ['keyword:reference_error'],
      success_streak: 3,
    },
    {
      id: 'exp_004',
      trigger: 'Network timeout error',
      solution: 'Increase timeout or implement retry logic',
      confidence: 0.80,
      creator: 'agent_004',
      gdi_score: 0.68,
      status: 'deprecated',
      signals_match: ['keyword:timeout', 'keyword:network_error'],
      success_streak: 5,
    },
  ];
}

describe('FetchHandler', () => {
  let handler: FetchHandler;
  let testExperiences: Experience[];

  beforeEach(() => {
    handler = new FetchHandler({
      validateAgent: async (id) => id.startsWith('agent_'),
      updateAgentLastSeen: async () => {},
    });
    testExperiences = createTestExperiences();
  });

  describe('AC-FETCH-001: Endpoint accepts POST requests at /v1/fetch', () => {
    it('should accept valid fetch requests', async () => {
      const request = createValidRequest();
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_test123',
      });

      expect(response).toBeDefined();
      expect(response.experiences).toBeDefined();
      expect(response.count).toBeDefined();
      expect(response.query_id).toBeDefined();
    });
  });

  describe('AC-FETCH-002: Validates AEP envelope format', () => {
    it('should reject non-aep protocol', async () => {
      const request = createValidRequest({ protocol: 'http' });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject missing version', async () => {
      const request = createValidRequest({ version: '' });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject non-fetch type', async () => {
      const request = createValidRequest({ type: 'publish' as 'fetch' });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject missing sender', async () => {
      const request = createValidRequest({ sender: '' });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject missing timestamp', async () => {
      const request = createValidRequest({ timestamp: '' });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('AC-FETCH-003: Validates agent authentication', () => {
    it('should reject missing Authorization header', async () => {
      const request = createValidRequest();

      await expect(handler.handle(request, {})).rejects.toThrow(UnauthorizedError);
    });

    it('should reject invalid Authorization header format', async () => {
      const request = createValidRequest();

      await expect(
        handler.handle(request, { authorization: 'InvalidFormat' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject invalid agent_id', async () => {
      const request = createValidRequest();

      await expect(
        handler.handle(request, { authorization: 'Bearer invalid_agent' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should accept valid agent_id', async () => {
      const request = createValidRequest();
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_valid',
      });

      expect(response).toBeDefined();
    });
  });

  describe('AC-FETCH-004: Validates signals array is non-empty', () => {
    it('should reject empty signals array', async () => {
      const request = createValidRequest({
        payload: { signals: [] },
      });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject missing signals array', async () => {
      const request = createValidRequest({
        payload: {} as FetchPayload,
      });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should accept non-empty signals array', async () => {
      const request = createValidRequest({
        payload: { signals: ['error message'] },
      });
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_test',
      });

      expect(response).toBeDefined();
    });

    it('should reject signals with empty strings', async () => {
      const request = createValidRequest({
        payload: { signals: ['   '] },
      });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('AC-FETCH-005: Validates limit parameter range [1, 50]', () => {
    it('should reject limit < 1', async () => {
      const request = createValidRequest({
        payload: { signals: ['error'], limit: 0 },
      });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject limit > 50', async () => {
      const request = createValidRequest({
        payload: { signals: ['error'], limit: 51 },
      });

      await expect(
        handler.handle(request, { authorization: 'Bearer agent_test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should accept limit = 1', async () => {
      const request = createValidRequest({
        payload: { signals: ['error'], limit: 1 },
      });
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_test',
      });

      expect(response).toBeDefined();
    });

    it('should accept limit = 50', async () => {
      const request = createValidRequest({
        payload: { signals: ['error'], limit: 50 },
      });
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_test',
      });

      expect(response).toBeDefined();
    });

    it('should default limit to 5 if not specified', async () => {
      const request = createValidRequest({
        payload: { signals: ['error'] },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      // Should return at most 5 results (or fewer if not enough matches)
      expect(response.experiences.length).toBeLessThanOrEqual(5);
    });
  });

  describe('AC-FETCH-006: Returns experiences ranked by GDI score (descending)', () => {
    it('should return experiences sorted by GDI score descending', () => {
      const request = createValidRequest({
        payload: { signals: ['TypeError'], limit: 10, include_candidates: true },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      const scores = response.experiences.map((e) => e.gdi_score);
      const sortedScores = [...scores].sort((a, b) => b - a);

      expect(scores).toEqual(sortedScores);
    });

    it('should have highest GDI score first', () => {
      const request = createValidRequest({
        payload: { signals: ['TypeError error'], limit: 10, include_candidates: true },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      if (response.experiences.length > 1) {
        expect(response.experiences[0].gdi_score).toBeGreaterThanOrEqual(
          response.experiences[1].gdi_score
        );
      }
    });
  });

  describe('AC-FETCH-007: Returns only promoted status experiences by default', () => {
    it('should only return promoted experiences by default', () => {
      const request = createValidRequest({
        payload: { signals: ['error timeout TypeError'], limit: 10 },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      // Check that all returned experiences have promoted status
      // (we filter from testExperiences which includes candidate and deprecated)
      const promotedIds = testExperiences
        .filter((e) => e.status === 'promoted')
        .map((e) => e.id);

      response.experiences.forEach((exp) => {
        expect(promotedIds).toContain(exp.id);
      });
    });

    it('should include candidate experiences when include_candidates is true', () => {
      const request = createValidRequest({
        payload: {
          signals: ['ReferenceError variable undefined'],
          limit: 10,
          include_candidates: true,
        },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      const ids = response.experiences.map((e) => e.id);
      // Should include candidate experience
      expect(ids).toContain('exp_003');
    });
  });

  describe('AC-FETCH-008: Includes query_id for tracking', () => {
    it('should include query_id in response', async () => {
      const request = createValidRequest();
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_test',
      });

      expect(response.query_id).toBeDefined();
      expect(typeof response.query_id).toBe('string');
      expect(response.query_id).toMatch(/^q_\d+_[a-f0-9]+$/);
    });

    it('should generate unique query_ids', async () => {
      const request = createValidRequest();

      const responses = await Promise.all([
        handler.handle(request, { authorization: 'Bearer agent_test' }),
        handler.handle(request, { authorization: 'Bearer agent_test' }),
      ]);

      expect(responses[0].query_id).not.toBe(responses[1].query_id);
    });
  });

  describe('AC-FETCH-009: Empty results return 200 with suggestion', () => {
    it('should return 200 status for empty results', () => {
      const request = createValidRequest({
        payload: { signals: ['xyznonexistent123'], limit: 5 },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      // Response should be valid (not an error)
      expect(response).toBeDefined();
      expect(response.count).toBe(0);
      expect(response.experiences).toEqual([]);
    });

    it('should include suggestion for empty results', () => {
      const request = createValidRequest({
        payload: { signals: ['xyznonexistent123'], limit: 5 },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      expect(response.suggestion).toBeDefined();
      expect(response.suggestion).toContain('No matching experiences');
      expect(response.suggestion).toContain('publishing');
    });

    it('should not include suggestion when results are found', () => {
      const request = createValidRequest({
        payload: { signals: ['TypeError'], limit: 5 },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      // If there are results, no suggestion
      if (response.count > 0) {
        expect(response.suggestion).toBeUndefined();
      }
    });
  });

  describe('AC-FETCH-010: Fetch latency < 100ms (p95)', () => {
    it('should complete within 100ms', async () => {
      const request = createValidRequest();
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_test',
      });

      expect(response.latency_ms).toBeLessThan(100);
    });

    it('should include latency_ms in response', async () => {
      const request = createValidRequest();
      const response = await handler.handle(request, {
        authorization: 'Bearer agent_test',
      });

      expect(response.latency_ms).toBeDefined();
      expect(typeof response.latency_ms).toBe('number');
      expect(response.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('should report sync latency correctly', () => {
      const request = createValidRequest();
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      expect(response.latency_ms).toBeDefined();
      expect(response.latency_ms).toBeLessThan(100);
    });
  });

  describe('Error Response Handling', () => {
    it('should create validation error response', () => {
      const error = new ValidationError('Test validation error', 'test_field');
      const response = FetchHandler.createErrorResponse(error);

      expect(response.error).toBe('invalid_request');
      expect(response.message).toBe('Test validation error');
      expect(response.field).toBe('test_field');
    });

    it('should create unauthorized error response', () => {
      const error = new UnauthorizedError('Test unauthorized error');
      const response = FetchHandler.createErrorResponse(error);

      expect(response.error).toBe('unauthorized');
      expect(response.message).toBe('Test unauthorized error');
    });

    it('should create internal error response for unknown errors', () => {
      const error = new Error('Unknown error');
      const response = FetchHandler.createErrorResponse(error);

      expect(response.error).toBe('internal_error');
      expect(response.message).toBe('An internal error occurred');
    });

    it('should return correct status codes', () => {
      expect(FetchHandler.getErrorStatusCode(new ValidationError('test'))).toBe(400);
      expect(FetchHandler.getErrorStatusCode(new UnauthorizedError('test'))).toBe(401);
      expect(FetchHandler.getErrorStatusCode(new Error('test'))).toBe(500);
    });
  });

  describe('Response Structure', () => {
    it('should return correct count', () => {
      const request = createValidRequest({
        payload: { signals: ['TypeError error'], limit: 10, include_candidates: true },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      expect(response.count).toBe(response.experiences.length);
    });

    it('should respect limit parameter', () => {
      const request = createValidRequest({
        payload: { signals: ['error'], limit: 2, include_candidates: true },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      expect(response.experiences.length).toBeLessThanOrEqual(2);
    });

    it('should include all required fields in experience summary', () => {
      const request = createValidRequest({
        payload: { signals: ['TypeError'], limit: 1 },
      });
      const response = handler.handleSync(request, testExperiences, {
        authorization: 'Bearer agent_test',
      });

      if (response.experiences.length > 0) {
        const exp = response.experiences[0];
        expect(exp.id).toBeDefined();
        expect(exp.trigger).toBeDefined();
        expect(exp.solution).toBeDefined();
        expect(exp.confidence).toBeDefined();
        expect(exp.creator).toBeDefined();
        expect(exp.gdi_score).toBeDefined();
        expect(exp.success_streak).toBeDefined();
        expect(exp.signals_match).toBeDefined();
      }
    });
  });
});
