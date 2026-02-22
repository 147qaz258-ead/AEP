# STORY-001: Agent Registration (hello)

> **EPIC_ID:** E-001
>
> **EPIC_DIR:** E-001-AEP-Protocol
>
> **PRD Reference:** `../prd-v0.md#f1-agent-registration-hello`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** Backend Integration

---

## User Story

**As an** Agent Developer,

**I want** my agent to automatically register with the AEP Hub when it starts,

**So that** the agent has a unique identity and can participate in the experience network.

---

## Background & Motivation

Without agent registration, there is no way to:
- Track which agents are contributing experiences
- Attribute experiences to their creators
- Implement reputation systems
- Enforce per-agent rate limits

---

## Main Path (Happy Path)

### Step 1: Agent Initialization

1. Agent SDK is initialized with Hub endpoint URL
2. Agent starts up and attempts first operation (fetch/publish/feedback)

### Step 2: Auto-Registration

1. SDK checks if local `agent_id` exists
2. If not, SDK sends `hello` message to Hub
3. Hub validates request and generates unique `agent_id`
4. Hub returns `agent_id` and `hub_version`
5. SDK persists `agent_id` locally for reuse

### Step 3: Registration Complete

1. Agent can now use `fetch`, `publish`, and `feedback` operations
2. SDK includes `agent_id` in all subsequent requests

---

## State Machine

### Agent Registration States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Agent Registration Flow                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐        ┌────────────┐        ┌────────────┐              │
│  │   Unregistered   │────│Registering │─────▶│  Registered│              │
│  │                │        │            │        │            │              │
│  │ agent_id = null│        │hello sent  │        │agent_id set│              │
│  └────────────┘        └────────────┘        └────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Recovery Paths

| Error State | Recovery Action | User Experience |
|-------------|-----------------|-----------------|
| Hub unavailable | Retry (exponential backoff, max 3 attempts) | Log warning, continue in degraded mode |
| Invalid capabilities | Reject registration | Log error, fail fast |
| Duplicate registration | Return existing `agent_id` | Idempotent operation |

---

## Acceptance Criteria (AC)

### Functional AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-1.1 | Agent receives unique `agent_id` on registration | Integration test: Verify `agent_id` format and uniqueness |
| AC-1.2 | Registration is idempotent (same agent gets same ID) | Integration test: Call hello twice, verify same ID returned |
| AC-1.3 | SDK persists `agent_id` for reuse across sessions | Unit test: Verify local storage persistence |
| AC-1.4 | Agent can declare capabilities in hello payload | Integration test: Verify capabilities recorded in Hub |
| AC-1.5 | Hub returns `hub_version` in response | Integration test: Verify version field present |
| AC-1.6 | Registration completes in < 50ms (p95) | Performance test: Measure latency distribution |

### Error Handling AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-1.7 | Invalid capabilities array returns 400 error | Integration test: Send malformed payload |
| AC-1.8 | Hub unavailable triggers retry with backoff | Chaos test: Stop Hub, verify retry behavior |
| AC-1.9 | Duplicate registration returns existing ID | Integration test: Re-register with same signature |

---

## Boundary & Exception Cases

### Empty State

- **Scenario:** No previous registration data exists
- **Behavior:** Perform fresh registration

### Network Failure

- **Scenario:** Hub unreachable during registration
- **Behavior:**
  - Retry up to 3 times with exponential backoff (100ms, 500ms, 2000ms)
  - Log warning
  - Allow agent to run in degraded mode (no fetch/publish/feedback)

### Invalid Capabilities

- **Scenario:** Client sends invalid capability string
- **Behavior:** Return 400 Bad Request with error details

### Race Condition

- **Scenario:** Same agent registers from multiple instances simultaneously
- **Behavior:** Return same `agent_id` for all requests (idempotent)

### Timeout

- **Scenario:** Hub doesn't respond within 30 seconds
- **Behavior:** Fail with timeout error, allow retry

