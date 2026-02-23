# TASK-E-003-SDK-003: SDK Publish Method

> Epic: E-003 SDK Core Implementation
> Story: SDK Client
> Priority: P0
> Status: TODO
> Beads 任务ID：待创建

---

## 任务描述

实现 SDK 的 `publish()` 方法，用于向 Hub 发布新经验。

## 验收标准

- [ ] `client.publish(trigger, solution)` 方法实现
- [ ] 支持 Gene + Capsule 格式
- [ ] 返回 experience_id
- [ ] 支持 confidence 参数
- [ ] 错误处理
- [ ] 单元测试通过

## 接口定义

```python
from aep_sdk import AEPClient

client = AEPClient(hub_url="http://localhost:3000")

# 基础用法
result = client.publish(
    trigger="TypeError: Cannot read property 'x' of undefined",
    solution="Add null check before accessing property",
    confidence=0.85
)

print(result.experience_id)  # "exp_..."
print(result.status)         # "candidate"
```

## 实现指南

1. 创建 `aep-sdk/src/aep_sdk/publish.py`
2. 构建 Gene + Capsule 结构
3. 调用 `POST /v1/publish` 端点
4. 返回发布结果

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `aep-sdk/src/aep_sdk/publish.py` | CREATE | Publish 实现 |
| `aep-sdk/src/aep_sdk/client.py` | MODIFY | 添加 publish 方法 |

## 依赖

- TASK-E-003-SDK-001 (SDK Client Core)

## 预计工时

4h
