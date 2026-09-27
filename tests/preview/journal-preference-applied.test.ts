import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { HOLDING_REPLY, JEV_MODEL, REPLY_RULES } from './reply-check.js';

const key = new Uint8Array(32).fill(42);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const update = (id: number, value: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: value, date: 1790000000 + id * 60 } });
const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

it('projects compliant and violating attempted replies at an explicit word bound, then retires the preference', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-applied-')));
  const path = join(root, 'journal.encrypted');
  const sent: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false, summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    model: async (input: { id: string; question?: string; context: string }) => {
      if (input.id.startsWith('summary:')) {
        const packet = JSON.parse(input.context);
        const request = packet.memoryRequest;
        return JSON.stringify({ summary: 'The operator described reply length.', people: [], memory:
          request?.message === 'Keep replies under 20 words.'
            ? [{ mode: 'prefer', source: request.id, quote: request.message }]
            : request?.message === 'Forget my reply length preference.'
              ? [{ mode: 'forget', source: packet.memoryCandidates[0].id, quote: 'Keep replies under 20 words.' }]
              : request?.message === 'Shorter please.'
                ? [{ mode: 'prefer', source: request.id, quote: request.message }]
              : [] });
      }
      return input.question === 'Within?' ? words(18)
        : input.question === 'Over?' || input.question === 'After forgetting?' || input.question === 'Relative?' ? words(19) : 'Okay.';
    }, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length === 3 ? null : sent.length; },
    checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Keep replies under 20 words.')]); await worker.drain();
    worker.intake([update(2, 'Within?')]); await worker.drain();
    worker.intake([update(3, 'Over?')]); await worker.drain();
    expect(journal.view.order[1]?.preferenceChecks).toMatchObject([{ words: 19, maxWords: 19, violated: false }]);
    expect(journal.view.order[2]?.preferenceChecks).toMatchObject([{ words: 20, maxWords: 19, violated: true }]);
    expect(journal.view.order[2]?.intent).toBe(sent[2]);
    journal.close();

    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    expect(journal.view.order[2]?.preferenceChecks).toMatchObject([{ words: 20, maxWords: 19, violated: true }]);
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).preferenceApplied).toEqual({ checked: 3, findings: [{ update: 3,
      sourceUpdate: 1, words: 20, maxWords: 19, delivery: 'unknown' }] });
    worker.intake([update(4, 'Forget my reply length preference.')]); await worker.drain();
    worker.intake([update(5, 'After forgetting?')]); await worker.drain();
    expect(journal.view.order[4]?.preferenceChecks).toEqual([]);
    worker.intake([update(6, 'Shorter please.')]); await worker.drain();
    worker.intake([update(7, 'Relative?')]); await worker.drain();
    expect(journal.view.order[6]?.preferenceChecks).toEqual([]);
    expect(journal.view.order[2]?.preferenceChecks?.[0]?.violated).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('checks an active short-reply style but ignores an unsent candidate replaced by the holding reply', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-short-applied-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false, summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      model: async input => {
        if (input.id.startsWith('summary:')) {
          const request = JSON.parse(input.context).memoryRequest;
          return JSON.stringify({ summary: 'Short replies requested.', people: [], memory:
            [{ mode: 'prefer', source: request.id, quote: 'I prefer short replies.' }] });
        }
        return input.question === 'Long answer?' || input.question === 'Suppressed answer?' ? words(80) : 'Okay.';
      }, send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 0,
        jev: async (text, questions) => ({ latencyMs: 1, value: questions
          ? { model: JEV_MODEL, answers: { summary_integrity: { type: 'noul', noul: 0 } } }
          : { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul:
            id === 'raw_path' && text.includes(words(80)) && sent.length >= 2 ? 0.9 : 0 }])) } }),
        escalate: async () => ({ verdict: 'violation' as const, ruleIds: ['raw_path' as const], confidence: 1, latencyMs: 1 }),
        summaryReview: async () => ({ verdict: 'pass' as const, latencyMs: 1 }) } });
    worker.intake([update(1, 'I prefer short replies.')]); await worker.drain();
    worker.intake([update(2, 'Long answer?')]); await worker.drain();
    expect(journal.view.order[1]?.preferenceChecks).toMatchObject([{ words: 81, maxWords: 80, violated: true }]);
    worker.intake([update(3, 'Suppressed answer?')]); await worker.drain();
    expect(journal.view.order[2]?.answer).toBe(words(80));
    expect(journal.view.order[2]?.intent).toBe(HOLDING_REPLY);
    expect(journal.view.order[2]?.preferenceChecks).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
