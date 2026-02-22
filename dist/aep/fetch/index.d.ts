/**
 * Fetch API Endpoint for AEP Protocol
 *
 * Orchestrates signal extraction, experience matching, and GDI ranking
 * to handle /v1/fetch requests from agents.
 *
 * @module aep/fetch
 */
import { SignalExtractor, type Signal, type ExtractionResult } from '../signal';
import { ExperienceMatcher, type Experience, type MatchResult } from '../matcher';
/**
 * AEP envelope structure for fetch requests
 */
export interface AEPEnvelope {
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
    blast_radius?: {
        files: number;
        lines: number;
    };
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
/**
 * Agent validation function type
 */
export type AgentValidatorFn = (agentId: string) => Promise<boolean>;
/**
 * Agent last-seen update function type
 */
export type AgentUpdateFn = (agentId: string) => Promise<void>;
/**
 * Validation error for request validation failures
 */
export declare class ValidationError extends Error {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
/**
 * Unauthorized error for authentication failures
 */
export declare class UnauthorizedError extends Error {
    constructor(message: string);
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
export declare class FetchHandler {
    private readonly signalExtractor;
    private readonly experienceMatcher;
    private readonly validateAgent;
    private readonly updateAgentLastSeen;
    /**
     * Creates a new FetchHandler instance.
     *
     * @param options - Configuration options
     * @param options.signalExtractor - Custom signal extractor instance
     * @param options.experienceMatcher - Custom experience matcher instance
     * @param options.validateAgent - Function to validate agent existence
     * @param options.updateAgentLastSeen - Function to update agent's last seen timestamp
     */
    constructor(options?: {
        signalExtractor?: SignalExtractor;
        experienceMatcher?: ExperienceMatcher;
        validateAgent?: AgentValidatorFn;
        updateAgentLastSeen?: AgentUpdateFn;
    });
    /**
     * Handles a fetch request end-to-end.
     *
     * @param request - The fetch request envelope
     * @param context - Request context with headers
     * @returns Fetch response with ranked experiences
     * @throws ValidationError for validation failures
     * @throws UnauthorizedError for authentication failures
     */
    handle(request: AEPEnvelope, context?: FetchContext): Promise<FetchResponse>;
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
    handleSync(request: AEPEnvelope, experiences: Experience[], _context?: FetchContext): FetchResponse;
    /**
     * Authenticates the agent from the Authorization header.
     *
     * AC-FETCH-003: Validates agent authentication (Authorization header)
     *
     * @param context - Request context with headers
     * @throws UnauthorizedError if authentication fails
     */
    private authenticate;
    /**
     * Creates an error response from an error object.
     *
     * @param error - The error to convert
     * @returns Error response object
     */
    static createErrorResponse(error: unknown): FetchErrorResponse;
    /**
     * Gets the HTTP status code for an error.
     *
     * @param error - The error to get status code for
     * @returns HTTP status code
     */
    static getErrorStatusCode(error: unknown): number;
}
export declare const fetchHandler: FetchHandler;
export type { Signal, ExtractionResult, Experience, MatchResult };
export default FetchHandler;
//# sourceMappingURL=index.d.ts.map