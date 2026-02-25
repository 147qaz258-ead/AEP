# TASK-E-004-FEEDBACK-002: 显式反馈收集

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-FEEDBACK-002.md`
> 任务ID：TASK-E-004-FEEDBACK-002
> Beads 任务ID：`（待创建）`
> 任务标题：FeedbackCollector 显式反馈收集
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：TODO
> 负责人：（待分配）
> 预估工期：4h
> 创建日期：2026-02-23

---

## 1. 任务目标

* **做什么**：实现 FeedbackCollector 的显式反馈收集功能
* **为什么做**：显式反馈是用户主动提供的，精度高

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-009
* 上游依赖：
  - **硬依赖**：SESSION-003（ActionLogger），FEEDBACK-001
* 下游任务：FEEDBACK-003

---

## 3. 验收标准

- [ ] AC1：`collect_explicit_feedback()` 正确关联反馈到 AgentAction
- [ ] AC2：反馈写入 JSONL 文件（更新对应 action 行）
- [ ] AC3：action_id 不存在时返回 False
- [ ] AC4：支持覆盖之前的反馈

---

## 4. 实施方案

```python
# aep_sdk/session/feedback.py

from typing import Optional
from ..models import Feedback
from .logger import ActionLogger


class FeedbackCollector:
    """反馈收集器"""

    def __init__(self, action_logger: ActionLogger):
        self._logger = action_logger

    def collect_explicit_feedback(
        self,
        action_id: str,
        value: str,
        score: Optional[float] = None,
        source: Optional[str] = None
    ) -> bool:
        """
        收集显式反馈。

        Args:
            action_id: 行动 ID
            value: 反馈值 ('positive' | 'negative' | 'neutral')
            score: 可选评分 0-1
            source: 反馈来源（如 'user_click', 'user_rating'）

        Returns:
            是否成功关联
        """
        # 创建反馈对象
        feedback = Feedback.create_explicit(
            action_id=action_id,
            value=value,
            score=score,
            source=source
        )

        # 更新 AgentAction
        return self._logger.update_action(
            action_id,
            {"feedback": feedback.to_dict()}
        )

    def collect_rating(
        self,
        action_id: str,
        rating: int,  # 1-5
        source: Optional[str] = None
    ) -> bool:
        """
        便捷方法：收集评分（转换为 0-1 分数）。

        Args:
            action_id: 行动 ID
            rating: 评分 1-5
            source: 反馈来源
        """
        # 转换 1-5 评分到 0-1 分数
        score = (rating - 1) / 4  # 1->0, 3->0.5, 5->1

        # 根据评分确定 value
        if rating >= 4:
            value = "positive"
        elif rating <= 2:
            value = "negative"
        else:
            value = "neutral"

        return self.collect_explicit_feedback(
            action_id=action_id,
            value=value,
            score=score,
            source=source or "user_rating"
        )

    def collect_thumbs_up(self, action_id: str) -> bool:
        """便捷方法：点赞"""
        return self.collect_explicit_feedback(
            action_id=action_id,
            value="positive",
            score=0.8,
            source="thumbs_up"
        )

    def collect_thumbs_down(self, action_id: str) -> bool:
        """便捷方法：踩"""
        return self.collect_explicit_feedback(
            action_id=action_id,
            value="negative",
            score=0.2,
            source="thumbs_down"
        )
```

---

## 5. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
