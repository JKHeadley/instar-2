/**
 * Integration — the correction loop through the existing retrospective owner (carryover row 32; the route the 1.x
 * CorrectionLoopDriver took through its injected capabilities, here through the journal worker's own `retrospect`
 * step and the retrospective's packet, validator and reservation row).
 *
 * Pins: a gate-crossing cluster rides the review packet as `correctionCandidates`; the reservation row records
 * what was presented, durably and replayably; a recurrence finding that cites the candidate is accepted and opens
 * owned root-cause work; a finding that cites a candidate the packet never carried is refused; after the pass the
 * cluster is acted-on and is not presented again. Stub boundary tests are paired with the captured
 * real provider output and the read-only proof-room shapes below.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createJournalWorker, type Turn } from './journal.js';
import { GRAVITY_WELLS, RETROSPECTIVE_DUTIES, RETROSPECTIVE_QUESTION, openFindings, retrospectivePlan, retrospectivePopulation, RETRO_ANSWER_BUDGET_BYTES, type RetroCase } from './retrospective.js';
import { evaluateCorrectionInstanceFix } from './correction-fix-gate.js';
import { correctionCandidates, correctionLifecycle, presentedCorrections } from './correction-loop-driver.js';
import { correctionWorld, T, type CorrectionWorld } from './correction-fixture.js';

const DAY = 86400_000;
const DIGEST = 'sha256:config-a';
type Packet = { correctionCandidates?: { id: string; kind: string; keys: string[]; occurrences: string[]; learning: string; context: { fromUser: boolean; text: string }[] }[]; cases: RetroCase[] };

function seed(w: CorrectionWorld) {
  const learning = 'lead with the one action';
  for (let i = 0; i < 4; i++) {
    if (i === 2) w.summarize(T('2026-05-01T10:00:00Z') + DAY - 3600_000);
    w.preference(learning, T('2026-05-01T10:00:00Z') + (i % 2) * DAY + i * 60_000);
  }
}
/** A complete answer that defers every case and opens the findings given. */
const answerWith = (packet: Packet, findings: unknown[]) => JSON.stringify({ inspected: [], omitted: packet.cases.map(item => ({ case: item.id, reason: 'answer budget' })),
  duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length), wells: GRAVITY_WELLS.map(() => 0), eff: 'No wasted attempts found in this window.',
  findings, grades: [], feedback: [], authorizations: [], comparisons: [], closures: [] });
const recurrence = (candidate: NonNullable<Packet['correctionCandidates']>[number]) => ({ duty: 'recurrence', refs: candidate.occurrences,
  summary: 'The operator restated the same style preference four times across two days.', recurs: [candidate.id],
  rootCause: 'the standing style is carried but the reply still opens with preamble', structuralRemedy: { none: 'watch the next window first' },
  disposition: { owner: 'agent', next: 'open with the action on the next reply' } });

function review(w: CorrectionWorld, reply: (packet: Packet) => string, now: number) {
  const states: string[] = [];
  const worker = createJournalWorker(w.journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, timeZone: 'America/Los_Angeles',
    send: async () => 7, model: async () => JSON.stringify({ reply: 'Noted.', memory: [] }),
    retrospect: async (state: string) => { states.push(state); return { state: 'complete' as const, value: reply(JSON.parse(state) as Packet),
      usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true as const } }; } });
  return { worker, states, operator: (turn: Turn) => w.operator(turn) };
}

