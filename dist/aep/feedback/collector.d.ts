/**
 * Feedback Collector for AEP SDK (TypeScript)
 *
 * This module provides the FeedbackCollector class for managing explicit feedback collection.
 * Feedback is persisted to JSONL files in the .aep/feedback directory.
 *
 * @module aep/feedback/collector
 */
import { Feedback, FeedbackRating, FeedbackStats, FeedbackQuery, FeedbackQueryResult, ActionOutcome } from './types';
/**
 * Base exception for feedback-related errors
 */
export declare class FeedbackError extends Error {
    constructor(message: string);
}
/**
 * Raised when a feedback entry cannot be found
 */
export declare class FeedbackNotFoundError extends FeedbackError {
    constructor(message: string);
}
/**
 * Raised when invalid rating is provided
 */
export declare class InvalidRatingError extends FeedbackError {
    constructor(message: string);
}
/**
 * Options for submitting explicit feedback
 */
export interface SubmitExplicitFeedbackOptions {
    /** ID of the session this feedback belongs to */
    session_id: string;
    /** ID of the agent that received the feedback */
    agent_id: string;
    /** ID of the action this feedback is for (optional) */
    action_id?: string;
    /** User's rating (1-5) */
    rating: FeedbackRating;
    /** User's comment (optional) */
    comment?: string;
    /** User ID (optional) */
    user_id?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Options for submitting implicit feedback.
 */
export interface SubmitImplicitFeedbackOptions {
    /** ID of the session this feedback belongs to */
    session_id: string;
    /** ID of the agent that received the feedback */
    agent_id: string;
    /** ID of the action this feedback is for (optional) */
    action_id?: string;
    /** Outcome inferred from user behavior */
    outcome: ActionOutcome;
    /** Confidence score of the inference (0-1) */
    confidence: number;
    /** Evidence describing why feedback was inferred */
    evidence?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
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
export declare class FeedbackCollector {
    private _workspace;
    private storageDir;
    /**
     * Initialize the feedback collector.
     *
     * @param workspace - Path to the workspace directory
     * @param storageDir - Directory name for feedback storage (default: 'feedback')
     */
    constructor(workspace: string, storageDir?: string);
    /** Get the workspace path */
    get workspace(): string;
    /**
     * Submit explicit feedback for an action or session.
     *
     * Creates a new feedback entry and persists it to a JSONL file.
     *
     * @param options - Feedback submission options
     * @returns The created Feedback object
     * @throws InvalidRatingError if rating is not between 1-5
     */
    submitExplicit(options: SubmitExplicitFeedbackOptions): Feedback;
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
    submit(actionId: string, rating: FeedbackRating, comment?: string, sessionId?: string, agentId?: string, userId?: string): Feedback;
    /**
     * Submit implicit feedback for an action.
     *
     * Creates a new implicit feedback entry and persists it to a JSONL file.
     * Implicit feedback is inferred from user behavior, not explicitly provided.
     *
     * @param options - Implicit feedback submission options
     * @returns The created Feedback object
     */
    submitImplicit(options: SubmitImplicitFeedbackOptions): Feedback;
    /**
     * Infer positive feedback from user accepting a suggestion.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The action ID that was accepted
     * @param evidence - Optional custom evidence
     * @returns The created Feedback object
     */
    inferFromAcceptance(sessionId: string, agentId: string, actionId: string, evidence?: string): Feedback;
    /**
     * Infer negative feedback from user rejecting a suggestion.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The action ID that was rejected
     * @param evidence - Optional custom evidence
     * @returns The created Feedback object
     */
    inferFromRejection(sessionId: string, agentId: string, actionId: string, evidence?: string): Feedback;
    /**
     * Infer positive feedback from user copying content.
     *
     * @param sessionId - The session ID
     * @param agentId - The agent ID
     * @param actionId - The action ID with content that was copied
     * @returns The created Feedback object
     */
    inferFromCopy(sessionId: string, agentId: string, actionId: string): Feedback;
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
    inferFromSessionDuration(sessionId: string, agentId: string, actionId: string, durationSeconds: number): Feedback;
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
    inferFromSimilarQuestion(sessionId: string, agentId: string, actionId: string): Feedback;
    /**
     * Get feedback for a specific action.
     *
     * @param actionId - The action ID to get feedback for
     * @returns The Feedback object, or null if not found
     */
    getFeedback(actionId: string): Feedback | null;
    /**
     * Get all feedback for a session.
     *
     * @param sessionId - The session ID to get feedback for
     * @returns Array of Feedback objects
     */
    getSessionFeedback(sessionId: string): Feedback[];
    /**
     * Get feedback statistics for a session.
     *
     * @param sessionId - The session ID to get statistics for
     * @returns FeedbackStats object with aggregated metrics
     */
    getStats(sessionId: string): FeedbackStats;
    /**
     * Query feedback with filters.
     *
     * @param query - Query parameters
     * @returns FeedbackQueryResult with matching feedback entries
     */
    query(query: FeedbackQuery): FeedbackQueryResult;
    /**
     * Delete feedback by ID.
     *
     * @param feedbackId - The feedback ID to delete
     * @returns true if feedback was deleted, false if not found
     */
    deleteFeedback(feedbackId: string): boolean;
    private getFeedbackFile;
    /**
     * Get the global feedback file path.
     */
    private getGlobalFeedbackFile;
    /**
     * Append a feedback entry to the JSONL file.
     */
    private appendFeedback;
    /**
     * Load all feedback entries from storage.
     */
    private loadAllFeedback;
    /**
     * Rewrite all feedback entries to the JSONL file.
     */
    private rewriteAllFeedback;
}
//# sourceMappingURL=collector.d.ts.map