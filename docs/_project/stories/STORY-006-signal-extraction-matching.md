# STORY-006: Signal Extraction & Matching

> **EPIC_ID:** E-001
>
> **EPIC_DIR:** E-001-AEP-Protocol
>
> **PRD Reference:** `../prd-v0.md#f6-signal-extraction-matching`
>
> **Status:** Draft
>
> **Priority:** P0 - Blocking
>
> **Story Type:** Backend Service

---

## User Story

**As an** Agent,

**I want** the Hub to understand my problem from natural language,

**So that** I don't have to learn a complex query syntax.

---

## Background & Motivation

Agents encounter problems in various forms: error messages, stack traces, log entries, natural language descriptions. The signal extraction system converts these diverse inputs into structured signals that can be matched against the experience database. Good signal extraction is critical for fetch relevance.

---

## Main Path (Happy Path)

### Step 1: Raw Input Processing

1. Agent sends fetch request with `signals` array
2. Signals may include: keywords, error messages, stack traces
3. Hub receives raw signal strings

### Step 2: Signal Extraction

1. Hub extracts keywords from text
2. Hub identifies error patterns (TypeError, ReferenceError, etc.)
3. Hub normalizes error signatures (removes paths, numbers)
4. Hub generates signal hashes for indexing

### Step 3: Signal Matching

1. Hub queries inverted index for exact matches
2. Hub queries vector index for semantic matches
3. Hub applies context weighting (domain, model compatibility)
4. Hub combines and deduplicates results

### Step 4: Result Ranking

1. Hub calculates match scores
2. Hub sorts by GDI score (descending)
3. Hub returns top N results

---

## State Machine

### Signal Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Signal Processing Pipeline                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │  Raw Input     │─────▶│  Signal         │─────▶│  Signal         │    │
│  │  (text/json)   │      │  Extraction     │      │  Normalization  │    │
│  └────────────────┘      └─────────────────┘      └─────────────────┘    │
│                                                           │                │
│                                                           ▼                │
│  ┌────────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │  Matched       │◀─────│  Index          │◀─────│  Signal         │    │
│  │  Experiences   │      │  Lookup         │      │  Hashing        │    │
│  └────────────────┘      └─────────────────┘      └─────────────────┘    │
│          │                                                                 │
│          ▼                                                                 │
│  ┌────────────────┐      ┌─────────────────┐                             │
│  │  Ranked        │◀─────│  Context        │                             │
│  │  Results       │      │  Weighting      │                             │
│  └────────────────┘      └─────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Signal Types

### Signal Taxonomy

| Type | Format | Weight | Example |
|------|--------|--------|---------|
| keyword | `keyword:{word}` | 1.0 | `keyword:timeout` |
| errsig | `errsig:{hash}` | 1.5 | `errsig:a1b2c3d4` |
| errsig_norm | `errsig_norm:{hash}` | 1.3 | Normalized error signature |
| opportunity | `opportunity:{type}` | 0.8 | `opportunity:feature_request` |
| context | `context:{domain}` | 0.6 | `context:api` |
| semantic | `semantic:{vector_hash}` | 1.0 | Vector embedding match |

### Error Patterns

| Pattern | Regex | Description |
|---------|-------|-------------|
| log_error | `\[\s*error\s*\]|error:|exception:|isError":true` | Log error markers |
| type_error | `\bTypeError\b` | JavaScript TypeError |
| reference_error | `\bReferenceError\b` | JavaScript ReferenceError |
| timeout | `\btimeout|timed?\s*out\b` | Timeout-related errors |
| network_error | `\bECONNREFUSED|ENOTFOUND|network\b` | Network-related errors |
| auth_error | `\bUnauthorized|401|authentication\b` | Authentication errors |

---

## Acceptance Criteria (AC)

### Functional AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-6.1 | Extract keywords from error messages | Unit test: Parse "TypeError: foo is not a function" |
| AC-6.2 | Normalize error signatures (remove paths) | Unit test: "Error at C:\foo\bar.js:123" -> "Error at <path>:<n>" |
| AC-6.3 | Generate stable hash for normalized signatures | Unit test: Same error -> same hash |
| AC-6.4 | Support semantic matching via embeddings | Integration test: Similar meaning returns match |
| AC-6.5 | Combine exact + semantic matches | Integration test: Verify both used |
| AC-6.6 | Return relevant experiences within 100ms | Performance test: End-to-end latency |

### Matching Quality AC

| ID | Criteria | Test Method |
|----|----------|-------------|
| AC-6.7 | Exact error signature match returns correct experience | Integration test: Known error signature |
| AC-6.8 | Semantic similarity >= 0.75 considered match | Integration test: Similar descriptions |
| AC-6.9 | Jaccard similarity >= 0.34 considered match | Integration test: Overlapping keywords |
| AC-6.10 | Context weighting improves relevance | A/B test: With/without context |

