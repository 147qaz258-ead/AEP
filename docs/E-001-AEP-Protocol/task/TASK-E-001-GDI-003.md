# TASK-E-001-GDI-003: GDI Aggregator

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-005
> **Status:** done
> **Beads 任务ID:** agent network-w8c
> **依赖:** [TASK-E-001-GDI-001, TASK-E-001-GDI-002]

## 摘要

Implement the GDI Aggregator that combines all five dimensions (Quality, Usage, Social, Freshness, Confidence) into a single Global Desirability Index score using weighted geometric mean. Provides the final ranking value for experiences.

## 验收标准

- [x] AC-AGG-001: GDI = (Quality^0.35) * (Usage^0.25) * (Social^0.15) * (Freshness^0.15) * (Confidence^0.10)
- [x] AC-AGG-002: All dimensions must be in range [0, 1]
- [x] AC-AGG-003: GDI always in range [0, 1]
- [x] AC-AGG-004: GDI rounded to 4 decimal places
- [x] AC-AGG-005: Initial GDI for new experience = 0.5 * confidence
- [x] AC-AGG-006: GDI calculation time < 10ms
- [x] AC-AGG-007: Weights are configurable via config file
- [x] AC-AGG-008: Geometric mean used instead of arithmetic mean

## 接口定义

### GDI Aggregator Interface

```python
@dataclass
class GDIDimensions:
    quality: float      # Weight: 0.35
    usage: float        # Weight: 0.25
    social: float       # Weight: 0.15
    freshness: float    # Weight: 0.15
    confidence: float   # Weight: 0.10

@dataclass
class GDIResult:
    score: float                    # Final GDI: 0.0 - 1.0
    dimensions: GDIDimensions
    weights: Dict[str, float]
    calculated_at: datetime

class GDIAggregator:
    """Aggregate GDI dimensions into final score."""

    DEFAULT_WEIGHTS = {
        "quality": 0.35,
        "usage": 0.25,
        "social": 0.15,
        "freshness": 0.15,
        "confidence": 0.10
    }

    def compute_gdi(self, experience: Experience) -> GDIResult:
        """Compute final GDI score from all dimensions."""

    def compute_initial_gdi(self, confidence: float) -> float:
        """Compute initial GDI for newly published experience."""

    def validate_dimensions(self, dimensions: GDIDimensions) -> bool:
        """Validate all dimensions are in valid range."""
```

## 实现笔记

### GDI Aggregator (Pseudocode)

```python
from datetime import datetime
from typing import Dict

class GDIAggregator:
    """Aggregate GDI dimensions into final score."""

    DEFAULT_WEIGHTS = {
        "quality": 0.35,
        "usage": 0.25,
        "social": 0.15,
        "freshness": 0.15,
        "confidence": 0.10
    }

    def __init__(self, config: Optional[Dict] = None):
        """Initialize with optional custom weights."""
        self.weights = config.get("weights", self.DEFAULT_WEIGHTS) if config else self.DEFAULT_WEIGHTS
        self._validate_weights()

    def _validate_weights(self) -> None:
        """Validate weights sum to 1.0."""
        total = sum(self.weights.values())
        if abs(total - 1.0) > 0.001:
            raise ValueError(f"Weights must sum to 1.0, got {total}")

    def compute_gdi(self, experience: Experience) -> GDIResult:
        """
        Compute final GDI score using weighted geometric mean.

        GDI = (Quality^w_q) * (Usage^w_u) * (Social^w_s) * (Freshness^w_f) * (Confidence^w_c)

        Geometric mean is used instead of arithmetic mean to:
        - Prevent one high dimension from masking problems in others
        - Ensure all dimensions contribute proportionally
        - Penalize experiences with any very low dimension

        Example:
          Arithmetic: (0.9 + 0.9 + 0.9 + 0.1 + 0.9) / 5 = 0.74
          Geometric: (0.9 * 0.9 * 0.9 * 0.1 * 0.9)^(1/5) = 0.62

        The geometric mean more accurately reflects the low Social score.
        """
        # 1. Compute each dimension
        quality_result = self.quality_calculator.compute_quality(experience)
        usage_result = self.usage_calculator.compute_usage(experience)
        social_result = self.social_calculator.compute_social(experience)
        freshness_result = self.freshness_calculator.compute_freshness(experience)

        dimensions = GDIDimensions(
            quality=quality_result.quality,
            usage=usage_result.usage,
            social=social_result.social,
            freshness=freshness_result.freshness,
            confidence=experience.confidence
        )

        # 2. Validate all dimensions in [0, 1]
        if not self.validate_dimensions(dimensions):
            raise ValueError("All dimensions must be in range [0, 1]")

        # 3. Compute weighted geometric mean
        gdi = (
            (dimensions.quality ** self.weights["quality"]) *
            (dimensions.usage ** self.weights["usage"]) *
            (dimensions.social ** self.weights["social"]) *
            (dimensions.freshness ** self.weights["freshness"]) *
            (dimensions.confidence ** self.weights["confidence"])
        )

        # 4. Clamp to [0, 1] and round
        gdi = max(0.0, min(1.0, gdi))
        gdi = round(gdi, 4)

        return GDIResult(
            score=gdi,
            dimensions=dimensions,
            weights=self.weights.copy(),
            calculated_at=datetime.now()
        )

    def compute_initial_gdi(self, confidence: float) -> float:
        """
        Compute initial GDI for newly published experience.

        Initial GDI = 0.5 * confidence

        This provides a conservative starting point that:
        - Uses publisher's confidence as a baseline
        - Scales down to avoid over-ranking unvalidated experiences
        - Awaits community feedback for true GDI calculation

        Examples:
          - confidence = 1.0 -> initial GDI = 0.50
          - confidence = 0.8 -> initial GDI = 0.40
          - confidence = 0.5 -> initial GDI = 0.25
        """
        initial_gdi = 0.5 * confidence
        return round(initial_gdi, 4)

    def validate_dimensions(self, dimensions: GDIDimensions) -> bool:
        """Validate all dimensions are in valid range [0, 1]."""
        for name, value in [
            ("quality", dimensions.quality),
            ("usage", dimensions.usage),
            ("social", dimensions.social),
            ("freshness", dimensions.freshness),
            ("confidence", dimensions.confidence)
        ]:
            if value < 0.0 or value > 1.0:
                return False
        return True
```

