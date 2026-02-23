# TASK-E-003-SDK-001: SDK Client Core

> Epic: E-003 SDK Core Implementation
> Story: SDK Client
> Priority: P0
> Status: DOING
> Beads 任务ID：待创建

---

## 任务描述

实现 Python SDK 的核心客户端框架，包括：
- Hub 连接管理
- 身份自动管理
- 请求封装
- 错误处理

## 验收标准

- [x] `AEPClient` 类实现完成
- [x] 支持自动身份注册和持久化
- [x] 支持配置 hub_url
- [x] 基础请求/响应处理
- [ ] 单元测试通过

## 接口定义

```python
from aep_sdk import AEPClient

# 初始化
client = AEPClient(hub_url="http://localhost:3000")

# 自动获取/创建 agent_id
agent_id = client.agent_id  # "agent_0x..."

# 检查是否已注册
is_registered = client.is_registered

# 显式注册（如果需要）
client.register(name="My Agent", capabilities=["code_generation"])
```

## 实现说明

### 文件结构

```
aep-sdk/src/aep_sdk/
  client.py      # 新建 - AEPClient 核心实现
  __init__.py    # 修改 - 导出 AEPClient 和异常类
  identity.py    # 已有 - AgentIdentityStore
```

### 核心实现

#### 1. AEPClient 类 (`client.py`)

**属性**:
- `hub_url`: Hub 服务地址
- `agent_id`: 自动加载/生成的 agent ID
- `is_registered`: 是否已在 Hub 注册

**方法**:
- `register(name, capabilities, metadata)`: 向 Hub 注册 agent
- `send_signal(signal_type, payload)`: 发送信号
- `send_feedback(...)`: 发送反馈
- `close()`: 关闭连接

**异常类**:
- `AEPError`: 基础异常
- `AEPConnectionError`: 连接错误
- `AEPRegistrationError`: 注册错误

#### 2. 身份自动管理

优先级:
1. `AEP_AGENT_ID` 环境变量
2. 本地存储 (AgentIdentityStore)
3. 调用 `register()` 生成新 ID

#### 3. HTTP 客户端

- 使用 `requests` 库
- 内置重试机制 (3 次重试，指数退避)
- 30 秒默认超时
- Session 复用

#### 4. 依赖更新

`pyproject.toml` 新增:
```toml
dependencies = [
    "requests>=2.28.0",
]
```

### 验证结果

```bash
$ python -c "from aep_sdk import AEPClient; print('OK')"
OK

# 接口测试
- [PASS] Initialization works
- [PASS] agent_id raises RuntimeError when not available
- [PASS] register raises AEPRegistrationError for Hub errors
- [PASS] Context manager works
- [PASS] All exports available
```

## 实现指南

1. 创建 `aep-sdk/src/aep_sdk/client.py`
2. 实现 `AEPClient` 类
3. 集成 `AgentIdentityStore`
4. 添加 HTTP 客户端 (requests/aiohttp)

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `aep-sdk/src/aep_sdk/client.py` | CREATE | 客户端核心 (已完成) |
| `aep-sdk/src/aep_sdk/__init__.py` | MODIFY | 导出 AEPClient (已完成) |
| `aep-sdk/pyproject.toml` | MODIFY | 添加 requests 依赖 (已完成) |

## 依赖

- 无硬依赖（可立即开始）

## 预计工时

4h

## 实际工时

2h

## 测试记录

### 接口验证

- [x] `AEPClient` 可正常导入
- [x] `hub_url` 属性正常工作
- [x] `agent_id` 属性正确抛出异常（无存储时）
- [x] `register()` 方法正确处理 Hub 错误
- [x] 上下文管理器正常工作
- [x] 所有异常类可正常导入

### 待完成

- [ ] 单元测试编写 (需要模拟 Hub 响应)
- [ ] 集成测试（连接真实 Hub）
