# TASK-E-004-ARCHIVE-001: Session Compressor

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-ARCHIVE-001.md`
> 任务ID：TASK-E-004-ARCHIVE-001
> Beads 任务ID：`（待创建）`
> 任务标题：Session Compressor 压缩器实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：TODO
> 负责人：（待分配）
> 预估工期：6h
> 创建日期：2026-02-24

---

## 0. 状态与进展

### 0.1 Beads 状态（只读）

* Beads 任务：`（待创建）`
* 状态：TODO

### 0.2 Review/验收记录

**tech 代码 Review**：
- [ ] Review 通过（APPROVE）
- [ ] Review 不通过次数：__ 次
- [ ] **禁止提前 commit**：Review 通过前绝对不要执行 Git Commit

---

## 1. 任务目标

* **做什么**：实现 SessionCompressor 类，将完整会话记录压缩为摘要
* **为什么做**：长会话需要压缩以节省存储空间并提取关键信息
* **不做什么**：不实现自动触发（由 ARCHIVE-002 负责）

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-010（会话压缩与归档）
* 关联 Slice：`NO_SLICE`
* 关联 TECH：`../tech/TECH-E-004-v1.md`
* 上游依赖：
  - **硬依赖**：SESSION-001（AgentAction, Session 数据模型）
  - **接口依赖**：无
* 下游任务：ARCHIVE-002, ARCHIVE-003

---

## 3. 验收标准

### 3.1 功能验收标准

- [ ] AC1：`compress(session_path)` 生成 Markdown 摘要文件
- [ ] AC2：摘要包含 user_intent、main_problems、successful_solutions
- [ ] AC3：摘要包含 failed_attempts、feedback_summary、metrics
- [ ] AC4：压缩比 >= 70%（原始大小 vs 摘要大小）
- [ ] AC5：原始 JSONL 文件可 gzip 压缩归档
- [ ] AC6：摘要文件人类可读

### 3.2 质量验收标准

- [ ] 代码覆盖率 >= 70%
- [ ] 1000 条行动的会话压缩时间 < 5s

---

## 4. 实施方案

### 4.1 改动点列表

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `aep-sdk/src/aep_sdk/session/compressor.py` | 新增 | SessionCompressor 实现 |
| `aep-sdk/src/aep_sdk/models.py` | 扩展 | 添加 SessionSummary 类 |

### 4.2 数据模型

```python
# aep_sdk/models.py 扩展

@dataclass
class SessionSummary:
    """会话压缩摘要"""

    session_id: str
    user_intent: str                    # 用户意图（1-2 句）
    main_problems: List[Dict[str, str]]  # 主要问题列表
    successful_solutions: List[Dict[str, str]]  # 成功方案
    failed_attempts: List[Dict[str, str]]       # 失败尝试
    feedback_summary: Dict[str, Any]     # 反馈统计
    metrics: Dict[str, Any]              # 资源消耗统计
    lessons_learned: List[str]           # 经验教训
    generated_at: str                    # 生成时间

    def to_markdown(self) -> str:
        """生成 Markdown 格式摘要"""
        # 参考 STORY-010 的摘要模板
        pass
```

### 4.3 核心实现

```python
# aep_sdk/session/compressor.py

from typing import List, Dict, Any, Optional
from pathlib import Path
import gzip
import shutil
from datetime import datetime

from ..models import AgentAction, Session, SessionSummary


