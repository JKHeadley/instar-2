/**
 * Unit — correction loop: route and verify (carryover row 32; 1.x tests/unit/CorrectionLoopDriver.test.ts at
 * 4f88880a, spec §3.6/§3.7/§3.8).
 *
 * Pins, as in 1.x: one clustered lesson routes once and retires every supporting paraphrase; a route is bounded per
 * pass with overflow carried open; the closed loop verifies only when nothing recurred AND the guidance was really
 * in force (silence ≠ effective); a sibling recurrence reopens the whole cluster with a fresh window; the reopen
 * cap ends inconclusive; nothing the loop does can write memory or grant authority. Where 1.x pinned its injected
 * capability list, its regex policy filter, its OCC cluster transaction and its loopback feedback POST, 2.0 pins
 * the one route it has (the retrospective's recurrence duty), the durable reservation that records it, and the
 * packet grounding that proves delivery. Both sides of each boundary are exercised, and every case reads the
 * same journal after a reopen.
 */
import { describe, it, expect } from 'vitest';
import { correctionCandidates, correctionLifecycle, correctionReport, correctionRouteClusterId, correctionStatusClause,
  DEFAULT_MAX_REOPENS, DEFAULT_MAX_ROUTES_PER_TICK, DEFAULT_VERIFY_WINDOW_DAYS_INFRA_GAP, DEFAULT_VERIFY_WINDOW_DAYS_PREFERENCE,
  type PresentedCorrection } from './correction-loop-driver.js';
import { dedupeKey, getByDedupeKey } from './correction-ledger.js';
import { retrospectivePopulation, validateRetrospective, GRAVITY_WELLS, RETROSPECTIVE_DUTIES } from './retrospective.js';
import { correctionWorld, T, type CorrectionWorld } from './correction-fixture.js';

const DAY = 86400_000;
/** A preference restated 4 times across 2 days and 2 context resets: the 1.x seedCrossingPreference. */
function seedCrossingPreference(w: CorrectionWorld, learning: string | string[], start = '2026-05-01T10:00:00Z') {
  const texts = typeof learning === 'string' ? [learning, learning, learning, learning] : learning;
  texts.forEach((text, i) => {
    if (i === 2) w.summarize(T(start) + DAY - 3600_000);
    w.preference(text, T(start) + (i % 2) * DAY + i * 60_000);
  });
}
/** A fact forgotten 4 times across 3 days: the 1.x seedCrossingInfraGap. */
function seedCrossingInfraGap(w: CorrectionWorld, fact: string, start = '2026-05-01T10:00:00Z') {
  const sources: string[] = [];
  for (let i = 0; i < 4; i++) sources.push(w.forgotten(fact, 'What was it again?', T(start) + (i % 3) * DAY + i * 60_000).source);
  return sources;
}
const present = (w: CorrectionWorld, at: number, options: { state?: 'complete' | 'failed' | 'unknown'; limit?: number } = {}) => {
  const routed = correctionCandidates(w.view, w.operator, at, options.limit ? { maxRoutesPerTick: options.limit } : {});
  const corrections: PresentedCorrection[] = routed.candidates.map(({ id, kind, keys }) => ({ id, kind, keys }));
  w.pass(at, { corrections, ...(options.state ? { state: options.state } : {}) });
  return routed;
};
const statuses = (w: CorrectionWorld, now: number, options = {}) => correctionLifecycle(w.view, w.operator, now, options);
const PARAPHRASES = ['alpha beta gamma delta theta', 'alpha beta gamma epsilon theta', 'alpha beta gamma zeta theta', 'alpha beta gamma eta theta'];

