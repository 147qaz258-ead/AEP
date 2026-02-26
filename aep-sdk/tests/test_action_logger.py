"""
Unit tests for ActionLogger.

Tests cover:
- log_action with and without active session
- log_tool_call, log_message, log_decision convenience methods
- get_action and update_action methods
- Latency requirements
- Error handling
"""

import json
import tempfile
import time
from pathlib import Path

import pytest

from aep_sdk.session import (
    SessionRecorder,
    SessionNotActiveError,
    ActionType,
    ActionResult,
    AgentAction,
    create_action,
)
from aep_sdk.session.action_logger import ActionLogger, WriteError


class TestActionLogger:
    """Tests for ActionLogger class."""

    def test_init(self):
        """Test initializing ActionLogger."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            logger = ActionLogger(recorder)

            assert logger.recorder is recorder

    def test_recorder_property(self):
        """Test that recorder property returns the underlying recorder."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            logger = ActionLogger(recorder)

            assert logger.recorder is recorder

    def test_log_action_requires_active_session(self):
        """Test that log_action raises error without active session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            logger = ActionLogger(recorder)

            action = create_action(
                action_type=ActionType.MESSAGE,
                trigger="test",
                solution="test solution",
                result=ActionResult.SUCCESS,
            )

            with pytest.raises(SessionNotActiveError):
                logger.log_action(action)

    def test_log_action_success(self):
        """Test successfully logging an action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action = create_action(
                action_type=ActionType.MESSAGE,
                trigger="Hello",
                solution="Hi there!",
                result=ActionResult.SUCCESS,
            )

            action_id = logger.log_action(action)
            assert action_id == action.id

    def test_log_action_written_to_session(self):
        """Test that logged action is persisted to session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_message(
                trigger="Hello",
                solution="Hi there!",
                result="success"
            )

            # Verify action is in session
            session = recorder.get_session(session_id)
            assert session is not None
            assert len(session.actions) == 1
            assert session.actions[0].trigger == "Hello"
            assert session.actions[0].solution == "Hi there!"

    def test_log_tool_call(self):
        """Test logging a tool call action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_tool_call(
                tool_name="bash",
                trigger="File not found",
                solution="Create file",
                result="success",
            )

            assert action_id is not None

            # Verify action properties
            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            action = session.actions[0]
            assert action.action_type == ActionType.TOOL_CALL
            assert action.trigger == "File not found"
            assert action.solution == "Create file"
            assert action.result == ActionResult.SUCCESS
            assert action.context.get("tool_name") == "bash"
            assert "bash" in action.context.get("tools_used", [])

    def test_log_tool_call_with_context(self):
        """Test logging a tool call with additional context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_tool_call(
                tool_name="read_file",
                trigger="Need file content",
                solution="Read file content",
                result="success",
                context={"file_path": "/path/to/file.txt", "encoding": "utf-8"},
            )

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            action = session.actions[0]
            assert action.context.get("file_path") == "/path/to/file.txt"
            assert action.context.get("encoding") == "utf-8"
            assert action.context.get("tool_name") == "read_file"

    def test_log_message(self):
        """Test logging a message action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_message(
                trigger="User question",
                solution="Agent response",
                result="success",
            )

            assert action_id is not None

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            action = session.actions[0]
            assert action.action_type == ActionType.MESSAGE
            assert action.trigger == "User question"
            assert action.solution == "Agent response"

    def test_log_message_with_context(self):
        """Test logging a message with context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_message(
                trigger="Help request",
                solution="Provided assistance",
                result="success",
                context={"conversation_id": "conv_123", "user_id": "user_456"},
            )

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            action = session.actions[0]
            assert action.context.get("conversation_id") == "conv_123"
            assert action.context.get("user_id") == "user_456"

    def test_log_decision(self):
        """Test logging a decision action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_decision(
                trigger="Multiple options available",
                solution="Chose option A",
                result="success",
            )

            assert action_id is not None

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            action = session.actions[0]
            assert action.action_type == ActionType.DECISION
            assert action.trigger == "Multiple options available"
            assert action.solution == "Chose option A"

    def test_log_decision_with_context(self):
        """Test logging a decision with context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_decision(
                trigger="Need to choose strategy",
                solution="Selected aggressive strategy",
                result="partial",
                context={"alternatives": ["conservative", "moderate", "aggressive"]},
            )

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            action = session.actions[0]
            assert action.result == ActionResult.PARTIAL
            assert "alternatives" in action.context

    def test_result_variations(self):
        """Test different result values."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            # Test success
            logger.log_message("test", "test", "success")
            # Test failure
            logger.log_message("test", "test", "failure")
            # Test partial
            logger.log_message("test", "test", "partial")

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            assert session.actions[0].result == ActionResult.SUCCESS
            assert session.actions[1].result == ActionResult.FAILURE
            assert session.actions[2].result == ActionResult.PARTIAL

    def test_invalid_result_raises_error(self):
        """Test that invalid result raises ValueError."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            with pytest.raises(ValueError) as exc_info:
                logger.log_message("test", "test", "invalid_result")

            assert "Invalid result" in str(exc_info.value)

    def test_get_action_found(self):
        """Test getting an action that exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_message(
                trigger="Test trigger",
                solution="Test solution",
            )

            found_action = logger.get_action(action_id)
            assert found_action is not None
            assert found_action.id == action_id
            assert found_action.trigger == "Test trigger"

    def test_get_action_not_found(self):
        """Test getting an action that doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            found_action = logger.get_action("nonexistent_action_id")
            assert found_action is None

    def test_get_action_no_active_session(self):
        """Test getting an action without an active session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            logger = ActionLogger(recorder)

            found_action = logger.get_action("some_id")
            assert found_action is None

    def test_update_action_success(self):
        """Test updating an action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_message(
                trigger="Original trigger",
                solution="Original solution",
            )

            success = logger.update_action(action_id, {
                "trigger": "Updated trigger",
                "solution": "Updated solution",
            })

            assert success is True

            updated_action = logger.get_action(action_id)
            assert updated_action is not None
            assert updated_action.trigger == "Updated trigger"
            assert updated_action.solution == "Updated solution"

    def test_update_action_not_found(self):
        """Test updating a non-existent action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            success = logger.update_action("nonexistent_id", {"trigger": "New"})
            assert success is False

    def test_update_action_no_active_session(self):
        """Test updating an action without an active session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            logger = ActionLogger(recorder)

            success = logger.update_action("some_id", {"trigger": "New"})
            assert success is False

    def test_update_action_result(self):
        """Test updating action result."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_message("test", "test", "success")

            success = logger.update_action(action_id, {"result": "failure"})

            assert success is True
            action = logger.get_action(action_id)
            assert action is not None
            assert action.result == ActionResult.FAILURE

    def test_update_action_context(self):
        """Test updating action context (merge)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_message(
                trigger="test",
                solution="test",
                context={"existing_key": "existing_value"},
            )

            success = logger.update_action(action_id, {
                "context": {"new_key": "new_value"},
            })

            assert success is True
            action = logger.get_action(action_id)
            assert action is not None
            assert action.context.get("existing_key") == "existing_value"
            assert action.context.get("new_key") == "new_value"

    def test_get_action_count(self):
        """Test getting action count."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            assert logger.get_action_count() == 0

            logger.log_message("test1", "test")
            assert logger.get_action_count() == 1

            logger.log_tool_call("bash", "test2", "test", "success")
            assert logger.get_action_count() == 2

            logger.log_decision("test3", "test", "success")
            assert logger.get_action_count() == 3

    def test_get_action_count_no_session(self):
        """Test getting action count without an active session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            logger = ActionLogger(recorder)

            assert logger.get_action_count() == 0

    def test_latency_under_100ms(self):
        """Test that logging action is under 100ms."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            start = time.perf_counter()
            logger.log_message("test", "test", "success")
            latency_ms = (time.perf_counter() - start) * 1000

            assert latency_ms < 100, f"Latency {latency_ms}ms exceeds 100ms threshold"

    def test_multiple_actions_in_sequence(self):
        """Test logging multiple actions in sequence."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            # Log multiple actions
            action_ids = []
            for i in range(10):
                action_id = logger.log_tool_call(
                    tool_name=f"tool_{i}",
                    trigger=f"Trigger {i}",
                    solution=f"Solution {i}",
                    result="success",
                )
                action_ids.append(action_id)

            assert len(action_ids) == 10
            assert len(set(action_ids)) == 10  # All unique

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            assert len(session.actions) == 10

    def test_action_persisted_to_file(self):
        """Test that action is persisted to JSONL file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_tool_call(
                tool_name="bash",
                trigger="File not found",
                solution="Created file",
                result="success",
            )

            # Verify file content
            file_path = Path(tmpdir) / ".aep" / "sessions" / f"{session_id}.jsonl"
            content = file_path.read_text()
            lines = content.strip().split("\n")

            assert len(lines) == 2  # header + 1 action

            action_line = json.loads(lines[1])
            assert action_line["_type"] == "action"
            assert action_line["action"]["action_type"] == "tool_call"
            assert action_line["action"]["trigger"] == "File not found"
            assert action_line["action"]["context"]["tool_name"] == "bash"


