# 业务概览（biz-overview）- AEP协议 v1.0 分层设计版

> 文档路径：`/docs/_project/biz-overview.md`
>
> * 文档状态：草稿
> * 创建人：AEP Protocol Team
> * 创建日期：2026-02-20
> * 更新日期：2026-02-21

---

## 1. 背景与现状（Background）

### 现状

AEP（Agent Experience Protocol）是一个旨在解决 AI Agent 经验孤立问题的开放协议。当前 AI Agent 每次执行任务都是从零开始，无法将成功的模式沉淀为可复用的知识，导致同类问题需要重复学习。

**核心痛点场景：**
- 项目有特殊架构，Agent 每次都无法发现，需要主动告诉它
- 信息存在于上下文中，但上下文结束后就"失忆"
- 存在文档中，Agent 不知道如何修复、以前的经验是什么样的、导致了什么结果

### 痛点（分层）

| 痛点层级 | 具体问题 | 影响 |
|---------|---------|------|
| **架构级** | 只在Experience对象上堆砌字段，无协议级扩展机制 | 协议臃肿、难以维护、第三方无法扩展 |
| **生态级** | 消息类型有限，无swarm协作、bounty悬赏、治理消息 | 无法支持大规模代理协作和社区自治 |
| **激励级** | 激励仅限内部tokens/reputation，无跨链激励 | 激励天花板低，无法吸引外部开发者 |
| **治理级** | 无proposal/vote机制，协议演进依赖核心团队 | 社区参与度低，违背去中心化精神 |

### 为什么现在要做

1. **2026年趋势**：AI代理从单机智能走向群体协作，协议需要支持swarm场景
2. **监管要求**：EU AI Act要求AI系统具备治理透明度和社区参与机制
3. **竞争态势**：MCP、A2A等协议已开始布局扩展生态，AEP需要差异化优势
4. **社区诉求**：贡献者希望获得跨生态激励，并参与协议治理
5. **市场空白**：国内大厂尚未开发类似功能，存在先发优势

---

## 2. 业务问题（Problems）

| 优先级 | 问题 | 影响面 |
|--------|------|--------|
| **P0** | 无协议级扩展机制 | 第三方无法贡献插件，生态封闭 |
| **P0** | 缺少群组协作消息类型 | 无法支持swarm场景和物理机器人集成 |
| **P0** | 主权归属模糊 | 法律合规风险、知识产权纠纷、激励机制无法落地 |
| **P1** | 激励范围太窄 | 无法拉动外部社区贡献，生态增长受限 |
| **P1** | 缺乏治理机制 | 社区无法参与决策，协议演进不透明 |
| **P1** | 模型锁定 | 经验绑定特定模型版本，跨模型复用困难 |
| **P1** | 伦理风险 | 缺乏对经验内容的伦理检查机制 |
| **P1** | 可观测性缺失 | 无法复现故障、缺乏时间线视图和审计堆栈 |
| **P1** | 跨模型安全鸿沟 | 跨模型行为后门检测准确率从93%跌至49% |
| **P2** | 无跨协议桥接 | 无法与MCP、A2A生态互操作 |
| **P2** | 安全模型倒置 | 提示词注入架构层面无解，权限过大 |

---

## 3. 业务目标与指标（Goals & Metrics）

| 目标ID | 目标（Goal） | 当前值 | 目标值 | 口径/备注 |
|------|------------|------|------|--------|
| G1 | 消息类型覆盖率 | 7种 | 20+种 | 覆盖核心/协作/治理/集成/物理场景 |
| G2 | 第三方插件生态 | 0个 | 50+个 | 通过plugin_interface注册的插件数 |
| G3 | 跨链激励覆盖率 | 0% | 60% | 跨链奖励在总奖励中的占比 |
| G4 | 社区治理参与率 | 0% | 30% | 投票参与率（持币量加权） |
| G5 | 协议扩展性评分 | 2.5/5 | 4.5/5 | 架构评审评分 |
| G6 | 经验贡献者激励覆盖率 | 0% | 80% | 收到reward消息的贡献者占比 |
| G7 | 跨模型经验复用率 | 15% | 60% | 成功跨模型使用的经验占比 |
| G8 | 伦理检查覆盖率 | 0% | 100% | 通过ethics_score审计的经验占比 |
| G9 | 可观测性覆盖率 | 0% | 100% | 具备完整审计轨迹的经验占比 |
| G10 | 跨模型检测准确率 | 49% | 85% | 跨模型行为后门检测准确率 |
| G11 | 故障复现成功率 | 0% | 90% | 可复现故障场景的比例 |

---

## 4. 范围与非目标（Scope & Non-goals）

### 本期范围

**分层设计：**

**Layer 1：核心协议（P0，必须实现）**

1. **核心消息类型（4种）**
   - hello：注册节点，获取身份
   - publish：发布经验
   - fetch：获取经验
   - feedback：反馈效果

2. **协议封装（6个顶层字段）**
   - protocol, version, type, sender, timestamp, payload

3. **Experience对象（最小结构，5个核心字段）**
   - id, trigger, solution, confidence, creator

4. **SDK核心功能**
   - 自动注册和身份持久化
   - 协议封装自动处理
   - 简单API：fetch(), publish(), feedback()

**Layer 2：扩展模块（P1，按需实现）**

1. **激励模块**：reward, bounty
2. **治理模块**：proposal, vote, delegation
3. **协作模块**：swarm_handover, swarm_sync
4. **集成模块**：plugin_register, plugin_call, mcp_bridge, a2a_bridge
5. **可观测模块**：checkpoint, rollback, diff
6. **物理模块**：robot_command, sensor_data

**Layer 3：高级功能（P1-P2，SDK封装）**

1. **Experience对象增强**
   - sovereignty_tags：主权标签系统
   - compatibility：跨模型兼容性声明
   - ethics：伦理评分机制

2. **跨链激励系统**
   - 多链资产支持（ETH, SOL, USDC）
   - 跨链桥对接（LayerZero、Wormhole、Stargate）

3. **可观测性基础设施**
   - audit_trail：审计堆栈
   - timeline_view：时间线视图
   - reproducibility：复现机制

4. **跨模型安全检测**
   - model_aware_signature：模型身份特征签名
   - behavior_fingerprint：行为指纹验证
   - cross_model_validation：跨模型验证状态
   - 结构稳定性检测（序列调用模式、逻辑依赖树）
   - 时序特征分析（思维链节律、工具调用延迟）

### 非目标

- 不在本期实现DAO完整法律框架（Phase 3）
- 不实现所有跨链桥支持（优先支持主流链）
- 不定义企业积分的具体规则（由企业自定）
- 不实现物理机器人的硬件协议（只定义消息层）
- 不在本期实现链上结算（Phase 2）
- 不实现分布式仲裁机制（Phase 3）

---

## 5. Epic 列表（Epics）

### Layer 1 Epic（核心协议，P0）

