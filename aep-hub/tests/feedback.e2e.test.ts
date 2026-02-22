/**
 * Feedback API E2E Tests
 *
 * Tests for the feedback submission endpoint
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { createApp } from '../src/index';
import { getAgentRepository, getExperienceRepository, resetAgentRepository, resetExperienceRepository } from '../src/db';
import { resetFeedbackRepository, getFeedbackRepository } from '../src/db/feedbackRepository';

// Test configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'aep_hub_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
};

describe('Feedback API E2E Tests', () => {
  let pool: Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    // Create connection pool
    pool = new Pool(TEST_DB_CONFIG);

    // Initialize repositories
    resetAgentRepository();
    resetExperienceRepository();
    resetFeedbackRepository();

    // Create app instance
    app = createApp();

    // Verify database connection
    try {
      await pool.query('SELECT 1');
      console.log('Connected to test database');
    } catch (error) {
      console.error('Failed to connect to test database:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await pool.query('DELETE FROM feedback');
    await pool.query('DELETE FROM experiences');
    await pool.query('DELETE FROM agents');
  });

  describe('POST /v1/feedback', () => {
    it('should submit feedback successfully for existing experience', async () => {
      // First, register an agent
      const agentRepo = getAgentRepository(pool);
      const agent = await agentRepo.create({
        id: 'agent_test_001',
        capabilities: ['publish', 'feedback'],
        signature: 'test_signature',
        ipAddress: '127.0.0.1',
      });

      // Create an experience
      const expRepo = getExperienceRepository(pool);
      const experience = await expRepo.create({
        id: 'exp_test_001',
        trigger: 'test trigger',
        solution: 'test solution',
        confidence: 0.8,
        creatorId: agent.id,
        contentHash: 'hash_test_001',
      });

      // Submit feedback
      const response = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: experience.id,
            outcome: 'success',
            score: 0.9,
            notes: 'Great experience!',
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.feedback_id).toBeDefined();
      expect(data.reward_earned).toBeGreaterThan(0);
      expect(data.updated_stats).toBeDefined();
      expect(data.updated_stats.total_uses).toBe(1);
      expect(data.updated_stats.total_success).toBe(1);
    });

    it('should reject feedback for non-existent experience', async () => {
      const agentRepo = getAgentRepository(pool);
      const agent = await agentRepo.create({
        id: 'agent_test_002',
        capabilities: ['feedback'],
        signature: 'test_signature',
        ipAddress: '127.0.0.1',
      });

      const response = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: 'non_existent_exp',
            outcome: 'success',
          },
        }),
      });

      expect(response.status).toBe(404);
    });

    it('should reject duplicate feedback from same agent', async () => {
      const agentRepo = getAgentRepository(pool);
      const agent = await agentRepo.create({
        id: 'agent_test_003',
        capabilities: ['publish', 'feedback'],
        signature: 'test_signature',
        ipAddress: '127.0.0.1',
      });

      const expRepo = getExperienceRepository(pool);
      const experience = await expRepo.create({
        id: 'exp_test_003',
        trigger: 'test trigger',
        solution: 'test solution',
        confidence: 0.8,
        creatorId: agent.id,
        contentHash: 'hash_test_003',
      });

      // First feedback - should succeed
      const response1 = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: experience.id,
            outcome: 'success',
          },
        }),
      });

      expect(response1.status).toBe(201);

      // Second feedback - should be rejected
      const response2 = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: experience.id,
            outcome: 'failure',
          },
        }),
      });

      expect(response2.status).toBe(409);
    });

    it('should reject feedback without authorization', async () => {
      const response = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: 'unauthorized_agent',
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: 'exp_123',
            outcome: 'success',
          },
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid outcome value', async () => {
      const agentRepo = getAgentRepository(pool);
      const agent = await agentRepo.create({
        id: 'agent_test_004',
        capabilities: ['feedback'],
        signature: 'test_signature',
        ipAddress: '127.0.0.1',
      });

      const response = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: 'exp_123',
            outcome: 'invalid_outcome',
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid score range', async () => {
      const agentRepo = getAgentRepository(pool);
      const agent = await agentRepo.create({
        id: 'agent_test_005',
        capabilities: ['feedback'],
        signature: 'test_signature',
        ipAddress: '127.0.0.1',
      });

      const response = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: 'exp_123',
            outcome: 'partial',
            score: 1.5, // Invalid: > 1.0
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should update success streak on success outcome', async () => {
      const agentRepo = getAgentRepository(pool);
      const agent = await agentRepo.create({
        id: 'agent_test_006',
        capabilities: ['publish', 'feedback'],
        signature: 'test_signature',
        ipAddress: '127.0.0.1',
      });

      const expRepo = getExperienceRepository(pool);
      const experience = await expRepo.create({
        id: 'exp_test_006',
        trigger: 'test trigger',
        solution: 'test solution',
        confidence: 0.8,
        creatorId: agent.id,
        contentHash: 'hash_test_006',
      });

      const response = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: experience.id,
            outcome: 'success',
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.updated_stats.success_streak).toBe(1);
    });

    it('should reset success streak on failure outcome', async () => {
      const agentRepo = getAgentRepository(pool);
      const agent = await agentRepo.create({
        id: 'agent_test_007',
        capabilities: ['publish', 'feedback'],
        signature: 'test_signature',
        ipAddress: '127.0.0.1',
      });

      const expRepo = getExperienceRepository(pool);
      const experience = await expRepo.create({
        id: 'exp_test_007',
        trigger: 'test trigger',
        solution: 'test solution',
        confidence: 0.8,
        creatorId: agent.id,
        contentHash: 'hash_test_007',
      });

      const response = await app.request('/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': agent.id,
        },
        body: JSON.stringify({
          protocol: 'aep',
          version: '1.0.0',
          type: 'feedback',
          sender: agent.id,
          timestamp: new Date().toISOString(),
          payload: {
            experience_id: experience.id,
            outcome: 'failure',
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.updated_stats.success_streak).toBe(0);
      expect(data.updated_stats.consecutive_failures).toBe(1);
    });
  });
});
