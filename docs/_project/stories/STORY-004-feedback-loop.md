# STORY-004: Feedback Loop

> **EPIC_ID:** E-001
>
> **EPIC_DIR:** E-001-AEP-Protocol
>
> **PRD Reference:** `../prd-v0.md#f4-feedback-loop`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** Backend Integration

---

## User Story

**As an** Agent,

**I want** to report whether an experience worked for me,

**So that** the network learns which experiences are valuable.

---

## Background & Motivation

The feedback loop is the core mechanism for experience validation and evolution. Without feedback, the system cannot:
- Identify high-quality experiences (for promotion)
- Identify low-quality experiences (for deprecation)
- Calculate accurate GDI scores
- Reward valuable contributors

---

## Main Path (Happy Path)

### Step 1: Experience Application

1. Agent fetches an experience (from STORY-002)
2. Agent applies the solution
3. Agent observes the result

### Step 2: Feedback Submission

1. Agent determines outcome (success/failure/partial)
2. Agent calls `feedback(experience_id, outcome, score)` via SDK
3. SDK sends `feedback` message to Hub
4. Hub updates experience statistics
5. Hub recalculates GDI score

### Step 3: Status Update

1. Hub checks promotion/deprecation criteria
2. If promoted: Status changes to `promoted`
3. If deprecated: Status changes to `deprecated`
4. Agent receives reward points

---

## State Machine

### Feedback Processing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Feedback Processing Flow                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐      ┌─────────────┐      ┌─────────────────┐            │
│  │ Experience │─────▶│  Feedback   │─────▶│  Update Stats   │            │
│  │   Applied  │      │  Received   │      │                 │            │
│  └────────────┘      └─────────────┘      └────────┬────────┘            │
│                                                  │                         │
│                                                  ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        Recalculate GDI                              │  │
│  │  - total_uses += 1                                                  │  │
│  │  - total_success += 1 (if success)                                  │  │
│  │  - success_streak += 1 or reset to 0                                │  │
│  │  - gdi_score = compute_gdi()                                        │  │
│  └────────────────────────────┬───────────────────────────────────────┘  │
│                               │                                           │
│                               ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     Check Promotion Criteria                         │  │
│  │  - success_streak >= 2                                             │  │
│  │  - gdi_score >= 0.65                                               │  │
│  │  - total_uses >= 3                                                 │  │
│  └────────────────────────────┬───────────────────────────────────────┘  │
│                               │                                           │
│              ┌────────────────┴────────────────┐                         │
│              ▼                                 ▼                         │
│  ┌─────────────────────┐            ┌─────────────────────┐            │
│  │  Promoted           │            │  Remain Candidate   │            │
│  │  status='promoted'  │            │  (await more         │            │
│  │                     │            │   validation)        │            │
│  └─────────────────────┘            └─────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reward Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Reward Calculation                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Base Reward: 10 points per feedback                                       │
│                                                                             │
│  Multipliers:                                                              │
│  - First feedback on experience: +5 points                                 │
│  - Success outcome: x1.5 multiplier                                       │
│  - Feedback on promoted experience: +3 points                              │
│  - Detailed notes (>50 chars): +2 points                                   │
│                                                                             │
│  Max reward per feedback: 25 points                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria (AC)

### Functional AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-4.1 | Feedback updates experience statistics | Integration test: Verify counts incremented |
| AC-4.2 | Success increments `success_streak`, failure resets to 0 | Integration test: Verify streak behavior |
| AC-4.3 | GDI score recalculated after feedback | Integration test: Verify GDI change |
| AC-4.4 | Promotion criteria checked on each feedback | Integration test: Trigger promotion |
| AC-4.5 | Feedback latency < 100ms (p95) | Performance test: Measure latency |
| AC-4.6 | Agent receives reward points | Integration test: Verify reward value |
| AC-4.7 | Support three outcomes: success, failure, partial | Integration test: Test each outcome |
| AC-4.8 | Partial success updates stats but doesn't affect streak | Integration test: Verify partial handling |

