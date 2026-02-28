/**
 * Action Logger for AEP SDK (TypeScript)
 *
 * This module provides the ActionLogger class for recording agent actions
 * to session files.
 * @module aep/session/action-logger
 */
import { createAgentAction, } from './types';
import { SessionNotActiveError } from './recorder';
/**
 * Error thrown when writing to session file fails
 */
export class WriteError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WriteError';
    }
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
export class ActionLogger {
    constructor(recorderOrOptions) {
        if ('recorder' in recorderOrOptions) {
            this._recorder = recorderOrOptions.recorder;
        }
        else {
            this._recorder = recorderOrOptions;
        }
    }
    /**
     * Get the underlying SessionRecorder.
     */
    get recorder() {
        return this._recorder;
    }
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
    logAction(action) {
        const sessionId = this._recorder.getActiveSession();
        if (!sessionId) {
            throw new SessionNotActiveError('No active session. Call startSession() first.');
        }
        // Measure latency
        const startTime = performance.now();
        try {
            this._recorder.recordAction(action);
        }
        catch (e) {
            throw new WriteError(`Failed to write action: ${e}`);
        }
        const latencyMs = performance.now() - startTime;
        // Log warning if latency exceeds threshold (100ms)
        if (latencyMs > 100) {
            // In production, this would use proper logging
            // TODO: Add logging when logging module is integrated
        }
        return action.id;
    }
    logToolCall(optionsOrToolName, trigger, solution, result, context) {
        let toolName;
        let ctx;
        let resultValue;
        if (typeof optionsOrToolName === 'string') {
            // Legacy signature
            toolName = optionsOrToolName;
            ctx = context || {};
            resultValue = this.parseResult(result || 'success');
        }
        else {
            // Options object
            const options = optionsOrToolName;
            toolName = options.toolName;
            trigger = options.trigger;
            solution = options.solution;
            ctx = options.context || {};
            resultValue = this.parseResult(options.result || 'success');
        }
        ctx['tool_name'] = toolName;
        ctx['tools_used'] = ctx['tools_used'] || [toolName];
        const action = createAgentAction({
            action_type: 'tool_call',
            trigger: trigger,
            solution: solution,
            result: resultValue,
            context: ctx,
        });
        return this.logAction(action);
    }
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
    log_tool_call(log) {
        const ctx = {
            tool_name: log.tool_name,
            tool_arguments: log.arguments,
            tool_result: log.result,
            tools_used: [log.tool_name],
        };
        // Add optional fields
        if (log.error !== undefined) {
            ctx['tool_error'] = log.error;
        }
        if (log.duration_ms !== undefined) {
            ctx['duration_ms'] = log.duration_ms;
        }
        // Determine result status based on error presence
        const resultValue = log.error ? 'failure' : 'success';
        // Create trigger and solution from tool call info
        const trigger = `Tool call: ${log.tool_name}`;
        const solution = log.error
            ? `Error: ${log.error}`
            : `Executed ${log.tool_name} successfully`;
        const action = createAgentAction({
            action_type: 'tool_call',
            trigger,
            solution,
            result: resultValue,
            context: ctx,
        });
        return this.logAction(action);
    }
    logMessage(optionsOrTrigger, solution, result, context) {
        let trigger;
        let ctx;
        let resultValue;
        if (typeof optionsOrTrigger === 'string') {
            // Legacy signature
            trigger = optionsOrTrigger;
            ctx = context || {};
            resultValue = this.parseResult(result || 'success');
        }
        else {
            // Options object
            const options = optionsOrTrigger;
            trigger = options.trigger;
            solution = options.solution;
            ctx = options.context || {};
            resultValue = this.parseResult(options.result || 'success');
        }
        const action = createAgentAction({
            action_type: 'message',
            trigger,
            solution: solution,
            result: resultValue,
            context: ctx,
        });
        return this.logAction(action);
    }
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
    log_message(log) {
        const MAX_MESSAGE_SIZE = 10000; // 10KB limit
        // Truncate messages if too long
        const truncateMessage = (msg) => {
            if (msg.length > MAX_MESSAGE_SIZE) {
                return msg.substring(0, MAX_MESSAGE_SIZE) + '...[truncated]';
            }
            return msg;
        };
        const ctx = {
            user_message: truncateMessage(log.user_message),
            agent_message: truncateMessage(log.agent_message),
            ...log.context,
        };
        // Add optional fields
        if (log.tokens_used !== undefined) {
            ctx['tokens_used'] = log.tokens_used;
        }
        if (log.model !== undefined) {
            ctx['model'] = log.model;
        }
        // Determine result status
        const resultValue = log.result || 'success';
        // Create trigger and solution from message info
        const trigger = `User: ${truncateMessage(log.user_message.substring(0, 100))}`;
        const solution = `Agent: ${truncateMessage(log.agent_message.substring(0, 100))}`;
        const action = createAgentAction({
            action_type: 'message',
            trigger,
            solution,
            result: resultValue,
            context: ctx,
        });
        return this.logAction(action);
    }
    logDecision(optionsOrTrigger, solution, result, context) {
        let trigger;
        let ctx;
        let resultValue;
        if (typeof optionsOrTrigger === 'string') {
            // Legacy signature
            trigger = optionsOrTrigger;
            ctx = context || {};
            resultValue = this.parseResult(result || 'success');
        }
        else {
            // Options object
            const options = optionsOrTrigger;
            trigger = options.trigger;
            solution = options.solution;
            ctx = options.context || {};
            resultValue = this.parseResult(options.result || 'success');
        }
        const action = createAgentAction({
            action_type: 'decision',
            trigger,
            solution: solution,
            result: resultValue,
            context: ctx,
        });
        return this.logAction(action);
    }
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
    log_decision(log) {
        const ctx = {
            ...log.context,
        };
        // Add optional fields
        if (log.options !== undefined) {
            ctx['options'] = log.options;
        }
        if (log.selected_option !== undefined) {
            ctx['selected_option'] = log.selected_option;
        }
        if (log.reasoning !== undefined) {
            ctx['reasoning'] = log.reasoning;
        }
        if (log.confidence !== undefined) {
            // Validate confidence is between 0 and 1
            const confidence = Math.max(0, Math.min(1, log.confidence));
            ctx['confidence'] = confidence;
        }
        // Determine result status
        const resultValue = log.result || 'success';
        // Create trigger and solution from decision info
        const trigger = log.options
            ? `Decision needed: ${log.options.length} options available`
            : 'Decision made';
        const solution = log.reasoning
            ? `Selected option ${log.selected_option ?? '?'}: ${log.reasoning.substring(0, 100)}`
            : `Selected option ${log.selected_option ?? '?'}`;
        const action = createAgentAction({
            action_type: 'decision',
            trigger,
            solution,
            result: resultValue,
            context: ctx,
        });
        return this.logAction(action);
    }
    /**
     * Get an action from the current session by ID.
     *
     * @param actionId - The action ID to look up
     * @returns The AgentAction if found, undefined otherwise
     */
    getAction(actionId) {
        const sessionId = this._recorder.getActiveSession();
        if (!sessionId) {
            return undefined;
        }
        const session = this._recorder.getSession(sessionId);
        if (!session) {
            return undefined;
        }
        // Search through actions in the session
        return session.actions.find((action) => action.id === actionId);
    }
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
    updateAction(actionId, updates) {
        const sessionId = this._recorder.getActiveSession();
        if (!sessionId) {
            return false;
        }
        const session = this._recorder.getSession(sessionId);
        if (!session) {
            return false;
        }
        // Find and update the action
        const action = session.actions.find((a) => a.id === actionId);
        if (!action) {
            return false;
        }
        // Update allowed fields
        if (updates.trigger !== undefined) {
            action.trigger = updates.trigger;
        }
        if (updates.solution !== undefined) {
            action.solution = updates.solution;
        }
        if (updates.result !== undefined) {
            action.result = this.parseResult(updates.result);
        }
        if (updates.context !== undefined) {
            action.context = { ...action.context, ...updates.context };
        }
        if (updates.feedback !== undefined) {
            action.feedback = updates.feedback;
        }
        return true;
    }
    /**
     * Get the count of actions in the current session.
     *
     * @returns Number of actions, or 0 if no active session
     */
    getActionCount() {
        const sessionId = this._recorder.getActiveSession();
        if (!sessionId) {
            return 0;
        }
        const session = this._recorder.getSession(sessionId);
        if (!session) {
            return 0;
        }
        return session.actions.length;
    }
    /**
     * Parse a result string into an ActionResult.
     *
     * @param result - Result string or ActionResult
     * @returns ActionResult value
     */
    parseResult(result) {
        if (result === 'success' ||
            result === 'failure' ||
            result === 'partial') {
            return result;
        }
        return result;
    }
}
//# sourceMappingURL=action-logger.js.map