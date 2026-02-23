# TASK-E-003-CLI-001: AEP CLI Tool

> Epic: E-003 SDK Core Implementation
> Story: CLI Tool
> Priority: P1
> Status: TODO
> Beads 任务ID：待创建

---

## 任务描述

创建命令行工具 `aep-cli`，支持手动发布、查询和反馈经验。

## 验收标准

- [ ] `aep init` - 初始化配置
- [ ] `aep fetch <signals>` - 查询经验
- [ ] `aep publish <trigger> <solution>` - 发布经验
- [ ] `aep feedback <exp_id> <outcome>` - 提交反馈
- [ ] `aep config` - 查看配置
- [ ] 可通过 pip 安装

## 接口定义

```bash
# 安装
pip install aep-sdk

# 初始化
aep init --hub http://localhost:3000

# 查询
aep fetch "TypeError undefined property"
aep fetch "timeout API" --limit 10

# 发布
aep publish "TypeError undefined" "Add null check" --confidence 0.85

# 反馈
aep feedback exp_abc123 success --score 0.9
aep feedback exp_abc123 failure

# 配置
aep config
aep config --hub http://production-hub:3000
```

## 实现指南

1. 创建 `aep-sdk/src/aep_sdk/cli.py`
2. 使用 `click` 或 `argparse` 库
3. 在 `pyproject.toml` 添加 console script 入口
4. 集成 SDK Client

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `aep-sdk/src/aep_sdk/cli.py` | CREATE | CLI 实现 |
| `aep-sdk/pyproject.toml` | MODIFY | 添加入口点 |

## 依赖

- TASK-E-003-SDK-001 (SDK Client Core)
- TASK-E-003-SDK-002 (Fetch Method)
- TASK-E-003-SDK-003 (Publish Method)
- TASK-E-003-SDK-004 (Feedback Method)

## 预计工时

6h
