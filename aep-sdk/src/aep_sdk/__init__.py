"""
AEP Protocol SDK

Agent Experience Protocol SDK for Python.
"""

from .client import (
    AEPClient,
    AEPError,
    AEPConnectionError,
    AEPRegistrationError,
    AEPFetchError,
    AEPPublishError,
    AEPFeedbackError,
)
from .identity import (
    AgentIdentityStore,
    get_environment_agent_id,
    ensure_agent_id,
)
from .models import BlastRadius, Experience, FeedbackResult, PublishPayload, PublishResult
from .collectors import LogCollector, LogEntry, LogCollectorConfig

__version__ = "0.1.0"
__all__ = [
    # Client
    "AEPClient",
    # Exceptions
    "AEPError",
    "AEPConnectionError",
    "AEPRegistrationError",
    "AEPFetchError",
    "AEPPublishError",
    "AEPFeedbackError",
    # Identity
    "AgentIdentityStore",
    "get_environment_agent_id",
    "ensure_agent_id",
    # Models
    "Experience",
    "BlastRadius",
    "PublishPayload",
    "PublishResult",
    "FeedbackResult",
    # Collectors
    "LogCollector",
    "LogEntry",
    "LogCollectorConfig",
]
