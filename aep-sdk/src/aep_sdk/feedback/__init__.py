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

from .collector import (
    # Collector classes
    FeedbackCollector,
    FeedbackError,
    FeedbackNotFoundError,
    InvalidRatingError,
    SubmitExplicitFeedbackOptions,
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

    # Collector
    "FeedbackCollector",
    "FeedbackError",
    "FeedbackNotFoundError",
    "InvalidRatingError",
    "SubmitExplicitFeedbackOptions",
]
