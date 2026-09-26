import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkReply, HOLDING_REPLY, REPLY_RULES, replyReviewContext } from './reply-check.js';
import type { ReplyCheckResult } from './reply-check.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const scores = (overrides: Record<string, number> = {}) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: overrides[id] ?? 0.01 }])) });
const key = new Uint8Array(32).fill(3);

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
  expect(result.sendOriginal).toBe(sendOriginal);
  expect(calls).toBe(Number(escalate));
  expect(reserved).toBe(Number(escalate));
  expect(records.at(-1)?.verdict).toBe(expected);
  expect(records[0]?.path).toBe('jev');
  if (escalate) expect(records.at(-1)?.path).toBe('subscription');
});

it('keeps a non-secret candidate reachable when review cannot be reserved', async () => {
  const records: ReplyCheckResult[] = [];
  const result = await checkReply('PREVIEW — candidate', 'turn:1', {
    elapsedMs: () => 100, jev: async () => ({ value: scores({ parks_on_user: 0.5 }), latencyMs: 160 }),
    reserveEscalation: () => false, escalate: async () => { throw Error('must not call'); }, record: row => records.push(row),
  });
  expect(result).toEqual({ sendOriginal: true, path: 'holding' });
  expect(records.at(-1)?.path).toBe('holding');
});

it('keeps a non-secret candidate reachable when the full-context review errors', async () => {
  const records: ReplyCheckResult[] = [];
  const result = await checkReply('PREVIEW — candidate', 'turn:1', {
    elapsedMs: () => 100, jev: async () => { throw Error('timeout'); },
    reserveEscalation: () => true, escalate: async () => { throw Error('provider unavailable'); },
    record: row => records.push(row),
  });
  expect(result.sendOriginal).toBe(true);
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
    expect(JSON.parse(next.context).history[0]).toMatchObject({ answer: HOLDING_REPLY, outcome: 'Telegram API accepted' });
    await worker.summarizeIfNeeded(true);
    expect(summaryPacket?.history[0]).toMatchObject({ answer: HOLDING_REPLY, outcome: 'Telegram API accepted' });
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

it('does not repeat an interrupted paid review and sends the non-secret candidate', async () => {
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
    expect(sent).toBe('PREVIEW — candidate');
    expect(second.view.calls).toBe(2);
    expect(second.view.lastReplyCheck?.path).toBe('subscription');
    expect(second.view.lastReplyCheck?.verdict).toBe('unavailable');
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
