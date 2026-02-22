/**
 * Asset Store for AEP Protocol
 *
 * Manages Gene (reusable strategy templates) and Capsule (specific solution instances) assets.
 * Provides CRUD operations for Genes and links Genes to Capsules (experiences).
 *
 * @module aep/asset-store
 */
/**
 * Gene entity representing a reusable strategy template
 */
export interface Gene {
    id: string;
    name: string;
    category: string;
    description: string;
    created_at: string;
    updated_at: string;
}
/**
 * Request payload for creating a new Gene
 */
export interface CreateGeneRequest {
    name: string;
    category: string;
    description: string;
}
/**
 * Request payload for updating a Gene
 */
export interface UpdateGeneRequest {
    name?: string;
    description?: string;
}
/**
 * Error thrown when a duplicate Gene is detected
 */
export declare class DuplicateGeneError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when a Gene is not found
 */
export declare class GeneNotFoundError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when validation fails
 */
export declare class ValidationError extends Error {
    constructor(message: string);
}
/**
 * Gene storage interface for database abstraction
 */
export interface GeneStorage {
    insert(gene: Gene): Promise<void>;
    findById(id: string): Promise<Gene | null>;
    findByCategory(category: string): Promise<Gene[]>;
    findAll(): Promise<Gene[]>;
    findByNameAndCategory(name: string, category: string): Promise<Gene | null>;
    existsById(id: string): Promise<boolean>;
    update(id: string, updates: Partial<Gene>): Promise<void>;
    existsByIdPrefix(prefix: string): Promise<boolean>;
}
/**
 * Experience/Capsule storage interface for linking
 */
export interface ExperienceStorage {
    update(capsuleId: string, updates: {
        gene_id?: string;
    }): Promise<boolean>;
}
/**
 * In-memory implementation of GeneStorage for testing and development
 */
export declare class InMemoryGeneStorage implements GeneStorage {
    private genes;
    insert(gene: Gene): Promise<void>;
    findById(id: string): Promise<Gene | null>;
    findByCategory(category: string): Promise<Gene[]>;
    findAll(): Promise<Gene[]>;
    findByNameAndCategory(name: string, category: string): Promise<Gene | null>;
    existsById(id: string): Promise<boolean>;
    update(id: string, updates: Partial<Gene>): Promise<void>;
    existsByIdPrefix(prefix: string): Promise<boolean>;
    /**
     * Clear all stored genes (useful for testing)
     */
    clear(): void;
}
/**
 * In-memory implementation of ExperienceStorage for testing and development
 */
export declare class InMemoryExperienceStorage implements ExperienceStorage {
    private experiences;
    update(capsuleId: string, updates: {
        gene_id?: string;
    }): Promise<boolean>;
    /**
     * Add an experience to the storage (for testing)
     */
    addExperience(capsuleId: string): void;
    /**
     * Clear all stored experiences (useful for testing)
     */
    clear(): void;
}
/**
 * Generate a human-readable gene_id from name and category.
 * AC-ASSET-001: Generate unique gene_id
 *
 * @param name - Gene name
 * @param category - Gene category
 * @param existsFn - Function to check if a gene_id already exists
 * @returns Generated unique gene_id
 */
export declare function generateGeneId(name: string, category: string, existsFn: (id: string) => Promise<boolean>): Promise<string>;
/**
 * Asset Store for managing Gene and Capsule assets.
 *
 * Provides CRUD operations for Genes and links Genes to Capsules (experiences).
 */
export declare class AssetStore {
    private geneStorage;
    private experienceStorage?;
    /**
     * Creates a new AssetStore instance.
     *
     * @param options - Configuration options
     * @param options.geneStorage - Storage backend for genes
     * @param options.experienceStorage - Storage backend for experiences (optional)
     */
    constructor(options: {
        geneStorage: GeneStorage;
        experienceStorage?: ExperienceStorage;
    });
    /**
     * Create a new Gene.
     * AC-ASSET-001: Create Gene with unique gene_id
     * AC-ASSET-002: Validate Gene name is unique within category
     *
     * @param request - Gene creation request
     * @returns Created Gene
     * @throws DuplicateGeneError if name already exists in category
     */
    createGene(request: CreateGeneRequest): Promise<Gene>;
    /**
     * Retrieve a Gene by ID.
     * AC-ASSET-004: Retrieve Gene by gene_id
     *
     * @param geneId - Gene ID to retrieve
     * @returns Gene if found, null otherwise
     */
    getGene(geneId: string): Promise<Gene | null>;
    /**
     * List Genes, optionally filtered by category.
     * AC-ASSET-005: List Genes by category
     *
     * @param category - Optional category filter
     * @returns Array of Genes
     */
    listGenes(category?: string): Promise<Gene[]>;
    /**
     * Update Gene metadata (name and description only).
     * AC-ASSET-006: Update Gene metadata
     *
     * @param geneId - Gene ID to update
     * @param updates - Fields to update
     * @returns Updated Gene
     * @throws GeneNotFoundError if gene not found
     * @throws ValidationError if no valid fields to update
     */
    updateGene(geneId: string, updates: UpdateGeneRequest): Promise<Gene>;
    /**
     * Validate that a gene_id exists.
     * AC-ASSET-007: Validate gene_id exists before linking to Capsule
     *
     * @param geneId - Gene ID to validate
     * @returns true if gene exists, false otherwise
     */
    validateGeneExists(geneId: string): Promise<boolean>;
    /**
     * Link a Capsule (experience) to a Gene.
     * AC-ASSET-003: Link Capsules to Genes via gene_id foreign key
     * AC-ASSET-007: Validate gene_id exists before linking to Capsule
     *
     * @param capsuleId - Capsule/Experience ID to link
     * @param geneId - Gene ID to link to
     * @throws GeneNotFoundError if gene not found
     * @throws Error if experience storage not configured
     */
    linkCapsuleToGene(capsuleId: string, geneId: string): Promise<void>;
}
/**
 * Create a default AssetStore with in-memory storage.
 * Useful for testing and development.
 *
 * @returns AssetStore instance with in-memory storage
 */
export declare function createDefaultAssetStore(): {
    store: AssetStore;
    geneStorage: InMemoryGeneStorage;
    experienceStorage: InMemoryExperienceStorage;
};
export default AssetStore;
//# sourceMappingURL=index.d.ts.map