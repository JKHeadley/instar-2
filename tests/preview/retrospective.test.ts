import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETRO_MIN_INTERVAL_MS, RETRO_PENDING_RECHECK_MS, RETRO_STALE_CASE_MS, RETROSPECTIVE_DUTIES, RETROSPECTIVE_QUESTION,
  WAIVER_EVIDENCE_UNAVAILABLE, benchmarkReruns, disciplineSource, eligibleCases, feedbackDispositions, feedbackRecordOf, latestGrades,
  openFindings, passAccounting, pendingGrades, promotedCases, replyContextDigest, retrospectivePlan, retrospectivePopulation,
  retrospectiveStatusLine, standingGrantCandidates, validateRetrospective, type RetroCase } from './retrospective.js';

const key = new Uint8Array(32).fill(21);
const start = Date.UTC(2026, 8, 26, 17);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 80, maxReplies: 80, maxTurns: 80, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, at = start) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: Math.floor(at / 1000) + id, text } });
const words = Array.from({ length: 20 }, (_, index) => `message ${String(index + 1)}`);
const turnId = (n: number) => `telegram:12345678:update:${String(n)}`;
const operator = () => (turn: JournalView['order'][number]) => turn.accepted && !turn.requestedSummary;
const DIGEST = 'sha256:config-a';

type Case = { id: string; category: string; reason?: string };
/** A complete, valid review answer for whatever cases the pass supplied. */
function body(cases: Case[], extra: Record<string, unknown> = {}) {
  return { inspected: cases.map(item => item.id), omitted: [],
    duties: RETROSPECTIVE_DUTIES.map(duty => ({ duty, disposition: 'inspected', note: 'checked; nothing found' })),
    gravityWells: GRAVITY_WELLS.map(well => ({ well: well.id, observed: false, refs: [], note: 'not seen' })),
    efficiency: { summary: 'No wasted attempts found in this window.' },
    findings: [], feedback: [], closures: [],
    grades: cases.filter(item => item.category === 'decision' || item.category === 'verdict').map(item => ({ case: item.id,
      conclusion: { assessment: 'unverifiable', evidence: [] }, reason: { assessment: item.reason ? 'unverifiable' : 'not-applicable', evidence: [] },
      outcome: { assessment: 'pending', reason: 'no later message settles it yet', evidence: [] }, observations: [] })),
    authorizations: cases.filter(item => item.category === 'authorization').map(item => ({ case: item.id, candidate: false, recurrences: [] })),
    comparisons: cases.filter(item => item.category === 'rerun').map(item => ({ case: item.id, verdict: 'consistent', reason: 'same advice' })),
    ...extra };
}
const casesOf = (state: string) => (JSON.parse(state) as { cases: RetroCase[] }).cases;
const answerFor = (state: string, extra: Record<string, unknown> = {}) => JSON.stringify(body(casesOf(state), extra));
const remindRequest = /^remind me (.+?) to /u;

function world(options: { calls?: number; duringCall?: (id: string, journal: ReturnType<typeof openPreviewJournal>) => void;
  evidence?: () => Record<string, unknown> } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { ...genesis, maxCalls: options.calls ?? genesis.maxCalls });
  let now = start;
  const states: string[] = [], contexts: string[] = [], modelIds: string[] = [];
  let reply: (state: string) => string = state => answerFor(state);
  let answer: unknown = 'Noted.';
  const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
    sources: () => [disciplineSource(journal.view)],
    model: async (input: { id: string; question: string; context: string }) => {
      modelIds.push(input.id); contexts.push(input.context);
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator chatted and asked for reminders.', people: [], memory: [], commitments: [], questions: [] });
      const request = remindRequest.exec(input.question);
      if (request && !input.id.startsWith('retrospective:')) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: request[1]!, remind: true }] });
      return typeof answer === 'string' ? JSON.stringify({ reply: answer, memory: [], dated: [] }) : answer as string; },
    send: async () => 7, checkOutbound: () => {},
    ...(options.evidence ? { retrospectiveEvidence: options.evidence } : {}),
    retrospect: async (state: string, id: string) => { states.push(state); options.duringCall?.(id, journal);
      return { state: 'complete' as const, value: reply(state), usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true as const } }; } };
  const worker = createJournalWorker(journal, ports);
  let next = 1;
  return { root, path, journal, worker, states, contexts, modelIds, advance: (ms: number) => { now += ms; }, at: () => now,
    answerWith: (fn: (state: string) => string) => { reply = fn; }, modelAnswer: (value: unknown) => { answer = value; },
    retrospect: () => worker.retrospect(DIGEST),
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text, now))); await worker.drain(); },
    done: () => { try { journal.close(); } catch { /* closed by the test */ } rmSync(root, { recursive: true, force: true }); } };
}
const owedIds = (view: JournalView, now?: number) => eligibleCases(view, retrospectiveCases(view), now).map(item => item.id);

