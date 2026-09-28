import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETRO_MIN_INTERVAL_MS, RETROSPECTIVE_QUESTION, disciplineSource, eligibleCases, openFindings,
  promotedCases, retrospectivePopulation, retrospectiveStatusLine, standingGrantCandidates, validateRetrospective,
  type RetroCase } from './retrospective.js';

const key = new Uint8Array(32).fill(21);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 60, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, date = 1_000 + id) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date, text } });
const words = Array.from({ length: 20 }, (_, index) => `message ${String(index + 1)}`);
const turnId = (n: number) => `telegram:12345678:update:${String(n)}`;
const operator = (view: JournalView) => (turn: JournalView['order'][number]) => turn.accepted && !turn.requestedSummary;

/** A complete, valid review answer for whatever cases the pass supplied. */
function answerFor(state: string, extra: Record<string, unknown> = {}) {
  const cases = (JSON.parse(state) as { cases: RetroCase[] }).cases;
  return JSON.stringify({ inspected: cases.map(item => item.id), omitted: [],
    gravityWells: GRAVITY_WELLS.map(well => ({ well: well.id, observed: false, refs: [], note: 'not seen' })),
    efficiency: { summary: 'No wasted attempts found in this window.' },
    findings: [], feedback: [], closures: [],
    grades: cases.filter(item => /^(answer|verdict):/u.test(item.id)).map(item => ({ case: item.id, conclusion: 'unverifiable',
      reason: 'unverifiable', outcome: 'pending', evidence: [], observations: [] })),
    authorizations: cases.filter(item => item.category === 'authorization').map(item => ({ case: item.id, recurrences: [], candidateScope: null })),
    ...extra });
}

function world(options: { calls?: number; duringCall?: (id: string, journal: ReturnType<typeof openPreviewJournal>) => void } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { ...genesis, maxCalls: options.calls ?? genesis.maxCalls });
  let now = 10_000;
  const states: string[] = [], contexts: string[] = [];
  let reply: (state: string) => string = state => answerFor(state);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    sources: () => [disciplineSource(journal.view)],
    model: async input => { contexts.push(input.context); return 'Noted.'; },
    send: async () => 7, checkOutbound: () => {},
    retrospect: async (state, id) => { states.push(state); options.duringCall?.(id, journal); return { state: 'complete', value: reply(state), usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true } }; } });
  return { root, path, journal, worker, states, contexts, advance: (ms: number) => { now += ms; }, at: () => now,
    answerWith: (fn: (state: string) => string) => { reply = fn; }, done: () => rmSync(root, { recursive: true, force: true }) };
}
const converse = async (w: ReturnType<typeof world>, texts: string[], first = 1) => {
  w.worker.intake(texts.map((text, index) => update(first + index, text))); await w.worker.drain();
};

