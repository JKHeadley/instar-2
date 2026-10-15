import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  SUBSCRIPTION_NATIVE_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-codex-provider.js';
import { checkReply, interpretJev, jevQuestions, jevRequestBody, replyJevQuestions, replyReviewContext,
  replyReviewQuestion, type ReplyCheckResult } from './reply-check.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/completeness-c1-2026-10-15.json', import.meta.url), 'utf8')) as {
  update: number; request: string; answer: string; maxOutputTokens: number;
  usage: { outputTokens: number }; jev: ReplyCheckResult;
};
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[];
};
const prompt = (request = captured.request) => prepareJournalEnvelope({ question: request, id: 'test:completeness',
  context: JSON.stringify({ audience: { surface: 'telegram-private-chat' },
    history: shapes.otherShapes.map(row => ({ source: row.id, text: row.raw })) }) }, 'claude-sonnet-5', 'grant:test', 1000);
const scores = (parks: number) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(jevQuestions)
  .map(rule => [rule, { type: 'noul', noul: rule === 'parks_on_user' ? parks : 0.01 }])) });
// Explicit counterfactual neighbors, not fresh provider captures or a production month detector.
const complete = 'Temperate Northern Hemisphere example; adjust to local frost dates.\n' + [
  'January: sow onions indoors for a head start; transplant none in frozen soil; harvest stored roots; check stores for rot.',
  'February: sow peppers indoors for their long season; transplant none outside; harvest winter greens; prepare seed trays.',
  'March: sow peas in cool soil; transplant hardy onions; harvest overwintered kale; compost beds before planting.',
  'April: sow carrots in warming soil; transplant brassicas; harvest radishes; cover seedlings against pests.',
  'May: sow beans after frost; transplant tomatoes; harvest lettuce; mulch to retain water.',
  'June: sow succession beans; transplant squash; harvest peas; water deeply for roots.',
  'July: sow fall carrots; transplant fall brassicas; harvest beans; shade greens against heat.',
  'August: sow spinach for autumn; transplant kale; harvest tomatoes; remove diseased leaves.',
  'September: sow winter greens under cover; transplant lettuce; harvest squash; protect against frost.',
  'October: sow cover crops to protect soil; transplant garlic cloves; harvest roots; mulch beds.',
  'November: sow none in frozen ground; transplant none; harvest hardy kale; store roots before hard frost.',
  'December: sow indoor microgreens; transplant none outside; harvest stored produce; review crops for next year.',
].join('\n');
const limited = captured.answer + '\nThis covers January–April only; May–December and their care details are missing because I have not completed the rest of the plan.';

it('replays the actual request with completion instructions on every inherited answer route', () => {
  expect(captured.update).toBe(46040043);
  expect(captured.usage.outputTokens).toBe(984);
  expect(captured.maxOutputTokens).toBe(2048);
  expect(captured.jev.verdict).toBe('pass'); // preserve the original miss, never relabel it
  for (const system of [SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
    SUBSCRIPTION_NATIVE_SYSTEM_PROMPT, CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT]) {
    const stub = (input: string) => {
      expect(JSON.parse(input).messages.find((m: { role: string }) => m.role === 'user').content).toBe(captured.request);
      expect(system).toContain('every requested item and category');
      expect(system).toContain('condense detail across the whole set');
      expect(system).toContain('state exactly what is missing and why');
      return captured.answer;
    };
    expect(stub(prompt())).toBe(captured.answer);
  }
});

