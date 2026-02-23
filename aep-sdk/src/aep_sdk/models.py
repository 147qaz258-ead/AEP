"""
AEP SDK Data Models

This module defines data models for the AEP SDK.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Experience:
    """
    Represents a matched experience returned from the Hub.

    Attributes:
        id: Unique experience identifier (e.g., "exp_...")
        trigger: The error/signal that triggers this experience
        solution: The solution or fix for this experience
        confidence: Confidence score (0.0 - 1.0)
        gdi_score: GDI (Good Distribution Index) score (0.0 - 1.0)
        tags: Optional list of tags for categorization
        metadata: Optional additional metadata
    """

    id: str
    trigger: str
    solution: str
    confidence: float
    gdi_score: float
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Experience":
        """
        Create an Experience from a dictionary.

        Args:
            data: Dictionary containing experience data

        Returns:
            Experience instance
        """
        return cls(
            id=data.get("id", ""),
            trigger=data.get("trigger", ""),
            solution=data.get("solution", ""),
            confidence=data.get("confidence", 0.0),
            gdi_score=data.get("gdi_score", 0.0),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
        )

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert Experience to dictionary.

        Returns:
            Dictionary representation
        """
        return {
            "id": self.id,
            "trigger": self.trigger,
            "solution": self.solution,
            "confidence": self.confidence,
            "gdi_score": self.gdi_score,
            "tags": self.tags,
            "metadata": self.metadata,
        }


@dataclass
class BlastRadius:
    """
    Blast radius of changes for an experience.

    Attributes:
        files: Number of files affected
        lines: Number of lines changed
    """
    files: int
    lines: int


@dataclass
class PublishResult:
    """
    Result of a publish operation.

    Attributes:
        experience_id: Unique identifier for the published experience
        status: Status of the experience ('candidate' or 'promoted')
        created_at: ISO 8601 timestamp of creation
        duplicate: Whether this was a duplicate of an existing experience
        message: Human-readable message about the result
    """
    experience_id: str
    status: str  # 'candidate' | 'promoted'
    created_at: str
    duplicate: bool
    message: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PublishResult":
        """
        Create PublishResult from API response dictionary.

        Args:
            data: Dictionary containing publish response data

        Returns:
            PublishResult instance
        """
        return cls(
            experience_id=data["experience_id"],
            status=data["status"],
            created_at=data["created_at"],
            duplicate=data["duplicate"],
            message=data["message"],
        )


@dataclass
class PublishPayload:
    """
    Internal payload structure for publishing an experience.

    This represents the Gene + Capsule format used internally by the AEP Protocol.

    Attributes:
        trigger: The trigger pattern (error, issue, or situation)
        solution: The solution that worked for this trigger
        confidence: Confidence level (0.0 to 1.0)
        signals_match: Optional list of matched signal types
        gene: Optional gene ID this experience belongs to
        context: Optional additional context metadata
        blast_radius: Optional blast radius of changes
    """
    trigger: str
    solution: str
    confidence: float
    signals_match: Optional[List[str]] = None
    gene: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    blast_radius: Optional[BlastRadius] = None

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert to dictionary for API request.

        Returns:
            Dictionary representation for the API payload
        """
        result: Dict[str, Any] = {
            "trigger": self.trigger,
            "solution": self.solution,
            "confidence": self.confidence,
        }

        if self.signals_match is not None:
            result["signals_match"] = self.signals_match
        if self.gene is not None:
            result["gene"] = self.gene
        if self.context is not None:
            result["context"] = self.context
        if self.blast_radius is not None:
            result["blast_radius"] = {
                "files": self.blast_radius.files,
                "lines": self.blast_radius.lines,
            }

        return result


@dataclass
class ExperienceStats:
    """
    Statistics for an experience.

    Attributes:
        total_uses: Total number of times the experience was used
        total_success: Total number of successful uses
        total_feedback: Total feedback submissions received
        positive_feedback: Number of positive feedback submissions
        success_streak: Current consecutive success streak
        consecutive_failures: Current consecutive failure count
    """

    total_uses: int
    total_success: int
    total_feedback: int
    positive_feedback: int
    success_streak: int
    consecutive_failures: int

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExperienceStats":
        """
        Create ExperienceStats from a dictionary.

        Args:
            data: Dictionary containing stats data

        Returns:
            ExperienceStats instance
        """
        return cls(
            total_uses=data.get("total_uses", 0),
            total_success=data.get("total_success", 0),
            total_feedback=data.get("total_feedback", 0),
            positive_feedback=data.get("positive_feedback", 0),
            success_streak=data.get("success_streak", 0),
            consecutive_failures=data.get("consecutive_failures", 0),
        )


@dataclass
class FeedbackResult:
    """
    Result of a feedback submission.

    Attributes:
        status: Status of the feedback submission (always "recorded" on success)
        feedback_id: Unique identifier for the submitted feedback
        reward_earned: Reward points earned for this feedback
        updated_stats: Updated experience statistics
        previous_status: Previous status of the experience (candidate/promoted/deprecated)
        new_status: New status of the experience after feedback
        new_gdi_score: Updated GDI score of the experience
    """

    status: str
    feedback_id: str
    reward_earned: float
    updated_stats: ExperienceStats
    previous_status: str
    new_status: str
    new_gdi_score: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeedbackResult":
        """
        Create FeedbackResult from a dictionary.

        Args:
            data: Dictionary containing feedback response data

        Returns:
            FeedbackResult instance
        """
        stats = ExperienceStats.from_dict(data.get("updated_stats", {}))
        return cls(
            status="recorded",
            feedback_id=data.get("feedback_id", ""),
            reward_earned=data.get("reward_earned", 0),
            updated_stats=stats,
            previous_status=data.get("previous_status", "candidate"),
            new_status=data.get("new_status", "candidate"),
            new_gdi_score=data.get("new_gdi_score"),
        )

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert FeedbackResult to dictionary.

        Returns:
            Dictionary representation
        """
        return {
            "status": self.status,
            "feedback_id": self.feedback_id,
            "reward_earned": self.reward_earned,
            "updated_stats": self.updated_stats.__dict__,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "new_gdi_score": self.new_gdi_score,
        }
