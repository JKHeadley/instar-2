import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETRO_ANSWER_BUDGET_BYTES, RETRO_ANSWER_BYTES_PER_TOKEN, RETRO_ANSWER_GROWTH, RETRO_ANSWER_START_BYTES,
  RETRO_ANSWER_NARROW_STEPS, RETRO_EFFICIENCY_CHARS, RETRO_FAILURE_BACKOFF_MS, RETRO_MIN_INTERVAL_MS,
  RETRO_OUTCOME_REASON_CHARS, RETRO_OVER_CAP_REASON, RETRO_STALE_CASE_MS, disciplineSource,
  eligibleCases, estimatedAnswerBytes, measuredAnswerBudget, retroAnswerBudget, type RetroCase } from './retrospective.js';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';

/** The live line's own record of this failure: the 2026-09-29 proof room, where every model answer over the
 * route's output cap came back `uncertain`. The retrospective review's answer is always over that cap, which is
 * why no pass ever completed from 2026-09-29 to 10-01 (~1,400 status snapshots, every one `ports.retrospect`
 * uncertain). These are the recorded physical outcome rows, replayed verbatim — the only change is the call id,
 * because the live room never got far enough to record a retrospective call of its own. */
type Recorded = { kind: string; id?: string; role?: string; through?: number;
  outcome?: { exitCode: number | null; localLimit: string | null; type: string | null; isError: boolean | null;
    outputTokens: number | null; promptBytes: number; elapsedMs: number; resources?: unknown };
  usage?: { inputTokens: number; outputTokens: number; charge: null; inputComplete?: true } };
const recorded = (JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json',
  import.meta.url), 'utf8')) as { rows: Recorded[] }).rows;
const overCapRows = recorded.filter(row => row.kind === 'call-outcome' && row.outcome?.localLimit === 'output-cap');
const uncertainRows = recorded.filter(row => row.kind === 'summary-uncertain');
/** The recorded over-cap outcome whose frame reported `tokens`, rebound to this call id. */
const overCapOutcome = (tokens: number) => {
  const row = overCapRows.find(item => item.outcome?.outputTokens === tokens);
  if (!row?.outcome) throw Error(`no recorded over-cap frame at ${String(tokens)} output tokens`);
  return JSON.parse(JSON.stringify(row.outcome)) as NonNullable<Recorded['outcome']>;
};
/** The recorded uncertain return the provider hands the consumer for such a frame. */
const uncertainUsage = (tokens: number) => {
  const row = uncertainRows.find(item => item.usage?.outputTokens === tokens);
  if (!row?.usage) throw Error(`no recorded uncertain outcome at ${String(tokens)} output tokens`);
  return JSON.parse(JSON.stringify(row.usage)) as NonNullable<Recorded['usage']>;
};

const key = new Uint8Array(32).fill(37);
const start = Date.UTC(2026, 8, 26, 17);
// The live room's own identity shape: a long bot id, so every case id is as long as it really is.
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 400, maxReplies: 400, maxTurns: 400, maxBytes: 409600, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: 715672478 + id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, date: Math.floor(at / 1000) + id, text } });
const DIGEST = 'sha256:config-a';
const pad = (n: number) => 'note '.repeat(Math.ceil(n / 5)).slice(0, n);

/** A complete review answer written at exactly the lengths the question asks for. */
function answerAtAskedLengths(state: string, findings = 1) {
  const cases = (JSON.parse(state) as { cases: RetroCase[] }).cases;
  const graded = cases.filter(item => item.category === 'decision' || item.category === 'verdict');
  return JSON.stringify({ inspected: cases.map(item => item.id), omitted: [],
    duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length), wells: GRAVITY_WELLS.map(() => 0),
    eff: pad(RETRO_EFFICIENCY_CHARS),
    findings: Array.from({ length: findings }, () => ({ duty: 'waste', refs: [cases[0]!.id],
      summary: pad(RETRO_OUTCOME_REASON_CHARS), disposition: { owner: 'agent', next: pad(RETRO_OUTCOME_REASON_CHARS) } })),
    feedback: [], closures: [], authorizations: [], comparisons: [],
    grades: graded.map(item => ({ case: item.id, conclusion: { assessment: 'unverifiable', evidence: [] },
      reason: { assessment: item.reason === undefined ? 'not-applicable' : 'unverifiable', evidence: [] },
      outcome: { assessment: 'pending', reason: pad(RETRO_OUTCOME_REASON_CHARS), evidence: [] }, observations: [] })) });
}

