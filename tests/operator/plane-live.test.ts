import { expect, it } from 'vitest';
import { evaluateGenesisReplay, evaluateMinimalPath, minimalPlaneProjectionIds, minimalPlaneProjections, minimalResponse,
  operatorSeams, requiredMinimalDependencies, resolveFailureTrace, validateSeamInventory } from '../../src/operator/index.js';
import type { MinimalDependency, ReplaySample } from '../../src/operator/index.js';
import { value } from '../fixtures.js';
import { operatorFixture } from './fixture.js';

function dependencies(missing: readonly MinimalDependency[] = []): Record<MinimalDependency, boolean> {
  return Object.fromEntries(requiredMinimalDependencies.map(name => [name, !missing.includes(name)])) as Record<MinimalDependency, boolean>;
}
function samples(): ReplaySample[] {
  const hash = operatorFixture().f.authorization.requestDigest;
  return [
    { deployment: 'phone', cache: 'cold', facts: 20, bytes: 2_000, lineages: 2, generation: 'g1', started: 10, ended: 30,
      peakMemory: 100, resultDigest: hash, failures: [] },
    { deployment: 'phone', cache: 'warm', facts: 20, bytes: 2_000, lineages: 2, generation: 'g1', started: 40, ended: 50,
      peakMemory: 80, resultDigest: hash, failures: [] },
  ];
}

it('P11-NF-24 P11-NF-25 P11-NF-26 the six informational projections enumerate every admitted kind and never answer authority', () => {
  const kinds = ['intake-receipt', 'conversation-binding', 'slice-obligation', 'effect-EffectSettlement', 'run-opening'];
  const rows = minimalPlaneProjections(kinds);
  expect(rows.map(row => row.id)).toEqual([...minimalPlaneProjectionIds]);
  for (const row of rows) {
    expect(row.class).toBe('informational');
    expect(Object.keys(row.decisions).sort()).toEqual([...kinds].sort());
    expect(Object.values(row.decisions).every(decision => decision.kind === 'folds' || decision.reason.trim().length > 0)).toBe(true);
  }
});

it('P11-NF-27 P11-NF-28 P11-NF-29 complete cold/warm genesis measurements produce one maximum-plus-margin admission bound only when bytes agree', () => {
  const x = operatorFixture();
  const admitted = value(evaluateGenesisReplay(samples(), { phone: ['cold', 'warm'] }, 30, 5, 20, x.f.c));
  expect(admitted).toEqual({ eligible: true, maximumDuration: 20, maximumMemory: 100, admissionDuration: 25, admissionMemory: 120, failures: [] });
  const divergent = samples(); divergent[1] = { ...divergent[1]!, resultDigest: x.f.nextArtifact };
  expect(value(evaluateGenesisReplay(divergent, { phone: ['cold', 'warm'] }, 30, 5, 20, x.f.c)).failures).toContain('canonical-replay-divergence');
});

it('P11-NF-30 P11-NF-31 failed, missing and over-budget replay samples remain in the release verdict and block admission', () => {
  const x = operatorFixture(), failed = samples();
  failed[0] = { ...failed[0]!, ended: 100, failures: ['timeout'] };
  const verdict = value(evaluateGenesisReplay(failed, { phone: ['cold', 'warm'], server: ['cold', 'warm'] }, 30, 5, 0, x.f.c));
  expect(verdict.eligible).toBe(false);
  expect(verdict.failures).toEqual(expect.arrayContaining(['phone:cold:timeout', 'server:cold:missing', 'startup-budget-exceeded']));
});

it('P11-NF-27 P11-NF-29 P11-NF-30 P11-NF-31 replay admission refuses malformed, empty, cross-generation, and incomparable measurements', () => {
  const x = operatorFixture(), matrix = { phone: ['cold', 'warm'] as const };
  expect(x.detail(evaluateGenesisReplay(samples().slice(1), {}, 30, 5, 20, x.f.c))).toContain('samples and finite budgets');
  for (const mutate of [
    (rows: ReplaySample[]) => { rows[0] = { ...rows[0]!, ended: Number.NaN }; },
    (rows: ReplaySample[]) => { rows[0] = { ...rows[0]!, peakMemory: Number.POSITIVE_INFINITY }; },
    (rows: ReplaySample[]) => { rows[0] = { ...rows[0]!, resultDigest: 'not-a-digest' as never }; },
    (rows: ReplaySample[]) => { rows[0] = { ...rows[0]!, generation: 'other-generation' }; },
    (rows: ReplaySample[]) => { rows[0] = { ...rows[0]!, lineages: 1 }; },
  ]) {
    const rows = samples(); mutate(rows);
    expect(value(evaluateGenesisReplay(rows, matrix, 30, 5, 20, x.f.c)).eligible).toBe(false);
  }
  expect(value(evaluateGenesisReplay(samples(), matrix, 30, 5, 20, x.f.c, 119)).failures).toContain('memory-budget-exceeded');
});

it('P11-NF-24 P11-NF-26 the authority projection folds owner authorization requests and dispositions without conferring authority', () => {
  const authority = minimalPlaneProjections(['authorization-request', 'authorization-disposition'])[4]!;
  expect(authority.class).toBe('informational');
  expect(authority.decisions['authorization-request']?.kind).toBe('folds');
  expect(authority.decisions['authorization-disposition']?.kind).toBe('folds');
});

