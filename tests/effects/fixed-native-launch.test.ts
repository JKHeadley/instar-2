import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend, createFactStore, decodeHistoricalBody } from '../../src/facts/index.js';
import { decodeHistoricalNativeConfinedLaunchDefinition, nativeProcessMigrations,
  nativeProcessSchemas, registerEffectBodies, createEffectSpine, installNativeLaunchDefinition } from '../../src/effects/index.js';
import { effectFixture, refused, value } from './fixture.js';
import { privateKey, json } from '../facts/fixtures.js';

it('Eight keeps the genuine v1 definition and request body unchanged after version registration', () => {
  const f = effectFixture();
  const request = f.prepare();
  const facts = value(f.store.read());
  for (const id of [f.d.id, request.id]) {
    const fact = facts.find(row => (row.body as { record?: { id?: string } }).record?.id === id);
    expect(fact?.schemaVersion).toBe(1);
    const historical = value(decodeHistoricalBody(fact!, { ...f.ctx, facts }, f.ctx.decode));
    expect(value(canonical(historical.fields.record)).bytes)
      .toBe(value(canonical((fact!.body as { record: unknown }).record)).bytes);
  }
  expect(f.calls()).toBe(0);
}, 30000);

it('Eight historically decodes the genuine v1 observation and settlement against their original Six operation', () => {
  const f = effectFixture();
  const request = f.prepare();
  const observation = value(f.api.dispatch(request, f.fence));
  f.assess('happened', 0);
  const settlement = value(f.api.settle(observation.operation));
  const facts = value(f.store.read());
  const original = value(f.transport.inspect()).find(row => row.record.type === 'AdmissionReservation'
    && row.record.operation === observation.operation && row.record.state === 'prepared');
  if (original?.record.type !== 'AdmissionReservation') throw Error('original Six reservation missing');
  for (const id of [observation.id, settlement.id]) {
    const fact = facts.find(row => (row.body as { record?: { id?: string } }).record?.id === id)!;
    const historical = value(decodeHistoricalBody(fact, { ...f.ctx, facts }, f.ctx.decode));
    expect(value(canonical(historical.fields.record)).bytes)
      .toBe(value(canonical((fact.body as { record: unknown }).record)).bytes);
    expect((historical.fields.record as { operation: string }).operation).toBe(original.record.operation);
  }
}, 30000);

it('Eight publishes only the three closed v2 kinds with corresponding P2 migrations', () => {
  const f = effectFixture();
  expect(nativeProcessSchemas(f.host).map(row => `${row.kind}:${row.version}`)).toEqual([
    'effect-OperationDefinition:2', 'effect-EffectRequest:2', 'effect-OperationObservation:2',
  ]);
  expect(nativeProcessMigrations.map(row => `${row.kind}:${row.from}:${row.to}`)).toEqual([
    'effect-OperationDefinition:1:2', 'effect-EffectRequest:1:2', 'effect-OperationObservation:1:2',
  ]);
  expect(f.calls()).toBe(0);
});

it('Eight refuses a caller-supplied stored v2 legacy intermediate', () => {
  const f = effectFixture();
  const original = value(f.store.read()).find(row =>
    (row.body as { record?: { id?: string } }).record?.id === f.d.id)!;
  const legacy = { ...(original.body as { record: object }).record, schemaVersion: 2, legacyMessage: true };
  const forged = { ...original, schemaVersion: 2, body: { record: legacy } };
  const context = { ...f.host.boundary, origin: forged, mode: 'historical' as const, facts: f.ctx };
  expect(refused(decodeHistoricalNativeConfinedLaunchDefinition(legacy, context, f.host)))
    .toContain('undeclared field');
  expect(f.calls()).toBe(0);
});

