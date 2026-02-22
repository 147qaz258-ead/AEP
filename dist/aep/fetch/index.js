/**
 * Fetch API Endpoint for AEP Protocol
 *
 * Orchestrates signal extraction, experience matching, and GDI ranking
 * to handle /v1/fetch requests from agents.
 *
 * @module aep/fetch
 */
import { SignalExtractor } from '../signal';
import { ExperienceMatcher, } from '../matcher';
/**
 * Validation error for request validation failures
 */
export class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.field = field;
        this.name = 'ValidationError';
    }
}
/**
 * Unauthorized error for authentication failures
 */
export class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}
/**
 * Generates a unique query ID for tracking.
 * Format: q_{timestamp}_{random_hex}
 *
 * @returns Query ID string
 */
function generateQueryId() {
    const timestamp = Math.floor(Date.now());
    const randomHex = Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `q_${timestamp}_${randomHex}`;
}
/**
 * Validates the AEP envelope structure.
 *
 * AC-FETCH-002: Validates AEP envelope format (protocol, version, type, sender)
 *
 * @param envelope - The envelope to validate
 * @throws ValidationError if envelope is invalid
 */
function validateEnvelope(envelope) {
    if (envelope.protocol !== 'aep') {
        throw new ValidationError("protocol must be 'aep'", 'protocol');
    }
    if (!envelope.version || typeof envelope.version !== 'string') {
        throw new ValidationError('version is required', 'version');
    }
    if (envelope.type !== 'fetch') {
        throw new ValidationError("type must be 'fetch'", 'type');
    }
    if (!envelope.sender || typeof envelope.sender !== 'string') {
        throw new ValidationError('sender (agent_id) is required', 'sender');
    }
    if (!envelope.timestamp || typeof envelope.timestamp !== 'string') {
        throw new ValidationError('timestamp is required', 'timestamp');
    }
}
/**
 * Validates the fetch payload.
 *
 * AC-FETCH-004: Validates signals array is non-empty
 * AC-FETCH-005: Validates limit parameter range [1, 50]
 *
 * @param payload - The payload to validate
 * @throws ValidationError if payload is invalid
 */
function validatePayload(payload) {
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
 * Extracts agent ID from Authorization header.
 *
 * @param authHeader - Authorization header value
 * @returns Agent ID or null if invalid
 */
function extractAgentId(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') {
        return null;
    }
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7).trim() || null;
}
/**
 * Converts a matcher MatchResult to an ExperienceSummary.
 *
 * @param result - Match result from the matcher
 * @returns Experience summary for API response
 */
function toExperienceSummary(result) {
    const exp = result.experience;
    return {
        id: exp.id,
        trigger: exp.trigger,
        solution: exp.solution,
        confidence: exp.confidence,
        creator: exp.creator,
        gdi_score: exp.gdi_score,
        success_streak: exp.success_streak,
        signals_match: result.signals_matched?.length > 0
            ? result.signals_matched
            : exp.signals_match,
        // summary and blast_radius are optional - would come from full experience data
    };
}
/**
 * Fetch Handler class for processing /v1/fetch requests.
 *
 * Implements the full fetch flow:
 * 1. Validate AEP envelope
 * 2. Authenticate agent
 * 3. Validate payload
 * 4. Extract signals from raw input
 * 5. Match experiences
 * 6. Rank by GDI and return top N
 *
 * @example
 * ```typescript
 * const handler = new FetchHandler({
 *   validateAgent: async (id) => db.agentExists(id),
 *   updateAgentLastSeen: async (id) => db.updateLastSeen(id),
 * });
 *
 * const response = await handler.handle(request, { authorization: 'Bearer agent_123' });
 * ```
 */
