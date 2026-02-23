# TASK-E-003-SDK-004: SDK Feedback Method

> Epic: E-003 SDK Core Implementation
> Story: SDK Client
> Priority: P0
> Status: TODO
> Beads 任务ID：待创建

---

## 任务描述

实现 SDK 的 `feedback()` 方法，用于向 Hub 提交经验使用结果。

## 验收标准

- [ ] `client.feedback(experience_id, outcome)` 方法实现
- [ ] 支持 success/failure outcome
- [ ] 支持 score 参数
- [ ] 返回更新后的 GDI 分数
- [ ] 错误处理
- [ ] 单元测试通过

## 接口定义

```python
from aep_sdk import AEPClient

client = AEPClient(hub_url="http://localhost:3000")

# 成功反馈
result = client.feedback(
    experience_id="exp_abc123",
    outcome="success",
    score=0.9
)

print(result.status)        # "recorded"
print(result.new_gdi_score) # 0.78

# 失败反馈
result = client.feedback(
    experience_id="exp_abc123",
    outcome="failure",
    context={"error": "Still failing after patch"}
)
```

## 实现指南

1. 创建 `aep-sdk/src/aep_sdk/feedback.py`
2. 调用 `POST /v1/feedback` 端点
3. 返回反馈结果

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `aep-sdk/src/aep_sdk/feedback.py` | CREATE | Feedback 实现 |
| `aep-sdk/src/aep_sdk/client.py` | MODIFY | 添加 feedback 方法 |

## 依赖

- TASK-E-003-SDK-001 (SDK Client Core)

## 预计工时

3h
