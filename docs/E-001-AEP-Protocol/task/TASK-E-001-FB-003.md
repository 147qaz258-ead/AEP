# TASK-E-001-FB-003: Feedback API Endpoint

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-004
> **Status:** done
> **Beads 任务ID:** agent network-sdq
> **依赖:** [TASK-E-001-FB-001, TASK-E-001-FB-002]

## 摘要

Implement the `/v1/feedback` endpoint that receives feedback submissions, validates input, processes feedback through the feedback service, and returns reward information with status change notifications.

## 验收标准

- [x] AC-FB-API-001: Endpoint accepts POST requests at `/v1/feedback`
- [x] AC-FB-API-002: Validates AEP envelope format
- [x] AC-FB-API-003: Authenticates agent via Authorization header
- [x] AC-FB-API-004: Validates experience_id exists
- [x] AC-FB-API-005: Validates outcome is one of: success, failure, partial
- [x] AC-FB-API-006: Returns reward_earned for feedback submitter
- [x] AC-FB-API-007: Returns updated_stats (total_uses, success_streak, gdi_score)
- [x] AC-FB-API-008: Returns previous_status and new_status if changed
- [x] AC-FB-API-009: Returns 404 for non-existent experience_id
- [x] AC-FB-API-010: Returns 409 for duplicate feedback
- [x] AC-FB-API-011: Feedback latency < 100ms (p95)

## 实现记录

### 文件位置
- **路由实现**: `aep-hub/src/routes/feedback.ts`
- **类型定义**: `aep-hub/src/types/feedback.ts`
- **验证逻辑**: `aep-hub/src/utils/feedbackValidation.ts`
- **数据库仓库**: `aep-hub/src/db/feedbackRepository.ts`
- **GDI 更新服务**: `aep-hub/src/services/gdiUpdateService.ts`
- **E2E 测试**: `aep-hub/tests/feedback.e2e.test.ts`
- **验证测试**: `aep-hub/tests/feedbackValidation.test.ts`

### 实现说明
1. **端点挂载**: `/v1/feedback` 在 `aep-hub/src/index.ts` 中注册
2. **认证方式**: 通过 `X-Agent-Id` header 或 `Authorization: Bearer` 进行认证
3. **验证流程**:
   - AEP envelope 验证 (protocol, version, type, sender, timestamp)
   - Payload 验证 (experience_id, outcome, score 范围 0.0-1.0)
4. **GDI 更新**: 提交 feedback 后自动触发 GDI 重新计算和状态检查
5. **奖励计算**: 基础奖励 10 分，可叠加首次反馈、成功结果、promoted 状态、详细笔记等加成

### 测试覆盖
- ✅ 成功提交 feedback (201)
- ✅ 拒绝不存在的 experience_id (404)
- ✅ 拒绝重复 feedback (409)
- ✅ 拒绝未授权请求 (401)
- ✅ 拒绝无效 outcome 值 (400)
- ✅ 拒绝无效 score 范围 (400)
- ✅ 验证 success_streak 更新
- ✅ 验证 consecutive_failures 更新

## 接口定义

### HTTP Endpoint

```http
POST /v1/feedback HTTP/1.1
Host: hub.aep.network
Content-Type: application/json
Authorization: Bearer agent_0x8f3a2b4c5d6e7f8a
```

### Request Schema

```typescript
interface FeedbackAPIRequest {
  protocol: "aep";
  version: string;
  type: "feedback";
  sender: string;  // agent_id
  timestamp: string;  // ISO 8601
  payload: {
    experience_id: string;
    outcome: "success" | "failure" | "partial";
    score?: number;  // 0.0 - 1.0
    notes?: string;
  }
}
```

### Response Schema (Success - with Promotion)

```typescript
interface FeedbackAPIResponse {
  status: "recorded";
  experience_id: string;
  reward_earned: number;
  previous_status: string;
  new_status: string;
  updated_stats: {
    total_uses: number;
    total_success: number;
    success_streak: number;
    gdi_score: number;
  };
  message: string;
}
```

### Response Schema (Success - No Status Change)

```typescript
interface FeedbackAPIResponseNoChange {
  status: "recorded";
  experience_id: string;
  reward_earned: number;
  updated_stats: {
    total_uses: number;
    total_success: number;
    success_streak: number;
    gdi_score: number;
  };
  message: string;
}
```

### Response Schema (Error - Not Found)

```typescript
interface ErrorResponse {
  error: "experience_not_found";
  message: string;
  experience_id: string;
}
```

### Response Schema (Error - Duplicate)

```typescript
interface DuplicateErrorResponse {
  error: "duplicate_feedback";
  message: string;
  experience_id: string;
  existing_feedback_id: string;
}
```

## 实现笔记

### Feedback Handler (Pseudocode)

