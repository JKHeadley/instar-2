import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_THINKING_ENV, subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { createJournalWorker, openPreviewJournal, openQuestionCandidates, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE } from './journal-test-worker.js';
import { parseModelJson } from './model-json.js';
import { parseReplyReviewVerdict, replyReviewDiagnostics } from './reply-check.js';

// Each named case is a replayable boundary from the live preview record. The
// nearby accepting case prevents a safety hold from becoming a blanket refusal.
const key = new Uint8Array(32).fill(29);
const fence = '```';
const genesis = (maxTurns = 20, maxBytes = 32768) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:catalog', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns, maxBytes, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const inJournal = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-failure-catalog-')));
  try { await run(join(root, 'journal.encrypted')); }
  finally { rmSync(root, { recursive: true, force: true }); }
};

it('F01 thinking overflow: an over-cap review stays charged and held after replay; a capped result can complete', async () => {
  // Live failure: thinking consumed the shared output allowance, leaving no review verdict.
  expect(SUBSCRIPTION_THINKING_ENV.MAX_THINKING_TOKENS).toBe('0');
  expect(subscriptionConversationPolicy('claude-sonnet-5').maxTokens).toBe(2048);
  await inJournal(async path => {
    const journal = openPreviewJournal(path, key, genesis());
    for (const [index, state, tokens] of [[1, 'complete', 2048], [2, 'uncertain', 2049]] as const) {
      const id = `telegram:12345678:update:${index}`;
      journal.append({ kind: 'intake', id, update: index, text: 'Check this answer',
        raw: JSON.stringify(update(index, 'Check this answer')), accepted: true, cursor: index + 1, at: 1000 + index });
      journal.append({ kind: 'reserve', id, at: 1000 + index });
      journal.append({ kind: 'answer', id, text: 'candidate', state: 'complete', at: 1000 + index });
      journal.append({ kind: 'reply-review-reserve', id, candidate: 'PREVIEW — candidate', at: 1000 + index });
      journal.append({ kind: 'reply-review-state', id, state,
        diagnostics: replyReviewDiagnostics({ outputTokens: tokens }), at: 1000 + index });
      if (state === 'uncertain') journal.append({ kind: 'hold', id, reason: 'reply check unavailable', at: 1000 + index });
    }
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.calls).toBe(4); // two answers plus two durable review reservations
    expect(replay.view.order.map(turn => ({ state: turn.reviewState, tokens: turn.reviewDiagnostics?.outputTokens,
      thinking: turn.reviewDiagnostics?.thinkingPresent, held: turn.held, intent: turn.intent }))).toEqual([
      { state: 'complete', tokens: 2048, thinking: 'unobservable', held: undefined, intent: undefined },
      { state: 'uncertain', tokens: 2049, thinking: 'unobservable', held: 'reply check unavailable', intent: undefined },
    ]);
    replay.close();
  });
});

