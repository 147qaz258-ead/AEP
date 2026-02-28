/**
 * PendingQueueManager - Manages pending experiences for AEP Protocol
 *
 * Provides functionality to manage experiences waiting to be published to Hub.
 *
 * @module aep/archive/pending-queue
 */
import { PendingExperience, CreatePendingExperienceOptions, ListPendingOptions, GetBatchOptions } from './types';
/**
 * PendingQueueManager - Manages pending experiences waiting to be published to Hub.
 *
 * This class provides functionality to:
 * - Add pending experiences
 * - List/filter pending experiences
 * - Approve/reject pending experiences
 * - Get batch for publishing
 * - Clean up completed experiences
 *
 * @example
 * ```typescript
 * const manager = new PendingQueueManager('/path/to/workspace');
 * const exp = manager.addPending({
 *   trigger: 'TypeError',
 *   solution: 'Add null check',
 *   confidence: 0.85,
 *   source_action_id: 'action_123',
 *   source_session_id: 'session_456',
 * });
 * ```
 */
export declare class PendingQueueManager {
    private _workspace;
    private pendingDir;
    /**
     * Initialize the PendingQueueManager.
     *
     * @param workspace - Path to the workspace directory
     */
    constructor(workspace: string);
    /** Get the workspace path */
    get workspace(): string;
    /**
     * Add a pending experience to the queue.
     *
     * @param options - Options for creating the pending experience
     * @returns The created pending experience
     */
    addPending(options: CreatePendingExperienceOptions): PendingExperience;
    /**
     * List pending experiences with optional filtering.
     *
     * @param options - Filter options
     * @returns List of pending experiences
     */
    listPending(options?: ListPendingOptions): PendingExperience[];
    /**
     * Get a specific pending experience by ID.
     *
     * @param expId - The experience ID
     * @returns The pending experience, or null if not found
     */
    getPending(expId: string): PendingExperience | null;
    /**
     * Remove a pending experience from the queue.
     *
     * @param expId - The experience ID
     * @returns True if removed, false if not found
     */
    removePending(expId: string): boolean;
    /**
     * Approve a pending experience.
     *
     * @param expId - The experience ID
     * @returns True if approved, false if not found
     */
    approvePending(expId: string): boolean;
    /**
     * Reject a pending experience.
     *
     * @param expId - The experience ID
     * @returns True if rejected, false if not found
     */
    rejectPending(expId: string): boolean;
    /**
     * Get a batch of experiences ready for publishing.
     *
     * @param options - Batch options
     * @returns List of experiences ready for publishing
     */
    getBatch(options?: GetBatchOptions): PendingExperience[];
    /**
     * Clear completed experiences (approved or rejected).
     *
     * @returns Number of experiences cleared
     */
    clearCompleted(): number;
    /**
     * Get statistics about the pending queue.
     *
     * @returns Queue statistics
     */
    getStats(): {
        pending: number;
        approved: number;
        rejected: number;
        total: number;
    };
    /**
     * Convert a pending experience to a publish payload for Hub.
     *
     * @param exp - The pending experience
     * @returns The publish payload
     */
    toPublishPayload(exp: PendingExperience): Record<string, unknown>;
    /**
     * Ensure a directory exists.
     */
    private ensureDirectory;
    /**
     * Save an experience to disk.
     */
    private saveExperience;
    /**
     * Load an experience from disk.
     */
    private loadExperience;
    /**
     * Update the status of an experience.
     */
    private updateStatus;
}
export default PendingQueueManager;
//# sourceMappingURL=pending-queue.d.ts.map