it('Eight registers and historically decodes a genuine v2 definition without changing v1 bytes', () => {
  const f = effectFixture();
  const register = { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries,
    'native-confined-launch', 'native-fixed-executor'] };
  const decode = { ...f.ctx.decode, register };
  let authority: string[] = [], versions: ReturnType<typeof f.host.current>['versions'] = [];
  const host = { ...f.host, boundary: { ...f.host.boundary, register },
    current: () => ({ ...f.host.current(), decode, authority, versions }) };
  const context = { ...f.ctx, decode, schemas: [...f.ctx.schemas, ...nativeProcessSchemas(host)],
    migrations: [...(f.ctx.migrations ?? []), ...nativeProcessMigrations],
    ownedBodies: [...(f.ctx.ownedBodies ?? []).filter(row => row.owner !== 'part-eight'),
      ...value(registerEffectBodies(host))] };
  const wire: unknown[] = [];
  const storage = { owner: 'part-ten' as const, read: () => wire,
    append: (bytes: string, expected: string | null) => {
      if (((wire.at(-1) as { contentHash?: string } | undefined)?.contentHash ?? null) !== expected) throw Error('storage CAS');
      wire.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const });
    } };
  const store = createFactStore(context, storage);
  const note = value(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(f.now),
    body: { identity: 'native-definition-basis', amount: '0' }, required: [] }, context, store, privateKey)).fact;
  authority = [note.id];
  const target = { installation: 'test-installation', machine: host.machine, principal: host.principal.id,
    harness: 'native-fixed', artifactDigest: value(canonical('artifact')).hash,
    executable: '/test-only/native', executableDigest: value(canonical('runtime')).hash,
    boundaryDigest: value(canonical('boundary')).hash, restrictedIdentity: '_test_worker',
    workingScope: '/test-only/work', environmentDigest: value(canonical([])).hash,
    handlePolicyDigest: value(canonical(['loadContext', 'observeContext'])).hash };
  const limits = { wallMilliseconds: 100, cpuMilliseconds: 100, memoryBytes: 1024,
    processCount: 1, handleCount: 2, inputBytes: 100, outputBytes: 100,
    scratchBytes: 100, queueCount: 1, outstandingDispatchCount: 1,
    observationCount: 1, observationMilliseconds: 100, observationBytes: 100,
    maximumExposure: 100, allocation: 'test-allocation-not-admitted-for-request' };
  const definition = { type: 'OperationDefinition' as const, schemaVersion: 2 as const, id: 'native-definition:1',
    operation: 'native-confined-launch' as const, feature: 'native-confined-launch' as const,
    version: 'native-version:1', generation: register.generation.id, adapter: 'native-fixed-executor',
    mode: 'context-loading' as const, profile: 'test-only-profile', target, limits,
    authority: { scope: value(canonical(host.scope)).hash, grants: [note.id], authorization: [], policy: [] },
    durability: 'local-durable' as const, replicas: 0, lossModel: 'test-local-only',
    verificationBar: 'native-test-bar', observationPolicy: 'test-loop-policy', expiryEvidence: 'test-expiry-pending' };
  const approvedIn = f.authorize({ id: 'native-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'native-base' });
  versions = [{ id: definition.version, subject: definition.feature, content: json(definition),
    contentHash: value(canonical(definition)).hash, since: note.id, supersedes: [],
    approvedIn, base: approvedIn.base, landedIn: null }];
  const spine = createEffectSpine(host, { context, privateKey }, store);
  const installed = value(installNativeLaunchDefinition(definition, host, spine));
  expect(installed).toMatchObject({ id: definition.id, schemaVersion: 2 });
  const facts = value(store.read());
  const fact = facts.find(row => row.kind === 'effect-OperationDefinition')!;
  expect(fact.schemaVersion).toBe(2);
  const historical = value(decodeHistoricalBody(fact, { ...context, facts }, decode));
  expect(value(canonical(historical.fields.record)).bytes).toBe(value(canonical(definition)).bytes);
  expect(f.calls()).toBe(0);
}, 30000);
