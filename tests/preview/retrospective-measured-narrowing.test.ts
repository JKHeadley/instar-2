import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETRO_ANSWER_BUDGET_BYTES, RETRO_ANSWER_BYTES_PER_TOKEN,
  RETRO_ANSWER_NARROW_STEPS, RETRO_EFFICIENCY_CHARS, RETRO_FAILURE_BACKOFF_MS, RETRO_MIN_INTERVAL_MS, RETRO_NOTE_CHARS,
  RETRO_OUTCOME_REASON_CHARS, RETRO_OVER_CAP_REASON, RETRO_WELL_NOTE_CHARS, disciplineSource, eligibleCases,
  estimatedAnswerBytes, measuredAnswerBudget, retroAnswerBudget, type CaseCategory, type RetroCase } from './retrospective.js';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';

/** The live line's own record of this failure, from the proof run I-live-20261001-195320 over Justin's preview
 * (status-i-end.json, read 2026-10-02): `retrospective.passes` 9 and 10 both settled `review output over the cap`,
 * the first supplying 37 cases and the second — after one fixed halving of the case room — still 23, six hours
 * apart. The one measurement the live run recorded of what such an answer really costs is `modelCalls.last`'s
 * `retrospective:10`: outcome `uncertain`, `usage.outputTokens` 8192, against a route cap of 2048. Because 8192
 * is also the largest frame the provider has ever recorded, it is a LOWER bound on that answer's true length,
 * which makes every budget derived from it the conservative side. */
const LIVE = Object.freeze({ overCapPasses: [{ pass: 9, supplied: 37 }, { pass: 10, supplied: 23 }],
  pass10OutputTokens: 8192, periodMs: 6 * 3_600_000 });

