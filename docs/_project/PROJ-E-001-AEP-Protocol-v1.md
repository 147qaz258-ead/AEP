# AEP Protocol 项目计划 - v1（E-001-AEP-Protocol）

> 文档路径：`/docs/_project/PROJ-E-001-AEP-Protocol-v1.md`
>
> * 文档状态：正式执行版
> * 版本：v1.1
> * Epic ID：E-001
> * Epic 目录：`/docs/E-001-AEP-Protocol/`
> * 项目经理：proj
> * 创建日期：2026-02-21
> * 更新日期：2026-02-21 18:09
> * 关联文档：
>   * biz：`/docs/_project/biz-overview.md`
>   * prd：`../prd-v0.md`
>   * story：`../stories/`
>   * tech：`/docs/E-001-AEP-Protocol/tech/TECH-E-001-v1.md`
>   * 依赖分析：`/docs/_project/tech/task-dependencies.md`（规划中）

---

## 1. 项目概述

**项目名称**：AEP Protocol Layer 1 核心协议实现

**业务目标**（摘自 biz-overview）：
- 构建一个开放协议，让 AI Agent 能够共享和复用经验
- 实现核心 4 种消息类型：hello, publish, fetch, feedback
- 建立基于 GDI 的质量评分系统
- 支持信号提取和经验匹配

**关键指标**：
- Fetch 延迟 < 100ms (p95)
- Agent 注册成功率 > 99.9%
- 经验匹配准确率 > 80%
- 支持 10,000+ 并发请求/秒

---

## 2. 范围说明

**本期包含的 Story**：
- STORY-001: Agent Registration (hello)
- STORY-002: Experience Fetch
- STORY-003: Experience Publish
- STORY-004: Feedback Loop
- STORY-005: GDI Scoring System
- STORY-006: Signal Extraction & Matching

**本期交付的 Task**：16 个任务（详见执行进度表）

**Out of Scope**：
- Layer 2 扩展模块（reward, bounty, proposal, vote 等）
- 跨链激励系统
- 可观测性基础设施（checkpoint, rollback, diff）
- 跨模型安全检测
- 物理机器人集成

---

## 2.1 Story -> Slice -> Task 对齐表（必填）

> 目的：避免"任务很多但不覆盖主路径/AC"，以及"无需求来源的任务混入版本"。
>
> 规则：
> * 本期纳入的每个 `TASK_ID` 必须关联一个 `STORY_ID` 与 `SLICE_ID`；
> * 允许例外：技术债/纯重构/基础设施任务可以标注 `NO_STORY`，但必须写清验收方式与真流程验证。

| STORY_ID | SLICE_ID | TASK_ID 列表 | 本期纳入 | 验收责任人 | 备注 |
|---|---|---|---|---|---|
| STORY-001 | SLICE-001 | TASK-001-01, TASK-001-02 | ✅ | proj | 竖切闭环 P0：Agent 注册与身份服务 |
| STORY-002 | SLICE-001 | TASK-002-01, TASK-002-02, TASK-002-03, TASK-002-04 | ✅ | proj | 竖切闭环 P0：经验获取完整流程 |
| STORY-003 | SLICE-001 | TASK-003-01, TASK-003-02, TASK-003-03 | ✅ | proj | 竖切闭环 P0：经验发布完整流程 |
| STORY-004 | SLICE-001 | TASK-004-01, TASK-004-02, TASK-004-03 | ✅ | proj | 竖切闭环 P0：反馈闭环 |
| STORY-005 | SLICE-001 | TASK-005-01, TASK-005-02, TASK-005-03 | ✅ | proj | 竖切闭环 P0：GDI 评分与聚合 |
| STORY-006 | SLICE-001 | TASK-006-01, TASK-006-02, TASK-006-03 | ✅ | proj | 竖切闭环 P0：信号提取与三层匹配 |

---

## 2.2 执行进度表（必填）

> 目的：在 `PROJ` 里给出"一眼能读懂"的执行状态视图；详细实现与证据回写到对应 `TASK-*.md`。
>
> 建议：
> * `状态` 只用：`TODO/DOING/BLOCKED/DONE`
> * 每周至少更新 2 次（或每次例会后更新）
> * `证据` 一列直接链接到对应任务文档

