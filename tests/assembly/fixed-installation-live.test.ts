// @ts-nocheck -- owner-produced Six/Ten admission boundary fixture.
import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createProductionRunAdmission, decodeLoopPolicy } from '../../src/transport/index.js';
import { createLiveInputAssemblyFixture, value, refused, digest } from './live-input-owner-fixture.js';
import { assemblyInput } from './fixture.js';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical } from '../../src/index.js';
import { frame, unframe, request as monitorRequest, signReply, verifyReply,
  launchIdentity, OfflineJournal } from '../../scripts/fixed-native-worker-monitor.mjs';

function reservationFixture() {
  const f = createLiveInputAssemblyFixture(undefined, { minimal: true });
  const admission = createProductionRunAdmission({ authority: f.effects.transport, store: f.store, context: f.c });
  const graph = value(createRunGraph({ ...f.deps, admission }));
  const opened = value(graph.open(f.run));
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'launch-test-policy',
    maxAttempts: 2, minDelay: 1, maxDuration: 100, timeout: 10, concurrency: 1,
    failDirection: 'closed', breaker: 'stub-closed' }, f.c));
  value(f.effects.transport.schedule('launch-test-schedule', f.effects.fence,
    { owner: 'part-five', name: 'Run', id: opened.run.id }, policy));
  const request = 'request:launch-test', attempt = 'initial-launch-attempt:test', payloadDigest = digest('launch-test');
  const prepared = value(f.effects.transport.reserve({ command: 'launch-test-reserve', fence: f.effects.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: request }, attempt, payloadDigest,
    charge: 1, run: { owner: 'part-five', name: 'Run', id: opened.run.id },
    semanticMessage: 'initial-launch:test', durability: 'local-durable', replicas: 0 }));
  const row = value(f.effects.transport.inspect()).find(entry => entry.record.type === 'AdmissionReservation'
    && entry.record.operation === prepared.operation && entry.record.state === 'prepared');
  expect(row).toBeTruthy();
  const record = (id: string, processOperation: string, resourceReferences: string[]) =>
    value(f.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'), id,
      run: opened.run.id, step: id, machine: f.host.machine, incarnation: f.owners.host.incarnation,
      principal: 'w', harness: f.harnessId, processOperation, resourceReferences }));
  return { f, admission, graph, opened, prepared, row, record };
}

it('Six follows the exact prepared fact to its current consumed reservation after reconstruction', () => {
  const { f, admission, opened, prepared, row, record } = reservationFixture();
  record('launch-test-fact-placement', row.fact.id, [row.fact.id]);
  const claim = value(f.effects.transport.claim('launch-test-claim', f.effects.fence, prepared.operation));
  value(f.effects.transport.consume(claim, f.effects.fence));
  expect(value(admission.execution(opened.run.id, f.lease)).worker).toBe('w');
  const restarted = createProductionRunAdmission({ authority: f.effects.transport, store: f.store, context: f.c });
  expect(value(restarted.execution(opened.run.id, f.lease)).worker).toBe('w');
});

it('Six refuses invalid prepared fact references while retaining operation-key placements', () => {
  const { f, admission, opened, prepared, row, record } = reservationFixture();
  record('launch-test-legacy', prepared.operation, [row.fact.id]);
  expect(value(admission.execution(opened.run.id, f.lease)).worker).toBe('w');
  expect(refused(f.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch-test-missing', run: opened.run.id, step: 'launch-test-missing',
    machine: f.host.machine, incarnation: f.owners.host.incarnation, principal: 'w', harness: f.harnessId,
    processOperation: 'machine-a:0:999999', resourceReferences: [row.fact.id] })))
    .toContain('processOperation reference missing from signed history');
  record('launch-test-unlisted', row.fact.id, []);
  expect(refused(admission.execution(opened.run.id, f.lease))).toContain('prepared worker reservation mapping changed');
});

it('Six refuses a dispatch-claimed row substituted for the prepared fact', () => {
  const { f, admission, opened, prepared, record } = reservationFixture();
  value(f.effects.transport.claim('launch-test-claim', f.effects.fence, prepared.operation));
  const claimed = value(f.effects.transport.inspect()).filter(entry => entry.record.type === 'AdmissionReservation'
    && entry.record.operation === prepared.operation).at(-1)!;
  record('launch-test-claim-placement', claimed.fact.id, [claimed.fact.id]);
  expect(refused(admission.execution(opened.run.id, f.lease))).toContain('prepared worker reservation mapping changed');
});

