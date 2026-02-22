# TASK-E-001-SIG-002: Signal Index Builder

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-006
> **Status:** done
> **Beads 任务ID:** agent network-vvg
> **依赖:** []

## 摘要

Implement the Signal Index Builder that creates and maintains the inverted index for fast signal-to-experience lookups. Supports indexing new experiences, updating weights, and bulk rebuilds.

## 验收标准

- [x] AC-IDX-001: Creates inverted index entries for signal-to-experience mapping
- [x] AC-IDX-002: Supports multiple signals per experience
- [x] AC-IDX-003: Stores signal weight for ranking
- [x] AC-IDX-004: Supports bulk index rebuild for all experiences
- [x] AC-IDX-005: Supports incremental index for new experiences
- [x] AC-IDX-006: Removes index entries when experience is deprecated
- [x] AC-IDX-007: Query by signal returns all matching experience IDs
- [x] AC-IDX-008: Multi-signal query returns combined results

## 接口定义

### Index Builder Interface

```python
@dataclass
class IndexEntry:
    signal_key: str
    experience_id: str
    weight: float
    created_at: datetime

class SignalIndexBuilder:
    """Build and maintain inverted index for signal matching."""

    def index_experience(self, experience_id: str, signals: List[Signal]) -> None:
        """Index signals for a single experience."""

    def index_batch(self, experiences: List[Experience]) -> int:
        """Bulk index signals for multiple experiences."""

    def remove_experience(self, experience_id: str) -> int:
        """Remove all index entries for an experience."""

    def update_weight(self, signal_key: str, experience_id: str, weight: float) -> None:
        """Update signal weight for an experience."""

    def rebuild_index(self) -> int:
        """Rebuild entire index from experiences table."""

class SignalIndexQuerier:
    """Query the signal index."""

    def query(self, signal_key: str) -> List[str]:
        """Query experiences matching a single signal."""

    def multi_query(self, signal_keys: List[str]) -> List[str]:
        """Query experiences matching any of the signals."""

    def get_stats(self) -> Dict[str, int]:
        """Get index statistics."""
```

## 实现笔记

### Index Builder (Pseudocode)

```python
from datetime import datetime
from typing import List, Dict

class SignalIndexBuilder:
    """Build and maintain inverted index for signal matching."""

    def __init__(self, db):
        self.db = db

    def index_experience(self, experience_id: str, signals: List[Signal]) -> None:
        """Index signals for a single experience."""
        for signal in signals:
            signal_key = self._make_signal_key(signal)

            # Check if entry already exists
            existing = self.db.query(
                "SELECT 1 FROM signal_index WHERE signal_key = ? AND experience_id = ?",
                signal_key, experience_id
            ).first()

            if existing:
                # Update weight if changed
                self.db.update(
                    "signal_index",
                    {"weight": signal.weight},
                    {"signal_key": signal_key, "experience_id": experience_id}
                )
            else:
                # Insert new entry
                self.db.insert("signal_index", {
                    "signal_key": signal_key,
                    "experience_id": experience_id,
                    "weight": signal.weight,
                    "created_at": datetime.now()
                })

    def index_batch(self, experiences: List[Experience]) -> int:
        """Bulk index signals for multiple experiences."""
        count = 0
        for experience in experiences:
            if experience.signals_match:
                signals = [Signal(type='keyword', value=s, weight=1.0)
                          for s in experience.signals_match]
                self.index_experience(experience.id, signals)
                count += 1
        return count

    def remove_experience(self, experience_id: str) -> int:
        """Remove all index entries for an experience."""
        result = self.db.execute(
            "DELETE FROM signal_index WHERE experience_id = ?",
            experience_id
        )
        return result.rowcount

    def update_weight(self, signal_key: str, experience_id: str, weight: float) -> None:
        """Update signal weight for an experience."""
        self.db.update(
            "signal_index",
            {"weight": weight},
            {"signal_key": signal_key, "experience_id": experience_id}
        )

    def rebuild_index(self) -> int:
        """Rebuild entire index from experiences table."""
        # Clear existing index
        self.db.execute("TRUNCATE TABLE signal_index")

        # Get all active experiences
        experiences = self.db.query(
            "SELECT id, signals_match FROM experiences WHERE status != 'deprecated'"
        )

        count = 0
        for exp in experiences:
            if exp.signals_match:
                signals = [Signal(type='keyword', value=s, weight=1.0)
                          for s in exp.signals_match]
                self.index_experience(exp.id, signals)
                count += 1

        return count

    def _make_signal_key(self, signal: Signal) -> str:
        """Create normalized signal key for indexing."""
        return f"{signal.type}:{signal.value.lower()}"


class SignalIndexQuerier:
    """Query the signal index."""

    def __init__(self, db):
        self.db = db

    def query(self, signal_key: str) -> List[str]:
        """Query experiences matching a single signal."""
        results = self.db.query(
            """
            SELECT experience_id, weight
            FROM signal_index
            WHERE signal_key = ?
            ORDER BY weight DESC
            """,
            signal_key.lower()
        )
        return [r.experience_id for r in results]

    def multi_query(self, signal_keys: List[str]) -> List[str]:
        """Query experiences matching any of the signals."""
        if not signal_keys:
            return []

        # Normalize keys
        normalized_keys = [k.lower() for k in signal_keys]
        placeholders = ",".join(["?"] * len(normalized_keys))

        results = self.db.query(
            f"""
            SELECT DISTINCT experience_id, SUM(weight) as total_weight
            FROM signal_index
            WHERE signal_key IN ({placeholders})
            GROUP BY experience_id
            ORDER BY total_weight DESC
            """,
            normalized_keys
        )
        return [r.experience_id for r in results]

    def get_stats(self) -> Dict[str, int]:
        """Get index statistics."""
        total_entries = self.db.query(
            "SELECT COUNT(*) as count FROM signal_index"
        ).first().count

        unique_signals = self.db.query(
            "SELECT COUNT(DISTINCT signal_key) as count FROM signal_index"
        ).first().count

        indexed_experiences = self.db.query(
            "SELECT COUNT(DISTINCT experience_id) as count FROM signal_index"
        ).first().count

        return {
            "total_entries": total_entries,
            "unique_signals": unique_signals,
            "indexed_experiences": indexed_experiences
        }
```

