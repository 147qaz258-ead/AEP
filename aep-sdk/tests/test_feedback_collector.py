"""
Unit tests for FeedbackCollector (Python).

Tests cover:
- submit_explicit feedback submission
- submit convenience method
- get_feedback retrieval
- get_session_feedback retrieval
- get_stats statistics calculation
- Invalid rating validation
- JSONL persistence
"""

import json
import tempfile
from pathlib import Path

import pytest

from aep_sdk.feedback import (
    Feedback,
    FeedbackCollector,
    FeedbackError,
    FeedbackNotFoundError,
    InvalidRatingError,
    FeedbackType,
    FeedbackStats,
    ActionOutcome,
)
from aep_sdk.feedback.collector import (
    FeedbackRecord,
    _generate_feedback_id,
    _validate_rating,
)


class TestFeedbackCollector:
    """Tests for FeedbackCollector class."""

    def test_init(self):
        """Test initializing FeedbackCollector."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)
            assert collector.workspace == tmpdir

    def test_init_creates_feedback_directory(self):
        """Test that initialization creates feedback directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)
            feedback_dir = Path(tmpdir) / ".aep" / "feedback"
            assert feedback_dir.exists()

    def test_init_custom_storage_directory(self):
        """Test initializing with custom storage directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir, "custom-feedback")
            custom_dir = Path(tmpdir) / ".aep" / "custom-feedback"
            assert custom_dir.exists()

    def test_submit_explicit_with_all_fields(self):
        """Test submitting explicit feedback with all fields."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                rating=5,
                comment="Excellent response!",
                user_id="user_789",
            )

            assert feedback.id is not None
            assert feedback.id.startswith("fb_")
            assert feedback.session_id == "session_123"
            assert feedback.agent_id == "agent_001"
            assert feedback.action_id == "action_456"
            assert feedback.rating == 5
            assert feedback.comment == "Excellent response!"
            assert feedback.type == FeedbackType.EXPLICIT
            assert feedback.confidence == 1.0
            assert feedback.created_at is not None
            assert feedback.metadata is not None
            assert feedback.metadata.get("user_id") == "user_789"

    def test_submit_explicit_with_minimal_fields(self):
        """Test submitting explicit feedback with minimal fields."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                rating=3,
            )

            assert feedback.action_id is None
            assert feedback.comment is None
            assert feedback.rating == 3

    def test_submit_explicit_invalid_rating_below_range(self):
        """Test that invalid rating below 1 raises error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            with pytest.raises(InvalidRatingError) as exc_info:
                collector.submit_explicit(
                    session_id="session_123",
                    agent_id="agent_001",
                    rating=0,
                )

            assert "Invalid rating" in str(exc_info.value)

    def test_submit_explicit_invalid_rating_above_range(self):
        """Test that invalid rating above 5 raises error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            with pytest.raises(InvalidRatingError):
                collector.submit_explicit(
                    session_id="session_123",
                    agent_id="agent_001",
                    rating=6,
                )

    def test_submit_explicit_invalid_rating_non_integer(self):
        """Test that non-integer rating raises error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            with pytest.raises(InvalidRatingError):
                collector.submit_explicit(
                    session_id="session_123",
                    agent_id="agent_001",
                    rating=3.5,
                )

    def test_submit_explicit_persists_to_jsonl(self):
        """Test that feedback is persisted to JSONL file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                rating=4,
            )

            feedback_file = Path(tmpdir) / ".aep" / "feedback" / "feedback.jsonl"
            assert feedback_file.exists()

            content = feedback_file.read_text()
            lines = content.strip().split("\n")
            assert len(lines) == 1

            record = json.loads(lines[0])
            assert record["_type"] == "feedback"
            assert record["feedback"]["rating"] == 4

    def test_submit_simplified_parameters(self):
        """Test submit convenience method with simplified parameters."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit(
                action_id="action_123",
                rating=5,
                comment="Great!",
            )

            assert feedback.action_id == "action_123"
            assert feedback.rating == 5
            assert feedback.comment == "Great!"
            assert feedback.session_id is not None
            assert feedback.agent_id == "default_agent"

    def test_submit_all_optional_parameters(self):
        """Test submit with all optional parameters."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit(
                action_id="action_456",
                rating=4,
                comment="Good",
                session_id="session_custom",
                agent_id="agent_custom",
                user_id="user_123",
            )

            assert feedback.action_id == "action_456"
            assert feedback.rating == 4
            assert feedback.comment == "Good"
            assert feedback.session_id == "session_custom"
            assert feedback.agent_id == "agent_custom"
            assert feedback.metadata is not None
            assert feedback.metadata.get("user_id") == "user_123"

    def test_get_feedback_existing(self):
        """Test getting feedback for existing action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                rating=5,
            )

            feedback = collector.get_feedback("action_456")

            assert feedback is not None
            assert feedback.action_id == "action_456"
            assert feedback.rating == 5

    def test_get_feedback_non_existing(self):
        """Test getting feedback for non-existing action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.get_feedback("nonexistent_action")
            assert feedback is None

    def test_get_feedback_multiple_exist(self):
        """Test getting correct feedback when multiple exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_1",
                rating=5,
            )

            collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_2",
                rating=3,
            )

            feedback = collector.get_feedback("action_2")
            assert feedback is not None
            assert feedback.rating == 3

    def test_get_session_feedback(self):
        """Test getting all feedback for a session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            collector.submit_explicit(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_1",
                rating=5,
            )

            collector.submit_explicit(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_2",
                rating=4,
            )

            collector.submit_explicit(
                session_id="session_2",
                agent_id="agent_001",
                action_id="action_3",
                rating=3,
            )

            feedbacks = collector.get_session_feedback("session_1")
            assert len(feedbacks) == 2
            action_ids = [f.action_id for f in feedbacks]
            assert "action_1" in action_ids
            assert "action_2" in action_ids

    def test_get_session_feedback_empty(self):
        """Test getting feedback for session with no feedback."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedbacks = collector.get_session_feedback("nonexistent_session")
            assert feedbacks == []

    def test_get_stats(self):
        """Test calculating statistics correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            # Submit feedbacks with different ratings
            collector.submit_explicit(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_1",
                rating=5,
            )

            collector.submit_explicit(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_2",
                rating=4,
            )

            collector.submit_explicit(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_3",
                rating=5,
            )

            stats = collector.get_stats("session_1")

            assert stats.total_feedback == 3
            assert stats.explicit_count == 3
            assert stats.implicit_count == 0
            assert stats.avg_rating is not None
            assert abs(stats.avg_rating - 4.67) < 0.1
            assert stats.rating_distribution[5] == 2
            assert stats.rating_distribution[4] == 1
            assert stats.rating_distribution[1] == 0
            assert stats.rating_distribution[2] == 0
            assert stats.rating_distribution[3] == 0

    def test_get_stats_empty_session(self):
        """Test stats for empty session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            stats = collector.get_stats("nonexistent_session")

            assert stats.total_feedback == 0
            assert stats.explicit_count == 0
            assert stats.implicit_count == 0
            assert stats.avg_rating is None

    def test_get_stats_multiple_sessions(self):
        """Test stats for multiple independent sessions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            collector.submit_explicit(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_1",
                rating=5,
            )

            collector.submit_explicit(
                session_id="session_2",
                agent_id="agent_001",
                action_id="action_2",
                rating=1,
            )

            stats1 = collector.get_stats("session_1")
            stats2 = collector.get_stats("session_2")

            assert stats1.total_feedback == 1
            assert stats1.avg_rating == 5
            assert stats2.total_feedback == 1
            assert stats2.avg_rating == 1

    def test_delete_feedback_existing(self):
        """Test deleting existing feedback."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                rating=5,
            )

            deleted = collector.delete_feedback(feedback.id)
            assert deleted is True

            retrieved = collector.get_feedback("action_456")
            assert retrieved is None

    def test_delete_feedback_non_existing(self):
        """Test deleting non-existing feedback."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            deleted = collector.delete_feedback("nonexistent_id")
            assert deleted is False

    def test_delete_feedback_persists(self):
        """Test that deletion persists across collector instances."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                rating=5,
            )

            collector.delete_feedback(feedback.id)

            # Create new collector to test persistence
            new_collector = FeedbackCollector(tmpdir)
            retrieved = new_collector.get_feedback("action_456")
            assert retrieved is None


