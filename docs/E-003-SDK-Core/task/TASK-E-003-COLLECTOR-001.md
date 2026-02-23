# TASK-E-003-COLLECTOR-001: Log Collector

> Epic: E-003 SDK Core Implementation
> Story: Data Collection
> Priority: P1
> Status: TODO
> Beads 任务ID：待创建

---

## 任务描述

实现日志文件采集器，能够从日志文件中提取错误并自动发布为经验。

## 验收标准

- [ ] 支持监听日志文件
- [ ] 自动解析 ERROR/WARN 行
- [ ] 提取错误签名
- [ ] 可配置发布策略
- [ ] 支持批量处理

## 接口定义

```python
from aep_sdk.collectors import LogCollector

# 创建采集器
collector = LogCollector(
    hub_url="http://localhost:3000",
    auto_publish=True  # 自动发布发现的经验
)

# 监听单个文件
collector.watch("/var/log/app.log")

# 监听目录
collector.watch_dir("/var/log/", pattern="*.log")

# 一次性处理
collector.process_file("/var/log/errors.log")

# 设置回调
collector.on_error(lambda entry: print(f"Found: {entry}"))
```

## CLI 使用

```bash
# 监听并自动发布
aep collect --source log --path /var/log/app.log --auto-publish

# 处理历史日志
aep collect --source log --path /var/log/history.log --dry-run
```

## 实现指南

1. 创建 `aep-sdk/src/aep_sdk/collectors/log.py`
2. 实现文件监听 (watchdog 库)
3. 集成 SignalExtractor 提取信号
4. 调用 SDK Client 发布

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `aep-sdk/src/aep_sdk/collectors/__init__.py` | CREATE | 采集器模块 |
| `aep-sdk/src/aep_sdk/collectors/log.py` | CREATE | 日志采集器 |

## 依赖

- TASK-E-003-SDK-001 (SDK Client Core)
- TASK-E-003-SDK-003 (Publish Method)

## 预计工时

6h