function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-overcap-')));
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis);
  let now = start, next = 1;
  const states: string[] = [];
  let answer: (state: string, id: string) => Awaited<ReturnType<NonNullable<Parameters<typeof createJournalWorker>[1]['retrospect']>>>
    = state => ({ state: 'complete', value: answerAtAskedLengths(state), usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true } });
  const workerOn = (opened: typeof journal) => createJournalWorker(opened, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
    sources: () => [disciplineSource(opened.view)],
    model: async (input: { id: string }) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator chatted about the preview.', people: [], memory: [], commitments: [], questions: [] })
      : JSON.stringify({ reply: 'Noted — here is a reply of ordinary length for this preview conversation.', memory: [], dated: [] }),
    send: async () => 7, checkOutbound: () => {},
    retrospect: async (state: string, id: string) => { states.push(state); return answer(state, id); } });
  let worker = workerOn(journal);
  return { get journal() { return journal; }, states, at: () => now, advance: (ms: number) => { now += ms; },
    answerWith: (fn: typeof answer) => { answer = fn; },
    retrospect: () => worker.retrospect(DIGEST),
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text, now))); await worker.drain(); },
    /** A restart: the journal is closed and read again from its own file, with a new worker over it. */
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); worker = workerOn(journal); },
    done: () => { try { journal.close(); } catch { /* closed */ } rmSync(root, { recursive: true, force: true }); } };
}
const owed = (view: JournalView, now: number) => eligibleCases(view, retrospectiveCases(view), now).map(item => item.id);
const messages = Array.from({ length: 14 }, (_, index) => `Question number ${String(index + 1)} about how this preview works.`);

it('the live record shows an answer over the route output cap coming back uncertain, which is what the review always asks for', () => {
  // 18 over-cap frames, 18 uncertain outcomes, paired by the very token counts the frames reported.
  expect(overCapRows.length).toBe(18);
  expect(uncertainRows.length).toBe(18);
  for (const row of overCapRows) expect(row.outcome!.outputTokens!).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(new Set(uncertainRows.map(row => row.usage!.outputTokens)))
    .toEqual(new Set(overCapRows.map(row => row.outcome!.outputTokens)));
  // Replies, which do stay under the cap, are what the same room recorded as complete.
  const answers = recorded.filter(row => row.kind === 'call-outcome' && row.outcome?.localLimit === null
    && row.id?.startsWith('telegram:'));
  expect(answers.length).toBeGreaterThan(0);
  for (const row of answers) expect(row.outcome!.outputTokens!).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  // The budget the review now asks within is inside the cap it is actually judged against.
  expect(RETRO_ANSWER_BUDGET_BYTES).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS * RETRO_ANSWER_BYTES_PER_TOKEN);
});

