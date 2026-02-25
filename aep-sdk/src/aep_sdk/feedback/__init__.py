"""
Feedback Module for AEP Protocol

Main entry point for feedback collection and management types.
"""

from .models import (
    # Enums
    FeedbackType,
    FeedbackRating,
    ActionOutcome,

    # Core data classes
    Feedback,
    CreateExplicitFeedbackOptions,
    CreateImplicitFeedbackOptions,

    # Query types
    FeedbackQuery,
    FeedbackQueryResult,

    # Statistics types
    FeedbackStats,
)

__all__ = [
    # Enums
    "FeedbackType",
    "FeedbackRating",
    "ActionOutcome",

    # Core data classes
    "Feedback",
    "CreateExplicitFeedbackOptions",
    "CreateImplicitFeedbackOptions",

    # Query types
    "FeedbackQuery",
    "FeedbackQueryResult",

    # Statistics types
    "FeedbackStats",
]
