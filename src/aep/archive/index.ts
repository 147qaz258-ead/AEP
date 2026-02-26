/**
 * Archive Module for AEP Protocol
 *
 * Main entry point for session summary and archival types.
 *
 * @module aep/archive
 */

// Export all types
export {
  // Core types
  type ActionOutcome,
  type KeyAction,
  type SessionSummary,
  type CreateSessionSummaryOptions,

  // Detailed types
  type SessionStats,
  type TopSignal,
  type FeedbackSummary,
  type ExperienceSummary,
  type DetailedSessionSummary,
  type ArchiveQuery,
  type ArchiveQueryResult,

  // Pending types
  type PendingStatus,
  type PendingExperience,
  type CreatePendingExperienceOptions,
  type ListPendingOptions,
  type GetBatchOptions,

  // Constants
  ARCHIVE_VERSION,
} from './types';

// Export archiver
export {
  MemoryArchiver,
  type CleanupResult,
  type SummaryInfo,
  type StorageStats,
  type ArchiveOptions,
} from './archiver';

// Export pending queue
export { PendingQueueManager } from './pending-queue';