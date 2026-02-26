/**
 * MemoryArchiver - Session compression and archival for AEP Protocol
 *
 * Provides functionality to compress sessions into summaries and archive old sessions.
 *
 * @module aep/archive/archiver
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import {
  SessionSummary,
  KeyAction,
  ActionOutcome,
  CreateSessionSummaryOptions,
  ARCHIVE_VERSION,
} from './types';
import { Session, AgentAction } from '../session/types';

const gzip = promisify(zlib.gzip);

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of files deleted */
  deleted_count: number;
  /** Bytes freed */
  freed_bytes: number;
}

/**
 * Summary information for listing
 */
export interface SummaryInfo {
  /** Session ID */
  session_id: string;
  /** File path */
  path: string;
  /** Creation timestamp */
  created_at: string;
  /** File size in bytes */
  size: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Size of sessions directory in bytes */
  sessions_size: number;
  /** Size of memory directory in bytes */
  memory_size: number;
  /** Size of pending directory in bytes */
  pending_size: number;
  /** Number of archived sessions */
  archive_count: number;
  /** Number of summary files */
  summary_count: number;
}

/**
 * Options for archiving a session
 */
export interface ArchiveOptions {
  /** Whether to compress the archive with gzip */
  compress?: boolean;
  /** Whether to delete the original session file after archiving */
  delete_original?: boolean;
  /** Custom summary to use instead of auto-generating */
  summary?: SessionSummary;
}

/**
 * MemoryArchiver - Manages session compression and archival.
 *
 * This class provides functionality to:
 * - Compress sessions into summaries
 * - Archive old sessions (with optional gzip compression)
 * - Generate Markdown summaries
 * - Clean up old archives
 *
 * @example
 * ```typescript
 * const archiver = new MemoryArchiver('/path/to/workspace');
 * const summary = archiver.compressSession(session);
 * const archivePath = archiver.archiveSession('session_123', { compress: true });
 * ```
 */
export class MemoryArchiver {
  private _workspace: string;
  private aepDir: string;
  private sessionsDir: string;
  private memoryDir: string;
  private archiveDir: string;
  private pendingDir: string;
  private defaultRetentionDays: number;

  /**
   * Initialize the MemoryArchiver.
   *
   * @param workspace - Path to the workspace directory
   * @param retentionDays - Number of days to retain archives (default: 30)
   */
  constructor(workspace: string, retentionDays: number = 30) {
    this._workspace = workspace;
    this.aepDir = path.join(workspace, '.aep');
    this.sessionsDir = path.join(this.aepDir, 'sessions');
    this.memoryDir = path.join(this.aepDir, 'memory');
    this.archiveDir = path.join(this.aepDir, 'sessions', 'archive');
    this.pendingDir = path.join(this.aepDir, 'pending');
    this.defaultRetentionDays = retentionDays;
  }

  /** Get the workspace path */
  get workspace(): string {
    return this._workspace;
  }

  /**
   * Compress a session into a summary.
   *
   * @param session - The session to compress
   * @param title - Optional title for the summary
   * @returns The generated session summary
   */
  compressSession(session: Session, title?: string): SessionSummary {
    // Calculate session duration
    const startedAt = new Date(session.started_at);
    const endedAt = session.ended_at ? new Date(session.ended_at) : new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    // Extract key actions
    const keyActions = this.extractKeyActions(session.actions);

    // Determine overall outcome
    const outcome = this.determineOutcome(session.actions);

    // Extract signals (from action context or feedback)
    const signals = this.extractSignals(session.actions);

    // Generate title if not provided
    const summaryTitle = title || this.generateTitle(session, keyActions);

    // Calculate average feedback score
    const feedbackScore = this.calculateFeedbackScore(session.actions);

    const options: CreateSessionSummaryOptions = {
      session_id: session.id,
      agent_id: session.agent_id,
      title: summaryTitle,
      problem: this.inferProblem(session, keyActions),
      solution: this.inferSolution(session, keyActions),
      outcome,
      key_actions: keyActions,
      signals,
      action_count: session.actions.length,
      duration_seconds: durationSeconds,
      feedback_score: feedbackScore,
    };

    return this.createSummary(options);
  }

