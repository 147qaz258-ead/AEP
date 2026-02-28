/**
 * AgentAction and Session type definitions for AEP SDK
 * @module aep/session
 */
/**
 * Generate a unique ID for actions and sessions
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
/**
 * Create a new AgentAction with defaults
 */
export function createAgentAction(options) {
    return {
        id: options.id || generateId(),
        timestamp: options.timestamp || new Date().toISOString(),
        action_type: options.action_type,
        trigger: options.trigger,
        solution: options.solution,
        result: options.result || 'success',
        context: options.context || {},
        feedback: options.feedback,
    };
}
/**
 * Create a new Session with defaults
 */
export function createSession(options) {
    return {
        id: options.id || generateId(),
        agent_id: options.agent_id,
        started_at: options.started_at || new Date().toISOString(),
        ended_at: options.ended_at,
        actions: options.actions || [],
        summary: options.summary,
    };
}
//# sourceMappingURL=types.js.map