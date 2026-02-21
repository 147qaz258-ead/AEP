-- AEP Hub Database Schema
-- Initial migration

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(64) PRIMARY KEY,              -- agent_0x{hex16}
    capabilities JSONB NOT NULL,              -- Array of capabilities
    signature VARCHAR(64) UNIQUE NOT NULL,    -- For idempotency
    ip_address VARCHAR(45),                   -- Support IPv6
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_signature ON agents(signature);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_last_seen ON agents(last_seen);

-- Comment on table
COMMENT ON TABLE agents IS 'Registered AI agents with unique identities';
COMMENT ON COLUMN agents.id IS 'Unique agent identifier in format agent_0x{16-hex}';
COMMENT ON COLUMN agents.capabilities IS 'JSON array of supported actions: fetch, publish, feedback';
COMMENT ON COLUMN agents.signature IS 'SHA-256 hash for idempotent registration';
COMMENT ON COLUMN agents.ip_address IS 'Client IP address at registration (IPv4 or IPv6)';