/** The 18 recorded physical over-cap frames of the same room, replayed as the output counts a failed pass measures. */
type Recorded = { kind: string; outcome?: { localLimit: string | null; outputTokens: number | null } };
const recordedOverCapTokens = (JSON.parse(readFileSync(
  new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8') ) as { rows: Recorded[] })
  .rows.filter(row => row.kind === 'call-outcome' && row.outcome?.localLimit === 'output-cap')
  .map(row => row.outcome!.outputTokens!);

const FIXED = estimatedAnswerBytes([]);
const TARGET_TOKENS = RETRO_ANSWER_BUDGET_BYTES / RETRO_ANSWER_BYTES_PER_TOKEN;
/** A case id of exactly the live room's shape, so every byte the estimate charges is the length it really is. */
const liveCase = (index: number, category: CaseCategory = 'message'): RetroCase =>
  ({ id: `answer:telegram:8994258214:update:${String(715672478 + index)}`, category, at: 0, seq: index, text: '' });
const pool = Array.from({ length: 200 }, (_, index) => liveCase(index));
/** The planner's own admission, in the one dimension these tests are about: cases are taken while the estimate
 * fits, and a pass's FIRST case is held to the whole bound, which is where the floor of one case lives. */
const planAt = (budget: number) => {
  const taken: RetroCase[] = [];
  for (const item of pool) {
    const bound = taken.length ? budget : RETRO_ANSWER_BUDGET_BYTES;
    if (estimatedAnswerBytes([...taken, item]) <= bound) taken.push(item);
  }
  return taken;
};
const overCap = (estimatedAnswerBytes_: number | undefined, outputTokens: number | undefined) =>
  ({ state: 'failed' as const, reason: RETRO_OVER_CAP_REASON,
    ...(estimatedAnswerBytes_ === undefined ? {} : { estimatedAnswerBytes: estimatedAnswerBytes_ }),
    ...(outputTokens === undefined ? {} : { outputTokens }) });

it('names the gap the live record proves: the ask is budgeted in bytes and judged in tokens, and the answer really costs several times what the estimate charges', () => {
  // The plan aims inside the cap by its own arithmetic — that part was never the bug.
  expect(TARGET_TOKENS).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  // Every recorded over-cap answer, and the live retrospective pass itself, blew straight past that aim.
  for (const tokens of [...recordedOverCapTokens, LIVE.pass10OutputTokens])
    expect(tokens).toBeGreaterThan(TARGET_TOKENS);
  // The live pass 10 supplied 23 cases, so its ask was planned inside the once-halved budget. That ask cost 8192
  // output tokens: the answer is about five times the length the byte estimate charges for it, and the case rows
  // are the SMALLER half of the ask — the rows every pass owes carry most of it.
  const halved = retroAnswerBudget([overCap(undefined, undefined)]);
  expect(halved).toBe(FIXED + Math.floor((RETRO_ANSWER_BUDGET_BYTES - FIXED) / 2));
  // An ask of the size the live pass 10 was planned at — a score of cases inside the once-halved budget.
  const pass10 = planAt(halved);
  expect(pass10.length).toBeGreaterThan(LIVE.overCapPasses[1]!.supplied / 2);
  const pass10Estimate = estimatedAnswerBytes(pass10);
  // The answer the live run recorded for an ask that size cost MORE THAN FOUR TIMES the tokens the byte estimate
  // charges for it — the gap is in the whole answer's scale, not in the bytes-per-token conversion.
  expect(LIVE.pass10OutputTokens / (pass10Estimate / RETRO_ANSWER_BYTES_PER_TOKEN)).toBeGreaterThan(4);
  // And the case rows are the smaller half of that ask: the rows every pass owes, whatever its cases are, carry
  // most of it. Which is why halving the CASE room cannot converge — emptied of every case, the ask it reaches is
  // still over the cap at the rate the live answer was really written to.
  expect(FIXED / pass10Estimate).toBeGreaterThan(0.5);
  const perPlannedByte = LIVE.pass10OutputTokens / pass10Estimate;
  expect(FIXED * perPlannedByte).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
});

it('sizes the next ask from the failed pass own measurement, and reaches a fitting ask in ONE step wherever one exists', () => {
  const planned = estimatedAnswerBytes(planAt(RETRO_ANSWER_BUDGET_BYTES));
  const oneHalving = retroAnswerBudget([overCap(undefined, undefined)]);
  const fitting: number[] = [];
  for (const tokens of recordedOverCapTokens) {
    const next = retroAnswerBudget([overCap(planned, tokens)]);
    const perPlannedByte = tokens / planned;                   // what this pass measured, per byte it planned
    const cases = planAt(next);
    expect(next).toBeLessThan(planned);                        // a measurement can only ever narrow
    expect(next).toBeLessThanOrEqual(oneHalving);              // and never by less than one halving would
    expect(next).toBeGreaterThanOrEqual(FIXED);                // never below the rows every pass owes
    expect(cases.length).toBeGreaterThan(0);                   // the floor of one case is kept throughout
    // The next ask, priced at the very rate the failed answer was written at.
    const wouldCost = estimatedAnswerBytes(cases) * perPlannedByte;
    if (wouldCost <= SUBSCRIPTION_MAX_OUTPUT_TOKENS) fitting.push(tokens);
    // Where it still does not fit, the budget has reached its floor: no number of cases removed makes the ask
    // answerable, because the rows every pass owes exceed the cap on their own at that rate. The sizing says so
    // honestly rather than claiming to have fixed a cap the narrowing cannot reach.
    else { expect(next).toBe(FIXED); expect(cases.length).toBe(1);
      expect(FIXED * perPlannedByte).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS * 0.99); }
  }
  // Exactly where the boundary falls on the recorded evidence: the ten gentlest overruns are answerable after one
  // measured step; the eight largest are not answerable at any number of cases.
  expect([...fitting].sort((a, b) => a - b)).toEqual([...recordedOverCapTokens].sort((a, b) => a - b).slice(0, 10));
  // The live measurement is on the far side of it: 8192 tokens for a score-of-cases ask leaves no ask that fits.
  const livePlanned = estimatedAnswerBytes(planAt(oneHalving));
  expect(retroAnswerBudget([overCap(livePlanned, LIVE.pass10OutputTokens)])).toBe(FIXED);
});

it('converges where the fixed halving never does, which is the whole complaint', () => {
  const planned = estimatedAnswerBytes(planAt(RETRO_ANSWER_BUDGET_BYTES));
  // A recorded overrun in the middle of the range. Every ask the halving can ever reach, including the floor it
  // only arrives at after RETRO_ANSWER_NARROW_STEPS failures — a full day of wall clock at six hours each — is
  // still over the cap at the rate this answer was really written to.
  const tokens = 3592;
  expect(recordedOverCapTokens).toContain(tokens);
  const perPlannedByte = tokens / planned;
  const halvingSteps = Array.from({ length: RETRO_ANSWER_NARROW_STEPS + 2 }, (_, index) =>
    planAt(retroAnswerBudget(Array.from({ length: index + 1 }, () => overCap(undefined, undefined)))));
  for (const step of halvingSteps)
    expect(estimatedAnswerBytes(step) * perPlannedByte).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(halvingSteps.at(-1)!.length).toBe(halvingSteps[RETRO_ANSWER_NARROW_STEPS - 1]!.length);  // it bottoms out
  expect(RETRO_ANSWER_NARROW_STEPS * RETRO_FAILURE_BACKOFF_MS).toBeGreaterThanOrEqual(LIVE.periodMs * 3);
  // The measurement reaches a fitting ask on the first attempt after the failure, at the ordinary interval.
  const measuredStep = planAt(retroAnswerBudget([overCap(planned, tokens)]));
  expect(measuredStep.length).toBeLessThan(halvingSteps.at(-1)!.length);
  expect(estimatedAnswerBytes(measuredStep) * perPlannedByte).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(RETRO_MIN_INTERVAL_MS * RETRO_ANSWER_NARROW_STEPS).toBeLessThan(RETRO_FAILURE_BACKOFF_MS);
});

it('falls back to the halving where there is nothing to measure, and a pass that measured nothing can never widen the ask back out', () => {
  const planned = estimatedAnswerBytes(planAt(RETRO_ANSWER_BUDGET_BYTES));
  // No estimate recorded (a pass written before it was kept), no output count recorded (usage unknown), or a
  // nonsense pair: each falls back rather than budgeting from a number nobody observed.
  expect(measuredAnswerBudget({ outputTokens: 2312 })).toBeNull();
  expect(measuredAnswerBudget({ estimatedAnswerBytes: planned })).toBeNull();
  expect(measuredAnswerBudget({ estimatedAnswerBytes: 0, outputTokens: 2312 })).toBeNull();
  expect(measuredAnswerBudget({ estimatedAnswerBytes: planned, outputTokens: 0 })).toBeNull();
  expect(measuredAnswerBudget({ estimatedAnswerBytes: planned, outputTokens: 0.5 })).toBeNull();
  expect(retroAnswerBudget([overCap(planned, undefined)]))
    .toBe(FIXED + Math.floor((RETRO_ANSWER_BUDGET_BYTES - FIXED) / 2));
  // An older measured pass followed by an unmeasured one keeps the smaller, measured budget: the unmeasured
  // halving at depth 2 would otherwise hand back more room than a measurement already proved too large.
  const measured = retroAnswerBudget([overCap(planned, 2229)]);
  const mixed = retroAnswerBudget([overCap(planned, 2229), overCap(undefined, undefined)]);
  expect(mixed).toBeLessThan(measured);
  // The unmeasured pass halves at the depth it really sits at — two — rather than starting over from the whole
  // bound and handing back more room than the measurement before it already proved too large.
  expect(mixed).toBe(FIXED + Math.floor((RETRO_ANSWER_BUDGET_BYTES - FIXED) / 4));
  expect(retroAnswerBudget([overCap(undefined, undefined), overCap(planned, 2229)])).toBe(measured);
  // A complete pass ends the narrowing, and a genuinely unknown outcome never starts it.
  expect(retroAnswerBudget([overCap(planned, 2229), { state: 'complete' }])).toBe(RETRO_ANSWER_BUDGET_BYTES);
  expect(retroAnswerBudget([{ state: 'unknown', reason: 'model outcome uncertain' }])).toBe(RETRO_ANSWER_BUDGET_BYTES);
  expect(retroAnswerBudget([])).toBe(RETRO_ANSWER_BUDGET_BYTES);
});

// --- the wired path: a real journal, a real worker, the recorded over-cap shapes replayed through it -----------

const key = new Uint8Array(32).fill(41);
const start = Date.UTC(2026, 8, 26, 17);
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 400, maxReplies: 400, maxTurns: 400, maxBytes: 409600, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: 715672478 + id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, date: Math.floor(at / 1000) + id, text } });
const DIGEST = 'sha256:config-a';
const pad = (n: number) => 'note '.repeat(Math.ceil(n / 5)).slice(0, n);
/** A complete answer written at exactly the lengths the question asks for. */
function answerAtAskedLengths(state: string) {
  const cases = (JSON.parse(state) as { cases: RetroCase[] }).cases;
  const graded = cases.filter(item => item.category === 'decision' || item.category === 'verdict');
  return JSON.stringify({ inspected: cases.map(item => item.id), omitted: [],
    duties: RETROSPECTIVE_DUTIES.map(duty => ({ duty, disposition: 'inspected', note: pad(RETRO_NOTE_CHARS) })),
    gravityWells: GRAVITY_WELLS.map(well => ({ well: well.id, observed: false, refs: [], note: pad(RETRO_WELL_NOTE_CHARS) })),
    efficiency: { summary: pad(RETRO_EFFICIENCY_CHARS) }, findings: [], feedback: [], closures: [], authorizations: [],
    comparisons: [], grades: graded.map(item => ({ case: item.id, conclusion: { assessment: 'unverifiable', evidence: [] },
      reason: { assessment: item.reason === undefined ? 'not-applicable' : 'unverifiable', evidence: [] },
      outcome: { assessment: 'pending', reason: pad(RETRO_OUTCOME_REASON_CHARS), evidence: [] }, observations: [] })) });
}
/** The over-cap outcome row the live provider appends before it classifies, at a recorded output count. */
const overCapOutcome = (outputTokens: number) => ({ exitCode: 0, localLimit: 'output-cap' as const, elapsedMs: 22921,
  type: 'result' as const, subtype: 'success' as const, isError: false, outputTokens, promptBytes: 16180 });

