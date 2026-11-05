/** Journal-backed fixture for the carryover row 32 correction tests. Where the 1.x unit tests seeded a SQLite ledger
 * with `ledger.record(...)`, these tests seed the durable preview journal with the rows the answer path writes: an
 * accepted operator message, its reservation (with the packet grounding) and its answer carrying a validated
 * `prefer` memory change or a `memoryFailure` report. Every projection under test then reads that journal, and a
 * `reopen` replays it from disk so restart equality is part of every case (Rules 2, 36, 70). */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, operatorWriter, type JournalView, type MemoryChange, type ReplyGrounding, type Turn } from './journal.js';
import type { MemoryFailureProposal } from './memory-learning.js';
import type { PresentedCorrection } from './correction-loop-driver.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, type RetroResult } from './retrospective.js';

export const T = (iso: string) => Date.parse(iso);
export const BOT = '12345678';
export const OPERATOR = '7654321';
export const STRANGER = '5550001';
export const KEY = new Uint8Array(32).fill(32);
export const turnId = (n: number) => `telegram:${BOT}:update:${String(n)}`;

/** A complete pass result that recorded nothing: the shape a reservation's `retro` row needs. */
export function emptyRetroResult(extra: Partial<RetroResult> = {}): RetroResult {
  return { inspected: [], omitted: [], duties: RETROSPECTIVE_DUTIES.map(duty => ({ duty, disposition: 'inspected' as const, note: 'inspected; nothing found' })),
    gravityWells: GRAVITY_WELLS.map(well => ({ well: well.id, observed: false, refs: [], note: 'not observed' })),
    efficiency: { summary: 'offline' }, findings: [], grades: [], feedback: [], authorizations: [], closures: [], comparisons: [], ...extra };
}

export function correctionWorld(limits: { maxCalls?: number; maxTurns?: number } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-corrections-')));
  const path = join(dir, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: BOT, chat: OPERATOR, operator: OPERATOR, grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: limits.maxCalls ?? 2000, maxReplies: 2000, maxTurns: limits.maxTurns ?? 2000, maxBytes: 409600, cursor: 0 };
  let journal = openPreviewJournal(path, KEY, genesis);
  let next = 1;
  const operator = (turn: Turn) => operatorWriter(journal.view, turn, true);
  const raw = (id: number, text: string, at: number, from: string, thread?: number) => JSON.stringify({ update_id: id,
    message: { message_id: id, date: Math.floor(at / 1000), chat: { id: Number(OPERATOR), type: 'private' },
      from: { id: Number(from), is_bot: false, first_name: 'Operator' }, text, ...(thread === undefined ? {} : { message_thread_id: thread, is_topic_message: true }) } });
  /** An accepted message: from the verified operator, or (for a provenance neighbor) from another sender. */
  const say = (text: string, at: number, options: { thread?: number; from?: string } = {}) => {
    const update = next++, id = turnId(update);
    journal.append({ kind: 'intake', id, update, text, raw: raw(update, text, at, options.from ?? OPERATOR, options.thread), accepted: true,
      cursor: update + 1, at, ...(options.thread === undefined ? {} : { thread: options.thread }) });
    return id;
  };
  const groundingOf = (partial: Partial<ReplyGrounding> = {}): ReplyGrounding => ({ packetSha256: 'offline', summaryThrough: null,
    history: [], recalled: [], people: [], commitments: [], channelItems: [], corrections: [], memoryChanges: [], memoryCandidates: [], ...partial });
  /** The reservation (with the packet grounding) and the complete answer of a message. */
  const answer = (id: string, text: string, at: number, extra: { memory?: MemoryChange[]; memoryFailure?: MemoryFailureProposal;
    grounding?: Partial<ReplyGrounding> } = {}) => {
    journal.append({ kind: 'reserve', id, at, grounding: groundingOf(extra.grounding) });
    journal.append({ kind: 'answer', id, text, state: 'complete', at, ...(extra.memory ? { memory: extra.memory } : {}),
      ...(extra.memoryFailure ? { memoryFailure: extra.memoryFailure } : {}) });
  };
  return {
    dir, path,
    get journal() { return journal; },
    get view(): JournalView { return journal.view; },
    operator,
    say, answer,
    /** The operator states a standing preference and the answer path records it. Returns the message id. */
    preference: (learning: string, at: number, options: { thread?: number; from?: string } = {}) => {
      const id = say(learning, at, options);
      answer(id, 'Will do.', at + 1, { memory: [{ mode: 'prefer', source: id, quote: learning, trigger: id }] });
      return id;
    },
    /** The operator states a fact, asks about it later, the agent fails, and the operator reminds it: one recorded
     * memory failure whose trigger is the reminder and whose source is the fact. `shown` puts the fact in the
     * failed answer's packet (cause shown-not-used); otherwise it was verbatim-reachable and not retrieved. */
    forgotten: (fact: string, question: string, at: number, options: { thread?: number; shown?: boolean } = {}) => {
      const source = say(fact, at, options);
      answer(source, 'Noted.', at + 1);
      const asked = say(question, at + 2000, options);
      answer(asked, 'I do not know.', at + 2001, { grounding: options.shown ? { history: [source] } : {} });
      const reminder = say(`You should have known that: ${fact}`, at + 4000, options);
      answer(reminder, 'Sorry.', at + 4001, { memoryFailure: { quote: fact, source } });
      return { source, asked, reminder };
    },
    /** An ordinary exchange whose recorded packet grounding is the delivery evidence under test. */
    reply: (text: string, at: number, grounding: Partial<ReplyGrounding> = {}) => {
      const id = say(text, at);
      answer(id, 'Noted.', at + 1, { grounding });
      return id;
    },
    /** A rolling summary through the latest message: the journal's context reset. */
    summarize: (at: number) => {
      const through = next - 1;
      journal.append({ kind: 'summary-reserve', through, at });
      journal.append({ kind: 'summary', through, text: 'Routine discussion.', at });
    },
    /** A retrospective pass: its reservation (recording the correction clusters it presented) and its result. */
    pass: (at: number, options: { corrections?: PresentedCorrection[]; cases?: string[]; result?: Partial<RetroResult> | null;
      state?: 'complete' | 'failed' | 'unknown'; turnsSeen?: number } = {}) => {
      const pass = journal.view.retroPasses.length;
      journal.append({ kind: 'retro-reserve', pass, turnsSeen: options.turnsSeen ?? journal.view.order.length, cases: options.cases ?? [], omitted: [],
        eligible: options.cases?.length ?? 0, packetSha256: 'sha256:offline', contextDigest: 'sha256:offline', at,
        ...(options.corrections?.length ? { corrections: options.corrections } : {}) });
      if (options.result === null) return pass;
      const state = options.state ?? 'complete';
      journal.append({ kind: 'retro', pass, state, ...(state === 'complete' ? { result: emptyRetroResult(options.result ?? {}) } : { reason: 'offline failure' }), at: at + 1 });
      return pass;
    },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, KEY); },
    close: () => { try { journal.close(); } catch { /* closed */ } rmSync(dir, { recursive: true, force: true }); },
  };
}
export type CorrectionWorld = ReturnType<typeof correctionWorld>;
