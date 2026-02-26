/**
 * Unit tests for ActionLogger (TypeScript)
 *
 * Tests cover:
 * - logAction with and without active session
 * - logToolCall, logMessage, logDecision convenience methods
 * - getAction and updateAction methods
 * - Latency requirements
 * - Error handling
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ActionLogger,
  WriteError,
  SessionRecorder,
  SessionNotActiveError,
  ActionType,
  ActionResult,
  createAgentAction,
  ToolCallLog,
} from '../index';

describe('ActionLogger', () => {
  let tempDir: string;
  let recorder: SessionRecorder;
  let logger: ActionLogger;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aep-test-'));
    recorder = new SessionRecorder(tempDir, 'agent_0x1234');
    logger = new ActionLogger(recorder);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should initialize with SessionRecorder', () => {
      expect(logger.recorder).toBe(recorder);
    });

    it('should initialize with options object', () => {
      const loggerWithOptions = new ActionLogger({ recorder });
      expect(loggerWithOptions.recorder).toBe(recorder);
    });
  });

  describe('recorder property', () => {
    it('should return the underlying recorder', () => {
      expect(logger.recorder).toBe(recorder);
    });
  });

  describe('logAction', () => {
    it('should throw SessionNotActiveError without active session', () => {
      const action = createAgentAction({
        action_type: 'message',
        trigger: 'test',
        solution: 'test solution',
        result: 'success',
      });

      expect(() => logger.logAction(action)).toThrow(SessionNotActiveError);
    });

    it('should successfully log an action', () => {
      recorder.startSession();

      const action = createAgentAction({
        action_type: 'message',
        trigger: 'Hello',
        solution: 'Hi there!',
        result: 'success',
      });

      const actionId = logger.logAction(action);
      expect(actionId).toBe(action.id);
    });

    it('should persist action to session', () => {
      const sessionId = recorder.startSession();

      logger.logMessage({
        trigger: 'Hello',
        solution: 'Hi there!',
        result: 'success',
      });

      const session = recorder.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.actions).toHaveLength(1);
      expect(session!.actions[0].trigger).toBe('Hello');
      expect(session!.actions[0].solution).toBe('Hi there!');
    });
  });

  describe('logToolCall', () => {
    it('should log a tool call action', () => {
      recorder.startSession();

      const actionId = logger.logToolCall({
        toolName: 'bash',
        trigger: 'File not found',
        solution: 'Create file',
        result: 'success',
      });

      expect(actionId).toBeDefined();

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session).toBeDefined();
      const action = session!.actions[0];
      expect(action.action_type).toBe('tool_call');
      expect(action.trigger).toBe('File not found');
      expect(action.solution).toBe('Create file');
      expect(action.result).toBe('success');
      expect(action.context.tool_name).toBe('bash');
      expect(action.context.tools_used).toContain('bash');
    });

    it('should log tool call with context', () => {
      recorder.startSession();

      logger.logToolCall({
        toolName: 'read_file',
        trigger: 'Need file content',
        solution: 'Read file content',
        result: 'success',
        context: { file_path: '/path/to/file.txt', encoding: 'utf-8' },
      });

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session!.actions[0].context.file_path).toBe('/path/to/file.txt');
      expect(session!.actions[0].context.encoding).toBe('utf-8');
      expect(session!.actions[0].context.tool_name).toBe('read_file');
    });

    it('should support legacy signature', () => {
      recorder.startSession();

      const actionId = logger.logToolCall(
        'bash',
        'File not found',
        'Create file',
        'success',
        { extra: 'info' }
      );

      expect(actionId).toBeDefined();

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session!.actions[0].action_type).toBe('tool_call');
      expect(session!.actions[0].context.extra).toBe('info');
    });
  });

  describe('log_tool_call', () => {
    it('should log a tool call with structured log format', () => {
      recorder.startSession();

      const actionId = logger.log_tool_call({
        tool_name: 'read_file',
        arguments: { path: '/src/index.ts' },
        result: { content: 'file content here' },
        duration_ms: 150,
      });

      expect(actionId).toBeDefined();

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session).toBeDefined();
      const action = session!.actions[0];
      expect(action.action_type).toBe('tool_call');
      expect(action.result).toBe('success');
      expect(action.context.tool_name).toBe('read_file');
      expect(action.context.tool_arguments).toEqual({ path: '/src/index.ts' });
      expect(action.context.tool_result).toEqual({ content: 'file content here' });
      expect(action.context.duration_ms).toBe(150);
      expect(action.context.tools_used).toContain('read_file');
    });

    it('should log a failed tool call with error', () => {
      recorder.startSession();

      const actionId = logger.log_tool_call({
        tool_name: 'bash',
        arguments: { command: 'npm test' },
        result: null,
        error: 'Command failed with exit code 1',
        duration_ms: 5230,
      });

      expect(actionId).toBeDefined();

      const session = recorder.getSession(recorder.getActiveSession()!);
      const action = session!.actions[0];
      expect(action.action_type).toBe('tool_call');
      expect(action.result).toBe('failure');
      expect(action.context.tool_name).toBe('bash');
      expect(action.context.tool_error).toBe('Command failed with exit code 1');
      expect(action.context.duration_ms).toBe(5230);
      expect(action.solution).toContain('Error: Command failed with exit code 1');
    });

    it('should log tool call without optional fields', () => {
      recorder.startSession();

      const actionId = logger.log_tool_call({
        tool_name: 'search',
        arguments: { query: 'test' },
        result: ['result1', 'result2'],
      });

      expect(actionId).toBeDefined();

      const session = recorder.getSession(recorder.getActiveSession()!);
      const action = session!.actions[0];
      expect(action.action_type).toBe('tool_call');
      expect(action.result).toBe('success');
      expect(action.context.tool_name).toBe('search');
      expect(action.context.tool_arguments).toEqual({ query: 'test' });
      expect(action.context.tool_result).toEqual(['result1', 'result2']);
      expect(action.context.tool_error).toBeUndefined();
      expect(action.context.duration_ms).toBeUndefined();
    });

    it('should handle complex nested arguments and results', () => {
      recorder.startSession();

      const actionId = logger.log_tool_call({
        tool_name: 'complex_tool',
        arguments: {
          config: {
            nested: { deep: 'value' },
            array: [1, 2, 3],
          },
          options: ['a', 'b', 'c'],
        },
        result: {
          status: 'completed',
          data: {
            items: [{ id: 1, name: 'item1' }, { id: 2, name: 'item2' }],
          },
        },
        duration_ms: 1000,
      });

      const session = recorder.getSession(recorder.getActiveSession()!);
      const action = session!.actions[0];
      expect(action.context.tool_arguments.config.nested.deep).toBe('value');
      expect(action.context.tool_arguments.config.array).toEqual([1, 2, 3]);
      expect(action.context.tool_result.data.items).toHaveLength(2);
    });

    it('should persist log_tool_call to JSONL file', () => {
      const sessionId = recorder.startSession();

      logger.log_tool_call({
        tool_name: 'read_file',
        arguments: { path: '/src/index.ts' },
        result: { content: 'file content' },
        duration_ms: 100,
      });

      // Verify file content
      const filePath = path.join(tempDir, '.aep', 'sessions', `${sessionId}.jsonl`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2); // header + 1 action

      const actionLine = JSON.parse(lines[1]);
      expect(actionLine._type).toBe('action');
      expect(actionLine.action.action_type).toBe('tool_call');
      expect(actionLine.action.context.tool_name).toBe('read_file');
      expect(actionLine.action.context.duration_ms).toBe(100);
    });

    it('should throw SessionNotActiveError without active session', () => {
      expect(() =>
        logger.log_tool_call({
          tool_name: 'test',
          arguments: {},
          result: null,
        })
      ).toThrow(SessionNotActiveError);
    });
  });

  describe('logMessage', () => {
    it('should log a message action', () => {
      recorder.startSession();

      const actionId = logger.logMessage({
        trigger: 'User question',
        solution: 'Agent response',
        result: 'success',
      });

      expect(actionId).toBeDefined();

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session).toBeDefined();
      const action = session!.actions[0];
      expect(action.action_type).toBe('message');
      expect(action.trigger).toBe('User question');
      expect(action.solution).toBe('Agent response');
    });

    it('should log message with context', () => {
      recorder.startSession();

      logger.logMessage({
        trigger: 'Help request',
        solution: 'Provided assistance',
        result: 'success',
        context: { conversation_id: 'conv_123', user_id: 'user_456' },
      });

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session!.actions[0].context.conversation_id).toBe('conv_123');
      expect(session!.actions[0].context.user_id).toBe('user_456');
    });

    it('should support legacy signature', () => {
      recorder.startSession();

      const actionId = logger.logMessage(
        'User question',
        'Agent response',
        'success',
        { key: 'value' }
      );

      expect(actionId).toBeDefined();
    });
  });

  describe('logDecision', () => {
    it('should log a decision action', () => {
      recorder.startSession();

      const actionId = logger.logDecision({
        trigger: 'Multiple options available',
        solution: 'Chose option A',
        result: 'success',
      });

      expect(actionId).toBeDefined();

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session).toBeDefined();
      const action = session!.actions[0];
      expect(action.action_type).toBe('decision');
      expect(action.trigger).toBe('Multiple options available');
      expect(action.solution).toBe('Chose option A');
    });

    it('should log decision with context', () => {
      recorder.startSession();

      logger.logDecision({
        trigger: 'Need to choose strategy',
        solution: 'Selected aggressive strategy',
        result: 'partial',
        context: { alternatives: ['conservative', 'moderate', 'aggressive'] },
      });

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session!.actions[0].result).toBe('partial');
      expect(session!.actions[0].context.alternatives).toEqual([
        'conservative',
        'moderate',
        'aggressive',
      ]);
    });

    it('should support legacy signature', () => {
      recorder.startSession();

      const actionId = logger.logDecision(
        'Multiple options',
        'Chose A',
        'success',
        { key: 'value' }
      );

      expect(actionId).toBeDefined();
    });
  });

  describe('result variations', () => {
    it('should handle different result values', () => {
      recorder.startSession();

      logger.logMessage({ trigger: 'test', solution: 'test', result: 'success' });
      logger.logMessage({ trigger: 'test', solution: 'test', result: 'failure' });
      logger.logMessage({ trigger: 'test', solution: 'test', result: 'partial' });

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session!.actions[0].result).toBe('success');
      expect(session!.actions[1].result).toBe('failure');
      expect(session!.actions[2].result).toBe('partial');
    });
  });

  describe('getAction', () => {
    it('should return action when found', () => {
      recorder.startSession();

      const actionId = logger.logMessage({
        trigger: 'Test trigger',
        solution: 'Test solution',
      });

      const foundAction = logger.getAction(actionId);
      expect(foundAction).toBeDefined();
      expect(foundAction!.id).toBe(actionId);
      expect(foundAction!.trigger).toBe('Test trigger');
    });

    it('should return undefined when action not found', () => {
      recorder.startSession();

      const foundAction = logger.getAction('nonexistent_action_id');
      expect(foundAction).toBeUndefined();
    });

    it('should return undefined without active session', () => {
      const foundAction = logger.getAction('some_id');
      expect(foundAction).toBeUndefined();
    });
  });

  describe('updateAction', () => {
    it('should update action successfully', () => {
      recorder.startSession();

      const actionId = logger.logMessage({
        trigger: 'Original trigger',
        solution: 'Original solution',
      });

      const success = logger.updateAction(actionId, {
        trigger: 'Updated trigger',
        solution: 'Updated solution',
      });

      expect(success).toBe(true);

      const updatedAction = logger.getAction(actionId);
      expect(updatedAction).toBeDefined();
      expect(updatedAction!.trigger).toBe('Updated trigger');
      expect(updatedAction!.solution).toBe('Updated solution');
    });

    it('should return false when action not found', () => {
      recorder.startSession();

      const success = logger.updateAction('nonexistent_id', { trigger: 'New' });
      expect(success).toBe(false);
    });

    it('should return false without active session', () => {
      const success = logger.updateAction('some_id', { trigger: 'New' });
      expect(success).toBe(false);
    });

    it('should update result', () => {
      recorder.startSession();

      const actionId = logger.logMessage({
        trigger: 'test',
        solution: 'test',
        result: 'success',
      });

      const success = logger.updateAction(actionId, { result: 'failure' });

      expect(success).toBe(true);
      const action = logger.getAction(actionId);
      expect(action!.result).toBe('failure');
    });

    it('should merge context', () => {
      recorder.startSession();

      const actionId = logger.logMessage({
        trigger: 'test',
        solution: 'test',
        context: { existing_key: 'existing_value' },
      });

      const success = logger.updateAction(actionId, {
        context: { new_key: 'new_value' },
      });

      expect(success).toBe(true);
      const action = logger.getAction(actionId);
      expect(action!.context.existing_key).toBe('existing_value');
      expect(action!.context.new_key).toBe('new_value');
    });
  });

  describe('getActionCount', () => {
    it('should return correct count', () => {
      recorder.startSession();

      expect(logger.getActionCount()).toBe(0);

      logger.logMessage({ trigger: 'test1', solution: 'test' });
      expect(logger.getActionCount()).toBe(1);

      logger.logToolCall({ toolName: 'bash', trigger: 'test2', solution: 'test' });
      expect(logger.getActionCount()).toBe(2);

      logger.logDecision({ trigger: 'test3', solution: 'test' });
      expect(logger.getActionCount()).toBe(3);
    });

    it('should return 0 without active session', () => {
      expect(logger.getActionCount()).toBe(0);
    });
  });

  describe('latency', () => {
    it('should log action under 100ms', () => {
      recorder.startSession();

      const start = performance.now();
      logger.logMessage({ trigger: 'test', solution: 'test', result: 'success' });
      const latencyMs = performance.now() - start;

      expect(latencyMs).toBeLessThan(100);
    });
  });

  describe('multiple actions', () => {
    it('should log multiple actions in sequence', () => {
      recorder.startSession();

      const actionIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const actionId = logger.logToolCall({
          toolName: `tool_${i}`,
          trigger: `Trigger ${i}`,
          solution: `Solution ${i}`,
          result: 'success',
        });
        actionIds.push(actionId);
      }

      expect(actionIds).toHaveLength(10);
      expect(new Set(actionIds).size).toBe(10); // All unique

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session!.actions).toHaveLength(10);
    });
  });

  describe('persistence', () => {
    it('should persist action to JSONL file', () => {
      const sessionId = recorder.startSession();

      logger.logToolCall({
        toolName: 'bash',
        trigger: 'File not found',
        solution: 'Created file',
        result: 'success',
      });

      // Verify file content
      const filePath = path.join(tempDir, '.aep', 'sessions', `${sessionId}.jsonl`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2); // header + 1 action

      const actionLine = JSON.parse(lines[1]);
      expect(actionLine._type).toBe('action');
      expect(actionLine.action.action_type).toBe('tool_call');
      expect(actionLine.action.trigger).toBe('File not found');
      expect(actionLine.action.context.tool_name).toBe('bash');
    });
  });

  describe('edge cases', () => {
    it('should throw error when logging after session ended', () => {
      const sessionId = recorder.startSession();
      recorder.endSession(sessionId);

      expect(() => logger.logMessage({ trigger: 'test', solution: 'test' })).toThrow(
        SessionNotActiveError
      );
    });

    it('should handle empty context', () => {
      recorder.startSession();

      logger.logMessage({
        trigger: 'test',
        solution: 'test',
        result: 'success',
        context: {},
      });

      const session = recorder.getSession(recorder.getActiveSession()!);
      expect(session!.actions[0].context).toEqual({});
    });

    it('should handle complex nested context', () => {
      recorder.startSession();

      logger.logToolCall({
        toolName: 'complex_tool',
        trigger: 'Complex operation',
        solution: 'Executed complex operation',
        result: 'success',
        context: {
          nested: {
            level1: {
              level2: ['a', 'b', 'c'],
            },
          },
          count: 42,
          enabled: true,
        },
      });

      const session = recorder.getSession(recorder.getActiveSession()!);
      const action = session!.actions[0];
      expect(action.context.nested.level1.level2).toEqual(['a', 'b', 'c']);
      expect(action.context.count).toBe(42);
      expect(action.context.enabled).toBe(true);
    });

    it('should work with session metadata', () => {
      const sessionId = recorder.startSession({ task: 'testing', environment: 'test' });

      logger.logMessage({ trigger: 'test', solution: 'test' });

      const session = recorder.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.actions).toHaveLength(1);
    });
  });
});