function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-measured-')));
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis);
  let now = start, next = 1;
  const states: string[] = [];
  let answer: (state: string, id: string) => Awaited<ReturnType<NonNullable<Parameters<typeof createJournalWorker>[1]['retrospect']>>>
    = state => ({ state: 'complete', value: answerAtAskedLengths(state), usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true } });
  const workerOn = (opened: typeof journal) => createJournalWorker(opened, { now: () => now, stopped: () => false,
    timeZone: 'America/Los_Angeles', sources: () => [disciplineSource(opened.view)],
    model: async (input: { id: string }) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator chatted about the preview.', people: [], memory: [], commitments: [], questions: [] })
      : JSON.stringify({ reply: 'Noted — here is a reply of ordinary length for this preview conversation.', memory: [], dated: [] }),
    send: async () => 7, checkOutbound: () => {},
    retrospect: async (state: string, id: string) => { states.push(state); return answer(state, id); } });
  let worker = workerOn(journal);
  /** The whole live over-cap shape: the physical outcome row, then the uncertain return the provider hands back
   * carrying the same output count as its usage — which is the number the next ask is sized from. */
  const answerOverCapAt = (outputTokens: number) => { answer = (_state, id) => {
    journal.append({ kind: 'call-outcome', id, role: 'model', outcome: overCapOutcome(outputTokens), at: now } as never);
    return { state: 'uncertain', usage: { inputTokens: 53198, outputTokens, charge: null, inputComplete: true } };
  }; };
  return { get journal() { return journal; }, states, at: () => now, advance: (ms: number) => { now += ms; },
    answerWith: (fn: typeof answer) => { answer = fn; }, answerOverCapAt,
    retrospect: () => worker.retrospect(DIGEST),
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text, now))); await worker.drain(); },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); worker = workerOn(journal); },
    done: () => { try { journal.close(); } catch { /* closed */ } rmSync(root, { recursive: true, force: true }); } };
}
const owed = (view: JournalView, now: number) => eligibleCases(view, retrospectiveCases(view), now).map(item => item.id);
const messages = Array.from({ length: 14 }, (_, index) => `Question number ${String(index + 1)} about how this preview works.`);

