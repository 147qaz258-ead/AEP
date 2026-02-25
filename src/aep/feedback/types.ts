/**
 * Feedback Module for AEP Protocol
 *
 * Provides feedback collection and management types for
 * capturing user feedback on agent actions and experiences.
 *
 * @module aep/feedback
 */

/**
 * Feedback type indicating the source of feedback.
 */
export type FeedbackType = 'explicit' | 'implicit';

/**
 * Feedback rating scale (1-5).
 */
export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

/**
 * Outcome type for action results.
 */
export type ActionOutcome = 'success' | 'failure' | 'partial';

/**
 * Represents a feedback entry for an action or session.
 */
export interface Feedback {
  /** Unique identifier for this feedback entry */
  id: string;
  /** ID of the session this feedback belongs to */
  session_id: string;
  /** ID of the action this feedback is for (optional) */
  action_id?: string;
  /** ID of the agent that received the feedback */
  agent_id: string;
  /** ISO 8601 timestamp when feedback was created */
  created_at: string;
  /** Type of feedback (explicit or implicit) */
  type: FeedbackType;
  /** User's rating (1-5, only for explicit feedback) */
  rating?: FeedbackRating;
  /** User's comment (optional, for explicit feedback) */
  comment?: string;
  /** Outcome inferred from user behavior (for implicit feedback) */
  outcome?: ActionOutcome;
  /** Confidence score of the feedback (0-1) */
  confidence: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating explicit feedback.
 */
export interface CreateExplicitFeedbackOptions {
  session_id: string;
  action_id?: string;
  agent_id: string;
  rating: FeedbackRating;
  comment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating implicit feedback.
 */
export interface CreateImplicitFeedbackOptions {
  session_id: string;
  action_id?: string;
  agent_id: string;
  outcome: ActionOutcome;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Feedback query parameters.
 */
export interface FeedbackQuery {
  /** Filter by session ID */
  session_id?: string;
  /** Filter by action ID */
  action_id?: string;
  /** Filter by agent ID */
  agent_id?: string;
  /** Filter by feedback type */
  type?: FeedbackType;
  /** Filter by rating (for explicit feedback) */
  rating?: FeedbackRating;
  /** Filter by outcome (for implicit feedback) */
  outcome?: ActionOutcome;
  /** Start date filter (ISO 8601) */
  from_date?: string;
  /** End date filter (ISO 8601) */
  to_date?: string;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Feedback query result.
 */
export interface FeedbackQueryResult {
  /** Matching feedback entries */
  feedbacks: Feedback[];
  /** Total number of matching entries */
  total: number;
  /** Query execution time in milliseconds */
  query_time_ms: number;
}

/**
 * Feedback statistics for a session or agent.
 */
export interface FeedbackStats {
  /** Total number of feedback entries */
  total_feedback: number;
  /** Number of explicit feedback entries */
  explicit_count: number;
  /** Number of implicit feedback entries */
  implicit_count: number;
  /** Average rating (1-5) for explicit feedback */
  avg_rating?: number;
  /** Distribution of ratings (for explicit feedback) */
  rating_distribution: Record<FeedbackRating, number>;
  /** Distribution of outcomes (for implicit feedback) */
  outcome_distribution: Record<ActionOutcome, number>;
  /** Average confidence score */
  avg_confidence: number;
}