it('Six refuses a prepared reference when the current reservation was closed', () => {
  const { f, admission, opened, prepared, row, record } = reservationFixture();
  record('launch-test-closed-placement', row.fact.id, [row.fact.id]);
  value(f.effects.transport.close('launch-test-close', f.effects.fence, prepared.operation));
  expect(refused(admission.execution(opened.run.id, f.lease))).toContain('current worker resource reservation absent');
});

it('production launch refuses when the reviewed monitor is unavailable', async () => {
  const { createProductionLaunchBoundary } = await import('../../src/assembly/index.js');
  const { f } = reservationFixture();
  const boundary = createProductionLaunchBoundary(f.c);
  expect(boundary.state).toBe('monitor-unavailable');
  expect(refused(boundary.launch({} as never, 'operation:test', 'claim:test')))
    .toContain('fixed native worker monitor and trusted installation are unavailable');
  expect(refused(boundary.observe('operation:test', digest('test'))))
    .toContain('fixed native worker monitor and trusted installation are unavailable');
});

it('Six rejects an opening fact used as a prepared reservation', () => {
  const { f, admission, opened, record } = reservationFixture();
  record('launch-test-wrong-kind', f.opening.id, [f.opening.id]);
  expect(refused(admission.execution(opened.run.id, f.lease)))
    .toContain('prepared worker reservation mapping changed');
});

it('Six rejects a consumed fact substituted for the original prepared fact', () => {
  const { f, admission, opened, prepared, record } = reservationFixture();
  const claim = value(f.effects.transport.claim('launch-test-claim', f.effects.fence, prepared.operation));
  value(f.effects.transport.consume(claim, f.effects.fence));
  const consumed = value(f.effects.transport.inspect()).filter(entry => entry.record.type === 'AdmissionReservation'
    && entry.record.operation === prepared.operation).at(-1)!;
  record('launch-test-consumed-placement', consumed.fact.id, [consumed.fact.id]);
  expect(refused(admission.execution(opened.run.id, f.lease)))
    .toContain('prepared worker reservation mapping changed');
});

it('Six rejects a prepared reservation from an earlier lease assignment', () => {
  const { f, admission, opened, row, record } = reservationFixture();
  record('launch-test-stale-lease', row.fact.id, [row.fact.id]);
  value(f.effects.transport.release('launch-test-release', f.effects.fence));
  const predecessor = value(f.effects.transport.inspect()).at(-1)!.fact.id;
  value(f.effects.transport.acquire('launch-test-takeover', predecessor, 500));
  expect(refused(admission.execution(opened.run.id, f.lease))).toContain('stale');
});

it('Six rejects a prepared reservation for another Run', () => {
  const { f, admission, row } = reservationFixture();
  value(f.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch-test-wrong-run', run: 'another-run', step: 'launch-test-wrong-run',
    machine: f.host.machine, incarnation: f.owners.host.incarnation, principal: 'w',
    harness: f.harnessId, processOperation: row.fact.id, resourceReferences: [row.fact.id] }));
  expect(refused(admission.execution('another-run', f.lease)))
    .toContain('prepared worker reservation mapping changed');
});

it('Six rejects an original prepared fence after a new assignment', () => {
  const { f, admission, opened, row, record } = reservationFixture();
  record('launch-test-old-prepared-fence', row.fact.id, [row.fact.id]);
  value(f.effects.transport.release('launch-test-fence-release', f.effects.fence));
  const predecessor = value(f.effects.transport.inspect()).at(-1)!.fact.id;
  value(f.effects.transport.acquire('launch-test-fence-takeover', predecessor, 500));
  const assignment = value(f.effects.transport.inspect()).filter(entry => entry.record.type === 'Lease'
    && entry.record.operation === 'acquire').at(-1)!;
  expect(refused(admission.execution(opened.run.id,
    { owner: 'part-six', name: 'Lease', id: assignment.fact.id })))
    .toContain('prepared worker reservation mapping changed');
});