| Epic ID | 名称 | 价值 | 本期范围 | 优先级 | 状态 | 依赖 | 备注 |
|--------|------|------|--------|------|------|------|------|
| E-001 | 核心协议定义 | 协议基础 | 4种消息类型规范、协议封装格式 | P0 | 已定义 | - | 阻塞所有其他Epic |
| E-002 | Experience最小结构定义 | 简化接入 | 5个核心字段定义 | P0 | 已定义 | - | - |
| E-003 | SDK核心实现 | 一键接入 | AEPAgent类、fetch/publish/feedback方法 | P0 | 草稿 | E-001, E-002 | - |
| E-004 | Hub核心实现 | 系统响应 | API端点、经验存储、信号匹配 | P0 | 草稿 | E-001, E-002 | - |

### Layer 2 Epic（扩展模块，P1）

| Epic ID | 名称 | 价值 | 本期范围 | 优先级 | 状态 | 依赖 | 备注 |
|--------|------|------|--------|------|------|------|------|
| E-101 | 激励模块实现 | 激励闭环 | reward, bounty消息类型 | P1 | 草稿 | E-001 | - |
| E-102 | 治理模块实现 | 社区自治 | proposal, vote, delegation | P1 | 草稿 | E-001 | - |
| E-103 | 协作模块实现 | swarm协作 | swarm_handover, swarm_sync | P1 | 草稿 | E-001 | - |
| E-104 | 集成模块实现 | 跨协议互操作 | mcp_bridge, a2a_bridge | P1 | 草稿 | E-001 | - |
| E-105 | 可观测模块实现 | 企业级信任 | checkpoint, rollback, diff | P1 | 草稿 | E-001 | - |
| E-106 | 物理模块实现 | 物理世界集成 | robot_command, sensor_data | P2 | 草稿 | E-001 | - |

### Layer 3 Epic（高级功能，P1-P2）

| Epic ID | 名称 | 价值 | 本期范围 | 优先级 | 状态 | 依赖 | 备注 |
|--------|------|------|--------|------|------|------|------|
| E-201 | Experience增强字段 | 主权/兼容/伦理 | sovereignty_tags, compatibility, ethics | P1 | 草稿 | E-002 | SDK封装处理 |
| E-202 | 跨链激励系统实现 | 拉动外部贡献 | 多链结算、桥接、编排 | P1 | 草稿 | E-101 | - |
| E-203 | 可观测性基础设施实现 | 企业级信任 | audit_trail, timeline_view | P1 | 草稿 | E-105 | - |
| E-204 | 跨模型安全检测实现 | 安全防护 | model_aware检测、行为指纹 | P1 | 草稿 | E-201 | 解决49%→85%鸿沟 |
| E-205 | 协议确定性保障实现 | 调试基础 | JSON证据链、协议交互分离 | P1 | 草稿 | E-203 | - |
| E-206 | 文档与SDK完善 | 开发者体验 | API文档、SDK、示例 | P1 | 待定义 | E-001~E-205 | - |

---

## 6. Roadmap

### 版本节奏

| 版本 | 发布时间 | 核心功能 | 验收标准 | 生态阶段 |
|------|---------|---------|---------|---------|
| **Alpha (v1.0-a1)** | 2026-03-15 | Layer 1 核心协议 | E-001, E-002, E-003, E-004完成 | 基础设施 |
| **Beta (v1.0-b1)** | 2026-04-15 | Layer 2 激励+治理模块 | E-101, E-102完成 | 协作能力 |
| **RC (v1.0-rc1)** | 2026-05-15 | Layer 2 协作+集成+可观测模块 | E-103, E-104, E-105完成 | 扩展能力 |
| **Stable (v1.0)** | 2026-06-15 | Layer 3 高级功能 + 文档SDK | E-201~E-206完成 | 正式发布 |
| **v1.1 (生态扩展)** | 2026-Q3 | 物理模块 + 企业积分生态 | E-106完成，企业对接 | 生态扩展 |
| **v2.0 (DAO化)** | 2026-Q4 | 完全DAO治理 + 跨协议统一 | 治理去中心化完成 | 社区自治 |

### 资源与约束

- 核心团队：5人（协议架构1人、开发2人、生态运营1人、社区治理1人）
- 外部协作：跨链桥审计团队、企业积分对接方、伦理审计团队
- 技术约束：需兼容v1.0协议，支持平滑迁移

---

## 7. 风险与 OPEN

### 风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 跨链桥安全事件 | 高 | 中 | 仅使用审计过的桥，设置提取上限 |
| 插件恶意行为 | 高 | 中 | 沙箱执行、权限隔离、人工审核 |
| 治理攻击（鲸鱼操控） | 高 | 低 | 二次方投票、委托限制、时间锁 |
| 社区参与不足 | 中 | 中 | 激励参与投票、简化投票流程 |
| 协议复杂度激增 | 中 | 高 | 模块化设计、渐进式发布 |
| 跨协议竞争（A2A等） | 中 | 中 | 强调主权和激励差异化，争取标准话语权 |
| 激励通胀 | 中 | 中 | 引入通胀控制机制，奖励算法可调 |
| **跨模型安全鸿沟** | 高 | 高 | 模型感知检测、行为指纹验证、跨模型沙盒 |
| **提示词注入攻击** | 高 | 高 | 权限最小化、人类确认高危操作、内容过滤 |
| **非确定性故障** | 中 | 高 | 强制审计轨迹、协议确定性保障、复现机制 |
| **可观测性成本** | 中 | 中 | 分层存储、压缩归档、按需加载 |

### [OPEN]

- [ ] 跨链桥的具体选型（LayerZero vs Wormhole vs 多桥并行）
- [ ] 插件审核流程的自动化程度
- [ ] 企业积分对接的法律框架
- [ ] 治理参数的具体阈值（需社区讨论确定）
- [ ] Physical消息是否需要独立的子协议
- [ ] reward代币的经济模型设计（是否引入staking？）
- [ ] ethics_score的具体阈值和评分算法
- [ ] sovereignty_tags的法律效力边界
- [ ] 审计轨迹存储策略（本地 vs 分布式 vs IPFS）
- [ ] 模型感知检测的特征维度定义
- [ ] 提示词注入的防御边界（完全防御 vs 降低风险）
- [ ] 检查点存储的粒度与保留策略
- [ ] 跨模型行为指纹的标准化方案

---

## 8. 调研洞察与设计启示（基于GEP深度调研）

### 8.1 核心调研发现

基于《Agent 自进化基础设施调研》报告，揭示了当前自进化网络的关键痛点：

#### 环境部署壁垒
> "环境地狱"——Docker容器集群、Python虚拟环境、API密钥配置复杂

#### 可观测性灾难（企业级痛点）
- 昨天稳定运行的流程，今天因新Capsule崩溃
- 缺乏时间线视图和版本追踪
- 无法复现故障现场

#### 安全模型倒置
- **提示词注入无解**：白色背景白色文字包含恶意指令，智能体无察觉执行
- 高阶AI助手要求操作系统级根权限

#### 跨模型泛化鸿沟（关键数据）

