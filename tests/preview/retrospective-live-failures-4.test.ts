import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';
import type { JournalView } from './journal.js';
import { RETROSPECTIVE_DUTIES, RETRO_DUTIES_UNREADABLE_NOTE, RETRO_DUTY_PART_UNREADABLE_NOTE, RETRO_DUTY_ROWS_NOTE, RETRO_DUTY_UNCORROBORATED_NOTE, RETRO_DUTY_UNINSPECTED_NOTE,
  RETRO_UNACCOUNTED_REASON, owedCases, rowMissingReason, rowRefusedReason, validateRetrospective, type RetroCase, type RetroPass, type RetroResult, type RetrospectivePlan } from './retrospective.js';

/** Plan row #412 (w3-retrocut). Room two's only pass on the cint-L40 root was discarded whole with 'a verdict case
 * was not graded or deferred' on an answer that FITTED the cap (1418 output tokens): the fourth live pass in a row
 * lost to one per-case or per-duty refusal. The live answer is not recoverable (a failed pass journals only its
 * reason); its packet is, byte for byte, and `realModelCalls` are four verbatim answers the live room's model gave
 * to that exact packet. Each test below takes a REAL answer and changes the one field the recorded failure names. */
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-4-2026-10-03.json',
  import.meta.url), 'utf8')) as {
    recorded: { livePass: { reason: string; packetSha256: string; contextDigest: string; at: number; outputTokens: number };
      earlierLiveRefusals: Record<string, string> };
    plan: Pick<RetrospectivePlan, 'omitted' | 'prior' | 'waiverAvailable' | 'waiverRefs'> & { cases: RetroCase[]; state: string; packetSha256: string };
    realModelCalls: { call: number; model: string; outputTokens: number; answer: string }[];
    branchQuestionCalls: { call: number; model: string; outputTokens: number; answer: string }[];
  };
const live = FIXTURE.recorded.livePass;
const plan = FIXTURE.plan;
/** No authorization, open or rerun case and no earlier pass: the validator reads nothing else from the view. */
const view = { retroPasses: [], dated: [], turns: new Map() } as unknown as JournalView;
type Answer = Record<string, unknown> & { inspected: string[]; grades: { case: string }[] };
const answers = FIXTURE.realModelCalls.map(row => JSON.parse(row.answer) as Answer);
const validate = (answer: unknown) => validateRetrospective(answer, plan, view, 0, live.at, live.contextDigest);
const supplied = plan.cases.map(item => item.id);
const verdict = plan.cases.find(item => item.category === 'verdict')!.id;
const turns = plan.cases.filter(item => item.category === 'message').map(item => item.id);
/** What stays owed once this pass is recorded complete: the scheduler's own reading, over the supplied cases. */
const owedAfter = (result: RetroResult) => owedCases({ retroPasses: [{ pass: 0, at: live.at, turnsSeen: 10, cases: supplied, omitted: [],
  eligible: supplied.length, packetSha256: live.packetSha256, contextDigest: live.contextDigest, state: 'complete', result } satisfies RetroPass] } as unknown as JournalView,
plan.cases, live.at).map(row => row.item.id).sort();
/** The floor every accepted result must keep: nothing inspected that is not a supplied case, and no inspected
 * decision or verdict without its grade row. */
const floor = (result: RetroResult) => {
  for (const id of result.inspected) expect(supplied).toContain(id);
  for (const item of plan.cases) if ((item.category === 'decision' || item.category === 'verdict') && result.inspected.includes(item.id))
    expect(result.grades.map(row => row.case), item.id).toContain(item.id);
  expect(new Set([...result.inspected, ...result.omitted.map(row => row.case)])).toEqual(new Set(supplied));
};

