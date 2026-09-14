import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { canonical, consumeResult, decode } from '../../src/index.js';
import { decodeHarnessObservation } from '../../src/assembly/index.js';
import {
  createHarnessEvidenceHolder,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
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

const [mode, cut, directory, loss, historyKind = 'full'] = process.argv.slice(2);

function take<T>(result: import('../../src/index.js').Result<T>): T {
  return consumeResult(result, {
    Success: row => row,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

const fixture = harnessFixture();
fixture.owner.time(mode === 'seed' ? 20 : 24);
if (mode === 'recover') {
  fixture.owner.raw.splice(0, fixture.owner.raw.length,
    ...JSON.parse(fs.readFileSync(`${directory}/ten-${historyKind}.json`, 'utf8')) as unknown[]);
}
const six = transportFixture(`${directory}/six`);
const fence = value(six.api.acquire('r7:poison:acquire', '', 500));
const spec = mode === 'recover'
  ? take(fixture.owner.c.history!.lookup('r7:launch:poison'))?.record
  : value(fixture.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'r7:launch:poison', artifactDigest: digest('native-artifact'), incarnation: fence.incarnation }));
if (!spec || spec.type !== 'HarnessLaunchSpec') throw new Error('expected signed launch');
const handle = signedHandle(fixture, { launch: spec.id, incarnation: spec.incarnation });
const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
  maxHandles: 4, maxAttempts: 8, context: fixture.owner.c,
  state: createHarnessAdapterFileState(`${directory}/handles.json`), admission: fixture.port });
if (mode === 'seed') handles.put(handle);

const nine = verificationRuntimeFixture();
nine.setGeneration('generation:fixture');
nine.time(mode === 'seed' ? 20 : 24);
if (mode === 'recover') {
  nine.bytes.splice(0, nine.bytes.length,
    ...JSON.parse(fs.readFileSync(`${directory}/nine.json`, 'utf8')) as unknown[]);
  nine.setEvidence((JSON.parse(fs.readFileSync(`${directory}/nine-evidence.json`, 'utf8')) as unknown[])
    .map(raw => take(decode('Evidence', raw, nine.host.current().decode))));
}

function exactSubject(event: HarnessRuntimeEvent): string {
  return take(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity])).bytes;
}

function confirmed(purpose: 'resume-compatible' | 'transcript-poison', at: number): HarnessRuntimeEvent {
  const event = witnessedEvent(fixture, 'diagnostic', { id: `r7:cut:event:${purpose}`,
    sourceEvidence: [`r7:cut:observation:${purpose}`], launch: handle.launch,
    incarnation: handle.incarnation, sourceClock: at, observedAt: at,
    diagnosticCode: `${purpose}:r7:cut:plan:${purpose}` });
  const base = verificationInput('VerificationPlan');
  const plan = { ...base, id: `r7:cut:plan:${purpose}`,
    subject: { ...base.subject, holder: `part-thirteen:${purpose}`, governed: exactSubject(event),
      scope: 'conversation:1', generation: 'generation:fixture' },
    arms: [{ ...base.arms[0]!, id: purpose, executable: `harness.${purpose}`,
      fixture: purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51' }],
    bar: { ...base.bar, sources: ['runtime-conversation'] },
    consumers: [{ ...base.consumers[0]!, id: `part-thirteen:${purpose}` }] };
  value(nine.runtime.record('VerificationPlan', plan));
  const fact = value(nine.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
  const probe = value(decodeProbeRecord({ ...verificationInput('ProbeRecord'), id: `r7:cut:probe:${purpose}`,
    predecessors: [fact], plan: plan.id, planVersion: plan.bar.version, arm: purpose,
    subject: plan.subject.governed }, nine.c));
  const witness = nine.witnessFor(probe, `r7:cut:evidence:${purpose}`);
  nine.setEvidence([...nine.host.current().evidence, witness]);
  value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  return event;
}

const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
  platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
  maxCaptureBytes: 1024, context: fixture.owner.c,
  state: createHarnessAdapterFileState(`${directory}/events.json`), admission: fixture.port,
  owners: { handles, current: fixture.owner.host, verification: nine.runtime } });

if (mode === 'seed') {
  evidence.admit(witnessedEvent(fixture, 'heartbeat', { id: 'r7:cut:event:live',
    sourceEvidence: ['r7:cut:observation:live'], launch: handle.launch, incarnation: handle.incarnation,
    sourceClock: 19, observedAt: 19, streamState: 'closed' }));
  fs.writeFileSync(`${directory}/ten-older.json`, JSON.stringify(fixture.owner.raw));
  const poison = confirmed('transcript-poison', 20);
  const compatible = confirmed('resume-compatible', 21);
  fs.writeFileSync(`${directory}/ten-full.json`, JSON.stringify(fixture.owner.raw));
  fs.writeFileSync(`${directory}/nine.json`, JSON.stringify(nine.bytes));
  fs.writeFileSync(`${directory}/nine-evidence.json`, JSON.stringify(nine.host.current().evidence));
  evidence.admit(poison);

  let syncs = 0;
  const original = fs.fsyncSync;
  fs.fsyncSync = ((descriptor: number) => {
    const result = original(descriptor);
    if (++syncs === 3 && cut === 'final-fsync') process.kill(process.pid, 'SIGKILL');
    return result;
  }) as typeof fs.fsyncSync;
  syncBuiltinESMExports();
  evidence.admit(compatible);
  process.stdout.write(JSON.stringify({ state: evidence.resume(handle, 20) }));
} else {
  const before = evidence.resume(handle, 24);
  if (loss === 'conflict' && historyKind === 'full') {
    const row = take(fixture.owner.c.history!.lookup('r7:cut:observation:transcript-poison'))!;
    if (!row.record || row.record.type !== 'HarnessObservation') throw new Error('expected poison observation');
    value(fixture.owner.spine.append(value(decodeHarnessObservation({ ...row.record,
      detail: `${row.record.detail}:conflict` }, { ...fixture.owner.c, validateReferences: false }))));
  }
  if (loss === 'nine-witness') {
    nine.setEvidence(nine.host.current().evidence
      .filter(row => row.id !== 'r7:cut:evidence:transcript-poison'));
  }
  const after = evidence.resume(handle, 24);
  process.stdout.write(JSON.stringify({ before, after,
    reconnect: sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine,
      incarnation: handle.incarnation, fence, now: 24, evidence, authority: six.api }, handles) }));
}
