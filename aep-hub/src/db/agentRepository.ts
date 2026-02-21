import { Pool, PoolClient, QueryResult } from 'pg';
import { Capability, AgentRecord } from '../types';

/**
 * Database configuration
 */
interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  maxConnections?: number;
}

/**
 * Agent repository for database operations
 */
export class AgentRepository {
  private pool: Pool;

  constructor(config: DatabaseConfig = {}) {
    const connectionString = config.connectionString || process.env.DATABASE_URL;
    
    if (connectionString) {
      this.pool = new Pool({ connectionString });
    } else {
      this.pool = new Pool({
        host: config.host || process.env.DB_HOST || 'localhost',
        port: config.port || parseInt(process.env.DB_PORT || '5432'),
        database: config.database || process.env.DB_NAME || 'aep_hub',
        user: config.user || process.env.DB_USER || 'postgres',
        password: config.password || process.env.DB_PASSWORD || 'postgres',
        max: config.maxConnections || 20,
      });
    }
  }

  /**
   * Get the underlying pool for testing/advanced usage
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Find an existing agent by registration signature
   */
  async findBySignature(signature: string): Promise<AgentRecord | null> {
    const result = await this.pool.query<AgentRecord>(
      'SELECT id, capabilities, signature, ip_address, created_at, last_seen FROM agents WHERE signature = $1',
      [signature]
    );

    return result.rows[0] || null;
  }

  /**
   * Find an agent by ID
   */
  async findById(agentId: string): Promise<AgentRecord | null> {
    const result = await this.pool.query<AgentRecord>(
      'SELECT id, capabilities, signature, ip_address, created_at, last_seen FROM agents WHERE id = $1',
      [agentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new agent
   */
  async create(
    agentId: string,
    capabilities: Capability[],
    signature: string,
    ipAddress: string | null
  ): Promise<AgentRecord> {
    const result = await this.pool.query<AgentRecord>(
      `INSERT INTO agents (id, capabilities, signature, ip_address, created_at, last_seen)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, capabilities, signature, ip_address, created_at, last_seen`,
      [agentId, JSON.stringify(capabilities), signature, ipAddress]
    );

    return result.rows[0];
  }

  /**
   * Update last_seen timestamp for an agent
   */
  async updateLastSeen(agentId: string): Promise<void> {
    await this.pool.query(
      'UPDATE agents SET last_seen = NOW() WHERE id = $1',
      [agentId]
    );
  }

  /**
   * Create or get existing agent (idempotent registration)
   * Returns the agent record and whether it was newly created
   */
  async createOrGet(
    agentId: string,
    capabilities: Capability[],
    signature: string,
    ipAddress: string | null
  ): Promise<{ agent: AgentRecord; isNew: boolean }> {
    // First, check for existing registration by signature
    const existing = await this.findBySignature(signature);
    
    if (existing) {
      // Update last_seen for existing agent
      await this.updateLastSeen(existing.id);
      return { agent: existing, isNew: false };
    }

    // Create new agent
    const agent = await this.create(agentId, capabilities, signature, ipAddress);
    return { agent, isNew: true };
  }

  /**
   * Count total agents
   */
  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM agents'
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Execute a query within a transaction
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Singleton instance
let repositoryInstance: AgentRepository | null = null;

/**
 * Get the singleton repository instance
 */
export function getAgentRepository(config?: DatabaseConfig): AgentRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AgentRepository(config);
  }
  return repositoryInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAgentRepository(): void {
  if (repositoryInstance) {
    repositoryInstance.close().catch(() => {});
    repositoryInstance = null;
  }
}
