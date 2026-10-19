import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, replyOutcomeOf, REPLY_ACKNOWLEDGEMENT, REFUSED_SEND_NOTICE } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(7);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 20, maxReplies: 20, maxTurns: 20,
  maxBytes: 262144, cursor: 0 };
const notice = 'My answer may not have arrived. Your request and the answer remain in the conversation record. You can ask me for the answer again.';
const update = { update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'hi' } };

it.each(['accepted', 'unknown', 'refused'] as const)('final UNKNOWN sends one loss notice, even when its notice is %s', async noticeOutcome => {
  const root = mkdtempSync(join(tmpdir(), 'send-loss-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), models = 0;
  const sent: string[] = [];
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => { models++; return 'finished answer'; },
    send: async (input: { expectedText: string }) => {
      sent.push(input.expectedText);
      return input.expectedText === notice && noticeOutcome === 'accepted' ? 42
        : { kind: input.expectedText === notice ? noticeOutcome as 'unknown' | 'refused' : 'unknown' as const, reason: 'no receipt' };
    } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([update]); await worker.drain(); await worker.drain();
    expect(sent).toEqual(['finished answer', notice]);
    expect(replyOutcomeOf(journal.view, journal.view.order[0]!).outcome.kind).toBe('unknown');
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(sent).toEqual(['finished answer', notice]); expect(models).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['accepted'] as const)('does not emit a delivery-unknown notice for a %s answer', async kind => {
  const root = mkdtempSync(join(tmpdir(), 'send-known-'));
  const journal = openPreviewJournal(join(root, 'journal'), key, genesis), sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
      model: async () => 'finished answer', send: async input => { sent.push(input.expectedText);
        return 1; } });
    worker.intake([update]); await worker.drain(); expect(sent).toEqual(['finished answer']);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['stop', 'capacity'] as const)('keeps the %s floor before the notice and recovers the eligible notice after reopen', async floor => {
  const root = mkdtempSync(join(tmpdir(), 'send-floor-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, { ...genesis, maxReplies: floor === 'capacity' ? 1 : 20 });
  let finalAttempted = false;
  const sent: string[] = [];
  const ports = { now: () => 1000, stopped: () => floor === 'stop' && finalAttempted,
    checkOutbound: () => {},
    model: async () => 'finished answer', send: async (input: { expectedText: string }) => {
      finalAttempted = true; sent.push(input.expectedText); return { kind: 'unknown' as const, reason: 'lost receipt' }; } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([update]); await worker.drain(); expect(sent).toEqual(['finished answer']);
    journal.close(); journal = openPreviewJournal(path, key);
    const reopened = createJournalWorker(journal, { ...ports, stopped: () => false, groupDisclosure: async () => true,
      send: async input => { sent.push(input.expectedText); return 99; } });
    await reopened.drain(); await reopened.drain();
    expect(sent).toEqual(floor === 'capacity' ? ['finished answer'] : ['finished answer', notice]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('aggregates a burst of ambiguous answers into one signed notice while retaining each answer as UNKNOWN', async () => {
  const root = mkdtempSync(join(tmpdir(), 'send-burst-'));
  const journal = openPreviewJournal(join(root, 'journal'), key, genesis), sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
      model: async () => 'finished answer', send: async input => {
        sent.push(input.expectedText);
        expect(journal.verifyOutbound(input.provenance, { target: input.target!, chat: input.chat, body: input.text })).toBe(true);
        return input.expectedText === notice ? 99 : { kind: 'unknown', reason: 'lost receipt' };
      } });
    worker.intake([update, { ...update, update_id: 2 }]); await worker.drain(); await worker.drain();
    expect(sent).toEqual(['finished answer', 'finished answer', notice]);
    expect(journal.view.order.map(turn => replyOutcomeOf(journal.view, turn).outcome.kind)).toEqual(['unknown', 'unknown']);
    expect(journal.view.order.map(turn => turn.deliveryNotice?.sent)).toEqual([99, 99]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('replays the captured D1c answer after an acknowledgement, then emits the lost-send notice without replacing either receipt', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/deferral-send-failure-2026-10-08.json', import.meta.url), 'utf8'));
  const answer = capture.candidate.replace(/^PREVIEW — /u, '');
  const root = mkdtempSync(join(tmpdir(), 'send-ack-loss-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), now = 1000, timer: (() => void) | undefined;
  let release!: () => void, started!: () => void, acknowledged!: () => void;
  const held = new Promise<void>(done => { release = done; }), began = new Promise<void>(done => { started = done; });
  const ack = new Promise<void>(done => { acknowledged = done; });
  const sent: string[] = [];
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
    acknowledgementTimer: (_ms: number, run: () => void) => { timer = run; return () => {}; },
    model: async () => { started(); await held; return answer; },
    send: async (input: { expectedText: string }) => {
      sent.push(input.expectedText);
      if (input.expectedText === REPLY_ACKNOWLEDGEMENT) { acknowledged(); return 10; }
      return input.expectedText === notice ? 11 : { kind: 'unknown' as const, reason: capture.sendOutcome.reason };
    } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ ...update, update_id: capture.update }]); const draining = worker.drain(); await began;
    now += 10_001; timer!(); await ack; release(); await draining;
    expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT, answer, notice]);
    expect(journal.view.order[0]).toMatchObject({ heldNoticeSent: 10, intent: answer, deliveryNotice: { sent: 11 } });
    expect(journal.view.order[0]?.sent).toBeUndefined();
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain(); expect(sent).toHaveLength(3);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['unknown', 'refused'] as const)('rechecks audience standing before disclosing the %s delivery notice', async kind => {
  const lossNotice = kind === 'refused' ? REFUSED_SEND_NOTICE : notice;
  const { appendGroupCarry } = await import('./group-carry.js');
  const { resolveGroupDisclosure } = await import('./group-disclosure.js');
  const f = await import('./group-carry-fixture.js');
  const root = mkdtempSync(join(tmpdir(), 'send-audience-'));
  const base = { ...genesis, bot: f.scope.bot, operator: f.scope.operator, chat: f.scope.operator, expires: f.now + 86400000 };
  const source = openPreviewJournal(join(root, 'source'), f.key, base);
  const destination = openPreviewJournal(join(root, 'destination'), f.key, { ...base, chat: f.scope.chat, forum: true });
  let allowed = true;
  const sent: string[] = [];
  try {
    const makeUpdate = (forum: boolean) => ({ update_id: 1, message: { message_id: 1,
      chat: { id: Number(forum ? f.scope.chat : f.scope.operator), type: forum ? 'supergroup' : 'private', ...(forum ? { is_forum: true } : {}) },
      from: { id: Number(f.scope.operator) }, text: 'hi' } });
    const first = createJournalWorker(source, { now: () => f.now, stopped: () => false, checkOutbound: () => {}, model: async () => 'saved', send: async () => 1 });
    first.intake([makeUpdate(false)]); await first.drain();
    appendGroupCarry(destination, source, f.scope, resolveGroupDisclosure(f.scope, f.authority(), f.now, f.records, f.sealKey), true, f.now, () => false);
    const worker = createJournalWorker(destination, { now: () => f.now, stopped: () => false,
      groupDisclosure: async () => allowed, checkOutbound: () => {}, model: async () => 'finished answer',
      send: async input => { sent.push(input.expectedText); allowed = false; return { kind, reason: 'lost receipt' }; } });
    worker.intake([makeUpdate(true)]); await worker.drain(); expect(sent).toEqual(['finished answer']);
    allowed = true; await worker.drain(); expect(sent).toEqual(['finished answer', lossNotice]);
    allowed = true; await worker.drain(); expect(sent).toHaveLength(2);
  } finally { source.close(); destination.close(); rmSync(root, { recursive: true, force: true }); }
});
