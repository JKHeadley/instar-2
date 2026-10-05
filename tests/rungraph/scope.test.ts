import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { decodeRunGraphRegistration } from '../../src/rungraph/index.js';
import { setup as registerFixture } from '../register/fixtures.js';
import { governanceFixture } from './governance-fixture.js';
import { setup, value, refused } from './fixtures.js';

// These rows must be present in actual Vitest output, not a prose coverage claim.
const residuals = [
  ['06', 'recursive graphs, owning parents and dependency edges are not built'],
  ['10', 'real six lease/fence lifecycle composition is owned by six and eleven'],
  ['14', 'ancestor and concurrent child allocation is not built'],
  ['15', 'real physical-capacity and spend reservation realization belongs to six/eight'],
  ['16', 'six real loop/brake realization is not built in this package'],
  ['18', 'child settlement and accepted responsibility transfer are not built'],
  ['19', 'late child collection is not built'],
  ['20', 'operator/requester and Directive closure realization belongs to four; no cancellation API'],
  ['21', 'remote/full-cancellation races are not built; local stop/completed and authorized resume are tested'],
  ['22', 'judgment-driven question work is not built'],
  ['23', 'exhaustion/escalation records are not built'],
  ['24', 'exhaustive impossibility and lawful-avenue exploration are not built'],
  ['25', 'boundary-review autonomous continuation loop is not built'],
  ['26', 'awaiting-authorization is not built'],
  ['27', 'authorization expiry and reminder custody are not built'],
  ['28', 'late approval and authorization resume are not built'],
  ['29', 'real six ownership/resource/recovery adapter composition remains six/eleven integration'],
  ['30', 'owning delegation edges and offers are not built'],
  ['31', 'delegated subsets and sub-delegation are not built'],
  ['32', 'delegation question/constraints and review records are not built'],
  ['33', 'delegated worker placement is not built'],
  ['34', 'DelegationResult is not built'],
  ['35', 'terminal child collection is not built'],
  ['36', 'agent transport/delegation adapter is not built'],
  ['37', 'remote delivery evidence is not built'],
  ['38', 'remote authenticated delegation is not built'],
  ['39', 'remote semantic message/peer authority is not built'],
  ['40', 'remote delivery witness refinement is not built'],
  ['41', 'agent transport acceptance/task-result handoff is not built'],
  ['42', 'transport queue/tombstone custody is not built'],
  ['43', 'peer concurrence is not built'],
  ['45', 'above-threshold summaries are not built; full-history threshold refuses'],
  ['46', 'post-compaction continuity accounting is not built'],
  ['47', 'compaction briefing parity is not built; actual-start classes are checked'],
  ['49', 'independent production communication/stop surfaces are eleven/four integration'],
  ['50', 'remote and nested child crash traces are not built'],
  ['54', 'entering-force governed production assembly remains three/eleven; shape registration is tested'],
  ['55', 'production probes and supervision remain eleven integration; scoped test metrics are measured'],
  ['56', 'real-surface vertical slice assembly remains eleven integration; public core lifecycle is tested'],
  ['59', 'seven provider attempts and eight real dispatch boundary are not built here'],
  ['60', 'seven attempt mapping and six/eight real credit release are not built here'],
] as const;
it.skip.each(residuals)('P5-NF-%s SKIPPED: out of slice scope — %s', () => {});

