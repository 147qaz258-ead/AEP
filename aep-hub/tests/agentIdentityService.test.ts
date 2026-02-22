import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentIdentityService, getAgentIdentityService, resetAgentIdentityService } from '../src/services/agentIdentityService';
import { AgentRepository } from '../src/db/agentRepository';
import { AgentRecord } from '../src/types';

// Mock the repository
const mockAgent: AgentRecord = {
  id: 'agent_0x1234567890abcdef',
  capabilities: ['fetch', 'publish'],
  signature: 'test-signature-123',
  ip_address: '127.0.0.1',
  created_at: new Date('2024-01-01T00:00:00Z'),
  last_seen: new Date('2024-01-01T00:00:00Z'),
};

describe('AgentIdentityService', () => {
  let mockRepository: {
    findById: ReturnType<typeof vi.fn>;
    updateLastSeen: ReturnType<typeof vi.fn>;
  };
  let service: AgentIdentityService;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      updateLastSeen: vi.fn(),
    };
    service = new AgentIdentityService(mockRepository as unknown as AgentRepository, 1); // 1 second TTL for testing
  });

  afterEach(() => {
    resetAgentIdentityService();
  });

  describe('getAgent', () => {
    it('should return null for invalid agent ID format', async () => {
      const result = await service.getAgent('invalid-id');
      expect(result).toBeNull();
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should return null for agent ID with wrong length', async () => {
      const result = await service.getAgent('agent_0x1234567890abcde'); // 15 chars instead of 16
      expect(result).toBeNull();
    });

    it('should return null when agent not found in database', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getAgent('agent_0x1234567890abcdef');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('agent_0x1234567890abcdef');
    });

    it('should return agent when found in database', async () => {
      mockRepository.findById.mockResolvedValue(mockAgent);

      const result = await service.getAgent('agent_0x1234567890abcdef');

      expect(result).toEqual(mockAgent);
    });

    it('should cache agent lookups', async () => {
      mockRepository.findById.mockResolvedValue(mockAgent);

      // First call
      await service.getAgent('agent_0x1234567890abcdef');
      // Second call
      await service.getAgent('agent_0x1234567890abcdef');

      // Repository should only be called once due to caching
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expires', async () => {
      mockRepository.findById.mockResolvedValue(mockAgent);

      // First call
      await service.getAgent('agent_0x1234567890abcdef');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second call after TTL
      await service.getAgent('agent_0x1234567890abcdef');

      // Repository should be called twice
      expect(mockRepository.findById).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateAgent', () => {
    it('should return false for invalid format', async () => {
      const result = await service.validateAgent('invalid-id');
      expect(result).toBe(false);
    });

    it('should return false when agent not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.validateAgent('agent_0x1234567890abcdef');

      expect(result).toBe(false);
    });

    it('should return true when agent exists', async () => {
      mockRepository.findById.mockResolvedValue(mockAgent);

      const result = await service.validateAgent('agent_0x1234567890abcdef');

      expect(result).toBe(true);
    });
  });

  describe('updateLastSeen', () => {
    it('should throw error for invalid agent ID', async () => {
      await expect(service.updateLastSeen('invalid-id')).rejects.toThrow('Invalid agent ID format');
    });

    it('should call repository updateLastSeen', async () => {
      mockRepository.updateLastSeen.mockResolvedValue(undefined);

      await service.updateLastSeen('agent_0x1234567890abcdef');

      expect(mockRepository.updateLastSeen).toHaveBeenCalledWith('agent_0x1234567890abcdef');
    });

    it('should invalidate cache after update', async () => {
      mockRepository.findById.mockResolvedValue(mockAgent);
      mockRepository.updateLastSeen.mockResolvedValue(undefined);

      // Prime the cache
      await service.getAgent('agent_0x1234567890abcdef');

      // Update last seen
      await service.updateLastSeen('agent_0x1234567890abcdef');

      // Get again - should hit database
      await service.getAgent('agent_0x1234567890abcdef');

      expect(mockRepository.findById).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCache', () => {
    it('should clear specific agent from cache', async () => {
      mockRepository.findById.mockResolvedValue(mockAgent);

      // Prime cache
      await service.getAgent('agent_0x1234567890abcdef');

      // Clear specific entry
      service.clearCache('agent_0x1234567890abcdef');

      // Get again
      await service.getAgent('agent_0x1234567890abcdef');

      expect(mockRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache when no ID provided', async () => {
      mockRepository.findById.mockResolvedValue(mockAgent);

      // Prime cache
      await service.getAgent('agent_0x1234567890abcdef');

      // Clear all
      service.clearCache();

      expect(service.getCacheStats().size).toBe(0);
    });
  });

  describe('isValidFormat', () => {
    it('should validate correct format', () => {
      expect(AgentIdentityService.isValidFormat('agent_0x1234567890abcdef')).toBe(true);
      expect(AgentIdentityService.isValidFormat('agent_0x0000000000000000')).toBe(true);
      expect(AgentIdentityService.isValidFormat('agent_0xffffffffffffffff')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(AgentIdentityService.isValidFormat('agent_0x12345')).toBe(false); // Too short
      expect(AgentIdentityService.isValidFormat('agent_0x1234567890abcdefg')).toBe(false); // Invalid char
      expect(AgentIdentityService.isValidFormat('Agent_0x1234567890abcdef')).toBe(false); // Uppercase
      expect(AgentIdentityService.isValidFormat('')).toBe(false);
    });
  });

  describe('getAgentIdentityService singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getAgentIdentityService();
      const instance2 = getAgentIdentityService();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getAgentIdentityService();
      resetAgentIdentityService();
      const instance2 = getAgentIdentityService();

      expect(instance1).not.toBe(instance2);
    });
  });
});
