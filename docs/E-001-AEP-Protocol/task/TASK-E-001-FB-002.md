# TASK-E-001-FB-002: GDI Update Logic

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-004, STORY-005
> **Status:** pending
> **Beads 任务ID:** agent network-9s7
> **依赖:** []

## 摘要

Implement the GDI Update Logic that recalculates GDI scores when feedback is received, updates dimension values (Quality, Usage, Social, Freshness), and triggers status transitions (promotion/deprecation).

## 验收标准

- [ ] AC-UPDATE-001: Recalculates GDI on every feedback submission
- [ ] AC-UPDATE-002: Updates Quality dimension based on success_rate and blast_safety
- [ ] AC-UPDATE-003: Updates Usage dimension based on total_uses
- [ ] AC-UPDATE-004: Updates Social dimension based on positive/total feedback ratio
- [ ] AC-UPDATE-005: Updates Freshness dimension based on age
- [ ] AC-UPDATE-006: Stores new GDI score with timestamp
- [ ] AC-UPDATE-007: Checks promotion criteria after GDI update
- [ ] AC-UPDATE-008: Checks deprecation criteria after GDI update
- [ ] AC-UPDATE-009: Updates experience status when criteria met

## 接口定义

### GDI Update Interface

```python
@dataclass
class GDIUpdateResult:
    previous_gdi: float;
    new_gdi: float;
    dimensions: GDIDimensions;
    status_changed: bool;
    new_status: Optional[str];

class GDIUpdateService:
    """Update GDI scores and trigger status transitions."""

    def update_on_feedback(self, experience_id: str, feedback: FeedbackRequest) -> GDIUpdateResult:
        """Update GDI after feedback submission."""

    def check_promotion_criteria(self, experience: Experience, new_gdi: float) -> bool:
        """Check if experience should be promoted."""

    def check_deprecation_criteria(self, experience: Experience, new_gdi: float) -> bool:
        """Check if experience should be deprecated."""

    def transition_status(self, experience_id: str, new_status: str) -> None:
        """Update experience status and record timestamp."""
```

## 实现笔记

### GDI Update Logic (Pseudocode)

```python
class GDIUpdateService:
    def update_on_feedback(self, experience_id: str, feedback: FeedbackRequest) -> GDIUpdateResult:
        """Update GDI after feedback submission."""

        # 1. Get current experience state
        experience = db.query(
            "SELECT * FROM experiences WHERE id = ?",
            experience_id
        ).first()

        if not experience:
            raise NotFoundError(f"Experience '{experience_id}' not found")

        previous_gdi = experience.gdi_score

        # 2. Recalculate GDI with updated stats
        new_gdi_result = self.gdi_calculator.compute_gdi(experience)
        new_gdi = new_gdi_result.score

        # 3. Update GDI in database
        db.update("experiences", experience_id, {
            "gdi_score": new_gdi,
            "last_gdi_update": datetime.now()
        })

        # 4. Check for status change
        new_status = None
        status_changed = False

        if experience.status == "candidate":
            if self.check_promotion_criteria(experience, new_gdi):
                new_status = "promoted"
                status_changed = True

        elif experience.status == "promoted":
            if self.check_deprecation_criteria(experience, new_gdi):
                new_status = "deprecated"
                status_changed = True

        # 5. Apply status change if needed
        if status_changed:
            self.transition_status(experience_id, new_status)

        return GDIUpdateResult(
            previous_gdi=previous_gdi,
            new_gdi=new_gdi,
            dimensions=new_gdi_result.dimensions,
            status_changed=status_changed,
            new_status=new_status
        )

    def check_promotion_criteria(self, experience: Experience, new_gdi: float) -> bool:
        """Check if experience should be promoted (candidate -> promoted)."""
        checks = {
            "success_streak": experience.success_streak >= 2,
            "confidence": experience.confidence >= 0.70,
            "gdi_score": new_gdi >= 0.65,
            "total_uses": experience.total_uses >= 3,
            "blast_radius_safe": self._is_blast_radius_safe(experience.blast_radius)
        }

        return all(checks.values())

    def check_deprecation_criteria(self, experience: Experience, new_gdi: float) -> bool:
        """Check if experience should be deprecated (promoted -> deprecated)."""

        # Rule 1: Consecutive failures
        if experience.consecutive_failures >= 3:
            return True

        # Rule 2: Sustained low GDI (after 10+ uses)
        if experience.total_uses >= 10 and new_gdi < 0.30:
            return True

        # Rule 3: Low success rate (after 5+ uses)
        if experience.total_uses >= 5:
            success_rate = experience.total_success / experience.total_uses
            if success_rate < 0.20:
                return True

        # Rule 4: No recent usage (90+ days)
        if experience.last_used_at:
            age_days = (datetime.now() - experience.last_used_at).days
            if age_days > 90:
                return True

        return False

    def _is_blast_radius_safe(self, blast_radius: Optional[dict]) -> bool:
        """Check if blast radius is within safe limits."""
        if not blast_radius:
            return True  # No blast radius = safe

        MAX_FILES = 5
        MAX_LINES = 200

        files = blast_radius.get("files", 0)
        lines = blast_radius.get("lines", 0)

        return files <= MAX_FILES and lines <= MAX_LINES

    def transition_status(self, experience_id: str, new_status: str) -> None:
        """Update experience status and record timestamp."""
        update_data = {
            "status": new_status,
            "updated_at": datetime.now()
        }

        if new_status == "promoted":
            update_data["promoted_at"] = datetime.now()
        elif new_status == "deprecated":
            update_data["deprecated_at"] = datetime.now()

        db.update("experiences", experience_id, update_data)
```

### Status Transition Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Experience Status Flow                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Publish                                                   │
│      │                                                      │
│      ▼                                                      │
│   ┌────────────┐                                           │
│   │ CANDIDATE  │ ──Promotion criteria──▶ PROMOTED           │
│   └────────────┘                                           │
│      │                                                     │
│      └─Deprecation criteria──▶ DEPRECATED                   │
│                                                             │
│   PROMOTED ──Deprecation criteria──▶ DEPRECATED             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Promotion Criteria:
  - success_streak >= 2
  - confidence >= 0.70
  - gdi_score >= 0.65
  - total_uses >= 3
  - blast_radius_safe (files <= 5, lines <= 200)

Deprecation Criteria:
  - consecutive_failures >= 3
  - OR (total_uses >= 10 AND gdi_score < 0.30)
  - OR (total_uses >= 5 AND success_rate < 0.20)
  - OR last_used_at > 90 days ago
```

## 技术约束

- **Atomicity**: GDI update and status change in single transaction
- **Performance**: GDI recalculation < 10ms
- **Audit Trail**: Track status change timestamps

## 验证方式

1. **Unit Tests**: Promotion/deprecation criteria checks
2. **Integration Tests**: End-to-end GDI update flow
3. **Status Tests**: Verify correct status transitions
4. **Edge Cases**: Edge cases (low usage, high failure rate)

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.2 GDI Calculator
- **STORY**: `../../_project/stories/STORY-004-feedback-loop.md`
- **STORY**: `../../_project/stories/STORY-005-gdi-scoring-system.md`
