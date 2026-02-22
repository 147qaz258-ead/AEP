# STORY-005: GDI Scoring System

> **EPIC_ID:** E-001
>
> **EPIC_DIR:** E-001-AEP-Protocol
>
> **PRD Reference:** `../prd-v0.md#f5-gdi-global-desirability-index`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** Backend Service

---

## User Story

**As a** Hub Operator,

**I want** a multi-dimensional scoring system to rank experiences,

**So that** agents receive the highest quality solutions first.

---

## Background & Motivation

The GDI (Global Desirability Index) is the core quality metric in AEP. It determines which experiences appear first in search results and which experiences get promoted to "trusted" status. Without GDI, the system would have no way to distinguish high-quality experiences from low-quality ones.

**Design Principle:** "Accuracy as primary, iterability as mandatory" (from biz-overview §13.1)

---

## Main Path (Happy Path)

### Step 1: Initial GDI Calculation

1. Experience is published (status: candidate)
2. Initial GDI calculated from publisher's confidence
3. Initial GDI: `0.5 * confidence` (conservative starting point)

### Step 2: Feedback-Driven Updates

1. Agent submits feedback for experience
2. Hub updates experience statistics (uses, successes, streak)
3. Hub recalculates GDI using multi-dimensional formula
4. GDI stored with timestamp

### Step 3: Ranking Application

1. Agent sends fetch request
2. Hub matches experiences by signals
3. Hub sorts results by GDI score (descending)
4. Top N experiences returned

---

## State Machine

### GDI Score Evolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GDI Score Lifecycle                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Initial State                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  GDI = 0.5 * confidence                                              │  │
│  │  Example: confidence=0.85 → GDI = 0.425                              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  After First Feedback (Success)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  GDI = geometric_mean(Quality, Usage, Social, Freshness, Conf)      │  │
│  │  - Quality: ↑ (first success)                                       │  │
│  │  - Usage: ↑ (first use)                                              │  │
│  │  - Social: 0.5 (neutral)                                             │  │
│  │  - Freshness: 1.0 (brand new)                                        │  │
│  │  - Confidence: publisher's value                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  After N Feedbacks                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  GDI stabilizes around true quality                                  │  │
│  │  - Success rate determines Quality dimension                         │  │
│  │  - Total uses determine Usage dimension                              │  │
│  │  - Positive/negative ratio determines Social dimension               │  │
│  │  - Age determines Freshness dimension                                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria (AC)

### Functional AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-5.1 | GDI calculated on every feedback | Integration test: Verify GDI changes after feedback |
| AC-5.2 | GDI always in range [0, 1] | Unit test: Boundary conditions |
| AC-5.3 | Higher success rate → higher GDI | Unit test: Compare same exp with different success rates |
| AC-5.4 | Higher usage → higher GDI (up to a point) | Unit test: Verify usage dimension |
| AC-5.5 | Newer experiences → higher GDI | Unit test: Verify freshness decay |
| AC-5.6 | GDI calculation completes in < 10ms | Performance test: Measure compute time |
| AC-5.7 | Results sorted by GDI descending | Integration test: Fetch returns sorted results |

### Dimension-Specific AC

| ID | Dimension | Criteria | Test Method |
|----|-----------|----------|-------------|
| AC-5.8 | Quality | quality = confidence * success_rate * blast_safety | Unit test: Verify formula |
| AC-5.9 | Usage | usage = log(total_uses + 1) / log(max_uses + 1) | Unit test: Verify formula |
| AC-5.10 | Social | social = Wilson score (positive/total) | Unit test: Verify formula |
| AC-5.11 | Freshness | freshness = 0.5^(age_days / 30) | Unit test: Verify decay |
| AC-5.12 | Confidence | confidence = publisher's confidence | Unit test: Verify field used |

---

## GDI Calculation Formula

### Multi-Dimensional Formula

```
GDI = (Quality^w_q) * (Usage^w_u) * (Social^w_s) * (Freshness^w_f) * (Confidence^w_c)

Weights:
  w_q = 0.35 (Quality)
  w_u = 0.25 (Usage)
  w_s = 0.15 (Social)
  w_f = 0.15 (Freshness)
  w_c = 0.10 (Confidence)
```

### Dimension Calculations

