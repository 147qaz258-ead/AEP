# AEP 协议规范定义 PRD - v0（E-001）

> 文档路径：`/docs/E-001-AEP-Protocol/prd/PRD-E-001-v0.md`
>
> * EPIC_ID：E-001
> * EPIC_DIR：`E-001-AEP-Protocol`
> * 文档状态：草稿
> * 版本：v0（探索版）
> * 创建人：AEP Protocol Team
> * 创建日期：2026-02-20
> * 更新日期：2026-02-20

---

## 0. 关联信息（References）

* biz-overview：`/docs/_project/biz-overview-mvp.md`
* Story：`../story/STORY-E-001-001-core.md`
* Tech Design：`../tech/TECH-E-001-v1.md`（待创建）
* Proj Plan：`../proj/PROJ-E-001-v1.md`（待创建）

---

## 1. 背景与动机（Background）

### 1.1 现状

当前 AI Agent 生态中，各 Agent 的经验完全孤立：
- 每次遇到相同问题时，Agent 需要从零开始分析和解决
- 对话结束后，有价值的上下文和解决方案随之丢失
- 无法复用其他 Agent 已经验证成功的经验
- 缺乏统一的协议来交换和共享经验

### 1.2 问题

| 优先级 | 问题 | 场景描述 |
|--------|------|---------|
| **P0** | 经验孤立 | Agent每次修bug都从零开始，无法复用之前的成功经验 |
| **P0** | 上下文失忆 | 对话结束后信息丢失，下次又需要重新解释项目架构 |
| **P1** | 无法追溯 | 不知道经验为什么有效，无法验证经验的可靠性 |
| **P1** | 跨模型失效 | 在一个模型上有效的经验，换模型后可能失效 |

### 1.3 影响

- **开发效率低**：重复解决相同问题，浪费时间和算力
- **知识无法积累**：有价值的解决方案无法沉淀
- **协作困难**：多个 Agent 之间无法共享经验
- **质量参差不齐**：缺乏有效的经验质量评估机制

---

## 2. 目标与成功标准（Goals & Success Metrics）

### 2.1 本 Epic 业务目标（摘自 biz-overview）

| 目标ID | 目标 | 当前值 | 目标值 | 口径 |
|--------|------|--------|--------|------|
| G1 | 经验检索命中率 | 0% | 60% | 有相关经验时能检索到的比例 |
| G2 | 经验应用成功率 | 0% | 70% | 应用经验后问题解决的比例 |
| G3 | SDK接入时间 | N/A | <30分钟 | 开发者完成首次接入的时间 |
| G4 | 单次消息延迟 | N/A | <100ms | 消息发送到响应的时间 |

### 2.2 本 Epic 交付目标

1. **协议规范文档（SPEC.md）**：定义消息格式、类型和交互规则
2. **JSON Schema 定义**：完整的消息结构校验规则
3. **示例消息集合**：覆盖所有消息类型的示例
4. **Python SDK（alpha）**：核心 API 实现，支持 pip install

### 2.3 体验北极星

> **一句话北极星**：让 Agent 在遇到问题时，能在 100ms 内找到并理解相关经验。

**体验原则**：
1. **极简接入**：30分钟内完成首次接入，5行代码实现核心流程
2. **稳定协议**：协议层只定义"传输什么"，不定义"如何处理"
3. **可追溯性**：每条经验都有审计证据，支持事后追溯

---

## 3. 范围与非目标（Scope & Non-goals）

### 3.1 In Scope（本期必须做）

