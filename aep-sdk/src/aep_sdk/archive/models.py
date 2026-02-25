"""
Archive Module for AEP Protocol

Provides session summary and archival types for long-term storage
and analytics of agent experience data.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


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
class SessionStats:
    """Summary statistics for a session."""
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
class SessionSummary:
    """Session summary for archival and analytics."""
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
    def from_dict(cls, data: Dict[str, Any]) -> "SessionSummary":
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

        return cls(
            session_id=data.get("session_id"),
            agent_id=data.get("agent_id"),
            project_id=data.get("project_id"),
            user_id=data.get("user_id"),
            status=status,
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
