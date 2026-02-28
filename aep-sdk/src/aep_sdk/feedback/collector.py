"""
Feedback Collector for AEP SDK (Python)

This module provides the FeedbackCollector class for managing explicit feedback collection.
Feedback is persisted to JSONL files in the .aep/feedback directory.
"""

import json
import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .models import (
    ActionOutcome,
    Feedback,
    FeedbackRating,
    FeedbackStats,
    FeedbackType,
)


class FeedbackError(Exception):
    """Base exception for feedback-related errors."""
    pass


class FeedbackNotFoundError(FeedbackError):
    """Raised when a feedback entry cannot be found."""
    pass


class InvalidRatingError(FeedbackError):
    """Raised when invalid rating is provided."""
    pass


@dataclass
class SubmitExplicitFeedbackOptions:
    """
    Options for submitting explicit feedback.

    Attributes:
        session_id: ID of the session this feedback belongs to
        agent_id: ID of the agent that received the feedback
        rating: User's rating (1-5)
        action_id: ID of the action this feedback is for (optional)
        comment: User's comment (optional)
        user_id: User ID (optional)
        metadata: Additional metadata
    """
    session_id: str
    agent_id: str
    rating: int
    action_id: Optional[str] = None
    comment: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


def _generate_feedback_id() -> str:
    """Generate a unique ID for feedback entries."""
    timestamp = int(time.time() * 1000)
    random_suffix = uuid.uuid4().hex[:6]
    return f"fb_{timestamp}_{random_suffix}"


def _validate_rating(rating: int) -> None:
    """
    Validate rating is within valid range (1-5).

    Raises:
        InvalidRatingError: If rating is not between 1 and 5
    """
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        raise InvalidRatingError(
            f"Invalid rating: {rating}. Rating must be an integer between 1 and 5."
        )


@dataclass
class FeedbackRecord:
    """Feedback record structure for JSONL entries."""
    _type: str = "feedback"
    feedback: Feedback = field(default_factory=lambda: Feedback(
        session_id="",
        agent_id="",
        type=FeedbackType.EXPLICIT,
        confidence=1.0
    ))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "_type": self._type,
            "feedback": self.feedback.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeedbackRecord":
        """Create from dictionary representation."""
        return cls(
            _type=data.get("_type", "feedback"),
            feedback=Feedback.from_dict(data.get("feedback", {})),
        )