  /**
   * Archive a session file.
   *
   * @param sessionId - The session ID to archive
   * @param options - Archive options
   * @returns Path to the archived file, or null if session not found
   */
  async archiveSession(sessionId: string, options: ArchiveOptions = {}): Promise<string | null> {
    const { compress = true, delete_original = true, summary } = options;

    // Ensure archive directory exists
    this.ensureDirectory(this.archiveDir);

    // Get source session file
    const sourcePath = path.join(this.sessionsDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(sourcePath)) {
      return null;
    }

    // Load and compress session if summary not provided
    let sessionSummary = summary;
    if (!sessionSummary) {
      const session = this.loadSession(sessionId);
      if (session) {
        sessionSummary = this.compressSession(session);
      }
    }

    // Save summary to memory directory
    if (sessionSummary) {
      this.saveSummary(sessionSummary);
    }

    // Determine archive path
    const archiveExtension = compress ? '.jsonl.gz' : '.jsonl';
    const archivePath = path.join(this.archiveDir, `${sessionId}${archiveExtension}`);

    if (compress) {
      // Read and compress the file
      const content = fs.readFileSync(sourcePath);
      const compressed = await gzip(content);
      fs.writeFileSync(archivePath, compressed);
    } else {
      // Just copy the file
      fs.copyFileSync(sourcePath, archivePath);
    }

    // Delete original if requested
    if (delete_original) {
      fs.unlinkSync(sourcePath);
    }

    return archivePath;
  }

  /**
   * Generate Markdown format summary.
   *
   * @param summary - The session summary to format
   * @returns Markdown formatted string
   */
  generateMarkdown(summary: SessionSummary): string {
    const lines: string[] = [
      `# ${summary.title}`,
      '',
      `**Session ID:** ${summary.session_id}`,
      `**Agent:** ${summary.agent_id}`,
      `**Created:** ${summary.created_at}`,
      `**Outcome:** ${summary.outcome}`,
      `**Duration:** ${this.formatDuration(summary.duration_seconds)}`,
      `**Actions:** ${summary.action_count}`,
      '',
      '## Problem',
      '',
      summary.problem,
      '',
      '## Solution',
      '',
      summary.solution,
      '',
      '## Key Actions',
      '',
    ];

    // Add key actions table
    if (summary.key_actions.length > 0) {
      lines.push('| Trigger | Solution | Result |');
      lines.push('|---------|----------|--------|');
      for (const action of summary.key_actions) {
        lines.push(`| ${action.trigger} | ${action.solution} | ${action.result} |`);
      }
    } else {
      lines.push('_No key actions recorded._');
    }

    lines.push('');
    lines.push('## Signals');
    lines.push('');

    if (summary.signals.length > 0) {
      for (const signal of summary.signals) {
        lines.push(`- ${signal}`);
      }
    } else {
      lines.push('_No signals extracted._');
    }

    if (summary.feedback_score !== undefined && summary.feedback_score !== null) {
      lines.push('');
      lines.push(`## Feedback Score: ${summary.feedback_score}/5`);
    }

    lines.push('');
    lines.push(`---`);
    lines.push(`_Archive Version: ${ARCHIVE_VERSION}_`);

    return lines.join('\n');
  }

