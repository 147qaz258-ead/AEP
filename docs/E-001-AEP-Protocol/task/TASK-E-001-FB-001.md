# TASK-E-001-FB-001: Feedback Processing

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-004
> **Status:** pending
> **Beads 任务ID:** agent network-gr3
> **依赖:** []

## 摘要

Implement the Feedback Processing service that receives feedback submissions, validates input, stores feedback records, and triggers GDI recalculation. Handles deduplication and reward calculation.

## 验收标准

- [ ] AC-FB-001: Validates experience_id exists
- [ ] AC-FB-002: Validates outcome is one of: success, failure, partial
- [ ] AC-FB-003: Validates score range [0.0, 1.0]
- [ ] AC-FB-004: Detects duplicate feedback (same agent, same experience)
- [ ] AC-FB-005: Stores feedback record with timestamp
- [ ] AC-FB-006: Updates experience statistics (total_uses, total_success, success_streak)
- [ ] AC-FB-007: Triggers GDI recalculation
- [ ] AC-FB-008: Calculates reward points for feedback submitter

## 接口定义

### Feedback Schema

```typescript
interface FeedbackRequest {
  experience_id: string;
  outcome: "success" | "failure" | "partial";
  score?: number;  // 0.0 - 1.0
  notes?: string;
}

interface FeedbackRecord {
  id: string;
  experience_id: string;
  agent_id: string;
  outcome: "success" | "failure" | "partial";
  score?: number;
  notes?: string;
  created_at: string;
}

interface FeedbackResult {
  feedback_id: string;
  reward_earned: number;
  updated_stats: ExperienceStats;
  previous_status: string;
  new_status: string;
}
```

### Feedback Service Interface

```python
class FeedbackService:
    """Process feedback submissions."""

    def submit_feedback(self, agent_id: str, request: FeedbackRequest) -> FeedbackResult:
        """Submit feedback and update experience statistics."""

    def validate_feedback(self, request: FeedbackRequest) -> List[str]:
        """Validate feedback request."""

    def check_duplicate(self, agent_id: str, experience_id: str) -> bool:
        """Check for duplicate feedback."""

    def update_experience_stats(self, experience_id: str, feedback: FeedbackRequest) -> ExperienceStats:
        """Update experience usage statistics."""

    def calculate_reward(self, feedback: FeedbackRequest, experience: Experience, is_first: bool) -> int:
        """Calculate reward points for feedback."""
```

## 实现笔记

### Feedback Processing (Pseudocode)

