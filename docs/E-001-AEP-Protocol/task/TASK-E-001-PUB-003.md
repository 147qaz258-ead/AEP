# TASK-E-001-PUB-003: Asset Store Integration

> **EPIC_ID:** E-001-AEP-Protocol
> **Story:** STORY-003
> **Status:** DONE
> **Beads 任务ID:** agent network-wvy
> **依赖:** []

## 摘要

Implement the Asset Store for managing Gene (reusable strategy templates) and Capsule (specific solution instances) structures. Provides CRUD operations for Genes and links Genes to Capsules (experiences).

## 验收标准

- [x] AC-ASSET-001: Create Gene with unique gene_id
- [x] AC-ASSET-002: Validate Gene name is unique within category
- [x] AC-ASSET-003: Link Capsules to Genes via gene_id foreign key
- [x] AC-ASSET-004: Retrieve Gene by gene_id
- [x] AC-ASSET-005: List Genes by category
- [x] AC-ASSET-006: Update Gene metadata (name, description)
- [x] AC-ASSET-007: Validate gene_id exists before linking to Capsule

## 接口定义

### Gene Schema

```typescript
interface Gene {
  id: string;  // gene_repair_connection_timeout
  name: string;
  category: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface CreateGeneRequest {
  name: string;
  category: string;
  description: string;
}
```

### Asset Store Interface

```python
class AssetStore:
    """Manage Gene and Capsule assets."""

    def create_gene(self, request: CreateGeneRequest) -> Gene:
        """Create new Gene."""

    def get_gene(self, gene_id: str) -> Optional[Gene]:
        """Retrieve Gene by ID."""

    def list_genes(self, category: Optional[str]) -> List[Gene]:
        """List Genes, optionally filtered by category."""

    def update_gene(self, gene_id: str, updates: dict) -> Gene:
        """Update Gene metadata."""

    def validate_gene_exists(self, gene_id: str) -> bool:
        """Validate gene_id exists."""

    def link_capsule_to_gene(self, capsule_id: str, gene_id: str) -> None:
        """Link Capsule (experience) to Gene."""
```

## 实现笔记

### Gene ID Generation (Pseudocode)

```python
import re

def generate_gene_id(name: str, category: str) -> str:
    """Generate human-readable gene_id from name and category."""
    # Normalize name: lowercase, replace spaces with underscores
    normalized = name.lower().strip()
    normalized = re.sub(r'\s+', '_', normalized)
    normalized = re.sub(r'[^a-z0-9_]', '', normalized)

    # Combine with category prefix
    category_prefix = category.lower().replace(' ', '_')
    gene_id = f"gene_{category_prefix}_{normalized}"

    # Ensure uniqueness by appending number if needed
    suffix = 1
    base_id = gene_id
    while gene_exists(gene_id):
        gene_id = f"{base_id}_{suffix}"
        suffix += 1

    return gene_id
```

### Asset Store Implementation