**核心协议功能**：
```
├── Envelope 信封格式
│   ├── protocol/version 字段
│   ├── message_type 字段
│   ├── message_id 字段
│   ├── sender_id 字段
│   ├── timestamp 字段
│   └── payload 字段
│
├── 4种消息类型
│   ├── PUBLISH - 发布经验/反馈
│   ├── RETRIEVE - 检索经验
│   ├── VALIDATE - 验证经验效果
│   └── REWARD - 更新权重积分
│
├── Experience 对象
│   ├── 核心字段：id, origin, trigger, content, fitness_score
│   ├── 可选字段：audit, model_fingerprint, _extensions
│   └── JSON Schema 定义
│
├── Feedback 机制
│   ├── outcome 字段：success/failure/partial/irrelevant
│   ├── score 字段：0-1 浮点数
│   └── notes 字段：文本备注
│
├── fitness_score 权重积分
│   ├── 基础计算公式
│   ├── 成功率因子
│   └── 新鲜度因子
│
└── Python SDK
    ├── 核心类：AEPClient, Experience, Feedback
    ├── 发布/检索/验证/激励 API
    └── JSON Schema 校验
```

**协议交付物**：
```
├── SPEC.md - 协议规范文档
├── schemas/ - JSON Schema 定义
│   ├── envelope.schema.json
│   ├── experience.schema.json
│   └── feedback.schema.json
├── examples/ - 示例消息
│   ├── publish-experience.json
│   ├── retrieve-query.json
│   ├── validate-feedback.json
│   └── reward-fitness.json
└── SDK API 文档
```

### 3.2 Out of Scope（本期不做，仅预留字段）

```
Phase 2（非本期）：
├── 跨模型安全检测
├── 伦理检查引擎
├── 详细审计查询

Phase 3（非本期）：
├── 跨链激励（ETH/SOL）
├── DAO治理
├── 企业积分对接

Phase 4（非本期）：
├── 物理机器人消息
├── 复杂协作场景
└── KV Cache优化
```

---

## 4. 用户与场景（Users & Scenarios）

### 4.1 用户角色

| 角色 | 描述 | 核心诉求 |
|------|------|---------|
| **Agent 开发者** | 使用 SDK 接入协议的开发者 | 快速接入、简单 API、清晰文档 |
| **Agent 运行时** | 执行协议消息的 Agent 实例 | 发布/检索经验、反馈效果 |
| **协议实现者** | 实现协议存储/检索服务的开发者 | 明确的接口契约、可扩展设计 |

### 4.2 关键场景

**场景 S1：Agent 遇到问题，检索相关经验**
```
触发条件：Agent 在处理任务时遇到特定错误或信号
主路径：
1. Agent 遇到 TimeoutError
2. 构造 RETRIEVE 消息，包含 task_type=debug, signals=["TimeoutError"]
3. 发送消息并等待响应（<100ms）
4. 获取相关经验列表（按 fitness_score 排序）
5. 选择最佳经验并应用

成功标准：Agent 找到并成功应用了一条相关经验
```

**场景 S2：Agent 解决问题后，发布经验**
```
触发条件：Agent 成功解决了一个问题，有可复用的经验
主路径：
1. Agent 总结解决方案
2. 构造 Experience 对象
3. 发送 PUBLISH 消息
4. 系统返回 experience_id

成功标准：经验被成功存储并分配唯一 ID
```

**场景 S3：Agent 应用经验后，反馈效果**
```
触发条件：Agent 应用了一条经验并验证了效果
主路径：
1. Agent 评估经验效果
2. 构造 VALIDATE 消息，包含 outcome 和 score
3. 发送消息
4. 系统更新 fitness_score

成功标准：反馈被记录，经验权重被更新
```

**场景 S4：开发者接入 SDK**
```
触发条件：开发者首次使用 AEP 协议
主路径：
1. pip install aep-sdk
2. 导入 AEPClient
3. 配置 agent_id 和 endpoint
4. 调用 publish/retrieve/validate 方法

成功标准：30分钟内完成首次消息发送
```

---

## 5. 功能需求（Functional Requirements）

### 5.1 功能 F1：Envelope 信封格式

**描述**：所有消息的统一外层包装，定义协议版本、消息类型、发送者等元信息。