class FeedbackCollector:
    """
    Feedback collector for managing explicit feedback collection.

    This class handles submitting, retrieving, and analyzing user feedback.
    Feedback is persisted to JSONL files in the .aep/feedback directory.

    Example:
        ```python
        collector = FeedbackCollector('/path/to/project')

        # Submit feedback
        feedback = collector.submit_explicit(
            session_id='session_123',
            agent_id='agent_001',
            action_id='action_456',
            rating=5,
            comment='Excellent response!'
        )

        # Get feedback for an action
        action_feedback = collector.get_feedback('action_456')

        # Get session statistics
        stats = collector.get_stats('session_123')
        ```
    """

    def __init__(self, workspace: str, storage_dir: str = "feedback"):
        """
        Initialize the feedback collector.

        Args:
            workspace: Path to the workspace directory
            storage_dir: Directory name for feedback storage (default: 'feedback')
        """
        self._workspace = workspace
        self._storage_dir = Path(workspace) / ".aep" / storage_dir

        # Ensure feedback directory exists
        self._storage_dir.mkdir(parents=True, exist_ok=True)

    @property
    def workspace(self) -> str:
        """Get the workspace path."""
        return self._workspace

    def submit_explicit(
        self,
        session_id: str,
        agent_id: str,
        rating: int,
        action_id: Optional[str] = None,
        comment: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Feedback:
        """
        Submit explicit feedback for an action or session.

        Creates a new feedback entry and persists it to a JSONL file.

        Args:
            session_id: ID of the session this feedback belongs to
            agent_id: ID of the agent that received the feedback
            rating: User's rating (1-5)
            action_id: ID of the action this feedback is for (optional)
            comment: User's comment (optional)
            user_id: User ID (optional)
            metadata: Additional metadata

        Returns:
            The created Feedback object

        Raises:
            InvalidRatingError: If rating is not between 1-5
        """
        _validate_rating(rating)

        # Combine metadata with user_id
        full_metadata = metadata or {}
        if user_id is not None:
            full_metadata["user_id"] = user_id

        feedback = Feedback(
            id=_generate_feedback_id(),
            session_id=session_id,
            agent_id=agent_id,
            action_id=action_id,
            created_at=datetime.utcnow().isoformat() + "Z",
            type=FeedbackType.EXPLICIT,
            rating=rating,
            comment=comment,
            confidence=1.0,  # Explicit feedback has full confidence
            metadata=full_metadata if full_metadata else None,
        )

        # Persist to JSONL file
        self._append_feedback(feedback)

        return feedback

    def submit(
        self,
        action_id: str,
        rating: int,
        comment: Optional[str] = None,
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Feedback:
        """
        Submit explicit feedback with simplified parameters.

        Args:
            action_id: ID of the action this feedback is for
            rating: User's rating (1-5)
            comment: Optional comment
            session_id: Optional session ID (auto-generated if not provided)
            agent_id: Optional agent ID (uses default if not provided)
            user_id: Optional user ID

        Returns:
            The created Feedback object
        """
        return self.submit_explicit(
            session_id=session_id or f"session_{int(time.time() * 1000)}",
            agent_id=agent_id or "default_agent",
            action_id=action_id,
            rating=rating,
            comment=comment,
            user_id=user_id,
        )

    def submit_implicit(
        self,
        session_id: str,
        agent_id: str,
        outcome: ActionOutcome,
        confidence: float,
        action_id: Optional[str] = None,
        evidence: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Feedback:
        """
        Submit implicit feedback for an action.

        Implicit feedback is inferred from user behavior, not explicitly provided.

        Args:
            session_id: ID of the session this feedback belongs to
            agent_id: ID of the agent that received the feedback
            outcome: Outcome inferred from user behavior
            confidence: Confidence score of the inference (0-1)
            action_id: ID of the action this feedback is for (optional)
            evidence: Evidence describing why feedback was inferred
            metadata: Additional metadata

        Returns:
            The created Feedback object
        """
        # Clamp confidence to valid range
        confidence = max(0.0, min(1.0, confidence))

        feedback = Feedback(
            id=_generate_feedback_id(),
            session_id=session_id,
            agent_id=agent_id,
            action_id=action_id,
            created_at=datetime.utcnow().isoformat() + "Z",
            type=FeedbackType.IMPLICIT,
            outcome=outcome,
            confidence=confidence,
            evidence=evidence,
            metadata=metadata,
        )

        # Persist to JSONL file
        self._append_feedback(feedback)

        return feedback

    def infer_from_acceptance(
        self,
        session_id: str,
        agent_id: str,
        action_id: str,
        evidence: Optional[str] = None,
    ) -> Feedback:
        """
        Infer positive feedback from user accepting a suggestion.

        Args:
            session_id: The session ID
            agent_id: The agent ID
            action_id: The action ID that was accepted
            evidence: Optional custom evidence

        Returns:
            The created Feedback object
        """
        return self.submit_implicit(
            session_id=session_id,
            agent_id=agent_id,
            action_id=action_id,
            outcome=ActionOutcome.SUCCESS,
            confidence=0.8,
            evidence=evidence or "user_accepted_suggestion",
        )

    def infer_from_rejection(
        self,
        session_id: str,
        agent_id: str,
        action_id: str,
        evidence: Optional[str] = None,
    ) -> Feedback:
        """
        Infer negative feedback from user rejecting a suggestion.

        Args:
            session_id: The session ID
            agent_id: The agent ID
            action_id: The action ID that was rejected
            evidence: Optional custom evidence

        Returns:
            The created Feedback object
        """
        return self.submit_implicit(
            session_id=session_id,
            agent_id=agent_id,
            action_id=action_id,
            outcome=ActionOutcome.FAILURE,
            confidence=0.9,
            evidence=evidence or "user_rejected_suggestion",
        )

    def infer_from_copy(
        self,
        session_id: str,
        agent_id: str,
        action_id: str,
    ) -> Feedback:
        """
        Infer positive feedback from user copying content.

        Args:
            session_id: The session ID
            agent_id: The agent ID
            action_id: The action ID with content that was copied

        Returns:
            The created Feedback object
        """
        return self.submit_implicit(
            session_id=session_id,
            agent_id=agent_id,
            action_id=action_id,
            outcome=ActionOutcome.SUCCESS,
            confidence=0.7,
            evidence="user_copied_content",
        )

    def infer_from_session_duration(
        self,
        session_id: str,
        agent_id: str,
        action_id: str,
        duration_seconds: float,
    ) -> Feedback:
        """
        Infer feedback from session duration.

        Short sessions (< 30s) suggest the problem wasn't solved.
        Long sessions (> 5min) suggest detailed engagement.

        Args:
            session_id: The session ID
            agent_id: The agent ID
            action_id: The last action ID
            duration_seconds: Session duration in seconds

        Returns:
            The created Feedback object
        """
        if duration_seconds < 30:
            outcome = ActionOutcome.FAILURE
            confidence = 0.6
            evidence = f"short_session_{int(duration_seconds)}s"
        elif duration_seconds > 300:
            outcome = ActionOutcome.SUCCESS
            confidence = 0.6
            evidence = f"long_session_{int(duration_seconds)}s"
        else:
            outcome = ActionOutcome.PARTIAL
            confidence = 0.5
            evidence = f"session_duration_{int(duration_seconds)}s"

        return self.submit_implicit(
            session_id=session_id,
            agent_id=agent_id,
            action_id=action_id,
            outcome=outcome,
            confidence=confidence,
            evidence=evidence,
        )

    def infer_from_similar_question(
        self,
        session_id: str,
        agent_id: str,
        action_id: str,
    ) -> Feedback:
        """
        Infer negative feedback from user asking a similar question.

        This suggests the previous response didn't fully address the user's needs.

        Args:
            session_id: The session ID
            agent_id: The agent ID
            action_id: The action ID that didn't satisfy the user

        Returns:
            The created Feedback object
        """
        return self.submit_implicit(
            session_id=session_id,
            agent_id=agent_id,
            action_id=action_id,
            outcome=ActionOutcome.PARTIAL,
            confidence=0.7,
            evidence="user_asked_similar_question",
        )

    def get_feedback(self, action_id: str) -> Optional[Feedback]:
        """
        Get feedback for a specific action.

        Args:
            action_id: The action ID to get feedback for

        Returns:
            The Feedback object, or None if not found
        """
        all_feedback = self._load_all_feedback()
        for f in all_feedback:
            if f.action_id == action_id:
                return f
        return None

    def get_session_feedback(self, session_id: str) -> List[Feedback]:
        """
        Get all feedback for a session.

        Args:
            session_id: The session ID to get feedback for

        Returns:
            List of Feedback objects
        """
        all_feedback = self._load_all_feedback()
        return [f for f in all_feedback if f.session_id == session_id]

    def get_stats(self, session_id: str) -> FeedbackStats:
        """
        Get feedback statistics for a session.

        Args:
            session_id: The session ID to get statistics for

        Returns:
            FeedbackStats object with aggregated metrics
        """
        session_feedback = self.get_session_feedback(session_id)

        explicit_feedback = [f for f in session_feedback if f.type == FeedbackType.EXPLICIT]
        implicit_feedback = [f for f in session_feedback if f.type == FeedbackType.IMPLICIT]

        # Calculate rating distribution
        rating_distribution: Dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        total_rating = 0

        for f in explicit_feedback:
            if f.rating is not None:
                rating_distribution[f.rating] = rating_distribution.get(f.rating, 0) + 1
                total_rating += f.rating

        avg_rating = None
        if explicit_feedback:
            avg_rating = total_rating / len(explicit_feedback)

        # Calculate outcome distribution
        outcome_distribution: Dict[str, int] = {
            ActionOutcome.SUCCESS.value: 0,
            ActionOutcome.FAILURE.value: 0,
            ActionOutcome.PARTIAL.value: 0,
        }

        for f in implicit_feedback:
            if f.outcome is not None:
                outcome_key = f.outcome.value if isinstance(f.outcome, ActionOutcome) else f.outcome
                outcome_distribution[outcome_key] = outcome_distribution.get(outcome_key, 0) + 1

        # Calculate average confidence
        total_confidence = sum(f.confidence for f in session_feedback)
        avg_confidence = total_confidence / len(session_feedback) if session_feedback else 0.0

        return FeedbackStats(
            total_feedback=len(session_feedback),
            explicit_count=len(explicit_feedback),
            implicit_count=len(implicit_feedback),
            avg_rating=avg_rating,
            rating_distribution=rating_distribution,
            outcome_distribution=outcome_distribution,
            avg_confidence=avg_confidence,
        )

    def delete_feedback(self, feedback_id: str) -> bool:
        """
        Delete feedback by ID.

        Args:
            feedback_id: The feedback ID to delete

        Returns:
            True if feedback was deleted, False if not found
        """
        all_feedback = self._load_all_feedback()

        for i, f in enumerate(all_feedback):
            if f.id == feedback_id:
                all_feedback.pop(i)
                self._rewrite_all_feedback(all_feedback)
                return True

        return False

    def _get_global_feedback_file(self) -> Path:
        """Get the global feedback file path."""
        return self._storage_dir / "feedback.jsonl"

    def _append_feedback(self, feedback: Feedback) -> None:
        """Append a feedback entry to the JSONL file."""
        file_path = self._get_global_feedback_file()
        record = FeedbackRecord(feedback=feedback)

        with open(file_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record.to_dict()) + "\n")

    def _load_all_feedback(self) -> List[Feedback]:
        """Load all feedback entries from storage."""
        file_path = self._get_global_feedback_file()

        if not file_path.exists():
            return []

        feedbacks: List[Feedback] = []

        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = FeedbackRecord.from_dict(json.loads(line))
                    if record._type == "feedback":
                        feedbacks.append(record.feedback)
                except (json.JSONDecodeError, KeyError):
                    # Skip malformed lines
                    continue

        return feedbacks

    def _rewrite_all_feedback(self, feedbacks: List[Feedback]) -> None:
        """Rewrite all feedback entries to the JSONL file."""
        file_path = self._get_global_feedback_file()

        if not feedbacks:
            # Write empty file
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("")
            return

        with open(file_path, "w", encoding="utf-8") as f:
            for feedback in feedbacks:
                record = FeedbackRecord(feedback=feedback)
                f.write(json.dumps(record.to_dict()) + "\n")