it('P5-NF-01 P5-NF-48 one owner inventory and every public seam have six-field closure records', () => {
  const doc = readFileSync('src/rungraph/README.md', 'utf8');
  for (const type of ['Run', 'RunBudget', 'RunStep', 'RunTransition', 'RunExit', 'SessionGrounding']) expect(doc).toContain('`' + type + '`');
  const rows = doc.split('\n').filter(line => /^\| (One|Two|Three|Four|Five|Six|Eight|Nine|Ten)/.test(line));
  expect(rows).toHaveLength(11); for (const row of rows) expect(row.split('|').slice(1, -1)).toHaveLength(6);
  const sources = readdirSync('src/rungraph').filter(p => p.endsWith('.ts')).map(p => readFileSync('src/rungraph/' + p, 'utf8')).join('\n');
  expect(sources).not.toMatch(/from ['"]\.\.\/(?:facts|register|projections)\/(?!index\.js)/);
  expect(sources).not.toMatch(/\b(?:Date\.now|process\.|fetch\(|setInterval\()/);
});
it('P5-NF-54 P3 validates the actual colocated feature declaration; wrong profiles refuse', () => {
  const registration = JSON.parse(readFileSync('src/rungraph/rungraph.declarations.json', 'utf8'))[0];
  const f = registerFixture(), register = { ...f.context.types.register, entries: [...f.context.register.entries, 'rungraph.bound'] };
  const context = { ...f.context, register, types: { ...f.context.types, register }, references: [...f.context.references!, { provider: 'fixture', id: 'P5-NF-54' }],
    source: { path: 'src/rungraph/rungraph.declarations.json', symbol: 'rungraph-core' } };
  expect(value(decodeRunGraphRegistration(registration, context)).id).toBe('rungraph-core');
  expect(registration.status).toBe('dark');
  expect(registration.requiredFacts.liveProof).toBeUndefined();
  for (const profile of [{ consequence: 'none' }, { reversibility: 'reversible' }, { reach: 'internal' },
    { surface: 'none' }, { repeats: { kind: 'no' } }])
    refused(decodeRunGraphRegistration({ ...registration, profile: { ...registration.profile, ...profile } }, context), 'understates');
  for (const status of ['live', 'soaking'])
    refused(decodeRunGraphRegistration({ ...registration, status }, context), 'liveProof');
  refused(decodeRunGraphRegistration({ ...registration, requiredFacts: { metrics: registration.requiredFacts.metrics } }, context), 'object');
  expect(registration.requiredFacts.gate).toEqual({ test: 'P5-NF-54', deadline: Date.parse('2030-01-01T00:00:00Z') });
  // Resolution belongs to the real P3 generation path, not the shape decoder.
  const run = setup();
  expect(() => governanceFixture(run.c, declarations => declarations.map(d => d.id === 'rungraph-core'
    ? { ...d, requiredFacts: { ...d.requiredFacts, liveProof: 'unavailable:production' } } : d)))
    .toThrow('unresolved rungraph-core.liveProof');
});
it('P5-NF-55 P5-NF-55-PARTIAL scoped live-core workload measures fold latency, retained facts, pending and conflicts', () => {
  const f = setup(), ready = value(f.graph.open(f.run)), g = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  value(f.graph.transition(f.start(ready, g)));
  const start = performance.now(), view = value(f.graph.read(f.id)), foldMs = performance.now() - start;
  const metrics = { 'rungraph.fold-ms': foldMs, 'rungraph.fact-count': value(f.store.read()).length,
    'rungraph.pending-count': view.pending.length, 'rungraph.conflict-count': view.conflicts.length };
  // Five seconds budgets the signed multi-record fold on CI; it is not model or
  // external provider latency. This is the stated single-step slice workload.
  expect(metrics['rungraph.fold-ms']).toBeLessThan(5000);
  expect(metrics['rungraph.fact-count']).toBe(5); expect(metrics['rungraph.pending-count']).toBe(1); expect(metrics['rungraph.conflict-count']).toBe(0);
});
it('P5-NF-57 inherited residuals name owners, revisit loop, evidence and calendar ceiling', () => {
  const doc = readFileSync('src/rungraph/README.md', 'utf8');
  for (const token of ['Designed, not yet built', 'eleven', 'six/eight', 'seven', '2026-10-05', 'orchestration/review loop', 'real port/lifecycle evidence']) expect(doc).toContain(token);
});
it('P5-NF-58 the authoritative design has exactly sixty rows and scoped skips retain explicit reasons', () => {
  const design = readFileSync('docs/09-the-run-graph.md', 'utf8');
  const ids = [...design.matchAll(/^\| (P5-NF-\d+) \|/gm)].map(m => m[1]);
  expect(new Set(ids).size).toBe(60);
  for (const [id, reason] of residuals) { expect(ids).toContain(`P5-NF-${id}`); expect(reason.length).toBeGreaterThan(20); }
  expect(new Set(residuals.map(r => r[0])).size).toBe(residuals.length);
});
