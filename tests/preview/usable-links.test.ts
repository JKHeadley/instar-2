import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, CREDENTIAL_SHAPE_NOTICE, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE,
  UNKNOWN_ANSWER_NOTICE, MODEL_FAILURE_REPLY, limitedAnswerText, requestOverflowLine } from './journal-test-worker.js';
import { BARE_TOPIC_OBJECTION, JEV_MODEL, LINK_SHAPE_REASON, REPLY_RULES, bareTopicReferences, linkShapeRules, topicNameReason } from './reply-check.js';
import { topicNames } from './journal.js';
import { machineLink } from './coherence-check.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

// Rule 106: the existing link-shape predicate runs before every model-written send, as a signal.
const key = new Uint8Array(32).fill(81);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 6, maxTurns: 6, maxBytes: 32768, cursor: 0 };
const hello = [{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'where is the report?' } }];
const pass = { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0.01 }])) };
const withJournal = async (run: (journal: ReturnType<typeof openPreviewJournal>) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-links-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  try { await run(journal); } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
};

it.each([
  ['a localhost link', 'Open http://localhost:4042/view/abc to read it.', ['api_endpoint']],
  ['a machine-only path', 'It is saved at /Users/me/report.md for you.', ['raw_path']],
  ['a public link', 'It is at https://example.com/report for you.', []],
  ['no link', 'It is in your notes.', []],
] as const)('classifies %s', (_name, text, rules) => {
  expect(linkShapeRules(text)).toEqual(rules);
});

it('turns an unusable link into a revision signal before the send, then sends the revision', () => withJournal(async journal => {
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
    model: async () => 'Open http://localhost:4042/view/abc to read it.',
    replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: pass, latencyMs: 1 }),
      // Only the revised candidate is reviewed, for the held classes (Rules 6, 8); the link signal needs no review.
      escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => {
        if (operation !== 'revision') throw Error('no review needed');
        return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }; },
      revise: async input => { expect(input.ruleIds).toEqual(['api_endpoint']); expect(input.reason).toBe(LINK_SHAPE_REASON);
        return { state: 'complete', text: 'The report is in the private view I shared in the dashboard.' }; } },
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake(hello); await worker.drain();
  expect(sent).toEqual(['PREVIEW — The report is in the private view I shared in the dashboard.']);
  expect(journal.view.order[0]?.release).toMatchObject({ objections: ['api_endpoint'], revised: true });
}));

it('never blocks on the link signal: without a reviser the reply is sent with the signal recorded', () => withJournal(async journal => {
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => 'It is saved at /Users/me/report.md for you.',
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake(hello); await worker.drain();
  expect(sent).toEqual(['PREVIEW — It is saved at /Users/me/report.md for you.']);
  expect(journal.view.order[0]?.release).toMatchObject({ review: 'violation', objections: ['raw_path'], reason: LINK_SHAPE_REASON,
    revised: false, final: { links: ['raw_path'] } });
}));

it('checks the final candidate: a revision that introduces a localhost link is recorded against the text actually sent', () => withJournal(async journal => {
  // The review's probe: a link-free draft draws a contextual objection, and the revision adds a
  // machine-local link. The predicate runs on the exact final text; the finding is advisory, never a hold.
  const sent: string[] = [];
  const objection = { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id =>
    [id, { type: 'noul', noul: id === 'raw_path' ? 0.99 : 0.01 }])) };
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
    model: async () => 'Your report is ready in the usual place.',
    replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: objection, latencyMs: 1 }),
      escalate: async () => ({ verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 1, reason: 'names a machine place' }),
      revise: async () => ({ state: 'complete', text: 'Open http://localhost:4042/new-report for your report.' }) },
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake(hello); await worker.drain();
  const final = 'PREVIEW — Open http://localhost:4042/new-report for your report.';
  expect(sent).toEqual([final]);
  const release = journal.view.order[0]?.release;
  expect(release?.revised).toBe(true);
  expect(release?.objections).toEqual(expect.arrayContaining(['raw_path', 'api_endpoint']));
  expect(release?.final).toEqual({ digest: createHash('sha256').update(final).digest('hex'), links: ['api_endpoint'] });
}));

it('builds every fixed outbound template without a link the operator cannot open', () => withJournal(async journal => {
  for (const text of [CREDENTIAL_SHAPE_NOTICE, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE, UNKNOWN_ANSWER_NOTICE, MODEL_FAILURE_REPLY,
    limitedAnswerText(journal.view, 'turns', 1), limitedAnswerText(journal.view, 'calls', 3), limitedAnswerText(journal.view, 'replies', 2),
    requestOverflowLine(4)]) expect(machineLink.test(text), text).toBe(false);
}));

// Rule 106, "never a bare id where a name exists": topic names come from the service updates the
// journal already preserves, so a rename is known at once and after a reopen.
const chat = { id: 7654321, type: 'private' }, operator = { id: 7654321 };
const topicEvent = (id: number, thread: number, event: 'forum_topic_created' | 'forum_topic_edited', body: Record<string, unknown>, on = chat) =>
  ({ update_id: id, message: { message_id: id, chat: on, from: operator, message_thread_id: thread, [event]: body } });
