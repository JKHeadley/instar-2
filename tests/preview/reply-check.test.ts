import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BARE_TOPIC_OBJECTION, checkReply, HOLDING_REPLY, interpretJev, noDecisions, parseReplyRevision, replyRevisionQuestion, validDispositions, jevQuestions, REPLY_RULES, replyReviewContext, replyReviewQuestion, replyReviewRules, parseReplyReviewVerdict, parseJevResponse, JEV_RESPONSE_MAX_BYTES, REPLY_CHECK_BUDGET_MS, REPLY_CHECK_BUDGET_REASON, REPLY_REVIEW_REASON_MAX } from './reply-check.js';


import type { ObjectionDisposition, ReplyCheckResult, ReplyFinding, ReplyRule } from './reply-check.js';
import { redact } from '../../src/recall/redact.js';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal-test-worker.js';
import { CREDENTIAL_SHAPE_NOTICE, replyTimings, type JournalView } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const scores = (overrides: Record<string, number> = {}) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: overrides[id] ?? 0.01 }])) });
const key = new Uint8Array(32).fill(3);
// Memory holds the sent text without the PREVIEW surface marker.
const HOLDING_TEXT = HOLDING_REPLY.replace(/^PREVIEW — /u, '');

it('accepts a bounded Jev response and refuses an oversized one', () => {
  expect(parseJevResponse(JSON.stringify(scores()))).toEqual(scores());
  expect(() => parseJevResponse('x'.repeat(JEV_RESPONSE_MAX_BYTES + 1))).toThrow('Jev response too large');
});

it.each([
  ['pass', scores(), 'pass', true, false],
  ['ordinary reply at 0.31', scores({ parks_on_user: 0.31 }), 'pass', true, false],
  ['confirmed violation', scores({ raw_path: 0.85 }), 'violation', false, true],
  ['Jev false alarm', scores({ raw_path: 0.91 }), 'pass', true, true],
  ['unsure at 0.55', scores({ parks_on_user: 0.55 }), 'pass', true, true],
  ['timeout', null, 'violation', false, true],
] as const)('%s: Jev and escalation choose the recorded reply path', async (_name, jev, expected, sendOriginal, escalate) => {
  const records: ReplyCheckResult[] = [];
  let calls = 0, reserved = 0;
  const result = await checkReply('PREVIEW — candidate', 'turn:1', {
    elapsedMs: () => 100,
    jev: async () => { if (!jev) throw Error('timeout'); return { value: jev, latencyMs: 170 }; },
    reserveEscalation: () => { reserved++; return true; },
    escalate: async () => { calls++; return { verdict: expected === 'violation' ? 'violation' : 'pass',
      ruleIds: expected === 'violation' ? ['parks_on_user'] : [], confidence: null, latencyMs: 500 }; },
    record: row => records.push(row),
  });
  expect(result.outcome === 'pass').toBe(sendOriginal);
  expect(calls).toBe(Number(escalate));
  expect(reserved).toBe(Number(escalate));
  expect(records.at(-1)?.verdict).toBe(expected);
  expect(records[0]?.path).toBe('jev');
  if (escalate) expect(records.at(-1)?.path).toBe('subscription');
});

it.each([
  ['below the uncertainty line', { parks_on_user: 0.49 }, 'pass', []],
  ['at the uncertainty line', { parks_on_user: 0.5 }, 'unsure', ['parks_on_user']],
  ['above the uncertainty line', { parks_on_user: 0.55 }, 'unsure', ['parks_on_user']],
  ['at the ordinary positive line', { parks_on_user: 0.85 }, 'violation', ['parks_on_user']],
  ['credential escalation band', { credential: 0.55 }, 'unsure', ['credential']],
  ['at the credential positive line', { credential: 0.70 }, 'violation', ['credential']],
] as const)('%s has the calibrated Jev verdict', (_name, values, verdict, ruleIds) => {
  expect(interpretJev(scores(values), 170)).toMatchObject({ verdict, ruleIds, path: 'jev' });
});

it('reports unavailable, never a pass, when review cannot be reserved', async () => {
  const records: ReplyCheckResult[] = [];
  const result = await checkReply('PREVIEW — candidate', 'turn:1', {
    elapsedMs: () => 100, jev: async () => ({ value: scores({ parks_on_user: 0.5 }), latencyMs: 160 }),
    reserveEscalation: () => false, escalate: async () => { throw Error('must not call'); }, record: row => records.push(row),
  });
  expect(result).toEqual({ outcome: 'unavailable', path: 'holding', capRefused: true });
  expect(records.at(-1)?.path).toBe('holding');
});

it('reports unavailable, never a pass, when Jev and the full-context review both fail', async () => {
  const records: ReplyCheckResult[] = [];
  const result = await checkReply('PREVIEW — candidate', 'turn:1', {
    elapsedMs: () => 100, jev: async () => { throw Error('timeout'); },
    reserveEscalation: () => true, escalate: async () => { throw Error('provider unavailable'); },
    record: row => records.push(row),
  });
  expect(result.outcome).toBe('unavailable');
  expect(records.map(row => row.path)).toEqual(['jev', 'subscription']);
  expect(records.at(-1)?.verdict).toBe('unavailable');
});

it('keeps the complete answer grounding for the blocking reviewer and selects only flagged rules', () => {
  const context = { audience: { operator: 'verified' }, sources: [{ id: 'source:1' }],
    history: Array.from({ length: 12 }, (_, index) => ({ update: index + 1, user: `turn ${index + 1}` })),
    memory: [{ secret: 'unrelated' }], now: 1000 };
  const prompt = prepareJournalEnvelope({ question: 'What did I say?', context: JSON.stringify(context), id: 'turn:2' },
    'claude-sonnet-4-5', 'grant:test', 1000);
  expect(JSON.parse(replyReviewContext(prompt, 'PREVIEW — candidate', ['credential']))).toEqual({ ...context,
    operatorMessage: 'What did I say?', candidateReply: 'PREVIEW — candidate',
    rules: { credential: REPLY_RULES.credential } });
  expect(JSON.parse(replyReviewContext(prompt, 'PREVIEW — candidate')).rules).toEqual(REPLY_RULES);
  const large = prepareJournalEnvelope({ question: 'Question?',
    context: JSON.stringify({ audience: { operator: 'verified' },
      history: [{ user: 'a'.repeat(6000) }, { user: 'recent' }] }), id: 'turn:3' },
    'claude-sonnet-4-5', 'grant:test', 1000);
  expect(JSON.parse(replyReviewContext(large, 'candidate')).history).toEqual([
    { user: 'a'.repeat(6000) }, { user: 'recent' }]);
  expect(() => replyReviewContext(prompt, 'candidate', ['unknown' as keyof typeof REPLY_RULES])).toThrow('rule absent');
});

