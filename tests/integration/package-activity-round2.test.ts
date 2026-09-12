import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeAssemblyRecord, decodePackageActivityResult, resolvePackageActivity } from '../../src/assembly/index.js';
import type { AssemblyRecordName, PackageActivityResult, PackageTransition } from '../../src/assembly/index.js';
import type { FactEnvelope, FactStorePort } from '../../src/facts/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { packageActivityRuntimeFixture } from '../assembly/package-activity-fixture.js';

type Fixture = ReturnType<typeof packageActivityRuntimeFixture>;
type TransitionRow = Readonly<{ record: PackageTransition; fact: FactEnvelope }>;
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;
const fixture = () => packageActivityRuntimeFixture();

function signed<N extends AssemblyRecordName>(f: Fixture, name: N, overrides: object = {}) {
  const record = value(f.runtime.record(name, { ...clone(assemblyInput(name)), ...overrides }));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact;
  return { record, fact };
}

function appendUnchecked<N extends AssemblyRecordName>(f: Fixture, name: N, overrides: object) {
  const record = value(decodeAssemblyRecord(name, { ...clone(assemblyInput(name)), ...overrides }, { ...f.c, validateReferences: false }));
  return { record, fact: value(f.spine.append(record)).fact };
}

function step(f: Fixture, pkg: ReturnType<typeof signed<'LocalCapabilityPackage'>>, id: string,
  from: PackageTransition['from'], to: PackageTransition['to'], prior?: TransitionRow, extra: object = {}): TransitionRow {
  return signed(f, 'PackageTransition', { id, from, to, operation: `operation:${id}`, claim: `claim:${id}`,
    predecessors: prior ? [prior.fact.id] : [], dependencyFacts: prior ? [pkg.fact.id, prior.fact.id] : [pkg.fact.id], ...extra });
}

function chain(f: Fixture, until: PackageTransition['to'] = 'active') {
  const pkg = signed(f, 'LocalCapabilityPackage');
  const rows: Partial<Record<PackageTransition['to'], TransitionRow>> & { pkg: typeof pkg } = { pkg };
  let prior: TransitionRow | undefined; let from: PackageTransition['from'] = 'none';
  for (const to of ['staged', 'validated', 'eligible', 'activating', 'active'] as const) {
    prior = step(f, pkg, `transition:${to}`, from, to, prior); rows[to] = prior; from = to;
    if (to === until) break;
  }
  return rows;
}

function activity(f: Fixture, store: FactStorePort = f.store, clock: () => number = (() => { let now = 200; return () => now++; })()) {
  return value(resolvePackageActivity('alice.word-count', store, clock, f.c));
}

function rehash(input: PackageActivityResult): unknown {
  const { id: _id, identity: _identity, ...content } = clone(input);
  const identity = value(canonical(content));
  return { ...content, id: `package-activity:${identity.hash}`, identity };
}

it('P10-NF-43 unrelated-dependency-hides-active-branch remains unresolved because only lifecycle predecessors supersede heads', () => {
  const f = fixture(); const rows = chain(f); const pkg = rows.pkg;
  expect(activity(f).outcome.status).toBe('active');
  step(f, pkg, 'transition:fork-inhibited', 'staged', 'inhibited', rows.staged,
    { dependencyFacts: [pkg.fact.id, rows.staged!.fact.id, rows.active!.fact.id] });
  expect(activity(f).outcome).toEqual({ status: 'unresolved', reason: 'multi-head' });
}, 30_000);

it('P10-NF-41 P10-NF-43 incomplete-dependency cannot establish inactive package activity', () => {
  const f = fixture(); const rows = chain(f, 'staged');
  const partial = signed(f, 'GrowthObservation', { id: 'growth:partial', completion: 'incomplete', sampleCount: 0, timeouts: 1 });
  step(f, rows.pkg, 'transition:inhibited', 'staged', 'inhibited', rows.staged,
    { dependencyFacts: [rows.pkg.fact.id, rows.staged!.fact.id, partial.fact.id] });
  const result = activity(f);
  expect(result.outcome).toEqual({ status: 'unresolved', reason: 'incomplete' });
  expect(value(decodePackageActivityResult(clone(result), f.c)).outcome).toEqual(result.outcome);
}, 30_000);

it('P10-NF-41 P10-NF-43 wrong-owner-as-probe cannot establish active package activity', () => {
  const f = fixture(); const rows = chain(f, 'activating');
  const wrong = signed(f, 'GrowthPolicy');
  appendUnchecked(f, 'PackageTransition', { id: 'transition:wrong-probe', from: 'activating', to: 'active',
    operation: 'operation:wrong-probe', claim: 'claim:wrong-probe', predecessors: [rows.activating!.fact.id],
    dependencyFacts: [rows.pkg.fact.id, rows.activating!.fact.id], probeEvidence: [wrong.fact.id] });
  const result = activity(f);
  expect(result.outcome).toEqual({ status: 'unresolved', reason: 'conflicted' });
  expect(value(decodePackageActivityResult(clone(result), f.c)).outcome).toEqual(result.outcome);
}, 30_000);

