import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNextDueWake } from '../../src/transport/next-due.js';
import { createOrdinaryLane, sentinelCycle } from './live-sentinels.js';
import { nextObligationAt, createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal-test-worker.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';

// Retained Astra reproduction, replaying proof-room update 46040219.
it.each(['preparation', 'packet-fit'])('bounds unchanged overdue work after %s refusal', async refusal => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/requested-report-proofroom4-2026-10-17.json', import.meta.url), 'utf8'));
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'astra-wake-')));
  const start = 1792240053608;
  let now = start, refuse = false, attempts = 0, passes = 0;
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:reply-only', configurationDigest: 'sha256:offline', expires: start + 10 * LOOP_REVISIT_MS,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    timeZone: 'UTC', checkOutbound: () => {},
    prepareModel: input => {
      if (refuse && input.id.startsWith('obligation:')) { attempts++; throw Error('prepared envelope exceeds byte allowance'); }
      return input.context;
    },
    model: async input => {
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'A later answer was requested.', memory: [], people: [], commitments: [], closed: [] });
      return conversationSessionAnswer({ state: 'complete', text: input.id.startsWith('obligation:') ? capture.work : capture.answer,
        edge: input.id, child: null, detail: 'recorded replay' }, input.id, shape => { throw Error(shape); });
    }, send: async () => 1 });
  const timers: { ms: number; fire(): void }[] = [];
  let wake: ReturnType<typeof createNextDueWake>;
  const lane = createOrdinaryLane({ elapsed: () => now, peerCurrent: () => true, after: () => wake.refresh() });
  wake = createNextDueWake({ now: () => now, next: () => nextObligationAt(journal.view),
    after: (ms, fire) => { timers.push({ ms, fire }); return () => {}; },
    wake: () => { sentinelCycle(lane, { tick: () => {}, requested: [], drain: async () => {},
      // Exactly the runner's workCycle.after behavior.
      after: async () => { passes++; try { await worker.workObligations(); } catch {} } }, true); } });
  try {
    worker.intake([{ update_id: capture.provenance.sourceUpdate, message: {
      chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: Math.floor(now / 1000), text: capture.request } }]);
    await worker.drain();
    expect(journal.view.commitments).toHaveLength(1);
    now = nextObligationAt(journal.view)!; refuse = refusal === 'preparation';
    // Constructed packet-size neighbour; the worker itself returns false before reserving a call.
    if (refusal === 'packet-fit') journal.view.limits.maxBytes = 1;
    const deadline = nextObligationAt(journal.view);
    wake.refresh();
    for (let i = 0; i < 20 && timers.length > i; i++) {
      now += timers[i]!.ms; timers[i]!.fire(); await lane.settle();
    }
    expect(Object.keys(journal.view.obligationWork)).toHaveLength(0);
    expect(lane.error()).toBeNull();
    expect(passes, 'unchanged refused work must not loop every millisecond').toBe(1);
    expect(attempts).toBe(refusal === 'preparation' ? 1 : 0);
    expect(timers).toHaveLength(1);
    expect(nextObligationAt(journal.view)).toBe(deadline);
    // Ordinary polling can revisit and recover the still-open promise without a fresh timer.
    refuse = false; journal.view.limits.maxBytes = 32768;
    sentinelCycle(lane, { tick: () => {}, requested: [], drain: async () => {},
      after: async () => { await worker.workObligations(); } });
    await lane.settle();
    expect(Object.keys(journal.view.obligationWork)).toHaveLength(1);
    expect(nextObligationAt(journal.view)).not.toBe(deadline);
  } finally { wake.close(); journal.close(); rmSync(root, { recursive: true, force: true }); }
});
