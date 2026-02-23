import { Request, Response, Router } from 'express';
import {
  FetchRequest,
  FetchPayload,
  ExperienceSummary,
  FetchResponse,
  FetchErrorResponse,
} from '../types';
import { ErrorResponse } from '../types';
import { getAgentRepository, getExperienceRepository } from '../db';

// Hub version from environment or default
const HUB_VERSION = process.env.HUB_VERSION || '1.0.0';

/**
 * Validation error for request validation failures
 */
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Unauthorized error for authentication failures
 */
class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Generates a unique query ID for tracking.
 * Format: q_{timestamp}_{random_hex}
 */
function generateQueryId(): string {
  const timestamp = Math.floor(Date.now());
  const randomHex = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return `q_${timestamp}_${randomHex}`;
}

/**
 * Extracts agent ID from Authorization header.
 */
function extractAgentIdFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7).trim() || null;
}

/**
 * Validates the AEP envelope structure.
 */
function validateEnvelope(request: FetchRequest): void {
  if (request.protocol !== 'aep') {
    throw new ValidationError("protocol must be 'aep'", 'protocol');
  }

  if (!request.version || typeof request.version !== 'string') {
    throw new ValidationError('version is required', 'version');
  }

  if (request.type !== 'fetch') {
    throw new ValidationError("type must be 'fetch'", 'type');
  }

  if (!request.sender || typeof request.sender !== 'string') {
    throw new ValidationError('sender (agent_id) is required', 'sender');
  }

  if (!request.timestamp || typeof request.timestamp !== 'string') {
    throw new ValidationError('timestamp is required', 'timestamp');
  }
}

/**
 * Validates the fetch payload.
 */
function validatePayload(payload: FetchPayload): void {
  if (!payload) {
    throw new ValidationError('payload is required', 'payload');
  }

  if (!Array.isArray(payload.signals)) {
    throw new ValidationError('signals must be an array', 'payload.signals');
  }

  if (payload.signals.length === 0) {
    throw new ValidationError('signals array must not be empty', 'payload.signals');
  }

  // Validate each signal is a non-empty string
  for (let i = 0; i < payload.signals.length; i++) {
    const signal = payload.signals[i];
    if (typeof signal !== 'string') {
      throw new ValidationError(`signals[${i}] must be a string`, `payload.signals[${i}]`);
    }
    if (!signal.trim()) {
      throw new ValidationError(`signals[${i}] cannot be empty`, `payload.signals[${i}]`);
    }
  }

  // Validate limit if provided
  if (payload.limit !== undefined) {
    if (typeof payload.limit !== 'number' || !Number.isInteger(payload.limit)) {
      throw new ValidationError('limit must be an integer', 'payload.limit');
    }
    if (payload.limit < 1 || payload.limit > 50) {
      throw new ValidationError('limit must be between 1 and 50', 'payload.limit');
    }
  }
}

/**
 * Creates an error response from an error object.
 */
function createErrorResponse(error: unknown): FetchErrorResponse {
  if (error instanceof ValidationError) {
    return {
      error: 'invalid_request',
      message: error.message,
      field: error.field,
    };
  }

  if (error instanceof UnauthorizedError) {
    return {
      error: 'unauthorized',
      message: error.message,
    };
  }

  // Generic internal error
  return {
    error: 'internal_error',
    message: 'An internal error occurred',
  };
}

/**
 * Gets the HTTP status code for an error.
 */
function getErrorStatusCode(error: unknown): number {
  if (error instanceof ValidationError) {
    return 400;
  }

  if (error instanceof UnauthorizedError) {
    return 401;
  }

  return 500;
}

/**
 * Create the fetch router
 */
export function createFetchRouter(): Router {
  const router = Router();

  /**
   * POST /v1/fetch
   *
   * Experience retrieval endpoint.
   * Validates the AEP envelope, authenticates agent, matches experiences, and returns ranked results.
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      // Step 1: Extract and validate Authorization header
      const agentId = extractAgentIdFromHeader(req.headers.authorization);

      if (!agentId) {
        const errorResponse: ErrorResponse = {
          error: 'unauthorized',
          message: 'Missing or invalid Authorization header. Use: Bearer <agent_id>',
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Step 2: Verify agent exists and has fetch capability
      const agentRepo = getAgentRepository();
      const agent = await agentRepo.findById(agentId);

      if (!agent) {
        throw new UnauthorizedError('Agent not registered');
      }

      if (!agent.capabilities.includes('fetch')) {
        throw new UnauthorizedError('Agent does not have fetch capability');
      }

      // Step 3: Validate request body
      const request = req.body as FetchRequest;

      if (!request || typeof request !== 'object') {
        throw new ValidationError('Request body is required and must be a valid AEP envelope');
      }

      // Step 4: Validate envelope and payload
      validateEnvelope(request);
      validatePayload(request.payload);

      // Step 5: Get limit with default
      const limit = request.payload.limit ?? 5;

      // Step 6: Search experiences by signals
      // Normalize signals for matching
      const signals = request.payload.signals.map(s => s.toLowerCase().trim());

      // Build query to find experiences matching any of the signals
      const expRepo = getExperienceRepository();

      // Use signal_index table for efficient signal matching
      const result = await expRepo['pool'].query(
        `SELECT DISTINCT e.id, e.trigger, e.solution, e.confidence, e.creator_id,
                e.status, e.gdi_score, e.signals_match, e.context, e.blast_radius,
                e.created_at, e.updated_at,
                COUNT(si.signal_key) as signal_matches
         FROM experiences e
         JOIN signal_index si ON si.experience_id = e.id
         WHERE si.signal_key = ANY($1)
           AND ($2 = true OR e.status = 'promoted')
         GROUP BY e.id, e.trigger, e.solution, e.confidence, e.creator_id,
                  e.status, e.gdi_score, e.signals_match, e.context, e.blast_radius,
                  e.created_at, e.updated_at
         ORDER BY signal_matches DESC, e.gdi_score DESC
         LIMIT $3`,
        [signals, request.payload.include_candidates ?? false, limit]
      );

      // Step 7: Build response
      const experiences: ExperienceSummary[] = result.rows.map((row: any) => ({
        id: row.id,
        trigger: row.trigger,
        solution: row.solution,
        confidence: row.confidence,
        creator: row.creator_id,
        gdi_score: row.gdi_score,
        success_streak: 0, // TODO: Calculate from feedback
        signals_match: row.signals_match || [],
        blast_radius: row.blast_radius || undefined,
      }));

      const latencyMs = performance.now() - startTime;
      const queryId = generateQueryId();

      const response: FetchResponse = {
        experiences,
        count: experiences.length,
        query_id: queryId,
        latency_ms: Math.round(latencyMs * 100) / 100,
      };

      // Add suggestion for empty results
      if (experiences.length === 0) {
        response.suggestion = 'No matching experiences found. Consider publishing your solution.';
      }

      // Update agent last_seen
      await agentRepo.updateLastSeen(agentId);

      // Log successful fetch
      console.log(
        `[FETCH] Agent ${agentId} fetched ${response.count} experiences (query: ${queryId}, ${Math.round(latencyMs)}ms)`
      );

      // Step 8: Return success response
      res.status(200).json(response);

    } catch (error) {
      console.error('[FETCH] Error processing fetch request:', error);

      // Convert errors to HTTP responses
      const errorResponse = createErrorResponse(error);
      const statusCode = getErrorStatusCode(error);

      res.status(statusCode).json(errorResponse);
    }
  });

  return router;
}

// Export default router instance
export const fetchRouter = createFetchRouter();
