"""
Storage Manager for AEP Session files.

This module handles file system operations for session storage.
"""

from pathlib import Path
from typing import Optional


class StorageManager:
    """
    Storage manager for AEP session files.

    Manages the directory structure for sessions, memory, pending, cache, and archive.

    Attributes:
        SESSIONS_DIR: Directory name for active sessions
        MEMORY_DIR: Directory name for memory files
        PENDING_DIR: Directory name for pending uploads
        CACHE_DIR: Directory name for cache files
        ARCHIVE_DIR: Directory name for archived sessions
    """

    SESSIONS_DIR = "sessions"
    MEMORY_DIR = "memory"
    PENDING_DIR = "pending"
    CACHE_DIR = "cache"
    ARCHIVE_DIR = "sessions/archive"

    def __init__(self, workspace: Path):
        """
        Initialize the storage manager.

        Args:
            workspace: Path to the workspace directory
        """
        self.workspace = workspace
        self.aep_dir = workspace / ".aep"

    def ensure_directory(self, dir_name: str) -> Path:
        """
        Ensure a directory exists within .aep.

        Args:
            dir_name: Name of the directory to ensure

        Returns:
            Path to the ensured directory
        """
        dir_path = self.aep_dir / dir_name
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path

    def get_sessions_path(self) -> Path:
        """Get the sessions directory path."""
        return self.ensure_directory(self.SESSIONS_DIR)

    def get_memory_path(self) -> Path:
        """Get the memory directory path."""
        return self.ensure_directory(self.MEMORY_DIR)

    def get_pending_path(self) -> Path:
        """Get the pending directory path."""
        return self.ensure_directory(self.PENDING_DIR)

    def get_cache_path(self) -> Path:
        """Get the cache directory path."""
        return self.ensure_directory(self.CACHE_DIR)

    def get_archive_path(self) -> Path:
        """Get the archive directory path."""
        return self.ensure_directory(self.ARCHIVE_DIR)

    def get_session_file(self, session_id: str) -> Path:
        """
        Get the file path for a session.

        Args:
            session_id: The session identifier

        Returns:
            Path to the session JSONL file
        """
        return self.get_sessions_path() / f"{session_id}.jsonl"

    def session_exists(self, session_id: str) -> bool:
        """
        Check if a session file exists.

        Args:
            session_id: The session identifier

        Returns:
            True if the session file exists
        """
        return self.get_session_file(session_id).exists()

    def archive_session(self, session_id: str) -> Optional[Path]:
        """
        Move a session to the archive directory.

        Args:
            session_id: The session identifier

        Returns:
            Path to the archived file, or None if source doesn't exist
        """
        source = self.get_session_file(session_id)
        if not source.exists():
            return None

        archive_path = self.get_archive_path() / f"{session_id}.jsonl"
        source.rename(archive_path)
        return archive_path
