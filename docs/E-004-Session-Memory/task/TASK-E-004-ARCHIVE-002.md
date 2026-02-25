# TASK-E-004-ARCHIVE-002: Memory Manager

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-ARCHIVE-002.md`
> 任务ID：TASK-E-004-ARCHIVE-002
> Beads 任务ID：`（待创建）`
> 任务标题：Memory Manager 记忆管理器实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：TODO
> 负责人：（待分配）
> 预估工期：4h
> 创建日期：2026-02-24

---

## 1. 任务目标

* **做什么**：实现 MemoryManager 类，管理压缩摘要和归档文件的自动清理
* **为什么做**：长期运行会产生大量历史记录，需要定期清理
* **不做什么**：不实现压缩逻辑（ARCHIVE-001 负责）

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-010（会话压缩与归档）
* 上游依赖：
  - **硬依赖**：ARCHIVE-001（SessionCompressor）
* 下游任务：ARCHIVE-003

---

## 3. 验收标准

- [ ] AC1：`list_summaries()` 列出所有摘要文件
- [ ] AC2：`get_summary(session_id)` 获取指定摘要内容
- [ ] AC3：`cleanup_old_archives(days=30)` 清理过期归档
- [ ] AC4：支持配置归档保留天数
- [ ] AC5：清理前有日志记录

---

## 4. 实施方案

### 4.1 核心实现

```python
# aep_sdk/session/memory_manager.py

from typing import List, Optional
from pathlib import Path
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class MemoryManager:
    """
    记忆管理器，管理压缩摘要和归档文件。

    职责：
    - 列出/查询摘要
    - 自动清理过期归档
    """

    DEFAULT_RETENTION_DAYS = 30

    def __init__(self, workspace: str, retention_days: int = None):
        self.workspace = Path(workspace)
        self.memory_dir = self.workspace / ".aep" / "memory"
        self.archive_dir = self.workspace / ".aep" / "sessions" / "archive"
        self.retention_days = retention_days or self.DEFAULT_RETENTION_DAYS

    def list_summaries(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 10
    ) -> List[SummaryInfo]:
        """
        列出摘要文件。

        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            limit: 最大返回数量

        Returns:
            摘要信息列表
        """
        summaries = []

        if not self.memory_dir.exists():
            return summaries

        for summary_file in sorted(
            self.memory_dir.glob("*_summary.md"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        ):
            info = SummaryInfo(
                session_id=self._extract_session_id(summary_file.name),
                path=str(summary_file),
                created_at=datetime.fromtimestamp(
                    summary_file.stat().st_mtime
                ).isoformat(),
                size=summary_file.stat().st_size
            )
            summaries.append(info)

            if len(summaries) >= limit:
                break

        return summaries

    def get_summary(self, session_id: str) -> Optional[str]:
        """
        获取摘要内容。

        Args:
            session_id: 会话 ID

        Returns:
            Markdown 内容，或 None 如果不存在
        """
        summary_path = self.memory_dir / f"{session_id}_summary.md"

        if not summary_path.exists():
            return None

        with open(summary_path, 'r', encoding='utf-8') as f:
            return f.read()

    def cleanup_old_archives(self, days: int = None) -> CleanupResult:
        """
        清理过期归档。

        Args:
            days: 保留天数，默认使用实例配置

        Returns:
            CleanupResult: 清理结果统计
        """
        days = days or self.retention_days
        cutoff = datetime.now() - timedelta(days=days)

        deleted_count = 0
        freed_bytes = 0

        if not self.archive_dir.exists():
            return CleanupResult(deleted_count=0, freed_bytes=0)

        for archive_file in self.archive_dir.glob("**/*.jsonl.gz"):
            file_time = datetime.fromtimestamp(archive_file.stat().st_mtime)

            if file_time < cutoff:
                file_size = archive_file.stat().st_size
                logger.info(f"Deleting old archive: {archive_file}")
                archive_file.unlink()
                deleted_count += 1
                freed_bytes += file_size

        logger.info(
            f"Cleanup complete: {deleted_count} files, "
            f"{freed_bytes / 1024 / 1024:.2f} MB freed"
        )

        return CleanupResult(
            deleted_count=deleted_count,
            freed_bytes=freed_bytes
        )

    def get_storage_stats(self) -> StorageStats:
        """获取存储统计"""
        return StorageStats(
            sessions_size=self._dir_size(self.workspace / ".aep" / "sessions"),
            memory_size=self._dir_size(self.memory_dir),
            pending_size=self._dir_size(self.workspace / ".aep" / "pending"),
            archive_count=self._count_files(self.archive_dir, "*.gz"),
            summary_count=self._count_files(self.memory_dir, "*.md")
        )

    def _extract_session_id(self, filename: str) -> str:
        """从文件名提取 session_id"""
        return filename.replace("_summary.md", "")

    def _dir_size(self, path: Path) -> int:
        """计算目录大小"""
        if not path.exists():
            return 0
        return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())

    def _count_files(self, path: Path, pattern: str) -> int:
        """计算文件数量"""
        if not path.exists():
            return 0
        return len(list(path.glob(pattern)))


@dataclass
class SummaryInfo:
    """摘要信息"""
    session_id: str
    path: str
    created_at: str
    size: int


@dataclass
class CleanupResult:
    """清理结果"""
    deleted_count: int
    freed_bytes: int


@dataclass
class StorageStats:
    """存储统计"""
    sessions_size: int
    memory_size: int
    pending_size: int
    archive_count: int
    summary_count: int
```

---

## 5. 测试

```python
def test_list_summaries():
    manager = MemoryManager(tmpdir)
    summaries = manager.list_summaries(limit=5)
    assert isinstance(summaries, list)

def test_cleanup_old_archives():
    # 创建 31 天前的归档文件
    old_file = archive_dir / "old_session.jsonl.gz"
    old_file.touch()
    # 设置修改时间为 31 天前
    import os
    old_time = time.time() - 31 * 24 * 3600
    os.utime(old_file, (old_time, old_time))

    result = manager.cleanup_old_archives(days=30)
    assert result.deleted_count == 1
    assert not old_file.exists()
```

---

## 6. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-24 | AEP Protocol Team | 初版 |
