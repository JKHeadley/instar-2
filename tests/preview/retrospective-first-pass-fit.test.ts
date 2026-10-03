import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETRO_ANSWER_BUDGET_BYTES, RETRO_ANSWER_BYTES_PER_TOKEN,
  RETRO_ANSWER_GRADE_REFS, RETRO_ANSWER_GROWTH, RETRO_ANSWER_START_BYTES, RETRO_CLASSIFICATION_CHARS,
  RETRO_EFFICIENCY_CHARS, RETRO_FEEDBACK_OWNER_CHARS, RETRO_MAX_OMITTED_ROWS, RETRO_MIN_INTERVAL_MS,
  RETRO_OUTCOME_REASON_CHARS, RETRO_OVER_CAP_REASON, RETRO_UNACCOUNTED_REASON, disciplineSource, eligibleCases,
  estimatedAnswerBytes, retroAnswerBudget, reviewRecordOf, rowMissingReason, validateRetrospective, type RetroCase } from './retrospective.js';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';

/** The three live retrospective failures of 2026-10-02, recorded AFTER the compact answer shape went live, so
 * none of them is the shape problem that unit fixed. Everything under `recorded` is the live projection,
 * verbatim; the answers replayed against those shapes below are authored, because no model has been asked for
 * the budget-carrying ask this unit introduces and the first live pass is its real proof. */
const live = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-2026-10-02.json',
  import.meta.url), 'utf8')) as {
    recorded: {
      justinRoot: { passes: { pass: number; state: string; reason: string; eligible: number; supplied: number;
        deferredByBound: number; inspected: number | null; efficiency: string | null }[];
        owed: { cases: number }; routeSelection: string };
      freshRoot: { passes: { pass: number; state: string; reason: string; eligible: number; supplied: number;
        deferredByBound: number }[]; owed: { cases: number } };
      proofChecks: string[];
      liveIdShapes: { message: string; decision: string; verdict: string };
      liveModelRuns: { calls: { run: string; call: number; plannedBytes: number; outputTokens: number;
        answerBytes: number; frameBytes: number; state: string }[];
        refusedBeforeTheRowIsolation: { run: string; call: number; plannedBytes: number; outputTokens: number;
          answerBytes: number; reason: string }[] };
    };
  };
const justinPasses = live.recorded.justinRoot.passes;
const freshPass = live.recorded.freshRoot.passes[0]!;
const liveIds = live.recorded.liveIdShapes;

const key = new Uint8Array(32).fill(41);
const start = Date.UTC(2026, 8, 26, 17);
/** The live room's identity shape, so every case id is as long as it really is (43 bytes for a decision). */
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 4000, maxReplies: 4000, maxTurns: 4000, maxBytes: 409600, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: 715672478 + id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, date: Math.floor(at / 1000) + id, text } });
const DIGEST = 'sha256:config-a';
const pad = (n: number) => 'note '.repeat(Math.ceil(n / 5)).slice(0, n);
type Answer = { state: 'complete'; value: string; usage: { inputTokens: number; outputTokens: number; charge: null; inputComplete: true } }
  | { state: 'uncertain'; usage: { inputTokens: number; outputTokens: number; charge: null; inputComplete: true } };

/** The answer the VALIDATOR REQUIRES for a packet's cases, at the lengths the question asks for, with every
 * claim fully evidenced — which is the shape a review that can settle its outcomes really writes: every case
 * inspected; every decision and verdict graded with refs on its conclusion, refs on its stated reason, and a
 * settled outcome with its own later ref wherever a later case exists (three ref lists, which is what
 * RETRO_ANSWER_GRADE_REFS prices); a feedback row for every case the journal already recorded as a correction,
 * without which the pass is refused; and one finding. This is the oracle the estimate has to bound — an
 * estimate below it prices an answer the review cannot write inside the route's output cap. */
