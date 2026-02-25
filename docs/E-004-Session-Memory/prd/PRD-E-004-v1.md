# E-004 Session Memory - PRD v1

> 文档路径：`/docs/E-004-Session-Memory/prd/PRD-E-004-v1.md`
>
> * EPIC_ID：E-004
> * EPIC_DIR：`E-004-Session-Memory`
> * 文档状态：草稿
> * 版本：v1
> * 创建人：AEP Protocol Team
> * 创建日期：2026-02-23
> * 更新日期：2026-02-23

---

> **注意**：本文档是 PRD 的正式版本，位于 Epic 目录下。
>
> 另有一份副本位于 `/docs/_project/prd-v1-session-memory.md`，作为项目级别的 PRD 索引。

---

## 关联文档

本 PRD 由以下 4 个 Story 实现：

| Story ID | 标题 | 优先级 | 状态 |
|----------|------|--------|------|
| STORY-007 | 会话自动记录 | P0 | 草稿 |
| STORY-008 | AgentAction 日志格式 | P0 | 草稿 |
| STORY-009 | 反馈收集机制 | P0 | 草稿 |
| STORY-010 | 会话压缩与归档 | P1 | 草稿 |

**详细 Story 文档**：`/docs/_project/stories/STORY-007~010-*.md`

---

## 摘要

E-004 Session Memory 为 AEP 协议引入"智能体会话记忆"能力，解决以下核心问题：

1. **数据源错位**：数据源应该是"智能体行动记录"而不是"传统日志"
2. **记忆丢失**：每次会话结束后上下文丢失
3. **反馈断层**：反馈与具体行动脱节
4. **存储不规范**：缺乏统一的存储位置和格式

### 核心设计

```
AgentAction 结构（对齐 Experience）

{
  "id": "action_...",
  "timestamp": "2026-02-23T10:00:00Z",
  "action_type": "tool_call" | "message" | "decision",
  "trigger": "遇到什么问题",
  "solution": "采取什么行动",
  "result": "success" | "failure" | "partial",
  "context": { "session_id": "...", ... },
  "feedback": { ... }  // 可选
}
```

### 统一存储位置

```
<workspace>/.aep/
├── sessions/       # 会话记录 (JSONL)
├── memory/         # 压缩记忆 (MD)
├── pending/        # 待发布队列
└── cache/          # 本地缓存
```

---

## 完整 PRD

详见：`/docs/_project/prd-v1-session-memory.md`

---

## 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