it.each([
  ['four of twelve', captured.answer, 0.93, 'violation'],
  ['all twelve condensed', complete, 0.01, 'pass'],
  ['explicit partial limitation', limited, 0.01, 'pass'],
] as const)('%s takes the existing check route (stub judgments, recorded input)', async (_name, text, score, verdict) => {
  const records: ReplyCheckResult[] = [];
  let reviews = 0;
  const original = prompt();
  const decision = await checkReply(text, 'test:completeness', {
    elapsedMs: () => 0, reserveEscalation: () => true, record: row => records.push(row),
    jev: async (candidate, questions) => {
      expect(candidate).toBe(text);
      expect(questions?.parks_on_user?.instructions).toContain(JSON.stringify(captured.request));
      expect(questions?.parks_on_user?.instructions).toContain('silently omitting requested items or categories');
      expect(JSON.parse(jevRequestBody(candidate, undefined, original)).questions).toEqual(questions);
      return { value: scores(score), latencyMs: 1 };
    },
    escalate: async (candidate, _id, grounding, rules) => {
      reviews++;
      expect(rules).toContain('parks_on_user');
      expect(replyReviewQuestion(rules!)).toContain('silently omitting requested items');
      const context = JSON.parse(replyReviewContext(grounding!, candidate, rules));
      expect(context.operatorMessage).toBe(captured.request);
      expect(context.history.map((row: { source: string }) => row.source)).toEqual(shapes.otherShapes.map(row => row.id));
      return { verdict: 'violation', ruleIds: ['parks_on_user'], confidence: null, latencyMs: 1,
        reason: 'Only four months are supplied; eight months are absent without explanation.' };
    },
  }, original);
  expect(decision.outcome).toBe(verdict);
  expect(reviews).toBe(verdict === 'violation' ? 1 : 0);
  expect(records[0]?.ruleIds).toEqual(verdict === 'violation' ? ['parks_on_user'] : []);
});

it('quotes arbitrary full-set requests without a keyword selector and preserves approval questions', () => {
  for (const request of ['Explain every stage of this process.', 'Compare both alternatives.', 'Hello!']) {
    const questions = replyJevQuestions(prompt(request), { request: 'TEST-request', change: 'does TEST work' });
    expect(questions.parks_on_user?.instructions).toContain(JSON.stringify(request));
    expect(questions).toHaveProperty('approval_report');
    expect(questions.credential).toEqual(jevQuestions.credential);
  }
  expect(replyJevQuestions()).toEqual(jevQuestions);
  expect(replyJevQuestions('{')).toEqual(jevQuestions);
  expect(replyJevQuestions(JSON.stringify({ messages: [] }))).toEqual(jevQuestions);
  expect(interpretJev(scores(0.55), 1).verdict).toBe('unsure');
});

it.each([complete, limited])('the existing worker revises the captured omission and sends once', async replacement => {
  const root = mkdtempSync(join(tmpdir(), 'completeness-'));
  const path = join(root, 'journal'); const key = new Uint8Array(32).fill(7);
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:test', configurationDigest: 'sha256:test', expires: 9999999999999,
    maxCalls: 5, maxReplies: 3, maxTurns: 2, maxBytes: 32768, cursor: 0 });
  try {
    const sent: string[] = []; let revisions = 0; let reservedBytes = 0;
    const append = journal.append.bind(journal);
    journal.append = row => {
      if (row.kind === 'reply-jev-reserve') reservedBytes = row.maxInputTokens ?? 0;
      return append(row);
    };
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:test', 1000),
      model: async () => captured.answer, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 0,
        jev: async (text, questions) => {
          expect(questions?.parks_on_user?.instructions).toContain(JSON.stringify(captured.request));
          expect(reservedBytes).toBe(Buffer.byteLength(JSON.stringify({ state: text, model: 'jev-1.13.0', questions })));
          return { value: scores(0.93), latencyMs: 1 };
        },
        escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => operation === 'revision'
          ? { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 1 }
          : { verdict: 'violation', ruleIds: ['parks_on_user'], confidence: null, latencyMs: 1,
            reason: 'The requested eight remaining months are missing.' },
        revise: async input => {
          revisions++;
          expect(input.ruleIds).toContain('parks_on_user');
          return { state: 'complete', text: replacement, usage: { inputTokens: 10, outputTokens: 10, charge: null } };
        } },
      send: async input => { sent.push(input.expectedText); return sent.length; } });
    worker.intake([{ update_id: captured.update, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: captured.request } }]);
    await worker.drain();
    expect(revisions).toBe(1);
    expect(sent).toEqual([replacement]);
    expect(journal.view.order[0]?.answer).toBe(captured.answer);
    journal.close();
    const reopened = openPreviewJournal(path, key);
    await createJournalWorker(reopened, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('repeat model'); }, checkOutbound: () => {},
      send: async () => { throw Error('duplicate send'); } }).drain();
    expect(reopened.view.order[0]?.sent).toBe(1);
    reopened.close();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
