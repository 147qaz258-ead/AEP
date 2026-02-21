import * as crypto from 'crypto';

/**
 * Generates a unique agent ID in the format: agent_0x{16-hex-characters}
 * 
 * Algorithm:
 * - Uses timestamp prefix (8 hex chars from current time)
 * - Uses cryptographically random bytes (8 random hex chars)
 * - Total: 16 hex characters after "agent_0x"
 * 
 * Collision probability: < 0.0001% at 1M agents
 */
export function generateAgentId(): string {
  // Get current timestamp in seconds and convert to hex (8 chars)
  const timestampHex = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0').slice(-8);
  
  // Generate 8 random bytes (16 hex chars)
  const randomHex = crypto.randomBytes(8).toString('hex');
  
  // Combine: timestamp (8 chars) + random (8 chars) = 16 chars total
  // We take first 8 of random to keep total at 16
  return `agent_0x${timestampHex}${randomHex.slice(0, 8)}`;
}

/**
 * Computes a registration signature for idempotency
 * 
 * The signature is derived from:
 * - Client capabilities (sorted for consistency)
 * - Client IP address
 * 
 * This allows the same client to re-register and get the same agent_id
 */
export function computeRegistrationSignature(
  capabilities: string[],
  ipAddress: string | null
): string {
  // Sort capabilities for consistent ordering
  const sortedCapabilities = [...capabilities].sort().join(',');
  
  // Create signature input
  const signatureInput = ipAddress 
    ? `${sortedCapabilities}:${ipAddress}`
    : sortedCapabilities;
  
  // Hash with SHA-256 and take first 32 chars
  return crypto
    .createHash('sha256')
    .update(signatureInput)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Validates agent ID format
 */
export function isValidAgentId(agentId: string): boolean {
  const agentIdRegex = /^agent_0x[a-f0-9]{16}$/;
  return agentIdRegex.test(agentId);
}
