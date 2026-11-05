/**
 * Session Stall Detector — JSONL Tail Analysis. Carried from 1.x
 * `src/monitoring/stall-detector.ts` at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9
 * for carryover row 03. The harness adapter that owns the transcript reads its
 * tail and parses the entries (the 1.x 64 KB tail read and partial-first-line
 * skip live there); this core function judges the parsed entries against the
 * injected clock and never touches a file (NF-52; Rule 30).
 *
 * Detects when a harness session has stalled mid-tool-call by analyzing
 * the conversation JSONL tail. A stall occurs when:
 * 1. The last assistant message has stop_reason: "tool_use"
 * 2. No subsequent tool_result has been received
 * 3. The time since the tool_use exceeds the threshold for that tool type
 *
 * Part of PROP-XXX: Session Stall Detection & Auto-Recovery
 */

export interface StallInfo {
  sessionUuid: string;
  /** Milliseconds since the epoch, converted by the adapter from the entry timestamp. */
  stalledAt: number;
  stallDurationMs: number;
  lastToolName: string;
  lastToolInput: Record<string, unknown>;
  lastToolUseId: string;
}

/** One parsed transcript entry as the adapter supplies it; timestamps already in epoch ms. */
export interface TranscriptEntry {
  type: string;
  timestampMs?: number;
  message?: {
    stop_reason?: string;
    content?: unknown;
  };
}

/** A parsed transcript tail: the session's identity and its last entries, oldest first. */
export interface TranscriptTail {
  sessionUuid: string;
  entries: readonly TranscriptEntry[];
}

interface ToolUseBlock { type: 'tool_use'; id?: string; name?: string; input?: Record<string, unknown> }
interface ToolResultBlock { type: 'tool_result'; tool_use_id?: string; is_error?: boolean; content?: unknown }

export const isToolUseBlock = (block: unknown): block is ToolUseBlock =>
  !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'tool_use';
export const isToolResultBlock = (block: unknown): block is ToolResultBlock =>
  !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'tool_result';
export const contentBlocks = (content: unknown): readonly unknown[] => Array.isArray(content) ? content : [];

/**
 * Per-tool stall thresholds in milliseconds.
 * Tools that legitimately take longer get higher thresholds.
 */
export const DEFAULT_TOOL_THRESHOLDS: Record<string, number> = {
  // Fast tools — should complete in seconds
  Read: 60_000,
  Write: 60_000,
  Edit: 60_000,
  Glob: 60_000,
  Grep: 60_000,

  // Medium tools — may take a few minutes
  Bash: 10 * 60_000,
  Skill: 5 * 60_000,

  // Slow tools — subagents and complex operations
  Agent: 15 * 60_000,

  // Default for unknown tools
  _default: 3 * 60_000,
};

/**
 * Detect if a harness session has stalled mid-tool-call.
 *
 * @param tail - The parsed transcript tail (the adapter reads the last ~20 entries)
 * @param now - The host clock, milliseconds since the epoch
 * @param maxAgeMs - Optional global override for stall threshold (overrides per-tool thresholds)
 * @returns StallInfo if stalled, null otherwise
 */
export function detectToolCallStall(
  tail: TranscriptTail,
  now: number,
  maxAgeMs?: number
): StallInfo | null {
  // 1–2. The adapter has read the tail and parsed the last ~20 JSONL entries.
  const entries = tail.entries.slice(-20);

  if (entries.length === 0) return null;

  // 3. Find the last assistant message
  let lastAssistantIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.type === 'assistant') {
      lastAssistantIdx = i;
      break;
    }
  }

  if (lastAssistantIdx === -1) return null;

  const lastAssistant = entries[lastAssistantIdx]!;
  const message = lastAssistant.message;
  if (!message) return null;

  // 4. Check if stop_reason is tool_use
  if (message.stop_reason !== 'tool_use') return null;

  // 5. Find the tool_use content blocks
  const toolUseBlocks = contentBlocks(message.content).filter(isToolUseBlock);

  if (toolUseBlocks.length === 0) return null;

  // 6. Check if any subsequent entry contains a tool_result for these tool_use IDs
  const toolUseIds = new Set(toolUseBlocks.map((b) => b.id));
  let hasToolResult = false;

  for (let i = lastAssistantIdx + 1; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry.type === 'user' && entry.message?.content) {
      const resultBlocks = contentBlocks(entry.message.content);
      for (const block of resultBlocks) {
        if (isToolResultBlock(block) && toolUseIds.has(block.tool_use_id)) {
          hasToolResult = true;
          break;
        }
      }
    }
    if (hasToolResult) break;
  }

  if (hasToolResult) return null; // Tool completed — no stall

  // 7. Calculate stall duration
  const toolUseTimestamp = lastAssistant.timestampMs;
  if (toolUseTimestamp === undefined || !Number.isFinite(toolUseTimestamp)) return null;

  const stalledAt = toolUseTimestamp;
  const stallDurationMs = now - stalledAt;

  // 8. Get the last tool_use block (the one that stalled)
  const lastToolUse = toolUseBlocks[toolUseBlocks.length - 1]!;
  const toolName: string = lastToolUse.name || 'unknown';

  // 9. Check against threshold
  const threshold = maxAgeMs ?? (DEFAULT_TOOL_THRESHOLDS[toolName] || DEFAULT_TOOL_THRESHOLDS._default!);
  if (stallDurationMs < threshold) return null;

  // 10. The session UUID is the transcript identity the adapter resolved.
  const sessionUuid = tail.sessionUuid;

  return {
    sessionUuid,
    stalledAt,
    stallDurationMs,
    lastToolName: toolName,
    lastToolInput: lastToolUse.input || {},
    lastToolUseId: lastToolUse.id || '',
  };
}
