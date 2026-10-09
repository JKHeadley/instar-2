import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { REPLY_RULES, replyReviewContext, replyReviewQuestion } from './reply-check.js';
import type { ReplyRule } from './reply-check.js';

const key = new Uint8Array(32).fill(27);
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const scores = (uncertain: boolean) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: uncertain && id === 'claims_blocked' ? 0.5 : 0.01 }])) });

/** Fake transport and models, real journal intake/packet/check/intent/send order.
 * The reviewer fixture charges a fixed launch cost plus time proportional to
 * submitted bytes. This is a controlled comparison, not a live provider SLA. */
async function runCase(scope: 'all' | 'selected' | 'pass') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reply-latency-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
      configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 20, maxReplies: 20,
      maxTurns: 20, maxBytes: 32768, cursor: 0 });
    let jevCalls = 0, reviewBytes = 0, reviewedAt = 0, sentAt = 0;
    const worker = createJournalWorker(journal, {
      now: () => 1000, stopped: () => false,
      sources: [{ name: 'purpose', text: 'Make coherence something an AI cannot lose. '.repeat(25) }],
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:offline', 1000),
      model: async () => { await sleep(5); return 'I can answer that.'; },
      checkOutbound: () => {},
      replyCheck: {
        elapsedMs: () => performance.now(),
        jev: async () => { jevCalls++; await sleep(15); return { value: scores(scope !== 'pass' && jevCalls === 9), latencyMs: 15 }; },
        escalate: async (text, id, originalPrompt, flagged) => {
          const question = replyReviewQuestion(scope === 'all' ? [] : flagged ?? []);
          const context = replyReviewContext(originalPrompt!, text);
          expect(JSON.parse(context)).toMatchObject({ operatorMessage: 'Is that blocked?',
            audience: { surface: 'telegram-private-chat' }, sources: expect.any(Array), history: expect.any(Array) });
          const prepared = prepareJournalEnvelope({ question, context, id: `${id}:reply-review` },
            'claude-sonnet-4-5', 'grant:offline', 1000);
          reviewBytes = Buffer.byteLength(prepared);
          // Controlled fixture: same 40 ms launch and 300 bytes/ms processing rate.
          await sleep(40 + Math.ceil(reviewBytes / 300));
          reviewedAt = performance.now();
          return { verdict: 'pass' as const, ruleIds: [] as ReplyRule[], confidence: null, latencyMs: 40 + reviewBytes / 300 };
        },
      },
      send: async input => { expect(input.expectedText).toBe('I can answer that.');
        if (scope !== 'pass') expect(reviewedAt).toBeGreaterThan(0);
        await sleep(8); sentAt = performance.now(); return input.update; },
    });
    for (let update = 1; update <= 8; update++) {
      worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: `Earlier message ${update}: ${'context '.repeat(12)}` } }]);
      await worker.drain();
    }
    const started = performance.now();
    worker.intake([{ update_id: 9, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Is that blocked?' } }]);
    await worker.drain();
    const final = journal.view.order.at(-1)!;
    expect(final.sent).toBe(9);
    expect(final.replyChecks?.at(-1)?.verdict).toBe('pass');
    expect(final.intent).toBe('I can answer that.');
    const result = { scope, endToEndMs: Math.round((sentAt - started) * 10) / 10,
      reviewBytes, reviewCalls: journal.view.replyCheckPaths.subscription,
      path: final.replyChecks?.map(row => `${row.path}:${row.verdict}`) };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('measures intake through Jev, full-context review and send with a controlled fixture', async () => {
  const pass = await runCase('pass');
  const all = await runCase('all');
  const selected = await runCase('selected');
  expect(pass.reviewBytes).toBe(0);
  expect(pass.reviewCalls).toBe(0);
  expect(all.reviewCalls).toBe(1);
  expect(selected.reviewCalls).toBe(1);
  expect(all.path).toEqual(selected.path);
  expect(selected.reviewBytes).toBeLessThan(all.reviewBytes);
  console.log(JSON.stringify({ fixture: 'reply-latency', pass, allRules: all, selectedRules: selected,
    bytesSaved: all.reviewBytes - selected.reviewBytes }));
});