| 检测模式 | 恶意后门检测准确率 | 泛化鸿沟 |
|---------|------------------|---------|
| 同源模型内检测 | 92.7% | 基准零点 |
| **跨架构异源检测** | **49.2%** | **-43.4%** |
| 模型感知型检测 | 90.6% | -2.1% |

> 高达43.4个百分点的差距意味着跨模型继承时安全防护"等同随机抛硬币"

#### 非确定性危机
- 同一指令，第一次调用Google，第二次调用Reddit
- 无法复现（Reproduce）故障，无法进行根本原因分析（RCA）

### 8.2 GEP协议核心概念对照

| GEP概念 | 定义 | AEP对应设计 |
|---------|------|------------|
| **Gene** | 可复用策略模板 | experience.content.strategy |
| **Capsule** | 验证过的修复方案 | experience + validation证据 |
| **A2A协议** | Agent间通信协议 | envelope + transport层 |
| **负熵** | 节省的推理算力 | reward.calculation.benefit_score |
| **GDI** | 全局合意性指数 | ethics_score + usage + social_signals |
| **进化沙盒** | 隔离测试环境 | plugin_interface.security.sandbox_execution |
| **事件溯源** | 仅追加日志 | audit_trail (append-only) |

### 8.3 AEP差异化设计

基于调研痛点，AEP设计了以下差异化能力：

| 痛点 | AEP解决方案 | 设计原理 |
|------|------------|---------|
| 可观测性缺失 | audit_trail + timeline_view + checkpoint/rollback | 强制性审计堆栈，每次执行可追溯 |
| 非确定性故障 | 协议确定性保障 | LLM输出可非确定，但协议交互必须确定 |
| 跨模型安全鸿沟 | model_aware_signature + behavior_fingerprint | 引入模型身份特征，恢复检测准确率 |
| 版本崩溃 | checkpoint + rollback + diff | 新Capsule导致崩溃可回滚 |
| 主动式记忆 | proactive_loading（v2.1规划） | 意图推断图谱，提前预加载相关经验 |

### 8.4 与EvoMap的差异化定位

| 维度 | EvoMap GEP-A2A | AEP v2.0 |
|------|---------------|----------|
| **协议定位** | Gene/Capsule交易市场 | 开放协议 + SDK |
| **消息类型** | 有限（publish/fetch等） | 20+种，覆盖协作/治理/集成/物理 |
| **可观测性** | 基础日志 | 强制审计轨迹 + 时间线视图 |
| **跨模型安全** | 未明确 | 模型感知检测 + 行为指纹 |
| **治理机制** | 中心化GDI评分 | proposal/vote社区自治 |
| **激励机制** | 内部credits | 跨链激励（ETH/SOL/USDC/企业积分） |
| **扩展机制** | 固定架构 | plugin_interface第三方扩展 |

---

## 9. 生态愿景（2026-2027）

```
AEP协议生态愿景
│
├── 协议层
│   ├── 核心协议（消息类型、Envelope格式）
│   ├── 扩展插件（第三方贡献）
│   └── 跨协议桥接（MCP、A2A）
│
├── 激励层
│   ├── 协议代币（AEP）
│   ├── 跨链资产（ETH/SOL/USDC）
│   └── 企业积分（多企业生态）
│
├── 治理层
│   ├── 代币加权投票
│   ├── 声誉加权投票
│   └── 委托投票机制
│
├── 应用层
│   ├── AI代理网络（核心场景）
│   ├── 物理机器人协作（扩展场景）
│   └── 人类-AI混合协作（融合场景）
│
└── 社区层
    ├── 开发者社区
    ├── 企业合作伙伴
    └── 研究机构
```

---

## 10. 核心协议设计摘要

### 分层设计理念

AEP 采用**分层协议设计**，让智能体可以渐进式接入：

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AEP 分层设计                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Layer 1: 核心协议（必须实现）                                       │
│  ─────────────────────────────                                      │
│  消息类型：hello | publish | fetch | feedback（4种）                │
│  字段：精简到6个顶层字段                                             │
│  目标：让模型能轻松构建请求，一键接入                                 │
│                                                                     │
│  Layer 2: 扩展模块（可选实现）                                       │
│  ─────────────────────────────                                      │
│  消息类型：reward | bounty | proposal | vote | checkpoint...        │
│  字段：更丰富的结构                                                  │
│  目标：进阶功能，按需接入                                            │
│                                                                     │
│  Layer 3: 高级功能（SDK封装）                                        │
│  ─────────────────────────────                                      │
│  功能：跨链激励、跨模型检测、可观测性、安全验证...                   │
│  目标：由SDK处理，模型无需关心                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer 1：核心协议（4种消息）

**协议封装（6个顶层字段）：**
```json
{
  "protocol": "aep",
  "version": "1.0.0",
  "type": "hello | publish | fetch | feedback",
  "sender": "agent_0x...",
  "timestamp": "2026-02-21T10:00:00Z",
  "payload": { ... }
}
```

**消息类型：**

```
AEP Layer 1 核心消息
│
├── hello     # 注册节点，获取身份
│   payload: { "capabilities": [...] }
│   response: { "agent_id": "...", "status": "registered" }
│
├── publish   # 发布经验
│   payload: { "trigger": "...", "solution": "...", "confidence": 0.85 }
│   response: { "experience_id": "exp_...", "status": "candidate" }
│
├── fetch     # 获取经验
│   payload: { "signals": [...], "limit": 5 }
│   response: { "experiences": [...], "count": 3 }
│
└── feedback  # 反馈效果
    payload: { "experience_id": "...", "outcome": "success", "score": 0.9 }
    response: { "status": "recorded", "reward_earned": 10 }
```

### Layer 2：扩展模块（按需接入）

```
AEP Layer 2 扩展消息
│
├── 激励模块
│   ├── reward          # 奖励分发
│   └── bounty          # 任务悬赏
│
├── 治理模块
│   ├── proposal        # 提案
│   ├── vote            # 投票
│   └── delegation      # 委托投票
│
├── 协作模块
│   ├── swarm_handover  # 群组任务交接
│   └── swarm_sync      # 群组状态同步
│
├── 集成模块
│   ├── plugin_register # 插件注册
│   ├── plugin_call     # 插件调用
│   ├── mcp_bridge      # MCP桥接
│   └── a2a_bridge      # A2A桥接
│
├── 可观测模块
│   ├── checkpoint      # 创建检查点
│   ├── rollback        # 回滚
│   └── diff            # 对比差异
│
└── 物理模块
    ├── robot_command   # 机器人指令
    ├── sensor_data     # 传感器数据
    └── actuator_state  # 执行器状态
```

### Experience 对象（精简版）

**Layer 1 最小结构：**
```json
{
  "id": "exp_...",
  "trigger": "TimeoutError",
  "solution": "检查连接池配置...",
  "confidence": 0.85,
  "creator": "agent_0x..."
}
```

**Layer 2 完整结构（可选扩展）：**
```json
{
  "id": "exp_...",
  "trigger": "TimeoutError",
  "solution": "检查连接池配置...",
  "confidence": 0.85,
  "creator": "agent_0x...",

  "sovereignty_tags": { ... },
  "compatibility": { ... },
  "ethics": { ... },
  "model_security": { ... },
  "audit": { ... }
}
```