it('Ten refuses a prepared fact copied from another signed store before Six execution', () => {
  const local = reservationFixture();
  const foreign = createLiveInputAssemblyFixture(undefined, { minimal: false });
  const admission = createProductionRunAdmission({ authority: foreign.effects.transport,
    store: foreign.store, context: foreign.c });
  const graph = value(createRunGraph({ ...foreign.deps, admission }));
  const opened = value(graph.open(foreign.run));
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'foreign-launch-policy',
    maxAttempts: 2, minDelay: 1, maxDuration: 100, timeout: 10, concurrency: 1,
    failDirection: 'closed', breaker: 'stub-closed' }, foreign.c));
  value(foreign.effects.transport.schedule('foreign-launch-schedule', foreign.effects.fence,
    { owner: 'part-five', name: 'Run', id: opened.run.id }, policy));
  const prepared = value(foreign.effects.transport.reserve({ command: 'foreign-launch-reserve',
    fence: foreign.effects.fence, request: { owner: 'part-eight', name: 'EffectRequest', id: 'request:foreign' },
    attempt: 'initial-launch-attempt:foreign', payloadDigest: digest('foreign'), charge: 1,
    run: { owner: 'part-five', name: 'Run', id: opened.run.id }, semanticMessage: 'initial-launch:foreign',
    durability: 'local-durable', replicas: 0 }));
  const foreignPrepared = value(foreign.effects.transport.inspect()).find(row =>
    row.record.type === 'AdmissionReservation' && row.record.operation === prepared.operation
      && row.record.state === 'prepared')!;
  expect(foreignPrepared.fact.id).not.toBe(local.row.fact.id);
  expect(refused(local.f.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch-test-foreign-store', run: local.opened.run.id, step: 'launch-test-foreign-store',
    machine: local.f.host.machine, incarnation: local.f.owners.host.incarnation, principal: 'w',
    harness: local.f.harnessId, processOperation: foreignPrepared.fact.id,
    resourceReferences: [foreignPrepared.fact.id] })))
    .toContain('processOperation reference missing from signed history');
});

function monitorFixture() {
  const digestValue = value(canonical('monitor-test')).hash;
  const launch = { v: 1, method: 'launch', challenge: 'ab'.repeat(32),
    installation: 'installation:test', machine: 'machine:test',
    body: { request: 'request:test', specification: 'specification:test',
      claim: 'claim:test', consumed: 'consumed:test', operation: 'operation:test',
      digest: digestValue } };
  const identity = launchIdentity(launch, 'boot:test');
  const receipt = { installation: launch.installation, machine: launch.machine,
    bootId: 'boot:test', releaseDigest: digestValue, request: launch.body.request,
    operation: launch.body.operation, digest: digestValue, claim: launch.body.claim,
    consumed: launch.body.consumed, specification: launch.body.specification,
    launchIdentity: identity, uid: 501, pid: 123, processStartIdentity:
      { bootId: 'boot:test', uniqueId: '7', startTicks: '12' },
    artifactDigest: digestValue, profileDigest: digestValue,
    handlePolicyDigest: digestValue, limitsDigest: digestValue,
    originalDeadline: { ownerClockReference: 'clock:test', ownerValidUntil: 100,
      bootId: 'boot:test', continuousTicks: '200', timebaseNumer: '1', timebaseDenom: '1' },
    state: 'running', reason: 'ok', sequence: 1,
    observedAt: { clockReference: 'clock:test', value: 50 },
    freshForMs: 500, currentBootId: 'boot:test', evidenceReferences: ['fact:test'] };
  const keys = generateKeyPairSync('ed25519');
  return { launch, receipt, keys, digestValue, identity };
}