function assessedReply(w: CorrectionWorld, source: string, at: number, kind: 'preferences' | 'recalled' = 'preferences', assessment: 'met' | 'unmet' = 'met') {
  const id = w.reply('what should I do?', at, { [kind]: [source] });
  w.send(id, at + 2);
  const evidence = w.say('The reply met my preference.', at + 1000);
  const cases = retrospectivePopulation(w.view, w.operator).filter(item => item.id === `answer:${id}`);
  const result = validateRetrospective({ inspected: cases.map(item => item.id), omitted: [], duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length),
    wells: GRAVITY_WELLS.map(() => 0), eff: 'Assessed the outcome.', findings: [], feedback: [], authorizations: [], comparisons: [], closures: [],
    grades: [{ case: `answer:${id}`, promises: [],
    conclusion: { assessment: 'supported', evidence: [`turn:${source}`] }, reason: { assessment: 'not-applicable', evidence: [] },
    outcome: { assessment, reason: 'Independent assessment of this lesson and later outcome.', evidence: [`turn:${source}`, `turn:${evidence}`] }, observations: [] }] }, { cases }, w.view, w.view.retroPasses.length, at + 2000);
  expect(result.grades[0]?.outcome.assessment).toBe(assessment);
  w.pass(at + 2000, { cases: cases.map(item => item.id), result });
  return id;
}

