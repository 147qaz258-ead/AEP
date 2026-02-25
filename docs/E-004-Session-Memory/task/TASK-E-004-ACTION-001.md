# TASK-E-004-ACTION-001: tool_call 类型日志

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-ACTION-001.md`
> 任务ID：TASK-E-004-ACTION-001
> Beads 任务ID：`（待创建）`
> 任务标题：tool_call 类型日志完整实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：TODO
> 负责人：（待分配）
> 预估工期：3h
> 创建日期：2026-02-23

---

## 1. 任务目标

* **做什么**：完善 tool_call 类型行动日志，增加工具调用特有的上下文信息
* **为什么做**：工具调用是最常见的智能体行动类型，需要完整记录
* **不做什么**：不实现其他类型的日志

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-008（行动日志）
* 关联 Slice：`NO_SLICE`
* 关联 TECH：`../tech/TECH-E-004-v1.md`
* 上游依赖：
  - **硬依赖**：SESSION-001（AgentAction 类型）
  - **接口依赖**：SESSION-003（ActionLogger 接口）
* 下游任务：ACTION-002

---

## 3. 验收标准

- [ ] AC1：tool_call 日志包含 tool_name, tool_args, tool_result
- [ ] AC2：支持记录工具执行时间（duration_ms）
- [ ] AC3：支持记录工具调用链（parent_action_id）
- [ ] AC4：支持标记敏感参数（redacted）

---

## 4. 实施方案

### 4.1 扩展 ActionLogger

```python
# 扩展 log_tool_call 方法

def log_tool_call(
    self,
    tool_name: str,
    trigger: str,
    solution: str,
    result: str,
    tool_args: Optional[Dict[str, Any]] = None,
    tool_result: Optional[str] = None,
    duration_ms: Optional[float] = None,
    parent_action_id: Optional[str] = None,
    redacted_fields: Optional[List[str]] = None,
    context: Optional[Dict[str, Any]] = None
) -> str:
    """
    记录工具调用，包含完整的工具上下文。

    Args:
        tool_name: 工具名称
        trigger: 触发原因
        solution: 工具执行的操作
        result: 执行结果
        tool_args: 工具参数
        tool_result: 工具返回值
        duration_ms: 执行耗时
        parent_action_id: 父行动 ID
        redacted_fields: 需要脱敏的字段名
        context: 额外上下文
    """
    ctx = context or {}
    ctx["tool_name"] = tool_name
    ctx["tools_used"] = [tool_name]

    if tool_args:
        # 处理敏感字段
        if redacted_fields:
            tool_args = self._redact_fields(tool_args, redacted_fields)
        ctx["tool_args"] = tool_args

    if tool_result:
        ctx["tool_result"] = tool_result[:1000]  # 截断过长的返回值

    if parent_action_id:
        ctx["parent_action_id"] = parent_action_id

    metadata = {}
    if duration_ms is not None:
        metadata["duration_ms"] = duration_ms

    action = AgentAction.create(
        action_type="tool_call",
        trigger=trigger,
        solution=solution,
        result=result,
        context=ctx,
        metadata=metadata if metadata else None
    )
    return self.log_action(action)

def _redact_fields(self, data: Dict[str, Any], fields: List[str]) -> Dict[str, Any]:
    """脱敏敏感字段"""
    result = data.copy()
    for field in fields:
        if field in result:
            result[field] = "[REDACTED]"
    return result
```

---

## 5. 测试

```python
def test_tool_call_with_args():
    logger.log_tool_call(
        tool_name="file_read",
        trigger="Need to read config",
        solution="Read /etc/config.json",
        result="success",
        tool_args={"path": "/etc/config.json"},
        tool_result='{"key": "value"}',
        duration_ms=15.5
    )
```

---

## 6. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
