import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, overCapCall, type CallOutcome } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { GROUP_REVIEW_FINAL_NOTICE, REVIEW_OUTPUT_CAP, parseJevResponse, parseReplyReviewVerdict,
  reviewReply, type ReplyRule } from './reply-check.js';
import { readAnswer } from './answer-reading.js';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const live = load('reply-review-overcap-2026-10-20.json') as {
  id: string; text: string; answer: string; delivered: string; jevOutput: string;
  review: { state: 'uncertain'; output: null; usage: { inputTokens: number; outputTokens: number; charge: null }; outcome: CallOutcome };
};
const earlier = load('canary9-review-2026-10-11.json') as {
  text: string; answer: string; jev: unknown; reviews: { output: string }[];
};
const key = new Uint8Array(32).fill(98);
type Options = { outcome?: Partial<CallOutcome>; maxCalls?: number; stop?: boolean; elapsed?: number;
  second?: 'pass' | 'overcap' | 'violation'; realReview?: boolean; noUsage?: boolean };

async function replay(options: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'review-overcap-')), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '-1004367556355',
    operator: '7654321', forum: true, grant: 'grant:offline', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: options.maxCalls ?? 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  let elapsed = 0, stopped = false;
  const retries: (boolean | undefined)[] = [], sends: string[] = [];
  const candidate = options.realReview ? earlier.answer : live.answer;
  const worker = createJournalWorker(journal, { now: () => 1000 + elapsed, elapsed: () => elapsed, stopped: () => stopped,
    prepareModel: input => prepareJournalEnvelope(input, 'offline-model', 'grant:offline', 1000, 32768),
    model: async () => candidate,
    replyCheck: { elapsedMs: () => elapsed,
      jev: async () => ({ value: options.realReview ? earlier.jev : parseJevResponse(live.jevOutput), latencyMs: 406 }),
      escalate: async (_text, id, prompt, rules, _deadline, _operation, retry) => {
        expect(prompt).toContain('telegram-group-topic');
        expect(rules).toContain('sensitive_disclosure');
        if (_operation === 'revision') throw Error('supplemental remainder review unavailable');
        retries.push(retry);
        const capped = !retry || options.second === 'overcap';
        journal.append({ kind: 'call-outcome', id: `${id}:reply-review`, role: 'reply-review',
          outcome: capped ? { ...live.review.outcome, ...options.outcome }
            : { ...live.review.outcome, localLimit: null, outputTokens: 250 }, at: 1000 + elapsed });
        journal.append({ kind: 'reply-review-state', id, state: capped ? live.review.state : 'complete',
          ...options.noUsage ? {} : { usage: capped ? live.review.usage : { inputTokens: 100, outputTokens: 250, charge: null, inputComplete: true } },
          at: 1000 + elapsed });
        elapsed += options.elapsed ?? (capped ? 36969 : 1000);
        if (options.stop) stopped = true;
        if (capped) {
          // Same physical-evidence predicate used by journal-agent's escalation adapter.
          if (overCapCall(journal.view, `${id}:reply-review`)) throw Error(REVIEW_OUTPUT_CAP);
          throw Error('preview: reply review unavailable');
        }
        if (options.realReview) {
          const reading = readAnswer(earlier.reviews[0]!.output, { wrapped: 'refuse', object: true, evidence: [id] });
          expect(reading.ok).toBe(true);
          if (!reading.ok) throw Error('recorded verdict unreadable');
          const value = reading.value;
          return { ...parseReplyReviewVerdict(value, rules), confidence: null, latencyMs: 1000 };
        }
        if (options.second !== 'violation') {
          // The discarded frame retained the actual verdict in diagnostics. Replay those bytes as
          // a separately completed replacement; never recover them from the over-cap call in production.
          const terminal = JSON.parse(live.review.outcome.diagnostic!.rawOutputExcerpt) as { result: string };
          const reading = readAnswer(terminal.result, { wrapped: 'refuse', object: true, evidence: [id] });
          if (!reading.ok) throw Error('recorded verdict unreadable');
          return { ...parseReplyReviewVerdict(reading.value, rules), confidence: null, latencyMs: 1000 };
        }
        // Supplemental constructed violation, with the exact offending span named.
        return { ...parseReplyReviewVerdict(JSON.stringify(Object.fromEntries((rules ?? []).map(rule => [rule,
          options.second === 'violation' && rule === 'sensitive_disclosure'
            ? `VIOLATION | Private disclosure: "${candidate.split('\n')[0]}".` : 'PASS | No breach.']))), rules),
          confidence: null, latencyMs: 1000 };
      } }, checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return sends.length; } });
  worker.intake([{ update_id: 367052411, message: { chat: { id: -1004367556355, type: 'supergroup', is_forum: true },
    from: { id: 7654321 }, text: options.realReview ? earlier.text : live.text } }]);
  const error = await worker.drain().then(() => undefined, (error: unknown) => error);
  return { get journal() { return journal; }, retries, sends, error, candidate,
    restart: async () => {
      journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
      await createJournalWorker(journal, { now: () => 1000 + elapsed, stopped: () => false,
        model: async () => { throw Error('duplicate model'); }, checkOutbound: () => {},
        send: async () => { throw Error('duplicate send'); } }).drain();
    }, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('recorded 367052411: retries the ended over-cap review once and sends the reviewed answer once', async () => {
  const w = await replay();
  try {
    expect(w.error).toBeUndefined();
    expect(live.delivered).toBe(GROUP_REVIEW_FINAL_NOTICE);
    expect(live.review.output).toBeNull();
    expect(w.retries).toEqual([undefined, true]);
    expect(w.sends).toEqual([w.candidate]);
    expect(w.journal.view.calls).toBe(3);
    expect(w.journal.view.order[0]?.reviewRetried).toBe(true);
    // Jev usage + the actual over-cap usage + retry usage; no charge disappears.
    expect(w.journal.view.tokenTotals.replyCheck.outputTokens).toBe(184 + 2365 + 250);
    expect(w.journal.view.tokenTotals.replyCheck.unknownCalls).toBe(1); // first call's input is not certified complete
    await w.restart();
    expect(w.sends).toHaveLength(1);
    expect(w.journal.view.calls).toBe(3);
    expect(w.journal.view.order[0]?.reviewRetried).toBe(true);
    expect(w.journal.view.tokenTotals.replyCheck.outputTokens).toBe(2799);
  } finally { w.close(); }
});

it('replays the real 969390374 probe review after the recorded over-cap failure (audience re-addressed)', async () => {
  const w = await replay({ realReview: true });
  try {
    expect(w.error).toBeUndefined();
    expect(w.retries).toEqual([undefined, true]);
    expect(w.sends).toEqual([earlier.answer]);
    expect(w.journal.view.order[0]?.replyChecks?.at(-1)).toMatchObject({ verdict: 'pass', path: 'subscription' });
  } finally { w.close(); }
});

it.each([{ exitCode: null }, { type: null }, { localLimit: 'timeout' as const }])
('does not retry an unproven ended output-cap result: %j', async outcome => {
  const w = await replay({ outcome });
  try { expect(w.error).toBeUndefined(); expect(w.retries).toEqual([undefined]); expect(w.sends).toEqual([GROUP_REVIEW_FINAL_NOTICE]); }
  finally { w.close(); }
});

it.each([{ maxCalls: 2 }, { elapsed: 60001 }, { stop: true }])('keeps the cap, shared deadline and stop: %j', async options => {
  const w = await replay(options);
  try {
    expect(w.retries).toEqual([undefined]);
    expect(w.journal.view.calls).toBe(2);
    expect(w.sends).toEqual('stop' in options ? [] : [GROUP_REVIEW_FINAL_NOTICE]);
  } finally { w.close(); }
});

it('a second output-cap result cannot create a third review or an unchecked group answer', async () => {
  const w = await replay({ second: 'overcap' });
  try {
    expect(w.error).toBeUndefined(); expect(w.retries).toEqual([undefined, true]);
    expect(w.sends).toEqual([GROUP_REVIEW_FINAL_NOTICE]); expect(w.journal.view.calls).toBe(3);
  } finally { w.close(); }
});

it('an explicit sensitivity violation from the replacement still withholds the answer', async () => {
  const w = await replay({ second: 'violation' });
  try {
    expect(w.retries).toEqual([undefined, true]);
    expect(w.journal.view.order[0]?.replyChecks?.at(-1)?.verdict).toBe('violation');
    expect(w.sends).not.toContain(w.candidate);
  } finally { w.close(); }
});

it('missing usage retains both reserved charges rather than replacing the old one', async () => {
  const w = await replay({ noUsage: true });
  try {
    expect(w.error).toBeUndefined(); expect(w.sends).toEqual([w.candidate]);
    expect(w.journal.view.tokenTotals.replyCheck.unknownCalls).toBe(2);
    expect(w.journal.view.tokenTotals.replyCheck.outputTokens).toBe(184 + 2048 * 2);
  } finally { w.close(); }
});

it('replays the recorded wider corpus through the retry without interpreting missing verdicts as passes', async () => {
  const corpus = load('retrospective-duty-followup-train-1-2026-10-08.json') as { otherShapes: { kind: string; id: string; raw: string }[] };
  for (const row of corpus.otherShapes) {
    let calls = 0;
    const result = await reviewReply('candidate', row.id, { elapsedMs: () => 0, reserveEscalation: () => true,
      reserveFormatRetry: () => true, jev: async () => ({ value: null, latencyMs: 0 }), record: () => {},
      escalate: async (_text, _id, _prompt, rules) => {
        if (++calls === 1) throw Error(REVIEW_OUTPUT_CAP);
        const reading = readAnswer(row.raw, { wrapped: 'refuse', object: true, evidence: [row.id] });
        if (!reading.ok) throw Error('no verdict');
        return { ...parseReplyReviewVerdict(reading.value, rules), confidence: null, latencyMs: 0 };
      } }, ['defers_work'] as ReplyRule[]);
    expect(calls, row.id).toBe(2);
    expect(result.outcome, row.id).toBe(row.kind === 'reply-review' ? 'violation' : 'unavailable');
  }
});

it('the journal refuses a claimed output-cap retry without the exact physical evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'review-retry-proof-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:offline', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const id = 'telegram:12345678:update:1';
  try {
    journal.append({ kind: 'intake', id, update: 1, text: 'question', raw: '{}', accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1000 });
    journal.append({ kind: 'answer', id, text: 'candidate', state: 'complete', at: 1000 });
    journal.append({ kind: 'reply-review-reserve', id, candidate: 'candidate', at: 1000 });
    journal.append({ kind: 'reply-review-state', id, state: 'uncertain', at: 1000 });
    const retry = { kind: 'format-retry' as const, id, role: 'reply-review' as const, failureClass: 'output-cap' as const, at: 1000 };
    expect(() => journal.append(retry)).toThrow('format retry order or cap');
    journal.append({ kind: 'call-outcome', id: `${id}:reply-review`, role: 'reply-review', outcome: live.review.outcome, at: 1000 });
    // A newer outcome for the same call supersedes the older proof; never search for any past cap hit.
    journal.append({ kind: 'call-outcome', id: `${id}:reply-review`, role: 'reply-review',
      outcome: { ...live.review.outcome, localLimit: 'timeout' }, at: 1001 });
    expect(() => journal.append(retry)).toThrow('format retry order or cap');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