it.each([2700, 3000])('reviews and sends a %i-character CJK message, including after replay', async length => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-cjk-')));
  const path = join(root, 'journal.encrypted');
  try {
    const question = '文'.repeat(length);
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let reviewed = 0, sent = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
      model: async () => 'candidate', checkOutbound: () => {},
      send: async () => { sent++; return 1; },
      replyCheck: { elapsedMs: () => 100,
        jev: async () => ({ value: scores({ credential: 0.57 }), latencyMs: 150 }),
        escalate: async (text, _id, originalPrompt, ruleIds) => {
          const context = replyReviewContext(originalPrompt!, text, ruleIds);
          expect(JSON.parse(context).operatorMessage).toBe(question);
          prepareJournalEnvelope({ question: 'Judge the candidate reply.', context, id: 'review:1' },
            'claude-sonnet-4-5', 'grant:preview', 1000);
          reviewed++;
          return { verdict: 'pass', ruleIds: [] as [], confidence: null, latencyMs: 400 };
        } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: question } }]);
    await worker.drain();
    expect(reviewed).toBe(1);
    expect(sent).toBe(1);
    expect(journal.view.order[0]?.held).toBeUndefined();
    journal.close();
    const replay = openPreviewJournal(path, key);
    await createJournalWorker(replay, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async () => { sent++; return 2; } }).drain();
    expect(sent).toBe(1);
    expect(replay.view.order[0]?.sent).toBe(1);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('accepts one-line compact verdicts and refuses malformed or unlisted outcomes', () => {
  expect(parseReplyReviewVerdict('PASS | A personal locker code is safe to repeat here.')).toEqual({
    verdict: 'pass', ruleIds: [], reason: 'A personal locker code is safe to repeat here.' });
  expect(parseReplyReviewVerdict('VIOLATION:credential,raw_path | The reply exposes a credential and path.')).toEqual({
    verdict: 'violation', ruleIds: ['credential', 'raw_path'], reason: 'The reply exposes a credential and path.' });
  for (const value of ['PASS', 'VIOLATION | reason', 'PASS | ', 'VIOLATION:unknown | reason',
    'VIOLATION:credential,credential | reason', 'PASS | reason\nextra', 'PASS | ' + 'x'.repeat(REPLY_REVIEW_REASON_MAX + 1)])
    expect(() => parseReplyReviewVerdict(value)).toThrow('malformed');
});

it('states the credential boundary: a value returned only to the operator who supplied it does not leave', () => {
  expect(jevQuestions.credential?.instructions).toBe(REPLY_RULES.credential);
  expect(REPLY_RULES.credential).toMatch(/other than the verified operator who supplied it in this same private chat/u);
  expect(REPLY_RULES.credential).toMatch(/does not leave.*\(Rule 4\)/u);
  expect(REPLY_RULES.credential).toMatch(/never from a keyword list \(Rule 10\)/u);
  expect(REPLY_RULES.credential).toMatch(/credential wall on every reply, including one the operator pasted/u);
});

it('gives full-context review the actual operator request and the required Decision envelope', () => {
  const question = replyReviewQuestion(['cli_command']);
  expect(question).toContain('packet.operatorMessage');
  expect(question).toContain('conclusion.value');
  expect(question).toContain('explicit request for the command');
  expect(question).toContain('authentication secret');
  expect(question).not.toContain('Jev cleared');
  expect(question).not.toContain('raw_path":');
});

it('sends an operator-supplied personal code by the exact operator-echo path, without Jev or review', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-personal-code-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 4, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let sent = '', reviewed = false, answers = 0;
    let reviewContext: Record<string, unknown> | undefined;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async () => ++answers === 1 ? 'Got it.' : 'Your gym locker code is 3310.',
      checkOutbound: text => { if (redact(text).count) throw Error('outbound secret refused'); },
      replyCheck: { elapsedMs: () => 100,
        jev: async text => ({ value: scores(text.includes('3310') ? { credential: 0.8 } : {}), latencyMs: 170 }),
        escalate: async (text, _id, originalPrompt) => {
          reviewContext = JSON.parse(replyReviewContext(originalPrompt!, text));
          reviewed = true;
          return { verdict: 'pass', ruleIds: [] as [], confidence: null, latencyMs: 500 };
        } },
      send: async input => { sent = input.expectedText; return 8; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'My gym locker code is 3310.' } },
    { update_id: 2, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'What is my gym locker code?' } }]);
    await worker.drain();
    expect(reviewed).toBe(false);
    expect(reviewContext).toBeUndefined();
    expect(sent).toBe('PREVIEW — Your gym locker code is 3310.');
    expect(journal.view.lastReplyCheck).toMatchObject({ verdict: 'pass', path: 'operator-echo' });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([
  ['one uncertain rule', scores({ claims_blocked: 0.5 }), ['claims_blocked']],
  ['positive plus uncertain', scores({ raw_path: 0.9, parks_on_user: 0.5 }), ['raw_path', 'parks_on_user']],
  ['Jev unavailable', null, Object.keys(REPLY_RULES)],
] as const)('%s: review receives every unresolved rule and full context', async (_name, answer, expected) => {
  const prompt = prepareJournalEnvelope({ question: 'What did I say?',
    context: JSON.stringify({ audience: { operator: 'verified' }, sources: [{ id: 'source:1' }],
      history: [{ update: 1, user: 'remember this' }] }), id: 'turn:2' },
  'claude-sonnet-4-5', 'grant:test', 1000);
  let reviewed: readonly string[] = [];
  const result = await checkReply('PREVIEW — candidate', 'turn:2', {
    elapsedMs: () => 100,
    jev: async () => { if (!answer) throw Error('timeout'); return { value: answer, latencyMs: 100 }; },
    reserveEscalation: () => true,
    escalate: async (text, _id, originalPrompt, ruleIds) => {
      reviewed = ruleIds ?? [];
      expect(JSON.parse(replyReviewContext(originalPrompt!, text))).toMatchObject({
        operatorMessage: 'What did I say?', audience: { operator: 'verified' },
        sources: [{ id: 'source:1' }], history: [{ update: 1, user: 'remember this' }] });
      return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 100 };
    }, record: () => {},
  }, prompt);
  expect(result.outcome).toBe('pass');
  expect(reviewed).toEqual(expected);
  const selected = replyReviewRules(reviewed as (keyof typeof REPLY_RULES)[]);
  expect(selected).toEqual(Object.fromEntries(expected.map(id => [id, REPLY_RULES[id as keyof typeof REPLY_RULES]])));
  expect(replyReviewQuestion(reviewed as (keyof typeof REPLY_RULES)[])).toContain(JSON.stringify(selected));
});

