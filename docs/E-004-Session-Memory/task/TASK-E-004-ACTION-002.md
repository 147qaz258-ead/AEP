# TASK-E-004-ACTION-002: message 类型日志

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-ACTION-002.md`
> 任务ID：TASK-E-004-ACTION-002
> Beads 任务ID：`（待创建）`
> 任务标题：message 类型日志完整实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：TODO
> 负责人：（待分配）
> 预估工期：2h
> 创建日期：2026-02-23

---

## 1. 任务目标

* **做什么**：完善 message 类型行动日志，记录智能体与用户的对话
* **为什么做**：对话是智能体交互的核心形式

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-008
* 上游依赖：
  - **硬依赖**：SESSION-003（ActionLogger）, ACTION-001
* 下游任务：ACTION-003

---

## 3. 验收标准

- [ ] AC1：message 日志包含 user_message, agent_message
- [ ] AC2：支持记录 token 使用量
- [ ] AC3：支持记录模型信息
- [ ] AC4：超长消息自动截断（>10KB）

---

## 4. 实施方案

```python
def log_message(
    self,
    trigger: str,  # 用户消息
    solution: str,  # 智能体回复
    result: str,
    tokens_used: Optional[int] = None,
    model: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
) -> str:
    """记录消息"""
    ctx = context or {}

    # 截断超长消息
    ctx["user_message"] = trigger[:10000] if len(trigger) > 10000 else trigger
    ctx["agent_message"] = solution[:10000] if len(solution) > 10000 else solution

    metadata = {}
    if tokens_used:
        metadata["tokens_used"] = tokens_used
    if model:
        ctx["model"] = model

    action = AgentAction.create(
        action_type="message",
        trigger=trigger,
        solution=solution,
        result=result,
        context=ctx,
        metadata=metadata if metadata else None
    )
    return self.log_action(action)
```

---

## 5. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
