# AEP 使用场景验证

## 问题定义

**核心问题**：如何让智能体（如 Claude Code）主动使用 AEP 协议？

## 竞品解决方案

### claude-mem 方案
```
触发机制：5个生命周期钩子
- SessionStart: 检索相关记忆注入上下文
- UserPromptSubmit: 分析用户意图
- PostToolUse: 自动捕获工具调用
- Stop: 压缩会话
- SessionEnd: 生成摘要存储

关键：钩子是"自动触发"的，不需要 AI 主动思考
```

### mcp-memory-service 方案
```
触发机制：MCP 工具调用
- AI 可以主动调用 memory_search 工具
- AI 可以主动调用 memory_store 工具
- 按 X-Agent-ID 隔离不同智能体的记忆

关键：提供"工具"让 AI 可以主动调用
```

## AEP 可以采用的方案

### 方案 1：MCP 工具集成（推荐）

```typescript
// 为 Claude Code 提供 MCP 工具
{
  name: "aep_search_experience",
  description: "搜索历史经验，找到类似问题的解决方案",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "问题描述或信号" },
      limit: { type: "number", default: 5 }
    }
  }
}

{
  name: "aep_record_experience",
  description: "记录当前会话的经验，供未来使用",
  inputSchema: {
    type: "object",
    properties: {
      problem: { type: "string" },
      solution: { type: "string" },
      signals: { type: "array", items: { type: "string" } }
    }
  }
}
```

### 方案 2：CLAUDE.md 自动注入

```markdown
# 项目经验库

当你遇到以下类型的问题时，请先搜索经验库：

## 搜索命令
- `aep search "问题描述"` - 搜索相关经验

## 已知信号
- TypeScript 错误 → 检查 tsconfig.json
- 依赖冲突 → 使用 pnpm resolve
- ...
```

### 方案 3：钩子自动触发（类似 claude-mem）

```json
// .claude/hooks.json
{
  "PostToolUse": "aep record --auto",
  "SessionStart": "aep search --context"
}
```

## 验证步骤

### 第一步：让我现在就尝试使用 AEP

1. 我当前遇到的问题：**AEP 产品定位不清晰**
2. 我应该搜索什么信号？
3. 如果没有相关经验，我如何记录新的经验？

### 第二步：设计最小可用流程

```
┌─────────────────────────────────────────────────────────────┐
│                智能体使用 AEP 的最小流程                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 遇到问题                                                │
│     ↓                                                       │
│  2. 提取信号（关键词、错误类型、上下文）                    │
│     ↓                                                       │
│  3. 检索经验（aep search）                                  │
│     ↓                                                       │
│  4. 如果找到 → 应用经验                                     │
│     如果没找到 → 探索解决 → 记录新经验（aep record）        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 第三步：实际测试

**问题**：我现在如何使用 AEP？

**现状**：
- `.aep/sessions/` 目录存在但为空
- 没有 MCP 工具可用
- 没有自动钩子触发

**缺失的关键环节**：
1. ❌ 没有检索入口（MCP 工具或 CLI）
2. ❌ 没有自动记录机制
3. ❌ 没有信号提取逻辑

## 下一步建议

1. **创建 CLI 工具**：`aep search` 和 `aep record`
2. **创建 MCP 服务器**：让 Claude Code 可以主动调用
3. **创建钩子配置**：自动触发记录和检索

你想先实现哪个？