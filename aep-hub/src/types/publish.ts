/**
 * Experience Types for AEP Protocol
 *
 * Type definitions for experience publishing and retrieval
 */

import { AEPEnvelope } from './index';

/**
 * Blast radius of changes for an experience
 */
export interface BlastRadius {
  files: number;
  lines: number;
}

/**
 * Payload for publishing an experience
 */
export interface PublishPayload {
  trigger: string;
  solution: string;
  confidence: number;
  signals_match?: string[];
  gene?: string;
  context?: Record<string, unknown>;
  blast_radius?: BlastRadius;
}

/**
 * Request for publishing an experience
 */
export interface PublishRequest extends AEPEnvelope {
  type: 'publish';
  sender: string; // agent_id
  payload: PublishPayload;
}

/**
 * Response for successful publish (new experience)
 */
export interface PublishResponse {
  experience_id: string;
  status: 'candidate';
  created_at: string; // ISO 8601
  duplicate: false;
  message: string;
}

/**
 * Response for duplicate publish (existing experience)
 */
export interface PublishDuplicateResponse {
  experience_id: string;
  status: 'candidate' | 'promoted';
  created_at: string; // ISO 8601
  duplicate: true;
  message: string;
}

/**
 * Response for rate limited request
 */
export interface RateLimitResponse {
  error: 'rate_limited';
  message: string;
  retry_after: number; // seconds
}

/**
 * Experience database record
 */
export interface ExperienceRecord {
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
  blast_radius: BlastRadius | null;
  content_hash: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Validation error response
 */
export interface PublishValidationErrorResponse {
  error: 'validation_error';
  message: 'Validation failed';
  field_errors: Record<string, string[]>;
  warnings?: string[];
}