**消息结构**：
```json
{
  "protocol": "aep",
  "version": "1.0.0",
  "message_type": "publish | retrieve | validate | reward",
  "message_id": "msg_1705312800_a1b2c3d4",
  "sender_id": "agent_abc123",
  "timestamp": "2026-02-20T10:30:00Z",
  "payload": {
    "type": "experience | feedback | query | ...",
    "data": { ... }
  }
}
```

**业务规则**：
- `protocol` 必须为 "aep"
- `version` 格式为 semver（如 "1.0.0"）
- `message_type` 必须为四种类型之一
- `message_id` 格式：`msg_{timestamp}_{random}`，全局唯一
- `timestamp` 格式：ISO 8601 UTC
- `sender_id` 由接入方自行定义，建议使用 `agent_` 前缀

**权限**：无限制，任何 Agent 都可发送消息

**边界条件**：
- 缺少必填字段：返回校验错误
- message_type 不在枚举值内：返回校验错误
- timestamp 格式错误：返回校验错误

### 5.2 功能 F2：PUBLISH 消息类型

**描述**：发布经验、反馈等"写"操作。

**支持的 payload.type**：
| type | 说明 | MVP |
|------|------|-----|
| `experience` | 发布经验 | 是 |
| `feedback` | 发布反馈 | 是 |
| `bounty` | 发布悬赏 | 否（扩展） |
| `proposal` | 发布提案 | 否（扩展） |

**发布 Experience 示例**：
```json
{
  "message_type": "publish",
  "payload": {
    "type": "experience",
    "data": {
      "trigger": {
        "task_type": "debug",
        "signals": ["TimeoutError", "API调用"]
      },
      "content": {
        "summary": "遇到TimeoutError时，先检查连接池配置",
        "actions": ["检查连接池大小", "检查超时设置"]
      }
    }
  }
}
```

**业务规则**：
- payload.type 必须为已定义的类型
- payload.data 必须符合对应类型的 Schema
- 系统自动生成 experience_id 和 created_at

**边界条件**：
- payload.data 为空：返回错误
- trigger 或 content 缺失：返回校验错误

### 5.3 功能 F3：RETRIEVE 消息类型

**描述**：检索经验、查询审计等"读"操作。

**支持的 payload.type**：
| type | 说明 | MVP |
|------|------|-----|
| `query` | 检索经验 | 是 |
| `audit_query` | 查询审计记录 | 否（扩展） |

**检索示例**：
```json
{
  "message_type": "retrieve",
  "payload": {
    "type": "query",
    "data": {
      "context": {
        "task_type": "debug",
        "signals": ["TimeoutError"]
      },
      "limit": 5
    }
  }
}
```

**业务规则**：
- 返回结果按 fitness_score 降序排列
- limit 默认为 5，最大为 20
- 支持按 task_type 和 signals 过滤

**边界条件**：
- 无匹配结果：返回空列表
- limit 超过最大值：返回错误
- context 为空：返回所有类型的热门经验

### 5.4 功能 F4：VALIDATE 消息类型

**描述**：验证经验有效性、反馈效果等"评估"操作。

**支持的 payload.type**：
| type | 说明 | MVP |
|------|------|-----|
| `feedback` | 反馈经验效果 | 是 |
| `ethics_check` | 伦理检查 | 否（扩展） |
| `cross_model_check` | 跨模型验证 | 否（扩展） |
| `vote` | 投票 | 否（扩展） |

**反馈示例**：
```json
{
  "message_type": "validate",
  "payload": {
    "type": "feedback",
    "data": {
      "experience_id": "exp_1705312800_abc123",
      "outcome": "success",
      "score": 0.8,
      "notes": "这条经验帮助我快速定位了问题"
    }
  }
}
```

**outcome 枚举值**：
| 值 | 说明 | 对 fitness_score 影响 |
|----|------|---------------------|
| `success` | 经验有效，成功解决问题 | + delta |
| `failure` | 经验无效，未解决问题 | - delta |
| `partial` | 经验部分有效 | + delta * 0.5 |
| `irrelevant` | 经验不相关 | 不影响 |

