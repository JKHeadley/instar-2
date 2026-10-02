import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, replyReviewReserveFor, TOO_LONG_INPUT_NOTICE } from './journal-test-worker.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

/** The reachability floor's last rung (preparedWithFloor): every earlier turn is set aside and what is left is
 * the message and the parts every turn carries. Live 2026-10-02 (proofroom2-rule40-20261002, update 6230924) a
 * default-size root reached it with a prompt that fit the context limit but not the reply-review reserve beside
 * it, and the turn was re-held every five minutes for good: three answers, then silence. Both sides of the rung:
 * a prompt that fits once the reserve yields is answered; one that cannot fit at all gets the size notice. Neither
 * is held. */

const key = new Uint8Array(32).fill(37);
const limit = 32768;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: limit, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const system = Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
/** The prepared size that fits the limit but leaves less than the reserve beside it: the live shape. */
const pastReserve = limit - system - replyReviewReserveFor(limit) + 737;

async function oneTurn(preparedBytes: number | 'overflow') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-floor-last-rung-')));
  const answered: string[] = [];
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      // Every variant of every rung prepares to the same size: the parts the floor cannot shed.
      prepareModel: input => {
        if (preparedBytes === 'overflow') throw Error('preview: complete prompt overflow');
        return `${input.id}:${'x'.repeat(preparedBytes - input.id.length - 1)}`;
      },
      model: async input => { answered.push(input.id); return JSON.stringify({ reply: 'Ok.', memory: [], dated: [] }); },
      send: async () => journal.view.replies + 1, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100,
        jev: async (_text, questions) => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
          Object.keys(questions ?? {}).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 10 }),
        escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 10 }) } });
    worker.intake([update(1, 'Garden log 1: watered bed 1. No reply needed beyond ok.')]);
    await worker.drain();
    const turn = journal.view.order[0]!;
    const result = { sent: turn.sent, held: turn.held, notice: turn.noticeClass, intent: turn.intent, answered: [...answered] };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('answers a turn whose prompt fits the limit but not the review reserve beside it', async () => {
  expect(pastReserve + system).toBeLessThanOrEqual(limit);
  expect(pastReserve + system + replyReviewReserveFor(limit)).toBeGreaterThan(limit);
  const turn = await oneTurn(pastReserve);
  expect(turn.held).toBeUndefined();
  expect(turn.notice).toBeUndefined();
  expect(turn.answered).toEqual(['telegram:12345678:update:1']);
  expect(turn.sent).toBeDefined();
});

it('sends the size notice, never a silent hold, when even the last rung cannot fit', async () => {
  const turn = await oneTurn('overflow');
  expect(turn.held).toBeUndefined();
  expect(turn.notice).toBe('too-long-input');
  expect(turn.intent).toBe(TOO_LONG_INPUT_NOTICE);
  expect(turn.answered).toEqual([]);
  expect(turn.sent).toBeDefined();
});
