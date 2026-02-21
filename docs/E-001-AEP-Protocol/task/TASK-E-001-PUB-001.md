# TASK-E-001-PUB-001: Gene/Capsule Validation

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-003
> **Status:** DONE
> **Beads 任务ID:** agent network-lxo
> **依赖:** []

## 摘要

Implement validation logic for Gene and Capsule structures in experience publishing. Validates Gene references exist, Capsule format is correct, and all required fields are present with valid values.

## 验收标准

- [x] AC-VAL-001: Validates `trigger` field length [10, 500] characters
- [x] AC-VAL-002: Validates `solution` field length [20, 10000] characters
- [x] AC-VAL-003: Validates `confidence` range [0.0, 1.0]
- [x] AC-VAL-004: Validates `signals_match` array max 20 items
- [x] AC-VAL-005: Validates `gene` reference exists in genes table (if provided)
- [x] AC-VAL-006: Validates `context` object max 10 keys
- [x] AC-VAL-007: Validates `blast_radius` has `files` and `lines` as non-negative integers
- [x] AC-VAL-008: Sanitizes solution text for script-injection
- [x] AC-VAL-009: Detects duplicate experiences by content hash

## 接口定义

### Validation Interface

```python
@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str]
    warnings: List[str]

class ExperienceValidator:
    """Validate experience publishing data."""

    def validate_publish_request(self, request: PublishRequest) -> ValidationResult:
        """Validate complete publish request."""

    def validate_trigger(self, trigger: str) -> List[str]:
        """Validate trigger field."""

    def validate_solution(self, solution: str) -> List[str]:
        """Validate and sanitize solution field."""

    def validate_confidence(self, confidence: float) -> List[str]:
        """Validate confidence field."""

    def validate_gene_reference(self, gene_id: Optional[str]) -> List[str]:
        """Validate gene exists (if provided)."""

    def validate_signals_match(self, signals: Optional[List[str]]) -> List[str]:
        """Validate signals_match array."""

    def validate_context(self, context: Optional[dict]) -> List[str]:
        """Validate context object."""

    def validate_blast_radius(self, blast_radius: Optional[dict]) -> List[str]:
        """Validate blast_radius object."""

    def check_duplicate(self, trigger: str, solution: str) -> Optional[str]:
        """Check for duplicate experience, return existing experience_id if found."""
```

## 实现笔记

### Validation Logic (Pseudocode)

