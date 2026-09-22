import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decode } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createProductionCustodyReader, decodeStoreCustodyPolicy, openProductionCustody } from '../../src/assembly/index.js';
import type { ProductionCustodyInput } from '../../src/assembly/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
// @ts-expect-error Physical host stays outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

function setup() {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'm4-custody-')));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const secret = (name: string) => value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name }, f.ctx.decode));
  const policy = value(decodeStoreCustodyPolicy({ ...assemblyInput('StoreCustodyPolicy'), readOperation: 'work', grants: [f.g.id] }, f.c));
  let calls = 0, now = 100, generation = 'generation:1', stopped = false;
  let peer = { requester: f.alice.id, incarnation: 'worker:1' };
  // Public, isolated test material only. No installed credential is loaded and
  // no adapter transport is invoked by construction or by the mediated read.
  const config: ProductionCustodyInput = {
    context: { ...f.ctx.decode, ...f.c }, policy,
    storage: { root, machine: 'machine-a', key: secret('test-storage'), keyReference: policy.wrappingKey, io: productionStorageIO },
    recovery: { custodian: policy.recoveryCustody, handle: secret('test-recovery') },
    resolveSecret: reference => reference.name === 'test-storage' ? '00'.repeat(32)
      : reference.name === 'test-bot' ? `0:${'ISOLATED_TEST_ONLY_'.repeat(2)}` : 'ISOLATED_TEST_ONLY',
    provider: { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'local-test', credential: secret('test-provider'),
      submit: async () => { calls++; throw Error('no provider calls authorized'); } },
    telegram: { credential: secret('test-bot'), machine: 'machine-a', now: () => f.clock(now), freshFor: 20,
      declaration: { schemaVersion: 1, bot: { id: '123', username: '@isolated_test_bot', identityEpoch: 'test' }, token: secret('test-bot'),
        apiVersion: 'bot-api', cursor: { contractVersion: 'telegram-update-offset:v1', initialOffset: 0, maxBatchItems: 1, maxPollSeconds: 1 },
        limits: { maxUpdateBytes: 1024, maxReplyCharacters: 4096, maxReplyBytes: 4096, maxEntities: 1, maxConcurrentPolls: 1, maxCharge: 1, timeout: 1 },
        supportedOperations: ['ordinary-reply'] },
      io: { invoke: () => { calls++; throw Error('no Telegram calls authorized'); } } },
  };
  const custody = value(openProductionCustody(config)); cleanup.push(custody.close);
  const bytes = '{"permitted":"nonsecret challenge"}';
  value(custody.storage.persistence.appendExact({ bytes, bytesDigest: hashBytes(bytes), segment: policy.store,
    position: 'challenge:1', expectedPhysicalHead: null, policy: policy.id }));
  const observed = assemblyRuntimeFixture(() => custody.storage.segment);
  value(observed.runtime.record('StoreCustodyPolicy', policy));
  const reader = createProductionCustodyReader({ storage: custody.storage, policy, context: f.c, observations: observed.runtime,
    binding: { requester: f.alice.id, incarnation: 'worker:1', grant: f.g.id, scope: policy.disclosureScopes[0]!,
      disclosure: f.scope, generation, validUntil: 200, positions: ['challenge:1'] },
    authenticatedPeer: () => peer, current: () => ({ decode: f.ctx.decode, clock: f.clock(now), generation, stopped }) });
  const request = { requester: f.alice.id, operation: 'read:challenge:1', scope: policy.disclosureScopes[0]!, grant: f.g.id,
    policy: policy.id, positions: ['challenge:1'], maxBytes: 128 };
  return { f, root, config, custody, reader, request, bytes, observed, calls: () => calls,
    change: (change: 'expiry' | 'generation' | 'stop' | 'peer') => {
      if (change === 'expiry') now = 200;
      if (change === 'generation') generation = 'generation:2';
      if (change === 'stop') stopped = true;
      if (change === 'peer') peer = { ...peer, incarnation: 'worker:2' };
    } };
}

it('P10-SI-08/14 custody uses physical encrypted storage and One standing for a bounded read', () => {
  const f = setup(), result = value(f.reader.read(f.request));
  expect(result.bytes).toEqual([f.bytes]);
  expect(result.observations).toHaveLength(1);
  expect(result.observations[0]).toMatchObject({ type: 'StorageAccessObservation', result: 'allowed',
    grant: f.request.grant, operation: f.request.operation, byteCount: Buffer.byteLength(f.bytes) });
  expect(readFileSync(join(f.root, 'exact.encrypted'), 'utf8')).not.toContain('nonsecret challenge');
  expect(Object.keys(f.reader).sort()).toEqual(['owner', 'read']);
  expect(f.custody.recovery.status).toBe('prepared');
  expect(value(f.observed.runtime.inspect()).some(row => row.record.type === 'StorageAccessObservation'
    && row.record.id === result.observations[0]!.id)).toBe(true);
  f.custody.close();
  const reopened = value(openProductionCustody(f.config)); cleanup.push(reopened.close);
  expect(reopened.storage.segment.read().some(row => (row as { kind: string }).kind === 'assembly-StorageAccessObservation')).toBe(true);
  expect(f.calls()).toBe(0);
});

it('P10-SI-14 custody refuses wrong scope, grant, position, bound and worker secret requests', () => {
  const f = setup();
  for (const delta of [{ scope: 'wrong' }, { grant: 'wrong' }, { positions: ['secret'] }, { maxBytes: 1 },
    { resolveSecret: { vault: 'vault', name: 'test-storage' } }]) refused(f.reader.read({ ...f.request, ...delta }));
  const candidate = { ...f.f.g, grantee: f.f.bob } as typeof f.f.g;
  f.f.grants.splice(0, f.f.grants.length, candidate);
  refused(f.reader.read(f.request));
  expect(f.calls()).toBe(0);
});

it.each(['expiry', 'generation', 'stop', 'peer'] as const)('P10-SI-14 custody rechecks %s at consumption', change => {
  const f = setup(); value(f.reader.read(f.request)); f.change(change); refused(f.reader.read(f.request));
  expect(f.calls()).toBe(0);
});

it('P10-SI-09 custody refuses unresolved SecretRefs without returning resolver diagnostics', () => {
  const f = setup();
  refused(openProductionCustody({ ...f.config, resolveSecret: () => { throw Error('PRIVATE DIAGNOSTIC'); } }),
    'storage-key: SecretRef unresolvable');
  expect(f.calls()).toBe(0);
});
