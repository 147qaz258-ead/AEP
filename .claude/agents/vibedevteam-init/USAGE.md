# Vibedevteam-init 使用经验

> 最后更新：2026-02-24

## 目的

vibedevteam-init 用于批量创建 beads 任务并关联 TASK 文档。

---

## 环境要求

### 1. 工具检查

```bash
# 确认 beads CLI 可用
which bd
bd --version

# 确认 jq 可用（可选，用于自动回填 beads ID）
which jq
```

### 2. PATH 配置

**问题**: beads 安装在自定义路径，默认不在系统 PATH 中

**解决方案**:
```bash
# 方法1: 临时设置（每次会话都需要）
export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"

# 方法2: 持久化到 ~/.bashrc 或 ~/.bash_profile
echo 'export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 3. 数据库初始化

```bash
cd "D:\C_Projects\Agent\agent network"

# 初始化 beads 数据库
bd init

# 输出示例:
# ✓ Initialized git repository
#   Repository ID: c783df8c
#   Database: .beads\dolt
# ✓ bd initialized successfully!
```

---

## 使用流程

### 步骤1: 确认 TASK 文件存在

```bash
ls "docs/E-001-AEP-Protocol/task"/*.md
# 应该看到 TASK-E-001-*.md 文件
```

### 步骤2: 运行初始化脚本

```bash
cd "D:\C_Projects\Agent\agent network"
export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"

.claude/agents/vibedevteam-init/beads-auto-link.sh "E-001" "docs/E-001-AEP-Protocol/task"
```

**参数说明**:
- 第1个参数: EPIC_ID（如 `E-001`）
- 第2个参数: TASK_DIR（如 `docs/E-001-AEP-Protocol/task`）

### 步骤3: 验证结果

```bash
# 列出所有创建的任务
bd list

# 查看某个任务的详情
bd show 1o4  # 使用短ID（3字符）
# 或
bd show agent network-1o4  # 可能失败，因ID含空格
```

---

## 遇到的问题与解决

### 问题1: bd 命令未找到

**错误信息**:
```
bd: command not found
# 或
Cannot find module '.../npm/node_modules/@beads/bd/bin/bd.js'
```

**原因**: beads 不在 PATH 中

**解决**:
```bash
export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"
```

---

### 问题2: jq 未安装

**错误信息**:
```
jq: command not found
```

**影响**: 无法自动回填 beads ID 到 TASK 文档

**解决方案1**: 安装 jq
```bash
# Windows (通过 scoop 或手动下载)
scoop install jq

# 或手动下载后添加到 PATH
```

**解决方案2**: 手动更新 TASK 文档
```bash
# 脚本会输出已创建的 beads ID
# 手动编辑 TASK 文档，填入 beads ID
```

---

### 问题3: 依赖添加失败（逗号分隔）

**错误信息**:
```
bd dep add mxf "c38,3r0"
Error: resolving dependency ID c38,3r0: no issue found matching
```

**原因**: beads CLI 不支持逗号分隔多个 ID

**解决**: 逐个添加依赖
```bash
bd dep add mxf c38    # FETCH-004 依赖 FETCH-002
bd dep add mxf 3r0   # FETCH-004 依赖 FETCH-003
```

---

### 问题4: beads ID 查询失败（空格问题）

**错误信息**:
```
bd show agent network-1o4
Error: no issue found matching "agent"
```

**原因**: beads ID 格式 `agent network-xxx` 包含空格

**解决**: 使用短 ID（3字符后缀）
```bash
bd show 1o4        # ✓ 成功
bd show 1o4,3r0    # 多个ID用逗号，无空格
```

---

## 常用命令

### 任务管理

```bash
# 列出所有任务
bd list

# 显示任务状态（● 进行中，○ 待处理）
bd list --status in_progress

# 查看任务详情
bd show <短ID>

# 开始任务
bd update <短ID> -s "doing"

# 完成任务（注意：bd done 不存在！）
bd update <短ID> -s "doing" && bd close <短ID>

# 查看可执行任务（无阻塞）
bd ready
```

**重要**：`bd done` 命令不存在，正确的是 `bd close`。

### 依赖管理

```bash
# 添加硬依赖
bd dep add <被阻塞任务> <阻塞源>

# 查看任务依赖
bd show <短ID> | grep blocked

# 列出被阻塞的任务
bd blocked
```

### 项目级操作

```bash
# 快速开始
bd quickstart

# 查看帮助
bd --help

# 查看特定命令帮助
bd dep --help
```

---

## 批量设置依赖脚本模式

### 模式1: 逐个添加（推荐）

```bash
# 优点：清晰，容易调试
# 缺点：需要多行命令
bd dep add c38 4ma
bd dep add mxf c38
bd dep add mxf 3r0
bd dep add lxo 4ma
```

### 模式2: 循环添加

```bash
# 创建依赖对数组
deps=(
    "c38:4ma"    # FETCH-002 depends on FETCH-001
    "mxf:c38,3r0"  # FETCH-004 depends on both
)

# 循环添加
for dep in "${deps[@]}"; do
    blocked="${dep%%:*}"
    blockers="${dep#*:}"
    for blocker in ${blocksers//,/ }; do
        bd dep add $blocked $blocker
    done
done
```

### 模式3: 配置文件方式

```bash
# 创建 deps.sh
cat > deps.sh <<'EOF'
#!/bin/bash
# AEP 依赖配置
bd dep add rsu 1o4      # REG-002 depends on REG-001
bd dep add c38 4ma       # FETCH-002 depends on FETCH-001
bd dep add mxf c38,3r0   # FETCH-004 depends on both
bd dep add lxo 4ma       # PUB-001 depends on FETCH-001
bd dep add elx lxo       # PUB-002 depends on PUB-001
# ... 更多依赖
EOF

# 执行
chmod +x deps.sh
./deps.sh
```

---

## TASK 文档命名规范

### 当前格式
```
TASK-E-001-REG-001.md
TASK-E-001-FETCH-001.md
```

### 推荐格式（更易解析）
```
TASK-{EPIC}-{GROUP}-{SEQ}.md
```

**示例**:
- `TASK-E-001-REG-001` - Agent Registration, Task 1
- `TASK-E-001-FETCH-001` - Experience Fetch, Task 1
- `TASK-E-001-PUB-003` - Experience Publish, Task 3

**GROUP 命名**:
- `REG` - Registration
- `FETCH` - Experience Fetch
- `PUB` - Publish
- `FB` - Feedback
- `GDI` - GDI System
- `SIG` - Signal System

---

## 脚本改进建议

### beads-auto-link.sh

```bash
#!/bin/bash

# 1. 自动检测 PATH
BEADS_PATHS=(
    "D:\app\beads_0.55.4_windows_amd64"
    "$HOME/.local/bin"
    "/usr/local/bin"
)

for p in "${BEADS_PATHS[@]}"; do
    [[ -x "$p/bd" ]] && export PATH="$p:$PATH" && break
done

# 2. 检查 jq 依赖
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq 未安装，无法自动回填 beads ID"
    echo "   请手动更新 TASK 文档或运行 update-task-beads-ids.sh"
    SKIP_JQ=true
fi

# 3. 使用短 ID 映射
# 从 TASK 文件名提取
```

### 自动依赖设置脚本

```bash
#!/bin/bash
# auto-deps.sh - 根据 TASK 文档自动设置依赖

TASK_DIR="docs/E-001-AEP-Protocol/task"

# 从 TASK 文档解析依赖
for task_file in "$TASK_DIR"/TASK-*.md; do
    # 提取 "依赖" 字段
    deps=$(grep "^> **依赖:" "$task_file" | sed 's/> \*\*依赖:\* //' | tr ',' '\n')

    task_id=$(basename "$task_file" .md | cut -d- -f2)
    beads_id=$(grep "Beads 任务ID" "$task_file" | sed 's/> \*\*Beads 任务ID:\* //' | cut -d' ' -f1)

    # 添加依赖
    for dep in $deps; do
        dep_beads_id=$(grep "^> **Beads 任务ID:.*$dep" "$TASK_DIR"/*.md | head -1 | sed 's/> \*\*Beads 任务ID:\* //' | cut -d' ' -f1)
        [[ -n "$dep_beads_id" ]] && bd dep add $beads_id $dep_beads_id
    done
done
```

---

## 验证清单

在运行 vibedevteam-init 前，确认：

- [ ] beads 已安装 (`bd --version` 返回版本）
- [ ] beads 已添加到 PATH（可运行 `bd --help`）
- [ ] 项目目录已初始化 (`ls .beads/` 存在）
- [ ] TASK 文档存在于指定目录
- [ ] jq 已安装（如需自动回填功能）

---

## dev agent 自动化模式

### 获取并执行任务

```bash
# 每次 bash 命令前需要设置 PATH
export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"

# 获取可执行任务
bd ready

# 获取第一个可执行任务的 ID
TASK_ID=$(bd ready | grep -oP 'agent network-\w+' | head -1)
echo "Task ID: $TASK_ID"

# 开始任务
bd update $TASK_ID -s "doing"

# 开发完成后关闭任务
bd update $TASK_ID -s "doing"
bd close $TASK_ID
```

### Git Commit 与 beads

```bash
# Git pre-commit hook 可能需要 beads
# 在 commit 前设置 PATH
export PATH="D:\app\beads_0.55.4_windows_amd64:$PATH"
git add .
git commit -m "feat(xxx): description"
```

### 批量任务状态检查

```bash
# 查看所有任务状态
bd list --all

# 查看已完成的任务
bd list --status closed

# 查看进行中的任务
bd list --status in_progress
```

---

## 故障排查

### bd init 失败

```bash
# 检查是否在 git 仓库中
git status

# 检查是否有 .beads 目录冲突
ls -la .beads 2>/dev/null && rm -rf .beads

# 重新初始化
bd init
```

### 任务未显示

```bash
# 检查 beads 数据库
bd list --all

# 检查任务过滤器
bd list --status open
bd list --priority P0

# 强制刷新
bd refresh 2>/dev/null || echo "无需刷新"
```

### 依赖设置后任务仍未阻塞

```bash
# 查看任务详情
bd show <短ID>

# 手动触发依赖检查
bd verify 2>/dev/null || echo "验证命令不存在"
```

---

## 相关链接

- beads CLI 文档: `bd --help`
- 项目文档: `docs/_project/`
- SKILL.md: `.claude/agents/vibedevteam-init/SKILL.md`
