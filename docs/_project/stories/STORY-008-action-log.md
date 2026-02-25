# STORY-008: AgentAction 日志格式（Action Log Format）

> **EPIC_ID:** E-004
>
> **EPIC_DIR:** E-004-Session-Memory
>
> **PRD Reference:** `/docs/_project/prd-v1-session-memory.md#52-f2-agentaction-日志格式action-log-format`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** Data Structure Definition

---

## User Story

**As an** Agent Developer,

**I want** a standardized action log format,

**So that** all agent interactions can be consistently recorded, analyzed, and transformed into experiences.

---

## Background & Motivation

### 问题

当前缺乏统一的智能体行动日志格式：
- 不同智能体记录的信息不一致
- 难以跨智能体比较和分析
- 无法直接映射到 Experience 结构

### 价值

标准化的 AgentAction 格式：
- 为所有智能体提供一致的记录规范
- 便于后续分析和处理
- 直接映射到 AEP Experience 结构

### 设计原则

1. **最小必要**：只记录核心信息，避免膨胀
2. **可扩展**：支持自定义上下文字段
3. **可映射**：字段设计参考 Experience 结构

---

## AgentAction Interface Definition

### TypeScript Interface

```typescript
/**
 * AgentAction - 智能体行动日志标准格式
 *
 * 设计原则：
 * 1. 与 Experience 结构对齐（trigger, solution, result）
 * 2. 支持三种核心行动类型
 * 3. 保留扩展性
 */
interface AgentAction {
  // ============ 基础信息（必填）============

  /**
   * 唯一标识符
   * 格式：UUID v4
   * 示例："action_12345678-1234-5678-abcd-1234567890ab"
   */
  id: string;

  /**
   * 行动发生时间
   * 格式：ISO 8601
   * 示例："2026-02-23T10:01:23.456Z"
   */
  timestamp: Date;

  // ============ 行动类型（必填）============

  /**
   * 行动类型
   * - tool_call: 调用工具（读文件、执行命令等）
   * - message: 发送消息给用户
   * - decision: 做出决策（选择方案、跳过步骤等）
   */
  action_type: 'tool_call' | 'message' | 'decision';

  // ============ 核心内容（必填，对齐 Experience）============

  /**
   * 触发条件 / 遇到的问题
   * - tool_call: 为什么调用这个工具
   * - message: 用户的问题是什么
   * - decision: 为什么需要做决策
   *
   * 示例："User reported timeout error when connecting to database"
   */
  trigger: string;

  /**
   * 采取的行动 / 解决方案
   * - tool_call: 调用了什么工具，参数是什么
   * - message: 回答了什么
   * - decision: 选择了什么方案
   *
   * 示例："Checked connection pool config, found max_connections=10"
   */
  solution: string;

  /**
   * 行动结果
   * - success: 成功完成
   * - failure: 失败
   * - partial: 部分成功（如：找到问题但未完全解决）
   */
  result: 'success' | 'failure' | 'partial';

  // ============ 上下文信息（必填）============

  /**
   * 上下文信息
   */
  context: {
    /**
     * 所属会话 ID
     * 用于关联同一会话的多个行动
     */
    session_id: string;

    /**
     * 父行动 ID
     * 用于建立行动之间的依赖关系
     * 示例：工具调用的父行动是对应的用户消息
     */
    parent_action_id?: string;

    /**
     * 工作空间路径
     */
    workspace?: string;

    /**
     * 使用的模型
     */
    model?: string;

    /**
     * 使用的工具列表
     */
    tools_used?: string[];

    /**
     * 扩展字段
     * 支持自定义上下文信息
     */
    [key: string]: any;
  };

  // ============ 反馈信息（可选，后续填充）============

  /**
   * 用户反馈
   * 在行动发生后由反馈机制填充
   */
  feedback?: {
    /**
     * 反馈类型
     * - explicit: 用户主动反馈（点击按钮、评分）
     * - implicit: 系统推断（采纳建议、重新提问）
     */
    type: 'explicit' | 'implicit';

    /**
     * 反馈值
     */
    value: 'positive' | 'negative' | 'neutral';

    /**
     * 反馈分数（0-1）
     */
    score?: number;

    /**
     * 反馈来源
     * 示例："thumbs_up_button", "solution_adopted"
     */
    source?: string;

    /**
     * 反馈时间
     */
    timestamp: Date;
  };

  // ============ 元数据（可选）============

  /**
   * 行动元数据
   */
  metadata?: {
    /**
     * 行动耗时（毫秒）
     */
    duration_ms?: number;

    /**
     * 消耗的 token 数
     */
    tokens_used?: number;

    /**
     * 智能体置信度（0-1）
     */
    confidence?: number;

    /**
     * 扩展字段
     */
    [key: string]: any;
  };

  // ============ 特殊标记（可选）============

  /**
   * 是否被截断
   * 当 trigger 或 solution 超过长度限制时设置
   */
  truncated?: boolean;

  /**
   * 原始长度（如果被截断）
   */
  original_length?: number;

  /**
   * 是否包含敏感信息
   * 设置后在上传时需要特殊处理
   */
  contains_sensitive?: boolean;

  /**
   * 是否已脱敏
   */
  redacted?: boolean;
}
```

