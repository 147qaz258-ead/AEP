"""
AEP Session Module.

Exports types and utilities for AgentAction and Session,
as well as the SessionRecorder for managing session lifecycle,
and ActionLogger for recording agent actions.
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
from .action_logger import (
    ActionLogger,
    WriteError,
)

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
    # Action logging
    "ActionLogger",
    "WriteError",
]