function requiredAnswer(state: string, over: Record<string, unknown> = {}): string {
  const cases = (JSON.parse(state) as { cases: RetroCase[] }).cases;
  const graded = cases.filter(item => item.category === 'decision' || item.category === 'verdict');
  const corrections = cases.filter(item => item.meta?.correction !== undefined);
  // A met or unmet outcome needs evidence LATER than the answer it grades (a verdict is exempt).
  const later = (item: RetroCase) => cases.find(other => other.seq > item.seq);
  return JSON.stringify({ inspected: cases.map(item => item.id), omitted: [],
    duties: RETROSPECTIVE_DUTIES.map(duty => duty === 'waste' ? 'f' : 'n').join(''), wells: GRAVITY_WELLS.map(() => 0),
    eff: pad(RETRO_EFFICIENCY_CHARS),
    findings: [{ duty: 'waste', refs: [cases[0]!.id], summary: pad(RETRO_OUTCOME_REASON_CHARS),
      disposition: { owner: 'agent', next: pad(RETRO_OUTCOME_REASON_CHARS) } }],
    feedback: corrections.map(item => ({ case: item.id, classification: pad(RETRO_CLASSIFICATION_CHARS),
      disposition: 'improvement-owned', owner: pad(RETRO_FEEDBACK_OWNER_CHARS), next: pad(RETRO_OUTCOME_REASON_CHARS) })),
    closures: [], authorizations: [], comparisons: [],
    grades: graded.map(item => { const settles = item.category === 'verdict' ? item : later(item);
      return { case: item.id, conclusion: { assessment: 'supported', evidence: [item.id] },
        reason: { assessment: 'supported', evidence: [item.id] },
        outcome: settles === undefined ? { assessment: 'pending', reason: pad(RETRO_OUTCOME_REASON_CHARS), evidence: [] }
          : { assessment: 'met', reason: pad(RETRO_OUTCOME_REASON_CHARS), evidence: [settles.id] }, observations: [] }; }),
    ...over });
}
/** The tokens a frame of this many bytes reports, at the measured bytes-per-token on record. */
const tokensFor = (bytes: number) => Math.round(bytes / RETRO_ANSWER_BYTES_PER_TOKEN);

function world(answer: (state: string, id: string) => Answer = state => {
  const value = requiredAnswer(state);
  return { state: 'complete', value, usage: { inputTokens: 100, outputTokens: tokensFor(Buffer.byteLength(value)), charge: null, inputComplete: true } };
}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-fit-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let now = start, next = 1;
  const states: string[] = [];
  let reply = (state: string, id: string) => answer(state, id);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
    sources: () => [disciplineSource(journal.view)],
    model: async (input: { id: string }) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator chatted about the preview.', people: [], memory: [], commitments: [], questions: [] })
      : JSON.stringify({ reply: 'Noted — here is a reply of ordinary length for this preview conversation.', memory: [], dated: [] }),
    send: async () => 7, checkOutbound: () => {},
    retrospect: async (state: string, id: string) => { states.push(state); return reply(state, id); } });
  return { journal, states, at: () => now, advance: (ms: number) => { now += ms; },
    answerWith: (fn: typeof reply) => { reply = fn; },
    retrospect: () => worker.retrospect(DIGEST),
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text, now))); await worker.drain(); },
    done: () => { try { journal.close(); } catch { /* closed */ } rmSync(root, { recursive: true, force: true }); } };
}
const owed = (view: JournalView, now: number) => eligibleCases(view, retrospectiveCases(view), now).map(item => item.id);
const messages = (count: number, from = 1) =>
  Array.from({ length: count }, (_, index) => `Question number ${String(index + from)} about how this preview works.`);
const liveCase = (id: string, category: RetroCase['category'], meta?: Record<string, string>): RetroCase =>
  ({ id, category, at: 1, seq: 1, text: 'a case of ordinary length', ...(meta ? { meta } : {}) });

it('replays the three recorded live failures of 2026-10-02, each after the compact answer shape went live', () => {
  // 1. Over the cap on a FIRST ask, with nothing behind it to narrow from. A fresh root's very first pass.
  expect(freshPass.pass).toBe(0);
  expect(freshPass.state).toBe('failed');
  expect(freshPass.reason).toBe(RETRO_OVER_CAP_REASON);
  expect(freshPass.supplied).toBe(22);
  expect(freshPass.eligible).toBe(36);
  // Justin's root ran over four consecutive times, the last with only 13 of 953 cases supplied.
  const overCap = justinPasses.filter(pass => pass.reason === RETRO_OVER_CAP_REASON);
  expect(overCap.map(pass => pass.supplied)).toEqual([37, 23, 11, 13]);
  // 2. A narrowed pass that FITTED was refused for its accounting, discarding the whole pass.
  expect(live.recorded.proofChecks.some(line => line.startsWith('I1a FAIL'))).toBe(true);
  // 3. The record decoder refused the pass before its answer was read, on a 978-case deferral list.
  const last = justinPasses.at(-1)!;
  expect(last.reason).toBe('retrospective: review record refused by its verification decoder: bounded array required');
  expect(last.deferredByBound).toBe(978);
  expect(live.recorded.justinRoot.owed.cases).toBe(980);
  // Not one pass on either root ever completed: every one records no inspection and no efficiency sentence.
  expect(justinPasses.every(pass => pass.inspected === null && pass.efficiency === null)).toBe(true);
});