```python
class FeedbackService:
    def submit_feedback(self, agent_id: str, request: FeedbackRequest) -> FeedbackResult:
        """Submit feedback and update experience statistics."""

        # 1. Validate feedback
        errors = self.validate_feedback(request)
        if errors:
            raise ValidationError(errors)

        # 2. Check for duplicate
        if self.check_duplicate(agent_id, request.experience_id):
            raise ConflictError("Feedback already submitted for this experience")

        # 3. Verify experience exists
        experience = db.query(
            "SELECT * FROM experiences WHERE id = ?",
            request.experience_id
        ).first()

        if not experience:
            raise NotFoundError(f"Experience '{request.experience_id}' not found")

        # 4. Store feedback record
        feedback_id = str(uuid.uuid4())
        is_first_feedback = experience.total_uses == 0

        db.insert("feedback", {
            "id": feedback_id,
            "experience_id": request.experience_id,
            "agent_id": agent_id,
            "outcome": request.outcome,
            "score": request.score,
            "notes": request.notes,
            "created_at": datetime.now()
        })

        # 5. Update experience statistics
        previous_status = experience.status
        updated_stats = self.update_experience_stats(request.experience_id, request)

        # 6. Recalculate GDI
        new_gdi = self.gdi_calculator.compute_gdi(experience)
        db.update("experiences", request.experience_id, {
            "gdi_score": new_gdi.score,
            "last_gdi_update": datetime.now()
        })

        # 7. Check for status change (promotion/deprecation)
        new_status = self._check_status_change(experience, updated_stats, new_gdi.score)
        if new_status != previous_status:
            db.update("experiences", request.experience_id, {
                "status": new_status,
                "promoted_at" if new_status == "promoted" else "deprecated_at": datetime.now()
            })

        # 8. Calculate reward
        reward = self.calculate_reward(request, experience, is_first_feedback)

        return FeedbackResult(
            feedback_id=feedback_id,
            reward_earned=reward,
            updated_stats=updated_stats,
            previous_status=previous_status,
            new_status=new_status
        )

    def validate_feedback(self, request: FeedbackRequest) -> List[str]:
        """Validate feedback request."""
        errors = []

        # Validate experience_id
        if not request.experience_id:
            errors.append("experience_id is required")

        # Validate outcome
        valid_outcomes = {"success", "failure", "partial"}
        if request.outcome not in valid_outcomes:
            errors.append(f"outcome must be one of: {', '.join(valid_outcomes)}")

        # Validate score
        if request.score is not None:
            if request.score < 0.0 or request.score > 1.0:
                errors.append("score must be between 0.0 and 1.0")

        return errors

    def check_duplicate(self, agent_id: str, experience_id: str) -> bool:
        """Check for duplicate feedback."""
        existing = db.query(
            "SELECT 1 FROM feedback WHERE agent_id = ? AND experience_id = ?",
            agent_id, experience_id
        ).first()
        return existing is not None

    def update_experience_stats(self, experience_id: str, feedback: FeedbackRequest) -> ExperienceStats:
        """Update experience usage statistics."""
        # Get current stats
        exp = db.query("SELECT * FROM experiences WHERE id = ?", experience_id).first()

        # Update counters
        total_uses = exp.total_uses + 1
        total_success = exp.total_success
        success_streak = exp.success_streak
        consecutive_failures = exp.consecutive_failures

        if feedback.outcome == "success":
            total_success += 1
            success_streak += 1
            consecutive_failures = 0
        elif feedback.outcome == "failure":
            consecutive_failures += 1
            success_streak = 0
        # partial: no change to streak

        # Update last_used_at
        db.update("experiences", experience_id, {
            "total_uses": total_uses,
            "total_success": total_success,
            "success_streak": success_streak,
            "consecutive_failures": consecutive_failures,
            "last_used_at": datetime.now()
        })

        return ExperienceStats(
            total_uses=total_uses,
            total_success=total_success,
            success_streak=success_streak,
            consecutive_failures=consecutive_failures
        )

    def calculate_reward(self, feedback: FeedbackRequest, experience: Experience, is_first: bool) -> int:
        """Calculate reward points for feedback."""
        base_reward = 10

        # Multipliers
        bonuses = []

        # First feedback bonus
        if is_first:
            bonuses.append(5)

        # Success outcome multiplier
        if feedback.outcome == "success":
            bonuses.append(int(base_reward * 0.5))

        # Promoted experience bonus
        if experience.status == "promoted":
            bonuses.append(3)

        # Detailed notes bonus
        if feedback.notes and len(feedback.notes) > 50:
            bonuses.append(2)

        total_reward = base_reward + sum(bonuses)
        return min(total_reward, 25)  # Cap at 25 points

    def _check_status_change(self, experience: Experience, stats: ExperienceStats, gdi_score: float) -> str:
        """Check if experience should be promoted or deprecated."""
        current_status = experience.status

        # Promotion criteria
        if current_status == "candidate":
            if (stats.success_streak >= 2 and
                gdi_score >= 0.65 and
                stats.total_uses >= 3):
                return "promoted"

        # Deprecation criteria
        if current_status in ["candidate", "promoted"]:
            if stats.consecutive_failures >= 3:
                return "deprecated"
            if stats.total_uses >= 10 and gdi_score < 0.30:
                return "deprecated"

        return current_status
```

## 技术约束

- **Idempotency**: Duplicate feedback rejected
- **Atomicity**: Stats update and GDI recalc in transaction
- **Performance**: Feedback processing < 50ms

## 验证方式

1. **Unit Tests**: Validation, reward calculation
2. **Integration Tests**: End-to-end feedback flow
3. **Duplicate Tests**: Verify duplicate detection
4. **Stats Tests**: Verify correct counter updates

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §2.3 Table: feedback
- **STORY**: `../../_project/stories/STORY-004-feedback-loop.md`
