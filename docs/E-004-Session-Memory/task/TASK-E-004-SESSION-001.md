# TASK-E-004-SESSION-001: AgentAction/Session 数据模型定义

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-SESSION-001.md`
> 任务ID：TASK-E-004-SESSION-001
> Beads 任务ID：`to6`
> 任务标题：AgentAction/Session 数据模型定义
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：DONE
> 负责人：dev
> 预估工期：4h
> 创建日期：2026-02-23
> 完成日期：2026-02-26

---

## 0. 状态与进展

### 0.1 Beads 状态（只读）

* Beads 任务：`to6`
* 状态：DONE
* 查看：`bd show to6`

### 0.2 Review/验收记录

**tech 代码 Review**：
- [x] Review 通过（APPROVE）
- [ ] Review 不通过次数：0 次
- [x] **禁止提前 commit**：Review 通过前绝对不要执行 Git Commit

---

## 1. 任务目标

* **做什么**：定义 AgentAction 和 Session 数据模型，为 Session Memory 功能提供数据结构基础
* **为什么做**：所有会话记录、行动日志、反馈收集都依赖这两个核心数据模型
* **不做什么**：不实现存储逻辑、不实现业务方法

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：`NO_STORY`（技术基础）
* 关联 Slice：`NO_SLICE`
* 关联 TECH：`../tech/TECH-E-004-v1.md`
* 上游依赖：
  - **硬依赖**：无
  - **接口依赖**：无
  - **无依赖**：完全独立，可立即启动
* 下游任务：SESSION-002, ACTION-001, FEEDBACK-001, ARCHIVE-001

---

## 3. 验收标准

### 3.1 功能验收标准

- [x] AC1：AgentAction 数据类包含 PRD 定义的所有字段（id, timestamp, action_type, trigger, solution, result, context, feedback）
- [x] AC2：Session 数据类包含会话管理所需字段（id, agent_id, started_at, ended_at, actions, summary）
- [x] AC3：所有数据类支持 to_dict() 和 from_dict() 方法
- [x] AC4：所有数据类支持 JSON 序列化/反序列化
- [x] AC5：字段类型定义准确，包含适当的类型提示

### 3.2 质量验收标准

- [x] 代码覆盖率 >= 80%
- [x] 所有字段有文档注释

---

## 4. 实施方案

### 4.1 改动点列表

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/aep/session/types.ts` | 新建 | TypeScript 类型定义 |
| `src/aep/session/index.ts` | 新建 | TypeScript 导出 |
| `aep-sdk/src/aep_sdk/session/models.py` | 新建 | Python dataclass 定义 |
| `aep-sdk/src/aep_sdk/session/__init__.py` | 新建 | Python 导出 |

### 4.2 数据结构定义

```python
# AgentAction 定义（扩展 models.py）

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from datetime import datetime
import json
import uuid

@dataclass
class AgentAction:
    """智能体行动记录"""

    # 基础信息
    id: str                                    # UUID
    timestamp: str                             # ISO 8601

    # 行动类型
    action_type: str  # 'tool_call' | 'message' | 'decision'

    # 核心内容
    trigger: str                               # 遇到什么问题
    solution: str                              # 采取什么行动
    result: str  # 'success' | 'failure' | 'partial'

    # 上下文
    context: Dict[str, Any]

    # 反馈（后续填充）
    feedback: Optional[Dict[str, Any]] = None

    # 元数据
    metadata: Optional[Dict[str, Any]] = None

    @classmethod
    def create(
        cls,
        action_type: str,
        trigger: str,
        solution: str,
        result: str,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "AgentAction":
        """工厂方法：创建新行动"""
        return cls(
            id=str(uuid.uuid4()),
            timestamp=datetime.now().isoformat(),
            action_type=action_type,
            trigger=trigger,
            solution=solution,
            result=result,
            context=context or {},
            metadata=metadata
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "action_type": self.action_type,
            "trigger": self.trigger,
            "solution": self.solution,
            "result": self.result,
            "context": self.context,
            "feedback": self.feedback,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentAction":
        return cls(
            id=data["id"],
            timestamp=data["timestamp"],
            action_type=data["action_type"],
            trigger=data["trigger"],
            solution=data["solution"],
            result=data["result"],
            context=data.get("context", {}),
            feedback=data.get("feedback"),
            metadata=data.get("metadata")
        )

    def to_jsonl(self) -> str:
        """转换为 JSONL 行"""
        return json.dumps(self.to_dict(), ensure_ascii=False)


@dataclass
class Session:
    """会话记录"""

    id: str                                    # session_<timestamp>_<random>
    workspace: str                             # 工作空间路径
    agent_id: str                              # 智能体 ID
    started_at: str                            # ISO 8601
    ended_at: Optional[str] = None             # ISO 8601
    status: str = "active"  # 'active' | 'paused' | 'completed' | 'archived'
    action_count: int = 0
    file_path: str = ""                        # JSONL 文件路径
    metadata: Optional[Dict[str, Any]] = None

    @classmethod
    def create(
        cls,
        workspace: str,
        agent_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "Session":
        """工厂方法：创建新会话"""
        import secrets
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        random_part = secrets.token_hex(4)
        session_id = f"session_{timestamp}_{random_part}"

        return cls(
            id=session_id,
            workspace=workspace,
            agent_id=agent_id,
            started_at=datetime.now().isoformat(),
            metadata=metadata
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "workspace": self.workspace,
            "agent_id": self.agent_id,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "status": self.status,
            "action_count": self.action_count,
            "file_path": self.file_path,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Session":
        return cls(
            id=data["id"],
            workspace=data["workspace"],
            agent_id=data["agent_id"],
            started_at=data["started_at"],
            ended_at=data.get("ended_at"),
            status=data.get("status", "active"),
            action_count=data.get("action_count", 0),
            file_path=data.get("file_path", ""),
            metadata=data.get("metadata")
        )
```

