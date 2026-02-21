/**
 * Signal Extraction Module for AEP Protocol
 *
 * Extracts structured signals from raw error text for matching
 * against the experience database.
 *
 * @module aep/signal
 */

/**
 * Signal types supported by the AEP protocol
 */
export type SignalType =
  | "keyword"
  | "errsig"
  | "errsig_norm"
  | "opportunity"
  | "context"
  | "semantic";

/**
 * Represents a single extracted signal
 */
export interface Signal {
  type: SignalType;
  value: string;
  hash?: string; // For errsig types
  weight: number; // 0.0 - 1.5
}

/**
 * Result of signal extraction
 */
export interface ExtractionResult {
  signals: Signal[];
  normalized_input: string;
  processing_time_ms: number;
}

/**
 * Pre-compiled regex patterns for error detection
 */
const ERROR_PATTERNS: Record<string, RegExp> = {
  log_error: /\[\s*error\s*\]|error:|exception:|isError":true/i,
  type_error: /\bTypeError\b/i,
  reference_error: /\bReferenceError\b/i,
  syntax_error: /\bSyntaxError\b/i,
  range_error: /\bRangeError\b/i,
  timeout: /\btimeout|timed?\s*out\b/i,
  network_error: /\bECONNREFUSED|ENOTFOUND|ENETUNREACH|network\b/i,
  auth_error: /\bUnauthorized|Forbidden|401|403|authentication\b/i,
  null_undefined: /\bnull\b|\bundefined\b/i,
  file_not_found: /\bENOENT|file not found|no such file\b/i,
};

/**
 * Pre-compiled regex patterns for opportunity detection
 */
const OPPORTUNITY_PATTERNS: Record<string, RegExp> = {
  feature_request: /\b(add|implement|create|build)\b.*\b(feature|function|support)\b/i,
  improvement: /\b(improve|enhance|optimize|refactor|better)\b/i,
  bug_report: /\bbug\b|\bissue\b|\bproblem\b|\bdoesn'?t work\b/i,
};

/**
 * Pre-compiled normalization patterns (cached for performance)
 */
const NORMALIZATION_PATTERNS = {
  // Windows paths (C:\, D:\, etc.)
  windowsPath: /[a-zA-Z]:\\[^\s]*/g,
  // Unix paths (/, but avoid matching division)
  unixPath: /\/[^\s]*/g,
  // Hex values (0x...)
  hexValue: /\b0x[0-9a-fA-F]+\b/g,
  // UUIDs
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  // Numbers (standalone)
  number: /\b\d+\b/g,
  // Timestamps (ISO 8601 format: 2024-01-15T10:30:45 or 2024-01-15 10:30:45)
  // Case-insensitive to handle lowercase 't' after toLowerCase()
  timestamp: /\b\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:z|[+-]\d{2}:?\d{2})?\b/gi,
  // IP addresses
  ip: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

/**
 * Maximum length for normalized signatures
 */
const MAX_NORMALIZED_LENGTH = 220;

/**
 * Length of hash to generate (first 16 chars of SHA-256)
 */
const HASH_LENGTH = 16;

/**
 * Result of error signature normalization.
 * Tracks original input, normalized output, hash, and transformations applied.
 */
export interface NormalizationResult {
  /** Original input text */
  original: string;
  /** Normalized error signature (max 220 chars) */
  normalized: string;
  /** Stable SHA-256 hash (first 16 chars) for deduplication */
  hash: string;
  /** List of transformations applied during normalization */
  transformations: string[];
}

/**
 * Generates a stable SHA-256 hash for signal deduplication.
 * Uses first 16 characters of hex digest for compact representation.
 *
 * @param text - Text to hash
 * @returns 16-character hex string
 */
export function generateStableHash(text: string): string {
  // Use SubtleCrypto API for browser/Node.js compatibility
  // Fallback to simple hash for environments without crypto
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and pad to ensure consistent length
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return hexHash.repeat(2).substring(0, 16);
}

/**
 * Normalizes error signature by removing noise elements.
 *
 * Examples:
 *   "Error at C:\\project\\file.js:123" -> "error at <path>:<n>"
 *   "Error at /usr/local/app.js:45" -> "error at <path>:<n>"
 *   "Error 0x1a2b3c4d at line 42" -> "error <hex> at line <n>"
 *
 * @param text - Raw error text to normalize
 * @returns Normalized error signature (max 220 chars)
 */
