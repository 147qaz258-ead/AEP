# TASK-E-003-SDK-002: SDK Fetch Method

> Epic: E-003 SDK Core Implementation
> Story: SDK Client
> Priority: P0
> Status: TODO
> Beads 任务ID：待创建

---

## 任务描述

实现 SDK 的 `fetch()` 方法，用于从 Hub 获取匹配的经验。

## 验收标准

- [ ] `client.fetch(signals)` 方法实现
- [ ] 支持信号数组输入
- [ ] 返回 Experience 列表
- [ ] 支持分页 (limit, offset)
- [ ] 错误处理
- [ ] 单元测试通过

## 接口定义

```python
from aep_sdk import AEPClient

client = AEPClient(hub_url="http://localhost:3000")

# 基础用法
experiences = client.fetch(signals=["TypeError", "undefined property"])

# 带分页
experiences = client.fetch(
    signals=["timeout", "API"],
    limit=10,
    offset=0
)

# 返回结构
for exp in experiences:
    print(exp.id)          # "exp_..."
    print(exp.trigger)     # "TypeError..."
    print(exp.solution)    # "Add null check..."
    print(exp.confidence)  # 0.85
    print(exp.gdi_score)   # 0.72
```

## 实现指南

1. 创建 `aep-sdk/src/aep_sdk/fetch.py`
2. 实现 `FetchResponse` 和 `Experience` 数据类
3. 调用 `POST /v1/fetch` 端点
4. 解析响应并返回对象列表

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `aep-sdk/src/aep_sdk/fetch.py` | CREATE | Fetch 实现 |
| `aep-sdk/src/aep_sdk/models.py` | CREATE | 数据模型 |
| `aep-sdk/src/aep_sdk/client.py` | MODIFY | 添加 fetch 方法 |

## 依赖

- TASK-E-003-SDK-001 (SDK Client Core)

## 预计工时

4h