describe('retrospective review: delivery, bounds and durability', () => {
  it('delivers the named gravity wells and the right to stand ground in every reply packet', async () => {
    const w = world();
    try {
      await w.converse(['Hello there.']);
      const source = JSON.parse(w.contexts[0]!).sources.find((item: { id: string }) => item.id === 'working-disciplines');
      for (const well of GRAVITY_WELLS) expect(source.text).toContain(well.id);
      expect(source.text).toContain('hold a position, warmly');
      for (const duty of ['unsupported-reversal', 'waste (efficiency duty)', 'process-tier and proportionality', 'waiver-recurrence', 'benchmark-divergence'])
        expect(RETROSPECTIVE_QUESTION).toContain(duty);
    } finally { w.done(); }
  });

  it('is bounded (message threshold, hourly, reply reserve) yet makes any owed work due once it has waited a day', async () => {
    const w = world();
    try {
      await w.converse(words.slice(0, 9));
      await w.retrospect();
      expect(w.states).toHaveLength(0);
      await w.converse(words.slice(9, 10));
      await w.retrospect();
      expect(w.journal.view.retroPasses[0]).toMatchObject({ state: 'complete', pass: 0 });
      await w.converse(words.slice(10, 20));
      await w.retrospect();
      expect(w.states).toHaveLength(1);
      w.advance(RETRO_MIN_INTERVAL_MS);
      await w.retrospect();
      expect(w.states).toHaveLength(2);
      // One final correction: not due at once, due once it has waited a day (never stranded).
      await w.converse(['No, that was wrong.']);
      w.advance(RETRO_MIN_INTERVAL_MS);
      await w.retrospect();
      expect(w.states).toHaveLength(2);
      w.advance(RETRO_STALE_CASE_MS);
      await w.retrospect();
      expect(w.states).toHaveLength(3);
      expect(casesOf(w.states[2]!).map(item => item.id)).toContain(`turn:${turnId(21)}`);
    } finally { w.done(); }
    const tight = world({ calls: 13 });
    try {
      await tight.converse(words.slice(0, 10));
      await tight.retrospect();
      expect(tight.states).toHaveLength(0);
    } finally { tight.done(); }
  });

  it('counts its attempt in the trial cap and its tokens, and replays from the journal', async () => {
    const outcome = { exitCode: 0, localLimit: null, elapsedMs: 5, type: 'result' as const, subtype: 'success' as const,
      isError: false, outputTokens: 50, promptBytes: 10 };
    const w = world({ duringCall: (id, journal) => journal.append({ kind: 'call-outcome', id, role: 'model', outcome, at: start }) });
    try {
      await w.converse(words.slice(0, 10));
      const before = w.journal.view.calls;
      await w.retrospect();
      expect(w.journal.view.calls).toBe(before + 1);
      expect(w.journal.view.callOutcomes.at(-1)?.id).toBe('retrospective:0');
      expect(() => w.journal.append({ kind: 'call-outcome', id: 'retrospective:0', role: 'model', outcome, at: w.at() })).toThrow('malformed');
      const pass = w.journal.view.retroPasses[0]!;
      w.journal.close();
      const replay = openPreviewJournal(w.path, key, undefined, undefined, true);
      expect(replay.view.retroPasses).toEqual([pass]);
      expect(replay.view.calls).toBe(before + 1);
      replay.close();
    } finally { w.done(); }
  });

  it('leaves an interrupted pass UNKNOWN, never replays it, and keeps its cases owed', async () => {
    const w = world();
    try {
      await w.converse(words.slice(0, 10));
      w.journal.append({ kind: 'retro-reserve', pass: 0, turnsSeen: 6, cases: [`turn:${turnId(1)}`], omitted: [], eligible: 12,
        packetSha256: 'sha256:x', contextDigest: 'sha256:y', at: w.at() });
      await w.retrospect();
      expect(w.states).toHaveLength(0);
      expect(w.journal.view.retroPasses[0]).toMatchObject({ state: 'unknown' });
      expect(owedIds(w.journal.view)).toContain(`turn:${turnId(1)}`);
      expect(retrospectiveStatusLine(w.journal.view)).toContain('UNKNOWN outcome');
    } finally { w.done(); }
  });
});

