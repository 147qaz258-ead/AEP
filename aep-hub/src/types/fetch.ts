/**
 * Fetch API Types
 *
 * Type definitions for the /v1/fetch endpoint
 */

/**
 * AEP envelope structure for fetch requests
 */
export interface FetchRequest {
  protocol: 'aep';
  version: string;
  type: 'fetch';
  sender: string;
  timestamp: string;
  payload: FetchPayload;
}

/**
 * Payload for fetch requests
 */
export interface FetchPayload {
  signals: string[];
  limit?: number;
  include_candidates?: boolean;
}

/**
 * Request context including headers
 */
export interface FetchContext {
  authorization?: string;
  requestId?: string;
}

/**
 * Summary of an experience returned in fetch response
 */
export interface ExperienceSummary {
  id: string;
  trigger: string;
  solution: string;
  confidence: number;
  creator: string;
  gdi_score: number;
  success_streak: number;
  signals_match: string[];
  summary?: string;
  blast_radius?: { files: number; lines: number };
}

/**
 * Successful fetch response
 */
export interface FetchResponse {
  experiences: ExperienceSummary[];
  count: number;
  query_id: string;
  latency_ms: number;
  suggestion?: string;
}

/**
 * Error response structure
 */
export interface FetchErrorResponse {
  error: string;
  message: string;
  field?: string;
}
