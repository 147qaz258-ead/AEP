# TASK-E-001-SIG-003: Three-Tier Matcher

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-006
> **Status:** done
> **Beads 任务ID:** agent network-3jn
> **依赖:** []

## 摘要

Implement the Three-Tier Matcher that combines exact signal matching (inverted index), semantic matching (vector embeddings), and context weighting to provide comprehensive experience matching with configurable thresholds.

## 验收标准

- [x] AC-MATCH-001: Tier 1: Exact signal matching via inverted index
- [x] AC-MATCH-002: Tier 2: Semantic matching via vector embeddings (pgvector)
- [x] AC-MATCH-003: Tier 3: Context weighting for domain/model compatibility
- [x] AC-MATCH-004: Semantic similarity threshold >= 0.75
- [x] AC-MATCH-005: Jaccard similarity threshold >= 0.34
- [x] AC-MATCH-006: Combines results from all tiers without duplicates
- [x] AC-MATCH-007: Ranks combined results by GDI score
- [x] AC-MATCH-008: Total matching time < 100ms (p95)

## 接口定义

### Three-Tier Matcher Interface

```python
@dataclass
class MatchRequest:
    signals: List[Signal]
    limit: int
    context: Optional[MatchContext]
    include_candidates: bool = False

@dataclass
class MatchContext:
    domain: Optional[str]      # e.g., "api", "database", "frontend"
    model: Optional[str]       # e.g., "claude-3", "gpt-4"
    language: Optional[str]    # e.g., "python", "javascript"

@dataclass
class MatchResult:
    experience: Experience
    match_score: float
    match_type: str           # "exact", "semantic", "hybrid"
    match_tier: int           # 1, 2, or 3
    signals_matched: List[str]

class ThreeTierMatcher:
    """Three-tier experience matching system."""

    def match(self, request: MatchRequest) -> List[MatchResult]:
        """Find matching experiences using all three tiers."""

    def exact_match(self, signals: List[Signal]) -> List[MatchResult]:
        """Tier 1: Exact signal matching via inverted index."""

    def semantic_match(self, signals: List[Signal], threshold: float = 0.75) -> List[MatchResult]:
        """Tier 2: Semantic matching via vector embeddings."""

    def context_weight(self, results: List[MatchResult], context: MatchContext) -> List[MatchResult]:
        """Tier 3: Apply context-based weighting."""

    def combine_results(self, exact: List[MatchResult], semantic: List[MatchResult]) -> List[MatchResult]:
        """Combine and deduplicate results from multiple tiers."""
```

## 实现笔记

### Three-Tier Matcher (Pseudocode)

