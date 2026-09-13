import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { canonical, consumeResult, decode } from '../../src/index.js';
import { createHarnessEvidenceHolder, createRuntimeHandleHolder,
  sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { digest, harnessFixture, witnessedEvent } from './fixture.js';
import { signedHandle } from './a2-fixture.js';

const [mode, cut, directory] = process.argv.slice(2);
const take = <T>(result: import('../../src/index.js').Result<T>): T => consumeResult(result, {
  Success: row => row, Refused: refusal => { throw new Error(refusal.detail); },
});
const f = harnessFixture();
f.owner.time(20);
if (mode === 'recover') {
  f.owner.raw.splice(0, f.owner.raw.length,
    ...JSON.parse(fs.readFileSync(`${directory}/ten.json`, 'utf8')) as unknown[]);
}
const six = transportFixture(`${directory}/six`);
const fence = value(six.api.acquire('r4:poison:acquire', '', 500));
const spec = mode === 'recover'
  ? take(f.owner.c.history!.lookup('launch:r4:poison'))?.record
  : value(f.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch:r4:poison', artifactDigest: digest('native-artifact'), incarnation: fence.incarnation }));
if (!spec || spec.type !== 'HarnessLaunchSpec') throw new Error('expected launch');
const handle = signedHandle(f, { launch: spec.id, incarnation: fence.incarnation });
const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine, maxHandles: 4,
  maxAttempts: 8, context: f.owner.c, state: createHarnessAdapterFileState(`${directory}/handles.json`),
  admission: f.port });
if (mode === 'seed') handles.put(handle);
const nine = verificationRuntimeFixture();
nine.setGeneration('generation:fixture');
nine.time(20);
if (mode === 'recover') {
  nine.bytes.splice(0, nine.bytes.length, ...JSON.parse(fs.readFileSync(`${directory}/nine.json`, 'utf8')) as unknown[]);
  nine.setEvidence((JSON.parse(fs.readFileSync(`${directory}/nine-evidence.json`, 'utf8')) as unknown[])
    .map(raw => take(decode('Evidence', raw, nine.host.current().decode))));
}

function exactSubject(event: HarnessRuntimeEvent): string {
  return take(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity])).bytes;
}

function confirmed(purpose: 'resume-compatible' | 'transcript-poison', at: number): HarnessRuntimeEvent {
  const event = witnessedEvent(f, 'diagnostic', { id: `r4:event:${purpose}`,
    sourceEvidence: [`r4:observation:${purpose}`], launch: handle.launch, incarnation: handle.incarnation,
    sourceClock: at, observedAt: at, diagnosticCode: `${purpose}:plan:${purpose}` });
  const base = verificationInput('VerificationPlan');
  const plan = { ...base, id: `plan:${purpose}`,
    subject: { ...base.subject, holder: `part-thirteen:${purpose}`, governed: exactSubject(event),
      scope: 'conversation:1', generation: 'generation:fixture' },
    arms: [{ ...base.arms[0]!, id: purpose, executable: `harness.${purpose}`,
      fixture: purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51' }],
    bar: { ...base.bar, sources: ['runtime-conversation'] },
    consumers: [{ ...base.consumers[0]!, id: `part-thirteen:${purpose}` }] };
  value(nine.runtime.record('VerificationPlan', plan));
  const fact = value(nine.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
  const probe = value(decodeProbeRecord({ ...verificationInput('ProbeRecord'), id: `probe:${purpose}`,
    predecessors: [fact], plan: plan.id, planVersion: plan.bar.version, arm: purpose,
    subject: plan.subject.governed }, nine.c));
  const witness = nine.witnessFor(probe, `evidence:${purpose}`);
  nine.setEvidence([...nine.host.current().evidence, witness]);
  value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  return event;
}

const compatible = mode === 'seed' ? confirmed('resume-compatible', 20) : null;
const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
  platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
  maxCaptureBytes: 1024, context: f.owner.c,
  state: createHarnessAdapterFileState(`${directory}/events.json`), admission: f.port,
  owners: { handles, current: f.owner.host, verification: nine.runtime } });

if (mode === 'seed') {
  evidence.admit(compatible!);
  evidence.admit(witnessedEvent(f, 'heartbeat', { id: 'r4:poison:live',
    sourceEvidence: ['r4:observation:live'], launch: handle.launch, incarnation: handle.incarnation }));
  const poison = confirmed('transcript-poison', 21);
  fs.writeFileSync(`${directory}/ten.json`, JSON.stringify(f.owner.raw));
  fs.writeFileSync(`${directory}/nine.json`, JSON.stringify(nine.bytes));
  fs.writeFileSync(`${directory}/nine-evidence.json`, JSON.stringify(nine.host.current().evidence));
  const original = fs.symlinkSync;
  fs.symlinkSync = ((...args: Parameters<typeof fs.symlinkSync>) => {
    const result = original(...args);
    if (cut === 'lock') process.kill(process.pid, 'SIGKILL');
    return result;
  }) as typeof fs.symlinkSync;
  syncBuiltinESMExports();
  evidence.admit(poison);
} else {
  f.owner.time(22);
  nine.time(22);
  process.stdout.write(JSON.stringify({ resume: evidence.resume(handle, 22),
    reconnect: sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine,
      incarnation: handle.incarnation, fence, now: 22, evidence, authority: six.api }, handles) }));
}
