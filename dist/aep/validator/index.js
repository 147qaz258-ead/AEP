/**
 * Experience Validator for AEP Protocol
 *
 * Validates experience publishing data including trigger, solution,
 * confidence, gene references, and other fields according to AEP specs.
 *
 * @module aep/validator
 */
import * as crypto from 'crypto';
/**
 * Field validation constraints
 */
export const VALIDATION_CONSTANTS = {
    TRIGGER_MIN_LEN: 10,
    TRIGGER_MAX_LEN: 500,
    SOLUTION_MIN_LEN: 20,
    SOLUTION_MAX_LEN: 10000,
    SIGNALS_MAX_COUNT: 20,
    CONTEXT_MAX_KEYS: 10,
    CONFIDENCE_MIN: 0.0,
    CONFIDENCE_MAX: 1.0,
};
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
 * Validates trigger field.
 * AC-VAL-001: Validates trigger field length [10, 500] characters
 *
 * @param trigger - Trigger text to validate
 * @returns Array of error messages
 */
export function validateTrigger(trigger) {
    const errors = [];
    if (!trigger || typeof trigger !== 'string') {
        errors.push('trigger is required');
        return errors;
    }
    const length = trigger.length;
    if (length < VALIDATION_CONSTANTS.TRIGGER_MIN_LEN) {
        errors.push(`trigger must be at least ${VALIDATION_CONSTANTS.TRIGGER_MIN_LEN} characters`);
    }
    else if (length > VALIDATION_CONSTANTS.TRIGGER_MAX_LEN) {
        errors.push(`trigger must be at most ${VALIDATION_CONSTANTS.TRIGGER_MAX_LEN} characters`);
    }
    return errors;
}
/**
 * Validates and checks for unsafe content in solution field.
 * AC-VAL-002: Validates solution field length [20, 10000] characters
 * AC-VAL-008: Sanitizes solution text for script-injection
 *
 * @param solution - Solution text to validate
 * @returns Array of error messages
 */
