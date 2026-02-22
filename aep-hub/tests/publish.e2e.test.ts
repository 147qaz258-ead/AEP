import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createPublishRouter } from '../src/routes/publish';
import { AgentRecord, Capability, ExperienceRecord } from '../src/types';
import { publishRateLimiter } from '../src/middleware';

// Create mock agent record
const mockAgentRecord: AgentRecord = {
  id: 'agent_0x1234567890abcdef',
  capabilities: ['fetch', 'publish', 'feedback'] as Capability[],
  signature: 'testsignature12345678901234567890',
  ip_address: '::1',
  created_at: new Date(),
  last_seen: new Date(),
};

// Create mock agent without publish capability
const mockAgentNoPublish: AgentRecord = {
  id: 'agent_0xnoPublishCapable',
  capabilities: ['fetch', 'feedback'] as Capability[],
  signature: 'testsignature12345678901234567890',
  ip_address: '::1',
  created_at: new Date(),
  last_seen: new Date(),
};

// Create mock experience record
const mockExperienceRecord: ExperienceRecord = {
  id: 'exp_1234567890_abc12345',
  trigger: 'Test trigger for duplicate detection',
  solution: 'Test solution for duplicate detection with enough length.',
  confidence: 0.85,
  creator_id: 'agent_0x1234567890abcdef',
  status: 'candidate',
  gdi_score: 0.425,
  signals_match: ['error', 'timeout'],
  gene_id: null,
  context: null,
  blast_radius: { files: 3, lines: 50 },
  content_hash: 'existing_hash_abc123',
  created_at: new Date(),
  updated_at: new Date(),
};

// In-memory store for experiences
let experienceStore: Map<string, ExperienceRecord> = new Map();
let experienceByHashMap: Map<string, string> = new Map();

// Reset rate limiter before each test
beforeEach(() => {
  publishRateLimiter.reset('agent_0x1234567890abcdef');
  publishRateLimiter.reset('agent_0xnoPublishCapable');
  experienceStore.clear();
  experienceByHashMap.clear();
});

// Mock the repository modules
vi.mock('../src/db', () => ({
  getAgentRepository: () => ({
    findById: vi.fn((id: string) => {
      if (id === 'agent_0x1234567890abcdef') {
        return Promise.resolve(mockAgentRecord);
      }
      if (id === 'agent_0xnoPublishCapable') {
        return Promise.resolve(mockAgentNoPublish);
      }
      if (id === 'agent_0xunregistered') {
        return Promise.resolve(null); // Unregistered agent
      }
      return Promise.resolve(null);
    }),
  }),
  getExperienceRepository: () => ({
    findByContentHash: vi.fn((hash: string) => {
      const expId = experienceByHashMap.get(hash);
      if (expId) {
        return Promise.resolve(experienceStore.get(expId) || null);
      }
      return Promise.resolve(null);
    }),
    createWithSignals: vi.fn((input: any) => {
      const record: ExperienceRecord = {
        id: input.id,
        trigger: input.trigger,
        solution: input.solution,
        confidence: input.confidence,
        creator_id: input.creatorId,
        status: 'candidate',
        gdi_score: 0.5 * input.confidence,
        signals_match: input.signalsMatch || null,
        gene_id: input.geneId || null,
        context: input.context || null,
        blast_radius: input.blastRadius || null,
        content_hash: input.contentHash,
        created_at: new Date(),
        updated_at: new Date(),
      };
      experienceStore.set(input.id, record);
      experienceByHashMap.set(input.contentHash, input.id);
      return Promise.resolve(record);
    }),
  }),
  resetAgentRepository: vi.fn(),
  resetExperienceRepository: vi.fn(),
}));

