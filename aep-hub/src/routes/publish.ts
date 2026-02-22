import { Request, Response, Router } from 'express';
import * as crypto from 'crypto';
import {
  PublishRequest,
  PublishResponse,
  PublishDuplicateResponse,
  ErrorResponse,
  ExperienceRecord,
} from '../types';
import {
  validatePublishRequest,
  validatePublishAuthorization,
} from '../utils';
import { getAgentRepository, getExperienceRepository } from '../db';
import { publishRateLimiter } from '../middleware';

// Hub version from environment or default
const HUB_VERSION = process.env.HUB_VERSION || '1.0.0';

/**
 * Generate unique experience ID
 * Format: exp_{timestamp_ms}_{hash8}
 */
function generateExperienceId(trigger: string, solution: string): string {
  const ts = Date.now();
  const contentHash = computeContentHash(trigger, solution);
  const hashSuffix = contentHash.substring(0, 8);
  return `exp_${ts}_${hashSuffix}`;
}

/**
 * Compute content hash for duplicate detection
 */
function computeContentHash(trigger: string, solution: string): string {
  const normalized = (trigger + solution).toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Create the publish router
 */
export function createPublishRouter(): Router {
  const router = Router();

  /**
   * POST /v1/publish
   *
   * Experience publishing endpoint.
   * Validates the AEP envelope, checks for duplicates, stores experiences, and returns experience IDs.
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
      // Step 1: Validate authorization (before rate limiting to get agent ID)
      const authResult = validatePublishAuthorization(req);
      if (!authResult.valid) {
        res.status(401).json(authResult.error);
        return;
      }

      const agentId = authResult.agentId;

      // Step 2: Check rate limit using agent ID
      const rateLimitResult = publishRateLimiter.check(agentId);
      if (!rateLimitResult.allowed) {
        res.status(429).json({
          error: 'rate_limited',
          message: `Publish rate limit exceeded. Maximum 10 requests per minute.`,
          retry_after: rateLimitResult.retryAfter,
        });
        return;
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', 10);
      res.setHeader('X-RateLimit-Remaining', publishRateLimiter.getRemaining(agentId));

      // Step 3: Validate request body
      const validationResult = validatePublishRequest(req.body);

      if (!validationResult.valid) {
        res.status(400).json(validationResult.error);
        return;
      }

      const validatedRequest: PublishRequest = validationResult.request;

      // Step 4: Verify sender matches authorization
      if (validatedRequest.sender !== agentId) {
        const errorResponse: ErrorResponse = {
          error: 'unauthorized',
          message: 'Sender ID does not match authorization',
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Step 5: Verify agent exists and has publish capability
      const agentRepo = getAgentRepository();
      const agent = await agentRepo.findById(agentId);

      if (!agent) {
        const errorResponse: ErrorResponse = {
          error: 'unauthorized',
          message: 'Agent not registered',
        };
        res.status(401).json(errorResponse);
        return;
      }

      if (!agent.capabilities.includes('publish')) {
        const errorResponse: ErrorResponse = {
          error: 'forbidden',
          message: 'Agent does not have publish capability',
        };
        res.status(403).json(errorResponse);
        return;
      }

      const payload = validatedRequest.payload;

      // Step 6: Check for duplicate
      const contentHash = computeContentHash(payload.trigger, payload.solution);
      const expRepo = getExperienceRepository();
      const existingExperience = await expRepo.findByContentHash(contentHash);

      if (existingExperience) {
        // Return existing experience (200 OK with duplicate=true)
        const duplicateResponse: PublishDuplicateResponse = {
          experience_id: existingExperience.id,
          status: existingExperience.status as 'candidate' | 'promoted',
          created_at: existingExperience.created_at.toISOString(),
          duplicate: true,
          message: 'Similar experience already exists. Use existing experience_id.',
        };

        console.log(`[PUBLISH] Duplicate detected: ${existingExperience.id} from agent ${agentId} (${Date.now() - startTime}ms)`);

        res.status(200).json(duplicateResponse);
        return;
      }

      // Step 7: Generate experience ID
      const experienceId = generateExperienceId(payload.trigger, payload.solution);

      // Step 8: Store experience with signals
      const newExperience = await expRepo.createWithSignals({
        id: experienceId,
        trigger: payload.trigger,
        solution: payload.solution,
        confidence: payload.confidence,
        creatorId: agentId,
        signalsMatch: payload.signals_match,
        geneId: payload.gene,
        context: payload.context,
        blastRadius: payload.blast_radius,
        contentHash,
      });

      // Step 9: Return success response (201 Created)
      const successResponse: PublishResponse = {
        experience_id: newExperience.id,
        status: 'candidate',
        created_at: newExperience.created_at.toISOString(),
        duplicate: false,
        message: 'Experience published successfully. Awaiting community validation.',
      };

      console.log(`[PUBLISH] Experience created: ${newExperience.id} from agent ${agentId} (${Date.now() - startTime}ms)`);

      res.status(201).json(successResponse);

    } catch (error) {
      console.error('[PUBLISH] Error processing publish request:', error);

      // Internal server error
      const errorResponse: ErrorResponse = {
        error: 'internal_error',
        message: 'An unexpected error occurred while publishing experience',
      };

      res.status(500).json(errorResponse);
    }
  });

  return router;
}

// Export default router instance
export const publishRouter = createPublishRouter();
