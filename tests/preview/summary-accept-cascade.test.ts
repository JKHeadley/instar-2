import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, reachedJournalCap } from './journal.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';

// Live proof room, 2026-09-29/30: every summary it produced was judged "undecided" by Jev (0.22, 0.16, 0.30)
// and refused, although the first two were faithful. Nothing escalated, so no summary was ever accepted and the
// room stopped answering. The confidence cascade (observer #102): Jev decides when confident; its unsure band
// escalates to the full-context subscription review, which accepts a faithful summary and refuses a lossy one.
const key = new Uint8Array(32).fill(41);
const genesis = (maxBytes: number) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

// The proof room's first four operator turns, verbatim.
const TURNS = ['/start',
  'Proof room check: my test marker is probe-5f1ba73c. What is my test marker? Reply with the marker.',
  'When your stored memory or code says one thing and your own judgment says another, which wins — and is there anything code decides without you?',
  'What commitments do I have?'];
const ANSWERS: Record<string, string> = {
  [TURNS[0]!]: 'Welcome — this is a private PREVIEW of Instar 2.0. I keep an encrypted local journal and answer here.',
  [TURNS[1]!]: 'Your test marker is probe-5f1ba73c.',
  [TURNS[2]!]: 'When they disagree, my present judgment wins; code alone decides secrets custody, the spend cap, the stop latch, duplicate-send prevention and durable intake.',
  [TURNS[3]!]: 'None are open right now: no reminders, requested actions, standing directives or unfulfilled promises.' };
// The faithful candidate the live room refused at Jev 0.16 (proof-room journal, 12:16:43 PDT).
const FAITHFUL = 'All from \'main chat\' on 2026-09-29. At 18:55Z, I gave the /start orientation explaining PREVIEW capabilities. '
  + 'At 18:55Z, operator ran a proof-room check stating their test marker is probe-5f1ba73c and asked me to reply with it; I confirmed: '
  + '\'Your test marker is probe-5f1ba73c.\' At 18:57Z, operator asked which wins when stored memory/code conflicts with my judgment; '
  + 'I answered: present judgment wins, but code alone decides secrets custody, spend cap, the stop latch, duplicate-send prevention, and durable intake. '
  + 'At 18:58Z, operator asked what commitments they have; I answered none were open.';
// A lossy candidate: the operator's marker is replaced by an invented one.
const LOSSY = 'Preview conversation, main chat, 2026-09-29. Operator ran /start, gave a test marker probe-00000000 (echoed), asked '
  + 'about judgment versus stored memory, and asked about commitments; none were open.';

type Answer = { model: string; answers: Record<string, { type: 'noul'; noul: number }> };
const jevAnswer = (id: string, score: number): Answer => ({ model: JEV_MODEL, answers: { [id]: { type: 'noul', noul: score } } });

function world(options: { summary: (packet: Record<string, unknown>) => string; faithfulness: () => number | 'throw';
  review: (state: string) => { verdict: 'pass' | 'violation' | 'unavailable'; retryable?: true } | 'throw'; integrity?: number; maxBytes?: number;
  uncertain?: (summaryCall: number) => boolean }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-cascade-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(options.maxBytes ?? 262144));
  const log: string[] = [];
  let clock = 0;
  const worker = createJournalWorker(journal, { now: () => 1790000000000 + clock, elapsed: () => clock, stopped: () => false,
    model: async input => {
      if (!input.id.startsWith('summary:')) return ANSWERS[input.question] ?? 'Noted.';
      log.push('summary');
      if (options.uncertain?.(log.filter(item => item === 'summary').length)) return { state: 'uncertain' as const };
      return options.summary(JSON.parse(input.context) as Record<string, unknown>);
    },
    summaryCheck: async () => {
      log.push('jev-faithfulness');
      const score = options.faithfulness();
      if (score === 'throw') throw Error('Jev unavailable');
      return jevAnswer('lost_memory', score);
    },
    replyCheck: {
      jev: async (_state, question) => {
        const integrity = question !== undefined && 'summary_integrity' in question;
        log.push(integrity ? 'jev-integrity' : 'jev-reply');
        return { value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(question ?? REPLY_RULES)
          .map(id => [id, { type: 'noul', noul: integrity ? options.integrity ?? 0.01 : 0.01 }])) }, latencyMs: 1 };
      },
      summaryReview: async state => {
        log.push('review');
        const verdict = options.review(state);
        if (verdict === 'throw') throw Error('subscription route unavailable');
        return { ...verdict, reason: 'fixture review of the full packet', latencyMs: 1 };
      },
      escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 }),
      elapsedMs: () => clock },
    send: async input => input.update, checkOutbound: () => {} });
  let open = true;
  return { path, journal, worker, log, tick: (ms: number) => { clock += ms; },
    closeJournal: () => { if (open) journal.close(); open = false; },
    close: () => { if (open) journal.close(); open = false; rmSync(root, { recursive: true, force: true }); } };
}

