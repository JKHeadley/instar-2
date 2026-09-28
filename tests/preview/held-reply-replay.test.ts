import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MODEL_FAILURE_REPLY, openPreviewJournal } from './journal-test-worker.js';
import type { CallOutcome } from './journal.js';
import { failureShapeOf, parseModelJson } from './model-json.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { replyReviewContext, REPLY_RULES } from './reply-check.js';

type FailureClass = 'ordinary' | 'wrapped-review' | 'output-cap-answer' | 'output-cap-review'
  | 'contradicting-prose' | 'jev-unavailable' | 'review-timeout';
const cases: readonly { class: FailureClass; question: string; answer: string }[] = [
  { class: 'ordinary', question: 'Good morning. What should I focus on today?', answer: 'Pick one important task and finish it first.' },
  { class: 'ordinary', question: 'Explain why leaves change color in autumn.', answer: 'Chlorophyll fades, revealing other pigments.' },
  { class: 'wrapped-review', question: 'What did I say about my blue notebook?', answer: 'You said it is for travel ideas.' },
  { class: 'wrapped-review', question: 'Summarize the plan we discussed for Friday.', answer: 'We planned to review the draft on Friday.' },
  { class: 'wrapped-review', question: 'Explain what git status tells me.', answer: 'It shows changed and staged files.' },
  { class: 'wrapped-review', question: 'Where should I start with this bug report?', answer: 'Reproduce the failure and record the smallest case.' },
  { class: 'output-cap-answer', question: 'Give me a concise explanation of photosynthesis.', answer: '' },
  { class: 'output-cap-review', question: 'What did I decide about the meeting?', answer: 'You decided to move it to Tuesday.' },
  { class: 'contradicting-prose', question: 'What was my short personal note?', answer: 'You asked me to remember the blue notebook.' },
  { class: 'jev-unavailable', question: 'Can you answer despite the quick check being down?', answer: 'Yes, the full review has checked this answer.' },
  { class: 'review-timeout', question: 'Please recap the design discussion.', answer: 'We chose the smaller design.' },
  { class: 'review-timeout', question: 'What is the next step for the draft?', answer: 'Review the examples and revise the draft.' },
];
const key = new Uint8Array(32).fill(73);
const now = 1_790_000_000_000;
const verdict = '{"verdict":"pass","ruleIds":[],"reason":"The answer fits the full conversation."}';
const jev = { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES)
  .map(id => [id, { type: 'noul', noul: id === 'parks_on_user' ? 0.55 : 0.01 }])) };

interface CaseResult {
  class: FailureClass; held: boolean; reason: string | null; intent: string | null;
  sends: number; calls: number; callOutcomeCounts: Record<string, number>;
  lastCallOutcomes: { role: string; localLimit: CallOutcome['localLimit'] }[];
  modelJsonShapes: { version: 1; counts: Record<string, number> };
}

/** Each case uses a separate encrypted journal so an UNKNOWN or held turn cannot
 * contaminate the next sample. The names mirror the live status diagnostics. */