  /**
   * List archive files.
   *
   * @param limit - Maximum number of archives to return
   * @returns List of archive file paths
   */
  listArchives(limit: number = 10): string[] {
    if (!fs.existsSync(this.archiveDir)) {
      return [];
    }

    const archives: string[] = [];
    const files = fs.readdirSync(this.archiveDir);

    // Sort by modification time (newest first)
    const sortedFiles = files
      .map(f => ({
        name: f,
        path: path.join(this.archiveDir, f),
        mtime: fs.statSync(path.join(this.archiveDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of sortedFiles) {
      if (file.name.endsWith('.jsonl') || file.name.endsWith('.jsonl.gz')) {
        archives.push(file.path);
        if (archives.length >= limit) {
          break;
        }
      }
    }

    return archives;
  }

  /**
   * List summary files.
   *
   * @param limit - Maximum number of summaries to return
   * @returns List of summary information
   */
  listSummaries(limit: number = 10): SummaryInfo[] {
    if (!fs.existsSync(this.memoryDir)) {
      return [];
    }

    const summaries: SummaryInfo[] = [];
    const files = fs.readdirSync(this.memoryDir);

    // Sort by modification time (newest first)
    const sortedFiles = files
      .filter(f => f.endsWith('_summary.md'))
      .map(f => {
        const filePath = path.join(this.memoryDir, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          mtime: stats.mtime.getTime(),
          size: stats.size,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of sortedFiles) {
      const sessionId = file.name.replace('_summary.md', '');
      summaries.push({
        session_id: sessionId,
        path: file.path,
        created_at: new Date(file.mtime).toISOString(),
        size: file.size,
      });

      if (summaries.length >= limit) {
        break;
      }
    }

    return summaries;
  }

  /**
   * Get a summary by session ID.
   *
   * @param sessionId - The session ID
   * @returns The summary content, or null if not found
   */
  getSummary(sessionId: string): string | null {
    const summaryPath = path.join(this.memoryDir, `${sessionId}_summary.md`);
    if (!fs.existsSync(summaryPath)) {
      return null;
    }
    return fs.readFileSync(summaryPath, 'utf-8');
  }

  /**
   * Clean up old archives.
   *
   * @param days - Number of days to retain (default: instance default)
   * @returns Cleanup result with statistics
   */
  async cleanupOldArchives(days?: number): Promise<CleanupResult> {
    const retentionDays = days ?? this.defaultRetentionDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    let deletedCount = 0;
    let freedBytes = 0;

    if (!fs.existsSync(this.archiveDir)) {
      return { deleted_count: 0, freed_bytes: 0 };
    }

    const files = fs.readdirSync(this.archiveDir);

    for (const file of files) {
      if (!file.endsWith('.jsonl') && !file.endsWith('.jsonl.gz')) {
        continue;
      }

      const filePath = path.join(this.archiveDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoff) {
        console.log(`[MemoryArchiver] Deleting old archive: ${file}`);
        freedBytes += stats.size;
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    console.log(
      `[MemoryArchiver] Cleanup complete: ${deletedCount} files, ` +
      `${(freedBytes / 1024 / 1024).toFixed(2)} MB freed`
    );

    return {
      deleted_count: deletedCount,
      freed_bytes: freedBytes,
    };
  }

  /**
   * Get storage statistics.
   *
   * @returns Storage statistics
   */
  getStorageStats(): StorageStats {
    return {
      sessions_size: this.getDirectorySize(this.sessionsDir),
      memory_size: this.getDirectorySize(this.memoryDir),
      pending_size: this.getDirectorySize(this.pendingDir),
      archive_count: this.countFiles(this.archiveDir, '*.jsonl.gz') + this.countFiles(this.archiveDir, '*.jsonl'),
      summary_count: this.countFiles(this.memoryDir, '*_summary.md'),
    };
  }

  /**
   * Load a session from file.
   *
   * @param sessionId - The session ID to load
   * @returns The session, or null if not found
   */
  private loadSession(sessionId: string): Session | null {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    const content = fs.readFileSync(sessionPath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length === 0) {
      return null;
    }

    try {
      const header = JSON.parse(lines[0]);
      if (header._type !== 'session_header') {
        return null;
      }

      // Load all actions from subsequent lines
      const actions: AgentAction[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        try {
          const record = JSON.parse(lines[i]);
          if (record._type === 'action') {
            actions.push(record.action as AgentAction);
          }
        } catch {
          // Skip malformed lines
        }
      }

      return {
        ...header.session,
        actions,
      } as Session;
    } catch {
      return null;
    }
  }

  /**
   * Save a summary to the memory directory.
   *
   * @param summary - The summary to save
   */
  private saveSummary(summary: SessionSummary): void {
    this.ensureDirectory(this.memoryDir);
    const summaryPath = path.join(this.memoryDir, `${summary.session_id}_summary.md`);
    const markdown = this.generateMarkdown(summary);
    fs.writeFileSync(summaryPath, markdown, 'utf-8');

    // Also save JSON version
    const jsonPath = path.join(this.memoryDir, `${summary.session_id}_summary.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  /**
   * Create a summary from options.
   */
  private createSummary(options: CreateSessionSummaryOptions): SessionSummary {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      session_id: options.session_id,
      agent_id: options.agent_id,
      created_at: new Date().toISOString(),
      title: options.title,
      problem: options.problem,
      solution: options.solution,
      outcome: options.outcome,
      key_actions: options.key_actions,
      signals: options.signals,
      action_count: options.action_count,
      duration_seconds: options.duration_seconds,
      feedback_score: options.feedback_score,
    };
  }

  /**
   * Extract key actions from a session.
   * Returns the most significant actions based on complexity and outcome.
   */
  private extractKeyActions(actions: AgentAction[]): KeyAction[] {
    if (actions.length === 0) {
      return [];
    }

    // Score each action by significance
    const scoredActions = actions.map(action => ({
      action,
      score: this.scoreActionSignificance(action),
    }));

    // Sort by score descending
    scoredActions.sort((a, b) => b.score - a.score);

    // Take top actions (max 10)
    const topActions = scoredActions.slice(0, 10);

    return topActions.map(({ action }) => ({
      trigger: action.trigger,
      solution: action.solution,
      result: action.result,
    }));
  }

  /**
   * Score an action's significance for summary purposes.
   */
  private scoreActionSignificance(action: AgentAction): number {
    let score = 0;

    // Failure actions are more significant
    if (action.result === 'failure') {
      score += 3;
    } else if (action.result === 'partial') {
      score += 2;
    }

    // Actions with feedback are significant
    if (action.feedback) {
      if (action.feedback.rating === 'negative') {
        score += 3;
      } else if (action.feedback.rating === 'positive') {
        score += 1;
      }
    }

    // Tool calls are generally more significant
    if (action.action_type === 'tool_call') {
      score += 1;
    }

    // Longer solutions suggest more complex actions
    score += Math.min(action.solution.length / 100, 2);

    return score;
  }

  /**
   * Determine overall session outcome from actions.
   */
  private determineOutcome(actions: AgentAction[]): ActionOutcome {
    if (actions.length === 0) {
      return 'success';
    }

    const results = actions.map(a => a.result);
    const failures = results.filter(r => r === 'failure').length;
    const successes = results.filter(r => r === 'success').length;

    // If more than half failed, it's a failure
    if (failures > actions.length / 2) {
      return 'failure';
    }

    // If any failures but less than half, it's partial
    if (failures > 0) {
      return 'partial';
    }

    // If all successes
    if (successes === actions.length) {
      return 'success';
    }

    return 'partial';
  }

  /**
   * Extract signals from actions.
   */
  private extractSignals(actions: AgentAction[]): string[] {
    const signals: Set<string> = new Set();

    for (const action of actions) {
      // Extract from context
      if (action.context) {
        if (action.context.signals) {
          for (const signal of action.context.signals as string[]) {
            signals.add(signal);
          }
        }
        if (action.context.error_type) {
          signals.add(`error:${action.context.error_type}`);
        }
        if (action.context.tool_name) {
          signals.add(`tool:${action.context.tool_name}`);
        }
      }

      // Extract trigger patterns
      const triggerLower = action.trigger.toLowerCase();
      if (triggerLower.includes('error')) {
        signals.add('error');
      }
      if (triggerLower.includes('fix') || triggerLower.includes('resolve')) {
        signals.add('fix');
      }
    }

    return Array.from(signals).slice(0, 20); // Limit to 20 signals
  }

  /**
   * Generate a title for the session.
   */
  private generateTitle(session: Session, keyActions: KeyAction[]): string {
    if (session.summary) {
      return session.summary.substring(0, 100);
    }

    if (keyActions.length > 0) {
      return keyActions[0].trigger.substring(0, 100);
    }

    return `Session ${session.id}`;
  }

  /**
   * Infer the problem from session and actions.
   */
  private inferProblem(session: Session, keyActions: KeyAction[]): string {
    if (session.summary) {
      return session.summary;
    }

    if (keyActions.length > 0) {
      return keyActions[0].trigger;
    }

    return 'Unknown problem';
  }

  /**
   * Infer the solution from actions.
   */
  private inferSolution(session: Session, keyActions: KeyAction[]): string {
    if (keyActions.length > 0) {
      // Combine solutions from successful actions
      const successfulSolutions = keyActions
        .filter(a => a.result === 'success')
        .map(a => a.solution)
        .slice(0, 3);
      return successfulSolutions.join('; ') || keyActions[0].solution;
    }

    return session.summary || 'No solution recorded';
  }

  /**
   * Calculate average feedback score.
   */
  private calculateFeedbackScore(actions: AgentAction[]): number | undefined {
    const ratings = actions
      .filter(a => a.feedback)
      .map(a => {
        switch (a.feedback!.rating) {
          case 'positive': return 5;
          case 'neutral': return 3;
          case 'negative': return 1;
          default: return 3;
        }
      });

    if (ratings.length === 0) {
      return undefined;
    }

    const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    return Math.round(avg * 10) / 10;
  }

  /**
   * Format duration in human-readable format.
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Ensure a directory exists.
   */
  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get the total size of a directory.
   */
  private getDirectorySize(dir: string): number {
    if (!fs.existsSync(dir)) {
      return 0;
    }

    let size = 0;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        size += this.getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }

    return size;
  }

  /**
   * Count files matching a pattern.
   */
  private countFiles(dir: string, pattern: string): number {
    if (!fs.existsSync(dir)) {
      return 0;
    }

    const files = fs.readdirSync(dir);
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    return files.filter(f => regex.test(f)).length;
  }
}

export default MemoryArchiver;