# TASK-E-004-FEEDBACK-001: Feedback 数据模型

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-FEEDBACK-001.md`
> 任务ID：TASK-E-004-FEEDBACK-001
> Beads 任务ID：`（待创建）`
> 任务标题：Feedback 数据模型定义
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：DONE
> 负责人：（待分配）
> 预估工期：2h
> 创建日期：2026-02-23

---

## 1. 任务目标

* **做什么**：定义 Feedback 数据模型，支持显式和隐式反馈
* **为什么做**：反馈是 Experience 质量评估的核心数据

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-009（反馈收集）
* 上游依赖：
  - **硬依赖**：无（可与 SESSION-001 并行）
* 下游任务：FEEDBACK-002

---

## 3. 验收标准

- [x] AC1：Feedback 数据类包含 action_id, type, value, score, source, timestamp
- [x] AC2：支持显式反馈（explicit）和隐式反馈（implicit）类型
- [x] AC3：value 支持 positive/negative/neutral 三种值
- [x] AC4：score 为可选字段，范围 0-1

---

## 4. 实施方案

### 4.1 数据模型

```python
# aep_sdk/models.py 扩展

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

@dataclass
class Feedback:
    """
    用户反馈记录。

    Attributes:
        action_id: 关联的行动 ID
        type: 反馈类型 ('explicit' | 'implicit')
        value: 反馈值 ('positive' | 'negative' | 'neutral')
        score: 可选评分 (0-1)
        source: 反馈来源
        timestamp: 反馈时间
        evidence: 隐式反馈的推断依据
    """

    action_id: str
    type: str  # 'explicit' | 'implicit'
    value: str  # 'positive' | 'negative' | 'neutral'
    score: Optional[float] = None
    source: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    evidence: Optional[str] = None  # 隐式反馈的推断依据

    def __post_init__(self):
        # 验证 type
        valid_types = ('explicit', 'implicit')
        if self.type not in valid_types:
            raise ValueError(f"type must be one of {valid_types}")

        # 验证 value
        valid_values = ('positive', 'negative', 'neutral')
        if self.value not in valid_values:
            raise ValueError(f"value must be one of {valid_values}")

        # 验证 score
        if self.score is not None and not (0 <= self.score <= 1):
            raise ValueError("score must be between 0 and 1")

    @classmethod
    def create_explicit(
        cls,
        action_id: str,
        value: str,
        score: Optional[float] = None,
        source: Optional[str] = None
    ) -> "Feedback":
        """创建显式反馈"""
        return cls(
            action_id=action_id,
            type="explicit",
            value=value,
            score=score,
            source=source or "user"
        )

    @classmethod
    def create_implicit(
        cls,
        action_id: str,
        value: str,
        evidence: Optional[str] = None
    ) -> "Feedback":
        """创建隐式反馈"""
        return cls(
            action_id=action_id,
            type="implicit",
            value=value,
            evidence=evidence
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action_id": self.action_id,
            "type": self.type,
            "value": self.value,
            "score": self.score,
            "source": self.source,
            "timestamp": self.timestamp,
            "evidence": self.evidence
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Feedback":
        return cls(
            action_id=data["action_id"],
            type=data["type"],
            value=data["value"],
            score=data.get("score"),
            source=data.get("source"),
            timestamp=data.get("timestamp", datetime.now().isoformat()),
            evidence=data.get("evidence")
        )
```

---

## 5. 测试

```python
def test_create_explicit_feedback():
    fb = Feedback.create_explicit(
        action_id="action_123",
        value="positive",
        score=0.9,
        source="user_click"
    )
    assert fb.type == "explicit"
    assert fb.value == "positive"
    assert fb.score == 0.9

def test_create_implicit_feedback():
    fb = Feedback.create_implicit(
        action_id="action_123",
        value="positive",
        evidence="user_accepted_suggestion"
    )
    assert fb.type == "implicit"
    assert fb.evidence == "user_accepted_suggestion"

def test_invalid_type_raises_error():
    with pytest.raises(ValueError):
        Feedback(action_id="x", type="invalid", value="positive")

def test_invalid_score_raises_error():
    with pytest.raises(ValueError):
        Feedback(action_id="x", type="explicit", value="positive", score=1.5)
```

---

## 6. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