const said = (id: number, text: string, thread?: number) => ({ update_id: id, message: { message_id: id, chat, from: operator, text,
  ...(thread === undefined ? {} : { message_thread_id: thread, is_topic_message: true }) } });
const renamed = [topicEvent(1, 12, 'forum_topic_created', { name: 'Trip', icon_color: 7322096 }),
  said(2, 'The passports are in the blue folder.', 12), topicEvent(3, 12, 'forum_topic_edited', { name: 'Travel  plans\u0007' })];

it('names a renamed topic in another conversation\'s packet, never "topic 12", and keeps the name after a reopen', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-topic-names-')));
  const path = join(root, 'journal.encrypted'), wide = { ...genesis, maxCalls: 20, maxReplies: 20, maxTurns: 20 };
  try {
    const contexts: string[] = [];
    const run = (journal: ReturnType<typeof openPreviewJournal>) => createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      checkOutbound: () => {}, model: async input => { contexts.push(input.context); return 'noted'; },
      send: async () => 1 });
    const first = openPreviewJournal(path, key, wide);
    const worker = run(first);
    worker.intake(renamed); await worker.drain();
    expect(topicNames(first.view)).toEqual(new Map([[12, 'Travel plans']]));
    worker.intake([said(4, 'Where are the passports?')]); await worker.drain();
    const packet = JSON.parse(contexts.at(-1)!);
    expect(packet.history).toContainEqual(expect.objectContaining({ conversation: 'the "Travel plans" topic', user: 'The passports are in the blue folder.' }));
    expect(contexts.at(-1)).not.toMatch(/topic 12\b/u);
    first.close();
    const reopened = openPreviewJournal(path, key, wide);
    expect(topicNames(reopened.view)).toEqual(new Map([[12, 'Travel plans']]));
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('takes a name only from the bound chat, keeps it on an icon-only edit, and leaves an unnamed topic its number', () => withJournal(async journal => {
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => 'noted', send: async () => 1 });
  worker.intake([topicEvent(1, 5, 'forum_topic_created', { name: 'Garden' }),
    topicEvent(2, 5, 'forum_topic_edited', { icon_custom_emoji_id: '123' }),
    topicEvent(3, 9, 'forum_topic_created', { name: 'Not mine' }, { id: 111, type: 'private' }),
    topicEvent(4, 6, 'forum_topic_created', { name: '   ' })]);
  expect(topicNames(journal.view)).toEqual(new Map([[5, 'Garden']]));
  expect(journal.view.order.every(turn => !turn.accepted)).toBe(true);
}));

it('finds a named topic called only by its number, and nothing else', () => {
  const names = new Map([[12, 'Travel plans']]);
  expect(bareTopicReferences('It is in topic 12, see Topic #12.', names)).toEqual([12]);
  expect(bareTopicReferences('It is in topic 13 and in the "Travel plans" topic.', names)).toEqual([]);
  expect(bareTopicReferences('It is in topic 120.', names)).toEqual([]);
  expect(topicNameReason([12], new Map([[12, 'x'.repeat(100)]])).length).toBeLessThanOrEqual(160);
  expect(topicNameReason([12], names)).toContain('"Travel plans"');
});

it('turns a bare topic number into a revision signal naming the topic, then sends the revision', () => withJournal(async journal => {
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
    model: async input => input.id.endsWith(':4') ? 'They are in topic 12.' : 'noted',
    replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: pass, latencyMs: 1 }),
      escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => {
        if (operation !== 'revision') throw Error('no review needed');
        return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }; },
      revise: async input => { expect(input.ruleIds).toEqual([BARE_TOPIC_OBJECTION]);
        expect(input.reason).toBe(topicNameReason([12], new Map([[12, 'Travel plans']])));
        return { state: 'complete', text: 'They are in the blue folder, as you said in the "Travel plans" topic.' }; } },
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake([...renamed, said(4, 'Where are the passports?')]); await worker.drain();
  expect(sent.at(-1)).toBe('PREVIEW — They are in the blue folder, as you said in the "Travel plans" topic.');
  expect(journal.view.turns.get('telegram:12345678:update:4')?.release).toMatchObject({ objections: [BARE_TOPIC_OBJECTION], revised: true });
}));

it('never blocks on the topic signal: an unnamed number passes, a named one is sent with the signal recorded', () => withJournal(async journal => {
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async input => input.id.endsWith(':4') ? 'They are in topic 12.' : 'It is in topic 30.',
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake([...renamed, said(4, 'Where are the passports?'), said(5, 'And the tickets?')]); await worker.drain();
  expect(sent.slice(-2)).toEqual(['PREVIEW — They are in topic 12.', 'PREVIEW — It is in topic 30.']);
  expect(journal.view.turns.get('telegram:12345678:update:4')?.release).toMatchObject({ review: 'violation',
    objections: [BARE_TOPIC_OBJECTION], revised: false, final: { links: [BARE_TOPIC_OBJECTION] } });
  expect(journal.view.turns.get('telegram:12345678:update:5')?.release).toBeUndefined();
}));
