import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { canonical, consumeResult, decode } from '../../src/index.js';
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

const [mode, cut, directory, loss] = process.argv.slice(2);
if (!mode || !cut || !directory || !loss) throw new Error('mode, cut, directory, and loss are required');

function take<T>(result: import('../../src/index.js').Result<T>): T {
  return consumeResult(result, {
    Success: row => row,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

const ten = harnessFixture();
ten.owner.time(mode === 'seed' ? 22 : 24);
if (mode === 'recover') {
  ten.owner.raw.splice(0, ten.owner.raw.length,
    ...JSON.parse(fs.readFileSync(`${directory}/ten-full.json`, 'utf8')) as unknown[]);
}
const six = transportFixture(`${directory}/six`);
const fence = value(six.api.acquire('r9:poison:acquire', '', 500));
const spec = mode === 'recover'
  ? take(ten.owner.c.history!.lookup('r9:launch:poison'))?.record
  : value(ten.owner.runtime.record('HarnessLaunchSpec', {
      ...assemblyInput('HarnessLaunchSpec'),
      id: 'r9:launch:poison',
      artifactDigest: digest('native-artifact'),
      incarnation: fence.incarnation,
    }));
if (!spec || spec.type !== 'HarnessLaunchSpec') throw new Error('expected signed launch');
const handle = signedHandle(ten, { launch: spec.id, incarnation: spec.incarnation });
const handles = createRuntimeHandleHolder({
  adapter: handle.harness,
  machine: handle.machine,
  maxHandles: 4,
  maxAttempts: 8,
  context: ten.owner.c,
  state: createHarnessAdapterFileState(`${directory}/handles.json`),
  admission: ten.port,
});
if (mode === 'seed' && handles.put(handle).disposition !== 'stored') {
  throw new Error('failed to retain seed handle');
}

const nine = verificationRuntimeFixture();
nine.setGeneration('generation:fixture');
nine.time(mode === 'seed' ? 22 : 24);
if (mode === 'recover') {
  nine.bytes.splice(0, nine.bytes.length,
    ...JSON.parse(fs.readFileSync(`${directory}/nine-${loss}.json`, 'utf8')) as unknown[]);
  nine.setEvidence((JSON.parse(fs.readFileSync(`${directory}/nine-evidence.json`, 'utf8')) as unknown[])
    .map(raw => take(decode('Evidence', raw, nine.host.current().decode))));
}

function exactSubject(event: HarnessRuntimeEvent): string {
  return take(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity])).bytes;
}

function confirmed(purpose: 'resume-compatible' | 'transcript-poison', at: number): HarnessRuntimeEvent {
  const event = witnessedEvent(ten, 'diagnostic', {
    id: `r9:cut:event:${purpose}`,
    sourceEvidence: [`r9:cut:observation:${purpose}`],
    launch: handle.launch,
    incarnation: handle.incarnation,
    sourceClock: at,
    observedAt: at,
    diagnosticCode: `${purpose}:r9:cut:plan:${purpose}`,
  });
  const base = verificationInput('VerificationPlan');
  const plan = {
    ...base,
    id: `r9:cut:plan:${purpose}`,
    subject: { ...base.subject, holder: `part-thirteen:${purpose}`, governed: exactSubject(event),
      scope: 'conversation:1', generation: 'generation:fixture' },
    arms: [{ ...base.arms[0]!, id: purpose, executable: `harness.${purpose}`,
      fixture: purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51' }],
    bar: { ...base.bar, sources: ['runtime-conversation'] },
    consumers: [{ ...base.consumers[0]!, id: `part-thirteen:${purpose}` }],
  };
  value(nine.runtime.record('VerificationPlan', plan));
  const fact = value(nine.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
  const probe = value(decodeProbeRecord({
    ...verificationInput('ProbeRecord'),
    id: `r9:cut:probe:${purpose}`,
    predecessors: [fact],
    plan: plan.id,
    planVersion: plan.bar.version,
    arm: purpose,
    subject: plan.subject.governed,
  }, nine.c));
  const witness = nine.witnessFor(probe, `r9:cut:evidence:${purpose}`);
  nine.setEvidence([...nine.host.current().evidence, witness]);
  value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  return event;
}

function installBoundaryCut(boundary: string): void {
  let opens = 0;
  let closes = 0;
  for (const [method, label] of [['mkdirSync', 'lock'], ['openSync', 'open'], ['writeFileSync', 'write'],
    ['fsyncSync', 'fsync'], ['closeSync', 'close'], ['renameSync', 'rename']] as const) {
    const original = fs[method] as (...args: never[]) => unknown;
    (fs[method] as unknown as (...args: never[]) => unknown) = (...args: never[]) => {
      const result = original(...args);
      const actual = label === 'open' ? `open:${++opens}` : label === 'close' ? `close:${++closes}`
        : label === 'fsync' ? `fsync:${opens}` : label;
      if (label === 'lock' && !String(args[0]).endsWith('append.lock')) return result;
      if (label === 'write' && typeof args[0] !== 'number') return result;
      if (actual === boundary) process.kill(process.pid, 'SIGKILL');
      return result;
    };
  }
  syncBuiltinESMExports();
}

const evidence = createHarnessEvidenceHolder({
  adapter: handle.harness,
  artifact: handle.artifactDigest,
  platform: handle.platform,
  machine: handle.machine,
  scope: 'conversation:1',
  maxEvents: 8,
  maxCaptureBytes: 1024,
  context: ten.owner.c,
  state: createHarnessAdapterFileState(`${directory}/events.json`),
  admission: ten.port,
  owners: { handles, current: ten.owner.host, verification: nine.runtime },
});

if (mode === 'seed') {
  evidence.admit(witnessedEvent(ten, 'heartbeat', {
    id: 'r9:cut:event:live',
    sourceEvidence: ['r9:cut:observation:live'],
    launch: handle.launch,
    incarnation: handle.incarnation,
    sourceClock: 19,
    observedAt: 19,
    streamState: 'closed',
  }));
  const compatible = confirmed('resume-compatible', 21);
  const poisonPrefix = nine.bytes.length;
  const poison = confirmed('transcript-poison', 20);
  fs.writeFileSync(`${directory}/ten-full.json`, JSON.stringify(ten.owner.raw));
  fs.writeFileSync(`${directory}/nine-control.json`, JSON.stringify(nine.bytes));
  fs.writeFileSync(`${directory}/nine-probe-prefix.json`, JSON.stringify(nine.bytes.slice(0, -1)));
  fs.writeFileSync(`${directory}/nine-plan-prefix.json`, JSON.stringify(nine.bytes.slice(0, poisonPrefix)));
  fs.writeFileSync(`${directory}/nine-evidence.json`, JSON.stringify(nine.host.current().evidence));
  for (const name of ['ten-full.json', 'nine-control.json', 'nine-probe-prefix.json',
    'nine-plan-prefix.json', 'nine-evidence.json']) {
    const descriptor = fs.openSync(`${directory}/${name}`, 'r');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
  }
  if (cut.startsWith('boundary-')) installBoundaryCut(cut.slice('boundary-'.length));
  evidence.admit(poison);
  evidence.admit(compatible);
  fs.writeFileSync(`${directory}/before-cut.json`, JSON.stringify(evidence.resume(handle, 22)));
  for (const name of ['ten-full.json', 'nine-control.json', 'nine-probe-prefix.json',
    'nine-plan-prefix.json', 'nine-evidence.json', 'before-cut.json']) {
    const descriptor = fs.openSync(`${directory}/${name}`, 'r');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
  }
  const descriptor = fs.openSync(directory, 'r');
  fs.fsyncSync(descriptor);
  fs.closeSync(descriptor);
  if (cut === 'killed') process.kill(process.pid, 'SIGKILL');
  process.stdout.write(JSON.stringify({ state: 'seeded' }));
} else {
  const after = evidence.resume(handle, 24);
  process.stdout.write(JSON.stringify({
    ownerReadKind: nine.runtime.inspectCurrent().kind,
    after,
    reconnect: sameMachineReconnectCandidate({
      launch: handle.launch,
      machine: handle.machine,
      incarnation: handle.incarnation,
      fence,
      now: 24,
      evidence,
      authority: six.api,
    }, handles),
  }));
}
