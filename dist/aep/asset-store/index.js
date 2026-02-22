/**
 * Asset Store for AEP Protocol
 *
 * Manages Gene (reusable strategy templates) and Capsule (specific solution instances) assets.
 * Provides CRUD operations for Genes and links Genes to Capsules (experiences).
 *
 * @module aep/asset-store
 */
/**
 * Error thrown when a duplicate Gene is detected
 */
export class DuplicateGeneError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DuplicateGeneError';
    }
}
/**
 * Error thrown when a Gene is not found
 */
export class GeneNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GeneNotFoundError';
    }
}
/**
 * Error thrown when validation fails
 */
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
/**
 * In-memory implementation of GeneStorage for testing and development
 */
export class InMemoryGeneStorage {
    constructor() {
        this.genes = new Map();
    }
    async insert(gene) {
        this.genes.set(gene.id, gene);
    }
    async findById(id) {
        return this.genes.get(id) ?? null;
    }
    async findByCategory(category) {
        return Array.from(this.genes.values())
            .filter((gene) => gene.category === category)
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    async findAll() {
        return Array.from(this.genes.values()).sort((a, b) => {
            const categoryCompare = a.category.localeCompare(b.category);
            if (categoryCompare !== 0)
                return categoryCompare;
            return a.name.localeCompare(b.name);
        });
    }
    async findByNameAndCategory(name, category) {
        for (const gene of this.genes.values()) {
            if (gene.name === name && gene.category === category) {
                return gene;
            }
        }
        return null;
    }
    async existsById(id) {
        return this.genes.has(id);
    }
    async update(id, updates) {
        const gene = this.genes.get(id);
        if (gene) {
            this.genes.set(id, { ...gene, ...updates });
        }
    }
    async existsByIdPrefix(prefix) {
        for (const id of this.genes.keys()) {
            if (id.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Clear all stored genes (useful for testing)
     */
    clear() {
        this.genes.clear();
    }
}
/**
 * In-memory implementation of ExperienceStorage for testing and development
 */
export class InMemoryExperienceStorage {
    constructor() {
        this.experiences = new Map();
    }
    async update(capsuleId, updates) {
        if (!this.experiences.has(capsuleId)) {
            return false;
        }
        const existing = this.experiences.get(capsuleId);
        this.experiences.set(capsuleId, { ...existing, ...updates });
        return true;
    }
    /**
     * Add an experience to the storage (for testing)
     */
    addExperience(capsuleId) {
        this.experiences.set(capsuleId, {});
    }
    /**
     * Clear all stored experiences (useful for testing)
     */
    clear() {
        this.experiences.clear();
    }
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
export function generateGeneId(name, category, existsFn) {
    return generateGeneIdWithCounter(name, category, existsFn, 1);
}
/**
 * Helper function to generate gene_id with counter suffix if needed
 */
async function generateGeneIdWithCounter(name, category, existsFn, counter) {
    // Normalize name: lowercase, replace spaces with underscores, remove special chars
    let normalized = name.toLowerCase().trim();
    normalized = normalized.replace(/\s+/g, '_');
    normalized = normalized.replace(/[^a-z0-9_]/g, '');
    // Combine with category prefix (also normalize special chars)
    let categoryPrefix = category.toLowerCase().trim();
    categoryPrefix = categoryPrefix.replace(/\s+/g, '_');
    categoryPrefix = categoryPrefix.replace(/[^a-z0-9_]/g, '');
    let baseId = `gene_${categoryPrefix}_${normalized}`;
    // Limit base ID length to prevent excessively long IDs
    if (baseId.length > 100) {
        baseId = baseId.substring(0, 100);
    }
    // Check if base ID exists
    const baseExists = await existsFn(baseId);
    if (!baseExists) {
        return baseId;
    }
    // If base exists, append counter
    const suffixedId = `${baseId}_${counter}`;
    const suffixedExists = await existsFn(suffixedId);
    if (!suffixedExists) {
        return suffixedId;
    }
    // Recurse with incremented counter
    return generateGeneIdWithCounter(name, category, existsFn, counter + 1);
}
/**
 * Asset Store for managing Gene and Capsule assets.
 *
 * Provides CRUD operations for Genes and links Genes to Capsules (experiences).
 */
export class AssetStore {
    /**
     * Creates a new AssetStore instance.
     *
     * @param options - Configuration options
     * @param options.geneStorage - Storage backend for genes
     * @param options.experienceStorage - Storage backend for experiences (optional)
     */
    constructor(options) {
        this.geneStorage = options.geneStorage;
        this.experienceStorage = options.experienceStorage;
    }
    /**
     * Create a new Gene.
     * AC-ASSET-001: Create Gene with unique gene_id
     * AC-ASSET-002: Validate Gene name is unique within category
     *
     * @param request - Gene creation request
     * @returns Created Gene
     * @throws DuplicateGeneError if name already exists in category
     */
    async createGene(request) {
        // Validate input
        if (!request.name || !request.name.trim()) {
            throw new ValidationError('Gene name is required');
        }
        if (!request.category || !request.category.trim()) {
            throw new ValidationError('Gene category is required');
        }
        // Validate name uniqueness within category
        const existing = await this.geneStorage.findByNameAndCategory(request.name, request.category);
        if (existing) {
            throw new DuplicateGeneError(`Gene '${request.name}' already exists in category '${request.category}'`);
        }
        // Generate unique gene_id
        const geneId = await generateGeneId(request.name, request.category, (id) => this.geneStorage.existsById(id));
        // Create gene entity
        const now = new Date().toISOString();
        const gene = {
            id: geneId,
            name: request.name,
            category: request.category,
            description: request.description ?? '',
            created_at: now,
            updated_at: now,
        };
        // Store gene
        await this.geneStorage.insert(gene);
        return gene;
    }
    /**
     * Retrieve a Gene by ID.
     * AC-ASSET-004: Retrieve Gene by gene_id
     *
     * @param geneId - Gene ID to retrieve
     * @returns Gene if found, null otherwise
     */
    async getGene(geneId) {
        return this.geneStorage.findById(geneId);
    }
    /**
     * List Genes, optionally filtered by category.
     * AC-ASSET-005: List Genes by category
     *
     * @param category - Optional category filter
     * @returns Array of Genes
     */
    async listGenes(category) {
        if (category) {
            return this.geneStorage.findByCategory(category);
        }
        return this.geneStorage.findAll();
    }
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
    async updateGene(geneId, updates) {
        // Validate gene exists
        const gene = await this.geneStorage.findById(geneId);
        if (!gene) {
            throw new GeneNotFoundError(`Gene '${geneId}' not found`);
        }
        // Filter to allowed fields only
        const allowedFields = ['name', 'description'];
        const updateData = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }
        if (Object.keys(updateData).length === 0) {
            throw new ValidationError('No valid fields to update');
        }
        // If name is being updated, check uniqueness
        if (updates.name && updates.name !== gene.name) {
            const existing = await this.geneStorage.findByNameAndCategory(updates.name, gene.category);
            if (existing && existing.id !== geneId) {
                throw new DuplicateGeneError(`Gene '${updates.name}' already exists in category '${gene.category}'`);
            }
        }
        // Update timestamp
        updateData.updated_at = new Date().toISOString();
        // Perform update
        await this.geneStorage.update(geneId, updateData);
        // Return updated gene
        const updated = await this.geneStorage.findById(geneId);
        if (!updated) {
            throw new GeneNotFoundError(`Gene '${geneId}' not found after update`);
        }
        return updated;
    }
    /**
     * Validate that a gene_id exists.
     * AC-ASSET-007: Validate gene_id exists before linking to Capsule
     *
     * @param geneId - Gene ID to validate
     * @returns true if gene exists, false otherwise
     */
    async validateGeneExists(geneId) {
        return this.geneStorage.existsById(geneId);
    }
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
    async linkCapsuleToGene(capsuleId, geneId) {
        // Validate gene exists
        const exists = await this.validateGeneExists(geneId);
        if (!exists) {
            throw new GeneNotFoundError(`Gene '${geneId}' not found`);
        }
        // Link capsule to gene
        if (!this.experienceStorage) {
            throw new Error('Experience storage not configured');
        }
        const updated = await this.experienceStorage.update(capsuleId, { gene_id: geneId });
        if (!updated) {
            throw new Error(`Capsule '${capsuleId}' not found`);
        }
    }
}
/**
 * Create a default AssetStore with in-memory storage.
 * Useful for testing and development.
 *
 * @returns AssetStore instance with in-memory storage
 */
export function createDefaultAssetStore() {
    const geneStorage = new InMemoryGeneStorage();
    const experienceStorage = new InMemoryExperienceStorage();
    const store = new AssetStore({ geneStorage, experienceStorage });
    return { store, geneStorage, experienceStorage };
}
// Default export
export default AssetStore;
//# sourceMappingURL=index.js.map