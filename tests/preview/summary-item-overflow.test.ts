import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, SUMMARY_OVER_BOUND_REASON } from './journal-test-worker.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const at = 1792909000000;
const key = new Uint8Array(32).fill(39);
const id = (n: number) => `telegram:12345678:update:${n}`;
const fact = (n: number) => `The sample ${n} weighs ${n + 40} grams.`;
function world(prose = 'The operator supplied measurements.', datedPending = true) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'summary-items-'))); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal'), key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:test', configurationDigest: 'sha256:test', expires: at + 86400000,
    maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 40000, cursor: 0 });
  for (let n = 1; n <= 26; n++) {
    const text = fact(n), raw = JSON.stringify({ update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
    journal.append({ kind: 'intake', id: id(n), update: n, text, raw, accepted: true, cursor: n + 1, at });
    journal.append({ kind: 'reserve', id: id(n), at });
    journal.append({ kind: 'answer', id: id(n), text: 'Noted.', ...(datedPending ? { datedPending: true as const } : {}), at });
    journal.append({ kind: 'intent', id: id(n), text: 'Noted.', chat: '7654321', update: n, grant: 'grant:test', at });
    journal.append({ kind: 'sent', id: id(n), message: n, at });
  }
  journal.append({ kind: 'summary-reserve', through: 20, at });
  journal.append({ kind: 'summary', through: 20, text: prose,
    memoryItems: Array.from({ length: 20 }, (_, n) => ({ source: id(n + 1), quote: fact(n + 1) })), at });
  const evidence: string[] = [];
  const worker = createJournalWorker(journal, { now: () => at + 600001, stopped: () => false,
    model: async input => {
      const packet = JSON.parse(input.context) as { summary: { text: string }; history: { id: string; user: string }[] };
      return JSON.stringify({ summary: packet.summary.text, people: [], memory: [],
        memoryItems: [...packet.history.map(item => ({ source: item.id, quote: item.user })),
          { source: 'absent', quote: 'Invented fact.' }, { source: id(21), quote: 'Invented clause.' }] });
    },
    summaryCheck: async input => { evidence.push(input); return { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }; },
    send: async () => { throw Error('summary must not send'); }, checkOutbound: () => {} });
  return { journal, worker, evidence };
}

it.each([false, true])('advances beyond 20 exact facts with datedPending=%s, carrying overflow in reviewed bounded prose', async datedPending => {
  const w = world(undefined, datedPending);
  try {
    await w.worker.summarizeIfNeeded(true);
    const summary = w.journal.view.summaries.at(-1)!;
    expect(summary.through).toBe(26);
    expect(summary.memoryItems).toHaveLength(20);
    for (let n = 21; n <= 26; n++) expect(summary.text).toContain(fact(n));
    expect(summary.text).not.toContain('Invented');
    expect(summary.text).toContain(id(26));
    expect(w.evidence.at(-1)).toContain(fact(26));
    expect(w.journal.view.order.filter(turn => turn.datedPending)).toHaveLength(datedPending ? 26 : 0);
  } finally { w.journal.close(); }
});

it('counts overflow facts inside the existing prose ceiling instead of admitting an oversized summary', async () => {
  const w = world('x'.repeat(8190));
  try {
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(20);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_BOUND_REASON);
    expect(w.journal.view.summaryReservations.size).toBe(0);
  } finally { w.journal.close(); }
});
