# TASK-E-004-FEEDBACK-002: 显式反馈收集

> 文档路径：`/docs/E-004-Session-Memory/task/TASK-E-004-FEEDBACK-002.md`
> 任务ID：TASK-E-004-FEEDBACK-002
> Beads 任务ID：`9ks`
> 任务标题：FeedbackCollector 显式反馈收集
> Epic：E-004 Session Memory
> Epic 目录：`E-004-Session-Memory`
> 状态（以 beads 为准）：DONE
> 负责人：dev
> 预估工期：4h
> 创建日期：2026-02-23
> 完成日期：2026-02-26

---

## 1. 任务目标

* **做什么**：实现 FeedbackCollector 的显式反馈收集功能
* **为什么做**：显式反馈是用户主动提供的，精度高

---

## 2. 关联关系

* 关联 Epic：E-004
* 关联 Story：STORY-009
* 上游依赖：
  - **硬依赖**：SESSION-003（ActionLogger），FEEDBACK-001
* 下游任务：FEEDBACK-003

---

## 3. 验收标准

- [x] AC1：FeedbackCollector 类实现完成
- [x] AC2：支持用户评分（1-5星）
- [x] AC3：支持文字备注
- [x] AC4：支持关联到 AgentAction
- [x] AC5：单元测试通过

---

## 4. 实施方案

### 4.1 最终实现（TypeScript）

**文件**: `src/aep/feedback/collector.ts`

```typescript
class FeedbackCollector {
  constructor(workspace: string, storageDir?: string)

  // 核心方法
  submitExplicit(options: SubmitExplicitFeedbackOptions): Feedback
  submit(actionId: string, rating: FeedbackRating, comment?: string, ...): Feedback
  getFeedback(actionId: string): Feedback | null
  getSessionFeedback(sessionId: string): Feedback[]
  getStats(sessionId: string): FeedbackStats
  deleteFeedback(feedbackId: string): boolean
  query(query: FeedbackQuery): FeedbackQueryResult
}
```

### 4.2 最终实现（Python）

**文件**: `aep-sdk/src/aep_sdk/feedback/collector.py`

```python
class FeedbackCollector:
    def __init__(self, workspace: str, storage_dir: str = "feedback")

    # 核心方法
    def submit_explicit(self, session_id: str, agent_id: str, rating: int, ...) -> Feedback
    def submit(self, action_id: str, rating: int, comment: Optional[str] = None, ...) -> Feedback
    def get_feedback(self, action_id: str) -> Optional[Feedback]
    def get_session_feedback(self, session_id: str) -> List[Feedback]
    def get_stats(self, session_id: str) -> FeedbackStats
    def delete_feedback(self, feedback_id: str) -> bool
```

### 4.3 数据存储

反馈数据存储在 `.aep/feedback/feedback.jsonl` 文件中，每行一个 JSON 记录：

```json
{"_type":"feedback","feedback":{"id":"fb_xxx","session_id":"...","agent_id":"...","action_id":"...","rating":5,"comment":"..."}}
```

---

## 5. 测试记录

### 5.1 TypeScript 测试

运行命令: `pnpm test -- --run src/aep/feedback/__tests__/collector.test.ts`

测试结果: **26 tests passed**

覆盖场景:
- 构造函数测试（目录创建）
- submitExplicit 完整/最小参数
- 无效评分验证（低于1、高于5、非整数）
- JSONL 持久化
- submit 便捷方法
- getFeedback 存在/不存在
- getSessionFeedback 多会话
- getStats 统计计算
- deleteFeedback 删除/不存在
- 跨实例持久化
- 损坏 JSONL 容错

### 5.2 Python 测试

运行命令: `python -m pytest tests/test_feedback_collector.py -v`

测试结果: **33 tests passed**

覆盖场景同 TypeScript 版本

---

## 6. 上线说明

### 6.1 新增文件

| 文件路径 | 说明 |
|----------|------|
| `src/aep/feedback/collector.ts` | TypeScript FeedbackCollector 实现 |
| `src/aep/feedback/__tests__/collector.test.ts` | TypeScript 单元测试 |
| `aep-sdk/src/aep_sdk/feedback/collector.py` | Python FeedbackCollector 实现 |
| `aep-sdk/tests/test_feedback_collector.py` | Python 单元测试 |

### 6.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `src/aep/feedback/index.ts` | 导出 FeedbackCollector 类 |
| `aep-sdk/src/aep_sdk/feedback/__init__.py` | 导出 FeedbackCollector 类 |

### 6.3 使用示例

```typescript
// TypeScript
import { FeedbackCollector } from 'aep/feedback';

const collector = new FeedbackCollector('/path/to/workspace');

// 提交评分
const feedback = collector.submitExplicit({
  session_id: 'session_123',
  agent_id: 'agent_001',
  action_id: 'action_456',
  rating: 5,
  comment: 'Excellent response!',
  user_id: 'user_789',
});

// 获取统计
const stats = collector.getStats('session_123');
console.log(`Average rating: ${stats.avg_rating}`);
```

```python
# Python
from aep_sdk.feedback import FeedbackCollector

collector = FeedbackCollector('/path/to/workspace')

# 提交评分
feedback = collector.submit_explicit(
    session_id='session_123',
    agent_id='agent_001',
    action_id='action_456',
    rating=5,
    comment='Excellent response!',
    user_id='user_789',
)

# 获取统计
stats = collector.get_stats('session_123')
print(f"Average rating: {stats.avg_rating}")
```

---

## 7. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-02-23 | AEP Protocol Team | 初版 |
| v1.1 | 2026-02-26 | dev | 实现完成，更新验收标准、测试记录、上线说明 |
