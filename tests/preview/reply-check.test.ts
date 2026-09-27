import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkReply, HOLDING_REPLY, REPLY_RULES, replyReviewContext, replyReviewQuestion, replyReviewRules } from './reply-check.js';
import type { ReplyCheckResult } from './reply-check.js';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const scores = (overrides: Record<string, number> = {}) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: overrides[id] ?? 0.01 }])) });
const key = new Uint8Array(32).fill(3);
// Memory holds the sent text without the PREVIEW surface marker.
const HOLDING_TEXT = HOLDING_REPLY.replace(/^PREVIEW — /u, '');

it.each([
  ['pass', scores(), 'pass', true, false],
  ['confirmed violation', scores({ raw_path: 0.91 }), 'violation', false, true],
  ['Jev false alarm', scores({ raw_path: 0.91 }), 'pass', true, true],
  ['unsure', scores({ parks_on_user: 0.5 }), 'pass', true, true],
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

it('gives review the original audience, sources, history and operator message', () => {
  const context = { audience: { operator: 'verified' }, sources: [{ id: 'source:1' }],
    history: [{ update: 1, user: 'remember this' }], now: 1000 };
  const prompt = prepareJournalEnvelope({ question: 'What did I say?', context: JSON.stringify(context), id: 'turn:2' },
    'claude-sonnet-4-5', 'grant:test', 1000);
  expect(JSON.parse(replyReviewContext(prompt, 'PREVIEW — candidate'))).toEqual({
    ...context, operatorMessage: 'What did I say?', candidateReply: 'PREVIEW — candidate' });
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
    expect(JSON.parse(next.context).history[0]).toMatchObject({ answer: HOLDING_TEXT, outcome: 'Telegram API accepted' });
    await worker.summarizeIfNeeded(true);
    expect(summaryPacket?.history[0]).toMatchObject({ answer: HOLDING_TEXT, outcome: 'Telegram API accepted' });
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
      model: async () => 'Here is sk-AAAAAAAAAAAAAAAAAAAAAAAA', checkOutbound: () => {},
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
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('answers a long, summarized conversation when Jev is unsure: the full-context review decides, never a hold', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-summary-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 1100, cursor: 0 });
    const reviewed: { historyMode: string; summary?: { text: string }; operatorMessage: string; candidateReply: string }[] = [];
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
        jev: async text => ({ value: text.includes('ORCHID') && ++jevMemoryChecks === 1
          ? scores({ claims_blocked: 0.5 }) : scores(), latencyMs: 150 }),
        escalate: async (text, _id, originalPrompt) => {
          reviewed.push(JSON.parse(replyReviewContext(originalPrompt!, text)));
          return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 400 };
        } } });
    for (let i = 0; i < 12; i++) {
      worker.intake([{ update_id: i + 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        text: i === 0 ? 'ORCHID is the first unique memory.' : `turn ${i} ${'a'.repeat(45)}` } }]);
      await worker.drain(); await worker.summarizeIfNeeded();
    }
    expect(journal.view.summaries.length).toBeGreaterThan(0);
    worker.intake([{ update_id: 13, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'What was the first unique memory?' } }]);
    await worker.drain();
    const last = journal.view.order.at(-1)!;
    expect(sent.at(-1)).toBe('PREVIEW — It was ORCHID.');
    expect(last.sent).toBe(13);
    expect(last.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['jev', 'unsure'], ['subscription', 'pass']]);
    // The deciding review saw the summarized grounding, not a message in isolation.
    expect(reviewed).toHaveLength(1);
    expect(reviewed[0]).toMatchObject({ historyMode: 'summary-plus-recent', operatorMessage: 'What was the first unique memory?',
      candidateReply: 'PREVIEW — It was ORCHID.' });
    expect(reviewed[0]!.summary?.text).toContain('ORCHID');
    worker.intake([{ update_id: 14, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Please repeat the first unique memory.' } }]);
    await worker.drain();
    const pass = journal.view.order.at(-1)!;
    expect(sent.at(-1)).toBe('PREVIEW — It was ORCHID.');
    expect(pass.sent).toBe(14);
    expect(pass.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['jev', 'pass']]);
    expect(reviewed).toHaveLength(1);
    expect(jevMemoryChecks).toBe(2);
    expect(journal.view.order.every(turn => turn.held === undefined && turn.sent !== undefined)).toBe(true);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.replyCheckPaths.subscription).toBe(1);
    expect(replay.view.replyCheckPaths.jev).toBe(14);
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