class TestFeedbackCollectorPersistence:
    """Tests for persistence behavior."""

    def test_persist_across_collector_instances(self):
        """Test that feedback persists across collector instances."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                rating=5,
                comment="Great!",
            )

            # Create new collector instance
            new_collector = FeedbackCollector(tmpdir)
            feedback = new_collector.get_feedback("action_456")

            assert feedback is not None
            assert feedback.rating == 5
            assert feedback.comment == "Great!"

    def test_multiple_feedback_submissions(self):
        """Test handling multiple feedback submissions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            for i in range(1, 11):
                collector.submit_explicit(
                    session_id="session_123",
                    agent_id="agent_001",
                    action_id=f"action_{i}",
                    rating=(i % 5) + 1,
                )

            feedbacks = collector.get_session_feedback("session_123")
            assert len(feedbacks) == 10


class TestFeedbackCollectorEdgeCases:
    """Tests for edge cases and error handling."""

    def test_invalid_rating_error_descriptive_message(self):
        """Test that InvalidRatingError has descriptive message."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            with pytest.raises(InvalidRatingError) as exc_info:
                collector.submit_explicit(
                    session_id="session_123",
                    agent_id="agent_001",
                    rating=10,
                )

            assert "Invalid rating" in str(exc_info.value)
            assert "10" in str(exc_info.value)

    def test_handle_corrupted_jsonl_gracefully(self):
        """Test that corrupted JSONL lines are handled gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            # Write corrupted line to file
            feedback_file = Path(tmpdir) / ".aep" / "feedback" / "feedback.jsonl"
            feedback_file.write_text("invalid json\n")

            # Submit valid feedback
            collector.submit_explicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                rating=5,
            )

            feedback = collector.get_feedback("action_456")
            assert feedback is not None
            assert feedback.rating == 5


