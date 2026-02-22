import { AgentRepository, getAgentRepository } from '../db';
import { AgentRecord } from '../types';
import { isValidAgentId } from '../utils/agentId';

/**
 * Simple in-memory cache entry
 */
interface CacheEntry {
  agent: AgentRecord;
  expiresAt: number;
}

/**
 * Agent Identity Service - Hub-side agent identity management
 *
 * Provides caching, validation, and lookup operations for agent identities.
 */
export class AgentIdentityService {
  private repository: AgentRepository;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number;

  /**
   * Create a new AgentIdentityService
   * @param repository - Agent repository for database operations
   * @param cacheTtlSeconds - Cache TTL in seconds (default: 300 = 5 minutes)
   */
  constructor(repository?: AgentRepository, cacheTtlSeconds: number = 300) {
    this.repository = repository || getAgentRepository();
    this.cacheTtlMs = cacheTtlSeconds * 1000;
  }

  /**
   * Look up an agent by ID with caching
   * @param agentId - The agent ID to look up
   * @returns The agent record or null if not found
   */
  async getAgent(agentId: string): Promise<AgentRecord | null> {
    // Validate format first
    if (!isValidAgentId(agentId)) {
      return null;
    }

    // Check cache
    const cached = this.cache.get(agentId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.agent;
    }

    // Query database
    const agent = await this.repository.findById(agentId);

    if (agent) {
      // Update cache
      this.cache.set(agentId, {
        agent,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    return agent;
  }

  /**
   * Check if an agent exists and is active
   * @param agentId - The agent ID to validate
   * @returns True if the agent exists and is valid
   */
  async validateAgent(agentId: string): Promise<boolean> {
    // Quick format check
    if (!isValidAgentId(agentId)) {
      return false;
    }

    const agent = await this.getAgent(agentId);
    return agent !== null;
  }

  /**
   * Update the last_seen timestamp for an agent
   * @param agentId - The agent ID to update
   */
  async updateLastSeen(agentId: string): Promise<void> {
    // Validate format
    if (!isValidAgentId(agentId)) {
      throw new Error(`Invalid agent ID format: ${agentId}`);
    }

    await this.repository.updateLastSeen(agentId);

    // Invalidate cache entry to force refresh on next lookup
    this.cache.delete(agentId);
  }

  /**
   * Clear the cache for a specific agent or all agents
   * @param agentId - Optional agent ID to clear specific cache entry
   */
  clearCache(agentId?: string): void {
    if (agentId) {
      this.cache.delete(agentId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Could be implemented with counters if needed
    };
  }

  /**
   * Validate agent ID format without database lookup
   * @param agentId - The agent ID to validate
   * @returns True if the format is valid
   */
  static isValidFormat(agentId: string): boolean {
    return isValidAgentId(agentId);
  }
}

// Singleton instance
let serviceInstance: AgentIdentityService | null = null;

/**
 * Get the singleton AgentIdentityService instance
 */
export function getAgentIdentityService(): AgentIdentityService {
  if (!serviceInstance) {
    serviceInstance = new AgentIdentityService();
  }
  return serviceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAgentIdentityService(): void {
  if (serviceInstance) {
    serviceInstance.clearCache();
    serviceInstance = null;
  }
}
