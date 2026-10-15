/** Codex app-server protocol mapping, not an authority or a transport. The host persists
 * intake/attempts before dispatch, owns RPC ids, deadlines, stop and process identity, and
 * supplies an isolated configuration with the existing tool and model admission checkpoints.
 * No request here is automatically retried. See codex-conversation.md for the host contract. */
/** App-server consumes this override on both thread/start and thread/resume. The host
 * supplies only its already-reviewed admission scripts, as on the terminal route. */
export const CODEX_CONVERSATION_CONFIG = Object.freeze({ bypass_hook_trust: true });
export interface CodexRequest {
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
}
export interface CodexThreadOptions {
  readonly cwd: string;
  readonly model: string;
  readonly approvalPolicy: 'never' | 'on-request';
  readonly sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  /** Exact host-prepared configuration, including admission hooks, model checkpoint and MCP.
   * Must contain references/launcher records, never credentials. Reapplied on resume. */
  readonly config: Readonly<Record<string, unknown>>;
}
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
function requireValue(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(detail);
}
function identity(value: string) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value), 'invalid protocol identity');
  return value;
}
function threadOptions(options: CodexThreadOptions) {
  requireValue(options.cwd.startsWith('/') && !options.cwd.split('/').includes('..'), 'absolute working scope required');
  identity(options.model);
  requireValue(['never', 'on-request'].includes(options.approvalPolicy)
    && ['read-only', 'workspace-write', 'danger-full-access'].includes(options.sandbox), 'explicit worker policy required');
  requireValue(record(options.config), 'host-prepared configuration required');
  return { ...options };
}
/** Requests are returned as values so the common host can record and admit the exact dispatch. */
export const codexConversationRequests = Object.freeze({
  initialize(): CodexRequest {
    return { method: 'initialize', params: { clientInfo: { name: 'instar', title: 'Instar', version: '2.0' } } };
  },
  initialized(): CodexRequest { return { method: 'initialized', params: {} }; },
  start(options: CodexThreadOptions): CodexRequest {
    return { method: 'thread/start', params: { ...threadOptions(options), ephemeral: false } };
  },
  resume(threadId: string, options: CodexThreadOptions): CodexRequest {
    return { method: 'thread/resume', params: { ...threadOptions(options), threadId: identity(threadId), excludeTurns: true } };
  },
  deliver(threadId: string, text: string): CodexRequest {
    requireValue(typeof text === 'string' && text.trim() && Buffer.byteLength(text) <= 1_048_576, 'bounded nonempty input required');
    return { method: 'turn/start', params: { threadId: identity(threadId), input: [{ type: 'text', text, text_elements: [] }] } };
  },
  interrupt(threadId: string, turnId: string): CodexRequest {
    return { method: 'turn/interrupt', params: { threadId: identity(threadId), turnId: identity(turnId) } };
  },
});

export interface CodexUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
}
export interface CodexTurnResult {
  readonly threadId: string;
  readonly turnId: string;
  readonly status: 'open' | 'completed' | 'failed' | 'interrupted' | 'unverifiable';
  /** Final-answer items only; empty or missing text is not a sendable reply. */
  readonly reply: string | null;
  /** Thread cumulative usage, NOT the cost of this turn or a count of model calls. */
  readonly cumulativeUsage: CodexUsage | null;
  readonly reason: string | null;
}
/** Bounded, identity-bound read of one turn. Completed items replace deltas, so duplicate
 * notifications cannot concatenate the reply twice. Unknown events do not imply completion.
 * Retain original frames in the host's capture store before feeding this local projection. */
export function createCodexTurnReader(threadId: string, turnId: string, maxReplyBytes = 65536) {
  identity(threadId); identity(turnId);
  requireValue(Number.isSafeInteger(maxReplyBytes) && maxReplyBytes > 0 && maxReplyBytes <= 1_048_576, 'bounded reply size required');
  let status: CodexTurnResult['status'] = 'open', reason: string | null = null;
  let cumulativeUsage: CodexUsage | null = null;
  const messages = new Map<string, { text: string; phase: string | null }>();
  let bytes = 0;
  const invalid = (detail: string) => { status = 'unverifiable'; reason = detail; };
  const addItem = (value: unknown) => {
    const item = record(value);
    if (!item || item.type !== 'agentMessage') return;
    if (typeof item.id !== 'string' || !item.id || item.id.length > 256 || typeof item.text !== 'string'
      || ![null, undefined, 'commentary', 'final_answer'].includes(item.phase as string | null | undefined)) {
      invalid('malformed agent message'); return;
    }
    const next = { text: item.text, phase: typeof item.phase === 'string' ? item.phase : null };
    const prior = messages.get(item.id);
    if (prior) {
      if (prior.text !== next.text || prior.phase !== next.phase) invalid('conflicting completed agent message');
      return;
    }
    const addedBytes = Buffer.byteLength(item.text);
    if (messages.size >= 256 || bytes + addedBytes > maxReplyBytes) {
      invalid('reply capture bound exceeded'); return;
    }
    messages.set(item.id, next); bytes += addedBytes;
  };
  const snapshot = (): CodexTurnResult => {
    // Legacy unphased messages count only when there is no explicit final-answer item.
    const all = [...messages.values()];
    const finals = all.filter(item => item.phase === 'final_answer');
    // Match the existing Codex exec adapter: the last completed answer replaces an
    // earlier answer from a retried response, rather than concatenating both replies.
    const reply = (finals.length ? finals : all.filter(item => item.phase === null)).at(-1)?.text ?? '';
    return Object.freeze({ threadId, turnId, status,
      reply: status === 'completed' && reply.trim() ? reply : null, cumulativeUsage, reason });
  };
  return Object.freeze({
    snapshot,
    consume(frame: unknown): CodexTurnResult {
      if (status === 'unverifiable') return snapshot();
      const event = record(frame), params = record(event?.params);
      // A server request (id + method) is not a lifecycle notification or approval.
      if (!event || event.id !== undefined || !params || params.threadId !== threadId) return snapshot();
      const turn = record(params.turn);
      if ((event.method === 'turn/completed' ? turn?.id : params.turnId) !== turnId) return snapshot();
      if (event.method === 'item/completed') {
        if (status === 'open') addItem(params.item);
      } else if (event.method === 'thread/tokenUsage/updated') {
        const total = record(record(params.tokenUsage)?.total);
        if (!total || !['inputTokens', 'outputTokens', 'cachedInputTokens'].every(key =>
          Number.isSafeInteger(total[key]) && (total[key] as number) >= 0)) invalid('malformed cumulative usage');
        else cumulativeUsage = Object.freeze({ inputTokens: total.inputTokens as number,
          outputTokens: total.outputTokens as number, cachedInputTokens: total.cachedInputTokens as number });
      } else if (event.method === 'turn/completed') {
        const terminal = turn?.status;
        if (terminal !== 'completed' && terminal !== 'failed' && terminal !== 'interrupted') invalid('unknown terminal status');
        else if (status !== 'open' && status !== terminal) invalid('conflicting terminal status');
        else {
          if (status === 'open' && Array.isArray(turn?.items)) for (const item of turn.items) addItem(item);
          if (snapshot().status !== 'unverifiable') {
            status = terminal;
            reason = terminal === 'completed' ? null : `worker turn ${terminal}`;
          }
        }
      }
      return snapshot();
    },
    lost(): CodexTurnResult {
      if (status === 'open') invalid('transport ended without terminal evidence; do not replay input');
      return snapshot();
    },
  });
}