---

## Action Types Detail

### Type 1: tool_call

工具调用行动，记录智能体调用外部工具的过程。

```typescript
// 示例：读取配置文件
{
  "id": "action_11111111-1111-1111-1111-111111111111",
  "timestamp": "2026-02-23T10:01:00.000Z",
  "action_type": "tool_call",
  "trigger": "Need to check database connection configuration",
  "solution": "Called read_file tool on /config/database.yml",
  "result": "success",
  "context": {
    "session_id": "sess_aaaabbbb-cccc-dddd-eeee-ffffffffffff",
    "parent_action_id": "action_00000000-0000-0000-0000-000000000000",
    "workspace": "/home/user/project",
    "model": "claude-opus-4-6",
    "tools_used": ["read_file"],
    "tool_name": "read_file",
    "tool_args": {
      "path": "/config/database.yml"
    },
    "tool_result": "content: pool: 5, timeout: 5000..."
  },
  "metadata": {
    "duration_ms": 45,
    "confidence": 0.95
  }
}
```

### Type 2: message

消息行动，记录智能体与用户的交互。

```typescript
// 示例：回答用户问题
{
  "id": "action_22222222-2222-2222-2222-222222222222",
  "timestamp": "2026-02-23T10:02:00.000Z",
  "action_type": "message",
  "trigger": "User asked: Why is my API returning 500 errors?",
  "solution": "Explained that the error is likely caused by database connection pool exhaustion, and suggested increasing max_connections.",
  "result": "success",
  "context": {
    "session_id": "sess_aaaabbbb-cccc-dddd-eeee-ffffffffffff",
    "parent_action_id": null,
    "workspace": "/home/user/project",
    "model": "claude-opus-4-6",
    "message_role": "assistant",
    "user_message_id": "action_00000000-0000-0000-0000-000000000000"
  },
  "metadata": {
    "duration_ms": 2345,
    "tokens_used": 456,
    "confidence": 0.88
  },
  "feedback": {
    "type": "explicit",
    "value": "positive",
    "score": 0.9,
    "source": "thumbs_up_button",
    "timestamp": "2026-02-23T10:02:30.000Z"
  }
}
```

### Type 3: decision

决策行动，记录智能体做出的关键决策。

```typescript
// 示例：选择修复方案
{
  "id": "action_33333333-3333-3333-3333-333333333333",
  "timestamp": "2026-02-23T10:03:00.000Z",
  "action_type": "decision",
  "trigger": "Multiple fix options available for timeout issue",
  "solution": "Selected option 2: Increase connection pool size. Reason: Lower risk, easier to rollback.",
  "result": "success",
  "context": {
    "session_id": "sess_aaaabbbb-cccc-dddd-eeee-ffffffffffff",
    "parent_action_id": "action_22222222-2222-2222-2222-222222222222",
    "workspace": "/home/user/project",
    "model": "claude-opus-4-6",
    "decision_type": "solution_selection",
    "options_considered": [
      {
        "id": "option_1",
        "description": "Increase timeout value",
        "pros": ["Quick fix"],
        "cons": ["May mask underlying issue"]
      },
      {
        "id": "option_2",
        "description": "Increase connection pool size",
        "pros": ["Addresses root cause", "Lower risk"],
        "cons": ["Uses more memory"]
      }
    ],
    "selected_option": "option_2"
  },
  "metadata": {
    "duration_ms": 500,
    "confidence": 0.92
  }
}
```

