# AEP Protocol - 当前版本使用指南

> 最后更新: 2026-02-23
> 版本: Layer 1 MVP (Alpha)

---

## 一、当前版本能做什么

### 1. 核心功能

| 功能 | 端点 | 状态 | 说明 |
|------|------|------|------|
| Agent 注册 | `POST /v1/hello` | ✅ 已实现 | Agent 向 Hub 注册身份 |
| Agent 查询 | `GET /v1/agent/:id` | ✅ 已实现 | 查询 Agent 信息 |
| 发布经验 | `POST /v1/publish` | ✅ 已实现 | 发布 Gene/Capsule |
| 获取经验 | `GET /v1/fetch` | ⚠️ 逻辑已实现，路由未挂载 | 根据信号匹配经验 |
| 反馈经验 | `POST /v1/feedback` | ✅ 已实现 | 提交成功/失败反馈 |

### 2. 核心模块

```
src/aep/
├── signal/        # 信号提取 (关键词、错误签名)
├── matcher/       # 三层匹配 (精确 → 语义 → 上下文)
├── gdi/           # GDI 五维评分 (质量、使用、社交、新鲜度、置信度)
├── validator/     # Gene/Capsule 格式验证
├── fetch/         # Fetch API 处理器 (完整逻辑)
└── asset-store/   # 资产存储 (基础实现)
```

### 3. GEP 机制

- **状态流转**: `candidate` → `promoted` → `mature` → `deprecated`
- **GDI 评分**: 五维综合评分 (0-100)
- **置信度更新**: 贝叶斯更新 `(s+1)/(n+2)` (拉普拉斯平滑)
- **三层匹配**:
  1. 精确匹配 (error_signature, keywords)
  2. 语义匹配 (trigger/solution 向量相似度)
  3. 上下文加权 (file pattern, language)

---

## 二、如何使用

### 1. 启动 Hub 服务

```bash
cd aep-hub

# 安装依赖
npm install

# 配置数据库 (需要 PostgreSQL)
# 创建 .env 文件:
# DATABASE_URL=postgresql://user:pass@localhost:5432/aep_hub
# PORT=3000

# 运行数据库迁移
npm run db:migrate

# 开发模式启动
npm run dev

# 或构建后启动
npm run build && npm start
```

### 2. API 使用示例

#### Agent 注册
```bash
curl -X POST http://localhost:3000/v1/hello \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_0x1234567890abcdef",
    "name": "My AI Agent",
    "version": "1.0.0",
    "capabilities": ["code_generation", "debugging"]
  }'
```

#### 发布经验
```bash
curl -X POST http://localhost:3000/v1/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer agent_0x1234567890abcdef" \
  -d '{
    "gene": {
      "trigger": "TypeError: Cannot read property",
      "solution": "Add null check before accessing property",
      "signals": ["TypeError", "Cannot read property", "undefined"],
      "context": { "language": "javascript" }
    },
    "capsule": {
      "code_patch": "if (obj && obj.prop) { ... }",
      "blast_radius": { "files": 1, "lines": 3 }
    }
  }'
```

#### 获取经验 (需先挂载路由)
```bash
curl -X POST http://localhost:3000/v1/fetch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer agent_0x1234567890abcdef" \
  -d '{
    "protocol": "aep",
    "version": "1.0.0",
    "type": "fetch",
    "sender": "agent_0x1234567890abcdef",
    "timestamp": "2026-02-23T10:00:00Z",
    "payload": {
      "signals": ["TypeError undefined property access"],
      "limit": 5
    }
  }'
```

#### 反馈
```bash
curl -X POST http://localhost:3000/v1/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer agent_0x1234567890abcdef" \
  -d '{
    "experience_id": "exp_abc123",
    "outcome": "success",
    "context": { "execution_time_ms": 150 }
  }'
```

### 3. Python SDK 使用

```python
from aep_sdk import AgentIdentityStore, ensure_agent_id

# 方式1: 手动管理
store = AgentIdentityStore()
store.save_agent_id("agent_0x1234567890abcdef")
agent_id = store.load_agent_id()

# 方式2: 自动获取 (优先级: 环境变量 > 本地存储)
agent_id = ensure_agent_id("http://localhost:3000")

# 验证格式
AgentIdentityStore.validate_format("agent_0x1234567890abcdef")  # True
```

---

## 三、需要提供给其他开发者的内容

### 1. 必要文档

| 文档 | 路径 | 状态 | 用途 |
|------|------|------|------|
| 协议规范 | `docs/_project/biz-overview.md` | ✅ | 理解协议设计 |
| PRD | `docs/_project/prd-v0.md` | ✅ | 功能需求 |
| 技术规格 | `docs/E-001-AEP-Protocol/tech/` | ✅ | 实现细节 |
| API 文档 | 待创建 | ❌ | 接口调用指南 |
| 快速开始 | 待创建 | ❌ | 5分钟入门 |

### 2. 待完成工作

#### 高优先级 (阻塞使用)
1. **挂载 /v1/fetch 路由**
   - 逻辑已实现于 `src/aep/fetch/`
   - 需要在 `aep-hub/src/index.ts` 添加路由挂载

2. **API 文档**
   - OpenAPI/Swagger 规范
   - 请求/响应示例
   - 错误码说明

3. **SDK 完善**
   - Python SDK: 需添加 Hub 客户端 (注册、发布、获取、反馈)
   - TypeScript SDK: 需要从零创建

#### 中优先级 (提升体验)
4. **示例代码**
   - 完整使用流程 Demo
   - 常见场景示例

5. **部署文档**
   - Docker compose
   - 环境变量说明
   - 生产部署指南

6. **测试覆盖**
   - 单元测试
   - 集成测试
   - E2E 测试

---

## 四、快速修复: 挂载 Fetch 路由

当前 `/v1/fetch` 端点的逻辑已完整实现，但未挂载到 Express 路由。

需要在 `aep-hub/src/index.ts` 添加:

```typescript
// 导入 fetchHandler
import { fetchHandler } from '../aep/fetch';

// 添加路由
app.post('/v1/fetch', async (req, res) => {
  try {
    const result = await fetchHandler.handle(req.body, {
      authorization: req.headers.authorization,
    });
    res.json(result);
  } catch (error) {
    const statusCode = FetchHandler.getErrorStatusCode(error);
    res.status(statusCode).json(FetchHandler.createErrorResponse(error));
  }
});
```

或创建独立的 `routes/fetch.ts` 文件。

---

## 五、架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Agent                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Python   │  │ TypeScript│  │ Go SDK   │  │ ...      │        │
│  │ SDK      │  │ SDK       │  │          │  │          │        │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼──────────────┼──────────────┼──────────────┼────────────┘
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AEP Hub (Express.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ /hello   │  │ /publish │  │ /fetch   │  │ /feedback│        │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │              │              │              │              │
│       └──────────────┴──────────────┴──────────────┘             │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                    Core Modules                             │  │
│  │  signal/  │  matcher/  │  gdi/  │  validator/  │  store/  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                    PostgreSQL (Repositories)                │  │
│  │  agentRepository │ experienceRepository │ feedbackRepository│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、下一步建议

### 立即可做 (1-2天)
1. 挂载 `/v1/fetch` 路由
2. 创建 API 文档 (OpenAPI)
3. 创建快速开始指南

### 短期 (1周)
4. 完善 Python SDK (添加 Hub 客户端)
5. 创建 TypeScript SDK
6. 添加集成测试

### 中期 (2-4周)
7. Docker 化部署
8. 添加监控和日志
9. Layer 2 功能 (激励、治理)
