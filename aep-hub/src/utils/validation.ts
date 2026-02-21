import { Request } from 'express';
import { Capability, HelloRequest, ErrorResponse } from '../types';

// Valid capabilities whitelist
const VALID_CAPABILITIES: Capability[] = ['fetch', 'publish', 'feedback'];

/**
 * Validation error codes
 */
export const ValidationErrorCodes = {
  INVALID_PROTOCOL: 'invalid_protocol',
  INVALID_TYPE: 'invalid_type',
  INVALID_CAPABILITIES: 'invalid_capabilities',
  INVALID_VERSION: 'invalid_version',
  MISSING_FIELD: 'missing_field',
} as const;

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
 * Validates capabilities array
 * Returns { valid: true } if valid, or { valid: false, error: ErrorResponse } if invalid
 */
export function validateCapabilities(capabilities: unknown): 
  { valid: true; capabilities: Capability[] } | 
  { valid: false; error: ErrorResponse } {
  
  // Must be an array
  if (!Array.isArray(capabilities)) {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_CAPABILITIES,
        message: 'Capabilities must be an array',
        valid_capabilities: VALID_CAPABILITIES,
      },
    };
  }

  // Must be non-empty
  if (capabilities.length === 0) {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_CAPABILITIES,
        message: 'Capabilities array cannot be empty',
        valid_capabilities: VALID_CAPABILITIES,
      },
    };
  }

  // All values must be valid capabilities
  const invalidCaps = capabilities.filter(cap => !VALID_CAPABILITIES.includes(cap as Capability));
  
  if (invalidCaps.length > 0) {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_CAPABILITIES,
        message: `Invalid capability: '${invalidCaps[0]}'. Must be one of: ${VALID_CAPABILITIES.join(', ')}`,
        valid_capabilities: VALID_CAPABILITIES,
      },
    };
  }

  // Remove duplicates
  const uniqueCapabilities = [...new Set(capabilities as Capability[])];

  return { valid: true, capabilities: uniqueCapabilities };
}

/**
 * Validates the AEP envelope structure for hello request
 * Returns { valid: true; request: HelloRequest } if valid, or { valid: false; error: ErrorResponse } if invalid
 */
export function validateHelloRequest(body: unknown, ip?: string): 
  { valid: true; request: HelloRequest } | 
  { valid: false; error: ErrorResponse } {
  
  // Check if body exists
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.MISSING_FIELD,
        message: 'Request body is required',
      },
    };
  }

  const envelope = body as Record<string, unknown>;

  // Validate protocol field
  if (envelope.protocol !== 'aep') {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_PROTOCOL,
        message: `Invalid protocol: '${envelope.protocol}'. Must be 'aep'`,
      },
    };
  }

  // Validate type field
  if (envelope.type !== 'hello') {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_TYPE,
        message: `Invalid type: '${envelope.type}'. Must be 'hello'`,
      },
    };
  }

  // Validate version field (envelope level)
  if (typeof envelope.version !== 'string' || !isValidSemver(envelope.version)) {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_VERSION,
        message: `Invalid version: '${envelope.version}'. Must be valid semver (e.g., 1.0.0)`,
      },
    };
  }

  // Validate sender (must be null for hello)
  if (envelope.sender !== null) {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_TYPE,
        message: 'Sender must be null for hello request',
      },
    };
  }

  // Validate timestamp
  if (typeof envelope.timestamp !== 'string' || !isValidTimestamp(envelope.timestamp)) {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.MISSING_FIELD,
        message: 'Invalid or missing timestamp. Must be valid ISO 8601 format',
      },
    };
  }

  // Validate payload exists
  if (!envelope.payload || typeof envelope.payload !== 'object') {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.MISSING_FIELD,
        message: 'Payload is required',
      },
    };
  }

  const payload = envelope.payload as Record<string, unknown>;

  // Validate payload version
  if (typeof payload.version !== 'string' || !isValidSemver(payload.version)) {
    return {
      valid: false,
      error: {
        error: ValidationErrorCodes.INVALID_VERSION,
        message: `Invalid payload version: '${payload.version}'. Must be valid semver (e.g., 1.0.0)`,
      },
    };
  }

  // Validate capabilities
  const capabilitiesResult = validateCapabilities(payload.capabilities);
  if (!capabilitiesResult.valid) {
    return capabilitiesResult;
  }

  // Construct validated request
  const validRequest: HelloRequest = {
    protocol: 'aep',
    version: envelope.version,
    type: 'hello',
    sender: null,
    timestamp: envelope.timestamp,
    payload: {
      capabilities: capabilitiesResult.capabilities,
      version: payload.version,
    },
  };

  return { valid: true, request: validRequest };
}

/**
 * Express middleware for validating hello requests
 */
export function helloValidationMiddleware(
  req: Request,
  res: any,
  next: any
): void {
  const ip = req.ip || req.socket.remoteAddress || undefined;
  const result = validateHelloRequest(req.body, ip);

  if (!result.valid) {
    res.status(400).json(result.error);
    return;
  }

  // Attach validated request to request object
  (req as any).validatedRequest = result.request;
  next();
}