it('settles a pass whose own outcome row proves an over-cap answer as failed with its reason, keeps every case owed, and narrows the next ask', async () => {
  const w = world();
  try {
    await w.converse(messages);
    const before = owed(w.journal.view, w.at());
    expect(before.length).toBeGreaterThan(0);
    // Exactly what the live provider does: the physical outcome row is appended before the adapter classifies,
    // then the refused frame is handed back as `uncertain`.
    w.answerWith((_state, id) => {
      w.journal.append({ kind: 'call-outcome', id, role: 'model', outcome: overCapOutcome(2312), at: w.at() } as never);
      return { state: 'uncertain', usage: uncertainUsage(2312) };
    });
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('failed');
    expect(pass.reason).toBe(RETRO_OVER_CAP_REASON);
    expect(pass.result).toBeUndefined();
    // The declared fail direction for this consumer: no grade, finding or candidate, every case still owed.
    expect(owed(w.journal.view, w.at())).toEqual(expect.arrayContaining(before));
    // And the next pass asks for less, rather than repeating an ask that cannot be answered. It is sized from what
    // this answer really cost — the 2312 output tokens its own frame reported — rather than from a fixed fraction
    // of the estimate, which is what makes it fit in one step (retrospective-measured-narrowing.test.ts).
    const fixed = estimatedAnswerBytes([]);
    expect(pass.outputTokens).toBe(2312);
    const narrowed = retroAnswerBudget(w.journal.view.retroPasses);
    expect(narrowed).toBe(measuredAnswerBudget(pass));
    expect(narrowed).toBeLessThan(pass.estimatedAnswerBytes!);
    expect(narrowed).toBeGreaterThan(fixed);
    // The measurement is the authority, not the fallback halving: with the first ask sized small (plan #289) a
    // gentle overrun like this one earns LESS room than the depth-one halving would have handed back, where from
    // the whole bound it earned more. Either way the halving is a fallback for a pass with nothing to measure,
    // never a ceiling on a real measurement — so the claim asserted here is the measurement's own invariant.
    expect(narrowed).toBe(Math.floor(RETRO_ANSWER_BUDGET_BYTES * pass.estimatedAnswerBytes!
      / (RETRO_ANSWER_BYTES_PER_TOKEN * pass.outputTokens!)));
    // Not immediately: the ordinary minimum interval between passes still holds. It does not wait the full
    // unknown-failure backoff, because this failure's cause is settled and the narrower ask is already computed.
    w.advance(RETRO_MIN_INTERVAL_MS - 1);
    await w.retrospect();
    expect(w.journal.view.retroPasses.length).toBe(1);
    expect(w.states.length).toBe(1);
    // Past that interval the narrower pass actually runs, and completes when its answer fits the cap.
    let asked = '';
    w.answerWith(state => { asked = answerAtAskedLengths(state);
      return { state: 'complete', value: asked, usage: { inputTokens: 17164, outputTokens: Math.round(Buffer.byteLength(asked) / RETRO_ANSWER_BYTES_PER_TOKEN), charge: null, inputComplete: true } }; });
    w.advance(1);
    await w.retrospect();
    expect(w.states.length).toBe(2);
    const second = w.journal.view.retroPasses.at(-1)!;
    expect(second.pass).toBe(1);
    expect(second.state).toBe('complete');
    expect(second.cases.length).toBeGreaterThan(0);
    expect(second.cases.length).toBeLessThan(pass.cases.length);
    expect(Buffer.byteLength(asked)).toBeLessThan(Buffer.byteLength(answerAtAskedLengths(w.states[0]!)));
    // The debt drains: what the smaller pass inspected is no longer owed, and what it deferred still is.
    const after = owed(w.journal.view, w.at());
    expect(after.length).toBeLessThan(before.length);
    for (const row of second.omitted) expect(after).toContain(row.case);
    // A completed pass ends the narrowing: the next one is planned from that pass's OWN measurement, widened by
    // at most one doubling of the ask it just answered (plan #289), rather than jumping back to the whole bound —
    // which is the jump that made the live line pay a failed call, and an interval, for every step back down.
    const completed = w.journal.view.retroPasses.at(-1)!;
    expect(completed.state).toBe('complete');
    expect(retroAnswerBudget(w.journal.view.retroPasses))
      .toBe(Math.min(RETRO_ANSWER_BUDGET_BYTES, completed.estimatedAnswerBytes! * RETRO_ANSWER_GROWTH,
        Math.floor(RETRO_ANSWER_BUDGET_BYTES * completed.estimatedAnswerBytes!
          / (RETRO_ANSWER_BYTES_PER_TOKEN * completed.outputTokens!))));
    expect(retroAnswerBudget(w.journal.view.retroPasses)).toBeGreaterThan(retroAnswerBudget(w.journal.view.retroPasses.slice(0, -1)));
  } finally { w.done(); }
});