```python
def compute_gdi(experience: Experience) -> float:
    """
    Compute Global Desirability Index using geometric mean.

    Geometric mean is used instead of arithmetic mean to prevent
    one high dimension from masking problems in other dimensions.
    """

    # 1. Quality Dimension (35%)
    quality = compute_quality(experience)

    # 2. Usage Dimension (25%)
    usage = compute_usage(experience)

    # 3. Social Dimension (15%)
    social = compute_social(experience)

    # 4. Freshness Dimension (15%)
    freshness = compute_freshness(experience)

    # 5. Confidence Dimension (10%)
    confidence = experience.confidence

    # Weights
    w_q, w_u, w_s, w_f, w_c = 0.35, 0.25, 0.15, 0.15, 0.10

    # Geometric mean (only valid if all values > 0)
    gdi = (
        (quality ** w_q) *
        (usage ** w_u) *
        (social ** w_s) *
        (freshness ** w_f) *
        (confidence ** w_c)
    )

    return round(gdi, 4)


def compute_quality(exp: Experience) -> float:
    """Quality = base_confidence * success_rate * blast_safety"""
    base_confidence = exp.confidence

    # Success rate with Laplace smoothing
    success_rate = (exp.total_success + 1) / (exp.total_uses + 2)

    # Blast radius safety (lower is better)
    blast_safety = compute_blast_safety(exp.blast_radius)

    quality = base_confidence * success_rate * blast_safety
    return min(quality, 1.0)


def compute_blast_safety(blast_radius: BlastRadius) -> float:
    """Blast radius safety score (0-1, higher is safer)"""
    MAX_FILES = 5
    MAX_LINES = 200

    file_safety = max(0, 1 - blast_radius.files / MAX_FILES)
    line_safety = max(0, 1 - blast_radius.lines / MAX_LINES)

    return (file_safety + line_safety) / 2


def compute_usage(exp: Experience) -> float:
    """Usage score with log normalization"""
    max_uses = get_max_uses_in_category(exp.category)
    usage = math.log(exp.total_uses + 1) / math.log(max_uses + 1)
    return min(usage, 1.0)


def compute_social(exp: Experience) -> float:
    """Social score using Wilson score interval"""
    if exp.total_feedback == 0:
        return 0.5  # Neutral if no feedback

    positive = exp.positive_feedback
    total = exp.total_feedback

    # Wilson score lower bound
    social = wilson_score_lower_bound(positive, total)
    return social


def compute_freshness(exp: Experience, half_life_days: float = 30.0) -> float:
    """Freshness score with exponential decay"""
    age_days = (datetime.now() - exp.updated_at).days

    if age_days <= 0:
        return 1.0

    freshness = 0.5 ** (age_days / half_life_days)
    return freshness
```

---

## Promotion and Deprecation Rules

### Promotion Criteria (candidate -> promoted)

| Criterion | Threshold | Description |
|-----------|-----------|-------------|
| success_streak | >= 2 | Consecutive successful uses |
| confidence | >= 0.70 | Publisher's confidence |
| gdi_score | >= 0.65 | Current GDI score |
| total_uses | >= 3 | Minimum usage count |
| blast_radius_safe | True | Files <= 5, Lines <= 200 |

```python
def should_promote(exp: Experience) -> bool:
    checks = [
        exp.success_streak >= 2,
        exp.confidence >= 0.70,
        exp.gdi_score >= 0.65,
        exp.total_uses >= 3,
        is_blast_radius_safe(exp.blast_radius),
    ]
    return all(checks)
```

### Deprecation Criteria (promoted -> deprecated)

| Criterion | Threshold | Description |
|-----------|-----------|-------------|
| consecutive_failures | >= 3 | Consecutive failed uses |
| gdi_score | < 0.30 | Sustained low GDI |
| success_rate | < 0.20 | Below 20% success (after 5+ uses) |
| age_without_use | > 90 days | No usage in 90 days |

```python
def should_deprecate(exp: Experience) -> bool:
    # Rule 1: Consecutive failures
    if exp.consecutive_failures >= 3:
        return True

    # Rule 2: Sustained low GDI
    if exp.total_uses >= 10 and exp.gdi_score < 0.30:
        return True

    # Rule 3: Low success rate
    if exp.total_uses >= 5:
        success_rate = exp.total_success / exp.total_uses
        if success_rate < 0.20:
            return True

    # Rule 4: No recent usage
    age_days = (datetime.now() - exp.last_used_at).days
    if age_days > 90:
        return True

    return False
```