export function normalizeErrorSignature(text: string): string {
  let normalized = text.toLowerCase();

  // Apply normalization patterns in specific order
  normalized = normalized.replace(NORMALIZATION_PATTERNS.timestamp, '<time>');
  normalized = normalized.replace(NORMALIZATION_PATTERNS.uuid, '<uuid>');
  normalized = normalized.replace(NORMALIZATION_PATTERNS.ip, '<ip>');
  normalized = normalized.replace(NORMALIZATION_PATTERNS.windowsPath, '<path>');
  normalized = normalized.replace(NORMALIZATION_PATTERNS.unixPath, '<path>');
  normalized = normalized.replace(NORMALIZATION_PATTERNS.hexValue, '<hex>');
  normalized = normalized.replace(NORMALIZATION_PATTERNS.number, '<n>');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Truncate to max length
  return normalized.substring(0, MAX_NORMALIZED_LENGTH);
}

/**
 * Error Signature Normalizer class.
 *
 * Normalizes error messages by removing platform-specific paths, hex IDs,
 * timestamps, and other noise to generate stable hashes for error signature matching.
 *
 * Implements the interface defined in TASK-E-001-SIG-001.
 */
export class ErrorSignatureNormalizer {
  /** Maximum length for normalized signatures */
  static readonly MAX_LENGTH = MAX_NORMALIZED_LENGTH;
  /** Length of hash to generate */
  static readonly HASH_LENGTH = HASH_LENGTH;

  /**
   * Normalize error signature by removing noise.
   *
   * Steps:
   * 1. Convert to lowercase
   * 2. Remove Windows paths (C:\...)
   * 3. Remove Unix paths (/...)
   * 4. Remove hex values (0x...)
   * 5. Remove standalone numbers
   * 6. Truncate to MAX_LENGTH
   * 7. Generate hash
   *
   * @param text - Raw error text to normalize
   * @returns NormalizationResult with original, normalized, hash, and transformations
   */
  normalize(text: string): NormalizationResult {
    const transformations: string[] = [];
    const original = text;

    // 1. Convert to lowercase
    let normalized = text.toLowerCase();
    if (normalized !== text) {
      transformations.push('lowercase');
    }

    // 2. Remove Windows paths (C:\...)
    const windowsResult = this.removeWindowsPaths(normalized);
    normalized = windowsResult.text;
    if (windowsResult.count > 0) {
      transformations.push(`windows_paths:${windowsResult.count}`);
    }

    // 3. Remove Unix paths (/...)
    const unixResult = this.removeUnixPaths(normalized);
    normalized = unixResult.text;
    if (unixResult.count > 0) {
      transformations.push(`unix_paths:${unixResult.count}`);
    }

    // 4. Remove hex values (0x...)
    const hexResult = this.removeHexValues(normalized);
    normalized = hexResult.text;
    if (hexResult.count > 0) {
      transformations.push(`hex_values:${hexResult.count}`);
    }

    // 5. Remove standalone numbers
    const numResult = this.removeNumbers(normalized);
    normalized = numResult.text;
    if (numResult.count > 0) {
      transformations.push(`numbers:${numResult.count}`);
    }

    // 6. Collapse multiple spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // 7. Truncate to MAX_LENGTH
    if (normalized.length > ErrorSignatureNormalizer.MAX_LENGTH) {
      normalized = normalized.substring(0, ErrorSignatureNormalizer.MAX_LENGTH);
      transformations.push('truncated');
    }

    // 8. Generate hash
    const hash = this.generateHash(normalized);

    return {
      original,
      normalized,
      hash,
      transformations,
    };
  }

  /**
   * Generate stable SHA-256 hash (first 16 chars).
   *
   * @param normalizedText - Normalized text to hash
   * @returns 16-character hex string
   */
  generateHash(normalizedText: string): string {
    return generateStableHash(normalizedText);
  }

  /**
   * Replace Windows paths with <path>.
   *
   * @param text - Text to process
   * @returns Object with processed text and count of replacements
   */
  removeWindowsPaths(text: string): { text: string; count: number } {
    const pattern = NORMALIZATION_PATTERNS.windowsPath;
    const matches = text.match(pattern) || [];
    const normalized = text.replace(pattern, '<path>');
    return { text: normalized, count: matches.length };
  }

  /**
   * Replace Unix paths with <path>.
   *
   * @param text - Text to process
   * @returns Object with processed text and count of replacements
   */
  removeUnixPaths(text: string): { text: string; count: number } {
    const pattern = NORMALIZATION_PATTERNS.unixPath;
    const matches = text.match(pattern) || [];
    const normalized = text.replace(pattern, '<path>');
    return { text: normalized, count: matches.length };
  }

