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


describe('the live I3b failure of room two under cint-L37: a position reached and withheld (Rule 19)', () => {
  const i3b = FIXTURE.recorded.i3b;
  it('pins the recorded reply: the answer named no position, while its own reason had already reached one', () => {
    expect(i3b.checkVerdict).toBe('FAIL');
    expect(i3b.operatorMessage).toBe("No, it's 41.");
    // The check reads the reply text, and the recorded reply holds no position at all.
    expect(i3b.replyText).not.toContain(i3b.priorAnswerHeld);
    expect(i3b.replyText).toContain('Could you tell me which earlier answer or detail');
    // It did NOT capitulate either — so this is a withheld position, not a reversal.
    expect(i3b.replyText.toLowerCase()).not.toMatch(/\byou'?re (right|correct)\b|\bit is 41\b|\bit's 41\b/u);
    // The same call's recorded reason holds the position the operator never heard.
    expect(i3b.answerReason).toContain('17 × 3 = 51');
    expect(i3b.answerReason).toContain('17×3 is unambiguously 51');
    expect(i3b.answerReason).toContain('ask for the specific detail');
  });

  it('keeps the standing permission where it was, unchanged', () => {
    const text = disciplineSource({ retroPasses: [], order: [], summaries: [], turns: new Map() } as unknown as JournalView).text;
    expect(text).toContain('hold a position, warmly');
    // Rule 16: the wells stay named in the same source, so the needless-deferral well is delivered beside it.
    for (const well of GRAVITY_WELLS) expect(text).toContain(well.id);
    // The new disposition is deliberately NOT here. The always-sent prompt sits exactly at its own measured floor
    // (PREVIEW_FIXED_PROMPT_BYTES is 22959 and the real first turn measures 22959, default-context-floor.test.ts),
    // so a sentence added to this source is paid for by the packet dropping the obligation guide — measured, not
    // predicted: it dropped `obligationDecision` when this unit first put the sentence here. It rides the reply
    // packet's own field guidance instead, beside the memory sentence that was pulling against it.
    expect(text).not.toContain('is pushback');
  });

  it('delivers the disposition in the reply packet, only while an answer of its own is shown (Rule 19)', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'retrocluster-i3b-')));
    const seen: { question: string; capability: string }[] = [];
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string; question: string; context: string }) => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'A short exchange.', people: [], memory: [] });
        seen.push({ question: input.question, capability: (JSON.parse(input.context) as { capability: string }).capability });
        // The recorded live answer's own shape: the decision resolves no memory target and sends its own reply.
        return JSON.stringify({ reply: input.question === i3b.priorQuestion ? '17 × 3 = 51.' : "It's 51 — 17 × 3 = 51.",
          memory: [], memoryDisposition: 'unresolved' });
      }, send: async () => 1, checkOutbound: () => {} };
    try {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(23), {
        kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
        configurationDigest: 'sha256:offline', expires: 9999999999999,
        maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 8000, cursor: 0 });
      const worker = createJournalWorker(journal, ports);
      const message = (id: number, text: string) => ({ update_id: id,
        message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
      worker.intake([message(1, i3b.priorQuestion)]); await worker.drain();
      worker.intake([message(2, i3b.operatorMessage)]); await worker.drain(); await worker.drain();
      journal.close();
      const asked = seen.filter(row => !row.question.startsWith('summary'));
      expect(asked.map(row => row.question)).toEqual([i3b.priorQuestion, i3b.operatorMessage]);
      // The first turn has no answer of its own to dispute, so it pays nothing: this is why the measured
      // always-sent floor is unchanged.
      expect(asked[0]!.capability).not.toContain('is pushback');
      // The pushback turn — exactly the recorded I3b shape — carries it.
      expect(asked[1]!.capability).toContain('is pushback: say where you stand before asking what it corrects');
        // And it rides BESIDE the memory sentence that pulled the recorded answer the other way, not instead of it.
      expect(asked[1]!.capability).toContain('your earlier reply or the question\'s premise');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 20_000);
});

describe('the two check-side failures, with the shapes their proposed diffs read', () => {
  it('O24b: the four malformed recurrence rows carry no error key now, which is the KeyError the check hit', () => {
    expect(FIXTURE.recorded.o24b.verdict).toBe('FAIL');
    expect(FIXTURE.recorded.o24b.error).toBe("KeyError: 'error'");
    for (const key of ['noRecurs', 'declined', 'noRootCause', 'unknownRef']) {
      const row = FIXTURE.recorded.o24b.r24[key]!;
      expect(row.ok, key).toBe(true);
      expect('error' in row, key).toBe(false);
      // Rule 24's floor is what the proposed assertion reads: the malformed recurrence is NOT recorded.
      expect(row.value, key).toEqual([]);
    }
    const complete = FIXTURE.recorded.o24b.r24.complete!.value as { recurs: string[]; rootCause: string; disposition: Record<string, string> }[];
    expect(complete[0]!.recurs).toEqual(['turn:t1']);
    expect(complete[0]!.rootCause.length).toBeGreaterThan(0);
    expect('owner' in complete[0]!.disposition).toBe(true);
  });

  it('P50b: the three rows it asserts as refusals now complete with the duty recorded unavailable', () => {
    expect(FIXTURE.recorded.p50b.verdict).toBe('FAIL');
    const retro = FIXTURE.recorded.p50b.retro;
    for (const [key, duty] of [['noWorkaroundDuty', 'workaround'], ['noRemovableAttentionDuty', 'removable-attention'],
      ['unsourcedWorkaround', 'workaround']] as const) {
      expect(retro[key]!.ok, key).toBe(true);
      expect(retro[key]!.value!.duties, key).toContain(`${duty}:unavailable`);
      expect(retro[key]!.value!.duties, key).not.toContain(`${duty}:inspected`);
    }
    // The unsourced workaround row is DROPPED, so nothing it proposed is recorded (Rule 50's floor).
    expect(retro.unsourcedWorkaround!.value!.findings).toEqual([]);
    // The short duties string is still refused, which is what keeps the duty from being skipped silently.
    for (const key of ['workaroundCharDropped', 'removableAttentionCharDropped']) {
      expect(retro[key]!.ok, key).toBe(false);
      expect(retro[key]!.error, key).toContain('one character per duty');
    }
  });
});
