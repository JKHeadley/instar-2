// @ts-nocheck -- owner-produced Six/Ten admission boundary fixture.
import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createProductionRunAdmission, decodeLoopPolicy } from '../../src/transport/index.js';
import { createLiveInputAssemblyFixture, value, refused, digest } from './live-input-owner-fixture.js';
import { assemblyInput } from './fixture.js';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

// Native enforcer (M2): compiled with the recorded clang command into the test
// temp directory. These are unprivileged builder-local OS observations on the
// running macOS build, NOT installed-host evidence. Non-macOS hosts do not run them.
const darwin = process.platform === 'darwin';
function buildEnforcer(dir: string, socket?: string) {
  const out = join(dir, 'rel', 'bin', 'instar-worker-enforcer');
  mkdirSync(join(dir, 'rel', 'bin'), { recursive: true });
  const define = socket ? [`-DINSTAR_CONTROL_SOCKET="${socket}"`] : [];
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

function monitorContextFixture(root: string, withCapacity = true, divergent = false) {
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
  const capacity = { inspectCapacity: () => f.success({ sourceFrontier: value(f.effects.transport.inspect()).at(-1).fact.id,
    heads: [{ capacity: "capacity:stand-in", fact: { id: standInA }, usable: true, blocker: null }] }) };
  const view = setup.reader();
  const context = value(createProductionMonitorContext({ installation: 'installation:test', machine: 'machine-a',
    facts: f.ctx, storage: view, authority: f.effects.transport, current: () => f.host.current(),
    capacity: withCapacity ? capacity : undefined, context: f.c }));
  return { ...setup, spec, locators, context, view, standInA, resources };
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
