"""
PendingQueueManager - Manages pending experiences for AEP Protocol

Provides functionality to manage experiences waiting to be published to Hub.
"""

from typing import List, Optional, Dict, Any
from pathlib import Path
import json
import uuid
from datetime import datetime, timezone

from ..archive.models import PendingExperience, PendingStatus


class PendingQueueManager:
    """
    Manages pending experiences waiting to be published to Hub.

    This class provides functionality to:
    - Add pending experiences
    - List/filter pending experiences
    - Approve/reject pending experiences
    - Get batch for publishing
    - Clean up completed experiences

    Example:
        >>> manager = PendingQueueManager('/path/to/workspace')
        >>> exp = manager.add_pending(
        ...     trigger='TypeError',
        ...     solution='Add null check',
        ...     confidence=0.85,
        ...     source_action_id='action_123',
        ...     source_session_id='session_456',
        ... )
    """

    def __init__(self, workspace: str):
        """
        Initialize the PendingQueueManager.

        Args:
            workspace: Path to the workspace directory
        """
        self.workspace = Path(workspace)
        self.pending_dir = self.workspace / ".aep" / "pending"
        self._ensure_directory(self.pending_dir)

    def _ensure_directory(self, dir_path: Path) -> None:
        """Ensure a directory exists."""
        dir_path.mkdir(parents=True, exist_ok=True)

    def add_pending(
        self,
        trigger: str,
        solution: str,
        confidence: float,
        source_action_id: str,
        source_session_id: str,
        feedback_score: Optional[float] = None
    ) -> PendingExperience:
        """
        Add a pending experience to the queue.

        Args:
            trigger: What triggered this experience
            solution: The solution or approach taken
            confidence: Confidence score (0-1)
            source_action_id: ID of the source action
            source_session_id: ID of the source session
            feedback_score: Optional feedback score

        Returns:
            The created PendingExperience
        """
        exp = PendingExperience(
            id=f"exp_{uuid.uuid4().hex[:12]}",
            trigger=trigger,
            solution=solution,
            confidence=confidence,
            source_action_id=source_action_id,
            source_session_id=source_session_id,
            feedback_score=feedback_score,
            created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            status=PendingStatus.PENDING,
        )

        self._save_experience(exp)
        return exp

    def list_pending(
        self,
        session_id: Optional[str] = None,
        status: Optional[PendingStatus] = None,
        limit: int = 50
    ) -> List[PendingExperience]:
        """
        List pending experiences with optional filtering.

        Args:
            session_id: Filter by session ID
            status: Filter by status
            limit: Maximum number of results

        Returns:
            List of PendingExperience
        """
        experiences = []

        if not self.pending_dir.exists():
            return experiences

        # Get all experience files sorted by modification time (newest first)
        exp_files = sorted(
            self.pending_dir.glob("exp_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )

        for exp_file in exp_files:
            exp = self._load_experience(exp_file)
            if exp is None:
                continue

            # Apply filters
            if session_id and exp.source_session_id != session_id:
                continue
            if status and exp.status != status:
                continue

            experiences.append(exp)

            if len(experiences) >= limit:
                break

        return experiences

    def get_pending(self, exp_id: str) -> Optional[PendingExperience]:
        """
        Get a specific pending experience by ID.

        Args:
            exp_id: The experience ID

        Returns:
            The PendingExperience, or None if not found
        """
        exp_file = self.pending_dir / f"{exp_id}.json"
        if not exp_file.exists():
            return None
        return self._load_experience(exp_file)

    def remove_pending(self, exp_id: str) -> bool:
        """
        Remove a pending experience from the queue.

        Args:
            exp_id: The experience ID

        Returns:
            True if removed, False if not found
        """
        exp_file = self.pending_dir / f"{exp_id}.json"
        if not exp_file.exists():
            return False
        exp_file.unlink()
        return True

    def approve_pending(self, exp_id: str) -> bool:
        """
        Approve a pending experience.

        Args:
            exp_id: The experience ID

        Returns:
            True if approved, False if not found
        """
        return self._update_status(exp_id, PendingStatus.APPROVED)

    def reject_pending(self, exp_id: str) -> bool:
        """
        Reject a pending experience.

        Args:
            exp_id: The experience ID

        Returns:
            True if rejected, False if not found
        """
        return self._update_status(exp_id, PendingStatus.REJECTED)

    def get_batch(
        self,
        batch_size: int = 10,
        status: PendingStatus = PendingStatus.APPROVED
    ) -> List[PendingExperience]:
        """
        Get a batch of experiences ready for publishing.

        Args:
            batch_size: Number of experiences to retrieve
            status: Filter by status (default: approved)

        Returns:
            List of PendingExperience ready for publishing
        """
        return self.list_pending(status=status, limit=batch_size)

    def clear_completed(self) -> int:
        """
        Clear completed experiences (approved or rejected).

        Returns:
            Number of experiences cleared
        """
        if not self.pending_dir.exists():
            return 0

        count = 0
        for exp_file in self.pending_dir.glob("exp_*.json"):
            exp = self._load_experience(exp_file)
            if exp and exp.status in (PendingStatus.APPROVED, PendingStatus.REJECTED):
                exp_file.unlink()
                count += 1

        return count

    def get_stats(self) -> Dict[str, int]:
        """
        Get statistics about the pending queue.

        Returns:
            Dictionary with pending, approved, rejected, and total counts
        """
        experiences = self.list_pending(limit=1000)
        return {
            "pending": sum(1 for e in experiences if e.status == PendingStatus.PENDING),
            "approved": sum(1 for e in experiences if e.status == PendingStatus.APPROVED),
            "rejected": sum(1 for e in experiences if e.status == PendingStatus.REJECTED),
            "total": len(experiences),
        }

    def _save_experience(self, exp: PendingExperience) -> None:
        """Save an experience to disk."""
        exp_file = self.pending_dir / f"{exp.id}.json"
        with open(exp_file, 'w', encoding='utf-8') as f:
            json.dump(exp.to_dict(), f, ensure_ascii=False, indent=2)

    def _load_experience(self, exp_file: Path) -> Optional[PendingExperience]:
        """Load an experience from disk."""
        try:
            with open(exp_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return PendingExperience.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            return None

    def _update_status(self, exp_id: str, status: PendingStatus) -> bool:
        """Update the status of an experience."""
        exp = self.get_pending(exp_id)
        if not exp:
            return False
        exp.status = status
        self._save_experience(exp)
        return True