# E-004 Session Memory - 项目计划 v1

> 文档路径：`/docs/E-004-Session-Memory/proj/PROJ-E-004-v1.md`
>
> * 文档状态：正式执行版
> * 版本：v1.0
> * Epic ID：E-004
> * Epic 目录：`/docs/E-004-Session-Memory/`
> * 项目经理：proj
> * 创建日期：2026-02-24
> * 更新日期：2026-02-24 05:48
> * 关联文档：
>   * biz：`/docs/_project/biz-overview.md`
>   * prd：`/docs/_project/prd-v1-session-memory.md`
>   * story：`/docs/_project/stories/STORY-007~010-*.md`
>   * tech：`/docs/E-004-Session-Memory/tech/TECH-E-004-v1.md`
>   * 依赖分析：`/docs/E-004-Session-Memory/tech/task-dependencies.md`

---

## 1. 项目概述

**项目名称**：E-004 Session Memory - 智能体会话记忆系统

**业务目标**（摘自 PRD）：
1. **可追溯性**：智能体的每一次行动都有记录，支持审计和复盘
2. **数据完整性**：行动记录与反馈关联，形成完整的经验闭环
3. **存储规范化**：统一存储位置，跨工具/环境可访问
4. **自动化压缩**：长会话自动压缩为摘要，保持可读性

**关键指标**：
- 会话记录覆盖率：100%（所有智能体交互都被记录）
- 反馈关联率：>= 90%
- 压缩比：>= 70%
- 记录延迟：< 100ms (p95)

**方案一句话**：
> 在 AEP SDK 中增加三层本地存储（sessions/memory/pending），通过 SessionRecorder、ActionLogger、FeedbackCollector 三个组件实现智能体行动的自动记录、反馈关联和压缩归档。

---

## 2. 范围说明

### 本期包含的 Story

| Story ID | 名称 | 优先级 | 说明 |
|----------|------|--------|------|
| STORY-007 | 会话自动记录（Session Recording） | P0 | 核心功能，每次交互自动记录为 JSONL |
| STORY-008 | AgentAction 日志格式（Action Log Format） | P0 | 数据结构定义，标准化行动日志格式 |
| STORY-009 | 反馈收集机制（Feedback Collection） | P0 | 显式/隐式反馈与行动关联 |
| STORY-010 | 会话压缩与归档（Session Compression & Archive） | P1 | 定期压缩为摘要，参考 OpenClaw |

### 本期交付的 Task

共 12 个任务，分为 4 个模块：
- SESSION（会话记录核心）：3 个任务
- ACTION（行动日志类型）：3 个任务
- FEEDBACK（反馈收集）：3 个任务
- ARCHIVE（压缩归档）：3 个任务

### Out of Scope

| 功能 | 原因 | 后续规划 |
|------|------|----------|
| 实时流式上传 | 复杂度高，先做本地存储 | v1.1 |
| 多智能体会话合并 | 需要协调机制 | v1.2 |
| 加密存储 | 安全需求明确后再做 | v1.3 |
| 云端同步 | 需要账户系统 | v2.0 |

---

## 2.1 Story -> Slice -> Task 对齐表（必填）

> 目的：避免"任务很多但不覆盖主路径/AC"，以及"无需求来源的任务混入版本"。

| STORY_ID | SLICE_ID | TASK_ID 列表 | 本期纳入 | 验收责任人 | 备注 |
|---|---|---|---|---|---|
| STORY-007 | SLICE-001 | SESSION-001, SESSION-002, SESSION-003 | YES | proj | 竖切闭环 P0：会话记录核心功能 |
| STORY-008 | SLICE-001 | ACTION-001, ACTION-002, ACTION-003 | YES | proj | 竖切闭环 P0：三种行动类型日志 |
| STORY-009 | SLICE-001 | FEEDBACK-001, FEEDBACK-002, FEEDBACK-003 | YES | proj | 竖切闭环 P0：反馈收集完整流程 |
| STORY-010 | SLICE-001 | ARCHIVE-001, ARCHIVE-002, ARCHIVE-003 | YES | proj | 竖切闭环 P1：压缩归档功能 |