class TestHelperFunctions:
    """Tests for helper functions."""

    def test_generate_feedback_id(self):
        """Test feedback ID generation."""
        id1 = _generate_feedback_id()
        id2 = _generate_feedback_id()

        assert id1.startswith("fb_")
        assert id2.startswith("fb_")
        assert id1 != id2  # IDs should be unique

    def test_validate_rating_valid(self):
        """Test valid rating validation."""
        # Should not raise
        _validate_rating(1)
        _validate_rating(2)
        _validate_rating(3)
        _validate_rating(4)
        _validate_rating(5)

    def test_validate_rating_invalid_below(self):
        """Test invalid rating below range."""
        with pytest.raises(InvalidRatingError):
            _validate_rating(0)

    def test_validate_rating_invalid_above(self):
        """Test invalid rating above range."""
        with pytest.raises(InvalidRatingError):
            _validate_rating(6)

    def test_validate_rating_invalid_non_integer(self):
        """Test invalid non-integer rating."""
        with pytest.raises(InvalidRatingError):
            _validate_rating(3.5)


class TestFeedbackRecord:
    """Tests for FeedbackRecord dataclass."""

    def test_to_dict(self):
        """Test FeedbackRecord to_dict."""
        feedback = Feedback(
            session_id="session_123",
            agent_id="agent_001",
            type=FeedbackType.EXPLICIT,
            confidence=1.0,
            rating=5,
        )
        record = FeedbackRecord(feedback=feedback)

        result = record.to_dict()

        assert result["_type"] == "feedback"
        assert result["feedback"]["session_id"] == "session_123"
        assert result["feedback"]["rating"] == 5

    def test_from_dict(self):
        """Test FeedbackRecord from_dict."""
        data = {
            "_type": "feedback",
            "feedback": {
                "id": "fb_123",
                "session_id": "session_123",
                "agent_id": "agent_001",
                "created_at": "2024-01-01T00:00:00Z",
                "type": "explicit",
                "confidence": 1.0,
                "rating": 5,
            },
        }

        record = FeedbackRecord.from_dict(data)

        assert record._type == "feedback"
        assert record.feedback.session_id == "session_123"
        assert record.feedback.rating == 5