const plain = (summary: string) => () => JSON.stringify({ summary, people: [], commitments: [], closed: [], memory: [], questions: [], memoryItems: [], concepts: [] });
/** The full-context reviewer reads the candidate against the packet: the operator's marker must survive, unaltered. */
const markerReview = (state: string) => {
  const proposed = (JSON.parse(state) as { proposed: { summary: string } }).proposed.summary;
  return { verdict: proposed.includes('probe-5f1ba73c') && !/probe-(?!5f1ba73c)[0-9a-f]{8}/u.test(proposed) ? 'pass' as const : 'violation' as const };
};

async function converse(w: ReturnType<typeof world>) {
  for (const [index, text] of TURNS.entries()) { w.worker.intake([update(index + 1, text)]); await w.worker.drain(); }
  await w.worker.summarizeIfNeeded(true);
}

it('escalates an undecided faithfulness answer and accepts a faithful summary on the full-context review', async () => {
  const w = world({ summary: plain(FAITHFUL), faithfulness: () => 0.16, review: markerReview });
  try {
    await converse(w);
    expect(w.journal.view.summaries).toHaveLength(1);
    const summary = w.journal.view.summaries[0]!;
    expect(summary.text).toContain('probe-5f1ba73c');
    expect(summary.faithfulness).toEqual({ path: 'subscription', verdict: 'pass', score: null });
    // Jev's own unsure answer is kept as calibration evidence; the review is the recorded deciding check.
    expect(w.journal.view.summaryFailures.size).toBe(0);
    // One review call, and the same route is not asked the integrity question again.
    expect(w.log.filter(item => item === 'review')).toHaveLength(1);
    expect(w.log).not.toContain('jev-integrity');
    // Replay reaches the same view (the cascade's rows are valid journal order).
    const through = summary.through;
    w.closeJournal();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.summaries.map(item => item.through)).toEqual([through]);
    expect(reopened.view.summaryCheckCounts.pass).toBe(1);
    reopened.close();
  } finally { w.close(); }
});

it('still refuses a lossy summary: Jev unsure escalates, and the review violation refuses it', async () => {
  const w = world({ summary: plain(LOSSY), faithfulness: () => 0.4, review: markerReview });
  try {
    await converse(w);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe('summary faithfulness: full-context review found loss');
    expect(w.log.filter(item => item === 'review').length).toBeGreaterThan(0);
  } finally { w.close(); }
});

it('refuses on a confident Jev "lost" without spending a review call', async () => {
  const w = world({ summary: plain(LOSSY), faithfulness: () => 0.9, review: markerReview });
  try {
    await converse(w);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe('summary faithfulness: active memory item lost');
    expect(w.log).not.toContain('review');
  } finally { w.close(); }
});

it('accepts on a confident Jev pass without a review, and runs the integrity check as before', async () => {
  const w = world({ summary: plain(FAITHFUL), faithfulness: () => 0.05, review: markerReview });
  try {
    await converse(w);
    expect(w.journal.view.summaries).toHaveLength(1);
    expect(w.journal.view.summaries[0]!.faithfulness).toEqual({ path: 'jev', verdict: 'pass', score: 0.05 });
    expect(w.log).toContain('jev-integrity');
    expect(w.log).not.toContain('review');
  } finally { w.close(); }
});

