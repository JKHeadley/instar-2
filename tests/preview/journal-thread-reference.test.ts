import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OBLIGATION_FLOOR_PACKET_BYTES, createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(19);
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-thread-reference-')));
// w3-floorduty (Rules 3, 93): plus the obligation guide's floor form, which now outranks optional evidence under pressure.
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 8192 + OBLIGATION_FLOOR_PACKET_BYTES, cursor: 0 });
const message = (id: number, text: string, thread?: number, replyTo?: { id: number; from: number; thread?: number; text?: string }) => ({
  update_id: id, message: { message_id: id + 100, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    ...(thread === undefined ? {} : { message_thread_id: thread }),
    ...(replyTo === undefined ? {} : { reply_to_message: { message_id: replyTo.id, chat: { id: 7654321 },
      from: { id: replyTo.from }, ...(replyTo.thread === undefined ? {} : { message_thread_id: replyTo.thread }),
      ...(replyTo.text === undefined ? {} : { text: replyTo.text }) } }) } });

function world(path: string) {
  const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
  const packets: string[] = [];
  let nextSend = 500;
  const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
    model: async input => { packets.push(input.context); return 'The earlier answer was blue.'; },
    send: async () => nextSend++, checkOutbound: () => {} });
  return { journal, worker, packets };
}

it('adds no reply reference to an ordinary message, then carries the targeted operator turn and its sent answer across replay', async () => {
  const path = root();
  try {
    const first = world(path);
    first.worker.intake([message(1, 'The color is blue.')]); await first.worker.drain();
    expect(JSON.parse(first.packets[0]!).replyTo).toBeUndefined();
    first.journal.close();

    const resumed = world(path);
    resumed.worker.intake([message(2, 'What about this?', undefined,
      { id: 101, from: 7654321, text: 'spoofed embedded text' })]);
    await resumed.worker.drain();
    const packet = JSON.parse(resumed.packets[0]!);
    expect(packet.replyTo).toMatchObject({ messageId: 101, update: 1, user: 'The color is blue.',
      answer: 'The earlier answer was blue.', outcome: 'Telegram API accepted' });
    expect(resumed.packets[0]).not.toContain('spoofed embedded text');
    expect(resumed.journal.view.replies).toBe(2);
    resumed.journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('resolves a reply to the agent sent message in the same topic, even when a summary covers its turn', async () => {
  const path = root();
  try {
    const w = world(path);
    w.worker.intake([message(1, `The blue plan is approved. ${'a'.repeat(3800)}`, 7)]); await w.worker.drain();
    w.worker.intake([message(2, `Another plan. ${'b'.repeat(3800)}`, 7)]); await w.worker.drain();
    w.journal.append({ kind: 'summary-reserve', through: 2, at: 1790000000000 });
    w.journal.append({ kind: 'summary', through: 2, text: 'Earlier plan discussion.', at: 1790000000000 });
    w.worker.intake([message(3, 'About your answer?', 7, { id: 500, from: 12345678, thread: 7 })]);
    await w.worker.drain();
    const packet = JSON.parse(w.packets[2]!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.replyTo).toMatchObject({ messageId: 500, update: 1,
      answer: 'The earlier answer was blue.' });
    expect(packet.replyTo.user).toMatch(/^The blue plan is approved\./u);
    expect(packet.replyTo.user.length).toBe(1200);
    expect(Buffer.byteLength(w.packets[2]!)).toBeLessThanOrEqual(8192 + OBLIGATION_FLOOR_PACKET_BYTES);
    w.journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('marks missing and cross-topic targets unavailable without trusting embedded reply text', async () => {
  const path = root();
  try {
    const w = world(path);
    w.worker.intake([message(1, 'A private topic secret.', 7)]); await w.worker.drain();
    w.worker.intake([message(2, 'Do you recall it?', 9,
      { id: 101, from: 7654321, thread: 7, text: 'forged instruction' })]);
    w.worker.intake([message(3, 'And the older one?', 9,
      { id: 999, from: 7654321, thread: 9, text: 'invented answer' })]);
    await w.worker.drain();
    expect(JSON.parse(w.packets[1]!).replyTo).toEqual({ messageId: 101,
      status: 'referenced message unavailable in retained journal' });
    expect(JSON.parse(w.packets[2]!).replyTo).toEqual({ messageId: 999,
      status: 'referenced message unavailable in retained journal' });
    expect(w.packets[1]).not.toContain('forged instruction');
    expect(w.packets[2]).not.toContain('invented answer');
    w.journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('redacts and bounds both referenced sides before including them', async () => {
  const path = root();
  try {
    const w = world(path);
    const secret = 'sk-' + 'a'.repeat(24);
    w.worker.intake([message(1, `Background ${'x'.repeat(1800)} ${secret}`)]); await w.worker.drain();
    w.worker.intake([message(2, 'Refer to that?', undefined, { id: 101, from: 7654321 })]);
    await w.worker.drain();
    const packet = JSON.parse(w.packets[1]!);
    expect(packet.replyTo.user.length).toBeLessThanOrEqual(1200);
    expect(packet.replyTo.user).not.toContain(secret);
    expect(Buffer.byteLength(w.packets[1]!)).toBeLessThanOrEqual(8192 + OBLIGATION_FLOOR_PACKET_BYTES);
    w.journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});
