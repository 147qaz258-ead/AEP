/**
 * MemoryArchiver - Session compression and archival for AEP Protocol
 *
 * Provides functionality to compress sessions into summaries and archive old sessions.
 *
 * @module aep/archive/archiver
 */
import { SessionSummary } from './types';
import { Session } from '../session/types';
/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
    /** Number of files deleted */
    deleted_count: number;
    /** Bytes freed */
    freed_bytes: number;
}
/**
 * Summary information for listing
 */
export interface SummaryInfo {
    /** Session ID */
    session_id: string;
    /** File path */
    path: string;
    /** Creation timestamp */
    created_at: string;
    /** File size in bytes */
    size: number;
}
/**
 * Storage statistics
 */
export interface StorageStats {
    /** Size of sessions directory in bytes */
    sessions_size: number;
    /** Size of memory directory in bytes */
    memory_size: number;
    /** Size of pending directory in bytes */
    pending_size: number;
    /** Number of archived sessions */
    archive_count: number;
    /** Number of summary files */
    summary_count: number;
}
/**
 * Options for archiving a session
 */
export interface ArchiveOptions {
    /** Whether to compress the archive with gzip */
    compress?: boolean;
    /** Whether to delete the original session file after archiving */
    delete_original?: boolean;
    /** Custom summary to use instead of auto-generating */
    summary?: SessionSummary;
}
/**
 * MemoryArchiver - Manages session compression and archival.
 *
 * This class provides functionality to:
 * - Compress sessions into summaries
 * - Archive old sessions (with optional gzip compression)
 * - Generate Markdown summaries
 * - Clean up old archives
 *
 * @example
 * ```typescript
 * const archiver = new MemoryArchiver('/path/to/workspace');
 * const summary = archiver.compressSession(session);
 * const archivePath = archiver.archiveSession('session_123', { compress: true });
 * ```
 */
export declare class MemoryArchiver {
    private _workspace;
    private aepDir;
    private sessionsDir;
    private memoryDir;
    private archiveDir;
    private pendingDir;
    private defaultRetentionDays;
    /**
     * Initialize the MemoryArchiver.
     *
     * @param workspace - Path to the workspace directory
     * @param retentionDays - Number of days to retain archives (default: 30)
     */
    constructor(workspace: string, retentionDays?: number);
    /** Get the workspace path */
    get workspace(): string;
    /**
     * Compress a session into a summary.
     *
     * @param session - The session to compress
     * @param title - Optional title for the summary
     * @returns The generated session summary
     */
    compressSession(session: Session, title?: string): SessionSummary;
    /**
     * Archive a session file.
     *
     * @param sessionId - The session ID to archive
     * @param options - Archive options
     * @returns Path to the archived file, or null if session not found
     */
    archiveSession(sessionId: string, options?: ArchiveOptions): Promise<string | null>;
    /**
     * Generate Markdown format summary.
     *
     * @param summary - The session summary to format
     * @returns Markdown formatted string
     */
    generateMarkdown(summary: SessionSummary): string;
    /**
     * List archive files.
     *
     * @param limit - Maximum number of archives to return
     * @returns List of archive file paths
     */
    listArchives(limit?: number): string[];
    /**
     * List summary files.
     *
     * @param limit - Maximum number of summaries to return
     * @returns List of summary information
     */
    listSummaries(limit?: number): SummaryInfo[];
    /**
     * Get a summary by session ID.
     *
     * @param sessionId - The session ID
     * @returns The summary content, or null if not found
     */
    getSummary(sessionId: string): string | null;
    /**
     * Clean up old archives.
     *
     * @param days - Number of days to retain (default: instance default)
     * @returns Cleanup result with statistics
     */
    cleanupOldArchives(days?: number): Promise<CleanupResult>;
    /**
     * Get storage statistics.
     *
     * @returns Storage statistics
     */
    getStorageStats(): StorageStats;
    /**
     * Load a session from file.
     *
     * @param sessionId - The session ID to load
     * @returns The session, or null if not found
     */
    private loadSession;
    /**
     * Save a summary to the memory directory.
     *
     * @param summary - The summary to save
     */
    private saveSummary;
    /**
     * Create a summary from options.
     */
    private createSummary;
    /**
     * Extract key actions from a session.
     * Returns the most significant actions based on complexity and outcome.
     */
    private extractKeyActions;
    /**
     * Score an action's significance for summary purposes.
     */
    private scoreActionSignificance;
    /**
     * Determine overall session outcome from actions.
     */
    private determineOutcome;
    /**
     * Extract signals from actions.
     */
    private extractSignals;
    /**
     * Generate a title for the session.
     */
    private generateTitle;
    /**
     * Infer the problem from session and actions.
     */
    private inferProblem;
    /**
     * Infer the solution from actions.
     */
    private inferSolution;
    /**
     * Calculate average feedback score.
     */
    private calculateFeedbackScore;
    /**
     * Format duration in human-readable format.
     */
    private formatDuration;
    /**
     * Ensure a directory exists.
     */
    private ensureDirectory;
    /**
     * Get the total size of a directory.
     */
    private getDirectorySize;
    /**
     * Count files matching a pattern.
     */
    private countFiles;
}
export default MemoryArchiver;
//# sourceMappingURL=archiver.d.ts.map