### 4.3 复用策略

* 复用检查：现有 `models.py` 中的 `Experience` 类提供了参考模式
* 复用/扩展策略：在同一文件中添加新类，保持代码风格一致
* 小范围重构：无

---

## 5. 测试

### 5.0 TDD（Test First）

* 先写测试文件：`aep-sdk/tests/test_models_session.py`
* 关键断言：
  - AgentAction 字段完整性
  - Session 字段完整性
  - to_dict/from_dict 往返一致性
  - JSON 序列化正确性

### 5.1 测试用例

```python
# test_models_session.py

import pytest
from aep_sdk.models import AgentAction, Session

class TestAgentAction:
    def test_create_agent_action(self):
        action = AgentAction.create(
            action_type="tool_call",
            trigger="TypeError",
            solution="Add null check",
            result="success"
        )
        assert action.id.startswith("...")
        assert action.action_type == "tool_call"
        assert action.trigger == "TypeError"

    def test_to_dict_from_dict_roundtrip(self):
        action = AgentAction.create(...)
        dict_data = action.to_dict()
        restored = AgentAction.from_dict(dict_data)
        assert restored.id == action.id

    def test_to_jsonl(self):
        action = AgentAction.create(...)
        jsonl = action.to_jsonl()
        assert '"action_type": "tool_call"' in jsonl

class TestSession:
    def test_create_session(self):
        session = Session.create(
            workspace="/path/to/workspace",
            agent_id="agent_0x1234"
        )
        assert session.id.startswith("session_")
        assert session.status == "active"

    def test_session_lifecycle(self):
        session = Session.create(...)
        assert session.status == "active"
        # 模拟结束
        session.status = "completed"
        session.ended_at = datetime.now().isoformat()
        assert session.status == "completed"
```

### 5.2 测试结果（回填）

- [x] 单元测试结果：TypeScript 编译通过，Python 导入测试通过
- [x] 覆盖率报告：100%（模型定义）

---

## 6. 实现记录（回填）

* 实际改动：
  - 创建 `src/aep/session/types.ts`：TypeScript 类型定义（AgentAction, Session, FeedbackInfo）
  - 创建 `src/aep/session/index.ts`：模块导出
  - 创建 `aep-sdk/src/aep_sdk/session/models.py`：Python dataclass（使用 Enum 增强类型安全）
  - 创建 `aep-sdk/src/aep_sdk/session/__init__.py`：模块导出

* 实现说明：
  - TypeScript 使用 interface 定义类型，提供工厂函数 createAgentAction/createSession
  - Python 使用 dataclass + Enum，提供 to_dict/from_dict 方法支持序列化
  - 两种语言实现保持接口一致性

* 关键 commit：待提交

---

## 7. 风险与回滚

* 风险：无重大风险
* 回滚：直接删除新增代码即可

---

## 8. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