it('records both numbers with the pass, so the next ask is sized from the measurement and survives a restart', async () => {
  const w = world();
  try {
    await w.converse(messages);
    const before = owed(w.journal.view, w.at());
    w.answerOverCapAt(2229);
    await w.retrospect();
    const failed = w.journal.view.retroPasses.at(-1)!;
    expect(failed.state).toBe('failed');
    expect(failed.reason).toBe(RETRO_OVER_CAP_REASON);
    // The pair the next plan needs: what this pass estimated, and what its answer really cost.
    expect(failed.estimatedAnswerBytes).toBe(estimatedAnswerBytes(
      (JSON.parse(w.states[0]!) as { cases: RetroCase[] }).cases));
    expect(failed.outputTokens).toBe(2229);
    const narrowed = retroAnswerBudget(w.journal.view.retroPasses);
    expect(narrowed).toBe(measuredAnswerBudget(failed));
    expect(narrowed).toBeLessThan(failed.estimatedAnswerBytes!);
    // It is read from the journal's own records, not from the ten-row outcome window, so a restart keeps it.
    w.reopen();
    const reopened = w.journal.view.retroPasses.at(-1)!;
    expect(reopened.estimatedAnswerBytes).toBe(failed.estimatedAnswerBytes);
    expect(reopened.outputTokens).toBe(2229);
    expect(retroAnswerBudget(w.journal.view.retroPasses)).toBe(narrowed);
    // Nothing was lost by failing: every case is still owed.
    expect(owed(w.journal.view, w.at())).toEqual(expect.arrayContaining(before));
  } finally { w.done(); }
});

