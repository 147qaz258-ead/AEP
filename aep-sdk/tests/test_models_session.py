"""
Tests for AgentAction and Session data models.

Tests creation, serialization, deserialization, and validation.
"""

import json
import pytest

from aep_sdk.session.models import (
    AgentAction,
    Session,
    ActionType,
    ActionResult,
    FeedbackRating,
    FeedbackInfo,
    create_action,
    create_session,
)


class TestAgentAction:
    """Tests for AgentAction dataclass."""

    def test_create_agent_action_basic(self):
        """Test creating an AgentAction with basic fields."""
        action = create_action(
            action_type=ActionType.TOOL_CALL,
            trigger="TypeError: 'NoneType' object is not subscriptable",
            solution="Added null check before accessing index",
            result=ActionResult.SUCCESS,
        )

        assert action.id  # Should have a UUID
        assert action.timestamp  # Should have a timestamp
        assert action.action_type == ActionType.TOOL_CALL
        assert action.trigger == "TypeError: 'NoneType' object is not subscriptable"
        assert action.solution == "Added null check before accessing index"
        assert action.result == ActionResult.SUCCESS
        assert action.context == {}
        assert action.feedback is None

    def test_create_agent_action_with_context(self):
        """Test creating an AgentAction with context."""
        context = {
            "file": "src/main.py",
            "line": 42,
            "function": "process_data",
        }

        action = create_action(
            action_type=ActionType.DECISION,
            trigger="Multiple solutions available",
            solution="Chose option A based on performance",
            result=ActionResult.PARTIAL,
            context=context,
        )

        assert action.context == context
        assert action.result == ActionResult.PARTIAL

    def test_agent_action_to_dict(self):
        """Test AgentAction serialization to dictionary."""
        action = create_action(
            action_type=ActionType.MESSAGE,
            trigger="User asked for help",
            solution="Provided documentation link",
            result=ActionResult.SUCCESS,
        )

        data = action.to_dict()

        assert data["id"] == action.id
        assert data["timestamp"] == action.timestamp
        assert data["action_type"] == "message"
        assert data["trigger"] == "User asked for help"
        assert data["solution"] == "Provided documentation link"
        assert data["result"] == "success"
        assert data["context"] == {}
        # feedback is not included when None
        assert "feedback" not in data or data["feedback"] is None

    def test_agent_action_from_dict(self):
        """Test AgentAction deserialization from dictionary."""
        data = {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "timestamp": "2026-02-24T10:30:00.000000Z",
            "action_type": "tool_call",
            "trigger": "ImportError: No module named 'requests'",
            "solution": "pip install requests",
            "result": "success",
            "context": {"python_version": "3.11"},
            "feedback": {"id": "fb001", "rating": "positive", "timestamp": "2026-02-24T10:31:00Z"},
        }

        action = AgentAction.from_dict(data)

        assert action.id == "550e8400-e29b-41d4-a716-446655440000"
        assert action.timestamp == "2026-02-24T10:30:00.000000Z"
        assert action.action_type == ActionType.TOOL_CALL
        assert action.trigger == "ImportError: No module named 'requests'"
        assert action.solution == "pip install requests"
        assert action.result == ActionResult.SUCCESS
        assert action.context == {"python_version": "3.11"}
        assert action.feedback is not None
        assert action.feedback.rating == FeedbackRating.POSITIVE

    def test_agent_action_to_dict_from_dict_roundtrip(self):
        """Test that to_dict and from_dict are inverses."""
        original = create_action(
            action_type=ActionType.TOOL_CALL,
            trigger="SyntaxError: invalid syntax",
            solution="Fixed indentation",
            result=ActionResult.SUCCESS,
            context={"file": "test.py"},
        )

        data = original.to_dict()
        restored = AgentAction.from_dict(data)

        assert restored.id == original.id
        assert restored.timestamp == original.timestamp
        assert restored.action_type == original.action_type
        assert restored.trigger == original.trigger
        assert restored.solution == original.solution
        assert restored.result == original.result
        assert restored.context == original.context

    def test_agent_action_with_feedback(self):
        """Test AgentAction with feedback field."""
        feedback = FeedbackInfo(
            id="fb001",
            rating=FeedbackRating.POSITIVE,
            timestamp="2026-02-24T10:30:00Z",
            comment="Great fix!",
        )

        action = create_action(
            action_type=ActionType.TOOL_CALL,
            trigger="File not found",
            solution="Created file",
            result=ActionResult.SUCCESS,
            feedback=feedback,
        )

        data = action.to_dict()
        assert data["feedback"]["rating"] == "positive"
        assert data["feedback"]["comment"] == "Great fix!"

    def test_agent_action_action_types(self):
        """Test all valid action types."""
        for action_type in ActionType:
            action = create_action(
                action_type=action_type,
                trigger="Test trigger",
                solution="Test solution",
                result=ActionResult.SUCCESS,
            )
            assert action.action_type == action_type

    def test_agent_action_result_types(self):
        """Test all valid result types."""
        for result in ActionResult:
            action = create_action(
                action_type=ActionType.TOOL_CALL,
                trigger="Test trigger",
                solution="Test solution",
                result=result,
            )
            assert action.result == result