it('synthetic monitor uses exact two-method canonical wire and bound signed receipts', () => {
  const { launch, receipt, keys, digestValue, identity } = monitorFixture();
  expect(monitorRequest(unframe(frame(launch)))).toEqual(launch);
  const reply = signReply(launch, receipt, 'key:test', keys.privateKey);
  const trust = { keyId: 'key:test', publicKey: keys.publicKey,
    releaseDigest: digestValue, artifactDigest: digestValue, profileDigest: digestValue,
    handlePolicyDigest: digestValue, limitsDigest: digestValue, currentBootId: 'boot:test',
    clockReference: 'clock:test', now: 50, authorityValidUntil: 100, millisecondsPerUnit: 1 };
  expect(verifyReply(launch, unframe(frame(reply)), trust)).toEqual(receipt);
  const observe = { v: 1, method: 'observe', challenge: 'cd'.repeat(32),
    installation: launch.installation, machine: launch.machine,
    body: { request: launch.body.request, operation: launch.body.operation,
      digest: digestValue, launchIdentity: identity, observationAuthority: 'fact:query' } };
  expect(monitorRequest(unframe(frame(observe)))).toEqual(observe);
  expect(verifyReply(observe, signReply(observe, receipt, 'key:test', keys.privateKey),
    trust)).toEqual(receipt);
  for (const method of ['stop', 'kill', 'cancel', 'cleanup', 'restart', 'replace', 'extend', 'install', 'updatePolicy'])
    expect(() => monitorRequest({ ...launch, method })).toThrow('unsupported method');
  expect(() => monitorRequest({ ...launch, executable: '/bin/sh' })).toThrow('closed shape');
  expect(() => monitorRequest({ ...launch, body: { ...launch.body, argv: [] } })).toThrow('closed shape');
  expect(() => verifyReply(launch, { ...reply, challenge: 'cd'.repeat(32) }, trust)).toThrow();
  expect(() => verifyReply(launch, { ...reply, receipt: { ...receipt, pid: 999 } },
    trust)).toThrow('invalid receipt signature');
  expect(() => verifyReply(launch, reply, { ...trust, keyId: 'key:foreign' }))
    .toThrow('reply request or trust binding differs');
  expect(() => verifyReply(launch, reply, { ...trust, now: 49 }))
    .toThrow('stale, future or unauthorized');
  expect(() => verifyReply(launch, reply, { ...trust, now: 551 }))
    .toThrow('stale, future or unauthorized');
  expect(() => verifyReply(launch, reply, { ...trust, authorityValidUntil: 49 }))
    .toThrow('stale, future or unauthorized');
  expect(() => verifyReply(launch, reply, { ...trust, profileDigest: value(canonical('wrong')).hash }))
    .toThrow('trusted profileDigest differs');
  expect(() => signReply(launch, { ...receipt, processStartIdentity: null },
    'key:test', keys.privateKey)).toThrow('attributable process evidence required');
});

it('synthetic monitor rejects noncanonical, oversized and truncated frames', () => {
  const { launch } = monitorFixture();
  const encoded = Buffer.from(JSON.stringify(launch));
  const raw = Buffer.alloc(4 + encoded.length);
  raw.writeUInt32BE(encoded.length); encoded.copy(raw, 4);
  expect(() => unframe(raw)).toThrow('noncanonical frame');
  expect(() => unframe(frame(launch).subarray(0, -1))).toThrow('invalid frame length');
  const tooLarge = Buffer.alloc(4); tooLarge.writeUInt32BE(65537);
  expect(() => unframe(tooLarge)).toThrow('invalid frame length');
  const duplicate = Buffer.from('{"v":1,"v":1}');
  const dupFrame = Buffer.alloc(4 + duplicate.length);
  dupFrame.writeUInt32BE(duplicate.length); duplicate.copy(dupFrame, 4);
  expect(() => unframe(dupFrame)).toThrow('noncanonical frame');
});

it('synthetic journal retains a decided original across reopen and refuses torn history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'instar-monitor-'));
  try {
    const path = join(dir, 'journal');
    const first = new OfflineJournal(path);
    const { launch, identity } = monitorFixture();
    const originalKey = `${launch.installation}/${launch.body.request}/${launch.body.operation}`;
    expect(first.decide(identity, originalKey, launch.body).newDecision).toBe(true);
    expect(new OfflineJournal(path).original(identity)?.value.value.request).toBe(launch.body.request);
    expect(new OfflineJournal(path).decide(identity, originalKey, launch.body).newDecision).toBe(false);
    expect(() => first.decide(identity, originalKey, { ...launch.body, claim: 'claim:changed' }))
      .toThrow('original launch conflicts');
    expect(() => first.decide('different-boot-identity', originalKey, launch.body))
      .toThrow('original launch conflicts');
    expect(new OfflineJournal(path).original('another')).toBeNull();
    const bytes = readFileSync(path);
    writeFileSync(path, bytes.subarray(0, -1));
    expect(() => new OfflineJournal(path)).toThrow('journal-untrusted');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