```python
import re
import html
import hashlib

class ExperienceValidator:
    # Field constraints
    TRIGGER_MIN_LEN = 10
    TRIGGER_MAX_LEN = 500
    SOLUTION_MIN_LEN = 20
    SOLUTION_MAX_LEN = 10000
    SIGNALS_MAX_COUNT = 20
    CONTEXT_MAX_KEYS = 10

    def validate_publish_request(self, request: PublishRequest) -> ValidationResult:
        """Validate complete publish request."""
        errors = []
        warnings = []

        # Validate required fields
        errors.extend(self.validate_trigger(request.payload.trigger))
        errors.extend(self.validate_solution(request.payload.solution))
        errors.extend(self.validate_confidence(request.payload.confidence))

        # Validate optional fields
        if request.payload.signals_match is not None:
            errors.extend(self.validate_signals_match(request.payload.signals_match))

        if request.payload.gene is not None:
            errors.extend(self.validate_gene_reference(request.payload.gene))

        if request.payload.context is not None:
            errors.extend(self.validate_context(request.payload.context))

        if request.payload.blast_radius is not None:
            errors.extend(self.validate_blast_radius(request.payload.blast_radius))

        # Check for duplicates
        duplicate_id = self.check_duplicate(
            request.payload.trigger,
            request.payload.solution
        )
        if duplicate_id:
            warnings.append(f"Duplicate experience exists: {duplicate_id}")

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )

    def validate_trigger(self, trigger: str) -> List[str]:
        """Validate trigger field."""
        errors = []

        if not trigger:
            errors.append("trigger is required")
            return errors

        length = len(trigger)
        if length < self.TRIGGER_MIN_LEN:
            errors.append(f"trigger must be at least {self.TRIGGER_MIN_LEN} characters")
        elif length > self.TRIGGER_MAX_LEN:
            errors.append(f"trigger must be at most {self.TRIGGER_MAX_LEN} characters")

        return errors

    def validate_solution(self, solution: str) -> List[str]:
        """Validate and sanitize solution field."""
        errors = []

        if not solution:
            errors.append("solution is required")
            return errors

        length = len(solution)
        if length < self.SOLUTION_MIN_LEN:
            errors.append(f"solution must be at least {self.SOLUTION_MIN_LEN} characters")
        elif length > self.SOLUTION_MAX_LEN:
            errors.append(f"solution must be at most {self.SOLUTION_MAX_LEN} characters")

        # Sanitize for script injection (basic)
        # This is a simple sanitization - production should use proper sanitization library
        if "<script>" in solution.lower():
            errors.append("solution contains potentially unsafe content")

        return errors

    def validate_confidence(self, confidence: float) -> List[str]:
        """Validate confidence field."""
        errors = []

        if confidence < 0.0 or confidence > 1.0:
            errors.append("confidence must be between 0.0 and 1.0")

        return errors

    def validate_gene_reference(self, gene_id: Optional[str]) -> List[str]:
        """Validate gene exists (if provided)."""
        errors = []

        if not gene_id:
            return errors

        # Check if gene exists in database
        gene = db.query("SELECT id FROM genes WHERE id = ?", gene_id).first()
        if not gene:
            errors.append(f"gene '{gene_id}' does not exist")

        return errors

    def validate_signals_match(self, signals: Optional[List[str]]) -> List[str]:
        """Validate signals_match array."""
        errors = []

        if signals is None:
            return errors

        if len(signals) > self.SIGNALS_MAX_COUNT:
            errors.append(f"signals_match must have at most {self.SIGNALS_MAX_COUNT} items")

        # Validate each signal is non-empty string
        for i, signal in enumerate(signals):
            if not isinstance(signal, str):
                errors.append(f"signals_match[{i}] must be a string")
            elif not signal.strip():
                errors.append(f"signals_match[{i}] cannot be empty")

        return errors

    def validate_context(self, context: Optional[dict]) -> List[str]:
        """Validate context object."""
        errors = []

        if context is None:
            return errors

        if len(context) > self.CONTEXT_MAX_KEYS:
            errors.append(f"context must have at most {self.CONTEXT_MAX_KEYS} keys")

        return errors

    def validate_blast_radius(self, blast_radius: Optional[dict]) -> List[str]:
        """Validate blast_radius object."""
        errors = []

        if blast_radius is None:
            return errors

        # Validate required fields
        if "files" not in blast_radius:
            errors.append("blast_radius must contain 'files' field")
        elif not isinstance(blast_radius["files"], int) or blast_radius["files"] < 0:
            errors.append("blast_radius.files must be a non-negative integer")

        if "lines" not in blast_radius:
            errors.append("blast_radius must contain 'lines' field")
        elif not isinstance(blast_radius["lines"], int) or blast_radius["lines"] < 0:
            errors.append("blast_radius.lines must be a non-negative integer")

        return errors

    def check_duplicate(self, trigger: str, solution: str) -> Optional[str]:
        """Check for duplicate experience by content hash."""
        # Normalize content
        normalized = self._normalize_content(trigger + solution)
        content_hash = hashlib.sha256(normalized.encode()).hexdigest()

        # Check existing experiences
        existing = db.query(
            "SELECT id FROM experiences WHERE content_hash = ?",
            content_hash
        ).first()

        return existing.id if existing else None

    def _normalize_content(self, content: str) -> str:
        """Normalize content for duplicate detection."""
        return content.lower().strip()
```

### Error Response Format

```typescript
interface ValidationErrorResponse {
  error: "validation_error";
  message: "Validation failed";
  field_errors: Record<string, string[]>;
  warnings: string[];
}
```

## 技术约束

- **Sanitization**: Basic script-injection detection
- **Performance**: Validation < 5ms per request
- **Database**: Gene lookup must be indexed

