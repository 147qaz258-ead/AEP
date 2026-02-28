# TASK-E-004-FEEDBACK-003: 隐式反馈收集

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-FEEDBACK-003.md`
> 任务ID：TASK-E-004-FEEDBACK-003
> Beads 任务ID：`（待创建）`
> 任务标题：FeedbackCollector 隐式反馈收集
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：DONE
> 负责人：dev
> 预估工期：4h
> 创建日期：2026-02-23
> 完成日期：2026-02-27

---

## 1. 任务目标

* **做什么**：实现隐式反馈收集，根据用户行为推断反馈
* **为什么做**：用户不会每次都主动提供反馈，需要系统推断

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-009
* 上游依赖：
  - **硬依赖**：FEEDBACK-002
* 下游任务：无

---

## 3. 验收标准

- [x] AC1：`collect_implicit_feedback()` 正确推断并关联反馈
- [x] AC2：支持用户采纳建议推断为正面反馈
- [x] AC3：支持用户重新提问推断为负面反馈
- [x] AC4：隐式反馈包含 evidence 字段说明推断依据

---

## 4. 实施方案

```python
# 扩展 FeedbackCollector

class FeedbackCollector:
    # ... 已有方法 ...

    def collect_implicit_feedback(
        self,
        action_id: str,
        value: str,
        evidence: Optional[str] = None
    ) -> bool:
        """
        收集隐式反馈。

        Args:
            action_id: 行动 ID
            value: 反馈值
            evidence: 推断依据

        Returns:
            是否成功关联
        """
        feedback = Feedback.create_implicit(
            action_id=action_id,
            value=value,
            evidence=evidence
        )

        return self._logger.update_action(
            action_id,
            {"feedback": feedback.to_dict()}
        )

    def infer_from_acceptance(self, action_id: str) -> bool:
        """
        用户采纳建议 -> 正面反馈。

        场景：用户复制了智能体提供的代码、接受了建议等
        """
        return self.collect_implicit_feedback(
            action_id=action_id,
            value="positive",
            evidence="user_accepted_suggestion"
        )

    def infer_from_rejection(self, action_id: str) -> bool:
        """
        用户拒绝建议 -> 负面反馈。

        场景：用户明确拒绝了智能体的建议
        """
        return self.collect_implicit_feedback(
            action_id=action_id,
            value="negative",
            evidence="user_rejected_suggestion"
        )

    def infer_from_requestion(self, action_id: str) -> bool:
        """
        用户重新提问 -> 部分负面反馈。

        场景：用户在短时间内对同一问题再次提问
        """
        return self.collect_implicit_feedback(
            action_id=action_id,
            value="negative",
            evidence="user_requestion_similar_topic"
        )

    def infer_from_copy(self, action_id: str) -> bool:
        """
        用户复制内容 -> 正面反馈。

        场景：用户复制了智能体的回复内容
        """
        return self.collect_implicit_feedback(
            action_id=action_id,
            value="positive",
            evidence="user_copied_content"
        )

    def infer_from_session_end(self, action_id: str, session_duration: float) -> bool:
        """
        会话结束时推断反馈。

        Args:
            action_id: 最后一个行动 ID
            session_duration: 会话时长（秒）

        推断规则：
        - 会话时长 < 30s -> 可能负面（问题未解决）
        - 会话时长 > 5min -> 可能正面（问题得到详细解答）
        """
        if session_duration < 30:
            value = "negative"
            evidence = f"short_session_{session_duration}s"
        elif session_duration > 300:  # 5分钟
            value = "positive"
            evidence = f"long_session_{session_duration}s"
        else:
            value = "neutral"
            evidence = f"session_duration_{session_duration}s"

        return self.collect_implicit_feedback(
            action_id=action_id,
            value=value,
            evidence=evidence
        )
```

---

## 5. 测试

```python
def test_infer_from_acceptance():
    collector.infer_from_acceptance("action_123")
    action = logger.get_action("action_123")
    assert action.feedback["value"] == "positive"
    assert action.feedback["evidence"] == "user_accepted_suggestion"

def test_infer_from_short_session():
    collector.infer_from_session_end("action_123", 15)  # 15秒
    action = logger.get_action("action_123")
    assert action.feedback["value"] == "negative"
```

---

## 6. [OPEN] 待确认

- [OPEN-1] 隐式反馈推断阈值如何设定？（产品待确认）

---

## 7. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
