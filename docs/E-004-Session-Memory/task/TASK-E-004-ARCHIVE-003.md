# TASK-E-004-ARCHIVE-003: Pending Queue Manager

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-ARCHIVE-003.md`
> 任务ID：TASK-E-004-ARCHIVE-003
> Beads 任务ID：`0z8`
> 任务标题：Pending Queue Manager 待发布队列管理器
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：DONE
> 负责人：dev-agent
> 预估工期：4h
> 创建日期：2026-02-24
> 完成日期：2026-02-26

---

## 1. 任务目标

* **做什么**：实现 PendingQueueManager 类，管理待发布到 Hub 的 Experience
* **为什么做**：从成功会话中提取的 Experience 需要暂存，等待用户确认后发布
* **不做什么**：不实现实际发布逻辑（由 AEPClient.publish 负责）

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-010（会话压缩与归档）
* 上游依赖：
  - **硬依赖**：ARCHIVE-001（需要 PendingExperience 格式）
* 下游任务：无

---

## 3. 验收标准

- [x] AC1：`add_pending(experience)` 添加待发布 Experience
- [x] AC2：`list_pending()` 列出所有待发布 Experience
- [x] AC3：`remove_pending(exp_id)` 移除已发布 Experience
- [x] AC4：`get_batch()` 获取批量发布队列
- [x] AC5：持久化到 `.aep/pending/` 目录
- [x] AC6：支持按 session_id 过滤

---

## 4. 实施方案

### 4.1 数据模型

```python
# aep_sdk/models.py 扩展

@dataclass
class PendingExperience:
    """待发布经验"""

    id: str                              # UUID
    trigger: str                         # 触发条件
    solution: str                        # 解决方案
    confidence: float                    # 置信度 (0-1)
    source_action_id: str               # 来源行动 ID
    source_session_id: str              # 来源会话 ID
    feedback_score: Optional[float]      # 反馈评分
    created_at: str                      # 创建时间
    status: str = "pending"              # pending | approved | rejected

    def to_publish_payload(self) -> Dict[str, Any]:
        """转换为发布请求格式"""
        return {
            "trigger": self.trigger,
            "solution": self.solution,
            "confidence": self.confidence,
            "context": {
                "source_session": self.source_session_id,
                "feedback_score": self.feedback_score
            }
        }
```

### 4.2 核心实现

```python
# aep_sdk/session/pending_queue.py

from typing import List, Optional, Dict, Any
from pathlib import Path
import json
import uuid
from datetime import datetime

from ..models import PendingExperience