### GDI Calculation Examples

**Example 1: High-quality, well-used experience**
```
Dimensions:
  Quality:    0.85 (high success rate, safe blast radius)
  Usage:      0.70 (50+ uses)
  Social:     0.80 (mostly positive feedback)
  Freshness:  0.90 (updated recently)
  Confidence: 0.95 (publisher very confident)

GDI = (0.85^0.35) * (0.70^0.25) * (0.80^0.15) * (0.90^0.15) * (0.95^0.10)
    = 0.9421 * 0.9147 * 0.9670 * 0.9845 * 0.9949
    = 0.8132
```

**Example 2: New experience (no feedback)**
```
Dimensions:
  Quality:    0.43 (initial: 0.5 * confidence, no success data)
  Usage:      0.00 (no uses)
  Social:     0.50 (neutral, no feedback)
  Freshness:  1.00 (brand new)
  Confidence: 0.85

GDI = (0.43^0.35) * (0.00^0.25) * (0.50^0.15) * (1.00^0.15) * (0.85^0.10)
    = 0.7756 * 0.0000 * 0.8966 * 1.0000 * 0.9836
    = 0.0000  (Usage = 0 drives GDI to 0)

Initial GDI instead: 0.5 * 0.85 = 0.4250
```

**Example 3: Outdated but once-popular experience**
```
Dimensions:
  Quality:    0.80 (was successful)
  Usage:      0.90 (many uses)
  Social:     0.75 (good feedback)
  Freshness:  0.25 (90 days old)
  Confidence: 0.90

GDI = (0.80^0.35) * (0.90^0.25) * (0.75^0.15) * (0.25^0.15) * (0.90^0.10)
    = 0.9203 * 0.9740 * 0.9561 * 0.7763 * 0.9895
    = 0.6517  (Freshness penalty reduces score)
```

## 技术约束

- **Geometric Mean**: All dimensions must be > 0 for valid result
- **Initial GDI**: Used when Usage = 0 to avoid division issues
- **Rounding**: 4 decimal places for precision
- **Performance**: < 10ms per calculation

## 验证方式

1. **Unit Tests**: Dimension aggregation formula
2. **Edge Cases**: Zero usage, max dimensions
3. **Comparison Tests**: Geometric vs arithmetic mean
4. **Performance Tests**: Calculation time

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.2 GDI Calculator
- **STORY**: `../../_project/stories/STORY-005-gdi-scoring-system.md`

---

## 实现记录

### 实现说明

GDI Aggregator 已在 `src/aep/gdi/index.ts` 中完整实现。核心类 `GDICalculator` 提供以下功能：

1. **computeGDI(exp)**: 计算完整的 GDI 分数
   - 使用加权几何平均：`(Q^0.35) * (U^0.25) * (S^0.15) * (F^0.15) * (C^0.10)`
   - 自动处理零值（使用 epsilon 避免NaN）
   - 返回 4 位小数精度

2. **computeInitialGDI(confidence)**: 计算新发布 Experience 的初始 GDI
   - 公式：`0.5 * confidence`
   - 用于避免零使用量导致的 GDI=0 问题

3. **validateDimensions(dimensions)**: 验证所有维度值在 [0, 1] 范围内

4. **可配置权重**:
   - 构造函数支持自定义权重
   - 自动验证权重总和为 1.0
   - 支持 getWeights() 和 updateWeights() 方法

### 关键代码位置

- **主实现**: `src/aep/gdi/index.ts`
  - `GDICalculator` 类 (L147-L396)
  - `computeGDI()` (L316-L349)
  - `computeInitialGDI()` (L392-L395)
  - `validateDimensions()` (L357-L372)
  - `getWeights()` / `updateWeights()` (L180-L193)

- **测试**: `src/aep/gdi/__tests__/gdiCalculator.test.ts`
  - AC-AGG-005: Initial GDI 测试 (L497-L523)
  - AC-AGG-002: Dimension validation 测试 (L525-L558)
  - AC-AGG-007: Configurable weights 测试 (L560-L617)

### 测试结果

所有 53 个测试用例通过：

```
✓ src/aep/gdi/__tests__/gdiCalculator.test.ts (53 tests) 28ms
  Test Files  1 passed (1)
  Tests  53 passed (53)
```

关键测试覆盖：
- AC-AGG-001 ~ AC-AGG-008 全部通过
- 性能测试：< 10ms 单次计算，1000 次计算 < 1 秒
- 边界测试：零值、负值、超范围值处理
- 几何平均 vs 算术平均对比验证