```python
from typing import List, Optional
import numpy as np

class ThreeTierMatcher:
    """Three-tier experience matching system."""

    SEMANTIC_THRESHOLD = 0.75
    JACCARD_THRESHOLD = 0.34

    def __init__(self, index_querier, vector_store, experience_store):
        self.index_querier = index_querier
        self.vector_store = vector_store
        self.experience_store = experience_store

    def match(self, request: MatchRequest) -> List[MatchResult]:
        """
        Find matching experiences using all three tiers.

        Strategy:
        1. Tier 1 (Exact): Fast inverted index lookup
        2. Tier 2 (Semantic): Vector similarity if Tier 1 insufficient
        3. Tier 3 (Context): Apply domain/model weighting
        4. Combine, deduplicate, rank by GDI
        """
        candidates = []

        # Tier 1: Exact match (highest priority)
        exact_results = self.exact_match(request.signals)
        candidates.extend(exact_results)

        # Tier 2: Semantic match (if not enough results)
        if len(candidates) < request.limit:
            semantic_results = self.semantic_match(request.signals)
            candidates.extend(semantic_results)

        # Tier 3: Context weighting
        if request.context:
            candidates = self.context_weight(candidates, request.context)

        # Combine and deduplicate
        combined = self.combine_results(exact_results,
                                        semantic_results if len(candidates) < request.limit else [])

        # Rank by GDI score
        ranked = sorted(combined, key=lambda x: x.experience.gdi_score, reverse=True)

        # Apply status filter
        if not request.include_candidates:
            ranked = [r for r in ranked if r.experience.status == "promoted"]

        return ranked[:request.limit]

    def exact_match(self, signals: List[Signal]) -> List[MatchResult]:
        """
        Tier 1: Exact signal matching via inverted index.

        Uses inverted index for O(1) signal lookup.
        Most reliable matching method.
        """
        signal_keys = [self._make_signal_key(s) for s in signals]

        # Query inverted index
        exp_ids = self.index_querier.multi_query(signal_keys)

        results = []
        for exp_id in exp_ids:
            exp = self.experience_store.get(exp_id)
            if exp:
                score = self._compute_exact_score(signals, exp)
                signals_matched = self._get_matched_signals(signals, exp)

                results.append(MatchResult(
                    experience=exp,
                    match_score=score,
                    match_type="exact",
                    match_tier=1,
                    signals_matched=signals_matched
                ))

        return results

    def semantic_match(self, signals: List[Signal], threshold: float = 0.75) -> List[MatchResult]:
        """
        Tier 2: Semantic matching via vector embeddings.

        Uses pgvector for similarity search.
        Catches conceptually similar but textually different errors.
        """
        # Build query text from signals
        query_text = " ".join(s.value for s in signals)

        # Get query embedding
        query_embedding = self.vector_store.get_embedding(query_text)

        # Query vector index
        vector_results = self.vector_store.query(
            query_embedding,
            threshold=threshold,
            limit=50
        )

        results = []
        for vr in vector_results:
            exp = self.experience_store.get(vr.experience_id)
            if exp:
                results.append(MatchResult(
                    experience=exp,
                    match_score=vr.similarity,
                    match_type="semantic",
                    match_tier=2,
                    signals_matched=[]
                ))

        return results

    def context_weight(self, results: List[MatchResult], context: MatchContext) -> List[MatchResult]:
        """
        Tier 3: Apply context-based weighting.

        Boosts scores for experiences matching the request context.
        """
        weighted = []
        for result in results:
            weight = 1.0
            exp = result.experience

            # Domain matching
            if context.domain and exp.context:
                if exp.context.get("domain") == context.domain:
                    weight *= 1.2

            # Language matching
            if context.language and exp.context:
                if exp.context.get("language") == context.language:
                    weight *= 1.15

            # Model compatibility (optional)
            if context.model and exp.context:
                compatible_models = exp.context.get("compatible_models", [])
                if context.model in compatible_models:
                    weight *= 1.1

            # Apply weight to score
            result.match_score *= weight
            weighted.append(result)

        return weighted

    def combine_results(self, exact: List[MatchResult], semantic: List[MatchResult]) -> List[MatchResult]:
        """Combine and deduplicate results from multiple tiers."""
        seen = set()
        combined = []

        # Add exact matches first (higher priority)
        for result in exact:
            if result.experience.id not in seen:
                seen.add(result.experience.id)
                combined.append(result)

        # Add semantic matches
        for result in semantic:
            if result.experience.id not in seen:
                seen.add(result.experience.id)
                combined.append(result)

        return combined

    def _compute_exact_score(self, signals: List[Signal], exp: Experience) -> float:
        """Compute exact match score based on signal overlap."""
        score = 0.0

        for signal in signals:
            # Signal in trigger text
            if signal.matches(exp.trigger):
                score += signal.weight

            # Signal in signals_match array
            if signal.in_list(exp.signals_match):
                score += signal.weight * 0.8

        # Jaccard similarity bonus
        signal_set = set(self._make_signal_key(s) for s in signals)
        exp_set = set(s.lower() for s in exp.signals_match)

        if signal_set or exp_set:
            intersection = len(signal_set & exp_set)
            union = len(signal_set | exp_set)
            jaccard = intersection / union if union > 0 else 0

            if jaccard >= self.JACCARD_THRESHOLD:
                score += jaccard

        return score

    def _get_matched_signals(self, signals: List[Signal], exp: Experience) -> List[str]:
        """Get list of signals that matched the experience."""
        matched = []
        for signal in signals:
            if signal.matches(exp.trigger) or signal.in_list(exp.signals_match):
                matched.append(signal.value)
        return matched

    def _make_signal_key(self, signal: Signal) -> str:
        """Create normalized signal key."""
        return f"{signal.type}:{signal.value.lower()}"
```

