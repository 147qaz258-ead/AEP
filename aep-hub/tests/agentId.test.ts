import { describe, it, expect } from 'vitest';
import { generateAgentId, computeRegistrationSignature, isValidAgentId } from '../src/utils/agentId';

describe('Agent ID Utils', () => {
  describe('generateAgentId', () => {
    it('should generate ID with correct format', () => {
      const id = generateAgentId();
      expect(id).toMatch(/^agent_0x[a-f0-9]{16}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateAgentId());
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate 16 hex characters after prefix', () => {
      const id = generateAgentId();
      const hexPart = id.replace('agent_0x', '');
      expect(hexPart).toHaveLength(16);
      expect(hexPart).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('computeRegistrationSignature', () => {
    it('should generate consistent signature for same inputs', () => {
      const capabilities = ['fetch', 'publish'];
      const ip = '127.0.0.1';
      
      const sig1 = computeRegistrationSignature(capabilities, ip);
      const sig2 = computeRegistrationSignature(capabilities, ip);
      
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different IPs', () => {
      const capabilities = ['fetch', 'publish'];
      
      const sig1 = computeRegistrationSignature(capabilities, '127.0.0.1');
      const sig2 = computeRegistrationSignature(capabilities, '127.0.0.2');
      
      expect(sig1).not.toBe(sig2);
    });

    it('should be order-independent for capabilities', () => {
      const ip = '127.0.0.1';
      
      const sig1 = computeRegistrationSignature(['fetch', 'publish'], ip);
      const sig2 = computeRegistrationSignature(['publish', 'fetch'], ip);
      
      expect(sig1).toBe(sig2);
    });

    it('should handle null IP address', () => {
      const capabilities = ['fetch'];
      
      const sig = computeRegistrationSignature(capabilities, null);
      
      expect(sig).toBeDefined();
      expect(sig).toHaveLength(32);
    });

    it('should generate 32-character hex string', () => {
      const sig = computeRegistrationSignature(['fetch'], '127.0.0.1');
      expect(sig).toHaveLength(32);
      expect(sig).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('isValidAgentId', () => {
    it('should accept valid agent IDs', () => {
      expect(isValidAgentId('agent_0x1234567890abcdef')).toBe(true);
      expect(isValidAgentId('agent_0x0000000000000000')).toBe(true);
      expect(isValidAgentId('agent_0xffffffffffffffff')).toBe(true);
    });

    it('should reject invalid agent IDs', () => {
      expect(isValidAgentId('agent_0x12345')).toBe(false); // Too short
      expect(isValidAgentId('agent_0x1234567890abcdefg')).toBe(false); // Invalid char
      expect(isValidAgentId('agent_1234567890abcdef')).toBe(false); // Missing 0x
      expect(isValidAgentId('Agent_0x1234567890abcdef')).toBe(false); // Uppercase
      expect(isValidAgentId('')).toBe(false); // Empty
    });
  });
});