it('durably checks before intent, releases the candidate with its objection on violation, and replays counts', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-check-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let exact = '';
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'bad candidate', checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores({ raw_path: 0.91 }), latencyMs: 170 }),
        escalate: async () => ({ verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 500, reason: 'shows a path' }) },
      send: async input => { exact = input.expectedText; expect(journal.view.lastReplyCheck?.verdict).toBe('violation');
        expect(journal.view.order[0]?.intent).toBe('PREVIEW — bad candidate'); return 5; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    // Rules 77/86: an ordinary objection is a signal; the substantive reply is sent, never replaced.
    expect(exact).toBe('PREVIEW — bad candidate');
    expect(journal.view.order[0]?.held).toBeUndefined();
    expect(journal.view.order[0]?.release).toEqual({ review: 'violation', objections: ['raw_path'], reason: 'shows a path', revised: false,
      dispositions: [{ objection: 'raw_path', decision: 'no-decision' }] });
    expect(journal.view.calls).toBe(2);
    journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true);
    expect(replay.view.replyCheckCounts.violation).toBe(2);
    expect(replay.view.lastReplyCheck?.ruleIds).toEqual(['raw_path']);
    expect(replay.view.lastReplyCheck?.path).toBe('subscription');
    expect(replay.view.order[0]?.release?.objections).toEqual(['raw_path']);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('revises an objected draft once within the call cap, then sends the revision with the surviving objection', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-revise-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 4, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    const sends: string[] = []; let revisions = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
      model: async () => 'Look in /Users/me/notes for it.', checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores({ raw_path: 0.91 }), latencyMs: 170 }),
        // The revised text gets its own held-class review (Rules 6, 8); only the held classes are asked.
        escalate: async (text, _id, _prompt, rules, _deadline, operation) => operation === 'revision'
          ? (expect(text).toBe('PREVIEW — It is in your notes folder.'),
            expect(rules).toEqual(['credential', 'defers_work', 'unrecorded_blocker']),
            { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 400 })
          : { verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 500, reason: 'shows a path' },
        revise: async input => {
          revisions++;
          expect(input.ruleIds).toEqual(['raw_path']);
          expect(input.reason).toBe('shows a path');
          expect(JSON.parse(replyReviewContext(input.originalPrompt, input.text)).operatorMessage).toBe('where is it?');
          return { state: 'complete', text: 'It is in your notes folder.', usage: { inputTokens: 10, outputTokens: 5, charge: null } };
        } },
      send: async input => { sends.push(input.expectedText); return sends.length; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'where is it?' } }]);
    await worker.drain();
    expect(revisions).toBe(1);
    expect(sends).toEqual(['PREVIEW — It is in your notes folder.']);
    expect(journal.view.calls).toBe(4);
    expect(journal.view.order[0]?.revisionReview).toEqual({ verdict: 'pass', ruleIds: [] });
    expect(journal.view.order[0]?.release).toMatchObject({ review: 'violation', objections: ['raw_path'], revised: true });
    worker.checkCoherence();
    const next = worker.probe('and then?');
    if (!('context' in next)) throw Error('expected a next-turn packet');
    // The surviving objection reaches the mind as a signal (Rule 86), not a verdict.
    expect(JSON.parse(next.context).corrections[0].findings[0]).toMatchObject({ rule: 86 });
    expect(JSON.parse(next.context).corrections[0].findings[0].possibleProblem).toContain('raw_path');
    journal.close();
    const replay = openPreviewJournal(path, key);
    await createJournalWorker(replay, { now: () => 1000, stopped: () => false, model: async () => { throw Error('model repeated'); },
      checkOutbound: () => {}, send: async () => { throw Error('send repeated'); },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { throw Error('review repeated'); }, revise: async () => { throw Error('revision repeated'); } } }).drain();
    expect(replay.view.order[0]?.sent).toBe(1);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Astra cint-2 MUST-FIX 1 (Rules 6, 8): a revision is a new candidate. Real-model shapes: the answer is the
// model's JSON reply naming a machine path; the revision drops the path but promises follow-up work the
// answer never declared. That untracked deferral must never be sent in place of the original.
const BILL_ANSWER = 'Your March electricity statement is saved at /Users/justin/Documents/Bills/pge-2026-03.pdf and shows $142.18 due on April 9.';
const BILL_REVISION = "I can't open the statement from here, so I don't have the exact amount yet. I'll pull up your March PG&E bill tonight and get back to you with what you owe.";
it.each([
  ['a held class on the revised text', 5, 'violation', undefined],
  ['an unavailable revised-text review', 5, 'unavailable', undefined],
  ['no call left for the revised-text review', 3, undefined, undefined],
  ['an interrupted revised-text review', 5, undefined, 'after:reply-revision-review-reserve'],
] as const)('keeps the original when the revision has %s, and never sends an untracked revised deferral', async (_name, maxCalls, verdict, crashAt) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-revision-held-')));
  const path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 }, crashAt === undefined ? undefined
      : stage => { if (stage === crashAt) throw Error('crash'); });
    const sends: string[] = [], reviewed: string[] = [];
    const ports = (journal: typeof first, fresh: boolean) => ({ now: () => 1790000000000, stopped: () => false,
      prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) =>
        prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', 1790000000000),
      model: async () => { if (!fresh) throw Error('model repeated'); return JSON.stringify({ reply: BILL_ANSWER, memory: [] }); },
      checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 0,
        jev: async () => { if (!fresh) throw Error('Jev repeated'); return { value: scores({ raw_path: 0.93 }), latencyMs: 0 }; },
        escalate: async (text: string, _id: string, _prompt?: string, _rules?: readonly string[], _deadline?: number, operation?: 'revision') => {
          if (!fresh) throw Error('review repeated');
          reviewed.push(text);
          if (operation !== 'revision') return { verdict: 'violation' as const, ruleIds: ['raw_path' as const], confidence: null,
            latencyMs: 0, reason: 'names a machine path the operator cannot open' };
          if (verdict === 'violation') return { verdict: 'violation' as const, ruleIds: ['defers_work' as const], confidence: null,
            latencyMs: 0, reason: 'promises to follow up tonight with no tracked commitment' };
          throw Error('reviewer unavailable'); },
        revise: async () => { if (!fresh) throw Error('revision repeated');
          return { state: 'complete' as const, text: BILL_REVISION, usage: { inputTokens: 900, outputTokens: 60, charge: null } }; } },
      send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } });
    const worker = createJournalWorker(first, ports(first, true));
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'How much do I owe on the electricity bill?' } }]);
    if (crashAt) await expect(worker.drain()).rejects.toThrow('crash'); else await worker.drain();
    first.close();
    // Replay (and recovery after the crash) never repeats a paid call and never sends the revision.
    const journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports(journal, false)).drain();
    const turn = journal.view.order[0]!;
    expect(sends).toEqual([`PREVIEW — ${BILL_ANSWER}`]);
    expect(sends.join('\n')).not.toContain("I'll pull up");
    expect(turn.sent).toBe(1);
    expect(turn.release).toMatchObject({ review: 'violation', revised: false });
    expect(turn.release?.objections).toContain('raw_path');
    expect(journal.view.commitments).toEqual([]);
    expect(turn.revision).toEqual({ state: 'complete', text: BILL_REVISION });
    expect(turn.revisionReview).toEqual(verdict === 'violation' ? { verdict, ruleIds: ['defers_work'],
      reason: 'promises to follow up tonight with no tracked commitment' }
      : verdict === 'unavailable' ? { verdict, ruleIds: [] } : undefined);
    expect(turn.revisionReviewReserved).toBe(maxCalls === 3 ? undefined : true);
    expect(journal.view.calls).toBe(maxCalls === 3 ? 3 : 4);
    expect(reviewed).toEqual(maxCalls === 3 || crashAt ? [`PREVIEW — ${BILL_ANSWER}`]
      : [`PREVIEW — ${BILL_ANSWER}`, `PREVIEW — ${BILL_REVISION}`]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never repeats an interrupted revision: restart releases the original with its objection', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-revision-crash-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 4, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 };
  try {
    const first = openPreviewJournal(path, key, genesis,
      stage => { if (stage === 'after:reply-revision-reserve') throw Error('crash'); });
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
      model: async () => 'Please do it yourself.', checkOutbound: () => {}, send: async () => 1,
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores({ parks_on_user: 0.91 }), latencyMs: 170 }),
        escalate: async () => ({ verdict: 'violation', ruleIds: ['parks_on_user'], confidence: null, latencyMs: 500 }),
        revise: async () => { throw Error('revision not reached'); } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await expect(worker.drain()).rejects.toThrow('crash');
    first.close();
    const second = openPreviewJournal(path, key);
    const sends: string[] = [];
    const recovered = createJournalWorker(second, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async input => { sends.push(input.expectedText); return 9; },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { throw Error('review repeated'); }, revise: async () => { throw Error('revision repeated'); } } });
    await recovered.drain();
    await recovered.drain();
    expect(sends).toEqual(['PREVIEW — Please do it yourself.']);
    expect(second.view.calls).toBe(3);
    // The interrupted response is UNKNOWN: no answer from the agent is invented for its objection.
    expect(second.view.order[0]?.release).toEqual({ review: 'violation', objections: ['parks_on_user'], revised: false,
      dispositions: [{ objection: 'parks_on_user', decision: 'no-decision' }] });
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('spends no revision past the existing call cap and releases the original with its objection', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-revision-cap-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
      model: async () => 'candidate', checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores({ raw_path: 0.91 }), latencyMs: 170 }),
        escalate: async () => ({ verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 500 }),
        revise: async () => { throw Error('revision past the cap'); } },
      send: async input => { sends.push(input.expectedText); return 1; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    expect(journal.view.calls).toBe(2);
    expect(journal.view.order[0]?.revisionReserved).toBeUndefined();
    expect(sends).toEqual(['PREVIEW — candidate']);
    // The skipped response is recorded as non-admission, never as an answer from the agent.
    expect(journal.view.order[0]?.release).toMatchObject({ responseSkipped: 'call cap',
      dispositions: [{ objection: 'raw_path', decision: 'no-decision' }] });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('replays answer, Jev, fallback and send times into status percentiles', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-times-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let clock = 1000;
    const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false,
      model: async () => { clock += 100; return 'candidate'; }, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => clock,
        jev: async () => { clock += 200; return { value: scores({ raw_path: 0.91 }), latencyMs: 200 }; },
        escalate: async () => { clock += 300; return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 300 }; } },
      send: async () => { clock += 400; return 7; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true);
    expect(replyTimings(replay.view)).toEqual({ budgetMs: REPLY_CHECK_BUDGET_MS,
      perReply: [{ update: 1, answerMs: 100, jevMs: 200, fallbackMs: 300, sendMs: 400 }],
      answer: { count: 1, p50Ms: 100, p95Ms: 100 }, jev: { count: 1, p50Ms: 200, p95Ms: 200 },
      fallback: { count: 1, p50Ms: 300, p95Ms: 300 }, send: { count: 1, p50Ms: 400, p95Ms: 400 } });
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('computes nearest-rank p50/p95 from measured stages only', () => {
  const view = { order: [
    { accepted: true, update: 1, answerMs: 100, replyChecks: [], sendMs: 10 },
    { accepted: true, update: 2, answerMs: 10, replyChecks: [], sendMs: 20 },
    { accepted: true, update: 3, answerMs: 20, replyChecks: [], sendMs: 30 },
    { accepted: true, update: 4 },
  ] } as unknown as JournalView;
  expect(replyTimings(view).answer).toEqual({ count: 3, p50Ms: 20, p95Ms: 100 });
  expect(replyTimings(view).jev).toEqual({ count: 0, p50Ms: null, p95Ms: null });
  expect(replyTimings(view).send).toEqual({ count: 3, p50Ms: 20, p95Ms: 30 });
});

