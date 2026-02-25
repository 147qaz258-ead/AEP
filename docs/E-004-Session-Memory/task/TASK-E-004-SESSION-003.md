# TASK-E-004-SESSION-003: ActionLogger 实现

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-SESSION-003.md`
> 任务ID：TASK-E-004-SESSION-003
> Beads 任务ID：`（待创建）`
> 任务标题：ActionLogger 行动日志器实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：TODO
> 负责人：（待分配）
> 预估工期：6h
> 创建日期：2026-02-23

---

## 1. 任务目标

* **做什么**：实现 ActionLogger 类，记录智能体行动到 JSONL 文件
* **为什么做**：行动日志是 Session Memory 的核心功能
* **不做什么**：不实现特定类型的日志（ACTION-001/002/003）

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：`NO_STORY`
* 关联 Slice：`NO_SLICE`
* 关联 TECH：`../tech/TECH-E-004-v1.md`
* 上游依赖：
  - **硬依赖**：SESSION-002（需要 SessionRecorder）
  - **接口依赖**：SESSION-001（需要 AgentAction 类型）
* 下游任务：ACTION-002, FEEDBACK-002, ARCHIVE-002

---

## 3. 验收标准

- [ ] AC1：`log_action()` 追加 AgentAction 到 JSONL 文件
- [ ] AC2：`log_tool_call()` 便捷方法正确创建 tool_call 类型行动
- [ ] AC3：`log_message()` 便捷方法正确创建 message 类型行动
- [ ] AC4：`log_decision()` 便捷方法正确创建 decision 类型行动
- [ ] AC5：记录延迟 < 100ms
- [ ] AC6：无活跃会话时抛出 SessionNotActiveError

---

## 4. 实施方案

### 4.1 改动点列表

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `aep-sdk/src/aep_sdk/session/logger.py` | 新增 | ActionLogger 实现 |

### 4.2 接口定义

```python
# aep_sdk/session/logger.py

from typing import Optional, Dict, Any
import time

from ..models import AgentAction
from .recorder import SessionRecorder, SessionNotActiveError


class WriteError(Exception):
    """写入错误"""
    pass


class ActionLogger:
    """
    行动日志器，记录智能体行动到 JSONL 文件。

    Usage:
        recorder = SessionRecorder(workspace, agent_id)
        recorder.start_session()

        logger = ActionLogger(recorder)
        action_id = logger.log_tool_call(
            tool_name="bash",
            trigger="File not found",
            solution="Create file",
            result="success"
        )
    """

    def __init__(self, session_recorder: SessionRecorder):
        """
        初始化行动日志器。

        Args:
            session_recorder: 会话记录器实例
        """
        self._recorder = session_recorder

    def log_action(self, action: AgentAction) -> str:
        """
        记录行动。

        Args:
            action: AgentAction 对象

        Returns:
            action_id: 行动唯一标识

        Raises:
            SessionNotActiveError: 会话未激活
            WriteError: 写入失败
        """
        session_id = self._recorder.get_active_session()
        if not session_id:
            raise SessionNotActiveError("No active session")

        session = self._recorder.get_session(session_id)
        if not session:
            raise SessionNotActiveError(f"Session not found: {session_id}")

        # 确保 context 包含 session_id
        action.context["session_id"] = session_id

        # 追加到 JSONL 文件
        start_time = time.perf_counter()
        try:
            with open(session.file_path, 'a', encoding='utf-8') as f:
                f.write(action.to_jsonl() + '\n')
        except IOError as e:
            raise WriteError(f"Failed to write action: {e}")

        latency_ms = (time.perf_counter() - start_time) * 1000

        # 更新行动计数
        session.action_count += 1

        return action.id

    def log_tool_call(
        self,
        tool_name: str,
        trigger: str,
        solution: str,
        result: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        便捷方法：记录工具调用。

        Args:
            tool_name: 工具名称
            trigger: 触发问题
            solution: 解决方案
            result: 结果 ('success' | 'failure' | 'partial')
            context: 可选上下文

        Returns:
            action_id
        """
        ctx = context or {}
        ctx["tool_name"] = tool_name
        ctx["tools_used"] = [tool_name]

        action = AgentAction.create(
            action_type="tool_call",
            trigger=trigger,
            solution=solution,
            result=result,
            context=ctx
        )
        return self.log_action(action)

    def log_message(
        self,
        trigger: str,
        solution: str,
        result: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        便捷方法：记录消息。

        Args:
            trigger: 触发问题（用户问题）
            solution: 解决方案（智能体回复）
            result: 结果
            context: 可选上下文

        Returns:
            action_id
        """
        action = AgentAction.create(
            action_type="message",
            trigger=trigger,
            solution=solution,
            result=result,
            context=context or {}
        )
        return self.log_action(action)

    def log_decision(
        self,
        trigger: str,
        solution: str,
        result: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        便捷方法：记录决策。

        Args:
            trigger: 触发问题
            solution: 决策内容
            result: 结果
            context: 可选上下文

        Returns:
            action_id
        """
        action = AgentAction.create(
            action_type="decision",
            trigger=trigger,
            solution=solution,
            result=result,
            context=context or {}
        )
        return self.log_action(action)

    def get_action(self, action_id: str) -> Optional[AgentAction]:
        """
        从当前会话获取指定行动。

        Args:
            action_id: 行动 ID

        Returns:
            AgentAction 或 None
        """
        session_id = self._recorder.get_active_session()
        if not session_id:
            return None

        session = self._recorder.get_session(session_id)
        if not session:
            return None

        # 读取 JSONL 文件查找
        with open(session.file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    data = eval(line)  # 或 json.loads
                    if data.get("id") == action_id:
                        return AgentAction.from_dict(data)

        return None

    def update_action(self, action_id: str, updates: Dict[str, Any]) -> bool:
        """
        更新行动（用于反馈关联）。

        Args:
            action_id: 行动 ID
            updates: 更新内容

        Returns:
            是否成功
        """
        # 实现更新逻辑（重写 JSONL 文件）
        pass
```

---

## 5. 测试

### 5.1 测试用例

```python
# tests/test_action_logger.py

import pytest
import tempfile

from aep_sdk.session.recorder import SessionRecorder
from aep_sdk.session.logger import ActionLogger, SessionNotActiveError


class TestActionLogger:
    def test_log_action_requires_active_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            logger = ActionLogger(recorder)

            action = AgentAction.create(
                action_type="message",
                trigger="test",
                solution="test",
                result="success"
            )

            with pytest.raises(SessionNotActiveError):
                logger.log_action(action)

    def test_log_tool_call(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)
            action_id = logger.log_tool_call(
                tool_name="bash",
                trigger="File not found",
                solution="Create file",
                result="success"
            )

            assert action_id is not None
            assert action_id.startswith("...")  # UUID 格式

    def test_action_written_to_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            logger = ActionLogger(recorder)
            logger.log_message(
                trigger="Hello",
                solution="Hi there!",
                result="success"
            )

            # 验证文件内容
            session = recorder.get_session(session_id)
            with open(session.file_path, 'r') as f:
                content = f.read()
                assert '"action_type": "message"' in content
                assert 'Hello' in content

    def test_latency_under_100ms(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            logger = ActionLogger(recorder)

            import time
            start = time.perf_counter()
            logger.log_message("test", "test", "success")
            latency = (time.perf_counter() - start) * 1000

            assert latency < 100
```

---

## 6. 风险与回滚

* 风险：高并发写入可能导致数据损坏
* 缓解：使用文件锁或队列
* 回滚：删除 logger.py

---

## 7. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
