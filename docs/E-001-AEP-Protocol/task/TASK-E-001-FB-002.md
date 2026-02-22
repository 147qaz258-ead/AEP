# TASK-E-001-FB-002: GDI Update Logic

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-004, STORY-005
> **Status:** DONE
> **Beads 任务ID:** agent network-9s7
> **依赖:** []

## 摘要

Implement the GDI Update Logic that recalculates GDI scores when feedback is received, updates dimension values (Quality, Usage, Social, Freshness), and triggers status transitions (promotion/deprecation).

## 验收标准

- [x] AC-UPDATE-001: Recalculates GDI on every feedback submission
- [x] AC-UPDATE-002: Updates Quality dimension based on success_rate and blast_safety
- [x] AC-UPDATE-003: Updates Usage dimension based on total_uses
- [x] AC-UPDATE-004: Updates Social dimension based on positive/total feedback ratio
- [x] AC-UPDATE-005: Updates Freshness dimension based on age
- [x] AC-UPDATE-006: Stores new GDI score with timestamp
- [x] AC-UPDATE-007: Checks promotion criteria after GDI update
- [x] AC-UPDATE-008: Checks deprecation criteria after GDI update
- [x] AC-UPDATE-009: Updates experience status when criteria met

## 实现记录

### 新增文件

1. **`aep-hub/src/services/gdiUpdateService.ts`** - GDI Update Service
   - `GDIUpdateService` class with methods:
     - `updateOnFeedback()` - Recalculates GDI and triggers status transitions
     - `checkPromotionCriteria()` - Checks if candidate should be promoted
     - `checkDeprecationCriteria()` - Checks if experience should be deprecated
     - `updateConfidence()` - Bayesian confidence update
   - Helper functions:
     - `isBlastRadiusSafe()` - Validates blast radius limits
     - `toGDIExperience()` - Converts ExperienceWithStats to GDI Experience
     - `calculateExpectedStats()` - Calculates stats after feedback

2. **`aep-hub/src/db/migrations/004_status_timestamps.sql`** - Migration
   - Adds `promoted_at` and `deprecated_at` columns to experiences table

3. **`aep-hub/tests/gdiUpdateService.test.ts`** - Unit tests (34 tests)
   - Tests for GDI recalculation
   - Tests for promotion criteria
   - Tests for deprecation criteria
   - Tests for Bayesian confidence update
   - Tests for helper functions

### 修改文件

1. **`aep-hub/src/services/index.ts`** - Export new service
2. **`aep-hub/src/db/feedbackRepository.ts`** - Updated `submitFeedbackWithStats()`:
   - Added `previousStatus` parameter
   - Sets `promoted_at` and `deprecated_at` timestamps on status change
3. **`aep-hub/src/routes/feedback.ts`** - Refactored to use GDI Update Service:
   - Removed inline GDI calculation and status check logic
   - Uses `GDIUpdateService.updateOnFeedback()` instead

### Promotion Criteria (as implemented)

```typescript
const PROMOTION_CRITERIA = {
  MIN_SUCCESS_STREAK: 2,
  MIN_CONFIDENCE: 0.70,
  MIN_GDI_SCORE: 0.65,
  MIN_TOTAL_USES: 3,
  BLAST_RADIUS: { MAX_FILES: 5, MAX_LINES: 200 },
};
```

### Deprecation Criteria (as implemented)

```typescript
const DEPRECATION_CRITERIA = {
  MIN_CONSECUTIVE_FAILURES: 3,
  LOW_GDI: { MIN_TOTAL_USES: 10, MAX_GDI_SCORE: 0.30 },
  LOW_SUCCESS_RATE: { MIN_TOTAL_USES: 5, MIN_SUCCESS_RATE: 0.20 },
  INACTIVITY_DAYS: 90,
};
```

## 测试记录

### Unit Tests (34 tests, all passing)

```
✓ tests/gdiUpdateService.test.ts (34 tests) 14ms
```

Test coverage includes:
- GDI recalculation on feedback submission
- Quality dimension update (success_rate * blast_safety)
- Usage dimension update (log normalization)
- Social dimension update (Wilson score interval)
- Freshness dimension update (exponential decay)
- Promotion criteria checking
- Deprecation criteria checking (4 rules)
- Bayesian confidence update
- Helper function validation

### Build Verification

```
npm run build - SUCCESS (no compilation errors)
```

## 技术约束验证

- **Atomicity**: GDI update and status change in single transaction - VERIFIED
  - `feedbackRepository.submitFeedbackWithStats()` uses database transaction
- **Performance**: GDI recalculation < 10ms - VERIFIED
  - Tests run in 14ms total for 34 tests
- **Audit Trail**: Track status change timestamps - VERIFIED
  - Migration 004 adds `promoted_at` and `deprecated_at` columns
  - Repository sets timestamps on status transition

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.2 GDI Calculator
- **STORY**: `../../_project/stories/STORY-004-feedback-loop.md`
- **STORY**: `../../_project/stories/STORY-005-gdi-scoring-system.md`