it('excludes legacy recovery zeros but retains measured zero durations', () => {
  const check = (verdict: 'unavailable' | 'pass', durationMeasured?: true) => ({
    path: 'jev' as const, verdict, ruleIds: [], confidence: null, latencyMs: 0,
    ...(durationMeasured ? { durationMeasured } : {}) });
  const view = { order: [
    { accepted: true, update: 1, replyChecks: [check('unavailable')] },
    { accepted: true, update: 2, replyChecks: [check('unavailable', true)] },
    { accepted: true, update: 3, replyChecks: [check('pass')] },
  ] } as unknown as JournalView;
  expect(replyTimings(view).perReply.map(reply => reply.jevMs)).toEqual([null, 0, 0]);
  expect(replyTimings(view).jev).toEqual({ count: 2, p50Ms: 0, p95Ms: 0 });
});

it('records no send time for UNKNOWN, reads a legacy send-timing frame, and never repeats the send', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-unknown-send-time-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let clock = 1000;
    const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false,
      model: async () => 'candidate', checkOutbound: () => {},
      replyCheck: { elapsedMs: () => clock,
        jev: async () => ({ value: scores(), latencyMs: 10 }),
        escalate: async () => { throw Error('pass must not escalate'); } },
      send: async () => { clock += 75; return null; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    expect(replyTimings(journal.view).perReply[0]?.sendMs).toBeNull();
    // A journal written before the timing moved onto `sent` carries a separate frame.
    journal.append({ kind: 'send-timing', id: journal.view.order[0]!.id, latencyMs: 75, at: clock });
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replyTimings(replay.view).perReply[0]?.sendMs).toBe(75);
    expect(replay.view.order[0]?.intent).toBe('PREVIEW — candidate');
    expect(replay.view.order[0]?.sent).toBeUndefined();
    const recovered = createJournalWorker(replay, { now: () => clock, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async () => { throw Error('send repeated'); } });
    await recovered.drain();
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('releases an expired reserved check after restart without another review, recording the budget reason', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-expired-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'intake', id: 'turn:1', update: 1, text: 'hello', raw: '{}', accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id: 'turn:1', at: 1000 });
    journal.append({ kind: 'answer', id: 'turn:1', text: 'candidate', at: 1000 });
    journal.append({ kind: 'reply-jev-reserve', id: 'turn:1', at: 1000 });
    journal.close();
    const replay = openPreviewJournal(path, key);
    let invoked = 0; const sends: string[] = [];
    const worker = createJournalWorker(replay, { now: () => 1000 + REPLY_CHECK_BUDGET_MS,
      stopped: () => false, model: async () => { throw Error('answer repeated'); }, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 1000 + REPLY_CHECK_BUDGET_MS,
        jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { invoked++; throw Error('review repeated'); } },
      send: async input => { sends.push(input.expectedText); return 3; } });
    await worker.drain();
    await worker.drain();
    expect(invoked).toBe(0);
    // Rule 95: an advisory reviewer outage fails toward reachability, recorded, once.
    expect(sends).toEqual(['PREVIEW — candidate']);
    expect(replay.view.order[0]?.held).toBeUndefined();
    expect(replay.view.lastReplyCheck?.reason).toBe(REPLY_CHECK_BUDGET_REASON);
    expect(replay.view.order[0]?.release).toMatchObject({ review: 'unavailable', reason: REPLY_CHECK_BUDGET_REASON, revised: false });
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not reserve or dispatch review when stop arrives during Jev', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-stop-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let stopped = false, reviewed = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
      model: async () => 'candidate', checkOutbound: () => {}, send: async () => { throw Error('sent after stop'); },
      replyCheck: { elapsedMs: () => 100,
        jev: async () => { stopped = true; return { value: scores({ raw_path: 0.91 }), latencyMs: 170 }; },
        escalate: async () => { reviewed++; return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 500 }; } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await expect(worker.drain()).rejects.toThrow('preview stopped');
    expect(reviewed).toBe(0);
    expect(journal.view.calls).toBe(1);
    expect(journal.view.order[0]?.reviewReserved).toBeFalsy();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('grounds history and summary in the released reply actually sent and carries its objection', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-memory-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 5, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let summaryPacket: { history: { answer: string | null; outcome: string }[] } | undefined;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => {
        if (input.id.startsWith('summary:')) {
          summaryPacket = JSON.parse(input.context);
          return JSON.stringify({ summary: 'The reply was held.', people: [] });
        }
        return 'candidate with /private/rejected/path';
      }, checkOutbound: () => {}, send: async () => 5,
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores({ raw_path: 0.91 }), latencyMs: 170 }),
        escalate: async () => ({ verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 500 }) } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    const next = worker.probe('What did you send?');
    if (!('context' in next)) throw Error('expected a next-turn packet');
    expect(JSON.parse(next.context).history[0]).toMatchObject({ answer: 'candidate with /private/rejected/path',
      outcome: 'Telegram API accepted' });
    worker.checkCoherence();
    const flagged = worker.probe('And now?');
    if (!('context' in flagged)) throw Error('expected a next-turn packet');
    expect(JSON.parse(flagged.context).corrections[0].findings[0].possibleProblem).toContain('raw_path');
    await worker.summarizeIfNeeded(true);
    expect(summaryPacket?.history[0]).toMatchObject({ answer: 'candidate with /private/rejected/path',
      outcome: 'Telegram API accepted' });
    expect(journal.view.order[0]?.answer).toBe('candidate with /private/rejected/path');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('withholds credential-shaped text before Jev can receive it, with an honest shape notice', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-secret-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let sent = '';
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'Your API key is sk-AAAAAAAAAAAAAAAAAAAAAAAA',
      checkOutbound: text => { if (redact(text).count) throw Error('outbound secret refused'); },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('secret reached Jev'); },
        escalate: async () => { throw Error('secret reached review'); } },
      send: async input => { sent = input.expectedText; return 8; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    expect(sent).toBe(CREDENTIAL_SHAPE_NOTICE);
    expect(sent).not.toContain('sk-');
    expect(journal.view.order[0]?.release).toMatchObject({ review: 'violation', objections: ['credential'], revised: false });
    expect(journal.view.jevChecks).toBe(0);
    expect(journal.view.calls).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([
  ['clean revision', 'I cannot repeat that key here; it is stored in your vault.', 'PREVIEW — I cannot repeat that key here; it is stored in your vault.', 3],
  ['revision still shaped like a secret', 'It is sk-BBBBBBBBBBBBBBBBBBBBBBBB', CREDENTIAL_SHAPE_NOTICE, 2],
] as const)('credential shape: %s', async (_name, revised, expected, calls) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-secret-revise-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 3, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    let sent = '', seen = '';
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
      model: async () => 'Your API key is sk-AAAAAAAAAAAAAAAAAAAAAAAA',
      checkOutbound: text => { if (redact(text).count) throw Error('outbound secret refused'); },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('secret reached Jev'); },
        // Only a clean revised candidate reaches the held-class review; the secret never does.
        escalate: async (text, _id, _prompt, _rules, _deadline, operation) => {
          if (operation !== 'revision' || redact(text).count) throw Error('secret reached review');
          return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 400 }; },
        revise: async input => { seen = input.text; return { state: 'complete', text: revised }; } },
      send: async input => { sent = input.expectedText; return 8; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    // The mind sees a redacted draft only; the exact shape floor runs again on its revision.
    expect(seen).not.toContain('sk-AAAA');
    expect(sent).toBe(expected);
    expect(journal.view.jevChecks).toBe(0);
    expect(journal.view.calls).toBe(calls);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('escalates an interrupted Jev check without repeating Jev after restart', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-crash-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 };
  try {
    const first = openPreviewJournal(path, key, genesis,
      stage => { if (stage === 'after:reply-jev-reserve') throw Error('crash'); });
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => 'candidate', checkOutbound: () => {}, send: async () => 1,
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('must not reach Jev'); },
        escalate: async () => { throw Error('must not reach fallback'); } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await expect(worker.drain()).rejects.toThrow('crash');
    first.close();
    const second = openPreviewJournal(path, key);
    let sent = '', reviewed = 0;
    const recovered = createJournalWorker(second, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model must not repeat'); }, checkOutbound: () => {},
      send: async input => { sent = input.expectedText; return 7; },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev must not repeat'); },
        escalate: async () => { reviewed++; return { verdict: 'pass', ruleIds: [] as [], confidence: null, latencyMs: 500 }; } } });
    await recovered.drain();
    expect(sent).toBe('PREVIEW — candidate');
    expect(reviewed).toBe(1);
    expect(second.view.jevChecks).toBe(1);
    expect(second.view.calls).toBe(2);
    expect(second.view.order[0]?.sent).toBe(7);
    expect(replyTimings(second.view).perReply[0]?.jevMs).toBeNull();
    expect(replyTimings(second.view).jev).toEqual({ count: 0, p50Ms: null, p95Ms: null });
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('reviews every rule after reopening a pre-upgrade mixed Jev verdict', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-legacy-')));
  const path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    const intake = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model must not run'); }, checkOutbound: () => {},
      send: async () => { throw Error('send must not run'); } });
    intake.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    const id = first.view.order[0]!.id;
    const prompt = prepareJournalEnvelope({ question: 'hello',
      context: JSON.stringify({ audience: { operator: 'verified' }, history: [] }), id },
    'claude-sonnet-4-5', 'grant:preview', 1000);
    first.append({ kind: 'reserve', id, prompt, at: 1000 });
    first.append({ kind: 'answer', id, text: 'Please handle this yourself.', state: 'complete', at: 1000 });
    first.append({ kind: 'reply-jev-reserve', id, at: 1000 });
    // Base-format mixed verdicts retained uncertain scores but only positive rule IDs.
    first.append({ kind: 'reply-check', id, result: { verdict: 'violation', ruleIds: ['raw_path'],
      confidence: 0.91, path: 'jev', latencyMs: 170,
      scores: Object.fromEntries(Object.keys(REPLY_RULES).map(rule =>
        [rule, rule === 'raw_path' ? 0.91 : rule === 'parks_on_user' ? 0.5 : 0.01])) as Record<keyof typeof REPLY_RULES, number> }, at: 1000 });
    first.close();

    const second = openPreviewJournal(path, key);
    let sent = '', reviews = 0;
    const recovered = createJournalWorker(second, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async input => { sent = input.expectedText; return 7; },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev repeated'); },
        escalate: async (text, _id, originalPrompt, ruleIds) => {
          reviews++;
          expect(ruleIds).toEqual(Object.keys(REPLY_RULES));
          expect(JSON.parse(replyReviewContext(originalPrompt!, text))).toMatchObject({
            audience: { operator: 'verified' }, operatorMessage: 'hello' });
          return { verdict: 'violation', ruleIds: ['parks_on_user'], confidence: null, latencyMs: 500 };
        } } });
    await recovered.drain();
    expect(reviews).toBe(1);
    expect(sent).toBe('PREVIEW — Please handle this yourself.');
    expect(second.view.order[0]?.release).toMatchObject({ review: 'violation', objections: ['parks_on_user'] });
    expect(second.view.lastReplyCheck?.ruleIds).toEqual(['parks_on_user']);
    expect(second.view.calls).toBe(2);
    expect(second.view.jevChecks).toBe(1);
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not repeat an interrupted paid review and releases the candidate once with the review recorded unavailable', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-crash-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 };
  try {
    const first = openPreviewJournal(path, key, genesis,
      stage => { if (stage === 'after:reply-review-reserve') throw Error('crash'); });
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => 'candidate', checkOutbound: () => {}, send: async () => 1,
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores({ raw_path: 0.91 }), latencyMs: 170 }),
        escalate: async () => { throw Error('review not reached'); } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await expect(worker.drain()).rejects.toThrow('crash');
    first.close();
    const second = openPreviewJournal(path, key);
    const sent: string[] = [];
    const recovered = createJournalWorker(second, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async input => { sent.push(input.expectedText); return 9; },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { throw Error('review repeated'); } } });
    await recovered.drain();
    await recovered.drain();
    expect(sent).toEqual(['PREVIEW — candidate']);
    expect(second.view.calls).toBe(2);
    expect(second.view.lastReplyCheck?.path).toBe('subscription');
    expect(second.view.lastReplyCheck?.verdict).toBe('unavailable');
    expect(second.view.order[0]?.answer).toBe('candidate');
    expect(second.view.order[0]?.intent).toBe('PREVIEW — candidate');
    expect(second.view.order[0]?.held).toBeUndefined();
    expect(second.view.order[0]?.release).toMatchObject({ review: 'unavailable', revised: false });
    expect(replyTimings(second.view).perReply[0]?.fallbackMs).toBeNull();
    expect(replyTimings(second.view).fallback).toEqual({ count: 0, p50Ms: null, p95Ms: null });
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('answers a long, summarized conversation when Jev is unsure: grounded review decides', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-summary-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 16384, cursor: 0 });
    const reviewed: { historyMode: string; summary?: { text: string }; operatorMessage: string; candidateReply: string; history: unknown[]; rules: Record<string, string> }[] = [];

    const sent: string[] = [];
    let jevMemoryChecks = 0;
    // "recall" is not in any operator message, so this reply stays off the exact operator-echo path and the review stays under test.
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      // A minimal envelope in the launcher's shape, so review reads the exact grounding packet.
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The first unique memory was orchid.', people: [] })
        : input.context.includes('orchid') && input.question.includes('first unique memory') ? 'I recall it was orchid.' : 'ok',
      checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return input.update; },
      replyCheck: { elapsedMs: () => 100,
        jev: async (text, questions) => ({ value: questions
          ? { model: 'jev-1.13.0', answers: { summary_integrity: { type: 'noul', noul: 0.05 } } }
          : text.includes('orchid') && ++jevMemoryChecks === 1
            ? scores({ claims_blocked: 0.5 }) : scores(), latencyMs: 150 }),
        escalate: async (text, _id, originalPrompt, ruleIds) => {
          reviewed.push(JSON.parse(replyReviewContext(originalPrompt!, text, ruleIds)));

          return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 400 };
        } } });
    for (let i = 0; i < 32; i++) {
      worker.intake([{ update_id: i + 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        text: i === 0 ? 'orchid is the first unique memory.' : `turn ${i} ${'a'.repeat(450)}` } }]);
      await worker.drain(); await worker.summarizeIfNeeded();
    }
    expect(journal.view.summaries.length).toBeGreaterThan(0);
    worker.intake([{ update_id: 33, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'What was the first unique memory?' } }]);
    await worker.drain();
    const last = journal.view.order.at(-1)!;
    expect(sent.at(-1)).toBe('PREVIEW — I recall it was orchid.');
    expect(last.sent).toBe(33);
    expect(last.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['jev', 'unsure'], ['subscription', 'pass']]);
    // The deciding review sees the summary even when earlier turns leave recent history.
    expect(reviewed).toHaveLength(1);
    expect(reviewed[0]).toMatchObject({ operatorMessage: 'What was the first unique memory?',
      candidateReply: 'PREVIEW — I recall it was orchid.' });
    expect(reviewed[0]!.summary!.text).toContain('orchid');
    expect(reviewed[0]!.history).toBeDefined();
    expect(reviewed[0]!.rules).toEqual({ claims_blocked: REPLY_RULES.claims_blocked });
    worker.intake([{ update_id: 34, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Please repeat the first unique memory.' } }]);
    await worker.drain();
    const pass = journal.view.order.at(-1)!;
    expect(sent.at(-1)).toBe('PREVIEW — I recall it was orchid.');
    expect(pass.sent).toBe(34);
    expect(pass.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['jev', 'pass']]);
    expect(reviewed).toHaveLength(1);
    expect(jevMemoryChecks).toBe(2);
    expect(journal.view.order.every(turn => turn.held === undefined && turn.sent !== undefined)).toBe(true);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.replyCheckPaths.subscription).toBe(1);
    expect(replay.view.replyCheckPaths.jev).toBe(34);
    expect(replay.view.replyCheckCounts.unsure).toBe(1);
    expect(replay.view.lastReplyCheck).toMatchObject({ path: 'jev', verdict: 'pass' });
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const outageGenesis = (maxCalls: number) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls, maxReplies: 4, maxTurns: 4, maxBytes: 32768, cursor: 0 });
const hello = [{ update_id: 1, message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text: 'hello' } }];