it('prices the feedback row a recorded correction MUST owe, and the validator really requires it', () => {
  const plain = liveCase(liveIds.message, 'message', { conversation: 'main' });
  const correction = liveCase(liveIds.message, 'message', { conversation: 'main', correction: 'prefer' });
  const feedbackRow = Buffer.byteLength(JSON.stringify({ case: correction.id, classification: pad(RETRO_CLASSIFICATION_CHARS),
    disposition: 'improvement-owned', owner: pad(RETRO_FEEDBACK_OWNER_CHARS), next: pad(RETRO_OUTCOME_REASON_CHARS) }));
  // The row is real work the answer cannot leave out, so the estimate must charge for it.
  expect(estimatedAnswerBytes([correction]) - estimatedAnswerBytes([plain])).toBeGreaterThanOrEqual(feedbackRow);
  // Both sides of the requirement, against the live validator: without the row the case is not inspected (changed
  // by plan #412: it is recorded omitted and stays owed, where it used to refuse the whole pass)...
  const view = { retroPasses: [], dated: [], turns: new Map() } as unknown as JournalView;
  const body = (feedback: unknown[]) => ({ inspected: [correction.id], omitted: [],
    duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length), wells: GRAVITY_WELLS.map(() => 0), eff: 'nothing wasted',
    findings: [], grades: [], feedback, authorizations: [], comparisons: [], closures: [] });
  expect(validateRetrospective(body([]), { cases: [correction] }, view, 1))
    .toMatchObject({ inspected: [], omitted: [{ case: correction.id, reason: rowMissingReason('feedback') }] });
  // ...and with it the case is inspected, and the row is clipped at the length the question states for it.
  const result = validateRetrospective(body([{ case: correction.id, classification: pad(RETRO_CLASSIFICATION_CHARS + 50),
    disposition: 'improvement-owned', owner: pad(RETRO_FEEDBACK_OWNER_CHARS), next: pad(RETRO_OUTCOME_REASON_CHARS) }]),
  { cases: [correction] }, view, 1);
  expect(result.feedback).toHaveLength(1);
  expect(result.inspected).toEqual([correction.id]);
  expect(result.feedback[0]!.classification).toHaveLength(RETRO_CLASSIFICATION_CHARS);
});

