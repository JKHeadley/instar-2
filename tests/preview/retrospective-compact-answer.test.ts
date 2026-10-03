import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETROSPECTIVE_QUESTION, RETRO_ANSWER_BUDGET_BYTES, RETRO_DUTY_UNCORROBORATED_NOTE, RETRO_DUTY_UNINSPECTED_NOTE,
  RETRO_ANSWER_BYTES_PER_TOKEN, RETRO_DUTY_CODES, RETRO_EFFICIENCY_CHARS, RETRO_FAILURE_BACKOFF_MS,
  RETRO_MIN_INTERVAL_MS, RETRO_OUTCOME_REASON_CHARS, RETRO_OVER_CAP_REASON, RETRO_WELL_NOTES,
  WAIVER_EVIDENCE_UNAVAILABLE, disciplineSource, eligibleCases, estimatedAnswerBytes, retroAnswerBudget, retrospectiveStatusLine,
  type RetroCase } from './retrospective.js';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';

/** w3-retrocompact. w3-retrofit measured that the retrospective review could not complete on the live journal at
 * ANY number of cases, and named why: the rows every pass owes cost more than the whole 2048-token output cap on
 * their own at the rate that answer was really written to. This file holds the measurement of the fixed part and
 * the acceptance of the compact shape that bounds it.
 *
 * Provenance, stated plainly (observer #106). The recorded halves are real: the live retrospective record, the
 * recorded malformed JSON classes, the recorded over-cap frames, and the two verbatim live model outputs the
 * bytes-per-token ratio is measured from. The compact ANSWERS are authored and cannot be otherwise — no model has
 * ever been asked for this shape, because this unit introduces it. The fixture says so in its own `source`. */
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/retrospective-compact-answer-2026-10-02.json',
  import.meta.url), 'utf8')) as {
    source: string;
    recorded: { liveRetrospective: { modelCallsByJudgmentRetrospective: number; callOutcomeCountsOutputCap: number;
        providerOutputCap: number; passes: { pass: number; supplied: number }[]; lastCall: { usage: { outputTokens: number } } };
      jsonShapes: Record<string, number>; bytesPerToken: { update: number; bytes: number; outputTokens: number }[] };
    answers: { compactFixed: Record<string, unknown>; verboseFixedAtAskedLengths: Record<string, unknown>;
      verboseFixedAtAcceptedLengths: Record<string, unknown>; overLongFixed: Record<string, unknown>;
      malformedFixed: { why: string; part: Record<string, unknown>; recordedUnavailable?: true }[];
      wireShapes: { class: string; recordedCount: number; body?: string }[] } };
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
/** The 18 recorded physical over-cap frames of the 2026-09-29 proof room, as output counts. */
type Recorded = { kind: string; outcome?: { localLimit: string | null; outputTokens: number | null } };
const recordedOverCapTokens = (JSON.parse(readFileSync(
  new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as { rows: Recorded[] })
  .rows.filter(row => row.kind === 'call-outcome' && row.outcome?.localLimit === 'output-cap')
  .map(row => row.outcome!.outputTokens!);

// ---------------------------------------------------------------------------------------------------------------
// 1. The measurement: what part of the answer was long, before and after.
// ---------------------------------------------------------------------------------------------------------------

it('measures the fixed part: the length ACCEPTED was more than five times the length ASKED, and that alone exceeded the cap', () => {
  const asked = bytes(FIXTURE.answers.verboseFixedAtAskedLengths);
  const accepted = bytes(FIXTURE.answers.verboseFixedAtAcceptedLengths);
  const compact = bytes(FIXTURE.answers.compactFixed);
  // The gap that was the bug: the question asked for a 40-character duty note and the validator took 500; asked
  // 30 for a well note and took 500; asked 120 for the efficiency summary and took 1000.
  expect(accepted / asked).toBeGreaterThan(5);
  // Priced in tokens at the ratio measured from real live outputs, the accepted envelope broke the cap on its
  // own, before a single case row — which is why cutting cases could never make the answer fit.
  expect(accepted / RETRO_ANSWER_BYTES_PER_TOKEN).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(asked / RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  // The compact shape, and the only reason it is bounded: asked and accepted are now the SAME number, so there is
  // no larger envelope for a model to fill. Two of its three fields admit no free text at all.
  expect(compact).toBeLessThan(asked / 10);
  expect(compact / RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS / 10);
  // And most of what the verbose fixed part spent was not content: repeated keys and enum names.
  const dutyRow = bytes({ duty: 'benchmark-divergence', disposition: 'inspected', note: '' });
  const wellRow = bytes({ well: 'false-completion', observed: false, refs: [], note: '' });
  const scaffolding = RETROSPECTIVE_DUTIES.length * dutyRow + GRAVITY_WELLS.length * wellRow;
  const payload = RETROSPECTIVE_DUTIES.length * 40 + GRAVITY_WELLS.length * 30 + RETRO_EFFICIENCY_CHARS;
  expect(scaffolding).toBeGreaterThan(payload);
  // The whole answer wrapper, which is what the planner budgets cases against.
  expect(estimatedAnswerBytes([])).toBeLessThan(asked / 7);
});

it('grounds the token arithmetic in the two verbatim live model outputs rather than an assumed ratio', () => {
  // 1616 bytes at 600 output tokens and 2119 at 716: 2.69 and 2.96 bytes per token, so 2.7 is the conservative side.
  const ratios = FIXTURE.recorded.bytesPerToken.map(row => row.bytes / row.outputTokens);
  expect(ratios.length).toBe(2);
  for (const ratio of ratios) expect(ratio).toBeGreaterThan(2.6);
  // Those two ratios are REPLY outputs, and a reply's output IS its answer text. The retrospective answer is
  // not: the route's system prompt puts the model's reasoning in the Decision's reason.value, so the output the
  // cap counts carries that reasoning beside the answer. Measured on four real retrospective calls (plan #289,
  // fixtures/retrospective-live-failures-2026-10-02.json, grounded in retrospective-first-pass-fit.test.ts), the
  // planned answer costs 1.576 to 2.173 bytes per output token — well under a reply's. The constant is therefore
  // far BELOW these reply ratios, which is the conservative side: a lower figure charges MORE tokens for the same
  // bytes, so the budget aims further inside the cap.
  expect(RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThan(Math.min(...ratios));
  expect(RETRO_ANSWER_BYTES_PER_TOKEN).toBeGreaterThan(1);
  // The live record this unit exists for: every retrospective call ever made on that line hit the output cap,
  // including the one that supplied only 23 cases where the one before it supplied 37. Halving the case rows did
  // not help, because the fixed part — constant across both — carried most of the cost.
  const live = FIXTURE.recorded.liveRetrospective;
  expect(live.callOutcomeCountsOutputCap).toBe(live.modelCallsByJudgmentRetrospective);
  expect(live.passes.map(row => row.supplied)).toEqual([37, 23]);
  expect(live.lastCall.usage.outputTokens).toBe(8192);
  expect(live.providerOutputCap).toBe(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
});

it('reaches an answerable ask at EVERY recorded over-cap rate, including the live 8192, where before none of the eight largest did', () => {
  const liveCase = (index: number): RetroCase => ({ category: 'decision', at: 0, seq: index, text: '',
    id: `answer:telegram:8994258214:update:${String(715672478 + index)}` });
  const pool = Array.from({ length: 300 }, (_, index) => liveCase(index));
  const planAt = (budget: number) => {
    const taken: RetroCase[] = [];
    for (const item of pool) {
      const bound = taken.length ? budget : RETRO_ANSWER_BUDGET_BYTES;
      if (estimatedAnswerBytes([...taken, item]) <= bound) taken.push(item);
    }
    return taken;
  };
  const planned = estimatedAnswerBytes(planAt(RETRO_ANSWER_BUDGET_BYTES));
  let atTheFloor = 0;
  for (const tokens of [...recordedOverCapTokens, FIXTURE.recorded.liveRetrospective.lastCall.usage.outputTokens]) {
    const next = retroAnswerBudget([{ state: 'failed', reason: RETRO_OVER_CAP_REASON,
      estimatedAnswerBytes: planned, outputTokens: tokens }]);
    // It always narrows, and it always still asks about at least one case.
    expect(next, String(tokens)).toBeLessThan(planned);
    const cases = planAt(next);
    expect(cases.length, String(tokens)).toBeGreaterThan(0);
    // Priced at the rate that very answer was written to, a next ask of more than one case fits — in one measured
    // step. Where the rate is so extreme that not even the planner's one-case floor would fit, the pass is at
    // that floor, its ask cannot shrink further, and the cadence returns to the failure backoff rather than
    // spending a call an hour on an identical ask (asserted in retrospective-measured-narrowing.test.ts).
    if (cases.length > 1) expect(estimatedAnswerBytes(cases) * (tokens / planned), String(tokens))
      .toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    else atTheFloor++;
  }
  // Honest count: most recorded rates reach an answerable multi-case ask; the extreme ones reach the floor.
  expect(atTheFloor).toBeLessThan(recordedOverCapTokens.length);
  // The other side, at the live rate: with the fixed part as it was — 2595 bytes of duty objects, gravity-well
  // objects and an efficiency object — those same rows cost more than the whole cap on their own, so no number of
  // cases could be removed to make the answer fit. That is exactly what w3-retrofit measured and could not close.
  const live = FIXTURE.recorded.liveRetrospective.lastCall.usage.outputTokens;
  expect(2595 * (live / planned)).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(estimatedAnswerBytes([]) * (live / planned)).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS / 2);
});

it('states the compact shape and its hard budget in the question the model is actually given', () => {
  expect(RETROSPECTIVE_QUESTION).toContain('HARD OUTPUT BUDGET');
  expect(RETROSPECTIVE_QUESTION).toContain(String(RETRO_ANSWER_BUDGET_BYTES));
  expect(RETROSPECTIVE_QUESTION).toContain(String(estimatedAnswerBytes([])));
  // One character per duty, one entry per well, one bounded sentence — named with their real counts and lengths.
  expect(RETROSPECTIVE_QUESTION).toContain(`ONE STRING of exactly ${String(RETROSPECTIVE_DUTIES.length)} characters`);
  expect(RETROSPECTIVE_QUESTION).toContain(`ONE ARRAY of exactly ${String(GRAVITY_WELLS.length)} entries`);
  expect(RETROSPECTIVE_QUESTION).toContain(`at most ${String(RETRO_EFFICIENCY_CHARS)} characters`);
  expect(RETROSPECTIVE_QUESTION).toContain(`at most ${String(RETRO_OUTCOME_REASON_CHARS)}`);
  // And it no longer asks for a duty note or a well note at all: there is no field for one.
  expect(RETROSPECTIVE_QUESTION).not.toContain('duty note');
  expect(RETROSPECTIVE_QUESTION).not.toContain('gravity-well note');
  expect(RETROSPECTIVE_QUESTION).not.toContain('"disposition":"inspected"|"unavailable"');
});

// ---------------------------------------------------------------------------------------------------------------
// 2. The wired path: a real journal and worker, the compact shape through them.
// ---------------------------------------------------------------------------------------------------------------

const key = new Uint8Array(32).fill(53);
const start = Date.UTC(2026, 8, 26, 17);
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 400, maxReplies: 400, maxTurns: 400, maxBytes: 409600, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: 715672478 + id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, date: Math.floor(at / 1000) + id, text } });
const DIGEST = 'sha256:config-a';
/** The over-cap outcome the live provider appends before it classifies, at a recorded output count. */
const overCapOutcome = (outputTokens: number) => ({ exitCode: 0, localLimit: 'output-cap' as const, elapsedMs: 72910,
  type: 'result' as const, subtype: 'success' as const, isError: false, outputTokens, promptBytes: 53198 });

type Answer = { state: 'complete'; value: string; usage?: { inputTokens: number; outputTokens: number; charge: null; inputComplete: true } }
  | { state: 'uncertain'; usage?: { inputTokens: number; outputTokens: number; charge: null; inputComplete: true } };
function world(options: { evidence?: () => Record<string, unknown> } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-compact-')));
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis);
  let now = start, next = 1;
  const states: string[] = [];
  let answer: (state: string, id: string) => Answer = state => ({ state: 'complete', value: compactAnswer(state),
    usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true } });
  const workerOn = (opened: typeof journal) => createJournalWorker(opened, { now: () => now, stopped: () => false,
    timeZone: 'America/Los_Angeles', sources: () => [disciplineSource(opened.view)],
    model: async (input: { id: string }) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator chatted about the preview.', people: [], memory: [], commitments: [], questions: [] })
      : JSON.stringify({ reply: 'Noted — here is a reply of ordinary length for this preview conversation.', memory: [], dated: [] }),
    send: async () => 7, checkOutbound: () => {},
    ...(options.evidence ? { retrospectiveEvidence: options.evidence } : {}),
    retrospect: async (state: string, id: string) => { states.push(state); return answer(state, id); } });
  let worker = workerOn(journal);
  return { get journal() { return journal; }, states, at: () => now, advance: (ms: number) => { now += ms; },
    answerWith: (fn: typeof answer) => { answer = fn; },
    retrospect: () => worker.retrospect(DIGEST),
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text, now))); await worker.drain(); },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); worker = workerOn(journal); },
    done: () => { try { journal.close(); } catch { /* closed */ } rmSync(root, { recursive: true, force: true }); } };
}
const casesOf = (state: string) => (JSON.parse(state) as { cases: RetroCase[] }).cases;
/** A complete compact answer for whatever cases the pass supplied: the fixture's fixed part, plus the case-driven
 * rows the pass owes. Only the fixed part changed in this unit; the rest is the shape it already was. */