## 验证方式

1. **Unit Tests**: Each validation function independently
2. **Integration Tests**: End-to-end validation flow
3. **Edge Cases**: Empty fields, max lengths, invalid types
4. **Duplicate Tests**: Verify hash-based duplicate detection

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §2.2 Table: experiences
- **STORY**: `../../_project/stories/STORY-003-experience-publish.md`

---

## 实现记录

### 实现说明

**实现文件**: `src/aep/validator/index.ts`

实现了 `ExperienceValidator` 类，提供完整的 Experience 发布数据验证功能：

1. **字段验证函数** (独立函数，可直接调用):
   - `validateTrigger(trigger: string)` - 验证 trigger 字段长度 [10, 500]
   - `validateSolution(solution: string)` - 验证 solution 字段长度 [20, 10000] + 脚本注入检测
   - `validateConfidence(confidence: number)` - 验证 confidence 范围 [0.0, 1.0]
   - `validateSignalsMatch(signals)` - 验证 signals_match 最多 20 项
   - `validateContext(context)` - 验证 context 最多 10 个 key
   - `validateBlastRadius(blastRadius)` - 验证 blast_radius 结构

2. **ExperienceValidator 类**:
   - `validatePublishRequest(request)` - 完整请求验证
   - `validateGeneReference(geneId)` - 异步验证 gene 引用存在性
   - `checkDuplicate(trigger, solution)` - 异步检测重复经验

3. **辅助函数**:
   - `generateContentHash(trigger, solution)` - SHA-256 内容哈希
   - `createValidationErrorResponse(errors, warnings)` - 创建标准错误响应

### 技术实现要点

1. **AC-VAL-008 脚本注入检测**: 使用正则表达式检测 `<script>`, `javascript:`, `on\w+=`, `data:text/html` 等危险模式

2. **AC-VAL-009 重复检测**: 使用 SHA-256 哈希，内容先归一化 (lowercase + trim + collapse whitespace)

3. **性能优化**: 所有验证函数设计为纯函数，无副作用，平均验证时间 < 1ms

4. **TypeScript 类型安全**: 完整的类型定义 (ValidationResult, PublishPayload, PublishRequest 等)

### 测试记录

**测试文件**: `src/aep/validator/__tests__/validator.test.ts`

**测试结果**: 72 tests passed

| 测试类别 | 测试数量 | 状态 |
|---------|---------|------|
| validateTrigger | 7 | PASSED |
| validateSolution | 10 | PASSED |
| validateConfidence | 5 | PASSED |
| validateSignalsMatch | 6 | PASSED |
| validateContext | 5 | PASSED |
| validateBlastRadius | 10 | PASSED |
| generateContentHash | 5 | PASSED |
| validatePublishRequest | 7 | PASSED |
| validateGeneReference | 5 | PASSED |
| checkDuplicate | 3 | PASSED |
| createValidationErrorResponse | 3 | PASSED |
| Performance | 1 | PASSED (< 5ms) |
| Edge Cases | 5 | PASSED |

### 运行验证

```bash
# 运行测试
npm test

# 仅运行 validator 测试
npx vitest run src/aep/validator/__tests__/validator.test.ts

# 构建
npm run build
```

### 接口使用示例

```typescript
import { ExperienceValidator, createValidationErrorResponse } from 'aep/validator';

const validator = new ExperienceValidator({
  geneLookup: async (id) => db.query('SELECT 1 FROM genes WHERE id = $1', [id]).rowCount > 0,
  experienceLookup: async (hash) => db.query('SELECT id FROM experiences WHERE content_hash = $1', [hash]).rows[0]?.id,
});

const result = await validator.validatePublishRequest({
  payload: {
    trigger: 'TypeError: Cannot read property of undefined',
    solution: 'Add null check before accessing the property.',
    confidence: 0.85,
    signals_match: ['TypeError', 'undefined'],
    blast_radius: { files: 2, lines: 15 },
  },
});

if (!result.is_valid) {
  const response = createValidationErrorResponse(result.errors, result.warnings);
  // Return HTTP 400 with response
}
```