it('sizes the answer budget from the REAL retrospective frame, not from a reply\'s bytes per token', () => {
  const runs = live.recorded.liveModelRuns.calls;
  expect(runs.length).toBeGreaterThanOrEqual(4);
  for (const row of runs) {
    expect(row.state, `${row.run}/${String(row.call)}`).toBe('complete');
    // The frame the cap counts is far larger than the answer inside it: the model's reasoning rides in the
    // Decision's reason.value. That is why the planned answer must be budgeted at a much smaller ratio than a
    // reply's measured bytes per token, and it is the whole point of this constant.
    expect(row.frameBytes).toBeGreaterThan(row.answerBytes);
  }
  // Honesty about these four calls: THREE fitted the route's output cap and ONE did not. The one that did not
  // (run4 call 2, 2,133 tokens against 2,048) is the calibration datum: it was planned at 3,459 bytes under the
  // old reply-measured ratio, and the stub provider of that run did not enforce the cap, so it recorded complete
  // where the real route would have refused the frame. It is kept here as evidence, not as a success.
  const fitted = runs.filter(row => row.outputTokens <= SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(fitted).toHaveLength(runs.length - 1);
  const overshoot = runs.find(row => row.outputTokens > SUBSCRIPTION_MAX_OUTPUT_TOKENS)!;
  expect(overshoot.plannedBytes).toBeGreaterThan(RETRO_ANSWER_BUDGET_BYTES);
  // The constant is at or below the DENSEST frame observed, never the average: a budget sized at the average
  // overruns the cap on a denser pass, which is exactly what that call did.
  const densest = Math.min(...runs.map(row => row.plannedBytes / row.outputTokens));
  expect(RETRO_ANSWER_BYTES_PER_TOKEN).toBeLessThanOrEqual(densest);
  // And the whole bound, at the densest ratio observed, is answerable inside the cap with room to spare —
  // which the ask that overshot was not.
  expect(RETRO_ANSWER_BUDGET_BYTES / densest).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(overshoot.plannedBytes / densest).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  // Both rows the real model refused BEFORE this unit isolated them fitted the cap: the ask was already right
  // and an hour of real review was discarded over one row.
  for (const row of live.recorded.liveModelRuns.refusedBeforeTheRowIsolation)
    expect(row.outputTokens, row.reason).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
});

it('prices the evidence refs a graded row requires, at live id length', () => {
  const decision = liveCase(liveIds.decision, 'decision');
  const message = liveCase(liveIds.message, 'message', { conversation: 'main' });
  const graded = estimatedAnswerBytes([decision]) - estimatedAnswerBytes([]);
  const plain = estimatedAnswerBytes([message]) - estimatedAnswerBytes([]);
  expect(graded - plain).toBeGreaterThanOrEqual(RETRO_ANSWER_GRADE_REFS * decision.id.length);
  // A verdict owes the same grade row as a decision.
  expect(estimatedAnswerBytes([liveCase(liveIds.verdict, 'verdict')]) - estimatedAnswerBytes([]))
    .toBeGreaterThan(RETRO_ANSWER_GRADE_REFS * liveIds.verdict.length);
});

it('starts the first ask small, and the answer that first pass requires fits the route output cap', async () => {
  const w = world();
  try {
    // A root shaped like the recorded ones: operator messages, each with its own judged answer.
    await w.converse(messages(14));
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    // THE claim this unit exists to make, stated without reference to how the budget is chosen: the answer the
    // validator REQUIRES of the pass that was actually planned fits the route's output cap. It did not before:
    // the first ask was planned at the whole bound, supplied 23 cases of this root, and the answer they require
    // is about 2,175 output tokens against a cap of 2,048 — the fresh root's recorded 09:28 failure.
    expect(tokensFor(Buffer.byteLength(requiredAnswer(w.states.at(-1)!)))).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    // And the ask it was planned at is the small start, because this root has nothing to measure from.
    expect(retroAnswerBudget([])).toBe(RETRO_ANSWER_START_BYTES);
    expect(RETRO_ANSWER_START_BYTES).toBeLessThan(RETRO_ANSWER_BUDGET_BYTES);
    // The pass completed: the live record's first failure is gone.
    expect(pass.state).toBe('complete');
    expect(pass.reason).toBeUndefined();
    expect(pass.result!.inspected.length).toBe(pass.cases.length);
    expect(pass.result!.efficiency.summary.split(' ').length).toBeGreaterThanOrEqual(3);
    expect(pass.result!.duties).toHaveLength(RETROSPECTIVE_DUTIES.length);
    // And it fitted BY CONSTRUCTION, not by luck. Two separate claims, because the estimate deliberately prices
    // only the rows a pass OWES: the rows this plan owes are inside the pass's own estimate, and the whole
    // required answer — findings included, which only exist when the review finds something and are what
    // RETRO_ANSWER_RESERVE is room for — is inside the route's output cap.
    const owedRows = Buffer.byteLength(requiredAnswer(w.states.at(-1)!, { findings: [] }));
    const required = Buffer.byteLength(requiredAnswer(w.states.at(-1)!));
    expect(owedRows).toBeLessThanOrEqual(pass.estimatedAnswerBytes!);
    expect(required).toBeGreaterThan(owedRows);
    expect(tokensFor(required)).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    expect(pass.outputTokens!).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  } finally { w.done(); }
});

it('tells the model this pass own budget rather than the whole bound, and the two agree', async () => {
  const w = world();
  try {
    await w.converse(messages(14));
    await w.retrospect();
    const packet = JSON.parse(w.states.at(-1)!) as { answerBudgetBytes: number };
    expect(packet.answerBudgetBytes).toBe(RETRO_ANSWER_START_BYTES);
    expect(packet.answerBudgetBytes).toBeLessThan(RETRO_ANSWER_BUDGET_BYTES);
    expect(w.journal.view.retroPasses.at(-1)!.estimatedAnswerBytes!).toBeLessThanOrEqual(packet.answerBudgetBytes);
  } finally { w.done(); }
});

it('widens from the root own measurement, one doubling at a time, and never past the whole bound', () => {
  const measured = (estimate: number, tokens: number, state: 'complete' | 'failed' = 'complete', reason?: string) =>
    ({ state, ...(reason === undefined ? {} : { reason }), estimatedAnswerBytes: estimate, outputTokens: tokens });
  // Nothing recorded yet: the small start.
  expect(retroAnswerBudget([])).toBe(RETRO_ANSWER_START_BYTES);
  // A completed pass that spent a quarter of the cap earns more room, bounded by one doubling of its own ask.
  const first = measured(RETRO_ANSWER_START_BYTES, Math.floor(SUBSCRIPTION_MAX_OUTPUT_TOKENS / 4));
  expect(retroAnswerBudget([first]))
    .toBe(Math.min(RETRO_ANSWER_BUDGET_BYTES, RETRO_ANSWER_START_BYTES * RETRO_ANSWER_GROWTH));
  // A start a long way below the bound climbs in doublings rather than one jump, and stops at the bound.
  const small = measured(500, 100);
  expect(retroAnswerBudget([small])).toBe(500 * RETRO_ANSWER_GROWTH);
  expect(retroAnswerBudget([small, measured(1000, 200)])).toBe(1000 * RETRO_ANSWER_GROWTH);
  const second = measured(RETRO_ANSWER_START_BYTES * RETRO_ANSWER_GROWTH, Math.floor(SUBSCRIPTION_MAX_OUTPUT_TOKENS / 4));
  expect(retroAnswerBudget([first, second])).toBe(RETRO_ANSWER_BUDGET_BYTES);
  // A pass that nearly filled the cap earns no widening at all.
  const tight = measured(RETRO_ANSWER_BUDGET_BYTES, SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(retroAnswerBudget([tight])).toBeLessThan(RETRO_ANSWER_BUDGET_BYTES);
  // An over-cap pass's proven ceiling still holds after a LATER pass fails for an unrelated reason and ends the
  // trailing run — the exact live sequence (four over-cap passes, then one refused by the record decoder).
  const over = measured(RETRO_ANSWER_BUDGET_BYTES, SUBSCRIPTION_MAX_OUTPUT_TOKENS * 4, 'failed', RETRO_OVER_CAP_REASON);
  const other = measured(400, 60, 'failed', 'answer was not JSON');
  expect(retroAnswerBudget([over, other])).toBeLessThanOrEqual(retroAnswerBudget([over]));
  expect(retroAnswerBudget([over, other])).toBeLessThan(RETRO_ANSWER_BUDGET_BYTES);
});

it('records a case the answer put in neither list as omitted, completes the pass, and keeps that case owed', async () => {
  const w = world();
  try {
    await w.converse(messages(14));
    let skipped = '';
    w.answerWith(state => {
      const cases = (JSON.parse(state) as { cases: RetroCase[] }).cases;
      // The recorded live shape: one supplied case accounted for in neither list.
      skipped = cases.at(-1)!.id;
      const value = requiredAnswer(state, { inspected: cases.slice(0, -1).map(item => item.id) });
      return { state: 'complete', value, usage: { inputTokens: 1, outputTokens: tokensFor(Buffer.byteLength(value)), charge: null, inputComplete: true } };
    });
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('complete');
    expect(pass.result!.inspected).not.toContain(skipped);
    expect(pass.result!.omitted).toEqual(expect.arrayContaining([{ case: skipped, reason: RETRO_UNACCOUNTED_REASON }]));
    // Every supplied case is still accounted for exactly once, so the pass's accounting stays complete.
    expect(pass.result!.inspected.length + pass.result!.omitted.length).toBe(pass.cases.length);
    // The unaccounted case stays owed, and the inspected ones do not.
    expect(owed(w.journal.view, w.at())).toContain(skipped);
    expect(owed(w.journal.view, w.at())).not.toContain(pass.result!.inspected[0]);
  } finally { w.done(); }
});

it('records a case the answer put in BOTH lists as omitted, never as inspected', () => {
  const view = { retroPasses: [], dated: [], turns: new Map() } as unknown as JournalView;
  const cases = [liveCase(liveIds.message, 'message', { conversation: 'main' }),
    liveCase(`${liveIds.message}-b`, 'message', { conversation: 'main' })];
  const result = validateRetrospective({ inspected: cases.map(item => item.id),
    omitted: [{ case: cases[1]!.id, reason: 'earlier assessment not shown' }],
    duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length), wells: GRAVITY_WELLS.map(() => 0), eff: 'nothing wasted',
    findings: [], grades: [], feedback: [], authorizations: [], comparisons: [], closures: [] },
  { cases }, view, 1);
  expect(result.inspected).toEqual([cases[0]!.id]);
  expect(result.omitted).toEqual([{ case: cases[1]!.id, reason: 'earlier assessment not shown' }]);
});

it('never records an inspection the answer did not claim: an answer that accounts for nothing inspects nothing', () => {
  // Deferring every case is work a pass may honestly record (every case stays owed), and it was already
  // accepted when the answer listed each deferral by name. What this must never do is READ silence as
  // inspection, so the derived disposition is omitted, and `inspected` stays empty.
  const view = { retroPasses: [], dated: [], turns: new Map() } as unknown as JournalView;
  const cases = [liveCase(liveIds.message, 'message', { conversation: 'main' })];
  const body = (inspected: string[]) => ({ inspected, omitted: [],
    duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length), wells: GRAVITY_WELLS.map(() => 0), eff: 'nothing wasted',
    findings: [], grades: [], feedback: [], authorizations: [], comparisons: [], closures: [] });
  const empty = validateRetrospective(body([]), { cases }, view, 1);
  expect(empty.inspected).toEqual([]);
  expect(empty.omitted).toEqual([{ case: cases[0]!.id, reason: RETRO_UNACCOUNTED_REASON }]);
  expect(validateRetrospective(body([cases[0]!.id]), { cases }, view, 1).inspected).toEqual([cases[0]!.id]);
});

