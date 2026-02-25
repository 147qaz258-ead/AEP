"""
AgentAction and Session data models for AEP SDK.

This module provides dataclasses for representing agent actions and sessions
in the AEP (Agent Event Protocol) system.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import uuid


class ActionType(str, Enum):
    """Types of actions an agent can perform."""
    TOOL_CALL = "tool_call"
    MESSAGE = "message"
    DECISION = "decision"


class ActionResult(str, Enum):
    """Result status of an action."""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"


class FeedbackRating(str, Enum):
    """Rating values for feedback."""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


@dataclass
class FeedbackInfo:
    """
    Feedback information attached to an action.

    Attributes:
        id: Unique identifier for the feedback.
        rating: Rating value (positive, negative, or neutral).
        comment: Optional comment explaining the feedback.
        timestamp: ISO 8601 timestamp when feedback was given.
        metadata: Additional metadata dictionary.
    """
    id: str
    rating: FeedbackRating
    timestamp: str
    comment: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "id": self.id,
            "rating": self.rating.value,
            "timestamp": self.timestamp,
        }
        if self.comment is not None:
            result["comment"] = self.comment
        if self.metadata is not None:
            result["metadata"] = self.metadata
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FeedbackInfo:
        """Create FeedbackInfo from dictionary."""
        return cls(
            id=data["id"],
            rating=FeedbackRating(data["rating"]),
            timestamp=data["timestamp"],
            comment=data.get("comment"),
            metadata=data.get("metadata"),
        )


@dataclass
class AgentAction:
    """
    Represents a single action performed by an agent.

    Attributes:
        id: Unique identifier for this action.
        timestamp: ISO 8601 timestamp when the action occurred.
        action_type: Type of action performed.
        trigger: What triggered this action.
        solution: The solution or approach taken.
        result: Result status of the action.
        context: Additional context data for this action.
        feedback: Optional feedback attached to this action.
    """
    id: str
    timestamp: str
    action_type: ActionType
    trigger: str
    solution: str
    result: ActionResult
    context: dict[str, Any] = field(default_factory=dict)
    feedback: Optional[FeedbackInfo] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "id": self.id,
            "timestamp": self.timestamp,
            "action_type": self.action_type.value,
            "trigger": self.trigger,
            "solution": self.solution,
            "result": self.result.value,
            "context": self.context,
        }
        if self.feedback is not None:
            result["feedback"] = self.feedback.to_dict()
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentAction:
        """Create AgentAction from dictionary."""
        feedback = None
        if "feedback" in data and data["feedback"] is not None:
            feedback = FeedbackInfo.from_dict(data["feedback"])

        return cls(
            id=data["id"],
            timestamp=data["timestamp"],
            action_type=ActionType(data["action_type"]),
            trigger=data["trigger"],
            solution=data["solution"],
            result=ActionResult(data["result"]),
            context=data.get("context", {}),
            feedback=feedback,
        )


@dataclass
class Session:
    """
    Represents a complete agent session with all actions.

    Attributes:
        id: Unique identifier for this session.
        agent_id: Identifier of the agent that performed this session.
        started_at: ISO 8601 timestamp when the session started.
        ended_at: ISO 8601 timestamp when the session ended (if completed).
        actions: List of all actions in this session.
        summary: Optional summary of the session.
    """
    id: str
    agent_id: str
    started_at: str
    actions: list[AgentAction] = field(default_factory=list)
    ended_at: Optional[str] = None
    summary: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "id": self.id,
            "agent_id": self.agent_id,
            "started_at": self.started_at,
            "actions": [action.to_dict() for action in self.actions],
        }
        if self.ended_at is not None:
            result["ended_at"] = self.ended_at
        if self.summary is not None:
            result["summary"] = self.summary
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Session:
        """Create Session from dictionary."""
        actions = [
            AgentAction.from_dict(action_data)
            for action_data in data.get("actions", [])
        ]

        return cls(
            id=data["id"],
            agent_id=data["agent_id"],
            started_at=data["started_at"],
            ended_at=data.get("ended_at"),
            actions=actions,
            summary=data.get("summary"),
        )

    def add_action(self, action: AgentAction) -> None:
        """Add an action to this session."""
        self.actions.append(action)

    def end(self, summary: Optional[str] = None) -> None:
        """End the session with an optional summary."""
        self.ended_at = datetime.utcnow().isoformat() + "Z"
        if summary is not None:
            self.summary = summary


# Utility functions

def generate_id() -> str:
    """Generate a unique ID for actions and sessions."""
    return str(uuid.uuid4())


def create_action(
    action_type: ActionType,
    trigger: str,
    solution: str,
    result: ActionResult = ActionResult.SUCCESS,
    context: Optional[dict[str, Any]] = None,
    feedback: Optional[FeedbackInfo] = None,
    id: Optional[str] = None,
    timestamp: Optional[str] = None,
) -> AgentAction:
    """
    Create a new AgentAction with defaults.

    Args:
        action_type: Type of action performed.
        trigger: What triggered this action.
        solution: The solution or approach taken.
        result: Result status (defaults to SUCCESS).
        context: Additional context data.
        feedback: Optional feedback info.
        id: Optional custom ID (auto-generated if not provided).
        timestamp: Optional custom timestamp (auto-generated if not provided).

    Returns:
        A new AgentAction instance.
    """
    return AgentAction(
        id=id or generate_id(),
        timestamp=timestamp or datetime.utcnow().isoformat() + "Z",
        action_type=action_type,
        trigger=trigger,
        solution=solution,
        result=result,
        context=context or {},
        feedback=feedback,
    )


def create_session(
    agent_id: str,
    id: Optional[str] = None,
    started_at: Optional[str] = None,
    ended_at: Optional[str] = None,
    actions: Optional[list[AgentAction]] = None,
    summary: Optional[str] = None,
) -> Session:
    """
    Create a new Session with defaults.

    Args:
        agent_id: Identifier of the agent.
        id: Optional custom ID (auto-generated if not provided).
        started_at: Optional start timestamp (auto-generated if not provided).
        ended_at: Optional end timestamp.
        actions: Optional list of actions.
        summary: Optional session summary.

    Returns:
        A new Session instance.
    """
    return Session(
        id=id or generate_id(),
        agent_id=agent_id,
        started_at=started_at or datetime.utcnow().isoformat() + "Z",
        ended_at=ended_at,
        actions=actions or [],
        summary=summary,
    )
