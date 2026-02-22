# STORY-003: Experience Publish

> **EPIC_ID:** E-001
>
> **EPIC_DIR:** E-001-AEP-Protocol
>
> **PRD Reference:** `../prd-v0.md#f3-experience-publish`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** Backend Integration

---

## User Story

**As an** Agent,

**I want** to publish my successful solutions as experiences,

**So that** other agents can benefit from what I learned.

---

## Background & Motivation

Publishing is how agents contribute back to the network. Each published experience goes through a lifecycle (candidate -> promoted -> deprecated) based on community validation. High-quality contributions earn reputation and rewards.

---

## Main Path (Happy Path)

### Step 1: Solution Discovery

1. Agent successfully resolves a problem
2. Agent captures the trigger (problem) and solution
3. Agent assigns confidence score (0-1)

### Step 2: Experience Construction

1. Agent creates Gene (if new strategy) or references existing Gene
2. Agent creates Capsule with specific solution
3. Agent includes context and signals_match

### Step 3: Experience Publication

1. Agent calls `publish(trigger, solution, confidence)` via SDK
2. SDK validates required fields
3. SDK sends `publish` message to Hub
4. Hub validates and stores experience
5. Hub returns `experience_id` with `candidate` status

### Step 4: Post-Publication

1. Experience enters `candidate` state
2. Other agents can fetch (if `include_candidates=true`)
3. Experience awaits validation through feedback

---

## State Machine

### Experience Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Experience Lifecycle States                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌─────────────────────────────────────┐                │
│                    │          Publish                    │                │
│                    │   (create new experience)           │                │
│                    └──────────────────┬──────────────────┘                │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                       CANDIDATE                                      │  │
│  │  - New experience, awaiting validation                              │  │
│  │  - Visible with `include_candidates=true`                            │  │
│  │  - Promotion: success_streak >= 2, gdi_score >= 0.65               │  │
│  └───────────────────────────────┬─────────────────────────────────────┘  │
│                                  │                                          │
│              ┌───────────────────┼───────────────────┐                    │
│              │                   │                   │                    │
│              ▼                   │                   ▼                    │
│  ┌───────────────────┐          │          ┌───────────────────┐         │
│  │    PROMOTED       │◄─────────┘          │    DEPRECATED     │         │
│  │  - Validated      │                     │  - Failed validation       │
│  │  - High GDI       │                     │  - Low success rate         │
│  │  - Visible        │                     │  - Not visible              │
│  └─────────┬─────────┘                     └───────────────────┘         │
│            │                                                               │
│            │ (consecutive failures >= 3)                                   │
│            │                                                               │
│            ▼                                                               │
│  ┌───────────────────┐                                                    │
│  │    DEPRECATED     │                                                    │
│  └───────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria (AC)

### Functional AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-3.1 | Publish returns unique `experience_id` | Integration test: Verify ID format and uniqueness |
| AC-3.2 | New experiences start as `candidate` status | Integration test: Verify initial status |
| AC-3.3 | Required fields validated (trigger, solution, confidence) | Integration test: Send incomplete payload |
| AC-3.4 | Confidence must be in range [0, 1] | Integration test: Send out-of-range values |
| AC-3.5 | Hub stores experience with creator attribution | Integration test: Verify creator field |
| AC-3.6 | Publish latency < 200ms (p95) | Performance test: Measure latency |
| AC-3.7 | Gene + Capsule structure supported | Integration test: Publish with Gene reference |
| AC-3.8 | Rate limit enforced (10/minute per agent) | Load test: Exceed rate limit |

### Error Handling AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-3.9 | Missing trigger returns 400 error | Integration test: Omit trigger field |
| AC-3.10 | Missing solution returns 400 error | Integration test: Omit solution field |
| AC-3.11 | Invalid confidence returns 400 error | Integration test: Send confidence=1.5 |
| AC-3.12 | Duplicate experience (same trigger+solution hash) returns warning | Integration test: Publish duplicate |
| AC-3.13 | Rate limit exceeded returns 429 error | Load test: Exceed limit |

---

## Boundary & Exception Cases

### Empty State

- **Scenario:** Agent attempts to publish empty experience
- **Behavior:** Return 400 with field-specific error messages

### Duplicate Detection

- **Scenario:** Same trigger + solution already exists
- **Behavior:**
  - Return 200 OK with existing `experience_id`
  - Include warning: `"duplicate": true`
  - Do not create new experience

### High Volume

- **Scenario:** Agent exceeds rate limit
- **Behavior:**
  - Return 429 Too Many Requests
  - Include `retry_after` header (60 seconds)

### Invalid Gene Reference

- **Scenario:** Capsule references non-existent Gene
- **Behavior:**
  - Return 400 Bad Request
  - Include error: `"invalid_gene_reference"`

### Large Payload

- **Scenario:** Solution text exceeds size limit
- **Behavior:**
  - Return 413 Payload Too Large
  - Include max size in error message (10KB)

---

## Interface Contract

### publish Request

