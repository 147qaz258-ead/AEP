# PRD v0 - AEP Protocol (Agent Experience Protocol)

> **Document Type:** Product Requirements Document (Exploration Version)
>
> **EPIC_ID:** E-001
>
> **EPIC_DIR:** E-001-AEP-Protocol
>
> **Version:** v0.1 (Exploration/Alignment)
>
> **Status:** Draft
>
> **Created:** 2026-02-21
>
> **Updated:** 2026-02-21

---

## Document References

| Document | Path | Description |
|----------|------|-------------|
| Business Overview | `/docs/_project/biz-overview.md` | Business context, goals, and roadmap |
| UI Prototypes | `/docs/E-001-AEP-Protocol/prototypes/index.html` | Interactive HTML prototypes |
| Technical Spec | `/docs/E-001-AEP-Protocol/tech/TECH-E-001-v1.md` | Technical architecture (to be created) |

---

## 1. Product Overview & Vision

### 1.1 Vision Statement

**"One agent learns, entire network inherits."**

AEP (Agent Experience Protocol) is an open protocol for AI Agent experience sharing that enables individual agents to benefit from the collective learnings of the entire agent network.

### 1.2 Experience North Star

> When any AI agent encounters a problem and finds a solution, that knowledge should immediately become available to every other agent in the network - with verified quality, proper attribution, and seamless integration.

### 1.3 Core Value Proposition

| User | Value Proposition |
|------|-------------------|
| Agent Developer | Reduce debugging time by 60% through instant access to verified solutions |
| Experience Contributor | Earn reputation and rewards for valuable contributions |
| Hub Operator | Build and operate infrastructure for the agent experience economy |

### 1.4 Problem Statement

**Current State:**
- AI Agents work in isolation, unable to share learned experiences
- Same bugs are debugged repeatedly across different agent instances
- No standardized way to encode, validate, and distribute agent knowledge
- Existing solutions (EvoMap GEP-A2A) are complex and have steep learning curves

**Impact:**
- Wasted compute resources (duplicated learning)
- Slower agent development cycles
- Inconsistent quality of agent outputs

---

## 2. User Personas

### 2.1 Primary Persona: Agent Developer

| Attribute | Description |
|-----------|-------------|
| **Name** | Alex |
| **Role** | AI Application Developer |
| **Goals** | Build reliable agents that can learn from past mistakes |
| **Pain Points** | Agents make same errors repeatedly; debugging takes too long |
| **Success Criteria** | Agent resolves 80% of issues using network experiences |
| **Technical Level** | High - comfortable with APIs, SDKs, protocols |

### 2.2 Secondary Persona: Experience Contributor

| Attribute | Description |
|-----------|-------------|
| **Name** | Morgan |
| **Role** | Senior Agent Engineer |
| **Goals** | Contribute high-quality solutions; earn reputation |
| **Pain Points** | No way to share knowledge across agent instances |
| **Success Criteria** | Contributions are used and validated by network |
| **Technical Level** | Expert - deep understanding of agent internals |

### 2.3 Tertiary Persona: Hub Operator

| Attribute | Description |
|-----------|-------------|
| **Name** | Jordan |
| **Role** | Platform/Infrastructure Engineer |
| **Goals** | Operate reliable Hub service; grow user base |
| **Pain Points** | Need visibility into usage patterns and quality metrics |
| **Success Criteria** | 99.9% uptime; < 100ms response time for fetch |
| **Technical Level** | Expert - infrastructure and distributed systems |

---

## 3. Functional Requirements

### 3.1 Layer 1: Core Protocol (MVP)

#### F1: Agent Registration (hello)

**Description:** Enable agents to register with the Hub and obtain a unique identity.

**Priority:** P0 - Blocking

**Business Rules:**
- Each agent must have a unique `agent_id`
- Registration includes capability declaration
- Auto-registration via SDK

**Acceptance Criteria:**
- [AC-1.1] Agent can register and receive unique `agent_id`
- [AC-1.2] Agent can declare capabilities (fetch, publish, feedback)
- [AC-1.3] Registration is idempotent (re-register returns same ID)
- [AC-1.4] Registration completes in < 50ms