```python
class AssetStore:
    def create_gene(self, request: CreateGeneRequest) -> Gene:
        """Create new Gene."""
        # Validate name uniqueness within category
        existing = db.query(
            "SELECT id FROM genes WHERE name = ? AND category = ?",
            request.name, request.category
        ).first()

        if existing:
            raise DuplicateError(f"Gene '{request.name}' already exists in category '{request.category}'")

        # Generate gene_id
        gene_id = generate_gene_id(request.name, request.category)

        # Store gene
        now = datetime.now()
        db.insert("genes", {
            "id": gene_id,
            "name": request.name,
            "category": request.category,
            "description": request.description,
            "created_at": now,
            "updated_at": now
        })

        return Gene(
            id=gene_id,
            name=request.name,
            category=request.category,
            description=request.description,
            created_at=now.isoformat(),
            updated_at=now.isoformat()
        )

    def get_gene(self, gene_id: str) -> Optional[Gene]:
        """Retrieve Gene by ID."""
        result = db.query(
            "SELECT * FROM genes WHERE id = ?",
            gene_id
        ).first()

        if not result:
            return None

        return Gene(
            id=result.id,
            name=result.name,
            category=result.category,
            description=result.description,
            created_at=result.created_at.isoformat(),
            updated_at=result.updated_at.isoformat()
        )

    def list_genes(self, category: Optional[str] = None) -> List[Gene]:
        """List Genes, optionally filtered by category."""
        if category:
            results = db.query(
                "SELECT * FROM genes WHERE category = ? ORDER BY name",
                category
            )
        else:
            results = db.query(
                "SELECT * FROM genes ORDER BY category, name"
            )

        return [
            Gene(
                id=r.id,
                name=r.name,
                category=r.category,
                description=r.description,
                created_at=r.created_at.isoformat(),
                updated_at=r.updated_at.isoformat()
            )
            for r in results
        ]

    def update_gene(self, gene_id: str, updates: dict) -> Gene:
        """Update Gene metadata."""
        # Validate gene exists
        gene = self.get_gene(gene_id)
        if not gene:
            raise NotFoundError(f"Gene '{gene_id}' not found")

        # Update allowed fields
        allowed_fields = {"name", "description"}
        update_data = {k: v for k, v in updates.items() if k in allowed_fields}

        if not update_data:
            raise ValidationError("No valid fields to update")

        # Update database
        update_data["updated_at"] = datetime.now()
        db.update("genes", gene_id, update_data)

        return self.get_gene(gene_id)

    def validate_gene_exists(self, gene_id: str) -> bool:
        """Validate gene_id exists."""
        return db.query(
            "SELECT 1 FROM genes WHERE id = ?",
            gene_id
        ).first() is not None

    def link_capsule_to_gene(self, capsule_id: str, gene_id: str) -> None:
        """Link Capsule (experience) to Gene."""
        if not self.validate_gene_exists(gene_id):
            raise NotFoundError(f"Gene '{gene_id}' not found")

        db.update("experiences", capsule_id, {"gene_id": gene_id})
```

### Database Schema

```sql
CREATE TABLE genes (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE (name, category),
    INDEX idx_category (category),
    INDEX idx_name (name)
);

ALTER TABLE experiences ADD COLUMN gene_id VARCHAR(128) REFERENCES genes(id);
CREATE INDEX idx_gene_id ON experiences(gene_id);
```

## 技术约束

- **Uniqueness**: Gene name must be unique within category
- **Referential Integrity**: gene_id must exist before linking to experience
- **Performance**: Gene lookup < 10ms

## 验证方式

1. **Unit Tests**: Gene ID generation, validation
2. **Integration Tests**: CRUD operations
3. **Constraint Tests**: Uniqueness, foreign key
4. **Performance Tests**: Lookup latency

## 实现记录

### 实际实现

**文件位置**: `src/aep/asset-store/index.ts`

**实现方式**:
- TypeScript implementation of AssetStore class with async methods
- In-memory storage implementation (`InMemoryGeneStorage`, `InMemoryExperienceStorage`) for testing
- Storage interface abstraction for future database integration
- Human-readable gene ID generation with uniqueness guarantee

**关键类和接口**:
1. `Gene` - Gene entity interface
2. `CreateGeneRequest` / `UpdateGeneRequest` - Request DTOs
3. `AssetStore` - Main asset store class with CRUD operations
4. `GeneStorage` / `ExperienceStorage` - Storage abstraction interfaces
5. `DuplicateGeneError`, `GeneNotFoundError`, `ValidationError` - Custom error classes
6. `generateGeneId()` - ID generation function with normalization

**ID Generation Logic**:
- Normalize name: lowercase, replace spaces with underscores, remove special characters
- Normalize category: same as name
- Format: `gene_{category}_{name}`
- Append counter suffix if ID already exists (e.g., `gene_network_timeout_1`)

## 测试记录

**测试文件**: `src/aep/asset-store/__tests__/assetStore.test.ts`

**测试覆盖**:
- 49 tests covering all acceptance criteria
- AC-ASSET-001: Unique gene_id generation tests
- AC-ASSET-002: Name uniqueness validation tests within category
- AC-ASSET-003: Capsule-to-Gene linking tests
- AC-ASSET-004: Gene retrieval by ID tests
- AC-ASSET-005: Gene listing with category filter tests
- AC-ASSET-006: Gene metadata update tests
- AC-ASSET-007: Gene existence validation tests
- Performance tests: Gene lookup < 10ms verified
- Edge cases: Unicode characters, long names, empty inputs

**测试结果**: All 49 tests passed

```
Test Files  1 passed
Tests       49 passed
Duration    72ms
```

## 关联文档

- **TECH**: `../tech/TECH-E-001-v1.md` §2.2 Table: experiences
- **STORY**: `../../_project/stories/STORY-003-experience-publish.md`
