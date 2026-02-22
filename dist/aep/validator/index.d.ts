/**
 * Experience Validator for AEP Protocol
 *
 * Validates experience publishing data including trigger, solution,
 * confidence, gene references, and other fields according to AEP specs.
 *
 * @module aep/validator
 */
/**
 * Field validation constraints
 */
export declare const VALIDATION_CONSTANTS: {
    readonly TRIGGER_MIN_LEN: 10;
    readonly TRIGGER_MAX_LEN: 500;
    readonly SOLUTION_MIN_LEN: 20;
    readonly SOLUTION_MAX_LEN: 10000;
    readonly SIGNALS_MAX_COUNT: 20;
    readonly CONTEXT_MAX_KEYS: 10;
    readonly CONFIDENCE_MIN: 0;
    readonly CONFIDENCE_MAX: 1;
};
/**
 * Result of validation operation
 */
export interface ValidationResult {
    is_valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Blast radius of changes for an experience
 */
export interface BlastRadius {
    files: number;
    lines: number;
}
/**
 * Payload for publishing an experience
 */
export interface PublishPayload {
    trigger: string;
    solution: string;
    confidence: number;
    signals_match?: string[];
    gene?: string;
    context?: Record<string, unknown>;
    blast_radius?: BlastRadius;
}
/**
 * Request for publishing an experience
 */
export interface PublishRequest {
    payload: PublishPayload;
    creator_id?: string;
}
/**
 * Gene lookup function type for database queries
 */
export type GeneLookupFn = (geneId: string) => Promise<boolean>;
/**
 * Experience lookup function type for duplicate detection
 */
export type ExperienceLookupFn = (contentHash: string) => Promise<string | null>;
/**
 * Validates trigger field.
 * AC-VAL-001: Validates trigger field length [10, 500] characters
 *
 * @param trigger - Trigger text to validate
 * @returns Array of error messages
 */
export declare function validateTrigger(trigger: string): string[];
/**
 * Validates and checks for unsafe content in solution field.
 * AC-VAL-002: Validates solution field length [20, 10000] characters
 * AC-VAL-008: Sanitizes solution text for script-injection
 *
 * @param solution - Solution text to validate
 * @returns Array of error messages
 */
export declare function validateSolution(solution: string): string[];
/**
 * Validates confidence field.
 * AC-VAL-003: Validates confidence range [0.0, 1.0]
 *
 * @param confidence - Confidence value to validate
 * @returns Array of error messages
 */
export declare function validateConfidence(confidence: number): string[];
/**
 * Validates signals_match array.
 * AC-VAL-004: Validates signals_match array max 20 items
 *
 * @param signals - Signals array to validate
 * @returns Array of error messages
 */
export declare function validateSignalsMatch(signals: unknown): string[];
/**
 * Validates context object.
 * AC-VAL-006: Validates context object max 10 keys
 *
 * @param context - Context object to validate
 * @returns Array of error messages
 */
export declare function validateContext(context: unknown): string[];
/**
 * Validates blast_radius object.
 * AC-VAL-007: Validates blast_radius has files and lines as non-negative integers
 *
 * @param blastRadius - Blast radius object to validate
 * @returns Array of error messages
 */
export declare function validateBlastRadius(blastRadius: unknown): string[];
/**
 * Generates SHA-256 content hash for duplicate detection.
 * AC-VAL-009: Detects duplicate experiences by content hash
 *
 * @param trigger - Trigger text
 * @param solution - Solution text
 * @returns SHA-256 hash of normalized content
 */
export declare function generateContentHash(trigger: string, solution: string): string;
/**
 * Main validator class for experience publishing data.
 */
export declare class ExperienceValidator {
    private geneLookup;
    private experienceLookup;
    /**
     * Creates a new ExperienceValidator instance.
     *
     * @param options - Configuration options
     * @param options.geneLookup - Function to check if a gene exists
     * @param options.experienceLookup - Function to check for duplicate experiences
     */
    constructor(options?: {
        geneLookup?: GeneLookupFn;
        experienceLookup?: ExperienceLookupFn;
    });
    /**
     * Validates gene reference.
     * AC-VAL-005: Validates gene reference exists in genes table (if provided)
     *
     * @param geneId - Gene ID to validate
     * @returns Array of error messages
     */
    validateGeneReference(geneId: unknown): Promise<string[]>;
    /**
     * Checks for duplicate experience by content hash.
     * AC-VAL-009: Detects duplicate experiences by content hash
     *
     * @param trigger - Trigger text
     * @param solution - Solution text
     * @returns Existing experience ID if duplicate found, null otherwise
     */
    checkDuplicate(trigger: string, solution: string): Promise<string | null>;
    /**
     * Validates complete publish request.
     *
     * @param request - Publish request to validate
     * @returns Validation result with errors and warnings
     */
    validatePublishRequest(request: PublishRequest): Promise<ValidationResult>;
}
/**
 * Create a validation error response object.
 *
 * @param errors - Array of error messages
 * @param warnings - Array of warning messages
 * @returns Formatted validation error response
 */
export declare function createValidationErrorResponse(errors: string[], warnings?: string[]): {
    error: 'validation_error';
    message: 'Validation failed';
    field_errors: Record<string, string[]>;
    warnings: string[];
};
export declare const experienceValidator: ExperienceValidator;
export default ExperienceValidator;
//# sourceMappingURL=index.d.ts.map