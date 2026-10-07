/** D1c on the live build rc-2 7d2ba68b (plan #610, w4-d1chold; Rules 8, 22, 92, 95, 42).
 *
 * Proof room 2, 2026-10-06 18:25 PDT, update 6232582 ("hi"): the turn that hands over two finished deferred results.
 * Jev scored the reply unsure on four rules, so the full-context review ran. Both of its answers (the first and the one
 * format re-ask) judged EVERY rule PASS, but each quoted the reply's own `Follow-up on "..."` text inside `reasoning`
 * without escaping the quotes. Both whole objects were refused (`reply-review/decision/malformed/prose-wrapped`), the
 * verdict became `unavailable` after 43 s, and the reply left with no completed review (`reviewUnavailableReleases` 1).
 * The proof saw no reply only because that send then failed in transport (`fetch-failure`, delivery UNKNOWN).
 *
 * Every case replays recorded bytes (fixture provenance in the file): the two refused reviews, the recorded Jev answer,
 * and, for the other side, the live 2026-10-04 review with the same slip whose verdict was a real VIOLATION. */
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { quotedReasoning, readAnswer } from './answer-reading.js';
import { parseModelJson } from './model-json.js';
import { checkReply, guidanceReviewRules, interpretJev, parseReplyReviewVerdict, REVIEW_MALFORMED,
  type ReplyCheckPorts, type ReplyCheckResult, type ReplyRule } from './reply-check.js';
import { REVIEW_HOLDING_RULES } from './journal.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/handover-review-quotes-live-2026-10-06.json', import.meta.url), 'utf8')) as {
  candidate: string; jev: { output: string; recordedRuleIds: ReplyRule[] }; selectedRules: ReplyRule[];
  reviews: { attempt: string; recordedShape: string; output: string }[]; control: { output: string; recordedRuleIds: ReplyRule[] } };
const earlier = (JSON.parse(readFileSync(new URL('./fixtures/runner-task-protocol-live-2026-10-04.json', import.meta.url), 'utf8')) as {
  live: { replyReviewFieldsBroken: { output: string } } }).live.replyReviewFieldsBroken.output;
const EARLIER_RULES: ReplyRule[] = ['claims_blocked', 'parks_on_user', 'unrecorded_blocker', 'self_state_claim', 'breaks_preference', 'quits_on_self'];

/** The runner's reply-review step (journal-agent escalate): read the result as a gate, a refused reading is a format miss
 * the worker may re-ask once, and the verdict must name exactly the selected rules. `read` is the reader under test. */
function ports(outputs: readonly string[], selected: readonly ReplyRule[], read = (raw: string) => readAnswer(raw, { wrapped: 'refuse' })) {
  const recorded: ReplyCheckResult[] = [];
  let calls = 0;
  const port: ReplyCheckPorts = {
    jev: async () => ({ value: JSON.parse(fixture.jev.output) as unknown, latencyMs: 196 }),
    escalate: async () => {
      const reading = read(outputs[Math.min(calls++, outputs.length - 1)]!);
      if (!reading.ok) throw Error(REVIEW_MALFORMED);
      const parsed = parseReplyReviewVerdict(reading.value, selected);
      return { verdict: parsed.verdict, ruleIds: parsed.ruleIds, confidence: null, latencyMs: 1, reason: parsed.reason,
        ...(parsed.findings ? { findings: parsed.findings } : {}) };
    },
    reserveEscalation: () => true, reserveFormatRetry: () => true,
    record: result => { recorded.push(result); }, elapsedMs: () => 0,
  };
  return { port, recorded, calls: () => calls };
}

it('the recorded Jev answer is what sent the hand-over to the full-context review', () => {
  const jev = interpretJev(JSON.parse(fixture.jev.output), 196);
  expect(jev).toMatchObject({ verdict: 'unsure', ruleIds: fixture.jev.recordedRuleIds });
  expect(new Set(guidanceReviewRules(jev.ruleIds))).toEqual(new Set(fixture.selectedRules));
  expect(fixture.candidate).toContain('Follow-up on "Got it — added to my list');
});

it('both refused reviews were whole objects whose only defect was unescaped quotes in reasoning; each now reads as written', () => {
  for (const review of fixture.reviews) {
    // The recorded refusal: the gate's narrow reading, unchanged.
    expect(parseModelJson(review.output), review.attempt).toEqual({ ok: false, shape: 'prose-wrapped' });
    expect(review.output.trim().startsWith('{"reasoning":"')).toBe(true);
    const reading = readAnswer(review.output, { wrapped: 'refuse' });
    expect(reading, review.attempt).toMatchObject({ ok: true, shape: 'reasoning-quotes', envelope: 'flat' });
    if (!reading.ok) throw Error('unreachable');
    // Nothing is discarded: the reasoning keeps every quote it wrote, and the verdict fields are exactly the written ones.
    expect(reading.reason).toContain('"Follow-up on..."');
    const verdict = parseReplyReviewVerdict(reading.value, fixture.selectedRules);
    expect(verdict, review.attempt).toMatchObject({ verdict: 'pass', ruleIds: [] });
    expect(verdict.findings).toHaveLength(fixture.selectedRules.length);
  }
  // The next turn's review was already a whole valid object: still the bare reading, verdict unchanged.
  const control = readAnswer(fixture.control.output, { wrapped: 'refuse' });
  expect(control).toMatchObject({ ok: true, shape: 'bare' });
  if (control.ok) expect(parseReplyReviewVerdict(control.value).ruleIds).toEqual(fixture.control.recordedRuleIds);
});

