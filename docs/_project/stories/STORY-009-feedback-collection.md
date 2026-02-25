# STORY-009: 反馈收集机制（Feedback Collection）

> **EPIC_ID:** E-004
>
> **EPIC_DIR:** E-004-Session-Memory
>
> **PRD Reference:** `/docs/_project/prd-v1-session-memory.md#53-f3-反馈收集机制feedback-collection`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** SDK Feature + UX Integration

---

## User Story

**As an** Agent User,

**I want** to easily provide feedback on agent responses,

**So that** the system learns which solutions are helpful and which are not.

---

## Background & Motivation

### 问题

当前反馈机制存在断层：
1. 反馈与具体行动脱节，无法知道用户在评价哪个具体回答
2. 只有显式反馈（按钮），缺乏隐式反馈（行为推断）
3. 反馈没有被系统性记录和利用

### 价值

完善的反馈收集：
- 为 Experience 质量评估提供数据
- 帮助智能体学习用户偏好
- 支持 GDI 评分计算

### 反馈类型对比

| 类型 | 触发方式 | 准确度 | 覆盖率 | 示例 |
|------|----------|--------|--------|------|
| **显式反馈** | 用户主动 | 高 | 低 | 点击"有帮助"按钮 |
| **隐式反馈** | 系统推断 | 中 | 高 | 采纳建议、复制代码 |

---

## Main Path (Happy Path)

### Path 1: Explicit Feedback (显式反馈)

```
智能体回复完成
    ↓
UI 显示反馈按钮（👍/👎 或评分）
    ↓
用户点击按钮
    ↓
系统创建 Feedback 对象
    ↓
关联到对应的 AgentAction（通过 action_id）
    ↓
追加到 AgentAction.feedback 字段
    ↓
更新统计（可选：发送到 Hub）
```

### Path 2: Implicit Feedback (隐式反馈)

```
智能体提供解决方案
    ↓
系统监控用户行为
    ↓
检测到正向信号（采纳/复制/执行）
    或
    检测到负向信号（重新提问/忽略）
    ↓
系统推断反馈值
    ↓
创建 implicit Feedback 对象
    ↓
关联到对应的 AgentAction
```

---

## State Machine

### Feedback State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Feedback Collection Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AgentAction Created                                                       │
│         │                                                                   │
│         ▼                                                                   │
│   ┌─────────────┐                                                          │
│   │   pending   │  等待反馈                                                 │
│   │  (无反馈)   │                                                          │
│   └──────┬──────┘                                                          │
│          │                                                                  │
│    ┌─────┴─────┐                                                           │
│    │           │                                                           │
│    ▼           ▼                                                           │
│ ┌────────┐  ┌────────┐                                                    │
│ │explicit│  │implicit│                                                    │
│ │ (显式) │  │ (隐式) │                                                    │
│ └───┬────┘  └───┬────┘                                                    │
│     │           │                                                          │
│     └─────┬─────┘                                                          │
│           ▼                                                                │
│   ┌─────────────┐                                                          │
│   │   recorded  │  反馈已记录                                               │
│   │  (已记录)   │                                                          │
│   └─────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Feedback Inference Rules (隐式推断规则)

```
隐式反馈推断逻辑

正向信号（positive）:
┌─────────────────────────────────────────────────────────────────┐
│ 信号                  │ 权重  │ 推断值   │ 置信度              │
├───────────────────────┼───────┼──────────┼─────────────────────┤
│ 采纳建议并执行成功    │ 1.0   │ positive │ 0.9                 │
│ 复制代码片段          │ 0.8   │ positive │ 0.7                 │
│ 没有追问相同问题      │ 0.6   │ positive │ 0.5                 │
│ 继续深入相关话题      │ 0.5   │ positive │ 0.4                 │
└─────────────────────────────────────────────────────────────────┘

负向信号（negative）:
┌─────────────────────────────────────────────────────────────────┐
│ 信号                  │ 权重  │ 推断值   │ 置信度              │
├───────────────────────┼───────┼──────────┼─────────────────────┤
│ 重新提问相同问题      │ 1.0   │ negative │ 0.8                 │
│ 忽略建议使用其他方案  │ 0.8   │ negative │ 0.7                 │
│ 明确表示不满意        │ 1.0   │ negative │ 0.95                │
│ 快速切换话题          │ 0.4   │ negative │ 0.3                 │
└─────────────────────────────────────────────────────────────────┘

推断算法:
1. 收集时间窗口内（如 5 分钟）的所有信号
2. 加权计算正向和负向得分
3. 差值超过阈值则产生推断反馈
4. 正向得分 - 负向得分 > 0.5 → positive
5. 正向得分 - 负向得分 < -0.5 → negative
6. 否则 → neutral 或不产生反馈
```

