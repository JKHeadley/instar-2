import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createJournalWorker, MEMORY_ITEM_SHAPE, OBLIGATION_DECISION, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';

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

it.each([3, 1, undefined])('uses the recorded topic name for topic %s and the matching source labels', async topic => {
  const journal = seed();
  try {
    // Telegram service updates are captured even though they have no accepted text.
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'Noted.', send: async () => 50, checkOutbound: () => {} });
    const service = { update_id: 969390332, message: { ...(topic === undefined ? {} : { message_thread_id: topic }),
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

it('keeps private-chat packet bytes from afa6be39 apart from the reviewed memory guidance', async () => {
  const journal = seed(true);
  try {
    const { context, value } = await packet(journal, undefined, true);
    expect(value.audience.conversation).toBeUndefined();
    expect(value.datedPending.every((item: object) => !('conversation' in item) && !('sourceLabel' in item))).toBe(true);
    expect(value.memoryDecision).toContain('mode:"remember"');
    // deferral-not-memory compresses scope wording; the historical packet digest below is unchanged.
    expect(value.memoryDecision).toContain('Journal persists across topics/restarts.');
    expect(value.memoryDecision).toContain(MEMORY_ITEM_SHAPE);
    // f589c692 shortened this one field. Restore its afa6be39 wording from the
    // immutable live capture, retaining the original digest for every other byte.
    const recorded = JSON.parse(readFileSync(new URL('./fixtures/inrole-memory-live-2026-10-11.json', import.meta.url), 'utf8'));
    const guide = recorded.cases[0].memoryDecision as string;
    expect(guide).toContain('Each memory item');
    const historical = JSON.parse(context);
    historical.memoryDecision = 'Return memory:[] unless the verified operator corrects, forgets or sets reply style. '
      + guide.slice(guide.indexOf('Each memory item'));
    // Restore only the reviewed recall-prose trim, keeping the historical hash
    // and every unrelated packet byte fixed. The current instruction still binds exact evidence.
    expect(historical.capability).toContain('For recall, state a remembered detail only when the offered journal evidence supports that exact detail');
    historical.capability = historical.capability.replace(
      /Summary covers earlier turns;.*?Cite sourceLabel; disclose unknown sources\./u,
      "Summary covers earlier turns; history has later turns. For a question about what the operator said, state a remembered detail only when the offered journal evidence supports that exact detail, not a similar name, event or date, a summary inference, your earlier reply or the question's premise; otherwise say \"I don't know from this journal\", never that the operator did not say it. Cite sourceLabel for supported remembered facts. Say when the source is unknown.");
    // Relative reminder admission adds an original-clock binding and reviewed date guidance.
    // Restore just those fields from the immutable train-18 capture; all other bytes retain the old pin.
    expect(historical.datedClock).toEqual({ at: JSON.parse(journal.view.order.at(-1)!.raw).message.date * 1000,
      zone: 'America/Los_Angeles' });
    expect(historical.datedDecision).toContain('at:datedClock.at,zone:datedClock.zone');
    expect(historical.datedDecision).toContain('ambiguity:clarifying question');
    const dates = JSON.parse(readFileSync(new URL('./fixtures/reminder-relative-1013.json', import.meta.url), 'utf8'));
    const reservation = dates.frames.find((row: { frame: number }) => row.frame === 400);
    const recordedPacket = JSON.parse(JSON.parse(reservation.prompt).messages
      .find((message: { role: string }) => message.role === 'context').content).packet;
    historical.datedDecision = recordedPacket.datedDecision;
    delete historical.datedClock;
    // Owed-result delivery adds an exact request and withdrawal declaration; restore only
    // those reviewed fields for the historical digest, keeping unrelated packet bytes pinned.
    expect(historical.obligationDecision).toBe(OBLIGATION_DECISION);
    expect(historical.obligationDecision).toContain('deliveryRequest?:exact operator request');
    historical.obligationDecision = recordedPacket.obligationDecision.replace(
      'Only your recorded tool calls ran; never call an avenue tried.',
      'You attempted nothing outside this reply, so never call an avenue tried; a missing tool is no-tools.');
    expect(historical.governingConstraints['reply-only-grant']).toBe('bot: replies and explicitly requested follow-ups');
    expect(historical.capabilities.sends).toBe(historical.governingConstraints['reply-only-grant']);
    historical.governingConstraints['reply-only-grant'] = recordedPacket.governingConstraints['reply-only-grant'];
    historical.capabilities.sends = recordedPacket.capabilities.sends;
    // sibling-time: reviewed source-label dates now use the operator's local clock.
    expect(historical.history.every((item: { sourceLabel: string }) => item.sourceLabel.includes(' PDT/'))).toBe(true);
    expect(createHash('sha256').update(JSON.stringify(historical)).digest('hex')).toBe('78d754604043004602197d7fa4c8da28a4c0d711a15d351adfeebf3c668a80d2');
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
