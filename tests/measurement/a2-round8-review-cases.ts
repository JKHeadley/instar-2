import { got, measurementA2Fixture as F, m, ok } from './a2-round4-review/common.js';

export type Round8Case = Readonly<{
  name: string;
  pass: boolean;
  actual?: unknown;
  exception?: string;
}>;

const cases: Round8Case[] = [];

function record(name: string, run: () => unknown,
  expected: (result: any) => boolean): void {
  try {
    const actual = run();
    cases.push({ name, pass: expected(actual), actual });
  } catch (error) {
    cases.push({ name, pass: false, exception: String(error) });
  }
}

function event(f: ReturnType<typeof F>, id: string, subject: string,
  amount: number, at: number, freshFor?: number) {
  let observation = f.planObservation({ subject, sourceEvent: id, amount, at,
    contract: f.eventProducer });
  if (freshFor !== undefined) {
    f.evidence.splice(f.evidence.findIndex((evidence: any) => evidence.id === id), 1);
    const evidence = f.admitEvidence(f.evidenceInput({ id, observedAt: f.clock(at),
      freshFor, claim: observation.evidence.claim }));
    observation = { ...observation, evidence,
      input: { ...observation.input, evidence } };
  }
  return observation;
}

const openEpisode = { state: 'open' as const, recoveryCount: 0,
  notified: true, investigation: 'existing' };

// Rereview6 F1: unavailable retained support remains audit evidence and cannot
// veto the distinct current witness that resolves the quantity used by the window.
for (const expired of [false, true]) {
  const f = F();
  const first = event(f, 'mixed:a', 'mixed:event', 17, 250,
    expired ? 30 : 1_000);
  const second = event(f, 'mixed:b', 'mixed:event', 23, 250);
  [first, second].forEach(f.persistObservation);
  const plan = f.persistBurnWindow({ id: 'mixed', start: 200, end: 400,
    samples: [{ identity: first.subject, feature: 'feature-a',
      source: 'programmatic-event', observations: [first, second] }],
    comparisonScopeAmount: expired ? 23 : 0 });
  const sourceHistory = f.snapshot();
  record(`mixed-freshness:${expired}:window-retains-valid-quantity`,
    () => m.createCurrentBurnWindow({ window: plan.build(sourceHistory), sourceHistory }, f.c),
    result => ok(result) && got(result).samples[0]?.quantities[0]?.state
      === (expired ? 'resolved' : 'unresolved')
      && got(result).samples[0]?.quantities[0]?.amount === (expired ? 23 : null));
}

// Rereview6 F2 variant one: evidence accepted at the baseline horizon may expire
// before use. It becomes named baseline debt instead of invalidating the operation.
for (const expired of [false, true]) {
  const f = F();
  const baseline = event(f, 'base:e', 'base:event', 17, 50,
    expired ? 160 : 1_000);
  const current = event(f, 'cur:e', 'cur:event', 151, 250);
  [baseline, current].forEach(f.persistObservation);
  const plan = (id: string, start: number, observation: typeof baseline) =>
    f.persistBurnWindow({ id, start, end: start + 200,
      samples: [{ identity: observation.subject, feature: 'feature-a',
        source: 'programmatic-event', observations: [observation] }],
      comparisonScopeAmount: observation.amount });
  const baselinePlan = plan('base', 0, baseline);
  const currentPlan = plan('current', 200, current);
  const sourceHistory = f.snapshot();
  const baselineWindow = got(m.createCurrentBurnWindow({
    window: baselinePlan.build(sourceHistory), sourceHistory }, f.c));
  const currentWindow = got(m.createCurrentBurnWindow({
    window: currentPlan.build(sourceHistory), sourceHistory }, f.c));
  record(`burn-expired-baseline:${expired}:retains-open-and-debt`,
    () => m.evaluateCurrentBurn(f.burnPolicy(), openEpisode,
      currentWindow, [baselineWindow], f.c),
    result => ok(result) && (expired
      ? got(result).episode.state === 'open'
        && got(result).episode.recoveryCount === 0
        && got(result).confidence === 'insufficient-evidence'
        && got(result).coverageDebt.some((debt: string) =>
          debt.includes('baseline:base:failed=') && debt.includes('unresolved:base:event'))
      : got(result).confidence === 'adequate'));
}