| TASK_ID | 标题 | 优先级 | Owner | 状态 | 预计 | 截止 | 阻塞点 | 证据（TASK链接） |
|---|---|---|---|---|---|---|---|---|
| TASK-001-01 | API Gateway - Hello endpoint | P0 | TBD | TODO | 4h | Day 2 | 无 | TBD |
| TASK-001-02 | Agent Identity Service | P0 | TBD | TODO | 8h | Day 3 | TASK-001-01 | TBD |
| TASK-002-01 | Signal Extraction Module | P0 | TBD | TODO | 8h | Day 3 | 无 | TBD |
| TASK-002-02 | Experience Matcher | P0 | TBD | TODO | 12h | Day 5 | TASK-002-01 | TBD |
| TASK-002-03 | GDI Scoring Engine | P0 | TBD | TODO | 8h | Day 5 | TASK-005-02 | TBD |
| TASK-002-04 | Fetch API Endpoint | P0 | TBD | TODO | 6h | Day 7 | TASK-002-02, TASK-002-03 | TBD |
| TASK-003-01 | Gene/Capsule Validation | P0 | TBD | TODO | 6h | Day 5 | TASK-002-01 | TBD |
| TASK-003-02 | Publish API Endpoint | P0 | TBD | TODO | 8h | Day 7 | TASK-003-01 | TBD |
| TASK-003-03 | Asset Store Integration | P0 | TBD | TODO | 6h | Day 9 | TASK-003-02 | TBD |
| TASK-004-01 | Feedback Processing | P0 | TBD | TODO | 6h | Day 7 | TASK-003-02 | TBD |
| TASK-004-02 | GDI Update Logic | P0 | TBD | TODO | 8h | Day 9 | TASK-005-03 | TBD |
| TASK-004-03 | Feedback API Endpoint | P0 | TBD | TODO | 6h | Day 10 | TASK-004-01, TASK-004-02 | TBD |
| TASK-005-01 | Quality Dimension Calculator | P0 | TBD | TODO | 6h | Day 3 | 无 | TBD |
| TASK-005-02 | Usage/Social/Freshness Calculators | P0 | TBD | TODO | 8h | Day 5 | TASK-005-01 | TBD |
| TASK-005-03 | GDI Aggregator | P0 | TBD | TODO | 6h | Day 5 | TASK-005-02 | TBD |
| TASK-006-01 | Error Signature Normalizer | P0 | TBD | TODO | 4h | Day 5 | TASK-002-01 | TBD |
| TASK-006-02 | Signal Index Builder | P0 | TBD | TODO | 6h | Day 7 | TASK-006-01 | TBD |
| TASK-006-03 | Three-tier Matcher | P0 | TBD | TODO | 8h | Day 9 | TASK-006-02 | TBD |

---

## 3. 资源配置

| 角色 | 人数 | 工作时间 | 主要职责 |
|------|------|----------|----------|
| 后端开发 | 2 | 全职 | API 实现、数据库设计、核心算法 |
| DevOps | 1 | 兼职 | 基础设施部署、CI/CD |

---

## 4. 时间计划

**上线目标**：2026-03-15（Alpha 版本）

**里程碑**：
- M1 Sprint 1-2 完成：Day 5
- M2 Sprint 3 完成：Day 7
- M3 Sprint 4-5 完成：Day 12
- M4 集成测试与文档：Day 15

---

## 4.1 里程碑完成定义（DoD）

> 每个里程碑写清"做到什么算达成"，避免只写日期。

**M1 Sprint 1-2 完成（Day 5）**：
- API Gateway Hello endpoint 可用
- Signal Extraction Module 完成
- Experience Matcher 完成基础匹配
- GDI 所有维度计算器完成
- Agent Identity Service 可用
- 单元测试覆盖率 >= 70%

**M2 Sprint 3 完成（Day 7）**：
- Fetch API Endpoint 完整实现
- Publish API Endpoint 完整实现
- Feedback Processing 完成
- Signal Index Builder 完成
- 集成测试通过
- API 延迟测试通过

