// @ts-nocheck -- owner-produced Six/Ten admission boundary fixture.
import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createProductionRunAdmission, decodeLoopPolicy } from '../../src/transport/index.js';
import { createLiveInputAssemblyFixture, value, refused, digest } from './live-input-owner-fixture.js';
import { assemblyInput } from './fixture.js';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { canonical } from '../../src/index.js';
import { frame, unframe, request as monitorRequest, signReply, verifyReply,
  launchIdentity, OfflineJournal } from '../../scripts/fixed-native-worker-monitor.mjs';

function reservationFixture(storageFactory?: (facts: any) => any) {
  const f = createLiveInputAssemblyFixture(storageFactory, { minimal: true });
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

// Installer (M5): synthetic host inventory only; --apply is never exercised here.
const provisionScript = join(process.cwd(), 'scripts/provision-fixed-native-worker.sh');
function provision(lines: string[], ...args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'instar-provision-'));
  try {
    const inventory = join(dir, 'inventory');
    writeFileSync(inventory, lines.join('\n') + '\n');
    const run = spawnSync('/bin/bash', [provisionScript, ...args, '--inventory', inventory,
      '--agent-user', 'agent'], { encoding: 'utf8', env: {} });
    return { status: run.status, out: run.stdout, err: run.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const cleanHost = ['os_name=Darwin', 'os_version=26.5', 'os_build=25F84', 'arch=arm64',
  'users=root:0,daemon:1,_www:70,agent:501,', 'groups=wheel:0,staff:20,admin:80,',
  'agent_groups=staff,everyone'];
const worker = 'uid=499;gid=499;shell=/usr/bin/false;home=/private/var/instar-worker/home;hidden=1;auth=none;password=*;groups=_instar_worker+everyone+localaccounts';
const provisionedDirs = ['/private/var/instar-worker|Directory|root|wheel|755',
  '/private/var/instar-worker/home|Directory|root|wheel|755',
  '/private/var/instar-worker/slot-0|Directory|root|wheel|755', '/Library/Instar2|Directory|root|wheel|755',
  '/Library/Instar2/m4-launch|Directory|root|wheel|755', '/Library/Instar2/m4-launch/releases|Directory|root|wheel|755',
  '/Library/Instar2/m4-launch/keys|Directory|root|wheel|700', '/private/var/db/instar2-worker|Directory|root|wheel|700',
  '/Library/Instar2/.accounts-ledger|Regular File|root|wheel|600'].map(row => `path=${row}`);
const provisionedHost = [...cleanHost.slice(0, 4), 'users=root:0,agent:501,_instar_worker:499,',
  'groups=wheel:0,staff:20,_instar_worker:499,', 'agent_groups=staff', `worker_attrs=${worker}`, ...provisionedDirs];

it('installer inspect and accounts-only dry run are read-only, digest-bound and choose an unused hidden ID', () => {
  const inspect = provision(cleanHost, 'inspect');
  expect(inspect.status).toBe(0);
  expect(inspect.out).toContain('inventory.worker.user=absent');
  expect(inspect.out).not.toContain('plan.step');
  const plan = provision(cleanHost, 'accounts-only');
  expect(plan.status).toBe(0);
  expect(plan.out).toContain('plan.step=dscl . -create /Users/_instar_worker UniqueID 499');
  expect(plan.out).toContain('plan.step=dscl . -create /Users/_instar_worker UserShell /usr/bin/false');
  expect(plan.out).toContain('plan.step=dscl . -create /Users/_instar_worker Password *');
  expect(plan.out).toContain('result=dry-run (nothing changed)');
  expect(plan.out.split('\n').filter(line => line.startsWith('plan.step=')).join('\n'))
    .not.toMatch(/sudoers|ssh|admin|LaunchDaemons|receipt|launchctl|AuthenticationAuthority/);
  const steps = plan.out.split('\n').filter(line => line.startsWith('plan.step='));
  expect(steps.indexOf('plan.step=ledger uid=499 gid=499')).toBeLessThan(
    steps.indexOf('plan.step=dscl . -create /Groups/_instar_worker'));
  const digestLine = plan.out.split('\n').find(line => line.startsWith('plan.digest=sha256:'));
  expect(provision(cleanHost, 'accounts-only').out).toContain(digestLine);
  const busy = provision([...cleanHost.slice(0, 4), 'users=root:0,x:499,', 'groups=wheel:0,y:498,', 'agent_groups=staff'], 'accounts-only');
  expect(busy.out).toContain('UniqueID 497');
  const pinned = provision(cleanHost, 'accounts-only', '--uid', '470', '--gid', '470');
  expect(pinned.out).toContain('UniqueID 470');
  expect(pinned.out.split('\n').find(line => line.startsWith('plan.digest='))).not.toBe(digestLine);
  const admin = provision([...cleanHost.slice(0, 6), 'agent_groups=staff,admin'], 'inspect');
  expect(admin.out).toContain('inventory.ADMIN=HOLD');
});

it('installer refuses collisions, synthetic apply, out-of-range IDs and every unreviewed monitor stage', () => {
  const taken = provision(provisionedHost, 'accounts-only');
  expect(taken.status).toBe(2);
  expect(taken.err).toContain('already exists (uid 499); never taken over');
  const groupOnly = provision([...cleanHost.slice(0, 5), 'groups=wheel:0,_instar_worker:300,', 'agent_groups=staff'], 'accounts-only');
  expect(groupOnly.err).toContain('group _instar_worker already exists');
  const foreignDir = provision([...cleanHost, 'path=/Library/Instar2|Directory|root|wheel|755'], 'accounts-only');
  expect(foreignDir.err).toContain('path already exists: /Library/Instar2');
  expect(provision(cleanHost, 'accounts-only', '--uid', '70', '--gid', '70').err).toContain('outside hidden range');
  expect(provision(cleanHost, 'accounts-only', '--uid', '499').err).toContain('given together');
  expect(provision([...cleanHost.slice(0, 4), 'users=root:0,x:480,', 'groups=wheel:0,', 'agent_groups=staff'],
    'accounts-only', '--uid', '480', '--gid', '480').err).toContain('uid 480 already in use');
  expect(provision(cleanHost, 'accounts-only', '--apply').err).toContain('never accepts a synthetic inventory');
  expect(provision(['os_name=Linux', ...cleanHost.slice(1)], 'accounts-only').err).toContain('unsupported OS');
  expect(provision([...cleanHost, 'mystery=1'], 'inspect').err).toContain('unknown inventory key');
  for (const mode of ['install', 'uninstall']) {
    const refused = provision(cleanHost, mode);
    expect(refused.status).toBe(2);
    expect(refused.err).toContain('not reviewed; this stage stays refusing');
  }
});

it('installer verify checks the inert end state and rollback removes only ledger-recorded items', () => {
  const ok = provision(provisionedHost, 'verify');
  expect(ok.status).toBe(0);
  expect(ok.out).toContain('verify.accounts=ok');
  expect(ok.out).toContain('verify.monitor-stage=pending');
  const privileged = provision(provisionedHost.map(row => row.startsWith('worker_attrs=')
    ? row.replace('+everyone', '+admin') : row), 'verify');
  expect(privileged.status).toBe(1);
  expect(privileged.out).toContain('verify.privileged-groups=FAIL');
  const writable = provision(provisionedHost.map(row => row.replace('slot-0|Directory|root|wheel|755',
    'slot-0|Directory|root|wheel|777')), 'verify');
  expect(writable.out).toContain('verify.dir:/private/var/instar-worker/slot-0=FAIL');
  expect(provision(cleanHost, 'verify').out).toContain('verify.accounts=not-provisioned');
  const rollback = provision(provisionedHost, 'accounts-rollback', '--uid', '499', '--gid', '499');
  expect(rollback.status).toBe(0);
  const steps = rollback.out.split('\n').filter(line => line.startsWith('plan.step=')).map(line => line.slice(10));
  expect(steps).toEqual(['dscl . -delete /Users/_instar_worker', 'dscl . -delete /Groups/_instar_worker',
    'rmdir /private/var/db/instar2-worker', 'rmdir /Library/Instar2/m4-launch/keys',
    'rmdir /Library/Instar2/m4-launch/releases', 'rmdir /Library/Instar2/m4-launch',
    'rmdir /private/var/instar-worker/slot-0', 'rmdir /private/var/instar-worker/home',
    'rmdir /private/var/instar-worker', 'rm-ledger', 'rmdir /Library/Instar2']);
  expect(provision(provisionedHost, 'accounts-rollback', '--uid', '498', '--gid', '499').err)
    .toContain('differs from ledger');
  expect(provision([...provisionedHost, 'worker_procs=1'], 'accounts-rollback', '--uid', '499', '--gid', '499').err)
    .toContain('processes are running');
  expect(provision([...provisionedHost, 'path=/Library/LaunchDaemons/ai.instar.worker-monitor.plist|Regular File|root|wheel|644'],
    'accounts-rollback', '--uid', '499', '--gid', '499').err).toContain('uninstall it first');
  expect(provision(cleanHost, 'accounts-rollback').err).toContain('no accounts ledger');
});

it('installer treats an ID-less or colliding account record as present, and rollback retains the ledger on a partial record', () => {
  // Case 1: a pre-existing record whose numeric ID was never assigned is a
  // collision, not absence (review finding 2 reproduction).
  const idless = [...cleanHost.slice(0, 4), 'users=root:0,_instar_worker:,', 'groups=wheel:0,_instar_worker:,', 'agent_groups=staff'];
  expect(provision(idless, 'inspect').out).toContain('inventory.worker.user=present-without-id');
  const collide = provision(idless, 'accounts-only');
  expect(collide.status).toBe(2);
  expect(collide.out).not.toContain('plan.step');
  expect(collide.err).toContain('account _instar_worker already exists (uid none); never taken over');
  const groupless = provision([...cleanHost.slice(0, 5), 'groups=wheel:0,_instar_worker:,', 'agent_groups=staff'], 'accounts-only');
  expect(groupless.status).toBe(2);
  expect(groupless.err).toContain('group _instar_worker already exists (gid none)');
  const partialVerify = provision([...idless, ...provisionedDirs], 'verify');
  expect(partialVerify.status).toBe(1);
  expect(partialVerify.out).toContain('verify.accounts=FAIL (partial record');
  // Case 2: interrupted between record creation and ID assignment, with the
  // ledger present. Rollback must neither report success nor drop the ledger.
  for (const host of [[...idless, ...provisionedDirs],
    [...cleanHost.slice(0, 4), 'users=root:0,', 'groups=wheel:0,_instar_worker:,', 'agent_groups=staff', ...provisionedDirs]]) {
    const partial = provision(host, 'accounts-rollback', '--uid', '499', '--gid', '499');
    expect(partial.status).toBe(4);
    expect(partial.out).not.toContain('plan.step');
    expect(partial.out).not.toContain('result=');
    expect(partial.err).toContain('disposition is unresolved, so nothing is removed and the ledger is retained');
    expect(partial.err).toContain('RECOVERY (administrator, bounded)');
  }
  // The positive neighbour: user fully numbered, group numbered -> ordinary rollback.
  expect(provision(provisionedHost, 'accounts-rollback', '--uid', '499', '--gid', '499').out)
    .toContain('plan.step=rm-ledger');
});

// Native enforcer (M2): compiled with the recorded clang command into the test
// temp directory. These are unprivileged builder-local OS observations on the
// running macOS build, NOT installed-host evidence. Non-macOS hosts do not run them.
const darwin = process.platform === 'darwin';
// A test socket is served by this (non-root) account, so a socket build also
// pins the expected peer uid to it unless a case asks for the release default.
function buildEnforcer(dir: string, socket?: string, peerUid: number = process.getuid!()) {
  const out = join(dir, 'rel', 'bin', 'instar-worker-enforcer');
  mkdirSync(join(dir, 'rel', 'bin'), { recursive: true });
  const define = socket ? [`-DINSTAR_CONTROL_SOCKET="${socket}"`, `-DINSTAR_CONTROL_PEER_UID=${peerUid}`] : [];
  const cc = spawnSync('/usr/bin/clang', ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', ...define,
    '-o', out, join(process.cwd(), 'scripts/fixed-native-worker-enforcer.c')], { encoding: 'utf8' });
  expect(cc.stderr).toBe('');
  expect(cc.status).toBe(0);
  return out;
}
function materializeProfile(dir: string) {
  const rel = join(dir, 'rel'), slot = join(dir, 'slot');
  mkdirSync(slot, { recursive: true });
  const ancestors: string[] = [];
  for (let p = rel; p !== '/'; ) { p = dirname(p); ancestors.push(`(literal "${p}")`); }
  const profile = readFileSync(join(process.cwd(), 'deploy/macos/fixed-worker/worker.sb'), 'utf8')
    .replaceAll('@RELEASE_DIR@', rel).replaceAll('@SLOT_DIR@', slot)
    + `\n; test-only: ancestors of the temporary release path\n(allow file-read-metadata ${ancestors.join(' ')})\n`;
  expect(profile).not.toMatch(/@[A-Z_]+@/);
  writeFileSync(join(rel, 'worker.sb'), profile);
  return join(rel, 'worker.sb');
}
const tempRoot = () => realpathSync(mkdtempSync(join(tmpdir(), 'instar-native-')));

it.runIf(darwin)('native enforcer compiles warning-free and the confined chain denies writes, network and children', () => {
  const dir = tempRoot();
  try {
    const enforcer = buildEnforcer(dir), profile = materializeProfile(dir);
    mkdirSync(join(dir, 'scratch'));
    const lines: Record<string, string> = {};
    for (const which of ['nowrite', 'children', 'gate']) {
      const run = spawnSync(enforcer, ['feasibility', which, profile, join(dir, 'scratch')],
        { encoding: 'utf8', cwd: join(dir, 'slot'), timeout: 30_000 });
      for (const line of run.stdout.split('\n')) {
        const m = /^feasibility\.([a-z-]+)=(PASS|FAIL) (.*)$/.exec(line);
        if (m) lines[m[1]] = `${m[2]} ${m[3]}`;
      }
    }
    for (const name of ['nowrite', 'permitted-read', 'network', 'children', 'gate'])
      expect(lines[name], name).toMatch(/^PASS /);
    const unknown = spawnSync(enforcer, ['stop'], { encoding: 'utf8' });
    expect(unknown.status).toBe(2);
    const supervise = spawnSync(enforcer, ['supervise'], { encoding: 'utf8' });
    expect(supervise.status).toBe(78);
    expect(supervise.stderr).toContain('owner bindings unavailable; refusing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

it.runIf(darwin)('native feasibility reports a verdict for every mandatory case and fails closed on an uninstallable limit', () => {
  const dir = tempRoot();
  try {
    const enforcer = buildEnforcer(dir), profile = materializeProfile(dir);
    mkdirSync(join(dir, 'scratch'));
    const run = spawnSync(enforcer, ['feasibility', 'memory', profile, join(dir, 'scratch')],
      { encoding: 'utf8', cwd: join(dir, 'slot'), timeout: 60_000 });
    const memory = run.stdout.split('\n').find(line => line.startsWith('feasibility.memory='));
    // A limit the kernel will not install must stop the launch before release
    // (outcome 2), never run the worker unbounded.
    expect(memory).toMatch(/outcome=(2|3) /);
    expect(run.stdout).toMatch(/feasibility\.limit-raise=PASS/);
    const task = spawnSync(enforcer, ['feasibility', 'task', profile, join(dir, 'scratch')],
      { encoding: 'utf8', cwd: join(dir, 'slot'), timeout: 30_000 });
    expect(task.stdout).toMatch(/feasibility\.task=(PASS|FAIL) task right acquired pre-gate: binding pre-exec=valid/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 90_000);

it.runIf(darwin)('native client role relays exactly one bounded canonical frame and refuses trailing bytes', async () => {
  const dir = tempRoot();
  const socket = join(dir, 'control.sock');
  const { launch } = monitorFixture();
  const replyBytes = frame({ echo: launch.challenge });
  const server = createServer(connection => {
    const chunks: Buffer[] = [];
    connection.on('data', chunk => chunks.push(chunk));
    connection.on('end', () => {
      const received = Buffer.concat(chunks);
      connection.end(received.equals(frame(launch)) ? replyBytes : Buffer.alloc(0));
    });
  });
  await new Promise<void>(resolve => server.listen(socket, resolve));
  const client = (input: Buffer) => new Promise<{ status: number | null; out: Buffer }>(resolve => {
    const child = spawn(buildEnforcer(dir, socket), ['client'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    child.stdout.on('data', chunk => out.push(chunk));
    child.on('close', status => resolve({ status, out: Buffer.concat(out) }));
    child.stdin.end(input);
  });
  try {
    const ok = await client(frame(launch));
    expect(ok.status).toBe(0);
    expect(ok.out.equals(replyBytes)).toBe(true);
    expect((await client(Buffer.concat([frame(launch), Buffer.from('x')]))).status).toBe(2);
    const oversized = Buffer.alloc(4); oversized.writeUInt32BE(65_537);
    expect((await client(oversized)).status).toBe(2);
    server.close();
    const absent = await client(frame(launch));
    expect(absent.status).toBe(2);
    expect(absent.out.length).toBe(0);
  } finally { server.close(); rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

// MUST-FIX 1: read-only installed reader + fixed monitor read composition.
import { openProductionStorage, openProductionStorageReader } from '../../src/assembly/production-storage.js';
import { createProductionMonitorContext } from '../../src/assembly/production-monitor-context.js';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
const storageKey = new Uint8Array(32).fill(7);
function diskRoot() { return realpathSync(mkdtempSync(join(tmpdir(), 'instar-monitor-store-'))); }
function onDisk(root: string) {
  let writer: any;
  const fixture = reservationFixture(facts => {
    writer = value(openProductionStorage({ root, machine: 'machine-a', key: storageKey, policy: 'policy:test',
      store: 'store:test', context: facts.c, io: productionStorageIO }));
    return writer.segment;
  });
  const reader = () => value(openProductionStorageReader({ root, machine: 'machine-a', key: storageKey,
    store: 'store:test', context: fixture.f.c, io: productionStorageIO }));
  return { ...fixture, writer, reader };
}

it('read-only installed reader follows a live writer without taking its lease and refuses rollback or rewritten history', () => {
  const root = diskRoot();
  try {
    const { f, writer, reader } = onDisk(root);
    const view = reader();
    const pinned = view.segment.read().length;
    expect(pinned).toBeGreaterThan(0);
    expect(refused(view.segment.append('{}', null))).toContain('read-only view refuses append');
    const before = readFileSync(join(root, 'facts.encrypted'));
    f.append('note', { identity: 'after-reader-open', amount: '1' });
    expect(view.segment.read().length).toBe(pinned);                  // pinned until refresh
    expect(value(view.refresh()).records).toBe(pinned + 1);           // concurrent writer change seen
    expect(readFileSync(join(root, '.boot-lease', 'owner.json'), 'utf8')).toContain('"machine":"machine-a"');
    f.append('note', { identity: 'writer-still-owns-lease', amount: '2' }); // writer lease intact
    expect(refused(openProductionStorage({ root, machine: 'machine-a', key: storageKey, policy: 'policy:test',
      store: 'store:test', context: f.c, io: productionStorageIO }))).toContain('second concurrent boot refused');
    const restarted = reader();                                        // reader restart: fresh coherent view
    expect(restarted.segment.read().length).toBe(pinned + 2);
    const current = readFileSync(join(root, 'facts.encrypted'));
    writeFileSync(join(root, 'facts.encrypted'), before);              // roll the file back
    expect(refused(restarted.refresh())).toContain('view rolled back');
    writeFileSync(join(root, 'facts.encrypted'), current);
    expect(value(restarted.refresh()).records).toBe(pinned + 2);
    expect(refused(openProductionStorageReader({ root, machine: 'machine-a', key: new Uint8Array(32).fill(8),
      store: 'store:test', context: f.c, io: productionStorageIO }))).toBeTruthy();   // wrong custody key
    view.close(); restarted.close();
    expect(refused(view.refresh())).toContain('closed');
    writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// SYNTHETIC R6 stand-in: the worker/control capacity instance the installed
// composition would name. Lane A today only produces the responder reserve.
const workerInstance = 'worker-control-allocation:synthetic';
function monitorContextFixture(root: string, withCapacity = true, divergent = false,
  options: { instance?: string; worker?: string | null; watermark?: boolean } = {}) {
  const setup = onDisk(root);
  const { f, prepared, row, record } = setup;
  if (divergent) f.append('note', { identity: 'foreign-installation-history', amount: '9' });
  // Lane A stand-in (impl-r1-m3i not landed): a SYNTHETIC capacity verdict naming
  // an existing signed fact as A. It exercises only this adapter's join logic;
  // it is never installed and does not stand for genuine capacity authority.
  const standInA = f.opening.id;
  const resources = [standInA, row.fact.id].sort();
  const spec = record('launch-monitor-spec', row.fact.id, resources);
  const claim = value(f.effects.transport.claim('launch-monitor-claim', f.effects.fence, prepared.operation));
  value(f.effects.transport.consume(claim, f.effects.fence));
  const rows = value(f.effects.transport.inspect()).filter(entry => entry.record.type === 'AdmissionReservation'
    && entry.record.operation === prepared.operation);
  const specFact = value(f.store.read()).filter(fact => fact.kind === 'assembly-HarnessLaunchSpec').at(-1);
  const locators = { request: prepared.request, specification: specFact.id, claim: rows.at(-2).fact.id,
    consumed: rows.at(-1).fact.id, operation: prepared.operation, digest: prepared.digest };
  // Stand-in in lane A's exact public CapacityInspection head shape (fact is the id string).
  const capacity = { inspectCapacity: () => f.success({ sourceFrontier: value(f.effects.transport.inspect()).at(-1).fact.id,
    heads: [{ capacity: 'capacity:stand-in', fact: standInA, usable: true, blocker: null,
      record: { type: 'CapacityReservation', instance: options.instance ?? workerInstance, installation: 'installation:test',
        machine: 'machine-a', state: 'held' } }] }) };
  // SYNTHETIC R4/R6 stand-in for the installed owner watermark: the writer's own
  // committed count and head, or a pinned value set by a test.
  let pinnedMark: { records: number; head: string } | null = null;
  const liveMark = () => { const all = value(f.store.read()); return { records: all.length, head: all.at(-1).id }; };
  const pinWatermark = () => { pinnedMark = liveMark(); };
  const build = (view: any) => value(createProductionMonitorContext({ installation: 'installation:test', machine: 'machine-a',
    facts: f.ctx, storage: view, authority: f.effects.transport, current: () => f.host.current(),
    capacity: withCapacity ? capacity : undefined,
    workerCapacityInstance: options.worker === null ? undefined : options.worker ?? workerInstance,
    watermark: options.watermark === false ? undefined : () => pinnedMark ?? liveMark(), context: f.c }));
  const view = setup.reader();
  const context = build(view);
  return { ...setup, spec, locators, context, view, standInA, resources, build, pinWatermark };
}

it('fixed monitor reader joins the genuine same-store launch closure and refuses wrong-store, raw-row and changed locators', () => {
  const root = diskRoot(), other = diskRoot();
  try {
    const { f, locators, context, writer, view, record, row, resources } = monitorContextFixture(root);
    const closure = value(context.resolveLaunch(locators));
    expect(closure).toMatchObject({ machine: 'machine-a', operation: locators.operation,
      specification: locators.specification, claim: locators.claim, consumed: locators.consumed });
    expect(value(context.recheck(closure)).bundle).toBe(closure.bundle);
    for (const [field, replacement] of [['specification', locators.claim], ['claim', locators.consumed],
      ['consumed', locators.claim], ['digest', digest('other')], ['request', 'request:other'], ['operation', 'operation:other']])
      expect(refused(context.resolveLaunch({ ...locators, [field]: replacement })), field).toMatch(/monitor-context/);
    // Wrong store: the identical locators against another installation's root.
    const foreign = monitorContextFixture(other, true, true);
    expect(foreign.locators.specification).not.toBe(locators.specification);
    expect(refused(foreign.context.resolveLaunch(locators))).toMatch(/monitor-context|absent/);
    // Stop and a changed worker placement both refuse at recheck.
    f.stop(true);
    expect(refused(context.recheck(closure))).toContain('installation stopped');
    f.stop(false);
    record('launch-monitor-replacement', row.fact.id, resources);       // placement changed after admission
    expect(refused(context.recheck(closure))).toContain('not the current worker placement');
    view.close(); writer.close(); foreign.view.close(); foreign.writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); }
});

it('fixed monitor reader refuses every launch while lane A capacity authority is unavailable', () => {
  const root = diskRoot();
  try {
    const { locators, context, writer, view } = monitorContextFixture(root, false);
    expect(refused(context.resolveLaunch(locators))).toContain('capacity reader unavailable (lane A impl-r1-m3i not landed)');
    view.close(); writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('fixed monitor reader consumes lane A\'s public capacity shape and never treats the responder reserve as worker allocation', () => {
  const root = diskRoot();
  try {
    const base = monitorContextFixture(root);
    expect(value(base.context.resolveLaunch(base.locators)).capacity).toEqual([base.standInA]);   // positive (synthetic R6 instance)
    base.view.close(); base.writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
  for (const [options, message] of [
    [{ instance: 'minimal-responder-binding' }, 'protected minimal-responder reserve, not a worker/control allocation'],
    [{ worker: null }, 'worker/control capacity allocation unavailable (R6)'],
    [{ worker: 'minimal-responder-binding' }, 'worker/control capacity allocation unavailable (R6)'],
    [{ instance: 'another-allocation' }, 'not this installation\'s worker/control allocation'],
  ] as const) {
    const other = diskRoot();
    try {
      const x = monitorContextFixture(other, true, false, options);
      expect(refused(x.context.resolveLaunch(x.locators))).toContain(message);
      x.view.close(); x.writer.close();
    } finally { rmSync(other, { recursive: true, force: true }); }
  }
});

it('fixed monitor reader requires current owner standing and the installed watermark, not signed history alone', () => {
  const root = diskRoot(), rootB = diskRoot(), rootC = diskRoot();
  try {
    const x = monitorContextFixture(root);
    const { f, locators, context } = x;
    const closure = value(context.resolveLaunch(locators));
    f.time(f.host.current().clock.value + 2);
    value(f.effects.transport.recover('launch-monitor-observe', f.effects.fence, locators.operation,
      { owner: 'part-eight', observe: () => f.success({ owner: 'part-eight', name: 'OperationObservation', id: 'obs:1' }) }));
    const wake = value(f.effects.transport.inspect()).filter(entry => entry.record.type === 'LoopRecord'
      && entry.record.pending === locators.operation).at(-1);
    const query = { request: locators.request, operation: locators.operation, digest: locators.digest,
      observationAuthority: wake.fact.id };
    expect(value(context.resolveObservation(query)).wake).toBe(wake.fact.id);
    // Review reproduction: the same genuine wake after the owner clock passes the lease horizon.
    f.time(100_000);
    expect(refused(context.resolveObservation(query))).toContain('owner lease horizon expired');
    expect(refused(context.recheck(closure))).toMatch(/owner lease horizon expired|closure changed/);
    // Watermark: unavailable refuses; a restarted reader over a rolled-back file refuses.
    const unmarked = monitorContextFixture(rootB, true, false, { watermark: false });
    expect(refused(unmarked.context.resolveLaunch(unmarked.locators))).toContain('installed owner watermark unavailable (R4/R6)');
    unmarked.view.close(); unmarked.writer.close();
    const y = monitorContextFixture(rootC);
    const before = readFileSync(join(rootC, 'facts.encrypted'));
    y.f.append('note', { identity: 'after-watermark-source', amount: '1' });
    y.pinWatermark();
    writeFileSync(join(rootC, 'facts.encrypted'), before);           // rolled back while no reader was open
    const restarted = y.reader();
    expect(refused(y.build(restarted).resolveLaunch(y.locators))).toContain('behind or diverges from the owner watermark');
    restarted.close(); y.view.close(); y.writer.close(); x.view.close(); x.writer.close();
  } finally { for (const dir of [root, rootB, rootC]) rmSync(dir, { recursive: true, force: true }); }
});

it('fixed monitor reader resolves observation only through the current admitted Six wake of the original operation', () => {
  const root = diskRoot();
  try {
    const { f, locators, context, writer, view } = monitorContextFixture(root);
    const loops = () => value(f.effects.transport.inspect()).filter(entry => entry.record.type === 'LoopRecord');
    const scheduled = loops().at(-1);
    const query = { request: locators.request, operation: locators.operation, digest: locators.digest,
      observationAuthority: scheduled.fact.id };
    expect(refused(context.resolveObservation(query))).toContain('not the current admitted wake');
    f.time(f.host.current().clock.value + 2);
    const recovery = f.effects.transport.recover('launch-monitor-observe', f.effects.fence, locators.operation,
      { owner: 'part-eight', observe: () => f.success({ owner: 'part-eight', name: 'OperationObservation', id: 'obs:1' }) });
    const wake = loops().filter(entry => entry.record.pending === locators.operation).at(-1);
    expect(value(recovery).command).toBe('launch-monitor-observe');
    expect(wake.record.state).toBe('running');
    const closure = value(context.resolveObservation({ ...query, observationAuthority: wake.fact.id }));
    expect(closure.wake).toBe(wake.fact.id);
    expect(refused(context.resolveObservation({ ...query, observationAuthority: scheduled.fact.id })))
      .toContain('not the current admitted wake');
    expect(refused(context.resolveObservation({ ...query, observationAuthority: wake.fact.id, digest: digest('x') })))
      .toContain('original operation absent or changed');
    expect(refused(context.resolveObservation({ ...query, operation: 'operation:never-dispatched' })))
      .toContain('original operation absent or changed');
    view.close(); writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// MUST-FIX 2: the one mediated worker channel (seam 3) and per-dispatch currency.
import { createInstalledChannelNativeContextIO } from '../../src/assembly/production-native-context.js';
import { createConfinedContextDeliveryDriver } from '../../src/assembly/context-delivery.js';
import { hashBytes } from '../../src/facts/index.js';
import { canonicalText } from '../../src/decode/canonical.js';
import { createChannelIO, createMonitorClient } from '../../scripts/fixed-native-worker-monitor.mjs';
import { realTenFixture } from './real-context-delivery-fixture.js';

const monitorScript = join(process.cwd(), 'scripts/fixed-native-worker-monitor.mjs');
const ok = { type: 'Result', schemaVersion: 1, kind: 'Success', value: true } as any;
const no = (detail: string) => ({ type: 'Result', schemaVersion: 1, kind: 'Refused', reason: 'decode', detail,
  site: 'test', failDirection: 'closed', preserved: 'test' }) as any;
// Test transport: node's 'pipe' stdio is an AF_UNIX socketpair; the worker gets
// fd 3 exactly as in production. The parent end's raw descriptor is read through
// libuv's handle (test-only access); production inherits the supervisor's fd.
function workerChannel(script: string[]) {
  const child = spawn(process.execPath, script, { stdio: ['ignore', 'ignore', 'pipe', 'pipe'] });
  const socket = child.stdio[3] as any;
  socket.pause(); socket._handle.readStop(); socket.on('error', () => {});   // the test reads the raw fd only
  const fd = socket._handle.fd as number;
  const exited = new Promise<number | null>(resolve => child.on('exit', code => resolve(code)));
  return { child, io: createChannelIO(fd), exited };
}
const bigDelivery = JSON.stringify({ context: 'x'.repeat(100_000), note: 'ünïcode' });

it('mediated channel streams one admitted delivery in bounded chunks and returns the worker\'s real readback', async () => {
  const { io, exited } = workerChannel([monitorScript, 'loading-worker', 'handle:launch-1', 'native-context:op-1']);
  let checks = 0;
  const channel = createInstalledChannelNativeContextIO({ io, identity: 'process:1', artifact: hashBytes('artifact'),
    handle: 'handle:launch-1', deadline: io.now() + 10_000, currency: () => { checks++; return ok; } });
  expect(channel.current().identity).toBe('process:1');
  const received = channel.consume('native-context:op-1', bigDelivery);
  expect(received).toEqual({ identity: 'process:1', digest: hashBytes(bigDelivery) });
  const chunks = Math.ceil(Buffer.byteLength(bigDelivery) / 32_768);
  expect(checks).toBe(chunks * 2 + 2);                 // every dispatch and again before every return, incl. the final
  expect(await exited).toBe(0);
  expect(() => channel.consume('native-context:op-1', bigDelivery)).toThrow('second initial delivery');
});

it('mediated channel closes on revocation in flight, expiry and a late authority check, and never regains standing', async () => {
  for (const scenario of ['revoked-mid-stream', 'expired', 'lapse'] as const) {
    const { io, exited, child } = workerChannel([monitorScript, 'loading-worker', 'handle:launch-1', 'native-context:op-1']);
    let checks = 0;
    const channel = createInstalledChannelNativeContextIO({ io, identity: 'process:1', artifact: hashBytes('artifact'),
      handle: 'handle:launch-1', deadline: io.now() + (scenario === 'expired' ? 0 : 10_000),
      currency: () => {
        checks++;
        if (scenario === 'lapse') { const end = Date.now() + 300; while (Date.now() < end) { /* owner service stalls */ } }
        return scenario === 'revoked-mid-stream' && checks > 2 ? no('stopped') : ok;
      } });
    expect(() => channel.consume('native-context:op-1', bigDelivery), scenario)
      .toThrow(scenario === 'revoked-mid-stream' ? 'current authority refused: stopped'
        : scenario === 'expired' ? 'original deadline' : 'lapse bound');
    expect(channel.closed).toBe(true);
    expect(() => channel.current()).toThrow('closed after revocation or expiry');
    expect(() => channel.consume('native-context:op-1', bigDelivery)).toThrow(/closed|second initial/);
    expect(await exited, scenario).not.toBe(0);           // worker sees the closed channel, never completes
    child.kill();
  }
});

it('mediated channel refuses hostile worker frames without dispatching on their behalf', async () => {
  const hostile = (frames: unknown[]) => {
    const encodedFrames = frames.map(frameValue => canonicalText(frameValue));
    const body = `const {writeSync}=require('fs');const f=${JSON.stringify(encodedFrames)};` +
      `for(const t of f){const p=Buffer.from(t);const h=Buffer.alloc(4);h.writeUInt32BE(p.length);writeSync(3,Buffer.concat([h,p]));}` +
      `setTimeout(()=>{},2000);`;
    return workerChannel(['-e', body]);
  };
  const base = { v: 1, sequence: 1, handle: 'handle:launch-1', method: 'loadContext',
    authorityReference: 'native-context:op-1', body: { delivery: 'native-context:op-1', offset: 0, readback: null } };
  const cases: [string, unknown[], string][] = [
    ['foreign method', [{ ...base, method: 'invokeProvider' }], 'fixed allowlist'],
    ['copied handle', [{ ...base, handle: 'handle:launch-0' }], 'this launch'],
    ['other delivery', [{ ...base, body: { ...base.body, delivery: 'native-context:op-2' } }], 'another delivery'],
    ['replayed sequence', [{ ...base, sequence: 2 }], 'out-of-order'],
    ['early readback', [{ ...base, body: { ...base.body, readback: hashBytes('guess') } }], 'readback before complete'],
    ['skip ahead', [{ ...base, body: { ...base.body, offset: 5 } }], 'rewind, skip'],
    ['extra field', [{ ...base, path: '/etc/passwd' }], 'closed request shape'],
    ['pipelined', [base, { ...base, sequence: 2 }], 'more than one outstanding'],
  ];
  for (const [name, frames, detail] of cases) {
    const { io, child } = hostile(frames);
    let dispatches = 0;
    const channel = createInstalledChannelNativeContextIO({ io, identity: 'process:1', artifact: hashBytes('artifact'),
      handle: 'handle:launch-1', deadline: io.now() + 2_000, currency: () => { dispatches++; return ok; } });
    if (name === 'pipelined') io.wait(200);          // both frames already buffered
    expect(() => channel.consume('native-context:op-1', bigDelivery), name).toThrow(detail);
    expect(channel.closed, name).toBe(true);
    if (name !== 'early readback' && name !== 'skip ahead') expect(dispatches, name).toBe(0);
    child.kill();
  }
  // A forged final readback is returned verbatim; the existing native-context
  // adapter's equality check against hashBytes(bytes) then refuses it.
  const small = 'tiny delivery';
  const second = canonicalText({ ...base, sequence: 2, body: { ...base.body, offset: Buffer.byteLength(small), readback: hashBytes('forged') } });
  const forged = workerChannel(['-e', `const {readSync,writeSync}=require('fs');` +
    `const send=t=>{const p=Buffer.from(t);const h=Buffer.alloc(4);h.writeUInt32BE(p.length);writeSync(3,Buffer.concat([h,p]));};` +
    `send(${JSON.stringify(canonicalText(base))});const b=Buffer.alloc(65540);readSync(3,b,0,65540,null);` +
    `send(${JSON.stringify(second)});setTimeout(()=>{},2000);`]);
  const channel = createInstalledChannelNativeContextIO({ io: forged.io, identity: 'process:1', artifact: hashBytes('artifact'),
    handle: 'handle:launch-1', deadline: forged.io.now() + 2_000, currency: () => ok });
  const receipt = channel.consume('native-context:op-1', small);
  expect(receipt.digest).not.toBe(hashBytes(small));
  forged.child.kill();
});

it('confined delivery driver checks current authority at dispatch and before a delayed result returns', () => {
  const f = realTenFixture();
  const history = f.runtime.history;
  const liveProcess = { owner: 'part-ten' as const, resolve: (l: any) => f.success({ launch: l.id, run: l.run,
    incarnation: l.incarnation, harness: l.harness, artifactDigest: l.artifactDigest, machine: l.machine, processIdentity: 'pid:42:start:1' }) };
  let verdicts: any[] = [];
  const driver = createConfinedContextDeliveryDriver({ runtime: f.runtime, history, context: { ...f.host.boundary, history },
    clock: () => f.deps.clock().value, liveProcess, execution: f.effects.executor, currency: () => verdicts.shift() ?? ok });
  const spec = value<any>(f.runtime.recordContextDelivery(f.spec()));
  const delivered = () => f.owners.events.filter((e: string) => e === 'deliver').length;
  const before = delivered();
  verdicts = [no('stopped before dispatch')];
  expect(refused(driver.deliver(spec, { operation: spec.operation, claim: spec.claim }))).toContain('stopped before dispatch');
  expect(delivered()).toBe(before);                          // never dispatched
  verdicts = [ok, no('revoked while delivery was in flight')];
  expect(refused(driver.deliver(spec, { operation: spec.operation, claim: spec.claim })))
    .toContain('revoked while delivery was in flight');
  expect(value<any[]>(f.runtime.inspectCurrent()).some(row => row.record.type === 'HarnessObservation'
    && row.record.phase === 'input-accepted' && row.record.contextDelivery !== undefined
    && row.record.launch === spec.launch && row.record.step === spec.step)).toBe(false); // delayed acceptance suppressed
});

// MUST-FIX 3: S8 constructor-bound locator resolution, fixed synchronous client
// and receipt translation. The monitor below is a SYNTHETIC transport leaf only
// (test key/time); the store, facts, claim and consumed successor are genuine.
import { createProductionLaunchBoundary as createInstalledBoundary } from '../../src/assembly/production-launch-boundary.js';
import { createFactStore } from '../../src/facts/index.js';

function syntheticMonitor(state = 'running', reason = 'ok') {
  const keys = generateKeyPairSync('ed25519');
  const digestValue = value(canonical('release')).hash;
  const calls: any[] = [];
  let tamper = false;
  const client = { exchange: (bytes: Uint8Array) => {
    const request = monitorRequest(unframe(Buffer.from(bytes)));
    calls.push(request);
    const launch = request.method === 'launch';
    const attributable = ['running', 'exited', 'expired', 'stopped'].includes(state);
    const identity = launch ? launchIdentity(request, 'boot:test') : request.body.launchIdentity;
    const receipt = { installation: request.installation, machine: request.machine, bootId: attributable ? 'boot:test' : null,
      releaseDigest: digestValue, request: request.body.request, operation: request.body.operation, digest: request.body.digest,
      claim: launch ? request.body.claim : null, consumed: launch ? request.body.consumed : null,
      specification: launch ? request.body.specification : null,
      launchIdentity: identity ?? null,
      uid: attributable ? 499 : null, pid: attributable ? 4242 : null,
      processStartIdentity: attributable ? { bootId: 'boot:test', uniqueId: '9', startTicks: '1' } : null,
      artifactDigest: digestValue, profileDigest: digestValue, handlePolicyDigest: digestValue, limitsDigest: digestValue,
      originalDeadline: attributable ? { ownerClockReference: 'clock:test', ownerValidUntil: 100, bootId: 'boot:test',
        continuousTicks: '200', timebaseNumer: '1', timebaseDenom: '1' } : null,
      state, reason, sequence: calls.length, observedAt: { clockReference: 'clock:test', value: 50 },
      freshForMs: 500, currentBootId: 'boot:test', evidenceReferences: attributable ? ['monitor:evidence:1'] : [] };
    const reply = signReply(request, receipt, 'key:test', keys.privateKey);
    return frame(tamper ? { ...reply, receipt: { ...reply.receipt, pid: 1 } } : reply);
  } };
  const trust = { keyId: 'key:test', publicKey: keys.publicKey, releaseDigest: digestValue, artifactDigest: digestValue,
    profileDigest: digestValue, handlePolicyDigest: digestValue, limitsDigest: digestValue, currentBootId: 'boot:test',
    clockReference: 'clock:test', now: 50, authorityValidUntil: 100, millisecondsPerUnit: 1 };
  return { client, trust, calls, tamperNext: () => { tamper = true; } };
}

it('S8 resolves exact launch locators from the genuine store, calls the fixed client once and maps the signed receipt', () => {
  const root = diskRoot();
  try {
    const { f, spec, locators, writer, view } = monitorContextFixture(root);
    const monitor = syntheticMonitor();
    const installed = (trust: any = monitor.trust) => ({ installation: 'installation:test', machine: 'machine-a',
      store: createFactStore(f.ctx, view.segment), client: monitor.client, trust: () => trust,
      generation: () => f.host.current().generation });
    value(view.refresh());
    const s8 = createInstalledBoundary(f.c, installed());
    expect(s8.state).toBe('monitor-installed');
    // Unavailable trust or a non-exact specification: zero transport calls.
    expect(refused(createInstalledBoundary(f.c, installed(null)).launch(spec, locators.operation, locators.claim)))
      .toContain('installed receipt trust unavailable');
    expect(refused(s8.launch({ ...spec, principal: 'someone-else' }, locators.operation, locators.claim)))
      .toContain('exact signed launch specification absent');
    expect(refused(createInstalledBoundary(f.c, installed()).launch(spec, locators.operation, locators.consumed)))
      .toContain('original dispatch claim absent');
    expect(monitor.calls).toHaveLength(0);
    const launched = value(s8.launch(spec, locators.operation, locators.claim));
    expect(monitor.calls).toHaveLength(1);
    expect(monitor.calls[0].body).toEqual(locators);       // exactly the genuine owner tuple
    expect(launched).toMatchObject({ phase: 'launched', launch: spec.id, run: spec.run, detail: 'running:ok',
      sourceEvidence: ['monitor:evidence:1'] });
    expect(refused(s8.launch(spec, locators.operation, locators.claim))).toContain('observe instead');
    expect(monitor.calls).toHaveLength(1);                  // never resent
    monitor.tamperNext();
    const tampered = createInstalledBoundary(f.c, installed());
    expect(refused(tampered.launch(spec, locators.operation, locators.claim))).toContain('invalid receipt signature');
    view.close(); writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('S8 validates trust before any transport and re-reads current trust and clock to verify the reply', () => {
  const root = diskRoot();
  try {
    const { f, spec, locators, writer, view } = monitorContextFixture(root);
    value(view.refresh());
    const monitor = syntheticMonitor();
    let reads = 0;
    const installed = (trust: () => any) => ({ installation: 'installation:test', machine: 'machine-a',
      store: createFactStore(f.ctx, view.segment), client: monitor.client, trust: () => { reads += 1; return trust(); },
      generation: () => f.host.current().generation });
    // (1) Already expired, and malformed, non-null trust: refused with zero transport calls.
    expect(refused(createInstalledBoundary(f.c, installed(() => ({ ...monitor.trust, now: 101 })))
      .launch(spec, locators.operation, locators.claim))).toContain('installed receipt trust expired');
    expect(refused(createInstalledBoundary(f.c, installed(() => ({ ...monitor.trust, releaseDigest: 'x' })))
      .launch(spec, locators.operation, locators.claim))).toContain('installed receipt trust malformed');
    expect(refused(createInstalledBoundary(f.c, installed(() => ({ ...monitor.trust, extra: 1 })))
      .launch(spec, locators.operation, locators.claim))).toContain('closed shape required');
    expect(monitor.calls).toHaveLength(0);
    // (2) Review reproduction: the owner clock moves from 50 to 1001 inside the
    // exchange (authorityValidUntil=100). The delayed receipt is refused.
    let clock = 50;
    const delayed = createInstalledBoundary(f.c, installed(() => ({ ...monitor.trust, now: clock })));
    const client = monitor.client.exchange;
    monitor.client.exchange = (bytes: Uint8Array) => { const reply = client(bytes); clock = 1_001; return reply; };
    reads = 0;
    expect(refused(delayed.launch(spec, locators.operation, locators.claim))).toContain('installed receipt trust expired');
    expect(reads).toBe(2);                                  // before transport and again for verification
    expect(monitor.calls).toHaveLength(1);
    // (3) A changed binding (rotated key) during the exchange refuses too.
    const rotated = generateKeyPairSync('ed25519').publicKey;
    let key = monitor.trust.publicKey;
    monitor.client.exchange = (bytes: Uint8Array) => { const reply = client(bytes); key = rotated; return reply; };
    expect(refused(createInstalledBoundary(f.c, installed(() => ({ ...monitor.trust, publicKey: key })))
      .launch(spec, locators.operation, locators.claim))).toContain('trust changed during the exchange');
    // Positive neighbour: trust unchanged and current -> launched, two reads.
    monitor.client.exchange = client; reads = 0;
    expect(value(createInstalledBoundary(f.c, installed(() => monitor.trust))
      .launch(spec, locators.operation, locators.claim))).toMatchObject({ phase: 'launched' });
    expect(reads).toBe(2);
    view.close(); writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('S8 observation after restart resolves the original tuple and current Six wake, never a new operation', () => {
  const root = diskRoot();
  try {
    const { f, spec, locators, writer, view } = monitorContextFixture(root);
    const monitor = syntheticMonitor('unknown', 'not-observed');
    const restarted = () => { value(view.refresh()); return createInstalledBoundary(f.c, { installation: 'installation:test',
      machine: 'machine-a', store: createFactStore(f.ctx, view.segment), client: monitor.client,
      trust: () => monitor.trust, generation: () => f.host.current().generation }); };
    expect(refused(restarted().observe(locators.operation, locators.digest))).toContain('no current admitted wake');
    expect(monitor.calls).toHaveLength(0);
    f.time(f.host.current().clock.value + 2);
    value(f.effects.transport.recover('s8-observe', f.effects.fence, locators.operation,
      { owner: 'part-eight', observe: () => f.success({ owner: 'part-eight', name: 'OperationObservation', id: 'obs:s8' }) }));
    const observed = value(restarted().observe(locators.operation, locators.digest));
    expect(observed).toMatchObject({ phase: 'uncertain', launch: spec.id, detail: 'unknown:not-observed' });
    const sent = monitor.calls[0];
    expect(sent.method).toBe('observe');
    expect(sent.body).toMatchObject({ request: locators.request, operation: locators.operation, digest: locators.digest,
      launchIdentity: null });
    expect(refused(restarted().observe('operation:new', locators.digest))).toContain('original operation absent');
    expect(refused(restarted().observe(locators.operation, digest('changed')))).toContain('original operation absent or changed');
    expect(monitor.calls).toHaveLength(1);
    const refusedMonitor = syntheticMonitor('refused-before-release', 'authority');
    const s8 = createInstalledBoundary(f.c, { installation: 'installation:test', machine: 'machine-a',
      store: createFactStore(f.ctx, view.segment), client: refusedMonitor.client, trust: () => refusedMonitor.trust,
      generation: () => f.host.current().generation });
    expect(value(s8.observe(locators.operation, locators.digest)).phase).toBe('refused');
    view.close(); writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.runIf(darwin)('M1 synchronous client is the pinned enforcer client role with a bounded timeout and no fallback', () => {
  const dir = tempRoot();
  try {
    const enforcer = buildEnforcer(dir, join(dir, 'absent.sock'));
    const client = createMonitorClient(enforcer);
    const started = Date.now();
    expect(() => client.exchange(frame({ v: 1 }))).toThrow('monitor client refused');
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(() => createMonitorClient('relative/enforcer')).toThrow('absolute pinned enforcer path required');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// M1 service: decision logic over the genuine fixed reader. The release leaf is
// SYNTHETIC (no native release exists: see the Sprint 2 feasibility conflict).
import { createMonitorService, initializeJournal } from '../../scripts/fixed-native-worker-monitor.mjs';

// Installed evidence (SYNTHETIC here): the journal genesis the reviewed manifest pins.
const journalGenesis = { installation: 'installation:test', machine: 'machine-a', journal: 'journal:test-1' };

function serviceFixture(root: string, journalPath: string, options: { context?: boolean; release?: boolean; sync?: any } = {}) {
  const setup = monitorContextFixture(root);
  const keys = generateKeyPairSync('ed25519');
  const digestValue = value(canonical('release')).hash;
  const digests = { releaseDigest: digestValue, artifactDigest: digestValue, profileDigest: digestValue,
    handlePolicyDigest: digestValue, limitsDigest: digestValue };
  const released: string[] = [];
  const release = { start: (closure: any, identity: string) => { released.push(identity); return { uid: 499, pid: 4242,
      processStartIdentity: { bootId: 'boot:test', uniqueId: '9', startTicks: '1' },
      originalDeadline: { ownerClockReference: 'clock:test', ownerValidUntil: 100, bootId: 'boot:test',
        continuousTicks: '200', timebaseNumer: '1', timebaseDenom: '1' }, evidenceReferences: [`release:${closure.bundle}`] }; },
    observe: () => ({ state: 'running', reason: 'ok' }) };
  if (!existsSync(journalPath)) initializeJournal(journalPath, journalGenesis);   // the installation path, once
  const config = { installation: 'installation:test', machine: 'machine-a', bootId: 'boot:test',
    digests, clockReference: 'clock:test', now: () => 50, keyId: 'key:test', privateKey: keys.privateKey,
    journal: new OfflineJournal(journalPath, undefined, { sync: options.sync ?? null, established: true }), journalGenesis,
    context: options.context === false ? null : setup.context,
    release: options.release === false ? null : release };
  const service = createMonitorService(config);
  const trust = { keyId: 'key:test', publicKey: keys.publicKey, ...digests, currentBootId: 'boot:test',
    clockReference: 'clock:test', now: 50, authorityValidUntil: 100, millisecondsPerUnit: 1 };
  const s8 = () => { value(setup.view.refresh()); return createInstalledBoundary(setup.f.c, { installation: 'installation:test',
    machine: 'machine-a', store: createFactStore(setup.f.ctx, setup.view.segment),
    client: { exchange: (bytes: Uint8Array) => service.handle(bytes) }, trust: () => trust,
    generation: () => setup.f.host.current().generation }); };
  return { ...setup, service, released, s8, trust, config };
}

it('M1 service releases once through the genuine reader and answers lost acknowledgements with the retained original', () => {
  const root = diskRoot(), dir = mkdtempSync(join(tmpdir(), 'instar-journal-'));
  try {
    const x = serviceFixture(root, join(dir, 'journal'));
    const first = value(x.s8().launch(x.spec, x.locators.operation, x.locators.claim));
    expect(first).toMatchObject({ phase: 'launched', detail: 'running:ok' });
    expect(x.released).toHaveLength(1);
    // Lost reply: a restarted S8 asks again; the service returns the retained
    // original receipt and never releases a second worker.
    const again = value(x.s8().launch(x.spec, x.locators.operation, x.locators.claim));
    expect(again.observedAt).toBe(first.observedAt);
    expect(x.released).toHaveLength(1);
    // A conflicting duplicate (other claim bytes) never claims non-occurrence.
    const conflicting = monitorRequest({ v: 1, method: 'launch', challenge: 'ef'.repeat(32), installation: 'installation:test',
      machine: 'machine-a', body: { ...x.locators, claim: x.locators.consumed } });
    const reply = unframe(x.service.handle(frame(conflicting)));
    expect(reply.receipt).toMatchObject({ state: 'unknown', reason: 'binding' });
    expect(x.released).toHaveLength(1);
    // Torn journal: new launches refuse; a decided original stays uncertain.
    const bytes = readFileSync(join(dir, 'journal'));
    writeFileSync(join(dir, 'journal'), bytes.subarray(0, -3));
    expect(unframe(x.service.handle(frame(conflicting))).receipt).toMatchObject({ reason: 'journal-untrusted' });
    expect(x.released).toHaveLength(1);
    x.view.close(); x.writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); }
});

it('M1 service refuses before any decision while the installed reader or native release is unavailable', () => {
  for (const [options, reason] of [[{ context: false }, 'authority'], [{ release: false }, 'unsupported']] as const) {
    const root = diskRoot(), dir = mkdtempSync(join(tmpdir(), 'instar-journal-'));
    try {
      const x = serviceFixture(root, join(dir, 'journal'), options);
      const observation = value(x.s8().launch(x.spec, x.locators.operation, x.locators.claim));
      expect(observation).toMatchObject({ phase: 'refused', detail: `refused-before-release:${reason}` });
      expect(x.released).toHaveLength(0);
      expect(new OfflineJournal(join(dir, 'journal')).entries.map(row => row.kind)).toEqual(['initialized']);  // no dispatch decision
      x.view.close(); x.writer.close();
    } finally { rmSync(root, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); }
  }
});

// A service restart over the same installed configuration and journal path.
function serviceFixtureRestart(x: { config: any }, path: string) {
  return createMonitorService({ ...x.config, journal: new OfflineJournal(path, undefined, { established: true }) });
}

it('M1 journal loss, truncation or a foreign re-initialization inhibits new launches across service restart', () => {
  const root = diskRoot(), dir = mkdtempSync(join(tmpdir(), 'instar-journal-'));
  try {
    const path = join(dir, 'journal');
    const x = serviceFixture(root, path);
    expect(value(x.s8().launch(x.spec, x.locators.operation, x.locators.claim))).toMatchObject({ phase: 'launched' });
    expect(x.released).toHaveLength(1);
    const kept = readFileSync(path);
    const request = () => frame(monitorRequest({ v: 1, method: 'launch', challenge: '12'.repeat(32),
      installation: 'installation:test', machine: 'machine-a', body: x.locators }));
    // (1) Review reproduction: remove only the journal, reconstruct, send the identical request.
    rmSync(path);
    expect(() => serviceFixtureRestart(x, path)).toThrow('journal-untrusted');   // restart refuses to open
    expect(unframe(x.service.handle(request())).receipt).toMatchObject({ state: 'unknown', reason: 'journal-untrusted' });
    expect(x.released).toHaveLength(1);
    // (2) An empty re-initialized replacement with another genesis refuses too.
    initializeJournal(path, { ...journalGenesis, journal: 'journal:replacement' });
    const foreign = serviceFixtureRestart(x, path);
    expect(unframe(foreign.handle(request())).receipt).toMatchObject({ state: 'refused-before-release', reason: 'journal-untrusted' });
    // (3) Within a lifetime, rollback to a shorter genuine prefix refuses.
    writeFileSync(path, kept);
    const restored = serviceFixtureRestart(x, path);
    expect(unframe(restored.handle(request())).receipt).toMatchObject({ state: 'running' });   // retained original, not a release
    writeFileSync(path, kept.subarray(0, 4 + kept.readUInt32BE(0) + 32));        // genesis only
    expect(unframe(restored.handle(request())).receipt.reason).toBe('journal-untrusted');
    expect(x.released).toHaveLength(1);
    // (4) The service will not start on an unestablished journal or a genesis for another installation.
    expect(() => createMonitorService({ ...x.config, journal: new OfflineJournal(join(dir, 'none')) }))
      .toThrow('configuration incomplete');
    expect(() => createMonitorService({ ...x.config, journalGenesis: { ...journalGenesis, installation: 'installation:other' } }))
      .toThrow('configuration incomplete');
    expect(() => initializeJournal(path, journalGenesis)).toThrow();            // never over an existing journal
    x.view.close(); x.writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); }
});

it('two processes racing the same launch against one journal release at most once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'instar-race-'));
  try {
    const keys = generateKeyPairSync('ed25519');
    const pem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const request = { v: 1, method: 'launch', challenge: 'ab'.repeat(32), installation: 'installation:test', machine: 'machine-a',
      body: { request: 'request:1', specification: 'spec:1', claim: 'claim:1', consumed: 'consumed:1',
        operation: 'operation:1', digest: digest('race') } };
    // Owner stand-in (SYNTHETIC, labelled): this case tests only journal
    // exclusion across processes, not owner authority.
    const script = `
      import { createMonitorService, OfflineJournal, frame, unframe } from ${JSON.stringify(monitorScript)};
      import { createPrivateKey } from 'node:crypto';
      import { appendFileSync } from 'node:fs';
      const ok = v => ({ type: 'Result', schemaVersion: 1, kind: 'Success', value: v });
      const context = { resolveLaunch: () => ok({ bundle: 'bundle:1' }), recheck: c => ok(c), resolveObservation: () => ok({}) };
      const release = { start: (c, identity) => { appendFileSync(${JSON.stringify(join(dir, 'released'))}, identity + '\\n');
        return { uid: 499, pid: process.pid, processStartIdentity: { bootId: 'boot:test', uniqueId: String(process.pid), startTicks: '1' },
          originalDeadline: { ownerClockReference: 'clock:test', ownerValidUntil: 100, bootId: 'boot:test', continuousTicks: '2', timebaseNumer: '1', timebaseDenom: '1' },
          evidenceReferences: ['release:race'] }; }, observe: () => null };
      const d = ${JSON.stringify(digest('release'))};
      const service = createMonitorService({ installation: 'installation:test', machine: 'machine-a', bootId: 'boot:test',
        digests: { releaseDigest: d, artifactDigest: d, profileDigest: d, handlePolicyDigest: d, limitsDigest: d },
        clockReference: 'clock:test', now: () => 50, keyId: 'key:test', privateKey: createPrivateKey(${JSON.stringify(pem)}),
        journal: new OfflineJournal(${JSON.stringify(join(dir, 'journal'))}, undefined, { established: true }),
        journalGenesis: ${JSON.stringify(journalGenesis)}, context, release });
      const start = ${Date.now() + 400}; while (Date.now() < start) {}
      process.stdout.write(unframe(service.handle(frame(${JSON.stringify(request)}))).receipt.state);`;
    initializeJournal(join(dir, 'journal'), journalGenesis);
    const run = () => new Promise<string>(resolve => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = ''; child.stdout.on('data', chunk => { out += chunk; }); child.on('close', () => resolve(out));
    });
    const states = await Promise.all([run(), run(), run()]);
    const releases = existsSync(join(dir, 'released')) ? readFileSync(join(dir, 'released'), 'utf8').trim().split('\n') : [];
    expect(releases).toHaveLength(1);
    // The winner reports running; a loser sees the retained original (running) or,
    // if it read between decision and release record, honest uncertainty.
    expect(states.every(state => state === 'running' || state === 'unknown')).toBe(true);
    expect(states).toContain('running');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 30_000);

// M2 durable journal primitive and client peer identity. Builder-local,
// unprivileged OS observations on this macOS build, not installed-host evidence.
import { createNativeJournalSync } from '../../scripts/fixed-native-worker-monitor.mjs';
import { chmodSync, symlinkSync } from 'node:fs';

it.runIf(darwin)('native journal-sync flushes an owner-only journal and refuses every other shape', () => {
  const dir = tempRoot();
  try {
    const enforcer = buildEnforcer(dir), sync = createNativeJournalSync(enforcer);
    const path = join(dir, 'journal');
    const journal = new OfflineJournal(path, undefined, { sync });
    expect(journal.durability).toBe('native-fullfsync');
    expect(new OfflineJournal(join(dir, 'other')).durability).toBe('offline-fsync');
    journal.append('dispatch-decided', 'id:1', { originalKey: 'k:1', value: {} });
    journal.append('released', 'id:1', { receipt: null });
    expect(new OfflineJournal(path).entries).toHaveLength(2);
    const run = (target: string) => spawnSync(enforcer, ['journal-sync', target], { encoding: 'utf8' }).status;
    expect(run(path)).toBe(0);
    symlinkSync(path, join(dir, 'link'));
    expect(run(join(dir, 'link'))).toBe(2);                      // no symlinked journal
    expect(run(join(dir, 'absent'))).toBe(2);
    expect(run('relative/journal')).toBe(2);
    expect(run(dir)).toBe(2);                                    // a directory is not a journal
    chmodSync(path, 0o666);
    expect(run(path)).toBe(2);                                   // group/other-writable journal refused
    // A failed durable sync means the entry never counts in memory.
    expect(() => journal.append('terminal', 'id:1', {})).toThrow('journal-untrusted');
    expect(journal.entries).toHaveLength(2);
    expect(() => createNativeJournalSync('relative/enforcer')).toThrow('absolute pinned enforcer path required');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it.runIf(darwin)('M1 service over the native durable journal releases once, and an unflushable decision never releases', () => {
  const dir = tempRoot();
  try {
    const sync = createNativeJournalSync(buildEnforcer(dir));
    for (const flushable of [false, true]) {
      const root = diskRoot(), jdir = join(dir, `journal-${flushable}`);
      mkdirSync(jdir, { mode: 0o700 });
      if (!flushable) chmodSync(jdir, 0o770);                    // the directory flush refuses
      try {
        const x = serviceFixture(root, join(jdir, 'journal'), { sync });
        const first = value(x.s8().launch(x.spec, x.locators.operation, x.locators.claim));
        if (flushable) expect(first).toMatchObject({ phase: 'launched', detail: 'running:ok' });
        else expect(first).toMatchObject({ phase: 'refused', detail: 'refused-before-release:journal-untrusted' });
        if (!flushable) {
          // The bytes reached the file but were never acknowledged as durable. After repair,
          // a retry finds that decision and answers uncertainty: it never releases.
          chmodSync(jdir, 0o700);
          const retry = unframe(x.service.handle(frame(monitorRequest({ v: 1, method: 'launch', challenge: 'cd'.repeat(32),
            installation: 'installation:test', machine: 'machine-a', body: x.locators }))));
          expect(retry.receipt).toMatchObject({ state: 'unknown', reason: 'identity-unknown' });
        }
        expect(x.released).toHaveLength(flushable ? 1 : 0);
        x.view.close(); x.writer.close();
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it.runIf(darwin)('the enforcer client checks the kernel-attested peer before sending any request byte', async () => {
  const dir = tempRoot();
  try {
    const socket = join(dir, 'control.sock'), received: Buffer[] = [];
    const reply = frame({ v: 1, ok: true });
    const server = createServer(connection => {
      connection.on('error', () => { /* a refusing client closes without reading */ });
      connection.on('data', chunk => received.push(chunk));
      connection.on('end', () => connection.end(reply));
    });
    await new Promise<void>(resolve => server.listen(socket, resolve));
    try {
      const uid = process.getuid!();
      // The release default is the root supervisor; a same-user socket is refused unspoken to.
      const wrongPeer = buildEnforcer(join(dir, 'a'), socket, 0);
      const refused = await new Promise<any>(resolve => {
        const child = spawn(wrongPeer, ['client']);
        let err = ''; child.stderr.on('data', d => { err += d; });
        child.on('close', status => resolve({ status, err }));
        child.stdin.end(frame({ v: 1 }));
      });
      expect(refused.status).toBe(2);
      expect(refused.err).toContain('client peer is not the supervisor');
      expect(Buffer.concat(received)).toHaveLength(0);
      // A build pinned to this account's uid (test-only) exchanges one frame.
      const rightPeer = buildEnforcer(join(dir, 'b'), socket, uid);
      const out = await new Promise<Buffer>((resolve, reject) => {
        const child = spawn(rightPeer, ['client']); const parts: Buffer[] = [];
        child.stdout.on('data', d => parts.push(d));
        child.on('close', status => status === 0 ? resolve(Buffer.concat(parts)) : reject(Error(`client ${status}`)));
        child.stdin.end(frame({ v: 1 }));
      });
      expect(Buffer.from(out).equals(Buffer.from(reply))).toBe(true);
      expect(Buffer.concat(received).equals(Buffer.from(frame({ v: 1 })))).toBe(true);
    } finally { await new Promise(resolve => server.close(resolve)); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 30_000);
