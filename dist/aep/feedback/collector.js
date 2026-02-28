/**
 * Feedback Collector for AEP SDK (TypeScript)
 *
 * This module provides the FeedbackCollector class for managing explicit feedback collection.
 * Feedback is persisted to JSONL files in the .aep/feedback directory.
 *
 * @module aep/feedback/collector
 */
import * as fs from 'fs';
import * as path from 'path';
/**
 * Base exception for feedback-related errors
 */
export class FeedbackError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FeedbackError';
    }
}
/**
 * Raised when a feedback entry cannot be found
 */
export class FeedbackNotFoundError extends FeedbackError {
    constructor(message) {
        super(message);
        this.name = 'FeedbackNotFoundError';
    }
}
/**
 * Raised when invalid rating is provided
 */
export class InvalidRatingError extends FeedbackError {
    constructor(message) {
        super(message);
        this.name = 'InvalidRatingError';
    }
}
/**
 * Generate a unique ID for feedback entries
 */
function generateFeedbackId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `fb_${timestamp}_${random}`;
}
/**
 * Validate rating is within valid range (1-5)
 */
function validateRating(rating) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new InvalidRatingError(`Invalid rating: ${rating}. Rating must be an integer between 1 and 5.`);
    }
}
/**
 * Feedback collector for managing explicit feedback collection.
 *
 * This class handles submitting, retrieving, and analyzing user feedback.
 * Feedback is persisted to JSONL files in the .aep/feedback directory.
 *
 * @example
 * ```typescript
 * const collector = new FeedbackCollector('/path/to/project');
 *
 * // Submit feedback
 * const feedback = collector.submitExplicit({
 *   session_id: 'session_123',
 *   agent_id: 'agent_001',
 *   action_id: 'action_456',
 *   rating: 5,
 *   comment: 'Excellent response!',
 * });
 *
 * // Get feedback for an action
 * const actionFeedback = collector.getFeedback('action_456');
 *
 * // Get session statistics
 * const stats = collector.getStats('session_123');
 * ```
 */
