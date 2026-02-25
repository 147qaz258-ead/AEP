"""
Tests for AgentAction and Session data models.

Tests creation, serialization, deserialization, and validation.
"""

import json
import pytest

from aep_sdk.models import AgentAction, Session


class TestAgentAction:
    """Tests for AgentAction dataclass."""

    def test_create_agent_action_basic(self):
        """Test creating an AgentAction with basic fields."""
        action = AgentAction.create(
            action_type="tool_call",
            trigger="TypeError: 'NoneType' object is not subscriptable",
            solution="Added null check before accessing index",
            result="success"
        )

        assert action.id  # Should have a UUID
        assert action.timestamp  # Should have a timestamp
        assert action.action_type == "tool_call"
        assert action.trigger == "TypeError: 'NoneType' object is not subscriptable"
        assert action.solution == "Added null check before accessing index"
        assert action.result == "success"
        assert action.context == {}
        assert action.feedback is None
        assert action.metadata is None

    def test_create_agent_action_with_context(self):
        """Test creating an AgentAction with context."""
        context = {
            "file": "src/main.py",
            "line": 42,
            "function": "process_data"
        }
        metadata = {
            "tool_name": "code_fixer",
            "duration_ms": 150
        }

        action = AgentAction.create(
            action_type="decision",
            trigger="Multiple solutions available",
            solution="Chose option A based on performance",
            result="partial",
            context=context,
            metadata=metadata
        )

        assert action.context == context
        assert action.metadata == metadata
        assert action.result == "partial"

    def test_agent_action_to_dict(self):
        """Test AgentAction serialization to dictionary."""
        action = AgentAction.create(
            action_type="message",
            trigger="User asked for help",
            solution="Provided documentation link",
            result="success"
        )

        data = action.to_dict()

        assert data["id"] == action.id
        assert data["timestamp"] == action.timestamp
        assert data["action_type"] == "message"
        assert data["trigger"] == "User asked for help"
        assert data["solution"] == "Provided documentation link"
        assert data["result"] == "success"
        assert data["context"] == {}
        assert data["feedback"] is None
        assert data["metadata"] is None

    def test_agent_action_from_dict(self):
        """Test AgentAction deserialization from dictionary."""
        data = {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "timestamp": "2026-02-24T10:30:00.000000",
            "action_type": "tool_call",
            "trigger": "ImportError: No module named 'requests'",
            "solution": "pip install requests",
            "result": "success",
            "context": {"python_version": "3.11"},
            "feedback": {"rating": 5},
            "metadata": {"attempt": 1}
        }

        action = AgentAction.from_dict(data)

        assert action.id == "550e8400-e29b-41d4-a716-446655440000"
        assert action.timestamp == "2026-02-24T10:30:00.000000"
        assert action.action_type == "tool_call"
        assert action.trigger == "ImportError: No module named 'requests'"
        assert action.solution == "pip install requests"
        assert action.result == "success"
        assert action.context == {"python_version": "3.11"}
        assert action.feedback == {"rating": 5}
        assert action.metadata == {"attempt": 1}

    def test_agent_action_to_dict_from_dict_roundtrip(self):
        """Test that to_dict and from_dict are inverses."""
        original = AgentAction.create(
            action_type="tool_call",
            trigger="SyntaxError: invalid syntax",
            solution="Fixed indentation",
            result="success",
            context={"file": "test.py"},
            metadata={"line": 10}
        )
        original.feedback = {"helpful": True}

        data = original.to_dict()
        restored = AgentAction.from_dict(data)

        assert restored.id == original.id
        assert restored.timestamp == original.timestamp
        assert restored.action_type == original.action_type
        assert restored.trigger == original.trigger
        assert restored.solution == original.solution
        assert restored.result == original.result
        assert restored.context == original.context
        assert restored.feedback == original.feedback
        assert restored.metadata == original.metadata

    def test_agent_action_to_jsonl(self):
        """Test AgentAction JSONL serialization."""
        action = AgentAction.create(
            action_type="message",
            trigger="Query received",
            solution="Response sent",
            result="success"
        )

        jsonl = action.to_jsonl()

        # Should be valid JSON
        parsed = json.loads(jsonl)
        assert parsed["action_type"] == "message"
        assert parsed["trigger"] == "Query received"
        assert parsed["solution"] == "Response sent"
        assert parsed["result"] == "success"

    def test_agent_action_with_feedback(self):
        """Test AgentAction with feedback field."""
        action = AgentAction.create(
            action_type="tool_call",
            trigger="File not found",
            solution="Created file",
            result="success"
        )

        # Add feedback after creation
        action.feedback = {
            "rating": 4,
            "comment": "Worked but slow",
            "helpful": True
        }

        data = action.to_dict()
        assert data["feedback"]["rating"] == 4
        assert data["feedback"]["helpful"] is True

    def test_agent_action_action_types(self):
        """Test all valid action types."""
        valid_types = ["tool_call", "message", "decision"]

        for action_type in valid_types:
            action = AgentAction.create(
                action_type=action_type,
                trigger="Test trigger",
                solution="Test solution",
                result="success"
            )
            assert action.action_type == action_type

    def test_agent_action_result_types(self):
        """Test all valid result types."""
        valid_results = ["success", "failure", "partial"]

        for result in valid_results:
            action = AgentAction.create(
                action_type="tool_call",
                trigger="Test trigger",
                solution="Test solution",
                result=result
            )
            assert action.result == result