describe('MUST-FIX 1: actual inspected/omitted accounting', () => {
  it('keeps every model-omitted case owed, before and after replay; inspected cases leave the owed set', async () => {
    const w = world();
    try {
      await w.converse(words.slice(0, 10));
      w.answerWith(state => answerFor(state, { inspected: [], grades: [],
        omitted: casesOf(state).map(item => ({ case: item.id, reason: 'deferred for later' })) }));
      await w.retrospect();
      const pass = w.journal.view.retroPasses[0]!;
      expect(pass.state).toBe('complete');
      const population = retrospectiveCases(w.journal.view).map(item => item.id);
      expect(owedIds(w.journal.view)).toEqual(population);
      expect(passAccounting(pass)).toMatchObject({ inspected: 0, omitted: pass.cases.length, eligible: pass.cases.length, complete: true });
      expect(retrospectiveStatusLine(w.journal.view)).toContain(`inspected 0 of ${String(pass.cases.length)}`);
      w.journal.close();
      const replay = openPreviewJournal(w.path, key, undefined, undefined, true);
      expect(owedIds(replay.view)).toEqual(population);
      replay.close();
    } finally { w.done(); }
    const ok = world();
    try {
      await ok.converse(words.slice(0, 10));
      ok.answerWith(state => answerFor(state, { grades: casesOf(state).filter(item => item.category === 'decision').map(item => ({ case: item.id,
        conclusion: { assessment: 'not-applicable', evidence: [] }, reason: { assessment: 'not-applicable', evidence: [] },
        outcome: { assessment: 'not-applicable', reason: 'an acknowledgement', evidence: [] }, observations: [] })) }));
      await ok.retrospect();
      expect(owedIds(ok.journal.view)).toEqual([]);
      expect(passAccounting(ok.journal.view.retroPasses[0]!)).toMatchObject({ inspected: 20, omitted: 0, complete: true });
    } finally { ok.done(); }
  });

  it('refuses a pass that leaves a supplied case unaccounted (the existing review-record decoder backs it)', () => {
    const w = world();
    try {
      const cases: RetroCase[] = [{ id: 'turn:t1', category: 'message', at: 1, seq: 0, text: 'hi' }, { id: 'turn:t2', category: 'message', at: 1, seq: 1, text: 'yo' }];
      expect(() => validateRetrospective(body(cases, { inspected: ['turn:t1'] }), { cases }, w.journal.view, 0)).toThrow('neither inspected nor omitted');
      expect(() => validateRetrospective(body(cases, { inspected: ['turn:t1'], omitted: [{ case: 'turn:t2', reason: 'later' }] }), { cases }, w.journal.view, 0)).not.toThrow();
    } finally { w.done(); }
  });
});

describe('MUST-FIX 2: owed work makes progress without new conversation', () => {
  it('re-presents an open improvement item a day later with no new messages', async () => {
    const w = world();
    try {
      await w.converse(words.slice(0, 10));
      w.answerWith(state => answerFor(state, { findings: [{ duty: 'waste', refs: [casesOf(state)[0]!.id], summary: 'Repair needed',
        disposition: { owner: 'agent', next: 'Evaluate the repair' } }] }));
      await w.retrospect();
      const view = w.journal.view;
      expect(retrospectivePlan(view, retrospectiveCases(view), w.at() + RETRO_MIN_INTERVAL_MS, DIGEST)).toBeNull();
      const plan = retrospectivePlan(view, retrospectiveCases(view), w.at() + RETRO_STALE_CASE_MS, DIGEST);
      expect(plan?.cases.map(item => item.id)).toEqual(['open:retro:0:0']);
      // Seven days on, the still-pending grades are re-presented too, so they can be closed rather than stranded.
      expect(retrospectivePlan(view, retrospectiveCases(view), w.at() + RETRO_PENDING_RECHECK_MS, DIGEST)?.cases.length).toBe(11);
    } finally { w.done(); }
  });

  it('keeps a pending grade owed beyond any count: re-presented on newer evidence, or after a bounded wait to be closed', async () => {
    const w = world();
    try {
      await w.converse(words.slice(0, 10));
      await w.retrospect();
      const answer = `answer:${turnId(1)}`;
      expect(pendingGrades(w.journal.view).length).toBe(10);
      expect(owedIds(w.journal.view)).not.toContain(answer);
      for (let round = 0; round < 4; round++) {
        await w.converse([`later ${String(round)}`]);
        w.advance(RETRO_STALE_CASE_MS);
        await w.retrospect();
        expect(casesOf(w.states.at(-1)!).map(item => item.id)).toContain(answer);
      }
      expect(latestGrades(w.journal.view).get(answer)?.grade.outcome.assessment).toBe('pending');
      expect(owedIds(w.journal.view)).not.toContain(answer);
      expect(owedIds(w.journal.view, w.at() + RETRO_PENDING_RECHECK_MS)).toContain(answer);
      // An explicit evidence-unavailable disposition closes it.
      w.advance(RETRO_PENDING_RECHECK_MS);
      w.answerWith(state => answerFor(state, { grades: casesOf(state).filter(item => item.category === 'decision').map(item => ({ case: item.id,
        conclusion: { assessment: 'unverifiable', evidence: [] }, reason: { assessment: 'not-applicable', evidence: [] },
        outcome: { assessment: 'unverifiable', reason: 'no outcome was ever reported', evidence: [] }, observations: [] })) }));
      await w.retrospect();
      expect(latestGrades(w.journal.view).get(answer)?.grade.outcome).toMatchObject({ assessment: 'unverifiable', reason: 'no outcome was ever reported' });
      expect(owedIds(w.journal.view, w.at() + RETRO_PENDING_RECHECK_MS)).not.toContain(answer);
    } finally { w.done(); }
  });
});