---

## 2.2 执行进度表（必填）

> 状态以 beads 为准，此处为同步视图。

| TASK_ID | 标题 | 优先级 | Owner | 状态 | 预估 | 批次 | 阻塞点 | 证据（TASK链接） |
|---|---|---|---|---|---|---|---|---|
| SESSION-001 | AgentAction/Session 数据模型 | P0 | TBD | TODO | 4h | 1 | 无 | TBD |
| SESSION-002 | SessionRecorder 实现 | P0 | TBD | TODO | 6h | 2 | SESSION-001 | TBD |
| SESSION-003 | ActionLogger 实现 | P0 | TBD | TODO | 6h | 3 | SESSION-002 | TBD |
| ACTION-001 | tool_call 日志 | P0 | TBD | TODO | 3h | 1*/3 | SESSION-001（接口）| TBD |
| ACTION-002 | message 日志 | P0 | TBD | TODO | 2h | 4 | ACTION-001, SESSION-003 | TBD |
| ACTION-003 | decision 日志 | P0 | TBD | TODO | 2h | 5 | ACTION-002 | TBD |
| FEEDBACK-001 | Feedback 数据模型 | P0 | TBD | TODO | 2h | 1 | 无 | TBD |
| FEEDBACK-002 | 显式反馈收集 | P0 | TBD | TODO | 4h | 4 | FEEDBACK-001, SESSION-003 | TBD |
| FEEDBACK-003 | 隐式反馈收集 | P0 | TBD | TODO | 4h | 5 | FEEDBACK-002 | TBD |
| ARCHIVE-001 | SessionSummary 摘要格式 | P1 | TBD | TODO | 3h | 1 | 无 | TBD |
| ARCHIVE-002 | MemoryArchiver 压缩归档 | P1 | TBD | TODO | 6h | 4 | ARCHIVE-001, SESSION-003 | TBD |
| ARCHIVE-003 | 待发布队列管理 | P1 | TBD | TODO | 4h | 5 | ARCHIVE-002 | TBD |

---

## 3. 资源配置

| 角色 | 人数 | 工作时间 | 主要职责 |
|------|------|----------|----------|
| 后端开发（Python SDK） | 2 | 全职 | SDK 核心实现、数据模型、存储层 |
| 测试 | 1 | 兼职 | 单元测试、集成测试、性能测试 |

---

## 4. 时间计划

**上线目标**：2026-03-15（Alpha 版本）

**里程碑**：
- M1 批次 1-2 完成（数据模型 + SessionRecorder）：Day 2
- M2 批次 3 完成（ActionLogger）：Day 3
- M3 批次 4 完成（日志类型 + 反馈 + 归档）：Day 5
- M4 批次 5 完成（完整功能闭环）：Day 6
- M5 集成测试与文档：Day 8

---

## 4.1 里程碑完成定义（DoD）

**M1 批次 1-2 完成（Day 2）**：
- AgentAction/Session 数据模型完成
- Feedback 数据模型完成
- SessionSummary 摘要格式完成
- SessionRecorder 实现完成
- 单元测试覆盖率 >= 70%

**M2 批次 3 完成（Day 3）**：
- ActionLogger 实现完成
- tool_call 类型定义完成（接口部分）
- 集成测试通过

**M3 批次 4 完成（Day 5）**：
- message 日志实现
- 显式反馈收集实现
- MemoryArchiver 压缩归档实现
- 端到端测试通过

**M4 批次 5 完成（Day 6）**：
- decision 日志实现
- 隐式反馈收集实现
- 待发布队列管理实现
- 性能测试通过（记录延迟 < 100ms）

**M5 集成测试与文档（Day 8）**：
- 所有 P0/P1 任务完成
- 验收测试通过
- API 文档完成
- 使用指南完成

---

## 5. 任务拆解与优先级

### 5.1 按模块分类

**P0 - 核心功能（MVP）**

