"""
Feedback Module for AEP Protocol

Provides feedback collection and management types for
capturing user feedback on agent actions and experiences.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Literal, Union
import uuid


class FeedbackType(str, Enum):
    """Feedback type indicating the source of feedback."""
    EXPLICIT = "explicit"
    IMPLICIT = "implicit"


class FeedbackRating(int, Enum):
    """Feedback rating scale (1-5)."""
    ONE = 1
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5


class ActionOutcome(str, Enum):
    """Outcome type for action results."""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"


@dataclass
class Feedback:
    """
    Represents a feedback entry for an action or session.

    Attributes:
        id: Unique identifier for this feedback entry
        session_id: ID of the session this feedback belongs to
        agent_id: ID of the agent that received the feedback
        created_at: ISO 8601 timestamp when feedback was created
        type: Type of feedback (explicit or implicit)
        confidence: Confidence score of the feedback (0-1)
        action_id: ID of the action this feedback is for (optional)
        rating: User's rating (1-5, only for explicit feedback)
        comment: User's comment (optional, for explicit feedback)
        outcome: Outcome inferred from user behavior (for implicit feedback)
        evidence: Evidence for implicit feedback (describes why feedback was inferred)
        metadata: Additional metadata
    """
    session_id: str
    agent_id: str
    type: FeedbackType
    confidence: float
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    action_id: Optional[str] = None
    rating: Optional[int] = None
    comment: Optional[str] = None
    outcome: Optional[ActionOutcome] = None
    evidence: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {
            "id": self.id,
            "session_id": self.session_id,
            "agent_id": self.agent_id,
            "created_at": self.created_at,
            "type": self.type.value if isinstance(self.type, FeedbackType) else self.type,
            "confidence": self.confidence,
        }
        if self.action_id is not None:
            result["action_id"] = self.action_id
        if self.rating is not None:
            result["rating"] = self.rating
        if self.comment is not None:
            result["comment"] = self.comment
        if self.outcome is not None:
            result["outcome"] = self.outcome.value if isinstance(self.outcome, ActionOutcome) else self.outcome
        if self.evidence is not None:
            result["evidence"] = self.evidence
        if self.metadata is not None:
            result["metadata"] = self.metadata
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Feedback":
        """Create from dictionary representation."""
        type_value = data.get("type", "explicit")
        feedback_type = FeedbackType(type_value) if isinstance(type_value, str) else type_value

        outcome_value = data.get("outcome")
        outcome = ActionOutcome(outcome_value) if outcome_value and isinstance(outcome_value, str) else outcome_value

        return cls(
            id=data.get("id", str(uuid.uuid4())),
            session_id=data["session_id"],
            agent_id=data["agent_id"],
            created_at=data.get("created_at", datetime.utcnow().isoformat() + "Z"),
            type=feedback_type,
            confidence=data.get("confidence", 0.0),
            action_id=data.get("action_id"),
            rating=data.get("rating"),
            comment=data.get("comment"),
            outcome=outcome,
            evidence=data.get("evidence"),
            metadata=data.get("metadata"),
        )


@dataclass
class CreateExplicitFeedbackOptions:
    """
    Options for creating explicit feedback.

    Attributes:
        session_id: ID of the session this feedback belongs to
        agent_id: ID of the agent that received the feedback
        rating: User's rating (1-5)
        action_id: ID of the action this feedback is for (optional)
        comment: User's comment (optional)
        metadata: Additional metadata
    """
    session_id: str
    agent_id: str
    rating: int
    action_id: Optional[str] = None
    comment: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_feedback(self) -> Feedback:
        """Convert options to a Feedback instance."""
        return Feedback(
            session_id=self.session_id,
            agent_id=self.agent_id,
            type=FeedbackType.EXPLICIT,
            confidence=1.0,  # Explicit feedback has full confidence
            action_id=self.action_id,
            rating=self.rating,
            comment=self.comment,
            metadata=self.metadata,
        )


@dataclass
class CreateImplicitFeedbackOptions:
    """
    Options for creating implicit feedback.

    Attributes:
        session_id: ID of the session this feedback belongs to
        agent_id: ID of the agent that received the feedback
        outcome: Outcome inferred from user behavior
        confidence: Confidence score of the inference (0-1)
        action_id: ID of the action this feedback is for (optional)
        metadata: Additional metadata
    """
    session_id: str
    agent_id: str
    outcome: ActionOutcome
    confidence: float
    action_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_feedback(self) -> Feedback:
        """Convert options to a Feedback instance."""
        return Feedback(
            session_id=self.session_id,
            agent_id=self.agent_id,
            type=FeedbackType.IMPLICIT,
            confidence=self.confidence,
            action_id=self.action_id,
            outcome=self.outcome,
            metadata=self.metadata,
        )


@dataclass
class FeedbackQuery:
    """
    Feedback query parameters.

    Attributes:
        session_id: Filter by session ID
        action_id: Filter by action ID
        agent_id: Filter by agent ID
        type: Filter by feedback type
        rating: Filter by rating (for explicit feedback)
        outcome: Filter by outcome (for implicit feedback)
        from_date: Start date filter (ISO 8601)
        to_date: End date filter (ISO 8601)
        limit: Maximum number of results
        offset: Offset for pagination
    """
    session_id: Optional[str] = None
    action_id: Optional[str] = None
    agent_id: Optional[str] = None
    type: Optional[FeedbackType] = None
    rating: Optional[int] = None
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
        if self.action_id is not None:
            result["action_id"] = self.action_id
        if self.agent_id is not None:
            result["agent_id"] = self.agent_id
        if self.type is not None:
            result["type"] = self.type.value if isinstance(self.type, FeedbackType) else self.type
        if self.rating is not None:
            result["rating"] = self.rating
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
    def from_dict(cls, data: Dict[str, Any]) -> "FeedbackQuery":
        """Create from dictionary representation."""
        type_value = data.get("type")
        feedback_type = FeedbackType(type_value) if type_value else None

        outcome_value = data.get("outcome")
        outcome = ActionOutcome(outcome_value) if outcome_value else None

        return cls(
            session_id=data.get("session_id"),
            action_id=data.get("action_id"),
            agent_id=data.get("agent_id"),
            type=feedback_type,
            rating=data.get("rating"),
            outcome=outcome,
            from_date=data.get("from_date"),
            to_date=data.get("to_date"),
            limit=data.get("limit"),
            offset=data.get("offset"),
        )


@dataclass
class FeedbackQueryResult:
    """
    Feedback query result.

    Attributes:
        feedbacks: Matching feedback entries
        total: Total number of matching entries
        query_time_ms: Query execution time in milliseconds
    """
    feedbacks: List[Feedback] = field(default_factory=list)
    total: int = 0
    query_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "feedbacks": [f.to_dict() for f in self.feedbacks],
            "total": self.total,
            "query_time_ms": self.query_time_ms,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeedbackQueryResult":
        """Create from dictionary representation."""
        return cls(
            feedbacks=[Feedback.from_dict(f) for f in data.get("feedbacks", [])],
            total=data.get("total", 0),
            query_time_ms=data.get("query_time_ms", 0.0),
        )


@dataclass
class FeedbackStats:
    """
    Feedback statistics for a session or agent.

    Attributes:
        total_feedback: Total number of feedback entries
        explicit_count: Number of explicit feedback entries
        implicit_count: Number of implicit feedback entries
        avg_rating: Average rating (1-5) for explicit feedback
        rating_distribution: Distribution of ratings (for explicit feedback)
        outcome_distribution: Distribution of outcomes (for implicit feedback)
        avg_confidence: Average confidence score
    """
    total_feedback: int = 0
    explicit_count: int = 0
    implicit_count: int = 0
    avg_rating: Optional[float] = None
    rating_distribution: Dict[int, int] = field(default_factory=lambda: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0})
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
            "rating_distribution": self.rating_distribution,
            "outcome_distribution": self.outcome_distribution,
            "avg_confidence": self.avg_confidence,
        }
        if self.avg_rating is not None:
            result["avg_rating"] = self.avg_rating
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeedbackStats":
        """Create from dictionary representation."""
        return cls(
            total_feedback=data.get("total_feedback", 0),
            explicit_count=data.get("explicit_count", 0),
            implicit_count=data.get("implicit_count", 0),
            avg_rating=data.get("avg_rating"),
            rating_distribution=data.get("rating_distribution", {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}),
            outcome_distribution=data.get("outcome_distribution", {
                ActionOutcome.SUCCESS.value: 0,
                ActionOutcome.FAILURE.value: 0,
                ActionOutcome.PARTIAL.value: 0,
            }),
            avg_confidence=data.get("avg_confidence", 0.0),
        )