---

## Acceptance Criteria (AC)

### Schema Validation AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-8.1 | id 必须是有效的 UUID v4 | 单元测试：正则验证 |
| AC-8.2 | timestamp 必须是有效的 ISO 8601 格式 | 单元测试：Date.parse() |
| AC-8.3 | action_type 必须是三种类型之一 | 单元测试：枚举验证 |
| AC-8.4 | trigger 和 solution 不能为空 | 单元测试：非空验证 |
| AC-8.5 | result 必须是三种值之一 | 单元测试：枚举验证 |
| AC-8.6 | context.session_id 必填 | 单元测试：字段验证 |

### Field Constraints AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-8.7 | trigger 最大长度 2000 字符 | 单元测试：边界验证 |
| AC-8.8 | solution 最大长度 10000 字符 | 单元测试：边界验证 |
| AC-8.9 | 超长内容自动截断并标记 | 单元测试：截断逻辑 |
| AC-8.10 | feedback.score 范围 0-1 | 单元测试：范围验证 |

### Serialization AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-8.11 | 序列化为有效 JSON | 单元测试：JSON.stringify/parse |
| AC-8.12 | 反序列化恢复原始对象 | 单元测试：往返验证 |
| AC-8.13 | 支持可选字段缺失 | 单元测试：部分字段 |

---

## Boundary & Exception Cases

### Missing Optional Fields

- **Scenario:** 只填写必填字段
- **Behavior:** 正常序列化，可选字段不出现

### Extra Fields

- **Scenario:** 添加未定义的字段
- **Behavior:** 保留在 context 或 metadata 的扩展字段中

### Nested Objects

- **Scenario:** context 中包含复杂嵌套对象
- **Behavior:** 支持，但总 JSON 大小不超过 100KB

### Unicode Content

- **Scenario:** trigger/solution 包含中文、emoji
- **Behavior:** 正确编码，UTF-8 支持

---

## Technical Notes

### JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "timestamp", "action_type", "trigger", "solution", "result", "context"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^action_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "action_type": {
      "type": "string",
      "enum": ["tool_call", "message", "decision"]
    },
    "trigger": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "solution": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "result": {
      "type": "string",
      "enum": ["success", "failure", "partial"]
    },
    "context": {
      "type": "object",
      "required": ["session_id"],
      "properties": {
        "session_id": { "type": "string" },
        "parent_action_id": { "type": "string" },
        "workspace": { "type": "string" },
        "model": { "type": "string" },
        "tools_used": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "additionalProperties": true
    },
    "feedback": {
      "type": "object",
      "required": ["type", "value", "timestamp"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["explicit", "implicit"]
        },
        "value": {
          "type": "string",
          "enum": ["positive", "negative", "neutral"]
        },
        "score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "source": { "type": "string" },
        "timestamp": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true
    },
    "truncated": { "type": "boolean" },
    "original_length": { "type": "integer" },
    "contains_sensitive": { "type": "boolean" },
    "redacted": { "type": "boolean" }
  }
}
```

### Experience Mapping

AgentAction 到 Experience 的映射关系：

```
AgentAction                    Experience
─────────────                  ───────────
trigger                    →   trigger
solution                   →   solution
result (success/partial)   →   confidence (映射)
context                    →   context (部分)
feedback.score             →   validation (部分)
```

---

## Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| JSON Schema | Standard | 用于验证格式 |
| UUID Generator | Library | 生成唯一 ID |

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-8.1] | 是否需要支持加密字段？ | 安全 | 2026-03-01 |
| [OPEN-8.2] | 最大 JSON 大小限制？ | 开发 | 2026-02-28 |
| [OPEN-8.3] | 是否需要版本字段？ | 产品 | 2026-02-28 |

---

## References

- **PRD:** `/docs/_project/prd-v1-session-memory.md#52`
- **Experience 格式:** `/docs/_project/biz-overview.md` §10
- **JSON Schema:** https://json-schema.org/

---

*Last Updated: 2026-02-23*