---

## Acceptance Criteria (AC)

### Explicit Feedback AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-9.1 | 用户点击 👍 产生 positive 反馈 | E2E 测试：点击验证 |
| AC-9.2 | 用户点击 👎 产生 negative 反馈 | E2E 测试：点击验证 |
| AC-9.3 | 反馈关联到正确的 AgentAction | 集成测试：验证 action_id |
| AC-9.4 | 同一行动多次反馈，取最新值 | 集成测试：多次点击 |
| AC-9.5 | 反馈时间戳正确记录 | 单元测试：时间验证 |

### Implicit Feedback AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-9.6 | 采纳建议后产生 positive 推断 | 集成测试：执行建议 |
| AC-9.7 | 重新提问产生 negative 推断 | 集成测试：重复提问 |
| AC-9.8 | 推断置信度低于阈值不产生反馈 | 单元测试：边界条件 |
| AC-9.9 | 隐式反馈标记 type='implicit' | 集成测试：验证字段 |
| AC-9.10 | 显式反馈优先级高于隐式 | 集成测试：混合场景 |

### Recording AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-9.11 | 反馈追加到 AgentAction.feedback | 集成测试：文件验证 |
| AC-9.12 | 反馈不影响原 AgentAction 其他字段 | 集成测试：数据完整性 |
| AC-9.13 | 反馈延迟 < 200ms | 性能测试：测量延迟 |

---

## Boundary & Exception Cases

### No Feedback

- **Scenario:** 用户未提供任何反馈
- **Behavior:** AgentAction.feedback 字段不存在或为 null

### Conflicting Signals (冲突信号)

- **Scenario:** 显式反馈与隐式推断不一致
- **Behavior:** 显式反馈优先，忽略隐式推断

### Delayed Feedback

- **Scenario:** 用户在会话结束后才提供反馈
- **Behavior:** 通过 action_id 关联，支持跨会话反馈

### Multiple Actions

- **Scenario:** 用户一次性评价多个行动
- **Behavior:** 每个行动独立记录反馈

### Anonymous Feedback

- **Scenario:** 未登录用户提供反馈
- **Behavior:** 记录反馈但标记 source='anonymous'

---

## Interface Contract

### Feedback Object

```typescript
interface Feedback {
  /**
   * 反馈类型
   */
  type: 'explicit' | 'implicit';

  /**
   * 反馈值
   */
  value: 'positive' | 'negative' | 'neutral';

  /**
   * 反馈分数 (0-1)
   * 用于细粒度评价
   */
  score?: number;

  /**
   * 反馈来源
   * explicit: 'thumbs_up', 'thumbs_down', 'star_rating', 'text_input'
   * implicit: 'solution_adopted', 'code_copied', 'question_repeated'
   */
  source: string;

  /**
   * 反馈时间
   */
  timestamp: Date;

  /**
   * 推断置信度（仅 implicit）
   */
  confidence?: number;

  /**
   * 附加信息
   */
  details?: {
    rating?: number;          // 1-5 星评分
    comment?: string;         // 文字评论
    signals?: string[];       // 触发的隐式信号列表
  };
}
```

### SDK API

```typescript
// 显式反馈
await agent.feedback({
  action_id: 'action_12345678-...',
  type: 'explicit',
  value: 'positive',
  source: 'thumbs_up'
});

// 带评分的显式反馈
await agent.feedback({
  action_id: 'action_12345678-...',
  type: 'explicit',
  value: 'positive',
  score: 0.9,
  source: 'star_rating',
  details: {
    rating: 5,
    comment: '非常详细的解答！'
  }
});

// 查询某行动的反馈
const feedback = await agent.getFeedback('action_12345678-...');
// Feedback | null
```

### Event-based Implicit Feedback

```typescript
// SDK 内部监听用户行为
agent.onUserAction((event) => {
  // event.type: 'adopted' | 'copied' | 'repeated' | 'ignored'
  // event.action_id: 关联的 AgentAction ID

  if (event.type === 'adopted') {
    // 自动产生 positive 隐式反馈
    agent.recordImplicitFeedback({
      action_id: event.action_id,
      value: 'positive',
      source: 'solution_adopted',
      confidence: 0.9
    });
  }
});
```

---

## Technical Notes

### Feedback Storage