describe('MUST-FIX 3: feedback follow-through and proof', () => {
  it('turns owned feedback into one open improvement item delivered to the next reply, closed only by later evidence', async () => {
    const w = world();
    try {
      await w.converse(['What is 2+2?', 'Your replies are too long, keep them to two sentences.', ...words.slice(2, 10)]);
      w.answerWith(state => answerFor(state, { feedback: [{ case: `turn:${turnId(2)}`, classification: 'reply length',
        disposition: 'improvement-owned', owner: 'agent', next: 'Use exactly two sentences.' }] }));
      await w.retrospect();
      expect(w.journal.view.retroPasses[0]?.state).toBe('complete');
      expect(openFindings(w.journal.view)).toEqual([expect.objectContaining({ id: 'retro:0:feedback:0', duty: 'feedback', feedback: `turn:${turnId(2)}` })]);
      expect(disciplineSource(w.journal.view).text).toContain('Use exactly two sentences.');
      await w.converse(['How are the answers now?']);
      expect(w.contexts.at(-1)).toContain('Use exactly two sentences.');
      // Verified improvement needs the item it proves and later evidence; prose alone is refused.
      await w.converse(['Much better, thanks.', ...words.slice(11, 20)]);
      w.advance(RETRO_MIN_INTERVAL_MS);
      w.answerWith(state => answerFor(state, { feedback: [{ case: `turn:${turnId(2)}`, classification: 'reply length',
        disposition: 'verified-improvement', reason: 'I fixed it' }] }));
      await w.retrospect();
      expect(w.journal.view.retroPasses[1]).toMatchObject({ state: 'failed', reason: expect.stringContaining('names the open improvement item') });
      expect(openFindings(w.journal.view)).toHaveLength(1);
      w.advance(6 * 3_600_000);
      w.answerWith(state => answerFor(state, { feedback: [{ case: `turn:${turnId(2)}`, classification: 'reply length',
        disposition: 'verified-improvement', improvementOf: 'open:retro:0:feedback:0', evidence: [`turn:${turnId(12)}`] }] }));
      await w.retrospect();
      expect(w.journal.view.retroPasses[2]?.state).toBe('complete');
      expect(openFindings(w.journal.view)).toHaveLength(0);
      expect(feedbackDispositions(w.journal.view).find(item => item.case === `turn:${turnId(2)}`)).toMatchObject({ disposition: 'verified-improvement',
        evidence: [`turn:${turnId(12)}`] });
      expect(w.journal.view.retroPasses[2]?.result?.closures).toEqual([{ finding: 'retro:0:feedback:0', outcome: 'improved', evidence: [`turn:${turnId(12)}`] }]);
    } finally { w.done(); }
  });

  it('keeps the rest of the feedback contract: decline needs a reason, ownership needs owner and next, and the decoder refuses proofless verification', () => {
    const w = world();
    try {
      const cases: RetroCase[] = [{ id: 'turn:t2', category: 'message', at: 1, seq: 1, text: 'It broke.' }];
      const fb = (entry: Record<string, unknown>) => () => validateRetrospective(body(cases, { feedback: [{ case: 'turn:t2', classification: 'failure report', ...entry }] }),
        { cases }, w.journal.view, 0);
      expect(fb({ disposition: 'declined-with-reason' })).toThrow('feedback reason');
      expect(fb({ disposition: 'improvement-owned' })).toThrow('feedback owner');
      expect(fb({ disposition: 'duplicate-linked', duplicateOf: 'turn:t2' })()).toMatchObject({ feedback: [{ duplicateOf: 'turn:t2' }] });
      expect(() => feedbackRecordOf({ case: 'turn:t2', classification: 'x', disposition: 'verified-improvement' }, 0, 0, 'main'))
        .toThrow('verified improvement requires run exit and proof');
      const corrected: RetroCase[] = [{ id: 'turn:t3', category: 'message', at: 1, seq: 2, text: 'No, Ana.', meta: { correction: 'correct' } }];
      expect(() => validateRetrospective(body(corrected), { cases: corrected }, w.journal.view, 0)).toThrow('recorded correction');
    } finally { w.done(); }
  });
});

