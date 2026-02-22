-- AEP Hub Database Schema
-- Migration 004: Status transition timestamps

-- Add status transition timestamp columns to experiences table
ALTER TABLE experiences
    ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP;

-- Comments
COMMENT ON COLUMN experiences.promoted_at IS 'Timestamp when experience was promoted from candidate';
COMMENT ON COLUMN experiences.deprecated_at IS 'Timestamp when experience was deprecated';
