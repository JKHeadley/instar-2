import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { canonical, consumeResult } from '../../src/index.js';
import { createFutureHarnessAdapter } from '../../src/harness-adapters/adapter.js';
import { createHarnessEvidenceHolder, createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import type { HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import type { HarnessAdapterStateStorePort } from '../../src/harness-adapters/holder.js';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { decodedHandle, harnessFixture, witnessedEvent } from './fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';

const [mode, cut, path] = process.argv.slice(2) as [string, string, string];
const die = () => process.kill(process.pid, 'SIGKILL');
const original = {
  symlinkSync: fs.symlinkSync, writeFileSync: fs.writeFileSync, fsyncSync: fs.fsyncSync,
  renameSync: fs.renameSync, unlinkSync: fs.unlinkSync,
};

function exactSubject(event: HarnessRuntimeEvent): string {
  return consumeResult(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity]), {
    Success: encoded => encoded.bytes,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

function resumeOwner(event: HarnessRuntimeEvent) {
  const f = verificationRuntimeFixture();
  f.setGeneration('generation:fixture');
  f.time(20);
  const plan = { ...verificationInput('VerificationPlan'), id: 'plan:restart-resume',
    subject: { ...verificationInput('VerificationPlan').subject, holder: 'part-thirteen:resume-compatible',
      governed: exactSubject(event), scope: 'conversation:1', generation: 'generation:fixture' },
    arms: [{ ...verificationInput('VerificationPlan').arms[0]!, id: 'resume-compatible',
      executable: 'harness.resume-compatible', fixture: 'P13-NF-38' }],
    bar: { ...verificationInput('VerificationPlan').bar, sources: ['runtime-conversation'] },
    consumers: [{ ...verificationInput('VerificationPlan').consumers[0]!,
      id: 'part-thirteen:resume-compatible' }] };
  value(f.runtime.record('VerificationPlan', plan));
  const fact = value(f.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
  const probe = value(decodeProbeRecord({ ...verificationInput('ProbeRecord'), id: 'probe:restart-resume',
    predecessors: [fact], plan: plan.id, planVersion: plan.bar.version, arm: 'resume-compatible',
    subject: plan.subject.governed }, f.c));
  const witness = f.witnessFor(probe, 'evidence:restart-resume');
  f.setEvidence([witness]);
  value(f.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  return f.runtime;
}

const f = harnessFixture();
f.owner.time(20);
const seedHandle = decodedHandle(f);
const spec = value(f.owner.runtime.record('HarnessLaunchSpec', {
  ...assemblyInput('HarnessLaunchSpec'), id: 'launch:restart', run: 'run:restart', step: 'step:restart',
  artifactDigest: seedHandle.artifactDigest, inputDigest: seedHandle.inputDigest,
}));
const handle = decodedHandle(f, { id: 'handle:restart', launch: spec.id, run: spec.run, step: spec.step });
const contract = value(f.owner.runtime.record('AdapterEvidenceContract', {
  ...assemblyInput('AdapterEvidenceContract'), id: 'contract:restart', adapter: 'native',
  artifact: handle.artifactDigest,
}));
const conformance = value(f.owner.runtime.record('AdapterConformance', {
  ...assemblyInput('AdapterConformance'), id: 'conformance:restart', contract: contract.id,
  adapter: 'native', artifact: handle.artifactDigest, platform: handle.platform, mode: 'advisory',
}));
const delivery = { launch: handle.launch, intake: handle.input, digest: handle.inputDigest,
  incarnation: handle.incarnation, operation: 'operation:restart-delivery' };
const subjectDigest = value(canonical(delivery)).hash;
const handleState = createHarnessAdapterFileState(path) as HarnessAdapterStateStorePort;
const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 4,
  maxAttempts: 8, context: f.owner.c, state: handleState, admission: f.port });
if (handles.lookup(handle.launch).state === 'missing') handles.put(handle);
handles.beginAttempt({ kind: 'delivery', operation: delivery.operation, launch: delivery.launch,
  incarnation: delivery.incarnation, subjectDigest, attemptedAt: 20 });

const subject = { launch: handle.launch, run: handle.run, step: handle.step };
const closure = witnessedEvent(f, 'turn-closed', { ...subject, id: 'restart:closure', sourceClock: 20, observedAt: 20,
  streamState: 'closed', childrenState: 'closed', unresolvedOperations: [] });
const pending = witnessedEvent(f, 'input-accepted', { ...subject, id: 'restart:pending-input', sourceClock: 20, observedAt: 20,
  streamState: 'open', unresolvedOperations: ['operation:restart-delivery'] });
const resume = witnessedEvent(f, 'diagnostic', { ...subject, id: 'restart:resume', sourceClock: 20, observedAt: 20,
  diagnosticCode: 'resume-compatible:plan:restart-resume' });
const evidenceState = createHarnessAdapterFileState(`${path}.evidence`) as HarnessAdapterStateStorePort;
const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
  platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
  context: f.owner.c, state: evidenceState, admission: f.port,
  owners: { handles, current: f.owner.host, verification: resumeOwner(resume) } });
for (const event of [closure, pending, resume]) evidence.admit(event);

if (mode === 'seed') {
  let syncs = 0;
  fs.symlinkSync = ((...args: Parameters<typeof fs.symlinkSync>) => {
    const result = original.symlinkSync(...args); if (cut === 'lock') die(); return result;
  }) as typeof fs.symlinkSync;
  fs.writeFileSync = ((...args: Parameters<typeof fs.writeFileSync>) => {
    const result = original.writeFileSync(...args);
    if (cut === 'write' && String(args[0]).includes('.pending-')) die(); return result;
  }) as typeof fs.writeFileSync;
  fs.fsyncSync = ((...args: Parameters<typeof fs.fsyncSync>) => {
    const result = original.fsyncSync(...args);
    if (cut === `fsync:${++syncs}`) die(); return result;
  }) as typeof fs.fsyncSync;
  fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
    const result = original.renameSync(...args); if (cut === 'rename') die(); return result;
  }) as typeof fs.renameSync;
  fs.unlinkSync = ((...args: Parameters<typeof fs.unlinkSync>) => {
    const result = original.unlinkSync(...args);
    if (cut === 'unlink' && String(args[0]).endsWith('.lock')) die(); return result;
  }) as typeof fs.unlinkSync;
  syncBuiltinESMExports();
  handles.finishAttempt(delivery.operation, 'absent-from-owner-history', 20);
  process.stdout.write(JSON.stringify({ status: 'saved' }));
} else {
  let driverCalls = 0;
  const tripwire = () => { driverCalls++; throw new Error('restart replay must not invoke a driver'); };
  const packageView = createFutureHarnessAdapter({ id: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, conformance: conformance.id, machine: handle.machine,
    driver: { owner: 'part-eight', launch: tripwire, deliver: tripwire, observe: tripwire },
    handles, evidence, context: f.owner.c, clock: () => 21,
    generation: () => f.owner.host.current().generation });
  const deliveryView = value(packageView.adapter.deliver(delivery));
  const attempt = handles.beginAttempt({ kind: 'delivery', operation: delivery.operation, launch: delivery.launch,
    incarnation: delivery.incarnation, subjectDigest, attemptedAt: 21 }).attempt;
  process.stdout.write(JSON.stringify({ status: 'recovered', attemptState: attempt?.state,
    attemptedAt: attempt?.attemptedAt, delivery: deliveryView.phase,
    completion: evidence.completion(handle, 20).state, resume: evidence.resume(handle, 20).state, driverCalls }));
}
