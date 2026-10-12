import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { boundedCorrection, REPLY_RULES, type ReplyRule } from './reply-check.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/correction-keeps-answer-2026-10-12.json', import.meta.url), 'utf8'));
const key = new Uint8Array(32).fill(37);
const scores = (flag = false) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).filter(rule => rule !== 'incoherent_remainder')
    .map(rule => [rule, { type: 'noul', noul: flag && rule === 'raw_path' ? 0.91 : 0.01 }])) });

async function replay(options: { correction?: string; pending?: boolean; verdict?: 'pass' | 'violation' | 'unavailable'; cap?: number; crash?: boolean; reviseAnswer?: boolean; slowReview?: boolean; answer?: string }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'correction-answer-'))), path = join(root, 'journal.encrypted');
  let crash = options.crash === true, now = 1000;
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: options.cap ?? 12, maxReplies: 4, maxTurns: 4, maxBytes: 65536, cursor: 0 }, stage => {
    if (crash && stage === 'after:reply-revision-review-reserve') { crash = false; throw Error('interrupted correction review'); }
  });
  const sends: string[] = [], packets: string[] = [], reviews: string[] = [];
  const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text } });
  const ports = {
    now: () => now, stopped: () => false,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
    model: async (input: { context: string }) => {
      packets.push(input.context);
      return packets.length === 1 && options.pending !== false ? capture.previous.text
        : JSON.stringify({ reply: options.answer ?? '51.', ...(options.correction === undefined ? {} : { correction: options.correction }), memory: [] });
    },
    checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; },
    replyCheck: {
      elapsedMs: () => 100,
      jev: async () => ({ value: scores(packets.length === 1 && options.pending !== false || options.reviseAnswer || options.cap !== undefined), latencyMs: 1 }),
      escalate: async (text: string, _id: string, _prompt?: string, rules?: readonly ReplyRule[], _deadline?: number, operation?: 'revision' | 'acknowledgement') => {
        if (operation !== 'revision') return packets.length === 2 && options.cap !== undefined
          ? { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1 } : { ...capture.previous.review, latencyMs: 1 };
        reviews.push(text);
        if (options.slowReview) now = _deadline! + 1;
        if (options.reviseAnswer) {
          expect(rules).toContain('incoherent_remainder');
          return { verdict: 'violation' as const, ruleIds: ['incoherent_remainder' as const], confidence: null, latencyMs: 1 };
        }
        if (options.verdict === 'unavailable') throw Error('review uncertain');
        if (text.includes('\n\n')) expect(rules).toContain('raw_path');
        return options.verdict === 'violation' ? { ...capture.current.review, latencyMs: 1 }
          : { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1 };
      },
      ...(options.reviseAnswer ? { revise: async () => packets.length === 1 ? { state: 'rejected' as const } : { state: 'complete' as const, text: capture.current.deliveredCorrection } } : {}),
    },
  };
  try {
    const worker = createJournalWorker(journal, ports);
    if (options.pending !== false) {
      worker.intake([update(capture.previous.update, 'What self-deceptions are you supposed to watch for in yourself?')]);
      await worker.drain(); worker.checkCoherence();
    }
    worker.intake([update(capture.current.update, capture.current.question)]);
    if (options.crash) await expect(worker.drain()).rejects.toThrow('interrupted correction review');
    else await worker.drain();
    const before = journal.view.calls;
    journal.close();
    const restored = openPreviewJournal(path, key);
    const recovered = createJournalWorker(restored, { ...ports,
      model: async () => { throw Error('answer repeated'); },
      replyCheck: { ...ports.replyCheck, escalate: async () => { throw Error('paid review repeated'); } } });
    await recovered.drain();
    expect(restored.view.calls).toBe(before);
    const turn = restored.view.order.at(-1)!;
    const result = { sent: sends.at(-1), sends: [...sends], turn, reviews: [...reviews], calls: restored.view.calls,
      pending: [...restored.view.corrections], packet: JSON.parse(packets.at(-1)!) };
    restored.close(); return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('replays the captured correction-only delivery as an optional addition; the arithmetic answer survives', async () => {
  expect(capture.current.answerReason).toContain('51');
  expect(capture.current.deliveredCorrection).not.toContain('51');
  const result = await replay({ correction: capture.current.deliveredCorrection });
  expect(result.sent).toBe('51.');
  expect(result.sent).not.toContain('tests/preview/');
  expect(result.turn.answerCorrection).toBe(capture.current.deliveredCorrection);
  expect(result.turn.correctionDeferred).toBe(true);
  expect(result.pending).toContain(result.packet.corrections[0].source);
  expect(result.sends).toHaveLength(2); // one per incoming turn; no correction-only send
  expect(result.packet.capability).toContain('without any carried correction in that field');
});

it.each(['violation', 'unavailable'] as const)('keeps the answer and pending correction when the addition review is %s', async verdict => {
  const result = await replay({ correction: 'I should not have cited tests/preview/retrospective.ts#disciplineSource.', verdict });
  expect(result.reviews).toEqual(['51.\n\nI should not have cited tests/preview/retrospective.ts#disciplineSource.']);
  expect(result.sent).toBe('51.');
  expect(result.turn.correctionDeferred).toBe(true);
  expect(result.turn.revisionReview?.verdict).toBe(verdict);
});

it('appends one reviewed sentence without changing the answer or sending another message', async () => {
  const correction = 'My earlier source citation should have stayed in plain language.';
  const result = await replay({ correction });
  expect(result.sent).toBe(`51.\n\n${correction}`);
  expect(result.turn.answer).toBe('51.');
  expect(result.turn.correctionDeferred).toBeUndefined();
  expect(result.pending).toEqual([]);
});

it('leaves the neighbour with no pending correction unchanged', async () => {
  const result = await replay({ pending: false, correction: capture.current.deliveredCorrection });
  expect(result.sent).toBe('51.');
  expect(result.turn.answerCorrection).toBeUndefined();
  expect(result.reviews).toEqual([]);
  expect(result.calls).toBe(1);
});

it.each([{ cap: 4 }, { crash: true }])('does not retry or lose the answer when the correction budget or call is lost: %j', async options => {
  const result = await replay({ correction: 'My earlier citation should have stayed in plain language.', ...options });
  expect(result.sent).toBe('51.');
  expect(result.turn.correctionDeferred).toBe(true);
  expect(result.pending).not.toEqual([]);
});

it('does not expose a secret in an optional correction or spend a review on it', async () => {
  const result = await replay({ correction: 'The key is sk-AAAAAAAAAAAAAAAAAAAAAAAA.' });
  expect(result.sent).toBe('51.');
  expect(result.reviews).toEqual([]);
  expect(result.turn.correctionDeferred).toBe(true);
});

it('bounds the addition without truncating or rewriting its claim', () => {
  expect(boundedCorrection('One sentence.')).toBe('One sentence.');
  expect(boundedCorrection('One sentence. Another sentence.')).toBeUndefined();
  expect(boundedCorrection('x'.repeat(240))).toBe('x'.repeat(240));
  expect(boundedCorrection('x'.repeat(241))).toBeUndefined();
  expect(boundedCorrection('')).toBeUndefined();
});

it('reviews the captured correction-only rewrite for answer loss and keeps the original answer', async () => {
  const result = await replay({ reviseAnswer: true, correction: 'My earlier citation should have stayed in plain language.' });
  expect(result.reviews).toEqual([capture.current.deliveredCorrection]);
  expect(result.sent).toBe('51.');
  expect(result.turn.revision?.text).toBe(capture.current.deliveredCorrection);
  expect(result.turn.revisionReview?.ruleIds).toContain('incoherent_remainder');
  expect(result.turn.correctionDeferred).toBe(true);
});

it('an injected slow review cannot append a correction after the shared deadline', async () => {
  const result = await replay({ correction: 'My earlier citation should have stayed in plain language.', slowReview: true });
  expect(result.turn.revisionReview?.verdict).toBe('pass');
  expect(result.sent).toBe('51.');
  expect(result.turn.correctionDeferred).toBe(true);
});

it('an addition cannot force the answer into a second outbound message', async () => {
  const answer = `51. ${'x'.repeat(4080)}`;
  const result = await replay({ answer, correction: 'My earlier citation should have stayed in plain language.' });
  expect(result.sent).toBe(answer);
  expect(result.sends).toHaveLength(2);
  expect(result.reviews).toEqual([]);
  expect(result.turn.correctionDeferred).toBe(true);
});
