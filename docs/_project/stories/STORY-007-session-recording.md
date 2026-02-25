# STORY-007: 会话自动记录（Session Recording）

> **EPIC_ID:** E-004
>
> **EPIC_DIR:** E-004-Session-Memory
>
> **PRD Reference:** `/docs/_project/prd-v1-session-memory.md#51-f1-会话自动记录session-recording`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** SDK Core Feature

---

## User Story

**As an** Agent,

**I want** every interaction with the user to be automatically recorded,

**So that** my actions can be traced, reviewed, and transformed into reusable experiences.

---

## Background & Motivation

### 问题

当前智能体的交互没有系统性记录：
- 会话结束后上下文丢失，无法追溯
- 无法知道智能体做了什么决策、为什么做
- 缺乏原始数据支撑 Experience 的发布

### 价值

会话自动记录是 Session Memory 的基础：
- 为审计和复盘提供数据
- 为 Experience 提取提供原始素材
- 为反馈关联提供锚点

---

## Main Path (Happy Path)

### Step 1: Session Initialization

1. Agent SDK 初始化时，创建新会话
2. 生成 `session_id`（UUID 格式）
3. 创建会话文件：`.aep/sessions/session_<timestamp>_<session_id>.jsonl`
4. 写入会话头信息

### Step 2: Action Recording (Per Interaction)

```
用户发送消息
    ↓
Agent 处理并生成回复
    ↓
AgentAction 创建（填充 trigger, solution, result）
    ↓
追加写入 JSONL 文件
    ↓
返回响应给用户
```

### Step 3: Session Lifecycle

```
会话开始 → active 状态
    ↓
持续交互 → 持续追加记录
    ↓
会话结束 → 写入结束标记，准备压缩
```

---

## State Machine

### Session State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Session State Machine                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────┐                                     │
│                         │   created   │                                     │
│                         │  (已创建)   │                                     │
│                         └──────┬──────┘                                     │
│                                │                                            │
│                                │ 首次交互                                    │
│                                ▼                                            │
│                         ┌─────────────┐                                     │
│      ┌─────────────────▶│   active    │◀─────────────────┐                 │
│      │                  │  (活跃)     │                  │                 │
│      │                  └──────┬──────┘                  │                 │
│      │                         │                         │                 │
│      │    ┌────────────────────┼────────────────────┐    │                 │
│      │    │                    │                    │    │                 │
│      │    │ 5min 无交互        │ 用户关闭           │ 错误发生            │
│      │    ▼                    ▼                    ▼    │                 │
│      │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │                 │
│      │ │   idle      │  │  completed  │  │   error     │ │                 │
│      │ │  (空闲)     │  │  (完成)     │  │  (错误)     │ │                 │
│      │ └──────┬──────┘  └──────┬──────┘  └─────────────┘ │                 │
│      │        │                │                          │                 │
│      │        │ 新交互         │ 触发压缩                 │                 │
│      └────────┘                ▼                          │                 │
│                          ┌─────────────┐                  │                 │
│                          │  archived   │◀─────────────────┘                 │
│                          │  (已归档)   │                                    │
│                          └─────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Record State (Per Action)

```
Action 记录状态

created → 写入中 → 已写入 → (可选) 已反馈
    │         │
    │         └─▶ 写入失败 → 重试 → 成功/放弃
    │
    └─▶ 取消（用户中断）
```

---

## Acceptance Criteria (AC)

### Functional AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-7.1 | 每次用户消息都被记录为 AgentAction | 集成测试：发送消息，检查 JSONL |
| AC-7.2 | 每次工具调用都被记录为 AgentAction | 集成测试：调用工具，检查 JSONL |
| AC-7.3 | AgentAction 包含完整上下文信息 | 单元测试：验证字段完整性 |
| AC-7.4 | JSONL 文件格式正确（每行一个有效 JSON） | 单元测试：解析验证 |
| AC-7.5 | 会话文件按规范命名和存储 | 集成测试：检查路径格式 |
| AC-7.6 | 支持离线记录（断网时不丢失） | 集成测试：断网场景 |
| AC-7.7 | 记录延迟 < 100ms (p95) | 性能测试：测量延迟 |

### Error Handling AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-7.8 | 磁盘空间不足时提示用户 | 集成测试：模拟空间不足 |
| AC-7.9 | 写入失败自动重试 3 次 | 集成测试：模拟写入失败 |
| AC-7.10 | 重试失败后放入内存队列 | 集成测试：验证队列 |
| AC-7.11 | 超长内容自动截断并标记 | 单元测试：10KB+ 内容 |

---

## Boundary & Exception Cases

### Empty State

- **Scenario:** 新会话，无任何记录
- **Behavior:** 创建空 JSONL 文件，仅包含会话头

### High Frequency

- **Scenario:** 用户快速连续发送消息（< 1s 间隔）
- **Behavior:** 所有消息都被记录，按时间戳排序

### Large Content

- **Scenario:** 单条消息内容超过 10KB
- **Behavior:** 截断内容，设置 `truncated: true`，记录原始长度

### Concurrent Sessions

