import { Request, Response, Router } from 'express';
import {
  FeedbackRequest,
  FeedbackResponse,
  ErrorResponse,
  ExperienceWithStats,
  ExperienceStats,
} from '../types';
import {
  validateFeedbackRequest,
  validatePublishAuthorization,
} from '../utils';
import { getAgentRepository, getFeedbackRepository } from '../db';
import {
  GDIUpdateService,
  getGDIUpdateService,
  GDIUpdateResult,
} from '../services';

// Hub version from environment or default
const HUB_VERSION = process.env.HUB_VERSION || '1.0.0';

// GDI Update Service instance
const gdiUpdateService = getGDIUpdateService();

/**
 * Calculate reward points for feedback submission
 */
function calculateReward(
  outcome: string,
  experience: ExperienceWithStats,
  isFirstFeedback: boolean,
  notes?: string
): number {
  const baseReward = 10;
  const bonuses: number[] = [];

  // First feedback bonus
  if (isFirstFeedback) {
    bonuses.push(5);
  }

  // Success outcome multiplier
  if (outcome === 'success') {
    bonuses.push(Math.floor(baseReward * 0.5)); // +5
  }

  // Promoted experience bonus
  if (experience.status === 'promoted') {
    bonuses.push(3);
  }

  // Detailed notes bonus (>50 chars)
  if (notes && notes.length > 50) {
    bonuses.push(2);
  }

  const totalReward = baseReward + bonuses.reduce((sum, b) => sum + b, 0);
  return Math.min(totalReward, 25); // Cap at 25 points
}

/**
 * Create the feedback router
 */
export function createFeedbackRouter(): Router {
  const router = Router();

  /**
   * POST /v1/feedback
   *
   * Feedback submission endpoint.
   * Validates feedback, checks for duplicates, updates experience stats, and triggers GDI recalculation.
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
      // Step 1: Validate authorization
      const authResult = validatePublishAuthorization(req);
      if (!authResult.valid) {
        res.status(401).json(authResult.error);
        return;
      }

      const agentId = authResult.agentId;

      // Step 2: Validate request body
      const validationResult = validateFeedbackRequest(req.body);

      if (!validationResult.valid) {
        res.status(400).json(validationResult.error);
        return;
      }

      const validatedRequest: FeedbackRequest = validationResult.request!;

      // Step 3: Verify sender matches authorization
      if (validatedRequest.sender !== agentId) {
        const errorResponse: ErrorResponse = {
          error: 'unauthorized',
          message: 'Sender ID does not match authorization',
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Step 4: Verify agent exists and has feedback capability
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

      if (!agent.capabilities.includes('feedback')) {
        const errorResponse: ErrorResponse = {
          error: 'forbidden',
          message: 'Agent does not have feedback capability',
        };
        res.status(403).json(errorResponse);
        return;
      }

      const payload = validatedRequest.payload;

      // Step 5: Check for duplicate feedback
      const feedbackRepo = getFeedbackRepository();
      const isDuplicate = await feedbackRepo.checkDuplicate(agentId, payload.experience_id);

      if (isDuplicate) {
        const errorResponse: ErrorResponse = {
          error: 'conflict',
          message: 'Feedback already submitted for this experience by this agent',
        };
        res.status(409).json(errorResponse);
        return;
      }

      // Step 6: Verify experience exists
      const experience = await feedbackRepo.findExperienceWithStats(payload.experience_id);

      if (!experience) {
        const errorResponse: ErrorResponse = {
          error: 'not_found',
          message: `Experience '${payload.experience_id}' not found`,
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Step 7: Use GDI Update Service to calculate new GDI and check status changes
      const gdiResult = gdiUpdateService.updateOnFeedback({
        experience,
        outcome: payload.outcome,
        score: payload.score,
      });

      const newGdiScore = gdiResult.new_gdi;
      const previousStatus = gdiResult.previous_status;
      const newStatus = gdiResult.new_status ?? previousStatus;

      // Step 8: Determine if this is the first feedback
      const isFirstFeedback = experience.total_uses === 0;

      // Step 9: Calculate reward
      const reward = calculateReward(
        payload.outcome,
        experience,
        isFirstFeedback,
        payload.notes
      );

      // Step 10: Store feedback and update stats atomically
      const { feedback, stats } = await feedbackRepo.submitFeedbackWithStats(
        {
          experienceId: payload.experience_id,
          agentId,
          outcome: payload.outcome,
          score: payload.score,
          notes: payload.notes,
        },
        newGdiScore,
        newStatus,
        previousStatus
      );

      // Step 11: Return success response
      const successResponse: FeedbackResponse = {
        feedback_id: feedback.id,
        reward_earned: reward,
        updated_stats: stats,
        previous_status: previousStatus,
        new_status: newStatus as 'candidate' | 'promoted' | 'deprecated',
      };

      console.log(
        `[FEEDBACK] Feedback submitted: ${feedback.id} for experience ${payload.experience_id} by agent ${agentId} (GDI: ${gdiResult.previous_gdi.toFixed(4)} -> ${gdiResult.new_gdi.toFixed(4)}, Status: ${previousStatus} -> ${newStatus}) (${Date.now() - startTime}ms)`
      );

      res.status(201).json(successResponse);
    } catch (error) {
      console.error('[FEEDBACK] Error processing feedback request:', error);

      // Internal server error
      const errorResponse: ErrorResponse = {
        error: 'internal_error',
        message: 'An unexpected error occurred while processing feedback',
      };

      res.status(500).json(errorResponse);
    }
  });

  return router;
}

// Export default router instance
export const feedbackRouter = createFeedbackRouter();