describe('MUST-FIX 4: complete, separately supported grades', () => {
  const cases: RetroCase[] = [
    { id: 'turn:t1', category: 'message', at: 100, seq: 0, text: 'Should I buy it?' },
    { id: 'answer:t1', category: 'decision', at: 100, seq: 0, text: 'Yes.', reason: 'Reviews are good.', followUps: [{ ref: 'turn:t2', seq: 1, text: 'It broke.' }] },
    { id: 'turn:t2', category: 'message', at: 100, seq: 1, text: 'It broke.' },
    { id: 'verdict:t1:0', category: 'verdict', at: 100, seq: 0, text: 'verdict pass', reason: 'grounded in the manual' },
  ];
  const check = (extra: Record<string, unknown>, view: JournalView) => () => validateRetrospective(body(cases, extra), { cases }, view, 0);
  const grade = (fields: Record<string, unknown>, target = 'answer:t1') => ({ grades: body(cases).grades.map(item => item.case === target ? { ...item, ...fields } : item) });

  it('refuses a pass that grades no decisions, and grades failed answers too', async () => {
    const w = world();
    try {
      expect(check({ grades: [] }, w.journal.view)).toThrow('was not graded or deferred');
      expect(check({ grades: body(cases).grades.filter(item => item.case !== 'verdict:t1:0') }, w.journal.view)).toThrow('verdict case was not graded');
      w.modelAnswer({ state: 'rejected', failureClass: 'rejected' });
      await w.converse(['What now?']);
      const decision = retrospectiveCases(w.journal.view).find(item => item.id === `answer:${turnId(1)}`);
      expect(decision).toMatchObject({ category: 'decision', meta: { state: 'rejected' } });
      expect(decision?.text).toContain('no answer');
    } finally { w.done(); }
  });

  it('keeps conclusion, reason and outcome as separate claims with their own evidence; observation is never proof', () => {
    const w = world();
    try {
      const view = w.journal.view;
      expect(check(grade({ reason: { assessment: 'not-applicable', evidence: [] } }), view)).toThrow('stated reason is assessed separately');
      expect(check(grade({ conclusion: { assessment: 'supported', evidence: [] } }), view)).toThrow('conclusion assessment needs its own evidence');
      expect(check(grade({ outcome: { assessment: 'pending', reason: '', evidence: [] } }), view)).toThrow('deferred or unavailable outcome needs its reason');
      expect(check(grade({ outcome: { assessment: 'unmet', reason: 'broke', evidence: ['turn:t1'] } }), view)).toThrow('later evidence');
      expect(check(grade({ outcome: { assessment: 'met', reason: 'x', evidence: ['turn:t2'] }, observations: [{ by: 'operator', kind: 'complied', ref: 'turn:t2' }] }), view))
        .toThrow('attributed observation');
      const accepted = check(grade({ conclusion: { assessment: 'contradicted', evidence: ['turn:t2'] }, reason: { assessment: 'contradicted', evidence: ['turn:t2'] },
        outcome: { assessment: 'unmet', reason: 'it broke', evidence: ['turn:t2'] }, rederivation: { conclusion: 'changed', reason: 'reliability data says no' },
        promote: 'Purchase advice later contradicted by breakage.', observations: [{ by: 'operator', kind: 'complied', ref: 'turn:t1' }] }), view)();
      expect(accepted.grades[0]).toMatchObject({ conclusion: { assessment: 'contradicted', evidence: ['turn:t2'] },
        reason: { assessment: 'contradicted', evidence: ['turn:t2'] }, outcome: { assessment: 'unmet' }, rederivation: { conclusion: 'changed' } });
      expect(check(grade({ reason: { assessment: 'contradicted', evidence: ['turn:t2'] } }, 'verdict:t1:0'), view)).toThrow('rederivation');
    } finally { w.done(); }
  });

  it('keeps a long answer\'s stated reason (the live Decision reason) whole beside the conclusion', async () => {
    const w = world();
    try {
      w.journal.close();
      const journal = openPreviewJournal(join(w.root, 'reason.encrypted'), key, genesis);
      const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, send: async () => 3, checkOutbound: () => {},
        model: async () => ({ state: 'complete' as const, text: 'x'.repeat(650), reason: 'The independently falsifiable reason',
          usage: { inputTokens: 1, outputTokens: 1, charge: null } }) });
      worker.intake([update(1, 'Which bus?')]); await worker.drain();
      expect(journal.view.order[0]?.answerReason).toBe('The independently falsifiable reason');
      const decision = retrospectivePopulation(journal.view, operator()).find(item => item.id === `answer:${turnId(1)}`);
      expect(decision?.reason).toBe('The independently falsifiable reason');
      expect(decision?.text.length).toBeLessThanOrEqual(601);
      journal.close();
    } finally { w.done(); }
  });

  it('reopens a settled grade when a later outcome arrives in a later pass', async () => {
    const w = world();
    try {
      await w.converse(['Which bus should I take?', ...words.slice(1, 10)]);
      const answer = `answer:${turnId(1)}`;
      w.answerWith(state => answerFor(state, { grades: casesOf(state).filter(item => item.category === 'decision').map(item => ({ case: item.id,
        conclusion: { assessment: 'unverifiable', evidence: [] }, reason: { assessment: 'not-applicable', evidence: [] },
        outcome: { assessment: 'unverifiable', reason: 'no report expected', evidence: [] }, observations: [] })) }));
      await w.retrospect();
      await w.converse(['By the way, the bus you suggested never came.']);
      w.advance(RETRO_STALE_CASE_MS);
      let packet: { priorGrades: { case: string }[] } | undefined;
      w.answerWith(state => { packet = JSON.parse(state); return answerFor(state, { grades: [...body(casesOf(state)).grades, { case: answer,
        conclusion: { assessment: 'contradicted', evidence: [`turn:${turnId(11)}`] }, reason: { assessment: 'not-applicable', evidence: [] },
        outcome: { assessment: 'unmet', reason: 'bus never came', evidence: [`turn:${turnId(11)}`] }, observations: [] }] }); });
      await w.retrospect();
      expect(packet?.priorGrades.map(item => item.case)).toContain(answer);
      expect(w.journal.view.retroPasses[1]?.state).toBe('complete');
      expect(latestGrades(w.journal.view).get(answer)?.grade).toMatchObject({ reassessment: true, outcome: { assessment: 'unmet' } });
    } finally { w.done(); }
  });
});