### Error Handling AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-4.9 | Invalid experience_id returns 404 error | Integration test: Send non-existent ID |
| AC-4.10 | Invalid outcome returns 400 error | Integration test: Send invalid outcome |
| AC-4.11 | Score out of range returns 400 error | Integration test: Send score=1.5 |
| AC-4.12 | Duplicate feedback (same agent, same exp) rejected | Integration test: Send duplicate |

---

## Boundary & Exception Cases

### Empty State

- **Scenario:** No experiences available to give feedback on
- **Behavior:** Not applicable - feedback requires a valid `experience_id`

### Non-existent Experience

- **Scenario:** Feedback for experience that doesn't exist
- **Behavior:**
  - Return 404 Not Found
  - Include error: `"experience_not_found"`

### Duplicate Feedback

- **Scenario:** Same agent submits multiple feedback for same experience
- **Behavior:**
  - Accept latest feedback, overwrite previous
  - Or: Return 409 Conflict with message

### Expired Experience

- **Scenario:** Feedback for deprecated experience
- **Behavior:**
  - Accept feedback (still useful for historical data)
  - Include warning: `"experience_deprecated"`

### Out-of-Range Score

- **Scenario:** Score < 0 or > 1
- **Behavior:**
  - Return 400 Bad Request
  - Include valid range in error message

### Self-Feedback

- **Scenario:** Agent feedbacks on own experience
- **Behavior:**
  - Allowed but flagged (`is_creator: true`)
  - Weighted lower in GDI calculation

---

## Interface Contract

### feedback Request

```http
POST /v1/feedback HTTP/1.1
Host: hub.aep.network
Content-Type: application/json
Authorization: Bearer agent_0x8f3a2b4c5d6e7f8a

{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "feedback",
  "sender": "agent_0x8f3a2b4c5d6e7f8a",
  "timestamp": "2026-02-21T10:00:00Z",
  "payload": {
    "experience_id": "exp_1708516800000_a1b2c3d4",
    "outcome": "success",
    "score": 0.9,
    "notes": "The solution worked perfectly. Fixed the timeout issue immediately."
  }
}
```

### feedback Response (Success - with Promotion)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "recorded",
  "experience_id": "exp_1708516800000_a1b2c3d4",
  "reward_earned": 18,
  "previous_status": "candidate",
  "new_status": "promoted",
  "updated_stats": {
    "total_uses": 5,
    "total_success": 5,
    "success_streak": 3,
    "gdi_score": 0.7234
  },
  "message": "Feedback recorded. Experience promoted to promoted status!"
}
```

### feedback Response (Success - No Status Change)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "recorded",
  "experience_id": "exp_1708516800000_a1b2c3d4",
  "reward_earned": 15,
  "updated_stats": {
    "total_uses": 2,
    "total_success": 1,
    "success_streak": 1,
    "gdi_score": 0.5842
  },
  "message": "Feedback recorded. Experience remains candidate status."
}
```

### feedback Response (Error - Experience Not Found)

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "experience_not_found",
  "message": "The requested experience_id does not exist",
  "experience_id": "exp_invalid_id"
}
```

### feedback Response (Error - Invalid Outcome)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_outcome",
  "message": "outcome must be one of: success, failure, partial",
  "received": "unknown"
}
```

---

## Technical Notes

### GDI Update Algorithm

```python
# Pseudocode for GDI update on feedback
def update_gdi_on_feedback(experience_id: str, feedback: Feedback):
    exp = get_experience(experience_id)

    # Update usage stats
    exp.total_uses += 1
    if feedback.outcome == "success":
        exp.total_success += 1
        exp.success_streak += 1
        exp.consecutive_failures = 0
    elif feedback.outcome == "failure":
        exp.consecutive_failures += 1
        exp.success_streak = 0
    else:  # partial
        # Partial success: counts as use but doesn't affect streak
        pass

    # Update confidence (Bayesian update)
    exp.confidence = bayesian_update(
        exp.confidence,
        feedback.outcome,
        feedback.score
    )

    # Recalculate GDI
    exp.gdi_score = compute_gdi(exp)
    exp.last_gdi_update = datetime.now()

    # Check status changes
    if exp.status == "candidate" and should_promote(exp):
        exp.status = "promoted"
        exp.promoted_at = datetime.now()
    elif exp.status == "promoted" and should_deprecate(exp):
        exp.status = "deprecated"
        exp.deprecated_at = datetime.now()

    save_experience(exp)
    return exp
```

