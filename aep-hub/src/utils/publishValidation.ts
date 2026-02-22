import { Request } from 'express';
import {
  PublishRequest,
  PublishPayload,
  ErrorResponse,
  PublishValidationErrorResponse,
} from '../types';

/**
 * Publish validation error codes
 */
export const PublishValidationErrorCodes = {
  INVALID_PROTOCOL: 'invalid_protocol',
  INVALID_TYPE: 'invalid_type',
  INVALID_VERSION: 'invalid_version',
  MISSING_FIELD: 'missing_field',
  UNAUTHORIZED: 'unauthorized',
} as const;

/**
 * Field validation constraints
 */
export const PUBLISH_CONSTRAINTS = {
  TRIGGER_MIN_LEN: 10,
  TRIGGER_MAX_LEN: 500,
  SOLUTION_MIN_LEN: 20,
  SOLUTION_MAX_LEN: 10000,
  SIGNALS_MAX_COUNT: 20,
  CONTEXT_MAX_KEYS: 10,
  CONFIDENCE_MIN: 0.0,
  CONFIDENCE_MAX: 1.0,
} as const;

/**
 * Sanitization patterns for script injection detection
 */
const UNSAFE_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:\s*text\/html/i,
];

/**
 * Validates semver format (major.minor.patch)
 */
function isValidSemver(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  return semverRegex.test(version);
}

/**
 * Validates ISO 8601 timestamp format
 */
function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && timestamp === date.toISOString();
}

/**
 * Validates trigger field
 */
function validateTrigger(trigger: unknown): string[] {
  const errors: string[] = [];

  if (!trigger || typeof trigger !== 'string') {
    errors.push('trigger is required');
    return errors;
  }

  const length = trigger.length;
  if (length < PUBLISH_CONSTRAINTS.TRIGGER_MIN_LEN) {
    errors.push(`trigger must be at least ${PUBLISH_CONSTRAINTS.TRIGGER_MIN_LEN} characters`);
  } else if (length > PUBLISH_CONSTRAINTS.TRIGGER_MAX_LEN) {
    errors.push(`trigger must be at most ${PUBLISH_CONSTRAINTS.TRIGGER_MAX_LEN} characters`);
  }

  return errors;
}

/**
 * Validates solution field with sanitization
 */
function validateSolution(solution: unknown): string[] {
  const errors: string[] = [];

  if (!solution || typeof solution !== 'string') {
    errors.push('solution is required');
    return errors;
  }

  const length = solution.length;
  if (length < PUBLISH_CONSTRAINTS.SOLUTION_MIN_LEN) {
    errors.push(`solution must be at least ${PUBLISH_CONSTRAINTS.SOLUTION_MIN_LEN} characters`);
  } else if (length > PUBLISH_CONSTRAINTS.SOLUTION_MAX_LEN) {
    errors.push(`solution must be at most ${PUBLISH_CONSTRAINTS.SOLUTION_MAX_LEN} characters`);
  }

  // Check for unsafe patterns (script injection detection)
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(solution)) {
      errors.push('solution contains potentially unsafe content');
      break;
    }
  }

  return errors;
}

/**
 * Validates confidence field
 */
function validateConfidence(confidence: unknown): string[] {
  const errors: string[] = [];

  if (typeof confidence !== 'number' || isNaN(confidence)) {
    errors.push('confidence must be a number');
    return errors;
  }

  if (confidence < PUBLISH_CONSTRAINTS.CONFIDENCE_MIN ||
      confidence > PUBLISH_CONSTRAINTS.CONFIDENCE_MAX) {
    errors.push('confidence must be between 0.0 and 1.0');
  }

  return errors;
}

/**
 * Validates signals_match array
 */
function validateSignalsMatch(signals: unknown): string[] {
  const errors: string[] = [];

  if (signals === undefined || signals === null) {
    return errors;
  }

  if (!Array.isArray(signals)) {
    errors.push('signals_match must be an array');
    return errors;
  }

  if (signals.length > PUBLISH_CONSTRAINTS.SIGNALS_MAX_COUNT) {
    errors.push(`signals_match must have at most ${PUBLISH_CONSTRAINTS.SIGNALS_MAX_COUNT} items`);
  }

  // Validate each signal is non-empty string
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (typeof signal !== 'string') {
      errors.push(`signals_match[${i}] must be a string`);
    } else if (!signal.trim()) {
      errors.push(`signals_match[${i}] cannot be empty`);
    }
  }

  return errors;
}

/**
 * Validates context object
 */
function validateContext(context: unknown): string[] {
  const errors: string[] = [];

  if (context === undefined || context === null) {
    return errors;
  }

  if (typeof context !== 'object' || Array.isArray(context)) {
    errors.push('context must be an object');
    return errors;
  }

  const keys = Object.keys(context as Record<string, unknown>);
  if (keys.length > PUBLISH_CONSTRAINTS.CONTEXT_MAX_KEYS) {
    errors.push(`context must have at most ${PUBLISH_CONSTRAINTS.CONTEXT_MAX_KEYS} keys`);
  }

  return errors;
}

/**
 * Validates blast_radius object
 */
function validateBlastRadius(blastRadius: unknown): string[] {
  const errors: string[] = [];

  if (blastRadius === undefined || blastRadius === null) {
    return errors;
  }

  if (typeof blastRadius !== 'object' || Array.isArray(blastRadius)) {
    errors.push('blast_radius must be an object');
    return errors;
  }

  const br = blastRadius as Record<string, unknown>;

  // Validate 'files' field
  if (!('files' in br)) {
    errors.push("blast_radius must contain 'files' field");
  } else if (typeof br.files !== 'number' || !Number.isInteger(br.files) || br.files < 0) {
    errors.push('blast_radius.files must be a non-negative integer');
  }

  // Validate 'lines' field
  if (!('lines' in br)) {
    errors.push("blast_radius must contain 'lines' field");
  } else if (typeof br.lines !== 'number' || !Number.isInteger(br.lines) || br.lines < 0) {
    errors.push('blast_radius.lines must be a non-negative integer');
  }

  return errors;
}