| Task ID | 模块 | 任务名称 | 预估 | 依赖 |
|---------|------|----------|------|------|
| SESSION-001 | SESSION | AgentAction/Session 数据模型 | 4h | 无 |
| SESSION-002 | SESSION | SessionRecorder 实现 | 6h | SESSION-001 |
| SESSION-003 | SESSION | ActionLogger 实现 | 6h | SESSION-002 |
| ACTION-001 | ACTION | tool_call 日志 | 3h | SESSION-001（接口）|
| ACTION-002 | ACTION | message 日志 | 2h | ACTION-001, SESSION-003 |
| ACTION-003 | ACTION | decision 日志 | 2h | ACTION-002 |
| FEEDBACK-001 | FEEDBACK | Feedback 数据模型 | 2h | 无 |
| FEEDBACK-002 | FEEDBACK | 显式反馈收集 | 4h | FEEDBACK-001, SESSION-003 |
| FEEDBACK-003 | FEEDBACK | 隐式反馈收集 | 4h | FEEDBACK-002 |

**P1 - 压缩归档**

| Task ID | 模块 | 任务名称 | 预估 | 依赖 |
|---------|------|----------|------|------|
| ARCHIVE-001 | ARCHIVE | SessionSummary 摘要格式 | 3h | 无 |
| ARCHIVE-002 | ARCHIVE | MemoryArchiver 压缩归档 | 6h | ARCHIVE-001, SESSION-003 |
| ARCHIVE-003 | ARCHIVE | 待发布队列管理 | 4h | ARCHIVE-002 |

### 5.2 总工期估算

```
关键路径（Critical Path）:
SESSION-001 (4h) → SESSION-002 (6h) → SESSION-003 (6h) → FEEDBACK-002 (4h) → FEEDBACK-003 (4h)
总计：24 小时（约 3 个工作日）

加上 ARCHIVE 路径：
ARCHIVE-001 (3h) → ARCHIVE-002 (6h) → ARCHIVE-003 (4h)
总计：13 小时（约 2 个工作日）

完整工期估算：4-5 个工作日（考虑并行）
```

---

## 6. 依赖关系管理（beads 强制）

### 6.1 依赖图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         E-004 Session Memory 任务依赖图                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────── 批次 1：数据模型（可并行）─────────────────────┐    │
│  │                                                                      │    │
│  │  SESSION-001 ──────────────────────────────────────────────────────┐│    │
│  │  (AgentAction/Session)                                              ││    │
│  │                                                                      ││    │
│  │  FEEDBACK-001 ─────────────────────────────────────────────────────┤│    │
│  │  (Feedback 模型)                                                    ││    │
│  │                                                                      ││    │
│  │  ARCHIVE-001 ──────────────────────────────────────────────────────┘│    │
│  │  (摘要格式)                                                          │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────── 批次 2：SessionRecorder ───────────────────────┐    │
│  │                                                                      │    │
│  │  SESSION-002 ──────────────────────────────────────────────────────┐│    │
│  │  (依赖 SESSION-001)                                                 ││    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────── 批次 3：ActionLogger ──────────────────────────┐    │
│  │                                                                      │    │
│  │  SESSION-003 ──────────────────────────────────────────────────────┐│    │
│  │  (依赖 SESSION-002)                                                 ││    │
│  │                                                                      ││    │
│  │  ACTION-001（接口部分）─────────────────────────────────────────────┤│    │
│  │  (接口依赖 SESSION-001，实现等 SESSION-003)                          ││    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────── 批次 4：功能扩展（可并行）─────────────────────┐    │
│  │                                                                      │    │
│  │  ACTION-002 ───────────────────────────────────────────────────────┐│    │
│  │  (依赖 ACTION-001, SESSION-003)                                     ││    │
│  │                                                                      ││    │
│  │  FEEDBACK-002 ─────────────────────────────────────────────────────┤│    │
│  │  (依赖 FEEDBACK-001, SESSION-003)                                   ││    │
│  │                                                                      ││    │
│  │  ARCHIVE-002 ──────────────────────────────────────────────────────┘│    │
│  │  (依赖 ARCHIVE-001, SESSION-003)                                     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────── 批次 5：完成闭环（可并行）─────────────────────┐    │
│  │                                                                      │    │
│  │  ACTION-003 ───────────────────────────────────────────────────────┐│    │
│  │  (依赖 ACTION-002)                                                  ││    │
│  │                                                                      ││    │
│  │  FEEDBACK-003 ─────────────────────────────────────────────────────┤│    │
│  │  (依赖 FEEDBACK-002)                                                ││    │
│  │                                                                      ││    │
│  │  ARCHIVE-003 ──────────────────────────────────────────────────────┘│    │
│  │  (依赖 ARCHIVE-002)                                                  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 beads 依赖设置命令