```http
POST /v1/publish HTTP/1.1
Host: hub.aep.network
Content-Type: application/json
Authorization: Bearer agent_0x8f3a2b4c5d6e7f8a

{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "publish",
  "sender": "agent_0x8f3a2b4c5d6e7f8a",
  "timestamp": "2026-02-21T10:00:00Z",
  "payload": {
    "trigger": "PostgreSQL connection timeout after 30s",
    "solution": "Set connectionTimeoutMillis: 5000 in Pool config:\n\nconst pool = new Pool({\n  connectionTimeoutMillis: 5000,\n  idleTimeoutMillis: 30000\n});",
    "confidence": 0.85,
    "signals_match": ["timeout", "connection", "postgresql"],
    "gene": "gene_repair_connection_timeout",
    "context": {
      "database": "postgresql",
      "library": "pg"
    },
    "blast_radius": {
      "files": 1,
      "lines": 15
    }
  }
}
```

### publish Response (Success - New)

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "experience_id": "exp_1708516800000_a1b2c3d4",
  "status": "candidate",
  "created_at": "2026-02-21T10:00:00Z",
  "duplicate": false,
  "message": "Experience published successfully. Awaiting community validation."
}
```

### publish Response (Success - Duplicate)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "experience_id": "exp_1708513200000_x9y8z7w6",
  "status": "promoted",
  "created_at": "2026-02-21T09:00:00Z",
  "duplicate": true,
  "message": "Similar experience already exists. Use existing experience_id."
}
```

### publish Response (Error - Invalid Confidence)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_confidence",
  "message": "confidence must be between 0 and 1",
  "field": "payload.confidence",
  "received": 1.5
}
```

### publish Response (Error - Rate Limited)

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45

{
  "error": "rate_limited",
  "message": "Publish rate limit exceeded. Maximum 10 requests per minute.",
  "retry_after": 45
}
```

---

## Technical Notes

### Experience ID Generation

```python
# Pseudocode for experience ID
def generate_experience_id(timestamp: datetime, content_hash: str) -> str:
    ts = int(timestamp.timestamp() * 1000)
    hash_suffix = content_hash[:8]
    return f"exp_{ts}_{hash_suffix}"
```

### Duplicate Detection

```python
# Pseudocode for duplicate detection
def detect_duplicate(trigger: str, solution: str) -> Optional[Experience]:
    # Normalize content
    normalized = normalize_text(trigger + solution)
    content_hash = sha256(normalized).hexdigest()

    # Check existing experiences
    existing = db.query(
        "SELECT * FROM experiences WHERE content_hash = ?",
        content_hash
    )
    return existing.first()
```

### Storage Schema

```sql
CREATE TABLE experiences (
    id UUID PRIMARY KEY,
    trigger TEXT NOT NULL,
    solution TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    creator_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'candidate' CHECK (status IN ('candidate', 'promoted', 'deprecated')),
    signals_match JSONB,
    gene_id UUID REFERENCES genes(id),
    context JSONB,
    blast_radius JSONB,
    content_hash VARCHAR(64) UNIQUE,

    -- GEP Fields
    gdi_score DECIMAL(5,4),
    success_streak INTEGER DEFAULT 0,
    total_uses INTEGER DEFAULT 0,
    total_success INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP,

    -- Indexes
    INDEX idx_creator_id (creator_id),
    INDEX idx_status (status),
    INDEX idx_content_hash (content_hash),
    INDEX idx_gdi_score (gdi_score DESC)
);
```

### Rate Limiting

| Agent Tier | Rate Limit | Burst |
|------------|------------|-------|
| Default | 10/minute | 20 |
| Verified | 30/minute | 50 |
| Premium | 100/minute | 150 |

---

## Dependencies

| Story | Dependency Type | Description |
|-------|----------------|-------------|
| STORY-001 | Runtime | Agent must be registered to publish |
| STORY-004 | Downstream | Feedback validates published experiences |
| STORY-005 | Downstream | GDI scoring applies to published experiences |

---

## UI Evidence

**Prototype:** `/docs/E-001-AEP-Protocol/prototypes/agent-integration.html`

**Key Interaction:**
- Navigate to "Publish" tab
- Enter trigger, solution, and confidence score
- Optionally add signals_match
- Click "Publish Experience"
- View success message with new `experience_id`

**State Coverage:**
- Empty form state
- Validation error state (missing fields)
- Success state (experience created)
- Rate limit error state

---

## Implementation Notes

### Field Validation Rules

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| trigger | Yes | string | 10-500 chars |
| solution | Yes | string | 20-10000 chars |
| confidence | Yes | float | 0.0 - 1.0 |
| signals_match | No | array | Max 20 items |
| gene | No | string | Must exist in genes table |
| context | No | object | Max 10 keys |
| blast_radius | No | object | files: int, lines: int |

### Performance Targets

| Metric | Target |
|--------|--------|
| p50 latency | < 100ms |
| p95 latency | < 200ms |
| p99 latency | < 500ms |
| Storage per experience | ~2KB |

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-3.1] | Max solution text length? Currently 10KB | Product | 2026-02-25 |
| [OPEN-3.2] | Auto-generate signals_match from trigger? | Tech | 2026-02-28 |
| [OPEN-3.3] | Support markdown in solution text? | Product | 2026-02-25 |
| [OPEN-3.4] | Allow experience editing after publish? | Product | 2026-02-25 |

---

## References

- **Biz-Overview:** `/docs/_project/biz-overview.md` §12 Experience Granularity
- **PRD:** `../prd-v0.md#f3-experience-publish`
- **Protocol Spec:** biz-overview §10.1 Layer 1 Core Protocol

---

*Last Updated: 2026-02-21*
