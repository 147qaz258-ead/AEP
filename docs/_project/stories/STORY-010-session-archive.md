# STORY-010: 会话压缩与归档（Session Compression & Archive）

> **EPIC_ID:** E-004
>
> **EPIC_DIR:** E-004-Session-Memory
>
> **PRD Reference:** `/docs/_project/prd-v1-session-memory.md#54-f4-会话压缩与归档session-compression--archive`
>
> **Status:** Draft
>
> **Priority:** P1 - Important
>
> **Story Type:** SDK Background Feature

---

## User Story

**As an** Agent System,

**I want** to compress and archive session records periodically,

**So that** storage is managed efficiently and key information is preserved for long-term reference.

---

## Background & Motivation

### 问题

随着使用时间增长，会话记录会不断膨胀：
1. 磁盘空间占用越来越大
2. 详细记录难以快速回顾
3. 长期有价值的信息被淹没在细节中

### 价值

压缩与归档机制：
1. **存储优化**：减少磁盘占用，保持系统轻量
2. **信息提炼**：提取关键信息，便于回顾和学习
3. **长期保存**：重要记忆可长期保留，原始数据可归档

### 参考：OpenClaw 模式

OpenClaw 在 `/new` 时将当前会话压缩保存到 `<workspace>/memory/*.md`：
- 保留关键决策和结果
- 丢弃冗余细节
- 生成人类可读的摘要

---

## Main Path (Happy Path)

### Step 1: Trigger Detection

压缩触发条件检测：
1. **会话结束**：用户关闭会话或超时
2. **大小阈值**：会话记录超过 N 条行动（如 100 条）
3. **手动触发**：用户或系统主动请求压缩

### Step 2: Compression

```
原始会话 (100+ AgentAction)
    ↓
分析阶段:
  - 识别用户意图
  - 提取主要问题
  - 归类成功/失败尝试
  - 汇总反馈信息
    ↓
生成摘要:
  - 用户意图 (1-2 句)
  - 主要问题列表
  - 成功的解决方案
  - 失败尝试与教训
  - 资源消耗统计
    ↓
写入 memory/ 目录
```

### Step 3: Archive

```
原始 JSONL 文件
    ↓
压缩 (gzip)
    ↓
移动到 archive/ 目录
    ↓
更新索引（可选）
```

---

## State Machine

### Session Lifecycle with Archive

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Session Compression & Archive Flow                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐                                                          │
│   │   active    │  会话进行中                                               │
│   │  (活跃)     │                                                          │
│   └──────┬──────┘                                                          │
│          │                                                                  │
│          │ 触发条件:                                                        │
│          │ - 会话结束                                                       │
│          │ - 超过 100 条行动                                                │
│          │ - 手动触发                                                       │
│          ▼                                                                  │
│   ┌─────────────┐                                                          │
│   │ compressing │  压缩中                                                   │
│   │  (压缩中)   │                                                          │
│   └──────┬──────┘                                                          │
│          │                                                                  │
│          ├──────────────────────┐                                          │
│          │                      │                                          │
│          ▼                      ▼                                          │
│   ┌─────────────┐        ┌─────────────┐                                  │
│   │   summary   │        │   archive   │                                  │
│   │  (生成摘要) │        │  (归档原始)  │                                  │
│   └──────┬──────┘        └──────┬──────┘                                  │
│          │                      │                                          │
│          ▼                      ▼                                          │
│   ┌─────────────┐        ┌─────────────┐                                  │
│   │ memory/     │        │ archive/    │                                  │
│   │ *.md        │        │ *.jsonl.gz  │                                  │
│   └─────────────┘        └─────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Compression Strategy

```
信息保留策略

必须保留:
┌─────────────────────────────────────────────────────────────────┐
│ 信息类型          │ 保留方式           │ 优先级               │
├───────────────────┼────────────────────┼──────────────────────┤
│ 用户核心意图      │ 摘要描述           │ P0                   │
│ 成功的解决方案    │ 完整保留 + 标记    │ P0                   │
│ 关键决策点        │ 决策 + 原因        │ P0                   │
│ 显式反馈          │ 数值 + 来源        │ P1                   │
│ 失败尝试          │ 简要 + 教训        │ P1                   │
│ 资源消耗          │ 统计数值           │ P2                   │
└─────────────────────────────────────────────────────────────────┘

可压缩:
- 详细的工具调用参数
- 中间的调试过程
- 重复的尝试
- 未产生反馈的一般性对话
```

---

## Acceptance Criteria (AC)

### Compression AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-10.1 | 会话结束时自动触发压缩 | 集成测试：关闭会话 |
| AC-10.2 | 超过 100 条行动时触发压缩 | 集成测试：大文件 |
| AC-10.3 | 摘要包含用户意图 | 单元测试：验证字段 |
| AC-10.4 | 摘要包含成功解决方案 | 单元测试：验证字段 |
| AC-10.5 | 压缩比 >= 70%（体积减少） | 性能测试：文件大小 |
| AC-10.6 | 摘要文件人类可读 | 人工验证：MD 格式 |

