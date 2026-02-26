"""
MemoryArchiver - Session compression and archival for AEP Protocol.

Provides functionality to compress sessions into summaries and archive old sessions.
"""

from __future__ import annotations

import gzip
import json
import logging
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    ActionOutcome,
    KeyAction,
    SessionSummary,
    CreateSessionSummaryOptions,
    ARCHIVE_VERSION,
)
from ..session.models import Session, AgentAction, ActionResult, FeedbackRating
from ..session.storage import StorageManager

logger = logging.getLogger(__name__)


@dataclass
class CleanupResult:
    """Result of a cleanup operation."""
    deleted_count: int
    freed_bytes: int


@dataclass
class SummaryInfo:
    """Summary information for listing."""
    session_id: str
    path: str
    created_at: str
    size: int


@dataclass
class StorageStats:
    """Storage statistics."""
    sessions_size: int
    memory_size: int
    pending_size: int
    archive_count: int
    summary_count: int


class MemoryArchiver:
    """
    Memory Archiver - Manages session compression and archival.

    This class provides functionality to:
    - Compress sessions into summaries
    - Archive old sessions (with optional gzip compression)
    - Generate Markdown summaries
    - Clean up old archives

    Usage:
        archiver = MemoryArchiver(workspace="/path/to/project")
        summary = archiver.compress_session(session)
        archive_path = archiver.archive_session("session_123", compress=True)

    Attributes:
        workspace: Path to the workspace directory
        retention_days: Number of days to retain archives (default: 30)
    """

    DEFAULT_RETENTION_DAYS = 30

    def __init__(
        self,
        workspace: str | Path,
        retention_days: int | None = None
    ):
        """
        Initialize the MemoryArchiver.

        Args:
            workspace: Path to the workspace directory
            retention_days: Number of days to retain archives (default: 30)
        """
        self.workspace = Path(workspace)
        self.aep_dir = self.workspace / ".aep"
        self.sessions_dir = self.aep_dir / "sessions"
        self.memory_dir = self.aep_dir / "memory"
        self.archive_dir = self.aep_dir / "sessions" / "archive"
        self.pending_dir = self.aep_dir / "pending"
        self.retention_days = retention_days or self.DEFAULT_RETENTION_DAYS
        self._storage = StorageManager(self.workspace)

    def compress_session(
        self,
        session: Session,
        title: str | None = None
    ) -> SessionSummary:
        """
        Compress a session into a summary.

        Args:
            session: The session to compress
            title: Optional title for the summary

        Returns:
            The generated session summary
        """
        # Calculate session duration - handle both aware and naive datetimes
        started_at_str = session.started_at.replace("Z", "+00:00")
        started_at = datetime.fromisoformat(started_at_str)

        if session.ended_at:
            ended_at_str = session.ended_at.replace("Z", "+00:00")
            ended_at = datetime.fromisoformat(ended_at_str)
        else:
            ended_at = datetime.now(timezone.utc)

        # Make both timezone-naive for comparison
        if started_at.tzinfo is not None:
            started_at = started_at.replace(tzinfo=None)
        if ended_at.tzinfo is not None:
            ended_at = ended_at.replace(tzinfo=None)

        duration_seconds = int((ended_at - started_at).total_seconds())

        # Extract key actions
        key_actions = self._extract_key_actions(session.actions)

        # Determine overall outcome
        outcome = self._determine_outcome(session.actions)

        # Extract signals
        signals = self._extract_signals(session.actions)

        # Generate title if not provided
        summary_title = title or self._generate_title(session, key_actions)

        # Calculate average feedback score
        feedback_score = self._calculate_feedback_score(session.actions)

        options = CreateSessionSummaryOptions(
            session_id=session.id,
            agent_id=session.agent_id,
            title=summary_title,
            problem=self._infer_problem(session, key_actions),
            solution=self._infer_solution(session, key_actions),
            outcome=outcome,
            key_actions=key_actions,
            signals=signals,
            action_count=len(session.actions),
            duration_seconds=duration_seconds,
            feedback_score=feedback_score,
        )

        return options.to_summary()

    def archive_session(
        self,
        session_id: str,
        compress: bool = True,
        delete_original: bool = True,
        summary: SessionSummary | None = None
    ) -> str | None:
        """
        Archive a session file.

        Args:
            session_id: The session ID to archive
            compress: Whether to compress the archive with gzip (default: True)
            delete_original: Whether to delete the original session file (default: True)
            summary: Optional pre-generated summary to use

        Returns:
            Path to the archived file, or None if session not found
        """
        # Ensure archive directory exists
        self.archive_dir.mkdir(parents=True, exist_ok=True)

        # Get source session file
        source_path = self._storage.get_session_file(session_id)
        if not source_path.exists():
            return None

        # Load and compress session if summary not provided
        session_summary = summary
        if session_summary is None:
            session = self._load_session(session_id)
            if session:
                session_summary = self.compress_session(session)

        # Save summary to memory directory
        if session_summary:
            self._save_summary(session_summary)

        # Determine archive path
        archive_extension = ".jsonl.gz" if compress else ".jsonl"
        archive_path = self.archive_dir / f"{session_id}{archive_extension}"

        if compress:
            # Read and compress the file
            with open(source_path, "rb") as f_in:
                with gzip.open(archive_path, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)
        else:
            # Just copy the file
            shutil.copy2(source_path, archive_path)

        # Delete original if requested
        if delete_original:
            source_path.unlink()

        logger.info(f"Archived session {session_id} to {archive_path}")
        return str(archive_path)

    def generate_markdown(self, summary: SessionSummary) -> str:
        """
        Generate Markdown format summary.

        Args:
            summary: The session summary to format

        Returns:
            Markdown formatted string
        """
        lines = [
            f"# {summary.title}",
            "",
            f"**Session ID:** {summary.session_id}",
            f"**Agent:** {summary.agent_id}",
            f"**Created:** {summary.created_at}",
            f"**Outcome:** {summary.outcome.value}",
            f"**Duration:** {self._format_duration(summary.duration_seconds)}",
            f"**Actions:** {summary.action_count}",
            "",
            "## Problem",
            "",
            summary.problem,
            "",
            "## Solution",
            "",
            summary.solution,
            "",
            "## Key Actions",
            "",
        ]

        # Add key actions table
        if summary.key_actions:
            lines.append("| Trigger | Solution | Result |")
            lines.append("|---------|----------|--------|")
            for action in summary.key_actions:
                lines.append(f"| {action.trigger} | {action.solution} | {action.result} |")
        else:
            lines.append("_No key actions recorded._")

        lines.append("")
        lines.append("## Signals")
        lines.append("")

        if summary.signals:
            for signal in summary.signals:
                lines.append(f"- {signal}")
        else:
            lines.append("_No signals extracted._")

        if summary.feedback_score is not None:
            lines.append("")
            lines.append(f"## Feedback Score: {summary.feedback_score}/5")

        lines.append("")
        lines.append("---")
        lines.append(f"_Archive Version: {ARCHIVE_VERSION}_")

        return "\n".join(lines)

    def list_archives(self, limit: int = 10) -> List[str]:
        """
        List archive files.

        Args:
            limit: Maximum number of archives to return

        Returns:
            List of archive file paths
        """
        if not self.archive_dir.exists():
            return []

        archives: List[str] = []
        files = []

        for f in self.archive_dir.iterdir():
            if f.name.endswith(".jsonl") or f.name.endswith(".jsonl.gz"):
                files.append((f, f.stat().st_mtime))

        # Sort by modification time (newest first)
        files.sort(key=lambda x: x[1], reverse=True)

        for f, _ in files[:limit]:
            archives.append(str(f))

        return archives

    def list_summaries(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 10
    ) -> List[SummaryInfo]:
        """
        List summary files.

        Args:
            start_date: Start date filter (YYYY-MM-DD)
            end_date: End date filter (YYYY-MM-DD)
            limit: Maximum number of summaries to return

        Returns:
            List of summary information
        """
        if not self.memory_dir.exists():
            return []

        summaries: List[SummaryInfo] = []
        files = []

        for f in self.memory_dir.iterdir():
            if f.name.endswith("_summary.md"):
                files.append((f, f.stat().st_mtime, f.stat().st_size))

        # Sort by modification time (newest first)
        files.sort(key=lambda x: x[1], reverse=True)

        for f, mtime, size in files[:limit]:
            session_id = f.name.replace("_summary.md", "")
            summaries.append(SummaryInfo(
                session_id=session_id,
                path=str(f),
                created_at=datetime.fromtimestamp(mtime).isoformat(),
                size=size,
            ))

        return summaries

    def get_summary(self, session_id: str) -> str | None:
        """
        Get a summary by session ID.

        Args:
            session_id: The session ID

        Returns:
            The summary content, or None if not found
        """
        summary_path = self.memory_dir / f"{session_id}_summary.md"
        if not summary_path.exists():
            return None

        with open(summary_path, "r", encoding="utf-8") as f:
            return f.read()

    def cleanup_old_archives(self, days: int | None = None) -> CleanupResult:
        """
        Clean up old archives.

        Args:
            days: Number of days to retain (default: instance default)

        Returns:
            CleanupResult with statistics
        """
        retention_days = days or self.retention_days
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

        deleted_count = 0
        freed_bytes = 0

        if not self.archive_dir.exists():
            return CleanupResult(deleted_count=0, freed_bytes=0)

        for archive_file in self.archive_dir.iterdir():
            if not (archive_file.name.endswith(".jsonl") or archive_file.name.endswith(".jsonl.gz")):
                continue

            file_mtime = datetime.fromtimestamp(archive_file.stat().st_mtime, tz=timezone.utc)

            if file_mtime < cutoff:
                file_size = archive_file.stat().st_size
                logger.info(f"Deleting old archive: {archive_file}")
                archive_file.unlink()
                deleted_count += 1
                freed_bytes += file_size

        logger.info(
            f"Cleanup complete: {deleted_count} files, "
            f"{freed_bytes / 1024 / 1024:.2f} MB freed"
        )

        return CleanupResult(
            deleted_count=deleted_count,
            freed_bytes=freed_bytes
        )

    def get_storage_stats(self) -> StorageStats:
        """
        Get storage statistics.

        Returns:
            StorageStats with directory sizes and file counts
        """
        return StorageStats(
            sessions_size=self._get_directory_size(self.sessions_dir),
            memory_size=self._get_directory_size(self.memory_dir),
            pending_size=self._get_directory_size(self.pending_dir),
            archive_count=self._count_files(self.archive_dir, "*.gz") + self._count_files(self.archive_dir, "*.jsonl"),
            summary_count=self._count_files(self.memory_dir, "*_summary.md"),
        )

    def _load_session(self, session_id: str) -> Session | None:
        """Load a session from file."""
        session_path = self._storage.get_session_file(session_id)
        if not session_path.exists():
            return None

        with open(session_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        if not lines:
            return None

        try:
            header = json.loads(lines[0])
            if header.get("_type") != "session_header":
                return None

            session_data = header.get("session", {})
            return Session.from_dict(session_data)
        except (json.JSONDecodeError, KeyError):
            return None

    def _save_summary(self, summary: SessionSummary) -> None:
        """Save a summary to the memory directory."""
        self.memory_dir.mkdir(parents=True, exist_ok=True)

        # Save Markdown
        summary_path = self.memory_dir / f"{summary.session_id}_summary.md"
        markdown = self.generate_markdown(summary)
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(markdown)

        # Save JSON
        json_path = self.memory_dir / f"{summary.session_id}_summary.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(summary.to_dict(), f, indent=2, ensure_ascii=False)

    def _extract_key_actions(self, actions: List[AgentAction]) -> List[KeyAction]:
        """Extract key actions from a session."""
        if not actions:
            return []

        # Score each action by significance
        scored_actions = [(action, self._score_action_significance(action)) for action in actions]

        # Sort by score descending
        scored_actions.sort(key=lambda x: x[1], reverse=True)

        # Take top actions (max 10)
        top_actions = scored_actions[:10]

        return [
            KeyAction(
                trigger=action.trigger,
                solution=action.solution,
                result=action.result.value,
            )
            for action, _ in top_actions
        ]

    def _score_action_significance(self, action: AgentAction) -> float:
        """Score an action's significance for summary purposes."""
        score = 0.0

        # Failure actions are more significant
        if action.result == ActionResult.FAILURE:
            score += 3
        elif action.result == ActionResult.PARTIAL:
            score += 2

        # Actions with feedback are significant
        if action.feedback:
            if action.feedback.rating == FeedbackRating.NEGATIVE:
                score += 3
            elif action.feedback.rating == FeedbackRating.POSITIVE:
                score += 1

        # Longer solutions suggest more complex actions
        score += min(len(action.solution) / 100, 2)

        return score

    def _determine_outcome(self, actions: List[AgentAction]) -> ActionOutcome:
        """Determine overall session outcome from actions."""
        if not actions:
            return ActionOutcome.SUCCESS

        failures = sum(1 for a in actions if a.result == ActionResult.FAILURE)
        successes = sum(1 for a in actions if a.result == ActionResult.SUCCESS)

        # If more than half failed, it's a failure
        if failures > len(actions) / 2:
            return ActionOutcome.FAILURE

        # If any failures but less than half, it's partial
        if failures > 0:
            return ActionOutcome.PARTIAL

        # If all successes
        if successes == len(actions):
            return ActionOutcome.SUCCESS

        return ActionOutcome.PARTIAL

    def _extract_signals(self, actions: List[AgentAction]) -> List[str]:
        """Extract signals from actions."""
        signals: set[str] = set()

        for action in actions:
            # Extract from context
            if action.context:
                if "signals" in action.context:
                    for signal in action.context["signals"]:
                        signals.add(str(signal))
                if "error_type" in action.context:
                    signals.add(f"error:{action.context['error_type']}")
                if "tool_name" in action.context:
                    signals.add(f"tool:{action.context['tool_name']}")

            # Extract trigger patterns
            trigger_lower = action.trigger.lower()
            if "error" in trigger_lower:
                signals.add("error")
            if "fix" in trigger_lower or "resolve" in trigger_lower:
                signals.add("fix")

        return list(signals)[:20]  # Limit to 20 signals

    def _generate_title(self, session: Session, key_actions: List[KeyAction]) -> str:
        """Generate a title for the session."""
        if session.summary:
            return session.summary[:100]

        if key_actions:
            return key_actions[0].trigger[:100]

        return f"Session {session.id}"

    def _infer_problem(self, session: Session, key_actions: List[KeyAction]) -> str:
        """Infer the problem from session and actions."""
        if session.summary:
            return session.summary

        if key_actions:
            return key_actions[0].trigger

        return "Unknown problem"

    def _infer_solution(self, session: Session, key_actions: List[KeyAction]) -> str:
        """Infer the solution from actions."""
        if key_actions:
            # Combine solutions from successful actions
            successful_solutions = [
                a.solution for a in key_actions
                if a.result == "success"
            ][:3]
            return "; ".join(successful_solutions) or key_actions[0].solution

        return session.summary or "No solution recorded"

    def _calculate_feedback_score(self, actions: List[AgentAction]) -> float | None:
        """Calculate average feedback score."""
        ratings: List[int] = []

        for action in actions:
            if action.feedback:
                if action.feedback.rating == FeedbackRating.POSITIVE:
                    ratings.append(5)
                elif action.feedback.rating == FeedbackRating.NEUTRAL:
                    ratings.append(3)
                elif action.feedback.rating == FeedbackRating.NEGATIVE:
                    ratings.append(1)

        if not ratings:
            return None

        avg = sum(ratings) / len(ratings)
        return round(avg * 10) / 10

    def _format_duration(self, seconds: int) -> str:
        """Format duration in human-readable format."""
        if seconds < 60:
            return f"{seconds}s"
        if seconds < 3600:
            minutes = seconds // 60
            secs = seconds % 60
            return f"{minutes}m {secs}s"
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours}h {minutes}m"

    def _get_directory_size(self, path: Path) -> int:
        """Get the total size of a directory."""
        if not path.exists():
            return 0

        total_size = 0
        for item in path.rglob("*"):
            if item.is_file():
                total_size += item.stat().st_size
        return total_size

    def _count_files(self, path: Path, pattern: str) -> int:
        """Count files matching a pattern."""
        if not path.exists():
            return 0
        return len(list(path.glob(pattern)))