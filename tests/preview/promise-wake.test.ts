import { expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNextDueWake } from '../../src/transport/next-due.js';
import { obligationSchedule, nextObligationAt, createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal-test-worker.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/requested-report-proofroom4-2026-10-17.json', import.meta.url), 'utf8'));
it('replays update 46040219 across restart and wakes/delivers without another inbound or poll tick', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'promise-wake-'))), path = join(root, 'journal');
  const key = new Uint8Array(32).fill(61), start = 1792240053608;
  let now = start, sends: string[] = [], work = 0;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:reply-only', configurationDigest: 'sha256:offline', expires: start + 10 * LOOP_REVISIT_MS,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
  const ports = { now: () => now, stopped: () => false, timeZone: 'UTC', checkOutbound: () => {}, model: async (input: { id: string }) => {
    if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'A later answer was requested.', memory: [], people: [], commitments: [], closed: [] });
    if (input.id.startsWith('obligation:')) work++;
    return conversationSessionAnswer({ state: 'complete', text: input.id.startsWith('obligation:') ? capture.work : capture.answer,
      edge: input.id, child: null, detail: 'recorded replay' }, input.id, shape => { throw Error(shape); });
  }, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  let worker = createJournalWorker(journal, ports);
  let due: { at: number; fire(): void } | null = null, pending = Promise.resolve();
  const wake = createNextDueWake({ now: () => now, next: () => nextObligationAt(journal.view),
    after: (ms, fire) => { due = { at: now + ms, fire }; return () => { due = null; }; },
    wake: () => { pending = worker.workObligations().then(() => undefined); } });
  try {
    worker.intake([{ update_id: capture.provenance.sourceUpdate, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, date: Math.floor(now / 1000), text: capture.request } }]);
    await worker.drain();
    expect(sends, JSON.stringify(journal.view.order.map(t => ({id:t.id, held:t.held, answer:t.answer, accepted:t.accepted, intent:t.intent})))).toEqual([JSON.parse(capture.answer).reply]);
    expect(journal.view.commitments).toHaveLength(1);
    // Constructed timing neighbour of the recorded declaration: a resolved instant with seconds.
    const note = journal.view.commitments[0]!;
    const original = { ...note };
    note.waitsOn = 'date';
    note.agentPromise = { quote: note.quote, action: 'promised', owner: 'agent', waitsOn: 'next-relevant-reply',
      due: { source: note.source, quote: note.quote, when: 'later', zone: 'UTC', day: '2026-10-17', time: '12:27',
        resolution: { at: start, instant: new Date(start + 12345).toISOString() } } };
    expect(obligationSchedule(journal.view)[0]?.slot).toBe(start + 12345);
    Object.assign(note, original); delete note.agentPromise;
    const deadline = nextObligationAt(journal.view)!;
    expect(Number.isSafeInteger(deadline)).toBe(true);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    wake.refresh();
    expect(due!.at).toBe(Math.max(now + 1, deadline));
    now = deadline - 1; expect(await worker.workObligations()).toBe(false);
    now = Math.max(start + 1, deadline); due!.fire(); await pending;
    expect(work).toBe(1);
    // The host must still pass its successful-empty-poll withdrawal check before delivery.
    await worker.sendRequested();
    expect(sends).toEqual([JSON.parse(capture.answer).reply, capture.delivery.text]);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    wake.refresh(); expect(due).toBeNull();
    await worker.sendRequested(); expect(work).toBe(1); expect(sends).toHaveLength(2);
  } finally { wake.close(); journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('replaces one timer, rejects stale callbacks, rereads closures and stops without a busy retry loop', () => {
  let now = 100, next: number | null = 200;
  const timers: { ms: number; fire(): void; cancel: ReturnType<typeof vi.fn> }[] = [];
  const run = vi.fn();
  const wake = createNextDueWake({ now: () => now, next: () => next, wake: run,
    after: (ms, fire) => { const cancel = vi.fn(); timers.push({ ms, fire, cancel }); return cancel; } });
  wake.refresh(); wake.refresh(); expect(timers).toHaveLength(1);
  next = 150; wake.refresh(); expect(timers[0]!.cancel).toHaveBeenCalledOnce();
  now = 200; timers[0]!.fire(); expect(run).not.toHaveBeenCalled();
  next = null; timers[1]!.fire(); expect(run).not.toHaveBeenCalled();
  next = 201; wake.refresh(); now = 201; timers.at(-1)!.fire();
  expect(run).toHaveBeenCalledOnce(); expect(timers).toHaveLength(3);
  wake.close(); next = 202; wake.refresh(); expect(timers).toHaveLength(3);
});

it('rearms an early clock wake and caps native timer delay without firing distant work early', () => {
  let now = 0, next = 3_000_000_000;
  const timers: { ms: number; fire(): void }[] = [], run = vi.fn();
  const wake = createNextDueWake({ now: () => now, next: () => next, wake: run,
    after: (ms, fire) => { timers.push({ ms, fire }); return () => {}; } });
  wake.refresh(); expect(timers[0]!.ms).toBe(2_147_483_647);
  now = 2_147_483_647; timers[0]!.fire(); expect(run).not.toHaveBeenCalled();
  expect(timers[1]!.ms).toBe(next - now);
  now = next - 1; timers[1]!.fire(); expect(run).not.toHaveBeenCalled();
  now = next; timers[2]!.fire(); expect(run).toHaveBeenCalledOnce();
  wake.close();
});

it('coalesces a due wake behind busy work and still obeys owner/peer admission', async () => {
  const { createOrdinaryLane } = await import('./live-sentinels.js');
  let release!: () => void, current = true, calls = 0, next: number | null = 100;
  let fire = () => {};
  const lane = createOrdinaryLane({ elapsed: () => 100, peerCurrent: () => current, after: () => {} });
  lane.submit(() => new Promise<void>(done => { release = done; }));
  const wake = createNextDueWake({ now: () => 100, next: () => next,
    after: (_ms, callback) => { fire = callback; return () => {}; },
    wake: () => { lane.submit(async () => { calls++; next = null; }, true); } });
  wake.refresh(); fire(); expect(calls).toBe(0);
  release(); await lane.settle(); expect(calls).toBe(1);
  current = false; next = 100; wake.refresh(); fire(); await lane.settle(); expect(calls).toBe(1);
  current = true; wake.refresh(); fire(); await lane.settle(); expect(calls).toBe(2);
  wake.close();
});
