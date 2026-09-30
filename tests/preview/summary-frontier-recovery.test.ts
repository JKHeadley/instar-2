import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, HELD_REPREPARE_MS, openPreviewJournal, reachedJournalCap } from './journal.js';

// Live proof room, 2026-09-29: the first summary frontier came back "undecided" (Jev 0.16) twice. Every later
// pass returned at that exhausted frontier, so no summary was ever accepted; the chat grew to its byte bound,
// the next turn was held and reported as "bytes cap reached", and the held turn was re-prepared on every drain.
const key = new Uint8Array(32).fill(23);
const genesis = (maxBytes: number) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const jev = (score: number) => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: score } } });
const filler = (id: number) => `Filler note ${String(id)}: ${'the garden shed holds rakes, twine and seed trays. '.repeat(12)}`;
/** The summary judge sees the transition's history; its last item is the frontier being checked. */
const frontierOf = (evidence: string) => {
  const history = (JSON.parse(evidence) as { history: { id: string }[] }).history;
  return Number(history.at(-1)?.id.split(':').at(-1));
};

function world(undecided: (through: number) => boolean, maxBytes = 12000) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-frontier-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(maxBytes));
  const judged: { through: number; score: number }[] = [];
  const prepared: string[] = [];
  let clock = 0;
  const worker = createJournalWorker(journal, { now: () => 1790000000000 + clock, elapsed: () => clock, stopped: () => false,
    // The real envelope adds framing: a packet that fits can still overflow once prepared (live: "prompt overflow").
    prepareModel: input => { prepared.push(input.id);
      if (Buffer.byteLength(input.context) > maxBytes * 0.8) throw Error('preview: envelope over its byte bound');
      return JSON.stringify(input); },
    model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: `Earlier the operator kept filler notes about a garden shed (through ${input.id}).`, people: [] })
      : 'Noted.',
    summaryCheck: async evidence => {
      const through = frontierOf(evidence), score = undecided(through) ? 0.16 : 0.01;
      judged.push({ through, score }); return jev(score);
    },
    send: async () => 1, checkOutbound: () => {} });
  return { root, path, journal, worker, judged, prepared, tick: (ms: number) => { clock += ms; },
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('moves to another span after an undecided frontier, so a long chat at its byte bound keeps answering', async () => {
  // The widest first prefix is always undecided, as in the live proof room; narrower spans pass.
  const w = world(through => through === 4);
  try {
    for (let id = 1; id <= 30; id++) {
      w.worker.intake([update(id, filler(id))]);
      await w.worker.drain();
      await w.worker.summarizeIfNeeded();
    }
    // The undecided frontier used exactly its two attempts and was never retried after that.
    expect(w.judged.filter(item => item.through === 4)).toHaveLength(2);
    expect(w.journal.view.summaryFailures.get(4)).toBe(2);
    // Another span was accepted instead, and the frontier then moved on past the failed one.
    expect(w.journal.view.summaries.length).toBeGreaterThan(1);
    expect(w.journal.view.summaries.some(summary => summary.through === 4)).toBe(false);
    expect(w.journal.view.summaries.at(-1)!.through).toBeGreaterThan(4);
    // Every turn was answered: no held turn, no reported cap.
    expect(w.journal.view.order.filter(turn => turn.held !== undefined && turn.update > 4)).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.sent).length).toBe(30);
    expect(reachedJournalCap(w.journal.view)).toBeNull();
  } finally { w.close(); }
});

/** Fill until a turn is held for want of a summary. */
async function fillUntilHeld(w: ReturnType<typeof world>) {
  for (let id = 1; id <= 40; id++) {
    w.worker.intake([update(id, filler(id))]);
    await w.worker.drain();
    const held = w.journal.view.order.find(turn => turn.held?.startsWith('summary unavailable:'));
    if (held) return held;
  }
  throw Error('fixture never reached its byte bound');
}

it('holds a turn no summary can shrink as recoverable, and prepares it again only when something changed', async () => {
  const w = world(() => true, 9000);
  try {
    const held = await fillUntilHeld(w);
    // Recoverable, not a cap: nothing latches the preview while a summary may still let it resume.
    expect(reachedJournalCap(w.journal.view)).toBeNull();
    // Each drain gives another span its bounded attempts; none re-prepares the held turn.
    const preparations = w.prepared.filter(item => item === held.id).length;
    for (let i = 0; i < 12; i++) await w.worker.drain();
    // Every frontier the summary can reach (the turns answered before the held one) used its two attempts.
    const reachable = w.journal.view.order.filter(turn => turn.sent !== undefined && turn.update < held.update).map(turn => turn.update);
    expect([...w.journal.view.summaryFailures.keys()].sort((a, b) => a - b)).toEqual(reachable);
    expect([...w.journal.view.summaryFailures.values()].every(count => count === 2)).toBe(true);
    expect(w.prepared.filter(item => item === held.id).length).toBe(preparations);
    // Every span in reach is exhausted: further drains spend nothing and prepare nothing; the hold stays visible.
    const calls = w.journal.view.calls;
    for (let i = 0; i < 5; i++) await w.worker.drain();
    expect(w.prepared.filter(item => item === held.id).length).toBe(preparations);
    expect(w.journal.view.calls).toBe(calls);
    expect(held.held).toMatch(/^summary unavailable:/u);
    // After the bounded interval it is prepared once more (still held: nothing changed).
    w.tick(HELD_REPREPARE_MS);
    await w.worker.drain();
    expect(w.prepared.filter(item => item === held.id).length).toBeGreaterThan(preparations);
    expect(held.held).toMatch(/^summary unavailable:/u);
    expect(w.journal.view.calls).toBe(calls);
  } finally { w.close(); }
});

it('resumes a byte-held turn as soon as a summary is accepted, without waiting for the retry interval', async () => {
  // Undecided until the chat reaches its bound and a turn is held; the next attempt passes.
  let undecided = true;
  const w = world(() => undecided, 9000);
  try {
    const held = await fillUntilHeld(w);
    undecided = false;
    for (let i = 0; i < 6 && held.sent === undefined; i++) await w.worker.drain();
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    expect(held.held).toBeUndefined();
    expect(held.sent).toBeDefined();
    expect(reachedJournalCap(w.journal.view)).toBeNull();
  } finally { w.close(); }
});

it('releases a summary-unavailable hold on replay once a summary is accepted, while genuine exhaustion stays a cap', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-hold-replay-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis(12000));
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.id.startsWith('summary:') ? JSON.stringify({ summary: 'Garden notes.', people: [] }) : 'Noted.',
      summaryCheck: async () => jev(0.01), send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'First.'), update(2, 'Second.')]); await worker.drain();
    const second = journal.view.order[1]!;
    journal.append({ kind: 'hold', id: second.id, reason: 'summary unavailable: prompt overflow', at: 1790000000001 });
    expect(reachedJournalCap(journal.view)).toBeNull();
    // An earlier writer reported this hold as a bytes cap (the live proof-room journal carries one); it still replays.
    journal.append({ kind: 'cap-report', reason: 'bytes', limit: 12000, at: 1790000000001 });
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(1);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect([...journal.view.capReports]).toEqual(['bytes:12000']);
    expect(journal.view.order[1]!.held).toBeUndefined();
    // A first turn that cannot fit has nothing earlier to summarize: that is genuine byte exhaustion.
    journal.append({ kind: 'hold', id: journal.view.order[0]!.id, reason: 'prompt overflow', at: 1790000000002 });
    expect(reachedJournalCap(journal.view)).toEqual({ reason: 'bytes', limit: 12000 });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