describe('correction candidates through the retrospective review', () => {
  it('presents a crossing cluster in the packet, records it on the reservation, accepts a recurrence finding citing it, and retires it', async () => {
    const w = correctionWorld();
    try {
      seed(w);
      const now = T('2026-05-10T00:00:00Z');
      expect(correctionCandidates(w.view, w.operator, now).candidates).toHaveLength(1);
      const r = review(w, packet => answerWith(packet, [recurrence(packet.correctionCandidates![0]!)]), now);
      await r.worker.retrospect(DIGEST);
      const packet = JSON.parse(r.states[0]!) as Packet;
      expect(packet.correctionCandidates).toHaveLength(1);
      const candidate = packet.correctionCandidates![0]!;
      expect(candidate).toMatchObject({ kind: 'user-preference', learning: 'lead with the one action' });
      expect(candidate.occurrences).toHaveLength(4);
      expect(String(RETROSPECTIVE_QUESTION)).toContain('correctionCandidates');
      // The reservation row is the durable route event, and the pass recorded the owned root-cause finding.
      const pass = w.view.retroPasses[0]!;
      expect(pass.state).toBe('complete');
      expect(pass.corrections).toEqual([{ id: candidate.id, kind: 'user-preference', keys: candidate.keys }]);
      expect(pass.result!.findings).toHaveLength(1);
      expect(pass.result!.findings[0]).toMatchObject({ duty: 'recurrence', recurs: [candidate.id], refs: candidate.occurrences, disposition: { owner: 'agent' } });
      expect(openFindings(w.view).map(item => item.duty)).toEqual(['recurrence']);
      const after = correctionLifecycle(w.view, w.operator, now + 1000);
      expect(after.map(record => record.status)).toEqual(['acted-on']);
      expect(after[0]!.routeClusterId).toBe(candidate.id);
      expect(presentedCorrections(w.view)).toEqual([{ id: candidate.id, kind: 'user-preference', keys: candidate.keys, pass: 0, at: now }]);
      expect(correctionCandidates(w.view, w.operator, now + 1000).candidates).toEqual([]);
      // A restart replays the same presentation and lifecycle.
      w.reopen();
      expect(presentedCorrections(w.view)).toHaveLength(1);
      expect(correctionLifecycle(w.view, w.operator, now + 1000).map(record => record.status)).toEqual(['acted-on']);
    } finally { w.close(); }
  }, 60_000);

  it('refuses a recurrence finding that cites a candidate the packet never carried, and a packet with no crossing cluster carries no field', async () => {
    const w = correctionWorld();
    try {
      seed(w);
      const now = T('2026-05-10T00:00:00Z');
      const forged = { id: 'correction:deadbeefdeadbeef', kind: 'user-preference', keys: [], occurrences: ['turn:telegram:12345678:update:1'], learning: '', context: [] };
      const r = review(w, packet => answerWith(packet, [recurrence(forged)]), now);
      await r.worker.retrospect(DIGEST);
      const pass = w.view.retroPasses[0]!;
      expect(pass.state).toBe('complete');
      expect(pass.result!.findings).toEqual([]);
      expect(pass.result!.duties.find(row => row.duty === 'recurrence')?.disposition).toBe('unavailable');
      // Presented is presented: the cluster was in the packet, so it is acted-on even though the finding was refused.
      expect(correctionLifecycle(w.view, w.operator, now + 1000).map(record => record.status)).toEqual(['acted-on']);
      // Below the gate nothing rides the packet, and the reservation records nothing (byte-identical to before).
      const v = correctionWorld();
      try {
        v.preference('lead with the one action', T('2026-05-01T10:00:00Z'));
        v.preference('lead with the one action', T('2026-05-02T10:00:00Z'));
        const quiet = review(v, packet => answerWith(packet, []), now);
        await quiet.worker.retrospect(DIGEST);
        expect(quiet.states).toHaveLength(1);
        expect(quiet.states[0]).not.toContain('correctionCandidates');
        expect(v.view.retroPasses[0]!.corrections).toBeUndefined();
      } finally { v.close(); }
    } finally { w.close(); }
  }, 60_000);
});

it('five crossed clusters share the planner budget with cases and deferred candidates drain', () => {
  const w = correctionWorld();
  try {
    const start = T('2026-05-01T10:00:00Z');
    for (let i = 0; i < 4; i++) {
      if (i === 2) w.summarize(start + DAY - 1000);
      ['amber', 'bronze', 'cobalt', 'denim', 'emerald'].forEach((lesson, j) => w.preference(lesson, start + Math.floor(i / 2) * DAY + i * 1000 + j));
    }
    let now = start + 10 * DAY;
    expect(correctionCandidates(w.view, w.operator, now).candidates).toHaveLength(5);
    const presented = new Set<string>();
    for (let i = 0; i < 5 && presented.size < 5; i++) {
      const plan = retrospectivePlan(w.view, retrospectivePopulation(w.view, w.operator), now, DIGEST)!;
      expect(plan).not.toBeNull();
      expect(plan.cases.length).toBeGreaterThan(0);
      expect(plan.estimatedAnswerBytes).toBeLessThanOrEqual(RETRO_ANSWER_BUDGET_BYTES);
      expect(plan.corrections.length).toBeGreaterThan(0);
      if (i === 0) expect(plan.corrections.length).toBeLessThan(5);
      for (const candidate of plan.corrections) { expect(presented.has(candidate.id)).toBe(false); presented.add(candidate.id); }
      w.pass(now, { corrections: plan.corrections, cases: plan.cases.map(item => item.id) });
      w.reopen(); now += DAY;
    }
    expect(presented.size).toBe(5);
    expect(correctionCandidates(w.view, w.operator, now).candidates).toHaveLength(0);
  } finally { w.close(); }
});

