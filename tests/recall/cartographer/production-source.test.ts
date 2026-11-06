import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { factsFixture, privateKey, refused, value } from '../../facts/fixtures.js';
import { assemblyInput } from '../../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../../assembly/runtime-fixture.js';
import { createFactStore } from '../../../src/facts/index.js';
import { createAssemblyRuntime, createAssemblySpine, decodeStoreCustodyPolicy } from '../../../src/assembly/index.js';
import { openProductionStorage } from '../../../src/assembly/production-storage.js';
import type { ProductionCustodyReadInput } from '../../../src/assembly/production-custody-wiring.js';
import { captureCommittedCartographerSource, createProductionCartographerSource } from '../../../src/assembly/production-cartographer-source.js';
import { composeProductionCartographer } from '../../../src/assembly/production-cartographer.js';
import { cartographerObservationSchema } from '../../../src/recall/cartographer/tree.js';
// @ts-expect-error Host operations are outside the pure core.
import { productionStorageIO } from '../../../scripts/production-boot-io.mjs';
// @ts-expect-error The real bounded Git producer is an installed host module.
import { readCommittedCartographerCapture } from '../../../scripts/cartographer-committed-source.mjs';
const clean: (() => void)[] = [];
afterEach(() => { while (clean.length) clean.pop()!(); });
function world() {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'c95-source-')));
  clean.push(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  writeFileSync(join(repo, 'TelegramAdapter.ts'), 'export class TelegramAdapter {}\n');
  writeFileSync(join(repo, '.env'), 'DO_NOT_READ=this_is_not_a_real_secret\n');
  git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'source');
  let stopped = false, lease = true, generation = 'generation:1', now = 100, admissions = 0;
  const captured = readCommittedCartographerCapture({ root: repo, stopped: () => stopped,
    admit: (requested: string) => { expect(requested).toBe(repo); admissions++; return true; } });
  const policy = value(decodeStoreCustodyPolicy({ ...assemblyInput('StoreCustodyPolicy'), readOperation: 'work',
    grants: [f.g.id], resourceBound: 2097152 }, f.c));
  const storage = value(openProductionStorage({ root: join(root, 'custody'), machine: 'machine-a', key: Buffer.alloc(32),
    policy: policy.id, store: policy.store, context: f.c, io: productionStorageIO }));
  clean.push(storage.close);
  const observed = assemblyRuntimeFixture(() => storage.segment);
  const context = { ...observed.context, schemas: [...observed.context.schemas, cartographerObservationSchema(f.scope)] };
  const store = createFactStore(context, storage.segment);
  const host = { ...observed.host, current: () => ({ ...observed.host.current(), facts: context }) };
  const spine = createAssemblySpine(host, { context, privateKey }, store);
  const runtime = createAssemblyRuntime({ ...observed.composition, host, spine, persistence: storage.persistence });
  value(runtime.record('StoreCustodyPolicy', policy));
  const binding = { requester: f.alice.id, incarnation: 'worker:1', grant: f.g.id, scope: policy.disclosureScopes[0]!,
    disclosure: f.scope, generation, validUntil: 200, positions: [] as string[] };
  const custody: ProductionCustodyReadInput = { storage, policy, context: f.c, observations: runtime, binding,
    authenticatedPeer: () => ({ requester: f.alice.id, incarnation: 'worker:1' }),
    current: () => ({ decode: f.ctx.decode, clock: f.clock(now), generation, stopped }) };
  const capture = value(captureCommittedCartographerSource({ custody, ...captured, expectedPhysicalHead: null }));
  binding.positions.push(capture.position);
  let revision = captured.revision as string;
  const sourceInput = { custody, capture, topic: 'fixture-topic', current: () => ({ root: repo, revision, stopped, holdsLease: lease }) };
  const source = createProductionCartographerSource(sourceInput);
  return { f, root, repo, git, storage, captured, capture, custody, source, sourceInput, context, store, admissions: () => admissions,
    set: (change: { stopped?: boolean; lease?: boolean; revision?: string; generation?: string; now?: number }) => {
      stopped = change.stopped ?? stopped; lease = change.lease ?? lease; revision = change.revision ?? revision;
      generation = change.generation ?? generation; now = change.now ?? now;
    } };
}
describe('committed producer through physical custody and production Awareness', () => {
  it('uses Git bytes, durable exact positions and current mediated standing', () => {
    const w = world();
    expect(w.admissions()).toBeGreaterThan(0);
    const page = value(w.source.page(w.capture.revision, null, 32));
    expect(page.nodes.map(n => n.path)).toEqual(['', 'TelegramAdapter.ts']);
    expect(page.source).toBe(w.capture.position);
    writeFileSync(join(w.repo, 'TelegramAdapter.ts'), 'WORKTREE CONTENT MUST NOT BE READ');
    const content = value(w.source.content(w.capture.revision, 'TelegramAdapter.ts', 100));
    expect(content.text).toBe('export class TelegramAdapter {}\n');
    expect(value(w.source.oids(w.capture.revision, ['TelegramAdapter.ts'])).get('TelegramAdapter.ts')).toBe(content.oid);
    const facts = value(w.store.read());
    expect(facts.some(row => row.kind === 'assembly-StorageAccessObservation')).toBe(true);
    expect(content.source).toBe(w.capture.position);
  });
  it.each(['stop', 'lease', 'revision', 'generation', 'expiry', 'scope', 'position'] as const)('refuses %s without disclosure', kind => {
    const w = world();
    if (kind === 'stop') w.set({ stopped: true });
    if (kind === 'lease') w.set({ lease: false });
    if (kind === 'revision') w.set({ revision: 'b'.repeat(40) });
    if (kind === 'generation') w.set({ generation: 'generation:2' });
    if (kind === 'expiry') w.set({ now: 200 });
    if (kind === 'position') {
      const source = createProductionCartographerSource({ ...w.sourceInput, custody: { ...w.custody,
        binding: { ...w.custody.binding, positions: [] } } });
      expect(refused(source.page(w.capture.revision, null, 32))).toContain('outside bound disclosure'); return;
    }
    expect(refused(w.source.admit({ root: w.repo, revision: w.capture.revision,
      purpose: 'author', topic: kind === 'scope' ? 'other-topic' : 'fixture-topic' }))).toBeTruthy();
  });
  it('rejects malformed identity, missing custody and over-budget reads', () => {
    const w = world();
    const changed = { ...w.captured, rows: w.captured.rows.map((row: { node: { kind: string } }) => row.node.kind === 'file'
      ? { ...row, content: 'tampered' } : row) };
    expect(refused(captureCommittedCartographerSource({ custody: w.custody, ...changed, expectedPhysicalHead: null }))).toContain('identity differs');
    expect(refused(w.source.page(w.capture.revision, null, 33))).toContain('bounded');
    expect(refused(w.source.page(w.capture.revision, 'wrong:0', 1))).toContain('revision-bound');
    expect(refused(w.source.content(w.capture.revision, '.env', 100))).toContain('bounded scoped');
    expect(refused(w.source.content(w.capture.revision, 'missing.ts', 100))).toContain('unavailable');
    expect(value(w.source.content(w.capture.revision, 'TelegramAdapter.ts', 7)).text).toBe('export ');
    expect(() => readCommittedCartographerCapture({ root: w.repo, admit: () => true, stopped: () => false, maxNodes: 1 })).toThrow('population exceeds');
  });
  it('refuses a nonexistent durable position and changed capture digest', () => {
    const w = world();
    const missing = createProductionCartographerSource({ ...w.sourceInput,
      capture: { ...w.capture, position: 'missing-position' },
      custody: { ...w.custody, binding: { ...w.custody.binding, positions: ['missing-position'] } } });
    expect(refused(missing.page(w.capture.revision, null, 1))).toContain('position missing');
    const corrupt = createProductionCartographerSource({ ...w.sourceInput, capture: { ...w.capture, digest: 'sha256:bad' } });
    expect(refused(corrupt.page(w.capture.revision, null, 1))).toContain('digest differs');
  });
  it('requires synchronous admission before Git and never reads a secret-path blob', () => {
    const w = world();
    expect(() => readCommittedCartographerCapture({ root: '/nonexistent', admit: () => false, stopped: () => false })).toThrow('admission refused');
    expect(() => readCommittedCartographerCapture({ root: w.repo, admit: () => true, stopped: () => true })).toThrow('stopped');
    expect(JSON.stringify(w.captured)).not.toContain('DO_NOT_READ');
    expect(() => readCommittedCartographerCapture({ root: w.repo, admit: () => true, stopped: () => false, maxBytes: 20 })).toThrow();
  });
  it('production composition delivers the custody-backed manifest to actual Awareness grounding', async () => {
    const w = world(), fail = (): never => { throw Error('unexpected dispatch'); };
    const session = { owner: 'part-eight' as const, available: () => true, collect: () => null, stepsUsed: () => 0,
      run: async () => ({ state: 'complete' as const, text: JSON.stringify({ summary: 'TelegramAdapter coordinates delivery and polling for messages in this source repository.' }),
        detail: 'isolated recorded-shape author', edge: 'edge', child: 'child' }), stop: () => w.f.success([]) };
    const composed = composeProductionCartographer({ source: w.sourceInput,
      service: { writer: { context: w.context, store: w.store, privateKey, machine: 'machine-a', principal: w.f.alice, provenance: w.f.alice.provenance },
        context: w.f.c, session, authority: w.f.g.id, topic: 'fixture-topic', now: () => 100,
        at: () => w.f.clockRaw(100), stopped: () => false, holdsLease: () => true, pressure: () => 'normal' },
      awareness: { sources: { identity: () => ({ name: 'Fixture', identity: 'Isolated test' }),
        topics: () => [{ id: 'fixture-topic', name: 'Fixture', claim: 'claim' }],
        conversation: () => ({ messages: [{ id: 'question', at: 100, from: 'user', text: 'TelegramAdapter' }] }),
        commitments: () => [], sessions: () => [] },
        io: { writeGrounding: fail, readGroundingDigest: fail, readReceipts: fail, loadState: fail, saveState: fail, signal: fail },
        observer: { observe: fail }, actions: { deliver: fail, recoverContext: fail } } });
    value(await composed.cartographer.sweep({ revision: w.capture.revision, cursor: null, pass: 0, nextAt: 0, zeroProgress: 0, idle: 0 }, 'production-source'));
    const manifest = value(composed.cartographer.navigate('TelegramAdapter'));
    const grounding = composed.awareness.grounding('fixture-topic');
    expect(grounding.included.recall).toBeGreaterThan(0);
    expect(grounding.text).toContain(w.capture.position);
    for (const row of manifest.scored) expect(grounding.text).toContain(manifest.evidence.find(e => e.path === row.path)!.fact);
    expect(grounding.text).toContain('summaries are untrusted');
    w.set({ revision: 'b'.repeat(40) });
    const unavailable = composed.awareness.grounding('fixture-topic');
    expect(unavailable.included.recall).toBe(0);
    expect(unavailable.text).toContain('UNANSWERED MESSAGE');
    expect(unavailable.text).toContain('recall: degraded');
  });
});
