# TASK-E-001-SIG-001: Error Signature Normalizer

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-006
> **Status:** done
> **Beads 任务ID:** agent network-u51
> **依赖:** []

## 摘要

Implement the Error Signature Normalizer that standardizes error messages by removing platform-specific paths, hex IDs, timestamps, and other noise. Generates stable hashes for error signature matching.

## 验收标准

- [x] AC-NORM-001: Removes Windows paths (C:\...) -> <path>
- [x] AC-NORM-002: Removes Unix paths (/...) -> <path>
- [x] AC-NORM-003: Removes hex values (0x...) -> <hex>
- [x] AC-NORM-004: Removes line numbers -> <n>
- [x] AC-NORM-005: Converts to lowercase
- [x] AC-NORM-006: Truncates to 220 characters
- [x] AC-NORM-007: Generates SHA-256 hash (first 16 chars) for stable identification
- [x] AC-NORM-008: Same normalized input always produces same hash

## 接口定义

### Normalizer Interface

```python
@dataclass
class NormalizationResult:
    original: str
    normalized: str
    hash: str
    transformations: List[str]

class ErrorSignatureNormalizer:
    """Normalize error signatures for matching."""

    MAX_LENGTH = 220
    HASH_LENGTH = 16

    def normalize(self, text: str) -> NormalizationResult:
        """Normalize error signature."""

    def generate_hash(self, normalized_text: str) -> str:
        """Generate stable SHA-256 hash."""

    def remove_windows_paths(self, text: str) -> str:
        """Replace Windows paths with <path>."""

    def remove_unix_paths(self, text: str) -> str:
        """Replace Unix paths with <path>."""

    def remove_hex_values(self, text: str) -> str:
        """Replace hex values with <hex>."""

    def remove_numbers(self, text: str) -> str:
        """Replace standalone numbers with <n>."""
```

## 实现笔记

### Error Signature Normalizer (Pseudocode)

```python
import re
import hashlib
from typing import List

class ErrorSignatureNormalizer:
    """Normalize error signatures for matching."""

    MAX_LENGTH = 220
    HASH_LENGTH = 16

    def normalize(self, text: str) -> NormalizationResult:
        """
        Normalize error signature by removing noise.

        Steps:
        1. Convert to lowercase
        2. Remove Windows paths (C:\...)
        3. Remove Unix paths (/...)
        4. Remove hex values (0x...)
        5. Remove standalone numbers
        6. Truncate to MAX_LENGTH
        7. Generate hash
        """
        transformations = []
        original = text

        # 1. Convert to lowercase
        text = text.lower()
        if text != original.lower():
            transformations.append("lowercase")

        # 2. Remove Windows paths (C:\...)
        text, count = self.remove_windows_paths(text)
        if count > 0:
            transformations.append(f"windows_paths:{count}")

        # 3. Remove Unix paths (/...)
        text, count = self.remove_unix_paths(text)
        if count > 0:
            transformations.append(f"unix_paths:{count}")

        # 4. Remove hex values (0x...)
        text, count = self.remove_hex_values(text)
        if count > 0:
            transformations.append(f"hex_values:{count}")

        # 5. Remove standalone numbers
        text, count = self.remove_numbers(text)
        if count > 0:
            transformations.append(f"numbers:{count}")

        # 6. Truncate
        if len(text) > self.MAX_LENGTH:
            text = text[:self.MAX_LENGTH]
            transformations.append("truncated")

        # 7. Generate hash
        hash_value = self.generate_hash(text)

        return NormalizationResult(
            original=original,
            normalized=text,
            hash=hash_value,
            transformations=transformations
        )

    def generate_hash(self, normalized_text: str) -> str:
        """Generate stable SHA-256 hash (first 16 chars)."""
        return hashlib.sha256(normalized_text.encode()).hexdigest()[:self.HASH_LENGTH]

    def remove_windows_paths(self, text: str) -> Tuple[str, int]:
        """Replace Windows paths with <path>."""
        pattern = r'[a-z]:\\[^\s]+'
        matches = re.findall(pattern, text, re.IGNORECASE)
        text = re.sub(pattern, '<path>', text, flags=re.IGNORECASE)
        return text, len(matches)

    def remove_unix_paths(self, text: str) -> Tuple[str, int]:
        """Replace Unix paths with <path>."""
        pattern = r'/[^\s]*'
        matches = re.findall(pattern, text)
        text = re.sub(pattern, '<path>', text)
        return text, len(matches)

    def remove_hex_values(self, text: str) -> Tuple[str, int]:
        """Replace hex values with <hex>."""
        pattern = r'\b0x[0-9a-f]+\b'
        matches = re.findall(pattern, text, re.IGNORECASE)
        text = re.sub(pattern, '<hex>', text, flags=re.IGNORECASE)
        return text, len(matches)

    def remove_numbers(self, text: str) -> Tuple[str, int]:
        """Replace standalone numbers with <n>."""
        pattern = r'\b\d+\b'
        matches = re.findall(pattern, text)
        text = re.sub(pattern, '<n>', text)
        return text, len(matches)
```

### Normalization Examples