it('F02 wrapped JSON: a single whole-response fence parses, while prose and extra objects do not', () => {
  // Live failure: a complete model JSON fence caused an avoidable held reply.
  const decision = '{"type":"Decision","conclusion":{"value":"PASS | safe"}}';
  expect(parseModelJson(decision)).toMatchObject({ ok: true, shape: 'bare' });
  expect(parseModelJson(`${fence}json\r\n${decision}\r\n${fence}`)).toMatchObject({ ok: true, shape: 'fenced' });
  expect(parseModelJson(`Here is my decision: ${decision}`)).toEqual({ ok: false, shape: 'prose-wrapped' });
  expect(parseModelJson(`${decision}\n${decision}`)).toEqual({ ok: false, shape: 'multiple-objects' });
  const captured = JSON.parse(readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8'));
  expect(parseModelJson(captured.result)).toEqual({ ok: false, shape: 'not-json' });
});

it('F03 contradicting review prose: a PASS is valid alone, never after a written rejection', () => {
  // Live failure: extracting a PASS object from rejecting prose could authorize a send.
  const pass = '{"verdict":"pass","ruleIds":[],"reason":"safe"}';
  expect(parseReplyReviewVerdict('PASS | The answer is safe.').verdict).toBe('pass');
  expect(() => parseReplyReviewVerdict('VIOLATION:credential | Do not send.\nPASS | The answer is safe.')).toThrow('malformed');
  expect(parseModelJson(`${fence}json\n${pass}\n${fence}`)).toMatchObject({ ok: true, shape: 'fenced' });
  expect(parseModelJson(`VIOLATION:credential | Do not send. ${pass}`)).toEqual({ ok: false, shape: 'prose-wrapped' });
  expect(parseModelJson(`${fence}json\n${pass}\n${fence}\nVIOLATION:credential | Do not send.`))
    .toEqual({ ok: false, shape: 'fenced' });
});

it('F04 too-long notice: a short answer sends whole; an oversized answer sends one fixed notice across replay', async () => {
  // Live failure: a reply beyond Telegram's limit must not send a truncated prefix.
  const cases: [string, string][] = [['short answer', 'PREVIEW — short answer'], ['x'.repeat(4085), TOO_LONG_REPLY_NOTICE]];
  for (const [answer, expected] of cases) {
    await inJournal(async path => {
      const journal = openPreviewJournal(path, key, genesis());
      const sent: string[] = [];
      const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
        model: async () => answer, checkOutbound: () => {},
        send: async ({ text }) => { sent.push(text); return 7; } });
      worker.intake([update(1, 'Please answer.')]);
      await worker.drain();
      expect(sent).toEqual([expected]);
      expect(journal.view.order[0]?.answer).toBe(answer);
      expect(journal.view.order[0]?.intent).toBe(expected);
      journal.close();
      const replay = openPreviewJournal(path, key);
      let repeats = 0;
      await createJournalWorker(replay, { now: () => 1001, stopped: () => false,
        model: async () => { repeats++; return 'repeat'; }, checkOutbound: () => {},
        send: async () => { repeats++; return 8; } }).drain();
      expect(repeats).toBe(0);
      expect(replay.view.order[0]?.sent).toBe(7);
      replay.close();
    });
  }
  await inJournal(async path => {
    const original = 'x'.repeat(4097);
    const journal = openPreviewJournal(path, key, genesis(20, 4096));
    const sent: string[] = [];
    let modelCalls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { modelCalls++; return 'unexpected answer'; }, checkOutbound: () => {},
      send: async ({ text }) => { sent.push(text); return 7; } });
    worker.intake([update(1, original)]);
    await worker.drain();
    expect(modelCalls).toBe(0);
    expect(sent).toEqual([TOO_LONG_INPUT_NOTICE]);
    expect(journal.view.order[0]).toMatchObject({ text: original, noticeClass: 'too-long-input',
      intent: TOO_LONG_INPUT_NOTICE, sent: 7 });
    journal.close();
  });
});

it('F05 held-item crowding: a relevant older hold survives the ten-item window; unrelated holds stay bounded', async () => {
  // Live failure: many held turns can crowd a later question's bounded model packet.
  await inJournal(async path => {
    const journal = openPreviewJournal(path, key, genesis(16));
    const held = ['Where is the cobalt launch plan?', ...Array.from({ length: 11 }, (_, index) => `Where is item ${index + 1}?`)];
    for (const [index, text] of held.entries()) {
      const id = `telegram:12345678:update:${index + 1}`;
      journal.append({ kind: 'intake', id, update: index + 1, text,
        raw: JSON.stringify(update(index + 1, text)), accepted: true, cursor: index + 2, at: 1000 + index });
      journal.append({ kind: 'hold', id, reason: 'reply check unavailable', at: 1000 + index });
    }
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(openQuestionCandidates(replay.view)).toHaveLength(12);
    let packet: { openQuestions?: { question: string }[] } = {};
    const worker = createJournalWorker(replay, { now: () => 2000, stopped: () => false,
      model: async input => { packet = JSON.parse(input.context); return 'I can help with that.'; },
      checkOutbound: () => {}, send: async () => 9 });
    worker.intake([update(13, 'Can you answer the cobalt launch plan question?')]);
    await worker.drain();
    const selected = packet.openQuestions?.map(item => item.question) ?? [];
    expect(selected).toContain('Where is the cobalt launch plan?');
    expect(selected.length).toBeLessThanOrEqual(10);
    expect(selected.length).toBeLessThan(held.length);
    expect(replay.view.order.at(-1)?.sent).toBe(9);
    replay.close();
  });
});
