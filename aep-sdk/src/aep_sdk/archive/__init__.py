"""
Archive Module for AEP Protocol

Main entry point for session summary and archival types.
"""

from .models import (
    # Enums
    ActionOutcome,
    SessionStatus,

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

    # Constants
    ARCHIVE_VERSION,
)

__all__ = [
    # Enums
    "ActionOutcome",
    "SessionStatus",

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

    # Constants
    "ARCHIVE_VERSION",
]
