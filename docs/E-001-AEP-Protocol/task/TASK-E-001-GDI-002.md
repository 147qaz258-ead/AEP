# TASK-E-001-GDI-002: Usage/Social/Freshness Calculator

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-005
> **Status:** done
> **Beads 任务ID:** agent network-fbl
> **依赖:** []

## 摘要

Implement the Usage, Social, and Freshness dimension calculators for the GDI scoring system. These secondary dimensions complement Quality by considering popularity, community validation, and recency.

## 验收标准

### Usage Dimension
- [x] AC-USAGE-001: Usage = log(total_uses + 1) / log(max_uses + 1)
- [x] AC-USAGE-002: Default max_uses = 100 (configurable)
- [x] AC-USAGE-003: Usage always in range [0, 1]
- [x] AC-USAGE-004: Zero uses returns 0.0

### Social Dimension
- [x] AC-SOCIAL-001: Social uses Wilson score lower bound (95% confidence)
- [x] AC-SOCIAL-002: Zero feedback returns 0.5 (neutral)
- [x] AC-SOCIAL-003: Wilson score provides stable estimates for small samples
- [x] AC-SOCIAL-004: Social always in range [0, 1]

### Freshness Dimension
- [x] AC-FRESH-001: Freshness = 0.5^(age_days / half_life_days)
- [x] AC-FRESH-002: Default half_life_days = 30 (configurable)
- [x] AC-FRESH-003: Zero age (today) returns 1.0
- [x] AC-FRESH-004: 30-day old experience returns 0.5
- [x] AC-FRESH-005: 60-day old experience returns 0.25

## 接口定义

### Calculator Interfaces

```python
@dataclass
class UsageResult:
    usage: float
    total_uses: int
    max_uses: int

@dataclass
class SocialResult:
    social: float
    positive: int
    total: int
    wilson_score: float

@dataclass
class FreshnessResult:
    freshness: float
    age_days: int
    half_life_days: float

class UsageCalculator:
    """Calculate Usage dimension for GDI."""

    def compute_usage(self, experience: Experience) -> UsageResult:
        """Compute Usage dimension score."""

class SocialCalculator:
    """Calculate Social dimension for GDI."""

    def compute_social(self, experience: Experience) -> SocialResult:
        """Compute Social dimension score using Wilson score."""

    def wilson_score_lower_bound(self, positive: int, total: int, confidence: float = 0.95) -> float:
        """Calculate Wilson score interval lower bound."""

class FreshnessCalculator:
    """Calculate Freshness dimension for GDI."""

    def compute_freshness(self, experience: Experience, half_life_days: float = 30.0) -> FreshnessResult:
        """Compute Freshness dimension score with exponential decay."""
```

## 实现笔记

### Usage Calculator (Pseudocode)

```python
import math

class UsageCalculator:
    """Calculate Usage dimension for GDI."""

    DEFAULT_MAX_USES = 100

    def compute_usage(self, experience: Experience) -> UsageResult:
        """
        Compute Usage dimension score with log normalization.

        Usage = log(total_uses + 1) / log(max_uses + 1)

        Logarithmic scaling prevents high-use experiences from
        dominating the score while still rewarding popularity.

        Examples:
          - 0 uses: 0.0
          - 1 use: 0.301 (log2/log101)
          - 10 uses: 0.5 (log11/log101)
          - 100 uses: 1.0 (log101/log101)
        """
        max_uses = self.DEFAULT_MAX_USES
        total_uses = experience.total_uses

        if total_uses == 0:
            usage = 0.0
        else:
            usage = math.log(total_uses + 1) / math.log(max_uses + 1)

        # Clamp to [0, 1]
        usage = max(0.0, min(1.0, usage))

        return UsageResult(
            usage=usage,
            total_uses=total_uses,
            max_uses=max_uses
        )
```

### Social Calculator (Pseudocode)

```python
import math
from scipy.stats import norm

class SocialCalculator:
    """Calculate Social dimension for GDI."""

    def compute_social(self, experience: Experience) -> SocialResult:
        """
        Compute Social dimension score using Wilson score interval.

        Wilson score provides a stable lower bound estimate of the
        true positive rate, accounting for sample size uncertainty.

        More stable than simple proportion for small samples.
        """
        positive = experience.positive_feedback or 0
        total = experience.total_feedback or 0

        if total == 0:
            # No feedback yet - return neutral score
            return SocialResult(
                social=0.5,
                positive=0,
                total=0,
                wilson_score=0.5
            )

        wilson_score = self.wilson_score_lower_bound(positive, total)

        return SocialResult(
            social=wilson_score,
            positive=positive,
            total=total,
            wilson_score=wilson_score
        )

    def wilson_score_lower_bound(self, positive: int, total: int, confidence: float = 0.95) -> float:
        """
        Wilson score interval lower bound.

        Provides a conservative estimate of the true proportion,
        accounting for sample size uncertainty.

        Args:
            positive: Number of positive outcomes
            total: Total number of outcomes
            confidence: Confidence level (default 0.95 for 95% CI)

        Returns:
            Lower bound of confidence interval (0.0 - 1.0)
        """
        if total == 0:
            return 0.0

        p = positive / total
        z = norm.ppf(1 - (1 - confidence) / 2)  # z-score for confidence level

        denominator = 1 + z**2 / total
        center = p + z**2 / (2 * total)
        width = z * math.sqrt((p * (1 - p) + z**2 / (4 * total)) / total)

        lower_bound = (center - width) / denominator
        return max(0.0, lower_bound)
```

