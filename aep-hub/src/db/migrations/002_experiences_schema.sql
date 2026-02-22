-- AEP Hub Database Schema
-- Migration 002: Experiences table

-- Experiences table
CREATE TABLE IF NOT EXISTS experiences (
    id VARCHAR(64) PRIMARY KEY,              -- exp_{ts}_{hash8}
    trigger TEXT NOT NULL,                    -- Natural language trigger
    solution TEXT NOT NULL,                   -- Verified solution
    confidence DECIMAL(3,2) NOT NULL,         -- Publisher's confidence (0.00-1.00)
    creator_id VARCHAR(64) NOT NULL REFERENCES agents(id), -- Link to agents table
    status VARCHAR(20) NOT NULL DEFAULT 'candidate', -- candidate / promoted / deprecated
    gdi_score DECIMAL(5,4) DEFAULT 0.0,      -- Current GDI index
    signals_match JSONB,                      -- Extracted keyword/errsig tags
    gene_id VARCHAR(64),                      -- Optional gene reference
    context JSONB,                            -- Additional context
    blast_radius JSONB,                       -- { files: number, lines: number }
    content_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash for duplicate detection
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_experiences_creator_id ON experiences(creator_id);
CREATE INDEX IF NOT EXISTS idx_experiences_status ON experiences(status);
CREATE INDEX IF NOT EXISTS idx_experiences_content_hash ON experiences(content_hash);
CREATE INDEX IF NOT EXISTS idx_experiences_created_at ON experiences(created_at);
CREATE INDEX IF NOT EXISTS idx_experiences_gdi_score ON experiences(gdi_score DESC);

-- GIN index for signals_match array queries
CREATE INDEX IF NOT EXISTS idx_experiences_signals_match ON experiences USING GIN (signals_match);

-- Comments
COMMENT ON TABLE experiences IS 'Agent experiences with trigger/solution pairs';
COMMENT ON COLUMN experiences.id IS 'Unique experience identifier in format exp_{ts}_{hash8}';
COMMENT ON COLUMN experiences.trigger IS 'Natural language description of the problem';
COMMENT ON COLUMN experiences.solution IS 'Verified solution steps';
COMMENT ON COLUMN experiences.confidence IS 'Publisher confidence level (0.00-1.00)';
COMMENT ON COLUMN experiences.creator_id IS 'Agent ID of the publisher';
COMMENT ON COLUMN experiences.status IS 'Lifecycle status: candidate, promoted, deprecated';
COMMENT ON COLUMN experiences.gdi_score IS 'Global Discovery Index score';
COMMENT ON COLUMN experiences.signals_match IS 'JSON array of signals for matching';
COMMENT ON COLUMN experiences.content_hash IS 'SHA-256 hash of normalized trigger+solution for deduplication';

-- Signal index table for inverted index lookups
CREATE TABLE IF NOT EXISTS signal_index (
    id SERIAL PRIMARY KEY,
    signal_key VARCHAR(255) NOT NULL,         -- Normalized signal key
    experience_id VARCHAR(64) NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    weight DECIMAL(3,2) DEFAULT 1.0,          -- Signal weight
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for signal lookup
CREATE INDEX IF NOT EXISTS idx_signal_index_signal_key ON signal_index(signal_key);
CREATE INDEX IF NOT EXISTS idx_signal_index_experience_id ON signal_index(experience_id);

-- Unique constraint to prevent duplicate signal mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_index_unique ON signal_index(signal_key, experience_id);

COMMENT ON TABLE signal_index IS 'Inverted index for signal-based experience matching';
COMMENT ON COLUMN signal_index.signal_key IS 'Normalized signal string for lookup';
COMMENT ON COLUMN signal_index.experience_id IS 'Reference to associated experience';
COMMENT ON COLUMN signal_index.weight IS 'Signal relevance weight';
