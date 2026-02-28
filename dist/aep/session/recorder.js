/**
 * Session Recorder for AEP SDK (TypeScript)
 *
 * This module provides the SessionRecorder class for managing session lifecycle.
 * @module aep/session/recorder
 */
import * as fs from 'fs';
import * as path from 'path';
import { createSession, generateId } from './types';
/**
 * Base exception for session-related errors
 */
export class SessionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SessionError';
    }
}
/**
 * Raised when trying to operate on an inactive session
 */
export class SessionNotActiveError extends SessionError {
    constructor(message) {
        super(message);
        this.name = 'SessionNotActiveError';
    }
}
/**
 * Raised when a session cannot be found
 */
export class SessionNotFoundError extends SessionError {
    constructor(message) {
        super(message);
        this.name = 'SessionNotFoundError';
    }
}
/**
 * Storage manager for AEP session files.
 * Handles directory structure and file operations.
 */
export class StorageManager {
    constructor(workspace) {
        this._workspace = workspace;
        this.aepDir = path.join(workspace, '.aep');
    }
    /** Get the workspace path */
    get workspace() {
        return this._workspace;
    }
    /**
     * Ensure a directory exists within .aep
     */
    ensureDirectory(dirName) {
        const dirPath = path.join(this.aepDir, dirName);
        fs.mkdirSync(dirPath, { recursive: true });
        return dirPath;
    }
    /**
     * Get the sessions directory path
     */
    getSessionsPath() {
        return this.ensureDirectory(StorageManager.SESSIONS_DIR);
    }
    /**
     * Get the memory directory path
     */
    getMemoryPath() {
        return this.ensureDirectory(StorageManager.MEMORY_DIR);
    }
    /**
     * Get the pending directory path
     */
    getPendingPath() {
        return this.ensureDirectory(StorageManager.PENDING_DIR);
    }
    /**
     * Get the cache directory path
     */
    getCachePath() {
        return this.ensureDirectory(StorageManager.CACHE_DIR);
    }
    /**
     * Get the archive directory path
     */
    getArchivePath() {
        return this.ensureDirectory(StorageManager.ARCHIVE_DIR);
    }
    /**
     * Get the file path for a session
     */
    getSessionFile(sessionId) {
        return path.join(this.getSessionsPath(), `${sessionId}.jsonl`);
    }
    /**
     * Check if a session file exists
     */
    sessionExists(sessionId) {
        return fs.existsSync(this.getSessionFile(sessionId));
    }
    /**
     * Move a session to the archive directory
     */
    archiveSession(sessionId) {
        const source = this.getSessionFile(sessionId);
        if (!fs.existsSync(source)) {
            return null;
        }
        const archivePath = path.join(this.getArchivePath(), `${sessionId}.jsonl`);
        fs.renameSync(source, archivePath);
        return archivePath;
    }
}
StorageManager.SESSIONS_DIR = 'sessions';
StorageManager.MEMORY_DIR = 'memory';
StorageManager.PENDING_DIR = 'pending';
StorageManager.CACHE_DIR = 'cache';
StorageManager.ARCHIVE_DIR = 'sessions/archive';
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
export class SessionRecorder {
    /**
     * Initialize the session recorder.
     *
     * @param workspace - Path to the workspace directory
     * @param agentId - Unique identifier for the agent
     */
    constructor(workspace, agentId) {
        this.activeSession = null;
        this._workspace = workspace;
        this._agentId = agentId;
        this.storage = new StorageManager(workspace);
        // Ensure sessions directory exists
        this.storage.ensureDirectory('sessions');
    }
    /** Get the workspace path */
    get workspace() {
        return this._workspace;
    }
    /** Get the agent ID */
    get agentId() {
        return this._agentId;
    }
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
    startSession(metadata) {
        if (this.activeSession !== null) {
            throw new SessionError(`Active session already exists: ${this.activeSession.id}. ` +
                'End the current session before starting a new one.');
        }
        // Create new session
        const sessionId = `session_${generateId()}`;
        this.activeSession = createSession({
            id: sessionId,
            agent_id: this.agentId,
        });
        // Create JSONL file with header
        const filePath = this.storage.getSessionFile(sessionId);
        this.writeSessionHeader(filePath, this.activeSession, metadata);
        return sessionId;
    }
    /**
     * Get the current active session ID.
     *
     * @returns The active session ID, or null if no session is active
     */
    getActiveSession() {
        return this.activeSession?.id ?? null;
    }
    /**
     * Get a session by ID.
     *
     * @param sessionId - The session identifier
     * @returns The Session object, or null if not found
     */
    getSession(sessionId) {
        // Check if it's the active session
        if (this.activeSession && this.activeSession.id === sessionId) {
            return this.activeSession;
        }
        // Load from file
        return this.loadSession(sessionId);
    }
    /**
     * Record an action to the active session.
     *
     * @param action - The AgentAction to record
     * @throws SessionNotActiveError if no session is currently active
     */
    recordAction(action) {
        if (this.activeSession === null) {
            throw new SessionNotActiveError('No active session. Call startSession() first.');
        }
        // Add action to session
        this.activeSession.actions.push(action);
        // Append action to JSONL file
        const filePath = this.storage.getSessionFile(this.activeSession.id);
        this.appendAction(filePath, action);
    }
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
    endSession(sessionId, summary) {
        if (!this.activeSession || this.activeSession.id !== sessionId) {
            throw new SessionNotActiveError(`Session not active: ${sessionId}`);
        }
        // End the session
        this.activeSession.ended_at = new Date().toISOString();
        if (summary) {
            this.activeSession.summary = summary;
        }
        // Update the session header in the file
        const filePath = this.storage.getSessionFile(sessionId);
        this.updateSessionHeader(filePath, this.activeSession);
        // Clear active session
        const resultPath = filePath;
        this.activeSession = null;
        return resultPath;
    }
    /**
     * Pause a session (placeholder for future implementation).
     *
     * @param _sessionId - The session identifier (unused, reserved for future)
     * @throws SessionNotActiveError if the session is not active
     */
    pauseSession(_sessionId) {
        if (!this.activeSession || this.activeSession.id !== _sessionId) {
            throw new SessionNotActiveError(`Session not active: ${_sessionId}`);
        }
        // TODO: Implement pause logic
    }
    /**
     * Resume a paused session (placeholder for future implementation).
     *
     * @param _sessionId - The session identifier (unused, reserved for future)
     * @throws SessionError if the session cannot be resumed
     */
    resumeSession(_sessionId) {
        if (this.activeSession !== null) {
            throw new SessionError(`Active session already exists: ${this.activeSession.id}`);
        }
        // TODO: Implement resume logic
    }
    /**
     * Write session header to JSONL file.
     */
    writeSessionHeader(filePath, session, metadata) {
        const header = {
            _type: 'session_header',
            session,
        };
        if (metadata) {
            header.metadata = metadata;
        }
        fs.writeFileSync(filePath, JSON.stringify(header) + '\n', 'utf-8');
    }
    /**
     * Append an action record to the JSONL file.
     */
    appendAction(filePath, action) {
        const record = {
            _type: 'action',
            action,
        };
        fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf-8');
    }
    /**
     * Update the session header in the JSONL file.
     */
    updateSessionHeader(filePath, session) {
        // Read all lines
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        if (lines.length === 0) {
            // If file is empty, just write the header
            this.writeSessionHeader(filePath, session);
            return;
        }
        // Update the first line (header)
        lines[0] = JSON.stringify({
            _type: 'session_header',
            session,
        });
        // Write back
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    }
    /**
     * Load a session from file.
     */
    loadSession(sessionId) {
        const filePath = this.storage.getSessionFile(sessionId);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const firstLine = content.split('\n')[0];
        if (!firstLine) {
            return null;
        }
        try {
            const header = JSON.parse(firstLine);
            if (header._type !== 'session_header') {
                return null;
            }
            return header.session;
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=recorder.js.map