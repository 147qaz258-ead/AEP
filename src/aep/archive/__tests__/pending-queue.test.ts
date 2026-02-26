/**
 * Tests for PendingQueueManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PendingQueueManager, PendingExperience } from '../pending-queue';

describe('PendingQueueManager', () => {
  let tempDir: string;
  let manager: PendingQueueManager;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-queue-test-'));
    manager = new PendingQueueManager(tempDir);
  });

  afterEach(() => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('addPending', () => {
    it('should add a pending experience', () => {
      const exp = manager.addPending({
        trigger: 'TypeError',
        solution: 'Add null check',
        confidence: 0.85,
        source_action_id: 'action_123',
        source_session_id: 'session_456',
      });

      expect(exp.id).toMatch(/^exp_[a-f0-9]{12}$/);
      expect(exp.trigger).toBe('TypeError');
      expect(exp.solution).toBe('Add null check');
      expect(exp.confidence).toBe(0.85);
      expect(exp.status).toBe('pending');
      expect(exp.created_at).toBeDefined();
    });

    it('should persist pending experience to disk', () => {
      const exp = manager.addPending({
        trigger: 'Error',
        solution: 'Fix',
        confidence: 0.9,
        source_action_id: 'action_1',
        source_session_id: 'session_1',
      });

      const loaded = manager.getPending(exp.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.trigger).toBe('Error');
      expect(loaded?.solution).toBe('Fix');
    });

    it('should include optional feedback_score', () => {
      const exp = manager.addPending({
        trigger: 'Bug',
        solution: 'Patch',
        confidence: 0.75,
        source_action_id: 'action_2',
        source_session_id: 'session_2',
        feedback_score: 4.5,
      });

      expect(exp.feedback_score).toBe(4.5);
    });
  });

  describe('listPending', () => {
    it('should list all pending experiences', () => {
      manager.addPending({
        trigger: 'Error1',
        solution: 'Fix1',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });
      manager.addPending({
        trigger: 'Error2',
        solution: 'Fix2',
        confidence: 0.9,
        source_action_id: 'a2',
        source_session_id: 's2',
      });

      const list = manager.listPending();
      expect(list.length).toBe(2);
    });

    it('should filter by session_id', () => {
      manager.addPending({
        trigger: 'Error1',
        solution: 'Fix1',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 'session_A',
      });
      manager.addPending({
        trigger: 'Error2',
        solution: 'Fix2',
        confidence: 0.9,
        source_action_id: 'a2',
        source_session_id: 'session_B',
      });

      const listA = manager.listPending({ session_id: 'session_A' });
      expect(listA.length).toBe(1);
      expect(listA[0].source_session_id).toBe('session_A');

      const listB = manager.listPending({ session_id: 'session_B' });
      expect(listB.length).toBe(1);
      expect(listB[0].source_session_id).toBe('session_B');
    });

    it('should filter by status', () => {
      const exp = manager.addPending({
        trigger: 'Error',
        solution: 'Fix',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });

      manager.approvePending(exp.id);

      const pendingList = manager.listPending({ status: 'pending' });
      expect(pendingList.length).toBe(0);

      const approvedList = manager.listPending({ status: 'approved' });
      expect(approvedList.length).toBe(1);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        manager.addPending({
          trigger: `Error${i}`,
          solution: `Fix${i}`,
          confidence: 0.8,
          source_action_id: `a${i}`,
          source_session_id: `s${i}`,
        });
      }

      const list = manager.listPending({ limit: 5 });
      expect(list.length).toBe(5);
    });
  });

  describe('getPending', () => {
    it('should return experience by ID', () => {
      const exp = manager.addPending({
        trigger: 'TestError',
        solution: 'TestFix',
        confidence: 0.95,
        source_action_id: 'action_test',
        source_session_id: 'session_test',
      });

      const loaded = manager.getPending(exp.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(exp.id);
      expect(loaded?.trigger).toBe('TestError');
    });

    it('should return null for non-existent ID', () => {
      const loaded = manager.getPending('exp_nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('removePending', () => {
    it('should remove pending experience', () => {
      const exp = manager.addPending({
        trigger: 'Error',
        solution: 'Fix',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });

      const result = manager.removePending(exp.id);
      expect(result).toBe(true);
      expect(manager.getPending(exp.id)).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      const result = manager.removePending('exp_nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('approvePending', () => {
    it('should approve pending experience', () => {
      const exp = manager.addPending({
        trigger: 'Error',
        solution: 'Fix',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });

      const result = manager.approvePending(exp.id);
      expect(result).toBe(true);

      const loaded = manager.getPending(exp.id);
      expect(loaded?.status).toBe('approved');
    });

    it('should return false for non-existent ID', () => {
      const result = manager.approvePending('exp_nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('rejectPending', () => {
    it('should reject pending experience', () => {
      const exp = manager.addPending({
        trigger: 'Error',
        solution: 'Fix',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });

      const result = manager.rejectPending(exp.id);
      expect(result).toBe(true);

      const loaded = manager.getPending(exp.id);
      expect(loaded?.status).toBe('rejected');
    });
  });

  describe('getBatch', () => {
    it('should get batch of approved experiences', () => {
      const exp1 = manager.addPending({
        trigger: 'Error1',
        solution: 'Fix1',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });
      const exp2 = manager.addPending({
        trigger: 'Error2',
        solution: 'Fix2',
        confidence: 0.9,
        source_action_id: 'a2',
        source_session_id: 's2',
      });

      manager.approvePending(exp1.id);
      manager.approvePending(exp2.id);

      const batch = manager.getBatch({ batch_size: 10, status: 'approved' });
      expect(batch.length).toBe(2);
    });

    it('should respect batch_size', () => {
      for (let i = 0; i < 5; i++) {
        const exp = manager.addPending({
          trigger: `Error${i}`,
          solution: `Fix${i}`,
          confidence: 0.8,
          source_action_id: `a${i}`,
          source_session_id: `s${i}`,
        });
        manager.approvePending(exp.id);
      }

      const batch = manager.getBatch({ batch_size: 2, status: 'approved' });
      expect(batch.length).toBe(2);
    });
  });

  describe('clearCompleted', () => {
    it('should clear approved and rejected experiences', () => {
      const exp1 = manager.addPending({
        trigger: 'Error1',
        solution: 'Fix1',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });
      const exp2 = manager.addPending({
        trigger: 'Error2',
        solution: 'Fix2',
        confidence: 0.9,
        source_action_id: 'a2',
        source_session_id: 's2',
      });
      const exp3 = manager.addPending({
        trigger: 'Error3',
        solution: 'Fix3',
        confidence: 0.7,
        source_action_id: 'a3',
        source_session_id: 's3',
      });

      manager.approvePending(exp1.id);
      manager.rejectPending(exp2.id);
      // exp3 remains pending

      const count = manager.clearCompleted();
      expect(count).toBe(2);

      const remaining = manager.listPending();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(exp3.id);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', () => {
      const exp1 = manager.addPending({
        trigger: 'Error1',
        solution: 'Fix1',
        confidence: 0.8,
        source_action_id: 'a1',
        source_session_id: 's1',
      });
      const exp2 = manager.addPending({
        trigger: 'Error2',
        solution: 'Fix2',
        confidence: 0.9,
        source_action_id: 'a2',
        source_session_id: 's2',
      });
      manager.addPending({
        trigger: 'Error3',
        solution: 'Fix3',
        confidence: 0.7,
        source_action_id: 'a3',
        source_session_id: 's3',
      });

      manager.approvePending(exp1.id);
      manager.rejectPending(exp2.id);

      const stats = manager.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.total).toBe(3);
    });
  });

  describe('toPublishPayload', () => {
    it('should convert experience to publish payload', () => {
      const exp: PendingExperience = {
        id: 'exp_test123',
        trigger: 'TypeError',
        solution: 'Add null check',
        confidence: 0.85,
        source_action_id: 'action_123',
        source_session_id: 'session_456',
        feedback_score: 4.5,
        created_at: '2026-02-26T10:00:00Z',
        status: 'approved',
      };

      const payload = manager.toPublishPayload(exp);

      expect(payload.trigger).toBe('TypeError');
      expect(payload.solution).toBe('Add null check');
      expect(payload.confidence).toBe(0.85);
      expect(payload.context).toEqual({
        source_session: 'session_456',
        source_action: 'action_123',
        feedback_score: 4.5,
      });
    });
  });
});