- **Scenario:** 多个智能体实例同时运行
- **Behavior:** 每个实例有独立的 session_id，互不干扰

### Crash Recovery

- **Scenario:** 智能体崩溃，会话未正常关闭
- **Behavior:** 重启后检测未关闭会话，尝试恢复或标记为异常

---

## Interface Contract

### Session File Header

```json
{
  "type": "session_header",
  "session_id": "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "created_at": "2026-02-23T10:00:00Z",
  "agent_id": "agent_0x8f3a2b4c5d6e7f8a",
  "workspace": "/path/to/workspace",
  "version": "1.0.0"
}
```

### AgentAction Record (JSONL line)

```json
{
  "id": "action_12345678-1234-5678-abcd-1234567890ab",
  "timestamp": "2026-02-23T10:01:23.456Z",
  "action_type": "message",
  "trigger": "User asked: How to fix the timeout error?",
  "solution": "I suggested checking the connection pool configuration...",
  "result": "success",
  "context": {
    "session_id": "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "parent_action_id": null,
    "workspace": "/path/to/workspace",
    "model": "claude-opus-4-6",
    "tools_used": ["read_file", "bash"]
  },
  "metadata": {
    "duration_ms": 1234,
    "tokens_used": 567,
    "confidence": 0.92
  }
}
```

### Session End Marker

```json
{
  "type": "session_end",
  "session_id": "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "ended_at": "2026-02-23T11:30:00Z",
  "total_actions": 45,
  "status": "completed"
}
```

### SDK API

```typescript
// SDK 初始化
const agent = new AEPClient({
  hubUrl: 'https://hub.aep.network',
  workspace: '/path/to/workspace'
});

// 会话自动创建和记录，无需手动调用
// SDK 内部自动处理：
// - 创建 session_id
// - 打开会话文件
// - 每次 interaction 后追加记录

// 获取当前会话信息
const session = agent.getCurrentSession();
// {
//   id: 'sess_...',
//   startedAt: Date,
//   actionCount: number,
//   status: 'active' | 'idle' | ...
// }

// 手动结束会话（可选，通常自动处理）
await agent.endSession();
```

---

## Technical Notes

### JSONL Format Choice

**为什么选择 JSONL 而不是 JSON Array？**
1. **流式追加**：无需读取整个文件，直接追加一行
2. **容错性**：单行损坏不影响其他记录
3. **大文件友好**：可以逐行处理，不需要一次性加载
4. **工具支持**：大量日志分析工具原生支持 JSONL

### Write Strategy

```python
# Pseudocode for async write with retry
class SessionRecorder:
    def __init__(self, session_path: str):
        self.session_path = session_path
        self.write_queue = asyncio.Queue()
        self.retry_count = 3

    async def record_action(self, action: AgentAction):
        """非阻塞记录"""
        await self.write_queue.put(action)
        # 立即返回，不阻塞调用方

    async def _write_worker(self):
        """后台写入协程"""
        while True:
            action = await self.write_queue.get()
            for attempt in range(self.retry_count):
                try:
                    await self._append_to_file(action)
                    break
                except IOError as e:
                    if attempt == self.retry_count - 1:
                        # 最终失败，放入内存备份队列
                        self._backup_to_memory(action)
                    await asyncio.sleep(0.1 * (attempt + 1))

    async def _append_to_file(self, action: AgentAction):
        """原子追加写入"""
        line = json.dumps(action.to_dict()) + '\n'
        async with aiofiles.open(self.session_path, 'a') as f:
            await f.write(line)
```

### File Rotation

```python
# 文件轮转策略
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_ACTIONS = 10000

def should_rotate(session_file: str) -> bool:
    if os.path.getsize(session_file) > MAX_FILE_SIZE:
        return True
    if count_lines(session_file) > MAX_ACTIONS:
        return True
    return False

def rotate_session(session_file: str):
    """轮转会话文件"""
    # 1. 写入结束标记
    append_end_marker(session_file)
    # 2. 压缩并移动到 archive
    compressed = gzip.compress(session_file)
    move_to_archive(compressed)
    # 3. 创建新会话文件
    create_new_session()
```

---

## Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| SDK Core (E-003) | Runtime | AEPClient 基础类 |
| File System | Infrastructure | 本地文件写入能力 |

---

## UI Evidence

**无 UI 交互**：此功能为后台自动记录，用户无感知。

**验证方式**：
- 检查 `.aep/sessions/` 目录下的 JSONL 文件
- 使用 `aep session list` CLI 命令查看会话列表
- 使用 `aep session show <session_id>` 查看会话详情

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-7.1] | 会话空闲超时时间设为多少？5min 合适？ | 产品 | 2026-02-28 |
| [OPEN-7.2] | 是否需要加密存储？ | 安全 | 2026-03-01 |
| [OPEN-7.3] | 崩溃恢复的具体策略？ | 开发 | 2026-03-02 |

---

## References

- **PRD:** `/docs/_project/prd-v1-session-memory.md`
- **AgentAction 格式:** STORY-008
- **OpenClaw 参考:** `<workspace>/memory/*.md` 模式

---

*Last Updated: 2026-02-23*