```python
# 反馈追加到 JSONL 的实现
class FeedbackCollector:
    def __init__(self, session_path: str):
        self.session_path = session_path
        self.action_index = self._build_action_index()

    def _build_action_index(self) -> Dict[str, int]:
        """构建 action_id -> 行号的索引"""
        index = {}
        with open(self.session_path, 'r') as f:
            for line_num, line in enumerate(f):
                data = json.loads(line)
                if data.get('id'):
                    index[data['id']] = line_num
        return index

    async def add_feedback(self, action_id: str, feedback: Feedback):
        """追加反馈到对应 AgentAction"""
        if action_id not in self.action_index:
            raise ActionNotFoundError(action_id)

        line_num = self.action_index[action_id]

        # 读取原行动
        async with aiofiles.open(self.session_path, 'r') as f:
            lines = await f.readlines()
            action = json.loads(lines[line_num])

        # 更新反馈
        action['feedback'] = feedback.to_dict()

        # 写回（对于大文件考虑更高效的更新策略）
        lines[line_num] = json.dumps(action) + '\n'
        async with aiofiles.open(self.session_path, 'w') as f:
            await f.writelines(lines)
```

### Implicit Inference Engine

```python
class ImplicitFeedbackInferrer:
    """隐式反馈推断引擎"""

    # 信号权重配置
    SIGNAL_WEIGHTS = {
        'solution_adopted': (1.0, 'positive'),
        'code_copied': (0.8, 'positive'),
        'no_followup': (0.6, 'positive'),
        'question_repeated': (1.0, 'negative'),
        'solution_ignored': (0.8, 'negative'),
        'topic_switched': (0.4, 'negative'),
    }

    # 推断阈值
    THRESHOLD = 0.5

    def infer(self, action_id: str, time_window: timedelta) -> Optional[Feedback]:
        """推断隐式反馈"""
        signals = self._collect_signals(action_id, time_window)

        positive_score = 0.0
        negative_score = 0.0

        for signal in signals:
            weight, value = self.SIGNAL_WEIGHTS.get(signal.type, (0, 'neutral'))
            if value == 'positive':
                positive_score += weight * signal.confidence
            elif value == 'negative':
                negative_score += weight * signal.confidence

        diff = positive_score - negative_score

        if diff > self.THRESHOLD:
            return Feedback(
                type='implicit',
                value='positive',
                source='inferred',
                confidence=min(diff, 1.0),
                details={'signals': [s.type for s in signals]}
            )
        elif diff < -self.THRESHOLD:
            return Feedback(
                type='implicit',
                value='negative',
                source='inferred',
                confidence=min(abs(diff), 1.0),
                details={'signals': [s.type for s in signals]}
            )

        return None  # 不确定，不产生反馈
```

---

## Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| STORY-007 | Upstream | AgentAction 记录，提供 action_id |
| STORY-008 | Upstream | AgentAction 格式定义 |
| AEP Hub (E-001) | Optional | 反馈同步到 Hub |

---

## UI Evidence

### Explicit Feedback UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent: 建议检查连接池配置...                                    │
│                                                                 │
│  [👍 有帮助] [👎 没帮助] [💬 评论]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

评分 UI:

┌─────────────────────────────────────────────────────────────────┐
│  请评价这次回答：                                                │
│                                                                 │
│  ⭐ ⭐ ⭐ ⭐ ⭐                                                   │
│                                                                 │
│  [可选] 添加评论：                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [提交]                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Implicit Feedback Detection

```
检测场景:

1. 采纳建议:
   Agent: 建议运行 `npm install`
   User: 运行 `npm install` ✓
   → 检测: solution_adopted

2. 复制代码:
   Agent: 这是修复代码...
   User: [复制]
   → 检测: code_copied

3. 重新提问:
   Agent: 建议检查配置...
   User: 还是超时，怎么办？
   → 检测: question_repeated
```

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-9.1] | 隐式反馈推断阈值设为多少合适？ | 产品 | 2026-02-28 |
| [OPEN-9.2] | 是否需要用户手动开启隐式反馈？ | 产品/隐私 | 2026-03-01 |
| [OPEN-9.3] | 反馈是否需要同步到 Hub？ | 产品 | 2026-03-02 |
| [OPEN-9.4] | 匿名反馈如何处理？ | 产品 | 2026-03-02 |

---

## References

- **PRD:** `/docs/_project/prd-v1-session-memory.md#53`
- **STORY-004:** `/docs/_project/stories/STORY-004-feedback-loop.md`（Hub 层反馈）
- **Experience Feedback:** biz-overview §13 GEP 机制

---

*Last Updated: 2026-02-23*
