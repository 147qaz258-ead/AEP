"""
Archive Module for AEP Protocol

Main entry point for session summary and archival types.
"""

from .models import (
    # Enums
    ActionOutcome,
    SessionStatus,
    PendingStatus,

    # Core data classes
    KeyAction,
    SessionSummary,
    CreateSessionSummaryOptions,

    # Detailed data classes
    SessionStats,
    TopSignal,
    FeedbackSummary,
    ExperienceSummary,
    DetailedSessionSummary,
    ArchiveQuery,
    ArchiveQueryResult,

    # Pending experience
    PendingExperience,

    # Constants
    ARCHIVE_VERSION,
)
from .archiver import (
    MemoryArchiver,
    CleanupResult,
    SummaryInfo,
    StorageStats,
)
from .pending_queue import PendingQueueManager

__all__ = [
    # Enums
    "ActionOutcome",
    "SessionStatus",
    "PendingStatus",

    # Core data classes
    "KeyAction",
    "SessionSummary",
    "CreateSessionSummaryOptions",

    # Detailed data classes
    "SessionStats",
    "TopSignal",
    "FeedbackSummary",
    "ExperienceSummary",
    "DetailedSessionSummary",
    "ArchiveQuery",
    "ArchiveQueryResult",

    # Pending experience
    "PendingExperience",

    # Archiver
    "MemoryArchiver",
    "CleanupResult",
    "SummaryInfo",
    "StorageStats",

    # Pending Queue
    "PendingQueueManager",

    # Constants
    "ARCHIVE_VERSION",
]