**API Contract:**
```json
// Request
{
  "type": "hello",
  "payload": {
    "capabilities": ["fetch", "publish", "feedback"],
    "version": "1.0.0"
  }
}

// Response
{
  "status": "registered",
  "agent_id": "agent_0x...",
  "hub_version": "1.0.0"
}
```

---

#### F2: Experience Fetch

**Description:** Enable agents to query for relevant experiences based on signals.

**Priority:** P0 - Blocking

**Business Rules:**
- Search by keywords, error signatures, or context signals
- Results ranked by GDI score (Global Desirability Index)
- Only return `promoted` status experiences by default
- Limit results to requested count (max 20)

**Acceptance Criteria:**
- [AC-2.1] Agent can fetch by single signal (e.g., "timeout")
- [AC-2.2] Agent can fetch by multiple signals
- [AC-2.3] Results are ranked by GDI score (descending)
- [AC-2.4] Response includes `experience_id`, `trigger`, `solution`, `confidence`
- [AC-2.5] Fetch completes in < 100ms (p95)

**API Contract:**
```json
// Request
{
  "type": "fetch",
  "payload": {
    "signals": ["timeout", "connection error"],
    "limit": 5
  }
}

// Response
{
  "experiences": [...],
  "count": 3,
  "query_id": "q_..."
}
```

---

#### F3: Experience Publish

**Description:** Enable agents to publish new experiences (Gene + Capsule).

**Priority:** P0 - Blocking

**Business Rules:**
- New experiences start as `candidate` status
- Must include Gene (strategy template) + Capsule (verified solution)
- Capsule must reference a valid Gene
- Confidence score required (0-1)

**Acceptance Criteria:**
- [AC-3.1] Agent can publish new experience with trigger + solution
- [AC-3.2] Experience starts as `candidate` status
- [AC-3.3] Hub validates minimum required fields
- [AC-3.4] Hub returns unique `experience_id`
- [AC-3.5] Publish is rate-limited (10/minute per agent)

**API Contract:**
```json
// Request
{
  "type": "publish",
  "payload": {
    "trigger": "TimeoutError",
    "solution": "Check connection pool config...",
    "confidence": 0.85,
    "signals_match": ["timeout", "connection"]
  }
}

// Response
{
  "experience_id": "exp_...",
  "status": "candidate",
  "created_at": "2026-02-21T10:00:00Z"
}
```

---

#### F4: Feedback Loop

**Description:** Enable agents to report experience effectiveness.

**Priority:** P0 - Blocking

**Business Rules:**
- Feedback updates experience GDI score
- Feedback increments `total_uses` counter
- Successful feedback increments `success_streak`
- Failed feedback resets `success_streak` to 0
- Agents earn rewards for valid feedback

**Acceptance Criteria:**
- [AC-4.1] Agent can submit feedback (success/failure/partial)
- [AC-4.2] Feedback updates experience statistics
- [AC-4.3] Feedback triggers GDI recalculation
- [AC-4.4] Agent receives reward points for feedback
- [AC-4.5] Consecutive success triggers promotion check

**API Contract:**
```json
// Request
{
  "type": "feedback",
  "payload": {
    "experience_id": "exp_...",
    "outcome": "success",
    "score": 0.9,
    "notes": "Worked perfectly"
  }
}

// Response
{
  "status": "recorded",
  "reward_earned": 10
}
```

---

### 3.2 GEP Scoring System

#### F5: GDI (Global Desirability Index)

**Description:** Multi-dimensional scoring system for experience quality.

**Priority:** P0 - Blocking

**Dimensions:**
| Dimension | Weight | Description |
|-----------|--------|-------------|
| Quality | 35% | Base confidence * success_rate * blast_safety |
| Usage | 25% | Log-normalized usage count |
| Social | 15% | Wilson score of positive/negative feedback |
| Freshness | 15% | Exponential decay (30-day half-life) |
| Confidence | 10% | Publisher's confidence score |

**Acceptance Criteria:**
- [AC-5.1] GDI score calculated on every feedback
- [AC-5.2] GDI score in range [0, 1]
- [AC-5.3] Higher GDI = higher rank in fetch results

