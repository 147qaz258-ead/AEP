/**
 * Feedback Validation Utilities
 *
 * Validates feedback requests according to AEP protocol
 */

import {
  FeedbackRequest,
  FeedbackPayload,
  FeedbackValidationErrorResponse,
  FeedbackOutcome,
} from '../types';

/**
 * Valid outcome values
 */
const VALID_OUTCOMES: FeedbackOutcome[] = ['success', 'failure', 'partial'];

/**
 * Result of validating a feedback request
 */
export interface FeedbackValidationResult {
  valid: boolean;
  request?: FeedbackRequest;
  error?: FeedbackValidationErrorResponse;
}

/**
 * Validate feedback request structure and fields
 */
export function validateFeedbackRequest(body: unknown): FeedbackValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  // Check envelope structure
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: {
        error: 'validation_error',
        message: 'Validation failed',
        field_errors: { _body: ['Request body must be a valid JSON object'] },
      },
    };
  }

  const request = body as Record<string, unknown>;

  // Validate protocol
  if (request.protocol !== 'aep') {
    fieldErrors.protocol = fieldErrors.protocol || [];
    fieldErrors.protocol.push('Protocol must be "aep"');
  }

  // Validate version
  if (typeof request.version !== 'string' || !request.version) {
    fieldErrors.version = fieldErrors.version || [];
    fieldErrors.version.push('Version is required');
  }

  // Validate type
  if (request.type !== 'feedback') {
    fieldErrors.type = fieldErrors.type || [];
    fieldErrors.type.push('Type must be "feedback"');
  }

  // Validate sender
  if (typeof request.sender !== 'string' || !request.sender.trim()) {
    fieldErrors.sender = fieldErrors.sender || [];
    fieldErrors.sender.push('Sender (agent_id) is required');
  }

  // Validate timestamp
  if (typeof request.timestamp !== 'string') {
    fieldErrors.timestamp = fieldErrors.timestamp || [];
    fieldErrors.timestamp.push('Timestamp is required (ISO 8601)');
  } else {
    const timestamp = new Date(request.timestamp);
    if (isNaN(timestamp.getTime())) {
      fieldErrors.timestamp = fieldErrors.timestamp || [];
      fieldErrors.timestamp.push('Timestamp must be valid ISO 8601 format');
    }
  }

  // Validate payload
  if (!request.payload || typeof request.payload !== 'object') {
    fieldErrors.payload = fieldErrors.payload || [];
    fieldErrors.payload.push('Payload is required');
    return {
      valid: false,
      error: {
        error: 'validation_error',
        message: 'Validation failed',
        field_errors: fieldErrors,
      },
    };
  }

  // Validate payload fields
  const payload = request.payload as Record<string, unknown>;
  const payloadErrors = validateFeedbackPayload(payload);

  if (Object.keys(payloadErrors).length > 0) {
    fieldErrors.payload = fieldErrors.payload || [];
    Object.assign(fieldErrors, { payload_fields: payloadErrors });
  }

  // Return validation result
  if (Object.keys(fieldErrors).length > 0) {
    return {
      valid: false,
      error: {
        error: 'validation_error',
        message: 'Validation failed',
        field_errors: fieldErrors,
      },
    };
  }

  return {
    valid: true,
    request: request as unknown as FeedbackRequest,
  };
}

/**
 * Validate feedback payload fields
 */
export function validateFeedbackPayload(payload: unknown): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (!payload || typeof payload !== 'object') {
    errors._payload = ['Payload must be an object'];
    return errors;
  }

  const p = payload as Record<string, unknown>;

  // Validate experience_id (required)
  if (typeof p.experience_id !== 'string' || !p.experience_id.trim()) {
    errors.experience_id = errors.experience_id || [];
    errors.experience_id.push('experience_id is required');
  }

  // Validate outcome (required, must be one of valid values)
  if (typeof p.outcome !== 'string') {
    errors.outcome = errors.outcome || [];
    errors.outcome.push('outcome is required');
  } else if (!VALID_OUTCOMES.includes(p.outcome as FeedbackOutcome)) {
    errors.outcome = errors.outcome || [];
    errors.outcome.push(`outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
  }

  // Validate score (optional, must be 0.0-1.0)
  if (p.score !== undefined && p.score !== null) {
    if (typeof p.score !== 'number') {
      errors.score = errors.score || [];
      errors.score.push('score must be a number');
    } else if (p.score < 0.0 || p.score > 1.0) {
      errors.score = errors.score || [];
      errors.score.push('score must be between 0.0 and 1.0');
    }
  }

  // Validate notes (optional, must be string)
  if (p.notes !== undefined && p.notes !== null) {
    if (typeof p.notes !== 'string') {
      errors.notes = errors.notes || [];
      errors.notes.push('notes must be a string');
    }
  }

  return errors;
}

/**
 * Validate feedback payload only (for internal use)
 */
export function validateFeedbackPayloadOnly(payload: FeedbackPayload): string[] {
  const errors: string[] = [];

  if (!payload.experience_id?.trim()) {
    errors.push('experience_id is required');
  }

  if (!VALID_OUTCOMES.includes(payload.outcome)) {
    errors.push(`outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
  }

  if (payload.score !== undefined) {
    if (payload.score < 0.0 || payload.score > 1.0) {
      errors.push('score must be between 0.0 and 1.0');
    }
  }

  return errors;
}