describe('retrospective review (Rules 16, 19, 24, 25, 50, 51, 58, 85, 104, 108)', () => {
  it('delivers the named gravity wells and the right to stand ground in every reply packet', async () => {
    const w = world();
    try {
      await converse(w, ['Hello there.']);
      const source = JSON.parse(w.contexts[0]!).sources.find((item: { id: string }) => item.id === 'working-disciplines');
      for (const well of GRAVITY_WELLS) expect(source.text).toContain(well.id);
      expect(source.text).toContain('hold a position, warmly');
      expect(RETROSPECTIVE_QUESTION).toContain('unsupported-reversal');
      expect(RETROSPECTIVE_QUESTION).toContain('waste (efficiency duty)');
    } finally { w.done(); }
  });

  it('is bounded: waits for enough cases, keeps a reply reserve and runs at most hourly', async () => {
    const w = world();
    try {
      await converse(w, words.slice(0, 9));
      await w.worker.retrospect();
      expect(w.states).toHaveLength(0);
      await converse(w, words.slice(9, 10), 10);
      await w.worker.retrospect();
      expect(w.states).toHaveLength(1);
      expect(w.journal.view.retroPasses[0]).toMatchObject({ state: 'complete', pass: 0 });
      await converse(w, words.slice(10, 20), 11);
      await w.worker.retrospect();
      expect(w.states).toHaveLength(1);
      w.advance(RETRO_MIN_INTERVAL_MS);
      await w.worker.retrospect();
      expect(w.states).toHaveLength(2);
      // A small backlog waits (owed, not dropped) until it is a day old and has three messages.
      await converse(w, ['late one', 'late two'], 21);
      w.advance(24 * 3_600_000);
      await w.worker.retrospect();
      expect(w.states).toHaveLength(2);
      await converse(w, ['late three'], 23);
      await w.worker.retrospect();
      expect(w.states).toHaveLength(3);
    } finally { w.done(); }
    const tight = world({ calls: 13 });
    try {
      await converse(tight, words.slice(0, 10));
      await tight.worker.retrospect();
      expect(tight.states).toHaveLength(0);
    } finally { tight.done(); }
  });

  it('counts its attempt in the trial cap and its tokens, and replays from the journal', async () => {
    const outcome = { exitCode: 0, localLimit: null, elapsedMs: 5, type: 'result' as const, subtype: 'success' as const,
      isError: false, outputTokens: 50, promptBytes: 10 };
    const w = world({ duringCall: (id, journal) => journal.append({ kind: 'call-outcome', id, role: 'model', outcome, at: 10_000 }) });
    try {
      await converse(w, words.slice(0, 10));
      const before = w.journal.view.calls;
      await w.worker.retrospect();
      expect(w.journal.view.calls).toBe(before + 1);
      expect(w.journal.view.callOutcomes.at(-1)?.id).toBe('retrospective:0');
      // After its result, the same operation id can no longer claim a physical call.
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
      await converse(w, words.slice(0, 10));
      w.journal.append({ kind: 'retro-reserve', pass: 0, turnsSeen: 6, cases: [`turn:${turnId(1)}`], omitted: [], eligible: 12,
        packetSha256: 'sha256:x', contextDigest: 'sha256:y', at: w.at() });
      await w.worker.retrospect();
      expect(w.states).toHaveLength(0);
      expect(w.journal.view.retroPasses[0]).toMatchObject({ state: 'unknown' });
      const population = retrospectivePopulation(w.journal.view, operator(w.journal.view));
      expect(eligibleCases(w.journal.view, population).map(item => item.id)).toContain(`turn:${turnId(1)}`);
      expect(retrospectiveStatusLine(w.journal.view)).toContain('UNKNOWN outcome');
    } finally { w.done(); }
  });

  it('refuses an answer that leaves a gravity well unjudged, and those cases stay owed', async () => {
    const w = world();
    try {
      await converse(w, words.slice(0, 10));
      w.answerWith(state => { const body = JSON.parse(answerFor(state)); body.gravityWells.pop(); return JSON.stringify(body); });
      await w.worker.retrospect();
      expect(w.journal.view.retroPasses[0]).toMatchObject({ state: 'failed', reason: expect.stringContaining('gravity well') });
      const population = retrospectivePopulation(w.journal.view, operator(w.journal.view));
      expect(eligibleCases(w.journal.view, population).length).toBe(population.length);
    } finally { w.done(); }
  });

  it('records general feedback dispositions, owned findings and their evaluated outcome, and feeds them to the next reply', async () => {
    const w = world();
    try {
      await converse(w, ['What is 2+2?', 'That reply was far too long; keep answers short.', ...words.slice(2, 10)]);
      w.answerWith(state => answerFor(state, {
        feedback: [{ case: `turn:${turnId(2)}`, classification: 'behavior: reply length', disposition: 'improvement-owned',
          owner: 'agent', next: 'Keep ordinary answers under three sentences.' }],
        findings: [{ duty: 'waste', refs: [`answer:${turnId(1)}`], summary: 'Long replies spent the reply budget.',
          disposition: { owner: 'agent', next: 'Keep ordinary answers under three sentences.' } }] }));
      await w.worker.retrospect();
      expect(w.journal.view.retroPasses[0]?.state).toBe('complete');
      const [finding] = openFindings(w.journal.view);
      expect(finding).toMatchObject({ duty: 'waste', id: 'retro:0:0' });
      await converse(w, ['How are the answers now?'], 11);
      expect(w.contexts.at(-1)).toContain('Long replies spent the reply budget.');
      // The owned item stays open until a later pass cites later evidence of improvement.
      await converse(w, ['Much better, thanks.', ...words.slice(11, 20)], 12);
      w.advance(RETRO_MIN_INTERVAL_MS);
      w.answerWith(state => answerFor(state, { closures: [{ finding: 'retro:0:0', outcome: 'improved', evidence: [] }] }));
      await w.worker.retrospect();
      expect(w.journal.view.retroPasses[1]).toMatchObject({ state: 'failed', reason: expect.stringContaining('evidence after') });
      expect(openFindings(w.journal.view)).toHaveLength(1);
      w.advance(6 * 3_600_000);
      w.answerWith(state => answerFor(state, { closures: [{ finding: 'retro:0:0', outcome: 'improved', evidence: [`turn:${turnId(12)}`] }] }));
      await w.worker.retrospect();
      expect(w.journal.view.retroPasses[2]?.reason ?? 'complete').toBe('complete');
      expect(openFindings(w.journal.view)).toHaveLength(0);
    } finally { w.done(); }
  });

  it('opens owned root-cause work with a structural-remedy decision for a recurrence', async () => {
    const w = world();
    try {
      await converse(w, words.slice(0, 10));
      const recurrence = { duty: 'recurrence', refs: [`turn:${turnId(3)}`], recurs: [`turn:${turnId(1)}`],
        summary: 'Same misunderstanding twice.', rootCause: 'The packet omits the earlier correction.' };
      w.answerWith(state => answerFor(state, { findings: [{ ...recurrence, disposition: { declined: 'isolated' },
        structuralRemedy: { none: 'rare' } }] }));
      await w.worker.retrospect();
      expect(w.journal.view.retroPasses[0]?.reason).toContain('owned root-cause');
      w.advance(6 * 3_600_000);
      w.answerWith(state => answerFor(state, { findings: [{ ...recurrence, disposition: { owner: 'agent', next: 'Carry corrections.' } }] }));
      await w.worker.retrospect();
      expect(w.journal.view.retroPasses[1]?.reason).toContain('structural remedy');
      w.advance(6 * 3_600_000);
      w.answerWith(state => answerFor(state, { findings: [{ ...recurrence, disposition: { owner: 'agent', next: 'Carry corrections.' },
        structuralRemedy: { remove: 'the need to restate a correction each time' } }] }));
      await w.worker.retrospect();
      expect(openFindings(w.journal.view)[0]).toMatchObject({ duty: 'recurrence',
        structuralRemedy: { remove: 'the need to restate a correction each time' } });
    } finally { w.done(); }
  });
});

