import { Request, Response, Router } from 'express';
import { HelloRequest, HelloResponse, ErrorResponse } from '../types';
import { validateHelloRequest, generateAgentId, computeRegistrationSignature } from '../utils';
import { getAgentRepository } from '../db';

// Hub version from environment or default
const HUB_VERSION = process.env.HUB_VERSION || '1.0.0';

/**
 * Create the hello router
 */
export function createHelloRouter(): Router {
  const router = Router();

  /**
   * POST /v1/hello
   * 
   * Agent registration endpoint.
   * Validates the AEP envelope, generates unique agent IDs, and returns registration response.
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // Get client IP for signature computation
      const clientIp = req.ip || req.socket.remoteAddress || null;

      // Validate the request
      const validationResult = validateHelloRequest(req.body, clientIp || undefined);
      
      if (!validationResult.valid) {
        res.status(400).json(validationResult.error);
        return;
      }

      const validatedRequest: HelloRequest = validationResult.request;
      const { capabilities } = validatedRequest.payload;

      // Compute registration signature for idempotency
      const signature = computeRegistrationSignature(capabilities, clientIp);

      // Generate a new agent ID
      const newAgentId = generateAgentId();

      // Get repository and perform idempotent registration
      const repository = getAgentRepository();
      const { agent, isNew } = await repository.createOrGet(
        newAgentId,
        capabilities,
        signature,
        clientIp
      );

      // Log registration (for observability)
      console.log(`[HELLO] Agent ${agent.id} ${isNew ? 'registered' : 're-registered'} from ${clientIp || 'unknown'} (${Date.now() - startTime}ms)`);

      // Build success response
      const response: HelloResponse = {
        status: 'registered',
        agent_id: agent.id,
        hub_version: HUB_VERSION,
        registered_at: agent.created_at.toISOString(),
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('[HELLO] Error processing registration:', error);
      
      // Internal server error
      const errorResponse: ErrorResponse = {
        error: 'internal_error',
        message: 'An unexpected error occurred during registration',
      };
      
      res.status(500).json(errorResponse);
    }
  });

  return router;
}

// Export default router instance
export const helloRouter = createHelloRouter();
