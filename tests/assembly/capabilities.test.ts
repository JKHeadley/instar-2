import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { createCustodiedPersistenceAdapter, createNativeHarnessAdapter, deriveGrowthEpisodes, closeGrowthEpisode,
  decodeGrowthObservation, stageLocalCapability } from '../../src/assembly/index.js';
import type { EncryptedChunk } from '../../src/assembly/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

it('P10-NF-17 P10-NF-18 P10-NF-20 P10-NF-21 Native receives only the eight-owned process driver and distinguishes accepted from consumed', () => {
  const f = assemblyRuntimeFixture(); let phase: 'input-accepted' | 'context-consumed' = 'input-accepted'; let invokes = 0;
  value(f.runtime.record('HarnessObservation', { ...assemblyInput('HarnessObservation'), id: 'model-context:capture:1' }));
  const adapter = createNativeHarnessAdapter({ id: 'native', artifact: assemblyInput('HarnessLaunchSpec').artifactDigest, platform: 'darwin-arm64', conformance: 'conformance:1',
    context: f.c, clock: () => 20, generation: () => 'generation:fixture', driver: { owner: 'part-eight',
      launch: () => { invokes++; return f.success('pid:42:start:1'); }, deliver: () => f.success('stdin:accepted'),
      observe: () => f.success({ phase, evidence: phase === 'context-consumed' ? 'model-context:capture:1' : 'stdin:accepted', detail: 'instrumented' }) } });
  const spec = assemblyInput('HarnessLaunchSpec'); expect(value(adapter.launch(spec, 'operation:launch', 'claim:launch')).phase).toBe('launched');
  refused(adapter.deliver({ launch: spec.id, intake: 'intake:other', digest: spec.inputDigest, incarnation: spec.incarnation, operation: 'operation:deliver:wrong' }), 'identity or digest');
  expect(value(adapter.deliver({ launch: spec.id, intake: spec.input, digest: spec.inputDigest, incarnation: spec.incarnation, operation: 'operation:deliver' })).phase).toBe('input-accepted');
  expect(value(adapter.observe({ launch: spec.id, delivery: 'delivery:1', operation: 'operation:observe' })).phase).toBe('input-accepted');
  phase = 'context-consumed'; expect(value(adapter.observe({ launch: spec.id, delivery: 'delivery:1', operation: 'operation:observe:2' })).phase).toBe('context-consumed'); expect(invokes).toBe(1);
});

it('P10-NF-28 P10-NF-29 P10-NF-32 P10-NF-33 P10-NF-35 P10-NF-36 encrypted persistence preserves exact canonical bytes and rejects forks', () => {
  const f = factsFixture(); const policy = assemblyInput('StoreCustodyPolicy'); const stored = new Map<string, EncryptedChunk>(); let head: string | null = null;
  const adapter = value(createCustodiedPersistenceAdapter('encrypted-store', policy, { owner: 'part-ten', administration: 'custodian', read: position => stored.get(position) ?? null,
    append: (chunk, expected) => { if (expected !== head) throw new Error('physical head conflict'); stored.set(chunk.position, chunk); head = chunk.physicalHead; return f.success('durable'); } },
  { owner: 'part-ten', administration: 'independent', key: () => f.success('11'.repeat(32)), nonce: (_store, _epoch, position) => f.success(position === '0' ? '00'.repeat(12) : '01'.repeat(12)) }, f.c));
  const bytes = '{"canonical":true}'; const receipt = value(adapter.appendExact({ bytes, bytesDigest: hashBytes(bytes), segment: policy.store, position: '0', expectedPhysicalHead: null, policy: policy.id }));
  expect(stored.get('0')!.ciphertext).not.toContain('canonical'); expect(value(adapter.readExact({ store: policy.store, positions: ['0'], maxBytes: 100, access: 'grant:read' }))).toEqual([bytes]);
  expect(value(adapter.flushEvidence(receipt))).toEqual(receipt);
  refused(adapter.flushEvidence({ ...receipt, store: 'store:other' }), 'exact durable store');
  stored.set('1', { ...stored.get('0')!, position: '1' });
  refused(adapter.readExact({ store: policy.store, positions: ['1'], maxBytes: 100, access: 'grant:read' }), 'authenticated associated data');
  refused(adapter.appendExact({ bytes: 'changed', bytesDigest: hashBytes('changed'), segment: policy.store, position: '0', expectedPhysicalHead: receipt.physicalHead, policy: policy.id }), 'different bytes');
});

it('repair1 V210-V211 context-consumption resolves the exact signed run, input, and incarnation', () => {
  const f = assemblyRuntimeFixture();
  value(f.runtime.record('HarnessObservation', { ...assemblyInput('HarnessObservation'), id: 'model-context:other', run: 'run:other' }));
  const adapter = createNativeHarnessAdapter({ id: 'native', artifact: assemblyInput('HarnessLaunchSpec').artifactDigest, platform: 'darwin-arm64', conformance: 'conformance:1',
    context: f.c, clock: () => 20, generation: () => 'generation:fixture', driver: { owner: 'part-eight', launch: () => f.success('pid:42:start:1'),
      deliver: () => f.success('accepted'), observe: () => f.success({ phase: 'context-consumed', evidence: 'model-context:other', detail: 'wrong run' }) } });
  const spec = assemblyInput('HarnessLaunchSpec'); value(adapter.launch(spec, 'operation:launch', 'claim:launch'));
  refused(adapter.observe({ launch: spec.id, delivery: 'delivery:1', operation: 'operation:observe' }), 'another run');
});

it('P10-NF-41 P10-NF-42 P10-NF-44 inert package staging hashes every path and dependency without executing it', () => {
  const f = factsFixture(); const pkg = assemblyInput('LocalCapabilityPackage'); const bytes = 'export const count = value => value.length;'; const digest = hashBytes(bytes);
  const exact = { ...pkg, contentDigest: digest, entrypoints: [{ ...pkg.entrypoints[0]!, digest }] };
  expect(value(stageLocalCapability(exact, [{ path: 'dist/word-count.js', bytes, digest, kind: 'file' }], [], f.c)).dependencyOrder).toEqual(['alice.word-count']);
  refused(stageLocalCapability(exact, [{ path: '../escape.js', bytes, digest, kind: 'file' }], [], f.c), 'unsafe');
});

it('P10-NF-46 P10-NF-48 P10-NF-49 a breach coalesces once and only a complete measured exit closes it', () => {
  const f = factsFixture(); const policy = assemblyInput('GrowthPolicy'); const good = assemblyInput('GrowthObservation');
  const bad = value(decodeGrowthObservation({ ...good, id: 'growth:bad', completion: 'incomplete' as const, sampleCount: 0, timeouts: 1, unavailableInputs: ['replica:b'], comparisons: [{ ...good.comparisons[0]!, result: 'unknown' as const }] }, f.c));
  const first = value(deriveGrowthEpisodes(policy, [bad], [], f.c)); const again = value(deriveGrowthEpisodes(policy, [bad], first, f.c)); expect(again).toHaveLength(1);
  refused(closeGrowthEpisode(again[0]!, bad, f.c), 'measured exit'); expect(value(closeGrowthEpisode(again[0]!, good, f.c)).state).toBe('closed');
});