it('escalates when Jev gives no answer at all, both sides of the review', async () => {
  const pass = world({ summary: plain(FAITHFUL), faithfulness: () => 'throw', review: markerReview });
  try {
    await converse(pass);
    expect(pass.journal.view.summaries).toHaveLength(1);
    expect(pass.journal.view.summaries[0]!.faithfulness?.path).toBe('subscription');
  } finally { pass.close(); }
  const refuse = world({ summary: plain(LOSSY), faithfulness: () => 'throw', review: markerReview });
  try {
    await converse(refuse);
    expect(refuse.journal.view.summaries).toHaveLength(0);
    expect(refuse.journal.view.lastSummaryFailure?.reason).toBe('summary faithfulness: full-context review found loss');
  } finally { refuse.close(); }
});

it('never approves when the stronger model is unavailable too: retryable refuses, unknown keeps its reservation', async () => {
  const retryable = world({ summary: plain(FAITHFUL), faithfulness: () => 0.16, review: () => ({ verdict: 'unavailable', retryable: true }) });
  try {
    await converse(retryable);
    expect(retryable.journal.view.summaries).toHaveLength(0);
    expect(retryable.journal.view.lastSummaryFailure?.reason).toBe('summary faithfulness: undecided');
  } finally { retryable.close(); }
  const unknown = world({ summary: plain(FAITHFUL), faithfulness: () => 0.16, review: () => 'throw' });
  try {
    await converse(unknown);
    expect(unknown.journal.view.summaries).toHaveLength(0);
    // A thrown review may have been charged: its outcome is UNKNOWN and never replayed as a failure.
    expect(unknown.journal.view.summaryReservations.size).toBe(1);
    expect(unknown.log.filter(item => item === 'review')).toHaveLength(1);
  } finally { unknown.close(); }
});

it('reads a summary the model wrapped as {"reply": "<summary JSON>"} (live 2026-09-30) as the summary it carries', async () => {
  const wrapped = (inner: Record<string, unknown>) => () => JSON.stringify({ reply: JSON.stringify(inner) });
  const w = world({ summary: wrapped({ summary: FAITHFUL, people: [], commitments: [], closed: [], memory: [], questions: [], memoryItems: [], concepts: [] }),
    faithfulness: () => 0.3, review: markerReview });
  try {
    await converse(w);
    expect(w.journal.view.summaries).toHaveLength(1);
    // The recorded text is the prose, not the escaped envelope.
    expect(w.journal.view.summaries[0]!.text.startsWith('All from')).toBe(true);
    expect(w.journal.view.summaries[0]!.text).not.toContain('"reply"');
  } finally { w.close(); }
  // Its decision fields are read too: an inner memoryDisposition "unresolved" is a malformed summary, not an approval.
  const unresolved = world({ summary: wrapped({ summary: FAITHFUL, memory: [], memoryDisposition: 'unresolved', people: [] }),
    faithfulness: () => 0.3, review: markerReview });
  try {
    await converse(unresolved);
    expect(unresolved.journal.view.summaries).toHaveLength(0);
    expect(unresolved.log).not.toContain('review');
  } finally { unresolved.close(); }
});

it('lets a byte-held long chat resume once the cascade accepts a summary Jev keeps calling undecided', async () => {
  const filler = (id: number) => `Garden log ${String(id)}: a quiet note for the record, nothing to act on. ${'Row 1 of the beans looked steady today. '.repeat(10)}`;
  const w = world({ maxBytes: 9000, faithfulness: () => 0.3, review: () => ({ verdict: 'pass' }),
    summary: packet => JSON.stringify({ summary: `The operator kept ${String((packet.history as unknown[] | undefined)?.length ?? 0)} quiet garden log notes; nothing to act on.`,
      people: [], commitments: [], closed: [], memory: [], questions: [], memoryItems: [], concepts: [] }) });
  try {
    for (let id = 1; id <= 30; id++) { w.worker.intake([update(id, filler(id))]); await w.worker.drain(); }
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    expect(w.journal.view.order.filter(turn => turn.held !== undefined)).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.sent !== undefined)).toHaveLength(30);
    expect(reachedJournalCap(w.journal.view)).toBeNull();
    expect(w.log).not.toContain('jev-integrity');
  } finally { w.close(); }
});