### Archive AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-10.7 | 原始文件 gzip 压缩后移动到 archive/ | 集成测试：文件检查 |
| AC-10.8 | 归档文件命名包含时间戳 | 单元测试：命名规范 |
| AC-10.9 | 归档后可解压恢复 | 集成测试：解压验证 |
| AC-10.10 | 30 天前的归档自动清理（可配置） | 集成测试：时间模拟 |

### Quality AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-10.11 | 压缩不影响正在进行的会话 | 集成测试：并发场景 |
| AC-10.12 | 压缩失败不丢失数据 | 集成测试：故障注入 |
| AC-10.13 | 1000 条行动压缩时间 < 5s | 性能测试：测量时间 |

---

## Boundary & Exception Cases

### Empty Session

- **Scenario:** 会话无任何行动记录
- **Behavior:** 不生成摘要，直接删除空文件

### Small Session

- **Scenario:** 会话只有少量记录（< 10 条）
- **Behavior:** 可选择不压缩，或生成简化摘要

### Failed Compression

- **Scenario:** 压缩过程中出错
- **Behavior:** 保留原始文件，记录错误日志，下次重试

### Concurrent Access

- **Scenario:** 压缩时用户继续交互
- **Behavior:** 新记录写入新会话文件，不中断

### Disk Full

- **Scenario:** 归档时磁盘空间不足
- **Behavior:** 保留摘要，原始文件不删除，提示用户

---

## Interface Contract

### Summary File Format (Markdown)

```markdown
# Session Summary: 2026-02-23

> Session ID: sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890
> Duration: 45 minutes
> Actions: 87
> Status: completed

## User Intent

用户尝试解决数据库连接超时问题，需要优化连接池配置。

## Problems Encountered

1. **连接池耗尽** (success)
   - Trigger: `Error: Connection pool exhausted`
   - Solution: 增加 max_connections 从 10 到 50
   - Result: 问题解决

2. **超时配置不当** (partial)
   - Trigger: 部分请求仍然超时
   - Solution: 调整 connectionTimeoutMillis
   - Result: 改善但未完全解决

## Key Decisions

1. 选择增加连接池而非增加超时（原因：治本而非治标）

## Feedback Summary

- Explicit: 3 positive, 0 negative
- Implicit: 5 adopted solutions
- Overall Score: 0.85

## Resource Usage

- Total Duration: 45 min
- Tokens Used: 12,345
- Tools Called: read_file(5), bash(3), write_file(2)

## Lessons Learned

1. 连接池配置应根据并发量动态调整
2. 超时设置需要考虑网络延迟

---
*Generated: 2026-02-23T11:30:00Z*
*Compressed by AEP SDK v1.0.0*
```

### Archive File Naming

```
archive/
├── 2026-02/
│   ├── sess_20260223_101000_a1b2c3d4.jsonl.gz
│   ├── sess_20260223_143022_e5f6g7h8.jsonl.gz
│   └── ...
├── 2026-03/
│   └── ...
```

### SDK API

```typescript
// 手动触发压缩
const result = await agent.compressSession({
  sessionId: 'sess_...',
  options: {
    keepOriginal: false,     // 是否保留原始文件
    includeDetails: true,    // 摘要是否包含细节
    customTemplate: null     // 自定义摘要模板
  }
});

// result:
// {
//   summaryPath: '.aep/memory/sess_..._summary.md',
//   archivePath: '.aep/sessions/archive/.../sess_....jsonl.gz',
//   originalSize: 102400,
//   compressedSize: 30720,
//   compressionRatio: 0.70
// }

// 查询历史摘要
const summaries = await agent.listSummaries({
  startDate: '2026-02-01',
  endDate: '2026-02-28',
  limit: 10
});

// 读取特定摘要
const summary = await agent.getSummary('sess_...');
```

---

## Technical Notes

### Compression Algorithm