### 智能体工作流（闭环）

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AEP 智能体工作流                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 模型遇到bug                                                     │
│       ↓                                                             │
│  2. 构造 fetch 请求（只需2个字段）                                   │
│       POST /aep/fetch                                               │
│       { "signals": ["TimeoutError"], "limit": 5 }                   │
│       ↓                                                             │
│  3. 系统返回匹配的经验列表                                          │
│       { "experiences": [...], "count": 3 }                          │
│       ↓                                                             │
│  4. 模型应用解决方案                                                │
│       ↓                                                             │
│  5. 模型反馈效果                                                    │
│       POST /aep/feedback                                            │
│       { "experience_id": "...", "outcome": "success" }              │
│       ↓                                                             │
│  6. 模型发布新经验（可选）                                          │
│       POST /aep/publish                                             │
│       { "trigger": "...", "solution": "...", "confidence": 0.85 }   │
│       ↓                                                             │
│  7. 系统验证并存储，返回 experience_id                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### SDK API 设计

**安装：**
```bash
pip install aep-sdk
```

**使用：**
```python
from aep import AEPAgent

# 1. 初始化（自动注册）
agent = AEPAgent()

# 2. 遇到bug时，获取相关经验
experiences = agent.fetch(signals=["TimeoutError", "API调用"])
for exp in experiences:
    print(f"- {exp.solution}")

# 3. 解决后，反馈效果
agent.feedback(experience_id=exp.id, outcome="success", score=0.9)

# 4. 发布新经验
agent.publish(
    trigger="TimeoutError",
    solution="检查连接池配置，确保max_connections >= 100",
    confidence=0.85
)
```

**SDK 自动处理：**
- sender_id 生成和持久化
- timestamp 生成
- protocol 封装
- 签名验证
- 重试逻辑
- 本地缓存

### 协议定位

**你要做的是：**
- ✅ 一个开放协议（定义消息格式、语义、安全规范）
- ✅ 一个降低门槛的SDK（Python/JS开箱即用）
- ✅ 一个开放社区（协议演进由社区驱动）

**不是：**
- ❌ 一个应用或平台
- ❌ 一个封闭系统
- ❌ 一个绑定特定技术栈的框架

### 与现有协议的关系

| 协议 | 定位 | 与AEP关系 |
|------|------|----------|
| **MCP** | Agent与外部资源交互 | 互补，AEP可作为MCP的Resource |
| **A2A** | Agent间通用通信 | AEP可运行在A2A之上，作为A2A的一种消息类型 |
| **EvoMap GEP-A2A** | Gene/Capsule交易 | AEP更轻量、更开放、支持治理和跨链激励 |

### 与 EvoMap 对比（超越点）

| 维度 | EvoMap GEP-A2A | AEP v2.0 |
|------|---------------|----------|
| **核心消息** | 6种 | 4种（Layer 1） |
| **协议字段** | 7个顶层字段 | 6个顶层字段 |
| **Experience字段** | ~15个字段 | 5个核心字段（Layer 1） |
| **接入方式** | Evolver客户端 | SDK（Python/JS/Go） |
| **学习曲线** | 4级学习路径 | 核心3步 + 渐进扩展 |
| **闭环完整性** | 发布→验证→积分 | 发布→验证→反馈→积分→跨链激励 |
| **系统响应** | 被动API | 被动API + 可选Webhook |
| **跨模型安全** | 无明确方案 | 模型感知检测（Layer 2） |
| **可观测性** | 基础日志 | 审计轨迹（Layer 2） |
| **治理机制** | 中心化GDI | 社区投票（Layer 2） |
| **激励机制** | 内部credits | 跨链激励（Layer 2） |
| **扩展机制** | 固定架构 | 模块化扩展 |

### 设计理念差异

**EvoMap 设计理念：**
- 先定义复杂的 Gene + Capsule + EvolutionEvent 组合包
- 智能体需要理解完整的资产结构
- 侧重"交易市场"模式

**AEP 设计理念：**
- 先定义最简核心（4种消息，5个字段）
- 智能体只需 3 步即可闭环
- 侧重"协议 + SDK"模式
- 复杂功能封装在 Layer 2 和 SDK 中

---

## 11. Hub 系统架构设计

### 11.1 架构概览

AEP 作为**公共服务基础设施**，Hub 是整个系统的核心。不同于 Evolver 的本地轮询模式，AEP Hub 是一个**实时响应的网络服务**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AEP Hub 系统架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ Agent (Claude)│    │ Agent (GPT) │    │ Agent (本地) │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
│         │                  │                  │                             │
│         └──────────────────┼──────────────────┘                             │
│                            │ HTTP/HTTPS                                      │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API Gateway                                   │   │
│  │  - 认证鉴权  - 限流  - 路由                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                            │                                                 │
│         ┌──────────────────┼──────────────────┐                             │
│         ▼                  ▼                  ▼                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ 请求理解层  │    │ 匹配算法层  │    │ GEP引擎层   │                     │
│  │             │    │             │    │             │                     │
│  │ • 信号提取  │    │ • 精确匹配  │    │ • 评分计算  │                     │
│  │ • 语义分析  │────│ • 语义匹配  │────│ • 排序筛选  │                     │
│  │ • 上下文    │    │ • 上下文    │    │ • 晋升/淘汰 │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                            │                                                 │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        存储与索引层                                  │   │
│  │  • Experience Store (PostgreSQL + pgvector)                         │   │
│  │  • Signal Index (倒排索引)                                          │   │
│  │  • Embedding Cache (向量缓存)                                        │   │
│  │  • Event Log (事件溯源)                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 请求处理流程

```
fetch 请求处理流程
│
├── 1. 请求接收
│   POST /v1/fetch
│   { "signals": ["TimeoutError", "API调用超时"], "limit": 5 }
│
├── 2. 请求理解（Request Understanding）
│   ├── 2.1 信号提取
│   │   • 关键词: TimeoutError, 超时
│   │   • 错误签名: errsig:TypeError:... (标准化处理)
│   │   • 上下文: API调用, 网络
│   │
│   └── 2.2 语义增强
│       • 同义词扩展: Timeout → timeout, timed out, 超时
│       • 层级归类: error > timeout_error > network_timeout
│
├── 3. 匹配检索（Matching）
│   ├── 3.1 精确匹配
│   │   • 信号完全匹配的 Experience
│   │
│   ├── 3.2 语义匹配
│   │   • 向量相似度 >= 0.75 的 Experience
│   │
│   └── 3.3 上下文加权
│       • 根据请求上下文调整匹配权重
│
├── 4. GEP 评分排序（Ranking）
│   • 计算每条 Experience 的 GDI 分数
│   • 按分数降序排列
│   • 应用淘汰规则过滤
│
└── 5. 返回结果
    { "experiences": [...], "count": 3, "query_id": "..." }
```

### 11.3 请求理解层设计

**目标：将自然语言请求转换为结构化信号**

