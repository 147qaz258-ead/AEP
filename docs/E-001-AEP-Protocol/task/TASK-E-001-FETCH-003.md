# TASK-E-001-FETCH-003: GDI Scoring Engine

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-005
> **Status:** pending
> **Beads 任务ID:** agent network-3r0
> **依赖:** []

## 摘要

Implement the GDI (Global Desirability Index) Scoring Engine that calculates multi-dimensional quality scores using geometric mean. The engine computes Quality, Usage, Social, Freshness, and Confidence dimensions and aggregates them with weighted formula.

## 验收标准

- [ ] AC-GDI-001: Computes GDI using geometric mean formula with 5 dimensions
- [ ] AC-GDI-002: Quality dimension = confidence * success_rate * blast_safety
- [ ] AC-GDI-003: Usage dimension = log(total_uses + 1) / log(max_uses + 1)
- [ ] AC-GDI-004: Social dimension uses Wilson score interval for positive/total ratio
- [ ] AC-GDI-005: Freshness dimension = 0.5^(age_days / 30)
- [ ] AC-GDI-006: Confidence dimension = publisher's confidence
- [ ] AC-GDI-007: Weights: Quality=0.35, Usage=0.25, Social=0.15, Freshness=0.15, Confidence=0.10
- [ ] AC-GDI-008: GDI always in range [0, 1]
- [ ] AC-GDI-009: Calculation time < 10ms per experience

## 接口定义

### GDI Calculation Interface

```python
@dataclass
class GDIDimensions:
    quality: float      # 0.0 - 1.0
    usage: float        # 0.0 - 1.0
    social: float       # 0.0 - 1.0
    freshness: float    # 0.0 - 1.0
    confidence: float   # 0.0 - 1.0

@dataclass
class GDIResult:
    score: float              # Final GDI: 0.0 - 1.0
    dimensions: GDIDimensions
    calculated_at: datetime

class GDICalculator:
    """Calculate Global Desirability Index for experiences."""

    def compute_gdi(self, experience: Experience) -> GDIResult:
        """Compute GDI using multi-dimensional geometric mean."""

    def compute_quality(self, exp: Experience) -> float:
        """Quality = confidence * success_rate * blast_safety"""

    def compute_usage(self, exp: Experience) -> float:
        """Usage score with log normalization"""

    def compute_social(self, exp: Experience) -> float:
        """Social score using Wilson score interval"""

    def compute_freshness(self, exp: Experience, half_life_days: float = 30.0) -> float:
        """Freshness score with exponential decay"""

    def compute_blast_safety(self, blast_radius: BlastRadius) -> float:
        """Blast radius safety score (higher is safer)"""
```

## 实现笔记

### GDI Formula (Pseudocode)

