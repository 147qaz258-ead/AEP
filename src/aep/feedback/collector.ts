/**
 * Feedback Collector for AEP SDK (TypeScript)
 *
 * This module provides the FeedbackCollector class for managing explicit feedback collection.
 * Feedback is persisted to JSONL files in the .aep/feedback directory.
 *
 * @module aep/feedback/collector
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Feedback,
  FeedbackRating,
  FeedbackStats,
  FeedbackQuery,
  FeedbackQueryResult,
  ActionOutcome,
} from './types';

/**
 * Base exception for feedback-related errors
 */
export class FeedbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackError';
  }
}

/**
 * Raised when a feedback entry cannot be found
 */
export class FeedbackNotFoundError extends FeedbackError {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackNotFoundError';
  }
}

/**
 * Raised when invalid rating is provided
 */
export class InvalidRatingError extends FeedbackError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRatingError';
  }
}

/**
 * Feedback record structure for JSONL entries
 */
interface FeedbackRecord {
  _type: 'feedback';
  feedback: Feedback;
}

/**
 * Options for submitting explicit feedback
 */
export interface SubmitExplicitFeedbackOptions {
  /** ID of the session this feedback belongs to */
  session_id: string;
  /** ID of the agent that received the feedback */
  agent_id: string;
  /** ID of the action this feedback is for (optional) */
  action_id?: string;
  /** User's rating (1-5) */
  rating: FeedbackRating;
  /** User's comment (optional) */
  comment?: string;
  /** User ID (optional) */
  user_id?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generate a unique ID for feedback entries
 */
function generateFeedbackId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fb_${timestamp}_${random}`;
}

/**
 * Validate rating is within valid range (1-5)
 */
function validateRating(rating: number): asserts rating is FeedbackRating {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new InvalidRatingError(
      `Invalid rating: ${rating}. Rating must be an integer between 1 and 5.`
    );
  }
}

/**
 * Feedback collector for managing explicit feedback collection.
 *
 * This class handles submitting, retrieving, and analyzing user feedback.
 * Feedback is persisted to JSONL files in the .aep/feedback directory.
 *
 * @example
 * ```typescript
 * const collector = new FeedbackCollector('/path/to/project');
 *
 * // Submit feedback
 * const feedback = collector.submitExplicit({
 *   session_id: 'session_123',
 *   agent_id: 'agent_001',
 *   action_id: 'action_456',
 *   rating: 5,
 *   comment: 'Excellent response!',
 * });
 *
 * // Get feedback for an action
 * const actionFeedback = collector.getFeedback('action_456');
 *
 * // Get session statistics
 * const stats = collector.getStats('session_123');
 * ```
 */
export class FeedbackCollector {
  private _workspace: string;
  private storageDir: string;

  /**
   * Initialize the feedback collector.
   *
   * @param workspace - Path to the workspace directory
   * @param storageDir - Directory name for feedback storage (default: 'feedback')
   */
  constructor(workspace: string, storageDir: string = 'feedback') {
    this._workspace = workspace;
    this.storageDir = path.join(workspace, '.aep', storageDir);

    // Ensure feedback directory exists
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  /** Get the workspace path */
  get workspace(): string {
    return this._workspace;
  }

  /**
   * Submit explicit feedback for an action or session.
   *
   * Creates a new feedback entry and persists it to a JSONL file.
   *
   * @param options - Feedback submission options
   * @returns The created Feedback object
   * @throws InvalidRatingError if rating is not between 1-5
   */
  submitExplicit(options: SubmitExplicitFeedbackOptions): Feedback {
    validateRating(options.rating);

    const feedback: Feedback = {
      id: generateFeedbackId(),
      session_id: options.session_id,
      agent_id: options.agent_id,
      action_id: options.action_id,
      created_at: new Date().toISOString(),
      type: 'explicit',
      rating: options.rating,
      comment: options.comment,
      confidence: 1.0, // Explicit feedback has full confidence
      metadata: {
        ...options.metadata,
        user_id: options.user_id,
      },
    };

    // Persist to JSONL file
    this.appendFeedback(feedback);

    return feedback;
  }

  /**
   * Submit explicit feedback with simplified parameters.
   *
   * @param actionId - ID of the action this feedback is for
   * @param rating - User's rating (1-5)
   * @param comment - Optional comment
   * @param sessionId - Optional session ID
   * @param agentId - Optional agent ID (uses default if not provided)
   * @param userId - Optional user ID
   * @returns The created Feedback object
   */
  submit(
    actionId: string,
    rating: FeedbackRating,
    comment?: string,
    sessionId?: string,
    agentId?: string,
    userId?: string
  ): Feedback {
    return this.submitExplicit({
      session_id: sessionId ?? `session_${Date.now()}`,
      agent_id: agentId ?? 'default_agent',
      action_id: actionId,
      rating,
      comment,
      user_id: userId,
    });
  }

  /**
   * Get feedback for a specific action.
   *
   * @param actionId - The action ID to get feedback for
   * @returns The Feedback object, or null if not found
   */
  getFeedback(actionId: string): Feedback | null {
    const allFeedback = this.loadAllFeedback();
    return allFeedback.find((f) => f.action_id === actionId) ?? null;
  }

  /**
   * Get all feedback for a session.
   *
   * @param sessionId - The session ID to get feedback for
   * @returns Array of Feedback objects
   */
  getSessionFeedback(sessionId: string): Feedback[] {
    const allFeedback = this.loadAllFeedback();
    return allFeedback.filter((f) => f.session_id === sessionId);
  }

  /**
   * Get feedback statistics for a session.
   *
   * @param sessionId - The session ID to get statistics for
   * @returns FeedbackStats object with aggregated metrics
   */
  getStats(sessionId: string): FeedbackStats {
    const sessionFeedback = this.getSessionFeedback(sessionId);

    const explicitFeedback = sessionFeedback.filter((f) => f.type === 'explicit');
    const implicitFeedback = sessionFeedback.filter((f) => f.type === 'implicit');

    // Calculate rating distribution
    const ratingDistribution: Record<FeedbackRating, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalRating = 0;
    for (const f of explicitFeedback) {
      if (f.rating !== undefined) {
        ratingDistribution[f.rating]++;
        totalRating += f.rating;
      }
    }

    const avgRating =
      explicitFeedback.length > 0 ? totalRating / explicitFeedback.length : undefined;

    // Calculate outcome distribution
    const outcomeDistribution: Record<ActionOutcome, number> = {
      success: 0,
      failure: 0,
      partial: 0,
    };

    for (const f of implicitFeedback) {
      if (f.outcome !== undefined) {
        outcomeDistribution[f.outcome]++;
      }
    }

    // Calculate average confidence
    const totalConfidence = sessionFeedback.reduce((sum, f) => sum + f.confidence, 0);
    const avgConfidence =
      sessionFeedback.length > 0 ? totalConfidence / sessionFeedback.length : 0;

    return {
      total_feedback: sessionFeedback.length,
      explicit_count: explicitFeedback.length,
      implicit_count: implicitFeedback.length,
      avg_rating: avgRating,
      rating_distribution: ratingDistribution,
      outcome_distribution: outcomeDistribution,
      avg_confidence: avgConfidence,
    };
  }

  /**
   * Query feedback with filters.
   *
   * @param query - Query parameters
   * @returns FeedbackQueryResult with matching feedback entries
   */
  query(query: FeedbackQuery): FeedbackQueryResult {
    const startTime = Date.now();
    let feedbacks = this.loadAllFeedback();

    // Apply filters
    if (query.session_id !== undefined) {
      feedbacks = feedbacks.filter((f) => f.session_id === query.session_id);
    }
    if (query.action_id !== undefined) {
      feedbacks = feedbacks.filter((f) => f.action_id === query.action_id);
    }
    if (query.agent_id !== undefined) {
      feedbacks = feedbacks.filter((f) => f.agent_id === query.agent_id);
    }
    if (query.type !== undefined) {
      feedbacks = feedbacks.filter((f) => f.type === query.type);
    }
    if (query.rating !== undefined) {
      feedbacks = feedbacks.filter((f) => f.rating === query.rating);
    }
    if (query.outcome !== undefined) {
      feedbacks = feedbacks.filter((f) => f.outcome === query.outcome);
    }
    if (query.from_date !== undefined) {
      feedbacks = feedbacks.filter((f) => f.created_at >= query.from_date!);
    }
    if (query.to_date !== undefined) {
      feedbacks = feedbacks.filter((f) => f.created_at <= query.to_date!);
    }

    const total = feedbacks.length;

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? feedbacks.length;
    feedbacks = feedbacks.slice(offset, offset + limit);

    const queryTimeMs = Date.now() - startTime;

    return {
      feedbacks,
      total,
      query_time_ms: queryTimeMs,
    };
  }

  /**
   * Delete feedback by ID.
   *
   * @param feedbackId - The feedback ID to delete
   * @returns true if feedback was deleted, false if not found
   */
  deleteFeedback(feedbackId: string): boolean {
    const allFeedback = this.loadAllFeedback();
    const index = allFeedback.findIndex((f) => f.id === feedbackId);

    if (index === -1) {
      return false;
    }

    // Remove from list
    allFeedback.splice(index, 1);

    // Rewrite the file
    this.rewriteAllFeedback(allFeedback);

    return true;
  }

  /**
   * Get the storage file path for a session's feedback.
   */
  private getFeedbackFile(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.jsonl`);
  }

  /**
   * Get the global feedback file path.
   */
  private getGlobalFeedbackFile(): string {
    return path.join(this.storageDir, 'feedback.jsonl');
  }

  /**
   * Append a feedback entry to the JSONL file.
   */
  private appendFeedback(feedback: Feedback): void {
    const filePath = this.getGlobalFeedbackFile();
    const record: FeedbackRecord = {
      _type: 'feedback',
      feedback,
    };

    fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf-8');
  }

  /**
   * Load all feedback entries from storage.
   */
  private loadAllFeedback(): Feedback[] {
    const filePath = this.getGlobalFeedbackFile();

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    const feedbacks: Feedback[] = [];
    for (const line of lines) {
      try {
        const record = JSON.parse(line) as FeedbackRecord;
        if (record._type === 'feedback') {
          feedbacks.push(record.feedback);
        }
      } catch {
        // Skip malformed lines
      }
    }

    return feedbacks;
  }

  /**
   * Rewrite all feedback entries to the JSONL file.
   */
  private rewriteAllFeedback(feedbacks: Feedback[]): void {
    const filePath = this.getGlobalFeedbackFile();

    const lines = feedbacks.map((f) => {
      const record: FeedbackRecord = {
        _type: 'feedback',
        feedback: f,
      };
      return JSON.stringify(record);
    });

    if (lines.length === 0) {
      // Write empty file
      fs.writeFileSync(filePath, '', 'utf-8');
    } else {
      fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
    }
  }
}