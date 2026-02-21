import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createHelloRouter } from '../src/routes/hello';
import { AgentRecord, Capability } from '../src/types';

// Create a mock repository
const mockAgentRecord: AgentRecord = {
  id: 'agent_0x1234567890abcdef',
  capabilities: ['fetch', 'publish', 'feedback'] as Capability[],
  signature: 'testsignature12345678901234567890',
  ip_address: '::1',
  created_at: new Date(),
  last_seen: new Date(),
};

// Mock the repository module
vi.mock('../src/db', () => ({
  getAgentRepository: () => ({
    createOrGet: vi.fn().mockResolvedValue({
      agent: mockAgentRecord,
      isNew: true,
    }),
    findBySignature: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(mockAgentRecord),
    updateLastSeen: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }),
  resetAgentRepository: vi.fn(),
}));

describe('Hello Endpoint E2E Tests', () => {
  let app: Express;

  beforeAll(() => {
    // Create Express app with hello router
    app = express();
    app.use(express.json());
    app.use('/v1/hello', createHelloRouter());
  });

  const validHelloRequest = {
    protocol: 'aep',
    version: '1.0.0',
    type: 'hello',
    sender: null,
    timestamp: new Date().toISOString(),
    payload: {
      capabilities: ['fetch', 'publish', 'feedback'],
      version: '1.0.0',
    },
  };

  describe('POST /v1/hello', () => {
    it('should register a new agent with valid request', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .set('Content-Type', 'application/json')
        .send(validHelloRequest);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'registered',
        agent_id: expect.stringMatching(/^agent_0x[a-f0-9]{16}$/),
        hub_version: expect.any(String),
        registered_at: expect.any(String),
      });
    });

    it('should reject request with invalid protocol', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({ ...validHelloRequest, protocol: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_protocol');
    });

    it('should reject request with invalid type', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({ ...validHelloRequest, type: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_type');
    });

    it('should reject request with invalid capabilities', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({
          ...validHelloRequest,
          payload: {
            ...validHelloRequest.payload,
            capabilities: ['invalid_capability'],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_capabilities');
      expect(response.body.valid_capabilities).toEqual(['fetch', 'publish', 'feedback']);
    });

    it('should reject request with empty capabilities', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({
          ...validHelloRequest,
          payload: {
            ...validHelloRequest.payload,
            capabilities: [],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_capabilities');
    });

    it('should reject request with non-null sender', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({ ...validHelloRequest, sender: 'agent_0x123' });

      expect(response.status).toBe(400);
    });

    it('should reject request with invalid version format', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({ ...validHelloRequest, version: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_version');
    });

    it('should reject request with missing body', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send();

      expect(response.status).toBe(400);
    });
  });
});
