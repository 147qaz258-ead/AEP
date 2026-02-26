"""
Unit tests for MemoryArchiver.

Tests for session compression and archival functionality.
"""

import gzip
import json
import os
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from aep_sdk.archive.archiver import (
    MemoryArchiver,
    CleanupResult,
    SummaryInfo,
    StorageStats,
)
from aep_sdk.archive.models import (
    ActionOutcome,
    KeyAction,
    SessionSummary,
)
from aep_sdk.session.models import (
    Session,
    AgentAction,
    ActionType,
    ActionResult,
    FeedbackInfo,
    FeedbackRating,
)
from aep_sdk.session.storage import StorageManager


class TestMemoryArchiver:
    """Tests for MemoryArchiver class."""

    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    @pytest.fixture
    def archiver(self, temp_workspace):
        """Create a MemoryArchiver instance."""
        return MemoryArchiver(str(temp_workspace))

    @pytest.fixture
    def sample_session(self, temp_workspace):
        """Create a sample session with actions."""
        storage = StorageManager(temp_workspace)
        session_path = storage.get_session_file("test_session_001")

        # Create session header
        header = {
            "_type": "session_header",
            "session": {
                "id": "test_session_001",
                "agent_id": "agent_001",
                "started_at": "2024-01-15T10:00:00Z",
                "ended_at": "2024-01-15T10:30:00Z",
                "actions": [],
            }
        }

        # Create some actions
        actions = [
            {
                "_type": "action",
                "action": {
                    "id": "action_001",
                    "timestamp": "2024-01-15T10:05:00Z",
                    "action_type": "tool_call",
                    "trigger": "User requested file read",
                    "solution": "Read file using filesystem API",
                    "result": "success",
                    "context": {"file": "test.py"},
                }
            },
            {
                "_type": "action",
                "action": {
                    "id": "action_002",
                    "timestamp": "2024-01-15T10:10:00Z",
                    "action_type": "tool_call",
                    "trigger": "Syntax error in code",
                    "solution": "Fixed syntax error in test.py",
                    "result": "success",
                    "context": {"signals": ["error:syntax"]},
                }
            },
            {
                "_type": "action",
                "action": {
                    "id": "action_003",
                    "timestamp": "2024-01-15T10:15:00Z",
                    "action_type": "message",
                    "trigger": "Explained the fix to user",
                    "solution": "Provided explanation",
                    "result": "success",
                    "context": {},
                }
            },
        ]

        # Write session file
        with open(session_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(header) + "\n")
            for action in actions:
                f.write(json.dumps(action) + "\n")

        return session_path

    def test_init(self, temp_workspace):
        """Test MemoryArchiver initialization."""
        archiver = MemoryArchiver(str(temp_workspace))

        assert archiver.workspace == temp_workspace
        assert archiver.retention_days == 30

        # Test with custom retention
        archiver_custom = MemoryArchiver(str(temp_workspace), retention_days=60)
        assert archiver_custom.retention_days == 60

    def test_compress_session(self, archiver):
        """Test session compression."""
        # Create a sample session
        actions = [
            AgentAction(
                id="action_001",
                timestamp="2024-01-15T10:05:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="User requested file read",
                solution="Read file using filesystem API",
                result=ActionResult.SUCCESS,
                context={"file": "test.py"},
            ),
            AgentAction(
                id="action_002",
                timestamp="2024-01-15T10:10:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Syntax error in code",
                solution="Fixed syntax error in test.py",
                result=ActionResult.SUCCESS,
                context={"signals": ["error:syntax"]},
            ),
        ]

        session = Session(
            id="test_session_002",
            agent_id="agent_001",
            started_at="2024-01-15T10:00:00Z",
            ended_at="2024-01-15T10:30:00Z",
            actions=actions,
            summary="Test session for compression",
        )

        # Compress the session
        summary = archiver.compress_session(session, title="Test Session")

        assert summary.session_id == "test_session_002"
        assert summary.agent_id == "agent_001"
        assert summary.title == "Test Session"
        assert summary.problem != ""
        assert summary.solution != ""
        assert summary.outcome == ActionOutcome.SUCCESS
        assert summary.action_count == 2
        assert summary.duration_seconds == 1800  # 30 minutes

    def test_compress_session_with_failures(self, archiver):
        """Test session compression with mixed outcomes."""
        actions = [
            AgentAction(
                id="action_001",
                timestamp="2024-01-15T10:05:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Task 1",
                solution="Solution 1",
                result=ActionResult.SUCCESS,
                context={},
            ),
            AgentAction(
                id="action_002",
                timestamp="2024-01-15T10:10:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Task 2",
                solution="Solution 2",
                result=ActionResult.FAILURE,
                context={},
            ),
        ]

        session = Session(
            id="test_session_003",
            agent_id="agent_001",
            started_at="2024-01-15T10:00:00Z",
            ended_at="2024-01-15T10:30:00Z",
            actions=actions,
        )

        summary = archiver.compress_session(session)

        # With one failure out of two actions, should be partial
        assert summary.outcome == ActionOutcome.PARTIAL

    def test_compress_session_with_feedback(self, archiver):
        """Test session compression with feedback scores."""
        actions = [
            AgentAction(
                id="action_001",
                timestamp="2024-01-15T10:05:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Task 1",
                solution="Solution 1",
                result=ActionResult.SUCCESS,
                context={},
                feedback=FeedbackInfo(
                    id="feedback_001",
                    rating=FeedbackRating.POSITIVE,
                    timestamp="2024-01-15T10:06:00Z",
                ),
            ),
            AgentAction(
                id="action_002",
                timestamp="2024-01-15T10:10:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Task 2",
                solution="Solution 2",
                result=ActionResult.SUCCESS,
                context={},
                feedback=FeedbackInfo(
                    id="feedback_002",
                    rating=FeedbackRating.POSITIVE,
                    timestamp="2024-01-15T10:11:00Z",
                ),
            ),
        ]

        session = Session(
            id="test_session_004",
            agent_id="agent_001",
            started_at="2024-01-15T10:00:00Z",
            ended_at="2024-01-15T10:30:00Z",
            actions=actions,
        )

        summary = archiver.compress_session(session)

        assert summary.feedback_score == 5.0  # Both positive

    def test_generate_markdown(self, archiver):
        """Test Markdown generation."""
        summary = SessionSummary(
            id="summary_001",
            session_id="test_session_005",
            agent_id="agent_001",
            created_at="2024-01-15T10:30:00Z",
            title="Test Session Summary",
            problem="User needed to fix a syntax error",
            solution="Fixed the syntax error and explained the solution",
            outcome=ActionOutcome.SUCCESS,
            key_actions=[
                KeyAction(
                    trigger="Syntax error found",
                    solution="Applied fix",
                    result="success",
                ),
            ],
            signals=["error:syntax", "fix"],
            action_count=3,
            duration_seconds=1800,
            feedback_score=4.5,
        )

        markdown = archiver.generate_markdown(summary)

        assert "# Test Session Summary" in markdown
        assert "**Session ID:** test_session_005" in markdown
        assert "**Outcome:** success" in markdown
        assert "## Problem" in markdown
        assert "## Solution" in markdown
        assert "## Key Actions" in markdown
        assert "## Signals" in markdown
        assert "error:syntax" in markdown
        assert "## Feedback Score: 4.5/5" in markdown
        assert "Archive Version: 1.0.0" in markdown

    def test_archive_session(self, archiver, sample_session, temp_workspace):
        """Test session archival."""
        archive_path = archiver.archive_session("test_session_001")

        assert archive_path is not None
        assert Path(archive_path).exists()
        assert archive_path.endswith(".jsonl.gz")

        # Check that summary was created
        summary_path = temp_workspace / ".aep" / "memory" / "test_session_001_summary.md"
        assert summary_path.exists()

        # Check that original was deleted
        original_path = temp_workspace / ".aep" / "sessions" / "test_session_001.jsonl"
        assert not original_path.exists()

    def test_archive_session_without_compress(self, archiver, sample_session, temp_workspace):
        """Test session archival without compression."""
        archive_path = archiver.archive_session("test_session_001", compress=False)

        assert archive_path is not None
        assert Path(archive_path).exists()
        assert archive_path.endswith(".jsonl")  # Not compressed

    def test_archive_nonexistent_session(self, archiver):
        """Test archiving a nonexistent session."""
        archive_path = archiver.archive_session("nonexistent_session")
        assert archive_path is None

    def test_list_archives(self, archiver, sample_session):
        """Test listing archives."""
        # Archive a session
        archiver.archive_session("test_session_001")

        archives = archiver.list_archives()

        assert len(archives) == 1
        assert "test_session_001" in archives[0]

    def test_list_summaries(self, archiver, sample_session):
        """Test listing summaries."""
        # Archive a session (creates summary)
        archiver.archive_session("test_session_001")

        summaries = archiver.list_summaries()

        assert len(summaries) == 1
        assert summaries[0].session_id == "test_session_001"

    def test_get_summary(self, archiver, sample_session):
        """Test getting a summary."""
        # Archive a session (creates summary)
        archiver.archive_session("test_session_001")

        summary = archiver.get_summary("test_session_001")

        assert summary is not None
        assert "# " in summary  # Has a title

    def test_get_nonexistent_summary(self, archiver):
        """Test getting a nonexistent summary."""
        summary = archiver.get_summary("nonexistent_session")
        assert summary is None

    def test_cleanup_old_archives(self, archiver, sample_session, temp_workspace):
        """Test cleanup of old archives."""
        # Archive a session
        archive_path = archiver.archive_session("test_session_001")
        assert archive_path is not None

        # Modify mtime to be 31 days ago
        archive_file = Path(archive_path)
        old_time = time.time() - (31 * 24 * 3600)
        os.utime(archive_file, (old_time, old_time))

        # Run cleanup
        result = archiver.cleanup_old_archives(days=30)

        assert result.deleted_count == 1
        assert not archive_file.exists()

    def test_cleanup_keeps_recent_archives(self, archiver, sample_session):
        """Test that cleanup keeps recent archives."""
        # Archive a session
        archive_path = archiver.archive_session("test_session_001")
        assert archive_path is not None

        # Run cleanup with default retention
        result = archiver.cleanup_old_archives(days=30)

        assert result.deleted_count == 0
        assert Path(archive_path).exists()

    def test_get_storage_stats(self, archiver, sample_session):
        """Test getting storage statistics."""
        # Archive a session
        archiver.archive_session("test_session_001")

        stats = archiver.get_storage_stats()

        assert isinstance(stats, StorageStats)
        assert stats.archive_count == 1
        assert stats.summary_count == 1
        assert stats.memory_size > 0

    def test_list_archives_with_limit(self, archiver, temp_workspace):
        """Test listing archives with limit."""
        storage = StorageManager(temp_workspace)

        # Create multiple sessions
        for i in range(5):
            session_path = storage.get_session_file(f"session_{i:03d}")
            header = {
                "_type": "session_header",
                "session": {
                    "id": f"session_{i:03d}",
                    "agent_id": "agent_001",
                    "started_at": "2024-01-15T10:00:00Z",
                    "ended_at": "2024-01-15T10:30:00Z",
                    "actions": [],
                }
            }
            with open(session_path, "w", encoding="utf-8") as f:
                f.write(json.dumps(header) + "\n")

            # Small delay to ensure different timestamps
            time.sleep(0.01)

            archiver.archive_session(f"session_{i:03d}")

        archives = archiver.list_archives(limit=3)
        assert len(archives) == 3

    def test_extract_signals(self, archiver):
        """Test signal extraction."""
        actions = [
            AgentAction(
                id="action_001",
                timestamp="2024-01-15T10:05:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Fixed an error in the code",
                solution="Applied fix",
                result=ActionResult.SUCCESS,
                context={"error_type": "SyntaxError", "tool_name": "fix_tool"},
            ),
        ]

        session = Session(
            id="test_session",
            agent_id="agent_001",
            started_at="2024-01-15T10:00:00Z",
            actions=actions,
        )

        summary = archiver.compress_session(session)

        # Should contain signals from context and trigger
        assert "error:SyntaxError" in summary.signals
        assert "tool:fix_tool" in summary.signals
        assert "error" in summary.signals or "fix" in summary.signals

    def test_determine_outcome_majority_failure(self, archiver):
        """Test outcome determination with majority failures."""
        actions = [
            AgentAction(
                id="action_001",
                timestamp="2024-01-15T10:05:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Task 1",
                solution="Solution 1",
                result=ActionResult.FAILURE,
                context={},
            ),
            AgentAction(
                id="action_002",
                timestamp="2024-01-15T10:10:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Task 2",
                solution="Solution 2",
                result=ActionResult.FAILURE,
                context={},
            ),
            AgentAction(
                id="action_003",
                timestamp="2024-01-15T10:15:00Z",
                action_type=ActionType.TOOL_CALL,
                trigger="Task 3",
                solution="Solution 3",
                result=ActionResult.SUCCESS,
                context={},
            ),
        ]

        session = Session(
            id="test_session",
            agent_id="agent_001",
            started_at="2024-01-15T10:00:00Z",
            actions=actions,
        )

        summary = archiver.compress_session(session)
        assert summary.outcome == ActionOutcome.FAILURE


class TestCleanupResult:
    """Tests for CleanupResult dataclass."""

    def test_creation(self):
        """Test CleanupResult creation."""
        result = CleanupResult(deleted_count=5, freed_bytes=1024000)
        assert result.deleted_count == 5
        assert result.freed_bytes == 1024000


class TestSummaryInfo:
    """Tests for SummaryInfo dataclass."""

    def test_creation(self):
        """Test SummaryInfo creation."""
        info = SummaryInfo(
            session_id="test_session",
            path="/path/to/summary.md",
            created_at="2024-01-15T10:30:00Z",
            size=1024,
        )
        assert info.session_id == "test_session"
        assert info.path == "/path/to/summary.md"
        assert info.created_at == "2024-01-15T10:30:00Z"
        assert info.size == 1024


class TestStorageStats:
    """Tests for StorageStats dataclass."""

    def test_creation(self):
        """Test StorageStats creation."""
        stats = StorageStats(
            sessions_size=1024,
            memory_size=512,
            pending_size=256,
            archive_count=5,
            summary_count=3,
        )
        assert stats.sessions_size == 1024
        assert stats.memory_size == 512
        assert stats.pending_size == 256
        assert stats.archive_count == 5
        assert stats.summary_count == 3