import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import type { JournalView } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETROSPECTIVE_QUESTION, RETRO_DUTIES_UNREADABLE_NOTE,
  RETRO_DUTY_CODES, RETRO_DUTY_FINDING_REFUSED_NOTE, RETRO_PENDING_RECHECK_MS, WAIVER_EVIDENCE_UNAVAILABLE, disciplineSource,
  dutyLeftUninspected, owedCases, validateRetrospective,
  type RetroCase, type RetrospectivePlan } from './retrospective.js';

/** Plan row #382 (w3-retrocluster). The five live failures of cint-L37 02203355 in room two. The two the product
 * owns are replayed here; the two check-side ones (O24b, P50b) are replayed by the proposed `.sh` diffs against
 * their own recorded probe output, which is in this fixture so the shapes they now carry are pinned in the suite
 * as well.
 *
 * The live pass's own ANSWER is not recoverable: a failed `retro` row journals only its reason and usage, and the
 * live root cannot be read from this machine (the Studio file route refuses a download over 1 MiB; the journal is
 * 2401229 bytes), so it could not be re-asked either. What stands in for it is the REAL recorded model answers to
 * the previous live packet (retrospective-live-failures-2-2026-10-02.json, five verbatim answers of the live
 * room's own model through the production prepared ask) with exactly the one field the recorded reason names
 * mutated to the recorded failure class. Every other row in those answers — grades, findings, authorizations,
 * accounting, the efficiency sentence — is the real model's. */
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-3-2026-10-03.json',
  import.meta.url), 'utf8')) as {
    recorded: {
      livePass: { pass: number; at: number; state: string; reason: string; eligible: number; supplied: number;
        estimatedAnswerBytes: number; outputTokens: number; duties: unknown[] };
      retrospectiveCalls: number;
      i3b: { update: number; operatorMessage: string; priorQuestion: string; priorAnswerHeld: string;
        replyText: string; answerReason: string; checkVerdict: string; checkText: string };
      o24b: { verdict: string; error: string; r24: Record<string, { ok: boolean; value?: unknown[] }> };
      p50b: { verdict: string; retro: Record<string, { ok: boolean; error: string | null; value?: { duties: string[]; findings: unknown[] } }> };
    };
  };
const PRIOR = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-2-2026-10-02.json',
  import.meta.url), 'utf8')) as {
    recorded: { livePass: { at: number; contextDigest: string } };
    plan: Pick<RetrospectivePlan, 'omitted' | 'prior' | 'waiverAvailable' | 'waiverRefs'> & { cases: RetroCase[] };
    view: { dated: { source: string; quote: string; when: string; remind: true }[]; turns: Record<string, { at: number }> };
    realModelCalls: { call: number; answer: string }[];
  };
const live = FIXTURE.recorded.livePass;
const plan = PRIOR.plan;
const view = { retroPasses: [], dated: PRIOR.view.dated,
  turns: new Map(Object.entries(PRIOR.view.turns)) } as unknown as JournalView;
const answerOf = (call: number) => JSON.parse(PRIOR.realModelCalls.find(row => row.call === call)!.answer) as Record<string, unknown>;
const validate = (answer: unknown) => validateRetrospective(answer, plan, view, 0, PRIOR.recorded.livePass.at,
  PRIOR.recorded.livePass.contextDigest);
const at = (duty: string) => RETROSPECTIVE_DUTIES.indexOf(duty as typeof RETROSPECTIVE_DUTIES[number]);
const supplied = plan.cases.map(item => item.id);
/** The recorded refusal fires from one test with two arms and its reason does not say which: the answer parsed as
 * a clean object (the root recorded no retrospective JSON-shape class) and got past `wells`, so `duties` was
 * present and either not a string or not fourteen characters. Both arms are replayed. */
const UNREADABLE: [string, unknown][] = [
  ['one character short', 'n'.repeat(RETROSPECTIVE_DUTIES.length - 1)],
  ['one character long', 'n'.repeat(RETROSPECTIVE_DUTIES.length + 1)],
  ['not a string at all (the pre-compaction array)', RETROSPECTIVE_DUTIES.map(duty => ({ duty, disposition: 'inspected', note: 'checked' }))],
];

