# TASK-E-004-SESSION-002: SessionRecorder 实现

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-SESSION-002.md`
> 任务ID：TASK-E-004-SESSION-002
> Beads 任务ID：`（待创建）`
> 任务标题：SessionRecorder 会话管理器实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：TODO
> 负责人：（待分配）
> 预估工期：6h
> 创建日期：2026-02-23

---

## 1. 任务目标

* **做什么**：实现 SessionRecorder 类，管理会话的生命周期（创建、激活、暂停、结束）
* **为什么做**：会话是所有行动记录的容器，需要统一管理
* **不做什么**：不实现行动日志记录（SESSION-003）

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：`NO_STORY`
* 关联 Slice：`NO_SLICE`
* 关联 TECH：`../tech/TECH-E-004-v1.md`
* 上游依赖：
  - **硬依赖**：SESSION-001（需要 Session 数据模型）
  - **接口依赖**：无
* 下游任务：SESSION-003

---

## 3. 验收标准

- [ ] AC1：`start_session()` 创建新会话，返回 session_id
- [ ] AC2：`get_active_session()` 返回当前活跃会话
- [ ] AC3：`end_session()` 结束会话，更新状态和 ended_at
- [ ] AC4：会话文件自动创建在 `.aep/sessions/` 目录
- [ ] AC5：支持同一工作空间多会话管理
- [ ] AC6：会话元数据正确存储到 JSONL 文件头部

---

## 4. 实施方案

### 4.1 改动点列表

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `aep-sdk/src/aep_sdk/session/__init__.py` | 新增 | session 模块初始化 |
| `aep-sdk/src/aep_sdk/session/recorder.py` | 新增 | SessionRecorder 实现 |
| `aep-sdk/src/aep_sdk/session/storage.py` | 新增 | StorageManager 实现 |

### 4.2 接口定义

```python
# aep_sdk/session/recorder.py

from typing import Optional, Dict, Any
from pathlib import Path
import json

from ..models import Session


class SessionError(Exception):
    """会话相关错误"""
    pass


class SessionNotActiveError(SessionError):
    """会话未激活"""
    pass


class SessionRecorder:
    """
    会话记录器，管理会话生命周期。

    Usage:
        recorder = SessionRecorder(workspace="/path/to/project", agent_id="agent_0x1234")
        session_id = recorder.start_session(metadata={"purpose": "debugging"})
        # ... 执行任务 ...
        recorder.end_session(session_id)
    """

    def __init__(self, workspace: str, agent_id: str):
        """
        初始化会话记录器。

        Args:
            workspace: 工作空间路径
            agent_id: 智能体 ID
        """
        self.workspace = Path(workspace)
        self.agent_id = agent_id
        self._active_session: Optional[Session] = None
        self._storage = StorageManager(self.workspace)

        # 确保目录存在
        self._storage.ensure_directory("sessions")

    def start_session(self, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        开始新会话。

        Args:
            metadata: 可选的会话元数据

        Returns:
            session_id: 会话唯一标识

        Raises:
            SessionError: 如果已有活跃会话
        """
        if self._active_session is not None:
            raise SessionError(f"Active session already exists: {self._active_session.id}")

        # 创建新会话
        session = Session.create(
            workspace=str(self.workspace),
            agent_id=self.agent_id,
            metadata=metadata
        )

        # 创建 JSONL 文件
        file_path = self._storage.get_sessions_path() / f"{session.id}.jsonl"
        session.file_path = str(file_path)

        # 写入会话头
        self._write_session_header(session)

        self._active_session = session
        return session.id

    def get_active_session(self) -> Optional[str]:
        """获取当前活跃会话 ID"""
        return self._active_session.id if self._active_session else None

    def get_session(self, session_id: str) -> Optional[Session]:
        """获取指定会话"""
        if self._active_session and self._active_session.id == session_id:
            return self._active_session
        return self._load_session(session_id)

    def end_session(self, session_id: str) -> str:
        """
        结束会话。

        Args:
            session_id: 会话 ID

        Returns:
            JSONL 文件路径

        Raises:
            SessionNotActiveError: 会话不存在或未激活
        """
        if not self._active_session or self._active_session.id != session_id:
            raise SessionNotActiveError(f"Session not active: {session_id}")

        # 更新会话状态
        from datetime import datetime
        self._active_session.status = "completed"
        self._active_session.ended_at = datetime.now().isoformat()

        # 更新文件头
        self._update_session_header(self._active_session)

        file_path = self._active_session.file_path
        self._active_session = None

        return file_path

    def pause_session(self, session_id: str) -> None:
        """暂停会话"""
        # 实现暂停逻辑

    def resume_session(self, session_id: str) -> None:
        """恢复会话"""
        # 实现恢复逻辑

    def _write_session_header(self, session: Session) -> None:
        """写入会话头到 JSONL 文件"""
        header = {
            "_type": "session_header",
            "session": session.to_dict()
        }
        with open(session.file_path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(header, ensure_ascii=False) + '\n')

    def _update_session_header(self, session: Session) -> None:
        """更新会话头"""
        # 读取现有内容，更新头部，写回
        pass

    def _load_session(self, session_id: str) -> Optional[Session]:
        """从文件加载会话"""
        pass


class StorageManager:
    """存储管理器，处理文件系统操作"""

    SESSIONS_DIR = "sessions"
    MEMORY_DIR = "memory"
    PENDING_DIR = "pending"
    CACHE_DIR = "cache"
    ARCHIVE_DIR = "sessions/archive"

    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.aep_dir = workspace / ".aep"

    def ensure_directory(self, dir_name: str) -> Path:
        """确保目录存在"""
        dir_path = self.aep_dir / dir_name
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path

    def get_sessions_path(self) -> Path:
        """获取 sessions 目录路径"""
        return self.ensure_directory(self.SESSIONS_DIR)

    def get_memory_path(self) -> Path:
        """获取 memory 目录路径"""
        return self.ensure_directory(self.MEMORY_DIR)

    def get_pending_path(self) -> Path:
        """获取 pending 目录路径"""
        return self.ensure_directory(self.PENDING_DIR)
```

---

## 5. 测试

### 5.1 测试用例

```python
# tests/test_session_recorder.py

import pytest
import tempfile
from pathlib import Path

from aep_sdk.session.recorder import SessionRecorder, SessionError, SessionNotActiveError


class TestSessionRecorder:
    def test_start_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()

            assert session_id.startswith("session_")
            assert recorder.get_active_session() == session_id

            # 验证文件创建
            sessions_dir = Path(tmpdir) / ".aep" / "sessions"
            assert sessions_dir.exists()

    def test_start_session_twice_raises_error(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            recorder.start_session()

            with pytest.raises(SessionError):
                recorder.start_session()

    def test_end_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")
            session_id = recorder.start_session()
            file_path = recorder.end_session(session_id)

            assert Path(file_path).exists()
            assert recorder.get_active_session() is None

    def test_end_non_active_session_raises_error(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            recorder = SessionRecorder(tmpdir, "agent_0x1234")

            with pytest.raises(SessionNotActiveError):
                recorder.end_session("session_nonexistent")
```

---

## 6. 风险与回滚

* 风险：文件写入失败
* 回滚：删除 `.aep/sessions/` 目录

---

## 7. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
