"""
Session Recorder for AEP SDK.

This module provides the SessionRecorder class for managing session lifecycle.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .models import AgentAction, Session, generate_id
from .storage import StorageManager


class SessionError(Exception):
    """Base exception for session-related errors."""
    pass


class SessionNotActiveError(SessionError):
    """Raised when trying to operate on an inactive session."""
    pass


class SessionNotFoundError(SessionError):
    """Raised when a session cannot be found."""
    pass


class SessionRecorder:
    """
    Session recorder for managing agent session lifecycle.

    This class handles creating, recording actions to, and ending sessions.
    Sessions are persisted to JSONL files in the .aep/sessions directory.

    Usage:
        recorder = SessionRecorder(workspace="/path/to/project", agent_id="agent_0x1234")
        session_id = recorder.start_session(metadata={"purpose": "debugging"})
        # ... record actions ...
        recorder.end_session(session_id, summary="Task completed successfully")

    Attributes:
        workspace: Path to the workspace directory
        agent_id: Identifier of the agent
    """

    def __init__(self, workspace: str, agent_id: str):
        """
        Initialize the session recorder.

        Args:
            workspace: Path to the workspace directory
            agent_id: Unique identifier for the agent
        """
        self.workspace = Path(workspace)
        self.agent_id = agent_id
        self._active_session: Optional[Session] = None
        self._storage = StorageManager(self.workspace)

        # Ensure sessions directory exists
        self._storage.ensure_directory("sessions")

    def start_session(self, metadata: Optional[dict[str, Any]] = None) -> str:
        """
        Start a new session.

        Creates a new session and persists it to a JSONL file.
        Only one session can be active at a time.

        Args:
            metadata: Optional metadata to include in the session header

        Returns:
            The session ID

        Raises:
            SessionError: If a session is already active
        """
        if self._active_session is not None:
            raise SessionError(
                f"Active session already exists: {self._active_session.id}. "
                "End the current session before starting a new one."
            )

        # Create new session
        session_id = f"session_{generate_id()}"
        started_at = datetime.utcnow().isoformat() + "Z"

        self._active_session = Session(
            id=session_id,
            agent_id=self.agent_id,
            started_at=started_at,
            actions=[],
        )

        # Create JSONL file with header
        file_path = self._storage.get_session_file(session_id)
        self._write_session_header(file_path, self._active_session, metadata)

        return session_id

    def get_active_session(self) -> Optional[str]:
        """
        Get the current active session ID.

        Returns:
            The active session ID, or None if no session is active
        """
        return self._active_session.id if self._active_session else None

    def get_session(self, session_id: str) -> Optional[Session]:
        """
        Get a session by ID.

        Args:
            session_id: The session identifier

        Returns:
            The Session object, or None if not found
        """
        # Check if it's the active session
        if self._active_session and self._active_session.id == session_id:
            return self._active_session

        # Load from file
        return self._load_session(session_id)

    def record_action(self, action: AgentAction) -> None:
        """
        Record an action to the active session.

        Args:
            action: The AgentAction to record

        Raises:
            SessionNotActiveError: If no session is currently active
        """
        if self._active_session is None:
            raise SessionNotActiveError(
                "No active session. Call start_session() first."
            )

        # Add action to session
        self._active_session.add_action(action)

        # Append action to JSONL file
        file_path = self._storage.get_session_file(self._active_session.id)
        self._append_action(file_path, action)

    def end_session(
        self,
        session_id: str,
        summary: Optional[str] = None
    ) -> str:
        """
        End a session.

        Updates the session status, adds end timestamp and optional summary.

        Args:
            session_id: The session identifier
            summary: Optional summary of the session

        Returns:
            Path to the session JSONL file

        Raises:
            SessionNotActiveError: If the session is not active
        """
        if not self._active_session or self._active_session.id != session_id:
            raise SessionNotActiveError(
                f"Session not active: {session_id}"
            )

        # End the session
        self._active_session.end(summary=summary)

        # Update the session header in the file
        file_path = self._storage.get_session_file(session_id)
        self._update_session_header(file_path, self._active_session)

        # Clear active session
        result_path = str(file_path)
        self._active_session = None

        return result_path

    def pause_session(self, session_id: str) -> None:
        """
        Pause a session (placeholder for future implementation).

        Args:
            session_id: The session identifier

        Raises:
            SessionNotActiveError: If the session is not active
        """
        if not self._active_session or self._active_session.id != session_id:
            raise SessionNotActiveError(f"Session not active: {session_id}")

        # TODO: Implement pause logic
        # This could involve updating the session status to 'paused'
        # and recording a pause timestamp
        pass

    def resume_session(self, session_id: str) -> None:
        """
        Resume a paused session (placeholder for future implementation).

        Args:
            session_id: The session identifier

        Raises:
            SessionError: If the session cannot be resumed
        """
        if self._active_session is not None:
            raise SessionError(
                f"Active session already exists: {self._active_session.id}"
            )

        # TODO: Implement resume logic
        # This could involve loading the session from file,
        # checking if it's paused, and updating status to 'active'
        pass

    def _write_session_header(
        self,
        file_path: Path,
        session: Session,
        metadata: Optional[dict[str, Any]] = None
    ) -> None:
        """
        Write session header to JSONL file.

        Args:
            file_path: Path to the JSONL file
            session: The session object
            metadata: Optional metadata to include
        """
        header = {
            "_type": "session_header",
            "session": session.to_dict(),
        }
        if metadata:
            header["metadata"] = metadata

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(header, ensure_ascii=False) + '\n')

    def _append_action(self, file_path: Path, action: AgentAction) -> None:
        """
        Append an action record to the JSONL file.

        Args:
            file_path: Path to the JSONL file
            action: The action to append
        """
        record = {
            "_type": "action",
            "action": action.to_dict()
        }

        with open(file_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')

    def _update_session_header(self, file_path: Path, session: Session) -> None:
        """
        Update the session header in the JSONL file.

        Reads the file, updates the header, and rewrites the file.

        Args:
            file_path: Path to the JSONL file
            session: The updated session object
        """
        # Read all lines
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        if not lines:
            # If file is empty, just write the header
            self._write_session_header(file_path, session)
            return

        # Update the first line (header)
        lines[0] = json.dumps({
            "_type": "session_header",
            "session": session.to_dict()
        }, ensure_ascii=False) + '\n'

        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)

    def _load_session(self, session_id: str) -> Optional[Session]:
        """
        Load a session from file.

        Args:
            session_id: The session identifier

        Returns:
            The Session object, or None if not found
        """
        file_path = self._storage.get_session_file(session_id)
        if not file_path.exists():
            return None

        with open(file_path, 'r', encoding='utf-8') as f:
            first_line = f.readline()
            if not first_line:
                return None

            header = json.loads(first_line)
            if header.get("_type") != "session_header":
                return None

            session_data = header.get("session", {})
            return Session.from_dict(session_data)
