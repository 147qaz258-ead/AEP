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
from .models import BlastRadius, Experience, FeedbackResult, PublishPayload, PublishResult


class AEPError(Exception):
    """Base exception for AEP SDK errors."""

    pass


class AEPConnectionError(AEPError):
    """Raised when connection to Hub fails."""

    pass


class AEPRegistrationError(AEPError):
    """Raised when agent registration fails."""

    pass


class AEPFetchError(AEPError):
    """Raised when fetch operation fails."""

    pass


class AEPPublishError(AEPError):
    """Raised when publish operation fails."""

    pass


class AEPFeedbackError(AEPError):
    """Raised when feedback operation fails."""

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

    def fetch(
        self,
        signals: List[str],
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Experience]:
        """
        Fetch matching experiences from the Hub based on signals.

        Args:
            signals: List of signal strings to match (e.g., error types, keywords)
            limit: Optional maximum number of results to return
            offset: Optional offset for pagination

        Returns:
            List of Experience objects matching the signals

        Raises:
            AEPConnectionError: If connection to Hub fails
            AEPFetchError: If the fetch operation fails

        Example:
            # Basic usage
            experiences = client.fetch(signals=["TypeError", "undefined property"])

            # With pagination
            experiences = client.fetch(
                signals=["timeout", "API"],
                limit=10,
                offset=0
            )

            # Access results
            for exp in experiences:
                print(exp.id)          # "exp_..."
                print(exp.trigger)     # "TypeError..."
                print(exp.solution)    # "Add null check..."
                print(exp.confidence)  # 0.85
                print(exp.gdi_score)   # 0.72
        """
        payload: Dict[str, Any] = {
            "agent_id": self.agent_id,
            "signals": signals,
        }

        # Add optional pagination parameters
        if limit is not None:
            payload["limit"] = limit
        if offset is not None:
            payload["offset"] = offset

        try:
            session = self._get_session()
            response = session.post(
                f"{self._hub_url}/v1/fetch",
                json=payload,
                timeout=self._timeout,
            )

            if not response.ok:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", "Unknown error")
                except Exception:
                    error_msg = f"HTTP {response.status_code}"
                raise AEPFetchError(
                    f"Fetch failed: {error_msg} (status {response.status_code})"
                )

            # Parse response
            response_data = response.json()
            experiences_data = response_data.get("experiences", [])

            # Convert to Experience objects
            return [Experience.from_dict(exp) for exp in experiences_data]

        except requests.ConnectionError as e:
            raise AEPConnectionError(f"Failed to connect to Hub: {e}")
        except requests.Timeout:
            raise AEPConnectionError(f"Connection timed out after {self._timeout}s")
        except requests.RequestException as e:
            raise AEPConnectionError(f"Request failed: {e}")

    def publish(
        self,
        trigger: str,
        solution: str,
        confidence: float = 0.8,
        context: Optional[Dict[str, Any]] = None,
        signals_match: Optional[List[str]] = None,
        gene: Optional[str] = None,
        blast_radius: Optional[BlastRadius] = None,
    ) -> PublishResult:
        """
        Publish a new experience to the Hub.

        This method creates and publishes an experience (Gene + Capsule format)
        to the AEP Hub. The experience can later be matched and retrieved by
        other agents encountering similar triggers.

        Args:
            trigger: The trigger pattern (error, issue, or situation) that
                this experience addresses. Should be descriptive enough for
                matching (e.g., "TypeError: Cannot read property 'x' of undefined")
            solution: The solution or fix that worked for this trigger.
                Should be actionable (e.g., "Add null check before accessing property")
            confidence: Confidence level for this solution (0.0 to 1.0).
                Default is 0.8. Higher values indicate more certainty.
            context: Optional additional context metadata. Can include
                language, framework, environment info, etc.
                Example: {"language": "python", "library": "requests"}
            signals_match: Optional list of signal types that should match
                this experience. Used for categorization and matching.
            gene: Optional gene ID if this experience belongs to an
                existing gene family.
            blast_radius: Optional blast radius indicating the scope of
                changes (files affected, lines changed).

        Returns:
            PublishResult containing:
                - experience_id: Unique identifier for the published experience
                - status: Status of the experience ('candidate' or 'promoted')
                - created_at: ISO 8601 timestamp of creation
                - duplicate: Whether this was a duplicate of existing experience
                - message: Human-readable result message

        Raises:
            AEPConnectionError: If connection to Hub fails
            AEPPublishError: If the publish operation fails (validation, etc.)

        Example:
            # Basic usage
            result = client.publish(
                trigger="TypeError: Cannot read property 'x' of undefined",
                solution="Add null check before accessing property",
                confidence=0.85
            )
            print(result.experience_id)  # "exp_..."
            print(result.status)         # "candidate"

            # With additional context
            result = client.publish(
                trigger="TimeoutError in API call",
                solution="Increase connection timeout to 30s",
                confidence=0.90,
                context={"language": "python", "library": "requests"},
                signals_match=["timeout", "network", "api"]
            )

            # With blast radius
            from aep_sdk.models import BlastRadius
            result = client.publish(
                trigger="Database connection pool exhausted",
                solution="Increase max connections in pool config",
                confidence=0.95,
                blast_radius=BlastRadius(files=2, lines=15)
            )
        """
        # Build the internal Gene + Capsule payload
        internal_payload = PublishPayload(
            trigger=trigger,
            solution=solution,
            confidence=confidence,
            signals_match=signals_match,
            gene=gene,
            context=context,
            blast_radius=blast_radius,
        )

        # Build the AEP envelope request
        request_body = {
            "type": "publish",
            "sender": self.agent_id,
            "payload": internal_payload.to_dict(),
        }

        try:
            session = self._get_session()
            response = session.post(
                f"{self._hub_url}/v1/publish",
                json=request_body,
                timeout=self._timeout,
            )

            if not response.ok:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", "Unknown error")
                    # Include more details if available
                    if "message" in error_data:
                        error_msg = f"{error_msg}: {error_data['message']}"
                except Exception:
                    error_msg = f"HTTP {response.status_code}"
                raise AEPPublishError(
                    f"Publish failed: {error_msg} (status {response.status_code})"
                )

            # Parse response and return PublishResult
            response_data = response.json()
            return PublishResult.from_dict(response_data)

        except requests.ConnectionError as e:
            raise AEPConnectionError(f"Failed to connect to Hub: {e}")
        except requests.Timeout:
            raise AEPConnectionError(f"Connection timed out after {self._timeout}s")
        except requests.RequestException as e:
            raise AEPConnectionError(f"Request failed: {e}")

    def feedback(
        self,
        experience_id: str,
        outcome: str,
        score: Optional[float] = None,
        notes: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> FeedbackResult:
        """
        Submit feedback for an experience to the Hub.

        This method allows agents to report the outcome of using an experience,
        which helps improve the GDI (Good Distribution Index) and status of
        the experience in the network.

        Args:
            experience_id: The unique identifier of the experience to provide
                feedback for (e.g., "exp_abc123")
            outcome: The result of using the experience. Must be one of:
                - "success": The experience solved the problem
                - "failure": The experience did not work
                - "partial": The experience partially helped
            score: Optional score (0.0 to 1.0) indicating how effective the
                experience was. Higher is better.
            notes: Optional notes about the feedback, especially useful for
                failures to explain what went wrong.
            context: Optional additional context metadata about the feedback.
                Example: {"error": "Still failing after patch", "attempts": 3}

        Returns:
            FeedbackResult containing:
                - status: Always "recorded" on success
                - feedback_id: Unique identifier for the submitted feedback
                - reward_earned: Reward points earned for this feedback
                - updated_stats: Updated statistics for the experience
                - previous_status: Previous status (candidate/promoted/deprecated)
                - new_status: New status after feedback
                - new_gdi_score: Updated GDI score of the experience

        Raises:
            AEPConnectionError: If connection to Hub fails
            AEPFeedbackError: If the feedback operation fails (validation, etc.)

        Example:
            # Success feedback with score
            result = client.feedback(
                experience_id="exp_abc123",
                outcome="success",
                score=0.9
            )
            print(result.status)         # "recorded"
            print(result.new_gdi_score)  # 0.78

            # Failure feedback with context
            result = client.feedback(
                experience_id="exp_abc123",
                outcome="failure",
                notes="Still failing after patch",
                context={"error": "TypeError persists"}
            )
            print(result.status)         # "recorded"
        """
        # Validate outcome
        valid_outcomes = ("success", "failure", "partial")
        if outcome not in valid_outcomes:
            raise ValueError(
                f"Invalid outcome '{outcome}'. Must be one of: {valid_outcomes}"
            )

        # Validate score if provided
        if score is not None and not (0.0 <= score <= 1.0):
            raise ValueError(f"Score must be between 0.0 and 1.0, got {score}")

        # Build the feedback payload
        payload: Dict[str, Any] = {
            "experience_id": experience_id,
            "outcome": outcome,
        }
        if score is not None:
            payload["score"] = score
        if notes is not None:
            payload["notes"] = notes
        # Note: context is merged into notes for now since the API doesn't have
        # a separate context field in the payload
        if context is not None:
            # If there are existing notes, append context info
            context_str = str(context)
            if notes:
                payload["notes"] = f"{notes} | Context: {context_str}"
            else:
                payload["notes"] = f"Context: {context_str}"

        # Build the AEP envelope request
        request_body = {
            "type": "feedback",
            "sender": self.agent_id,
            "payload": payload,
        }

        try:
            session = self._get_session()
            response = session.post(
                f"{self._hub_url}/v1/feedback",
                json=request_body,
                timeout=self._timeout,
            )

            if not response.ok:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", "Unknown error")
                    # Include more details if available
                    if "message" in error_data:
                        error_msg = f"{error_msg}: {error_data['message']}"
                except Exception:
                    error_msg = f"HTTP {response.status_code}"
                raise AEPFeedbackError(
                    f"Feedback failed: {error_msg} (status {response.status_code})"
                )

            # Parse response and return FeedbackResult
            response_data = response.json()
            return FeedbackResult.from_dict(response_data)

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