describe('Publish Endpoint E2E Tests', () => {
  let app: Express;

  beforeAll(() => {
    // Create Express app with publish router
    app = express();
    app.use(express.json());
    app.use('/v1/publish', createPublishRouter());
  });

  const validPublishRequest = {
    protocol: 'aep',
    version: '1.0.0',
    type: 'publish',
    sender: 'agent_0x1234567890abcdef',
    timestamp: new Date().toISOString(),
    payload: {
      trigger: 'Error: Connection timeout when fetching data from API',
      solution: 'Increased the connection timeout from 5s to 30s and added retry logic with exponential backoff to handle transient network issues.',
      confidence: 0.85,
      signals_match: ['timeout', 'connection_error', 'api'],
      context: { environment: 'production', service: 'data-fetcher' },
      blast_radius: { files: 2, lines: 45 },
    },
  };

  describe('AC-PUB-001: POST /v1/publish endpoint', () => {
    it('should accept POST requests at /v1/publish', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send(validPublishRequest);

      expect(response.status).toBe(201);
    });
  });

  describe('AC-PUB-002: Validates AEP envelope format', () => {
    it('should reject invalid protocol', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({ ...validPublishRequest, protocol: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_protocol');
    });

    it('should reject invalid type', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({ ...validPublishRequest, type: 'hello' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_type');
    });
  });

  describe('AC-PUB-003: Authenticates agent via Authorization header', () => {
    it('should reject missing Authorization header', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .send(validPublishRequest);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('unauthorized');
    });

    it('should reject invalid Authorization format', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'InvalidFormat')
        .send(validPublishRequest);

      expect(response.status).toBe(401);
    });

    it('should reject unregistered agent', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0xunregistered')
        .send({
          ...validPublishRequest,
          sender: 'agent_0xunregistered', // Match auth header
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Agent not registered');
    });

    it('should reject agent without publish capability', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0xnoPublishCapable')
        .send({
          ...validPublishRequest,
          sender: 'agent_0xnoPublishCapable',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
    });
  });

  describe('AC-PUB-004: Validates all required fields', () => {
    it('should reject missing trigger', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, trigger: '' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
      expect(response.body.field_errors.trigger).toBeDefined();
    });

    it('should reject missing solution', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, solution: '' },
        });

      expect(response.status).toBe(400);
      expect(response.body.field_errors.solution).toBeDefined();
    });

    it('should reject invalid confidence (out of range)', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, confidence: 1.5 },
        });

      expect(response.status).toBe(400);
      expect(response.body.field_errors.confidence).toBeDefined();
    });

    it('should reject trigger too short', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({
          ...validPublishRequest,
          payload: { ...validPublishRequest.payload, trigger: 'Too short' },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('AC-PUB-005: Generates unique experience_id', () => {
    it('should generate experience_id in correct format', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send(validPublishRequest);

      expect(response.status).toBe(201);
      expect(response.body.experience_id).toMatch(/^exp_\d+_[a-f0-9]{8}$/);
    });
  });

  describe('AC-PUB-006: Returns 201 Created with experience_id for new experiences', () => {
    it('should return 201 Created for new experience', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send(validPublishRequest);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        experience_id: expect.any(String),
        status: 'candidate',
        duplicate: false,
        message: expect.any(String),
        created_at: expect.any(String),
      });
    });
  });

  describe('AC-PUB-007: Returns 200 OK with existing experience_id for duplicates', () => {
    it('should return 200 OK for duplicate experience', async () => {
      // First, create an experience
      const firstResponse = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send(validPublishRequest);

      expect(firstResponse.status).toBe(201);
      const experienceId = firstResponse.body.experience_id;

      // Send the same request again
      const secondResponse = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send(validPublishRequest);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body).toMatchObject({
        experience_id: experienceId,
        duplicate: true,
        message: expect.stringContaining('already exists'),
      });
    });
  });

  describe('AC-PUB-008: Enforces rate limit (10 requests/minute per agent)', () => {
    it('should allow requests within rate limit', async () => {
      // Make multiple requests within limit
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/v1/publish')
          .set('Authorization', 'Bearer agent_0x1234567890abcdef')
          .send({
            ...validPublishRequest,
            payload: {
              ...validPublishRequest.payload,
              trigger: `Unique trigger ${i} ${Date.now()}`,
              solution: `Unique solution ${i} with enough length for validation. ${Date.now()}`,
            },
          });

        expect(response.status).toBeLessThan(429);
      }
    });

    it('should reject requests exceeding rate limit', async () => {
      // Reset rate limiter
      publishRateLimiter.reset('agent_0x1234567890abcdef');

      // Make 10 requests (should all succeed)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/v1/publish')
          .set('Authorization', 'Bearer agent_0x1234567890abcdef')
          .send({
            ...validPublishRequest,
            payload: {
              ...validPublishRequest.payload,
              trigger: `Rate limit test ${i} ${Date.now()}`,
              solution: `Rate limit solution ${i} with enough length. ${Date.now()}`,
            },
          });
      }

      // 11th request should be rate limited
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            trigger: `Rate limit test overflow ${Date.now()}`,
            solution: `Rate limit solution overflow with length. ${Date.now()}`,
          },
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('rate_limited');
      expect(response.body.retry_after).toBeGreaterThan(0);
    });
  });

  describe('Validation edge cases', () => {
    it('should reject unsafe content in solution', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            solution: 'This contains <script>alert(1)</script> which is unsafe and should be rejected.',
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.field_errors.solution).toBeDefined();
    });

    it('should accept valid optional fields', async () => {
      const response = await request(app)
        .post('/v1/publish')
        .set('Authorization', 'Bearer agent_0x1234567890abcdef')
        .send({
          ...validPublishRequest,
          payload: {
            ...validPublishRequest.payload,
            gene: 'gene_0x123',
            context: { key1: 'value1', key2: 'value2' },
            blast_radius: { files: 5, lines: 100 },
          },
        });

      expect(response.status).toBe(201);
    });
  });
});