export class FeedbackCollector {
    /**
     * Initialize the feedback collector.
     *
     * @param workspace - Path to the workspace directory
     * @param storageDir - Directory name for feedback storage (default: 'feedback')
     */
    constructor(workspace, storageDir = 'feedback') {
        this._workspace = workspace;
        this.storageDir = path.join(workspace, '.aep', storageDir);
        // Ensure feedback directory exists
        fs.mkdirSync(this.storageDir, { recursive: true });
    }
    /** Get the workspace path */
    get workspace() {
        return this._workspace;
    }
    /**
     * Submit explicit feedback for an action or session.
     *
     * Creates a new feedback entry and persists it to a JSONL file.
     *
     * @param options - Feedback submission options
     * @returns The created Feedback object
     * @throws InvalidRatingError if rating is not between 1-5
     */
    submitExplicit(options) {
        validateRating(options.rating);
        const feedback = {
            id: generateFeedbackId(),
            session_id: options.session_id,
            agent_id: options.agent_id,
            action_id: options.action_id,
            created_at: new Date().toISOString(),
            type: 'explicit',
            rating: options.rating,
            comment: options.comment,
            confidence: 1.0, // Explicit feedback has full confidence
            metadata: {
                ...options.metadata,
                user_id: options.user_id,
            },
        };
        // Persist to JSONL file
        this.appendFeedback(feedback);
        return feedback;
    }
    /**
     * Submit explicit feedback with simplified parameters.
     *
     * @param actionId - ID of the action this feedback is for
     * @param rating - User's rating (1-5)
     * @param comment - Optional comment
     * @param sessionId - Optional session ID
     * @param agentId - Optional agent ID (uses default if not provided)
     * @param userId - Optional user ID
     * @returns The created Feedback object
     */
    submit(actionId, rating, comment, sessionId, agentId, userId) {
        return this.submitExplicit({
            session_id: sessionId ?? `session_${Date.now()}`,
            agent_id: agentId ?? 'default_agent',
            action_id: actionId,
            rating,
            comment,
            user_id: userId,
        });
    }
    /**
     * Submit implicit feedback for an action.
     *
     * Creates a new implicit feedback entry and persists it to a JSONL file.
     * Implicit feedback is inferred from user behavior, not explicitly provided.
     *
     * @param options - Implicit feedback submission options
     * @returns The created Feedback object
     */
    submitImplicit(options) {
        const feedback = {
            id: generateFeedbackId(),
            session_id: options.session_id,
            agent_id: options.agent_id,
            action_id: options.action_id,
            created_at: new Date().toISOString(),
            type: 'implicit',
            outcome: options.outcome,
            confidence: options.confidence,
            evidence: options.evidence,
            metadata: options.metadata,
        };
        // Persist to JSONL file
        this.appendFeedback(feedback);
        return feedback;
    }
    /**
     * Infer positive feedback from user accepting a suggestion.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The action ID that was accepted
     * @param evidence - Optional custom evidence
     * @returns The created Feedback object
     */
    inferFromAcceptance(sessionId, agentId, actionId, evidence) {
        return this.submitImplicit({
            session_id: sessionId,
            agent_id: agentId,
            action_id: actionId,
            outcome: 'success',
            confidence: 0.8,
            evidence: evidence ?? 'user_accepted_suggestion',
        });
    }
    /**
     * Infer negative feedback from user rejecting a suggestion.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The action ID that was rejected
     * @param evidence - Optional custom evidence
     * @returns The created Feedback object
     */
    inferFromRejection(sessionId, agentId, actionId, evidence) {
        return this.submitImplicit({
            session_id: sessionId,
            agent_id: agentId,
            action_id: actionId,
            outcome: 'failure',
            confidence: 0.9,
            evidence: evidence ?? 'user_rejected_suggestion',
        });
    }
    /**
     * Infer positive feedback from user copying content.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The action ID with content that was copied
     * @returns The created Feedback object
     */
    inferFromCopy(sessionId, agentId, actionId) {
        return this.submitImplicit({
            session_id: sessionId,
            agent_id: agentId,
            action_id: actionId,
            outcome: 'success',
            confidence: 0.7,
            evidence: 'user_copied_content',
        });
    }
    /**
     * Infer feedback from session duration.
     *
     * Short sessions (< 30s) suggest the problem wasn't solved.
     * Long sessions (> 5min) suggest detailed engagement.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The last action ID
     * @param durationSeconds - Session duration in seconds
     * @returns The created Feedback object
     */
    inferFromSessionDuration(sessionId, agentId, actionId, durationSeconds) {
        let outcome;
        let confidence;
        let evidence;
        if (durationSeconds < 30) {
            outcome = 'failure';
            confidence = 0.6;
            evidence = `short_session_${durationSeconds}s`;
        }
        else if (durationSeconds > 300) {
            outcome = 'success';
            confidence = 0.6;
            evidence = `long_session_${durationSeconds}s`;
        }
        else {
            outcome = 'partial';
            confidence = 0.5;
            evidence = `session_duration_${durationSeconds}s`;
        }
        return this.submitImplicit({
            session_id: sessionId,
            agent_id: agentId,
            action_id: actionId,
            outcome,
            confidence,
            evidence,
        });
    }
    /**
     * Infer negative feedback from user asking a similar question.
     *
     * This suggests the previous response didn't fully address the user's needs.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The action ID that didn't satisfy the user
     * @returns The created Feedback object
     */
    inferFromSimilarQuestion(sessionId, agentId, actionId) {
        return this.submitImplicit({
            session_id: sessionId,
            agent_id: agentId,
            action_id: actionId,
            outcome: 'partial',
            confidence: 0.7,
            evidence: 'user_asked_similar_question',
        });
    }
    /**
     * Get feedback for a specific action.
     *
     * @param actionId - The action ID to get feedback for
     * @returns The Feedback object, or null if not found
     */
    getFeedback(actionId) {
        const allFeedback = this.loadAllFeedback();
        return allFeedback.find((f) => f.action_id === actionId) ?? null;
    }
    /**
     * Get all feedback for a session.
     *
     * @param sessionId - The session ID to get feedback for
     * @returns Array of Feedback objects
     */
    getSessionFeedback(sessionId) {
        const allFeedback = this.loadAllFeedback();
        return allFeedback.filter((f) => f.session_id === sessionId);
    }
    /**
     * Get feedback statistics for a session.
     *
     * @param sessionId - The session ID to get statistics for
     * @returns FeedbackStats object with aggregated metrics
     */
    getStats(sessionId) {
        const sessionFeedback = this.getSessionFeedback(sessionId);
        const explicitFeedback = sessionFeedback.filter((f) => f.type === 'explicit');
        const implicitFeedback = sessionFeedback.filter((f) => f.type === 'implicit');
        // Calculate rating distribution
        const ratingDistribution = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
        };
        let totalRating = 0;
        for (const f of explicitFeedback) {
            if (f.rating !== undefined) {
                ratingDistribution[f.rating]++;
                totalRating += f.rating;
            }
        }
        const avgRating = explicitFeedback.length > 0 ? totalRating / explicitFeedback.length : undefined;
        // Calculate outcome distribution
        const outcomeDistribution = {
            success: 0,
            failure: 0,
            partial: 0,
        };
        for (const f of implicitFeedback) {
            if (f.outcome !== undefined) {
                outcomeDistribution[f.outcome]++;
            }
        }
        // Calculate average confidence
        const totalConfidence = sessionFeedback.reduce((sum, f) => sum + f.confidence, 0);
        const avgConfidence = sessionFeedback.length > 0 ? totalConfidence / sessionFeedback.length : 0;
        return {
            total_feedback: sessionFeedback.length,
            explicit_count: explicitFeedback.length,
            implicit_count: implicitFeedback.length,
            avg_rating: avgRating,
            rating_distribution: ratingDistribution,
            outcome_distribution: outcomeDistribution,
            avg_confidence: avgConfidence,
        };
    }
    /**
     * Query feedback with filters.
     *
     * @param query - Query parameters
     * @returns FeedbackQueryResult with matching feedback entries
     */
    query(query) {
        const startTime = Date.now();
        let feedbacks = this.loadAllFeedback();
        // Apply filters
        if (query.session_id !== undefined) {
            feedbacks = feedbacks.filter((f) => f.session_id === query.session_id);
        }
        if (query.action_id !== undefined) {
            feedbacks = feedbacks.filter((f) => f.action_id === query.action_id);
        }
        if (query.agent_id !== undefined) {
            feedbacks = feedbacks.filter((f) => f.agent_id === query.agent_id);
        }
        if (query.type !== undefined) {
            feedbacks = feedbacks.filter((f) => f.type === query.type);
        }
        if (query.rating !== undefined) {
            feedbacks = feedbacks.filter((f) => f.rating === query.rating);
        }
        if (query.outcome !== undefined) {
            feedbacks = feedbacks.filter((f) => f.outcome === query.outcome);
        }
        if (query.from_date !== undefined) {
            feedbacks = feedbacks.filter((f) => f.created_at >= query.from_date);
        }
        if (query.to_date !== undefined) {
            feedbacks = feedbacks.filter((f) => f.created_at <= query.to_date);
        }
        const total = feedbacks.length;
        // Apply pagination
        const offset = query.offset ?? 0;
        const limit = query.limit ?? feedbacks.length;
        feedbacks = feedbacks.slice(offset, offset + limit);
        const queryTimeMs = Date.now() - startTime;
        return {
            feedbacks,
            total,
            query_time_ms: queryTimeMs,
        };
    }
    /**
     * Delete feedback by ID.
     *
     * @param feedbackId - The feedback ID to delete
     * @returns true if feedback was deleted, false if not found
     */
    deleteFeedback(feedbackId) {
        const allFeedback = this.loadAllFeedback();
        const index = allFeedback.findIndex((f) => f.id === feedbackId);
        if (index === -1) {
            return false;
        }
        // Remove from list
        allFeedback.splice(index, 1);
        // Rewrite the file
        this.rewriteAllFeedback(allFeedback);
        return true;
    }
    // @ts-ignore - Deprecated method kept for API compatibility
    getFeedbackFile(sessionId) {
        return path.join(this.storageDir, `${sessionId}.jsonl`);
    }
    /**
     * Get the global feedback file path.
     */
    getGlobalFeedbackFile() {
        return path.join(this.storageDir, 'feedback.jsonl');
    }
    /**
     * Append a feedback entry to the JSONL file.
     */
    appendFeedback(feedback) {
        const filePath = this.getGlobalFeedbackFile();
        const record = {
            _type: 'feedback',
            feedback,
        };
        fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf-8');
    }
    /**
     * Load all feedback entries from storage.
     */
    loadAllFeedback() {
        const filePath = this.getGlobalFeedbackFile();
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());
        const feedbacks = [];
        for (const line of lines) {
            try {
                const record = JSON.parse(line);
                if (record._type === 'feedback') {
                    feedbacks.push(record.feedback);
                }
            }
            catch {
                // Skip malformed lines
            }
        }
        return feedbacks;
    }
    /**
     * Rewrite all feedback entries to the JSONL file.
     */
    rewriteAllFeedback(feedbacks) {
        const filePath = this.getGlobalFeedbackFile();
        const lines = feedbacks.map((f) => {
            const record = {
                _type: 'feedback',
                feedback: f,
            };
            return JSON.stringify(record);
        });
        if (lines.length === 0) {
            // Write empty file
            fs.writeFileSync(filePath, '', 'utf-8');
        }
        else {
            fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
        }
    }
}
//# sourceMappingURL=collector.js.map