it('keeps the review record inside the decoder array bound however large the owed backlog grows', () => {
  const cases = Array.from({ length: 2 }, (_, index) => `${liveIds.decision}${String(index)}`);
  // The live pass 13's own numbers: 978 deferred cases in one pass's record.
  const deferred = Array.from({ length: freshPass.deferredByBound + 964 },
    (_, index) => ({ case: `${liveIds.message}${String(index)}`, reason: 'bound: answer budget, deferred to a later pass' }));
  expect(deferred).toHaveLength(978);
  // Unbounded, the record is refused before the answer is even read — the live pass 13 failure.
  expect(() => reviewRecordOf({ pass: 13, cases, omitted: deferred, contextDigest: 'sha256:d',
    packetSha256: `sha256:${'a'.repeat(64)}` }, { inspected: cases, omitted: [], findings: [] }))
    .toThrow('bounded array required');
  // Bounded as the planner now bounds it, the same record is accepted.
  const record = reviewRecordOf({ pass: 13, cases, omitted: deferred.slice(0, RETRO_MAX_OMITTED_ROWS),
    contextDigest: 'sha256:d', packetSha256: `sha256:${'a'.repeat(64)}` }, { inspected: cases, omitted: [], findings: [] });
  expect(record.eligibleCases.length).toBeLessThanOrEqual(512);
  expect(record.closure).toBe('incomplete');
});

