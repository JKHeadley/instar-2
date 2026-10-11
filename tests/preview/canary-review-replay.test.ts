/** Observer 273: real failed train-9 probe, not a synthesized reviewer response. */
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readAnswer } from './answer-reading.js';
import { AUDIENCE_RULES, CONTEXT_RULES, GROUP_REVIEW_FINAL_NOTICE, checkReply, parseReplyReviewVerdict,
  type ReplyCheckResult, type ReplyRule } from './reply-check.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/canary9-review-2026-10-11.json', import.meta.url), 'utf8'));
const selected: ReplyRule[] = [...AUDIENCE_RULES, ...CONTEXT_RULES];
const valueOf = (output: string) => {
  const read = readAnswer(output, { wrapped: 'refuse', evidence: [captured.id], object: true });
  if (!read.ok) throw Error(read.defect);
  return read.value;
};

it('replays both completed reviews of update 969390374 through the group escalation path', async () => {
  expect(captured.delivered).toBe(GROUP_REVIEW_FINAL_NOTICE);
  expect(captured.checks.map((row: ReplyCheckResult) => row.verdict)).toEqual(['pass', 'unavailable']);
  for (const review of captured.reviews) {
    expect(review.outcome).toBe('complete');
    const checks: ReplyCheckResult[] = [];
    let calls = 0, retries = 0;
    const originalPrompt = JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({
      packet: { audience: captured.audience, operatorMessage: captured.text, candidateReply: captured.answer } }) }] });
    const decision = await checkReply(captured.answer, captured.id, {
      elapsedMs: () => 0, reserveEscalation: () => true, reserveFormatRetry: () => { retries++; return true; },
      jev: async () => ({ value: captured.jev, latencyMs: captured.checks[0].latencyMs }),
      escalate: async (_text, _id, _prompt, rules) => {
        calls++;
        expect(rules).toEqual(selected);
        return { ...parseReplyReviewVerdict(valueOf(review.output), rules), confidence: null, latencyMs: 0 };
      }, record: row => checks.push(row),
    }, originalPrompt);
    expect(decision).toEqual({ outcome: 'pass', path: 'subscription' });
    expect(calls).toBe(1);
    expect(retries).toBe(0);
    expect(checks.at(-1)?.findings).toHaveLength(7);
  }
});

it('retains every extra known violation, and still refuses missing, unknown, duplicate or malformed findings', () => {
  const original = JSON.parse(valueOf(captured.reviews[0].output));
  for (const rule of ['credential', 'sensitive_disclosure', 'defers_work'] as const) {
    const verdict = parseReplyReviewVerdict(JSON.stringify({ ...original, [rule]: 'VIOLATION | Recorded negative neighbour.' }), selected);
    expect(verdict.verdict).toBe('violation');
    expect(verdict.ruleIds).toEqual([rule]);
    expect(verdict.findings?.find(item => item.rule === rule)?.verdict).toBe('violation');
  }
  const missing = { ...original }; delete missing.sensitive_disclosure;
  for (const invalid of [missing, { ...original, alien_rule: 'PASS | Unknown.' },
    { ...original, credential: 'UNSURE | No verdict.' }, { ...original, credential: 'PASS | ' }])
    expect(() => parseReplyReviewVerdict(JSON.stringify(invalid), selected)).toThrow('malformed');
  const lines = Object.entries(original).map(([rule, verdict]) => `${rule}: ${verdict}`).join('\n');
  expect(() => parseReplyReviewVerdict(`${lines}\nsensitive_disclosure: PASS | Duplicate.`, selected)).toThrow('malformed');
});

// Observer 106: archived live/proof-room shapes stay distinct from completed reply reviews.
// Sources and update ids are carried by the fixture; an empty recorded candidate is not proof of delivery.
const archive = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string; source: string }[] };
it.each(archive.otherShapes)('preserves the review boundary on recorded $kind ($id)', row => {
  if (row.kind === 'reply-review') {
    const read = readAnswer(row.raw, { wrapped: 'refuse', object: true });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(parseReplyReviewVerdict(read.value, ['defers_work', 'self_state_claim', 'breaks_preference']))
      .toMatchObject({ verdict: 'violation', ruleIds: ['breaks_preference'] });
  } else {
    const read = readAnswer(row.raw, { wrapped: 'refuse', object: true });
    expect(() => parseReplyReviewVerdict(read.ok ? read.value : row.raw, selected)).toThrow('malformed');
  }
});
