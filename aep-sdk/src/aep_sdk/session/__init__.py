"""
AEP Session Module.

Exports types and utilities for AgentAction and Session,
as well as the SessionRecorder for managing session lifecycle.
"""

from .models import (
    # Enums
    ActionType,
    ActionResult,
    FeedbackRating,
    # Dataclasses
    FeedbackInfo,
    AgentAction,
    Session,
    # Utility functions
    generate_id,
    create_action,
    create_session,
)
from .recorder import (
    SessionRecorder,
    SessionError,
    SessionNotActiveError,
    SessionNotFoundError,
)
from .storage import StorageManager

__all__ = [
    # Enums
    "ActionType",
    "ActionResult",
    "FeedbackRating",
    # Dataclasses
    "FeedbackInfo",
    "AgentAction",
    "Session",
    # Utility functions
    "generate_id",
    "create_action",
    "create_session",
    # Session management
    "SessionRecorder",
    "SessionError",
    "SessionNotActiveError",
    "SessionNotFoundError",
    "StorageManager",
]
