---
name: vibedevteam-init
description: 批量创建 beads 任务并关联 TASK 文档。当用户需要初始化 Epic 的 beads 任务时使用。
allowed-tools: "Bash(bd:*),Bash(.claude/skills/vibedevteam-init/beads-auto-link.sh),Read,Write,Grep,Glob"
version: 0.4.0
---

# VibeDevTeam: 批量初始化 beads 任务

当用户调用此 skill 时，执行以下步骤：

## 触发条件

用户说类似：
- "初始化 beads 任务"
- "创建 beads 任务"
- "批量创建任务"

## 前置条件检查

1. **确认 beads 已安装且在 PATH 中**
   ```bash
   bd --version
   # 如失败，设置 PATH:
   export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"
   ```

2. **确认 beads 数据库已初始化**
   ```bash
   ls .beads/
   # 如不存在，运行: bd init
   ```

## 执行步骤

1. **确认参数**
   - EPIC_ID（如：E-001）
   - TASK_DIR（如：docs/E-001-AEP-Protocol/task）

2. **验证 TASK 文件存在**
   ```bash
   ls "$TASK_DIR"/TASK-*.md
   ```

3. **执行脚本**
   ```bash
   .claude/agents/vibedevteam-init/beads-auto-link.sh "$EPIC_ID" "$TASK_DIR"
   ```

4. **验证结果**
   ```bash
   bd list
   ```

## 常见问题

### jq 未安装
脚本会提示警告，但任务仍会创建。需手动更新 TASK 文档中的 beads ID：
```bash
.claude/agents/vibedevteam-init/update-task-beads-ids.sh
```

### 依赖设置
依赖需逐个添加，不支持逗号分隔：
```bash
# 正确
bd dep add mxf c38
bd dep add mxf 3r0

# 错误（不支持）
bd dep add mxf "c38,3r0"
```

## 相关文档

详细使用经验见: `.claude/agents/vibedevteam-init/USAGE.md`