// Rereview6 F2 variant two: an owner resolution that expires after admitting the
// baseline loses its vote at use time while the fresh disagreeing witnesses remain.
for (const expired of [false, true]) {
  const f = F();
  const first = event(f, 'resolution-use:a', 'resolution-use:baseline', 29, 50);
  const second = event(f, 'resolution-use:b', 'resolution-use:baseline', 31, 50);
  const current = event(f, 'resolution-use:c', 'resolution-use:current', 100, 250);
  [first, second, current].forEach(f.persistObservation);
  const evidence = f.admitEvidence(f.evidenceInput({ id: 'resolution-use:owner',
    observedAt: f.clock(70), freshFor: expired ? 140 : 1_000,
    claim: { subject: first.identity, predicate: 'quantity-resolved',
      value: { amount: 30, witnesses: [first.sourceEvent, second.sourceEvent] } } }));
  f.append('measurement-evidence', { evidence }, f.clock(70));
  const baselinePlan = f.persistBurnWindow({ id: 'resolution-use:base', start: 0, end: 200,
    samples: [{ identity: first.subject, feature: 'feature-a',
      source: 'programmatic-event', observations: [first, second] }],
    comparisonScopeAmount: 30 });
  const currentPlan = f.persistBurnWindow({ id: 'resolution-use:current', start: 200, end: 400,
    samples: [{ identity: current.subject, feature: 'feature-a',
      source: 'programmatic-event', observations: [current] }],
    comparisonScopeAmount: 100 });
  const sourceHistory = f.snapshot();
  const baselineWindow = got(m.createCurrentBurnWindow({
    window: baselinePlan.build(sourceHistory), sourceHistory }, f.c));
  const currentWindow = got(m.createCurrentBurnWindow({
    window: currentPlan.build(sourceHistory), sourceHistory }, f.c));
  record(`resolution-use:${expired}:open-episode`,
    () => m.evaluateCurrentBurn(f.burnPolicy(), openEpisode,
      currentWindow, [baselineWindow], f.c),
    result => ok(result) && (expired
      ? got(result).episode.state === 'open'
        && got(result).episode.recoveryCount === 0
        && got(result).confidence === 'insufficient-evidence'
        && got(result).coverageDebt.some((debt: string) =>
          debt.includes('baseline:resolution-use:base:failed=')
            && debt.includes('unresolved:resolution-use:baseline'))
      : got(result).confidence === 'adequate'));
}

// Both expiration forms also reset a recovery sequence that was honestly at one
// before the baseline support became unavailable at the next consequential clock.
{
  const f = F();
  const baseTarget = event(f, 'reset-evidence:base-target', 'reset-evidence:base-target', 10, 50);
  const baseOther = event(f, 'reset-evidence:base-other', 'reset-evidence:base-other', 90, 50);
  const lowTarget = event(f, 'reset-evidence:low-target', 'reset-evidence:low-target', 0, 250, 160);
  const lowOther = event(f, 'reset-evidence:low-other', 'reset-evidence:low-other', 20, 250);
  const nextTarget = event(f, 'reset-evidence:next-target', 'reset-evidence:next-target', 100, 450);
  const nextOther = event(f, 'reset-evidence:next-other', 'reset-evidence:next-other', 0, 450);
  [baseTarget, baseOther, lowTarget, lowOther, nextTarget, nextOther].forEach(f.persistObservation);
  const plan = (id: string, start: number, target: typeof baseTarget,
    other: typeof baseTarget, comparisonScopeAmount: number) => f.persistBurnWindow({
    id, start, end: start + 200, comparisonScopeAmount,
    samples: [
      { identity: target.subject, feature: 'feature-a', source: 'programmatic-event',
        observations: [target] },
      { identity: other.subject, feature: 'comparison', source: 'programmatic-event',
        observations: [other] },
    ],
  });
  const plans = [plan('reset-evidence:base', 0, baseTarget, baseOther, 100),
    plan('reset-evidence:low', 200, lowTarget, lowOther, 20),
    plan('reset-evidence:next', 400, nextTarget, nextOther, 100)];
  const sourceHistory = f.snapshot();
  const [base, low, next] = plans.map(candidate => got(m.createCurrentBurnWindow({
    window: candidate.build(sourceHistory), sourceHistory }, f.c)));
  const recovering = got(m.evaluateCurrentBurn(f.burnPolicy(), openEpisode, low!, [base!], f.c));
  record('burn-expired-baseline:true:resets-existing-recovery',
    () => m.evaluateCurrentBurn(f.burnPolicy(), recovering.episode, next!, [low!], f.c),
    result => ok(result) && got(result).classification === 'insufficient-evidence'
      && got(result).episode.state === 'open' && got(result).episode.recoveryCount === 0
      && got(result).coverageDebt.some((debt: string) =>
        debt.includes('baseline:reset-evidence:low:failed=')
          && debt.includes('unresolved:reset-evidence:low-target')));
}