it('keeps summarizing past an UNKNOWN summary inside the first window (live 2026-09-30: #483 over the output cap)', async () => {
  const filler = (id: number) => `Garden log ${String(id)}: a quiet note for the record, nothing to act on. ${'Row 1 of the beans looked steady today. '.repeat(10)}`;
  // The first summary call comes back UNKNOWN (a provider output past the local cap): its charge stays reserved,
  // and that frontier is never dispatched again. Later spans must still be offered and accepted.
  const w = world({ maxBytes: 9000, faithfulness: () => 0.3, review: () => ({ verdict: 'pass' }), uncertain: call => call === 1,
    summary: () => JSON.stringify({ summary: 'The operator kept quiet garden log notes; nothing to act on.',
      people: [], commitments: [], closed: [], memory: [], questions: [], memoryItems: [], concepts: [] }) });
  try {
    for (let id = 1; id <= 30; id++) {
      w.worker.intake([update(id, filler(id))]);
      await w.worker.drain();
      w.tick(2 * 60_000);
    }
    expect(w.journal.view.summaryReservations.size).toBe(1);
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    expect(w.journal.view.order.filter(turn => turn.held !== undefined)).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.sent !== undefined)).toHaveLength(30);
  } finally { w.close(); }
});

it('bounds the unresolved-correction warnings a packet carries and counts the rest (53 live, 2026-09-30)', async () => {
  const w = world({ summary: plain(FAITHFUL), faithfulness: () => 0.05, review: markerReview });
  try {
    const notes = Array.from({ length: 12 }, (_, index) => `Garden log ${String(index + 1)}: for the record, row ${String(index + 1)} of the beans looked steady today.`);
    for (const [index, text] of notes.entries()) { w.worker.intake([update(index + 1, text)]); await w.worker.drain(); }
    for (const turn of w.journal.view.order) w.journal.append({ kind: 'memory-undecided', id: turn.id, reason: 'summary-failed', at: 1790000000000 });
    const probe = w.worker.probe('How are the beans?');
    if ('reason' in probe) throw Error(`probe held: ${String(probe.reason)}`);
    const packet = JSON.parse(probe.context) as { undecidedEdits: { current: string }[]; moreUndecidedEdits?: number };
    // The most recent five, and a disclosed count of the seven older ones; each message stays in the journal.
    expect(packet.undecidedEdits.map(item => item.current)).toEqual(notes.slice(-5));
    expect(packet.moreUndecidedEdits).toBe(7);
    expect(w.journal.view.order.map(turn => turn.text)).toEqual(notes);
  } finally { w.close(); }
  // Below the bound nothing is omitted and no count is shown.
  const few = world({ summary: plain(FAITHFUL), faithfulness: () => 0.05, review: markerReview });
  try {
    few.worker.intake([update(1, 'For the record, my locker code is 4412, not 3310.')]); await few.worker.drain();
    few.journal.append({ kind: 'memory-undecided', id: few.journal.view.order[0]!.id, reason: 'summary-failed', at: 1790000000000 });
    const probe = few.worker.probe('What is my locker code?');
    if ('reason' in probe) throw Error(`probe held: ${String(probe.reason)}`);
    const packet = JSON.parse(probe.context) as { undecidedEdits: unknown[]; moreUndecidedEdits?: number };
    expect(packet.undecidedEdits).toHaveLength(1);
    expect(packet.moreUndecidedEdits).toBeUndefined();
  } finally { few.close(); }
});