class SessionCompressor:
    """
    会话压缩器，将 JSONL 会话压缩为 Markdown 摘要。

    压缩策略：
    1. 提取用户意图（第一个 message 类型的 trigger）
    2. 归类成功/失败的解决方案
    3. 汇总反馈信息
    4. 计算资源消耗统计
    """

    def __init__(self, workspace: str):
        self.workspace = Path(workspace)

    def compress(self, session_path: str) -> CompressionResult:
        """
        压缩会话。

        Args:
            session_path: JSONL 会话文件路径

        Returns:
            CompressionResult:
                - summary_path: 摘要文件路径
                - archive_path: 归档文件路径
                - original_size: 原始大小
                - compressed_size: 压缩后大小
                - compression_ratio: 压缩比
        """
        # 1. 读取所有行动
        actions = self._read_actions(session_path)

        # 2. 分析并提取关键信息
        analysis = self._analyze_session(actions)

        # 3. 生成摘要
        summary = self._generate_summary(analysis)

        # 4. 写入摘要文件
        summary_path = self._write_summary(summary)

        # 5. 压缩并归档原始文件
        archive_path = self._archive_original(session_path)

        # 6. 计算压缩比
        original_size = Path(session_path).stat().st_size
        compressed_size = Path(archive_path).stat().st_size

        return CompressionResult(
            summary_path=str(summary_path),
            archive_path=str(archive_path),
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=1 - (compressed_size / original_size)
        )

    def _read_actions(self, session_path: str) -> List[AgentAction]:
        """读取 JSONL 文件中的所有行动"""
        actions = []
        with open(session_path, 'r', encoding='utf-8') as f:
            for line in f:
                data = json.loads(line.strip())
                if data.get('_type') != 'session_header':
                    actions.append(AgentAction.from_dict(data))
        return actions

    def _analyze_session(self, actions: List[AgentAction]) -> Dict[str, Any]:
        """分析会话，提取关键信息"""

        return {
            'user_intent': self._extract_user_intent(actions),
            'main_problems': self._extract_problems(actions),
            'successful_solutions': self._extract_successes(actions),
            'failed_attempts': self._extract_failures(actions),
            'decisions': self._extract_decisions(actions),
            'feedback_summary': self._summarize_feedback(actions),
            'metrics': self._calculate_metrics(actions),
            'lessons_learned': self._extract_lessons(actions)
        }

    def _extract_user_intent(self, actions: List[AgentAction]) -> str:
        """提取用户意图（第一个 message 类型的 trigger）"""
        for action in actions:
            if action.action_type == 'message':
                return action.trigger[:200]  # 截断
        return "Unknown intent"

    def _extract_successes(self, actions: List[AgentAction]) -> List[Dict]:
        """提取成功的解决方案"""
        successes = []
        for action in actions:
            if action.result == 'success' and action.feedback:
                if action.feedback.get('value') == 'positive':
                    successes.append({
                        'trigger': action.trigger[:100],
                        'solution': action.solution[:200],
                        'result': action.result
                    })
        return successes[:5]  # 最多保留 5 个

    def _generate_summary(self, analysis: Dict) -> SessionSummary:
        """生成摘要对象"""
        return SessionSummary(
            session_id=analysis.get('session_id', 'unknown'),
            user_intent=analysis['user_intent'],
            main_problems=analysis['main_problems'],
            successful_solutions=analysis['successful_solutions'],
            failed_attempts=analysis['failed_attempts'],
            feedback_summary=analysis['feedback_summary'],
            metrics=analysis['metrics'],
            lessons_learned=analysis['lessons_learned'],
            generated_at=datetime.now().isoformat()
        )

    def _write_summary(self, summary: SessionSummary) -> Path:
        """写入 Markdown 摘要文件"""
        memory_dir = self.workspace / ".aep" / "memory"
        memory_dir.mkdir(parents=True, exist_ok=True)

        summary_path = memory_dir / f"{summary.session_id}_summary.md"
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(summary.to_markdown())

        return summary_path

    def _archive_original(self, session_path: str) -> Path:
        """gzip 压缩并归档原始文件"""
        archive_dir = self.workspace / ".aep" / "sessions" / "archive"
        archive_dir.mkdir(parents=True, exist_ok=True)

        archive_path = archive_dir / f"{Path(session_path).name}.gz"

        with open(session_path, 'rb') as f_in:
            with gzip.open(archive_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        return archive_path


@dataclass
class CompressionResult:
    """压缩结果"""
    summary_path: str
    archive_path: str
    original_size: int
    compressed_size: int
    compression_ratio: float
```

---

## 5. 测试

### 5.1 测试用例

```python
# tests/test_session_compressor.py

import pytest
import tempfile
from pathlib import Path

from aep_sdk.session.compressor import SessionCompressor, CompressionResult


class TestSessionCompressor:

    def test_compress_creates_summary(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # 创建测试会话文件
            session_path = self._create_test_session(tmpdir)

            compressor = SessionCompressor(tmpdir)
            result = compressor.compress(session_path)

            assert Path(result.summary_path).exists()
            assert result.summary_path.endswith('.md')

    def test_compress_creates_archive(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = self._create_test_session(tmpdir)

            compressor = SessionCompressor(tmpdir)
            result = compressor.compress(session_path)

            assert Path(result.archive_path).exists()
            assert result.archive_path.endswith('.gz')

    def test_compression_ratio(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = self._create_test_session(tmpdir, action_count=100)

            compressor = SessionCompressor(tmpdir)
            result = compressor.compress(session_path)

            assert result.compression_ratio >= 0.7  # >= 70%

    def test_summary_is_human_readable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = self._create_test_session(tmpdir)

            compressor = SessionCompressor(tmpdir)
            result = compressor.compress(session_path)

            with open(result.summary_path, 'r') as f:
                content = f.read()
                assert '# Session Summary' in content
                assert '## User Intent' in content

    def _create_test_session(self, tmpdir: str, action_count: int = 10) -> str:
        """创建测试会话文件"""
        sessions_dir = Path(tmpdir) / ".aep" / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)

        session_path = sessions_dir / "test_session.jsonl"
        with open(session_path, 'w') as f:
            for i in range(action_count):
                action = {
                    "id": f"action_{i}",
                    "timestamp": "2026-02-24T10:00:00Z",
                    "action_type": "message",
                    "trigger": f"Test trigger {i}",
                    "solution": f"Test solution {i}",
                    "result": "success",
                    "context": {"session_id": "test"},
                    "feedback": {"value": "positive"}
                }
                f.write(json.dumps(action) + '\n')

        return str(session_path)
```

---

## 6. 实现记录（回填）

* 实际改动：
* 关键 commit：

---

## 7. 风险与回滚

* 风险：压缩过程耗时过长
* 缓解：设置最大处理行动数，超限时截断
* 回滚：删除 archive/ 和 memory/ 目录

---

## 8. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-24 | AEP Protocol Team | 初版 |