> 所有硬依赖必须在 beads 中设置，接口依赖不设置依赖但需记录验证时间点。

```bash
# === 批次 1：无依赖（立即可启动）===
# SESSION-001, FEEDBACK-001, ARCHIVE-001 无需设置依赖

# === 批次 2：单依赖 ===
bd dep add <SESSION-002_ID> <SESSION-001_ID>  # SessionRecorder → 数据模型

# === 批次 3：单依赖 ===
bd dep add <SESSION-003_ID> <SESSION-002_ID>  # ActionLogger → SessionRecorder
# ACTION-001 是接口依赖，不设置 beads 依赖（契约先行）

# === 批次 4：多依赖 ===
bd dep add <ACTION-002_ID> <ACTION-001_ID>    # message → tool_call
bd dep add <ACTION-002_ID> <SESSION-003_ID>   # message → ActionLogger
bd dep add <FEEDBACK-002_ID> <FEEDBACK-001_ID> # 显式反馈 → 反馈模型
bd dep add <FEEDBACK-002_ID> <SESSION-003_ID>  # 显式反馈 → ActionLogger
bd dep add <ARCHIVE-002_ID> <ARCHIVE-001_ID>   # 压缩归档 → 摘要格式
bd dep add <ARCHIVE-002_ID> <SESSION-003_ID>   # 压缩归档 → ActionLogger

# === 批次 5：单依赖 ===
bd dep add <ACTION-003_ID> <ACTION-002_ID>    # decision → message
bd dep add <FEEDBACK-003_ID> <FEEDBACK-002_ID> # 隐式反馈 → 显式反馈
bd dep add <ARCHIVE-003_ID> <ARCHIVE-002_ID>   # 待发布队列 → 压缩归档
```

### 6.3 依赖类型分类

| 依赖类型 | beads 设置 | 并行策略 | 验证方式 |
|---------|-----------|---------|---------|
| **硬依赖** | 设置 `bd dep add` | 必须等待上游完成 | 代码编译通过 + 单元测试 |
| **接口依赖** | 不设置依赖 | 契约先行（使用桩实现） | 接口联调测试 |

### 6.4 接口依赖验证约定

> 接口依赖允许并行开发，但必须在被依赖任务完成后立即进行联调验证。

| 被依赖任务 | 接口依赖任务 | 验证时间点 | 验证方式 |
|-----------|-------------|-----------|---------|
| SESSION-001 | ACTION-001 | SESSION-001 完成后立即 | AgentAction 类型联调 |
| SESSION-001 | FEEDBACK-001 | SESSION-001 完成后立即 | Feedback 类型联调 |
| SESSION-001 | ARCHIVE-001 | SESSION-001 完成后立即 | SessionSummary 类型联调 |

### 6.5 硬依赖清单（必须顺序执行，设置 beads 依赖）

