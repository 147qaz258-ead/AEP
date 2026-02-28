/**
 * Action Logger for AEP SDK (TypeScript)
 *
 * This module provides the ActionLogger class for recording agent actions
 * to session files.
 * @module aep/session/action-logger
 */
import { AgentAction, ActionResult } from './types';
import { SessionRecorder } from './recorder';
/**
 * Error thrown when writing to session file fails
 */
export declare class WriteError extends Error {
    constructor(message: string);
}
/**
 * Options for creating an ActionLogger
 */
export interface ActionLoggerOptions {
    /** The SessionRecorder instance to use for persisting actions */
    recorder: SessionRecorder;
}
/**
 * Options for logging a tool call
 */
export interface ToolCallOptions {
    /** Name of the tool that was called */
    toolName: string;
    /** What triggered this tool call */
    trigger: string;
    /** What the tool did or returned */
    solution: string;
    /** Result status (default: 'success') */
    result?: ActionResult | 'success' | 'failure' | 'partial';
    /** Optional additional context */
    context?: Record<string, unknown>;
}
/**
 * Structured log entry for tool calls.
 * Provides a convenient way to log tool calls with detailed execution info.
 *
 * @example
 * ```typescript
 * logger.log_tool_call({
 *   tool_name: 'read_file',
 *   arguments: { path: '/src/index.ts' },
 *   result: { content: '...' },
 *   duration_ms: 150
 * });
 * ```
 */
export interface ToolCallLog {
    /** Name of the tool that was called */
    tool_name: string;
    /** Arguments passed to the tool */
    arguments: Record<string, any>;
    /** Result returned by the tool */
    result: any;
    /** Error message if the tool call failed */
    error?: string;
    /** Duration of the tool call in milliseconds */
    duration_ms?: number;
}
/**
 * Options for logging a message
 */
export interface MessageOptions {
    /** What triggered this message (e.g., user question) */
    trigger: string;
    /** The message content or response */
    solution: string;
    /** Result status (default: 'success') */
    result?: ActionResult | 'success' | 'failure' | 'partial';
    /** Optional additional context */
    context?: Record<string, unknown>;
}
/**
 * Structured log entry for messages.
 * Provides a convenient way to log conversations with detailed info.
 *
 * @example
 * ```typescript
 * logger.log_message({
 *   user_message: 'What is the capital of France?',
 *   agent_message: 'The capital of France is Paris.',
 *   tokens_used: 25,
 *   model: 'claude-3-opus'
 * });
 * ```
 */
export interface MessageLog {
    /** The user's input message */
    user_message: string;
    /** The agent's response message */
    agent_message: string;
    /** Number of tokens used (optional) */
    tokens_used?: number;
    /** Model identifier (optional) */
    model?: string;
    /** Additional context (optional) */
    context?: Record<string, unknown>;
    /** Result status (default: 'success') */
    result?: 'success' | 'failure' | 'partial';
}
/**
 * Options for logging a decision
 */
export interface DecisionOptions {
    /** What triggered this decision */
    trigger: string;
    /** The decision that was made */
    solution: string;
    /** Result status (default: 'success') */
    result?: ActionResult | 'success' | 'failure' | 'partial';
    /** Optional additional context */
    context?: Record<string, unknown>;
}
/**
 * Structured log entry for decisions.
 * Provides a convenient way to log decisions with detailed reasoning info.
 *
 * @example
 * ```typescript
 * logger.log_decision({
 *   options: ['Option A', 'Option B', 'Option C'],
 *   selected_option: 1,
 *   reasoning: 'Option B provides the best balance of performance and cost',
 *   confidence: 0.85
 * });
 * ```
 */
export interface DecisionLog {
    /** Available options at decision time */
    options?: string[];
    /** Index of the selected option */
    selected_option?: number;
    /** Reasoning for the decision */
    reasoning?: string;
    /** Confidence level (0-1) */
    confidence?: number;
    /** Additional context (optional) */
    context?: Record<string, unknown>;
    /** Result status (default: 'success') */
    result?: 'success' | 'failure' | 'partial';
}
/**
 * Action logger for recording agent actions to session files.
 *
 * This class provides convenient methods for logging different types of
 * agent actions (tool calls, messages, decisions) to the active session.
 *
 * @example
 * ```typescript
 * const recorder = new SessionRecorder(workspace, agentId);
 * recorder.startSession();
 *
 * const logger = new ActionLogger(recorder);
 * const actionId = logger.logToolCall({
 *   toolName: 'bash',
 *   trigger: 'File not found',
 *   solution: 'Create file',
 *   result: 'success'
 * });
 * ```
 */