### Database Schema

```sql
CREATE TABLE signal_index (
    signal_key VARCHAR(128) NOT NULL,
    experience_id UUID NOT NULL REFERENCES experiences(id),
    weight DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (signal_key, experience_id)
);

-- Index for fast signal lookups
CREATE INDEX idx_signal_key ON signal_index(signal_key);

-- Index for experience deletion
CREATE INDEX idx_experience_id ON signal_index(experience_id);

-- Index for weight-based sorting
CREATE INDEX idx_signal_weight ON signal_index(signal_key, weight DESC);
```

### Query Performance

| Query Type | Expected Time | Index Used |
|------------|---------------|------------|
| Single signal | < 5ms | idx_signal_key |
| Multi-signal (5) | < 20ms | idx_signal_key |
| Experience deletion | < 10ms | idx_experience_id |
| Full rebuild | O(n) | Full scan |

## 技术约束

- **Concurrency**: Support concurrent reads, serialized writes
- **Consistency**: Index must be consistent with experiences table
- **Performance**: Single signal query < 5ms

## 验证方式

1. **Unit Tests**: Index/unindex operations
2. **Query Tests**: Single and multi-signal queries
3. **Consistency Tests**: Index matches experiences
4. **Performance Tests**: Query latency

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §1.2 Sequence Diagram
- **STORY**: `../../_project/stories/STORY-006-signal-extraction-matching.md`

---

## 实现记录

### 实现概述

实现了 TypeScript 版本的 Signal Index Builder，使用内存中的 Map 结构构建倒排索引。

### 关键文件

| 文件路径 | 描述 |
|---------|------|
| `src/aep/signal/index-builder.ts` | 主要实现文件，包含 `SignalIndexBuilder` 和 `SignalIndexQuerier` 类 |
| `src/aep/signal/__tests__/index-builder.test.ts` | 测试文件，49 个测试用例覆盖所有验收标准 |
| `src/aep/signal/index.ts` | 更新导出，添加 index-builder 模块的重导出 |

### 实现亮点

1. **双重索引结构**：
   - 正向索引：`signal_key -> [{experienceId, weight, createdAt}]`
   - 反向索引：`experience_id -> Set<signal_key>`（用于高效删除）

2. **权重聚合**：multi-query 查询时按组合权重排序，匹配多个信号的体验排名更高

3. **类型安全**：完整的 TypeScript 类型定义，包括 `IndexEntry`、`IndexableExperience`、`IndexStats` 接口

4. **工厂函数**：提供 `createSignalIndexBuilder()` 和 `createSignalIndexQuerier()` 工厂函数

5. **单例模式**：导出 `signalIndexBuilder` 和 `signalIndexQuerier` 单例实例

### 性能测试结果

| 测试场景 | 结果 |
|---------|------|
| 1000 体验索引（各 5 信号） | < 1000ms |
| 单信号查询（1000 匹配） | < 5ms ✅ |
| 多信号查询（5 信号） | < 20ms ✅ |

### 测试覆盖

- 49 个测试用例
- 覆盖所有 8 个验收标准
- 包含单元测试、集成测试和性能测试

