# beads CLI 使用经验

> 最后更新：2026-02-21
> 来源：AEP 项目 vibedevteam-init 使用实践

## 环境配置

### beads 安装位置
```
D:\app\beads_0.55.4_windows_amd64\bd.exe
```

### PATH 设置（必须）
```bash
# 添加到 ~/.bashrc
export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"
```

---

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `bd init` | 初始化 beads 数据库 |
| `bd list` | 列出所有任务 |
| `bd show <id>` | 查看任务详情（用短ID） |
| `bd start <id>` | 开始任务 |
| `bd done <id>` | 完成任务 |
| `bd dep add <blocked> <blocker>` | 添加依赖 |
| `bd blocked` | 查看被阻塞的任务 |

---

## 关键注意事项

### 1. ID 格式
- 完整ID: `agent network-1o4` (含空格)
- 短ID: `1o4` (推荐使用)
- **查询时用短ID**，完整ID会因空格解析失败

### 2. 依赖设置
```bash
# ✓ 正确：逐个添加
bd dep add mxf c38
bd dep add mxf 3r0

# ✗ 错误：逗号分隔不支持
bd dep add mxf "c38,3r0"
```

### 3. jq 依赖
- `beads-auto-link.sh` 需要 jq 自动回填 beads ID
- 如未安装 jq，需手动运行 `update-task-beads-ids.sh`

---

## 项目信息

- 项目根目录: `D:\C_Projects\Agent\agent network`
- beads 数据库: `.beads/`
- 当前 Epic: `E-001-AEP-Protocol`
- 任务数: 18 个