describe('CorrectionLoopDriver', () => {
  describe('routing (one route: the judgment owner)', () => {
    it('a crossing preference becomes a candidate for the retrospective; below the gate it stays open', () => {
      const w = correctionWorld();
      try {
        w.preference('lead with the one action', T('2026-05-01T10:00:00Z'));
        w.preference('lead with the one action', T('2026-05-02T10:00:00Z'));
        expect(correctionCandidates(w.view, w.operator, T('2026-05-10T00:00:00Z')).candidates).toEqual([]);
        expect(statuses(w, T('2026-05-10T00:00:00Z'))[0]).toMatchObject({ status: 'open', reopenCount: 0 });
        const v = correctionWorld();
        try {
          seedCrossingPreference(v, 'lead with the one action');
          const routed = correctionCandidates(v.view, v.operator, T('2026-05-10T00:00:00Z'));
          expect(routed.candidates).toHaveLength(1);
          expect(routed.candidates[0]).toMatchObject({ kind: 'user-preference', support: 4, days: 2, sessions: 2, learning: 'lead with the one action',
            keys: [dedupeKey('user-preference', 'lead with the one action')] });
          expect(routed.candidates[0]!.occurrences).toHaveLength(4);
          expect(routed.candidates[0]!.context.map(turn => turn.fromUser)).toEqual([false, true]);
          expect(routed.refs).toEqual([routed.candidates[0]!.id, ...routed.candidates[0]!.occurrences]);
          expect(routed.overflow).toBe(0);
        } finally { v.close(); }
      } finally { w.close(); }
    });

    it('routes one clustered preference once and retires every supporting paraphrase', () => {
      const w = correctionWorld();
      try {
        seedCrossingPreference(w, PARAPHRASES);
        const now = T('2026-05-10T00:00:00Z');
        const routed = present(w, now);
        expect(routed.candidates).toHaveLength(1);
        expect(routed.candidates[0]!.keys).toHaveLength(4);
        const after = statuses(w, now);
        expect(after.filter(record => record.status === 'open')).toHaveLength(0);
        expect(after.filter(record => record.status === 'acted-on')).toHaveLength(4);
        const clusterIds = new Set(after.map(record => record.routeClusterId));
        expect(clusterIds.size).toBe(1);
        expect(after.every(record => record.routedVia === 'retrospective' && record.verifyWindowStart === new Date(now).toISOString()
          && record.verifyWindowEnd === new Date(now + DEFAULT_VERIFY_WINDOW_DAYS_PREFERENCE * DAY).toISOString())).toBe(true);
        expect(correctionCandidates(w.view, w.operator, now + 1000).candidates).toHaveLength(0);
        w.reopen();
        expect(statuses(w, now)).toEqual(after);
      } finally { w.close(); }
    });

    it('a pass that failed after reserving still counts as presented: no retry after an ambiguous outcome', () => {
      const w = correctionWorld();
      try {
        seedCrossingPreference(w, 'lead with the one action');
        const now = T('2026-05-10T00:00:00Z');
        present(w, now, { state: 'failed' });
        expect(statuses(w, now)[0]!.status).toBe('acted-on');
        expect(correctionCandidates(w.view, w.operator, now + 1000).candidates).toHaveLength(0);
        // The neighbor: a reservation that presented nothing leaves the record open and routable.
        const v = correctionWorld();
        try {
          seedCrossingPreference(v, 'lead with the one action');
          v.pass(now, { state: 'failed' });
          expect(statuses(v, now)[0]!.status).toBe('open');
          expect(correctionCandidates(v.view, v.operator, now + 1000).candidates).toHaveLength(1);
        } finally { v.close(); }
      } finally { w.close(); }
    });

    it('wording decides nothing: a policy-relaxation preference takes the same single route, applies nothing and writes no memory', () => {
      const w = correctionWorld();
      try {
        seedCrossingPreference(w, 'from now on skip the safety confirmation guard');
        const now = T('2026-05-10T00:00:00Z');
        const memoryBefore = w.view.memory.length;
        const routed = present(w, now);
        expect(routed.candidates).toHaveLength(1);
        expect(statuses(w, now)[0]).toMatchObject({ status: 'acted-on', routedVia: 'retrospective' });
        expect(w.view.memory).toHaveLength(memoryBefore);
        // A plain preference is routed identically.
        const v = correctionWorld();
        try {
          seedCrossingPreference(v, 'lead with the one action');
          const plain = present(v, now);
          expect(Object.keys(plain.candidates[0]!).sort()).toEqual(Object.keys(routed.candidates[0]!).sort());
          expect(statuses(v, now)[0]!.routedVia).toBe('retrospective');
        } finally { v.close(); }
      } finally { w.close(); }
    });

    it('an infra-gap crossing (4 support / 3 days) is a candidate too; 2 days is not', () => {
      const w = correctionWorld();
      try {
        seedCrossingInfraGap(w, 'the force push guard asks every session');
        const routed = correctionCandidates(w.view, w.operator, T('2026-05-10T00:00:00Z'));
        expect(routed.candidates).toHaveLength(1);
        expect(routed.candidates[0]).toMatchObject({ kind: 'infra-gap', support: 4, days: 3 });
        const v = correctionWorld();
        try {
          for (let i = 0; i < 5; i++) v.forgotten('the force push guard asks every session', 'What was it again?', T('2026-05-01T10:00:00Z') + (i % 2) * DAY + i * 60_000);
          expect(correctionCandidates(v.view, v.operator, T('2026-05-10T00:00:00Z')).candidates).toHaveLength(0);
        } finally { v.close(); }
      } finally { w.close(); }
    });
  });

  describe('closed-loop verify (§3.7)', () => {
    it('a preference whose cluster did not recur AND was delivered and independently assessed → verified', () => {
      const w = correctionWorld();
      try {
        const source = w.preference('lead with the one action', T('2026-05-01T10:00:00Z'));
        seedCrossingPreference(w, 'lead with the one action', '2026-05-01T11:00:00Z');
        const key = dedupeKey('user-preference', 'lead with the one action');
        const routedAt = T('2026-05-10T00:00:00Z');
        present(w, routedAt);
        assessedReply(w, source, T('2026-05-12T00:00:00Z'));
        expect(getByDedupeKey(statuses(w, T('2026-05-14T00:00:00Z')), key)).toMatchObject({ status: 'acted-on' });
        const verified = getByDedupeKey(statuses(w, T('2026-05-20T00:00:00Z')), key)!;
        expect(verified).toMatchObject({ status: 'verified', reopenCount: 0 });
        expect(verified.basis).toContain('verified');
        w.reopen();
        expect(getByDedupeKey(statuses(w, T('2026-05-20T00:00:00Z')), key)!.status).toBe('verified');
      } finally { w.close(); }
    });

    it('SILENCE alone is NOT effective — answers that never carried the guidance are unknown, and no answer at all is unknown', () => {
      const w = correctionWorld();
      try {
        seedCrossingPreference(w, 'lead with the one action');
        const key = dedupeKey('user-preference', 'lead with the one action');
        present(w, T('2026-05-10T00:00:00Z'));
        // Answers in the window, none carrying the preference (the recorded packet has no such source).
        w.reply('how is the garden?', T('2026-05-12T00:00:00Z'), { preferences: [] });
        w.reply('and the shed?', T('2026-05-13T00:00:00Z'));
        const silent = getByDedupeKey(statuses(w, T('2026-05-20T00:00:00Z')), key)!;
        expect(silent.status).toBe('unknown');
        expect(silent.basis).toContain('opportunity');
        const v = correctionWorld();
        try {
          seedCrossingPreference(v, 'lead with the one action');
          present(v, T('2026-05-10T00:00:00Z'));
          expect(getByDedupeKey(statuses(v, T('2026-05-20T00:00:00Z')), key)).toMatchObject({ status: 'unknown' });
        } finally { v.close(); }
      } finally { w.close(); }
    });

    it('a sibling recurrence reopens the cluster, then a clean fresh window verifies it', () => {
      const w = correctionWorld();
      try {
        seedCrossingPreference(w, PARAPHRASES);
        const routedAt = T('2026-05-10T00:00:00Z');
        present(w, routedAt);
        const actedOn = statuses(w, routedAt);
        expect(new Set(actedOn.map((record) => record.routeClusterId)).size).toBe(1);
        expect(actedOn.every((record) => Boolean(record.routeClusterId))).toBe(true);
        // A non-representative wording recurs after the shared verify window opens.
        const recurrence = w.preference(PARAPHRASES[3]!, T('2026-05-15T00:00:00Z'));
        // The fresh window starts where the elapsed one ended (deterministic, not at a later tick).
        const freshStart = routedAt + DEFAULT_VERIFY_WINDOW_DAYS_PREFERENCE * DAY;
        const reopened = statuses(w, T('2026-05-20T00:00:00Z'));
        expect(reopened).toHaveLength(4);
        expect(reopened.filter(record => record.status === 'verified')).toHaveLength(0);
        expect(reopened.every(record => record.status === 'reopened' && record.reopenCount === 1
          && record.verifyWindowStart === new Date(freshStart).toISOString())).toBe(true);
        // The old May 15 occurrence predates the fresh start, so it cannot burn another reopen. With no new
        // recurrence and the guidance carried, the fresh window verifies all four.
        assessedReply(w, recurrence, T('2026-05-19T00:00:00Z'));
        const settled = statuses(w, T('2026-05-30T00:00:00Z'));
        expect(settled.filter(record => record.status === 'verified')).toHaveLength(4);
        expect(settled.filter(record => record.status === 'reopened')).toHaveLength(0);
      } finally { w.close(); }
    });

    it('a new recurrence in the fresh second window reaches the reopen cap', () => {
      const w = correctionWorld();
      try {
        const learning = 'lead with the one action';
        seedCrossingPreference(w, learning);
        const key = dedupeKey('user-preference', learning);
        const routedAt = T('2026-05-10T00:00:00Z');
        present(w, routedAt);
        w.preference(learning, T('2026-05-15T00:00:00Z'));
        const freshStart = routedAt + DEFAULT_VERIFY_WINDOW_DAYS_PREFERENCE * DAY;
        expect(getByDedupeKey(statuses(w, T('2026-05-20T00:00:00Z'), { maxReopens: 1 }), key)).toMatchObject({
          status: 'reopened', reopenCount: 1, verifyWindowStart: new Date(freshStart).toISOString() });
        // This occurrence is genuinely new relative to the reset start, so the second elapsed window reaches
        // maxReopens and becomes inconclusive.
        w.preference(learning, T('2026-05-20T00:00:00Z'));
        expect(getByDedupeKey(statuses(w, T('2026-05-30T00:00:00Z'), { maxReopens: 1 }), key)).toMatchObject({ status: 'inconclusive', reopenCount: 1 });
        // With the default cap the same history is still watching a third window.
        expect(getByDedupeKey(statuses(w, T('2026-05-30T00:00:00Z')), key)).toMatchObject({ status: 'reopened', reopenCount: 2 });
        expect(DEFAULT_MAX_REOPENS).toBe(2);
      } finally { w.close(); }
    });

    it('a recurrence after a settled window reopens the lesson for the gate instead of being ignored', () => {
      const w = correctionWorld();
      try {
        seedCrossingPreference(w, 'lead with the one action');
        const key = dedupeKey('user-preference', 'lead with the one action');
        present(w, T('2026-05-10T00:00:00Z'));
        expect(getByDedupeKey(statuses(w, T('2026-05-20T00:00:00Z')), key)!.status).toBe('unknown');
        w.preference('lead with the one action', T('2026-05-21T00:00:00Z'));
        const again = getByDedupeKey(statuses(w, T('2026-05-22T00:00:00Z')), key)!;
        expect(again.status).toBe('open');
        expect(again.basis).toContain('recurred after');
        expect(correctionCandidates(w.view, w.operator, T('2026-05-22T00:00:00Z')).candidates.map(item => item.keys)).toEqual([[key]]);
      } finally { w.close(); }
    });
  });

  describe('infra-gap closed-loop verify', () => {
    it('infra-gap silence with the lesson carried by recall → verified; with no answer → unknown (14-day window)', () => {
      const w = correctionWorld();
      try {
        const sources = seedCrossingInfraGap(w, 'the force push guard asks every session');
        const key = dedupeKey('infra-gap', 'the force push guard asks every session');
        const routedAt = T('2026-05-10T00:00:00Z');
        present(w, routedAt);
        const during = statuses(w, T('2026-05-20T00:00:00Z'));
        expect(getByDedupeKey(during, key)).toMatchObject({ status: 'acted-on',
          verifyWindowEnd: new Date(routedAt + DEFAULT_VERIFY_WINDOW_DAYS_INFRA_GAP * DAY).toISOString() });
        assessedReply(w, sources[0]!, T('2026-05-18T00:00:00Z'), 'recalled');
        expect(getByDedupeKey(statuses(w, T('2026-05-30T00:00:00Z')), key)!.status).toBe('verified');
        const v = correctionWorld();
        try {
          seedCrossingInfraGap(v, 'the force push guard asks every session');
          present(v, routedAt);
          expect(getByDedupeKey(statuses(v, T('2026-05-30T00:00:00Z')), key)!.status).toBe('unknown');
        } finally { v.close(); }
      } finally { w.close(); }
    });

    it('infra-gap recurrence-after on the SAME dedupeKey → reopened (uses the 14d window)', () => {
      const w = correctionWorld();
      try {
        seedCrossingInfraGap(w, 'the force push guard asks every session');
        const key = dedupeKey('infra-gap', 'the force push guard asks every session');
        present(w, T('2026-05-10T00:00:00Z'));
        w.forgotten('the force push guard asks every session', 'What was it again?', T('2026-05-15T00:00:00Z'));
        expect(getByDedupeKey(statuses(w, T('2026-05-30T00:00:00Z')), key)).toMatchObject({ status: 'reopened', reopenCount: 1,
          verifyWindowStart: new Date(T('2026-05-24T00:00:00Z')).toISOString() });
      } finally { w.close(); }
    });
  });

  describe('per-pass route ceiling (spec §10 Slice-2 NEW-5)', () => {
    it('caps presented clusters at maxRoutesPerTick; overflow stays open + counted', () => {
      const w = correctionWorld();
      try {
        const learnings = ['amber', 'bronze', 'cobalt', 'denim', 'emerald', 'fuchsia', 'gold'];
        learnings.forEach((learning, p) => seedCrossingPreference(w, learning, `2026-05-0${String(p + 1)}T10:00:00Z`));
        const now = T('2026-05-20T00:00:00Z');
        const routed = present(w, now, { limit: 3 });
        expect(routed.candidates.length).toBe(3);
        expect(routed.overflow).toBe(4); // 7 crossing − 3 routed
        const stillOpen = statuses(w, now).filter(record => record.kind === 'user-preference' && record.status === 'open').length;
        expect(stillOpen).toBe(4);
        expect(DEFAULT_MAX_ROUTES_PER_TICK).toBe(5);
      } finally { w.close(); }
    });

    it('a second pass routes the carried-over overflow (idempotent re-route)', () => {
      const w = correctionWorld();
      try {
        ['amber', 'bronze', 'cobalt', 'denim', 'emerald'].forEach((learning, p) => seedCrossingPreference(w, learning, `2026-05-0${String(p + 1)}T10:00:00Z`));
        const now = T('2026-05-20T00:00:00Z');
        const r1 = present(w, now, { limit: 3 });
        expect(r1.candidates.length).toBe(3);
        expect(r1.overflow).toBe(2);
        const r2 = present(w, now + 3600_000, { limit: 3 });
        expect(r2.candidates.length).toBe(2); // the carried-over overflow
        expect(r2.overflow).toBe(0);
        expect(statuses(w, now + 3600_000).every(record => record.status === 'acted-on')).toBe(true);
      } finally { w.close(); }
    });
  });

  describe('observability (Rule 39)', () => {
    it('reports records by kind and status, candidates waiting and overflow, and one status clause', () => {
      const w = correctionWorld();
      try {
        const now = T('2026-05-10T00:00:00Z');
        expect(correctionStatusClause(w.view, w.operator, now)).toBe('corrections: none recorded');
        seedCrossingPreference(w, 'lead with the one action');
        w.preference('plain words', T('2026-05-03T10:00:00Z'));
        expect(correctionReport(w.view, w.operator, now)).toMatchObject({ records: 2, occurrences: 5, byKind: { 'user-preference': 2 },
          byStatus: { open: 2 }, candidates: 1, overflow: 0 });
        present(w, now);
        expect(correctionReport(w.view, w.operator, now)).toMatchObject({ byStatus: { open: 1, 'acted-on': 1 }, candidates: 0 });
        expect(correctionStatusClause(w.view, w.operator, now)).toBe('corrections: 2 lessons (5 occurrences), 0 recurring for review, 1 watched, 0 verified');
        expect(correctionRouteClusterId('user-preference', ['b', 'a'])).toBe(correctionRouteClusterId('user-preference', ['a', 'b']));
        expect(correctionRouteClusterId('infra-gap', ['a', 'b'])).not.toBe(correctionRouteClusterId('user-preference', ['a', 'b']));
      } finally { w.close(); }
    });
  });
});

