import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkReply, HOLDING_REPLY, interpretJev, jevQuestions, REPLY_RULES, replyReviewContext, replyReviewQuestion, replyReviewRules, parseReplyReviewVerdict, parseJevResponse, JEV_RESPONSE_MAX_BYTES, REPLY_CHECK_BUDGET_MS, REPLY_CHECK_BUDGET_REASON } from './reply-check.js';


import type { ReplyCheckResult } from './reply-check.js';
import { redact } from '../../src/recall/redact.js';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal-test-worker.js';
import { replyTimings, type JournalView } from './journal.js';
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

it('keeps the turn pending, never sending unchecked, when review cannot be reserved', async () => {
  const records: ReplyCheckResult[] = [];
  const result = await checkReply('PREVIEW — candidate', 'turn:1', {
    elapsedMs: () => 100, jev: async () => ({ value: scores({ parks_on_user: 0.5 }), latencyMs: 160 }),
    reserveEscalation: () => false, escalate: async () => { throw Error('must not call'); }, record: row => records.push(row),
  });
  expect(result).toEqual({ outcome: 'unavailable', path: 'holding', capRefused: true });
  expect(records.at(-1)?.path).toBe('holding');
});

it('keeps the turn pending, never sending unchecked, when Jev and the full-context review both fail', async () => {
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
    'VIOLATION:credential,credential | reason', 'PASS | reason\nextra', 'PASS | ' + 'x'.repeat(161)])
    expect(() => parseReplyReviewVerdict(value)).toThrow('malformed');
});

