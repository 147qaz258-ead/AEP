"""
AEP Protocol SDK

Agent Experience Protocol SDK for Python.
"""

from .client import (
    AEPClient,
    AEPError,
    AEPConnectionError,
    AEPRegistrationError,
)
from .identity import (
    AgentIdentityStore,
    get_environment_agent_id,
    ensure_agent_id,
)

__version__ = "0.1.0"
__all__ = [
    # Client
    "AEPClient",
    # Exceptions
    "AEPError",
    "AEPConnectionError",
    "AEPRegistrationError",
    # Identity
    "AgentIdentityStore",
    "get_environment_agent_id",
    "ensure_agent_id",
]