**M3 Sprint 4-5 完成（Day 12）**：
- Feedback API Endpoint 完整实现
- Asset Store Integration 完成
- Three-tier Matcher 完成
- 端到端测试通过
- 性能测试通过

**M4 集成测试与文档（Day 15）**：
- 所有 P0 任务完成
- 验收测试通过
- API 文档完成
- 部署文档完成

---

## 5. 任务拆解与优先级

| Task ID | 优先级 | 负责人 | 工期 | 依赖 | 状态 |
|---------|--------|--------|------|------|------|
| TASK-001-01 | P0 | TBD | 4h | 无 | TODO |
| TASK-001-02 | P0 | TBD | 8h | TASK-001-01 | TODO |
| TASK-002-01 | P0 | TBD | 8h | 无 | TODO |
| TASK-002-02 | P0 | TBD | 12h | TASK-002-01 | TODO |
| TASK-002-03 | P0 | TBD | 8h | TASK-005-02 | TODO |
| TASK-002-04 | P0 | TBD | 6h | TASK-002-02, TASK-002-03 | TODO |
| TASK-003-01 | P0 | TBD | 6h | TASK-002-01 | TODO |
| TASK-003-02 | P0 | TBD | 8h | TASK-003-01 | TODO |
| TASK-003-03 | P0 | TBD | 6h | TASK-003-02 | TODO |
| TASK-004-01 | P0 | TBD | 6h | TASK-003-02 | TODO |
| TASK-004-02 | P0 | TBD | 8h | TASK-005-03 | TODO |
| TASK-004-03 | P0 | TBD | 6h | TASK-004-01, TASK-004-02 | TODO |
| TASK-005-01 | P0 | TBD | 6h | 无 | TODO |
| TASK-005-02 | P0 | TBD | 8h | TASK-005-01 | TODO |
| TASK-005-03 | P0 | TBD | 6h | TASK-005-02 | TODO |
| TASK-006-01 | P0 | TBD | 4h | TASK-002-01 | TODO |
| TASK-006-02 | P0 | TBD | 6h | TASK-006-01 | TODO |
| TASK-006-03 | P0 | TBD | 8h | TASK-006-02 | TODO |

---

## 6. 依赖关系管理（beads 强制）

### 6.1 beads 依赖设置命令

> 所有硬依赖必须在 beads 中设置，接口依赖不设置依赖但需记录验证时间点。

```bash
# === 第一批次：无依赖（立即可启动）===
# TASK-001-01, TASK-002-01, TASK-005-01 无需设置依赖

# === 第二批次：单依赖 ===
bd dep add <TASK-001-02_ID> <TASK-001-01_ID>  # Identity Service → Gateway
bd dep add <TASK-002-02_ID> <TASK-002-01_ID>  # Matcher → Signal Extraction
bd dep add <TASK-005-02_ID> <TASK-005-01_ID>  # Usage/Social/Freshness → Quality
bd dep add <TASK-006-01_ID> <TASK-002-01_ID>  # Error Normalizer → Signal Extraction
# TASK-003-01 是接口依赖，不设置 beads 依赖（契约先行）

# === 第三批次：多依赖 ===
bd dep add <TASK-005-03_ID> <TASK-005-02_ID>  # GDI Aggregator → 所有维度计算器
bd dep add <TASK-002-03_ID> <TASK-005-03_ID>  # GDI Engine → GDI Aggregator
bd dep add <TASK-003-02_ID> <TASK-003-01_ID>  # Publish Endpoint → Validation
bd dep add <TASK-006-02_ID> <TASK-006-01_ID>  # Signal Index → Error Normalizer

# === 第四批次：合成依赖 ===
bd dep add <TASK-002-04_ID> <TASK-002-02_ID>  # Fetch API → Matcher
bd dep add <TASK-002-04_ID> <TASK-002-03_ID>  # Fetch API → GDI Engine
bd dep add <TASK-004-01_ID> <TASK-003-02_ID>  # Feedback Processing → Publish Endpoint
bd dep add <TASK-004-02_ID> <TASK-005-03_ID>  # GDI Update → GDI Aggregator
bd dep add <TASK-003-03_ID> <TASK-003-02_ID>  # Asset Store → Publish Endpoint
bd dep add <TASK-006-03_ID> <TASK-006-02_ID>  # Three-tier Matcher → Signal Index

# === 第五批次：最终依赖 ===
bd dep add <TASK-004-03_ID> <TASK-004-01_ID>  # Feedback API → Processing
bd dep add <TASK-004-03_ID> <TASK-004-02_ID>  # Feedback API → GDI Update
```