it('keeps planning at least one case however many passes in a row ran over the cap, and survives a restart', async () => {
  const w = world();
  try {
    await w.converse(messages);
    const before = owed(w.journal.view, w.at());
    w.answerWith((_state, id) => {
      w.journal.append({ kind: 'call-outcome', id, role: 'model', outcome: overCapOutcome(2312), at: w.at() } as never);
      return { state: 'uncertain', usage: uncertainUsage(2312) };
    });
    const fixed = estimatedAnswerBytes([]);
    const asked: number[] = [], budgets: number[] = [];
    // Run until the budget stops moving, bounded. Each measured step takes about a quarter off the room.
    for (let round = 0; round < 20; round++) {
      await w.retrospect();
      expect(w.journal.view.retroPasses.length).toBe(round + 1);
      const pass = w.journal.view.retroPasses.at(-1)!;
      expect(pass.reason).toBe(RETRO_OVER_CAP_REASON);
      expect(pass.cases.length).toBeGreaterThan(0);        // the floor of one case, every round, however deep
      asked.push(pass.cases.length);
      // The budget never reports less room than the rows every pass owes, so the narrowing only ever removes
      // cases; the floor of one case lives in the planner, which holds a pass's first case to the whole bound.
      const budget = retroAnswerBudget(w.journal.view.retroPasses);
      expect(budget).toBeGreaterThanOrEqual(fixed);
      budgets.push(budget);
      w.advance(RETRO_FAILURE_BACKOFF_MS);
      if (budgets.length > 1 && budget === budgets.at(-2)) break;
    }
    // The BUDGET is what narrows monotonically. The case COUNT is not monotone and must not be asserted to be:
    // every six hours of backoff makes more owed work eligible, and a cheap message case costs a fraction of a
    // graded decision, so a smaller budget can still buy more cases than the pass before it.
    for (let index = 1; index < budgets.length; index++) expect(budgets[index]!).toBeLessThanOrEqual(budgets[index - 1]!);
    expect(budgets.length).toBeLessThan(20);                 // it settles, it does not narrow for ever
    expect(asked[0]!).toBeGreaterThan(1);
    // Where it settles is the floor of ONE case, not the bare RETRO_ANSWER_FIXED_BYTES floor: a pass's first case
    // is always admitted at the whole bound, so the budget a one-case pass measures is self-consistent and holds
    // there. The floor itself is the arithmetic's backstop below that, never the resting state.
    expect(asked.at(-1)).toBe(1);
    expect(budgets.at(-1)).toBeGreaterThan(fixed);
    expect(budgets.at(-1)).toBeLessThan(estimatedAnswerBytes([]) + RETRO_ANSWER_BUDGET_BYTES);
    // Every failed pass stays truthful and every case stays owed.
    expect(owed(w.journal.view, w.at())).toEqual(expect.arrayContaining(before));
    // The narrowing is read from the journal's own records, so a restart neither loses it nor strands the debt:
    // the reopened journal plans the same one-case pass, and that pass completes when its answer fits.
    const narrowed = retroAnswerBudget(w.journal.view.retroPasses), passes = w.journal.view.retroPasses.length;
    w.reopen();
    expect(w.journal.view.retroPasses.length).toBe(passes);
    expect(retroAnswerBudget(w.journal.view.retroPasses)).toBe(narrowed);
    w.answerWith(state => ({ state: 'complete', value: answerAtAskedLengths(state),
      usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true } }));
    await w.retrospect();
    const last = w.journal.view.retroPasses.at(-1)!;
    expect(last.state).toBe('complete');
    expect(last.cases.length).toBe(1);
    expect(owed(w.journal.view, w.at())).not.toContain(last.cases[0]);
  } finally { w.done(); }
});

it('settles an exit-1 is_error frame over the cap the same way, because the error flag is not the proof', async () => {
  const w = world();
  try {
    await w.converse(messages);
    w.answerWith((_state, id) => {
      w.journal.append({ kind: 'call-outcome', id, role: 'model', outcome: overCapOutcome(8192), at: w.at() } as never);
      return { state: 'uncertain', usage: { inputTokens: 21441, outputTokens: 8192, charge: null } };
    });
    await w.retrospect();
    expect(w.journal.view.retroPasses.at(-1)!.reason).toBe(RETRO_OVER_CAP_REASON);
  } finally { w.done(); }
});