---

## Technical Notes

### Signal Extraction Implementation

```python
import re
import hashlib
from typing import List

class SignalExtractor:
    """Signal extraction from natural language and structured text."""

    # Error patterns for signal detection
    ERROR_PATTERNS = {
        'log_error': r'\[\s*error\s*\]|error:|exception:|isError":true',
        'type_error': r'\bTypeError\b',
        'reference_error': r'\bReferenceError\b',
        'timeout': r'\btimeout|timed?\s*out\b',
        'network_error': r'\bECONNREFUSED|ENOTFOUND|network\b',
        'auth_error': r'\bUnauthorized|401|authentication\b',
    }

    # Opportunity patterns
    OPPORTUNITY_PATTERNS = {
        'feature_request': r'\b(add|implement|create|build)\b.*\b(feature|function)\b',
        'improvement': r'\b(improve|enhance|optimize|refactor)\b',
        'perf_bottleneck': r'\b(slow|timeout|latency|bottleneck)\b',
    }

    def extract_signals(self, text: str) -> List[Signal]:
        """Extract structured signals from text."""
        signals = []
        text_lower = text.lower()

        # 1. Keyword signals
        for signal_type, pattern in self.ERROR_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                signals.append(Signal(
                    type='keyword',
                    value=signal_type,
                    weight=1.0
                ))

        # 2. Error signature extraction
        error_matches = self._extract_errors(text)
        for error_match in error_matches:
            normalized = self.normalize_error_signature(error_match)
            signals.append(Signal(
                type='errsig',
                value=normalized,
                hash=self._stable_hash(normalized),
                weight=1.5
            ))

        # 3. Opportunity signals
        for signal_type, pattern in self.OPPORTUNITY_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                signals.append(Signal(
                    type='opportunity',
                    value=signal_type,
                    weight=0.8
                ))

        # 4. Semantic expansion (optional)
        signals.extend(self._semantic_expand(text))

        return self._deduplicate(signals)

    def normalize_error_signature(self, text: str) -> str:
        """
        Normalize error signature by removing noise.

        Example:
          "Error at C:\\project\\file.js:123" -> "error at <path>:<n>"
        """
        text = text.lower()

        # Remove Windows paths
        text = re.sub(r'[a-z]:\\[^\s]+', '<path>', text)

        # Remove Unix paths
        text = re.sub(r'/[^\s]+', '<path>', text)

        # Remove hex values
        text = re.sub(r'\b0x[0-9a-f]+\b', '<hex>', text)

        # Remove numbers
        text = re.sub(r'\b\d+\b', '<n>', text)

        # Truncate to reasonable length
        return text[:220]

    def _stable_hash(self, text: str) -> str:
        """Generate stable hash for signal deduplication."""
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    def _extract_errors(self, text: str) -> List[str]:
        """Extract error messages from text."""
        # Match common error patterns
        patterns = [
            r'(Error:.*?)(?=\n|$)',
            r'(Exception:.*?)(?=\n|$)',
            r'(TypeError:.*?)(?=\n|$)',
            r'(ReferenceError:.*?)(?=\n|$)',
        ]

        errors = []
        for pattern in patterns:
            matches = re.findall(pattern, text)
            errors.extend(matches)

        return errors

    def _semantic_expand(self, text: str) -> List[Signal]:
        """Expand signals using semantic similarity."""
        # Placeholder for embedding-based expansion
        # In MVP, return empty list
        return []

    def _deduplicate(self, signals: List[Signal]) -> List[Signal]:
        """Remove duplicate signals."""
        seen = set()
        result = []
        for signal in signals:
            key = (signal.type, signal.value)
            if key not in seen:
                seen.add(key)
                result.append(signal)
        return result
```

### Matching Algorithm

