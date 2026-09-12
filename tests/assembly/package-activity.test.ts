import { expect, it } from 'vitest';
import { decodePackageActivityResult, resolvePackageActivity } from '../../src/assembly/index.js';
import type { PackageActivityResult, PackageTransition } from '../../src/assembly/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

type Fixture = ReturnType<typeof assemblyRuntimeFixture>;
type TransitionRow = Readonly<{ record: PackageTransition; fact: FactEnvelope }>;
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;

function recordPackage(f: Fixture) {
  const record = value(f.runtime.record('LocalCapabilityPackage', clone(assemblyInput('LocalCapabilityPackage'))));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact;
  return { record, fact };
}

function transition(f: Fixture, pkg: ReturnType<typeof recordPackage>, id: string,
  from: PackageTransition['from'], to: PackageTransition['to'], prior?: TransitionRow): TransitionRow {
  const record = value(f.runtime.record('PackageTransition', { ...clone(assemblyInput('PackageTransition')), id,
    from, to, operation: `operation:${id}`, claim: `claim:${id}`,
    predecessors: prior ? [prior.fact.id] : [], dependencyFacts: prior ? [pkg.fact.id, prior.fact.id] : [pkg.fact.id] }));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === id)!.fact;
  return { record, fact };
}

function chainToActive(f: Fixture) {
  const pkg = recordPackage(f);
  const staged = transition(f, pkg, 'transition:staged', 'none', 'staged');
  const validated = transition(f, pkg, 'transition:validated', 'staged', 'validated', staged);
  const eligible = transition(f, pkg, 'transition:eligible', 'validated', 'eligible', validated);
  const activating = transition(f, pkg, 'transition:activating', 'eligible', 'activating', eligible);
  const active = transition(f, pkg, 'transition:active', 'activating', 'active', activating);
  return { pkg, staged, validated, eligible, activating, active };
}

function activity(f: Fixture) {
  let now = 100;
  return value(resolvePackageActivity('alice.word-count', f.store, () => now++, f.c));
}

it('P10-NF-41 P10-NF-43 P10-NF-44 package activity outcomes are closed, distinct, owner-issued, and canonically identified', () => {
  const activeFixture = assemblyRuntimeFixture(); chainToActive(activeFixture); const active = activity(activeFixture);
  expect(active.outcome.status).toBe('active');
  expect(active.id).toBe(`package-activity:${active.identity.hash}`);
  expect(JSON.parse(active.identity.bytes)).toMatchObject({ owner: 'part-ten', outcome: { status: 'active' } });
  expect(Object.isFrozen(active)).toBe(true);

  const inactiveFixture = assemblyRuntimeFixture(); const pkg = recordPackage(inactiveFixture);
  const staged = transition(inactiveFixture, pkg, 'transition:staged', 'none', 'staged');
  transition(inactiveFixture, pkg, 'transition:inhibited', 'staged', 'inhibited', staged);
  const inactive = activity(inactiveFixture); expect(inactive.outcome).toMatchObject({ status: 'inactive', disposition: 'inhibited' });

  const unresolvedFixture = assemblyRuntimeFixture(); recordPackage(unresolvedFixture);
  const unresolved = activity(unresolvedFixture); expect(unresolved.outcome).toEqual({ status: 'unresolved', reason: 'incomplete' });
  expect(new Set([active.outcome.status, inactive.outcome.status, unresolved.outcome.status])).toEqual(new Set(['active', 'inactive', 'unresolved']));

  // @ts-expect-error PackageActivityResult construction is owner-closed behind its decoder brand.
  const forged: PackageActivityResult = { type: 'PackageActivityResult' };
  expect(forged.type).toBe('PackageActivityResult');
});

it('P10-NF-41 P10-NF-44 malformed package activity values are typed refusals, never widened outcomes', () => {
  const f = assemblyRuntimeFixture(); chainToActive(f); const valid = activity(f);
  const cases = [
    { ...clone(valid), owner: 'caller' },
    { ...clone(valid), outcome: { status: 'inactive', transition: 'transition:1', disposition: 'staged' } },
    { ...clone(valid), outcome: { status: 'maybe', reason: 'absent' } },
    { ...clone(valid), completedAt: valid.startedAt - 1 },
    { ...clone(valid), identity: { ...valid.identity, bytes: '{}' } },
    { ...clone(valid), extra: true },
  ];
  for (const input of cases) refused(decodePackageActivityResult(input, f.c));
});

it('P10-NF-43 a staged or recovered head and an incomplete causal transition are unresolved, never inactive', () => {
  const stagedFixture = assemblyRuntimeFixture(); const pkg = recordPackage(stagedFixture);
  const staged = transition(stagedFixture, pkg, 'transition:staged', 'none', 'staged');
  expect(activity(stagedFixture).outcome).toEqual({ status: 'unresolved', reason: 'nonterminal-head' });
  const inhibited = transition(stagedFixture, pkg, 'transition:inhibited', 'staged', 'inhibited', staged);
  expect(activity(stagedFixture).outcome.status).toBe('inactive');
  transition(stagedFixture, pkg, 'transition:recovered', 'inhibited', 'staged', inhibited);
  expect(activity(stagedFixture).outcome).toEqual({ status: 'unresolved', reason: 'nonterminal-head' });

  const incomplete = assemblyRuntimeFixture(); const incompletePkg = recordPackage(incomplete);
  transition(incomplete, incompletePkg, 'transition:orphan-active', 'activating', 'active');
  expect(activity(incomplete).outcome).toEqual({ status: 'unresolved', reason: 'incomplete' });
});
