"""
AEP SDK 功能演示示例

展示如何使用 AEP SDK 记录会话、行动、反馈并归档。
"""

import tempfile
from pathlib import Path

from aep_sdk.session import SessionRecorder, ActionLogger
from aep_sdk.feedback import FeedbackCollector, ActionOutcome
from aep_sdk.archive import MemoryArchiver, PendingQueueManager


def demo_full_workflow():
    """演示完整的 AEP 工作流程"""

    # 创建临时工作目录
    with tempfile.TemporaryDirectory() as workspace:
        print(f"工作目录: {workspace}")
        print("=" * 60)

        # 1. 初始化组件
        print("\n[1] 初始化组件...")
        recorder = SessionRecorder(workspace, agent_id="demo-agent")
        logger = ActionLogger(recorder)
        feedback = FeedbackCollector(workspace)
        archiver = MemoryArchiver(workspace)

        # 2. 开始会话
        print("\n[2] 开始会话...")
        session = recorder.start_session(summary="演示 AEP SDK 功能")
        print(f"   会话 ID: {session.id}")

        # 3. 记录行动
        print("\n[3] 记录行动...")

        # 记录工具调用
        action1 = logger.log_tool_call(
            trigger="用户请求：修复 TypeScript 错误",
            solution="检查 tsconfig.json，发现缺少 strict 模式配置",
            result="success",
            context={
                "tool_name": "Read",
                "file_path": "tsconfig.json",
            }
        )
        print(f"   行动 1 (tool_call): {action1.id[:8]}...")

        # 记录决策
        action2 = logger.log_decision(
            trigger="选择配置方案",
            solution="启用 strict 模式 + 添加缺失的类型定义",
            result="success",
            context={
                "alternatives": ["只添加类型定义", "完全重写配置"],
                "reason": "strict 模式可以避免未来错误"
            }
        )
        print(f"   行动 2 (decision): {action2.id[:8]}...")

        # 记录消息
        action3 = logger.log_message(
            trigger="用户追问：为什么这样配置？",
            solution="解释 strict 模式的优点和类型安全的重要性",
            result="success"
        )
        print(f"   行动 3 (message): {action3.id[:8]}...")

        # 4. 收集反馈
        print("\n[4] 收集反馈...")

        # 显式反馈
        explicit_fb = feedback.submit_explicit(
            session_id=session.id,
            agent_id="demo-agent",
            action_id=action1.id,
            rating=5,
            comment="快速定位问题，非常满意！"
        )
        print(f"   显式反馈: rating={explicit_fb.rating}, comment={explicit_fb.comment}")

        # 隐式反馈 - 用户采纳
        implicit_fb = feedback.infer_from_acceptance(
            session_id=session.id,
            agent_id="demo-agent",
            action_id=action2.id
        )
        print(f"   隐式反馈: outcome={implicit_fb.outcome.value}, evidence={implicit_fb.evidence}")

        # 隐式反馈 - 用户复制
        copy_fb = feedback.infer_from_copy(
            session_id=session.id,
            agent_id="demo-agent",
            action_id=action3.id
        )
        print(f"   隐式反馈: outcome={copy_fb.outcome.value}, evidence={copy_fb.evidence}")

        # 5. 查看统计
        print("\n[5] 会话统计...")
        stats = feedback.get_stats(session.id)
        print(f"   总反馈数: {stats.total_feedback}")
        print(f"   显式反馈: {stats.explicit_count}")
        print(f"   隐式反馈: {stats.implicit_count}")
        if stats.avg_rating:
            print(f"   平均评分: {stats.avg_rating:.2f}/5")

        # 6. 结束会话
        print("\n[6] 结束会话...")
        recorder.end_session(summary="成功演示 AEP SDK 功能")
        print(f"   会话已结束，共 {len(recorder.get_session().actions)} 个行动")

        # 7. 归档
        print("\n[7] 归档会话...")
        archive_path = archiver.archiveSession(session.id, {
            "compress": True,
            "delete_original": False
        })
        if archive_path:
            print(f"   归档路径: {archive_path}")

        # 8. 生成摘要
        print("\n[8] 会话摘要...")
        summary = archiver.getSummary(session.id)
        if summary:
            print("-" * 40)
            print(summary[:500] + "..." if len(summary) > 500 else summary)

        # 9. 存储统计
        print("\n[9] 存储统计...")
        storage_stats = archiver.getStorageStats()
        print(f"   会话大小: {storage_stats['sessions_size']} bytes")
        print(f"   摘要数量: {storage_stats['summary_count']}")
        print(f"   归档数量: {storage_stats['archive_count']}")

        print("\n" + "=" * 60)
        print("✅ 演示完成！")


def demo_pending_queue():
    """演示待发布队列"""

    with tempfile.TemporaryDirectory() as workspace:
        print("\n演示待发布队列...")
        print("=" * 60)

        queue = PendingQueueManager(workspace)

        # 添加待发布经验
        exp1 = queue.add({
            "session_id": "session_001",
            "title": "TypeScript 配置最佳实践",
            "problem": "缺少 strict 模式配置导致类型检查不严格",
            "solution": "在 tsconfig.json 中启用 strict 模式",
            "signals": ["typescript", "config", "strict-mode"],
        })
        print(f"添加经验: {exp1.id[:8]}... - {exp1.title}")

        exp2 = queue.add({
            "session_id": "session_002",
            "title": "React Hooks 依赖数组优化",
            "problem": "useEffect 依赖数组导致无限循环",
            "solution": "使用 useCallback 包装函数依赖",
            "signals": ["react", "hooks", "useEffect"],
        })
        print(f"添加经验: {exp2.id[:8]}... - {exp2.title}")

        # 列出待发布
        pending = queue.list()
        print(f"\n待发布经验数量: {len(pending)}")
        for exp in pending:
            print(f"  - {exp.title} (status: {exp.status})")

        # 获取一个批次
        batch = queue.get_batch(1)
        print(f"\n获取批次 (limit=1): {[e.id[:8] for e in batch]}")

        # 标记为已发布
        if batch:
            queue.mark_published(batch[0].id, "https://hub.aep.network/exp/123")
            print(f"已标记为发布: {batch[0].id[:8]}...")

        # 最终状态
        stats = queue.get_stats()
        print(f"\n队列统计: pending={stats['pending']}, published={stats['published']}")


if __name__ == "__main__":
    print("AEP SDK 功能演示")
    print("=" * 60)

    demo_full_workflow()
    demo_pending_queue()

    print("\n✅ 所有演示完成！")