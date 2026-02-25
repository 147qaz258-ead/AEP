/**
 * AgentAction and Session type definitions for AEP SDK
 * @module aep/session
 */

/**
 * Feedback information attached to an action
 */
export interface FeedbackInfo {
  /** Unique identifier for the feedback */
  id: string;
  /** Rating: positive, negative, or neutral */
  rating: 'positive' | 'negative' | 'neutral';
  /** Optional comment explaining the feedback */
  comment?: string;
  /** Timestamp when feedback was given */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Types of actions an agent can perform
 */
export type ActionType = 'tool_call' | 'message' | 'decision';

/**
 * Result status of an action
 */
export type ActionResult = 'success' | 'failure' | 'partial';

/**
 * Represents a single action performed by an agent
 */
export interface AgentAction {
  /** Unique identifier for this action */
  id: string;
  /** ISO 8601 timestamp when the action occurred */
  timestamp: string;
  /** Type of action performed */
  action_type: ActionType;
  /** What triggered this action */
  trigger: string;
  /** The solution or approach taken */
  solution: string;
  /** Result status of the action */
  result: ActionResult;
  /** Additional context data for this action */
  context: Record<string, any>;
  /** Optional feedback attached to this action */
  feedback?: FeedbackInfo;
}

/**
 * Represents a complete agent session with all actions
 */
export interface Session {
  /** Unique identifier for this session */
  id: string;
  /** Identifier of the agent that performed this session */
  agent_id: string;
  /** ISO 8601 timestamp when the session started */
  started_at: string;
  /** ISO 8601 timestamp when the session ended (if completed) */
  ended_at?: string;
  /** List of all actions in this session */
  actions: AgentAction[];
  /** Optional summary of the session */
  summary?: string;
}

/**
 * Options for creating a new AgentAction
 */
export interface AgentActionOptions {
  id?: string;
  timestamp?: string;
  action_type: ActionType;
  trigger: string;
  solution: string;
  result?: ActionResult;
  context?: Record<string, any>;
  feedback?: FeedbackInfo;
}

/**
 * Options for creating a new Session
 */
export interface SessionOptions {
  id?: string;
  agent_id: string;
  started_at?: string;
  ended_at?: string;
  actions?: AgentAction[];
  summary?: string;
}

/**
 * Generate a unique ID for actions and sessions
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a new AgentAction with defaults
 */
export function createAgentAction(options: AgentActionOptions): AgentAction {
  return {
    id: options.id || generateId(),
    timestamp: options.timestamp || new Date().toISOString(),
    action_type: options.action_type,
    trigger: options.trigger,
    solution: options.solution,
    result: options.result || 'success',
    context: options.context || {},
    feedback: options.feedback,
  };
}

/**
 * Create a new Session with defaults
 */
export function createSession(options: SessionOptions): Session {
  return {
    id: options.id || generateId(),
    agent_id: options.agent_id,
    started_at: options.started_at || new Date().toISOString(),
    ended_at: options.ended_at,
    actions: options.actions || [],
    summary: options.summary,
  };
}
