import { Request, Response, Router } from 'express';
import { AgentIdentityService, getAgentIdentityService } from '../services';
import { ErrorResponse } from '../types';

/**
 * Create the agent router for identity-related endpoints
 */
export function createAgentRouter(): Router {
  const router = Router();
  const identityService = getAgentIdentityService();

  /**
   * GET /v1/agent/:agentId
   *
   * Look up an agent by ID.
   * Returns agent information if found.
   */
  router.get('/:agentId', async (req: Request, res: Response): Promise<void> => {
    try {
      const { agentId } = req.params;

      // Validate format first
      if (!AgentIdentityService.isValidFormat(agentId)) {
        const errorResponse: ErrorResponse = {
          error: 'invalid_agent_id',
          message: `Invalid agent ID format: ${agentId}`,
        };
        res.status(400).json(errorResponse);
        return;
      }

      const agent = await identityService.getAgent(agentId);

      if (!agent) {
        const errorResponse: ErrorResponse = {
          error: 'agent_not_found',
          message: `Agent not found: ${agentId}`,
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Return agent info (excluding sensitive data)
      res.status(200).json({
        id: agent.id,
        capabilities: agent.capabilities,
        created_at: agent.created_at.toISOString(),
        last_seen: agent.last_seen.toISOString(),
      });

    } catch (error) {
      console.error('[AGENT] Error looking up agent:', error);

      const errorResponse: ErrorResponse = {
        error: 'internal_error',
        message: 'An unexpected error occurred during agent lookup',
      };

      res.status(500).json(errorResponse);
    }
  });

  /**
   * HEAD /v1/agent/:agentId
   *
   * Check if an agent exists and is valid.
   * Returns 200 if valid, 404 if not found.
   */
  router.head('/:agentId', async (req: Request, res: Response): Promise<void> => {
    try {
      const { agentId } = req.params;

      const isValid = await identityService.validateAgent(agentId);

      if (isValid) {
        res.status(200).send();
      } else {
        res.status(404).send();
      }

    } catch (error) {
      console.error('[AGENT] Error validating agent:', error);
      res.status(500).send();
    }
  });

  return router;
}

// Export default router instance
export const agentRouter = createAgentRouter();