```python
import math
from scipy.stats import norm

class GDICalculator:
    # Weights for each dimension
    WEIGHTS = {
        "quality": 0.35,
        "usage": 0.25,
        "social": 0.15,
        "freshness": 0.15,
        "confidence": 0.10
    }

    def compute_gdi(self, experience: Experience) -> GDIResult:
        """
        Compute Global Desirability Index using geometric mean.

        GDI = (Quality^w_q) * (Usage^w_u) * (Social^w_s) * (Freshness^w_f) * (Confidence^w_c)

        Geometric mean prevents one high dimension from masking problems.
        """
        dimensions = GDIDimensions(
            quality=self.compute_quality(experience),
            usage=self.compute_usage(experience),
            social=self.compute_social(experience),
            freshness=self.compute_freshness(experience),
            confidence=experience.confidence
        )

        # Geometric mean with weights
        gdi = (
            (dimensions.quality ** self.WEIGHTS["quality"]) *
            (dimensions.usage ** self.WEIGHTS["usage"]) *
            (dimensions.social ** self.WEIGHTS["social"]) *
            (dimensions.freshness ** self.WEIGHTS["freshness"]) *
            (dimensions.confidence ** self.WEIGHTS["confidence"])
        )

        # Ensure range [0, 1]
        gdi = max(0.0, min(1.0, gdi))

        return GDIResult(
            score=round(gdi, 4),
            dimensions=dimensions,
            calculated_at=datetime.now()
        )

    def compute_quality(self, exp: Experience) -> float:
        """Quality = confidence * success_rate * blast_safety"""
        base_confidence = exp.confidence

        # Success rate with Laplace smoothing
        success_rate = (exp.total_success + 1) / (exp.total_uses + 2)

        # Blast radius safety
        blast_safety = self.compute_blast_safety(exp.blast_radius)

        quality = base_confidence * success_rate * blast_safety
        return min(quality, 1.0)

    def compute_blast_safety(self, blast_radius: BlastRadius) -> float:
        """Blast radius safety score (higher is safer)"""
        MAX_FILES = 5
        MAX_LINES = 200

        file_safety = max(0, 1 - blast_radius.files / MAX_FILES)
        line_safety = max(0, 1 - blast_radius.lines / MAX_LINES)

        return (file_safety + line_safety) / 2

    def compute_usage(self, exp: Experience) -> float:
        """Usage score with log normalization"""
        max_uses = self._get_max_uses_in_category(exp.category)
        usage = math.log(exp.total_uses + 1) / math.log(max_uses + 1)
        return min(usage, 1.0)

    def compute_social(self, exp: Experience) -> float:
        """Social score using Wilson score interval"""
        if exp.total_feedback == 0:
            return 0.5  # Neutral if no feedback

        positive = exp.positive_feedback
        total = exp.total_feedback

        # Wilson score lower bound (95% confidence)
        return self._wilson_score_lower_bound(positive, total, confidence=0.95)

    def _wilson_score_lower_bound(self, positive: int, total: int, confidence: float = 0.95) -> float:
        """Wilson score interval lower bound for stable small-sample proportions"""
        if total == 0:
            return 0.0

        p = positive / total
        z = norm.ppf(1 - (1 - confidence) / 2)

        denominator = 1 + z**2 / total
        center = p + z**2 / (2 * total)
        width = z * math.sqrt((p * (1 - p) + z**2 / (4 * total)) / total)

        lower_bound = (center - width) / denominator
        return max(0.0, lower_bound)

    def compute_freshness(self, exp: Experience, half_life_days: float = 30.0) -> float:
        """Freshness score with exponential decay"""
        age_days = (datetime.now() - exp.updated_at).days

        if age_days <= 0:
            return 1.0

        freshness = 0.5 ** (age_days / half_life_days)
        return freshness
```

### Database Schema for GDI

```sql
ALTER TABLE experiences ADD COLUMN gdi_score DECIMAL(5,4);
ALTER TABLE experiences ADD COLUMN last_gdi_update TIMESTAMP;

-- Index for fast sorting
CREATE INDEX idx_gdi_score ON experiences(gdi_score DESC);

-- Statistics columns
ALTER TABLE experiences ADD COLUMN success_streak INTEGER DEFAULT 0;
ALTER TABLE experiences ADD COLUMN total_uses INTEGER DEFAULT 0;
ALTER TABLE experiences ADD COLUMN total_success INTEGER DEFAULT 0;
ALTER TABLE experiences ADD COLUMN total_feedback INTEGER DEFAULT 0;
ALTER TABLE experiences ADD COLUMN positive_feedback INTEGER DEFAULT 0;
ALTER TABLE experiences ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
```

## 技术约束

- **Precision**: GDI score rounded to 4 decimal places
- **Range**: Always [0, 1] after clamping
- **Performance**: < 10ms per calculation
- **Stability**: Same inputs produce same output

## 验证方式

1. **Unit Tests**: Each dimension calculation independently
2. **Formula Tests**: Verify geometric mean formula
3. **Edge Cases**: Zero feedback, new experiences, old experiences
4. **Performance Tests**: Calculation time under load

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.2 GDI Calculator
- **STORY**: `../../_project/stories/STORY-005-gdi-scoring-system.md`
