#!/bin/bash

# Update TASK documents with beads IDs

TASK_DIR="docs/E-001-AEP-Protocol/task"

# Map of TASK file to beads ID
declare -A TASK_TO_BEADS=(
    ["TASK-E-001-REG-001"]="1o4"
    ["TASK-E-001-REG-002"]="rsu"
    ["TASK-E-001-FETCH-001"]="4ma"
    ["TASK-E-001-FETCH-002"]="c38"
    ["TASK-E-001-FETCH-003"]="3r0"
    ["TASK-E-001-FETCH-004"]="mxf"
    ["TASK-E-001-PUB-001"]="lxo"
    ["TASK-E-001-PUB-002"]="elx"
    ["TASK-E-001-PUB-003"]="wvy"
    ["TASK-E-001-FB-001"]="gr3"
    ["TASK-E-001-FB-002"]="9s7"
    ["TASK-E-001-FB-003"]="sdq"
    ["TASK-E-001-GDI-001"]="39c"
    ["TASK-E-001-GDI-002"]="fbl"
    ["TASK-E-001-GDI-003"]="w8c"
    ["TASK-E-001-SIG-001"]="u51"
    ["TASK-E-001-SIG-002"]="vvg"
    ["TASK-E-001-SIG-003"]="3jn"
)

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "📝 更新 TASK 文档中的 Beads 任务ID..."

for task in "${!TASK_TO_BEADS[@]}"; do
    beads_id="${TASK_TO_BEADS[$task]}"
    file="$TASK_DIR/${task}.md"

    if [ -f "$file" ]; then
        # Replace the placeholder with actual beads ID
        sed -i "s/> \*\*Beads 任务ID:\*\* (待 vibedevteam-init 填充)/> **Beads 任务ID:** agent network-${beads_id}/" "$file"
        echo "  ✓ 已更新 $task → agent network-${beads_id}"
    else
        echo "  ✗ 文件不存在: $file"
    fi
done

echo ""
echo "✅ 完成！"
echo ""
echo "📋 验证："
echo "   grep 'Beads 任务ID' $TASK_DIR/*.md | head -3"