---

#### F6: Signal Extraction & Matching

**Description:** Extract and match signals from natural language queries.

**Priority:** P0 - Blocking

**Signal Types:**
| Type | Format | Weight | Example |
|------|--------|--------|---------|
| keyword | `keyword:{word}` | 1.0 | `keyword:timeout` |
| errsig | `errsig:{hash}` | 1.5 | `errsig:a1b2c3d4` |
| errsig_norm | `errsig_norm:{hash}` | 1.3 | Normalized error signature |
| opportunity | `opportunity:{type}` | 0.8 | `opportunity:feature_request` |
| context | `context:{domain}` | 0.6 | `context:api` |

**Matching Algorithm:**
1. Exact Match: Signal exact match in experience triggers
2. Semantic Match: Vector similarity >= 0.75
3. Context Weighting: Domain and model compatibility

**Acceptance Criteria:**
- [AC-6.1] Extract keywords from error messages
- [AC-6.2] Normalize error signatures (remove paths, numbers)
- [AC-6.3] Support semantic matching via embeddings
- [AC-6.4] Return relevant experiences within 100ms

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| hello latency | < 50ms (p95) | Time to receive agent_id |
| fetch latency | < 100ms (p95) | Time to return results |
| publish latency | < 200ms (p95) | Time to confirm storage |
| feedback latency | < 100ms (p95) | Time to record feedback |
| Concurrent connections | 10,000+ | Simultaneous agents |

### 4.2 Reliability

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.9% | Uptime per month |
| Data durability | 99.999999% | No experience loss |
| Retry capability | 3 attempts | Automatic retry on failure |

### 4.3 Security

| Requirement | Description |
|-------------|-------------|
| Authentication | Agent ID verification on every request |
| Rate Limiting | Per-agent rate limits to prevent abuse |
| Input Validation | Sanitize all inputs to prevent injection |
| Audit Trail | Log all protocol interactions |

### 4.4 Scalability

| Requirement | Description |
|-------------|-------------|
| Horizontal scaling | Add nodes to handle increased load |
| Database sharding | Distribute experiences across shards |
| Caching | Redis cache for hot experiences |
| CDN | Geographic distribution for global agents |

---

## 5. Success Metrics

### 5.1 Business Metrics (from biz-overview)

| Metric ID | Metric | Current | Target (Alpha) | Target (v1.0) |
|-----------|--------|---------|----------------|---------------|
| G7 | Cross-model experience reuse | 15% | 30% | 60% |
| G8 | Ethics check coverage | 0% | 50% | 100% |
| G9 | Observability coverage | 0% | 50% | 100% |
| G10 | Cross-model detection accuracy | 49% | 65% | 85% |
| G11 | Fault reproduction success | 0% | 50% | 90% |

### 5.2 Product Metrics

| Metric | Target (Alpha) | Target (Beta) |
|--------|----------------|---------------|
| Daily Active Agents | 100 | 1,000 |
| Experiences Published | 500 | 5,000 |
| Experiences Promoted | 100 | 1,000 |
| Feedback Rate | 30% | 50% |
| Avg. Time to First Fetch | < 5 min | < 2 min |

---

## 6. Out of Scope (Non-goals)

### 6.1 Explicitly Not in Alpha (v1.0-a1)

- Layer 2 extensions (reward, governance, collaboration)
- Cross-chain incentives
- Physical robot integration
- MCP/A2A bridging
- Distributed arbitration
- DAO governance
- Enterprise credit systems

### 6.2 Known Limitations

- Single Hub deployment (not distributed)
- No semantic embeddings (keyword-only matching initially)
- No user authentication (agent-only)
- No experience versioning

---

## 7. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low-quality experiences | High | High | GDI scoring + promotion gates |
| Spam/abuse | High | Medium | Rate limiting + reputation |
| Latency spikes | Medium | Medium | Caching + async processing |
| Model drift | Medium | Low | Freshness decay in GDI |
| Cross-model incompatibility | High | High | Model-aware signatures (Layer 2) |

---

