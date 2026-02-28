/**
 * Feedback Module for AEP Protocol
 *
 * Main entry point for feedback collection and management types.
 *
 * @module aep/feedback
 */

// Export all types
export {
  // Core types
  type FeedbackType,
  type FeedbackRating,
  type ActionOutcome,
  type Feedback,

  // Options types
  type CreateExplicitFeedbackOptions,
  type CreateImplicitFeedbackOptions,

  // Query types
  type FeedbackQuery,
  type FeedbackQueryResult,

  // Statistics types
  type FeedbackStats,
} from './types';

// Export collector
export {
  FeedbackCollector,
  FeedbackError,
  FeedbackNotFoundError,
  InvalidRatingError,
  type SubmitExplicitFeedbackOptions,
  type SubmitImplicitFeedbackOptions,
} from './collector';