| 被阻塞任务 | 阻塞它的任务 | 依赖类型 | beads 命令 | 说明 |
|-----------|-------------|---------|-----------|------|
| SESSION-002 | SESSION-001 | 硬依赖 | `bd dep add <SESSION-002_ID> <SESSION-001_ID>` | SessionRecorder 需要 AgentAction 类型 |
| SESSION-003 | SESSION-002 | 硬依赖 | `bd dep add <SESSION-003_ID> <SESSION-002_ID>` | ActionLogger 需要 SessionRecorder |
| ACTION-002 | ACTION-001 | 硬依赖 | `bd dep add <ACTION-002_ID> <ACTION-001_ID>` | message 日志需要 tool_call 基础 |
| ACTION-002 | SESSION-003 | 硬依赖 | `bd dep add <ACTION-002_ID> <SESSION-003_ID>` | message 日志需要 ActionLogger |
| ACTION-003 | ACTION-002 | 硬依赖 | `bd dep add <ACTION-003_ID> <ACTION-002_ID>` | decision 日志需要 message 基础 |
| FEEDBACK-002 | FEEDBACK-001 | 硬依赖 | `bd dep add <FEEDBACK-002_ID> <FEEDBACK-001_ID>` | 显式反馈需要 Feedback 模型 |
| FEEDBACK-002 | SESSION-003 | 硬依赖 | `bd dep add <FEEDBACK-002_ID> <SESSION-003_ID>` | 显式反馈需要 ActionLogger |
| FEEDBACK-003 | FEEDBACK-002 | 硬依赖 | `bd dep add <FEEDBACK-003_ID> <FEEDBACK-002_ID>` | 隐式反馈需要显式反馈基础 |
| ARCHIVE-002 | ARCHIVE-001 | 硬依赖 | `bd dep add <ARCHIVE-002_ID> <ARCHIVE-001_ID>` | 压缩归档需要摘要格式 |
| ARCHIVE-002 | SESSION-003 | 硬依赖 | `bd dep add <ARCHIVE-002_ID> <SESSION-003_ID>` | 压缩归档需要 ActionLogger |
| ARCHIVE-003 | ARCHIVE-002 | 硬依赖 | `bd dep add <ARCHIVE-003_ID> <ARCHIVE-002_ID>` | 待发布队列需要压缩归档 |

### 6.6 接口依赖清单（契约先行，可并行开发，不设置 beads 依赖）

| 被阻塞任务 | 接口提供任务 | 接口契约 | 验证时间点 | 桩实现说明 |
|-----------|-------------|---------|-----------|-----------|
| ACTION-001 | SESSION-001 | AgentAction 类型定义 | SESSION-001 完成后立即 | 使用空实现，返回 nil |
| FEEDBACK-001 | SESSION-001 | AgentAction.feedback 字段 | SESSION-001 完成后立即 | 使用空实现，无操作 |
| ARCHIVE-001 | SESSION-001 | Session 类型定义 | SESSION-001 完成后立即 | 使用空实现，返回空对象 |

---

## 7. Sprint 计划

### Sprint 1（Days 1-2）：数据模型与核心组件

**目标**：建立数据模型和核心会话记录器

| Task ID | 任务 | 工期 | 并行 | 批次 |
|---------|------|------|------|------|
| SESSION-001 | AgentAction/Session 数据模型 | 4h | YES | 1 |
| FEEDBACK-001 | Feedback 数据模型 | 2h | YES | 1 |
| ARCHIVE-001 | SessionSummary 摘要格式 | 3h | YES | 1 |
| SESSION-002 | SessionRecorder 实现 | 6h | NO | 2 |

**交付物**：
- 完整数据模型定义
- SessionRecorder 可用

### Sprint 2（Days 2-3）：ActionLogger 核心实现

**目标**：实现行动日志核心功能

| Task ID | 任务 | 工期 | 并行 | 批次 |
|---------|------|------|------|------|
| SESSION-003 | ActionLogger 实现 | 6h | NO | 3 |
| ACTION-001 | tool_call 日志 | 3h | NO | 3 |

**交付物**：
- ActionLogger 完成
- tool_call 日志实现

### Sprint 3（Days 4-5）：功能扩展

**目标**：完成日志类型、反馈收集、归档功能

| Task ID | 任务 | 工期 | 并行 | 批次 |
|---------|------|------|------|------|
| ACTION-002 | message 日志 | 2h | YES | 4 |
| FEEDBACK-002 | 显式反馈收集 | 4h | YES | 4 |
| ARCHIVE-002 | MemoryArchiver 压缩归档 | 6h | YES | 4 |

**交付物**：
- message 日志完成
- 显式反馈收集完成
- 压缩归档完成