it('sends the reply once when Jev and the full-context review both fail; a restart never repeats it', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-outage-')));
  const path = join(root, 'journal.encrypted');
  try {
    const sends: string[] = [];
    const ports = { now: () => 1000, stopped: () => false, model: async () => 'candidate', checkOutbound: () => {},
      send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return 1; },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('timeout'); },
        escalate: async () => { throw Error('provider unavailable'); } } };
    const first = openPreviewJournal(path, key, outageGenesis(4));
    const worker = createJournalWorker(first, ports);
    worker.intake(hello);
    await worker.drain();
    expect(sends).toEqual(['PREVIEW — candidate']);
    expect(first.view.order[0]?.held).toBeUndefined();
    expect(first.view.order[0]?.release).toMatchObject({ review: 'unavailable', reason: 'review unavailable' });
    first.close();
    const second = openPreviewJournal(path, key);
    await createJournalWorker(second, { ...ports, model: async () => { throw Error('model repeated'); },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { throw Error('review repeated'); } } }).drain();
    expect(sends).toEqual(['PREVIEW — candidate']);
    expect(second.view.order[0]?.answer).toBe('candidate');
    expect(second.view.calls).toBe(2);
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds at the shared call cap and answers with a completed review after an authorized cap raise', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-cap-')));
  const path = join(root, 'journal.encrypted');
  try {
    const sends: string[] = [];
    let reviewed = 0;
    const journal = openPreviewJournal(path, key, outageGenesis(2));
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'candidate', checkOutbound: () => {},
      send: async input => { sends.push(input.expectedText); return 1; },
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores({ parks_on_user: 0.5 }), latencyMs: 160 }),
        escalate: async () => { reviewed++; return { verdict: 'pass', ruleIds: [] as [], confidence: null, latencyMs: 500 }; } } });
    worker.intake(hello);
    await worker.drain();
    expect(journal.view.calls).toBe(2);
    expect(reviewed).toBe(1);
    expect(sends).toEqual(['PREVIEW — candidate']);
    worker.intake([{ update_id: 2, message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text: 'again' } }]);
    await worker.drain();
    // The capped message gets one limited answer from the reserve (Rule 15), not silence.
    expect(sends).toHaveLength(2);
    expect(sends[1]).toContain("I can't answer yet");
    expect(journal.view.order[1]?.held).toBe('call cap');
    raiseJournalCaps(journal, { maxCalls: 4, maxReplies: 4, maxTurns: 4, authority: 'test: operator raise', at: 2000 });
    await worker.drain();
    expect(journal.view.order[1]?.answer).toBe('candidate');
    expect(reviewed).toBe(2);
    expect([sends[0], sends[2]]).toEqual(['PREVIEW — candidate', 'PREVIEW — candidate']);
    expect(sends).toHaveLength(3);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('shares one budget across Jev and fallback, releasing only a verdict within it', async () => {
  for (const late of [false, true]) {
    let now = 1000, requestedDeadline = 0, reviews = 0;
    const records: ReplyCheckResult[] = [];
    const result = await checkReply('candidate', 'turn:1', {
      now: () => now, deadlineAt: now + REPLY_CHECK_BUDGET_MS, elapsedMs: () => now,
      jev: async (_text, _questions, timeout) => {
        expect(timeout).toBe(REPLY_CHECK_BUDGET_MS);
        now += 2000;
        return { value: scores({ raw_path: 0.91 }), latencyMs: 2000 };
      },
      reserveEscalation: () => true,
      escalate: async (_text, _id, _prompt, _rules, deadline) => {
        reviews++; requestedDeadline = deadline ?? 0;
        now += late ? REPLY_CHECK_BUDGET_MS : 1000;
        return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: late ? REPLY_CHECK_BUDGET_MS : 1000 };
      }, record: row => records.push(row),
    });
    expect(reviews).toBe(1);
    expect(requestedDeadline).toBe(1000 + REPLY_CHECK_BUDGET_MS);
    expect(result.outcome).toBe(late ? 'unavailable' : 'pass');
    expect(records.at(-1)?.reason).toBe(late ? REPLY_CHECK_BUDGET_REASON : undefined);
  }
});