it('keeps the live answer\'s stated reason beside its conclusion so the review can refute it separately (Rule 108)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-reason-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 5, stopped: () => false, send: async () => 3, checkOutbound: () => {},
      model: async () => ({ state: 'complete' as const, text: 'Take the 9 bus.', reason: 'The timetable lists it hourly.',
        usage: { inputTokens: 1, outputTokens: 1, charge: null } }) });
    worker.intake([update(1, 'Which bus?')]); await worker.drain();
    expect(journal.view.order[0]?.answerReason).toBe('The timetable lists it hourly.');
    const decision = retrospectivePopulation(journal.view, operator(journal.view)).find(item => item.id === `answer:${turnId(1)}`);
    expect(decision?.text).toContain('[stated reason] The timetable lists it hourly.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
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
    const population = retrospectivePopulation(journal.view, operator(journal.view));
    const marked = population.filter(item => item.meta?.correction !== undefined).map(item => item.id);
    expect(marked).toEqual([`turn:${journal.view.memory[0]!.trigger}`]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

describe('deterministic acceptance of graded judgments', () => {
  const setup = () => {
    const w = world();
    return w;
  };
  const cases: RetroCase[] = [
    { id: 'turn:t1', category: 'message', at: 100, seq: 0, text: 'Should I buy it?' },
    { id: 'answer:t1', category: 'decision', at: 100, seq: 0, text: 'Yes.', followUps: [{ ref: 'turn:t2', seq: 1, text: 'It broke.' }] },
    { id: 'turn:t2', category: 'message', at: 100, seq: 1, text: 'It broke.' },
    { id: 'verdict:t1:0', category: 'verdict', at: 100, seq: 0, text: 'verdict pass; reason: grounded in the manual' },
    { id: 'auth:reminder:aaa', category: 'authorization', at: 100, seq: 0, text: 'remind me to water the plants on Friday',
      meta: { kind: 'reminder' } },
  ];
  const base = () => JSON.parse(answerFor(JSON.stringify({ cases }))) as Record<string, unknown> & { grades: Record<string, unknown>[];
    authorizations: Record<string, unknown>[]; feedback: unknown[] };
  const check = (body: unknown, view: JournalView) => () => validateRetrospective(body, { cases }, view, 0);

  it('grades a later outcome only on later evidence, never on an attributed compliance', () => {
    const w = setup();
    try {
      const view = w.journal.view;
      const grade = (fields: Record<string, unknown>) => { const body = base();
        body.grades = body.grades.map(item => item.case === 'answer:t1' ? { ...item, ...fields } : item); return body; };
      expect(check(grade({ outcome: 'unmet', evidence: [] }), view)).toThrow('later evidence');
      expect(check(grade({ outcome: 'unmet', evidence: ['turn:t1'] }), view)).toThrow('later evidence');
      expect(check(grade({ outcome: 'met', evidence: ['turn:t2'], observations: [{ by: 'operator', kind: 'complied', ref: 'turn:t2' }] }), view))
        .toThrow('attributed observation');
      const accepted = check(grade({ outcome: 'unmet', evidence: ['turn:t2'], promote: 'Purchase advice later contradicted by breakage.',
        observations: [{ by: 'operator', kind: 'complied', ref: 'turn:t1' }] }), view)();
      expect(accepted.grades[0]).toMatchObject({ outcome: 'unmet', observations: [{ by: 'operator', kind: 'complied' }] });
      expect(check(grade({ outcome: 'pending', promote: 'x' }), view)).toThrow('only a graded case');
    } finally { w.done(); }
  });

  it('requires a re-derivation when a verdict reason is refuted, even if the conclusion stands', () => {
    const w = setup();
    try {
      const verdict = (fields: Record<string, unknown>) => { const body = base();
        body.grades = body.grades.map(item => item.case === 'verdict:t1:0' ? { ...item, ...fields } : item); return body; };
      expect(check(verdict({ conclusion: 'supported', reason: 'contradicted' }), w.journal.view)).toThrow('rederivation');
      const ok = check(verdict({ conclusion: 'supported', reason: 'contradicted',
        rederivation: { conclusion: 'stands', reason: 'grounded in the operator message, not the manual' } }), w.journal.view)();
      expect(ok.grades.find(item => item.case === 'verdict:t1:0')?.rederivation?.conclusion).toBe('stands');
      const missing = base(); missing.grades = missing.grades.filter(item => item.case !== 'verdict:t1:0');
      expect(check(missing, w.journal.view)).toThrow('verdict case was not graded');
    } finally { w.done(); }
  });

  it('reviews every authorization as a standing-grant candidate that never widens or grants itself', () => {
    const w = setup();
    try {
      const auth = (fields: Record<string, unknown>) => { const body = base(); body.authorizations = [{ case: 'auth:reminder:aaa', recurrences: [], candidateScope: null, ...fields }]; return body; };
      const skipped = base(); skipped.authorizations = [];
      expect(check(skipped, w.journal.view)).toThrow('standing-grant candidate');
      expect(check(auth({ candidateScope: 'remind me to water every plant daily' }), w.journal.view)).toThrow('exceeds its source');
      expect(check(auth({ recurrences: ['auth:summary:zzz'] }), w.journal.view)).toThrow('same kind');
      const accepted = check(auth({ candidateScope: 'remind me to water the plants' }), w.journal.view)();
      // No recorded recurrence within the P-10 window: reviewed, but not presented.
      expect(accepted.authorizations[0]).toEqual({ case: 'auth:reminder:aaa', recurrences: [],
        candidateScope: 'remind me to water the plants', presentable: false });
      expect(w.journal.view.summaryGrants).toHaveLength(0);
    } finally { w.done(); }
  });

  it('requires a reason to decline feedback and an owner and next step to own it', () => {
    const w = setup();
    try {
      const fb = (entry: Record<string, unknown>) => { const body = base(); body.feedback = [{ case: 'turn:t2', classification: 'failure report', ...entry }]; return body; };
      expect(check(fb({ disposition: 'declined-with-reason' }), w.journal.view)).toThrow('feedback reason');
      expect(check(fb({ disposition: 'improvement-owned' }), w.journal.view)).toThrow('feedback owner');
      expect(check(fb({ disposition: 'improvement-owned', owner: 'agent', next: 'Check product reviews first.' }), w.journal.view)().feedback)
        .toEqual([{ case: 'turn:t2', classification: 'failure report', disposition: 'improvement-owned', owner: 'agent', next: 'Check product reviews first.' }]);
      const uncited = base(); (uncited as Record<string, unknown>).findings = [{ duty: 'workaround', refs: ['turn:nope'], summary: 's',
        disposition: { owner: 'agent', next: 'n' } }];
      expect(check(uncited, w.journal.view)).toThrow('unknown record');
      const unaccounted = base(); (unaccounted as Record<string, unknown>).inspected = ['turn:t1'];
      expect(check(unaccounted, w.journal.view)).toThrow('neither inspected nor omitted');
    } finally { w.done(); }
  });

  it('refuses a pass that leaves a recorded correction without a feedback disposition (Rule 85 floor)', () => {
    const w = setup();
    try {
      const corrected: RetroCase[] = [...cases, { id: 'turn:t3', category: 'message', at: 100, seq: 2, text: 'No, my sister is Ana, not Ann.',
        meta: { correction: 'correct' } }];
      const body = JSON.parse(answerFor(JSON.stringify({ cases: corrected }))) as Record<string, unknown>;
      expect(() => validateRetrospective(body, { cases: corrected }, w.journal.view, 0)).toThrow('recorded correction');
      body.feedback = [{ case: 'turn:t3', classification: 'memory correction', disposition: 'verified-improvement',
        reason: 'Memory now records Ana.' }];
      expect(validateRetrospective(body, { cases: corrected }, w.journal.view, 0).feedback).toHaveLength(1);
      // An ordinary message without a recorded correction may be simply inspected.
      expect(validateRetrospective(JSON.parse(answerFor(JSON.stringify({ cases }))), { cases }, w.journal.view, 0).feedback).toEqual([]);
    } finally { w.done(); }
  });

  it('exposes promoted real cases with provenance and reports proof of running in status', async () => {
    const w = world();
    try {
      await converse(w, ['Which bus should I take?', 'That bus did not run today.', ...words.slice(2, 10)]);
      w.answerWith(state => { const body = JSON.parse(answerFor(state));
        body.grades = body.grades.map((item: { case: string }) => item.case === `answer:${turnId(1)}`
          ? { ...item, outcome: 'unmet', evidence: [`turn:${turnId(2)}`], promote: 'Transit advice contradicted by the next message.' } : item);
        return JSON.stringify(body); });
      await w.worker.retrospect();
      expect(w.journal.view.retroPasses[0]?.reason ?? 'complete').toBe('complete');
      expect(promotedCases(w.journal.view)).toEqual([{ scenario: 'Transit advice contradicted by the next message.', expected: 'unmet',
        provenance: { pass: 0, case: `answer:${turnId(1)}`, evidence: [`turn:${turnId(2)}`], contextDigest: expect.stringMatching(/^sha256:/u) } }]);
      const line = retrospectiveStatusLine(w.journal.view, 'sha256:changed');
      expect(line).toContain('1 completed pass(es)');
      expect(line).toContain('efficiency duty ran');
      expect(line).toContain('rerun due');
      expect(line).toContain('unmeasured');
      expect(standingGrantCandidates(w.journal.view)).toEqual([]);
    } finally { w.done(); }
  });
});