export declare class ActionLogger {
    private _recorder;
    /**
     * Initialize the action logger.
     *
     * @param recorder - The SessionRecorder instance to use for persisting actions
     */
    constructor(recorder: SessionRecorder);
    /**
     * Initialize the action logger with options.
     *
     * @param options - Configuration options
     */
    constructor(options: ActionLoggerOptions);
    /**
     * Get the underlying SessionRecorder.
     */
    get recorder(): SessionRecorder;
    /**
     * Record an action to the active session.
     *
     * This is the general method for recording any AgentAction.
     * Use convenience methods (logToolCall, logMessage, logDecision)
     * for common action types.
     *
     * @param action - The AgentAction to record
     * @returns The action ID
     * @throws SessionNotActiveError if no session is currently active
     * @throws WriteError if writing to the session file fails
     */
    logAction(action: AgentAction): string;
    /**
     * Convenience method to log a tool call action.
     *
     * @param options - Tool call options
     * @returns The action ID
     */
    logToolCall(options: ToolCallOptions): string;
    /**
     * Convenience method to log a tool call action (legacy signature).
     *
     * @param toolName - Name of the tool that was called
     * @param trigger - What triggered this tool call
     * @param solution - What the tool did or returned
     * @param result - Result status (default: 'success')
     * @param context - Optional additional context
     * @returns The action ID
     * @deprecated Use options object instead
     */
    logToolCall(toolName: string, trigger: string, solution: string, result?: ActionResult | 'success' | 'failure' | 'partial', context?: Record<string, unknown>): string;
    /**
     * Log a tool call with structured execution details.
     *
     * This method provides a convenient way to record tool calls with
     * detailed information including arguments, results, errors, and duration.
     *
     * @param log - The tool call log entry
     * @returns The action ID
     *
     * @example
     * ```typescript
     * // Successful tool call
     * logger.log_tool_call({
     *   tool_name: 'read_file',
     *   arguments: { path: '/src/index.ts' },
     *   result: { content: '...' },
     *   duration_ms: 150
     * });
     *
     * // Failed tool call
     * logger.log_tool_call({
     *   tool_name: 'bash',
     *   arguments: { command: 'npm test' },
     *   result: null,
     *   error: 'Command failed with exit code 1',
     *   duration_ms: 5230
     * });
     * ```
     */
    log_tool_call(log: ToolCallLog): string;
    /**
     * Convenience method to log a message action.
     *
     * @param options - Message options
     * @returns The action ID
     */
    logMessage(options: MessageOptions): string;
    /**
     * Convenience method to log a message action (legacy signature).
     *
     * @param trigger - What triggered this message (e.g., user question)
     * @param solution - The message content or response
     * @param result - Result status (default: 'success')
     * @param context - Optional additional context
     * @returns The action ID
     * @deprecated Use options object instead
     */
    logMessage(trigger: string, solution: string, result?: ActionResult | 'success' | 'failure' | 'partial', context?: Record<string, unknown>): string;
    /**
     * Log a message with structured conversation details.
     *
     * This method provides a convenient way to record messages with
     * detailed information including user input, agent response,
     * token usage, and model info.
     *
     * Messages longer than 10KB are automatically truncated.
     *
     * @param log - The message log entry
     * @returns The action ID
     *
     * @example
     * ```typescript
     * // Basic message logging
     * logger.log_message({
     *   user_message: 'What is the capital of France?',
     *   agent_message: 'The capital of France is Paris.',
     *   tokens_used: 25,
     *   model: 'claude-3-opus'
     * });
     *
     * // With failure result
     * logger.log_message({
     *   user_message: 'Complex query...',
     *   agent_message: 'Error: Unable to process',
     *   result: 'failure'
     * });
     * ```
     */
    log_message(log: MessageLog): string;
    /**
     * Convenience method to log a decision action.
     *
     * @param options - Decision options
     * @returns The action ID
     */
    logDecision(options: DecisionOptions): string;
    /**
     * Convenience method to log a decision action (legacy signature).
     *
     * @param trigger - What triggered this decision
     * @param solution - The decision that was made
     * @param result - Result status (default: 'success')
     * @param context - Optional additional context
     * @returns The action ID
     * @deprecated Use options object instead
     */
    logDecision(trigger: string, solution: string, result?: ActionResult | 'success' | 'failure' | 'partial', context?: Record<string, unknown>): string;
    /**
     * Log a decision with structured decision details.
     *
     * This method provides a convenient way to record decisions with
     * detailed information including options, selected option, reasoning,
     * and confidence level.
     *
     * @param log - The decision log entry
     * @returns The action ID
     *
     * @example
     * ```typescript
     * // Decision with options and reasoning
     * logger.log_decision({
     *   options: ['Option A', 'Option B', 'Option C'],
     *   selected_option: 1,
     *   reasoning: 'Option B provides the best balance of performance and cost',
     *   confidence: 0.85
     * });
     *
     * // Decision with partial confidence
     * logger.log_decision({
     *   options: ['Approach X', 'Approach Y'],
     *   selected_option: 0,
     *   reasoning: 'Chose X for simplicity',
     *   confidence: 0.6,
     *   result: 'partial'
     * });
     * ```
     */
    log_decision(log: DecisionLog): string;
    /**
     * Get an action from the current session by ID.
     *
     * @param actionId - The action ID to look up
     * @returns The AgentAction if found, undefined otherwise
     */
    getAction(actionId: string): AgentAction | undefined;
    /**
     * Update an existing action.
     *
     * This is primarily used for adding feedback to actions.
     *
     * Note: This method modifies the session in memory. The changes are
     * persisted when the session is ended.
     *
     * @param actionId - The ID of the action to update
     * @param updates - Dictionary of fields to update
     * @returns True if the action was found and updated, false otherwise
     */
    updateAction(actionId: string, updates: Partial<{
        trigger: string;
        solution: string;
        result: ActionResult | 'success' | 'failure' | 'partial';
        context: Record<string, unknown>;
        feedback: unknown;
    }>): boolean;
    /**
     * Get the count of actions in the current session.
     *
     * @returns Number of actions, or 0 if no active session
     */
    getActionCount(): number;
    /**
     * Parse a result string into an ActionResult.
     *
     * @param result - Result string or ActionResult
     * @returns ActionResult value
     */
    private parseResult;
}
//# sourceMappingURL=action-logger.d.ts.map