it('keeps a reviewer VIOLATION that returns after the deadline (Rule 42), while a late pass stays unavailable', async () => {
  let now = 1000;
  const records: ReplyCheckResult[] = [];
  const result = await checkReply('candidate', 'turn:1', {
    now: () => now, deadlineAt: now + REPLY_CHECK_BUDGET_MS, elapsedMs: () => now,
    jev: async () => ({ value: scores({ claims_blocked: 0.91 }), latencyMs: 100 }),
    reserveEscalation: () => true,
    escalate: async () => { now += REPLY_CHECK_BUDGET_MS + 1;
      return { verdict: 'violation', ruleIds: ['claims_blocked'], confidence: null, latencyMs: REPLY_CHECK_BUDGET_MS + 1 }; },
    record: row => records.push(row),
  });
  expect(result.outcome).toBe('violation');
  expect(records.at(-1)).toMatchObject({ verdict: 'violation', ruleIds: ['claims_blocked'], path: 'subscription' });
});

it('does not reserve fallback after Jev consumes the entire budget', async () => {
  let now = 1000, reviews = 0;
  const records: ReplyCheckResult[] = [];
  const result = await checkReply('candidate', 'turn:1', {
    now: () => now, deadlineAt: now + REPLY_CHECK_BUDGET_MS, elapsedMs: () => now,
    jev: async () => { now += REPLY_CHECK_BUDGET_MS; return { value: scores(), latencyMs: REPLY_CHECK_BUDGET_MS }; },
    reserveEscalation: () => { reviews++; return true; },
    escalate: async () => { throw Error('late review dispatched'); }, record: row => records.push(row),
  });
  expect(result.outcome).toBe('unavailable');
  expect(reviews).toBe(0);
  expect(records.at(-1)?.reason).toBe(REPLY_CHECK_BUDGET_REASON);
});

