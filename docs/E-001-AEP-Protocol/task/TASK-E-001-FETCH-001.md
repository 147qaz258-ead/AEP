# TASK-E-001-FETCH-001: Signal Extraction Module

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-006
> **Status:** pending
> **Beads 任务ID:** agent network-4ma
> **依赖:** []

## 摘要

Implement the Signal Extraction Module that normalizes error messages, extracts keywords, and generates signal hashes. This module converts raw error text into structured signals for matching against the experience database.

## 验收标准

- [ ] AC-SIG-001: Normalizes error signatures by removing paths (Windows/Unix), hex IDs, and line numbers
- [ ] AC-SIG-002: Extracts keywords using regex patterns for known error types (TypeError, TimeoutError, etc.)
- [ ] AC-SIG-003: Generates SHA-256 hash of normalized error strings for exact-match signals
- [ ] AC-SIG-004: Returns structured signals with type, value, and weight
- [ ] AC-SIG-005: Truncates normalized signatures to 220 characters
- [ ] AC-SIG-006: Processing time < 5ms per input string

## 接口定义

### Signal Types

```typescript
type SignalType = "keyword" | "errsig" | "errsig_norm" | "opportunity" | "context" | "semantic";

interface Signal {
  type: SignalType;
  value: string;
  hash?: string;       // For errsig types
  weight: number;      // 0.0 - 1.5
}

interface ExtractionResult {
  signals: Signal[];
  normalized_input: string;
  processing_time_ms: number;
}
```

### Main Interface

```python
class SignalExtractor:
    """Extract structured signals from raw error text."""

    ERROR_PATTERNS = {
        'log_error': r'\[\s*error\s*\]|error:|exception:|isError":true',
        'type_error': r'\bTypeError\b',
        'reference_error': r'\bReferenceError\b',
        'timeout': r'\btimeout|timed?\s*out\b',
        'network_error': r'\bECONNREFUSED|ENOTFOUND|network\b',
        'auth_error': r'\bUnauthorized|401|authentication\b',
    }

    def extract_signals(self, text: str) -> ExtractionResult:
        """Extract structured signals from text."""

    def normalize_error_signature(self, text: str) -> str:
        """Normalize error signature by removing noise."""

    def generate_stable_hash(self, text: str) -> str:
        """Generate SHA-256 hash for signal deduplication."""
```

## 实现笔记

### Normalization Algorithm (Pseudocode)

```python
import re
import hashlib

def normalize_error_signature(text: str) -> str:
    """
    Normalize error signature by removing noise.

    Examples:
      "Error at C:\\project\\file.js:123" -> "error at <path>:<n>"
      "Error at /usr/local/app.js:45" -> "error at <path>:<n>"
      "Error 0x1a2b3c4d at line 42" -> "error <hex> at line <n>"
    """
    text = text.lower()

    # Remove Windows paths (C:\...)
    text = re.sub(r'[a-z]:\\[^\s]+', '<path>', text)

    # Remove Unix paths (/...)
    text = re.sub(r'/[^\s]*', '<path>', text)

    # Remove hex values (0x...)
    text = re.sub(r'\b0x[0-9a-f]+\b', '<hex>', text)

    # Remove numbers
    text = re.sub(r'\b\d+\b', '<n>', text)

    # Truncate to 220 characters
    return text[:220]

def generate_stable_hash(text: str) -> str:
    """Generate stable SHA-256 hash for signal deduplication."""
    return hashlib.sha256(text.encode()).hexdigest()[:16]
```

### Signal Extraction Pipeline

```python
class SignalExtractor:
    def extract_signals(self, text: str) -> ExtractionResult:
        """Extract structured signals from text."""
        start = time.time()
        signals = []
        text_lower = text.lower()

        # 1. Keyword signals (weight: 1.0)
        for signal_type, pattern in self.ERROR_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                signals.append(Signal(
                    type='keyword',
                    value=signal_type,
                    weight=1.0
                ))

        # 2. Error signature extraction (weight: 1.5)
        error_matches = self._extract_errors(text)
        for error_match in error_matches:
            normalized = self.normalize_error_signature(error_match)
            signals.append(Signal(
                type='errsig',
                value=normalized,
                hash=self.generate_stable_hash(normalized),
                weight=1.5
            ))

        # 3. Opportunity signals (weight: 0.8)
        opportunity_patterns = {
            'feature_request': r'\b(add|implement|create|build)\b.*\b(feature|function)\b',
            'improvement': r'\b(improve|enhance|optimize|refactor)\b',
        }
        for signal_type, pattern in opportunity_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                signals.append(Signal(
                    type='opportunity',
                    value=signal_type,
                    weight=0.8
                ))

        # 4. Deduplicate by (type, value)
        signals = self._deduplicate(signals)

        processing_time = (time.time() - start) * 1000
        return ExtractionResult(
            signals=signals,
            normalized_input=self.normalize_error_signature(text),
            processing_time_ms=processing_time
        )

    def _deduplicate(self, signals: List[Signal]) -> List[Signal]:
        """Remove duplicate signals by (type, value)."""
        seen = set()
        result = []
        for signal in signals:
            key = (signal.type, signal.value)
            if key not in seen:
                seen.add(key)
                result.append(signal)
        return result
```

## 技术约束

- **Performance**: < 5ms processing time per input string
- **Memory**: Efficient regex compilation (pre-compile patterns)
- **Stability**: Same input always produces same hash

## 验证方式

1. **Unit Tests**: Normalization edge cases (paths, hex, numbers)
2. **Hash Stability Tests**: Verify same input produces same hash
3. **Performance Tests**: Measure extraction time under load
4. **Regression Tests**: Known error signatures produce expected signals

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.1 Signal Extraction Pipeline
- **STORY**: `../../_project/stories/STORY-006-signal-extraction-matching.md`
