import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { JournalView } from './journal.js';
import { RETROSPECTIVE_DUTIES, RETRO_DUTY_CODES, RETRO_DUTY_UNCORROBORATED_NOTE,
  RETRO_DUTY_PART_UNREADABLE_NOTE, RETRO_DUTY_UNINSPECTED_NOTE, WAIVER_EVIDENCE_UNAVAILABLE, rowRefusedReason,
  dutyLeftUninspected, validateRetrospective, type RetroCase, type RetrospectivePlan } from './retrospective.js';

/** Plan row #339 (w3-retrolive2). Room two's first pass under cint-L33 was refused with 'duty outcome claims a
 * finding this answer does not contain' on an answer that FITTED the cap (1992 output tokens). A failed pass
 * journals only its reason, so the live answer itself is not recoverable; the pass-0 packet is, byte for byte,
 * and `realModelCalls` are three verbatim answers the live room's model gave to that exact packet through the
 * production prepared ask. Everything below replays recorded shapes; nothing is authored except the two
 * one-field neighbours that prove the other side of each decision. */
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-2-2026-10-02.json',
  import.meta.url), 'utf8')) as {
    recorded: { livePass: { reason: string; packetSha256: string; contextDigest: string; at: number; outputTokens: number } };
    plan: Pick<RetrospectivePlan, 'omitted' | 'prior' | 'waiverAvailable' | 'waiverRefs'> & { cases: RetroCase[]; state: string; packetSha256: string };
    view: { dated: { source: string; quote: string; when: string; remind: true }[]; turns: Record<string, { at: number }> };
    realModelCalls: { call: number; model: string; outputTokens: number; answer: string }[];
  };
const live = FIXTURE.recorded.livePass;
const plan = FIXTURE.plan;
/** The only parts of the journal view the validator reads on a root with no completed pass: the dated reminder
 * records behind each authorization case, and their source turns' times. */
const view = { retroPasses: [], dated: FIXTURE.view.dated,
  turns: new Map(Object.entries(FIXTURE.view.turns)) } as unknown as JournalView;
const answerOf = (call: number) => JSON.parse(FIXTURE.realModelCalls.find(row => row.call === call)!.answer) as Record<string, unknown>;
const validate = (answer: unknown) => validateRetrospective(answer, plan, view, 0, live.at, live.contextDigest);
const at = (duty: string) => RETROSPECTIVE_DUTIES.indexOf(duty as typeof RETROSPECTIVE_DUTIES[number]);
const supplied = plan.cases.map(item => item.id);