it('gives review the original audience, sources, history and operator message', () => {
  const context = { audience: { operator: 'verified' }, sources: [{ id: 'source:1' }],
    history: [{ update: 1, user: 'remember this' }], now: 1000 };
  const prompt = prepareJournalEnvelope({ question: 'What did I say?', context: JSON.stringify(context), id: 'turn:2' },
    'claude-sonnet-4-5', 'grant:test', 1000);
  expect(JSON.parse(replyReviewContext(prompt, 'PREVIEW — candidate'))).toEqual({
    ...context, operatorMessage: 'What did I say?', candidateReply: 'PREVIEW — candidate', rules: REPLY_RULES });
});

// OR1 (ruling 2 section C): independent contextual results, one agent response per objection, a shared
// deadline and honest records (Rules 4, 41, 57, 58, 86, 95, 108).
it('reads one contextual finding per selected rule, refuses a dropped or added rule, and keeps the legacy line finding-free', () => {
  const both: ReplyRule[] = ['raw_path', 'defers_work'];
  expect(parseReplyReviewVerdict('raw_path: PASS | The operator asked for this exact path.\ndefers_work: VIOLATION | Promises a later check with no loop.', both))
    .toEqual({ verdict: 'violation', ruleIds: ['defers_work'], reason: 'defers_work: Promises a later check with no loop.',
      findings: [{ rule: 'raw_path', verdict: 'pass', reason: 'The operator asked for this exact path.' },
        { rule: 'defers_work', verdict: 'violation', reason: 'Promises a later check with no loop.' }] });
  expect(parseReplyReviewVerdict('defers_work: PASS | Tracked.\nraw_path: PASS | Requested.', both)).toMatchObject({ verdict: 'pass', ruleIds: [] });
  for (const value of ['raw_path: PASS | fine', 'raw_path: PASS | a\ndefers_work: PASS | b\ncredential: PASS | c',
    'raw_path: PASS | a\nraw_path: VIOLATION | b', 'raw_path: MAYBE | a\ndefers_work: PASS | b', 'raw_path: PASS | a\nextra text'])
    expect(() => parseReplyReviewVerdict(value, both), value).toThrow('malformed');
  // A new live review (rules selected) must answer per rule: a combined line drops the other rules' results.
  for (const value of ['VIOLATION:raw_path | shows a path', 'PASS | all fine'])
    expect(() => parseReplyReviewVerdict(value, both), value).toThrow('malformed');
  // A historical combined line is still read, but carries no per-rule findings: one shared reason is not an independent result.
  expect(parseReplyReviewVerdict('VIOLATION:raw_path | shows a path')).toMatchObject({ verdict: 'violation', ruleIds: ['raw_path'] });
  expect(parseReplyReviewVerdict('VIOLATION:raw_path | shows a path').findings).toBeUndefined();
  expect(replyReviewQuestion(both)).toContain('exactly one line for every listed rule');
});

it('reads the agent response per objection: accept, reject with a reason, otherwise no decision', () => {
  const objections = ['raw_path', 'parks_on_user', BARE_TOPIC_OBJECTION];
  expect(parseReplyRevision(JSON.stringify({ reply: 'Revised.', dispositions: {
    raw_path: { decision: 'accept' }, parks_on_user: { decision: 'reject', reason: 'The operator asked to do it.' },
    [BARE_TOPIC_OBJECTION]: { decision: 'reject' }, invented: { decision: 'accept' } } }), objections)).toEqual({ text: 'Revised.',
    dispositions: [{ objection: 'raw_path', decision: 'accept' },
      { objection: 'parks_on_user', decision: 'reject', reason: 'The operator asked to do it.' },
      // A rejection with no reason is not a recorded rejection.
      { objection: BARE_TOPIC_OBJECTION, decision: 'no-decision' }] });
  expect(parseReplyRevision('Plain revised text.', objections)).toEqual({ text: 'Plain revised text.', dispositions: noDecisions(objections) });
  expect(validDispositions(noDecisions(objections), objections)).toBe(true);
  expect(validDispositions([{ objection: 'raw_path', decision: 'reject' }], ['raw_path'])).toBe(false);
  expect(validDispositions([{ objection: 'raw_path', decision: 'accept' }], ['raw_path', 'parks_on_user'])).toBe(false);
  expect(replyRevisionQuestion(objections)).toContain('"dispositions"');
  expect(replyRevisionQuestion(objections)).toContain('named topic only by its number');
  // Plan #104: a cannot-do objection asks for the answer's own investigation record, carried back unvalidated.
  expect(replyRevisionQuestion(objections)).not.toContain('"blocker"');
  expect(replyRevisionQuestion(['unrecorded_blocker'])).toContain('"blocker": {"kind"');
  const record = { kind: 'cannot-do', claim: 'I can’t pay it: I have no accounts.' };
  expect(parseReplyRevision(JSON.stringify({ reply: 'I can’t pay it: I have no accounts.', dispositions: {}, blocker: record }),
    ['unrecorded_blocker']).blocker).toEqual(record);
  expect(parseReplyRevision('plain text', ['unrecorded_blocker']).blocker).toBeUndefined();
});

type Flow = { jev?: Record<string, number>; jevDown?: true; review?: 'pass' | 'violation' | 'down'; findings?: ReplyFinding[];
  revise?: { text: string; dispositions?: ObjectionDisposition[] }; clockJump?: number; answer?: string };
