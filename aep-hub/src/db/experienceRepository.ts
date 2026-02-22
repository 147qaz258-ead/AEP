import { Pool, PoolClient } from 'pg';
import {
  ExperienceRecord,
  BlastRadius,
} from '../types';

/**
 * Experience creation input
 */
export interface CreateExperienceInput {
  id: string;
  trigger: string;
  solution: string;
  confidence: number;
  creatorId: string;
  signalsMatch?: string[];
  geneId?: string;
  context?: Record<string, unknown>;
  blastRadius?: BlastRadius;
  contentHash: string;
}

/**
 * Experience repository for database operations
 */
export class ExperienceRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Find experience by content hash (for duplicate detection)
   */
  async findByContentHash(contentHash: string): Promise<ExperienceRecord | null> {
    const result = await this.pool.query<ExperienceRecord>(
      `SELECT id, trigger, solution, confidence, creator_id, status, gdi_score,
              signals_match, gene_id, context, blast_radius, content_hash,
              created_at, updated_at
       FROM experiences
       WHERE content_hash = $1`,
      [contentHash]
    );

    return result.rows[0] || null;
  }

  /**
   * Find experience by ID
   */
  async findById(experienceId: string): Promise<ExperienceRecord | null> {
    const result = await this.pool.query<ExperienceRecord>(
      `SELECT id, trigger, solution, confidence, creator_id, status, gdi_score,
              signals_match, gene_id, context, blast_radius, content_hash,
              created_at, updated_at
       FROM experiences
       WHERE id = $1`,
      [experienceId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new experience
   */
  async create(input: CreateExperienceInput): Promise<ExperienceRecord> {
    // Calculate initial GDI score: 0.5 * confidence
    const gdiScore = 0.5 * input.confidence;

    const result = await this.pool.query<ExperienceRecord>(
      `INSERT INTO experiences (
        id, trigger, solution, confidence, creator_id, status, gdi_score,
        signals_match, gene_id, context, blast_radius, content_hash,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'candidate', $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id, trigger, solution, confidence, creator_id, status, gdi_score,
                signals_match, gene_id, context, blast_radius, content_hash,
                created_at, updated_at`,
      [
        input.id,
        input.trigger,
        input.solution,
        input.confidence,
        input.creatorId,
        gdiScore,
        JSON.stringify(input.signalsMatch || null),
        input.geneId || null,
        JSON.stringify(input.context || null),
        JSON.stringify(input.blastRadius || null),
        input.contentHash,
      ]
    );

    return result.rows[0];
  }

  /**
   * Index signals for an experience
   */
  async indexSignals(experienceId: string, signals: string[]): Promise<void> {
    if (!signals || signals.length === 0) {
      return;
    }

    const values: (string | number)[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i].toLowerCase().trim();
      const baseIdx = i * 3;
      placeholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`);
      values.push(signal, experienceId, 1.0);
    }

    // Use ON CONFLICT DO NOTHING for idempotency
    await this.pool.query(
      `INSERT INTO signal_index (signal_key, experience_id, weight)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (signal_key, experience_id) DO NOTHING`,
      values
    );
  }

  /**
   * Create experience with signal indexing in a transaction
   */
  async createWithSignals(
    input: CreateExperienceInput
  ): Promise<ExperienceRecord> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create experience
      const gdiScore = 0.5 * input.confidence;

      const result = await client.query<ExperienceRecord>(
        `INSERT INTO experiences (
          id, trigger, solution, confidence, creator_id, status, gdi_score,
          signals_match, gene_id, context, blast_radius, content_hash,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'candidate', $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING id, trigger, solution, confidence, creator_id, status, gdi_score,
                  signals_match, gene_id, context, blast_radius, content_hash,
                  created_at, updated_at`,
        [
          input.id,
          input.trigger,
          input.solution,
          input.confidence,
          input.creatorId,
          gdiScore,
          JSON.stringify(input.signalsMatch || null),
          input.geneId || null,
          JSON.stringify(input.context || null),
          JSON.stringify(input.blastRadius || null),
          input.contentHash,
        ]
      );

      const experience = result.rows[0];

      // Index signals if present
      if (input.signalsMatch && input.signalsMatch.length > 0) {
        for (const signal of input.signalsMatch) {
          const signalKey = signal.toLowerCase().trim();
          await client.query(
            `INSERT INTO signal_index (signal_key, experience_id, weight)
             VALUES ($1, $2, $3)
             ON CONFLICT (signal_key, experience_id) DO NOTHING`,
            [signalKey, experience.id, 1.0]
          );
        }
      }

      await client.query('COMMIT');
      return experience;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Count total experiences
   */
  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM experiences'
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count experiences by status
   */
  async countByStatus(status: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM experiences WHERE status = $1',
      [status]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

// Singleton instance
let repositoryInstance: ExperienceRepository | null = null;

/**
 * Get the singleton experience repository instance
 * Requires the pool to be set on first call
 */
export function getExperienceRepository(pool?: Pool): ExperienceRepository {
  if (!repositoryInstance && pool) {
    repositoryInstance = new ExperienceRepository(pool);
  }

  if (!repositoryInstance) {
    throw new Error('ExperienceRepository not initialized. Call getExperienceRepository with a pool.');
  }

  return repositoryInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetExperienceRepository(): void {
  repositoryInstance = null;
}