describe('MUST-FIX 5: authorization scope and cross-pass recurrence', () => {
  it('carries the whole source scope (never a shortened excerpt) and judges recurrence against an earlier pass\'s authorization', async () => {
    const w = world();
    try {
      await w.converse(['remind me Friday to water the plants on Friday', ...words.slice(1, 10)]);
      const first = retrospectiveCases(w.journal.view).find(item => item.category === 'authorization')!;
      w.answerWith(state => answerFor(state, { authorizations: [{ case: first.id, candidate: true, recurrences: [], excerpt: 'remind me Friday to water the plants on Friday and Monday' }] }));
      await w.retrospect();
      expect(w.journal.view.retroPasses[0]).toMatchObject({ state: 'failed', reason: expect.stringContaining('exceeds its source') });
      w.advance(6 * 3_600_000);
      w.answerWith(state => answerFor(state, { authorizations: [{ case: first.id, candidate: true, recurrences: [], excerpt: 'water the plants' }] }));
      await w.retrospect();
      const [candidate] = standingGrantCandidates(w.journal.view);
      expect(candidate).toMatchObject({ case: first.id, presentable: false, excerpt: 'water the plants',
        scope: { kind: 'reminder', quote: 'remind me Friday to water the plants on Friday', restrictions: { when: 'Friday' } } });
      // A later pass sees the earlier authorization and may cite it; P-10 then presents the candidate.
      w.advance(3 * 86_400_000);
      await w.converse(['remind me Friday to water the plants on Friday, please']);
      w.advance(RETRO_STALE_CASE_MS);
      let prior: string[] = [];
      w.answerWith(state => { prior = (JSON.parse(state) as { priorAuthorizations: { id: string }[] }).priorAuthorizations.map(item => item.id);
        const second = casesOf(state).find(item => item.category === 'authorization')!;
        return answerFor(state, { authorizations: [{ case: second.id, candidate: true, recurrences: [first.id] }] }); });
      await w.retrospect();
      expect(prior).toContain(first.id);
      const presented = standingGrantCandidates(w.journal.view).filter(item => item.presentable);
      expect(presented).toHaveLength(1);
      expect(disciplineSource(w.journal.view).text).toContain('"remind me Friday to water the plants on Friday, please" (when: Friday)');
      expect(w.journal.view.summaryGrants).toHaveLength(0);
    } finally { w.done(); }
  });
});

