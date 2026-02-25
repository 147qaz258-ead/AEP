/**
 * AEP Session Module
 * Exports types and utilities for AgentAction and Session,
 * as well as the SessionRecorder for managing session lifecycle.
 */

export {
  // Types
  type FeedbackInfo,
  type ActionType,
  type ActionResult,
  type AgentAction,
  type Session,
  type AgentActionOptions,
  type SessionOptions,
  // Utilities
  generateId,
  createAgentAction,
  createSession,
} from './types';

export {
  // Session management
  SessionRecorder,
  SessionError,
  SessionNotActiveError,
  SessionNotFoundError,
  StorageManager,
} from './recorder';