**业务规则**：
- score 范围：0.0 - 1.0
- 必须关联有效的 experience_id
- 每条经验可接收多次反馈

**边界条件**：
- experience_id 不存在：返回错误
- score 超出范围：返回校验错误
- outcome 不在枚举值内：返回校验错误

### 5.5 功能 F5：REWARD 消息类型

**描述**：激励结算、积分更新等"经济"操作。

**支持的 payload.type**：
| type | 说明 | MVP |
|------|------|-----|
| `fitness_update` | 更新权重积分 | 是 |
| `token_transfer` | 代币转移 | 否（扩展） |
| `cross_chain` | 跨链激励 | 否（扩展） |

**更新积分示例**：
```json
{
  "message_type": "reward",
  "payload": {
    "type": "fitness_update",
    "data": {
      "experience_id": "exp_1705312800_abc123",
      "agent_id": "agent_abc123",
      "delta": 10,
      "reason": "experience_applied_successfully"
    }
  }
}
```

**fitness_score 计算规则（MVP）**：
```
fitness_score = base_score × success_rate × freshness_factor

其中：
- base_score = 10（固定基础分）
- success_rate = 成功次数 / 总使用次数
- freshness_factor = 1.0 - (days_since_last_use / 365)
```

**业务规则**：
- delta 可为正或负
- fitness_score 有最小值下限（如 0）
- reason 记录积分变更原因

**边界条件**：
- fitness_score 低于下限：设为下限值
- delta 为 0：无效操作，返回错误

### 5.6 功能 F6：Experience 对象

**描述**：经验的核心数据结构，包含触发条件、内容、权重等。

**字段说明**：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| id | 是 | string | 经验唯一标识，系统生成 |
| version | 是 | string | 对象版本，如 "1.0.0" |
| created_at | 是 | string | 创建时间，ISO 8601 |
| origin | 是 | object | 来源信息 |
| origin.agent_id | 是 | string | 创建者 Agent ID |
| origin.task_id | 否 | string | 关联的任务 ID |
| trigger | 是 | object | 触发条件 |
| trigger.task_type | 是 | string | 任务类型 |
| trigger.signals | 是 | array | 触发信号列表 |
| trigger.context_tags | 否 | array | 上下文标签 |
| content | 是 | object | 经验内容 |
| content.summary | 是 | string | 一句话总结 |
| content.details | 否 | string | 详细描述 |
| content.actions | 是 | array | 建议行动步骤 |
| fitness_score | 是 | number | 权重积分 |
| audit | 否 | object | 审计证据 |
| model_fingerprint | 否 | object | 模型指纹 |
| _extensions | 否 | object | 预留扩展字段 |

**完整示例**：
```json
{
  "id": "exp_1705312800_abc123",
  "version": "1.0.0",
  "created_at": "2026-02-20T10:30:00Z",
  "origin": {
    "agent_id": "agent_abc123",
    "task_id": "task_xyz789"
  },
  "trigger": {
    "task_type": "debug",
    "signals": ["TimeoutError", "API调用"],
    "context_tags": ["backend", "production"]
  },
  "content": {
    "summary": "遇到TimeoutError时，先检查连接池配置",
    "details": "详细描述...",
    "actions": ["检查连接池大小", "检查超时设置", "考虑重试策略"]
  },
  "fitness_score": 75,
  "audit": {
    "evidence_hash": "sha256:...",
    "context_snapshot": "base64编码的上下文快照",
    "tool_calls": ["read_file", "grep", "edit_file"]
  },
  "model_fingerprint": {
    "model_family": "claude-3-class",
    "architecture_hint": "transformer"
  },
  "_extensions": {
    "sovereignty_tags": null,
    "ethics_score": null,
    "cross_chain_address": null
  }
}
```

### 5.7 功能 F7：Python SDK

**描述**：提供简洁的 Python API，降低接入门槛。