describe('the live pass-0 refusal of room two under cint-L37: an unreadable duties field', () => {
  it('pins the recorded live failure: one retrospective call, an answer inside the cap, and the whole pass discarded', () => {
    expect(live.state).toBe('failed');
    expect(live.reason).toBe('retrospective: duties needs one character per duty, in order');
    // The ask was right: the answer fitted its own budget and the route's 2048-token output cap.
    expect(live.outputTokens).toBeLessThan(2048);
    expect(live.estimatedAnswerBytes).toBe(1942);
    // Nothing at all was recorded, and all 30 eligible cases stayed owed for 12 supplied.
    expect(live.duties).toEqual([]);
    expect(live.supplied).toBe(12);
    expect(live.eligible).toBe(30);
    expect(FIXTURE.recorded.retrospectiveCalls).toBe(1);
  });

  for (const [why, duties] of UNREADABLE)
    it(`records every duty uninspected and keeps the pass when duties is ${why}`, () => {
      const answer = { ...answerOf(4), duties };
      const result = validate(answer);
      // Rule 9's floor: no duty is recorded inspected, because no position could be attributed to a duty.
      expect(result.duties).toHaveLength(RETROSPECTIVE_DUTIES.length);
      expect(result.duties.filter(row => row.disposition === 'inspected')).toEqual([]);
      for (const row of result.duties) expect(dutyLeftUninspected(row), row.duty).toBe(row.duty !== 'waiver-recurrence');
      // The plan stays the availability authority: a duty whose producer evidence is absent keeps ITS reason.
      expect(result.duties[at('waiver-recurrence')]).toEqual({ duty: 'waiver-recurrence', disposition: 'unavailable',
        note: WAIVER_EVIDENCE_UNAVAILABLE });
      expect(result.duties[at('waste')]).toEqual({ duty: 'waste', disposition: 'unavailable', note: RETRO_DUTIES_UNREADABLE_NOTE });
      // Rules 2, 95: the rest of the review the model really produced stands, and nothing unproven is recorded.
      expect(result.inspected).toEqual(supplied);
      expect(result.omitted).toEqual([]);
      expect(result.grades.map(row => row.case)).toEqual((answerOf(4).grades as { case: string }[]).map(row => row.case));
      expect(result.findings.map(row => row.duty)).toEqual(['recurrence']);
      expect(result.efficiency.summary.length).toBeGreaterThan(0);
      expect(result.gravityWells).toHaveLength(GRAVITY_WELLS.length);
    });

  it('the other side: the same real answer with its own fourteen-character duties string still decodes per position', () => {
    const answer = answerOf(4);
    expect((answer.duties as string).length).toBe(RETROSPECTIVE_DUTIES.length);
    const result = validate(answer);
    expect(result.duties.some(row => row.disposition === 'inspected')).toBe(true);
    expect(result.duties.some(row => row.note === RETRO_DUTIES_UNREADABLE_NOTE)).toBe(false);
    // `n` still means inspected-and-nothing-found, so the compact decode is untouched where it can be read.
    expect(result.duties[at('gravity-well')]).toEqual({ duty: 'gravity-well', disposition: 'inspected', note: RETRO_DUTY_CODES.n });
  });

  it('a character outside the verdict alphabet still refuses the whole pass: a different test, with no recorded instance', () => {
    const duties = `${'n'.repeat(RETROSPECTIVE_DUTIES.length - 1)}x`;
    expect(() => validate({ ...answerOf(4), duties })).toThrow('retrospective: duty benchmark-divergence has no verdict');
  });

  it('states the id-list shape in the question the model is given, and what a mis-spelt id costs', () => {
    expect(RETROSPECTIVE_QUESTION).toContain('uninspected: ONE ARRAY of the duty ids');
    expect(RETROSPECTIVE_QUESTION).toContain('NO duty is recorded inspected');
    expect(RETROSPECTIVE_QUESTION).not.toContain('ONE STRING');
  });
});

/** Plan #382 round 1 (Astra, MUST-FIX): an unreadable duties field recorded every duty uninspected but its pass
 * still retired every case it claimed, so the uninspected duty work left the scheduler for good. Replayed on the
 * real recorded answer (call 4) with only `duties` mutated, exactly the reviewer's probe. */
describe('a pass whose duties were unreadable retires none of its cases', () => {
  const messages = plan.cases.filter(item => item.category === 'message');
  const passOf = (pass: number, passAt: number, result: ReturnType<typeof validate>) =>
    ({ state: 'complete', pass, at: passAt, turnsSeen: 20, result });
  const after = (...passes: ReturnType<typeof passOf>[]) => ({ ...view, retroPasses: passes }) as unknown as JournalView;
  const passAt = PRIOR.recorded.livePass.at;

  for (const [why, duties] of UNREADABLE)
    it(`keeps every supplied message owed, even a week later, when duties is ${why}`, () => {
      const result = validate({ ...answerOf(4), duties });
      expect(messages.length).toBeGreaterThan(0);
      expect(owedCases(after(passOf(0, passAt, result)), messages, passAt + RETRO_PENDING_RECHECK_MS)
        .map(row => row.item.id)).toEqual(messages.map(item => item.id));
    });

  it('the other side: a later readable inspection of the same cases clears them', () => {
    const unread = validate({ ...answerOf(4), duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length - 1) });
    const read = validate(answerOf(4));
    const owed = owedCases(after(passOf(0, passAt, unread), passOf(1, passAt + 1, read)), messages, passAt + RETRO_PENDING_RECHECK_MS);
    expect(owed).toEqual([]);
  });
});