/**
 * Validates gene field
 */
function validateGene(gene: unknown): string[] {
  const errors: string[] = [];

  if (gene === undefined || gene === null) {
    return errors;
  }

  if (typeof gene !== 'string') {
    errors.push('gene must be a string');
    return errors;
  }

  if (!gene.trim()) {
    errors.push('gene cannot be empty');
  }

  return errors;
}

/**
 * Validates the AEP envelope structure for publish request
 * Returns validation result with errors grouped by field
 */
export function validatePublishRequest(body: unknown):
  { valid: true; request: PublishRequest } |
  { valid: false; error: ErrorResponse | PublishValidationErrorResponse } {

  // Check if body exists
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.MISSING_FIELD,
        message: 'Request body is required',
      },
    };
  }

  const envelope = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate protocol field
  if (envelope.protocol !== 'aep') {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.INVALID_PROTOCOL,
        message: `Invalid protocol: '${envelope.protocol}'. Must be 'aep'`,
      },
    };
  }

  // Validate type field
  if (envelope.type !== 'publish') {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.INVALID_TYPE,
        message: `Invalid type: '${envelope.type}'. Must be 'publish'`,
      },
    };
  }

  // Validate version field
  if (typeof envelope.version !== 'string' || !isValidSemver(envelope.version)) {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.INVALID_VERSION,
        message: `Invalid version: '${envelope.version}'. Must be valid semver (e.g., 1.0.0)`,
      },
    };
  }

  // Validate sender (must be present for publish)
  if (typeof envelope.sender !== 'string' || !envelope.sender) {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.MISSING_FIELD,
        message: 'sender is required for publish request',
      },
    };
  }

  // Validate timestamp
  if (typeof envelope.timestamp !== 'string' || !isValidTimestamp(envelope.timestamp)) {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.MISSING_FIELD,
        message: 'Invalid or missing timestamp. Must be valid ISO 8601 format',
      },
    };
  }

  // Validate payload exists
  if (!envelope.payload || typeof envelope.payload !== 'object') {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.MISSING_FIELD,
        message: 'Payload is required',
      },
    };
  }

  const payload = envelope.payload as Record<string, unknown>;

  // Validate payload fields
  errors.push(...validateTrigger(payload.trigger));
  errors.push(...validateSolution(payload.solution));
  errors.push(...validateConfidence(payload.confidence));

  if (payload.signals_match !== undefined) {
    errors.push(...validateSignalsMatch(payload.signals_match));
  }

  if (payload.gene !== undefined) {
    errors.push(...validateGene(payload.gene));
  }

  if (payload.context !== undefined) {
    errors.push(...validateContext(payload.context));
  }

  if (payload.blast_radius !== undefined) {
    errors.push(...validateBlastRadius(payload.blast_radius));
  }

  // If there are validation errors, return them grouped by field
  if (errors.length > 0) {
    const field_errors: Record<string, string[]> = {};

    for (const error of errors) {
      // Extract field name from error message
      const fieldMatch = error.match(/^(\w+)/);
      const field = fieldMatch ? fieldMatch[1] : 'general';

      if (!field_errors[field]) {
        field_errors[field] = [];
      }
      field_errors[field].push(error);
    }

    return {
      valid: false,
      error: {
        error: 'validation_error',
        message: 'Validation failed',
        field_errors,
      },
    };
  }

  // Construct validated request
  const validRequest: PublishRequest = {
    protocol: 'aep',
    version: envelope.version,
    type: 'publish',
    sender: envelope.sender,
    timestamp: envelope.timestamp,
    payload: {
      trigger: payload.trigger as string,
      solution: payload.solution as string,
      confidence: payload.confidence as number,
      signals_match: payload.signals_match as string[] | undefined,
      gene: payload.gene as string | undefined,
      context: payload.context as Record<string, unknown> | undefined,
      blast_radius: payload.blast_radius as { files: number; lines: number } | undefined,
    },
  };

  return { valid: true, request: validRequest };
}

/**
 * Extract agent ID from Authorization header
 */
export function extractAgentId(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Trim the header
  const trimmed = authHeader.trim();

  // Support both "Bearer agent_xxx" and "agent_xxx" formats
  if (trimmed.startsWith('Bearer ')) {
    return trimmed.substring(7).trim() || null;
  }

  return trimmed || null;
}

/**
 * Validates authorization for publish request
 */
export function validatePublishAuthorization(req: Request):
  { valid: true; agentId: string } |
  { valid: false; error: ErrorResponse } {

  const authHeader = req.headers.authorization;
  const agentId = extractAgentId(authHeader);

  if (!agentId) {
    return {
      valid: false,
      error: {
        error: PublishValidationErrorCodes.UNAUTHORIZED,
        message: 'Missing or invalid Authorization header',
      },
    };
  }

  return { valid: true, agentId };
}

/**
 * Express middleware for validating publish requests
 */
export function publishValidationMiddleware(
  req: Request,
  res: any,
  next: any
): void {
  const result = validatePublishRequest(req.body);

  if (!result.valid) {
    res.status(400).json(result.error);
    return;
  }

  // Attach validated request to request object
  (req as any).validatedRequest = result.request;
  next();
}