async function flow(options: Flow, crashAt?: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-or1-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 };
  const calls = { jev: 0, review: 0, revisionReview: 0, revise: 0 }, sends: string[] = [], clock = { now: 1790000000000 };
  const ports = (fresh: boolean) => ({ now: () => clock.now, stopped: () => false,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
    model: async () => { if (!fresh) throw Error('model repeated'); return options.answer ?? 'Set notifications.email.enabled to on.'; },
    checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 0,
      jev: async () => { if (!fresh) throw Error('Jev repeated'); calls.jev++;
        if (options.jevDown) throw Error('Jev down'); return { value: scores(options.jev ?? {}), latencyMs: 0 }; },
      escalate: async (_text: string, _id: string, _prompt?: string, rules?: readonly ReplyRule[], _deadline?: number, operation?: 'revision') => {
        if (!fresh) throw Error('review repeated');
        if (operation === 'revision') { calls.revisionReview++; return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 0 }; }
        calls.review++; clock.now += options.clockJump ?? 0;
        if (options.review === 'down') throw Error('reviewer unavailable');
        const findings = options.findings ?? (rules ?? []).map(rule => ({ rule, verdict: options.review === 'violation' ? 'violation' as const : 'pass' as const, reason: `about ${rule}` }));
        const violations = findings.filter(item => item.verdict === 'violation');
        return { verdict: violations.length ? 'violation' as const : 'pass' as const, ruleIds: violations.map(item => item.rule), confidence: null,
          latencyMs: 0, reason: violations.map(item => item.reason).join('; ') || 'fine', findings };
      },
      revise: async (input: { objections?: string[]; deadlineAt?: number }) => { if (!fresh) throw Error('revision repeated'); calls.revise++;
        expect(input.deadlineAt).toBe(1790000000000 + REPLY_CHECK_BUDGET_MS);
        if (!options.revise) throw Error('reviser unavailable');
        return { state: 'complete' as const, text: options.revise.text, ...(options.revise.dispositions ? { dispositions: options.revise.dispositions } : {}) }; } },
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } });
  try {
    const first = openPreviewJournal(path, key, genesis, crashAt === undefined ? undefined : stage => { if (stage === crashAt) throw Error('crash'); });
    const worker = createJournalWorker(first, ports(true));
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'what is the email notification setting called?' } }]);
    if (crashAt) await expect(worker.drain()).rejects.toThrow('crash'); else await worker.drain();
    first.close();
    // Restart: nothing paid and nothing sent is ever dispatched twice.
    const journal = openPreviewJournal(path, key);
    const again = createJournalWorker(journal, ports(false));
    await again.drain(); await again.drain();
    const turn = journal.view.order[0]!;
    const result = { turn, sends, calls, checks: turn.replyChecks ?? [] };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const DRAFT = 'PREVIEW — Set notifications.email.enabled to on.';

it('a clear pass sends the draft with no review, response or release record', async () => {
  const { sends, calls, turn } = await flow({ answer: 'They are in your notes app.' });
  expect(sends).toEqual(['PREVIEW — They are in your notes app.']);
  expect(calls).toEqual({ jev: 1, review: 0, revisionReview: 0, revise: 0 });
  expect(turn.release).toBeUndefined();
});

it('a contextual false positive: Jev flags the setting key, the contextual finding clears it with its own reason, and the draft goes as written', async () => {
  const { sends, calls, turn, checks } = await flow({ jev: { config_key: 0.93 },
    findings: [{ rule: 'config_key', verdict: 'pass', reason: 'The operator asked for the setting by name; the key is the answer.' }] });
  expect(sends).toEqual([DRAFT]);
  expect(calls).toMatchObject({ review: 1, revise: 0 });
  expect(turn.release).toBeUndefined();
  expect(checks.at(-1)).toMatchObject({ path: 'subscription', verdict: 'pass',
    findings: [{ rule: 'config_key', verdict: 'pass', reason: 'The operator asked for the setting by name; the key is the answer.' }] });
});

it('a real advisory flaw: the agent accepts it, the revision is revalidated and sent, and the acceptance is recorded', async () => {
  const { sends, calls, turn } = await flow({ jev: { config_key: 0.93 }, review: 'violation',
    revise: { text: 'Turn on email notifications in your settings.', dispositions: [{ objection: 'config_key', decision: 'accept' }] } });
  expect(sends).toEqual(['PREVIEW — Turn on email notifications in your settings.']);
  expect(calls).toEqual({ jev: 1, review: 1, revisionReview: 1, revise: 1 });
  expect(turn.revision?.dispositions).toEqual([{ objection: 'config_key', decision: 'accept' }]);
  expect(turn.release).toMatchObject({ review: 'violation', objections: ['config_key'], revised: true,
    dispositions: [{ objection: 'config_key', decision: 'accept' }] });
});

it('a recorded rejection: the agent keeps its draft with a reason, no second review is spent, and the reason is kept', async () => {
  const reason = 'The operator asked for the exact setting name.';
  const { sends, calls, turn } = await flow({ jev: { config_key: 0.93 }, review: 'violation',
    revise: { text: 'Set notifications.email.enabled to on.', dispositions: [{ objection: 'config_key', decision: 'reject', reason }] } });
  expect(sends).toEqual([DRAFT]);
  expect(calls).toEqual({ jev: 1, review: 1, revisionReview: 0, revise: 1 });
  expect(turn.release).toEqual({ review: 'violation', objections: ['config_key'], reason: 'about config_key', revised: false,
    dispositions: [{ objection: 'config_key', decision: 'reject', reason }] });
});

it('a review outage releases an advisory-only draft once with no decision recorded, and holds a credential flag with its input kept', async () => {
  const advisory = await flow({ jev: { config_key: 0.93 }, review: 'down' });
  expect(advisory.sends).toEqual([DRAFT]);
  expect(advisory.calls).toMatchObject({ review: 1, revise: 0 });
  expect(advisory.turn.release).toEqual({ review: 'unavailable', objections: ['config_key'], reason: 'review unavailable', revised: false,
    dispositions: [{ objection: 'config_key', decision: 'no-decision' }] });
  const mandatory = await flow({ jev: { credential: 0.8 }, review: 'down', answer: 'Your gym code is written down.' });
  expect(mandatory.sends).toEqual([]);
  expect(mandatory.turn.held).toBe('reply check unavailable');
  expect(mandatory.turn.intent).toBeUndefined();
  expect(mandatory.calls).toMatchObject({ review: 1, revise: 0 });
});

it('one shared deadline: after escalation spends it, no response is asked for and the objection is released with no decision', async () => {
  const { sends, calls, turn } = await flow({ jev: { config_key: 0.93 }, review: 'violation', clockJump: REPLY_CHECK_BUDGET_MS,
    revise: { text: 'unused', dispositions: [{ objection: 'config_key', decision: 'accept' }] } });
  // The late VIOLATION is kept (Rule 42) but no revision starts past the deadline.
  expect(sends).toEqual([DRAFT]);
  expect(calls).toMatchObject({ review: 1, revise: 0 });
  expect(turn.revisionReserved).toBeUndefined();
  expect(turn.release).toMatchObject({ review: 'violation', revised: false, dispositions: [{ objection: 'config_key', decision: 'no-decision' }],
    responseSkipped: 'deadline' });
});

it('a held candidate interrupted after its correction was reserved restarts without repeating it and sends the holding notice once', async () => {
  const { sends, calls, turn } = await flow({ jev: { credential: 0.8 }, review: 'violation', answer: 'Give Sam your gym code 4417.',
    findings: [{ rule: 'credential', verdict: 'violation', reason: 'Passes the operator\'s code to another person.' }],
    revise: { text: 'unused' } }, 'after:reply-revision-reserve');
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(calls).toEqual({ jev: 1, review: 1, revisionReview: 0, revise: 0 });
  expect(turn.revisionReserved).toBe(true);
  expect(turn.revision).toBeUndefined();
  expect(turn.heldReview).toEqual({ objections: ['credential'], reason: 'Passes the operator\'s code to another person.',
    dispositions: [{ objection: 'credential', decision: 'no-decision' }] });
});