describe('MUST-FIX 6: every duty accounted, sibling evidence through a typed seam', () => {
  it('refuses a missing duty disposition and records waiver recurrence unavailable without producer evidence', async () => {
    const w = world();
    try {
      await w.converse(words.slice(0, 10));
      w.answerWith(state => { const answer = body(casesOf(state)); answer.duties = answer.duties.filter(item => item.duty !== 'workaround'); return JSON.stringify(answer); });
      await w.retrospect();
      expect(w.journal.view.retroPasses[0]).toMatchObject({ state: 'failed', reason: expect.stringContaining('duty workaround') });
      expect(owedIds(w.journal.view).length).toBe(retrospectiveCases(w.journal.view).length);
      w.advance(6 * 3_600_000);
      let packet: { waiverEvidence: unknown } | undefined;
      w.answerWith(state => { packet = JSON.parse(state); return answerFor(state); });
      await w.retrospect();
      expect(packet?.waiverEvidence).toBe(WAIVER_EVIDENCE_UNAVAILABLE);
      const duties = w.journal.view.retroPasses[1]!.result!.duties;
      expect(duties).toHaveLength(RETROSPECTIVE_DUTIES.length);
      expect(duties.find(item => item.duty === 'waiver-recurrence')).toMatchObject({ disposition: 'unavailable' });
      expect(duties.filter(item => item.disposition === 'inspected')).toHaveLength(RETROSPECTIVE_DUTIES.length - 1);
      expect(retrospectiveStatusLine(w.journal.view)).toContain('duties not inspected for lack of evidence: waiver-recurrence');
    } finally { w.done(); }
  });

  it('consumes waiver evidence through waiverReview when a producer supplies it', async () => {
    const w = world({ evidence: () => ({ waivers: { authorizations: [], acts: [{ id: 'act:1', rule: '26', scope: 'x', at: 5, predecessors: [] }] } }) });
    try {
      await w.converse(words.slice(0, 10));
      let packet: { waiverEvidence: unknown } | undefined;
      w.answerWith(state => { packet = JSON.parse(state); return answerFor(state); });
      await w.retrospect();
      expect(packet?.waiverEvidence).toEqual({ waivers: 0, linkedActs: 0, unusedWaivers: [], actsWithoutPriorWaiver: ['act:1'] });
      expect(w.journal.view.retroPasses[0]!.result!.duties.find(item => item.duty === 'waiver-recurrence')).toMatchObject({ disposition: 'inspected' });
    } finally { w.done(); }
  });

  it('opens owned root-cause work with a structural-remedy decision for a recurrence', async () => {
    const w = world();
    try {
      await w.converse(words.slice(0, 10));
      const recurrence = { duty: 'recurrence', refs: [`turn:${turnId(3)}`], recurs: [`turn:${turnId(1)}`],
        summary: 'Same misunderstanding twice.', rootCause: 'The packet omits the earlier correction.' };
      w.answerWith(state => answerFor(state, { findings: [{ ...recurrence, disposition: { declined: 'isolated' }, structuralRemedy: { none: 'rare' } }] }));
      await w.retrospect();
      expect(w.journal.view.retroPasses[0]?.reason).toContain('owned root-cause');
      w.advance(6 * 3_600_000);
      w.answerWith(state => answerFor(state, { findings: [{ ...recurrence, disposition: { owner: 'agent', next: 'Carry corrections.' },
        structuralRemedy: { remove: 'the need to restate a correction each time' } }] }));
      await w.retrospect();
      expect(openFindings(w.journal.view)[0]).toMatchObject({ duty: 'recurrence', structuralRemedy: { remove: 'the need to restate a correction each time' } });
    } finally { w.done(); }
  });
});

