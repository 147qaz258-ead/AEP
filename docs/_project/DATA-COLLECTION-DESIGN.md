# AEP 数据采集架构设计

> 问题：当前 AEP Hub 是被动 API，没有数据输入能力
> 目标：支持从日志、文件夹、会话等来源主动采集经验

---

## 一、当前缺失

```
┌─────────────────────────────────────────────────────────────────┐
│                        完整数据流                                │
│                                                                 │
│  数据源         采集器          处理器           Hub            │
│  ────────      ──────          ──────           ────            │
│  [日志文件] ──▶ [LogCollector] ─┐                               │
│  [代码仓库] ──▶ [GitWatcher]  ──┼─▶ [SignalExtractor] ─▶ /publish │
│  [Claude会话]─▶ [SessionRecorder]┘                               │
│  [文件夹]  ──▶ [FileWatcher]  ──┘                               │
│                                                                 │
│  当前实现状态:                                                   │
│  ✅ SignalExtractor - 已实现 (src/aep/signal/)                  │
│  ✅ AEP Hub API - 已实现 (aep-hub/)                             │
│  ❌ LogCollector - 未实现                                       │
│  ❌ GitWatcher - 未实现                                         │
│  ❌ SessionRecorder - 未实现                                    │
│  ❌ FileWatcher - 未实现                                        │
│  ❌ SDK Client - 未实现 (只有身份管理)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、需要新增的组件

### 1. Input Adapters (输入适配器)

```typescript
// src/aep/adapters/index.ts

interface InputAdapter {
  name: string;
  watch(path: string): Promise<void>;
  onData(callback: (raw: RawInput) => void): void;
}

interface RawInput {
  source: 'log' | 'git' | 'file' | 'session';
  content: string;
  metadata: Record<string, any>;
  timestamp: Date;
}
```

### 2. LogCollector - 日志采集器

```typescript
// src/aep/adapters/logCollector.ts

class LogCollector implements InputAdapter {
  // 监听日志文件
  async watch(logPath: string): Promise<void>;

  // 解析日志提取错误/警告
  parseLog(content: string): LogEntry[];

  // 转换为 Signal 格式
  toSignal(entry: LogEntry): Signal[];
}

// 使用示例:
const collector = new LogCollector();
collector.watch('/var/log/app.log');
collector.onData((raw) => {
  // 发送到 SignalExtractor 处理
});
```

### 3. FileWatcher - 文件夹监听

```typescript
// src/aep/adapters/fileWatcher.ts

class FileWatcher implements InputAdapter {
  // 监听文件夹变化
  async watch(dir: string, pattern: string): Promise<void>;

  // 读取文件内容
  readFile(path: string): string;
}

// 使用示例:
const watcher = new FileWatcher();
watcher.watch('./src', '**/*.ts');
watcher.onData((raw) => {
  // 分析代码变化，提取模式
});
```

### 4. SessionRecorder - 会话录制

```typescript
// src/aep/adapters/sessionRecorder.ts

class SessionRecorder {
  // 录制 Claude/Codex 会话
  startRecording(): void;
  stopRecording(): SessionData;

  // 从会话中提取经验
  extractExperience(session: SessionData): Experience;
}
```

### 5. ExperiencePublisher - 发布客户端

```typescript
// src/aep/client/publisher.ts

class ExperiencePublisher {
  constructor(hubUrl: string, agentId: string);

  // 发布经验
  async publish(gene: Gene, capsule?: Capsule): Promise<string>;

  // 批量发布
  async publishBatch(experiences: Experience[]): Promise<string[]>;
}
```

---

## 三、完整使用流程设计

### 场景 1: 从日志文件学习

```bash
# 命令行工具
aep collect --source logs --path /var/log/app.log --hub http://localhost:3000

