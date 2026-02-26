"""
Tests for PendingQueueManager
"""

import pytest
import tempfile
import os
from pathlib import Path

from aep_sdk.archive.pending_queue import PendingQueueManager
from aep_sdk.archive.models import PendingStatus


class TestPendingQueueManager:
    """Test cases for PendingQueueManager."""

    def test_add_pending(self):
        """Test adding a pending experience."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="TypeError",
                solution="Add null check",
                confidence=0.85,
                source_action_id="action_123",
                source_session_id="session_456"
            )

            assert exp.id.startswith("exp_")
            assert exp.status == PendingStatus.PENDING
            assert exp.trigger == "TypeError"
            assert exp.solution == "Add null check"
            assert exp.confidence == 0.85

            # Verify persistence
            loaded = manager.get_pending(exp.id)
            assert loaded is not None
            assert loaded.trigger == "TypeError"

    def test_add_pending_with_feedback_score(self):
        """Test adding a pending experience with feedback score."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="Bug",
                solution="Patch",
                confidence=0.75,
                source_action_id="action_2",
                source_session_id="session_2",
                feedback_score=4.5
            )

            assert exp.feedback_score == 4.5

    def test_list_pending(self):
        """Test listing pending experiences."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            manager.add_pending(
                trigger="Error1",
                solution="Fix1",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )
            manager.add_pending(
                trigger="Error2",
                solution="Fix2",
                confidence=0.9,
                source_action_id="a2",
                source_session_id="s2"
            )

            list_all = manager.list_pending()
            assert len(list_all) == 2

    def test_list_pending_with_session_filter(self):
        """Test listing pending experiences with session filter."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            manager.add_pending(
                trigger="Error1",
                solution="Fix1",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="session_A"
            )
            manager.add_pending(
                trigger="Error2",
                solution="Fix2",
                confidence=0.9,
                source_action_id="a2",
                source_session_id="session_B"
            )

            list_a = manager.list_pending(session_id="session_A")
            assert len(list_a) == 1
            assert list_a[0].source_session_id == "session_A"

    def test_list_pending_with_status_filter(self):
        """Test listing pending experiences with status filter."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="Error",
                solution="Fix",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )

            manager.approve_pending(exp.id)

            pending_list = manager.list_pending(status=PendingStatus.PENDING)
            assert len(pending_list) == 0

            approved_list = manager.list_pending(status=PendingStatus.APPROVED)
            assert len(approved_list) == 1

    def test_list_pending_with_limit(self):
        """Test listing pending experiences with limit."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            for i in range(10):
                manager.add_pending(
                    trigger=f"Error{i}",
                    solution=f"Fix{i}",
                    confidence=0.8,
                    source_action_id=f"a{i}",
                    source_session_id=f"s{i}"
                )

            list_limited = manager.list_pending(limit=5)
            assert len(list_limited) == 5

    def test_get_pending(self):
        """Test getting a specific pending experience."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="TestError",
                solution="TestFix",
                confidence=0.95,
                source_action_id="action_test",
                source_session_id="session_test"
            )

            loaded = manager.get_pending(exp.id)
            assert loaded is not None
            assert loaded.id == exp.id
            assert loaded.trigger == "TestError"

    def test_get_pending_not_found(self):
        """Test getting a non-existent pending experience."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            loaded = manager.get_pending("exp_nonexistent")
            assert loaded is None

    def test_remove_pending(self):
        """Test removing a pending experience."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="Error",
                solution="Fix",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )

            result = manager.remove_pending(exp.id)
            assert result is True
            assert manager.get_pending(exp.id) is None

    def test_remove_pending_not_found(self):
        """Test removing a non-existent pending experience."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            result = manager.remove_pending("exp_nonexistent")
            assert result is False

    def test_approve_pending(self):
        """Test approving a pending experience."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="Error",
                solution="Fix",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )

            result = manager.approve_pending(exp.id)
            assert result is True

            loaded = manager.get_pending(exp.id)
            assert loaded.status == PendingStatus.APPROVED

    def test_reject_pending(self):
        """Test rejecting a pending experience."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="Error",
                solution="Fix",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )

            result = manager.reject_pending(exp.id)
            assert result is True

            loaded = manager.get_pending(exp.id)
            assert loaded.status == PendingStatus.REJECTED

    def test_get_batch(self):
        """Test getting a batch of approved experiences."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp1 = manager.add_pending(
                trigger="Error1",
                solution="Fix1",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )
            exp2 = manager.add_pending(
                trigger="Error2",
                solution="Fix2",
                confidence=0.9,
                source_action_id="a2",
                source_session_id="s2"
            )

            manager.approve_pending(exp1.id)
            manager.approve_pending(exp2.id)

            batch = manager.get_batch(batch_size=10, status=PendingStatus.APPROVED)
            assert len(batch) == 2

    def test_get_batch_with_size_limit(self):
        """Test getting a batch with size limit."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            for i in range(5):
                exp = manager.add_pending(
                    trigger=f"Error{i}",
                    solution=f"Fix{i}",
                    confidence=0.8,
                    source_action_id=f"a{i}",
                    source_session_id=f"s{i}"
                )
                manager.approve_pending(exp.id)

            batch = manager.get_batch(batch_size=2, status=PendingStatus.APPROVED)
            assert len(batch) == 2

    def test_clear_completed(self):
        """Test clearing completed experiences."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp1 = manager.add_pending(
                trigger="Error1",
                solution="Fix1",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )
            exp2 = manager.add_pending(
                trigger="Error2",
                solution="Fix2",
                confidence=0.9,
                source_action_id="a2",
                source_session_id="s2"
            )
            exp3 = manager.add_pending(
                trigger="Error3",
                solution="Fix3",
                confidence=0.7,
                source_action_id="a3",
                source_session_id="s3"
            )

            manager.approve_pending(exp1.id)
            manager.reject_pending(exp2.id)
            # exp3 remains pending

            count = manager.clear_completed()
            assert count == 2

            remaining = manager.list_pending()
            assert len(remaining) == 1
            assert remaining[0].id == exp3.id

    def test_get_stats(self):
        """Test getting queue statistics."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp1 = manager.add_pending(
                trigger="Error1",
                solution="Fix1",
                confidence=0.8,
                source_action_id="a1",
                source_session_id="s1"
            )
            exp2 = manager.add_pending(
                trigger="Error2",
                solution="Fix2",
                confidence=0.9,
                source_action_id="a2",
                source_session_id="s2"
            )
            manager.add_pending(
                trigger="Error3",
                solution="Fix3",
                confidence=0.7,
                source_action_id="a3",
                source_session_id="s3"
            )

            manager.approve_pending(exp1.id)
            manager.reject_pending(exp2.id)

            stats = manager.get_stats()
            assert stats["pending"] == 1
            assert stats["approved"] == 1
            assert stats["rejected"] == 1
            assert stats["total"] == 3

    def test_persistence_across_instances(self):
        """Test that experiences persist across manager instances."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # First instance
            manager1 = PendingQueueManager(tmpdir)
            exp = manager1.add_pending(
                trigger="PersistentError",
                solution="PersistentFix",
                confidence=0.9,
                source_action_id="a1",
                source_session_id="s1"
            )
            exp_id = exp.id

            # Second instance (same workspace)
            manager2 = PendingQueueManager(tmpdir)
            loaded = manager2.get_pending(exp_id)

            assert loaded is not None
            assert loaded.trigger == "PersistentError"
            assert loaded.solution == "PersistentFix"

    def test_pending_experience_to_publish_payload(self):
        """Test converting experience to publish payload."""
        from aep_sdk.archive.models import PendingExperience

        exp = PendingExperience(
            id="exp_test123",
            trigger="TypeError",
            solution="Add null check",
            confidence=0.85,
            source_action_id="action_123",
            source_session_id="session_456",
            feedback_score=4.5,
            created_at="2026-02-26T10:00:00Z",
            status=PendingStatus.APPROVED,
        )

        payload = exp.to_publish_payload()

        assert payload["trigger"] == "TypeError"
        assert payload["solution"] == "Add null check"
        assert payload["confidence"] == 0.85
        assert payload["context"]["source_session"] == "session_456"
        assert payload["context"]["source_action"] == "action_123"
        assert payload["context"]["feedback_score"] == 4.5