import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodePackageActivityResult, resolvePackageActivity } from '../../src/assembly/index.js';
import type { AssemblyRecordName, PackageActivityResult, PackageTransition } from '../../src/assembly/index.js';
import { decodeCheckRun } from '../../src/register/index.js';
import type { FactEnvelope, FactStorePort } from '../../src/facts/index.js';
import { value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { packageActivityRuntimeFixture } from '../assembly/package-activity-fixture.js';

type Fixture = ReturnType<typeof packageActivityRuntimeFixture>;
type TransitionRow = Readonly<{ record: PackageTransition; fact: FactEnvelope }>;
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;
const admission = (input: any): 'accepted' | 'refused' => consumeResult(input, {
  Success: (): 'accepted' | 'refused' => 'accepted', Refused: (): 'accepted' | 'refused' => 'refused',
});

function signed<N extends AssemblyRecordName>(f: Fixture, name: N, overrides: object = {}) {
  const record = value(f.runtime.record(name, { ...clone(assemblyInput(name)), ...overrides }));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact;
  return { record, fact };
}

function step(f: Fixture, pkg: ReturnType<typeof signed<'LocalCapabilityPackage'>>, to: PackageTransition['to'],
  prior?: TransitionRow, overrides: object = {}): TransitionRow {
  return signed(f, 'PackageTransition', { id: `transition:${to}`, from: prior?.record.to ?? 'none', to,
    operation: `operation:${to}`, claim: `claim:${to}`, predecessors: prior ? [prior.fact.id] : [],
    dependencyFacts: prior ? [pkg.fact.id, prior.fact.id] : [pkg.fact.id], ...overrides });
}

function chain(f: Fixture, end: PackageTransition['to'] = 'active', first: object = {}) {
  const pkg = signed(f, 'LocalCapabilityPackage'); const rows: Record<string, TransitionRow> = {}; let prior: TransitionRow | undefined;
  for (const to of ['staged', 'validated', 'eligible', 'activating', 'active', 'retired'] as const) {
    prior = step(f, pkg, to, prior, to === 'staged' ? first : {}); rows[to] = prior;
    if (to === end) break;
  }
  return { pkg, rows };
}

function activity(f: Fixture, store: FactStorePort = f.store) {
  let now = 300;
  return value(resolvePackageActivity('alice.word-count', store, () => now++, f.c));
}

function rehash(input: PackageActivityResult): unknown {
  const { id: _id, identity: _identity, ...content } = clone(input);
  const identity = value(canonical(content));
  return { ...content, id: `package-activity:${identity.hash}`, identity };
}

it('R3-F1 P10-NF-08 P10-NF-43 stale-clean-snapshot copied-snapshot-taint-stripped and prefix-read-capture-loss stay unresolved', () => {
  for (const mode of ['stale-clean-snapshot', 'copied-snapshot-taint-stripped', 'prefix-read-capture-loss'] as const) {
    const f = packageActivityRuntimeFixture(); chain(f, 'retired'); const clean = value(f.store.readForProjection());
    expect(activity(f).outcome.status).toBe('inactive');
    if (mode !== 'prefix-read-capture-loss')
      for (const reference of Object.keys(f.context.decode.captures)) delete (f.context.decode.captures as Record<string, unknown>)[reference];
    const store: FactStorePort = mode === 'prefix-read-capture-loss'
      ? { ...f.store, verifiedPrefix: () => {
        for (const reference of Object.keys(f.context.decode.captures)) delete (f.context.decode.captures as Record<string, unknown>)[reference];
        return f.store.verifiedPrefix();
      } }
      : { ...f.store, readForProjection: () => f.success(mode === 'stale-clean-snapshot' ? clean : {
        entries: clean.entries.map(entry => ({ ...entry, taint: [], conflicts: [] })),
      } as unknown as typeof clean) };
    expect(activity(f, store).outcome.status, mode).toBe('unresolved');
  }
}, 60_000);

it('R3-F2 P10-NF-08 P10-NF-44 invented-equal-frontier and stale-frontier-unrelated-append are refused against current owner history', () => {
  const invented = packageActivityRuntimeFixture(); chain(invented); const candidate = clone(activity(invented)) as any;
  candidate.frontier['machine-a']!.position += 1000; candidate.confirmedFrontier = clone(candidate.frontier);
  expect(admission(decodePackageActivityResult(rehash(candidate), invented.c))).toBe('refused');

  const stale = packageActivityRuntimeFixture(); chain(stale); const prior = activity(stale);
  signed(stale, 'GrowthPolicy', { id: 'growth:later', storeScope: 'other:scope' });
  expect(admission(decodePackageActivityResult(prior, stale.c))).toBe('refused');
}, 60_000);

it('R3-F3 P10-NF-41 P10-NF-43 P10-NF-44 ancestor-wrong-owner-roundtrip accepts owner unresolved and ancestor-wrong-owner-forged-active refuses', () => {
  const f = packageActivityRuntimeFixture(); const rows = chain(f, 'active', { probeEvidence: ['check:unit'] });
  const result = activity(f); expect(result.outcome).toEqual({ status: 'unresolved', reason: 'conflicted' });
  expect(admission(decodePackageActivityResult(result, f.c))).toBe('accepted');
  const forged = clone(result) as PackageActivityResult;
  (forged as unknown as { outcome: unknown }).outcome = { status: 'active', package: rows.pkg.fact.id, transition: rows.rows.active!.fact.id };
  expect(admission(decodePackageActivityResult(rehash(forged), f.c))).toBe('refused');
}, 60_000);

it('R3-F4 P10-NF-44 fabricated-frontier-moved-no-owner is refused', () => {
  const f = packageActivityRuntimeFixture(); chain(f); const input = clone(activity(f)) as PackageActivityResult;
  Object.assign(input, { namespace: 'unwitnessed.namespace', frontier: {}, confirmedFrontier: {},
    evidence: { packages: [], transitions: [], heads: [] }, outcome: { status: 'unresolved', reason: 'frontier-moved' } });
  const { history: _history, ...withoutHistory } = f.c;
  expect(admission(decodePackageActivityResult(rehash(input), withoutHistory))).toBe('refused');
}, 30_000);

it('R3-F5 P10-NF-30 P10-NF-43 duplicate-canonical-transition is replay-equivalent while a distinct fork remains multi-head', () => {
  const f = packageActivityRuntimeFixture(); const rows = chain(f); expect(activity(f).outcome.status).toBe('active');
  value(f.spine.append(rows.rows.active!.record));
  expect(activity(f).outcome.status).toBe('active');
  step(f, rows.pkg, 'inhibited', rows.rows.staged, { id: 'transition:distinct-fork', operation: 'operation:distinct-fork', claim: 'claim:distinct-fork' });
  expect(activity(f).outcome).toEqual({ status: 'unresolved', reason: 'multi-head' });
}, 60_000);

it('R3-F6 P10-NF-41 positive-check-run-owner uses complete records accepted by Part Three and the activity port', () => {
  const f = packageActivityRuntimeFixture(); chain(f); expect(activity(f).outcome.status).toBe('active');
  const checks = value(f.store.read()).filter(fact => fact.kind === 'check-run-record');
  const owner = { ...f.c, register: f.context.decode.register, types: f.context.decode,
    shape: { factSchemas: [] }, provenance: f.alice.provenance,
    source: { path: 'tests/assembly/package-activity-fixture.ts', symbol: 'CheckRunRecord' } } as any;
  expect(checks.length).toBeGreaterThan(0);
  for (const fact of checks) expect(admission(decodeCheckRun((fact.body as any).record, owner))).toBe('accepted');
}, 30_000);
