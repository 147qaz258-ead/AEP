import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createHelloRouter } from '../src/routes/hello';
import { HelloRequest, Capability } from '../src/types';

// Mock the database repository
jest.mock('../src/db', () => {
  const mockRepository = {
    findBySignature: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateLastSeen: jest.fn(),
    createOrGet: jest.fn(),
    count: jest.fn(),
    close: jest.fn(),
  };

  return {
    getAgentRepository: () => mockRepository,
    resetAgentRepository: () => {},
  };
});

// Since we can't use jest.mock with vitest, let's create an inline mock
import { getAgentRepository } from '../src/db';

describe('Hello Endpoint Integration Tests', () => {
  let app: Express;
  let mockRepository: any;

  beforeAll(() => {
    // Create Express app with hello router
    app = express();
    app.use(express.json());
    app.use('/v1/hello', createHelloRouter());
    
    // Get mock repository
    mockRepository = getAgentRepository();
  });

  const validHelloRequest = {
    protocol: 'aep',
    version: '1.0.0',
    type: 'hello',
    sender: null,
    timestamp: new Date().toISOString(),
    payload: {
      capabilities: ['fetch', 'publish', 'feedback'] as Capability[],
      version: '1.0.0',
    },
  };

  describe('AC-REG-001: Endpoint accepts POST at /v1/hello', () => {
    it('should accept POST requests at /v1/hello', async () => {
      mockRepository.createOrGet.mockResolvedValueOnce({
        agent: {
          id: 'agent_0x1234567890abcdef',
          capabilities: ['fetch', 'publish', 'feedback'],
          signature: 'abc123',
          ip_address: '::1',
          created_at: new Date(),
          last_seen: new Date(),
        },
        isNew: true,
      });

      const response = await request(app)
        .post('/v1/hello')
        .set('Content-Type', 'application/json')
        .send(validHelloRequest);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('registered');
    });

    it('should reject non-POST requests', async () => {
      const response = await request(app)
        .get('/v1/hello');

      expect(response.status).toBe(404);
    });
  });

  describe('AC-REG-002: Validates protocol, version, and type fields', () => {
    it('should reject invalid protocol', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({ ...validHelloRequest, protocol: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_protocol');
    });

    it('should reject invalid type', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({ ...validHelloRequest, type: 'fetch' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_type');
    });
  });

  describe('AC-REG-003: Generates unique agent_id', () => {
    it('should return agent_id in correct format', async () => {
      mockRepository.createOrGet.mockResolvedValueOnce({
        agent: {
          id: 'agent_0x1234567890abcdef',
          capabilities: ['fetch', 'publish', 'feedback'],
          signature: 'abc123',
          ip_address: '::1',
          created_at: new Date(),
          last_seen: new Date(),
        },
        isNew: true,
      });

      const response = await request(app)
        .post('/v1/hello')
        .send(validHelloRequest);

      expect(response.status).toBe(200);
      expect(response.body.agent_id).toMatch(/^agent_0x[a-f0-9]{16}$/);
    });
  });

  describe('AC-REG-004: Returns correct response fields', () => {
    it('should return status, agent_id, hub_version, registered_at', async () => {
      const testDate = new Date();
      mockRepository.createOrGet.mockResolvedValueOnce({
        agent: {
          id: 'agent_0x1234567890abcdef',
          capabilities: ['fetch', 'publish', 'feedback'],
          signature: 'abc123',
          ip_address: '::1',
          created_at: testDate,
          last_seen: testDate,
        },
        isNew: true,
      });

      const response = await request(app)
        .post('/v1/hello')
        .send(validHelloRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'registered');
      expect(response.body).toHaveProperty('agent_id');
      expect(response.body).toHaveProperty('hub_version');
      expect(response.body).toHaveProperty('registered_at');
    });
  });

  describe('AC-REG-005 & AC-REG-006: Validates capabilities', () => {
    it('should reject invalid capabilities', async () => {
      const response = await request(app)
        .post('/v1/hello')
        .send({
          ...validHelloRequest,
          payload: {
            ...validHelloRequest.payload,
            capabilities: ['fetch', 'invalid_cap'],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_capabilities');
      expect(response.body.valid_capabilities).toEqual(['fetch', 'publish', 'feedback']);
    });
  });

  describe('AC-REG-007: Idempotent registration', () => {
    it('should return same agent_id for same signature', async () => {
      const existingAgentId = 'agent_0xexisting123456';
      mockRepository.createOrGet.mockResolvedValueOnce({
        agent: {
          id: existingAgentId,
          capabilities: ['fetch', 'publish', 'feedback'],
          signature: 'existing-sig',
          ip_address: '::1',
          created_at: new Date(),
          last_seen: new Date(),
        },
        isNew: false,
      });

      const response = await request(app)
        .post('/v1/hello')
        .send(validHelloRequest);

      expect(response.status).toBe(200);
      expect(response.body.agent_id).toBe(existingAgentId);
    });
  });
});