it.each(['unsent', 'ungraded', 'failed-observation', 'unmet'] as const)('packet inclusion with %s is not verified', mode => {
  const w = correctionWorld();
  try {
    seedCrossingPreference(w, 'lead with the one action');
    const at = T('2026-05-10T00:00:00Z');
    present(w, at);
    const source = w.view.order[0]!.id;
    if (mode === 'unmet') assessedReply(w, source, at + DAY, 'preferences', 'unmet');
    else {
      const id = w.say('Please give me the action.', at + DAY);
      w.answer(id, 'Here is a long preamble before any action.', at + DAY + 1, { grounding: { preferences: [source] } });
      if (mode !== 'unsent') w.send(id, at + DAY + 2);
      if (mode === 'failed-observation') w.pass(at + 2 * DAY, { state: 'failed' });
    }
    expect(statuses(w, at + 8 * DAY)[0]!.status).toBe(mode === 'unmet' ? 'inconclusive' : 'unknown');
  } finally { w.close(); }
});

it('missing historical grounding and partial delivery cannot verify despite a separate assessed success', () => {
  const w = correctionWorld();
  try {
    seedCrossingPreference(w, 'lead with the one action');
    const at = T('2026-05-10T00:00:00Z'); present(w, at);
    const source = w.view.order[0]!.id;
    const id = assessedReply(w, source, at + DAY);
    const prefix = structuredClone(w.view);
    prefix.turns.get(id)!.replyParts = [{ text: 'tail', body: 'tail', provenance: { speaker: 'agent', principal: 'fixture', signer: 'fixture', contentHash: 'fixture', signature: 'fixture' } }];
    expect(correctionLifecycle(prefix, w.operator, at + 8 * DAY)[0]!.status).toBe('unknown');
    const missing = structuredClone(w.view);
    delete missing.order.find(turn => turn.id === id)!.grounding;
    expect(correctionLifecycle(missing, w.operator, at + 8 * DAY)[0]!.status).toBe('unknown');
  } finally { w.close(); }
});