class TestSession:
    """Tests for Session dataclass."""

    def test_create_session_basic(self):
        """Test creating a Session with basic fields."""
        session = create_session(agent_id="agent_0x1234567890abcdef")

        assert session.id.startswith("session_") is False  # UUID format
        assert session.agent_id == "agent_0x1234567890abcdef"
        assert session.started_at  # Should have a timestamp
        assert session.ended_at is None
        assert session.actions == []
        assert session.summary is None

    def test_session_to_dict(self):
        """Test Session serialization to dictionary."""
        session = create_session(agent_id="agent_0x1234567890abcdef")
        session.summary = "Test session completed"

        data = session.to_dict()

        assert data["id"] == session.id
        assert data["agent_id"] == "agent_0x1234567890abcdef"
        assert data["started_at"] == session.started_at
        assert data["actions"] == []
        assert data["summary"] == "Test session completed"

    def test_session_from_dict(self):
        """Test Session deserialization from dictionary."""
        data = {
            "id": "session_20260224_103000_a1b2c3d4",
            "agent_id": "agent_0xabcdef1234567890",
            "started_at": "2026-02-24T10:30:00.000000Z",
            "ended_at": "2026-02-24T11:45:00.000000Z",
            "actions": [],
            "summary": "Test summary",
        }

        session = Session.from_dict(data)

        assert session.id == "session_20260224_103000_a1b2c3d4"
        assert session.agent_id == "agent_0xabcdef1234567890"
        assert session.started_at == "2026-02-24T10:30:00.000000Z"
        assert session.ended_at == "2026-02-24T11:45:00.000000Z"
        assert session.summary == "Test summary"
        assert session.actions == []

    def test_session_to_dict_from_dict_roundtrip(self):
        """Test that to_dict and from_dict are inverses for Session."""
        original = create_session(
            agent_id="agent_0x1234567890abcdef",
        )
        original.summary = "Test session"

        data = original.to_dict()
        restored = Session.from_dict(data)

        assert restored.id == original.id
        assert restored.agent_id == original.agent_id
        assert restored.started_at == original.started_at
        assert restored.ended_at == original.ended_at
        assert restored.summary == original.summary

    def test_session_end(self):
        """Test Session end method."""
        session = create_session(agent_id="agent_0x1234567890abcdef")

        # Initial state
        assert session.ended_at is None

        # End session
        session.end(summary="Session completed successfully")

        assert session.ended_at is not None
        assert session.summary == "Session completed successfully"

    def test_session_add_action(self):
        """Test adding actions to session."""
        session = create_session(agent_id="agent_0x1234567890abcdef")

        action = create_action(
            action_type=ActionType.TOOL_CALL,
            trigger="Test trigger",
            solution="Test solution",
            result=ActionResult.SUCCESS,
        )

        session.add_action(action)

        assert len(session.actions) == 1
        assert session.actions[0].id == action.id


class TestAgentActionSessionIntegration:
    """Integration tests for AgentAction within Session context."""

    def test_actions_can_be_added_to_session_context(self):
        """Test that actions can be tracked with session."""
        session = create_session(agent_id="agent_0x1234567890abcdef")

        # Create some actions
        action1 = create_action(
            action_type=ActionType.TOOL_CALL,
            trigger="Error in code",
            solution="Fixed bug",
            result=ActionResult.SUCCESS,
        )
        action2 = create_action(
            action_type=ActionType.MESSAGE,
            trigger="User question",
            solution="Provided answer",
            result=ActionResult.SUCCESS,
        )

        # Add actions to session
        session.add_action(action1)
        session.add_action(action2)

        assert len(session.actions) == 2

        # End session
        session.end(summary="Completed successfully")

        assert session.ended_at is not None
        assert session.summary == "Completed successfully"

    def test_session_with_actions_serialization(self):
        """Test session with actions can be serialized."""
        session = create_session(agent_id="agent_0x1234567890abcdef")

        action = create_action(
            action_type=ActionType.TOOL_CALL,
            trigger="Test",
            solution="Fix",
            result=ActionResult.SUCCESS,
        )
        session.add_action(action)

        data = session.to_dict()

        assert "actions" in data
        assert len(data["actions"]) == 1
        assert data["actions"][0]["trigger"] == "Test"