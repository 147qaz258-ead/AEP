/**
 * PendingQueueManager - Manages pending experiences for AEP Protocol
 *
 * Provides functionality to manage experiences waiting to be published to Hub.
 *
 * @module aep/archive/pending-queue
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
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
export class PendingQueueManager {
    /**
     * Initialize the PendingQueueManager.
     *
     * @param workspace - Path to the workspace directory
     */
    constructor(workspace) {
        this._workspace = workspace;
        this.pendingDir = path.join(workspace, '.aep', 'pending');
        this.ensureDirectory(this.pendingDir);
    }
    /** Get the workspace path */
    get workspace() {
        return this._workspace;
    }
    /**
     * Add a pending experience to the queue.
     *
     * @param options - Options for creating the pending experience
     * @returns The created pending experience
     */
    addPending(options) {
        const exp = {
            id: `exp_${randomUUID().replace(/-/g, '').substring(0, 12)}`,
            trigger: options.trigger,
            solution: options.solution,
            confidence: options.confidence,
            source_action_id: options.source_action_id,
            source_session_id: options.source_session_id,
            feedback_score: options.feedback_score,
            created_at: new Date().toISOString(),
            status: 'pending',
        };
        this.saveExperience(exp);
        return exp;
    }
    /**
     * List pending experiences with optional filtering.
     *
     * @param options - Filter options
     * @returns List of pending experiences
     */
    listPending(options = {}) {
        const { session_id, status, limit = 50 } = options;
        const experiences = [];
        if (!fs.existsSync(this.pendingDir)) {
            return experiences;
        }
        const files = fs.readdirSync(this.pendingDir)
            .filter(f => f.startsWith('exp_') && f.endsWith('.json'))
            .map(f => ({
            name: f,
            path: path.join(this.pendingDir, f),
            mtime: fs.statSync(path.join(this.pendingDir, f)).mtime.getTime(),
        }))
            .sort((a, b) => b.mtime - a.mtime);
        for (const file of files) {
            const exp = this.loadExperience(file.path);
            if (!exp)
                continue;
            // Apply filters
            if (session_id && exp.source_session_id !== session_id)
                continue;
            if (status && exp.status !== status)
                continue;
            experiences.push(exp);
            if (experiences.length >= limit)
                break;
        }
        return experiences;
    }
    /**
     * Get a specific pending experience by ID.
     *
     * @param expId - The experience ID
     * @returns The pending experience, or null if not found
     */
    getPending(expId) {
        const expFile = path.join(this.pendingDir, `${expId}.json`);
        if (!fs.existsSync(expFile)) {
            return null;
        }
        return this.loadExperience(expFile);
    }
    /**
     * Remove a pending experience from the queue.
     *
     * @param expId - The experience ID
     * @returns True if removed, false if not found
     */
    removePending(expId) {
        const expFile = path.join(this.pendingDir, `${expId}.json`);
        if (!fs.existsSync(expFile)) {
            return false;
        }
        fs.unlinkSync(expFile);
        return true;
    }
    /**
     * Approve a pending experience.
     *
     * @param expId - The experience ID
     * @returns True if approved, false if not found
     */
    approvePending(expId) {
        return this.updateStatus(expId, 'approved');
    }
    /**
     * Reject a pending experience.
     *
     * @param expId - The experience ID
     * @returns True if rejected, false if not found
     */
    rejectPending(expId) {
        return this.updateStatus(expId, 'rejected');
    }
    /**
     * Get a batch of experiences ready for publishing.
     *
     * @param options - Batch options
     * @returns List of experiences ready for publishing
     */
    getBatch(options = {}) {
        const { batch_size = 10, status = 'approved' } = options;
        return this.listPending({ status, limit: batch_size });
    }
    /**
     * Clear completed experiences (approved or rejected).
     *
     * @returns Number of experiences cleared
     */
    clearCompleted() {
        if (!fs.existsSync(this.pendingDir)) {
            return 0;
        }
        let count = 0;
        const files = fs.readdirSync(this.pendingDir)
            .filter(f => f.startsWith('exp_') && f.endsWith('.json'));
        for (const file of files) {
            const expPath = path.join(this.pendingDir, file);
            const exp = this.loadExperience(expPath);
            if (exp && (exp.status === 'approved' || exp.status === 'rejected')) {
                fs.unlinkSync(expPath);
                count++;
            }
        }
        return count;
    }
    /**
     * Get statistics about the pending queue.
     *
     * @returns Queue statistics
     */
    getStats() {
        const experiences = this.listPending({ limit: 1000 });
        return {
            pending: experiences.filter(e => e.status === 'pending').length,
            approved: experiences.filter(e => e.status === 'approved').length,
            rejected: experiences.filter(e => e.status === 'rejected').length,
            total: experiences.length,
        };
    }
    /**
     * Convert a pending experience to a publish payload for Hub.
     *
     * @param exp - The pending experience
     * @returns The publish payload
     */
    toPublishPayload(exp) {
        return {
            trigger: exp.trigger,
            solution: exp.solution,
            confidence: exp.confidence,
            context: {
                source_session: exp.source_session_id,
                source_action: exp.source_action_id,
                feedback_score: exp.feedback_score,
            },
        };
    }
    // Private methods
    /**
     * Ensure a directory exists.
     */
    ensureDirectory(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    /**
     * Save an experience to disk.
     */
    saveExperience(exp) {
        const expFile = path.join(this.pendingDir, `${exp.id}.json`);
        fs.writeFileSync(expFile, JSON.stringify(exp, null, 2), 'utf-8');
    }
    /**
     * Load an experience from disk.
     */
    loadExperience(expPath) {
        try {
            const content = fs.readFileSync(expPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    /**
     * Update the status of an experience.
     */
    updateStatus(expId, status) {
        const exp = this.getPending(expId);
        if (!exp) {
            return false;
        }
        exp.status = status;
        this.saveExperience(exp);
        return true;
    }
}
export default PendingQueueManager;
//# sourceMappingURL=pending-queue.js.map