/**
 * AEP Protocol Types
 * 
 * Type definitions for the Agent Experience Protocol
 */

// Valid capability values
export type Capability = 'fetch' | 'publish' | 'feedback';

// AEP Envelope structure
export interface AEPEnvelope {
  protocol: 'aep';
  version: string;
  type: 'hello' | 'fetch' | 'publish' | 'feedback';
  sender: string | null;
  timestamp: string; // ISO 8601
  payload: unknown;
}

// Hello Request Types
export interface HelloPayload {
  capabilities: Capability[];
  version: string;
}

export interface HelloRequest extends AEPEnvelope {
  type: 'hello';
  sender: null;
  payload: HelloPayload;
}

// Hello Response Types
export interface HelloResponse {
  status: 'registered';
  agent_id: string;
  hub_version: string;
  registered_at: string; // ISO 8601
}

// Error Response Types
export interface ErrorResponse {
  error: string;
  message: string;
  valid_capabilities?: Capability[];
}

// Agent database record
export interface AgentRecord {
  id: string;
  capabilities: Capability[];
  signature: string;
  ip_address: string | null;
  created_at: Date;
  last_seen: Date;
}