export class FetchHandler {
    /**
     * Creates a new FetchHandler instance.
     *
     * @param options - Configuration options
     * @param options.signalExtractor - Custom signal extractor instance
     * @param options.experienceMatcher - Custom experience matcher instance
     * @param options.validateAgent - Function to validate agent existence
     * @param options.updateAgentLastSeen - Function to update agent's last seen timestamp
     */
    constructor(options) {
        this.signalExtractor = options?.signalExtractor ?? new SignalExtractor();
        this.experienceMatcher = options?.experienceMatcher ?? new ExperienceMatcher();
        // Default: accept all agents
        this.validateAgent = options?.validateAgent ?? (async () => true);
        // Default: no-op for last seen update
        this.updateAgentLastSeen = options?.updateAgentLastSeen ?? (async () => { });
    }
    /**
     * Handles a fetch request end-to-end.
     *
     * @param request - The fetch request envelope
     * @param context - Request context with headers
     * @returns Fetch response with ranked experiences
     * @throws ValidationError for validation failures
     * @throws UnauthorizedError for authentication failures
     */
    async handle(request, context) {
        const startTime = performance.now();
        // 1. Validate AEP envelope
        validateEnvelope(request);
        // 2. Authenticate agent from Authorization header
        await this.authenticate(context);
        // 3. Validate payload
        validatePayload(request.payload);
        // 4. Get limit with default
        const limit = request.payload.limit ?? 5;
        // 5. Extract signals from raw input
        const rawSignalsText = request.payload.signals.join(' ');
        const extractionResult = this.signalExtractor.extractSignals(rawSignalsText);
        // 6. Build match request
        const matchRequest = {
            signals: extractionResult.signals,
            limit,
            include_candidates: request.payload.include_candidates,
            status_filter: request.payload.include_candidates
                ? undefined
                : ['promoted'],
        };
        // 7. Match experiences
        const matchResults = await this.experienceMatcher.match(matchRequest);
        // 8. Build response
        const experiences = matchResults.map(toExperienceSummary);
        const latencyMs = performance.now() - startTime;
        const queryId = generateQueryId();
        const response = {
            experiences,
            count: experiences.length,
            query_id: queryId,
            latency_ms: Math.round(latencyMs * 100) / 100,
        };
        // 9. Add suggestion for empty results (AC-FETCH-009)
        if (experiences.length === 0) {
            response.suggestion = 'No matching experiences found. Consider publishing your solution.';
        }
        return response;
    }
    /**
     * Handles a fetch request with in-memory experiences (synchronous version).
     *
     * Useful for testing or when experiences are already loaded in memory.
     *
     * @param request - The fetch request envelope
     * @param experiences - Array of experiences to search
     * @param context - Request context with headers
     * @returns Fetch response with ranked experiences
     * @throws ValidationError for validation failures
     * @throws UnauthorizedError for authentication failures
     */
    handleSync(request, experiences, _context) {
        const startTime = performance.now();
        // 1. Validate AEP envelope
        validateEnvelope(request);
        // 2. Authenticate agent (sync wrapper)
        // Note: In sync mode, we skip async agent validation
        // 3. Validate payload
        validatePayload(request.payload);
        // 4. Get limit with default
        const limit = request.payload.limit ?? 5;
        // 5. Extract signals from raw input
        const rawSignalsText = request.payload.signals.join(' ');
        const extractionResult = this.signalExtractor.extractSignals(rawSignalsText);
        // 6. Build match request
        const matchRequest = {
            signals: extractionResult.signals,
            limit,
            include_candidates: request.payload.include_candidates,
            status_filter: request.payload.include_candidates
                ? undefined
                : ['promoted'],
        };
        // 7. Match experiences synchronously
        const matchResults = this.experienceMatcher.matchSync(matchRequest, experiences);
        // 8. Build response
        const responseExperiences = matchResults.map(toExperienceSummary);
        const latencyMs = performance.now() - startTime;
        const queryId = generateQueryId();
        const response = {
            experiences: responseExperiences,
            count: responseExperiences.length,
            query_id: queryId,
            latency_ms: Math.round(latencyMs * 100) / 100,
        };
        // 9. Add suggestion for empty results (AC-FETCH-009)
        if (responseExperiences.length === 0) {
            response.suggestion = 'No matching experiences found. Consider publishing your solution.';
        }
        return response;
    }
    /**
     * Authenticates the agent from the Authorization header.
     *
     * AC-FETCH-003: Validates agent authentication (Authorization header)
     *
     * @param context - Request context with headers
     * @throws UnauthorizedError if authentication fails
     */
    async authenticate(context) {
        const agentId = extractAgentId(context?.authorization);
        if (!agentId) {
            throw new UnauthorizedError('Missing or invalid Authorization header');
        }
        // Validate agent exists
        const isValid = await this.validateAgent(agentId);
        if (!isValid) {
            throw new UnauthorizedError(`Invalid agent_id: ${agentId}`);
        }
        // Update last_seen
        await this.updateAgentLastSeen(agentId);
        return agentId;
    }
    /**
     * Creates an error response from an error object.
     *
     * @param error - The error to convert
     * @returns Error response object
     */
    static createErrorResponse(error) {
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
     *
     * @param error - The error to get status code for
     * @returns HTTP status code
     */
    static getErrorStatusCode(error) {
        if (error instanceof ValidationError) {
            return 400;
        }
        if (error instanceof UnauthorizedError) {
            return 401;
        }
        return 500;
    }
}
// Export singleton instance for convenience
export const fetchHandler = new FetchHandler();
// Default export
export default FetchHandler;
//# sourceMappingURL=index.js.map