class TestImplicitFeedback:
    """Tests for implicit feedback methods."""

    def test_submit_implicit_with_all_fields(self):
        """Test submitting implicit feedback with all fields."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit_implicit(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                outcome=ActionOutcome.SUCCESS,
                confidence=0.8,
                evidence="user_accepted_suggestion",
            )

            assert feedback.id is not None
            assert feedback.id.startswith("fb_")
            assert feedback.session_id == "session_123"
            assert feedback.agent_id == "agent_001"
            assert feedback.action_id == "action_456"
            assert feedback.type == FeedbackType.IMPLICIT
            assert feedback.outcome == ActionOutcome.SUCCESS
            assert feedback.confidence == 0.8
            assert feedback.evidence == "user_accepted_suggestion"
            assert feedback.rating is None

    def test_submit_implicit_with_minimal_fields(self):
        """Test submitting implicit feedback with minimal fields."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.submit_implicit(
                session_id="session_123",
                agent_id="agent_001",
                outcome=ActionOutcome.FAILURE,
                confidence=0.5,
            )

            assert feedback.action_id is None
            assert feedback.evidence is None
            assert feedback.outcome == ActionOutcome.FAILURE
            assert feedback.confidence == 0.5

    def test_infer_from_acceptance(self):
        """Test inferring positive feedback from acceptance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_acceptance(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
            )

            assert feedback.type == FeedbackType.IMPLICIT
            assert feedback.outcome == ActionOutcome.SUCCESS
            assert feedback.confidence == 0.8
            assert feedback.evidence == "user_accepted_suggestion"

    def test_infer_from_acceptance_custom_evidence(self):
        """Test inferring feedback from acceptance with custom evidence."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_acceptance(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                evidence="user_clicked_apply_button",
            )

            assert feedback.evidence == "user_clicked_apply_button"

    def test_infer_from_rejection(self):
        """Test inferring negative feedback from rejection."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_rejection(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
            )

            assert feedback.type == FeedbackType.IMPLICIT
            assert feedback.outcome == ActionOutcome.FAILURE
            assert feedback.confidence == 0.9
            assert feedback.evidence == "user_rejected_suggestion"

    def test_infer_from_copy(self):
        """Test inferring positive feedback from copy."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_copy(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
            )

            assert feedback.type == FeedbackType.IMPLICIT
            assert feedback.outcome == ActionOutcome.SUCCESS
            assert feedback.confidence == 0.7
            assert feedback.evidence == "user_copied_content"

    def test_infer_from_session_duration_short(self):
        """Test inferring failure from short session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_session_duration(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                duration_seconds=15,
            )

            assert feedback.outcome == ActionOutcome.FAILURE
            assert feedback.confidence == 0.6
            assert "short_session" in feedback.evidence

    def test_infer_from_session_duration_long(self):
        """Test inferring success from long session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_session_duration(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                duration_seconds=400,
            )

            assert feedback.outcome == ActionOutcome.SUCCESS
            assert feedback.confidence == 0.6
            assert "long_session" in feedback.evidence

    def test_infer_from_session_duration_medium(self):
        """Test inferring partial from medium session."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_session_duration(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
                duration_seconds=120,
            )

            assert feedback.outcome == ActionOutcome.PARTIAL
            assert feedback.confidence == 0.5
            assert "session_duration" in feedback.evidence

    def test_infer_from_similar_question(self):
        """Test inferring partial feedback from similar question."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            feedback = collector.infer_from_similar_question(
                session_id="session_123",
                agent_id="agent_001",
                action_id="action_456",
            )

            assert feedback.type == FeedbackType.IMPLICIT
            assert feedback.outcome == ActionOutcome.PARTIAL
            assert feedback.confidence == 0.7
            assert feedback.evidence == "user_asked_similar_question"

    def test_get_stats_with_implicit_feedback(self):
        """Test calculating implicit feedback statistics."""
        with tempfile.TemporaryDirectory() as tmpdir:
            collector = FeedbackCollector(tmpdir)

            collector.submit_explicit(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_1",
                rating=5,
            )

            collector.infer_from_acceptance(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_2",
            )

            collector.infer_from_rejection(
                session_id="session_1",
                agent_id="agent_001",
                action_id="action_3",
            )

            stats = collector.get_stats("session_1")

            assert stats.total_feedback == 3
            assert stats.explicit_count == 1
            assert stats.implicit_count == 2
            assert stats.outcome_distribution["success"] == 1
            assert stats.outcome_distribution["failure"] == 1