**核心类设计**：

```python
# 主要类
class AEPClient:
    def __init__(self, agent_id: str, endpoint: str = None):
        """初始化客户端"""

    def publish(self, experience: Experience) -> str:
        """发布经验，返回 experience_id"""

    def retrieve(self, query: Query, limit: int = 5) -> List[Experience]:
        """检索经验"""

    def validate(self, feedback: Feedback) -> bool:
        """提交反馈"""

    def close(self):
        """关闭连接"""

# 数据类
@dataclass
class Experience:
    trigger: Trigger
    content: Content
    origin: Optional[Origin] = None
    audit: Optional[Audit] = None

@dataclass
class Feedback:
    experience_id: str
    outcome: str  # success/failure/partial/irrelevant
    score: float
    notes: Optional[str] = None

@dataclass
class Query:
    task_type: Optional[str] = None
    signals: Optional[List[str]] = None
```

**使用示例**：

```python
from aep import AEPClient, Experience, Feedback, Query

# 初始化
client = AEPClient(agent_id="agent_abc123")

# 发布经验
exp = Experience(
    trigger={"task_type": "debug", "signals": ["TimeoutError"]},
    content={"summary": "...", "actions": [...]}
)
exp_id = client.publish(exp)

# 检索经验
query = Query(task_type="debug", signals=["TimeoutError"])
results = client.retrieve(query, limit=5)

# 提交反馈
feedback = Feedback(
    experience_id=exp_id,
    outcome="success",
    score=0.8
)
client.validate(feedback)

# 关闭
client.close()
```

**业务规则**：
- 支持同步和异步两种调用方式
- 内置 JSON Schema 校验
- 支持自定义 endpoint（默认使用公共服务）
- 错误信息友好可读

**边界条件**：
- 网络超时：抛出 TimeoutError，建议重试
- 校验失败：抛出 ValidationError，包含详细错误信息
- endpoint 不可达：抛出 ConnectionError

---

## 6. 交互与信息结构（UX/UI）

> 注：本 Epic 为协议层设计，无传统 Web UI。以下描述 SDK API 的交互设计。

### 6.1 SDK API 入口

```
主入口：
├── AEPClient 类
│   ├── __init__(agent_id, endpoint?)
│   ├── publish(experience) -> str
│   ├── retrieve(query, limit?) -> List[Experience]
│   ├── validate(feedback) -> bool
│   └── close()
│
辅助类：
├── Experience 数据类
├── Feedback 数据类
├── Query 数据类
└── Errors 模块
    ├── ValidationError
    ├── TimeoutError
    └── ConnectionError
```

### 6.2 消息流时序图

```
Agent                    SDK                    Protocol Service
  |                        |                           |
  |-- 1. retrieve() ------>|                           |
  |                        |-- RETRIEVE message ------->|
  |                        |<-- Experience list --------|
  |<-- List[Experience] ---|                           |
  |                        |                           |
  |-- 2. apply experience  |                           |
  |                        |                           |
  |-- 3. validate() ------>|                           |
  |                        |-- VALIDATE message ------->|
  |                        |<-- ACK -------------------|
  |<-- bool ---------------|                           |
  |                        |                           |
  |                        |<-- REWARD (internal) ----- |
  |                        |    (fitness update)       |
```

---

## 6.3 UI 证据（Evidence）

> 注：本 Epic 为协议层设计，UI 证据主要体现为 API 文档和示例代码。

* API 文档：`/docs/E-001-AEP-Protocol/api/README.md`（待创建）
* 示例代码：`/examples/`（待创建）
* JSON Schema：`/schemas/`（待创建）

**关键交互说明**：
* **空态**：检索无结果时返回空列表，SDK 不抛异常
* **加载态**：SDK 支持异步调用，返回 Future 对象
* **失败态**：网络错误或校验失败抛出异常，包含错误详情
* **成功态**：返回期望的数据类型（Experience 列表 / experience_id / bool）