```python
class SessionCompressor:
    """会话压缩器"""

    def compress(self, session_path: str) -> CompressionResult:
        """压缩会话，生成摘要并归档"""

        # 1. 读取所有行动
        actions = self._read_actions(session_path)

        # 2. 分析并提取关键信息
        analysis = self._analyze_session(actions)

        # 3. 生成摘要
        summary = self._generate_summary(analysis)

        # 4. 写入摘要文件
        summary_path = self._write_summary(summary)

        # 5. 压缩并归档原始文件
        archive_path = self._archive_original(session_path)

        return CompressionResult(
            summary_path=summary_path,
            archive_path=archive_path,
            original_size=os.path.getsize(session_path),
            compressed_size=os.path.getsize(archive_path)
        )

    def _analyze_session(self, actions: List[AgentAction]) -> SessionAnalysis:
        """分析会话，提取关键信息"""

        return SessionAnalysis(
            # 用户意图：找第一个 message 类型的 trigger
            user_intent=self._extract_user_intent(actions),

            # 问题列表：result != success 或 feedback.negative
            problems=self._extract_problems(actions),

            # 成功方案：result == success 且有 positive feedback
            successful_solutions=self._extract_successes(actions),

            # 决策点：action_type == decision
            decisions=self._extract_decisions(actions),

            # 反馈汇总
            feedback_summary=self._summarize_feedback(actions),

            # 资源统计
            resource_usage=self._calculate_resources(actions),

            # 经验教训：从失败中提取
            lessons_learned=self._extract_lessons(actions)
        )

    def _generate_summary(self, analysis: SessionAnalysis) -> str:
        """生成 Markdown 摘要"""
        template = self._load_template()
        return template.render(analysis)

    def _archive_original(self, session_path: str) -> str:
        """压缩并归档原始文件"""

        # 确定归档路径
        archive_dir = self._get_archive_dir(session_path)
        archive_path = os.path.join(
            archive_dir,
            os.path.basename(session_path) + '.gz'
        )

        # gzip 压缩
        with open(session_path, 'rb') as f_in:
            with gzip.open(archive_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        # 删除原始文件（可选）
        if not self.config.keep_original:
            os.remove(session_path)

        return archive_path
```

### Auto-cleanup Policy

```python
class ArchiveManager:
    """归档管理器"""

    DEFAULT_RETENTION_DAYS = 30

    def cleanup_old_archives(self, days: int = None):
        """清理过期归档"""
        days = days or self.DEFAULT_RETENTION_DAYS
        cutoff = datetime.now() - timedelta(days=days)

        for archive_file in self._list_archives():
            if self._get_archive_date(archive_file) < cutoff:
                self._delete_archive(archive_file)
                logger.info(f"Deleted old archive: {archive_file}")
```

### Summary Template

```markdown
# Session Summary: {{ date }}

> Session ID: {{ session_id }}
> Duration: {{ duration }}
> Actions: {{ action_count }}
> Status: {{ status }}

## User Intent

{{ user_intent }}

## Problems Encountered

{% for problem in problems %}
{{ loop.index }}. **{{ problem.title }}** ({{ problem.result }})
   - Trigger: `{{ problem.trigger }}`
   - Solution: {{ problem.solution }}
   - Result: {{ problem.result_detail }}
{% endfor %}

## Key Decisions

{% for decision in decisions %}
{{ loop.index }}. {{ decision.summary }}（原因：{{ decision.reason }}）
{% endfor %}

## Feedback Summary

- Explicit: {{ feedback.explicit_pos }} positive, {{ feedback.explicit_neg }} negative
- Implicit: {{ feedback.implicit_adopted }} adopted solutions
- Overall Score: {{ feedback.overall_score }}

## Resource Usage

- Total Duration: {{ resources.duration }}
- Tokens Used: {{ resources.tokens }}
- Tools Called: {{ resources.tools | join(', ') }}

{% if lessons_learned %}
## Lessons Learned

{% for lesson in lessons_learned %}
{{ loop.index }}. {{ lesson }}
{% endfor %}
{% endif %}

---
*Generated: {{ generated_at }}*
*Compressed by AEP SDK {{ version }}*
```

---

## Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| STORY-007 | Upstream | Session Recording 提供原始数据 |
| STORY-008 | Upstream | AgentAction 格式用于解析 |
| STORY-009 | Upstream | Feedback 用于摘要统计 |

---

## UI Evidence

### CLI Commands

```bash
# 查看会话列表
$ aep session list

ID                                    Started             Actions  Status
---------------------------------------------------------------------------
sess_a1b2c3d4-e5f6-7890-abcd-ef...   2026-02-23 10:00    87       archived
sess_b2c3d4e5-f6a7-8901-bcde-f1...   2026-02-23 14:30    45       active

# 查看摘要
$ aep session summary sess_a1b2c3d4

# Session Summary: 2026-02-23
#
# User Intent: 用户尝试解决数据库连接超时问题...
# ...

# 手动触发压缩
$ aep session compress sess_a1b2c3d4
Compressed: 102KB → 30KB (70% reduction)
Summary: .aep/memory/sess_..._summary.md
Archive: .aep/sessions/archive/2026-02/sess_...jsonl.gz

# 恢复归档（用于审计）
$ aep session restore sess_a1b2c3d4
Restored to: .aep/sessions/sess_..._restored.jsonl
```

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-10.1] | 压缩触发阈值（行动数）设为多少合适？ | 产品 | 2026-02-28 |
| [OPEN-10.2] | 摘要模板是否支持用户自定义？ | 产品 | 2026-03-01 |
| [OPEN-10.3] | 归档保留时间默认多少天？ | 产品 | 2026-02-28 |
| [OPEN-10.4] | 是否需要支持云端备份？ | 产品 | 2026-03-05 |

---

## References

- **PRD:** `/docs/_project/prd-v1-session-memory.md#54`
- **OpenClaw Memory:** `<workspace>/memory/*.md` 模式
- **Storage Spec:** `/docs/_project/prd-v1-session-memory.md#55`

---

*Last Updated: 2026-02-23*
