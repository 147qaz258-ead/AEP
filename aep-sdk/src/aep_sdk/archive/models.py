"""
Archive Module for AEP Protocol

Provides session summary and archival types for long-term storage
and analytics of agent experience data.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Literal
import uuid


class ActionOutcome(str, Enum):
    """Outcome type for action results."""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"


class SessionStatus(str, Enum):
    """Session status types."""
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    ERROR = "error"


@dataclass
class KeyAction:
    """
    Represents a key action taken during the session.

    Attributes:
        trigger: What triggered this action
        solution: The solution or approach taken
        result: The result of the action
    """
    trigger: str
    solution: str
    result: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "trigger": self.trigger,
            "solution": self.solution,
            "result": self.result,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KeyAction":
        """Create from dictionary representation."""
        return cls(
            trigger=data["trigger"],
            solution=data["solution"],
            result=data["result"],
        )


@dataclass
class SessionSummary:
    """
    Session summary for archival and knowledge extraction.
    This is the simplified format for session archiving.

    Attributes:
        id: Unique identifier for this summary
        session_id: ID of the original session
        agent_id: ID of the agent that handled the session
        created_at: ISO 8601 timestamp when the summary was created
        title: Human-readable title of the session
        problem: Description of the problem being solved
        solution: Description of the solution implemented
        outcome: Outcome status of the session
        key_actions: Key actions taken during the session
        signals: Signal patterns extracted from the session
        action_count: Total number of actions taken
        duration_seconds: Duration of the session in seconds
        feedback_score: Optional feedback score (1-5 scale)
    """
    session_id: str
    agent_id: str
    title: str
    problem: str
    solution: str
    outcome: ActionOutcome
    key_actions: List[KeyAction]
    signals: List[str]
    action_count: int
    duration_seconds: int
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    feedback_score: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "id": self.id,
            "session_id": self.session_id,
            "agent_id": self.agent_id,
            "created_at": self.created_at,
            "title": self.title,
            "problem": self.problem,
            "solution": self.solution,
            "outcome": self.outcome.value if isinstance(self.outcome, ActionOutcome) else self.outcome,
            "key_actions": [action.to_dict() for action in self.key_actions],
            "signals": self.signals,
            "action_count": self.action_count,
            "duration_seconds": self.duration_seconds,
        }
        if self.feedback_score is not None:
            result["feedback_score"] = self.feedback_score
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionSummary":
        """Create from dictionary representation."""
        outcome_value = data.get("outcome", "success")
        outcome = ActionOutcome(outcome_value) if isinstance(outcome_value, str) else outcome_value

        key_actions = [
            KeyAction.from_dict(action) for action in data.get("key_actions", [])
        ]

        return cls(
            id=data.get("id", str(uuid.uuid4())),
            session_id=data["session_id"],
            agent_id=data["agent_id"],
            created_at=data.get("created_at", datetime.utcnow().isoformat() + "Z"),
            title=data["title"],
            problem=data["problem"],
            solution=data["solution"],
            outcome=outcome,
            key_actions=key_actions,
            signals=data.get("signals", []),
            action_count=data["action_count"],
            duration_seconds=data["duration_seconds"],
            feedback_score=data.get("feedback_score"),
        )


@dataclass
class CreateSessionSummaryOptions:
    """
    Options for creating a session summary.

    Attributes:
        session_id: ID of the original session
        agent_id: ID of the agent that handled the session
        title: Human-readable title of the session
        problem: Description of the problem being solved
        solution: Description of the solution implemented
        outcome: Outcome status of the session
        key_actions: Key actions taken during the session
        signals: Signal patterns extracted from the session
        action_count: Total number of actions taken
        duration_seconds: Duration of the session in seconds
        feedback_score: Optional feedback score (1-5 scale)
    """
    session_id: str
    agent_id: str
    title: str
    problem: str
    solution: str
    outcome: ActionOutcome
    key_actions: List[KeyAction]
    signals: List[str]
    action_count: int
    duration_seconds: int
    feedback_score: Optional[int] = None

    def to_summary(self) -> SessionSummary:
        """Convert options to a SessionSummary instance."""
        return SessionSummary(
            session_id=self.session_id,
            agent_id=self.agent_id,
            title=self.title,
            problem=self.problem,
            solution=self.solution,
            outcome=self.outcome,
            key_actions=self.key_actions,
            signals=self.signals,
            action_count=self.action_count,
            duration_seconds=self.duration_seconds,
            feedback_score=self.feedback_score,
        )


@dataclass
class SessionStats:
    """Summary statistics for a session (detailed version)."""
    total_actions: int = 0
    success_count: int = 0
    failure_count: int = 0
    partial_count: int = 0
    avg_duration_ms: float = 0.0
    total_tokens: Optional[int] = None
    avg_confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "total_actions": self.total_actions,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "partial_count": self.partial_count,
            "avg_duration_ms": self.avg_duration_ms,
            "avg_confidence": self.avg_confidence,
        }
        if self.total_tokens is not None:
            result["total_tokens"] = self.total_tokens
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionStats":
        """Create from dictionary representation."""
        return cls(
            total_actions=data.get("total_actions", 0),
            success_count=data.get("success_count", 0),
            failure_count=data.get("failure_count", 0),
            partial_count=data.get("partial_count", 0),
            avg_duration_ms=data.get("avg_duration_ms", 0.0),
            total_tokens=data.get("total_tokens"),
            avg_confidence=data.get("avg_confidence", 0.0),
        )


@dataclass
class TopSignal:
    """Top signals extracted during the session."""
    type: str
    value: str
    count: int = 0
    avg_weight: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "type": self.type,
            "value": self.value,
            "count": self.count,
            "avg_weight": self.avg_weight,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TopSignal":
        """Create from dictionary representation."""
        return cls(
            type=data["type"],
            value=data["value"],
            count=data.get("count", 0),
            avg_weight=data.get("avg_weight", 0.0),
        )


@dataclass
class FeedbackSummary:
    """Feedback summary for the session."""
    total_feedback: int = 0
    explicit_count: int = 0
    implicit_count: int = 0
    avg_rating: Optional[float] = None
    outcome_distribution: Dict[str, int] = field(default_factory=lambda: {
        ActionOutcome.SUCCESS.value: 0,
        ActionOutcome.FAILURE.value: 0,
        ActionOutcome.PARTIAL.value: 0,
    })
    avg_confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "total_feedback": self.total_feedback,
            "explicit_count": self.explicit_count,
            "implicit_count": self.implicit_count,
            "outcome_distribution": self.outcome_distribution,
            "avg_confidence": self.avg_confidence,
        }
        if self.avg_rating is not None:
            result["avg_rating"] = self.avg_rating
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeedbackSummary":
        """Create from dictionary representation."""
        return cls(
            total_feedback=data.get("total_feedback", 0),
            explicit_count=data.get("explicit_count", 0),
            implicit_count=data.get("implicit_count", 0),
            avg_rating=data.get("avg_rating"),
            outcome_distribution=data.get("outcome_distribution", {
                ActionOutcome.SUCCESS.value: 0,
                ActionOutcome.FAILURE.value: 0,
                ActionOutcome.PARTIAL.value: 0,
            }),
            avg_confidence=data.get("avg_confidence", 0.0),
        )


@dataclass
class ExperienceSummary:
    """Experience record summary for archival."""
    id: str
    match_count: int = 0
    avg_relevance: float = 0.0
    last_matched_at: Optional[str] = None
    deprecated: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "id": self.id,
            "match_count": self.match_count,
            "avg_relevance": self.avg_relevance,
            "deprecated": self.deprecated,
        }
        if self.last_matched_at is not None:
            result["last_matched_at"] = self.last_matched_at
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExperienceSummary":
        """Create from dictionary representation."""
        return cls(
            id=data["id"],
            match_count=data.get("match_count", 0),
            avg_relevance=data.get("avg_relevance", 0.0),
            last_matched_at=data.get("last_matched_at"),
            deprecated=data.get("deprecated", False),
        )


@dataclass
class DetailedSessionSummary:
    """
    Detailed session summary for archival and analytics.
    Extended version with full statistics and feedback details.
    """
    session_id: str
    started_at: str
    ended_at: str
    duration_ms: int
    agent_id: str
    stats: SessionStats
    top_signals: List[TopSignal] = field(default_factory=list)
    feedback_summary: FeedbackSummary = field(default_factory=FeedbackSummary)
    experience_summaries: List[ExperienceSummary] = field(default_factory=list)
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    status: SessionStatus = SessionStatus.ACTIVE
    metadata: Optional[Dict[str, Any]] = None
    archive_version: str = "1.0.0"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "session_id": self.session_id,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "duration_ms": self.duration_ms,
            "agent_id": self.agent_id,
            "status": self.status.value if isinstance(self.status, SessionStatus) else self.status,
            "stats": self.stats.to_dict(),
            "top_signals": [s.to_dict() for s in self.top_signals],
            "feedback_summary": self.feedback_summary.to_dict(),
            "experience_summaries": [e.to_dict() for e in self.experience_summaries],
            "archive_version": self.archive_version,
        }
        if self.project_id is not None:
            result["project_id"] = self.project_id
        if self.user_id is not None:
            result["user_id"] = self.user_id
        if self.metadata is not None:
            result["metadata"] = self.metadata
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DetailedSessionSummary":
        """Create from dictionary representation."""
        status_value = data.get("status", "active")
        status = SessionStatus(status_value) if isinstance(status_value, str) else status_value

        return cls(
            session_id=data["session_id"],
            started_at=data["started_at"],
            ended_at=data["ended_at"],
            duration_ms=data["duration_ms"],
            agent_id=data["agent_id"],
            status=status,
            stats=SessionStats.from_dict(data.get("stats", {})),
            top_signals=[TopSignal.from_dict(s) for s in data.get("top_signals", [])],
            feedback_summary=FeedbackSummary.from_dict(data.get("feedback_summary", {})),
            experience_summaries=[ExperienceSummary.from_dict(e) for e in data.get("experience_summaries", [])],
            project_id=data.get("project_id"),
            user_id=data.get("user_id"),
            metadata=data.get("metadata"),
            archive_version=data.get("archive_version", "1.0.0"),
        )


@dataclass
class ArchiveQuery:
    """Archive query parameters."""
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[SessionStatus] = None
    outcome: Optional[ActionOutcome] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {}
        if self.session_id is not None:
            result["session_id"] = self.session_id
        if self.agent_id is not None:
            result["agent_id"] = self.agent_id
        if self.project_id is not None:
            result["project_id"] = self.project_id
        if self.user_id is not None:
            result["user_id"] = self.user_id
        if self.status is not None:
            result["status"] = self.status.value if isinstance(self.status, SessionStatus) else self.status
        if self.outcome is not None:
            result["outcome"] = self.outcome.value if isinstance(self.outcome, ActionOutcome) else self.outcome
        if self.from_date is not None:
            result["from_date"] = self.from_date
        if self.to_date is not None:
            result["to_date"] = self.to_date
        if self.limit is not None:
            result["limit"] = self.limit
        if self.offset is not None:
            result["offset"] = self.offset
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ArchiveQuery":
        """Create from dictionary representation."""
        status_value = data.get("status")
        status = SessionStatus(status_value) if status_value else None

        outcome_value = data.get("outcome")
        outcome = ActionOutcome(outcome_value) if outcome_value else None

        return cls(
            session_id=data.get("session_id"),
            agent_id=data.get("agent_id"),
            project_id=data.get("project_id"),
            user_id=data.get("user_id"),
            status=status,
            outcome=outcome,
            from_date=data.get("from_date"),
            to_date=data.get("to_date"),
            limit=data.get("limit"),
            offset=data.get("offset"),
        )


@dataclass
class ArchiveQueryResult:
    """Archive query result."""
    sessions: List[SessionSummary] = field(default_factory=list)
    total: int = 0
    query_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "sessions": [s.to_dict() for s in self.sessions],
            "total": self.total,
            "query_time_ms": self.query_time_ms,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ArchiveQueryResult":
        """Create from dictionary representation."""
        return cls(
            sessions=[SessionSummary.from_dict(s) for s in data.get("sessions", [])],
            total=data.get("total", 0),
            query_time_ms=data.get("query_time_ms", 0.0),
        )


# Current archive schema version
ARCHIVE_VERSION = "1.0.0"
