"""
Unit tests for SessionRecorder and StorageManager.

Tests cover:
- Session lifecycle (start, record, end)
- JSONL file persistence
- Error handling for invalid states
"""

import json
import tempfile
from pathlib import Path

import pytest

from aep_sdk.session import (
    SessionRecorder,
    SessionError,
    SessionNotActiveError,
    StorageManager,
    ActionType,
    ActionResult,
    AgentAction,
    create_action,
)
from aep_sdk.session.recorder import SessionNotFoundError


class TestStorageManager:
    """Tests for StorageManager class."""

    def test_ensure_directory(self):
        """Test that ensure_directory creates the directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = StorageManager(Path(tmpdir))
            sessions_path = storage.ensure_directory("sessions")

            assert sessions_path.exists()
            assert sessions_path.name == "sessions"
            assert sessions_path.parent.name == ".aep"

    def test_get_sessions_path(self):
        """Test getting sessions path."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = StorageManager(Path(tmpdir))
            sessions_path = storage.get_sessions_path()

            assert sessions_path.exists()
            assert "sessions" in str(sessions_path)

    def test_get_session_file(self):
        """Test getting session file path."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = StorageManager(Path(tmpdir))
            file_path = storage.get_session_file("session_123")

            assert file_path.name == "session_123.jsonl"
            assert "sessions" in str(file_path)

    def test_session_exists(self):
        """Test checking if session file exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = StorageManager(Path(tmpdir))

            assert not storage.session_exists("session_123")

            # Create the file
            file_path = storage.get_session_file("session_123")
            file_path.write_text("{}")

            assert storage.session_exists("session_123")

    def test_archive_session(self):
        """Test archiving a session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = StorageManager(Path(tmpdir))

            # Create a session file
            file_path = storage.get_session_file("session_123")
            file_path.write_text('{"test": "data"}')

            # Archive it
            archive_path = storage.archive_session("session_123")

            assert archive_path is not None
            assert archive_path.exists()
            assert "archive" in str(archive_path)
            assert not file_path.exists()


class TestSessionRecorder:
    """Tests for SessionRecorder class."""

    def test_start_session(self):
        """Test starting a new session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            assert session_id.startswith("session_")
            assert recorder.get_active_session() == session_id

            # Verify file was created
            sessions_dir = Path(tmpdir) / ".aep" / "sessions"
            assert sessions_dir.exists()

            file_path = sessions_dir / f"{session_id}.jsonl"
            assert file_path.exists()

    def test_start_session_with_metadata(self):
        """Test starting a session with metadata."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session(
                metadata={"purpose": "debugging", "task": "fix_bug"}
            )

            assert session_id.startswith("session_")

            # Verify metadata in file
            file_path = Path(tmpdir) / ".aep" / "sessions" / f"{session_id}.jsonl"
            content = file_path.read_text()
            first_line = content.split('\n')[0]
            header = json.loads(first_line)

            assert header["metadata"]["purpose"] == "debugging"
            assert header["metadata"]["task"] == "fix_bug"

    def test_start_session_twice_raises_error(self):
        """Test that starting a second session raises an error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            with pytest.raises(SessionError) as exc_info:
                recorder.start_session()

            assert "Active session already exists" in str(exc_info.value)

    def test_get_active_session(self):
        """Test getting active session ID."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")

            assert recorder.get_active_session() is None

            session_id = recorder.start_session()
            assert recorder.get_active_session() == session_id

    def test_get_session(self):
        """Test getting a session by ID."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            session = recorder.get_session(session_id)
            assert session is not None
            assert session.id == session_id
            assert session.agent_id == "agent_0x1234"

    def test_end_session(self):
        """Test ending a session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()
            file_path = recorder.end_session(session_id)

            assert Path(file_path).exists()
            assert recorder.get_active_session() is None

            # Verify session was ended
            session = recorder.get_session(session_id)
            assert session is not None
            assert session.ended_at is not None

    def test_end_session_with_summary(self):
        """Test ending a session with summary."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()
            recorder.end_session(session_id, summary="Task completed")

            session = recorder.get_session(session_id)
            assert session is not None
            assert session.summary == "Task completed"

    def test_end_non_active_session_raises_error(self):
        """Test that ending a non-active session raises an error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")

            with pytest.raises(SessionNotActiveError):
                recorder.end_session("session_nonexistent")

    def test_record_action(self):
        """Test recording an action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            action = create_action(
                action_type=ActionType.TOOL_CALL,
                trigger="User requested file read",
                solution="Used fs.readFile",
                result=ActionResult.SUCCESS,
                context={"file": "test.txt"}
            )

            recorder.record_action(action)

            # Verify action was added to session
            session = recorder.get_session(session_id)
            assert session is not None
            assert len(session.actions) == 1
            assert session.actions[0].trigger == "User requested file read"

            # Verify action was written to file
            file_path = Path(tmpdir) / ".aep" / "sessions" / f"{session_id}.jsonl"
            content = file_path.read_text()
            lines = content.strip().split('\n')

            assert len(lines) == 2  # header + action

            action_line = json.loads(lines[1])
            assert action_line["_type"] == "action"
            assert action_line["action"]["trigger"] == "User requested file read"

    def test_record_action_without_active_session_raises_error(self):
        """Test that recording without an active session raises an error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")

            action = create_action(
                action_type=ActionType.TOOL_CALL,
                trigger="test",
                solution="test",
                result=ActionResult.SUCCESS,
            )

            with pytest.raises(SessionNotActiveError) as exc_info:
                recorder.record_action(action)

            assert "No active session" in str(exc_info.value)

    def test_multiple_actions(self):
        """Test recording multiple actions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            # Record multiple actions
            for i in range(5):
                action = create_action(
                    action_type=ActionType.TOOL_CALL,
                    trigger=f"Trigger {i}",
                    solution=f"Solution {i}",
                    result=ActionResult.SUCCESS,
                )
                recorder.record_action(action)

            session = recorder.get_session(session_id)
            assert session is not None
            assert len(session.actions) == 5

    def test_session_header_format(self):
        """Test that session header is correctly formatted."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            file_path = Path(tmpdir) / ".aep" / "sessions" / f"{session_id}.jsonl"
            content = file_path.read_text()
            first_line = content.split('\n')[0]
            header = json.loads(first_line)

            assert header["_type"] == "session_header"
            assert "session" in header
            assert header["session"]["id"] == session_id
            assert header["session"]["agent_id"] == "agent_0x1234"
            assert "started_at" in header["session"]

    def test_end_session_updates_header(self):
        """Test that ending session updates the header."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            # Record an action
            action = create_action(
                action_type=ActionType.MESSAGE,
                trigger="test",
                solution="test",
                result=ActionResult.SUCCESS,
            )
            recorder.record_action(action)

            # End session
            recorder.end_session(session_id, summary="Done")

            # Verify header was updated
            file_path = Path(tmpdir) / ".aep" / "sessions" / f"{session_id}.jsonl"
            content = file_path.read_text()
            first_line = content.split('\n')[0]
            header = json.loads(first_line)

            assert header["session"]["ended_at"] is not None
            assert header["session"]["summary"] == "Done"

    def test_get_session_from_file(self):
        """Test loading a session from file after it's ended."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            recorder.end_session(session_id, summary="Completed")

            # Session should be loadable from file
            session = recorder.get_session(session_id)
            assert session is not None
            assert session.id == session_id
            assert session.summary == "Completed"

    def test_get_nonexistent_session(self):
        """Test getting a session that doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session = recorder.get_session("nonexistent_session")

            assert session is None


