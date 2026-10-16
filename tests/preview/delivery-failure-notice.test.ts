import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, replyOutcomeOf } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(7);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 20, maxReplies: 20, maxTurns: 20,
  maxBytes: 262144, cursor: 0 };
const notice = 'I could not send my complete answer. Your request and the answer remain in the conversation record. You can ask me for the answer again.';
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'hi' } });

it.each(['refused', 'not-sent'] as const)('retains the recorded answer and reports %s once, without replay after restart', async kind => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/deferral-send-failure-2026-10-08.json', import.meta.url), 'utf8'));
  const answer = capture.candidate.replace(/^PREVIEW — /u, '');
  const root = mkdtempSync(join(tmpdir(), 'delivery-fail-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), models = 0;
  const sent: string[] = [];
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => { models++; return answer; }, send: async (input: { expectedText: string }) => {
      sent.push(input.expectedText); return input.expectedText === notice ? 42 : { kind, reason: 'definite non-delivery' };
    } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(capture.update)]); await worker.drain(); await worker.drain();
    expect(sent).toEqual([...Array(kind === 'not-sent' ? 2 : 1).fill(answer), notice]);
    expect(journal.view.order[0]).toMatchObject({ intent: answer, deliveryNotice: { text: notice, sent: 42 } });
    expect(replyOutcomeOf(journal.view, journal.view.order[0]!).outcome.kind).toBe('refused');
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(sent).toHaveLength(kind === 'not-sent' ? 3 : 2); expect(models).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['accepted', 'unknown', 'refused', 'not-sent'] as const)('aggregates refused answers and never recursively reports a %s notice', async outcome => {
  const root = mkdtempSync(join(tmpdir(), 'delivery-burst-'));
  const journal = openPreviewJournal(join(root, 'journal'), key, genesis), sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
      model: async () => 'answer', send: async input => {
        sent.push(input.expectedText);
        if (input.expectedText !== notice) return { kind: 'refused', reason: 'definite non-delivery' };
        return outcome === 'accepted' ? 42 : { kind: outcome, reason: 'notice failed' };
      } });
    worker.intake([update(1), update(2)]); await worker.drain(); await worker.drain();
    expect(sent).toEqual(['answer', 'answer', ...Array(outcome === 'not-sent' ? 2 : 1).fill(notice)]);
    expect(journal.view.order.map(turn => replyOutcomeOf(journal.view, turn).outcome.kind)).toEqual(['refused', 'refused']);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['stop', 'expiry', 'capacity'] as const)('retains a refused answer behind the %s floor and recovers only when admitted', async floor => {
  const root = mkdtempSync(join(tmpdir(), 'delivery-floor-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, { ...genesis, maxReplies: floor === 'capacity' ? 1 : 20 });
  let attempted = false;
  const sent: string[] = [];
  const ports = { now: () => floor === 'expiry' && attempted ? genesis.expires : 1000,
    stopped: () => floor === 'stop' && attempted,
    checkOutbound: () => {}, model: async () => 'answer', send: async (input: { expectedText: string }) => {
      attempted = true; sent.push(input.expectedText); return { kind: 'refused' as const, reason: 'known failure' };
    } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1)]); await worker.drain(); expect(sent).toEqual(['answer']);
    expect(journal.view.order[0]?.intent).toBe('answer');
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, { ...ports, stopped: () => false, groupDisclosure: async () => true,
      send: async input => { sent.push(input.expectedText); return 42; } }).drain();
    expect(sent).toEqual(floor === 'capacity' || floor === 'expiry' ? ['answer'] : ['answer', notice]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('coalesces mixed unknown and refused answers without claiming certainty or repeating either answer', async () => {
  const root = mkdtempSync(join(tmpdir(), 'delivery-mixed-'));
  const journal = openPreviewJournal(join(root, 'journal'), key, genesis), sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
      model: async () => 'answer', send: async input => {
        sent.push(input.expectedText);
        return input.target?.startsWith('delivery-notice:') ? 42
          : { kind: input.update === 1 ? 'refused' : 'unknown', reason: 'transport outcome' };
      } });
    worker.intake([update(1), update(2)]); await worker.drain(); await worker.drain();
    expect(sent).toHaveLength(3); expect(sent[2]).toContain('may not have arrived');
    expect(journal.view.order.map(turn => replyOutcomeOf(journal.view, turn).outcome.kind)).toEqual(['refused', 'unknown']);
    expect(journal.view.order.map(turn => turn.deliveryNotice?.sent)).toEqual([42, 42]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