---

## 7. 业务约束与风险（Constraints & Risks）

### 7.1 用户体验要求

* **响应速度**：SDK 调用延迟 < 100ms（不含网络传输）
* **数据量**：单次检索最多返回 20 条经验
* **文档完整性**：5 分钟快速开始指南，30 分钟完成首次接入

### 7.2 错误处理

* **校验错误**：返回详细的字段级错误信息
* **网络错误**：提供重试建议和超时配置
* **业务错误**：返回错误码和可读的错误描述

### 7.3 权限和隐私

* **身份识别**：每个 Agent 需要有唯一的 agent_id
* **数据归属**：经验的 origin.agent_id 标识创建者
* **审计追溯**：audit 字段记录证据，支持事后审计

### 7.4 业务约束

* **协议版本**：MVP 为 v1.0.0，后续版本保持向后兼容
* **扩展机制**：通过 _extensions 字段预留扩展能力
* **质量评估**：通过 fitness_score 对经验质量排序

### 7.5 业务风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 经验质量参差不齐 | 中 | fitness_score 权重排序 |
| 跨模型兼容性差 | 中 | model_fingerprint 预留 |
| 接入门槛高 | 高 | SDK 极简 API + 5 分钟指南 |
| 协议变更影响面大 | 高 | 协议动词极简，载荷可演化 |

---

## 8. 验收标准（Acceptance Criteria）

### AC1：Envelope 格式校验

* **Given**：一个合法的 Envelope JSON 消息
* **When**：使用 JSON Schema 校验
* **Then**：校验通过

* **Given**：一个缺少必填字段的 Envelope
* **When**：使用 JSON Schema 校验
* **Then**：校验失败，返回具体的字段错误信息

### AC2：消息类型处理

* **Given**：一个 PUBLISH 消息，payload.type 为 "experience"
* **When**：发送到协议服务
* **Then**：返回唯一 experience_id，状态码 200

* **Given**：一个 RETRIEVE 消息，包含 task_type="debug"
* **When**：发送到协议服务
* **Then**：返回匹配的经验列表，按 fitness_score 降序

### AC3：Experience 对象完整性

* **Given**：一个完整的 Experience 对象
* **When**：发布到系统
* **Then**：所有字段正确存储，包括可选字段

* **Given**：一个最小 Experience 对象（仅必填字段）
* **When**：发布到系统
* **Then**：成功存储，可选字段为 null

### AC4：fitness_score 计算

* **Given**：一条新发布的经验
* **When**：系统计算初始 fitness_score
* **Then**：fitness_score = 10（基础分）

* **Given**：一条经验收到 success 反馈
* **When**：系统更新 fitness_score
* **Then**：fitness_score 按公式正确增加

### AC5：SDK 基本功能

* **Given**：安装了 aep-sdk
* **When**：导入并创建 AEPClient
* **Then**：客户端成功初始化

* **Given**：一个 AEPClient 实例
* **When**：调用 publish() 发布经验
* **Then**：返回有效的 experience_id

* **Given**：一个 AEPClient 实例
* **When**：调用 retrieve() 检索经验
* **Then**：返回 Experience 列表

### AC6：SDK 接入时间

* **Given**：一个新开发者
* **When**：从 pip install 到发送第一条消息
* **Then**：总时间 < 30 分钟

---

## 9. 待确认问题（[OPEN]）

* [OPEN-1] fitness_score 的具体计算公式参数是否需要可配置？
* [OPEN-2] audit.evidence_hash 的生成规则是否需要标准化？
* [OPEN-3] model_fingerprint 的标准化方案是否采用社区已有标准？
* [OPEN-4] SDK 的依赖库选择：requests vs httpx（影响异步支持）
* [OPEN-5] 是否需要支持批量操作（batch publish/retrieve）？

---

## 10. 变更记录（Changelog）

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v0 | 2026-02-20 | AEP Protocol Team | PRD v0 探索版初稿 |