describe('MUST-FIX 7: benchmark promotion, rerun and comparison bound to the real reply configuration', () => {
  it('binds the compatibility digest to the actual reply inputs', async () => {
    const w = world();
    try {
      const view = w.journal.view;
      expect(replyContextDigest(view)).toBe(replyContextDigest(view));
      expect(replyContextDigest({ ...view, genesis: { ...view.genesis, configurationDigest: 'sha256:other-model' } })).not.toBe(replyContextDigest(view));
    } finally { w.done(); }
  });

  it('reruns a promoted case through the live reply assembly after a configuration change and records the comparison', async () => {
    const outcome = { exitCode: 0, localLimit: null, elapsedMs: 5, type: 'result' as const, subtype: 'success' as const,
      isError: false, outputTokens: 5, promptBytes: 10 };
    const w = world();
    try {
      await w.converse(['Which bus should I take?', 'That bus did not run today.', ...words.slice(2, 10)]);
      w.answerWith(state => answerFor(state, { grades: body(casesOf(state)).grades.map(item => item.case === `answer:${turnId(1)}`
        ? { ...item, outcome: { assessment: 'unmet', reason: 'did not run', evidence: [`turn:${turnId(2)}`] }, promote: 'Transit advice contradicted by the next message.' } : item) }));
      await w.retrospect();
      expect(promotedCases(w.journal.view)).toEqual([expect.objectContaining({ expected: 'unmet',
        provenance: { pass: 0, case: `answer:${turnId(1)}`, evidence: [`turn:${turnId(2)}`], contextDigest: DIGEST } })]);
      // Same configuration: nothing to rerun, no pass due.
      w.advance(RETRO_MIN_INTERVAL_MS);
      await w.worker.retrospect(DIGEST);
      expect(w.states).toHaveLength(1);
      // Changed configuration: the rerun alone makes a pass due, runs the original question, and counts one attempt.
      const calls = w.journal.view.calls;
      w.modelAnswer('Take the 10 bus; the 9 is not running today.');
      const seen = w.modelIds.length;
      await w.worker.retrospect('sha256:config-b');
      expect(w.modelIds.slice(seen)).toEqual(['retrospective:1:rerun:0']);
      expect(w.journal.view.calls).toBe(calls + 2);
      expect(() => w.journal.append({ kind: 'call-outcome', id: 'retrospective:1:rerun:0', role: 'model', outcome, at: w.at() })).toThrow('malformed');
      expect(benchmarkReruns(w.journal.view)).toEqual([expect.objectContaining({ id: 'rerun:1:0', state: 'complete', comparison: null })]);
      expect(retrospectiveStatusLine(w.journal.view, 'sha256:config-b')).toContain('reruns 1 (0 regressed)');
      // The next pass must compare the rerun with the original graded outcome.
      w.advance(RETRO_STALE_CASE_MS);
      w.answerWith(state => answerFor(state, { comparisons: [] }));
      await w.worker.retrospect('sha256:config-b');
      expect(w.journal.view.retroPasses[2]).toMatchObject({ state: 'failed', reason: expect.stringContaining('not compared') });
      w.advance(6 * 3_600_000);
      w.answerWith(state => answerFor(state, { comparisons: [{ case: 'rerun:1:0', verdict: 'improved', reason: 'now avoids the cancelled bus' }] }));
      await w.worker.retrospect('sha256:config-b');
      expect(benchmarkReruns(w.journal.view)[0]?.comparison).toMatchObject({ verdict: 'improved' });
      const passes = w.journal.view.retroPasses;
      w.journal.close();
      const replay = openPreviewJournal(w.path, key, undefined, undefined, true);
      expect(replay.view.retroPasses).toEqual(passes);
      replay.close();
    } finally { w.done(); }
  });
});

it('marks a message the journal recorded as a memory correction so the review must dispose of it', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-correction-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false, send: async () => 3, checkOutbound: () => {},
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      model: async (input: { id: string; context: string }) => {
        if (!input.id.startsWith('summary:')) return 'Understood.';
        const packet = JSON.parse(input.context);
        const source = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('East Pier'));
        return JSON.stringify({ summary: 'The cedar trail starts at West Pier.', people: [], memory: [{ mode: 'correct',
          source: source.id, quote: 'The cedar trail starts at East Pier.', replacement: 'the cedar trail starts at West Pier.' }] });
      } });
    worker.intake([update(1, 'The cedar trail starts at East Pier.')]); await worker.drain();
    worker.intake([update(2, 'Actually, the cedar trail starts at West Pier.')]); await worker.drain();
    await worker.summarizeIfNeeded();
    expect(journal.view.memory).toHaveLength(1);
    const marked = retrospectivePopulation(journal.view, operator()).filter(item => item.meta?.correction !== undefined).map(item => item.id);
    expect(marked).toEqual([`turn:${journal.view.memory[0]!.trigger}`]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
