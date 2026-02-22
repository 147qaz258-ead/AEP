/**
 * Feedback Types for AEP Protocol
 *
 * Type definitions for experience feedback submission
 */

import { AEPEnvelope } from './index';

/**
 * Valid feedback outcome values
 */
export type FeedbackOutcome = 'success' | 'failure' | 'partial';

/**
 * Payload for submitting feedback
 */
export interface FeedbackPayload {
  experience_id: string;
  outcome: FeedbackOutcome;
  score?: number;  // 0.0 - 1.0
  notes?: string;
}

/**
 * Request for submitting feedback
 */
export interface FeedbackRequest extends AEPEnvelope {
  type: 'feedback';
  sender: string; // agent_id
  payload: FeedbackPayload;
}

/**
 * Experience statistics returned in feedback response
 */
export interface ExperienceStats {
  total_uses: number;
  total_success: number;
  total_feedback: number;
  positive_feedback: number;
  success_streak: number;
  consecutive_failures: number;
}

/**
 * Response for successful feedback submission
 */
export interface FeedbackResponse {
  feedback_id: string;
  reward_earned: number;
  updated_stats: ExperienceStats;
  previous_status: 'candidate' | 'promoted' | 'deprecated';
  new_status: 'candidate' | 'promoted' | 'deprecated';
}

/**
 * Feedback database record
 */
export interface FeedbackRecord {
  id: string;
  experience_id: string;
  agent_id: string;
  outcome: FeedbackOutcome;
  score: number | null;
  notes: string | null;
  created_at: Date;
}

/**
 * Experience record with statistics
 */
export interface ExperienceWithStats {
  id: string;
  trigger: string;
  solution: string;
  confidence: number;
  creator_id: string;
  status: 'candidate' | 'promoted' | 'deprecated';
  gdi_score: number;
  signals_match: string[] | null;
  gene_id: string | null;
  context: Record<string, unknown> | null;
  blast_radius: { files: number; lines: number } | null;
  content_hash: string;
  created_at: Date;
  updated_at: Date;
  // Stats fields
  total_uses: number;
  total_success: number;
  total_feedback: number;
  positive_feedback: number;
  success_streak: number;
  consecutive_failures: number;
  last_used_at: Date | null;
  last_gdi_update: Date | null;
}

/**
 * Validation error response for feedback
 */
export interface FeedbackValidationErrorResponse {
  error: 'validation_error';
  message: 'Validation failed';
  field_errors: Record<string, string[]>;
}
