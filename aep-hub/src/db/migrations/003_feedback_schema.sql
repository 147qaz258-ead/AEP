-- AEP Hub Database Schema
-- Migration 003: Feedback table and experience stats

-- Add statistics columns to experiences table
ALTER TABLE experiences
    ADD COLUMN IF NOT EXISTS total_uses INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_success INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_feedback INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS positive_feedback INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS success_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_gdi_update TIMESTAMP;

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id VARCHAR(64) PRIMARY KEY,               -- fb_{ts}_{hash8}
    experience_id VARCHAR(64) NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
    outcome VARCHAR(20) NOT NULL,             -- success / failure / partial
    score DECIMAL(3,2),                       -- Optional score 0.00-1.00
    notes TEXT,                               -- Optional feedback notes
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for feedback queries
CREATE INDEX IF NOT EXISTS idx_feedback_experience_id ON feedback(experience_id);
CREATE INDEX IF NOT EXISTS idx_feedback_agent_id ON feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);

-- Unique constraint to prevent duplicate feedback from same agent on same experience
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_unique ON feedback(agent_id, experience_id);

-- Comments
COMMENT ON TABLE feedback IS 'Agent feedback on experiences';
COMMENT ON COLUMN feedback.id IS 'Unique feedback identifier in format fb_{ts}_{hash8}';
COMMENT ON COLUMN feedback.experience_id IS 'Reference to the experience being rated';
COMMENT ON COLUMN feedback.agent_id IS 'Agent ID of the feedback submitter';
COMMENT ON COLUMN feedback.outcome IS 'Feedback outcome: success, failure, or partial';
COMMENT ON COLUMN feedback.score IS 'Optional detailed score (0.00-1.00)';
COMMENT ON COLUMN feedback.notes IS 'Optional feedback notes';

COMMENT ON COLUMN experiences.total_uses IS 'Total number of times this experience has been used';
COMMENT ON COLUMN experiences.total_success IS 'Total number of successful uses';
COMMENT ON COLUMN experiences.total_feedback IS 'Total number of feedback received';
COMMENT ON COLUMN experiences.positive_feedback IS 'Number of positive feedback (success + partial with score >= 0.5)';
COMMENT ON COLUMN experiences.success_streak IS 'Current consecutive success streak';
COMMENT ON COLUMN experiences.consecutive_failures IS 'Current consecutive failure count';
COMMENT ON COLUMN experiences.last_used_at IS 'Timestamp of last feedback/use';
COMMENT ON COLUMN experiences.last_gdi_update IS 'Timestamp of last GDI recalculation';
