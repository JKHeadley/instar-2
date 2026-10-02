import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, projectionDigest, retrospectiveCases, type JournalView } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETRO_ANSWER_BYTES_PER_TOKEN, RETRO_DUTY_UNINSPECTED_NOTE,
  RETRO_EFFICIENCY_CHARS, RETRO_MAX_OMITTED_ROWS, RETRO_MIN_INTERVAL_MS,
  RETRO_OUTCOME_REASON_CHARS, RETRO_OUTCOME_UNSETTLED_REASON, RETRO_OVER_CAP_REASON, RETRO_STALE_CASE_MS, RETRO_UNACCOUNTED_REASON,
  disciplineSource, eligibleCases, retroAnswerBudget, type RetroCase } from './retrospective.js';

/** cint-L31. w3-retrolive changes what a retrospective pass writes into the journal: a bounded deferral list on the
 * reservation, an omitted disposition for an unaccounted case, a duty recorded unavailable with its note, a
 * settled grade recorded pending with its reason, and the planned estimate plus measured output tokens the next
 * pass's answerBudgetBytes is derived from. None of its tests compacted a journal. These do: each field is written
 * through the journal's own append (cint-L26's validate-before-write path), carried by a compaction snapshot
 * (cint-L29's format), reopened, and read back — and the next pass is planned from the reopened copy exactly as
 * from the live one. The second test opens a root holding the pass records the OLDER builds wrote (the recorded
 * live shapes in retrospective-live-failures-2026-10-02.json) and carries on from them. */
const live = JSON.parse(readFileSync(new URL('./fixtures/retrospective-live-failures-2026-10-02.json', import.meta.url), 'utf8')) as {
  recorded: { justinRoot: { passes: { pass: number; at: number; state: 'unknown' | 'failed'; reason: string; eligible: number;
    supplied: number; deferredByBound: number }[] }; liveIdShapes: { message: string } } };

const key = new Uint8Array(32).fill(43);
const START = Date.UTC(2026, 9, 2, 17);
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 4000, maxReplies: 4000, maxTurns: 4000, maxBytes: 409600, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: 715672478 + id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, date: Math.floor(at / 1000) + id, text } });
const DIGEST = 'sha256:config-a';
const pad = (n: number) => 'note '.repeat(Math.ceil(n / 5)).slice(0, n);
type Answer = { state: 'complete'; value: string; usage: { inputTokens: number; outputTokens: number; charge: null; inputComplete: true } }
  | { state: 'uncertain'; usage: { inputTokens: number; outputTokens: number; charge: null; inputComplete: true } };
const casesOf = (state: string) => (JSON.parse(state) as { cases: RetroCase[] }).cases;
const budgetOf = (state: string) => (JSON.parse(state) as { answerBudgetBytes: number }).answerBudgetBytes;
const usage = (bytes: number) => ({ inputTokens: 100, outputTokens: Math.round(bytes / RETRO_ANSWER_BYTES_PER_TOKEN), charge: null, inputComplete: true as const });

/** A complete answer for whatever cases the pass supplied, at the lengths the question asks for. */
function answerFor(state: string, over: Record<string, unknown> = {}): string {
  const cases = casesOf(state);
  return JSON.stringify({ inspected: cases.map(item => item.id), omitted: [],
    duties: RETROSPECTIVE_DUTIES.map(duty => duty === 'waste' ? 'f' : 'n').join(''), wells: GRAVITY_WELLS.map(() => 0),
    eff: pad(RETRO_EFFICIENCY_CHARS),
    findings: [{ duty: 'waste', refs: [cases[0]!.id], summary: pad(80), disposition: { owner: 'agent', next: pad(80) } }],
    feedback: [], closures: [], authorizations: [], comparisons: [],
    grades: cases.filter(item => item.category === 'decision' || item.category === 'verdict').map(item => ({ case: item.id,
      conclusion: { assessment: 'supported', evidence: [item.id] }, reason: { assessment: 'supported', evidence: [item.id] },
      outcome: { assessment: 'pending', reason: pad(60), evidence: [] }, observations: [] })),
    ...over });
}
const complete = (value: string): Answer => ({ state: 'complete', value, usage: usage(Buffer.byteLength(value)) });