it('P11-NF-32 corrupt non-source views are disposable while source declarations and the smallest healthy path remain separate', () => {
  const x = operatorFixture(), before = minimalPlaneProjections(['intake-receipt']);
  const mutated = structuredClone(before) as unknown as { id: string }[]; mutated[0]!.id = 'corrupt';
  expect(minimalPlaneProjections(['intake-receipt']).map(row => row.id)).toEqual([...minimalPlaneProjectionIds]);
  expect(value(evaluateMinimalPath({ admitted: dependencies(), ordinaryUnavailable: ['corrupt-projection'], inputPreserved: true,
    repairOwner: 'minimal-repair', maximumExposure: 0 }, x.f.c)).responseEligible).toBe(true);
});

it('P11-NF-33 P11-NF-34 P11-NF-35 ordinary saturation cannot consume the admitted reserved minimal path or widen its authority', () => {
  const x = operatorFixture();
  const state = value(evaluateMinimalPath({ admitted: dependencies(), ordinaryUnavailable: ['ordinary-workers', 'ordinary-model', 'business-effect'],
    inputPreserved: true, repairOwner: 'minimal-repair', maximumExposure: 5 }, x.f.c));
  expect(state).toMatchObject({ admitted: true, responseEligible: true, preserved: true, replayCount: 0 });
  const response = value(minimalResponse(state, { attributable: true, pending: ['ordinary run'], blocked: ['model unavailable'], uncertain: [], emergencyStop: false }, x.f.c));
  expect(response).toContain('Limited response');
  expect(response).not.toMatch(/approved|authorized|complete/i);
});

it('P11-NF-36 P11-NF-37 P11-NF-38 each missing required dependency yields preserved owned outage, retained exposure and zero replay rather than an impossible reply', () => {
  const x = operatorFixture();
  for (const dependency of requiredMinimalDependencies) {
    const state = value(evaluateMinimalPath({ admitted: dependencies([dependency]), ordinaryUnavailable: [], inputPreserved: true,
      repairOwner: `repair:${dependency}`, maximumExposure: 9 }, x.f.c));
    expect(state).toMatchObject({ admitted: false, responseEligible: false, preserved: true, maximumExposure: 9, replayCount: 0 });
    expect(state.missing).toEqual([dependency]);
    expect(x.detail(minimalResponse(state, { attributable: true, pending: [], blocked: [], uncertain: [], emergencyStop: false }, x.f.c))).toContain(dependency);
  }
});

it('P11-NF-34 P11-NF-36 a caller cannot self-admit a minimal response by changing responseEligible', () => {
  const x = operatorFixture();
  const state = value(evaluateMinimalPath({ admitted: dependencies(['lease']), ordinaryUnavailable: [], inputPreserved: true,
    repairOwner: 'repair:lease', maximumExposure: 9 }, x.f.c));
  expect(x.detail(minimalResponse({ ...state, responseEligible: true },
    { attributable: true, pending: [], blocked: [], uncertain: [], emergencyStop: false }, x.f.c))).toContain('contradicts admitted dependencies');
});

it('P11-NF-34 P11-NF-39 an admitted emergency stop is narrow and an unknown identity never speaks as the agent', () => {
  const x = operatorFixture(), state = value(evaluateMinimalPath({ admitted: dependencies(), ordinaryUnavailable: [], inputPreserved: true,
    repairOwner: 'minimal-repair', maximumExposure: 0 }, x.f.c));
  expect(value(minimalResponse(state, { attributable: true, pending: [], blocked: [], uncertain: [], emergencyStop: true }, x.f.c))).toContain('Emergency stop');
  expect(x.detail(minimalResponse(state, { attributable: false, pending: [], blocked: [], uncertain: [], emergencyStop: false }, x.f.c))).toContain('cannot speak');
});

it('P11-NF-40 P11-NF-41 the four shared seams each name producer, consumer, record, transition order, fail direction and closure owner', () => {
  const x = operatorFixture();
  expect(value(validateSeamInventory(operatorSeams, x.f.c))).toBe('complete');
  expect(operatorSeams.map(row => row.seam)).toEqual(['authorization-completion', 'conversation-binding', 'minimal-plane', 'vertical-slice']);
});

it('P11-NF-41 P11-NF-42 shared traces never retry: uncertainty remains owned, duplicate digest conflicts, cancellation stays stopped, stale authority closes', () => {
  const x = operatorFixture(), base = { semanticIdentity: 'message:1', digests: ['d1'], applications: 1,
    stopCausallyPrior: false, owner: 'repair-owner', outcome: 'uncertain' as const, authorityCurrent: true };
  expect(value(resolveFailureTrace({ ...base, trace: 'crash-after-effect' }, x.f.c))).toMatchObject({ retry: false, state: 'owned-uncertain' });
  expect(value(resolveFailureTrace({ ...base, trace: 'duplicate-delivery', digests: ['d1', 'd2'] }, x.f.c))).toMatchObject({ conflict: true, state: 'authority-closed' });
  expect(value(resolveFailureTrace({ ...base, trace: 'cancellation-race', stopCausallyPrior: true }, x.f.c))).toMatchObject({ state: 'stopped' });
  expect(value(resolveFailureTrace({ ...base, trace: 'stale-authority', authorityCurrent: false }, x.f.c))).toMatchObject({ state: 'authority-closed' });
});
