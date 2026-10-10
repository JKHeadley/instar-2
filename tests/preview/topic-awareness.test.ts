import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/topic-awareness-live-2026-10-10.json', import.meta.url), 'utf8')) as {
  genesis: Extract<JournalRecord, { kind: 'genesis' }>; rows: JournalRecord[];
  question: { update_id: number; message: { text: string; message_thread_id?: number; chat: { id: number; type: string; is_forum?: boolean } } };
  failedAnswer: string;
  modelReplay: { cases: { question: string; model: string; output: string }[] };
};
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const key = new Uint8Array(32).fill(81);
const now = 1791648000000;
function seed(privateChat = false) {
  const root = mkdtempSync(join(tmpdir(), 'topic-awareness-')); roots.push(root);
  const genesis = { ...capture.genesis };
  if (privateChat) { delete genesis.forum; genesis.chat = genesis.operator; }
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  for (const original of capture.rows) {
    const row = structuredClone(original);
    if (privateChat && row.kind === 'intake') {
      const raw = JSON.parse(row.raw);
      raw.message.chat = { id: Number(genesis.operator), type: 'private' };
      delete raw.message.message_thread_id; delete raw.message.is_topic_message;
      row.raw = JSON.stringify(raw); delete row.thread;
    }
    if (privateChat && row.kind === 'intent') { row.chat = genesis.chat; delete row.thread; }
    journal.append(row);
  }
  return journal;
}
async function packet(journal: ReturnType<typeof seed>, thread?: number, privateChat = false, replay?: { question: string; output: string }) {
  let context = '';
  const sent: { thread?: number; text: string }[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => { context = input.context; return replay?.output ?? 'Noted.'; },
    send: async input => { sent.push(input); return 50; }, checkOutbound: () => {} });
  const question = structuredClone(capture.question);
  if (replay) question.message.text = replay.question;
  if (thread !== undefined) question.message.message_thread_id = thread;
  if (privateChat) question.message.chat = { id: Number(journal.view.genesis.operator), type: 'private' };
  worker.intake([question]); await worker.drain();
  return { context, value: JSON.parse(context), sent, worker };
}

it.each([undefined, 1, 3, 8])('replays CEDAR with current topic %s separate from its shared source and recent history', async thread => {
  const journal = seed();
  try {
    const { value, sent } = await packet(journal, thread);
    const current = thread === undefined || thread === 1 ? 'General' : `topic ${thread}`;
    expect(value.audience.conversation).toBe(current);
    expect(value.datedPending.find((item: { update: number }) => item.update === 969390331)).toMatchObject({
      conversation: 'topic 3', sourceLabel: expect.stringContaining('/topic 3/'), message: expect.stringContaining('CEDAR') });
    expect(value.memoryCandidates.find((item: { id: string }) => item.id.endsWith('969390331'))).toMatchObject({
      conversation: 'topic 3', sourceLabel: expect.stringContaining('/topic 3/') });
    expect(value.capability).toContain('audience.conversation is the topic of the current message');
    expect(value.capability).toContain('say where you learned them');
    expect(value.history.map((item: { id: string }) => item.id)).toEqual(thread === 3
      ? ['telegram:8820318295:update:969390331'] : thread === 8 ? [] : ['telegram:8820318295:update:969390330']);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.thread).toBe(thread === 1 ? undefined : thread);
    // Re-delivery never repeats the recorded source replies or this reply.
    expect(journal.view.order.filter(turn => turn.sent !== undefined)).toHaveLength(3);
  } finally { journal.close(); }
});

it.each([3, 1])('uses the recorded topic name for topic %s and the matching source labels', async topic => {
  const journal = seed();
  try {
    // Telegram service updates are captured even though they have no accepted text.
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'Noted.', send: async () => 50, checkOutbound: () => {} });
    const service = { update_id: 969390332, message: { message_thread_id: topic,
      chat: { id: Number(capture.genesis.chat), type: 'supergroup', is_forum: true },
      forum_topic_edited: { name: 'Garden' } } };
    worker.intake([service]);
    const question = capture.question.update_id; capture.question.update_id++;
    try {
      const { value } = await packet(journal, topic);
      expect(value.audience.conversation).toBe('the "Garden" topic');
      const source = value.datedPending.find((item: { update: number }) => item.update === (topic === 3 ? 969390331 : 969390330));
      expect(source.conversation).toBe('the "Garden" topic');
      expect(source.sourceLabel).toContain('/the "Garden" topic/');
    } finally { capture.question.update_id = question; }
  } finally { journal.close(); }
});

it('labels resolved dates, recalled turns and preference candidates with their original forum topic', async () => {
  const journal = seed();
  try {
    const source = journal.view.order[1]!;
    // Projection neighbors: recorded-shape replay above covers the durable path.
    journal.view.dated.push({ source: source.id, quote: source.text, when: 'tomorrow', day: '2026-10-11', zone: 'UTC' });
    journal.view.memory.push({ mode: 'prefer', source: source.id, trigger: source.id, quote: source.text });
    journal.view.summaries.push({ kind: 'summary', through: source.update, text: 'A word was set.', at: now });
    const { value, worker } = await packet(journal);
    const recalled = JSON.parse((worker.probe('What did I say on 2026-10-10?') as { context: string }).context);
    expect(value.dated[0]).toMatchObject({ conversation: 'topic 3', sourceLabel: expect.stringContaining('/topic 3/') });
    expect(recalled.recalled).toContainEqual(expect.objectContaining({ id: source.id, conversation: 'topic 3', sourceLabel: expect.stringContaining('/topic 3/') }));
    expect(value.memoryCandidates).toContainEqual(expect.objectContaining({ id: source.id, conversation: 'topic 3', sourceLabel: expect.stringContaining('/topic 3/') }));
  } finally { journal.close(); }
});

it('keeps the private-chat packet byte-identical to afa6be39 for the same recorded turns', async () => {
  const journal = seed(true);
  try {
    const { context, value } = await packet(journal, undefined, true);
    expect(value.audience.conversation).toBeUndefined();
    expect(value.datedPending.every((item: object) => !('conversation' in item) && !('sourceLabel' in item))).toBe(true);
    expect(createHash('sha256').update(context).digest('hex')).toBe('4f9861f1b198353ff376439dfdfdeb783be92d17167ca2b056d34613f4a04736');
  } finally { journal.close(); }
});

it.each(capture.modelReplay.cases)('delivers the recorded subscription-model replay: $question', async replay => {
  const journal = seed();
  try {
    const { sent, value } = await packet(journal, undefined, false, replay);
    expect(value.audience.conversation).toBe('General');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.thread).toBeUndefined();
    expect(sent[0]!.text).toContain('General');
    if (replay.question.includes('CEDAR')) {
      expect(sent[0]!.text).toContain('I learned CEDAR in topic 3');
      expect(sent[0]!.text).toContain('969390331');
    }
    expect(sent[0]!.text).not.toBe(capture.failedAnswer);
  } finally { journal.close(); }
});