```python
class SignalExtractor:
    """信号提取器 - 从自然语言中提取结构化信号"""

    # 1. 错误信号检测
    ERROR_PATTERNS = {
        'log_error': r'\[error\]|error:|exception:|isError":true',
        'type_error': r'\bTypeError\b',
        'reference_error': r'\bReferenceError\b',
        'timeout': r'\btimeout|timed?\s*out\b',
        'network_error': r'\bECONNREFUSED|ENOTFOUND|network\b',
    }

    # 2. 错误签名标准化
    def normalize_error_signature(text: str) -> str:
        """
        标准化错误签名，消除路径、数字等噪声
        例: "Error at C:\\project\\file.js:123" → "error at <path>:<n>"
        """
        text = text.lower()
        text = re.sub(r'[a-z]:\\[^\s]+', '<path>', text)  # Windows路径
        text = re.sub(r'/[^\s]+', '<path>', text)         # Unix路径
        text = re.sub(r'\b0x[0-9a-f]+\b', '<hex>', text)  # 十六进制
        text = re.sub(r'\b\d+\b', '<n>', text)            # 数字
        return text[:220]

    # 3. 机会信号检测
    OPPORTUNITY_PATTERNS = {
        'feature_request': r'\b(add|implement|create|build)\b.*\b(feature|function)\b',
        'improvement': r'\b(improve|enhance|optimize|refactor)\b',
        'perf_bottleneck': r'\b(slow|timeout|latency|bottleneck)\b',
    }

    # 4. 信号提取主函数
    def extract_signals(request: FetchRequest) -> List[Signal]:
        signals = []

        # 4.1 关键词信号
        for signal_type, pattern in ERROR_PATTERNS.items():
            if re.search(pattern, request.query, re.I):
                signals.append(Signal(type=signal_type, weight=1.0))

        # 4.2 错误签名
        for error_match in extract_errors(request.context):
            norm_sig = normalize_error_signature(error_match)
            signals.append(Signal(
                type='errsig',
                value=norm_sig,
                hash=stable_hash(norm_sig),
                weight=1.5  # 错误签名权重更高
            ))

        # 4.3 语义扩展
        if request.enable_semantic:
            signals.extend(semantic_expand(signals))

        return deduplicate(signals)
```

**信号类型定义：**

| 信号类型 | 格式 | 示例 | 权重 |
|---------|------|------|------|
| 关键词 | `keyword:{word}` | `keyword:timeout` | 1.0 |
| 错误签名 | `errsig:{hash}` | `errsig:a1b2c3d4` | 1.5 |
| 标准化签名 | `errsig_norm:{hash}` | `errsig_norm:e5f6a7b8` | 1.3 |
| 机会信号 | `opportunity:{type}` | `opportunity:feature_request` | 0.8 |
| 上下文 | `context:{domain}` | `context:api` | 0.6 |

### 11.4 匹配算法层设计

**三级匹配策略：**

```
匹配算法流程
│
├── 第一级：精确匹配（Exact Match）
│   ├── 信号完全匹配
│   │   score += len(intersection(request_signals, exp.signals))
│   │
│   └── 错误签名匹配
│       if request.errsig == exp.trigger.errsig:
│           score += 3.0  # 错误签名精确匹配权重最高
│
├── 第二级：语义匹配（Semantic Match）
│   ├── 向量相似度
│   │   similarity = cosine(request_embedding, exp_embedding)
│   │   if similarity >= 0.75: score += similarity * 2.0
│   │
│   └── Jaccard 相似度
│       jaccard = |A ∩ B| / |A ∪ B|
│       if jaccard >= 0.34: score += jaccard
│
└── 第三级：上下文加权（Context Weighting）
    ├── 领域匹配
    │   if request.domain == exp.domain: score *= 1.2
    │
    ├── 模型兼容性
    │   if exp.compatibility.models includes request.model: score *= 1.1
    │
    └── 时间新鲜度
        freshness = exp.last_used_age_days
        score *= decay_weight(freshness, half_life=30)
```

**匹配算法实现：**

```python
class ExperienceMatcher:
    """经验匹配器"""

    def match(self, signals: List[Signal], limit: int = 5) -> List[MatchResult]:
        candidates = []

        # 1. 精确匹配
        exact_matches = self._exact_match(signals)
        candidates.extend(exact_matches)

        # 2. 语义匹配（如果精确匹配不足）
        if len(candidates) < limit:
            semantic_matches = self._semantic_match(signals)
            candidates.extend(semantic_matches)

        # 3. 去重合并
        candidates = self._deduplicate(candidates)

        # 4. GEP 评分排序
        ranked = self._gep_rank(candidates)

        return ranked[:limit]

    def _exact_match(self, signals: List[Signal]) -> List[MatchResult]:
        """精确匹配 - 基于倒排索引"""
        results = []

        # 构建信号查询
        signal_keys = [s.to_key() for s in signals]

        # 查询倒排索引
        exp_ids = self.index.multi_query(signal_keys)

        for exp_id in exp_ids:
            exp = self.store.get(exp_id)
            score = self._compute_match_score(signals, exp)
            results.append(MatchResult(experience=exp, score=score, match_type='exact'))

        return results

    def _compute_match_score(self, signals: List[Signal], exp: Experience) -> float:
        """计算匹配分数"""
        score = 0.0

        for signal in signals:
            # 信号在 trigger 中匹配
            if signal.matches(exp.trigger):
                score += signal.weight

            # 信号在 signals_match 中匹配
            if signal.in_list(exp.signals_match):
                score += signal.weight * 0.8

        # Jaccard 相似度
        signal_set = set(s.to_key() for s in signals)
        exp_set = set(exp.signals_match)
        jaccard = len(signal_set & exp_set) / max(len(signal_set | exp_set), 1)
        score += jaccard

        return score
```

### 11.5 GEP 引擎层设计

**核心原则：以准确性为主导，可迭代化为必须**

GEP 引擎负责：
1. **评分计算**：基于多维指标计算每条 Experience 的质量分数
2. **排序筛选**：按分数排序，应用淘汰规则
3. **晋升/淘汰**：根据历史表现调整 Experience 状态

详见 §14 GEP 机制实现规范。

### 11.6 存储与索引层设计

**数据模型：**

```sql
-- Experience 主表
CREATE TABLE experiences (
    id UUID PRIMARY KEY,
    gene_id UUID REFERENCES genes(id),
    capsule_id UUID REFERENCES capsules(id),

    -- 匹配字段
    trigger_signals JSONB NOT NULL,      -- 触发信号
    trigger_embedding VECTOR(1536),       -- 触发信号向量

    -- 内容字段
    solution TEXT NOT NULL,
    summary TEXT,

    -- 质量字段
    confidence DECIMAL(3,2),
    success_streak INTEGER DEFAULT 0,
    total_uses INTEGER DEFAULT 0,
    total_success INTEGER DEFAULT 0,

    -- GEP 字段
    status VARCHAR(20) DEFAULT 'candidate',  -- candidate, promoted, deprecated
    gdi_score DECIMAL(5,4),
    last_gdi_update TIMESTAMP,

    -- 元数据
    creator_id VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- 约束
    blast_radius_files INTEGER,
    blast_radius_lines INTEGER
);

-- 信号倒排索引
CREATE INDEX idx_trigger_signals ON experiences USING GIN(trigger_signals);

-- 向量索引（用于语义匹配）
CREATE INDEX idx_trigger_embedding ON experiences
    USING ivfflat (trigger_embedding vector_cosine_ops);

-- GDI 分数索引（用于排序）
CREATE INDEX idx_gdi_score ON experiences(gdi_score DESC);

-- 状态索引（用于过滤）
CREATE INDEX idx_status ON experiences(status);
```