function compactAnswer(state: string, extra: Record<string, unknown> = {}) {
  const cases = casesOf(state);
  const graded = cases.filter(item => item.category === 'decision' || item.category === 'verdict');
  return JSON.stringify({ ...FIXTURE.answers.compactFixed,
    inspected: cases.map(item => item.id), omitted: [], findings: [], feedback: [], closures: [],
    grades: graded.map(item => ({ case: item.id, conclusion: { assessment: 'unverifiable', evidence: [] },
      reason: { assessment: item.reason === undefined ? 'not-applicable' : 'unverifiable', evidence: [] },
      outcome: { assessment: 'pending', reason: 'no later message settles it yet', evidence: [] }, observations: [] })),
    authorizations: cases.filter(item => item.category === 'authorization').map(item => ({ case: item.id, candidate: false, recurrences: [] })),
    comparisons: cases.filter(item => item.category === 'rerun').map(item => ({ case: item.id, verdict: 'consistent', reason: 'same advice' })),
    ...extra });
}
const owed = (view: JournalView, now: number) => eligibleCases(view, retrospectiveCases(view), now).map(item => item.id);
const messages = Array.from({ length: 14 }, (_, index) => `Question number ${String(index + 1)} about how this preview works.`);
const complete = (value: string) => ({ state: 'complete' as const, value,
  usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true as const } });