async function replay(scenario: (typeof cases)[number]): Promise<CaseResult> {
  const kind = scenario.class;
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-held-replay-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:offline', configurationDigest: 'sha256:offline',
    expires: 9_999_999_999_999, maxCalls: 3, maxReplies: 1, maxTurns: 1, maxBytes: 32768, cursor: 0 });
  let sends = 0;
  const shapeCounts: Record<string, number> = {};
  const recordShape = (outcome: 'malformed' | 'tolerated', shape: string) => {
    const key = `reply-review/verdict/${outcome}/${shape}`;
    shapeCounts[key] = (shapeCounts[key] ?? 0) + 1;
  };
  const outcome = (id: string, role: 'model' | 'reply-review', localLimit: CallOutcome['localLimit']) => {
    journal.append({ kind: 'call-outcome', id, role, outcome: {
      exitCode: localLimit === 'timeout' ? null : 0, localLimit,
      elapsedMs: localLimit === 'timeout' ? 120_000 : 20,
      type: localLimit === 'timeout' ? null : 'result',
      subtype: localLimit === 'timeout' ? null : 'success',
      isError: localLimit === 'timeout' ? null : false,
      outputTokens: localLimit === 'output-cap' ? 2049 : localLimit === 'timeout' ? null : 64,
      promptBytes: 2000 }, at: now });
  };
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:offline', now),
      model: async input => {
        outcome(input.id, 'model', kind === 'output-cap-answer' ? 'output-cap' : null);
        return kind === 'output-cap-answer'
          ? { state: 'rejected', failureClass: 'rejected' }
          : JSON.stringify({ reply: scenario.answer, memory: [] });
      },
      checkOutbound: () => {}, send: async () => { sends++; return 91; },
      replyCheck: { elapsedMs: () => now,
        jev: async () => {
          if (kind === 'jev-unavailable') throw Error('Jev unavailable');
          if (kind === 'ordinary' || kind === 'output-cap-answer') return { value: {
            ...jev, answers: Object.fromEntries(Object.keys(REPLY_RULES)
              .map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 10 };
          return { value: jev, latencyMs: 10 };
        },
        escalate: async (_text, id, originalPrompt) => {
          expect(JSON.parse(replyReviewContext(originalPrompt!, _text))).toMatchObject({
            operatorMessage: scenario.question, candidateReply: _text });
          outcome(`${id}:reply-review`, 'reply-review', kind === 'output-cap-review' ? 'output-cap'
            : kind === 'review-timeout' ? 'timeout' : null);
          if (kind === 'output-cap-review' || kind === 'review-timeout') throw Error('review unavailable');
          const raw = kind === 'wrapped-review' ? `\`\`\`json\r\n${verdict}\r\n\`\`\``
            : kind === 'contradicting-prose' ? `VIOLATION: do not send. ${verdict}` : verdict;
          const parsed = parseModelJson(raw);
          if (!parsed.ok) { recordShape('malformed', failureShapeOf(parsed)); throw Error('malformed review'); }
          if (parsed.shape !== 'bare') recordShape('tolerated', parsed.shape);
          if (parsed.value.verdict !== 'pass' || !Array.isArray(parsed.value.ruleIds)
            || parsed.value.ruleIds.length !== 0 || typeof parsed.value.reason !== 'string')
            throw Error('invalid review');
          return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 20,
            reason: parsed.value.reason };
        } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: scenario.question, date: Math.floor(now / 1000) } }]);
    await worker.drain();
    const turn = journal.view.order[0]!;
    const result: CaseResult = { class: kind, held: !turn.intent, reason: turn.held ?? null,
      intent: turn.intent ?? null, sends, calls: journal.view.calls,
      callOutcomeCounts: Object.fromEntries(journal.view.callOutcomeCounts),
      lastCallOutcomes: journal.view.callOutcomes.map(row => ({ role: row.role,
        localLimit: row.outcome.localLimit })),
      modelJsonShapes: { version: 1, counts: shapeCounts } };
    journal.close();
    const replayed = openPreviewJournal(path, key);
    expect(replayed.view.order[0]?.intent ?? null).toBe(result.intent);
    expect(Object.fromEntries(replayed.view.callOutcomeCounts)).toEqual(result.callOutcomeCounts);
    let repeatedSends = 0;
    const resumed = createJournalWorker(replayed, { now: () => now, stopped: () => false,
      model: async () => { throw Error('reserved call repeated'); },
      send: async () => { repeatedSends++; return 92; }, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => now, jev: async () => { throw Error('Jev repeated'); },
        escalate: async () => { throw Error('review repeated'); } } });
    await resumed.drain();
    expect(repeatedSends).toBe(0);
    expect(replayed.view.calls).toBe(result.calls);
    replayed.close();
    return result;
  } finally { try { journal.close(); } catch { /* already closed */ }
    rmSync(root, { recursive: true, force: true }); }
}

it('replays live-shaped failure classes and measures first-attempt holds by class', async () => {
  const results: CaseResult[] = [];
  for (const scenario of cases) results.push(await replay(scenario));
  const byClass = Object.fromEntries([...new Set(cases.map(item => item.class))].map(kind => {
    const rows = results.filter(row => row.class === kind);
    return [kind, { total: rows.length, held: rows.filter(row => row.held).length }];
  }));
  const held = results.filter(row => row.held).length;
  console.info('held-reply replay', JSON.stringify({ total: results.length, held,
    holdRate: held / results.length, byClass }));
  // Rule 86: Jev flagged only parks_on_user, so a review without a verdict no longer holds.
  expect(byClass).toMatchObject({
    ordinary: { total: 2, held: 0 }, 'wrapped-review': { total: 4, held: 0 },
    'output-cap-answer': { total: 1, held: 0 }, 'output-cap-review': { total: 1, held: 0 },
    'contradicting-prose': { total: 1, held: 0 }, 'jev-unavailable': { total: 1, held: 0 },
    'review-timeout': { total: 2, held: 0 },
  });
  expect(held).toBe(0);
  expect(results.filter(row => row.class === 'wrapped-review').every(row =>
    row.modelJsonShapes.counts['reply-review/verdict/tolerated/fenced'] === 1 && row.sends === 1)).toBe(true);
  expect(results.find(row => row.class === 'contradicting-prose')).toMatchObject({
    held: false, reason: null, sends: 1,
    modelJsonShapes: { counts: { 'reply-review/verdict/malformed/prose-wrapped': 1 } } });
  expect(results.find(row => row.class === 'output-cap-answer')?.intent).toContain(MODEL_FAILURE_REPLY);
  expect(results.find(row => row.class === 'output-cap-review')?.callOutcomeCounts['output-cap']).toBe(1);
  expect(results.filter(row => row.class === 'review-timeout').every(row =>
    row.lastCallOutcomes.at(-1)?.localLimit === 'timeout' && row.sends === 1)).toBe(true);
});
