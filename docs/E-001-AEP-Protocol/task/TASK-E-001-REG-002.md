# TASK-E-001-REG-002: Agent Identity Service

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-001
> **Status:** review
> **Beads 任务ID:** agent network-rsu
> **依赖:** []

## 摘要

Implement the Agent Identity Service that manages agent registration persistence, identity lookup, and storage operations. This service supports both SDK-side local persistence (for agents) and Hub-side identity management (for registration and verification).

## 验收标准

- [x] AC-ID-001: SDK persists agent_id to platform-specific local storage
- [x] AC-ID-002: SDK loads existing agent_id on initialization
- [x] AC-ID-003: SDK supports `AEP_AGENT_ID` environment variable override
- [x] AC-ID-004: Hub validates agent_id format and existence
- [x] AC-ID-005: Hub provides agent lookup endpoint
- [x] AC-ID-006: Storage paths follow platform conventions

## 实现记录

### Hub-side Implementation (TypeScript)

**Files Created:**
- `aep-hub/src/services/agentIdentityService.ts` - Core identity service with caching
- `aep-hub/src/services/index.ts` - Service exports
- `aep-hub/src/routes/agent.ts` - Agent lookup/validation endpoints
- `aep-hub/tests/agentIdentityService.test.ts` - 18 unit tests

**Key Features:**
1. **Caching**: In-memory cache with configurable TTL (default 5 minutes)
2. **Validation**: Format validation using existing `isValidAgentId` utility
3. **Lookup Endpoint**: `GET /v1/agent/:agentId` returns agent info
4. **Validation Endpoint**: `HEAD /v1/agent/:agentId` returns 200/404

### SDK-side Implementation (Python)

**Files Created:**
- `aep-sdk/src/aep_sdk/identity.py` - AgentIdentityStore class
- `aep-sdk/src/aep_sdk/__init__.py` - Package exports
- `aep-sdk/tests/test_identity.py` - 24 unit tests
- `aep-sdk/pyproject.toml` - Package configuration

**Key Features:**
1. **Platform-specific Storage**:
   - Linux: `~/.config/aep/agent_id`
   - macOS: `~/Library/Application Support/AEP/agent_id`
   - Windows: `%APPDATA%\AEP\agent_id`
2. **Environment Override**: `AEP_AGENT_ID` env variable takes precedence
3. **File Permissions**: User-readable only (0600 on Unix)
4. **Format Validation**: `agent_0x{16-hex-chars}` regex validation

### API Endpoints Added

```
GET  /v1/agent/:agentId - Returns agent info (id, capabilities, timestamps)
HEAD /v1/agent/:agentId - Returns 200 if exists, 404 if not
```

## 测试记录

### Hub Tests (18 tests passed)
- Format validation (valid/invalid IDs)
- Cache behavior (hit, miss, TTL expiry)
- Database integration (findById, updateLastSeen)
- Error handling (invalid format, not found)
- Singleton pattern

### SDK Tests (24 tests)
- Format validation (8 valid, 8 invalid cases)
- Save/load operations
- Platform-specific paths
- Environment variable override
- Error handling
- File permissions (Unix)

**Test Command:**
```bash
# Hub tests
cd aep-hub && npm test -- tests/agentIdentityService.test.ts

# SDK tests (requires Python 3.8+)
cd aep-sdk && pip install -e ".[dev]" && pytest tests/
```

## 上线/回滚说明

### Deployment
- No database migrations required (uses existing `agents` table)
- No configuration changes required
- Environment variables: None new

### Rollback
1. Remove `/v1/agent` route registration from `src/index.ts`
2. Remove `agentRouter` import from `src/routes/index.ts`
3. Remove `aep-sdk` directory if not needed

### Observability
- Request logging via existing middleware
- Cache stats available via `getAgentIdentityService().getCacheStats()`

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §4.1 Identity Persistence
- **STORY**: `../../_project/stories/STORY-001-agent-registration.md`
