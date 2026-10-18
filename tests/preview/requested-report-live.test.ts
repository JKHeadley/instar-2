import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS, type ReplyLoop } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/requested-report-proofroom4-2026-10-17.json', import.meta.url), 'utf8')) as {
  provenance: { sourceUpdate: number; workCall: string; hiUpdate: number };
  request: string; answer: string; work: string;
  delivery: { kind: string; text: string; message: number };
};

// Exact model bytes from train-57 room 4. The negative neighbour removes only the source-bound
// delivery declaration; neither a completed report nor its prose can manufacture that authority.
it.each([true, false])('replays the recorded deferred report (delivery request: %s)', async requested => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'requested-report-live-')));
  const path = join(dir, 'journal.encrypted'), key = new Uint8Array(32).fill(61);
  let now = 1792240053608;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:reply-only', configurationDigest: 'sha256:offline', expires: now + 10 * LOOP_REVISIT_MS,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
  const answer = JSON.parse(capture.answer) as { reply: string; openLoops: ReplyLoop[] };
  if (!requested) for (const loop of answer.openLoops) delete loop.deliveryRequest;
  const sends: string[] = [], workCalls: string[] = [];
  const worker = () => createJournalWorker(journal, {
    now: () => now, stopped: () => false, timeZone: 'UTC', checkOutbound: () => {},
    model: async input => {
      // Stand-in for unrelated memory reconciliation in this isolated conversation.
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator requested a later answer.',
        memory: [], people: [], commitments: [], closed: [] });
      const read = (text: string) => conversationSessionAnswer({ state: 'complete', text, edge: input.id,
        child: null, detail: 'isolated replay of recorded output' }, input.id,
        shape => { throw Error(`recorded output refused: ${shape}`); });
      if (input.id.startsWith('obligation:')) { workCalls.push(input.id); return read(capture.work); }
      if (input.id.endsWith(String(capture.provenance.hiUpdate))) return JSON.stringify({ reply: "Hey Justin! I'm here — what can I help with?" });
      return read(requested ? capture.answer : JSON.stringify(answer));
    },
    send: async input => { sends.push(input.expectedText); return sends.length; },
  });
  const inbound = (update: number, text: string) => ({ update_id: update, message: {
    chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(now / 1000),
  } });
  try {
    let w = worker();
    w.intake([inbound(capture.provenance.sourceUpdate, capture.request)]); await w.drain();
    expect(sends).toEqual([answer.reply]);
    now += LOOP_REVISIT_MS;
    await w.workObligations();
    const report = (JSON.parse(capture.work) as { report: string }).report;
    expect(journal.view.obligationWork['commitment:0']).toMatchObject({ outcome: 'report', report: { text: report } });
    expect(loopHealth(journal.view, now).awaitingDelivery).toBe(1);
    journal.close(); journal = openPreviewJournal(path, key); w = worker();
    await w.sendRequested(); await w.sendRequested();
    if (requested) {
      expect(capture.delivery).toMatchObject({ kind: 'intent', message: 1612 });
      expect(sends).toEqual([answer.reply, capture.delivery.text]);
      expect(journal.view.order.find(turn => turn.requestedAction?.owed)?.requestedAction?.owed)
        .toEqual([{ key: 'commitment:0', slot: journal.view.obligationWork['commitment:0']!.lastSlot }]);
      expect(journal.view.closed.has(0)).toBe(true);
    } else {
      expect(sends).toEqual([answer.reply]);
      expect(journal.view.order.some(turn => turn.requestedAction?.owed)).toBe(false);
      expect(journal.view.closed.has(0)).toBe(false);
      expect(loopHealth(journal.view, now)).toMatchObject({ awaitingDelivery: 1,
        deliveryInhibition: 'no grant for unsolicited sends; 1 finished result waits for your next message' });
      w.intake([inbound(capture.provenance.hiUpdate, 'hi')]); await w.drain();
      expect(sends).toHaveLength(2); expect(sends[1]).toContain(report);
      expect(journal.view.closed.has(0)).toBe(true);
    }
    expect(loopHealth(journal.view, now).awaitingDelivery).toBe(0);
    journal.close(); journal = openPreviewJournal(path, key); w = worker();
    await w.sendRequested(); await w.workObligations();
    expect(sends).toHaveLength(2); expect(workCalls).toHaveLength(1);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});
