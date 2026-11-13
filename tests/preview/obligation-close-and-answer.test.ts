/** Recorded shapes supplied by the 2026-11-12 brief (16:46 owed question; 17:26/message 830).
 * Declarations and scheduling times are constructed, not private live journal bytes. */
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, reconcileDeliveredCommitments, LOOP_REVISIT_MS } from './journal-test-worker.js';
import { loopHealth, workRecords } from './obligations.js';

const key = new Uint8Array(32).fill(73), start = 1794528000000;
function world(mode: 'delivered' | 'unknown' | 'withdraw' | 'inventory' | 'invented-withdrawal') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'obligation-close-'))), path = join(root, 'journal');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 65536, cursor: 0 });
  let now = start, next = 1;
  const packets: { workRecords: ReturnType<typeof workRecords>; workRecordsGuide: string }[] = [], sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, prepareModel: input => input.context,
    model: async ({ id, question, context }) => {
      if (id.startsWith('obligation:')) return JSON.stringify({ outcome: 'report', report: 'The requested comparison is complete.' });
      if (question.startsWith('Please compare')) {
        const reply = `I will compare item ${next++}.`;
        return JSON.stringify({ reply, openLoops: [{ kind: 'promise', quote: reply, waitsOn: 'nothing' }] });
      }
      const packet = JSON.parse(context) as typeof packets[number]; packets.push(packet);
      if (question === 'Never mind the comparison.') return JSON.stringify({ reply: 'I have withdrawn it.',
        cancelDeliveries: [{ id: 0, quote: mode === 'invented-withdrawal' ? 'Cancel everything forever.' : question }] });
      // Deterministic consumer proves the real packet supplies the answer's facts; no live-model claim.
      return JSON.stringify({ ...(mode === 'delivered' || mode === 'unknown' ? { selectedReports: ['commitment:0'] } : {}), reply: packet.workRecords
        ? `${packet.workRecords.scheduled} scheduled; ${packet.workRecords.awaitingDelivery} awaiting delivery; ${packet.workRecords.deliveryUnknown} delivery unknown; ${packet.workRecords.open} open and unverified.`
        : 'Nothing scheduled.' });
    }, send: async ({ text }) => { if (mode === 'unknown' && now > start) return null; sent.push(text); return sent.length; }, checkOutbound: () => {} });
  let update = 100;
  return { root, path, journal, worker, packets, sent, tick: () => { now += LOOP_REVISIT_MS + 1000; }, now: () => now,
    say: async (text: string) => { worker.intake([{ update_id: update++, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text, date: Math.floor(now / 1000) } }]); await worker.drain(); },
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

for (const mode of ['delivered', 'unknown'] as const) it(`${mode} result keeps receipt-backed closure and honest owed records on replay`, async () => {
  const w = world(mode);
  try {
    await w.say('Please compare the options.'); w.tick();
    expect(await w.worker.workObligations()).toBe(true);
    await w.say('What do you still owe me?');
    expect(w.packets.at(-1)!.workRecords.awaitingDelivery).toBe(1);
    expect(w.journal.view.closed.has(0)).toBe(mode === 'delivered');
    const report = w.journal.view.obligationWork['commitment:0']!.report!;
    expect(report.boundTo).toBeDefined();
    if (mode === 'delivered') {
      expect(w.journal.view.closed.get(0)!.source).toBe(report.delivered);
      expect(w.journal.view.turns.get(report.delivered!)!.sent).toBeDefined();
      await w.say('Is anything waiting to be delivered?');
      expect(w.packets.at(-1)!.workRecords.items).toEqual([]);
    } else {
      const records = workRecords(w.journal.view, w.now(), text => text);
      expect(records.deliveryUnknown).toBe(1);
      expect(records.items[0]).toMatchObject({ state: 'delivery-unknown', unverified: true });
      await w.say('Is anything waiting to be delivered?');
      expect(w.packets.at(-1)!.workRecords.deliveryUnknown).toBe(1);
      expect(w.journal.view.order.at(-1)!.answer).toContain('1 delivery unknown');
      expect(reconcileDeliveredCommitments(w.journal, w.now())).toEqual({ examined: 1, closed: 0 });
      expect(() => w.journal.append({ kind: 'commitment-closed', closure: { id: 0, source: report.boundTo!, quote: report.text }, receipt: 999, at: w.now() })).toThrow('lacks delivery evidence');
    }
    const replay = openPreviewJournal(w.path, key);
    try { expect(replay.view.closed).toEqual(w.journal.view.closed);
      expect(replay.view.obligationWork).toEqual(w.journal.view.obligationWork); } finally { replay.close(); }
  } finally { w.close(); }
});

it('withdraws an ordinary reply promise with the verified operator turn, without a deliveryRequest', async () => {
  const w = world('withdraw');
  try {
    await w.say('Please compare the options.');
    expect(w.journal.view.commitments[0]!.deliveryRequest).toBeUndefined();
    await w.say('Never mind the comparison.');
    expect(w.journal.view.closed.get(0)).toMatchObject({ id: 0, quote: 'Never mind the comparison.', source: w.journal.view.order[1]!.id });
    const replay = openPreviewJournal(w.path, key);
    try { expect(replay.view.closed).toEqual(w.journal.view.closed); } finally { replay.close(); }
  } finally { w.close(); }
});

it('puts ten scheduled items and one awaiting delivery into the real answer packet, soonest first', async () => {
  const w = world('inventory');
  try {
    await w.say('Please compare the first options.'); w.tick();
    expect(await w.worker.workObligations()).toBe(true);
    for (let i = 0; i < 10; i++) await w.say(`Please compare scheduled options ${i}.`);
    expect(loopHealth(w.journal.view, w.now())).toMatchObject({ scheduledWork: 10, awaitingDelivery: 1 });
    await w.say('Besides this chat, what else are you working on or have scheduled right now?');
    const packet = w.packets.at(-1)!;
    expect(packet.workRecords).toMatchObject({ scheduled: 10, awaitingDelivery: 1, omitted: 0 });
    expect(packet.workRecords.items).toHaveLength(11);
    expect(packet.workRecordsGuide).toContain('answer from workRecords first');
    expect(w.sent.at(-1)).toContain('10 scheduled; 1 awaiting delivery');
    expect(w.sent.at(-1)).not.toContain('Nothing scheduled');
    const times = packet.workRecords.items.map(item => item.nextAt ?? Infinity);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  } finally { w.close(); }
});

it('bounds the inventory and counts omissions without treating them as absence', async () => {
  const w = world('inventory');
  try {
    for (let i = 0; i < 24; i++) await w.say(`Please compare options ${i}.`);
    const packet = workRecords(w.journal.view, w.now(), text => text);
    expect(packet.open).toBe(24); expect(packet.items.length).toBeLessThanOrEqual(20);
    expect(packet.omitted).toBe(24 - packet.items.length);
    expect(Buffer.byteLength(JSON.stringify(packet.items))).toBeLessThanOrEqual(6000);
  } finally { w.close(); }
});

it('refuses a model-invented withdrawal and a reconcile without recorded delivery', async () => {
  const w = world('invented-withdrawal');
  try {
    await w.say('Please compare the options.'); await w.say('Never mind the comparison.');
    expect(w.journal.view.closed.has(0)).toBe(false);
    expect(reconcileDeliveredCommitments(w.journal, w.now())).toEqual({ examined: 1, closed: 0 });
  } finally { w.close(); }
});