### Freshness Calculator (Pseudocode)

```python
from datetime import datetime, timedelta

class FreshnessCalculator:
    """Calculate Freshness dimension for GDI."""

    DEFAULT_HALF_LIFE = 30.0  # days

    def compute_freshness(self, experience: Experience, half_life_days: float = 30.0) -> FreshnessResult:
        """
        Compute Freshness dimension score with exponential decay.

        Freshness = 0.5^(age_days / half_life_days)

        Exponential decay ensures recent experiences score higher,
        reflecting that solutions may become outdated over time.

        Half-life is the time for freshness to drop to 50%:
        - 0 days old: 1.0 (fresh)
        - 30 days old: 0.5 (half-life)
        - 60 days old: 0.25
        - 90 days old: 0.125
        """
        if experience.updated_at is None:
            age_days = 0
        else:
            age_delta = datetime.now() - experience.updated_at
            age_days = max(0, age_delta.days)

        if age_days <= 0:
            freshness = 1.0
        else:
            freshness = 0.5 ** (age_days / half_life_days)

        return FreshnessResult(
            freshness=freshness,
            age_days=age_days,
            half_life_days=half_life_days
        )
```

### Dimension Examples

**Usage Examples:**
| Total Uses | Usage Score |
|------------|-------------|
| 0 | 0.000 |
| 1 | 0.301 |
| 10 | 0.500 |
| 50 | 0.850 |
| 100 | 1.000 |

**Social Examples (Wilson Score):**
| Positive | Total | Wilson Score |
|----------|-------|--------------|
| 0 | 0 | 0.500 (neutral) |
| 1 | 1 | 0.207 |
| 5 | 5 | 0.562 |
| 8 | 10 | 0.547 |
| 10 | 10 | 0.722 |

**Freshness Examples (half_life = 30):**
| Age (days) | Freshness |
|------------|-----------|
| 0 | 1.000 |
| 7 | 0.851 |
| 14 | 0.724 |
| 30 | 0.500 |
| 60 | 0.250 |
| 90 | 0.125 |

## 技术约束

- **Usage**: Logarithmic scaling prevents dominance
- **Social**: Wilson score requires scipy.stats
- **Freshness**: Based on updated_at, not created_at
- **Performance**: < 1ms per calculation

## 验证方式

1. **Unit Tests**: Each calculator independently
2. **Edge Cases**: Zero values, max values
3. **Wilson Score Tests**: Verify statistical accuracy
4. **Decay Tests**: Verify exponential decay

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.2 GDI Calculator
- **STORY**: `../../_project/stories/STORY-005-gdi-scoring-system.md`

---

## 实现记录

### 实现位置

- **文件**: `src/aep/gdi/index.ts`
- **测试**: `src/aep/gdi/__tests__/gdiCalculator.test.ts`

### 实现说明

所有三个计算器已集成到 `GDICalculator` 类中：

1. **Usage Calculator** (`computeUsage` 方法, 行 200-204)
   - 公式: `log(total_uses + 1) / log(max_uses + 1)`
   - 默认 max_uses = 100 (可通过 `setGlobalMaxUses()` 配置)
   - 支持按类别配置不同的 max_uses (`setCategoryMaxUses()`)
   - 返回值范围 [0, 1]

2. **Social Calculator** (`computeSocial` 方法, 行 213-219)
   - 使用 Wilson score interval 下界 (95% 置信度)
   - 零反馈时返回 0.5 (中性)
   - Wilson score 实现在 `wilsonScoreLowerBound` 函数 (行 87-106)

3. **Freshness Calculator** (`computeFreshness` 方法, 行 229-240)
   - 公式: `0.5^(age_days / half_life_days)`
   - 默认 half_life = 30 天 (可配置)
   - 基于 `updated_at` 字段计算年龄

### 测试记录

- **测试命令**: `pnpm test src/aep/gdi/__tests__/gdiCalculator.test.ts`
- **测试结果**: 39 tests passed
- **覆盖范围**:
  - Usage: 4 tests (AC-USAGE-001 to AC-USAGE-004)
  - Social: 4 tests (AC-SOCIAL-001 to AC-SOCIAL-004)
  - Freshness: 4 tests (AC-FRESH-001 to AC-FRESH-005)
  - Performance: 2 tests (计算时间 < 10ms)
  - Edge Cases: 3 tests (零值、未来日期等)

### 性能验证

- 单次 GDI 计算: < 10ms
- 1000 次 GDI 计算: < 1s (平均 < 1ms/次)

### 完成时间

- **日期**: 2026-02-22
- **状态**: DONE
