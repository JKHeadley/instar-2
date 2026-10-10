import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(37);
const now = 1791647400000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-1001234', operator: '7654321', forum: true as const,
  grant: 'grant:forum', configurationDigest: 'sha256:forum-test', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 };
const update = (id: number, text: string, thread?: number, forum = true) => ({ update_id: id,
  message: { message_id: id, chat: forum ? { id: -1001234, type: 'supergroup', is_forum: true }
    : { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    ...(thread === undefined ? {} : { message_thread_id: thread }) } });

// Operator-reported live fault, 2026-10-10 08:51 PDT, afa6be39, group -1004290919884.
// Text/sequence from the brief; update IDs below are synthetic, not claimed as captured live bytes.
it.each([undefined, 1])('distinguishes General (%s) from the shared topic-3 word without changing history or delivery', async general => {
  const root = mkdtempSync(join(tmpdir(), 'topic-awareness-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const packets: Record<string, any>[] = [];
  const destinations: (number | undefined)[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { packets.push(JSON.parse(input.context)); return 'Noted.'; },
      checkOutbound: () => {}, send: async input => { destinations.push(input.thread); return destinations.length; } });
    for (const item of [update(1, 'General history.', general), update(2, 'the word for this topic is CEDAR', 3),
      update(3, 'what topic is this message in?', general)]) { worker.intake([item]); await worker.drain(); }
    const packet = packets.at(-1)!;
    expect(packet.audience.conversation).toBe('General');
    expect(packet.history.map((item: { user: string }) => item.user)).toEqual(['General history.']);
    expect(packet.datedPending.find((item: { update: number }) => item.update === 2)).toMatchObject({
      message: 'the word for this topic is CEDAR', conversation: 'topic 3', sourceLabel: expect.stringContaining('/topic 3/') });
    expect(packet.memoryCandidates.find((item: { id: string }) => item.id.endsWith(':2')).sourceLabel).toContain('/topic 3/');
    expect(packet.history[0].sourceLabel).toContain('/General/');
    expect(packet.capability).toContain('attribute them to where they were learned');
    expect(destinations).toEqual([undefined, 3, undefined]);
    expect(packets[1]!.audience.conversation).toBe('topic 3');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([3, 1])('labels dated facts and uses the retained name of topic %s, including renamed General', async thread => {
  const root = mkdtempSync(join(tmpdir(), 'topic-named-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const packets: Record<string, any>[] = [];
  const request = 'My appointment is tomorrow at 3 pm.';
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { packets.push(JSON.parse(input.context)); return input.question === request
        ? JSON.stringify({ reply: 'Noted.', dated: [{ quote: request, when: 'tomorrow at 3 pm' }] }) : 'Noted.'; },
      checkOutbound: () => {}, send: async () => 1 });
    const service = update(1, '', thread);
    const named = { ...service, message: { ...service.message, forum_topic_created: { name: 'Garden' } } };
    worker.intake([named]);
    worker.intake([update(2, request, thread)]); await worker.drain();
    worker.intake([update(3, 'What is planned?')]); await worker.drain();
    expect(packets[0]!.audience.conversation).toBe('the "Garden" topic');
    expect(packets.at(-1)!.dated[0]).toMatchObject({ conversation: 'the "Garden" topic',
      sourceLabel: expect.stringContaining('/the "Garden" topic/') });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps private-chat packet bytes identical to the parent commit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'topic-private-'));
  const { forum: _forum, ...privateGenesis } = genesis;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...privateGenesis, chat: genesis.operator });
  const packets: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { packets.push(input.context); return 'Noted.'; }, checkOutbound: () => {}, send: async () => 1 });
    for (const [id, text] of [[1, 'the word for this topic is CEDAR'], [2, 'what topic is this message in?']] as const) {
      worker.intake([update(id, text, undefined, false)]); await worker.drain();
    }
    // SHA-256 of exact packet strings captured by this test on afa6be39 before the fix.
    expect(createHash('sha256').update(JSON.stringify(packets)).digest('hex')).toBe('18d77fb66b66f7d95044600b571487b513f1f3bca290d18c5e43e0ce2e4bf6a3');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('projects real recorded uncertain/undecided, review and delivered rows through the new forum packet path', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as {
    genesis: typeof genesis; rows: JournalRecord[] };
  const root = mkdtempSync(join(tmpdir(), 'topic-recorded-'));
  // The forum envelope is synthetic; every replayed decision/delivery row is the recorded original.
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...capture.genesis, kind: 'genesis',
    expires: genesis.expires, cursor: 0 });
  try {
    for (const row of capture.rows) journal.append(row);
    expect(journal.view.order).toHaveLength(22);
    expect(journal.view.order.some(turn => turn.memoryUndecided)).toBe(true);
    expect(journal.view.order.some(turn => turn.replyChecks?.some(check => check.verdict === 'unsure' || check.verdict === 'unavailable'))).toBe(true);
    const forumJournal = { ...journal, view: { ...journal.view, genesis: { ...journal.view.genesis, forum: true as const, chat: genesis.chat } } };
    const worker = createJournalWorker(forumJournal, { now: () => now, stopped: () => false,
      model: async () => { throw Error('read-only replay must not call a model'); }, send: async () => { throw Error('no sends'); }, checkOutbound: () => {} });
    const result = worker.probe('What do you remember about the bird feeder?');
    if ('reason' in result) throw Error(result.reason);
    const packet = JSON.parse(result.context);
    expect(packet.audience.conversation).toBe('General');
    expect(packet.datedPending.length).toBeGreaterThan(0);
    for (const item of packet.datedPending) expect(item.sourceLabel).toContain('/General/');
    expect(packet.memoryCandidates.length).toBeGreaterThan(0);
    for (const item of packet.memoryCandidates) expect(item.sourceLabel).toContain('/General/');
    for (const item of packet.recalled ?? []) expect(item.sourceLabel).toContain('/General/');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