class TestActionLoggerEdgeCases:
    """Tests for edge cases and error handling."""

    def test_log_action_after_session_ended(self):
        """Test logging after session ended raises error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()
            recorder.end_session(session_id)

            logger = ActionLogger(recorder)

            with pytest.raises(SessionNotActiveError):
                logger.log_message("test", "test")

    def test_case_insensitive_result(self):
        """Test that result string is case-insensitive."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            # Test uppercase
            logger.log_message("test", "test", "SUCCESS")
            # Test mixed case
            logger.log_message("test", "test", "Failure")
            # Test lowercase
            logger.log_message("test", "test", "partial")

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            assert session.actions[0].result == ActionResult.SUCCESS
            assert session.actions[1].result == ActionResult.FAILURE
            assert session.actions[2].result == ActionResult.PARTIAL

    def test_empty_context(self):
        """Test logging with empty context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_message("test", "test", "success", context={})

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            assert session.actions[0].context == {}

    def test_complex_context(self):
        """Test logging with complex nested context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_tool_call(
                tool_name="complex_tool",
                trigger="Complex operation",
                solution="Executed complex operation",
                result="success",
                context={
                    "nested": {
                        "level1": {
                            "level2": ["a", "b", "c"],
                        },
                    },
                    "count": 42,
                    "enabled": True,
                },
            )

            session = recorder.get_session(recorder.get_active_session())
            assert session is not None
            action = session.actions[0]
            assert action.context["nested"]["level1"]["level2"] == ["a", "b", "c"]
            assert action.context["count"] == 42
            assert action.context["enabled"] is True

    def test_session_with_metadata(self):
        """Test logging actions in a session with metadata."""
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session(
                metadata={"task": "testing", "environment": "test"}
            )

            logger = ActionLogger(recorder)
            logger.log_message("test", "test")

            session = recorder.get_session(session_id)
            assert session is not None
            assert len(session.actions) == 1