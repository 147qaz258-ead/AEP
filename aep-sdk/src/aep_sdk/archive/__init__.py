"""
Archive Module for AEP Protocol

Main entry point for session summary and archival types.
"""

from .models import (
    # Enums
    ActionOutcome,
    SessionStatus,

    # Data classes
    SessionStats,
    TopSignal,
    FeedbackSummary,
    ExperienceSummary,
    SessionSummary,
    ArchiveQuery,
    ArchiveQueryResult,

    # Constants
    ARCHIVE_VERSION,
)

__all__ = [
    # Enums
    "ActionOutcome",
    "SessionStatus",

    # Data classes
    "SessionStats",
    "TopSignal",
    "FeedbackSummary",
    "ExperienceSummary",
    "SessionSummary",
    "ArchiveQuery",
    "ArchiveQueryResult",

    # Constants
    "ARCHIVE_VERSION",
]
