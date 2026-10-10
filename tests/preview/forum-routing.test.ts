import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, independentSurface, openPreviewJournal } from './journal-test-worker.js';
import { importChannelItems, LOOP_REVISIT_MS, pendingReports } from './journal.js';
import { boundThread, journalConversation, journalWorkConversation, matchesBoundChat, validateChatBinding } from './forum-routing.js';
// @ts-expect-error The physical workspace host remains JavaScript.
import { conversationWorkspace, toolTurnEligible } from './tool-turn.mjs';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';
import { auditPacket } from './journal-audit.mjs';

const key = new Uint8Array(32).fill(37);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-1001234', operator: '7654321', forum: true as const,
  grant: 'grant:forum', configurationDigest: 'sha256:forum-test', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 };
const update = (id: number, text: string, thread?: number) => ({ update_id: id,
  message: { message_id: id, chat: { id: -1001234, type: 'supergroup', is_forum: true },
    from: { id: 7654321 }, text, ...(thread === undefined ? {} : { message_thread_id: thread }) } });

it.each([true, false])('keeps commitment and blocker tool work in its source workspace across restart (forum=%s)', async forum => {
  const root = mkdtempSync(join(tmpdir(), 'forum-workspace-'));
  const path = join(root, 'journal.encrypted');
  const binding = forum ? genesis : { ...genesis, forum: undefined, chat: genesis.operator };
  const { forum: mode, ...rest } = binding;
  let journal = openPreviewJournal(path, key, { ...rest, ...(mode ? { forum: mode } : {}) });
  let now = 1790000000000;
  const observed = new Map<string, string>();
  // Exercise the exact expression handed to runToolTurn by the shipped launcher, not a parallel test selector.
  const launcher = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  const expression = /conversation: (.+),\n\s*\/\/ The kept session/u.exec(launcher)?.[1];
  expect(expression).toBeDefined();
  const select = new Function('journal', 'id', 'journalWorkConversation', 'conversationOf', `return ${expression};`);
  const conversation = (id: string): string => select(journal, id, journalWorkConversation, journalConversation);
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => {
      if (toolTurnEligible(input.id)) observed.set(input.id, conversation(input.id));
      if (input.id.startsWith('obligation:blocker:')) return JSON.stringify({ outcome: 'cleared', report: 'The blocker cleared.' });
      if (input.id.startsWith('obligation:')) return JSON.stringify({ outcome: 'report', report: 'The work is finished.' });
      if (input.question === 'Book the appointment.') {
        const claim = 'I cannot book it: this preview has no browser or accounts.';
        return JSON.stringify({ reply: claim, blocker: { kind: 'cannot-do', claim,
          avenues: [{ avenue: 'booking tool', disposition: 'outside-standing', evidence: 'externalTools' }],
          constraint: 'no-tools', outsideAction: 'Book it on the clinic site.', recheck: '2026-09-22' } });
      }
      const reply = 'I will check the invoice and report back.';
      return JSON.stringify({ reply, openLoops: [{ kind: 'deferral', quote: reply, waitsOn: 'nothing' }] });
    }, checkOutbound: () => {}, send: async () => 1 });
  try {
    const first = worker();
    for (const [index, thread] of [7, 9, undefined, 1].entries()) {
      for (const [offset, question] of ['Check the invoice.', 'Book the appointment.'].entries()) {
        const message = update(index * 2 + offset + 1, question, thread);
        if (!forum) { message.message.chat.id = 7654321; message.message.chat.type = 'private'; }
        first.intake([message]); await first.drain();
      }
    }
    expect(journal.view.commitments).toHaveLength(4);
    expect(journal.view.blockers).toHaveLength(4);
    const turns = journal.view.order.map(turn => turn.id);
    const spaces = turns.map(id => conversationWorkspace(root, conversation(id)));
    for (const space of spaces) writeFileSync(join(space.directory, 'prepared.txt'), space.key);
    expect(spaces[0].key === spaces[2].key).toBe(!forum);
    expect(spaces[4].key).toBe(spaces[6].key);
    journal.close(); journal = openPreviewJournal(path, key);
    now += 4 * 86400000;
    const resumed = worker();
    for (let step = 0; step < 8; step++) expect(await resumed.workObligations()).toBe(true);
    const work = [...observed].filter(([id]) => id.startsWith('obligation:'));
    expect(work).toHaveLength(8);
    for (const [id, selected] of work) {
      const [, kind, index] = id.split(':');
      const note = (kind === 'commitment' ? journal.view.commitments : journal.view.blockers)[Number(index)]!;
      expect(selected).toBe(observed.get(note.source));
      const space = conversationWorkspace(root, selected);
      expect(readFileSync(join(space.directory, 'prepared.txt'), 'utf8')).toBe(space.key);
      expect(space).toEqual(conversationWorkspace(root, conversation(note.source)));
    }
    expect(journalWorkConversation(journal.view, 'obligation:commitment:999:1')).toBe(journalConversation(journal.view.genesis));
    expect(journalWorkConversation(journal.view, 'obligation:other:0:1')).toBe(journalConversation(journal.view.genesis));
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('uses distinct stable topic/session identities and one General identity without changing private keys', () => {
  expect(journalConversation(genesis, 7)).not.toBe(journalConversation(genesis, 9));
  expect(journalConversation(genesis, 1)).toBe(journalConversation(genesis));
  expect(boundThread(genesis, 1)).toBeUndefined();
  const privateBinding = { bot: genesis.bot, chat: genesis.operator, operator: genesis.operator };
  expect(journalConversation(privateBinding, 7)).toBe('telegram/bot-12345678/chat-7654321');
  expect(matchesBoundChat(privateBinding, { id: 7654321, type: 'private' })).toBe(true);
  expect(matchesBoundChat(privateBinding, update(1, 'x').message.chat)).toBe(false);
  expect(() => validateChatBinding(genesis)).not.toThrow();
  expect(() => validateChatBinding({ ...genesis, chat: '7654321' })).toThrow();
});

it('drains two topics and General to their own targets, separates recent history, and resumes without duplicate sends', async () => {
  const root = mkdtempSync(join(tmpdir(), 'forum-routing-'));
  const path = join(root, 'journal.encrypted');
  const sent: { thread?: number; chat: string; update: number }[] = [];
  const packets = new Map<string, Record<string, unknown>>();
  const open = () => {
    const journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => { packets.set(input.id, JSON.parse(input.context)); return 'noted'; },
      send: async input => { sent.push({ chat: input.chat, update: input.update,
        ...(input.thread === undefined ? {} : { thread: input.thread }) }); return sent.length; }, checkOutbound: () => {} });
    return { journal, worker };
  };
  try {
    let run = open();
    const reference = (id: number, text: string, thread: number, targetId: number, targetThread: number) => ({
      ...update(id, text, thread), message: { ...update(id, text, thread).message,
        reply_to_message: { message_id: targetId, chat: { id: -1001234 }, from: { id: 7654321 }, message_thread_id: targetThread } } });
    for (const message of [update(1, 'Topic seven history.', 7), update(2, 'Topic nine history.', 9),
      update(3, 'General history.'), reference(4, 'More in General.', 1, 3, 1), reference(5, 'Continue seven.', 7, 2, 9)]) {
      run.worker.intake([message]); await run.worker.drain();
    }
    expect(sent.map(item => item.thread)).toEqual([7, 9, undefined, undefined, 7]);
    expect(sent.every(item => item.chat === genesis.chat)).toBe(true);
    expect(packets.get('telegram:12345678:update:2')!.history).toEqual([]);
    expect(packets.get('telegram:12345678:update:5')!.history).toMatchObject([{ user: 'Topic seven history.' }]);
    expect(packets.get('telegram:12345678:update:4')!.replyTo).toMatchObject({ update: 3, user: 'General history.' });
    expect(packets.get('telegram:12345678:update:5')!.replyTo).toMatchObject({ status: 'referenced message unavailable in retained journal' });
    expect(packets.get('telegram:12345678:update:5')!.audience).toMatchObject({ surface: 'telegram-group-topic',
      conversationId: 'telegram/bot-12345678/chat--1001234/topic-7' });
    const last = run.journal.view.order.at(-1)!;
    expect(auditPacket(run.journal.view, last, packets.get(last.id)).findings).toEqual([]);
    expect(() => importChannelItems(run.journal, [], 'private-account', 1790000000000)).toThrow('disclosure grant');
    run.journal.close();
    run = open();
    run.worker.intake([update(5, 'Continue seven.', 7)]); await run.worker.drain();
    expect(sent).toHaveLength(5);
    expect(run.journal.view.order.map(item => item.thread)).toEqual([7, 9, undefined, undefined, 7]);
    run.journal.close();
    const { forum: _forum, ...legacy } = genesis;
    expect(() => openPreviewJournal(path, key, legacy)).toThrow('forum mode');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('preserves but refuses another group, a private chat, a non-operator, an anonymous sender and malformed topics', async () => {
  const root = mkdtempSync(join(tmpdir(), 'forum-refusal-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let calls = 0;
  try {
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async () => { calls++; return 'noted'; }, send: async () => 1, checkOutbound: () => {} });
    const foreign = update(1, 'foreign', 7); foreign.message.chat.id = -1005678;
    const direct = update(2, 'direct'); direct.message.chat.type = 'private';
    const sender = update(3, 'other sender', 7); sender.message.from.id = 111;
    const anonymous = { ...update(4, 'anonymous', 7), message: { ...update(4, 'anonymous', 7).message, sender_chat: { id: -1001234 } } };
    const nonForum = update(5, 'not a forum'); nonForum.message.chat.is_forum = false;
    worker.intake([foreign, direct, sender, anonymous, nonForum, update(6, 'bad topic', -1), update(7, 'hello', 7)]);
    await worker.drain();
    expect(journal.view.order.map(item => item.accepted)).toEqual([false, false, false, false, false, false, true]);
    expect(journal.view.cursor).toBe(8);
    expect(calls).toBe(1);
    worker.stop('operator');
    expect(() => worker.intake([update(8, 'stopped', 9)])).toThrow('stopped');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('requires a receipt for the exact forum topic, including General', () => {
  const reply = (thread?: number) => ({ kind: 'response', status: 200, bytes: JSON.stringify({ ok: true,
    result: { message_id: 1, chat: { id: -1001234 }, text: 'noted', ...(thread === undefined ? {} : { message_thread_id: thread }) } }) });
  const target = { chat: genesis.chat, expectedText: 'noted', forum: true };
  expect(classifyTelegramSend(reply(7), { ...target, thread: 7 }).kind).toBe('accepted');
  expect(classifyTelegramSend(reply(9), { ...target, thread: 7 }).kind).toBe('unknown');
  expect(classifyTelegramSend(reply(7), target).kind).toBe('unknown');
  expect(classifyTelegramSend(reply(), target).kind).toBe('accepted');
  expect(classifyTelegramSend(reply(1), target).kind).toBe('accepted');
});


it('routes due requests back to their source topic after another topic speaks, using the shared cap', async () => {
  const root = mkdtempSync(join(tmpdir(), 'forum-due-'));
  const path = join(root, 'journal.encrypted');
  let now = Date.UTC(2026, 8, 26, 17);
  const sent: { text: string; thread?: number }[] = [];
  const request = 'remind me Friday at 9 am to call Priya';
  const open = () => {
    const journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async input => input.question === request
        ? JSON.stringify({ reply: 'Okay.', dated: [{ quote: request, when: 'Friday at 9 am', remind: true }] })
        : 'Noted.', checkOutbound: () => {}, send: async input => {
          sent.push({ text: input.expectedText, ...(input.thread === undefined ? {} : { thread: input.thread }) }); return sent.length;
        } });
    return { journal, worker };
  };
  try {
    let run = open();
    run.worker.intake([update(1, request, 7)]); await run.worker.drain();
    run.worker.intake([update(2, 'Another conversation.', 9)]); await run.worker.drain();
    run.journal.close(); run = open();
    now = Date.UTC(2026, 9, 2, 16);
    await run.worker.sendRequested(); await run.worker.sendRequested();
    expect(sent.map(item => item.thread)).toEqual([7, 9, 7]);
    expect(sent[2]?.text).toContain(request);
    expect(run.journal.view.order.find(turn => turn.requestedAction)?.thread).toBe(7);
    expect(run.journal.view.replies).toBe(3);
    run.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('routes status and cap-approval links to each topic and refuses a callback copied into another topic', async () => {
  const root = mkdtempSync(join(tmpdir(), 'forum-approval-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 1 });
  const sent: { text: string; thread?: number; markup?: unknown }[] = [];
  const surface = independentSurface(() => 1790000000000);
  try {
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async () => 'noted', checkOutbound: () => {}, approvalSurface: surface.port,
      send: async input => { sent.push({ text: input.expectedText, markup: input.replyMarkup,
        ...(input.thread === undefined ? {} : { thread: input.thread }) }); return sent.length; } });
    worker.intake([update(1, 'status', 7)]); await worker.drain();
    expect(sent[0]?.thread).toBe(7);
    worker.intake([update(2, 'hello', 7)]); await worker.drain();
    worker.intake([update(3, 'hello again', 9)]); await worker.drain();
    const lead = journal.view.order.find(turn => turn.approval)!;
    expect(lead.thread).toBe(9);
    expect(sent.at(-1)?.thread).toBe(9);
    expect(JSON.stringify(sent.at(-1)?.markup)).toContain('https://approve.example.org/');
    const callback = (id: number, thread: number) => ({ update_id: id, callback_query: { id: `cb-${id}`,
      from: { id: 7654321 }, data: `dc:${lead.approval!.id}`, message: update(1, 'button', thread).message } });
    worker.intake([callback(4, 7)]);
    expect(lead.approval?.decision).toBeUndefined();
    worker.intake([callback(5, 9)]);
    expect(lead.approval?.decision).toBe('declined');
    expect(journal.view.limits.maxCalls).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});


it('keeps a finished promise pending until a reply in its originating topic can carry it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'forum-promise-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let now = 1790000000000;
  const promise = 'I will check the invoice and report back.';
  const report = 'The invoice is for 120 dollars.';
  const sent: { text: string; thread?: number }[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => input.id.startsWith('obligation:') ? JSON.stringify({ outcome: 'report', report })
        : input.question === 'Check the invoice.' ? JSON.stringify({ reply: promise,
          openLoops: [{ kind: 'deferral', quote: promise, waitsOn: 'nothing' }] }) : 'Noted.',
      checkOutbound: () => {}, send: async input => { sent.push({ text: input.expectedText,
        ...(input.thread === undefined ? {} : { thread: input.thread }) }); return sent.length; } });
    worker.intake([update(1, 'Check the invoice.', 7)]); await worker.drain();
    now += LOOP_REVISIT_MS + 60000;
    expect(await worker.workObligations()).toBe(true);
    expect(pendingReports(journal.view)).toHaveLength(1);
    worker.intake([update(2, 'Another conversation.', 9)]); await worker.drain();
    expect(sent.at(-1)?.text).not.toContain(report);
    expect(pendingReports(journal.view)).toHaveLength(1);
    worker.intake([update(3, 'Hello again.', 7)]); await worker.drain();
    expect(sent.at(-1)).toMatchObject({ thread: 7, text: expect.stringContaining(report) });
    expect(pendingReports(journal.view)).toHaveLength(0);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