it('retries a settled over-cap pass at the ordinary interval while the ask is still shrinking, and at the backoff once it is not', async () => {
  const w = world();
  try {
    await w.converse(messages);
    w.answerOverCapAt(2229);
    await w.retrospect();
    expect(w.journal.view.retroPasses.length).toBe(1);
    const failed = w.journal.view.retroPasses.at(-1)!;
    expect(retroAnswerBudget(w.journal.view.retroPasses)).toBeLessThan(failed.estimatedAnswerBytes!);
    // Not instantly: the ordinary minimum interval between passes still holds.
    w.advance(RETRO_MIN_INTERVAL_MS - 1);
    await w.retrospect();
    expect(w.journal.view.retroPasses.length).toBe(1);
    // But at that interval, not six hours later: the cause is settled and the repair already computed.
    expect(RETRO_MIN_INTERVAL_MS).toBeLessThan(RETRO_FAILURE_BACKOFF_MS);
    w.advance(1);
    let asked = '';
    w.answerWith(state => { asked = answerAtAskedLengths(state);
      return { state: 'complete', value: asked, usage: { inputTokens: 17164,
        outputTokens: Math.round(Buffer.byteLength(asked) / RETRO_ANSWER_BYTES_PER_TOKEN), charge: null, inputComplete: true } }; });
    await w.retrospect();
    const second = w.journal.view.retroPasses.at(-1)!;
    expect(second.pass).toBe(1);
    expect(second.state).toBe('complete');
    expect(second.cases.length).toBeGreaterThan(0);
    expect(second.cases.length).toBeLessThan(failed.cases.length);
    expect(Buffer.byteLength(asked) / RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  } finally { w.done(); }
});

it('the other side: a measurement that leaves no ask that fits waits the full backoff instead of burning a call an hour', async () => {
  const w = world();
  try {
    await w.converse(messages);
    // The live measurement: the rows every pass owes exceed the cap on their own, so the budget reaches its floor
    // and the next ask cannot be made smaller. One case is still asked about; the cadence returns to the backoff.
    w.answerOverCapAt(LIVE.pass10OutputTokens);
    await w.retrospect();
    expect(retroAnswerBudget(w.journal.view.retroPasses)).toBe(FIXED);
    w.advance(RETRO_FAILURE_BACKOFF_MS - 1);
    await w.retrospect();
    expect(w.journal.view.retroPasses.length).toBe(1);
    w.advance(1);
    await w.retrospect();
    expect(w.journal.view.retroPasses.length).toBe(2);
    const second = w.journal.view.retroPasses.at(-1)!;
    expect(second.cases.length).toBe(1);
    expect(second.reason).toBe(RETRO_OVER_CAP_REASON);
  } finally { w.done(); }
});

it('an unknown outcome keeps the backoff and starts no narrowing, measurement or not', async () => {
  const w = world();
  try {
    await w.converse(messages);
    // No outcome row proving an over-cap frame: the outcome is genuinely unknown, so nothing is measured from it.
    w.answerWith(() => ({ state: 'uncertain', usage: { inputTokens: 53198, outputTokens: 2229, charge: null, inputComplete: true } }));
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('unknown');
    expect(retroAnswerBudget(w.journal.view.retroPasses)).toBe(RETRO_ANSWER_BUDGET_BYTES);
    w.advance(RETRO_MIN_INTERVAL_MS);
    await w.retrospect();
    expect(w.journal.view.retroPasses.length).toBe(1);
    w.advance(RETRO_FAILURE_BACKOFF_MS - RETRO_MIN_INTERVAL_MS);
    await w.retrospect();
    expect(w.journal.view.retroPasses.length).toBe(2);
  } finally { w.done(); }
});

it('refuses a nonsense estimate rather than misbudgeting every later pass with it', async () => {
  const w = world();
  try {
    await w.converse(messages);
    for (const bad of [0, -1, 1.5]) expect(() => w.journal.append({ kind: 'retro-reserve', pass: 0, turnsSeen: 1,
      cases: [], omitted: [], eligible: 0, packetSha256: 'sha256:x', contextDigest: DIGEST,
      estimatedAnswerBytes: bad, at: w.at() } as never)).toThrow(/retrospective reservation/u);
    expect(w.journal.view.retroPasses.length).toBe(0);
  } finally { w.done(); }
});
