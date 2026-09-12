import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeAssemblyRecord, resolvePackageActivity } from '../../src/assembly/index.js';
import type { AssemblyRecordName, PackageTransition } from '../../src/assembly/index.js';
import type { FactEnvelope, FactStorePort } from '../../src/facts/index.js';
import { value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { packageActivityRuntimeFixture } from '../assembly/package-activity-fixture.js';

type Fixture = ReturnType<typeof packageActivityRuntimeFixture>;
type TransitionRow = Readonly<{ record: PackageTransition; fact: FactEnvelope }>;
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;
const fixture = () => packageActivityRuntimeFixture();

function signed<N extends AssemblyRecordName>(f: Fixture, name: N, input: object) {
  const record = value(f.runtime.record(name, input));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact;
  return { record, fact };
}

function recordPackage(f: Fixture, overrides: object = {}) {
  return signed(f, 'LocalCapabilityPackage', { ...clone(assemblyInput('LocalCapabilityPackage')), ...overrides });
}

function transition(f: Fixture, pkg: ReturnType<typeof recordPackage>, id: string,
  from: PackageTransition['from'], to: PackageTransition['to'], prior?: TransitionRow): TransitionRow {
  return signed(f, 'PackageTransition', { ...clone(assemblyInput('PackageTransition')), id, from, to,
    operation: `operation:${id}`, claim: `claim:${id}`,
    predecessors: prior ? [prior.fact.id] : [], dependencyFacts: prior ? [pkg.fact.id, prior.fact.id] : [pkg.fact.id] });
}

function resolve(f: Fixture, store: FactStorePort = f.store) {
  let now = 200;
  return value(resolvePackageActivity('alice.word-count', store, () => now++, f.c));
}

function activeChain(f: Fixture) {
  const pkg = recordPackage(f);
  const staged = transition(f, pkg, 'transition:staged', 'none', 'staged');
  const validated = transition(f, pkg, 'transition:validated', 'staged', 'validated', staged);
  const eligible = transition(f, pkg, 'transition:eligible', 'validated', 'eligible', validated);
  const activating = transition(f, pkg, 'transition:activating', 'eligible', 'activating', eligible);
  const active = transition(f, pkg, 'transition:active', 'activating', 'active', activating);
  return { pkg, staged, validated, eligible, activating, active };
}

it('P10-NF-30 P10-NF-41 P10-NF-43 P10-NF-44 full Part Ten runtime and Part Two store resolve every package lifecycle head', () => {
  const f = fixture();
  expect(resolve(f).outcome).toEqual({ status: 'unresolved', reason: 'absent' });
  const pkg = recordPackage(f);
  expect(resolve(f).outcome).toEqual({ status: 'unresolved', reason: 'incomplete' });
  const staged = transition(f, pkg, 'transition:staged', 'none', 'staged');
  expect(resolve(f).outcome).toEqual({ status: 'unresolved', reason: 'nonterminal-head' });
  const inhibited = transition(f, pkg, 'transition:inhibited', 'staged', 'inhibited', staged);
  expect(resolve(f).outcome).toMatchObject({ status: 'inactive', disposition: 'inhibited' });
  const recovered = transition(f, pkg, 'transition:recovered', 'inhibited', 'staged', inhibited);
  expect(resolve(f).outcome).toEqual({ status: 'unresolved', reason: 'nonterminal-head' });
  const validated = transition(f, pkg, 'transition:validated', 'staged', 'validated', recovered);
  expect(resolve(f).outcome).toEqual({ status: 'unresolved', reason: 'nonterminal-head' });
  const eligible = transition(f, pkg, 'transition:eligible', 'validated', 'eligible', validated);
  expect(resolve(f).outcome).toEqual({ status: 'unresolved', reason: 'nonterminal-head' });
  const activating = transition(f, pkg, 'transition:activating', 'eligible', 'activating', eligible);
  expect(resolve(f).outcome).toEqual({ status: 'unresolved', reason: 'nonterminal-head' });
  const active = transition(f, pkg, 'transition:active', 'activating', 'active', activating);
  expect(resolve(f).outcome).toMatchObject({ status: 'active', package: pkg.fact.id, transition: active.fact.id });
  const retired = transition(f, pkg, 'transition:retired', 'active', 'retired', active);
  expect(resolve(f).outcome).toMatchObject({ status: 'inactive', disposition: 'retired', transition: retired.fact.id });
}, 60_000);

it('P10-NF-43 conflicts, multi-heads, incomplete references, taint, and mismatched active artifacts remain unresolved', () => {
  const fork = fixture(); const forkPkg = recordPackage(fork);
  const staged = transition(fork, forkPkg, 'transition:staged', 'none', 'staged');
  transition(fork, forkPkg, 'transition:branch-a', 'staged', 'validated', staged);
  transition(fork, forkPkg, 'transition:branch-b', 'staged', 'inhibited', staged);
  expect(resolve(fork).outcome).toEqual({ status: 'unresolved', reason: 'multi-head' });

  const conflict = fixture(); recordPackage(conflict);
  const changed = value(decodeAssemblyRecord('LocalCapabilityPackage', { ...clone(assemblyInput('LocalCapabilityPackage')),
    sourceDigest: `sha256:${'a'.repeat(64)}` }, { ...conflict.c, validateReferences: false }));
  value(conflict.spine.append(changed));
  expect(resolve(conflict).outcome).toEqual({ status: 'unresolved', reason: 'conflicted' });

  const incomplete = fixture();
  const incompleteRecord = value(decodeAssemblyRecord('LocalCapabilityPackage', { ...clone(assemblyInput('LocalCapabilityPackage')),
    priorPackage: 'package:missing' }, { ...incomplete.c, validateReferences: false }));
  const incompleteFact = value(incomplete.spine.append(incompleteRecord)).fact;
  transition(incomplete, { record: incompleteRecord, fact: incompleteFact }, 'transition:staged', 'none', 'staged');
  expect(resolve(incomplete).outcome).toEqual({ status: 'unresolved', reason: 'incomplete' });

  const mismatchedActive = value(decodeAssemblyRecord('PackageTransition', { ...clone(assemblyInput('PackageTransition')), id: 'transition:active-mismatch',
    operation: 'operation:active-mismatch', claim: 'claim:active-mismatch', observedArtifactDigest: `sha256:${'0'.repeat(64)}`,
    from: 'activating', to: 'active', predecessors: [], dependencyFacts: [] }, { ...incomplete.c, validateReferences: false }));
  // Replace the clean active head with a distinct fixture so immutable conflict
  // does not hide the exact artifact-mismatch outcome under test.
  const mismatchOnly = fixture(); const mismatchPkg = recordPackage(mismatchOnly);
  const s = transition(mismatchOnly, mismatchPkg, 'mismatch:staged', 'none', 'staged');
  const v = transition(mismatchOnly, mismatchPkg, 'mismatch:validated', 'staged', 'validated', s);
  const e = transition(mismatchOnly, mismatchPkg, 'mismatch:eligible', 'validated', 'eligible', v);
  const a = transition(mismatchOnly, mismatchPkg, 'mismatch:activating', 'eligible', 'activating', e);
  value(mismatchOnly.spine.append(value(decodeAssemblyRecord('PackageTransition', { ...mismatchedActive,
    predecessors: [a.fact.id], dependencyFacts: [mismatchPkg.fact.id, a.fact.id] }, { ...mismatchOnly.c, validateReferences: false }))));
  expect(resolve(mismatchOnly).outcome).toEqual({ status: 'unresolved', reason: 'package-mismatch' });

  const tainted = fixture(); recordPackage(tainted);
  for (const reference of Object.keys(tainted.context.decode.captures))
    delete (tainted.context.decode.captures as Record<string, string>)[reference];
  expect(resolve(tainted).outcome).toEqual({ status: 'unresolved', reason: 'tainted' });
}, 60_000);

it('P10-NF-08 P10-NF-30 P10-NF-43 use-time re-resolution observes later activation and reports a moved frontier as unresolved', () => {
  const f = fixture(); const pkg = recordPackage(f);
  const staged = transition(f, pkg, 'transition:staged', 'none', 'staged');
  const inhibited = transition(f, pkg, 'transition:inhibited', 'staged', 'inhibited', staged);
  const cached = resolve(f); expect(cached.outcome.status).toBe('inactive');
  const recovered = transition(f, pkg, 'transition:recovered', 'inhibited', 'eligible', inhibited);
  const activating = transition(f, pkg, 'transition:activating', 'eligible', 'activating', recovered);
  transition(f, pkg, 'transition:active', 'activating', 'active', activating);
  expect(resolve(f).outcome.status).toBe('active');

  const moving = fixture(); const active = activeChain(moving); let reads = 0;
  const movingStore: FactStorePort = Object.freeze({ ...moving.store, readForProjection: () => {
    const snapshot = moving.store.readForProjection();
    if (reads++ === 0) transition(moving, active.pkg, 'transition:retired', 'active', 'retired', active.active);
    return snapshot;
  } });
  const result = resolve(moving, movingStore);
  expect(result.outcome).toEqual({ status: 'unresolved', reason: 'frontier-moved' });
  expect(result.frontier).not.toEqual(result.confirmedFrontier);
  expect(consumeResult(resolvePackageActivity('alice.word-count', moving.store, () => -1, moving.c), {
    Success: () => false, Refused: refusal => refusal.detail.includes('start clock'),
  })).toBe(true);
}, 60_000);