class TestSession:
    """Tests for Session dataclass."""

    def test_create_session_basic(self):
        """Test creating a Session with basic fields."""
        session = Session.create(
            workspace="/home/user/project",
            agent_id="agent_0x1234567890abcdef"
        )

        assert session.id.startswith("session_")
        assert session.workspace == "/home/user/project"
        assert session.agent_id == "agent_0x1234567890abcdef"
        assert session.started_at  # Should have a timestamp
        assert session.ended_at is None
        assert session.status == "active"
        assert session.action_count == 0
        assert session.file_path == ""
        assert session.metadata is None

    def test_create_session_with_metadata(self):
        """Test creating a Session with metadata."""
        metadata = {
            "project_name": "my-app",
            "git_branch": "feature/new-feature",
            "user": "developer"
        }

        session = Session.create(
            workspace="/path/to/workspace",
            agent_id="agent_0xabcdef1234567890",
            metadata=metadata
        )

        assert session.metadata == metadata

    def test_session_id_format(self):
        """Test that session ID follows expected format."""
        session = Session.create(
            workspace="/test",
            agent_id="agent_0x1234567890abcdef"
        )

        # Should match pattern: session_YYYYMMDD_HHMMSS_XXXXXXXX
        parts = session.id.split("_")
        assert len(parts) == 3
        assert parts[0] == "session"
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 8  # random hex

    def test_session_to_dict(self):
        """Test Session serialization to dictionary."""
        session = Session.create(
            workspace="/home/user/project",
            agent_id="agent_0x1234567890abcdef"
        )
        session.status = "completed"
        session.action_count = 5
        session.file_path = "/logs/session_xxx.jsonl"

        data = session.to_dict()

        assert data["id"] == session.id
        assert data["workspace"] == "/home/user/project"
        assert data["agent_id"] == "agent_0x1234567890abcdef"
        assert data["started_at"] == session.started_at
        assert data["status"] == "completed"
        assert data["action_count"] == 5
        assert data["file_path"] == "/logs/session_xxx.jsonl"

    def test_session_from_dict(self):
        """Test Session deserialization from dictionary."""
        data = {
            "id": "session_20260224_103000_a1b2c3d4",
            "workspace": "/home/user/myapp",
            "agent_id": "agent_0xabcdef1234567890",
            "started_at": "2026-02-24T10:30:00.000000",
            "ended_at": "2026-02-24T11:45:00.000000",
            "status": "completed",
            "action_count": 10,
            "file_path": "/logs/session_20260224_103000_a1b2c3d4.jsonl",
            "metadata": {"version": "1.0"}
        }

        session = Session.from_dict(data)

        assert session.id == "session_20260224_103000_a1b2c3d4"
        assert session.workspace == "/home/user/myapp"
        assert session.agent_id == "agent_0xabcdef1234567890"
        assert session.started_at == "2026-02-24T10:30:00.000000"
        assert session.ended_at == "2026-02-24T11:45:00.000000"
        assert session.status == "completed"
        assert session.action_count == 10
        assert session.file_path == "/logs/session_20260224_103000_a1b2c3d4.jsonl"
        assert session.metadata == {"version": "1.0"}

    def test_session_to_dict_from_dict_roundtrip(self):
        """Test that to_dict and from_dict are inverses for Session."""
        original = Session.create(
            workspace="/path/to/project",
            agent_id="agent_0x1234567890abcdef",
            metadata={"key": "value"}
        )
        original.status = "paused"
        original.action_count = 3
        original.file_path = "/logs/session.jsonl"

        data = original.to_dict()
        restored = Session.from_dict(data)

        assert restored.id == original.id
        assert restored.workspace == original.workspace
        assert restored.agent_id == original.agent_id
        assert restored.started_at == original.started_at
        assert restored.ended_at == original.ended_at
        assert restored.status == original.status
        assert restored.action_count == original.action_count
        assert restored.file_path == original.file_path
        assert restored.metadata == original.metadata

    def test_session_lifecycle(self):
        """Test Session lifecycle status transitions."""
        session = Session.create(
            workspace="/test",
            agent_id="agent_0x1234567890abcdef"
        )

        # Initial state
        assert session.status == "active"
        assert session.ended_at is None
        assert session.action_count == 0

        # Simulate some actions
        session.action_count = 5
        assert session.action_count == 5

        # Pause session
        session.status = "paused"
        assert session.status == "paused"

        # Resume and complete
        session.status = "completed"
        session.ended_at = "2026-02-24T12:00:00.000000"
        assert session.status == "completed"
        assert session.ended_at == "2026-02-24T12:00:00.000000"

    def test_session_status_values(self):
        """Test all valid session status values."""
        valid_statuses = ["active", "paused", "completed", "archived"]

        session = Session.create(
            workspace="/test",
            agent_id="agent_0x1234567890abcdef"
        )

        for status in valid_statuses:
            session.status = status
            assert session.status == status

    def test_session_from_dict_minimal(self):
        """Test Session from_dict with minimal required fields."""
        data = {
            "id": "session_20260224_103000_a1b2c3d4",
            "workspace": "/home/user/project",
            "agent_id": "agent_0x1234567890abcdef",
            "started_at": "2026-02-24T10:30:00.000000"
        }

        session = Session.from_dict(data)

        assert session.id == "session_20260224_103000_a1b2c3d4"
        assert session.workspace == "/home/user/project"
        assert session.agent_id == "agent_0x1234567890abcdef"
        assert session.started_at == "2026-02-24T10:30:00.000000"
        # Defaults
        assert session.ended_at is None
        assert session.status == "active"
        assert session.action_count == 0
        assert session.file_path == ""
        assert session.metadata is None


class TestAgentActionSessionIntegration:
    """Integration tests for AgentAction within Session context."""

    def test_actions_can_be_added_to_session_context(self):
        """Test that actions can be tracked with session."""
        session = Session.create(
            workspace="/project",
            agent_id="agent_0x1234567890abcdef"
        )

        # Create some actions
        action1 = AgentAction.create(
            action_type="tool_call",
            trigger="Error in code",
            solution="Fixed bug",
            result="success"
        )
        action2 = AgentAction.create(
            action_type="message",
            trigger="User question",
            solution="Provided answer",
            result="success"
        )

        # Simulate tracking
        session.action_count = 2
        session.status = "completed"
        session.ended_at = "2026-02-24T12:00:00.000000"

        assert session.action_count == 2
        assert session.status == "completed"

        # Verify actions can be serialized
        jsonl1 = action1.to_jsonl()
        jsonl2 = action2.to_jsonl()

        assert json.loads(jsonl1)["trigger"] == "Error in code"
        assert json.loads(jsonl2)["trigger"] == "User question"