class TestSessionRecorderIntegration:
    """Integration tests for SessionRecorder."""

    def test_full_session_lifecycle(self):
        """Test complete session lifecycle from start to end."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_test")

            # Start session
            session_id = recorder.start_session(
                metadata={"task": "integration_test"}
            )
            assert recorder.get_active_session() == session_id

            # Record multiple actions
            actions = [
                create_action(
                    action_type=ActionType.MESSAGE,
                    trigger="User asked for help",
                    solution="Provided helpful response",
                    result=ActionResult.SUCCESS,
                ),
                create_action(
                    action_type=ActionType.TOOL_CALL,
                    trigger="Needed to read config",
                    solution="Read config file",
                    result=ActionResult.SUCCESS,
                    context={"file": "config.json"},
                ),
                create_action(
                    action_type=ActionType.DECISION,
                    trigger="Multiple options available",
                    solution="Chose option A based on context",
                    result=ActionResult.SUCCESS,
                ),
            ]

            for action in actions:
                recorder.record_action(action)

            # End session
            file_path = recorder.end_session(
                session_id,
                summary="Integration test completed successfully"
            )

            # Verify final state
            assert recorder.get_active_session() is None
            assert Path(file_path).exists()

            # Verify file content
            content = Path(file_path).read_text()
            lines = content.strip().split('\n')

            assert len(lines) == 4  # 1 header + 3 actions

            # Verify header
            header = json.loads(lines[0])
            assert header["session"]["summary"] == "Integration test completed successfully"
            assert header["session"]["ended_at"] is not None

            # Verify actions
            for i, line in enumerate(lines[1:], 1):
                record = json.loads(line)
                assert record["_type"] == "action"
                assert "trigger" in record["action"]
