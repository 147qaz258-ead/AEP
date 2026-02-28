# AEP Protocol Skill

Use this skill when working with the AEP (Agent Experience Protocol) to enable self-evolving AI agents through experience sharing and feedback loops.

## When to Use

- Setting up session recording for agent actions
- Implementing feedback collection systems
- Working with experience archiving and retrieval
- Calculating GDI (Global Desirability Index) scores
- Integrating AEP with MCP servers for Claude Code
- Building agent memory and learning systems

## Core Concepts

### Session Management

Sessions track complete agent interactions:

```typescript
import { SessionRecorder, ActionLogger } from 'aep-protocol';

// Initialize session recorder
const recorder = new SessionRecorder({
  storagePath: './.aep/sessions'
});

// Start recording
await recorder.startSession({
  agent_id: 'agent-001',
  metadata: { project: 'my-project' }
});

// Log actions
const logger = new ActionLogger({ sessionId: recorder.sessionId });
await logger.logToolCall({
  tool_name: 'Read',
  tool_input: { file_path: '/src/index.ts' },
  tool_output: { content: '...' },
  success: true
});

// End session
await recorder.endSession({ summary: 'Task completed' });
```

### Action Types

1. **Tool Call**: Recording tool/function invocations
2. **Message**: Agent communication
3. **Decision**: Choices made with reasoning

### Feedback Collection

```typescript
import { FeedbackCollector } from 'aep-protocol';

const collector = new FeedbackCollector({
  storagePath: './.aep/feedback'
});

// Explicit feedback (user ratings)
await collector.submitExplicitFeedback({
  session_id: 'session-001',
  action_id: 'action-123',
  rating: 'positive', // 'positive' | 'negative' | 'neutral'
  comment: 'Great solution!'
});

// Implicit feedback (behavioral signals)
await collector.submitImplicitFeedback({
  session_id: 'session-001',
  action_id: 'action-123',
  outcome: 'accepted', // 'accepted' | 'edited' | 'rejected' | 'retried'
  signal_type: 'code_accepted'
});
```

### GDI Scoring

The Global Desirability Index ranks experiences using multi-dimensional scoring:

```typescript
import { GDICalculator } from 'aep-protocol';

const calculator = new GDICalculator();

const experience = {
  id: 'exp-001',
  confidence: 0.95,
  total_uses: 100,
  total_success: 92,
  total_feedback: 45,
  positive_feedback: 40,
  updated_at: new Date(),
  blast_radius: { files: 2, lines: 50 }
};

const result = calculator.computeGDI(experience);
// result.score: 0.0 - 1.0
// result.dimensions: { quality, usage, social, freshness, confidence }
```

**GDI Formula:**
```
GDI = Quality^0.35 × Usage^0.25 × Social^0.15 × Freshness^0.15 × Confidence^0.10
```

### Archive and Pending Queue

```typescript
import { MemoryArchiver, PendingQueueManager } from 'aep-protocol';

// Archive completed sessions
const archiver = new MemoryArchiver({
  storagePath: './.aep/memory'
});

await archiver.archive(session);

// Manage pending experiences
const pendingQueue = new PendingQueueManager({
  storagePath: './.aep/pending'
});

await pendingQueue.addPendingExperience({
  experience_data: { /* ... */ },
  status: 'pending_validation'
});
```

## MCP Server Integration

Configure AEP as an MCP server for Claude Code:

```json
// .mcp-config.json
{
  "mcpServers": {
    "aep": {
      "command": "node",
      "args": ["dist/aep/mcp/server.js"],
      "env": {
        "AEP_WORKSPACE": "/path/to/project"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Purpose |
|------|---------|
| `aep_search` | Search historical experiences for similar problems |
| `aep_record` | Record a new experience for future reference |
| `aep_list` | List all session summaries |
| `aep_stats` | View AEP usage statistics |

## Python SDK

```python
from aep_sdk.session import SessionRecorder, ActionLogger
from aep_sdk.feedback import FeedbackCollector
from aep_sdk.archive import MemoryArchiver

# Session recording
recorder = SessionRecorder(storage_path='./.aep/sessions')
recorder.start_session(agent_id='agent-001')

logger = ActionLogger(session_id=recorder.session_id)
logger.log_tool_call(
    tool_name='Read',
    tool_input={'file_path': '/src/main.py'},
    success=True
)

recorder.end_session(summary='Completed')

# Feedback
collector = FeedbackCollector(storage_path='./.aep/feedback')
collector.submit_explicit_feedback(
    session_id='session-001',
    rating='positive',
    comment='Excellent!'
)
```

## Project Structure

```
.aep/
├── sessions/      # Session recordings (JSONL)
├── feedback/      # Feedback records
├── memory/        # Archived experiences (Markdown)
└── pending/       # Pending experiences queue
```

## Best Practices

1. **Always record sessions**: Enable learning from every interaction
2. **Log meaningful decisions**: Include reasoning and alternatives
3. **Collect both feedback types**: Explicit ratings + implicit signals
4. **Use GDI for ranking**: Prioritize high-quality experiences
5. **Archive valuable sessions**: Convert sessions to reusable experiences

## Error Handling

```typescript
import {
  SessionError,
  SessionNotActiveError,
  FeedbackError,
  WriteError
} from 'aep-protocol';

try {
  await recorder.endSession();
} catch (error) {
  if (error instanceof SessionNotActiveError) {
    // Handle inactive session
  }
}
```

## References

- [AEP Protocol Documentation](https://github.com/147qaz258-ead/AEP)
- [GDI Paper](https://example.com/gdi-paper) - Global Desirability Index methodology
- [MCP Specification](https://modelcontextprotocol.io/) - Model Context Protocol