```python
class FeedbackAPIHandler:
    def handle_feedback(self, request: FeedbackAPIRequest) -> FeedbackAPIResponse:
        """Handle feedback request end-to-end."""

        # 1. Validate AEP envelope
        self._validate_envelope(request)

        # 2. Authenticate agent
        agent_id = self._authenticate(request)

        # 3. Validate payload
        payload = request.payload
        if not payload.experience_id:
            raise ValidationError("experience_id is required", "payload.experience_id")

        valid_outcomes = {"success", "failure", "partial"}
        if payload.outcome not in valid_outcomes:
            raise ValidationError(
                f"outcome must be one of: {', '.join(valid_outcomes)}",
                "payload.outcome"
            )

        # Validate score range
        if payload.score is not None and (payload.score < 0.0 or payload.score > 1.0):
            raise ValidationError("score must be between 0.0 and 1.0", "payload.score")

        # 4. Submit feedback through service
        feedback_request = FeedbackRequest(
            experience_id=payload.experience_id,
            outcome=payload.outcome,
            score=payload.score,
            notes=payload.notes
        )

        try:
            result = self.feedback_service.submit_feedback(agent_id, feedback_request)
        except NotFoundError as e:
            # Experience not found
            return ErrorResponse(
                error="experience_not_found",
                message=str(e),
                experience_id=payload.experience_id
            ), 404

        except ConflictError as e:
            # Duplicate feedback
            existing = db.query(
                "SELECT id FROM feedback WHERE agent_id = ? AND experience_id = ?",
                agent_id, payload.experience_id
            ).first()

            return DuplicateErrorResponse(
                error="duplicate_feedback",
                message=str(e),
                experience_id=payload.experience_id,
                existing_feedback_id=existing.id if existing else None
            ), 409

        # 5. Build success response
        response_data = {
            "status": "recorded",
            "experience_id": payload.experience_id,
            "reward_earned": result.reward_earned,
            "updated_stats": {
                "total_uses": result.updated_stats.total_uses,
                "total_success": result.updated_stats.total_success,
                "success_streak": result.updated_stats.success_streak,
                "gdi_score": result.updated_stats.gdi_score
            }
        }

        # Add status change info if applicable
        if result.status_changed:
            response_data["previous_status"] = result.previous_status
            response_data["new_status"] = result.new_status
            response_data["message"] = self._get_status_change_message(result.new_status)
        else:
            response_data["message"] = f"Feedback recorded. Experience remains {result.previous_status} status."

        return response_data, 200

    def _validate_envelope(self, request: FeedbackAPIRequest) -> None:
        """Validate AEP envelope structure."""
        if request.protocol != "aep":
            raise ValidationError("protocol must be 'aep'", "protocol")

        if not request.version:
            raise ValidationError("version is required", "version")

        if request.type != "feedback":
            raise ValidationError("type must be 'feedback'", "type")

        if not request.sender:
            raise ValidationError("sender (agent_id) is required", "sender")

    def _authenticate(self, request: FeedbackAPIRequest) -> str:
        """Authenticate agent from Authorization header."""
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise UnauthorizedError("Missing or invalid Authorization header")

        agent_id = auth_header[7:]  # Remove "Bearer "

        if not self.agent_service.validate_agent(agent_id):
            raise UnauthorizedError(f"Invalid agent_id: {agent_id}")

        # Update last_seen
        self.agent_service.update_last_seen(agent_id)

        return agent_id

    def _get_status_change_message(self, new_status: str) -> str:
        """Get appropriate message for status change."""
        messages = {
            "promoted": "Feedback recorded. Experience promoted to promoted status!",
            "deprecated": "Feedback recorded. Experience has been deprecated."
        }
        return messages.get(new_status, f"Experience status changed to {new_status}")
```

### Error Handler

```python
def error_handler(error: Exception) -> Tuple[int, dict]:
    """Convert exceptions to HTTP error responses."""
    if isinstance(error, ValidationError):
        return 400, {
            "error": "invalid_request",
            "message": str(error),
            "field": getattr(error, "field", None)
        }
    elif isinstance(error, UnauthorizedError):
        return 401, {
            "error": "unauthorized",
            "message": str(error)
        }
    elif isinstance(error, NotFoundError):
        return 404, {
            "error": "experience_not_found",
            "message": str(error)
        }
    elif isinstance(error, ConflictError):
        return 409, {
            "error": "duplicate_feedback",
            "message": str(error)
        }
    else:
        return 500, {
            "error": "internal_error",
            "message": "An internal error occurred"
        }
```

## 技术约束

- **Authentication**: Bearer token with valid agent_id
- **Idempotency**: Duplicate feedback rejected with 409
- **Latency**: p95 < 100ms

## 验证方式

1. **Integration Tests**: Happy path, error cases
2. **Authentication Tests**: Invalid/missing tokens
3. **Validation Tests**: Invalid outcome, score range
4. **Duplicate Tests**: Verify 409 response
5. **Performance Tests**: Latency under load

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §2.3 Table: feedback
- **STORY**: `../../_project/stories/STORY-004-feedback-loop.md`