{
  const f = F();
  const baseTarget = event(f, 'reset-resolution:base-target', 'reset-resolution:base-target', 40, 50);
  const baseOther = event(f, 'reset-resolution:base-other', 'reset-resolution:base-other', 60, 50);
  const lowFirst = event(f, 'reset-resolution:low-a', 'reset-resolution:low-target', 29, 250);
  const lowSecond = event(f, 'reset-resolution:low-b', 'reset-resolution:low-target', 31, 250);
  const lowOther = event(f, 'reset-resolution:low-other', 'reset-resolution:low-other', 170, 250);
  const nextTarget = event(f, 'reset-resolution:next-target', 'reset-resolution:next-target', 100, 450);
  const nextOther = event(f, 'reset-resolution:next-other', 'reset-resolution:next-other', 0, 450);
  [baseTarget, baseOther, lowFirst, lowSecond, lowOther, nextTarget, nextOther]
    .forEach(f.persistObservation);
  const resolution = f.admitEvidence(f.evidenceInput({ id: 'reset-resolution:owner',
    observedAt: f.clock(270), freshFor: 140,
    claim: { subject: lowFirst.identity, predicate: 'quantity-resolved',
      value: { amount: 30, witnesses: [lowFirst.sourceEvent, lowSecond.sourceEvent] } } }));
  f.append('measurement-evidence', { evidence: resolution }, f.clock(270));
  const plan = (id: string, start: number,
    target: readonly typeof baseTarget[], other: typeof baseTarget,
    comparisonScopeAmount: number) => f.persistBurnWindow({
    id, start, end: start + 200, comparisonScopeAmount,
    samples: [
      { identity: target[0]!.subject, feature: 'feature-a', source: 'programmatic-event',
        observations: target },
      { identity: other.subject, feature: 'comparison', source: 'programmatic-event',
        observations: [other] },
    ],
  });
  const plans = [plan('reset-resolution:base', 0, [baseTarget], baseOther, 100),
    plan('reset-resolution:low', 200, [lowFirst, lowSecond], lowOther, 200),
    plan('reset-resolution:next', 400, [nextTarget], nextOther, 100)];
  const sourceHistory = f.snapshot();
  const [base, low, next] = plans.map(candidate => got(m.createCurrentBurnWindow({
    window: candidate.build(sourceHistory), sourceHistory }, f.c)));
  const recovering = got(m.evaluateCurrentBurn(f.burnPolicy(), openEpisode, low!, [base!], f.c));
  record('resolution-use:true:resets-existing-recovery',
    () => m.evaluateCurrentBurn(f.burnPolicy(), recovering.episode, next!, [low!], f.c),
    result => ok(result) && got(result).classification === 'insufficient-evidence'
      && got(result).episode.state === 'open' && got(result).episode.recoveryCount === 0
      && got(result).coverageDebt.some((debt: string) =>
        debt.includes('baseline:reset-resolution:low:failed=')
          && debt.includes('unresolved:reset-resolution:low-target')));
}

export const round8Cases = cases;
