import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import {
  FeedbackRecord,
  FeedbackPayload,
  ExperienceWithStats,
  ExperienceStats,
  FeedbackOutcome,
} from '../types';

/**
 * Feedback creation input
 */
export interface CreateFeedbackInput {
  experienceId: string;
  agentId: string;
  outcome: FeedbackOutcome;
  score?: number;
  notes?: string;
}

/**
 * Generate unique feedback ID
 * Format: fb_{timestamp_ms}_{hash8}
 */
function generateFeedbackId(experienceId: string, agentId: string): string {
  const ts = Date.now();
  const hash = crypto
    .createHash('sha256')
    .update(`${experienceId}:${agentId}:${ts}`)
    .digest('hex');
  const hashSuffix = hash.substring(0, 8);
  return `fb_${ts}_${hashSuffix}`;
}

/**
 * Feedback repository for database operations
 */
export class FeedbackRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Check if feedback already exists for this agent/experience combination
   */
  async checkDuplicate(agentId: string, experienceId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM feedback WHERE agent_id = $1 AND experience_id = $2`,
      [agentId, experienceId]
    );
    return result.rows.length > 0;
  }

  /**
   * Find feedback by ID
   */
  async findById(feedbackId: string): Promise<FeedbackRecord | null> {
    const result = await this.pool.query<FeedbackRecord>(
      `SELECT id, experience_id, agent_id, outcome, score, notes, created_at
       FROM feedback
       WHERE id = $1`,
      [feedbackId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find experience with statistics by ID
   */
  async findExperienceWithStats(experienceId: string): Promise<ExperienceWithStats | null> {
    const result = await this.pool.query<ExperienceWithStats>(
      `SELECT id, trigger, solution, confidence, creator_id, status, gdi_score,
              signals_match, gene_id, context, blast_radius, content_hash,
              created_at, updated_at,
              COALESCE(total_uses, 0) as total_uses,
              COALESCE(total_success, 0) as total_success,
              COALESCE(total_feedback, 0) as total_feedback,
              COALESCE(positive_feedback, 0) as positive_feedback,
              COALESCE(success_streak, 0) as success_streak,
              COALESCE(consecutive_failures, 0) as consecutive_failures,
              last_used_at, last_gdi_update
       FROM experiences
       WHERE id = $1`,
      [experienceId]
    );

    return result.rows[0] || null;
  }

  /**
   * Submit feedback with atomic stats update and GDI recalculation
   */
  async submitFeedbackWithStats(
    input: CreateFeedbackInput,
    gdiScore: number,
    newStatus: string,
    previousStatus: string
  ): Promise<{ feedback: FeedbackRecord; stats: ExperienceStats }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Insert feedback record
      const feedbackId = generateFeedbackId(input.experienceId, input.agentId);

      const feedbackResult = await client.query<FeedbackRecord>(
        `INSERT INTO feedback (id, experience_id, agent_id, outcome, score, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, experience_id, agent_id, outcome, score, notes, created_at`,
        [
          feedbackId,
          input.experienceId,
          input.agentId,
          input.outcome,
          input.score ?? null,
          input.notes ?? null,
        ]
      );

      const feedback = feedbackResult.rows[0];

      // 2. Update experience statistics
      const isPositive =
        input.outcome === 'success' ||
        (input.outcome === 'partial' && (input.score ?? 0) >= 0.5);

      // Determine if status changed and set appropriate timestamp
      const statusChanged = newStatus !== previousStatus;
      const promotedAtUpdate = statusChanged && newStatus === 'promoted' ? 'NOW()' : 'promoted_at';
      const deprecatedAtUpdate = statusChanged && newStatus === 'deprecated' ? 'NOW()' : 'deprecated_at';

      const statsResult = await client.query<ExperienceStats>(
        `UPDATE experiences
         SET
           total_uses = COALESCE(total_uses, 0) + 1,
           total_success = COALESCE(total_success, 0) + CASE WHEN $1 = 'success' THEN 1 ELSE 0 END,
           total_feedback = COALESCE(total_feedback, 0) + 1,
           positive_feedback = COALESCE(positive_feedback, 0) + CASE WHEN $2 THEN 1 ELSE 0 END,
           success_streak = CASE
             WHEN $1 = 'success' THEN COALESCE(success_streak, 0) + 1
             WHEN $1 = 'failure' THEN 0
             ELSE COALESCE(success_streak, 0)
           END,
           consecutive_failures = CASE
             WHEN $1 = 'failure' THEN COALESCE(consecutive_failures, 0) + 1
             WHEN $1 = 'success' THEN 0
             ELSE COALESCE(consecutive_failures, 0)
           END,
           last_used_at = NOW(),
           last_gdi_update = NOW(),
           gdi_score = $3,
           status = $4,
           promoted_at = CASE WHEN $5 THEN NOW() ELSE promoted_at END,
           deprecated_at = CASE WHEN $6 THEN NOW() ELSE deprecated_at END,
           updated_at = NOW()
         WHERE id = $7
         RETURNING
           COALESCE(total_uses, 0) as total_uses,
           COALESCE(total_success, 0) as total_success,
           COALESCE(total_feedback, 0) as total_feedback,
           COALESCE(positive_feedback, 0) as positive_feedback,
           COALESCE(success_streak, 0) as success_streak,
           COALESCE(consecutive_failures, 0) as consecutive_failures`,
        [
          input.outcome,
          isPositive,
          gdiScore,
          newStatus,
          statusChanged && newStatus === 'promoted',
          statusChanged && newStatus === 'deprecated',
          input.experienceId,
        ]
      );

      const stats = statsResult.rows[0];

      await client.query('COMMIT');
      return { feedback, stats };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Count total feedback
   */
  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM feedback'
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count feedback by outcome
   */
  async countByOutcome(outcome: FeedbackOutcome): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM feedback WHERE outcome = $1',
      [outcome]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

// Singleton instance
let repositoryInstance: FeedbackRepository | null = null;

/**
 * Get the singleton feedback repository instance
 * Requires the pool to be set on first call
 */
export function getFeedbackRepository(pool?: Pool): FeedbackRepository {
  if (!repositoryInstance && pool) {
    repositoryInstance = new FeedbackRepository(pool);
  }

  if (!repositoryInstance) {
    throw new Error('FeedbackRepository not initialized. Call getFeedbackRepository with a pool.');
  }

  return repositoryInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetFeedbackRepository(): void {
  repositoryInstance = null;
}