export function validateSolution(solution) {
    const errors = [];
    if (!solution || typeof solution !== 'string') {
        errors.push('solution is required');
        return errors;
    }
    const length = solution.length;
    if (length < VALIDATION_CONSTANTS.SOLUTION_MIN_LEN) {
        errors.push(`solution must be at least ${VALIDATION_CONSTANTS.SOLUTION_MIN_LEN} characters`);
    }
    else if (length > VALIDATION_CONSTANTS.SOLUTION_MAX_LEN) {
        errors.push(`solution must be at most ${VALIDATION_CONSTANTS.SOLUTION_MAX_LEN} characters`);
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
 * Validates confidence field.
 * AC-VAL-003: Validates confidence range [0.0, 1.0]
 *
 * @param confidence - Confidence value to validate
 * @returns Array of error messages
 */
export function validateConfidence(confidence) {
    const errors = [];
    if (typeof confidence !== 'number' || isNaN(confidence)) {
        errors.push('confidence must be a number');
        return errors;
    }
    if (confidence < VALIDATION_CONSTANTS.CONFIDENCE_MIN ||
        confidence > VALIDATION_CONSTANTS.CONFIDENCE_MAX) {
        errors.push('confidence must be between 0.0 and 1.0');
    }
    return errors;
}
/**
 * Validates signals_match array.
 * AC-VAL-004: Validates signals_match array max 20 items
 *
 * @param signals - Signals array to validate
 * @returns Array of error messages
 */
export function validateSignalsMatch(signals) {
    const errors = [];
    if (signals === undefined || signals === null) {
        return errors;
    }
    if (!Array.isArray(signals)) {
        errors.push('signals_match must be an array');
        return errors;
    }
    if (signals.length > VALIDATION_CONSTANTS.SIGNALS_MAX_COUNT) {
        errors.push(`signals_match must have at most ${VALIDATION_CONSTANTS.SIGNALS_MAX_COUNT} items`);
    }
    // Validate each signal is non-empty string
    for (let i = 0; i < signals.length; i++) {
        const signal = signals[i];
        if (typeof signal !== 'string') {
            errors.push(`signals_match[${i}] must be a string`);
        }
        else if (!signal.trim()) {
            errors.push(`signals_match[${i}] cannot be empty`);
        }
    }
    return errors;
}
/**
 * Validates context object.
 * AC-VAL-006: Validates context object max 10 keys
 *
 * @param context - Context object to validate
 * @returns Array of error messages
 */
export function validateContext(context) {
    const errors = [];
    if (context === undefined || context === null) {
        return errors;
    }
    if (typeof context !== 'object' || Array.isArray(context)) {
        errors.push('context must be an object');
        return errors;
    }
    const keys = Object.keys(context);
    if (keys.length > VALIDATION_CONSTANTS.CONTEXT_MAX_KEYS) {
        errors.push(`context must have at most ${VALIDATION_CONSTANTS.CONTEXT_MAX_KEYS} keys`);
    }
    return errors;
}
/**
 * Validates blast_radius object.
 * AC-VAL-007: Validates blast_radius has files and lines as non-negative integers
 *
 * @param blastRadius - Blast radius object to validate
 * @returns Array of error messages
 */
export function validateBlastRadius(blastRadius) {
    const errors = [];
    if (blastRadius === undefined || blastRadius === null) {
        return errors;
    }
    if (typeof blastRadius !== 'object' || Array.isArray(blastRadius)) {
        errors.push('blast_radius must be an object');
        return errors;
    }
    const br = blastRadius;
    // Validate 'files' field
    if (!('files' in br)) {
        errors.push("blast_radius must contain 'files' field");
    }
    else if (typeof br.files !== 'number' || !Number.isInteger(br.files) || br.files < 0) {
        errors.push('blast_radius.files must be a non-negative integer');
    }
    // Validate 'lines' field
    if (!('lines' in br)) {
        errors.push("blast_radius must contain 'lines' field");
    }
    else if (typeof br.lines !== 'number' || !Number.isInteger(br.lines) || br.lines < 0) {
        errors.push('blast_radius.lines must be a non-negative integer');
    }
    return errors;
}
/**
 * Normalizes content for duplicate detection.
 *
 * @param content - Content to normalize
 * @returns Normalized content string
 */
function normalizeContent(content) {
    return content.toLowerCase().trim().replace(/\s+/g, ' ');
}
/**
 * Generates SHA-256 content hash for duplicate detection.
 * AC-VAL-009: Detects duplicate experiences by content hash
 *
 * @param trigger - Trigger text
 * @param solution - Solution text
 * @returns SHA-256 hash of normalized content
 */
export function generateContentHash(trigger, solution) {
    const normalized = normalizeContent(trigger + solution);
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
/**
 * Main validator class for experience publishing data.
 */
export class ExperienceValidator {
    /**
     * Creates a new ExperienceValidator instance.
     *
     * @param options - Configuration options
     * @param options.geneLookup - Function to check if a gene exists
     * @param options.experienceLookup - Function to check for duplicate experiences
     */
    constructor(options) {
        // Default no-op lookups
        this.geneLookup = options?.geneLookup ?? (async () => true);
        this.experienceLookup = options?.experienceLookup ?? (async () => null);
    }
    /**
     * Validates gene reference.
     * AC-VAL-005: Validates gene reference exists in genes table (if provided)
     *
     * @param geneId - Gene ID to validate
     * @returns Array of error messages
     */
    async validateGeneReference(geneId) {
        const errors = [];
        if (geneId === undefined || geneId === null) {
            return errors;
        }
        if (typeof geneId !== 'string') {
            errors.push('gene must be a string');
            return errors;
        }
        if (!geneId.trim()) {
            errors.push('gene cannot be empty');
            return errors;
        }
        // Check if gene exists in database
        const exists = await this.geneLookup(geneId);
        if (!exists) {
            errors.push(`gene '${geneId}' does not exist`);
        }
        return errors;
    }
    /**
     * Checks for duplicate experience by content hash.
     * AC-VAL-009: Detects duplicate experiences by content hash
     *
     * @param trigger - Trigger text
     * @param solution - Solution text
     * @returns Existing experience ID if duplicate found, null otherwise
     */
    async checkDuplicate(trigger, solution) {
        const contentHash = generateContentHash(trigger, solution);
        return this.experienceLookup(contentHash);
    }
    /**
     * Validates complete publish request.
     *
     * @param request - Publish request to validate
     * @returns Validation result with errors and warnings
     */
    async validatePublishRequest(request) {
        const errors = [];
        const warnings = [];
        if (!request || !request.payload) {
            errors.push('request payload is required');
            return { is_valid: false, errors, warnings };
        }
        const payload = request.payload;
        // Validate required fields
        errors.push(...validateTrigger(payload.trigger));
        errors.push(...validateSolution(payload.solution));
        errors.push(...validateConfidence(payload.confidence));
        // Validate optional fields
        if (payload.signals_match !== undefined) {
            errors.push(...validateSignalsMatch(payload.signals_match));
        }
        if (payload.gene !== undefined && payload.gene !== null) {
            const geneErrors = await this.validateGeneReference(payload.gene);
            errors.push(...geneErrors);
        }
        if (payload.context !== undefined) {
            errors.push(...validateContext(payload.context));
        }
        if (payload.blast_radius !== undefined) {
            errors.push(...validateBlastRadius(payload.blast_radius));
        }
        // Check for duplicates
        if (payload.trigger && payload.solution) {
            const duplicateId = await this.checkDuplicate(payload.trigger, payload.solution);
            if (duplicateId) {
                warnings.push(`Duplicate experience exists: ${duplicateId}`);
            }
        }
        return {
            is_valid: errors.length === 0,
            errors,
            warnings,
        };
    }
}
/**
 * Create a validation error response object.
 *
 * @param errors - Array of error messages
 * @param warnings - Array of warning messages
 * @returns Formatted validation error response
 */
export function createValidationErrorResponse(errors, warnings = []) {
    // Group errors by field
    const field_errors = {};
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
        error: 'validation_error',
        message: 'Validation failed',
        field_errors,
        warnings,
    };
}
// Export singleton instance for convenience (with default no-op lookups)
export const experienceValidator = new ExperienceValidator();
// Default export
export default ExperienceValidator;
//# sourceMappingURL=index.js.map