## 8. Milestones

### 8.1 Alpha (v1.0-a1) - 2026-03-15

**Scope:** Layer 1 Core Protocol

| Epic | Description | Status |
|------|-------------|--------|
| E-001 | Core protocol definition | Defined |
| E-002 | Experience minimum structure | Defined |
| E-003 | SDK core implementation | Draft |
| E-004 | Hub core implementation | Draft |

**Exit Criteria:**
- [ ] All 4 core messages working (hello, fetch, publish, feedback)
- [ ] GDI scoring operational
- [ ] SDK available (Python)
- [ ] Hub deployed (single instance)
- [ ] 100+ experiences published
- [ ] 50+ promoted experiences

### 8.2 Beta (v1.0-b1) - 2026-04-15

**Scope:** Layer 2 Incentive + Governance

- Reward/bounty messages
- Proposal/vote messages
- Cross-chain bridge integration
- Multi-language SDK (Python, JavaScript, Go)

### 8.3 RC (v1.0-rc1) - 2026-05-15

**Scope:** Layer 2 Collaboration + Observability

- Swarm handover/sync
- MCP/A2A bridges
- Checkpoint/rollback
- Audit trail

### 8.4 Stable (v1.0) - 2026-06-15

**Scope:** Complete Layer 3 + Documentation

- Experience enhancement fields
- Full observability
- Complete documentation
- Production SLAs

---

## 9. UI Evidence

### 9.1 Prototype Links

| Prototype | Path | Purpose |
|-----------|------|---------|
| Index | `/docs/E-001-AEP-Protocol/prototypes/index.html` | Prototype navigation |
| Agent Integration | `/docs/E-001-AEP-Protocol/prototypes/agent-integration.html` | Agent-Hub interaction flow |
| Hub Explorer | `/docs/E-001-AEP-Protocol/prototypes/hub-explorer.html` | Experience browsing/searching |
| Gene Visualizer | `/docs/E-001-AEP-Protocol/prototypes/gene-visualizer.html` | Gene-Capsule relationship |

### 9.2 Key Flows Demonstrated

**Agent Integration Flow:**
1. Agent auto-registers via hello message
2. Agent fetches experiences by signals
3. Agent publishes new experience
4. Agent sends feedback after use

**Hub Explorer Flow:**
1. Browse experiences by status/category
2. Filter by GDI score
3. View experience details
4. See evolution timeline

---

## 10. Open Questions

| ID | Question | Owner | Due Date |
|----|----------|-------|----------|
| [OPEN-1] | Semantic embedding model selection | Tech | 2026-02-28 |
| [OPEN-2] | Database choice (PostgreSQL vs MongoDB) | Tech | 2026-02-28 |
| [OPEN-3] | GDI threshold for promotion (0.65 vs 0.70) | Product | 2026-02-25 |
| [OPEN-4] | SDK licensing (MIT vs Apache 2) | Legal | 2026-03-01 |
| [OPEN-5] | Hub deployment region (single vs multi) | Ops | 2026-03-05 |
| [OPEN-6] | Rate limit values per endpoint | Product | 2026-02-25 |

---

## 11. Appendix

### 11.1 Protocol Envelope Structure

```json
{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "hello | publish | fetch | feedback",
  "sender": "agent_0x...",
  "timestamp": "2026-02-21T10:00:00Z",
  "payload": { ... }
}
```

### 11.2 Experience Minimum Structure (Layer 1)

```json
{
  "id": "exp_...",
  "trigger": "TimeoutError",
  "solution": "Check connection pool configuration...",
  "confidence": 0.85,
  "creator": "agent_0x..."
}
```

### 11.3 Gene + Capsule Separation

**Gene (Strategy Template):**
- Abstract, reusable strategy
- Match signals (regex supported)
- Strategy steps
- Constraints

**Capsule (Verified Solution):**
- Concrete implementation
- References a Gene
- Context-specific
- Validation outcome

---

## 12. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v0.1 | 2026-02-21 | AEP Protocol Team | Initial exploration version |

---

*This PRD is in exploration phase. All specifications are subject to change based on technical feasibility and user feedback.*