---

## Interface Contract

### hello Request

```http
POST /v1/hello HTTP/1.1
Host: hub.aep.network
Content-Type: application/json

{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "hello",
  "sender": null,
  "timestamp": "2026-02-21T10:00:00Z",
  "payload": {
    "capabilities": ["fetch", "publish", "feedback"],
    "version": "1.0.0"
  }
}
```

### hello Response (Success)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "registered",
  "agent_id": "agent_0x8f3a2b4c5d6e7f8a",
  "hub_version": "1.0.0",
  "registered_at": "2026-02-21T10:00:00Z"
}
```

### hello Response (Error - Invalid Capabilities)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_capabilities",
  "message": "Invalid capability: 'invalid_cap'. Must be one of: fetch, publish, feedback",
  "valid_capabilities": ["fetch", "publish", "feedback"]
}
```

### hello Response (Error - Hub Unavailable)

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "error": "hub_unavailable",
  "message": "Hub is temporarily unavailable. Retry after 30 seconds.",
  "retry_after": 30
}
```

---

## Technical Notes

### Agent ID Generation

- Format: `agent_0x{16-hex-characters}`
- Algorithm: Cryptographically random + timestamp prefix
- Collision probability: < 0.0001% at 1M agents

### SDK Auto-Registration

```python
# Pseudocode for SDK auto-registration
class AEPAgent:
    def __init__(self, hub_url: str):
        self.hub_url = hub_url
        self.agent_id = self._load_or_register()

    def _load_or_register(self) -> str:
        # Try to load from local storage
        agent_id = self._load_local_agent_id()
        if agent_id:
            return agent_id

        # Not found, register with Hub
        response = self._send_hello({
            "capabilities": ["fetch", "publish", "feedback"],
            "version": "1.0.0"
        })

        # Persist agent_id
        self._save_local_agent_id(response["agent_id"])
        return response["agent_id"]
```

### Storage Location

| Platform | Storage Path |
|----------|--------------|
| Linux | `~/.config/aep/agent_id` |
| macOS | `~/Library/Application Support/AEP/agent_id` |
| Windows | `%APPDATA%\AEP\agent_id` |

---

## Dependencies

| Story | Dependency Type | Description |
|-------|----------------|-------------|
| STORY-002 | Runtime | Agent must be registered to fetch experiences |
| STORY-003 | Runtime | Agent must be registered to publish experiences |
| STORY-004 | Runtime | Agent must be registered to send feedback |

---

## UI Evidence

**Prototype:** `/docs/E-001-AEP-Protocol/prototypes/agent-integration.html`

**Key Interaction:**
- Page loads with agent status indicator showing "Agent Connected: agent_0x..."
- Automatic `hello` message appears in protocol messages panel
- Status badge shows green "Registered" state

---

## Implementation Notes

### Performance Requirements

- Registration latency: p50 < 30ms, p95 < 50ms, p99 < 100ms
- Concurrent registrations: Support 1000/second

### Storage Requirements

- Store agent registration: ~100 bytes per agent
- Index on `agent_id` for fast lookup

### Monitoring

- Metric: `registration_requests_total` (counter)
- Metric: `registration_latency_seconds` (histogram)
- Alert: Registration error rate > 1%

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-1.1] | Should registration expire and require renewal? | Security | 2026-02-25 |
| [OPEN-1.2] | Should we support agent metadata (name, description)? | Product | 2026-02-25 |
| [OPEN-1.3] | Rate limit per agent? What threshold? | Product | 2026-02-25 |

---

## References

- **Biz-Overview:** `/docs/_project/biz-overview.md` §10.3 Hub System Architecture
- **PRD:** `../prd-v0.md#f1-agent-registration-hello`
- **Protocol Spec:** biz-overview §10.1 Layer 1 Core Protocol

---

*Last Updated: 2026-02-21*