function world(path: string, clock: { now: number }, fresh: boolean) {
  const journal = fresh ? openPreviewJournal(path, key, genesis) : openPreviewJournal(path, key);
  const states: string[] = [];
  let reply: (state: string) => Answer = state => complete(answerFor(state));
  let next = 1;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    sources: () => [disciplineSource(journal.view)],
    model: async (input: { id: string }) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator asked about the preview.', people: [], memory: [], commitments: [], questions: [] })
      : JSON.stringify({ reply: 'Noted — here is a reply of ordinary length for this preview conversation.', memory: [], dated: [] }),
    send: async () => 7, checkOutbound: () => {},
    retrospect: async (state: string) => { states.push(state); return reply(state); } });
  return { journal, states, answerWith: (fn: typeof reply) => { reply = fn; },
    retrospect: () => worker.retrospect(DIGEST),
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text, clock.now))); await worker.drain(); } };
}
const messages = (count: number) => Array.from({ length: count }, (_, index) => `Question number ${String(index + 1)} about the preview.`);
const owed = (view: JournalView, now: number) => eligibleCases(view, retrospectiveCases(view), now).map(item => item.id);
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `retro-snap-${name}-`)));

it('keeps every field a retrospective pass now writes through a compaction snapshot and a reopen, and plans the next pass identically', async () => {
  const root = tmp('fields');
  const path = join(root, 'journal.encrypted');
  try {
    const clock = { now: START };
    const w = world(path, clock, true);
    await w.converse(messages(12));
    let unaccounted = '', pended = '';
    // Pass 0: one case accounted for in neither list, a `u` at a duty whose evidence is present, and a met grade
    // with no later evidence. Each is recorded, never refused.
    w.answerWith(state => {
      const cases = casesOf(state);
      unaccounted = cases.at(-1)!.id;
      const decision = cases.find(item => item.category === 'decision')!;
      pended = decision.id;
      const base = JSON.parse(answerFor(state)) as { grades: { case: string }[] };
      return complete(answerFor(state, {
        inspected: cases.slice(0, -1).map(item => item.id),
        duties: RETROSPECTIVE_DUTIES.map(duty => duty === 'waste' ? 'f' : duty === 'workaround' ? 'u' : 'n').join(''),
        grades: base.grades.map(row => row.case === decision.id ? { ...row,
          outcome: { assessment: 'met', reason: '', evidence: [decision.id] } } : row) }));
    });
    await w.retrospect();
    const first = w.journal.view.retroPasses[0]!;
    expect(first.state).toBe('complete');
    expect(first.result!.omitted).toEqual(expect.arrayContaining([{ case: unaccounted, reason: RETRO_UNACCOUNTED_REASON }]));
    expect(first.result!.duties.find(row => row.duty === 'workaround')).toEqual({ duty: 'workaround', disposition: 'unavailable', note: RETRO_DUTY_UNINSPECTED_NOTE });
    expect(first.result!.grades.find(row => row.case === pended)!.outcome).toMatchObject({ assessment: 'pending', reason: RETRO_OUTCOME_UNSETTLED_REASON });
    expect(first.estimatedAnswerBytes).toBeGreaterThan(0);
    expect(first.outputTokens).toBeGreaterThan(0);
    // A bounded deferral list as the planner now writes it: a reservation naming exactly the bound.
    const deferred = Array.from({ length: RETRO_MAX_OMITTED_ROWS }, (_, index) =>
      ({ case: `${live.recorded.liveIdShapes.message}${String(index)}`, reason: 'bound: answer budget, deferred to a later pass' }));
    clock.now += RETRO_MIN_INTERVAL_MS;
    w.journal.append({ kind: 'retro-reserve', pass: 1, turnsSeen: 1, cases: [unaccounted], omitted: deferred, eligible: 900,
      packetSha256: 'sha256:x', contextDigest: DIGEST, estimatedAnswerBytes: 1200, at: clock.now });
    w.journal.append({ kind: 'retro', pass: 1, state: 'unknown', reason: 'model outcome uncertain', at: clock.now });

    const view = w.journal.view;
    const before = { digest: projectionDigest(view), passes: JSON.stringify(view.retroPasses), budget: retroAnswerBudget(view.retroPasses),
      owed: owed(view, clock.now) };
    w.journal.compact(); w.journal.close();

    const after = world(path, clock, false);
    const reopened = after.journal.view;
    expect(projectionDigest(reopened)).toBe(before.digest);
    expect(JSON.stringify(reopened.retroPasses)).toBe(before.passes);
    expect(reopened.retroPasses[1]!.omitted).toHaveLength(RETRO_MAX_OMITTED_ROWS);
    expect(reopened.retroPasses[0]!.result!.omitted).toEqual(expect.arrayContaining([{ case: unaccounted, reason: RETRO_UNACCOUNTED_REASON }]));
    expect(reopened.retroPasses[0]!.result!.duties.find(row => row.duty === 'workaround')!.note).toBe(RETRO_DUTY_UNINSPECTED_NOTE);
    expect(reopened.retroPasses[0]!.result!.grades.find(row => row.case === pended)!.outcome.assessment).toBe('pending');
    // The measurement the next ask widens from survives, so the reopened root plans the same budget.
    expect(reopened.retroPasses[0]!.estimatedAnswerBytes).toBe(first.estimatedAnswerBytes);
    expect(reopened.retroPasses[0]!.outputTokens).toBe(first.outputTokens);
    expect(retroAnswerBudget(reopened.retroPasses)).toBe(before.budget);
    expect(owed(reopened, clock.now)).toEqual(before.owed);
    expect(before.owed).toContain(unaccounted);
    // And the next pass runs from the reopened copy, carrying that budget in its packet (once its owed cases
    // are stale enough to be due on their own).
    clock.now += RETRO_STALE_CASE_MS;
    await after.retrospect();
    expect(after.states).toHaveLength(1);
    expect(budgetOf(after.states[0]!)).toBe(before.budget);
    expect(after.journal.view.retroPasses[2]!.state).toBe('complete');
    after.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);

it('opens a root holding the pass records older builds wrote, and the next pass completes or defers cleanly', async () => {
  const recorded = live.recorded.justinRoot.passes;
  for (const ending of ['complete', 'uncertain'] as const) {
    const root = tmp(`old-${ending}`);
    const path = join(root, 'journal.encrypted');
    try {
      // The conversation precedes the recorded passes, as it did on the live root.
      const clock = { now: recorded[0]!.at - 3_600_000 };
      const w = world(path, clock, true);
      await w.converse(messages(8));
      const real = owed(w.journal.view, clock.now);
      // The fourteen recorded passes of Justin's root (2026-10-02), as the older builds wrote them: the state,
      // reason, supplied count and deferral count are the recorded live values; the case ids are this root's own,
      // padded to the recorded deferral count with live-shaped ids. Passes 0-8 predate the recorded estimate (the
      // field is absent, as on those rows); the over-cap passes 9-12 carry an estimate under the old 4700-byte
      // bound and a frame at the output cap; pass 13 is the decoder refusal over a 978-entry deferral list.
      for (const pass of recorded) {
        const ids = Array.from({ length: pass.supplied + pass.deferredByBound }, (_, index) =>
          real[index] ?? `${live.recorded.liveIdShapes.message}${String(index)}`);
        const overCap = pass.reason === RETRO_OVER_CAP_REASON;
        w.journal.append({ kind: 'retro-reserve', pass: pass.pass, turnsSeen: 8, cases: ids.slice(0, pass.supplied),
          omitted: ids.slice(pass.supplied).map(id => ({ case: id, reason: 'bound: deferred to a later pass' })), eligible: pass.eligible,
          packetSha256: 'sha256:recorded', contextDigest: DIGEST,
          ...(overCap ? { estimatedAnswerBytes: Math.round(4700 * pass.supplied / 37) } : {}), at: pass.at });
        w.journal.append({ kind: 'retro', pass: pass.pass, state: pass.state, reason: pass.reason,
          ...(overCap ? { usage: { inputTokens: 9000, outputTokens: 2048, charge: null, inputComplete: true } } : {}), at: pass.at });
      }
      expect(w.journal.view.retroPasses.at(-1)!.omitted).toHaveLength(978);
      // The older records survive a compaction snapshot and a reopen like any other.
      const digest = projectionDigest(w.journal.view);
      w.journal.compact(); w.journal.close();
      const after = world(path, clock, false);
      expect(projectionDigest(after.journal.view)).toBe(digest);
      after.answerWith(state => ending === 'complete' ? complete(answerFor(state))
        : { state: 'uncertain', usage: usage(1500) });
      clock.now = recorded.at(-1)!.at + RETRO_STALE_CASE_MS;
      await after.retrospect();
      expect(after.states).toHaveLength(1);
      const next = after.journal.view.retroPasses.at(-1)!;
      expect(next.pass).toBe(recorded.length);
      // The new pass's own deferral list is bounded, whatever the older rows carried.
      expect(next.omitted.length).toBeLessThanOrEqual(RETRO_MAX_OMITTED_ROWS);
      // Its ask is planned from the older records themselves, under every over-cap ceiling they prove.
      expect(budgetOf(after.states[0]!)).toBe(retroAnswerBudget(after.journal.view.retroPasses.slice(0, -1)));
      if (ending === 'complete') {
        expect(next.state).toBe('complete');
        expect(next.result!.inspected.length).toBe(next.cases.length);
      } else {
        // Deferred cleanly: UNKNOWN, nothing inspected, every case still owed.
        expect(next.state).toBe('unknown');
        expect(owed(after.journal.view, clock.now)).toEqual(expect.arrayContaining(next.cases));
      }
      after.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}, 120_000);