/** One pass on its own fresh journal, and what it settled as. A COMPLETED pass inspects everything owed, so a
 * second pass on the same journal is simply not due — each scenario gets its own world rather than sharing one. */
async function onePass(answer: (state: string, id: string) => Answer, options: Parameters<typeof world>[0] = {}) {
  const w = world(options);
  try {
    await w.converse(messages);
    const before = owed(w.journal.view, w.at());
    w.answerWith(answer);
    await w.retrospect();
    return { pass: w.journal.view.retroPasses[0]!, before, stillOwed: owed(w.journal.view, w.at()), status: retrospectiveStatusLine(w.journal.view) };
  } finally { w.done(); }
}

it('decodes the compact answer into exactly the records every downstream reader and live proof check already reads', async () => {
  const w = world();
  try {
    await w.converse(messages);
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('complete');
    // I1b reads this: fourteen duty rows, every disposition inspected (or waiver-recurrence unavailable).
    expect(pass.result!.duties.map(row => row.duty)).toEqual([...RETROSPECTIVE_DUTIES]);
    // Every duty inspected with the nothing-found note, except waiver-recurrence: this world supplies no waiver
    // producer evidence, so the PLAN records that one unavailable — I1b accepts either for exactly that duty.
    for (const row of pass.result!.duties) expect(row).toMatchObject(row.duty === 'waiver-recurrence'
      ? { disposition: 'unavailable', note: WAIVER_EVIDENCE_UNAVAILABLE }
      : { disposition: 'inspected', note: RETRO_DUTY_CODES.n });
    // O24a and P50c read the same rows for their own duties.
    for (const duty of ['recurrence', 'workaround', 'removable-attention'] as const)
      expect(pass.result!.duties.find(row => row.duty === duty)!.disposition).toBe('inspected');
    // I3c reads this: one judgement per gravity well, in the declared order.
    expect(pass.result!.gravityWells.map(row => row.well)).toEqual(GRAVITY_WELLS.map(well => well.id));
    for (const row of pass.result!.gravityWells) expect(row).toMatchObject({ observed: false, refs: [], note: RETRO_WELL_NOTES.unobserved });
    // I1a reads this: an efficiency summary that is a sentence of three words or more.
    expect(pass.result!.efficiency.summary.split(/\s+/u).length).toBeGreaterThanOrEqual(3);
    expect(pass.result!.efficiency.summary.length).toBeLessThanOrEqual(RETRO_EFFICIENCY_CHARS);
    // And the whole answer the model was asked for fits the budget it was given, in tokens.
    const written = Buffer.byteLength(compactAnswer(w.states[0]!));
    expect(written).toBeLessThanOrEqual(RETRO_ANSWER_BUDGET_BYTES);
    expect(written / RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  } finally { w.done(); }
});

it('records a well as observed from its refs alone, and still refuses an observed well with nothing evidencing it', async () => {
  const observed = (refs: (state: string) => unknown) => (state: string) => complete(compactAnswer(state,
    { wells: [refs(state), ...GRAVITY_WELLS.slice(1).map(() => 0)],
      duties: 'f' + 'n'.repeat(RETROSPECTIVE_DUTIES.length - 1) }));
  // An observed well with an empty ref list is refused: nothing evidences it.
  const empty = await onePass(observed(() => []));
  expect(empty.pass).toMatchObject({ state: 'failed', reason: expect.stringContaining('needs refs') });
  expect(empty.stillOwed).toEqual(expect.arrayContaining(empty.before));
  // A ref the context never showed is refused too, exactly as it was in the verbose shape.
  const unknown = await onePass(observed(() => ['answer:telegram:8994258214:update:999999999']));
  expect(unknown.pass).toMatchObject({ state: 'failed', reason: expect.stringContaining('unknown record') });
  // With a real ref from the pass's own context it is recorded observed — and that observed well is what
  // corroborates the `f` at the gravity-well duty, whose output is the wells row rather than a finding.
  let first = '';
  const real = await onePass(observed(state => { first = casesOf(state)[0]!.id; return [first]; }));
  expect(real.pass.state).toBe('complete');
  expect(real.pass.result!.gravityWells[0]).toMatchObject({ well: GRAVITY_WELLS[0]!.id, observed: true,
    refs: [first], note: RETRO_WELL_NOTES.observed });
  expect(real.pass.result!.duties[0]).toMatchObject({ duty: 'gravity-well', disposition: 'inspected', note: RETRO_DUTY_CODES.f });
});

it('accepts a corroborated f and records an uncorroborated one NOT inspected, which is more than the prose note it replaces ever carried', async () => {
  const recurrenceIndex = RETROSPECTIVE_DUTIES.indexOf('recurrence');
  const codes = (code: string) => RETROSPECTIVE_DUTIES.map((_, index) => index === recurrenceIndex ? code : 'n').join('');
  const recurrence = (state: string, remedy: Record<string, string>) => { const cases = casesOf(state);
    return [{ duty: 'recurrence', refs: [cases[0]!.id], recurs: [cases[1]!.id], summary: 'The same slip twice.',
      rootCause: 'The packet omits the earlier correction.', structuralRemedy: remedy,
      disposition: { owner: 'agent', next: 'Carry corrections forward.' } }]; };
  // `f` with no finding of that duty in the answer. Changed by plan #339 (w3-retrolive2): it used to refuse the
  // whole pass, and live room two's first pass under cint-L33 died exactly there on an answer that fitted the cap.
  // The floor is intact: the duty is NOT recorded inspected, because the claim behind its `f` is not in the
  // answer; the rest of the pass stands.
  const bare = await onePass(state => complete(compactAnswer(state, { duties: codes('f') })));
  expect(bare.pass.state).toBe('complete');
  expect(bare.pass.result!.duties[recurrenceIndex]).toEqual({ duty: 'recurrence', disposition: 'unavailable',
    note: RETRO_DUTY_UNCORROBORATED_NOTE });
  expect(bare.pass.result!.findings).toEqual([]);
  expect(bare.status).toContain('duties not inspected although their evidence was present: recurrence');
  // The same `f` with the recurrence finding really present: accepted, recorded as the found verdict.
  const backed = await onePass(state => complete(compactAnswer(state,
    { duties: codes('f'), findings: recurrence(state, { remove: 'restating corrections' }) })));
  expect(backed.pass.state).toBe('complete');
  expect(backed.pass.result!.duties[recurrenceIndex]).toMatchObject({ duty: 'recurrence', note: RETRO_DUTY_CODES.f });
  expect(backed.pass.result!.findings.map(row => row.duty)).toEqual(['recurrence']);
  // And `n` beside a real finding is tolerated, deliberately: it is inconsistent bookkeeping, not a false claim,
  // and refusing it would discard every grade and finding the pass really produced. One direction only.
  const understated = await onePass(state => complete(compactAnswer(state,
    { duties: codes('n'), findings: recurrence(state, { none: 'No bounded change is warranted yet.' }) })));
  expect(understated.pass.state).toBe('complete');
  expect(understated.pass.result!.duties[recurrenceIndex]).toMatchObject({ note: RETRO_DUTY_CODES.n });
});

it('lets the plan, never the answer, decide an unavailable duty: u is refused where the evidence is there and ignored where it is not', async () => {
  const waiverIndex = RETROSPECTIVE_DUTIES.indexOf('waiver-recurrence');
  const codes = (code: string) => RETROSPECTIVE_DUTIES.map((_, index) => index === waiverIndex ? code : 'n').join('');
  const withWaivers = { evidence: () => ({ waivers: { authorizations: [],
    acts: [{ id: 'act:1', rule: '26', scope: 'x', at: 5, predecessors: [] }] } }) };
  // No producer evidence: the duty is recorded unavailable whatever character the answer puts there.
  for (const code of ['u', 'n']) {
    const { pass } = await onePass(state => complete(compactAnswer(state, { duties: codes(code) })));
    expect(pass.result!.duties[waiverIndex], code).toMatchObject({ duty: 'waiver-recurrence',
      disposition: 'unavailable', note: WAIVER_EVIDENCE_UNAVAILABLE });
  }
  // Evidence supplied: the answer still cannot declare the duty INSPECTED, so `u` records it UNAVAILABLE with a
  // note saying its evidence was present. Changed by plan #289 (w3-retrolive): it used to refuse the whole pass,
  // and the second real model call of 2026-10-02 died exactly there with an answer that fitted the output cap —
  // a bookkeeping character cost an hour of real review. The floor is intact: the duty is NOT inspected, so a
  // pass that shirks a duty is visible as a duty it did not discharge rather than hidden behind a refusal.
  const reported = await onePass(state => complete(compactAnswer(state, { duties: codes('u') })), withWaivers);
  expect(reported.pass).toMatchObject({ state: 'complete' });
  expect(reported.pass.result!.duties[waiverIndex]).toMatchObject({ duty: 'waiver-recurrence',
    disposition: 'unavailable', note: RETRO_DUTY_UNINSPECTED_NOTE });
  expect(reported.pass.result!.duties.filter(row => row.disposition === 'inspected'))
    .toHaveLength(RETROSPECTIVE_DUTIES.length - 1);
  const accepted = await onePass(state => complete(compactAnswer(state, { duties: codes('n') })), withWaivers);
  expect(accepted.pass.result!.duties[waiverIndex]).toMatchObject({ disposition: 'inspected', note: RETRO_DUTY_CODES.n });
});

it('reports each duty by its recorded disposition in status: an uninspected efficiency duty never reads as having run (Rules 9, 26, 42, 45)', async () => {
  const marked = new Set(['workaround', 'waste']);
  const codes = (code: string) => RETROSPECTIVE_DUTIES.map(duty => marked.has(duty) ? code : 'n').join('');
  // Available but reported `u`: not inspected, and its evidence was not lacking.
  const shirked = await onePass(state => complete(compactAnswer(state, { duties: codes('u') })));
  expect(shirked.pass.state).toBe('complete');
  expect(shirked.status).toContain('(efficiency duty not inspected: ');
  expect(shirked.status).not.toContain('efficiency duty ran');
  expect(shirked.status).toContain('duties not inspected although their evidence was present: workaround, waste');
  // Genuinely unavailable (no waiver producer): still reported as lacking evidence, and only that duty.
  expect(shirked.status).toContain('duties not inspected for lack of evidence: waiver-recurrence;');
  // The inspected neighbor: the efficiency duty ran, and nothing is reported uninspected with its evidence present.
  const done = await onePass(state => complete(compactAnswer(state, { duties: codes('n') })));
  expect(done.status).toContain('(efficiency duty ran: ');
  expect(done.status).not.toContain('although their evidence was present');
  expect(done.status).toContain('duties not inspected for lack of evidence: waiver-recurrence;');
});

it('fails closed on every malformed compact fixed part in the fixture, and keeps every case owed', async () => {
  // Two fixture entries are no longer malformed — a `u` at a duty whose evidence is present (plan #289), and an
  // `f` at a duty the answer holds no finding for (plan #339) now each record that duty unavailable instead of
  // refusing the pass (see the tests above) — and both carry `recordedUnavailable`, so the fail-closed set is
  // exactly the nine that remain rather than quietly shrinking further.
  const failClosed = FIXTURE.answers.malformedFixed.filter(row => row.recordedUnavailable !== true);
  expect(failClosed.length).toBe(9);
  for (const { why, part } of failClosed) {
    // The malformed fixed part REPLACES the well-formed one, so each case carries exactly one defect.
    const { pass, before, stillOwed } = await onePass(state => complete(JSON.stringify({
      ...JSON.parse(compactAnswer(state)) as Record<string, unknown>,
      duties: undefined, wells: undefined, eff: undefined, ...part })));
    expect(before.length, why).toBeGreaterThan(0);
    expect(pass.state, why).toBe('failed');
    expect(pass.result, why).toBeUndefined();
    // The declared fail direction, unchanged by the compaction: no grade, no finding, every case still owed.
    expect(stillOwed, why).toEqual(expect.arrayContaining(before));
  }
});

it('fails closed on the recorded malformed wire shapes, and decodes a fenced compact answer', async () => {
  const shapes = FIXTURE.answers.wireShapes.filter(row => row.body !== undefined);
  expect(shapes.map(row => row.class)).toEqual(['prose-wrapped', 'bare-wrong-fields', 'not-json']);
  for (const shape of shapes) {
    // Each class is one the live line really produced; its recorded count is in the fixture.
    expect(FIXTURE.recorded.jsonShapes[`answer/decision/malformed/${shape.class}`]
      ?? FIXTURE.recorded.jsonShapes[`reply-review/verdict/malformed/${shape.class}`], shape.class).toBe(shape.recordedCount);
    const { pass, before, stillOwed } = await onePass(() => complete(shape.body!));
    expect(pass.state, shape.class).toBe('failed');
    expect(stillOwed, shape.class).toEqual(expect.arrayContaining(before));
  }
  // A fence around an otherwise well-formed compact answer is stripped before decoding, as it already was.
  const fenced = await onePass(state => complete(`\`\`\`json\n${compactAnswer(state)}\n\`\`\``));
  expect(fenced.pass.state).toBe('complete');
});

it('clips an over-long prose field at the length the question states rather than refusing the pass', async () => {
  // The over-long fixture: the compact shape with its one prose field written far past its stated length. It is
  // CLIPPED, not refused — refusing would discard every grade the pass really produced over prose length.
  const over = FIXTURE.answers.overLongFixed as { eff: string };
  expect(over.eff.length).toBeGreaterThan(RETRO_EFFICIENCY_CHARS * 10);
  const padded = await onePass(state => complete(compactAnswer(state, { eff: over.eff })));
  expect(padded.pass.state).toBe('complete');
  expect(padded.pass.result!.efficiency.summary.length).toBe(RETRO_EFFICIENCY_CHARS);
  expect(padded.pass.result!.efficiency.summary).toBe(over.eff.slice(0, RETRO_EFFICIENCY_CHARS));
  // A per-row prose field is clipped at its own stated length too, which is what makes estimatedAnswerBytes a
  // true bound on the answer rather than an estimate the acceptance envelope exceeded five-fold.
  const long = 'reason '.repeat(RETRO_OUTCOME_REASON_CHARS).slice(0, RETRO_OUTCOME_REASON_CHARS * 5);
  const longReasons = await onePass(state => { const cases = casesOf(state);
    const graded = cases.filter(item => item.category === 'decision' || item.category === 'verdict');
    return complete(compactAnswer(state, { grades: graded.map(item => ({ case: item.id,
      conclusion: { assessment: 'unverifiable', evidence: [] },
      reason: { assessment: item.reason === undefined ? 'not-applicable' : 'unverifiable', evidence: [] },
      outcome: { assessment: 'pending', reason: long, evidence: [] }, observations: [] })) })); });
  expect(longReasons.pass.state).toBe('complete');
  expect(longReasons.pass.result!.grades.length).toBeGreaterThan(0);
  for (const grade of longReasons.pass.result!.grades) expect(grade.outcome.reason.length).toBe(RETRO_OUTCOME_REASON_CHARS);
});

it('settles a padded compact answer that still broke the route cap as over-cap, and narrows the next ask from its own measurement', async () => {
  const w = world();
  try {
    await w.converse(messages);
    const before = owed(w.journal.view, w.at());
    // The whole recorded over-cap wire shape, replayed: the physical outcome row the provider appends, then the
    // uncertain return it hands back. The count is the live retrospective measurement, 8192.
    const tokens = FIXTURE.recorded.liveRetrospective.lastCall.usage.outputTokens;
    expect(recordedOverCapTokens).toContain(tokens);
    w.answerWith((_state, id) => {
      w.journal.append({ kind: 'call-outcome', id, role: 'model', outcome: overCapOutcome(tokens), at: w.at() } as never);
      return { state: 'uncertain', usage: { inputTokens: 53198, outputTokens: tokens, charge: null, inputComplete: true } };
    });
    await w.retrospect();
    const failed = w.journal.view.retroPasses[0]!;
    expect(failed).toMatchObject({ state: 'failed', reason: RETRO_OVER_CAP_REASON, outputTokens: tokens });
    expect(owed(w.journal.view, w.at())).toEqual(expect.arrayContaining(before));
    // w3-retrofit's measured step, now acting on a bounded fixed part: the next ask is strictly smaller, still
    // above the floor, and it actually completes — which it could not do at any size before this unit.
    const narrowed = retroAnswerBudget(w.journal.view.retroPasses);
    expect(narrowed).toBeLessThan(failed.estimatedAnswerBytes!);
    expect(narrowed).toBeGreaterThan(estimatedAnswerBytes([]));
    w.advance(RETRO_MIN_INTERVAL_MS);
    let asked = '';
    w.answerWith(state => { asked = compactAnswer(state);
      return { state: 'complete', value: asked, usage: { inputTokens: 53198,
        outputTokens: Math.round(Buffer.byteLength(asked) / RETRO_ANSWER_BYTES_PER_TOKEN), charge: null, inputComplete: true } }; });
    await w.retrospect();
    const second = w.journal.view.retroPasses[1]!;
    expect(second.state).toBe('complete');
    expect(second.cases.length).toBeGreaterThan(0);
    expect(Buffer.byteLength(asked) / RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    // And the debt drains, which is the whole point: Rules 24, 50 and 51 have a completed pass to be proven by.
    expect(owed(w.journal.view, w.at()).length).toBeLessThan(before.length);
    expect(second.result!.duties).toHaveLength(RETROSPECTIVE_DUTIES.length);
    expect(second.result!.efficiency.summary.split(/\s+/u).length).toBeGreaterThanOrEqual(3);
  } finally { w.done(); }
});