it('asks both reviewers to distinguish operator-supplied personal facts from authentication secrets', () => {
  expect(jevQuestions.credential?.instructions).toBe(REPLY_RULES.credential);
  expect(REPLY_RULES.credential).toMatch(/short personal code or fact.*not a credential/u);
  expect(REPLY_RULES.credential).toMatch(/same private chat/u);
  expect(REPLY_RULES.credential).toMatch(/authentication secret remains a violation even if the operator supplied it/u);
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

it('sends an operator-supplied personal code after a full-context false-positive review', async () => {
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
    expect(reviewed).toBe(true);
    expect(reviewContext).toMatchObject({ operatorMessage: 'What is my gym locker code?',
      candidateReply: 'PREVIEW — Your gym locker code is 3310.' });
    expect(JSON.stringify(reviewContext?.history)).toContain('My gym locker code is 3310.');
    expect(sent).toBe('PREVIEW — Your gym locker code is 3310.');
    expect(journal.view.lastReplyCheck).toMatchObject({ verdict: 'pass', path: 'subscription' });
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

it('durably checks before intent, sends a holding reply on violation, and replays counts', async () => {
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
        escalate: async () => ({ verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 500 }) },
      send: async input => { exact = input.expectedText; expect(journal.view.lastReplyCheck?.verdict).toBe('violation');
        expect(journal.view.order[0]?.intent).toBe(HOLDING_REPLY); return 5; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    expect(exact).toBe(HOLDING_REPLY);
    expect(journal.view.calls).toBe(2);
    journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true);
    expect(replay.view.replyCheckCounts.violation).toBe(2);
    expect(replay.view.lastReplyCheck?.ruleIds).toEqual(['raw_path']);
    expect(replay.view.lastReplyCheck?.path).toBe('subscription');
    replay.close();
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

it('holds an expired reserved check after restart without another review or send', async () => {
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
    let invoked = 0;
    const worker = createJournalWorker(replay, { now: () => 1000 + REPLY_CHECK_BUDGET_MS,
      stopped: () => false, model: async () => { throw Error('answer repeated'); }, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 1000 + REPLY_CHECK_BUDGET_MS,
        jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { invoked++; throw Error('review repeated'); } },
      send: async () => { invoked++; throw Error('send attempted'); } });
    await worker.drain();
    expect(invoked).toBe(0);
    expect(replay.view.order[0]?.held).toBe(REPLY_CHECK_BUDGET_REASON);
    expect(replay.view.lastReplyCheck?.reason).toBe(REPLY_CHECK_BUDGET_REASON);
    expect(replay.view.order[0]?.intent).toBeUndefined();
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

it('grounds history and summary in the holding reply actually sent', async () => {
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
    expect(JSON.parse(next.context).history[0]).toMatchObject({ answer: HOLDING_TEXT,
      outcome: 'holding reply delivered after review violation' });
    await worker.summarizeIfNeeded(true);
    expect(summaryPacket?.history[0]).toMatchObject({ answer: HOLDING_TEXT,
      outcome: 'holding reply delivered after review violation' });
    expect(journal.view.order[0]?.answer).toBe('candidate with /private/rejected/path');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a detected credential before Jev can receive it', async () => {
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
    expect(sent).toBe(HOLDING_REPLY);
    expect(journal.view.jevChecks).toBe(0);
    expect(journal.view.calls).toBe(1);
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
    expect(sent).toBe(HOLDING_REPLY);
    expect(second.view.order[0]?.intent).toBe(HOLDING_REPLY);
    expect(second.view.lastReplyCheck?.ruleIds).toEqual(['parks_on_user']);
    expect(second.view.calls).toBe(2);
    expect(second.view.jevChecks).toBe(1);
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not repeat an interrupted paid review and holds the candidate instead of sending it unchecked', async () => {
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
    let sent = '';
    const recovered = createJournalWorker(second, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async input => { sent = input.expectedText; return 9; },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { throw Error('review repeated'); } } });
    await recovered.drain();
    await recovered.drain();
    expect(sent).toBe('');
    expect(second.view.calls).toBe(2);
    expect(second.view.lastReplyCheck?.path).toBe('subscription');
    expect(second.view.lastReplyCheck?.verdict).toBe('unavailable');
    expect(second.view.order[0]?.intent).toBeUndefined();
    expect(second.view.order[0]?.answer).toBe('candidate');
    expect(second.view.order[0]?.held).toBe('reply check unavailable');
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
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      // A minimal envelope in the launcher's shape, so review reads the exact grounding packet.
      prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
        { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The first unique memory was ORCHID.', people: [] })
        : input.context.includes('ORCHID') && input.question.includes('first unique memory') ? 'It was ORCHID.' : 'ok',
      checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return input.update; },
      replyCheck: { elapsedMs: () => 100,
        jev: async (text, questions) => ({ value: questions
          ? { model: 'jev-1.13.0', answers: { summary_integrity: { type: 'noul', noul: 0.05 } } }
          : text.includes('ORCHID') && ++jevMemoryChecks === 1
            ? scores({ claims_blocked: 0.5 }) : scores(), latencyMs: 150 }),
        escalate: async (text, _id, originalPrompt, ruleIds) => {
          reviewed.push(JSON.parse(replyReviewContext(originalPrompt!, text, ruleIds)));

          return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 400 };
        } } });
    for (let i = 0; i < 32; i++) {
      worker.intake([{ update_id: i + 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        text: i === 0 ? 'ORCHID is the first unique memory.' : `turn ${i} ${'a'.repeat(450)}` } }]);
      await worker.drain(); await worker.summarizeIfNeeded();
    }
    expect(journal.view.summaries.length).toBeGreaterThan(0);
    worker.intake([{ update_id: 33, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'What was the first unique memory?' } }]);
    await worker.drain();
    const last = journal.view.order.at(-1)!;
    expect(sent.at(-1)).toBe('PREVIEW — It was ORCHID.');
    expect(last.sent).toBe(33);
    expect(last.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['jev', 'unsure'], ['subscription', 'pass']]);
    // The deciding review sees the summary even when earlier turns leave recent history.
    expect(reviewed).toHaveLength(1);
    expect(reviewed[0]).toMatchObject({ operatorMessage: 'What was the first unique memory?',
      candidateReply: 'PREVIEW — It was ORCHID.' });
    expect(reviewed[0]!.summary!.text).toContain('ORCHID');
    expect(reviewed[0]!.history).toBeDefined();
    expect(reviewed[0]!.rules).toEqual({ claims_blocked: REPLY_RULES.claims_blocked });
    worker.intake([{ update_id: 34, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Please repeat the first unique memory.' } }]);
    await worker.drain();
    const pass = journal.view.order.at(-1)!;
    expect(sent.at(-1)).toBe('PREVIEW — It was ORCHID.');
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

it('sends nothing when Jev and the full-context review both fail, including after a restart', async () => {
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
    expect(sends).toEqual([]);
    expect(first.view.order[0]?.held).toBe('reply check unavailable');
    first.close();
    const second = openPreviewJournal(path, key);
    await createJournalWorker(second, { ...ports, model: async () => { throw Error('model repeated'); },
      replyCheck: { elapsedMs: () => 100, jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { throw Error('review repeated'); } } }).drain();
    expect(sends).toEqual([]);
    expect(second.view.order[0]?.answer).toBe('candidate');
    expect(second.view.order[0]?.intent).toBeUndefined();
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
    expect(sends).toHaveLength(1);
    expect(journal.view.order[1]?.held).toBe('call cap');
    raiseJournalCaps(journal, { maxCalls: 4, maxReplies: 4, maxTurns: 4, authority: 'test: operator raise', at: 2000 });
    await worker.drain();
    expect(journal.view.order[1]?.answer).toBe('candidate');
    expect(reviewed).toBe(2);
    expect(sends).toEqual(['PREVIEW — candidate', 'PREVIEW — candidate']);
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
