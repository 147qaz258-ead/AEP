/**
 * Session Recorder for AEP SDK (TypeScript)
 *
 * This module provides the SessionRecorder class for managing session lifecycle.
 * @module aep/session/recorder
 */
import { AgentAction, Session } from './types';
/**
 * Base exception for session-related errors
 */
export declare class SessionError extends Error {
    constructor(message: string);
}
/**
 * Raised when trying to operate on an inactive session
 */
export declare class SessionNotActiveError extends SessionError {
    constructor(message: string);
}
/**
 * Raised when a session cannot be found
 */
export declare class SessionNotFoundError extends SessionError {
    constructor(message: string);
}
/**
 * Storage manager for AEP session files.
 * Handles directory structure and file operations.
 */
export declare class StorageManager {
    static readonly SESSIONS_DIR = "sessions";
    static readonly MEMORY_DIR = "memory";
    static readonly PENDING_DIR = "pending";
    static readonly CACHE_DIR = "cache";
    static readonly ARCHIVE_DIR = "sessions/archive";
    private workspace;
    private aepDir;
    constructor(workspace: string);
    /**
     * Ensure a directory exists within .aep
     */
    ensureDirectory(dirName: string): string;
    /**
     * Get the sessions directory path
     */
    getSessionsPath(): string;
    /**
     * Get the memory directory path
     */
    getMemoryPath(): string;
    /**
     * Get the pending directory path
     */
    getPendingPath(): string;
    /**
     * Get the cache directory path
     */
    getCachePath(): string;
    /**
     * Get the archive directory path
     */
    getArchivePath(): string;
    /**
     * Get the file path for a session
     */
    getSessionFile(sessionId: string): string;
    /**
     * Check if a session file exists
     */
    sessionExists(sessionId: string): boolean;
    /**
     * Move a session to the archive directory
     */
    archiveSession(sessionId: string): string | null;
}
/**
 * Session recorder for managing agent session lifecycle.
 *
 * This class handles creating, recording actions to, and ending sessions.
 * Sessions are persisted to JSONL files in the .aep/sessions directory.
 *
 * @example
 * ```typescript
 * const recorder = new SessionRecorder('/path/to/project', 'agent_0x1234');
 * const sessionId = recorder.startSession({ purpose: 'debugging' });
 * // ... record actions ...
 * recorder.endSession(sessionId, 'Task completed successfully');
 * ```
 */
export declare class SessionRecorder {
    private workspace;
    private agentId;
    private activeSession;
    private storage;
    /**
     * Initialize the session recorder.
     *
     * @param workspace - Path to the workspace directory
     * @param agentId - Unique identifier for the agent
     */
    constructor(workspace: string, agentId: string);
    /**
     * Start a new session.
     *
     * Creates a new session and persists it to a JSONL file.
     * Only one session can be active at a time.
     *
     * @param metadata - Optional metadata to include in the session header
     * @returns The session ID
     * @throws SessionError if a session is already active
     */
    startSession(metadata?: Record<string, unknown>): string;
    /**
     * Get the current active session ID.
     *
     * @returns The active session ID, or null if no session is active
     */
    getActiveSession(): string | null;
    /**
     * Get a session by ID.
     *
     * @param sessionId - The session identifier
     * @returns The Session object, or null if not found
     */
    getSession(sessionId: string): Session | null;
    /**
     * Record an action to the active session.
     *
     * @param action - The AgentAction to record
     * @throws SessionNotActiveError if no session is currently active
     */
    recordAction(action: AgentAction): void;
    /**
     * End a session.
     *
     * Updates the session status, adds end timestamp and optional summary.
     *
     * @param sessionId - The session identifier
     * @param summary - Optional summary of the session
     * @returns Path to the session JSONL file
     * @throws SessionNotActiveError if the session is not active
     */
    endSession(sessionId: string, summary?: string): string;
    /**
     * Pause a session (placeholder for future implementation).
     *
     * @param sessionId - The session identifier
     * @throws SessionNotActiveError if the session is not active
     */
    pauseSession(sessionId: string): void;
    /**
     * Resume a paused session (placeholder for future implementation).
     *
     * @param sessionId - The session identifier
     * @throws SessionError if the session cannot be resumed
     */
    resumeSession(sessionId: string): void;
    /**
     * Write session header to JSONL file.
     */
    private writeSessionHeader;
    /**
     * Append an action record to the JSONL file.
     */
    private appendAction;
    /**
     * Update the session header in the JSONL file.
     */
    private updateSessionHeader;
    /**
     * Load a session from file.
     */
    private loadSession;
}