const captured = JSON.parse(readFileSync(new URL('./fixtures/correction-retrospective-2026-11-04.json', import.meta.url), 'utf8')) as {
  question: string; plan: { state: string }; raw: string;
  classReviewCapture: { question: string; plan: { state: string }; raw: string };
};
function seedCaptured(w: CorrectionWorld) {
  const start = T('2026-05-01T10:00:00Z');
  for (let i = 0; i < 4; i++) {
    if (i === 2) w.summarize(start + DAY - 1000);
    w.preference('lead with the one action', start + Math.floor(i / 2) * DAY + i * 1000);
  }
}
it.each([false, true])('replays actual provider candidate-reference output through the worker; forged=%s', async forged => {
  const w = correctionWorld();
  try {
    seedCaptured(w);
    expect(captured.question).toBe(RETROSPECTIVE_QUESTION);
    const now = T('2026-05-01T10:00:00Z') + 10 * DAY;
    const raw = forged ? captured.raw.replaceAll('correction:dc76622ebb2048b0', 'correction:0000000000000000') : captured.raw;
    const r = review(w, () => raw, now);
    await r.worker.retrospect(DIGEST);
    expect(r.states[0]).toBe(captured.plan.state);
    const pass = w.view.retroPasses[0]!;
    expect(pass.state).toBe('complete');
    expect(pass.result!.findings.filter(row => row.duty === 'recurrence')).toHaveLength(forged ? 0 : 1);
    if (!forged) expect(pass.result!.findings[0]!.recurs).toEqual(['correction:dc76622ebb2048b0']);
    else expect(pass.result!.duties.find(row => row.duty === 'recurrence')).toMatchObject({ disposition: 'unavailable' });
  } finally { w.close(); }
});
const otherShapes = (JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[];
}).otherShapes;
it.each(otherShapes)('replays recorded $kind $id: it cannot masquerade as a correction review or successful outcome', async shape => {
  const w = correctionWorld();
  try {
    seedCaptured(w);
    const now = T('2026-05-01T10:00:00Z') + 10 * DAY;
    const r = review(w, () => shape.raw, now);
    await r.worker.retrospect(DIGEST);
    const pass = w.view.retroPasses[0]!;
    expect(pass.corrections).toHaveLength(1); // The new path really fired on this replay.
    expect(pass.state).toBe('failed'); expect(pass.result).toBeUndefined();
    expect(correctionLifecycle(w.view, w.operator, now + 8 * DAY)[0]!.status).toBe('unknown');
  } finally { w.close(); }
});

it.each([false, true])('replays real two-question review before linked repair admission; partial=%s', async partial => {
  const w = correctionWorld();
  try {
    const start = T('2026-05-01T10:00:00Z');
    const id = w.preference('lead with the one action', start), caseId = `turn:${id}`;
    w.pass(start + DAY, { result: { inspected: [`answer:${id}`] } });
    const capture = captured.classReviewCapture;
    expect(capture.question).toBe(RETROSPECTIVE_QUESTION);
    const changed = JSON.parse(capture.raw) as { classReviews: { processReview?: unknown }[] };
    if (partial) delete changed.classReviews[0]!.processReview;
    const r = review(w, () => partial ? JSON.stringify(changed) : capture.raw, start + 10 * DAY);
    await r.worker.retrospect(DIGEST);
    expect(r.states[0]).toBe(capture.plan.state);
    const result = w.view.retroPasses[1]!.result!;
    expect(result.classReviews?.length ?? 0).toBe(partial ? 0 : 1);
    w.reopen();
    expect(evaluateCorrectionInstanceFix(w.view, { originCorrection: true, correctionCase: caseId, reviewEnabled: true }).allow).toBe(!partial);
  } finally { w.close(); }
});

it('candidates remain schedulable after the ordinary cases have drained', () => {
  const w = correctionWorld();
  try {
    seedCaptured(w);
    const now = T('2026-05-01T10:00:00Z') + 10 * DAY;
    const population = retrospectivePopulation(w.view, w.operator);
    w.pass(now - DAY, { result: { inspected: population.map(item => item.id),
      classReviews: population.filter(item => item.meta?.correction !== undefined).map(item => ({ case: item.id,
        standardReview: { verdict: 'not-applicable', isPolicyRelaxation: false }, processReview: { verdict: 'not-applicable' },
        rationale: 'Preference recorded; no standards change.', confidence: 'high' })) } });
    const plan = retrospectivePlan(w.view, population, now, DIGEST)!;
    expect(plan.cases).toEqual([]); expect(plan.corrections).toHaveLength(1);
    w.pass(now, { corrections: plan.corrections });
    expect(retrospectivePlan(w.view, population, now + DAY, DIGEST)).toBeNull();
  } finally { w.close(); }
});
