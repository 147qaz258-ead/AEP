/**
 * Unit tests for FeedbackCollector (TypeScript)
 *
 * Tests cover:
 * - submitExplicit feedback submission
 * - submit convenience method
 * - getFeedback retrieval
 * - getSessionFeedback retrieval
 * - getStats statistics calculation
 * - Invalid rating validation
 * - JSONL persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  FeedbackCollector,
  FeedbackError,
  FeedbackNotFoundError,
  InvalidRatingError,
} from '../collector';
import { Feedback } from '../types';

describe('FeedbackCollector', () => {
  let tempDir: string;
  let collector: FeedbackCollector;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aep-feedback-test-'));
    collector = new FeedbackCollector(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should initialize with workspace', () => {
      expect(collector.workspace).toBe(tempDir);
    });

    it('should create feedback directory', () => {
      const feedbackDir = path.join(tempDir, '.aep', 'feedback');
      expect(fs.existsSync(feedbackDir)).toBe(true);
    });

    it('should allow custom storage directory', () => {
      const customCollector = new FeedbackCollector(tempDir, 'custom-feedback');
      const customDir = path.join(tempDir, '.aep', 'custom-feedback');
      expect(fs.existsSync(customDir)).toBe(true);
    });
  });

  describe('submitExplicit', () => {
    it('should submit explicit feedback with all fields', () => {
      const feedback = collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_456',
        rating: 5,
        comment: 'Excellent response!',
        user_id: 'user_789',
      });

      expect(feedback.id).toBeDefined();
      expect(feedback.id).toMatch(/^fb_/);
      expect(feedback.session_id).toBe('session_123');
      expect(feedback.agent_id).toBe('agent_001');
      expect(feedback.action_id).toBe('action_456');
      expect(feedback.rating).toBe(5);
      expect(feedback.comment).toBe('Excellent response!');
      expect(feedback.type).toBe('explicit');
      expect(feedback.confidence).toBe(1.0);
      expect(feedback.created_at).toBeDefined();
      expect(feedback.metadata?.user_id).toBe('user_789');
    });

    it('should submit explicit feedback with minimal fields', () => {
      const feedback = collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        rating: 3,
      });

      expect(feedback.action_id).toBeUndefined();
      expect(feedback.comment).toBeUndefined();
      expect(feedback.rating).toBe(3);
    });

    it('should throw InvalidRatingError for rating below 1', () => {
      expect(() =>
        collector.submitExplicit({
          session_id: 'session_123',
          agent_id: 'agent_001',
          rating: 0,
        })
      ).toThrow(InvalidRatingError);
    });

    it('should throw InvalidRatingError for rating above 5', () => {
      expect(() =>
        collector.submitExplicit({
          session_id: 'session_123',
          agent_id: 'agent_001',
          rating: 6,
        })
      ).toThrow(InvalidRatingError);
    });

    it('should throw InvalidRatingError for non-integer rating', () => {
      expect(() =>
        collector.submitExplicit({
          session_id: 'session_123',
          agent_id: 'agent_001',
          rating: 3.5,
        })
      ).toThrow(InvalidRatingError);
    });

    it('should persist feedback to JSONL file', () => {
      collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        rating: 4,
      });

      const feedbackFile = path.join(tempDir, '.aep', 'feedback', 'feedback.jsonl');
      expect(fs.existsSync(feedbackFile)).toBe(true);

      const content = fs.readFileSync(feedbackFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const record = JSON.parse(lines[0]);
      expect(record._type).toBe('feedback');
      expect(record.feedback.rating).toBe(4);
    });
  });

  describe('submit', () => {
    it('should submit feedback with simplified parameters', () => {
      const feedback = collector.submit('action_123', 5, 'Great!');

      expect(feedback.action_id).toBe('action_123');
      expect(feedback.rating).toBe(5);
      expect(feedback.comment).toBe('Great!');
      expect(feedback.session_id).toBeDefined();
      expect(feedback.agent_id).toBe('default_agent');
    });

    it('should submit feedback with all optional parameters', () => {
      const feedback = collector.submit(
        'action_456',
        4,
        'Good',
        'session_custom',
        'agent_custom',
        'user_123'
      );

      expect(feedback.action_id).toBe('action_456');
      expect(feedback.rating).toBe(4);
      expect(feedback.comment).toBe('Good');
      expect(feedback.session_id).toBe('session_custom');
      expect(feedback.agent_id).toBe('agent_custom');
      expect(feedback.metadata?.user_id).toBe('user_123');
    });
  });

  describe('getFeedback', () => {
    it('should return feedback for existing action', () => {
      collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_456',
        rating: 5,
      });

      const feedback = collector.getFeedback('action_456');

      expect(feedback).toBeDefined();
      expect(feedback?.action_id).toBe('action_456');
      expect(feedback?.rating).toBe(5);
    });

    it('should return null for non-existing action', () => {
      const feedback = collector.getFeedback('nonexistent_action');
      expect(feedback).toBeNull();
    });

    it('should return the correct feedback when multiple exist', () => {
      collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_1',
        rating: 5,
      });

      collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_2',
        rating: 3,
      });

      const feedback = collector.getFeedback('action_2');
      expect(feedback?.rating).toBe(3);
    });
  });

  describe('getSessionFeedback', () => {
    it('should return all feedback for a session', () => {
      collector.submitExplicit({
        session_id: 'session_1',
        agent_id: 'agent_001',
        action_id: 'action_1',
        rating: 5,
      });

      collector.submitExplicit({
        session_id: 'session_1',
        agent_id: 'agent_001',
        action_id: 'action_2',
        rating: 4,
      });

      collector.submitExplicit({
        session_id: 'session_2',
        agent_id: 'agent_001',
        action_id: 'action_3',
        rating: 3,
      });

      const feedbacks = collector.getSessionFeedback('session_1');
      expect(feedbacks.length).toBe(2);
      expect(feedbacks.map((f) => f.action_id)).toContain('action_1');
      expect(feedbacks.map((f) => f.action_id)).toContain('action_2');
    });

    it('should return empty array for session with no feedback', () => {
      const feedbacks = collector.getSessionFeedback('nonexistent_session');
      expect(feedbacks).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should calculate statistics correctly', () => {
      // Submit feedbacks with different ratings
      collector.submitExplicit({
        session_id: 'session_1',
        agent_id: 'agent_001',
        action_id: 'action_1',
        rating: 5,
      });

      collector.submitExplicit({
        session_id: 'session_1',
        agent_id: 'agent_001',
        action_id: 'action_2',
        rating: 4,
      });

      collector.submitExplicit({
        session_id: 'session_1',
        agent_id: 'agent_001',
        action_id: 'action_3',
        rating: 5,
      });

      const stats = collector.getStats('session_1');

      expect(stats.total_feedback).toBe(3);
      expect(stats.explicit_count).toBe(3);
      expect(stats.implicit_count).toBe(0);
      expect(stats.avg_rating).toBeCloseTo(4.67, 2);
      expect(stats.rating_distribution[5]).toBe(2);
      expect(stats.rating_distribution[4]).toBe(1);
      expect(stats.rating_distribution[1]).toBe(0);
      expect(stats.rating_distribution[2]).toBe(0);
      expect(stats.rating_distribution[3]).toBe(0);
    });

    it('should return zero stats for empty session', () => {
      const stats = collector.getStats('nonexistent_session');

      expect(stats.total_feedback).toBe(0);
      expect(stats.explicit_count).toBe(0);
      expect(stats.implicit_count).toBe(0);
      expect(stats.avg_rating).toBeUndefined();
    });

    it('should handle multiple sessions independently', () => {
      collector.submitExplicit({
        session_id: 'session_1',
        agent_id: 'agent_001',
        action_id: 'action_1',
        rating: 5,
      });

      collector.submitExplicit({
        session_id: 'session_2',
        agent_id: 'agent_001',
        action_id: 'action_2',
        rating: 1,
      });

      const stats1 = collector.getStats('session_1');
      const stats2 = collector.getStats('session_2');

      expect(stats1.total_feedback).toBe(1);
      expect(stats1.avg_rating).toBe(5);
      expect(stats2.total_feedback).toBe(1);
      expect(stats2.avg_rating).toBe(1);
    });
  });

  describe('deleteFeedback', () => {
    it('should delete existing feedback', () => {
      const feedback = collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_456',
        rating: 5,
      });

      const deleted = collector.deleteFeedback(feedback.id);
      expect(deleted).toBe(true);

      const retrieved = collector.getFeedback('action_456');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existing feedback', () => {
      const deleted = collector.deleteFeedback('nonexistent_id');
      expect(deleted).toBe(false);
    });

    it('should persist deletion', () => {
      const feedback = collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_456',
        rating: 5,
      });

      collector.deleteFeedback(feedback.id);

      // Create new collector to test persistence
      const newCollector = new FeedbackCollector(tempDir);
      const retrieved = newCollector.getFeedback('action_456');
      expect(retrieved).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist feedback across collector instances', () => {
      collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_456',
        rating: 5,
        comment: 'Great!',
      });

      // Create new collector instance
      const newCollector = new FeedbackCollector(tempDir);
      const feedback = newCollector.getFeedback('action_456');

      expect(feedback).toBeDefined();
      expect(feedback?.rating).toBe(5);
      expect(feedback?.comment).toBe('Great!');
    });

    it('should handle multiple feedback submissions', () => {
      for (let i = 1; i <= 10; i++) {
        collector.submitExplicit({
          session_id: 'session_123',
          agent_id: 'agent_001',
          action_id: `action_${i}`,
          rating: (i % 5) + 1,
        });
      }

      const feedbacks = collector.getSessionFeedback('session_123');
      expect(feedbacks.length).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should throw InvalidRatingError with descriptive message', () => {
      expect(() =>
        collector.submitExplicit({
          session_id: 'session_123',
          agent_id: 'agent_001',
          rating: 10,
        })
      ).toThrow('Invalid rating: 10');
    });

    it('should handle corrupted JSONL gracefully', () => {
      const feedbackFile = path.join(tempDir, '.aep', 'feedback', 'feedback.jsonl');
      fs.appendFileSync(feedbackFile, 'invalid json\n');

      collector.submitExplicit({
        session_id: 'session_123',
        agent_id: 'agent_001',
        action_id: 'action_456',
        rating: 5,
      });

      const feedback = collector.getFeedback('action_456');
      expect(feedback).toBeDefined();
      expect(feedback?.rating).toBe(5);
    });
  });

  describe('implicit feedback', () => {
    describe('submitImplicit', () => {
      it('should submit implicit feedback with all fields', () => {
        const feedback = collector.submitImplicit({
          session_id: 'session_123',
          agent_id: 'agent_001',
          action_id: 'action_456',
          outcome: 'success',
          confidence: 0.8,
          evidence: 'user_accepted_suggestion',
        });

        expect(feedback.id).toBeDefined();
        expect(feedback.id).toMatch(/^fb_/);
        expect(feedback.session_id).toBe('session_123');
        expect(feedback.agent_id).toBe('agent_001');
        expect(feedback.action_id).toBe('action_456');
        expect(feedback.type).toBe('implicit');
        expect(feedback.outcome).toBe('success');
        expect(feedback.confidence).toBe(0.8);
        expect(feedback.evidence).toBe('user_accepted_suggestion');
        expect(feedback.rating).toBeUndefined();
      });

      it('should submit implicit feedback with minimal fields', () => {
        const feedback = collector.submitImplicit({
          session_id: 'session_123',
          agent_id: 'agent_001',
          outcome: 'failure',
          confidence: 0.5,
        });

        expect(feedback.action_id).toBeUndefined();
        expect(feedback.evidence).toBeUndefined();
        expect(feedback.outcome).toBe('failure');
        expect(feedback.confidence).toBe(0.5);
      });
    });

    describe('inferFromAcceptance', () => {
      it('should infer positive feedback from acceptance', () => {
        const feedback = collector.inferFromAcceptance(
          'session_123',
          'agent_001',
          'action_456'
        );

        expect(feedback.type).toBe('implicit');
        expect(feedback.outcome).toBe('success');
        expect(feedback.confidence).toBe(0.8);
        expect(feedback.evidence).toBe('user_accepted_suggestion');
      });

      it('should allow custom evidence', () => {
        const feedback = collector.inferFromAcceptance(
          'session_123',
          'agent_001',
          'action_456',
          'user_clicked_apply_button'
        );

        expect(feedback.evidence).toBe('user_clicked_apply_button');
      });
    });

    describe('inferFromRejection', () => {
      it('should infer negative feedback from rejection', () => {
        const feedback = collector.inferFromRejection(
          'session_123',
          'agent_001',
          'action_456'
        );

        expect(feedback.type).toBe('implicit');
        expect(feedback.outcome).toBe('failure');
        expect(feedback.confidence).toBe(0.9);
        expect(feedback.evidence).toBe('user_rejected_suggestion');
      });
    });

    describe('inferFromCopy', () => {
      it('should infer positive feedback from copy', () => {
        const feedback = collector.inferFromCopy(
          'session_123',
          'agent_001',
          'action_456'
        );

        expect(feedback.type).toBe('implicit');
        expect(feedback.outcome).toBe('success');
        expect(feedback.confidence).toBe(0.7);
        expect(feedback.evidence).toBe('user_copied_content');
      });
    });

    describe('inferFromSessionDuration', () => {
      it('should infer failure from short session (< 30s)', () => {
        const feedback = collector.inferFromSessionDuration(
          'session_123',
          'agent_001',
          'action_456',
          15
        );

        expect(feedback.outcome).toBe('failure');
        expect(feedback.confidence).toBe(0.6);
        expect(feedback.evidence).toBe('short_session_15s');
      });

      it('should infer success from long session (> 5min)', () => {
        const feedback = collector.inferFromSessionDuration(
          'session_123',
          'agent_001',
          'action_456',
          400
        );

        expect(feedback.outcome).toBe('success');
        expect(feedback.confidence).toBe(0.6);
        expect(feedback.evidence).toBe('long_session_400s');
      });

      it('should infer partial from medium session', () => {
        const feedback = collector.inferFromSessionDuration(
          'session_123',
          'agent_001',
          'action_456',
          120
        );

        expect(feedback.outcome).toBe('partial');
        expect(feedback.confidence).toBe(0.5);
        expect(feedback.evidence).toBe('session_duration_120s');
      });
    });

    describe('inferFromSimilarQuestion', () => {
      it('should infer partial feedback from similar question', () => {
        const feedback = collector.inferFromSimilarQuestion(
          'session_123',
          'agent_001',
          'action_456'
        );

        expect(feedback.type).toBe('implicit');
        expect(feedback.outcome).toBe('partial');
        expect(feedback.confidence).toBe(0.7);
        expect(feedback.evidence).toBe('user_asked_similar_question');
      });
    });

    describe('getStats with implicit feedback', () => {
      it('should calculate implicit feedback statistics', () => {
        collector.submitExplicit({
          session_id: 'session_1',
          agent_id: 'agent_001',
          action_id: 'action_1',
          rating: 5,
        });

        collector.inferFromAcceptance('session_1', 'agent_001', 'action_2');
        collector.inferFromRejection('session_1', 'agent_001', 'action_3');

        const stats = collector.getStats('session_1');

        expect(stats.total_feedback).toBe(3);
        expect(stats.explicit_count).toBe(1);
        expect(stats.implicit_count).toBe(2);
        expect(stats.outcome_distribution.success).toBe(1);
        expect(stats.outcome_distribution.failure).toBe(1);
      });
    });
  });
});