it('P10-NF-41 P10-NF-43 active-manifest-mismatch and inhibited-manifest-mismatch remain unresolved', () => {
  const wrongManifest = `sha256:${'0'.repeat(64)}`;
  const active = fixture(); const activeRows = chain(active, 'activating');
  step(active, activeRows.pkg, 'transition:wrong-active-manifest', 'activating', 'active', activeRows.activating,
    { manifestDigest: wrongManifest });
  expect(activity(active).outcome).toEqual({ status: 'unresolved', reason: 'package-mismatch' });

  const inactive = fixture(); const inactiveRows = chain(inactive, 'staged');
  step(inactive, inactiveRows.pkg, 'transition:wrong-inactive-manifest', 'staged', 'inhibited', inactiveRows.staged,
    { manifestDigest: wrongManifest });
  expect(activity(inactive).outcome).toEqual({ status: 'unresolved', reason: 'package-mismatch' });
}, 30_000);

it('P10-NF-41 P10-NF-44 self-consistent checksums cannot forge contradictory or unwitnessed owner results', () => {
  const f = fixture(); chain(f); const control = activity(f);
  expect(value(decodePackageActivityResult(clone(control), f.c)).identity.hash).toBe(control.identity.hash);
  const mutations: ((value: Record<string, any>) => void)[] = [
    result => { result.evidence = { packages: [], transitions: [], heads: [] }; },
    result => { result.outcome = { status: 'inactive', transition: (result.outcome as any).transition, disposition: 'retired' }; },
    result => { (result.confirmedFrontier as any)['machine-a'].position++; },
    result => { result.namespace = 'mallory.foreign'; },
    result => { result.outcome = { ...(result.outcome as any), transition: 'machine-a:0:999999' }; result.evidence.heads = ['machine-a:0:999999']; },
  ];
  for (const mutate of mutations) {
    const candidate = clone(control) as unknown as Record<string, any>; mutate(candidate);
    refused(decodePackageActivityResult(rehash(candidate as unknown as PackageActivityResult), f.c));
  }
}, 30_000);

it('P10-NF-08 stale-snapshot-returned-twice foreign-snapshot-returned-twice and clock-append-after-second-read never settle activity', () => {
  const stale = fixture(); const staleRows = chain(stale, 'staged');
  const inhibited = step(stale, staleRows.pkg, 'transition:inhibited', 'staged', 'inhibited', staleRows.staged);
  const old = value(stale.store.readForProjection());
  const recovered = step(stale, staleRows.pkg, 'transition:recovered', 'inhibited', 'eligible', inhibited);
  const activating = step(stale, staleRows.pkg, 'transition:activating', 'eligible', 'activating', recovered);
  step(stale, staleRows.pkg, 'transition:active', 'activating', 'active', activating);
  const replay = Object.freeze({ ...stale.store, readForProjection: () => stale.success(old) });
  expect(activity(stale, replay).outcome).toEqual({ status: 'unresolved', reason: 'frontier-moved' });

  const foreign = fixture(); const foreignRows = chain(foreign, 'staged');
  step(foreign, foreignRows.pkg, 'transition:inhibited', 'staged', 'inhibited', foreignRows.staged);
  const foreignSnapshot = value(foreign.store.readForProjection());
  const local = fixture(); chain(local);
  const substituted = Object.freeze({ ...local.store, readForProjection: () => local.success(foreignSnapshot) });
  expect(activity(local, substituted).outcome).toEqual({ status: 'unresolved', reason: 'frontier-moved' });

  const moving = fixture(); const movingRows = chain(moving, 'staged');
  const movingInhibited = step(moving, movingRows.pkg, 'transition:inhibited', 'staged', 'inhibited', movingRows.staged);
  let calls = 0;
  const moved = activity(moving, moving.store, () => {
    if (calls++ === 1) step(moving, movingRows.pkg, 'transition:recovered', 'inhibited', 'eligible', movingInhibited);
    return 300 + calls;
  });
  expect(moved.outcome).toEqual({ status: 'unresolved', reason: 'frontier-moved' });
}, 30_000);

it('P10-NF-30 P10-NF-41 duplicate-canonical-package-fact preserves one equivalent immutable package identity', () => {
  const f = fixture(); const rows = chain(f);
  value(f.spine.append(rows.pkg.record));
  expect(activity(f).outcome).toMatchObject({ status: 'active', package: rows.pkg.fact.id });
}, 30_000);
