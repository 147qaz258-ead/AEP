# TASK-E-004-ACTION-001: tool_call 类型日志

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-ACTION-001.md`
> 任务ID：TASK-E-004-ACTION-001
> Beads 任务ID：`42q`
> 任务标题：tool_call 类型日志完整实现
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：DONE
> 负责人：dev
> 预估工期：3h
> 创建日期：2026-02-23
> 完成日期：2026-02-26

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

- [x] AC1：tool_call 日志包含 tool_name, tool_args, tool_result
- [x] AC2：支持记录工具执行时间（duration_ms）
- [ ] AC3：支持记录工具调用链（parent_action_id）- 待后续版本
- [ ] AC4：支持标记敏感参数（redacted）- 待后续版本

---

## 4. 实施方案

### 4.1 实现的接口

```typescript
/**
 * Structured log entry for tool calls.
 * Provides a convenient way to log tool calls with detailed execution info.
 */
export interface ToolCallLog {
  /** Name of the tool that was called */
  tool_name: string;
  /** Arguments passed to the tool */
  arguments: Record<string, any>;
  /** Result returned by the tool */
  result: any;
  /** Error message if the tool call failed */
  error?: string;
  /** Duration of the tool call in milliseconds */
  duration_ms?: number;
}
```

### 4.2 实现的方法

```typescript
/**
 * Log a tool call with structured execution details.
 *
 * @param log - The tool call log entry
 * @returns The action ID
 */
log_tool_call(log: ToolCallLog): string;
```

### 4.3 Context 字段映射

| ToolCallLog 字段 | AgentAction.context 字段 |
|-----------------|-------------------------|
| tool_name | tool_name, tools_used |
| arguments | tool_arguments |
| result | tool_result |
| error | tool_error |
| duration_ms | duration_ms |

### 4.4 使用示例

```typescript
// Successful tool call
logger.log_tool_call({
  tool_name: 'read_file',
  arguments: { path: '/src/index.ts' },
  result: { content: '...' },
  duration_ms: 150
});

// Failed tool call
logger.log_tool_call({
  tool_name: 'bash',
  arguments: { command: 'npm test' },
  result: null,
  error: 'Command failed with exit code 1',
  duration_ms: 5230
});
```

---

## 5. 测试

### 5.1 测试用例

- [x] 测试基本 tool_call 日志记录
- [x] 测试带 duration_ms 的日志
- [x] 测试带 error 的失败日志
- [x] 测试复杂嵌套参数和结果
- [x] 测试持久化到 JSONL 文件
- [x] 测试无活跃 session 时抛出异常

### 5.2 测试执行结果

```
✓ src/aep/session/__tests__/action-logger.test.ts (39 tests) 141ms
 Test Files  1 passed (1)
 Tests  39 passed (39)
```

---

## 6. 变更文件

| 文件路径 | 变更类型 |
|---------|---------|
| `src/aep/session/action-logger.ts` | 修改：添加 ToolCallLog 接口和 log_tool_call 方法 |
| `src/aep/session/index.ts` | 修改：导出 ToolCallLog 接口 |
| `src/aep/session/__tests__/action-logger.test.ts` | 修改：添加 log_tool_call 测试用例 |

---

## 7. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
| v1.1 | 2026-02-26 | dev | 实现 ToolCallLog 接口和 log_tool_call 方法 |