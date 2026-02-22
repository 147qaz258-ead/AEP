# TASK-E-001-GDI-001: Quality Calculator

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-005
> **Status:** pending
> **Beads 任务ID:** agent network-39c
> **依赖:** []

## 摘要

Implement the Quality dimension calculator for the GDI scoring system. The Quality dimension is the primary driver of GDI scores, combining base confidence, success rate, and blast radius safety.

## 验收标准

- [ ] AC-QUAL-001: Quality = confidence * success_rate * blast_safety
- [ ] AC-QUAL-002: Success rate uses Laplace smoothing: (total_success + 1) / (total_uses + 2)
- [ ] AC-QUAL-003: Blast safety = (file_safety + line_safety) / 2
- [ ] AC-QUAL-004: File safety = max(0, 1 - files / MAX_FILES)
- [ ] AC-QUAL-005: Line safety = max(0, 1 - lines / MAX_LINES)
- [ ] AC-QUAL-006: MAX_FILES = 5, MAX_LINES = 200
- [ ] AC-QUAL-007: Quality always in range [0, 1]
- [ ] AC-QUAL-008: Zero uses returns quality = confidence (no penalty)

## 接口定义

### Quality Calculator Interface

```python
@dataclass
class BlastRadius:
    files: int
    lines: int

@dataclass
class QualityResult:
    quality: float
    base_confidence: float
    success_rate: float
    blast_safety: float

class QualityCalculator:
    """Calculate Quality dimension for GDI."""

    MAX_FILES = 5
    MAX_LINES = 200

    def compute_quality(self, experience: Experience) -> QualityResult:
        """Compute Quality dimension score."""

    def compute_success_rate(self, total_success: int, total_uses: int) -> float:
        """Compute success rate with Laplace smoothing."""

    def compute_blast_safety(self, blast_radius: Optional[BlastRadius]) -> float:
        """Compute blast radius safety score."""

    def compute_file_safety(self, files: int) -> float:
        """Compute file safety component."""

    def compute_line_safety(self, lines: int) -> float:
        """Compute line safety component."""
```

## 实现笔记

### Quality Calculation (Pseudocode)

```python
class QualityCalculator:
    """Calculate Quality dimension for GDI."""

    MAX_FILES = 5
    MAX_LINES = 200

    def compute_quality(self, experience: Experience) -> QualityResult:
        """
        Compute Quality dimension score.

        Quality = confidence * success_rate * blast_safety

        This is the primary quality indicator:
        - High confidence: Publisher believes in the solution
        - High success_rate: Community validates the solution works
        - High blast_safety: Solution is low-risk (minimal code changes)
        """
        base_confidence = experience.confidence

        # Success rate with Laplace smoothing
        success_rate = self.compute_success_rate(
            experience.total_success,
            experience.total_uses
        )

        # Blast radius safety
        blast_safety = self.compute_blast_safety(experience.blast_radius)

        # Combined quality score
        quality = base_confidence * success_rate * blast_safety

        # Clamp to [0, 1]
        quality = max(0.0, min(1.0, quality))

        return QualityResult(
            quality=quality,
            base_confidence=base_confidence,
            success_rate=success_rate,
            blast_safety=blast_safety
        )

    def compute_success_rate(self, total_success: int, total_uses: int) -> float:
        """
        Compute success rate with Laplace smoothing.

        Laplace smoothing (add-one smoothing) prevents extreme values
        when sample size is small.

        Formula: (successes + 1) / (total + 2)

        Examples:
          - 0 uses: 0.5 (neutral starting point)
          - 1 success, 1 use: 2/3 = 0.667
          - 10 successes, 10 uses: 11/12 = 0.917
          - 0 successes, 10 uses: 1/12 = 0.083
        """
        return (total_success + 1) / (total_uses + 2)

    def compute_blast_safety(self, blast_radius: Optional[BlastRadius]) -> float:
        """
        Compute blast radius safety score.

        Higher is safer (fewer files/lines affected).
        Returns 1.0 if no blast radius specified (neutral).
        """
        if blast_radius is None:
            return 1.0

        file_safety = self.compute_file_safety(blast_radius.files)
        line_safety = self.compute_line_safety(blast_radius.lines)

        return (file_safety + line_safety) / 2

    def compute_file_safety(self, files: int) -> float:
        """
        Compute file safety component.

        Linear decay from 1.0 (0 files) to 0.0 (5+ files).
        """
        return max(0.0, 1.0 - files / self.MAX_FILES)

    def compute_line_safety(self, lines: int) -> float:
        """
        Compute line safety component.

        Linear decay from 1.0 (0 lines) to 0.0 (200+ lines).
        """
        return max(0.0, 1.0 - lines / self.MAX_LINES)
```

### Blast Safety Examples

| Files | Lines | File Safety | Line Safety | Blast Safety |
|-------|-------|-------------|-------------|--------------|
| 0 | 0 | 1.00 | 1.00 | 1.00 |
| 1 | 50 | 0.80 | 0.75 | 0.775 |
| 2 | 100 | 0.60 | 0.50 | 0.55 |
| 3 | 150 | 0.40 | 0.25 | 0.325 |
| 5 | 200 | 0.00 | 0.00 | 0.00 |
| 10 | 500 | 0.00 | 0.00 | 0.00 |

### Success Rate Examples (Laplace Smoothing)

| Successes | Uses | Raw Rate | Smoothed Rate |
|-----------|------|----------|---------------|
| 0 | 0 | N/A | 0.500 |
| 1 | 1 | 1.00 | 0.667 |
| 5 | 5 | 1.00 | 0.857 |
| 10 | 10 | 1.00 | 0.917 |
| 0 | 10 | 0.00 | 0.083 |
| 5 | 10 | 0.50 | 0.500 |
| 8 | 10 | 0.80 | 0.750 |

## 技术约束

- **Precision**: 4 decimal places
- **Range**: Always [0, 1] after clamping
- **Performance**: < 1ms per calculation

## 验证方式

1. **Unit Tests**: Each sub-component independently
2. **Edge Cases**: Zero uses, max blast radius
3. **Precision Tests**: Verify rounding
4. **Performance Tests**: Calculation time

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.2 GDI Calculator
- **STORY**: `../../_project/stories/STORY-005-gdi-scoring-system.md`