| Original Error | Normalized | Hash |
|---------------|------------|------|
| `Error at C:\Users\John\project\file.js:123` | `error at <path>:<n>` | `a1b2c3d4e5f6g7h8` |
| `TypeError: Cannot read property 'foo' of undefined` | `typeerror: cannot read property 'foo' of undefined` | `9i8h7g6f5e4d3c2b` |
| `Exception at /usr/local/app.js:45 with id 0x1a2b` | `exception at <path>:<n> with id <hex>` | `x9y8z7w6v5u4t3s2` |
| `Failed to connect to database at localhost:5432` | `failed to connect to database at localhost:<n>` | `r1q2p3o4n5m6l7k8` |
| `Timeout after 30000ms waiting for response from 192.168.1.1` | `timeout after <n>ms waiting for response from <n>.<n>.<n>.<n>` | `j9k8l7m6n5o4p3q2` |

### Path Patterns

```python
# Windows paths
r'[a-z]:\\[^\s]+'           # C:\Users\John\file.js
r'\\[^\s]+'                  # \network\share\file.txt

# Unix paths
r'/[^\s]*'                   # /usr/local/bin/app
r'~/[^\s]+'                  # ~/Documents/file.txt

# URLs (partial - for error messages)
r'https?://[^\s]+'           # http://example.com/api
```

### Hex Patterns

```python
# Hex values
r'\b0x[0-9a-f]+\b'          # 0x1a2b3c4d
r'\b[0-9a-f]{8,}\b'          # Long hex strings (addresses)
```

## 技术约束

- **Idempotency**: Same input always produces same output
- **Length**: Truncate to 220 chars to prevent excessive storage
- **Hash**: Use first 16 chars of SHA-256 for compact storage

## 验证方式

1. **Unit Tests**: Each normalization step independently
2. **Hash Stability Tests**: Verify same input -> same hash
3. **Path Removal Tests**: Windows/Unix path patterns
4. **Edge Cases**: Empty string, very long strings

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §3.1 Signal Extraction Pipeline
- **STORY**: `../../_project/stories/STORY-006-signal-extraction-matching.md`

## 实现记录

### 实现概述

在 `src/aep/signal/index.ts` 中新增 `ErrorSignatureNormalizer` 类，提供完整的错误签名标准化功能。

### 新增接口

```typescript
interface NormalizationResult {
  original: string;      // 原始输入
  normalized: string;    // 标准化后的签名（最大 220 字符）
  hash: string;          // 稳定的 SHA-256 哈希（前 16 字符）
  transformations: string[];  // 应用的变换列表
}
```

### 新增类

```typescript
class ErrorSignatureNormalizer {
  static readonly MAX_LENGTH = 220;
  static readonly HASH_LENGTH = 16;

  normalize(text: string): NormalizationResult;
  generateHash(normalizedText: string): string;
  removeWindowsPaths(text: string): { text: string; count: number };
  removeUnixPaths(text: string): { text: string; count: number };
  removeHexValues(text: string): { text: string; count: number };
  removeNumbers(text: string): { text: string; count: number };
}
```

### 标准化流程

1. **小写转换** - 统一转换为小写
2. **Windows 路径移除** - `C:\...` -> `<path>`
3. **Unix 路径移除** - `/...` -> `<path>`
4. **十六进制值移除** - `0x...` -> `<hex>`
5. **独立数字移除** - `\d+` -> `<n>`
6. **空格压缩** - 多个空格压缩为单个
7. **长度截断** - 超过 220 字符截断
8. **哈希生成** - 生成 16 字符稳定哈希

### 测试覆盖

- 87 个测试用例全部通过
- 覆盖所有 8 个验收标准（AC-NORM-001 到 AC-NORM-008）
- 包含边界情况测试（空字符串、超长字符串、特殊字符、Unicode）
- 包含幂等性测试（重复标准化产生相同结果）

### 文件变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/aep/signal/index.ts` | 修改 | 新增 `ErrorSignatureNormalizer` 类和 `NormalizationResult` 接口 |
| `src/aep/signal/__tests__/signalExtractor.test.ts` | 修改 | 新增 40+ 个测试用例覆盖 ErrorSignatureNormalizer |

## 测试记录

### 测试命令

```bash
npm run test -- --run --reporter=verbose src/aep/signal/__tests__/signalExtractor.test.ts
```

### 测试结果

- **测试文件**: 1 passed
- **测试用例**: 87 passed
- **持续时间**: ~800ms

### AC 验证结果

| AC ID | 描述 | 测试用例 | 状态 |
|-------|------|----------|------|
| AC-NORM-001 | Windows 路径移除 | 4 个测试用例 | PASS |
| AC-NORM-002 | Unix 路径移除 | 3 个测试用例 | PASS |
| AC-NORM-003 | 十六进制值移除 | 4 个测试用例 | PASS |
| AC-NORM-004 | 行号移除 | 3 个测试用例 | PASS |
| AC-NORM-005 | 小写转换 | 2 个测试用例 | PASS |
| AC-NORM-006 | 220 字符截断 | 3 个测试用例 | PASS |
| AC-NORM-007 | SHA-256 哈希生成 | 4 个测试用例 | PASS |
| AC-NORM-008 | 哈希稳定性 | 3 个测试用例 | PASS |