describe('the live pass-0 refusal of room two under cint-L33, replayed on its own packet', () => {
  it('replays the very packet the live pass sent', () => {
    expect(`sha256:${createHash('sha256').update(plan.state).digest('hex')}`).toBe(live.packetSha256);
    expect(plan.packetSha256).toBe(live.packetSha256);
    expect((JSON.parse(plan.state) as { cases: RetroCase[] }).cases.map(item => item.id)).toEqual(supplied);
    expect(live.reason).toBe('retrospective: duty outcome claims a finding this answer does not contain');
  });

  it('records an f with no finding behind it NOT inspected and keeps the pass: the live shape is f at outcome beside graded answers', () => {
    const answer = answerOf(1);
    // The recorded shape: `f` at outcome (and at removable-attention) with grade rows but no finding of either duty.
    expect((answer.duties as string)[at('outcome')]).toBe('f');
    expect((answer.findings as { duty: string }[]).map(row => row.duty)).toEqual(['recurrence', 'gravity-well']);
    expect((answer.grades as unknown[]).length).toBe(2);
    const result = validate(answer);
    for (const duty of ['outcome', 'removable-attention'])
      expect(result.duties[at(duty)], duty).toEqual({ duty, disposition: 'unavailable', note: RETRO_DUTY_UNCORROBORATED_NOTE });
    // The rest of the pass stands: every supplied case inspected, both grades, both findings, both authorizations.
    expect(result.inspected).toEqual(supplied);
    expect(result.omitted).toEqual([]);
    expect(result.grades.map(row => row.case)).toEqual(['answer:telegram:8989505249:update:6231053', 'verdict:telegram:8989505249:update:6231053:1']);
    expect(result.findings.map(row => row.duty)).toEqual(['recurrence', 'gravity-well']);
    expect(result.authorizations.map(row => row.case)).toEqual(['auth:reminder:fcd6debd100c', 'auth:reminder:32eb2106d425']);
    // A corroborated `f` stays inspected as a finding opened.
    expect(result.duties[at('recurrence')]).toEqual({ duty: 'recurrence', disposition: 'inspected', note: RETRO_DUTY_CODES.f });
  });

  it('the other side: the same answer WITH a finding of that duty records the duty inspected, finding opened', () => {
    const answer = answerOf(1);
    const outcomeFinding = { duty: 'outcome', refs: ['answer:telegram:8989505249:update:6231053'], summary: 'Graded met on its verdict.',
      disposition: { declined: 'Nothing to improve.' } };
    const result = validate({ ...answer, findings: [...answer.findings as unknown[], outcomeFinding] });
    expect(result.duties[at('outcome')]).toEqual({ duty: 'outcome', disposition: 'inspected', note: RETRO_DUTY_CODES.f });
    expect(result.duties[at('removable-attention')]!.disposition).toBe('unavailable');
  });

  it('drops a recurrence finding that names nothing it repeats, records its duty NOT inspected with the reason, and keeps the pass', () => {
    for (const call of [2, 3]) {
      const answer = answerOf(call);
      const recurrence = (answer.findings as { duty: string; recurs: unknown[] }[]).find(row => row.duty === 'recurrence')!;
      expect(recurrence.recurs, String(call)).toEqual([]);
      const result = validate(answer);
      expect(result.findings.some(row => row.duty === 'recurrence'), String(call)).toBe(false);
      expect(result.duties[at('recurrence')], String(call)).toEqual({ duty: 'recurrence', disposition: 'unavailable',
        note: `${RETRO_DUTY_UNCORROBORATED_NOTE} (finding row refused: a recurrence names what it repeats)` });
    }
    // Call 2 keeps every case inspected and both grades.
    expect(validate(answerOf(2)).inspected).toEqual(supplied);
    expect(validate(answerOf(2)).grades).toHaveLength(2);
    // Call 3 cites its own pass id ('retrospective:0') as evidence in both grade rows: a genuinely unknown record,
    // so both rows are dropped and both cases stay owed, while the other eight stand.
    const three = validate(answerOf(3));
    const unsound = ['answer:telegram:8989505249:update:6231053', 'verdict:telegram:8989505249:update:6231053:1'];
    expect(three.omitted).toEqual(unsound.map(id => ({ case: id, reason: 'grade row refused: outcome evidence cites an unknown record' })));
    expect(three.inspected).toEqual(supplied.filter(id => !unsound.includes(id)));
    expect(three.grades).toEqual([]);
    // Call 2's other finding stands under its own id; its `f` at feedback has no feedback row or finding behind it.
    const two = validate(answerOf(2));
    expect(two.findings.map(row => [row.id, row.duty])).toEqual([['retro:0:1', 'refuted-reason']]);
    expect(two.duties[at('feedback')]).toEqual({ duty: 'feedback', disposition: 'unavailable', note: RETRO_DUTY_UNCORROBORATED_NOTE });
    // Call 3's `f` at workaround has nothing behind it either.
    expect(validate(answerOf(3)).duties[at('workaround')]).toEqual({ duty: 'workaround', disposition: 'unavailable', note: RETRO_DUTY_UNCORROBORATED_NOTE });
  });

  it('keeps the refused row\'s reason whatever code its duty carries, and never records that duty unqualified clean (Rule 42)', () => {
    // Astra, cint-L35 round 1: call 3's recorded empty-`recurs` row, with ONLY the recurrence code changed. On n the
    // duty used to read "inspected; nothing found" with the refusal gone; on u the reason vanished too.
    const refused = '(finding row refused: a recurrence names what it repeats)';
    const withCode = (code: string) => { const answer = answerOf(3);
      const codes = answer.duties as string; return { ...answer, duties: codes.slice(0, at('recurrence')) + code + codes.slice(at('recurrence') + 1) }; };
    const n = validate(withCode('n'));
    expect(n.duties[at('recurrence')]).toEqual({ duty: 'recurrence', disposition: 'inspected', note: `inspected; finding refused ${refused}` });
    expect(dutyLeftUninspected(n.duties[at('recurrence')]!)).toBe(false);
    const u = validate(withCode('u'));
    expect(u.duties[at('recurrence')]).toEqual({ duty: 'recurrence', disposition: 'unavailable', note: `${RETRO_DUTY_UNINSPECTED_NOTE} ${refused}` });
    expect(dutyLeftUninspected(u.duties[at('recurrence')]!)).toBe(true);
    // The rest of each pass stands as on f.
    for (const result of [n, u]) expect(result.findings.some(row => row.duty === 'recurrence')).toBe(false);
    // A valid recurrence beside the refused one keeps the duty inspected, qualified by the refusal; the valid row is recorded.
    const answer = answerOf(3);
    const bad = (answer.findings as { duty: string }[]).find(row => row.duty === 'recurrence')!;
    const mixed = validate({ ...answer, findings: [...answer.findings as unknown[], { ...bad, recurs: ['turn:telegram:8989505249:update:6231055'] }] });
    expect(mixed.findings.map(row => row.duty)).toEqual(['recurrence']);
    expect(mixed.duties[at('recurrence')]).toEqual({ duty: 'recurrence', disposition: 'inspected', note: `${RETRO_DUTY_CODES.f} ${refused}` });
    // The other side: with nothing refused, n stays clean.
    const clean = answerOf(3);
    const cleanCodes = clean.duties as string;
    const ok = validate({ ...clean, findings: (clean.findings as { duty: string }[]).filter(row => row.duty !== 'recurrence'),
      duties: cleanCodes.slice(0, at('recurrence')) + 'n' + cleanCodes.slice(at('recurrence') + 1) });
    expect(ok.duties[at('recurrence')]).toEqual({ duty: 'recurrence', disposition: 'inspected', note: RETRO_DUTY_CODES.n });
  });

  it('a malformed finding naming no known duty is not recorded, and its reason is kept (changed by plan #412)', () => {
    // It used to refuse the whole pass, because there was no duty to record it on. It discharges nothing, so the pass
    // stands without it and its refusal is kept in refusedRows (Rule 42).
    const answer = answerOf(3);
    const bad = (answer.findings as { duty: string }[]).find(row => row.duty === 'recurrence')!;
    const result = validate({ ...answer, findings: [...answer.findings as unknown[], { ...bad, duty: 'not-a-duty' }] });
    expect(result.findings.map(row => row.duty)).not.toContain('not-a-duty');
    expect(result.refusedRows).toEqual([rowRefusedReason('finding', 'duty invalid')]);
    expect(validate(answer).refusedRows).toBeUndefined();
  });

  it('the other side: the same recurrence finding naming an earlier record it repeats is kept and its duty inspected', () => {
    const answer = answerOf(3);
    const findings = (answer.findings as { duty: string }[]).map(row => row.duty === 'recurrence'
      ? { ...row, recurs: ['turn:telegram:8989505249:update:6231055'] } : row);
    const result = validate({ ...answer, findings });
    expect(result.findings.map(row => row.duty)).toEqual(['recurrence']);
    expect(result.findings[0]!.recurs).toEqual(['turn:telegram:8989505249:update:6231055']);
    expect(result.duties[at('recurrence')]).toEqual({ duty: 'recurrence', disposition: 'inspected', note: RETRO_DUTY_CODES.f });
  });

  it('drops the promotion with a met outcome it records pending, and keeps the grade row: two replays graded the answer met on same-turn evidence', () => {
    // Call 1 cites the same-turn verdict, call 2 the question the answer replied to: neither is later than the answer.
    for (const [call, cited] of [[1, 'verdict:telegram:8989505249:update:6231053:1'], [2, 'turn:telegram:8989505249:update:6231053']] as const) {
      const answer = answerOf(call);
      const row = (answer.grades as { case: string; outcome: { assessment: string; evidence: string[] }; promote?: string }[])[0]!;
      expect([row.outcome.assessment, row.outcome.evidence, typeof row.promote], String(call))
        .toEqual(['met', [cited], 'string']);
      const grade = validate(answer).grades.find(item => item.case === row.case)!;
      expect(grade.outcome.assessment, String(call)).toBe('pending');
      expect(grade.promote, String(call)).toBeUndefined();
    }
    // The other side: an outcome the ANSWER left pending still may not carry a promotion — that row is refused
    // and its case stays owed, exactly as before.
    const answer = answerOf(1);
    const grades = (answer.grades as { outcome: Record<string, unknown> }[]).map((row, index) => index === 0
      ? { ...row, outcome: { ...row.outcome, assessment: 'pending', reason: 'Nothing later settles it yet.' } } : row);
    const refused = validate({ ...answer, grades });
    expect(refused.omitted).toEqual([{ case: 'answer:telegram:8989505249:update:6231053',
      reason: 'grade row refused: only a graded case is promoted' }]);
    // And a met outcome WITH later evidence keeps its promotion.
    const settled = (answer.grades as { outcome: Record<string, unknown> }[]).map((row, index) => index === 0
      ? { ...row, outcome: { ...row.outcome, evidence: ['turn:telegram:8989505249:update:6231054'] } } : row);
    expect(validate({ ...answer, grades: settled }).grades[0]!).toMatchObject({ outcome: { assessment: 'met' },
      promote: 'Operator asks which wins when stored memory/code conflicts with judgment.' });
  });

  it('never records a duty inspected on a claim the answer does not hold, across every recorded answer', () => {
    for (const { call, answer: raw } of FIXTURE.realModelCalls) {
      const answer = JSON.parse(raw) as { duties: string };
      const result = validate(answer);
      result.duties.forEach((row, index) => {
        const code = answer.duties[index]!;
        if (row.disposition === 'inspected') {
          expect(code, `${String(call)} ${row.duty}`).not.toBe('u');
          // An inspected `f` is backed by a recorded finding (or, for gravity-well, an observed well).
          if (code === 'f') expect(result.findings.some(item => item.duty === row.duty)
            || (row.duty === 'gravity-well' && result.gravityWells.some(well => well.observed)), `${String(call)} ${row.duty}`).toBe(true);
        } else expect(row.note === WAIVER_EVIDENCE_UNAVAILABLE || dutyLeftUninspected(row), `${String(call)} ${row.duty}`).toBe(true);
      });
      // The waiver duty is decided by the plan: no waiver producer on this root.
      expect(result.duties[at('waiver-recurrence')]).toEqual({ duty: 'waiver-recurrence', disposition: 'unavailable', note: WAIVER_EVIDENCE_UNAVAILABLE });
      // The efficiency duty ran on every one of them, so the status line reads 'efficiency duty ran'.
      expect(result.duties[at('waste')]!.disposition, String(call)).toBe('inspected');
      // And every one now completes with cases inspected — on cint-L33 every one of them refused the whole pass.
      expect(result.inspected.length, String(call)).toBeGreaterThan(0);
    }
    expect(FIXTURE.realModelCalls.map(row => row.call)).toEqual([1, 2, 3, 4, 5]);
  });

  it('never records an id the context never showed: the gravity-well duty is recorded not inspected (changed by plan #412)', () => {
    // It used to refuse the whole pass. The floor is unchanged: no well is recorded on an unknown ref, and the duty
    // whose row it was is not recorded inspected; every case the answer graded stands.
    const answer = answerOf(1);
    const result = validate({ ...answer, wells: (answer.wells as unknown[]).map((row, index) => index === 1 ? ['answer:telegram:1:update:1'] : row) });
    expect(result.gravityWells).toEqual([]);
    expect(result.duties[at('gravity-well')]).toEqual({ duty: 'gravity-well', disposition: 'unavailable',
      note: `${RETRO_DUTY_PART_UNREADABLE_NOTE} (gravity well refs cites an unknown record)` });
    expect(result.inspected).toEqual(validate(answer).inspected);
  });
});