---

## Boundary & Exception Cases

### New Experience (Zero Feedback)

- **Initial GDI:** `0.5 * confidence`
- **Behavior:** Conservative starting point, awaits validation

### All Failures

- **Scenario:** 100% failure rate after 5+ uses
- **Behavior:** GDI approaches 0, triggers deprecation

### High Variance

- **Scenario:** Alternating success/failure
- **Behavior:** GDI reflects actual success rate

### Old Experience

- **Scenario:** 90+ days since last use
- **Behavior:** Freshness decay drives GDI down

### Viral Success

- **Scenario:** Sudden spike in usage and success
- **Behavior:** GDI rises quickly, rapid promotion

---

## Technical Notes

### Wilson Score Implementation

```python
import math
from scipy.stats import norm

def wilson_score_lower_bound(positive: int, total: int, confidence: float = 0.95) -> float:
    """
    Wilson score interval lower bound.

    More stable than simple proportion for small sample sizes.
    """
    if total == 0:
        return 0.0

    p = positive / total
    z = norm.ppf(1 - (1 - confidence) / 2)

    denominator = 1 + z**2 / total
    center = p + z**2 / (2 * total)
    width = z * math.sqrt((p * (1 - p) + z**2 / (4 * total)) / total)

    lower_bound = (center - width) / denominator
    return max(0.0, lower_bound)
```

### GDI Configuration

```yaml
# gdi_config.yaml

gdi:
  weights:
    quality: 0.35
    usage: 0.25
    social: 0.15
    freshness: 0.15
    confidence: 0.10

  half_life_days:
    default: 30
    error_signal: 14      # Faster decay for error-related
    feature_signal: 60    # Slower decay for feature-related

promotion:
  success_streak: 2
  min_confidence: 0.70
  min_gdi: 0.65
  min_uses: 3
  max_blast_files: 5
  max_blast_lines: 200

deprecation:
  consecutive_failures: 3
  low_gdi_threshold: 0.30
  low_success_rate: 0.20
  max_age_days: 90
```

---

## Dependencies

| Story | Dependency Type | Description |
|-------|----------------|-------------|
| STORY-003 | Upstream | Published experiences need initial GDI |
| STORY-004 | Upstream | Feedback triggers GDI recalculation |
| STORY-006 | Data | Signal matching affects GDI via success_rate |

---

## UI Evidence

**Prototype:** `/docs/E-001-AEP-Protocol/prototypes/hub-explorer.html`

**Key Interaction:**
- Experience list shows GDI score in metadata
- Detail panel shows GDI progress bar
- Color coding: Red (<0.4), Yellow (0.4-0.7), Green (>0.7)
- Stats row shows average GDI across all experiences

---

## Implementation Notes

### Performance Targets

| Metric | Target |
|--------|--------|
| GDI calculation time | < 10ms |
| Batch update (1000 experiences) | < 5 seconds |
| Daily GDI refresh job | < 5 minutes |

### Storage

```sql
-- GDI fields in experiences table
ALTER TABLE experiences ADD COLUMN gdi_score DECIMAL(5,4);
ALTER TABLE experiences ADD COLUMN last_gdi_update TIMESTAMP;

-- Index for fast sorting
CREATE INDEX idx_gdi_score ON experiences(gdi_score DESC);
```

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-5.1] | Should weights be configurable per Hub? | Product | 2026-02-28 |
| [OPEN-5.2] | How to handle category-specific GDI normalization? | Tech | 2026-02-28 |
| [OPEN-5.3] | Should GDI be recalculated periodically even without feedback? | Tech | 2026-02-28 |
| [OPEN-5.4] | Min samples before GDI is considered "stable"? | Product | 2026-02-25 |

---

## References

- **Biz-Overview:** `/docs/_project/biz-overview.md` §13 GEP Mechanism Implementation
- **PRD:** `../prd-v0.md#f5-gdi-global-desirability-index`
- **Wilson Score:** https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval

---

*Last Updated: 2026-02-21*
