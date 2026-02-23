"""
AEP Client - Core SDK client for AEP Protocol communication.

This module provides the main client class for interacting with the AEP Hub,
including automatic identity management and HTTP communication.
"""

import secrets
from typing import Any, Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .identity import AgentIdentityStore, get_environment_agent_id


class AEPError(Exception):
    """Base exception for AEP SDK errors."""

    pass


class AEPConnectionError(AEPError):
    """Raised when connection to Hub fails."""

    pass


class AEPRegistrationError(AEPError):
    """Raised when agent registration fails."""

    pass


class AEPClient:
    """
    AEP Protocol SDK Client.

    Provides high-level interface for:
    - Automatic agent identity management
    - Hub connection and communication
    - Agent registration

    Usage:
        client = AEPClient(hub_url="http://localhost:3000")
        agent_id = client.agent_id
        is_registered = client.is_registered
        client.register(name="My Agent", capabilities=["code_generation"])
    """

    DEFAULT_TIMEOUT = 30  # seconds
    DEFAULT_RETRY_COUNT = 3
    DEFAULT_RETRY_BACKOFF = 0.5

    def __init__(
        self,
        hub_url: str,
        timeout: int = DEFAULT_TIMEOUT,
        identity_store: Optional[AgentIdentityStore] = None,
    ):
        """
        Initialize the AEP Client.

        Args:
            hub_url: URL of the AEP Hub (e.g., "http://localhost:3000")
            timeout: HTTP request timeout in seconds
            identity_store: Optional custom identity store (for testing)
        """
        self._hub_url = hub_url.rstrip("/")
        self._timeout = timeout
        self._identity_store = identity_store or AgentIdentityStore()
        self._session: Optional[requests.Session] = None
        self._agent_id: Optional[str] = None
        self._is_registered: Optional[bool] = None

    @property
    def hub_url(self) -> str:
        """Get the Hub URL."""
        return self._hub_url

    @property
    def agent_id(self) -> str:
        """
        Get the agent ID, loading from storage or environment.

        Returns:
            The agent ID string (format: agent_0x...16 hex chars)

        Raises:
            RuntimeError: If no agent_id is available
        """
        if self._agent_id is None:
            self._agent_id = self._load_or_create_agent_id()
        return self._agent_id

    @property
    def is_registered(self) -> bool:
        """
        Check if the agent is registered with the Hub.

        Returns:
            True if registered, False otherwise
        """
        if self._is_registered is None:
            self._is_registered = self._check_registration()
        return self._is_registered

    def _get_session(self) -> requests.Session:
        """
        Get or create the HTTP session with retry configuration.

        Returns:
            Configured requests Session
        """
        if self._session is None:
            self._session = requests.Session()

            # Configure retry strategy
            retry_strategy = Retry(
                total=self.DEFAULT_RETRY_COUNT,
                backoff_factor=self.DEFAULT_RETRY_BACKOFF,
                status_forcelist=[502, 503, 504],
            )
            adapter = HTTPAdapter(max_retries=retry_strategy)
            self._session.mount("http://", adapter)
            self._session.mount("https://", adapter)

        return self._session

    def _load_or_create_agent_id(self) -> str:
        """
        Load existing agent_id or prepare for registration.

        Priority:
        1. AEP_AGENT_ID environment variable
        2. Local storage

        Returns:
            The agent_id

        Raises:
            RuntimeError: If no ID available (caller should register)
        """
        # 1. Check environment override
        try:
            env_agent_id = get_environment_agent_id()
            if env_agent_id:
                return env_agent_id
        except ValueError as e:
            raise RuntimeError(f"Invalid AEP_AGENT_ID: {e}")

        # 2. Try local storage
        local_agent_id = self._identity_store.load_agent_id()
        if local_agent_id:
            return local_agent_id

        # No ID available - need to register
        raise RuntimeError(
            "No agent_id found. Please call client.register() first "
            "or set AEP_AGENT_ID environment variable."
        )

    def _generate_agent_id(self) -> str:
        """
        Generate a new agent ID.

        Returns:
            New agent ID in format: agent_0x + 16 hex chars
        """
        hex_part = secrets.token_hex(8)  # 8 bytes = 16 hex chars
        return f"agent_0x{hex_part}"

    def _check_registration(self) -> bool:
        """
        Check if the current agent is registered with the Hub.

        Returns:
            True if registered, False otherwise
        """
        try:
            agent_id = self.agent_id
        except RuntimeError:
            return False

        try:
            session = self._get_session()
            response = session.get(
                f"{self._hub_url}/api/agents/{agent_id}",
                timeout=self._timeout,
            )
            return response.status_code == 200
        except requests.RequestException:
            # If we can't reach the hub, assume not registered
            return False

    def register(
        self,
        name: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Register the agent with the Hub.

        If agent_id already exists in storage, will use that.
        Otherwise, generates a new ID and registers it.

        Args:
            name: Optional agent name
            capabilities: Optional list of agent capabilities
            metadata: Optional additional metadata

        Returns:
            The agent_id

        Raises:
            AEPConnectionError: If connection to Hub fails
            AEPRegistrationError: If registration fails
        """
        # Try to use existing ID from storage, or generate new one
        try:
            agent_id = self._load_or_create_agent_id()
        except RuntimeError:
            agent_id = self._generate_agent_id()

        # Prepare registration payload
        payload = {
            "agent_id": agent_id,
            "name": name or "Unnamed Agent",
            "capabilities": capabilities or [],
        }
        if metadata:
            payload["metadata"] = metadata

        # Send registration request
        try:
            session = self._get_session()
            response = session.post(
                f"{self._hub_url}/api/agents/register",
                json=payload,
                timeout=self._timeout,
            )

            if response.status_code not in (200, 201):
                error_msg = response.json().get("error", "Unknown error")
                raise AEPRegistrationError(
                    f"Registration failed: {error_msg} (status {response.status_code})"
                )

        except requests.ConnectionError as e:
            raise AEPConnectionError(f"Failed to connect to Hub at {self._hub_url}: {e}")
        except requests.Timeout:
            raise AEPConnectionError(f"Connection to Hub timed out after {self._timeout}s")
        except requests.RequestException as e:
            raise AEPConnectionError(f"Request failed: {e}")

        # Save the agent_id to local storage
        self._identity_store.save_agent_id(agent_id)

        # Update internal state
        self._agent_id = agent_id
        self._is_registered = True

        return agent_id

    def send_signal(
        self,
        signal_type: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Send a signal to the Hub.

        Args:
            signal_type: Type of signal (e.g., "capability_advertisement")
            payload: Signal payload

        Returns:
            Response from the Hub

        Raises:
            AEPConnectionError: If connection fails
            AEPError: If the Hub returns an error
        """
        try:
            session = self._get_session()
            response = session.post(
                f"{self._hub_url}/api/signals",
                json={
                    "agent_id": self.agent_id,
                    "signal_type": signal_type,
                    "payload": payload,
                },
                timeout=self._timeout,
            )

            if not response.ok:
                error_msg = response.json().get("error", "Unknown error")
                raise AEPError(f"Signal failed: {error_msg} (status {response.status_code})")

            return response.json()

        except requests.ConnectionError as e:
            raise AEPConnectionError(f"Failed to connect to Hub: {e}")
        except requests.Timeout:
            raise AEPConnectionError(f"Connection timed out after {self._timeout}s")
        except requests.RequestException as e:
            raise AEPConnectionError(f"Request failed: {e}")

    def send_feedback(
        self,
        feedback_type: str,
        target_id: str,
        rating: Optional[int] = None,
        comment: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send feedback to the Hub.

        Args:
            feedback_type: Type of feedback
            target_id: ID of the target (signal, experience, etc.)
            rating: Optional rating (1-5)
            comment: Optional comment
            metadata: Optional additional metadata

        Returns:
            Response from the Hub

        Raises:
            AEPConnectionError: If connection fails
            AEPError: If the Hub returns an error
        """
        payload = {
            "agent_id": self.agent_id,
            "feedback_type": feedback_type,
            "target_id": target_id,
        }
        if rating is not None:
            payload["rating"] = rating
        if comment is not None:
            payload["comment"] = comment
        if metadata is not None:
            payload["metadata"] = metadata

        try:
            session = self._get_session()
            response = session.post(
                f"{self._hub_url}/api/feedback",
                json=payload,
                timeout=self._timeout,
            )

            if not response.ok:
                error_msg = response.json().get("error", "Unknown error")
                raise AEPError(f"Feedback failed: {error_msg} (status {response.status_code})")

            return response.json()

        except requests.ConnectionError as e:
            raise AEPConnectionError(f"Failed to connect to Hub: {e}")
        except requests.Timeout:
            raise AEPConnectionError(f"Connection timed out after {self._timeout}s")
        except requests.RequestException as e:
            raise AEPConnectionError(f"Request failed: {e}")

    def close(self) -> None:
        """Close the HTTP session and release resources."""
        if self._session is not None:
            self._session.close()
            self._session = None

    def __enter__(self) -> "AEPClient":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.close()