### Matching Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    Three-Tier Matching Flow                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Input: signals[], context                                     │
│      │                                                         │
│      ▼                                                         │
│  ┌─────────────────────────────────────────┐                  │
│  │  Tier 1: Exact Match (Inverted Index)   │                  │
│  │  - O(1) signal lookup                   │                  │
│  │  - Highest confidence                   │                  │
│  │  - Fast (5-20ms)                        │                  │
│  └─────────────────────────────────────────┘                  │
│      │                                                         │
│      ├─── Sufficient results? ──▶ Skip Tier 2                  │
│      │                                                         │
│      ▼                                                         │
│  ┌─────────────────────────────────────────┐                  │
│  │  Tier 2: Semantic Match (Vector Store)  │                  │
│  │  - pgvector similarity search           │                  │
│  │  - Threshold >= 0.75                    │                  │
│  │  - Slower (20-50ms)                     │                  │
│  └─────────────────────────────────────────┘                  │
│      │                                                         │
│      ▼                                                         │
│  ┌─────────────────────────────────────────┐                  │
│  │  Tier 3: Context Weighting              │                  │
│  │  - Domain: 1.2x                         │                  │
│  │  - Language: 1.15x                      │                  │
│  │  - Model: 1.1x                          │                  │
│  └─────────────────────────────────────────┘                  │
│      │                                                         │
│      ▼                                                         │
│  ┌─────────────────────────────────────────┐                  │
│  │  Combine, Deduplicate, Rank by GDI      │                  │
│  └─────────────────────────────────────────┘                  │
│      │                                                         │
│      ▼                                                         │
│  Output: MatchResult[]                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## 技术约束

- **Exact Match**: Inverted index lookup
- **Semantic Match**: pgvector with cosine similarity
- **Thresholds**: Semantic >= 0.75, Jaccard >= 0.34
- **Performance**: Total < 100ms (p95)

## 验证方式

1. **Unit Tests**: Each tier independently
2. **Integration Tests**: End-to-end matching
3. **Threshold Tests**: Verify threshold behavior
4. **Performance Tests**: Latency under load

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §1.2 Sequence Diagram
- **STORY**: `../../_project/stories/STORY-006-signal-extraction-matching.md`

---

## 实现记录

### 实现概述

在 `src/aep/matcher/threeTierMatcher.ts` 中实现了完整的三层匹配器：

**核心文件**:
- `src/aep/matcher/threeTierMatcher.ts` - ThreeTierMatcher 类及辅助函数
- `src/aep/matcher/index.ts` - 重新导出 ThreeTierMatcher

**关键实现**:

1. **Tier 1 (Exact Match)**: `exactMatch()` / `exactMatchFromList()`
   - 使用信号键进行精确匹配
   - 支持 trigger 文本和 signals_match 数组匹配
   - 返回 match_tier: 1

2. **Tier 2 (Semantic Match)**: `semanticMatch()` / `textSimilarityMatch()`
   - 向量存储查询或 Jaccard 相似度匹配
   - 阈值: 0.75 (AC-MATCH-004)
   - 返回 match_tier: 2

3. **Tier 3 (Context Weighting)**: `contextWeight()`
   - Domain 匹配: 1.2x 权重
   - Language 匹配: 1.15x 权重
   - Model 兼容: 1.1x 权重
   - 返回 match_tier: 3 (当有权重加成时)

4. **结果合并**: `combineResults()`
   - 去重（基于 experience.id）
   - 按 GDI 分数排序

**默认阈值**:
- SEMANTIC_THRESHOLD: 0.75
- JACCARD_THRESHOLD: 0.34

### 测试记录

**测试文件**: `src/aep/matcher/__tests__/threeTierMatcher.test.ts`

**测试结果**: 37 tests passed

| AC编号 | 测试覆盖 |
|--------|----------|
| AC-MATCH-001 | Tier 1 Exact Match - 3 tests |
| AC-MATCH-002 | Tier 2 Semantic Match - 2 tests |
| AC-MATCH-003 | Tier 3 Context Weighting - 4 tests |
| AC-MATCH-004 | Semantic threshold >= 0.75 - 2 tests |
| AC-MATCH-005 | Jaccard threshold >= 0.34 - 1 test |
| AC-MATCH-006 | Combine results without duplicates - 2 tests |
| AC-MATCH-007 | Rank by GDI score - 1 test |
| AC-MATCH-008 | Performance < 100ms - 2 tests |

**其他测试**:
- Status filtering - 3 tests
- Limit parameter - 2 tests
- Edge cases - 6 tests
- Async match - 1 test
- Helper functions (jaccardSimilarity, createSignalKey) - 5 tests
- Module exports - 3 tests

**性能测试结果**:
- 100 条 experiences 匹配: < 100ms
- 10 次 50 条 experiences 匹配: < 100ms 总计

### 完成日期

2026-02-22
