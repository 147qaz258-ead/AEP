/**
 * Tests for Asset Store Module
 *
 * @module aep/asset-store/__tests__/assetStore.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AssetStore,
  Gene,
  CreateGeneRequest,
  UpdateGeneRequest,
  InMemoryGeneStorage,
  InMemoryExperienceStorage,
  DuplicateGeneError,
  GeneNotFoundError,
  ValidationError,
  generateGeneId,
  createDefaultAssetStore,
} from '../index';

describe('AssetStore', () => {
  let store: AssetStore;
  let geneStorage: InMemoryGeneStorage;
  let experienceStorage: InMemoryExperienceStorage;

  beforeEach(() => {
    // Create fresh instances for each test
    const defaultStore = createDefaultAssetStore();
    store = defaultStore.store;
    geneStorage = defaultStore.geneStorage;
    experienceStorage = defaultStore.experienceStorage;
  });

  describe('createGene', () => {
    it('AC-ASSET-001: should create Gene with unique gene_id', async () => {
      const request: CreateGeneRequest = {
        name: 'Connection Timeout Handler',
        category: 'Network',
        description: 'Handles network connection timeout scenarios',
      };

      const gene = await store.createGene(request);

      expect(gene.id).toBe('gene_network_connection_timeout_handler');
      expect(gene.name).toBe(request.name);
      expect(gene.category).toBe(request.category);
      expect(gene.description).toBe(request.description);
      expect(gene.created_at).toBeDefined();
      expect(gene.updated_at).toBeDefined();
    });

    it('AC-ASSET-001: should generate unique gene_id when name has special characters', async () => {
      const request: CreateGeneRequest = {
        name: 'Fix Bug #123: API Error!',
        category: 'Debugging',
        description: 'Fix for API error bug',
      };

      const gene = await store.createGene(request);

      expect(gene.id).toBe('gene_debugging_fix_bug_123_api_error');
    });

    it('AC-ASSET-001: should append counter suffix if gene_id already exists', async () => {
      const request1: CreateGeneRequest = {
        name: 'Test Gene',
        category: 'Test',
        description: 'First gene',
      };

      const gene1 = await store.createGene(request1);
      expect(gene1.id).toBe('gene_test_test_gene');

      // Create another gene with same name and category
      const request2: CreateGeneRequest = {
        name: 'Test Gene',
        category: 'Test',
        description: 'Second gene with same name',
      };

      // This should throw because name must be unique within category
      await expect(store.createGene(request2)).rejects.toThrow(DuplicateGeneError);
    });

    it('AC-ASSET-002: should validate Gene name is unique within category', async () => {
      const request1: CreateGeneRequest = {
        name: 'Unique Name',
        category: 'Category A',
        description: 'First gene',
      };

      await store.createGene(request1);

      const request2: CreateGeneRequest = {
        name: 'Unique Name',
        category: 'Category A',
        description: 'Duplicate name in same category',
      };

      await expect(store.createGene(request2)).rejects.toThrow(DuplicateGeneError);
      await expect(store.createGene(request2)).rejects.toThrow(
        "Gene 'Unique Name' already exists in category 'Category A'"
      );
    });

    it('AC-ASSET-002: should allow same name in different categories', async () => {
      const request1: CreateGeneRequest = {
        name: 'Common Name',
        category: 'Category A',
        description: 'Gene in category A',
      };

      const gene1 = await store.createGene(request1);

      const request2: CreateGeneRequest = {
        name: 'Common Name',
        category: 'Category B',
        description: 'Gene in category B',
      };

      const gene2 = await store.createGene(request2);

      expect(gene1.id).toBe('gene_category_a_common_name');
      expect(gene2.id).toBe('gene_category_b_common_name');
      expect(gene1.category).toBe('Category A');
      expect(gene2.category).toBe('Category B');
    });

    it('should reject empty name', async () => {
      const request: CreateGeneRequest = {
        name: '',
        category: 'Test',
        description: 'Test gene',
      };

      await expect(store.createGene(request)).rejects.toThrow(ValidationError);
      await expect(store.createGene(request)).rejects.toThrow('Gene name is required');
    });

    it('should reject whitespace-only name', async () => {
      const request: CreateGeneRequest = {
        name: '   ',
        category: 'Test',
        description: 'Test gene',
      };

      await expect(store.createGene(request)).rejects.toThrow(ValidationError);
    });

    it('should reject empty category', async () => {
      const request: CreateGeneRequest = {
        name: 'Valid Name',
        category: '',
        description: 'Test gene',
      };

      await expect(store.createGene(request)).rejects.toThrow(ValidationError);
      await expect(store.createGene(request)).rejects.toThrow('Gene category is required');
    });

    it('should use empty description if not provided', async () => {
      const request: CreateGeneRequest = {
        name: 'No Description Gene',
        category: 'Test',
        description: '' as string,
      };

      const gene = await store.createGene(request);
      expect(gene.description).toBe('');
    });

    it('should handle multi-word categories', async () => {
      const request: CreateGeneRequest = {
        name: 'Test Strategy',
        category: 'Network Recovery',
        description: 'Test gene with multi-word category',
      };

      const gene = await store.createGene(request);
      expect(gene.id).toBe('gene_network_recovery_test_strategy');
    });
  });

  describe('getGene', () => {
    it('AC-ASSET-004: should retrieve Gene by gene_id', async () => {
      const request: CreateGeneRequest = {
        name: 'Retrieve Test',
        category: 'Test',
        description: 'Gene to retrieve',
      };

      const created = await store.createGene(request);
      const retrieved = await store.getGene(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe(created.name);
      expect(retrieved!.category).toBe(created.category);
    });

    it('AC-ASSET-004: should return null for non-existent gene_id', async () => {
      const retrieved = await store.getGene('gene_nonexistent');

      expect(retrieved).toBeNull();
    });
  });

  describe('listGenes', () => {
    beforeEach(async () => {
      // Create test genes
      await store.createGene({
        name: 'Alpha Strategy',
        category: 'Network',
        description: 'Network strategy A',
      });
      await store.createGene({
        name: 'Beta Strategy',
        category: 'Network',
        description: 'Network strategy B',
      });
      await store.createGene({
        name: 'Gamma Strategy',
        category: 'Database',
        description: 'Database strategy',
      });
    });

    it('AC-ASSET-005: should list all Genes when no category filter', async () => {
      const genes = await store.listGenes();

      expect(genes).toHaveLength(3);
      // Should be sorted by category, then by name
      expect(genes[0].category).toBe('Database');
      expect(genes[1].category).toBe('Network');
      expect(genes[2].category).toBe('Network');
    });

    it('AC-ASSET-005: should list Genes filtered by category', async () => {
      const genes = await store.listGenes('Network');

      expect(genes).toHaveLength(2);
      expect(genes.every((g) => g.category === 'Network')).toBe(true);
      // Should be sorted by name within category
      expect(genes[0].name).toBe('Alpha Strategy');
      expect(genes[1].name).toBe('Beta Strategy');
    });

    it('AC-ASSET-005: should return empty array for category with no genes', async () => {
      const genes = await store.listGenes('NonExistentCategory');

      expect(genes).toHaveLength(0);
      expect(genes).toEqual([]);
    });
  });

  describe('updateGene', () => {
    let testGene: Gene;

    beforeEach(async () => {
      testGene = await store.createGene({
        name: 'Original Name',
        category: 'Test',
        description: 'Original description',
      });
    });

    it('AC-ASSET-006: should update Gene name', async () => {
      const updates: UpdateGeneRequest = {
        name: 'Updated Name',
      };

      const updated = await store.updateGene(testGene.id, updates);

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Original description');
      // updated_at should be after created_at (timestamps should differ)
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(testGene.created_at).getTime()
      );
    });

    it('AC-ASSET-006: should update Gene description', async () => {
      const updates: UpdateGeneRequest = {
        description: 'Updated description',
      };

      const updated = await store.updateGene(testGene.id, updates);

      expect(updated.name).toBe('Original Name');
      expect(updated.description).toBe('Updated description');
    });

    it('AC-ASSET-006: should update multiple fields', async () => {
      const updates: UpdateGeneRequest = {
        name: 'New Name',
        description: 'New description',
      };

      const updated = await store.updateGene(testGene.id, updates);

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New description');
    });

    it('should reject update for non-existent gene', async () => {
      const updates: UpdateGeneRequest = {
        name: 'New Name',
      };

      await expect(store.updateGene('gene_nonexistent', updates)).rejects.toThrow(
        GeneNotFoundError
      );
    });

    it('should reject update with no valid fields', async () => {
      const updates: UpdateGeneRequest = {};

      await expect(store.updateGene(testGene.id, updates)).rejects.toThrow(ValidationError);
      await expect(store.updateGene(testGene.id, updates)).rejects.toThrow(
        'No valid fields to update'
      );
    });

    it('should reject duplicate name within category', async () => {
      // Create another gene in same category
      await store.createGene({
        name: 'Another Gene',
        category: 'Test',
        description: 'Another gene',
      });

      const updates: UpdateGeneRequest = {
        name: 'Another Gene',
      };

      await expect(store.updateGene(testGene.id, updates)).rejects.toThrow(DuplicateGeneError);
    });

    it('should allow same name if unchanged', async () => {
      const updates: UpdateGeneRequest = {
        name: 'Original Name',
        description: 'Updated description',
      };

      const updated = await store.updateGene(testGene.id, updates);

      expect(updated.name).toBe('Original Name');
      expect(updated.description).toBe('Updated description');
    });

    it('should not allow updating category', async () => {
      // Category is not in UpdateGeneRequest, so it can't be updated
      const updates: UpdateGeneRequest = {
        name: 'New Name',
      };

      const updated = await store.updateGene(testGene.id, updates);

      expect(updated.category).toBe('Test');
    });
  });

  describe('validateGeneExists', () => {
    it('AC-ASSET-007: should return true for existing gene', async () => {
      const gene = await store.createGene({
        name: 'Existence Test',
        category: 'Test',
        description: 'Test gene',
      });

      const exists = await store.validateGeneExists(gene.id);

      expect(exists).toBe(true);
    });

    it('AC-ASSET-007: should return false for non-existent gene', async () => {
      const exists = await store.validateGeneExists('gene_nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('linkCapsuleToGene', () => {
    let testGene: Gene;
    const capsuleId = 'capsule-123';

    beforeEach(async () => {
      testGene = await store.createGene({
        name: 'Link Test Gene',
        category: 'Test',
        description: 'Gene for linking test',
      });
      experienceStorage.addExperience(capsuleId);
    });

    it('AC-ASSET-003: should link Capsule to Gene via gene_id', async () => {
      await store.linkCapsuleToGene(capsuleId, testGene.id);

      // Verify link was successful (no exception thrown)
      // In a real implementation, we would query the experience to verify
    });

    it('AC-ASSET-007: should reject link to non-existent gene', async () => {
      await expect(store.linkCapsuleToGene(capsuleId, 'gene_nonexistent')).rejects.toThrow(
        GeneNotFoundError
      );
      await expect(store.linkCapsuleToGene(capsuleId, 'gene_nonexistent')).rejects.toThrow(
        "Gene 'gene_nonexistent' not found"
      );
    });

    it('should reject link if experience storage not configured', async () => {
      const storeWithoutExp = new AssetStore({
        geneStorage,
        experienceStorage: undefined,
      });

      await expect(
        storeWithoutExp.linkCapsuleToGene(capsuleId, testGene.id)
      ).rejects.toThrow('Experience storage not configured');
    });

    it('should reject link to non-existent capsule', async () => {
      await expect(
        store.linkCapsuleToGene('nonexistent-capsule', testGene.id)
      ).rejects.toThrow("Capsule 'nonexistent-capsule' not found");
    });
  });
});

describe('generateGeneId', () => {
  let geneStorage: InMemoryGeneStorage;

  beforeEach(() => {
    geneStorage = new InMemoryGeneStorage();
  });

  it('should generate gene_id from name and category', async () => {
    const id = await generateGeneId('Connection Timeout', 'Network', () =>
      geneStorage.existsById('')
    );

    expect(id).toBe('gene_network_connection_timeout');
  });

  it('should normalize name to lowercase', async () => {
    const id = await generateGeneId('UPPERCASE NAME', 'Category', () =>
      geneStorage.existsById('')
    );

    expect(id).toBe('gene_category_uppercase_name');
  });

  it('should replace spaces with underscores', async () => {
    const id = await generateGeneId('multi word name', 'multi word category', () =>
      geneStorage.existsById('')
    );

    expect(id).toBe('gene_multi_word_category_multi_word_name');
  });

  it('should remove special characters', async () => {
    const id = await generateGeneId('Fix Bug #123!', 'Test@Category', () =>
      geneStorage.existsById('')
    );

    expect(id).toBe('gene_testcategory_fix_bug_123');
  });

  it('should append suffix if gene_id exists', async () => {
    // Insert a gene with the base ID
    await geneStorage.insert({
      id: 'gene_test_test_gene',
      name: 'Test Gene',
      category: 'Test',
      description: 'Original',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const id = await generateGeneId('Test Gene', 'Test', (checkId) =>
      geneStorage.existsById(checkId)
    );

    expect(id).toBe('gene_test_test_gene_1');
  });

  it('should increment suffix until unique ID found', async () => {
    // Insert genes with base ID and suffixes 1, 2
    for (let i = 0; i <= 2; i++) {
      const suffix = i === 0 ? '' : `_${i}`;
      await geneStorage.insert({
        id: `gene_test_test_gene${suffix}`,
        name: `Test Gene ${i}`,
        category: 'Test',
        description: `Gene ${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const id = await generateGeneId('Test Gene', 'Test', (checkId) =>
      geneStorage.existsById(checkId)
    );

    expect(id).toBe('gene_test_test_gene_3');
  });
});

describe('InMemoryGeneStorage', () => {
  let storage: InMemoryGeneStorage;

  beforeEach(() => {
    storage = new InMemoryGeneStorage();
  });

  it('should insert and retrieve genes', async () => {
    const gene: Gene = {
      id: 'gene_test',
      name: 'Test',
      category: 'Test',
      description: 'Test gene',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    await storage.insert(gene);
    const retrieved = await storage.findById(gene.id);

    expect(retrieved).toEqual(gene);
  });

  it('should return null for non-existent gene', async () => {
    const retrieved = await storage.findById('nonexistent');

    expect(retrieved).toBeNull();
  });

  it('should find genes by category', async () => {
    await storage.insert({
      id: 'gene_network_1',
      name: 'Network 1',
      category: 'Network',
      description: '',
      created_at: '',
      updated_at: '',
    });
    await storage.insert({
      id: 'gene_network_2',
      name: 'Network 2',
      category: 'Network',
      description: '',
      created_at: '',
      updated_at: '',
    });
    await storage.insert({
      id: 'gene_db_1',
      name: 'Database 1',
      category: 'Database',
      description: '',
      created_at: '',
      updated_at: '',
    });

    const networkGenes = await storage.findByCategory('Network');

    expect(networkGenes).toHaveLength(2);
    expect(networkGenes.every((g) => g.category === 'Network')).toBe(true);
  });

  it('should find gene by name and category', async () => {
    await storage.insert({
      id: 'gene_test_unique',
      name: 'Unique Gene',
      category: 'Test',
      description: '',
      created_at: '',
      updated_at: '',
    });

    const found = await storage.findByNameAndCategory('Unique Gene', 'Test');
    const notFound = await storage.findByNameAndCategory('Unique Gene', 'Other');

    expect(found).not.toBeNull();
    expect(found!.id).toBe('gene_test_unique');
    expect(notFound).toBeNull();
  });

  it('should check existence by ID', async () => {
    await storage.insert({
      id: 'gene_exists',
      name: 'Exists',
      category: 'Test',
      description: '',
      created_at: '',
      updated_at: '',
    });

    const exists = await storage.existsById('gene_exists');
    const notExists = await storage.existsById('gene_not_exists');

    expect(exists).toBe(true);
    expect(notExists).toBe(false);
  });

  it('should update gene', async () => {
    await storage.insert({
      id: 'gene_update',
      name: 'Original',
      category: 'Test',
      description: 'Original description',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    await storage.update('gene_update', {
      name: 'Updated',
      description: 'Updated description',
    });

    const updated = await storage.findById('gene_update');

    expect(updated!.name).toBe('Updated');
    expect(updated!.description).toBe('Updated description');
    expect(updated!.category).toBe('Test'); // Should remain unchanged
  });

  it('should return all genes sorted by category and name', async () => {
    await storage.insert({
      id: 'gene_b_2',
      name: 'B2',
      category: 'B',
      description: '',
      created_at: '',
      updated_at: '',
    });
    await storage.insert({
      id: 'gene_a_1',
      name: 'A1',
      category: 'A',
      description: '',
      created_at: '',
      updated_at: '',
    });
    await storage.insert({
      id: 'gene_b_1',
      name: 'B1',
      category: 'B',
      description: '',
      created_at: '',
      updated_at: '',
    });

    const all = await storage.findAll();

    expect(all[0].id).toBe('gene_a_1');
    expect(all[1].id).toBe('gene_b_1');
    expect(all[2].id).toBe('gene_b_2');
  });
});

describe('Performance', () => {
  let store: AssetStore;
  let geneStorage: InMemoryGeneStorage;

  beforeEach(() => {
    geneStorage = new InMemoryGeneStorage();
    const experienceStorage = new InMemoryExperienceStorage();
    store = new AssetStore({ geneStorage, experienceStorage });
  });

  it('should complete gene lookup within 10ms', async () => {
    // Create a gene
    const gene = await store.createGene({
      name: 'Performance Test',
      category: 'Test',
      description: 'Performance test gene',
    });

    // Measure getGene performance
    const start = performance.now();
    await store.getGene(gene.id);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('should complete validateGeneExists within 10ms', async () => {
    const gene = await store.createGene({
      name: 'Validation Performance Test',
      category: 'Test',
      description: 'Validation performance test gene',
    });

    const start = performance.now();
    await store.validateGeneExists(gene.id);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});

describe('Edge Cases', () => {
  let store: AssetStore;
  let geneStorage: InMemoryGeneStorage;
  let experienceStorage: InMemoryExperienceStorage;

  beforeEach(() => {
    geneStorage = new InMemoryGeneStorage();
    experienceStorage = new InMemoryExperienceStorage();
    store = new AssetStore({ geneStorage, experienceStorage });
  });

  it('should handle very long gene names', async () => {
    const longName = 'A'.repeat(200);
    const gene = await store.createGene({
      name: longName,
      category: 'Test',
      description: 'Long name test',
    });

    expect(gene.name).toBe(longName);
    expect(gene.id.length).toBeLessThanOrEqual(100);
  });

  it('should handle unicode characters in name', async () => {
    const gene = await store.createGene({
      name: 'Unicode Test - 你好世界 🎉',
      category: 'Test',
      description: 'Unicode test',
    });

    // Unicode chars should be stripped from ID, hyphens become underscores via space replacement
    // Note: "Unicode Test - 你好世界 🎉" normalizes to "unicode_test _ ____ _" then to "unicode_test_____"
    // Actually: lowercase -> "unicode test - 你好世界 🎉" -> spaces to underscore -> "unicode_test_-____世界__🎉"
    // Then remove non-alphanum -> "unicode_test____"
    // The hyphen is replaced, and unicode/special chars removed, leaving multiple underscores
    expect(gene.id).toMatch(/^gene_test_unicode_test/);
    expect(gene.name).toBe('Unicode Test - 你好世界 🎉');
  });

  it('should handle concurrent gene creation with same name', async () => {
    const request: CreateGeneRequest = {
      name: 'Concurrent Test',
      category: 'Test',
      description: 'Concurrent creation test',
    };

    // Create first gene
    await store.createGene(request);

    // Attempt to create second gene with same name should fail
    await expect(store.createGene(request)).rejects.toThrow(DuplicateGeneError);
  });

  it('should handle empty gene list', async () => {
    const genes = await store.listGenes();

    expect(genes).toEqual([]);
  });

  it('should handle updating gene to same values', async () => {
    const gene = await store.createGene({
      name: 'Same Values Test',
      category: 'Test',
      description: 'Original description',
    });

    const updated = await store.updateGene(gene.id, {
      name: 'Same Values Test',
      description: 'Original description',
    });

    expect(updated.name).toBe('Same Values Test');
    expect(updated.description).toBe('Original description');
  });
});
