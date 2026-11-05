/**
 * Session Crash Detector — JSONL Analysis for Dead Sessions. Carried from 1.x
 * `src/monitoring/crash-detector.ts` at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9
 * for carryover row 03. The harness adapter that owns the transcript reads its
 * tail (the 1.x 128 KB tail read and partial-first-line skip live there) and
 * supplies the parsed entries and the clock; this core function judges them and
 * never touches a file (NF-52; Rule 30).
 *
 * Detects when a harness session has crashed by analyzing the JSONL
 * conversation tail in combination with process status. A crash occurs when:
 * 1. The worker process is no longer alive
 * 2. The JSONL ends in a problematic state (tool_use with no result, error pattern)
 *
 * Also detects error loops — repeated identical errors that suggest the session
 * is stuck retrying the same failing approach.
 *
 * Part of PROP-session-stall-recovery Phase B
 */

import { contentBlocks, isToolResultBlock, isToolUseBlock, type TranscriptEntry, type TranscriptTail } from './stall-detector.js';

// ============================================================================
// Types
// ============================================================================

export interface CrashInfo {
  type: 'crash';
  sessionUuid: string;
  /** Milliseconds since the epoch, from the injected clock. */
  detectedAt: number;
  errorMessage?: string;
  errorType: 'tool_use_incomplete' | 'parsing' | 'api' | 'internal' | 'unknown';
  lastToolName?: string;
  lastToolInput?: Record<string, unknown>;
}

export interface ErrorLoopInfo {
  type: 'error_loop';
  sessionUuid: string;
  detectedAt: number;
  loopCount: number;
  failingPattern: string;
  failingCommand?: string;
}

// ============================================================================
// Crash Detection
// ============================================================================

/**
 * Detect if a harness session has crashed.
 * A crash = process dead + JSONL ends in a non-terminal state.
 *
 * @param tail - The parsed transcript tail (the adapter reads the last ~20 entries)
 * @param processAlive - Whether the worker process is still running
 * @param now - The host clock, milliseconds since the epoch
 * @returns CrashInfo if crashed, null if clean exit or process still alive
 */
export function detectCrashedSession(
  tail: TranscriptTail,
  processAlive: boolean,
  now: number,
): CrashInfo | null {
  // If process is still alive, it's not a crash (might be a stall — handled by stall-detector)
  if (processAlive) return null;

  const entries = tail.entries.slice(-20);
  if (entries.length === 0) return null;

  // Find the last entry with a message
  let lastEntry: TranscriptEntry | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    if (entry.message || entry.type === 'assistant' || entry.type === 'user') {
      lastEntry = entry;
      break;
    }
  }

  if (!lastEntry) return null;

  const message = lastEntry.message;
  if (!message) return null;

  // Clean exit: last message has stop_reason: 'end_turn' — process exited normally
  if (message.stop_reason === 'end_turn') return null;

  // Crash indicator 1: Last assistant message has stop_reason: 'tool_use' but no result follows
  if (lastEntry.type === 'assistant' && message.stop_reason === 'tool_use') {
    const toolBlocks = contentBlocks(message.content).filter(isToolUseBlock);
    const lastTool = toolBlocks[toolBlocks.length - 1];

    return {
      type: 'crash',
      sessionUuid: tail.sessionUuid,
      detectedAt: now,
      errorType: 'tool_use_incomplete',
      ...(lastTool?.name !== undefined ? { lastToolName: lastTool.name } : {}),
      ...(lastTool?.input !== undefined ? { lastToolInput: lastTool.input } : {}),
    };
  }

  // Crash indicator 2: Last entry is a tool_result with is_error: true
  if (lastEntry.type === 'user' && Array.isArray(message.content)) {
    const errorResults = message.content.filter(
      (b: unknown) => isToolResultBlock(b) && b.is_error
    ).filter(isToolResultBlock);
    if (errorResults.length > 0) {
      const lastError = errorResults[errorResults.length - 1]!;
      const errorMsg = typeof lastError.content === 'string' ? lastError.content : '';

      return {
        type: 'crash',
        sessionUuid: tail.sessionUuid,
        detectedAt: now,
        errorMessage: errorMsg.slice(0, 500),
        errorType: classifyError(errorMsg),
      };
    }
  }

  return null;
}

// ============================================================================
// Error Loop Detection
// ============================================================================

/**
 * Detect if a session is stuck in an error loop — repeating the same failing approach.
 *
 * @param tail - The parsed transcript tail (the adapter reads the last ~50 entries for loops)
 * @param now - The host clock, milliseconds since the epoch
 * @param minRepetitions - Minimum number of identical errors to count as a loop (default: 3)
 * @returns ErrorLoopInfo if loop detected, null otherwise
 */
export function detectErrorLoop(
  tail: TranscriptTail,
  now: number,
  minRepetitions: number = 3,
): ErrorLoopInfo | null {
  const entries = tail.entries.slice(-50); // Look at more entries for loop detection
  if (entries.length === 0) return null;

  // Collect all error results
  const errors: Array<{ content: string; toolUseId: string }> = [];
  const commands: Map<string, string> = new Map(); // toolUseId -> command

  for (const entry of entries) {
    // Track tool_use commands
    if (entry.type === 'assistant' && entry.message?.content) {
      for (const block of contentBlocks(entry.message.content)) {
        if (isToolUseBlock(block) && block.id) {
          const cmd = block.input?.command || block.input?.file_path || block.name || '';
          commands.set(block.id, String(cmd));
        }
      }
    }

    // Collect errors
    if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (isToolResultBlock(block) && block.is_error) {
          const content = typeof block.content === 'string' ? block.content : '';
          errors.push({
            content: normalizeError(content),
            toolUseId: block.tool_use_id || '',
          });
        }
      }
    }
  }

  if (errors.length < minRepetitions) return null;

  // Check for repeated identical errors (by normalized content)
  const errorCounts = new Map<string, number>();
  for (const err of errors) {
    const count = (errorCounts.get(err.content) || 0) + 1;
    errorCounts.set(err.content, count);
  }

  for (const [pattern, count] of Array.from(errorCounts.entries())) {
    if (count >= minRepetitions) {
      // Find the associated command
      const matchingError = errors.find(e => e.content === pattern);
      const failingCommand = matchingError ? commands.get(matchingError.toolUseId) : undefined;

      return {
        type: 'error_loop',
        sessionUuid: tail.sessionUuid,
        detectedAt: now,
        loopCount: count,
        failingPattern: pattern.slice(0, 200),
        ...(failingCommand !== undefined ? { failingCommand } : {}),
      };
    }
  }

  return null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize an error message for comparison (strip variable parts like timestamps, PIDs).
 */
function normalizeError(error: string): string {
  return error
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>')
    .replace(/pid\s*[:=]\s*\d+/gi, 'pid:<PID>')
    .replace(/port\s*[:=]\s*\d+/gi, 'port:<PORT>')
    .trim();
}

/**
 * Classify an error message into a type.
 */
function classifyError(errorMessage: string): CrashInfo['errorType'] {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('parsing') || lower.includes('json') || lower.includes('syntax')) {
    return 'parsing';
  }
  if (lower.includes('api') || lower.includes('rate limit') || lower.includes('invalid_request_error') || lower.includes('overloaded_error') || lower.includes('429') || lower.includes('400') || lower.includes('500') || lower.includes('502') || lower.includes('503')) {
    return 'api';
  }
  if (lower.includes('internal') || lower.includes('segfault') || lower.includes('heap')) {
    return 'internal';
  }
  return 'unknown';
}