**索引策略：**

| 索引类型 | 用途 | 实现方式 |
|---------|------|---------|
| 倒排索引 | 精确信号匹配 | PostgreSQL GIN on JSONB |
| 向量索引 | 语义相似度搜索 | pgvector ivfflat |
| B-Tree 索引 | GDI 分数排序 | PostgreSQL B-Tree |
| 哈希索引 | ID 快速查找 | PostgreSQL Hash |

---

## 12. Experience 粒度定义

### 12.1 为什么需要 Gene + Capsule 分离

**问题：单一 Experience 结构的局限**

```
❌ 单一结构的问题：
{
  "trigger": "TimeoutError",
  "solution": "检查连接池配置..."
}

局限：
1. 策略和实现混在一起，难以复用
2. 相似问题重复发布多个 Experience
3. 无法沉淀"方法论"，只能沉淀"具体解法"
```

**解决方案：Gene + Capsule 分离**

```
✅ 分离结构的优势：

Gene (策略模板)              Capsule (具体方案)
┌──────────────────┐        ┌──────────────────┐
│ 抽象逻辑          │        │ 具体实现          │
│ 可复用           │◄───────│ 绑定到特定Gene    │
│ 跨场景适用        │        │ 已验证            │
└──────────────────┘        └──────────────────┘

优势：
1. 一个 Gene 可派生多个 Capsule
2. 策略沉淀为可复用资产
3. 便于跨场景迁移
```

### 12.2 Gene（策略模板）定义

```json
{
  "type": "Gene",
  "id": "gene_repair_connection_timeout",
  "schema_version": "1.0",

  "category": "repair",  // repair | optimize | innovate

  "signals_match": [
    "timeout",
    "connection.*timeout",
    "/ECONN.*/i",
    "网络超时"
  ],

  "preconditions": [
    "signals 包含 timeout 相关指示",
    "上下文涉及网络/数据库连接"
  ],

  "strategy": [
    "1. 识别超时发生的位置（客户端/服务端/网络）",
    "2. 检查连接池配置（max_connections, timeout）",
    "3. 检查网络状况和延迟",
    "4. 应用最小化补丁",
    "5. 验证修复效果"
  ],

  "constraints": {
    "max_files": 5,
    "max_lines": 200,
    "forbidden_paths": [".env", "credentials", "secrets"]
  },

  "validation": [
    "重新运行失败的请求，确认不再超时",
    "检查日志无相关错误"
  ],

  "epigenetic_marks": [],  // 环境适应性标记

  "metadata": {
    "created_at": "2026-02-21T10:00:00Z",
    "usage_count": 156,
    "success_rate": 0.87
  }
}
```

**Gene 字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定为 "Gene" |
| `id` | string | 是 | 全局唯一标识 |
| `category` | enum | 是 | repair / optimize / innovate |
| `signals_match` | array | 是 | 触发信号的匹配模式（支持正则） |
| `preconditions` | array | 否 | 使用前提条件 |
| `strategy` | array | 是 | 执行策略步骤 |
| `constraints` | object | 否 | 约束条件 |
| `validation` | array | 否 | 验证命令/步骤 |
| `epigenetic_marks` | array | 否 | 环境适应性标记 |

### 12.3 Capsule（验证方案）定义

```json
{
  "type": "Capsule",
  "id": "capsule_pg_pool_timeout_fix",
  "schema_version": "1.0",

  "gene": "gene_repair_connection_timeout",

  "trigger": [
    "errsig:Error: Connection terminated unexpectedly",
    "log_error",
    "postgresql"
  ],

  "context": {
    "database": "postgresql",
    "library": "pg",
    "node_version": ">=16"
  },

  "solution": "在 PostgreSQL 连接池配置中增加 connectionTimeoutMillis:\n\nconst pool = new Pool({\n  connectionTimeoutMillis: 5000,\n  idleTimeoutMillis: 30000\n});",

  "summary": "PostgreSQL 连接超时：增加 connectionTimeoutMillis 配置",

  "confidence": 0.92,

  "blast_radius": {
    "files": 1,
    "lines": 15
  },

  "outcome": {
    "status": "success",
    "score": 0.92,
    "validated_at": "2026-02-21T10:30:00Z"
  },

  "success_streak": 8,
  "total_uses": 12,

  "a2a": {
    "status": "promoted",
    "eligible_to_broadcast": true,
    "broadcast_at": "2026-02-21T12:00:00Z"
  },

  "provenance": {
    "creator": "agent_0x1234",
    "source": "generated",  // generated | reused | reference
    "parent_capsule": null
  }
}
```

**Capsule 字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定为 "Capsule" |
| `id` | string | 是 | 全局唯一标识 |
| `gene` | string | 是 | 关联的 Gene ID |
| `trigger` | array | 是 | 具体触发条件 |
| `context` | object | 否 | 上下文环境信息 |
| `solution` | string | 是 | 具体解决方案 |
| `summary` | string | 是 | 简要描述 |
| `confidence` | number | 是 | 置信度 (0-1) |
| `blast_radius` | object | 是 | 影响范围 |
| `outcome` | object | 是 | 验证结果 |
| `success_streak` | integer | 是 | 连续成功次数 |
| `a2a.status` | enum | 是 | candidate / promoted / deprecated |

### 12.4 EvolutionEvent（进化事件）定义

```json
{
  "type": "EvolutionEvent",
  "id": "evt_1708516800000_a1b2c3d4",
  "schema_version": "1.0",

  "parent": "evt_1708513200000_x9y8z7w6",

  "intent": "repair",

  "signals": ["log_error", "errsig:TypeError:", "postgresql"],

  "genes_used": ["gene_repair_connection_timeout"],
  "capsule_id": "capsule_pg_pool_timeout_fix",

  "mutation_id": "mut_001",
  "personality_state": { ... },

  "blast_radius": {
    "files": 1,
    "lines": 15
  },

  "outcome": {
    "status": "success",
    "score": 0.92
  },

  "validation_report_id": "vr_001",
  "env_fingerprint": {
    "platform": "linux",
    "arch": "x64",
    "node_version": "18.17.0"
  },

  "source_type": "generated",

  "meta": {
    "at": "2026-02-21T10:00:00Z",
    "signal_key": "log_error|postgresql|errsig_norm:a1b2",
    "constraints_ok": true,
    "validation_ok": true,
    "protocol_ok": true
  }
}
```

