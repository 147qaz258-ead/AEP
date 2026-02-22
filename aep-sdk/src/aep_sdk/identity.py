"""
Agent Identity Store - Manages agent identity persistence.

This module provides platform-specific local storage for agent IDs,
supporting persistence across sessions and environment variable overrides.
"""

import os
import platform
import stat
from pathlib import Path
from typing import Optional
import re


class AgentIdentityStore:
    """
    Manages agent identity persistence to platform-specific local storage.

    Storage paths follow platform conventions:
    - Linux: ~/.config/aep/agent_id
    - macOS: ~/Library/Application Support/AEP/agent_id
    - Windows: %APPDATA%\\AEP\\agent_id
    """

    # Platform-specific storage paths
    STORAGE_PATHS = {
        "linux": "~/.config/aep/agent_id",
        "darwin": "~/Library/Application Support/AEP/agent_id",
        "win32": "${APPDATA}/AEP/agent_id",
        "windows": "${APPDATA}/AEP/agent_id",
    }

    # Default path for unknown platforms
    DEFAULT_PATH = "~/.config/aep/agent_id"

    # Agent ID format validation regex
    AGENT_ID_PATTERN = re.compile(r"^agent_0x[a-f0-9]{16}$")

    def __init__(self, custom_path: Optional[Path] = None):
        """
        Initialize the identity store.

        Args:
            custom_path: Optional custom storage path (for testing)
        """
        self._custom_path = custom_path

    def get_storage_path(self) -> Path:
        """
        Get the platform-specific storage path for the agent ID.

        Returns:
            Path to the agent_id file
        """
        if self._custom_path:
            return self._custom_path

        system = platform.system().lower()
        if system == "windows":
            system = "win32"

        path_template = self.STORAGE_PATHS.get(system, self.DEFAULT_PATH)

        # Handle environment variable expansion (especially for Windows)
        if "${APPDATA}" in path_template:
            appdata = os.environ.get("APPDATA", "")
            path_template = path_template.replace("${APPDATA}", appdata)

        return Path(path_template).expanduser()

    def save_agent_id(self, agent_id: str) -> None:
        """
        Persist agent_id to local storage.

        Args:
            agent_id: The agent ID to persist

        Raises:
            ValueError: If the agent_id format is invalid
            IOError: If the file cannot be written
        """
        if not self.validate_format(agent_id):
            raise ValueError(f"Invalid agent_id format: {agent_id}")

        path = self.get_storage_path()

        # Create parent directories if needed
        path.parent.mkdir(parents=True, exist_ok=True)

        # Write agent_id (single line, plain text)
        path.write_text(agent_id, encoding="utf-8")

        # Set file permissions (user-readable only on Unix)
        if platform.system().lower() != "windows":
            try:
                path.chmod(stat.S_IRUSR | stat.S_IWUSR)  # 0600
            except OSError:
                pass  # Ignore permission errors on some filesystems

    def load_agent_id(self) -> Optional[str]:
        """
        Load agent_id from local storage.

        Returns:
            The stored agent_id, or None if not found or invalid
        """
        path = self.get_storage_path()

        if not path.exists():
            return None

        try:
            content = path.read_text(encoding="utf-8").strip()

            # Validate the loaded ID
            if self.validate_format(content):
                return content

            # Invalid format - return None (could log warning)
            return None

        except (IOError, OSError):
            # File read error - return None
            return None

    def clear_agent_id(self) -> bool:
        """
        Clear the stored agent_id.

        Returns:
            True if the file was deleted, False if it didn't exist
        """
        path = self.get_storage_path()

        if path.exists():
            path.unlink()
            return True

        return False

    def has_agent_id(self) -> bool:
        """
        Check if an agent_id is stored.

        Returns:
            True if a valid agent_id exists in storage
        """
        return self.load_agent_id() is not None

    @classmethod
    def validate_format(cls, agent_id: str) -> bool:
        """
        Validate the format of an agent_id.

        Args:
            agent_id: The agent ID to validate

        Returns:
            True if the format is valid (agent_0x + 16 hex chars)
        """
        return bool(cls.AGENT_ID_PATTERN.match(agent_id))

    def get_or_create_storage_dir(self) -> Path:
        """
        Get the storage directory, creating it if necessary.

        Returns:
            Path to the storage directory
        """
        path = self.get_storage_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path.parent


def get_environment_agent_id() -> Optional[str]:
    """
    Get agent_id from AEP_AGENT_ID environment variable.

    Returns:
        The environment-specified agent_id, or None if not set/invalid
    """
    env_agent_id = os.environ.get("AEP_AGENT_ID")

    if env_agent_id:
        if AgentIdentityStore.validate_format(env_agent_id):
            return env_agent_id
        # Invalid format - could raise or log warning
        raise ValueError(f"Invalid AEP_AGENT_ID format: {env_agent_id}")

    return None


def ensure_agent_id(hub_url: str, store: Optional[AgentIdentityStore] = None) -> str:
    """
    Ensure the agent has an ID, loading from storage or registering if necessary.

    Priority:
    1. AEP_AGENT_ID environment variable
    2. Local storage
    3. Register with Hub (requires network call - not implemented here)

    Args:
        hub_url: The URL of the AEP Hub (for registration if needed)
        store: Optional AgentIdentityStore instance (created if not provided)

    Returns:
        The agent_id to use

    Raises:
        ValueError: If environment variable has invalid format
        RuntimeError: If no ID available and registration fails
    """
    if store is None:
        store = AgentIdentityStore()

    # 1. Check environment override
    try:
        env_agent_id = get_environment_agent_id()
        if env_agent_id:
            return env_agent_id
    except ValueError:
        raise  # Re-raise format errors

    # 2. Try local storage
    local_agent_id = store.load_agent_id()
    if local_agent_id:
        return local_agent_id

    # 3. Need to register - this would require HTTP call to hub
    # For now, raise an error indicating registration is needed
    raise RuntimeError(
        "No agent_id found in environment or local storage. "
        "Please register with the Hub first or set AEP_AGENT_ID environment variable."
    )