### Sprint 4（Days 5-6）：完成闭环

**目标**：完成所有功能闭环

| Task ID | 任务 | 工期 | 并行 | 批次 |
|---------|------|------|------|------|
| ACTION-003 | decision 日志 | 2h | YES | 5 |
| FEEDBACK-003 | 隐式反馈收集 | 4h | YES | 5 |
| ARCHIVE-003 | 待发布队列管理 | 4h | YES | 5 |

**交付物**：
- 所有功能完成
- 端到端测试通过

### Sprint 5（Days 7-8）：集成与文档

**目标**：集成测试和文档编写

**交付物**：
- 性能测试通过
- API 文档完成
- 使用指南完成

---

## 8. 关键路径分析

**Critical Path**：SESSION-001 → SESSION-002 → SESSION-003 → FEEDBACK-002 → FEEDBACK-003

这是最长的依赖链，决定了项目最小工期：

1. SESSION-001 (4h): 数据模型
2. SESSION-002 (6h): SessionRecorder（依赖 SESSION-001）
3. SESSION-003 (6h): ActionLogger（依赖 SESSION-002）
4. FEEDBACK-002 (4h): 显式反馈（依赖 SESSION-003）
5. FEEDBACK-003 (4h): 隐式反馈（依赖 FEEDBACK-002）

**关键路径工期**: 约 24 小时（3 个工作日）

**并行机会**：
- 批次 1: 3 个任务可完全并行（SESSION-001, FEEDBACK-001, ARCHIVE-001）
- 批次 4: 3 个任务可并行（ACTION-002, FEEDBACK-002, ARCHIVE-002）
- 批次 5: 3 个任务可并行（ACTION-003, FEEDBACK-003, ARCHIVE-003）

---

## 9. 验收与上线门槛（Release Gate）

> 原则：宁可延期或降级，也不要带病上线。验收证据尽量回写到 `TASK-*.md`。

### 9.1 验收负责人与方式

**验收负责人**：proj

**验收方式**：
- 单元测试（覆盖率 >= 70%）
- 集成测试
- 端到端测试
- 性能测试

**验收入口**：
- Python SDK 安装验证
- CLI 命令可用
- 示例代码运行

### 9.2 必过清单（上线前）

- [ ] 本期纳入的 Story 全部验收通过（AC 逐条有记录）
- [ ] tech 代码 Review 通过（复用/基线/迁移/回滚，只读）
- [ ] prd 需求验收通过（对照 AC/边界，只读）
- [ ] P0/P1 Task 均已在 `TASK-*.md` 回写测试用例与结果
- [ ] 回归清单已执行并有记录
- [ ] 发布策略明确（Feature Flag/回滚/通知）且可执行
- [ ] 可观测性检查点明确且上线后可验证

### 9.3 功能验收清单

- [ ] 每次智能体交互都被记录为 AgentAction（AC-1）
- [ ] AgentAction 格式符合接口定义（AC-2）
- [ ] 显式反馈正确关联到对应 AgentAction（AC-3）
- [ ] 隐式反馈正确推断和关联（AC-4）
- [ ] 会话结束后生成压缩摘要（AC-5）
- [ ] 待发布队列正确管理 Experience（AC-6）
- [ ] 存储位置符合统一规范（AC-7）
- [ ] 记录延迟 < 100ms (p95)（AC-8）

### 9.4 测试要求

- [ ] 检查测试基建是否就绪（pytest）
- [ ] 单元测试覆盖率目标：70%
- [ ] 真数据真流程验证
- [ ] 性能测试（1000 条行动压缩 < 5s）

---

## 10. 风险管理

### 风险列表

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 磁盘空间占用大 | M | 中 | 自动清理策略、压缩归档 |
| 记录延迟影响主流程 | M | 中 | 异步写入选项 |
| 敏感信息泄露 | H | 低 | 敏感标记、发布前确认 |
| 隐式反馈推断不准确 | M | 中 | 可配置阈值、人工审核 |

### 缓解措施

1. **技术风险缓解**：
   - 异步写入保证不阻塞主流程
   - 重试机制保证数据不丢失
   - 压缩归档控制存储空间