it('still records a genuinely unknown outcome as unknown when no outcome row proves an over-cap answer', async () => {
  const w = world();
  try {
    await w.converse(messages);
    w.answerWith(() => ({ state: 'uncertain', usage: uncertainUsage(2312) }));
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('unknown');
    expect(pass.reason).toBe('model outcome uncertain');
    // Unchanged, which is what "no narrowing" means: this root has still measured nothing, so the next ask is
    // the same small start it already used (plan #289 sized a first ask small rather than at the whole bound).
    expect(retroAnswerBudget(w.journal.view.retroPasses)).toBe(RETRO_ANSWER_START_BYTES);
  } finally { w.done(); }
});

it('does not read an unended call or a frame that is not a result as an over-cap answer', async () => {
  for (const broken of [{ exitCode: null }, { type: 'other' as const }]) {
    const w = world();
    try {
      await w.converse(messages);
      w.answerWith((_state, id) => {
        w.journal.append({ kind: 'call-outcome', id, role: 'model',
          outcome: { ...overCapOutcome(2312), ...broken }, at: w.at() } as never);
        return { state: 'uncertain', usage: uncertainUsage(2312) };
      });
      await w.retrospect();
      expect(w.journal.view.retroPasses.at(-1)!.state).toBe('unknown');
    } finally { w.done(); }
  }
});

it('completes a pass and records its findings: the planned ask fits the cap at the lengths the question asks for', async () => {
  const w = world();
  try {
    await w.converse(messages);
    const eligible = owed(w.journal.view, w.at()).length;
    let asked = '';
    w.answerWith(state => { asked = answerAtAskedLengths(state);
      return { state: 'complete', value: asked, usage: { inputTokens: 17164, outputTokens: Math.round(Buffer.byteLength(asked) / RETRO_ANSWER_BYTES_PER_TOKEN), charge: null, inputComplete: true } }; });
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('complete');
    // A real pass: findings and grades recorded, the duties and the gravity wells all judged.
    expect(pass.result!.findings.length).toBeGreaterThan(0);
    expect(pass.result!.grades.length).toBeGreaterThan(0);
    expect(pass.result!.duties.map(row => row.duty)).toEqual([...RETROSPECTIVE_DUTIES]);
    expect(pass.result!.gravityWells.map(row => row.well)).toEqual(GRAVITY_WELLS.map(well => well.id));
    // The answer it had to write fits the cap the provider enforces — the whole reason no pass could complete.
    expect(Buffer.byteLength(asked) / RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    // The estimate is the conservative side of the case rows it plans for, never under them; the reserve
    // between the budget and the cap is what carries the findings, which no plan can know in advance.
    const planned = w.states.at(-1)!;
    const cases = (JSON.parse(planned) as { cases: RetroCase[] }).cases;
    expect(estimatedAnswerBytes(cases)).toBeGreaterThanOrEqual(Buffer.byteLength(answerAtAskedLengths(planned, 0)));
    expect(estimatedAnswerBytes(cases)).toBeLessThanOrEqual(RETRO_ANSWER_BUDGET_BYTES);
    // Several findings still fit inside the cap the provider enforces.
    expect(Buffer.byteLength(answerAtAskedLengths(planned, 3)) / RETRO_ANSWER_BYTES_PER_TOKEN)
      .toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    // It did not swallow the backlog: what it could not fit stays owed for a later pass.
    expect(pass.cases.length).toBeLessThan(eligible);
    expect(pass.omitted.some(row => row.reason === 'bound: answer budget, deferred to a later pass')).toBe(true);
    // A later pass picks the deferred work up rather than losing it (the remaining owed messages are below the
    // message threshold, so they become due on age, which is the bound the design already declares).
    w.advance(RETRO_STALE_CASE_MS);
    await w.retrospect();
    const second = w.journal.view.retroPasses.at(-1)!;
    expect(second.pass).toBe(1);
    expect(second.state).toBe('complete');
    expect(second.cases.some(id => pass.omitted.some(row => row.case === id))).toBe(true);
  } finally { w.done(); }
});
