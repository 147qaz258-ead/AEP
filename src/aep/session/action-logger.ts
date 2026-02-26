/**
 * Action Logger for AEP SDK (TypeScript)
 *
 * This module provides the ActionLogger class for recording agent actions
 * to session files.
 * @module aep/session/action-logger
 */

import {
  AgentAction,
  ActionType,
  ActionResult,
  createAgentAction,
  generateId,
} from './types';
import { SessionRecorder, SessionNotActiveError } from './recorder';

/**
 * Error thrown when writing to session file fails
 */
export class WriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteError';
  }
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
  private _recorder: SessionRecorder;

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

  constructor(recorderOrOptions: SessionRecorder | ActionLoggerOptions) {
    if ('recorder' in recorderOrOptions) {
      this._recorder = recorderOrOptions.recorder;
    } else {
      this._recorder = recorderOrOptions;
    }
  }

  /**
   * Get the underlying SessionRecorder.
   */
  get recorder(): SessionRecorder {
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
  logAction(action: AgentAction): string {
    const sessionId = this._recorder.getActiveSession();
    if (!sessionId) {
      throw new SessionNotActiveError(
        'No active session. Call startSession() first.'
      );
    }

    // Measure latency
    const startTime = performance.now();

    try {
      this._recorder.recordAction(action);
    } catch (e) {
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
  logToolCall(
    toolName: string,
    trigger: string,
    solution: string,
    result?: ActionResult | 'success' | 'failure' | 'partial',
    context?: Record<string, unknown>
  ): string;

  logToolCall(
    optionsOrToolName: ToolCallOptions | string,
    trigger?: string,
    solution?: string,
    result?: ActionResult | 'success' | 'failure' | 'partial',
    context?: Record<string, unknown>
  ): string {
    let toolName: string;
    let ctx: Record<string, unknown>;
    let resultValue: ActionResult;

    if (typeof optionsOrToolName === 'string') {
      // Legacy signature
      toolName = optionsOrToolName;
      ctx = context || {};
      resultValue = this.parseResult(result || 'success');
    } else {
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
      trigger: trigger!,
      solution: solution!,
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
  log_tool_call(log: ToolCallLog): string {
    const ctx: Record<string, unknown> = {
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
    const resultValue: ActionResult = log.error ? 'failure' : 'success';

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
  logMessage(
    trigger: string,
    solution: string,
    result?: ActionResult | 'success' | 'failure' | 'partial',
    context?: Record<string, unknown>
  ): string;

  logMessage(
    optionsOrTrigger: MessageOptions | string,
    solution?: string,
    result?: ActionResult | 'success' | 'failure' | 'partial',
    context?: Record<string, unknown>
  ): string {
    let trigger: string;
    let ctx: Record<string, unknown>;
    let resultValue: ActionResult;

    if (typeof optionsOrTrigger === 'string') {
      // Legacy signature
      trigger = optionsOrTrigger;
      ctx = context || {};
      resultValue = this.parseResult(result || 'success');
    } else {
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
      solution: solution!,
      result: resultValue,
      context: ctx,
    });

    return this.logAction(action);
  }

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
  logDecision(
    trigger: string,
    solution: string,
    result?: ActionResult | 'success' | 'failure' | 'partial',
    context?: Record<string, unknown>
  ): string;

  logDecision(
    optionsOrTrigger: DecisionOptions | string,
    solution?: string,
    result?: ActionResult | 'success' | 'failure' | 'partial',
    context?: Record<string, unknown>
  ): string {
    let trigger: string;
    let ctx: Record<string, unknown>;
    let resultValue: ActionResult;

    if (typeof optionsOrTrigger === 'string') {
      // Legacy signature
      trigger = optionsOrTrigger;
      ctx = context || {};
      resultValue = this.parseResult(result || 'success');
    } else {
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
      solution: solution!,
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
  getAction(actionId: string): AgentAction | undefined {
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
  updateAction(
    actionId: string,
    updates: Partial<{
      trigger: string;
      solution: string;
      result: ActionResult | 'success' | 'failure' | 'partial';
      context: Record<string, unknown>;
      feedback: unknown;
    }>
  ): boolean {
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
      action.feedback = updates.feedback as any;
    }

    return true;
  }

  /**
   * Get the count of actions in the current session.
   *
   * @returns Number of actions, or 0 if no active session
   */
  getActionCount(): number {
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
  private parseResult(
    result: ActionResult | 'success' | 'failure' | 'partial'
  ): ActionResult {
    if (
      result === 'success' ||
      result === 'failure' ||
      result === 'partial'
    ) {
      return result;
    }
    return result;
  }
}