/** The source fix for the recurring positional defect: duty accounting is BY DUTY ID. Each real recorded answer is
 * re-expressed as the id list its own string implies (its `u` positions), so the accounting is the model's. */
describe('duty accounting by an uninspected id list', () => {
  const listOf = (codes: string) => RETROSPECTIVE_DUTIES.filter((_duty, index) => codes[index] === 'u');
  const asList = (answer: Record<string, unknown>) => {
    const { duties, ...rest } = answer;
    return { ...rest, uninspected: listOf(duties as string) };
  };
  for (const call of [1, 2, 3, 4, 5])
    it(`real answer ${String(call)}: every duty its string left uninspected stays uninspected, every other is inspected`, () => {
      const answer = answerOf(call);
      const byList = validate(asList(answer)).duties, listed = listOf(answer.duties as string);
      for (const row of byList) {
        if (listed.includes(row.duty) || row.duty === 'waiver-recurrence' && !plan.waiverAvailable) expect(row.disposition, row.duty).toBe('unavailable');
        // Any other duty is inspected unless the one finding the model wrote for it was refused under its own rules.
        else expect(row.disposition === 'inspected' || row.note.startsWith(RETRO_DUTY_FINDING_REFUSED_NOTE), row.duty).toBe(true);
      }
      // `f` is derived from the answer's own findings, never claimed, so no duty can be marked uncorroborated.
      const result = validate(asList(answer)), findings = result.findings.map(item => item.duty);
      const observed = result.gravityWells.some(row => row.observed);
      for (const row of byList) if (row.disposition === 'inspected')
        expect(row.note, row.duty).toBe(findings.includes(row.duty) || row.duty === 'gravity-well' && observed
          ? RETRO_DUTY_CODES.f : RETRO_DUTY_CODES.n);
    });

  it('a mis-counted list shifts nothing: each named id affects only itself', () => {
    const answer = asList(answerOf(4));
    const result = validate({ ...answer, uninspected: ['outcome'] });
    for (const row of result.duties) expect(row.disposition, row.duty)
      .toBe(row.duty === 'outcome' || row.duty === 'waiver-recurrence' && !plan.waiverAvailable ? 'unavailable' : 'inspected');
    expect(dutyLeftUninspected(result.duties[at('outcome')]!)).toBe(true);
  });

  it('a mis-spelt id makes the whole list unreadable rather than counting its intended duty inspected', () => {
    const result = validate({ ...asList(answerOf(4)), uninspected: ['outcom'] });
    expect(result.duties.filter(row => row.disposition === 'inspected')).toEqual([]);
    expect(result.duties[at('outcome')]!.note).toBe(RETRO_DUTIES_UNREADABLE_NOTE);
  });

  it('neither a list nor the legacy string is unreadable; an empty list inspects every available duty', () => {
    const { duties: _legacy, ...bare } = answerOf(4);
    expect(validate(bare).duties.filter(row => row.disposition === 'inspected')).toEqual([]);
    expect(validate({ ...bare, uninspected: 'outcome' }).duties.filter(row => row.disposition === 'inspected')).toEqual([]);
    const all = validate({ ...bare, uninspected: [] }).duties;
    expect(all.filter(row => row.disposition === 'unavailable').map(row => row.duty))
      .toEqual(plan.waiverAvailable ? [] : ['waiver-recurrence']);
  });

  it('the owed-work floor holds for an unreadable list too, and a readable list retires the cases', () => {
    const messages = plan.cases.filter(item => item.category === 'message');
    const passAt = PRIOR.recorded.livePass.at;
    const owedAfter = (result: ReturnType<typeof validate>) => owedCases({ ...view, retroPasses: [{ state: 'complete', pass: 0,
      at: passAt, turnsSeen: 20, result }] } as unknown as JournalView, messages, passAt + RETRO_PENDING_RECHECK_MS).length;
    expect(owedAfter(validate({ ...asList(answerOf(4)), uninspected: ['outcom'] }))).toBe(messages.length);
    expect(owedAfter(validate(asList(answerOf(4))))).toBe(0);
  });
});