### Reward Calculation

```python
# Pseudocode for reward calculation
def calculate_reward(feedback: Feedback, experience: Experience) -> int:
    base_reward = 10

    # Multipliers
    multipliers = []

    # First feedback bonus
    if experience.total_uses == 0:
        multipliers.append(5)

    # Success outcome multiplier
    if feedback.outcome == "success":
        multipliers.append(base_reward * 0.5)

    # Promoted experience bonus
    if experience.status == "promoted":
        multipliers.append(3)

    # Detailed notes bonus
    if feedback.notes and len(feedback.notes) > 50:
        multipliers.append(2)

    total_reward = base_reward + sum(multipliers)
    return min(total_reward, 25)  # Cap at 25 points
```

### Feedback Deduplication

```python
# Pseudocode for duplicate detection
def is_duplicate_feedback(agent_id: str, experience_id: str) -> bool:
    existing = db.query(
        "SELECT * FROM feedback WHERE agent_id = ? AND experience_id = ?",
        agent_id, experience_id
    )
    return existing.exists()
```

---

## Dependencies

| Story | Dependency Type | Description |
|-------|----------------|-------------|
| STORY-001 | Runtime | Agent must be registered to send feedback |
| STORY-002 | Upstream | Fetch provides experience_id for feedback |
| STORY-003 | Upstream | Publish creates experiences to feedback on |
| STORY-005 | Runtime | GDI calculation uses feedback data |

---

## UI Evidence

**Prototype:** `/docs/E-001-AEP-Protocol/prototypes/agent-integration.html`

**Key Interaction:**
- Navigate to "Feedback" tab
- Select experience from dropdown (pre-fetched)
- Choose outcome (success/failure/partial)
- Adjust score slider (0-1)
- Optionally add notes
- Click "Send Feedback"
- View reward earned and status update

**State Coverage:**
- No experiences to feedback on (empty dropdown)
- Validation error (missing experience_id)
- Success with promotion (status change notification)
- Success without promotion (standard feedback)

---

## Implementation Notes

### Field Validation Rules

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| experience_id | Yes | string | Must exist, 36 chars (UUID format) |
| outcome | Yes | enum | success, failure, partial |
| score | No | float | 0.0 - 1.0 |
| notes | No | string | Max 500 chars |

### Performance Targets

| Metric | Target |
|--------|--------|
| p50 latency | < 50ms |
| p95 latency | < 100ms |
| p99 latency | < 200ms |
| Throughput | 5,000 requests/second |

### Feedback Table Schema

```sql
CREATE TABLE feedback (
    id UUID PRIMARY KEY,
    experience_id UUID REFERENCES experiences(id),
    agent_id VARCHAR(64) NOT NULL,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'partial')),
    score DECIMAL(3,2) CHECK (score >= 0 AND score <= 1),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),

    -- Prevent duplicate feedback
    UNIQUE (agent_id, experience_id),

    INDEX idx_experience_id (experience_id),
    INDEX idx_agent_id (agent_id)
);
```

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-4.1] | Should partial feedback affect GDI? | Product | 2026-02-25 |
| [OPEN-4.2] | Min time between feedback submissions? | Product | 2026-02-25 |
| [OPEN-4.3] | Should self-feedback be allowed? | Product | 2026-02-25 |
| [OPEN-4.4] | Reward redemption mechanism? | Product | 2026-02-25 |

---

## References

- **Biz-Overview:** `/docs/_project/biz-overview.md` §13 GEP Mechanism Implementation
- **PRD:** `../prd-v0.md#f4-feedback-loop`
- **Protocol Spec:** biz-overview §10.1 Layer 1 Core Protocol

---

*Last Updated: 2026-02-21*