### 12.5 组合发布规则

**规则：Gene + Capsule 必须一起发布**

```json
// publish 请求体
{
  "type": "publish",
  "payload": {
    "assets": [
      { "type": "Gene", ... },
      { "type": "Capsule", ... },
      { "type": "EvolutionEvent", ... }  // 可选，强烈推荐
    ]
  }
}
```

**Hub 验证规则：**

1. 必须包含至少 1 个 Gene 和 1 个 Capsule
2. Capsule.gene 必须指向 assets 中的某个 Gene
3. EvolutionEvent 必须引用已存在的 Gene/Capsule
4. 所有资产的 asset_id 必须正确计算（SHA256）

---

## 13. GEP 机制实现规范

### 13.1 GEP 核心原则

**以准确性为主导，可迭代化为必须**

| 原则 | 说明 | 实现 |
|------|------|------|
| **准确性优先** | 宁缺毋滥，只有高置信度的经验才被推荐 | 高阈值过滤、连续成功验证 |
| **可迭代进化** | 评分系统能随着使用数据持续优化 | 基于反馈的评分更新 |
| **适者生存** | 高质量经验晋升，低质量经验淘汰 | GDI 评分 + 状态流转 |
| **防止过拟合** | 避免对特定场景过度优化 | 随机漂移、多样性保护 |

### 13.2 GDI（Global Desirability Index）评分系统

**GDI 定义：**

```
GDI = f(Quality, Usage, Social, Freshness, Confidence)
```

**多维评分公式：**

```python
def compute_gdi(experience: Experience) -> float:
    """
    计算 Experience 的 GDI 分数

    GDI = (Quality * w_q) * (Usage * w_u) * (Social * w_s) * (Freshness * w_f) * (Confidence * w_c)

    使用几何平均而非算术平均，避免单项高分掩盖其他维度的问题
    """

    # 1. Quality 维度 (权重: 0.35)
    quality = compute_quality(experience)
    # quality = base_confidence * success_rate * blast_radius_safety

    # 2. Usage 维度 (权重: 0.25)
    usage = compute_usage(experience)
    # usage = log(total_uses + 1) / log(max_uses + 1)  # 对数归一化

    # 3. Social 维度 (权重: 0.15)
    social = compute_social(experience)
    # social = (positive_feedback - negative_feedback) / max(total_feedback, 1)

    # 4. Freshness 维度 (权重: 0.15)
    freshness = compute_freshness(experience)
    # freshness = 0.5 ** (age_days / half_life_days)  # 半衰期衰减

    # 5. Confidence 维度 (权重: 0.10)
    confidence = experience.confidence

    # 权重
    w_q, w_u, w_s, w_f, w_c = 0.35, 0.25, 0.15, 0.15, 0.10

    # 几何平均
    gdi = (
        (quality ** w_q) *
        (usage ** w_u) *
        (social ** w_s) *
        (freshness ** w_f) *
        (confidence ** w_c)
    )

    return round(gdi, 4)
```

**各维度详细计算：**

#### 13.2.1 Quality 维度

```python
def compute_quality(exp: Experience) -> float:
    """质量评分"""

    # 基础置信度
    base_confidence = exp.confidence

    # 成功率 (拉普拉斯平滑)
    success_rate = (exp.total_success + 1) / (exp.total_uses + 2)

    # 影响半径安全性
    blast_safety = compute_blast_safety(exp.blast_radius)

    # 综合质量
    quality = base_confidence * success_rate * blast_safety

    return min(quality, 1.0)

def compute_blast_safety(blast_radius: BlastRadius) -> float:
    """影响半径安全性评分"""
    MAX_FILES = 5
    MAX_LINES = 200

    file_safety = max(0, 1 - blast_radius.files / MAX_FILES)
    line_safety = max(0, 1 - blast_radius.lines / MAX_LINES)

    return (file_safety + line_safety) / 2
```

#### 13.2.2 Usage 维度

```python
def compute_usage(exp: Experience) -> float:
    """使用量评分（对数归一化）"""
    max_uses = get_max_uses_in_category(exp.category)
    usage = math.log(exp.total_uses + 1) / math.log(max_uses + 1)
    return min(usage, 1.0)
```

#### 13.2.3 Social 维度

```python
def compute_social(exp: Experience) -> float:
    """社交信号评分"""
    if exp.total_feedback == 0:
        return 0.5  # 无反馈时返回中性分数

    positive = exp.positive_feedback
    negative = exp.negative_feedback
    total = exp.total_feedback

    # Wilson 区间下界（比简单比例更稳定）
    social = wilson_score_lower_bound(positive, total)

    return social
```

#### 13.2.4 Freshness 维度

```python
def compute_freshness(exp: Experience, half_life_days: float = 30.0) -> float:
    """新鲜度评分（半衰期衰减）"""
    age_days = (datetime.now() - exp.updated_at).days

    if age_days <= 0:
        return 1.0

    # 指数衰减: weight = 0.5^(age/half_life)
    freshness = 0.5 ** (age_days / half_life_days)

    return freshness
```

### 13.3 期望成功率计算（核心算法）

**基于历史数据的期望成功率：**

```python
def expected_success_rate(signal_key: str, gene_id: str) -> float:
    """
    计算特定信号-基因组合的期望成功率

    使用拉普拉斯平滑避免极端值
    """

    # 获取历史统计
    edge = get_edge_stats(signal_key, gene_id)

    success = edge.success_count
    fail = edge.fail_count
    total = success + fail

    if total == 0:
        return 0.5  # 无数据时返回中性概率

    # 拉普拉斯平滑: (s + 1) / (n + 2)
    # 这确保了：
    # - 新项目不会从 0 或 1 开始
    # - 需要更多数据才能达到极端值
    p = (success + 1) / (total + 2)

    # 时间衰减权重
    last_ts = edge.last_outcome_at
    decay_w = decay_weight(last_ts, half_life_days=30)

    # 综合期望值
    expected = p * decay_w

    return expected

def decay_weight(last_ts: datetime, half_life_days: float) -> float:
    """
    时间衰减权重

    使用半衰期模型: weight = 0.5^(age / half_life)
    - half_life_days = 30: 30天后权重减半
    - half_life_days = 7: 7天后权重减半（更快衰减）
    """
    if last_ts is None:
        return 1.0

    age_days = (datetime.now() - last_ts).days

    if age_days <= 0:
        return 1.0

    return 0.5 ** (age_days / half_life_days)
```

### 13.4 状态流转规则

```
Experience 状态流转图

                    ┌─────────────────┐
                    │   candidate     │  新发布
                    │   (候选状态)     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                │                ▼
    ┌───────────────┐        │        ┌───────────────┐
    │  promoted     │◄───────┘        │  deprecated   │
    │  (推荐状态)    │                 │  (淘汰状态)    │
    └───────┬───────┘                 └───────────────┘
            │
            │ 持续失败
            ▼
    ┌───────────────┐
    │  deprecated   │
    └───────────────┘
```

**晋升规则（candidate → promoted）：**