it('completes a pass on a root whose owed backlog is past the record decoder array bound, and keeps the rest owed', async () => {
  const w = world();
  try {
    // 300 operator messages, each with its own judged answer: 600 owed cases, past the decoder's 512 bound.
    for (let batch = 0; batch < 6; batch++) await w.converse(messages(50, batch * 50 + 1));
    const before = owed(w.journal.view, w.at());
    expect(before.length).toBeGreaterThan(512);
    await w.retrospect();
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('complete');
    expect(pass.eligible).toBe(before.length);
    // The pass names a bounded number of deferrals, while `eligible` still carries the true owed total.
    expect(pass.omitted.length).toBeLessThanOrEqual(RETRO_MAX_OMITTED_ROWS);
    expect(pass.eligible - pass.cases.length).toBeGreaterThan(RETRO_MAX_OMITTED_ROWS);
    // Nothing is lost: every case this pass did not inspect is still owed.
    const after = owed(w.journal.view, w.at());
    expect(after).toEqual(expect.arrayContaining(before.filter(id => !pass.result!.inspected.includes(id))));
    // The only case the pass ADDED is the open improvement item its own finding opened, which is owed until a
    // later pass evaluates it.
    const opened = pass.result!.findings.map(item => `open:${item.id}`);
    expect(opened).toHaveLength(1);
    expect(after).toEqual(expect.arrayContaining(opened));
    expect(after.length).toBe(before.length - pass.result!.inspected.length + opened.length);
    // And the next pass is due at the ordinary interval after a completed one, not the failure backoff.
    w.advance(RETRO_MIN_INTERVAL_MS);
    await w.retrospect();
    expect(w.journal.view.retroPasses).toHaveLength(2);
    expect(w.journal.view.retroPasses.at(-1)!.state).toBe('complete');
  } finally { w.done(); }
  // A 300-turn conversation and two full passes over 600 owed cases: minutes of real journal work, not a
  // hang. The default 10 s is a reply-sized budget.
}, 120_000);
