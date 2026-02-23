# TASK-E-003-HUB-001: Mount Fetch Route

> Epic: E-003 SDK Core Implementation
> Story: Hub Complete API
> Priority: P0
> Status: TODO
> Beads 任务ID：待创建

---

## 任务描述

将已实现的 Fetch 逻辑挂载到 Express 路由，完成 `/v1/fetch` 端点。

## 验收标准

- [ ] 创建 `routes/fetch.ts` 路由文件
- [ ] 挂载到 `index.ts`
- [ ] API 文档更新
- [ ] 集成测试通过

## 接口定义

```bash
# 请求
POST /v1/fetch
Authorization: Bearer agent_0x...
Content-Type: application/json

{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "fetch",
  "sender": "agent_0x...",
  "timestamp": "2026-02-23T10:00:00Z",
  "payload": {
    "signals": ["TypeError undefined"],
    "limit": 5
  }
}

# 响应
{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "fetch_response",
  "timestamp": "2026-02-23T10:00:01Z",
  "payload": {
    "experiences": [...],
    "count": 3,
    "query_id": "qry_..."
  }
}
```

## 实现指南

1. 创建 `aep-hub/src/routes/fetch.ts`
2. 导入 `src/aep/fetch` 的 handler
3. 在 `index.ts` 添加: `app.use('/v1/fetch', fetchRouter)`
4. 更新 `/v1` 端点列表

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `aep-hub/src/routes/fetch.ts` | CREATE | Fetch 路由 |
| `aep-hub/src/routes/index.ts` | MODIFY | 导出 fetchRouter |
| `aep-hub/src/index.ts` | MODIFY | 挂载路由 |

## 依赖

- 无（Fetch 逻辑已实现于 `src/aep/fetch/`）

## 预计工时

2h