# 工作流程:
# 1. LogCollector 监听日志文件
# 2. 检测到 ERROR/WARN
# 3. SignalExtractor 提取错误签名
# 4. ExperiencePublisher 发布到 Hub
```

### 场景 2: 从文件夹学习

```bash
# 监听代码文件夹
aep collect --source files --path ./src --pattern "**/*.ts" --hub http://localhost:3000

# 工作流程:
# 1. FileWatcher 监听文件变化
# 2. 检测到 git diff
# 3. 分析修复前后的代码
# 4. 提取 "问题→解决方案" 对
# 5. 发布到 Hub
```

### 场景 3: 从 Claude 会话学习

```bash
# 录制当前会话
aep record --hub http://localhost:3000

# 工作流程:
# 1. 记录用户问题
# 2. 记录 Claude 的解决方案
# 3. 记录是否成功
# 4. 自动生成 Gene + Capsule
# 5. 发布到 Hub
```

### 场景 4: 简单 UI 测试

```bash
# 启动测试 UI
aep ui --hub http://localhost:3000

# 提供:
# - 文本输入: 输入问题描述
# - 文件上传: 上传日志/代码
# - 结果展示: 显示匹配到的经验
```

---

## 四、最小可行扩展 (MVP Extension)

要让你能立刻测试，最小需要实现：

### Phase 1: CLI 工具 (1-2 天)

```bash
# 安装
npm install -g aep-cli

# 初始化
aep init --hub http://localhost:3000

# 手动发布
aep publish --trigger "TypeError undefined" --solution "Add null check"

# 从文件发布
aep publish --file error.log

# 查询经验
aep fetch "TypeError undefined property"
```

### Phase 2: 文件监听 (2-3 天)

```bash
# 监听文件夹
aep watch ./logs --auto-publish

# 监听 Git 仓库
aep watch-git ./my-project --auto-publish
```

### Phase 3: Web UI (3-5 天)

```bash
# 启动 Web UI
aep ui

# 访问 http://localhost:3100
# - 输入问题
# - 查看匹配经验
# - 提交反馈
```

---

## 五、实现优先级

| 优先级 | 组件 | 工作量 | 价值 |
|--------|------|--------|------|
| P0 | SDK Client (publish/fetch) | 0.5天 | 基础能力 |
| P0 | 挂载 /v1/fetch 路由 | 0.5天 | 完整 API |
| P1 | CLI 工具 (手动发布) | 1天 | 可测试 |
| P1 | LogCollector | 1天 | 日志采集 |
| P2 | FileWatcher | 1天 | 文件监听 |
| P2 | Web UI | 2天 | 可视化 |
| P3 | SessionRecorder | 2天 | 会话录制 |
| P3 | GitWatcher | 1天 | Git 分析 |

---

## 六、立即可用的方案

在完整实现之前，可以用脚本快速测试：

```typescript
// scripts/test-publish.ts

import { SignalExtractor } from '../src/aep/signal';
import fetch from 'node-fetch';

const extractor = new SignalExtractor();

async function publishExperience(trigger: string, solution: string) {
  // 1. 提取信号
  const signals = extractor.extractSignals(trigger);

  // 2. 构造请求
  const body = {
    gene: {
      trigger,
      solution,
      signals: signals.signals.map(s => s.value),
      context: {}
    }
  };

  // 3. 发布到 Hub
  const res = await fetch('http://localhost:3000/v1/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test_agent_001'
    },
    body: JSON.stringify(body)
  });

  return res.json();
}

// 使用
publishExperience(
  "TypeError: Cannot read property 'x' of undefined",
  "Add null check: if (obj && obj.x) { ... }"
);
```

---

## 七、总结

**当前问题**: Hub 是被动 API，没有数据入口

**解决方案**:
1. 实现 SDK Client (publish/fetch)
2. 实现输入适配器 (LogCollector, FileWatcher)
3. 实现 CLI 工具
4. 可选: 实现 Web UI

**下一步任务**: 实现 SDK Client + CLI 工具，让系统可以被测试