```python
class ExperienceMatcher:
    """Match signals against experience database."""

    def match(self, signals: List[Signal], limit: int = 5) -> List[MatchResult]:
        """Find matching experiences."""
        candidates = []

        # 1. Exact match via inverted index
        exact_matches = self._exact_match(signals)
        candidates.extend(exact_matches)

        # 2. Semantic match via vector similarity
        if len(candidates) < limit:
            semantic_matches = self._semantic_match(signals)
            candidates.extend(semantic_matches)

        # 3. Deduplicate and combine scores
        candidates = self._deduplicate(candidates)

        # 4. Rank by GDI score
        ranked = sorted(candidates, key=lambda x: x.gdi_score, reverse=True)

        return ranked[:limit]

    def _exact_match(self, signals: List[Signal]) -> List[MatchResult]:
        """Exact signal matching via inverted index."""
        signal_keys = [s.to_key() for s in signals]

        # Query inverted index
        exp_ids = self.index.multi_query(signal_keys)

        results = []
        for exp_id in exp_ids:
            exp = self.store.get(exp_id)
            score = self._compute_match_score(signals, exp)
            results.append(MatchResult(
                experience=exp,
                score=score,
                match_type='exact'
            ))

        return results

    def _semantic_match(self, signals: List[Signal]) -> List[MatchResult]:
        """Semantic matching via vector similarity."""
        # Get query embedding
        query_text = ' '.join(s.value for s in signals)
        query_embedding = self.embedding_model.encode(query_text)

        # Query vector index
        results = self.vector_store.query(
            query_embedding,
            threshold=0.75,
            limit=20
        )

        return [MatchResult(exp=r, score=r.similarity, match_type='semantic')
                for r in results]

    def _compute_match_score(self, signals: List[Signal], exp: Experience) -> float:
        """Compute match score for exact matches."""
        score = 0.0

        for signal in signals:
            # Signal in trigger
            if signal.matches(exp.trigger):
                score += signal.weight

            # Signal in signals_match
            if signal.in_list(exp.signals_match):
                score += signal.weight * 0.8

        # Jaccard similarity
        signal_set = set(s.to_key() for s in signals)
        exp_set = set(exp.signals_match)
        if signal_set or exp_set:
            jaccard = len(signal_set & exp_set) / len(signal_set | exp_set)
            if jaccard >= 0.34:
                score += jaccard

        return score
```

### Index Schema

```sql
-- Inverted index for signal matching
CREATE TABLE signal_index (
    signal_key VARCHAR(128) NOT NULL,
    experience_id UUID NOT NULL REFERENCES experiences(id),
    weight DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (signal_key, experience_id),
    INDEX idx_signal_key (signal_key)
);

-- Vector index for semantic matching (pgvector)
CREATE TABLE experience_embeddings (
    experience_id UUID PRIMARY KEY REFERENCES experiences(id),
    trigger_embedding VECTOR(1536),
    solution_embedding VECTOR(1536),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create vector index
CREATE INDEX idx_trigger_embedding ON experience_embeddings
    USING ivfflat (trigger_embedding vector_cosine_ops);
```

---

## Boundary & Exception Cases

### Empty Input

- **Scenario:** Agent sends empty signals array
- **Behavior:** Return 400 Bad Request with error message

### No Matches

- **Scenario:** No experiences match any signals
- **Behavior:** Return 200 OK with empty array and suggestion

### Too Many Signals

- **Scenario:** Agent sends > 50 signals
- **Behavior:** Truncate to 50, log warning

### Malformed Input

- **Scenario:** Signals contain special characters or SQL
- **Behavior:** Sanitize input, reject if invalid

### Unicode/International

- **Scenario:** Signals contain non-ASCII characters
- **Behavior:** Normalize to UTF-8, support Chinese error messages

---

## Dependencies

| Story | Dependency Type | Description |
|-------|----------------|-------------|
| STORY-002 | Upstream | Fetch uses signal matching for results |
| STORY-003 | Upstream | Publish stores signals for indexing |
| STORY-005 | Data | Matched results ranked by GDI score |

---

## UI Evidence

**Prototype:** `/docs/E-001-AEP-Protocol/prototypes/hub-explorer.html`

**Key Interaction:**
- Search box accepts natural language queries
- Filter tags show extracted signals
- Results match on multiple signal types
- Experience detail shows `signals_match` array

---

## Implementation Notes

### Performance Targets

| Metric | Target |
|--------|--------|
| Signal extraction time | < 5ms |
| Exact match query | < 20ms |
| Semantic match query | < 50ms |
| Total matching time | < 100ms |

### Embedding Model Options

| Model | Dimensions | Speed | Quality |
|-------|------------|-------|---------|
| OpenAI text-embedding-3-small | 1536 | Fast | Good |
| OpenAI text-embedding-3-large | 3072 | Medium | Excellent |
| local sentence-transformers | 384 | Very Fast | Good |

---

## Open Questions

| ID | Question | Owner | Target Date |
|----|----------|-------|-------------|
| [OPEN-6.1] | Which embedding model for semantic search? | Tech | 2026-02-28 |
| [OPEN-6.2] | Pre-compute embeddings or on-demand? | Tech | 2026-02-28 |
| [OPEN-6.3] | Should we support custom signal types? | Product | 2026-02-25 |
| [OPEN-6.4] | Multi-language support for error messages? | Product | 2026-02-25 |

---

## References

- **Biz-Overview:** `/docs/_project/biz-overview.md` §11.3 Request Understanding Layer
- **PRD:** `../prd-v0.md#f6-signal-extraction-matching`
- **pgvector:** https://github.com/pgvector/pgvector

---

*Last Updated: 2026-02-21*