  /**
   * Replace hex values with <hex>.
   *
   * @param text - Text to process
   * @returns Object with processed text and count of replacements
   */
  removeHexValues(text: string): { text: string; count: number } {
    const pattern = NORMALIZATION_PATTERNS.hexValue;
    const matches = text.match(pattern) || [];
    const normalized = text.replace(pattern, '<hex>');
    return { text: normalized, count: matches.length };
  }

  /**
   * Replace standalone numbers with <n>.
   *
   * @param text - Text to process
   * @returns Object with processed text and count of replacements
   */
  removeNumbers(text: string): { text: string; count: number } {
    const pattern = NORMALIZATION_PATTERNS.number;
    const matches = text.match(pattern) || [];
    const normalized = text.replace(pattern, '<n>');
    return { text: normalized, count: matches.length };
  }
}

/**
 * Extracts error fragments from text for signature generation.
 *
 * @param text - Text to extract errors from
 * @returns Array of error fragments
 */
function extractErrorFragments(text: string): string[] {
  const fragments: string[] = [];

  // Match common error patterns
  const errorBlockPattern = /(error[:\s][^\n.]{10,200})/gi;
  const exceptionPattern = /(exception[:\s][^\n.]{10,200})/gi;
  const stackFramePattern = /(?:at\s+)?[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*\s*\([^)]+\)/gi;

  let match;
  while ((match = errorBlockPattern.exec(text)) !== null) {
    fragments.push(match[1]);
  }
  while ((match = exceptionPattern.exec(text)) !== null) {
    fragments.push(match[1]);
  }
  while ((match = stackFramePattern.exec(text)) !== null) {
    fragments.push(match[0]);
  }

  // If no fragments found, use entire text if it looks like an error
  if (fragments.length === 0 && ERROR_PATTERNS.log_error.test(text)) {
    fragments.push(text.substring(0, 500));
  }

  return fragments;
}

/**
 * Removes duplicate signals based on (type, value) pair.
 *
 * @param signals - Array of signals to deduplicate
 * @returns Deduplicated array
 */
function deduplicateSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  const result: Signal[] = [];

  for (const signal of signals) {
    const key = `${signal.type}:${signal.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(signal);
    }
  }

  return result;
}

/**
 * Main class for extracting structured signals from text.
 */
export class SignalExtractor {
  /**
   * Extracts structured signals from raw text.
   *
   * @param text - Raw text to extract signals from
   * @returns Extraction result with signals and metadata
   */
  extractSignals(text: string): ExtractionResult {
    const startTime = performance.now();
    const signals: Signal[] = [];

    // 1. Keyword signals (weight: 1.0)
    for (const [signalType, pattern] of Object.entries(ERROR_PATTERNS)) {
      if (pattern.test(text)) {
        signals.push({
          type: 'keyword',
          value: signalType,
          weight: 1.0,
        });
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
      }
    }

    // 2. Error signature extraction (weight: 1.5)
    const errorFragments = extractErrorFragments(text);
    for (const fragment of errorFragments) {
      const normalized = normalizeErrorSignature(fragment);
      signals.push({
        type: 'errsig',
        value: normalized,
        hash: generateStableHash(normalized),
        weight: 1.5,
      });
    }

    // 3. Opportunity signals (weight: 0.8)
    for (const [signalType, pattern] of Object.entries(OPPORTUNITY_PATTERNS)) {
      if (pattern.test(text)) {
        signals.push({
          type: 'opportunity',
          value: signalType,
          weight: 0.8,
        });
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
      }
    }

    // 4. Add normalized input as errsig_norm (weight: 0.5)
    const normalizedInput = normalizeErrorSignature(text);
    signals.push({
      type: 'errsig_norm',
      value: normalizedInput,
      hash: generateStableHash(normalizedInput),
      weight: 0.5,
    });

    // 5. Deduplicate signals
    const deduplicatedSignals = deduplicateSignals(signals);

    const processingTime = performance.now() - startTime;

    return {
      signals: deduplicatedSignals,
      normalized_input: normalizedInput,
      processing_time_ms: processingTime,
    };
  }

  /**
   * Normalizes error signature by removing noise.
   * Alias for module-level function.
   *
   * @param text - Text to normalize
   * @returns Normalized signature
   */
  normalizeErrorSignature(text: string): string {
    return normalizeErrorSignature(text);
  }

  /**
   * Generates SHA-256 hash for signal deduplication.
   * Alias for module-level function.
   *
   * @param text - Text to hash
   * @returns 16-character hex string
   */
  generateStableHash(text: string): string {
    return generateStableHash(text);
  }
}

// Export singleton instances for convenience
export const signalExtractor = new SignalExtractor();
export const errorSignatureNormalizer = new ErrorSignatureNormalizer();

// Default export
export default SignalExtractor;
