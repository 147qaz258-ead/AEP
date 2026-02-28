# AEP - Agent Experience Protocol

A comprehensive SDK for building self-evolving AI agents through experience sharing and feedback loops.

## Overview

AEP (Agent Experience Protocol) enables AI agents to:

- **Record Sessions**: Track agent actions, decisions, and outcomes
- **Collect Feedback**: Gather explicit and implicit feedback on agent performance
- **Archive Experiences**: Summarize and store valuable experiences for future reference
- **Score Quality**: Calculate Global Desirability Index (GDI) for experience ranking
- **Share Knowledge**: Enable agents to learn from each other's experiences

## Installation

### TypeScript/Node.js

```bash
npm install aep-protocol
# or
pnpm add aep-protocol
```

### Python

```bash
pip install aep-sdk
```

## Quick Start

### TypeScript

#### Session Recording

```typescript
import {
  SessionRecorder,
  ActionLogger,
  createSession,
  createAgentAction
} from 'aep-protocol';

// Create a new session
const recorder = new SessionRecorder({
  storagePath: './.aep/sessions'
});

// Start a session
await recorder.startSession({
  agent_id: 'my-agent-001',
  metadata: { project: 'example' }
});

// Log actions
const logger = new ActionLogger({ sessionId: recorder.sessionId });

// Log tool calls
await logger.logToolCall({
  tool_name: 'Read',
  tool_input: { file_path: '/src/index.ts' },
  tool_output: { content: 'file contents...' },
  success: true
});

// Log messages
await logger.logMessage({
  role: 'assistant',
  content: 'I will help you fix this bug.'
});

// Log decisions
await logger.logDecision({
  decision: 'Use React hooks instead of class components',
  reasoning: 'Better state management and code organization',
  alternatives: ['Class components', 'Redux']
});

// End session
await recorder.endSession({ summary: 'Fixed the bug successfully' });
```

#### Feedback Collection

```typescript
import { FeedbackCollector } from 'aep-protocol';

const collector = new FeedbackCollector({
  storagePath: './.aep/feedback'
});

// Submit explicit feedback
await collector.submitExplicitFeedback({
  session_id: 'session-001',
  action_id: 'action-123',
  rating: 'positive',
  comment: 'Great solution!'
});

// Submit implicit feedback
await collector.submitImplicitFeedback({
  session_id: 'session-001',
  action_id: 'action-123',
  outcome: 'accepted',
  signal_type: 'code_accepted'
});
```

#### GDI Scoring

```typescript
import { GDICalculator, computeBlastSafety } from 'aep-protocol';

const calculator = new GDICalculator({
  quality: 0.35,
  usage: 0.25,
  social: 0.15,
  freshness: 0.15,
  confidence: 0.10
});

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

const gdi = calculator.computeGDI(experience);
console.log(`GDI Score: ${gdi.score}`);
console.log('Dimensions:', gdi.dimensions);
```

### Python

#### Session Recording

```python
from aep_sdk.session import (
    SessionRecorder,
    ActionLogger,
    create_session,
    create_action
)

# Create a session recorder
recorder = SessionRecorder(storage_path='./.aep/sessions')

# Start a session
recorder.start_session(agent_id='my-agent-001')

# Log actions using ActionLogger
logger = ActionLogger(session_id=recorder.session_id)

# Log tool calls
logger.log_tool_call(
    tool_name='Read',
    tool_input={'file_path': '/src/main.py'},
    tool_output={'content': 'file contents...'},
    success=True
)

# Log decisions
logger.log_decision(
    decision='Use FastAPI instead of Flask',
    reasoning='Better async support and automatic API docs',
    alternatives=['Flask', 'Django']
)

# End session
recorder.end_session(summary='Implemented the feature successfully')
```

#### Feedback Collection

```python
from aep_sdk.feedback import FeedbackCollector

collector = FeedbackCollector(storage_path='./.aep/feedback')

# Submit explicit feedback
collector.submit_explicit_feedback(
    session_id='session-001',
    action_id='action-123',
    rating='positive',
    comment='Excellent solution!'
)

# Submit implicit feedback
collector.submit_implicit_feedback(
    session_id='session-001',
    action_id='action-123',
    outcome='accepted',
    signal_type='code_accepted'
)
```

## MCP Server Integration

AEP includes an MCP (Model Context Protocol) server for integration with Claude Code:

```bash
# Configure in .mcp-config.json
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

| Tool | Description |
|------|-------------|
| `aep_search` | Search historical experiences for similar problems |
| `aep_record` | Record a new experience for future reference |
| `aep_list` | List all session summaries |
| `aep_stats` | View AEP usage statistics |

## Architecture

```
aep-protocol/
├── src/aep/
│   ├── session/         # Session and action recording
│   │   ├── types.ts     # Type definitions
│   │   ├── recorder.ts  # Session management
│   │   └── action-logger.ts
│   ├── feedback/        # Feedback collection
│   │   ├── types.ts
│   │   └── collector.ts
│   ├── archive/         # Experience archiving
│   │   ├── types.ts
│   │   ├── archiver.ts
│   │   └── pending-queue.ts
│   ├── gdi/             # GDI scoring engine
│   ├── mcp/             # MCP server for Claude Code
│   ├── matcher/         # Experience matching
│   ├── signal/          # Signal extraction
│   └── fetch/           # Experience fetching
└── aep-sdk/             # Python SDK
    └── src/aep_sdk/
        ├── session/
        ├── feedback/
        ├── archive/
        └── ...
```

## Core Concepts

### Session

A session represents a complete interaction between an agent and a user. It contains:

- Agent identification
- Start/end timestamps
- All actions performed
- Optional summary

### AgentAction

An action is a single operation performed by an agent:

- **Tool Call**: Invoking a tool/function
- **Message**: Communication with the user
- **Decision**: A choice made by the agent

### Feedback

Feedback can be:

- **Explicit**: Direct ratings (positive/negative/neutral) with optional comments
- **Implicit**: Derived from user behavior (acceptance, edits, retries)

### GDI (Global Desirability Index)

GDI scores experiences using a multi-dimensional geometric mean:

```
GDI = Quality^0.35 * Usage^0.25 * Social^0.15 * Freshness^0.15 * Confidence^0.10
```

Where:
- **Quality**: Success rate and blast radius safety
- **Usage**: How often the experience is used
- **Social**: Community feedback (Wilson score)
- **Freshness**: Recency with exponential decay
- **Confidence**: Publisher confidence level

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## Links

- [GitHub Repository](https://github.com/147qaz258-ead/AEP)
- [Documentation](https://github.com/147qaz258-ead/AEP#readme)
- [Issue Tracker](https://github.com/147qaz258-ead/AEP/issues)