import express, { Express, Request, Response, NextFunction } from 'express';
import { helloRouter, publishRouter, agentRouter, feedbackRouter } from './routes';

// Hub version from environment or default
const HUB_VERSION = process.env.HUB_VERSION || '1.0.0';
const PORT = process.env.PORT || 3000;

/**
 * Create and configure the Express application
 */
export function createApp(): Express {
  const app = express();

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: '1mb' }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Log after response
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      version: HUB_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  // API version endpoint
  app.get('/v1', (_req: Request, res: Response) => {
    res.json({
      version: HUB_VERSION,
      protocol: 'aep',
      endpoints: [
        'POST /v1/hello - Agent registration',
        'POST /v1/publish - Experience publishing',
        'POST /v1/feedback - Feedback submission',
        'GET /v1/agent/:agentId - Agent lookup',
        'HEAD /v1/agent/:agentId - Agent validation',
      ],
    });
  });

  // Mount route handlers
  app.use('/v1/hello', helloRouter);
  app.use('/v1/publish', publishRouter);
  app.use('/v1/feedback', feedbackRouter);
  app.use('/v1/agent', agentRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'not_found',
      message: `Endpoint ${req.method} ${req.path} not found`,
    });
  });

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[ERROR]', err);
    
    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred',
    });
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(): Express {
  const app = createApp();
  
  app.listen(PORT, () => {
    console.log(`[AEP Hub] Server started on port ${PORT}`);
    console.log(`[AEP Hub] Version: ${HUB_VERSION}`);
    console.log(`[AEP Hub] Health: http://localhost:${PORT}/health`);
  });

  return app;
}

// Start server if this is the main module
if (require.main === module) {
  startServer();
}

export default createApp;
