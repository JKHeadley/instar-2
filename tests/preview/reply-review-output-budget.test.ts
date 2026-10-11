import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { HOLDING_REPLY, REPLY_RULES, REVIEW_FORMAT_REMINDER, guidanceReviewRules, interpretJev,
  parseReplyReviewVerdict, parseReplyRevision, replyReviewContext, replyReviewQuestion, substantiveReply,
  type ReplyRule } from './reply-check.js';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';

const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const live = read('reply-review-output-budget-2026-10-10.json');
const verdict = (raw: string, rules?: ReplyRule[]) => {
  const answer = readAnswer(raw);
  if (!answer.ok) throw Error(answer.defect);
  return parseReplyReviewVerdict(answer.value, rules);
};

it('the recorded group review overran; the same context under the final request fits with every selected rule retained', () => {
  expect(live.update).toBe(715675418);
  expect(live.originalReview.outcome).toBe('uncertain');
  expect(live.originalReview.output).toBeNull();
  expect(live.originalReview.usage.outputTokens).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  for (const name of ['selected', 'all', 'revision-review']) {
    const run = live.runs[name];
    expect(run.exitCode).toBe(0);
    expect(run.signal).toBeNull();
    expect(run.usage.output_tokens).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    expect(createHash('sha256').update(replyReviewQuestion(run.rules)).digest('hex')).toBe(run.questionSha256);
    expect(verdict(run.raw, run.rules).findings!.map(f => f.rule)).toEqual(run.rules);
  }
  expect(live.runs.all.rules).toEqual(Object.keys(REPLY_RULES));
  expect(live.runs.selected.rules).toEqual(guidanceReviewRules(live.jev.ruleIds, true));
  expect(REVIEW_FORMAT_REMINDER).toContain('400 characters');
  expect(REVIEW_FORMAT_REMINDER).toContain('1500 tokens');
  // First review, correction and correction review all share the existing 60-second budget.
  expect(['selected', 'revision', 'revision-review'].reduce((ms, name) => ms + live.runs[name].elapsedMs, 0)).toBeLessThan(60000);
});

it.each(['unavailable', 'selected', 'all'] as const)('replays live update 715675418 through the worker: %s', async mode => {
  const directory = mkdtempSync(join(tmpdir(), 'review-output-budget-'));
  const now = 1791690055463;
  const journal = openPreviewJournal(join(directory, 'journal.encrypted'), new Uint8Array(32).fill(17), {
    kind: 'genesis', bot: '12345678', chat: '-1001234', forum: true, operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 10, maxTurns: 10, maxBytes: 65536, cursor: 0,
  });
  const sent: string[] = [], reviewed: string[] = [];
  const worker = createJournalWorker(journal, {
    now: () => now, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, 65536),
    model: async () => live.answer,
    replyCheck: {
      elapsedMs: () => 0,
      jev: async () => ({ value: live.jevRaw, latencyMs: live.jev.latencyMs }),
      escalate: async (text, _id, prompt, _rules, _deadline, operation) => {
        reviewed.push(text);
        expect(JSON.parse(replyReviewContext(prompt!, text)).candidateReply).toBe(text);
        if (mode === 'unavailable') throw Error('preview: reply review unavailable');
        const run = live.runs[operation === 'revision' ? 'revision-review' : mode];
        return { ...verdict(run.raw, run.rules), confidence: null, latencyMs: run.elapsedMs };
      },
      revise: async () => {
        const run = live.runs.revision, reading = readAnswer(run.raw);
        if (!reading.ok) throw Error(reading.defect);
        return { state: 'complete', ...parseReplyRevision(reading.value, run.rules) };
      },
    },
    checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
  });
  try {
    worker.intake([{ update_id: live.update, message: { chat: { id: -1001234, type: 'supergroup', is_forum: true },
      from: { id: 7654321 }, text: live.question } }]);
    await worker.drain(); await worker.drain();
    expect(reviewed[0]).toBe(live.answer);
    expect(sent).toHaveLength(1);
    if (mode === 'unavailable') {
      expect(sent[0]).toBe(live.delivered);
      expect(sent[0]).toBe(HOLDING_REPLY);
    } else {
      expect(sent[0]).toContain('probe-d9f5c8f8');
      expect(sent[0]).not.toContain(HOLDING_REPLY);
      if (mode === 'selected') expect(reviewed).toHaveLength(2);
    }
    expect(journal.view.order[0]!.sent).toBe(1);
  } finally { journal.close(); rmSync(directory, { recursive: true, force: true }); }
});

it('replays the recorded summary, uncertain, Jev, review and delivered/empty shapes without changing their meaning', () => {
  const shapes: { kind: string; id: string; raw: string }[] = read('retrospective-duty-followup-train-1-2026-10-08.json').otherShapes;
  expect(shapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided', 'jev-unsure',
    'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  for (const row of shapes) {
    if (row.kind === 'summary-writer') expect(readAnswer(row.raw).ok).toBe(true);
    if (row.kind === 'summary-uncertain') expect(JSON.parse(row.raw).state).toBe('uncertain');
    if (row.kind === 'jev-undecided') expect(JSON.parse(row.raw).verdict).toBe('undecided');
    if (row.kind === 'jev-unsure') {
      const recorded = JSON.parse(row.raw);
      expect(recorded.verdict).toBe('unsure');
      // This older score set predates one current question: missing evidence cannot become a pass.
      expect(() => interpretJev({ model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(recorded.scores)
        .map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, recorded.latencyMs)).toThrow('malformed');
      expect(interpretJev(live.jevRaw, live.jev.latencyMs).verdict).toBe('unsure');
    }
    if (row.kind === 'reply-review') expect(verdict(row.raw).findings!.length).toBeGreaterThan(0);
    // All retained shapes remain quoted context, including uncertainty, under the new review request.
    const prompt = JSON.stringify({ messages: [{ role: 'user', content: live.question },
      { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-group' },
        history: [{ update: row.id, recorded: row.raw }] } }) }] });
    const candidate = row.kind.includes('reply') && row.kind !== 'reply-review' ? row.raw : live.answer;
    const context = JSON.parse(replyReviewContext(prompt, candidate));
    expect(context.history[0].recorded).toBe(row.raw);
    expect(context.candidateReply).toBe(candidate);
    expect(replyReviewQuestion([])).toContain('1500 tokens');
    if (row.kind === 'empty-reply-in-recorded-context') expect(substantiveReply(context.candidateReply)).toBe(false);
    if (row.kind === 'delivered-reply') expect(substantiveReply(context.candidateReply)).toBe(true);
  }
  // The parser still accepts the real longer explanations and retains adverse findings.
  const sensitivity = read('sensitivity-live-2026-10-03.json');
  const findings = sensitivity.samples.filter((sample: { scenario: string }) => ['group-review', 'group-ordinary', 'group-revision-review'].includes(sample.scenario))
    .flatMap((sample: { raw: string }) => verdict(sample.raw).findings ?? []);
  expect(findings.some((f: { rule: string; verdict: string }) => f.rule === 'sensitive_disclosure' && f.verdict === 'violation')).toBe(true);
  expect(findings.some((f: { rule: string; verdict: string }) => f.rule === 'sensitive_disclosure' && f.verdict === 'pass')).toBe(true);
});