describe('the live pass-0 refusal of room two under cint-L40, replayed on its own packet', () => {
  it('replays the very packet the live pass sent', () => {
    expect(`sha256:${createHash('sha256').update(plan.state).digest('hex')}`).toBe(live.packetSha256);
    expect(plan.packetSha256).toBe(live.packetSha256);
    expect(plan.cases).toHaveLength(12);
    expect(live.reason).toBe('retrospective: a verdict case was not graded or deferred');
    expect(FIXTURE.realModelCalls.map(row => [row.call, row.model])).toEqual([1, 2, 3, 4].map(call => [call, 'claude-sonnet-5']));
  });

  it('completes the recorded class, an inspected verdict with no grade row, with only that verdict owed', () => {
    for (const [index, answer] of answers.entries()) {
      const call = String(index + 1);
      // The recorded class: the verdict is inspected, and the answer holds no grade for it.
      expect(answer.inspected, call).toContain(verdict);
      const mutated = { ...answer, grades: answer.grades.filter(row => row.case !== verdict) };
      const whole = validate(answer), cut = validate(mutated);
      floor(cut);
      expect(cut.inspected, call).toEqual(whole.inspected.filter(id => id !== verdict));
      expect(cut.omitted, call).toEqual([...whole.omitted.filter(row => row.case !== verdict),
        { case: verdict, reason: 'grade row missing; deferred to a later pass' }]);
      expect(cut.grades.map(row => row.case), call).not.toContain(verdict);
      // Nothing else the review produced is lost to that one row.
      // ...except refuted-reason where only the cut verdict's grade row stood behind it (RETRO_ROW_BACKED_DUTIES): with
      // that row gone the answer's own `u` stands.
      const other = (rows: typeof whole.duties) => rows.filter(row => row.duty !== 'refuted-reason');
      expect(other(cut.duties), call).toEqual(other(whole.duties));
      const refuted = (rows: typeof whole.duties) => rows.find(row => row.duty === 'refuted-reason')!;
      expect(refuted(cut.duties), call).toEqual(refuted(whole.duties).note === RETRO_DUTY_ROWS_NOTE
        ? { duty: 'refuted-reason', disposition: 'unavailable', note: RETRO_DUTY_UNINSPECTED_NOTE } : refuted(whole.duties));
      expect(cut.findings, call).toEqual(whole.findings);
      expect(cut.efficiency, call).toEqual(whole.efficiency);
      expect(owedAfter(cut), call).toContain(verdict);
      expect(owedAfter(cut), call).toEqual([...new Set([...owedAfter(whole), verdict])].sort());
    }
    expect(rowMissingReason('grade')).toBe('grade row missing; deferred to a later pass');
  });

  it('the other side: the same real answers, unmutated, record the verdict inspected with its grade', () => {
    for (const answer of answers.slice(0, 3)) {
      const result = validate(answer);
      floor(result);
      expect(result.grades.map(row => row.case)).toContain(verdict);
      expect(owedAfter(result)).not.toContain(verdict);
    }
    // Call 4 wrote a verdict grade that breaks its own rules (it cites its own observation as outcome evidence):
    // the row is refused, and that one case stays owed with the reason, as a missing row does.
    const fourth = validate(answers[3]);
    floor(fourth);
    expect(fourth.omitted).toContainEqual({ case: verdict, reason: 'grade row refused: an attributed observation is not outcome evidence' });
  });

  it('completes the earlier recorded classes on the same real answers, each with the right owed set', () => {
    const answer = answers[2]!;
    // Plan #289's class, 'a case is neither inspected nor omitted, or both': three messages in neither, one in both.
    const [a, b, c, d] = turns;
    const unaccounted = validate({ ...answer, inspected: answer.inspected.filter(id => id !== a && id !== b && id !== c),
      omitted: [{ case: d, reason: 'later' }] });
    floor(unaccounted);
    expect(unaccounted.omitted).toEqual(expect.arrayContaining([{ case: d, reason: 'later' },
      ...[a, b, c].map(id => ({ case: id, reason: RETRO_UNACCOUNTED_REASON }))]));
    expect(owedAfter(unaccounted)).toEqual(expect.arrayContaining([a, b, c, d].map(String)));
    // Plan #339's class, an `f` with no finding behind it: the legacy string with `f` at outcome. The duty is not
    // inspected; every case keeps the disposition it had.
    const legacy = RETROSPECTIVE_DUTIES.map(duty => duty === 'outcome' ? 'f' : duty === 'waiver-recurrence' ? 'u' : 'n').join('');
    const fAtOutcome = validate({ ...answer, uninspected: undefined, duties: legacy });
    floor(fAtOutcome);
    expect(fAtOutcome.duties[RETROSPECTIVE_DUTIES.indexOf('outcome')]).toEqual({ duty: 'outcome', disposition: 'unavailable', note: RETRO_DUTY_UNCORROBORATED_NOTE });
    expect(owedAfter(fAtOutcome)).toEqual(owedAfter(validate(answer)));
    // Plan #382's class, a duties string one character short: no duty inspected, and no case retired by this pass.
    const short = validate({ ...answer, uninspected: undefined, duties: legacy.slice(1) });
    floor(short);
    expect(short.duties.every(row => row.disposition === 'unavailable')).toBe(true);
    expect(short.duties.filter(row => row.duty !== 'waiver-recurrence').every(row => row.note === RETRO_DUTIES_UNREADABLE_NOTE)).toBe(true);
    expect(owedAfter(short)).toEqual([...supplied].sort());
  });

  it('fails a pass only when there is no answer to classify, and then every supplied case stays owed', () => {
    // Pass-level: not an object, or an object with no inspected list (the recorded bare-wrong-fields shape).
    expect(() => validate('nothing')).toThrow('retrospective: answer not an object');
    expect(() => validate({ ...answers[0], inspected: undefined })).toThrow('retrospective: inspected not a list');
    expect(() => validate({ review: 'nothing found', duty_rows: 14, wells_checked: 7 })).toThrow('retrospective: inspected not a list');
    // A failed pass retires nothing: the scheduler reads only complete passes.
    expect(owedCases({ retroPasses: [{ pass: 0, at: live.at, turnsSeen: 10, cases: supplied, omitted: [], eligible: 12, packetSha256: live.packetSha256,
      contextDigest: live.contextDigest, state: 'failed', reason: live.reason }] } as unknown as JournalView, plan.cases, live.at).map(row => row.item.id).sort())
      .toEqual([...supplied].sort());
    // The other side: an answer that inspects nothing but is still an answer completes, with every case owed.
    const none = validate({ ...answers[0], inspected: [] });
    expect(none.inspected).toEqual([]);
    expect(owedAfter(none)).toEqual([...supplied].sort());
  });

  it('keeps every real answer complete whatever else it got wrong, and records why each case stays owed', () => {
    for (const answer of answers) {
      const result = validate(answer);
      floor(result);
      expect(result.inspected.length).toBeGreaterThan(0);
      for (const row of result.omitted) expect(row.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('completes the two real answers asked with this branch\'s question, each inside the cap', () => {
    for (const row of FIXTURE.branchQuestionCalls) {
      expect(row.outputTokens).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
      const result = validate(JSON.parse(row.answer));
      floor(result);
      expect(result.inspected.length, String(row.call)).toBeGreaterThan(0);
    }
  });
});

/** Plan #412's map: every refusal the validator used to raise, driven through a REAL answer with that one field
 * changed, lands where the map says. Case-level: the case is recorded omitted with the reason and stays owed.
 * Duty-level: that duty is recorded not inspected with the reason. A row that names no supplied case: not recorded,
 * its reason kept in refusedRows. Pass-level (only when there is no answer to classify): the pass fails. */
describe('every refusal class is classified, never discarding a pass it can classify (plan #412)', () => {
  const answer = answers[2]!;
  const decision = plan.cases.find(item => item.category === 'decision')!.id;
  const grade = (id: string) => answer.grades.find(row => row.case === id) as Record<string, unknown>;
  const regrade = (fields: Record<string, unknown>) => ({ ...answer, grades: answer.grades.map(row => row.case === verdict ? { ...row, ...fields } : row) });
  const dutyNote = (result: RetroResult, duty: string) => result.duties[RETROSPECTIVE_DUTIES.indexOf(duty as typeof RETROSPECTIVE_DUTIES[number])]!;

  it('case-level: a row missing, malformed or breaking its rules leaves exactly that case owed', () => {
    const cases: [string, unknown, string, string][] = [
      ['grade missing', { ...answer, grades: answer.grades.filter(row => row.case !== verdict) }, verdict, rowMissingReason('grade')],
      ['grades not a list', { ...answer, grades: 7 }, verdict, rowMissingReason('grade')],
      ['grade cites an unknown record', regrade({ conclusion: { assessment: 'supported', evidence: ['turn:telegram:1:update:1'] } }), verdict,
        rowRefusedReason('grade', 'conclusion evidence cites an unknown record')],
      ['grade outcome invalid', regrade({ outcome: { assessment: 'great', reason: 'x', evidence: [] } }), verdict, rowRefusedReason('grade', 'outcome invalid')],
      ['grade not an object', { ...answer, grades: [...answer.grades.filter(row => row.case !== verdict), { case: verdict, outcome: 7 }] }, verdict,
        rowRefusedReason('grade', 'outcome not an object')],
      ['omitted without a reason', { ...answer, omitted: [{ case: turns[0] }] }, turns[0]!, rowRefusedReason('omitted', 'omitted reason missing')],
      ['named in neither list', { ...answer, inspected: answer.inspected.filter(id => id !== turns[1]) }, turns[1]!, RETRO_UNACCOUNTED_REASON],
    ];
    for (const [name, mutated, id, reason] of cases) {
      const result = validate(mutated);
      floor(result);
      expect(result.omitted, name).toContainEqual({ case: id, reason });
      expect(result.inspected, name).not.toContain(id);
      expect(owedAfter(result), name).toContain(id);
      // Every other case keeps the disposition the real answer gave it.
      expect(result.inspected, name).toEqual(validate(answer).inspected.filter(other => other !== id));
    }
    expect(grade(decision)).toBeDefined();
  });

  it('duty-level: a part of the answer that cannot be read records its own duty not inspected', () => {
    const cases: [string, unknown, string, string][] = [
      ['wells not a list', { ...answer, wells: 7 }, 'gravity-well', `${RETRO_DUTY_PART_UNREADABLE_NOTE} (wells not a list)`],
      ['wells one short', { ...answer, wells: [0, 0, 0, 0, 0, 0] }, 'gravity-well', `${RETRO_DUTY_PART_UNREADABLE_NOTE} (wells needs one entry per gravity well, in order)`],
      ['eff missing', { ...answer, eff: undefined }, 'waste', `${RETRO_DUTY_PART_UNREADABLE_NOTE} (efficiency summary missing)`],
    ];
    for (const [name, mutated, duty, note] of cases) {
      const result = validate(mutated);
      floor(result);
      expect(dutyNote(result, duty), name).toEqual({ duty, disposition: 'unavailable', note });
      expect(result.inspected, name).toEqual(validate(answer).inspected);
    }
    // An unknown duty id makes the whole list unreadable: no duty inspected, and no case retired by this pass.
    const unknown = validate({ ...answer, uninspected: ['not-a-duty'] });
    expect(unknown.duties.filter(row => row.disposition === 'inspected')).toEqual([]);
    expect(owedAfter(unknown)).toEqual([...supplied].sort());
  });

  it('a row naming no supplied case is not recorded, and its reason is kept', () => {
    const cases: [string, unknown, string][] = [
      ['finding of no known duty', { ...answer, findings: [{ duty: 'not-a-duty', refs: [turns[0]], summary: 's', disposition: { declined: 'd' } }] },
        rowRefusedReason('finding', 'duty invalid')],
      ['grade of an unknown case', { ...answer, grades: [...answer.grades, { ...grade(verdict), case: 'verdict:telegram:1:update:1:0' }] },
        rowRefusedReason('grade', 'grade case cites an unknown record')],
      ['closure of an unknown item', { ...answer, closures: [{ finding: 'retro:9:9', outcome: 'improved', evidence: [] }] },
        rowRefusedReason('closure', 'closure of an unknown open item')],
      ['feedback on an unknown message', { ...answer, feedback: [{ case: 'turn:telegram:1:update:1', classification: 'c', disposition: 'declined-with-reason', reason: 'r' }] },
        rowRefusedReason('feedback', 'feedback case cites an unknown record')],
    ];
    for (const [name, mutated, reason] of cases) {
      const result = validate(mutated);
      floor(result);
      expect(result.refusedRows, name).toEqual([reason]);
      expect(result.inspected, name).toEqual(validate(answer).inspected);
    }
    // An id in inspected or omitted that is no supplied case is never recorded inspected, and owes nothing.
    const stray = validate({ ...answer, inspected: [...answer.inspected, 'retrospective:0'], omitted: [{ case: 'turn:telegram:1:update:1', reason: 'r' }] });
    expect(stray.inspected).toEqual(validate(answer).inspected);
    expect(stray.omitted).toEqual(validate(answer).omitted);
  });

  it('authorizations: a missing or widened review leaves that authorization owed; an omitted one owes no row', () => {
    const two = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-2-2026-10-02.json', import.meta.url), 'utf8')) as {
      plan: typeof plan; view: { dated: unknown[]; turns: Record<string, { at: number }> }; realModelCalls: { answer: string }[];
      recorded: { livePass: { at: number; contextDigest: string } } };
    const twoView = { retroPasses: [], dated: two.view.dated, turns: new Map(Object.entries(two.view.turns)) } as unknown as JournalView;
    const check = (body: unknown) => validateRetrospective(body, two.plan, twoView, 0, two.recorded.livePass.at, two.recorded.livePass.contextDigest);
    const real = JSON.parse(two.realModelCalls[2]!.answer) as Answer & { authorizations: { case: string; excerpt: string }[] };
    const [first, second] = real.authorizations.map(row => row.case) as [string, string];
    expect(check(real).authorizations.map(row => row.case)).toEqual([first, second]);
    const missing = check({ ...real, authorizations: [] });
    expect(missing.omitted).toEqual(expect.arrayContaining([first, second].map(id => ({ case: id, reason: rowMissingReason('authorization') }))));
    expect(missing.authorizations).toEqual([]);
    const widened = check({ ...real, authorizations: real.authorizations.map(row => row.case === first ? { ...row, excerpt: `${row.excerpt} and more` } : row) });
    expect(widened.omitted).toContainEqual({ case: first, reason: rowRefusedReason('authorization', 'a candidate excerpt exceeds its source authorization') });
    expect(widened.authorizations.map(row => row.case)).toEqual([second]);
    const omitted = check({ ...real, inspected: real.inspected.filter(id => id !== first), omitted: [{ case: first, reason: 'later' }],
      authorizations: real.authorizations.filter(row => row.case !== first) });
    expect(omitted.omitted.filter(row => row.case === first)).toEqual([{ case: first, reason: 'later' }]);
    expect(omitted.authorizations.map(row => row.case)).toEqual([second]);
  });

  it('pass-level: only an answer that cannot be classified fails the pass', () => {
    for (const raw of ['x', null, [], {}, { inspected: 'all of them' }, { review: 'nothing found', duty_rows: 14 }])
      expect(() => validate(raw), JSON.stringify(raw)).toThrow(/^retrospective: (answer not an object|inspected not a list)$/u);
  });
});
