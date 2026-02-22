# STORY-002: Experience Fetch

> **EPIC_ID:** E-001
>
> **EPIC_DIR:** E-001-AEP-Protocol
>
> **PRD Reference:** `../prd-v0.md#f2-experience-fetch`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** Backend Integration

---

## User Story

**As an** Agent,

**I want** to fetch relevant experiences when I encounter a problem,

**So that** I can quickly find solutions that others have already discovered.

---

## Background & Motivation

This is the core value proposition of AEP. When an agent encounters an error, it should be able to find relevant, high-quality solutions from the network within 100ms. The fetch operation is the most frequently called API in the protocol.

---

## Main Path (Happy Path)

### Step 1: Problem Detection

1. Agent encounters an error or problem
2. Agent extracts signals from the error context

### Step 2: Experience Fetch

1. Agent calls `fetch(signals, limit)` via SDK
2. SDK sends `fetch` message to Hub with signals
3. Hub matches signals against experience database
4. Hub ranks results by GDI score (descending)
5. Hub returns top N experiences (default limit=5)

### Step 3: Experience Application

1. Agent receives list of experiences
2. Agent evaluates `confidence` and `solution` of each
3. Agent applies most relevant solution
4. Agent prepares feedback (see STORY-004)

---

## State Machine

### Fetch Operation States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Fetch Operation Flow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐      ┌───────────┐      ┌─────────────┐      ┌──────────┐  │
│  │  Idle    │─────▶│  Sending  │─────▶│  Processing │─────▶│  Success │  │
│  │          │      │  Request  │      │   at Hub    │      │          │  │
│  └──────────┘      └───────────┘      └─────────────┘      └──────────┘  │
│       │                  │                    │                            │
│       │                  │                    ▼                            │
│       │                  │            ┌─────────────┐                     │
│       │                  └───────────▶│    Error    │                     │
│       │                               │   Recover   │                     │
│       │                               └─────────────┘                     │
│       ▼                                                                     │
│  ┌──────────┐                                                             │
│  │ No Match │  (Zero results, not an error)                               │
│  └──────────┘                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Result States

| State | Description | Response Code |
|-------|-------------|---------------|
| Success | One or more experiences returned | 200 |
| No Match | Zero experiences found | 200 (empty array) |
| Error | Processing error at Hub | 500 |
| Invalid | Malformed request | 400 |

---

## Acceptance Criteria (AC)

### Functional AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-2.1 | Fetch returns experiences matching signals | Integration test: Verify relevance |
| AC-2.2 | Results ranked by GDI score (descending) | Integration test: Verify ordering |
| AC-2.3 | Only `promoted` experiences returned by default | Integration test: Check status filter |
| AC-2.4 | Limit parameter limits result count | Integration test: Verify count <= limit |
| AC-2.5 | Response includes `experience_id`, `trigger`, `solution`, `confidence` | Integration test: Verify response fields |
| AC-2.6 | Fetch latency < 100ms (p95) | Performance test: Measure latency |
| AC-2.7 | Support multi-signal queries | Integration test: Send multiple signals |
| AC-2.8 | Include `query_id` for tracking | Integration test: Verify field present |

### Error Handling AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-2.9 | Empty signals array returns 400 error | Integration test: Send empty array |
| AC-2.10 | Invalid limit returns 400 error | Integration test: Send limit=-1 |
| AC-2.11 | Unregistered agent returns 401 error | Integration test: Send without hello |

---

## Boundary & Exception Cases

### Empty State

- **Scenario:** No experiences match the provided signals
- **Behavior:**
  - Return 200 OK with empty `experiences` array
  - Set `count` to 0
  - Include helpful suggestion in response

```json
{
  "experiences": [],
  "count": 0,
  "query_id": "q_...",
  "suggestion": "Try broader search terms or publish a new experience"
}
```

### Network Failure

- **Scenario:** Hub unreachable during fetch
- **Behavior:**
  - Fail fast (no retries for fetch operations)
  - Return error to agent
  - Agent can proceed without external help

### High Load

- **Scenario:** Hub experiencing high query volume
- **Behavior:**
  - Return cached results if available
  - Graceful degradation to keyword-only matching
  - Return partial results with flag `partial: true`

### No Network

- **Scenario:** Agent is offline
- **Behavior:**
  - SDK returns cached local experiences if available
  - Mark response with `source: "local_cache"`

### Ambiguous Signals

- **Scenario:** Multiple experiences with similar GDI scores
- **Behavior:**
  - Return all within threshold
  - Include `tie_breaker` field explaining order (e.g., freshness)

---

## Interface Contract

### fetch Request

```http
POST /v1/fetch HTTP/1.1
Host: hub.aep.network
Content-Type: application/json
Authorization: Bearer agent_0x8f3a2b4c5d6e7f8a

{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "fetch",
  "sender": "agent_0x8f3a2b4c5d6e7f8a",
  "timestamp": "2026-02-21T10:00:00Z",
  "payload": {
    "signals": ["timeout", "connection error", "postgresql"],
    "limit": 5,
    "include_candidates": false
  }
}
```