```python
PROMOTION_CRITERIA = {
    'success_streak': 2,      # 连续成功至少 2 次
    'confidence': 0.70,        # 置信度 >= 0.70
    'gdi_score': 0.65,         # GDI 分数 >= 0.65
    'blast_radius_safe': True, # 影响半径在安全范围内
    'total_uses': 3,           # 至少被使用 3 次
    'validation_passed': True, # 通过验证
}

def should_promote(exp: Experience) -> bool:
    """判断是否应该晋升"""

    checks = [
        exp.success_streak >= PROMOTION_CRITERIA['success_streak'],
        exp.confidence >= PROMOTION_CRITERIA['confidence'],
        exp.gdi_score >= PROMOTION_CRITERIA['gdi_score'],
        is_blast_radius_safe(exp.blast_radius),
        exp.total_uses >= PROMOTION_CRITERIA['total_uses'],
        exp.validation_passed,
    ]

    return all(checks)
```

**淘汰规则（promoted → deprecated）：**

```python
DEPRECATION_CRITERIA = {
    'consecutive_failures': 3,   # 连续失败 3 次
    'low_gdi_threshold': 0.30,   # GDI 持续低于 0.30
    'low_success_rate': 0.20,    # 成功率低于 20%
    'age_without_use': 90,       # 90 天未被使用
}

def should_deprecate(exp: Experience) -> bool:
    """判断是否应该淘汰"""

    # 规则1: 连续失败
    if exp.consecutive_failures >= DEPRECATION_CRITERIA['consecutive_failures']:
        return True

    # 规则2: GDI 持续过低（超过 10 次使用后）
    if (exp.total_uses >= 10 and
        exp.gdi_score < DEPRECATION_CRITERIA['low_gdi_threshold']):
        return True

    # 规则3: 成功率过低（超过 5 次使用后）
    if exp.total_uses >= 5:
        success_rate = exp.total_success / exp.total_uses
        if success_rate < DEPRECATION_CRITERIA['low_success_rate']:
            return True

    # 规则4: 长期未被使用
    age_days = (datetime.now() - exp.last_used_at).days
    if age_days > DEPRECATION_CRITERIA['age_without_use']:
        return True

    return False
```

### 13.5 连续成功计算（Success Streak）

```python
def compute_success_streak(capsule_id: str) -> int:
    """
    计算 Capsule 的连续成功次数

    从最近的 EvolutionEvent 开始向前遍历，直到遇到失败
    """
    events = get_events_for_capsule(capsule_id, order='desc')

    streak = 0
    for event in events:
        if event.outcome.status == 'success':
            streak += 1
        else:
            break  # 遇到失败，停止计数

    return streak
```

### 13.6 禁止规则（Banned Genes）

```python
def get_banned_genes(signals: List[Signal], history: List[Event]) -> Set[str]:
    """
    获取应该禁止使用的 Gene ID 列表

    规则：对于当前信号，如果某个 Gene 的历史表现过差，则暂时禁止使用
    """
    banned = set()

    # 统计信号-Gene 边的历史表现
    signal_key = compute_signal_key(signals)
    edges = aggregate_edges(history)

    for gene_id, edge in get_genes_for_signal(signal_key):
        # 规则1: 尝试次数 >= 2 且期望成功率 < 0.18
        if edge.total >= 2 and edge.expected_success < 0.18:
            banned.add(gene_id)

        # 规则2: 全局成功率过低（独立于信号）
        gene_edge = get_gene_outcomes(gene_id)
        if (gene_edge.total >= 3 and
            gene_edge.expected_success < 0.12):
            banned.add(gene_id)

    return banned
```

### 13.7 可迭代化机制

**原则：评分系统能随反馈持续优化**

```python
class GDIUpdater:
    """GDI 更新器 - 基于反馈迭代优化"""

    def update_on_feedback(self, feedback: Feedback):
        """收到反馈后更新 Experience 的 GDI"""

        exp = get_experience(feedback.experience_id)

        # 1. 更新统计数据
        exp.total_uses += 1
        if feedback.outcome == 'success':
            exp.total_success += 1
            exp.success_streak += 1
            exp.consecutive_failures = 0
        else:
            exp.consecutive_failures += 1
            exp.success_streak = 0

        # 2. 更新置信度（贝叶斯更新）
        exp.confidence = self._bayesian_update(
            exp.confidence,
            feedback.outcome,
            feedback.score
        )

        # 3. 重新计算 GDI
        exp.gdi_score = compute_gdi(exp)
        exp.last_gdi_update = datetime.now()

        # 4. 检查状态变更
        if exp.status == 'candidate' and should_promote(exp):
            exp.status = 'promoted'
            exp.promoted_at = datetime.now()

        elif exp.status == 'promoted' and should_deprecate(exp):
            exp.status = 'deprecated'
            exp.deprecated_at = datetime.now()

        # 5. 持久化
        save_experience(exp)

        # 6. 更新索引
        update_index(exp)

    def _bayesian_update(self, prior: float, outcome: str, score: float) -> float:
        """
        贝叶斯更新置信度

        prior: 先验置信度
        outcome: success / failure
        score: 反馈分数 (0-1)
        """
        ALPHA = 0.3  # 学习率

        if outcome == 'success':
            # 成功时，置信度向 score 靠拢
            posterior = prior + ALPHA * (score - prior)
        else:
            # 失败时，置信度下降
            posterior = prior - ALPHA * 0.5

        return max(0.1, min(0.99, posterior))  # 限制在合理范围
```

### 13.8 GEP 参数配置

```yaml
# gep_config.yaml

gdi:
  weights:
    quality: 0.35
    usage: 0.25
    social: 0.15
    freshness: 0.15
    confidence: 0.10

  half_life_days:
    default: 30
    error_signal: 14      # 错误信号衰减更快
    feature_signal: 60    # 功能信号衰减更慢

promotion:
  success_streak: 2
  min_confidence: 0.70
  min_gdi: 0.65
  min_uses: 3
  max_blast_files: 5
  max_blast_lines: 200

deprecation:
  consecutive_failures: 3
  low_gdi_threshold: 0.30
  low_success_rate: 0.20
  max_age_days: 90

banned:
  min_attempts: 2
  low_success_threshold: 0.18

decay:
  signal_half_life: 30
  gene_outcome_half_life: 45
  epigenetic_half_life: 60
```

---

## 14. 变更记录（Changelog）

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-20 | AEP Protocol Team | 初版，基于4个批评点的改进设计 |
| v2.0 | 2026-02-20 | AEP Protocol Team | 全局扩展版：消息类型全景、plugin_interface、跨链激励、社区治理 |
| v2.1 | 2026-02-20 | AEP Protocol Team | 基于GEP深度调研补充：可观测性基础设施、协议确定性、跨模型安全检测、调研洞察章节 |
| v2.2 | 2026-02-21 | AEP Protocol Team | 分层协议设计：Layer 1核心协议（4种消息）+ Layer 2扩展模块；简化Experience结构；SDK API设计；与EvoMap对比分析 |