class PendingQueueManager:
    """
    待发布队列管理器。

    职责：
    - 管理待发布 Experience
    - 持久化到文件系统
    - 支持批量发布
    """

    def __init__(self, workspace: str):
        self.workspace = Path(workspace)
        self.pending_dir = self.workspace / ".aep" / "pending"
        self.pending_dir.mkdir(parents=True, exist_ok=True)

    def add_pending(
        self,
        trigger: str,
        solution: str,
        confidence: float,
        source_action_id: str,
        source_session_id: str,
        feedback_score: Optional[float] = None
    ) -> PendingExperience:
        """
        添加待发布 Experience。

        Args:
            trigger: 触发条件
            solution: 解决方案
            confidence: 置信度
            source_action_id: 来源行动 ID
            source_session_id: 来源会话 ID
            feedback_score: 反馈评分

        Returns:
            创建的 PendingExperience
        """
        exp = PendingExperience(
            id=f"exp_{uuid.uuid4().hex[:12]}",
            trigger=trigger,
            solution=solution,
            confidence=confidence,
            source_action_id=source_action_id,
            source_session_id=source_session_id,
            feedback_score=feedback_score,
            created_at=datetime.now().isoformat(),
            status="pending"
        )

        # 持久化
        self._save_experience(exp)

        return exp

    def list_pending(
        self,
        session_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[PendingExperience]:
        """
        列出待发布 Experience。

        Args:
            session_id: 按会话过滤
            status: 按状态过滤
            limit: 最大返回数量

        Returns:
            PendingExperience 列表
        """
        experiences = []

        for exp_file in sorted(
            self.pending_dir.glob("exp_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        ):
            exp = self._load_experience(exp_file)

            # 过滤
            if session_id and exp.source_session_id != session_id:
                continue
            if status and exp.status != status:
                continue

            experiences.append(exp)

            if len(experiences) >= limit:
                break

        return experiences

    def get_pending(self, exp_id: str) -> Optional[PendingExperience]:
        """获取指定 Experience"""
        exp_file = self.pending_dir / f"{exp_id}.json"

        if not exp_file.exists():
            return None

        return self._load_experience(exp_file)

    def remove_pending(self, exp_id: str) -> bool:
        """
        移除待发布 Experience（发布成功后调用）。

        Args:
            exp_id: Experience ID

        Returns:
            是否成功移除
        """
        exp_file = self.pending_dir / f"{exp_id}.json"

        if not exp_file.exists():
            return False

        exp_file.unlink()
        return True

    def approve_pending(self, exp_id: str) -> bool:
        """标记为已批准"""
        return self._update_status(exp_id, "approved")

    def reject_pending(self, exp_id: str) -> bool:
        """标记为已拒绝"""
        return self._update_status(exp_id, "rejected")

    def get_batch(
        self,
        batch_size: int = 10,
        status: str = "approved"
    ) -> List[PendingExperience]:
        """
        获取批量发布队列。

        Args:
            batch_size: 批次大小
            status: 只获取指定状态

        Returns:
            待发布的 Experience 列表
        """
        return self.list_pending(status=status, limit=batch_size)

    def clear_completed(self) -> int:
        """清理已完成（approved/rejected）的记录"""
        count = 0
        for exp_file in self.pending_dir.glob("exp_*.json"):
            exp = self._load_experience(exp_file)
            if exp.status in ("approved", "rejected"):
                exp_file.unlink()
                count += 1
        return count

    def _save_experience(self, exp: PendingExperience) -> None:
        """持久化 Experience"""
        exp_file = self.pending_dir / f"{exp.id}.json"
        with open(exp_file, 'w', encoding='utf-8') as f:
            json.dump(exp.__dict__, f, ensure_ascii=False, indent=2)

    def _load_experience(self, exp_file: Path) -> PendingExperience:
        """加载 Experience"""
        with open(exp_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return PendingExperience(**data)

    def _update_status(self, exp_id: str, status: str) -> bool:
        """更新状态"""
        exp = self.get_pending(exp_id)
        if not exp:
            return False

        exp.status = status
        self._save_experience(exp)
        return True
```

---

## 5. 测试

```python
# tests/test_pending_queue.py

import pytest
import tempfile

from aep_sdk.session.pending_queue import PendingQueueManager


class TestPendingQueueManager:

    def test_add_pending(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(
                trigger="TypeError",
                solution="Add null check",
                confidence=0.85,
                source_action_id="action_123",
                source_session_id="session_456"
            )

            assert exp.id.startswith("exp_")
            assert exp.status == "pending"

            # 验证持久化
            loaded = manager.get_pending(exp.id)
            assert loaded is not None
            assert loaded.trigger == "TypeError"

    def test_list_pending_with_filter(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            manager.add_pending(..., source_session_id="session_A")
            manager.add_pending(..., source_session_id="session_B")

            list_a = manager.list_pending(session_id="session_A")
            assert len(list_a) == 1

    def test_approve_and_get_batch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(...)
            manager.approve_pending(exp.id)

            batch = manager.get_batch(status="approved")
            assert len(batch) == 1
            assert batch[0].id == exp.id

    def test_remove_pending(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PendingQueueManager(tmpdir)

            exp = manager.add_pending(...)
            result = manager.remove_pending(exp.id)

            assert result is True
            assert manager.get_pending(exp.id) is None
```

---

## 6. 实现记录

### 6.1 实际实现

**TypeScript 实现**：
- 文件位置：`src/aep/archive/pending-queue.ts`
- 类型定义：`src/aep/archive/types.ts`（新增 PendingExperience, PendingStatus 等）
- 导出更新：`src/aep/archive/index.ts`

**Python 实现**：
- 文件位置：`aep-sdk/src/aep_sdk/archive/pending_queue.py`
- 类型定义：`aep-sdk/src/aep_sdk/archive/models.py`（新增 PendingExperience, PendingStatus）
- 导出更新：`aep-sdk/src/aep_sdk/archive/__init__.py`

### 6.2 核心功能

| 方法 | 描述 | 状态 |
|------|------|------|
| `addPending()` | 添加待发布 Experience | 已实现 |
| `listPending()` | 列出待发布 Experience（支持 session_id/status/limit 过滤） | 已实现 |
| `getPending()` | 获取指定 Experience | 已实现 |
| `removePending()` | 移除已发布 Experience | 已实现 |
| `approvePending()` | 标记为已批准 | 已实现 |
| `rejectPending()` | 标记为已拒绝 | 已实现 |
| `getBatch()` | 获取批量发布队列 | 已实现 |
| `clearCompleted()` | 清理已完成记录 | 已实现 |
| `getStats()` | 获取队列统计 | 已实现 |
| `toPublishPayload()` | 转换为发布格式 | 已实现 |

### 6.3 测试记录

**TypeScript 测试**：
- 文件：`src/aep/archive/__tests__/pending-queue.test.ts`
- 测试结果：19 tests passed
- 覆盖场景：
  - 添加 pending experience
  - 持久化验证
  - 可选字段 feedback_score
  - 列表过滤（session_id、status、limit）
  - 获取单个 experience
  - 移除 experience
  - 批准/拒绝操作
  - 批量获取
  - 清理已完成记录
  - 队列统计
  - 发布载荷转换

**Python 测试**：
- 文件：`aep-sdk/tests/test_pending_queue.py`
- 测试结果：18 tests passed
- 覆盖场景：同 TypeScript + 跨实例持久化测试

### 6.4 持久化位置

- 目录：`{workspace}/.aep/pending/`
- 文件格式：`exp_{uuid}.json`
- JSON 结构与 PendingExperience 类型一致

---

## 7. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-24 | AEP Protocol Team | 初版 |
| v1.1 | 2026-02-26 | dev-agent | 实现完成，更新验收标准为已通过 |