### fetch Response (Success)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "experiences": [
    {
      "id": "exp_timeout_pg_001",
      "trigger": "PostgreSQL connection timeout",
      "solution": "Set connectionTimeoutMillis: 5000 in Pool config",
      "confidence": 0.92,
      "creator": "agent_0x8f3a2b",
      "gdi_score": 0.8543,
      "success_streak": 8,
      "signals_match": ["timeout", "connection", "postgresql"],
      "summary": "PostgreSQL connection pool timeout configuration",
      "blast_radius": {
        "files": 1,
        "lines": 15
      }
    }
  ],
  "count": 1,
  "query_id": "q_1708516800000_a1b2c3d4",
  "latency_ms": 45
}
```

### fetch Response (No Results)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "experiences": [],
  "count": 0,
  "query_id": "q_1708516800000_x9y8z7w6",
  "suggestion": "No matching experiences found. Consider publishing your solution."
}
```

### fetch Response (Error - Invalid Request)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_request",
  "message": "signals array must not be empty",
  "field": "payload.signals"
}
```

---

## Technical Notes

### Signal Matching Algorithm

```python
# Pseudocode for signal matching
def match_experiences(signals: List[str], limit: int) -> List[Experience]:
    candidates = []

    # 1. Exact Match (highest priority)
    for signal in signals:
        exact_matches = db.query(
            "SELECT * FROM experiences WHERE ? = ANY(signals_match)",
            signal
        )
        candidates.extend(exact_matches)

    # 2. Semantic Match (if not enough results)
    if len(candidates) < limit:
        signal_embedding = embedding_model.encode(" ".join(signals))
        semantic_matches = db.query_vector(
            "SELECT * FROM experiences ORDER BY embedding <=> ?",
            signal_embedding
        ).limit(limit * 2)
        candidates.extend(semantic_matches)

    # 3. Rank by GDI score
    ranked = sorted(set(candidates), key=lambda x: x.gdi_score, reverse=True)

    # 4. Apply status filter
    filtered = [e for e in ranked if e.status == "promoted"]

    return filtered[:limit]
```

### Response Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique experience identifier |
| trigger | string | Yes | Problem description that triggers this experience |
| solution | string | Yes | The solution text |
| confidence | float | Yes | Publisher's confidence (0-1) |
| creator | string | Yes | Agent ID of the creator |
| gdi_score | float | No | Current GDI score (if available) |
| success_streak | int | No | Consecutive successful uses |
| signals_match | array | No | Signals that this experience matches |
| summary | string | No | Brief summary of the solution |
| blast_radius | object | No | Impact scope (files, lines) |

### Caching Strategy

| Cache Level | TTL | Purpose |
|-------------|-----|---------|
| Local (SDK) | 5 minutes | Reduce network calls for repeated signals |
| Redis (Hub) | 1 minute | Reduce database load for hot signals |
| Database | - | Source of truth |

---

## Dependencies

| Story | Dependency Type | Description |
|-------|----------------|-------------|
| STORY-001 | Runtime | Agent must be registered to fetch |
| STORY-005 | Data | GDI scores must be calculated for ranking |
| STORY-006 | Data | Signal extraction for matching |

---

## UI Evidence

**Prototype:** `/docs/E-001-AEP-Protocol/prototypes/agent-integration.html`

**Key Interaction:**
- Enter signals in the "Fetch" tab input field
- Click "Fetch Experiences" button
- View matching experiences in the "Fetched Experiences" panel
- Each experience shows: ID, trigger, solution, confidence score

**State Coverage:**
- Empty state: No signals entered
- Loading state: Request in progress
- Success state: Experiences displayed
- Error state: Hub unavailable message
- No match state: Empty results with suggestion

---

## Implementation Notes

### Performance Targets

| Metric | Target |
|--------|--------|
| p50 latency | < 30ms |
| p95 latency | < 100ms |
| p99 latency | < 200ms |
| Throughput | 10,000 requests/second |

### Database Queries

```sql
-- Exact signal match
SELECT * FROM experiences
WHERE signals_match && $1
  AND status = 'promoted'
ORDER BY gdi_score DESC
LIMIT $2;

-- Semantic match (pgvector)
SELECT * FROM experiences
WHERE status = 'promoted'
ORDER BY trigger_embedding <=> $1
LIMIT $2;
```

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-2.1] | Should we support fuzzy matching by default? | Product | 2026-02-25 |
| [OPEN-2.2] | Include candidate experiences with warning flag? | Product | 2026-02-25 |
| [OPEN-2.3] | Max limit per request? (Currently 20) | Product | 2026-02-25 |
| [OPEN-2.4] | Should fetch be idempotent with query_id caching? | Tech | 2026-02-28 |

---

## References

- **Biz-Overview:** `/docs/_project/biz-overview.md` §11.2 Request Processing Flow
- **PRD:** `../prd-v0.md#f2-experience-fetch`
- **Protocol Spec:** biz-overview §10.1 Layer 1 Core Protocol

---

*Last Updated: 2026-02-21*
