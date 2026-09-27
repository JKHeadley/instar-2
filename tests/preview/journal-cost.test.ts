import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';

const key = new Uint8Array(32).fill(7);
const usage = (inputTokens: number | null, outputTokens: number | null) => ({ inputTokens, outputTokens, charge: null as null });
const turn = (update: number) => `telegram:12345678:update:${String(update)}`;

it('projects observed and reserved-maximum tokens by call kind into read-only status across restart', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-cost-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 16, maxReplies: 16, maxTurns: 16, maxBytes: 32768, cursor: 0 });
    for (let update = 1; update <= 3; update++) journal.append({ kind: 'intake', id: turn(update), update,
      text: `question ${String(update)}`, raw: '{}', accepted: true, cursor: update + 1, at: 1000 });
    journal.append({ kind: 'reserve', id: turn(1), maxInputTokens: 32768, maxOutputTokens: 2048, at: 1000 });
    journal.append({ kind: 'answer', id: turn(1), text: 'one', state: 'complete', usage: usage(100, 20), at: 1000 });
    journal.append({ kind: 'reply-jev-reserve', id: turn(1), maxInputTokens: 200, maxOutputTokens: 4096, at: 1000 });
    journal.append({ kind: 'reply-check', id: turn(1), result: { verdict: 'pass', ruleIds: [], confidence: 0.99,
      path: 'jev', latencyMs: 1, usage: usage(12, 3) }, at: 1000 });
    journal.append({ kind: 'reserve', id: turn(2), maxInputTokens: 32768, maxOutputTokens: 2048, at: 1000 });
    journal.append({ kind: 'model-uncertain', id: turn(2), state: 'uncertain', usage: usage(5, 2), at: 1000 });
    journal.append({ kind: 'reserve', id: turn(3), maxInputTokens: 32768, maxOutputTokens: 2048, at: 1000 });
    journal.append({ kind: 'answer', id: turn(3), text: 'three', state: 'complete', usage: usage(null, 7), at: 1000 });
    journal.append({ kind: 'reply-jev-reserve', id: turn(3), maxInputTokens: 250, maxOutputTokens: 4096, at: 1000 });
    journal.append({ kind: 'reply-check', id: turn(3), result: { verdict: 'unavailable', ruleIds: [],
      confidence: null, path: 'jev', latencyMs: 2 }, at: 1000 });
    journal.append({ kind: 'reply-review-reserve', id: turn(3), candidate: 'three',
      maxInputTokens: 32768, maxOutputTokens: 2048, at: 1000 });
    journal.append({ kind: 'reply-review-state', id: turn(3), state: 'rejected', usage: usage(9, 1), at: 1000 });
    journal.append({ kind: 'reply-check', id: turn(3), result: { verdict: 'unavailable', ruleIds: [],
      confidence: null, path: 'subscription', latencyMs: 2 }, at: 1000 });
    journal.append({ kind: 'summary-reserve', through: 1, maxInputTokens: 32768, maxOutputTokens: 2048, at: 1000 });
    journal.append({ kind: 'summary', through: 1, text: 'summary', state: 'complete', usage: usage(30, 4), at: 1000 });
    journal.append({ kind: 'summary-reserve', through: 2, maxInputTokens: 32768, maxOutputTokens: 2048, at: 1000 });
    journal.append({ kind: 'summary-uncertain', through: 2, state: 'uncertain', usage: usage(3, 1), at: 1000 });
    const expected = {
      answer: { calls: 3, inputTokens: 65636, outputTokens: 2075, unknownCalls: 2 },
      summary: { calls: 2, inputTokens: 32798, outputTokens: 2052, unknownCalls: 1 },
      replyCheck: { calls: 3, inputTokens: 271, outputTokens: 4100, unknownCalls: 1 },
    };
    expect(journal.view.tokenTotals).toEqual(expected);
    journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    expect(reopened.view.tokenTotals).toEqual(expected);
    reopened.close();
    const status = spawnSync(process.execPath, ['--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', root], { cwd: process.cwd(),
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8' });
    expect(status.status, status.stderr).toBe(0);
    const report = JSON.parse(status.stdout);
    expect(report.tokens).toEqual(expected);
    expect(report.tokenTotal).toEqual({ calls: 8, inputTokens: 98705,
      outputTokens: 8227, unknownCalls: 4 });
    expect(report.self).toContain('answer 65636/2075');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('counts an older unmetered reservation at the current durable maximum', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-cost-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'intake', id: turn(1), update: 1, text: 'hello', raw: '{}', accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id: turn(1), at: 1000 });
    expect(journal.view.tokenTotals.answer).toEqual({ calls: 1, inputTokens: 32768, outputTokens: 2048, unknownCalls: 1 });
    journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(reopened.view.tokenTotals.answer).toEqual({ calls: 1, inputTokens: 32768, outputTokens: 2048, unknownCalls: 1 });
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps an uncertain reply review at its reservation even when the provider returned partial usage', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-cost-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 3, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'intake', id: turn(1), update: 1, text: 'hello', raw: '{}', accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id: turn(1), at: 1000 });
    journal.append({ kind: 'answer', id: turn(1), text: 'candidate', state: 'complete', usage: usage(20, 5), at: 1000 });
    journal.append({ kind: 'reply-review-reserve', id: turn(1), candidate: 'candidate',
      maxInputTokens: 32768, maxOutputTokens: 2048, at: 1000 });
    journal.append({ kind: 'reply-review-state', id: turn(1), state: 'uncertain', usage: usage(7, 1), at: 1000 });
    expect(journal.view.tokenTotals.replyCheck).toEqual({ calls: 1, inputTokens: 32768,
      outputTokens: 2048, unknownCalls: 1 });
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.tokenTotals.replyCheck.inputTokens).toBe(32768);
    expect(reopened.view.tokenTotals.replyCheck.outputTokens).toBe(2048);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('meters the worker answer and Jev check from their actual returned usage', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-cost-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => ({ text: 'yes', usage: usage(41, 8) }), checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100,
        jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
          .map(rule => [rule, { type: 'noul', noul: 0.01 }])), usage: { input_tokens: 17, output_tokens: 3 } }, latencyMs: 2 }),
        escalate: async () => { throw Error('unexpected review'); } },
      send: async () => 1 });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'hello' } }]);
    await worker.drain();
    expect(journal.view.tokenTotals).toEqual({
      answer: { calls: 1, inputTokens: 41, outputTokens: 8, unknownCalls: 0 },
      summary: { calls: 0, inputTokens: 0, outputTokens: 0, unknownCalls: 0 },
      replyCheck: { calls: 1, inputTokens: 17, outputTokens: 3, unknownCalls: 0 },
    });
    journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    expect(reopened.view.tokenTotals.answer.inputTokens).toBe(41);
    expect(reopened.view.tokenTotals.replyCheck.outputTokens).toBe(3);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