it('replayed through the check: the recorded hand-over now passes its review on the first answer; before, two calls ended unavailable', async () => {
  const outputs = fixture.reviews.map(review => review.output);
  const after = ports(outputs, fixture.selectedRules);
  expect(await checkReply(fixture.candidate, 'telegram:8989505249:update:6232582', after.port)).toEqual({ outcome: 'pass', path: 'subscription' });
  expect(after.calls()).toBe(1);
  expect(after.recorded.at(-1)).toMatchObject({ verdict: 'pass', ruleIds: [], path: 'subscription' });
  // The recorded outcome, reproduced with the narrow reading alone: two review calls, then `unavailable` with Jev's rules.
  const narrow = (raw: string) => { const parsed = parseModelJson(raw);
    return parsed.ok ? readAnswer(raw, { wrapped: 'refuse' }) : { ok: false as const, shape: parsed.shape, defect: 'refused' }; };
  const before = ports(outputs, fixture.selectedRules, narrow);
  expect(await checkReply(fixture.candidate, 'telegram:8989505249:update:6232582', before.port)).toEqual({ outcome: 'unavailable', path: 'subscription' });
  expect(before.calls()).toBe(2);
  expect(before.recorded.at(-1)).toMatchObject({ verdict: 'unavailable', ruleIds: fixture.jev.recordedRuleIds });
});

it('a genuinely bad reply is still objected to and held: the same slip on a real VIOLATION review now keeps its objections', async () => {
  // Live 2026-10-04: the review of "I couldn't record that memory change. Please send it again." had the same
  // unescaped quotes in reasoning; refused, it became an unchecked release. Read now, its holding objection stands.
  const earlierRun = ports([earlier], EARLIER_RULES);
  expect(await checkReply('PREVIEW — I couldn\'t record that memory change. Please send it again.', 'earlier', earlierRun.port))
    .toEqual({ outcome: 'violation', path: 'subscription' });
  const objection = earlierRun.recorded.at(-1)!;
  expect(objection.ruleIds).toEqual(['claims_blocked', 'unrecorded_blocker', 'self_state_claim']);
  expect(objection.ruleIds.some(rule => REVIEW_HOLDING_RULES.includes(rule))).toBe(true);
  // The hand-over's own recorded review with one verdict written as a violation: read as that violation, never a pass.
  const flipped = fixture.reviews[0]!.output.replace('"unrecorded_blocker":"PASS | ', '"unrecorded_blocker":"VIOLATION | ');
  expect(flipped).not.toBe(fixture.reviews[0]!.output);
  const run = ports([flipped], fixture.selectedRules);
  expect(await checkReply(fixture.candidate, 'flipped', run.port)).toEqual({ outcome: 'violation', path: 'subscription' });
  expect(run.recorded.at(-1)!.ruleIds).toEqual(['unrecorded_blocker']);
});

it('only the one meaning is read: prose outside, a defect in a later field, or a second reasoning stay refused', () => {
  const raw = fixture.reviews[0]!.output;
  // Text outside the object: a gate never discards it (Rule 95).
  expect(readAnswer(`Looking at it: ${raw}`, { wrapped: 'refuse' }).ok).toBe(false);
  expect(readAnswer(`${raw}\nVIOLATION | actually not`, { wrapped: 'refuse' }).ok).toBe(false);
  // An unescaped quote inside a LATER field: a later boundary would parse, but reading there would fold the fields
  // before it into reasoning, so nothing is read.
  const laterField = raw.replace('"parks_on_user":"PASS | No task', '"parks_on_user":"PASS | No "task"');
  expect(laterField).not.toBe(raw);
  expect(quotedReasoning(laterField)).toBeNull();
  expect(readAnswer(laterField, { wrapped: 'refuse' }).ok).toBe(false);
  // A closed leading object plus something else: a second object, with or without an intervening rejection. The
  // boundary search must not cross that close -- escaping it, and everything after it, into the first `reasoning`
  // left only `{"unrecorded_blocker":"PASS | no blocker"}`, which the exact-selected-rules check then accepted as a
  // pass while the written VIOLATION outside was gone. The multiple-objects refusal it arrived with stands.
  for (const between of [' VIOLATION: do not release ', '']) {
    const two = `{"reasoning":"first answer"}${between}{"reasoning":"second answer","unrecorded_blocker":"PASS | no blocker"}`;
    expect(parseModelJson(two, { wrapped: 'refuse' }), between).toEqual({ ok: false, shape: 'multiple-objects' });
    expect(quotedReasoning(two), between).toBeNull();
    expect(readAnswer(two, { wrapped: 'refuse' }), between).toMatchObject({ ok: false, shape: 'multiple-objects' });
  }
  // A second `reasoning`, a reasoning that is not first, and a response that is not one object.
  expect(quotedReasoning('{"reasoning":"he said "hi"","claims_blocked":"PASS | a","reasoning":"x"}')).toBeNull();
  expect(quotedReasoning('{"claims_blocked":"PASS | a","reasoning":"he said "hi""}')).toBeNull();
  expect(quotedReasoning('{"reasoning":"he said "hi""}')).toBeNull();
  expect(quotedReasoning('{"reasoning":"he said "hi"","claims_blocked":"PASS | a"} trailing')).toBeNull();
  // The one reading, minimal: the quotes are kept as text, the field is exactly as written.
  expect(quotedReasoning('{"reasoning":"he said "hi" and \\"bye\\"", "claims_blocked":"PASS | a"}'))
    .toEqual({ reasoning: 'he said "hi" and "bye"', claims_blocked: 'PASS | a' });
});
