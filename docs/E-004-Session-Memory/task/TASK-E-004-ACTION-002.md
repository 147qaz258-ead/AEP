# TASK-E-004-ACTION-002: message 类型日志

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-ACTION-002.md`
> 任务ID：TASK-E-004-ACTION-002
> Beads 任务ID：`awx`
> 任务标题：message 类型日志完整实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：DONE
> 负责人：dev
> 预估工期：2h
> 创建日期：2026-02-23
> 完成日期：2026-02-27

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

- [x] AC1：message 日志包含 user_message, agent_message
- [x] AC2：支持记录 token 使用量
- [x] AC3：支持记录模型信息
- [x] AC4：超长消息自动截断（>10KB）

---

## 4. 实施方案

### 4.1 TypeScript 实现

**文件**: `src/aep/session/action-logger.ts`

```typescript
export interface MessageLog {
  /** The user's input message */
  user_message: string;
  /** The agent's response message */
  agent_message: string;
  /** Number of tokens used (optional) */
  tokens_used?: number;
  /** Model identifier (optional) */
  model?: string;
  /** Additional context (optional) */
  context?: Record<string, unknown>;
  /** Result status (default: 'success') */
  result?: 'success' | 'failure' | 'partial';
}

log_message(log: MessageLog): string;
```

### 4.2 Python 实现

**文件**: `aep-sdk/src/aep_sdk/session/action_logger.py`

```python
@dataclass
class MessageLog:
    user_message: str
    agent_message: str
    tokens_used: Optional[int] = None
    model: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    result: str = "success"

def log_message_structured(self, log: MessageLog) -> str:
    # ...
```

### 4.3 截断逻辑

消息超过 10KB 自动截断，添加 `...[truncated]` 后缀。

---

## 5. 测试记录

### TypeScript 测试

```
✓ src/aep/session/__tests__/action-logger.test.ts (48 tests)
```

测试覆盖:
- 基本 message 日志记录
- tokens_used 记录
- model 信息记录
- 超长消息截断
- JSONL 持久化

### Python 测试

```
tests/test_action_logger.py (31 tests)
```

---

## 6. 变更文件

| 文件路径 | 变更类型 |
|---------|---------|
| `src/aep/session/action-logger.ts` | 添加 MessageLog 接口和 log_message 方法 |
| `src/aep/session/index.ts` | 导出 MessageLog 接口 |
| `src/aep/session/__tests__/action-logger.test.ts` | 添加 log_message 测试用例 |
| `aep-sdk/src/aep_sdk/session/action_logger.py` | 添加 MessageLog 数据类和 log_message_structured 方法 |

---

## 7. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
| v1.1 | 2026-02-27 | dev | 实现 MessageLog 接口和 log_message 方法 |
