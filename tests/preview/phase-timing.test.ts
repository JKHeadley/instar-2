import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, UNKNOWN_SEND_NOTICE, REFUSED_SEND_NOTICE, type PreviewPorts } from './journal-test-worker.js';
import { checkPhaseTiming, recordPhaseTiming } from './phase-timing.js';
import { createGroupAudienceCache } from './group-disclosure.js';
import { membership, scope } from './group-carry-fixture.js';

const at = 1790000000000, key = new Uint8Array(32).fill(71);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 86400000,
  maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 };
const raw = { update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: 'What is six times seven?', date: at / 1000 } };
afterEach(() => vi.useRealTimers());

it.each([{ late: 0, audience: 5700 }, { late: 5700, audience: 0 }])(
  'distinguishes a callback $late ms late from $audience ms in audience admission', async ({ late, audience }) => {
    vi.useFakeTimers(); vi.setSystemTime(at);
    const root = mkdtempSync(join(tmpdir(), 'phase-timing-')), path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis);
    const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
    const sent: string[] = [];
    const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, checkOutbound: () => {},
      acknowledgementTimer: (ms, callback) => { const handle = setTimeout(callback, ms + late); return () => clearTimeout(handle); },
      model: async () => { await wait(30000); return '42'; }, sendAdmits: true,
      send: async input => {
        if (audience) await wait(audience);
        input.observeSendPhase?.('audienceAdmittedAt'); input.admit?.();
        input.observeSendPhase?.('transportBegunAt'); await wait(800);
        input.observeSendPhase?.('transportReturnedAt'); sent.push(input.expectedText); return sent.length;
      } };
    try {
      const worker = createJournalWorker(journal, ports); worker.intake([raw]); const draining = worker.drain();
      await vi.advanceTimersByTimeAsync(50000); await draining;
      expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT, '42']);
      const rows = journal.view.phaseTimings!;
      expect(rows.find(r => r.phase === 'acknowledgement')?.measurements).toEqual({
        scheduledDueAt: at + 7000, callbackEnteredAt: at + 7000 + late, timerCallback: true });
      const ack = rows.find(r => r.phase === 'send' && r.id.startsWith('held-notice:'))!;
      expect(ack.measurements).toMatchObject({ sendEnteredAt: at + 7000 + late,
        audienceAdmittedAt: at + 12700, transportBegunAt: at + 12700, transportReturnedAt: at + 13500,
        attempt: 1, provedNotSentAttempts: 0 });
      expect(rows.find(r => r.phase === 'send' && r.id.startsWith('reply:'))?.measurements).toMatchObject({
        audienceAdmittedAt: at + 30000 + audience, transportBegunAt: at + 30000 + audience,
        transportReturnedAt: at + 30800 + audience });
      journal.compact();
      journal.close(); const replay = openPreviewJournal(path, key);
      try { expect(replay.view.phaseTimings).toEqual(rows); } finally { replay.close(); }
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

it.each(['unknown', 'not-sent'] as const)('records %s without widening the send retry rule', async kind => {
  const root = mkdtempSync(join(tmpdir(), 'phase-outcome-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const sent: { target: string | undefined; text: string }[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => at, stopped: () => false, checkOutbound: () => {},
      model: async () => '42', send: async input => {
        sent.push({ target: input.target, text: input.expectedText });
        return { kind, reason: 'injected outcome' };
      } });
    worker.intake([raw]); await worker.drain(); await worker.drain();
    const turn = journal.view.order[0]!;
    const answer = { target: `reply:${turn.id}`, text: '42' };
    const notice = { target: `delivery-notice:${turn.id}`,
      text: kind === 'unknown' ? UNKNOWN_SEND_NOTICE : REFUSED_SEND_NOTICE };
    expect(sent).toEqual(kind === 'unknown' ? [answer, notice] : [answer, answer, notice, notice]);
    const rows = journal.view.phaseTimings!.filter(row => row.phase === 'send');
    expect(rows.map(row => ({ target: row.id, attempt: row.measurements.attempt,
      provedNotSentAttempts: row.measurements.provedNotSentAttempts }))).toEqual(kind === 'unknown'
      ? [{ target: answer.target, attempt: 1, provedNotSentAttempts: 0 },
        { target: notice.target, attempt: 1, provedNotSentAttempts: 0 }]
      : [{ target: answer.target, attempt: 1, provedNotSentAttempts: 1 },
        { target: answer.target, attempt: 2, provedNotSentAttempts: 2 },
        { target: notice.target, attempt: 1, provedNotSentAttempts: 1 },
        { target: notice.target, attempt: 2, provedNotSentAttempts: 2 }]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('observes cache hits and misses without changing expiry or the verdict', async () => {
  let now = 0;
  const hits: boolean[] = [], read = membership();
  const cache = createGroupAudienceCache(() => now, () => async (method, body) => { now += 100; return read(method, body); });
  expect(await cache.verify(scope, hit => hits.push(hit))).toBe(true); expect(now).toBe(600);
  expect(await cache.verify(scope, hit => hits.push(hit))).toBe(true); expect(now).toBe(600);
  now = 10000;
  expect(await cache.verify(scope, hit => hits.push(hit))).toBe(true);
  expect(hits).toEqual([false, true, false]);
  expect(await cache.verify(scope, () => { throw Error('diagnostics unavailable'); })).toBe(true);
});

it('rejects prose or unknown measurement fields and isolates a diagnostics write failure', () => {
  const row = { kind: 'phase-timing' as const, id: 'turn:1', phase: 'auth' as const, at,
    measurements: { elapsedMs: 4 }, forward: { generation: 4 as const, additive: true as const } };
  expect(() => checkPhaseTiming(row)).not.toThrow();
  expect(() => checkPhaseTiming({ ...row, measurements: { output: 4 } })).toThrow('invalid phase timing');
  expect(() => recordPhaseTiming(() => { throw Error('disk unavailable'); }, 'turn:1', 'auth', { elapsedMs: 4 }, at)).not.toThrow();
});
