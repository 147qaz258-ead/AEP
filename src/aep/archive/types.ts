/**
 * Archive Module for AEP Protocol
 *
 * Provides session summary and archival types for long-term storage
 * and analytics of agent experience data.
 *
 * @module aep/archive
 */

/**
 * Outcome type for action results
 */
export type ActionOutcome = 'success' | 'failure' | 'partial';

/**
 * Represents a key action taken during the session.
 */
export interface KeyAction {
  /** What triggered this action */
  trigger: string;
  /** The solution or approach taken */
  solution: string;
  /** The result of the action */
  result: string;
}

/**
 * Session summary for archival and knowledge extraction.
 * This is the simplified format for session archiving.
 */
export interface SessionSummary {
  /** Unique identifier for this summary */
  id: string;
  /** ID of the original session */
  session_id: string;
  /** ID of the agent that handled the session */
  agent_id: string;
  /** ISO 8601 timestamp when the summary was created */
  created_at: string;
  /** Human-readable title of the session */
  title: string;
  /** Description of the problem being solved */
  problem: string;
  /** Description of the solution implemented */
  solution: string;
  /** Outcome status of the session */
  outcome: ActionOutcome;
  /** Key actions taken during the session */
  key_actions: KeyAction[];
  /** Signal patterns extracted from the session */
  signals: string[];
  /** Total number of actions taken */
  action_count: number;
  /** Duration of the session in seconds */
  duration_seconds: number;
  /** Optional feedback score (1-5 scale) */
  feedback_score?: number;
}

/**
 * Summary statistics for a session (detailed version)
 */
export interface SessionStats {
  /** Total number of actions in the session */
  total_actions: number;
  /** Number of successful actions */
  success_count: number;
  /** Number of failed actions */
  failure_count: number;
  /** Number of partial success actions */
  partial_count: number;
  /** Average action duration in milliseconds */
  avg_duration_ms: number;
  /** Total tokens consumed (if applicable) */
  total_tokens?: number;
  /** Average confidence score across all actions */
  avg_confidence: number;
}

/**
 * Top signals extracted during the session
 */
export interface TopSignal {
  /** Signal type */
  type: string;
  /** Signal value */
  value: string;
  /** Number of times this signal appeared */
  count: number;
  /** Average weight of the signal */
  avg_weight: number;
}

/**
 * Feedback summary for the session
 */
export interface FeedbackSummary {
  /** Total number of feedback entries */
  total_feedback: number;
  /** Number of explicit feedback entries */
  explicit_count: number;
  /** Number of implicit feedback entries */
  implicit_count: number;
  /** Average rating (1-5) for explicit feedback */
  avg_rating?: number;
  /** Distribution of outcome types */
  outcome_distribution: Record<ActionOutcome, number>;
  /** Average confidence score */
  avg_confidence: number;
}

/**
 * Experience record summary for archival
 */
export interface ExperienceSummary {
  /** Experience ID */
  id: string;
  /** Number of times this experience was matched */
  match_count: number;
  /** Average relevance score when matched */
  avg_relevance: number;
  /** Last match timestamp (ISO 8601) */
  last_matched_at?: string;
  /** Whether the experience is deprecated */
  deprecated: boolean;
}

/**
 * Detailed session summary for archival and analytics.
 * Extended version with full statistics and feedback details.
 */
export interface DetailedSessionSummary {
  /** Unique session identifier */
  session_id: string;
  /** Session start timestamp (ISO 8601) */
  started_at: string;
  /** Session end timestamp (ISO 8601) */
  ended_at: string;
  /** Session duration in milliseconds */
  duration_ms: number;
  /** Agent identifier */
  agent_id: string;
  /** Project/context identifier */
  project_id?: string;
  /** User identifier (if available) */
  user_id?: string;
  /** Session status */
  status: 'active' | 'completed' | 'abandoned' | 'error';
  /** Session statistics */
  stats: SessionStats;
  /** Top signals extracted during session */
  top_signals: TopSignal[];
  /** Feedback summary */
  feedback_summary: FeedbackSummary;
  /** Experience records summary */
  experience_summaries: ExperienceSummary[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Archive version for schema evolution */
  archive_version: string;
}

/**
 * Archive query parameters
 */
export interface ArchiveQuery {
  /** Filter by session ID */
  session_id?: string;
  /** Filter by agent ID */
  agent_id?: string;
  /** Filter by project ID */
  project_id?: string;
  /** Filter by user ID */
  user_id?: string;
  /** Filter by status */
  status?: DetailedSessionSummary['status'];
  /** Filter by outcome */
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
 * Archive query result
 */
export interface ArchiveQueryResult {
  /** Matching session summaries */
  sessions: SessionSummary[];
  /** Total number of matching sessions */
  total: number;
  /** Query execution time in milliseconds */
  query_time_ms: number;
}

/**
 * Options for creating a session summary.
 */
export interface CreateSessionSummaryOptions {
  session_id: string;
  agent_id: string;
  title: string;
  problem: string;
  solution: string;
  outcome: ActionOutcome;
  key_actions: KeyAction[];
  signals: string[];
  action_count: number;
  duration_seconds: number;
  feedback_score?: number;
}

/**
 * Current archive schema version
 */
export const ARCHIVE_VERSION = '1.0.0';