### 6.2 依赖类型分类

| 依赖类型 | beads 设置 | 并行策略 | 验证方式 |
|---------|-----------|---------|---------|
| **硬依赖** | 设置 `bd dep add` | 必须等待上游完成 | 代码编译通过 + 单元测试 |
| **接口依赖** | 不设置依赖 | 契约先行（使用桩实现） | 接口联调测试 |

### 6.3 接口依赖验证约定

> 接口依赖允许并行开发，但必须在被依赖任务完成后立即进行联调验证。

| 被依赖任务 | 接口依赖任务 | 验证时间点 | 验证方式 |
|-----------|-------------|-----------|---------|
| TASK-002-01 | TASK-003-01 | TASK-002-01 完成后立即 | Signal 提取接口联调 |
| TASK-005-03 | TASK-002-03 | TASK-005-03 完成后立即 | GDI 计算接口联调 |
| TASK-005-03 | TASK-004-02 | TASK-005-03 完成后立即 | GDI 更新接口联调 |

### 任务依赖可视化（ASCII）

```
AEP Protocol 任务依赖图

核心路径（Critical Path）:
TASK-002-01 → TASK-002-02 → TASK-002-04 → TASK-004-03 (最长依赖链)

完整依赖结构:

┌─────────────────────────────────────────────────────────────────────────────┐
│                         第一批次（立即可并行）                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TASK-001-01 (API Gateway - Hello)                                         │
│  TASK-002-01 (Signal Extraction)     ──┐                                    │
│  TASK-005-01 (Quality Calculator)     ├──→ TASK-002-02 (Matcher)            │
│                                      │                                      │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         第二批次（第一批完成后启动）                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TASK-001-02 (Identity Service) ──────────────────────────┐                 │
│  TASK-005-02 (Usage/Social/Freshness) ──────────────────┤                 │
│  TASK-006-01 (Error Normalizer) ─────────────────────────┼─────────────────┤
│                                      │                 │                 │
│                                      ▼                 ▼                 │
│                               TASK-005-03 (GDI Aggr.) TASK-003-01 (Validate)│
│                                      │                 │                 │
│                                      ▼                 ▼                 │
│                               TASK-002-03 (GDI Engine) TASK-003-02 (Publish)│
│                                      │                 │                 │
│                                      ▼                 ▼                 │
│                               TASK-002-04 (Fetch)     TASK-003-03 (Asset)  │
│                                       │                 │                 │
│                                       ▼                 ▼                 │
│                               TASK-004-01 (Process)───TASK-004-02 (Update) │
│                                       │                 │                 │
│                                       └─────────────────┴─────────────────┘
│                                                       │
│                                                       ▼
│                                          TASK-004-03 (Feedback API)       │
│                                                       │
│                                          TASK-006-02 (Index)             │
│                                                       │
│                                          TASK-006-03 (Three-tier)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 硬依赖清单（必须顺序执行，设置 beads 依赖）

| 被阻塞任务 | 阻塞它的任务 | 依赖类型 | beads 命令 | 说明 |
|-----------|-------------|---------|-----------|------|
| TASK-001-02 | TASK-001-01 | 硬依赖 | `bd dep add <TASK-001-02_ID> <TASK-001-01_ID>` | 需要先有 API Gateway |
| TASK-002-02 | TASK-002-01 | 硬依赖 | `bd dep add <TASK-002-02_ID> <TASK-002-01_ID>` | 需要 Signal Extraction 完成 |
| TASK-002-04 | TASK-002-02 | 硬依赖 | `bd dep add <TASK-002-04_ID> <TASK-002-02_ID>` | 需要 Matcher 完成 |
| TASK-002-04 | TASK-002-03 | 硬依赖 | `bd dep add <TASK-002-04_ID> <TASK-002-03_ID>` | 需要 GDI Engine 完成 |
| TASK-003-01 | TASK-002-01 | **接口依赖** | **不设置** | 契约先行，Signal 提取接口联调 |
| TASK-003-02 | TASK-003-01 | 硬依赖 | `bd dep add <TASK-003-02_ID> <TASK-003-01_ID>` | 需要先验证 |
| TASK-004-01 | TASK-003-02 | 硬依赖 | `bd dep add <TASK-004-01_ID> <TASK-003-02_ID>` | 需要 Publish Endpoint |
| TASK-004-02 | TASK-005-03 | 硬依赖 | `bd dep add <TASK-004-02_ID> <TASK-005-03_ID>` | 需要 GDI Aggregator |
| TASK-004-03 | TASK-004-01 | 硬依赖 | `bd dep add <TASK-004-03_ID> <TASK-004-01_ID>` | 需要 Feedback Processing |
| TASK-004-03 | TASK-004-02 | 硬依赖 | `bd dep add <TASK-004-03_ID> <TASK-004-02_ID>` | 需要 GDI Update |
| TASK-005-02 | TASK-005-01 | 硬依赖 | `bd dep add <TASK-005-02_ID> <TASK-005-01_ID>` | 需要 Quality Calculator |
| TASK-005-03 | TASK-005-02 | 硬依赖 | `bd dep add <TASK-005-03_ID> <TASK-005-02_ID>` | 需要其他维度完成 |
| TASK-006-01 | TASK-002-01 | 硬依赖 | `bd dep add <TASK-006-01_ID> <TASK-002-01_ID>` | 需要 Signal Extraction |
| TASK-006-02 | TASK-006-01 | 硬依赖 | `bd dep add <TASK-006-02_ID> <TASK-006-01_ID>` | 需要 Error Normalizer |
| TASK-006-03 | TASK-006-02 | 硬依赖 | `bd dep add <TASK-006-03_ID> <TASK-006-02_ID>` | 需要 Signal Index |

### 接口依赖清单（契约先行，可并行开发，不设置 beads 依赖）

> **重要**：接口依赖不设置 beads 依赖，允许并行开发。被依赖任务完成后必须立即进行接口联调验证。

| 被阻塞任务 | 接口提供任务 | 接口契约 | 验证时间点 | 桩实现说明 |
|-----------|-------------|---------|-----------|-----------|
| TASK-003-01 | TASK-002-01 | Signal 提取接口 | TASK-002-01 完成后立即 | 使用空实现，返回 nil |
| TASK-002-03 | TASK-005-03 | GDI 计算接口 | TASK-005-03 完成后立即 | 使用空实现，返回 0.0 |
| TASK-004-02 | TASK-005-03 | GDI 更新接口 | TASK-005-03 完成后立即 | 使用空实现，无操作 |

---

## 7. Sprint 计划

### Sprint 1（Days 1-3）：Foundation

**目标**：建立基础设施和核心模块

| Task ID | 任务 | 工期 | 并行 |
|---------|------|------|------|
| TASK-001-01 | API Gateway - Hello endpoint | 4h | ✅ |
| TASK-002-01 | Signal Extraction Module | 8h | ✅ |
| TASK-005-01 | Quality Dimension Calculator | 6h | ✅ |

**交付物**：
- API Gateway 可用
- 信号提取器完成
- 质量计算器完成

### Sprint 2（Days 3-5）：Core Matching

**目标**：核心匹配和评分算法

| Task ID | 任务 | 工期 | 并行 |
|---------|------|------|------|
| TASK-001-02 | Agent Identity Service | 8h | ✅ |
| TASK-002-02 | Experience Matcher | 12h | ✅ |
| TASK-005-02 | Usage/Social/Freshness Calculators | 8h | ✅ |
| TASK-006-01 | Error Signature Normalizer | 4h | ❌ |
| TASK-005-03 | GDI Aggregator | 6h | ❌ |
| TASK-003-01 | Gene/Capsule Validation | 6h | ❌ |
| TASK-002-03 | GDI Scoring Engine | 8h | ❌ |

**交付物**：
- Agent Identity Service 完成
- Experience Matcher 完成
- GDI 完整计算完成

### Sprint 3（Days 5-7）：Scoring & Storage

**目标**：评分计算和数据存储

| Task ID | 任务 | 工期 | 并行 |
|---------|------|------|------|
| TASK-002-04 | Fetch API Endpoint | 6h | ✅ |
| TASK-003-02 | Publish API Endpoint | 8h | ✅ |
| TASK-004-01 | Feedback Processing | 6h | ✅ |
| TASK-006-02 | Signal Index Builder | 6h | ❌ |

**交付物**：
- Fetch API 完成
- Publish API 完成
- Feedback Processing 完成

### Sprint 4（Days 7-10）：Publish & Feedback

**目标**：发布和反馈完整流程

| Task ID | 任务 | 工期 | 并行 |
|---------|------|------|------|
| TASK-003-03 | Asset Store Integration | 6h | ✅ |
| TASK-004-02 | GDI Update Logic | 8h | ❌ |
| TASK-006-03 | Three-tier Matcher | 8h | ❌ |

**交付物**：
- Asset Store 完成
- GDI 更新完成

### Sprint 5（Days 10-12）：Integration

**目标**：集成和测试

| Task ID | 任务 | 工期 | 并行 |
|---------|------|------|------|
| TASK-004-03 | Feedback API Endpoint | 6h | ❌ |

**交付物**：
- Feedback API 完成
- 端到端测试

---

## 8. 关键路径分析

**Critical Path**：TASK-002-01 → TASK-002-02 → TASK-002-04 → TASK-004-03

这是最长的依赖链，决定了项目最小工期：

1. TASK-002-01 (Day 1-3): Signal Extraction - 8h
2. TASK-002-02 (Day 3-5): Experience Matcher - 12h (依赖 TASK-002-01)
3. TASK-002-04 (Day 7): Fetch API - 6h (依赖 TASK-002-02, TASK-002-03)
4. TASK-004-03 (Day 10-12): Feedback API - 6h (依赖 TASK-004-01, TASK-004-02)

**关键路径工期**: 约 12 天

**并行机会**：
- Sprint 1: 3 个任务可完全并行（TASK-001-01, TASK-002-01, TASK-005-01）
- Sprint 2: 4 个任务可并行（TASK-001-02, TASK-002-02, TASK-005-02, TASK-006-01）
- Sprint 3: 4 个任务可并行（TASK-002-04, TASK-003-02, TASK-004-01, TASK-006-02）

---

## 9. 验收与上线门槛（Release Gate）

> 原则：宁可延期或降级，也不要带病上线。验收证据尽量回写到 `TASK-*.md`（测试用例、结果、回滚）。

### 9.1 验收负责人与方式

**验收负责人**：proj

**验收方式**：
- 端到端测试
- 性能测试
- 集成测试

**验收入口**：
- 测试环境 URL
- API 文档

### 9.2 必过清单（上线前）

- [ ] 本期纳入的 Story 全部验收通过（AC 逐条有记录）
- [ ] tech 代码 Review 通过（复用/基线/迁移/回滚，只读）
- [ ] prd 需求验收通过（对照 AC/边界，只读）
- [ ] P0/P1 Task 均已在 `TASK-*.md` 回写测试用例与结果
- [ ] 回归清单已执行并有记录（至少 5 条关键回归）
- [ ] 发布策略明确（开关/灰度/回滚/通知）且可执行
- [ ] 可观测性检查点明确（关键日志/指标/告警/仪表盘）且上线后可验证
- [ ] 迁移/数据变更（如有）具备回滚或补救方案

- [ ] API Gateway 健康检查通过
- [ ] 所有 API 端点响应时间达标（p95 < 100ms）
- [ ] 数据库迁移脚本测试通过
- [ ] GDI 计算准确率测试通过
- [ ] 信号匹配准确率测试通过
- [ ] 单元测试覆盖率 >= 70%

---

## 10. 风险管理

### 风险列表

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| pgvector 安装/配置问题 | 高 | 中 | 提前验证，准备备选方案 |
| 嵌入模型性能不达标 | 高 | 中 | 准备多种模型方案 |
| 并发性能不达标 | 高 | 中 | 早期性能测试，优化瓶颈 |
| GDI 算法错误导致排序异常 | 高 | 低 | 充分单元测试和集成测试 |

### 缓解措施

1. **技术风险缓解**：
   - 提前搭建开发环境验证 pgvector
   - 准备多个嵌入模型备选（OpenAI, 本地模型）
   - 使用负载测试验证并发性能

2. **质量保障**：
   - 单元测试覆盖率 >= 70%
   - 集成测试覆盖关键路径
   - 性能测试基准建立

3. **回滚方案**：
   - 数据库迁移具备回滚脚本
   - API 版本化，支持灰度发布
   - 关键操作日志记录完整

### 变更管理（如何记录 scope/排期变更）

所有变更必须在 PROJ 文档的「变更记录」中记录，包括：
- 变更时间
- 变更人
- 变更内容（范围/排期）
- 变更原因
- 影响分析

---

## 11. 沟通机制（可选）

### 例会节奏

**Daily Standup**：每天上午 10 点（可选）

**Sprint Review**：Sprint 结束时

### 汇报对象

- 项目经理
- 技术负责人
- 业务方

---

## 12. Gate 检查点（强护栏）

### Gate A（进入实现前）：✅ 已通过

必须具备：
- `PRD-E-001-v0.md`：完成
- 至少 1 个"厚 STORY"：STORY-002 Experience Fetch（覆盖所有 AC 和边界）
- 至少 1 个 SLICE：SLICE-002-001
- UI 证据：协议消息面板原型

### Gate B（P0 Task 进入 DONE 前）：⏳ 待执行

必须具备：
- 对应 AC 的测试用例与结果
- 至少一次"真数据真流程"的端到端验证
- 回滚方案 + 上线观测点

### Gate C（方向偏差时）：⏳ 待触发

触发条件：
- 发现"不是想要的"
- 关键分叉决策改变

必须动作：
- PRD/TECH/PROJ 升版本并记录变更点
- 受影响的 TASK 必须重排

---

## 13. 变更记录（Changelog）

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-21 | proj | 初版，完整项目计划 |
| v1.1 | 2026-02-21 18:09 | proj | 添加 beads 依赖设置命令和接口依赖验证约定 |

---

## 14. 附录：beads 操作参考

### 14.1 常用 beads 命令

```bash
# 查看任务状态
bd list
bd ready          # 查看可立即开始的任务（无阻塞）
bd show <TASK_ID> # 查看任务详情

# 设置依赖（重要！必须按依赖顺序设置）
bd dep add <被阻塞任务ID> <阻塞它的任务ID>
# 示例：TASK-002 依赖 TASK-001
# bd dep add task-002-id task-001-id

# 更新任务状态
bd update <TASK_ID> -s "doing"   # 标记为进行中
bd update <TASK_ID> -s "done"    # 标记为完成
bd update <TASK_ID> -a "dev"     # 分配给 dev
```

### 14.2 TASK 文档与 beads 关联

每个 TASK 文档必须包含：
```markdown
> Beads 任务ID：`<BEADS_ID>`
```

创建 beads 任务时设置 external_ref：
```bash
bd create "TASK-E-001-BE-001: 任务标题" \
  -d "任务描述" \
  -p 0 \
  -e 120 \
  -l "E-001,SLICE-001,backend"

# 设置 external_ref 指向 TASK 文档
bd update <BEADS_ID> --external-ref "docs/E-001-AEP-Protocol/task/TASK-E-001-BE-001-xxx.md"
```

### 14.3 依赖验证

设置依赖后验证：
```bash
# 查看任务的依赖
bd dep list <TASK_ID>

# 确认 ready 任务数量正确
bd ready
```