2. **质量保障**：
   - 单元测试覆盖率 >= 70%
   - 集成测试覆盖关键路径
   - 性能测试基准建立

3. **回滚方案**：
   - Feature Flag 控制功能开关
   - 数据文件格式向后兼容
   - 可手动删除 `.aep/` 目录清理

### 变更管理

所有变更必须在 PROJ 文档的「变更记录」中记录，包括：
- 变更时间
- 变更人
- 变更内容（范围/排期）
- 变更原因
- 影响分析

---

## 11. Gate 检查点（强护栏）

### Gate A（进入实现前）：DONE

必须具备：
- [x] `prd-v1-session-memory.md`：完成
- [x] 至少 1 个"厚 STORY"：STORY-007 会话自动记录（覆盖所有 AC 和边界）
- [x] 至少 1 个 SLICE：SLICE-001
- [x] UI 证据：SDK API 设计，CLI 命令设计

### Gate B（P0 Task 进入 DONE 前）：TODO

必须具备：
- [ ] 对应 AC 的测试用例与结果
- [ ] 至少一次"真数据真流程"的端到端验证
- [ ] 回滚方案 + 上线观测点

### Gate C（方向偏差时）：TODO

触发条件：
- 发现"不是想要的"
- 关键分叉决策改变

必须动作：
- PRD/TECH/PROJ 升版本并记录变更点
- 受影响的 TASK 必须重排

---

## 12. 变更记录（Changelog）

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-24 | proj | 初版，基于 TECH 和 task-dependencies 创建项目计划 |
| v1.1 | 2026-02-24 05:48 | proj | 补充 beads 依赖设置（ACTION-001/003, FEEDBACK-003, ARCHIVE-003）|

---

## 13. 附录：beads 操作参考

### 13.1 常用 beads 命令

```bash
# 查看任务状态
bd list
bd ready          # 查看可立即开始的任务（无阻塞）
bd show <TASK_ID> # 查看任务详情

# 设置依赖（重要！必须按依赖顺序设置）
bd dep add <被阻塞任务ID> <阻塞它的任务ID>
# 示例：SESSION-002 依赖 SESSION-001
# bd dep add <SESSION-002_ID> <SESSION-001_ID>

# 更新任务状态
bd update <TASK_ID> -s "doing"   # 标记为进行中
bd update <TASK_ID> -s "done"    # 标记为完成
bd update <TASK_ID> -a "dev"     # 分配给 dev
```

### 13.2 TASK 文档与 beads 关联

每个 TASK 文档必须包含：
```markdown
> Beads 任务ID：`<BEADS_ID>`
```

创建 beads 任务时设置 external_ref：
```bash
bd create "TASK-E-004-SESSION-001: 任务标题" \
  -d "任务描述" \
  -p 0 \
  -e 240 \
  -l "E-004,SLICE-001,sdk"

# 设置 external_ref 指向 TASK 文档
bd update <BEADS_ID> --external-ref "docs/E-004-Session-Memory/task/TASK-E-004-SESSION-001.md"
```

### 13.3 依赖验证

设置依赖后验证：
```bash
# 查看任务的依赖
bd dep list <TASK_ID>

# 确认 ready 任务数量正确
bd ready
```

---

## 14. 附录：存储目录结构

```
<workspace>/.aep/
├── agent.json              # 智能体身份信息
├── sessions/               # 会话记录
│   ├── session_<ts>_<id>.jsonl    # 当前活跃会话
│   └── archive/                   # 已归档会话
│       └── session_<ts>_<id>.jsonl.gz
├── memory/                 # 压缩记忆
│   ├── 2026-02-23_summary.md      # 每日摘要
│   └── session_<ts>_summary.md    # 会话摘要
├── pending/                # 待发布队列
│   ├── exp_<id>.json              # 待发布的 Experience
│   └── batch_<ts>.json            # 批量发布队列
└── cache/                  # 本地缓存
    ├── experiences.json           # 获取的经验缓存
    └── signals.json               # 信号索引缓存
```
