import fs from 'node:fs';
import { canonical, decode } from '../../src/index.js';
import {
  createHarnessEvidenceHolder,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { harnessFixture } from './fixture.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

const [mode, cut, directory, loss] = process.argv.slice(2);
if (!mode || !cut || !directory || !loss) throw new Error('mode, cut, directory, and history loss are required');

const fileState = createHarnessAdapterFileState(`${directory}/events`) as HarnessEvidenceStateStorePort;
const dump = (name: string, value_: unknown) =>
  fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value_));
const read = (name: string): unknown => JSON.parse(fs.readFileSync(`${directory}/${name}.json`, 'utf8'));

if (mode === 'seed') {
  let blockedLocalAppend = false;
  const pendingState: HarnessEvidenceStateStorePort = Object.freeze({
    ...fileState,
    save(expected: Parameters<HarnessEvidenceStateStorePort['save']>[0],
      snapshot: Parameters<HarnessEvidenceStateStorePort['save']>[1]) {
      if (snapshot.events.some(event => event.diagnosticCode.startsWith('transcript-poison:'))) {
        blockedLocalAppend = true;
        throw new Error('injected EIO before local poison event commit');
      }
      fileState.save(expected, snapshot);
    },
  });
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false, eventState: pendingState });
  if (!blockedLocalAppend) throw new Error('local append boundary not reached');

  const nine = fixture.freshNine(fixture.fullNine);
  const plan = value(nine.runtime.inspectCurrent())
    .find(row => row.record.id === 'r9:plan:transcript-poison');
  if (!plan || plan.record.type !== 'VerificationPlan') throw new Error('poison plan missing');
  const probe = value(decodeProbeRecord({
    ...verificationInput('ProbeRecord'),
    id: 'r11:process:late-probe',
    predecessors: [plan.fact.id],
    plan: plan.record.id,
    planVersion: plan.record.bar.version,
    arm: 'transcript-poison',
    subject: plan.record.subject.governed,
  }, nine.c));
  const witness = nine.witnessFor(probe, 'r11:process:late-evidence');
  nine.setEvidence([...nine.host.current().evidence, witness]);
  value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  const evidence = fixture.holder(fileState, nine);

  const handleState = createHarnessAdapterFileState(`${directory}/handles`);
  const handles = createRuntimeHandleHolder({
    adapter: fixture.handle.harness,
    machine: fixture.handle.machine,
    maxHandles: 4,
    maxAttempts: 8,
    context: fixture.ten.owner.c,
    state: handleState,
    admission: fixture.ten.port,
  });
  if (handles.put(fixture.handle).disposition !== 'stored') throw new Error('seed handle failed');

  dump('ten', fixture.ten.owner.raw);
  dump('handle', fixture.handle);
  dump('nine-full', nine.bytes);
  dump('nine-probe', fixture.fullNine);
  dump('nine-plan', fixture.planPrefix);
  dump('evidence', nine.host.current().evidence);
  dump('before', {
    resume: evidence.resume(fixture.handle, 22),
    floorCount: fileState.loadValidationFloors().length,
    candidateCount: fileState.loadPoisonCandidates().length,
    blockedLocalAppend,
  });
  const six = transportFixture(`${directory}/six`);
  value(six.api.acquire('r11:process:acquire', '', 500));

  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const descriptor = fs.openSync(`${directory}/${name}`, 'r');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
  }
  const descriptor = fs.openSync(directory, 'r');
  fs.fsyncSync(descriptor);
  fs.closeSync(descriptor);
  if (cut === 'kill') process.kill(process.pid, 'SIGKILL');
  process.stdout.write(JSON.stringify(read('before')));
} else {
  const ten = harnessFixture();
  ten.owner.time(24);
  ten.owner.raw.splice(0, ten.owner.raw.length, ...(read('ten') as unknown[]));
  const handle = read('handle') as import('../../src/harness-adapters/contracts.js').HarnessRuntimeHandle;
  const nine = verificationRuntimeFixture();
  nine.time(24);
  nine.setGeneration('generation:fixture');
  nine.bytes.push(...(read(`nine-${loss}`) as unknown[]));
  nine.setEvidence((read('evidence') as unknown[])
    .map(row => value(decode('Evidence', row, nine.host.current().decode))));
  const handles = createRuntimeHandleHolder({
    adapter: handle.harness,
    machine: handle.machine,
    maxHandles: 4,
    maxAttempts: 8,
    context: ten.owner.c,
    state: createHarnessAdapterFileState(`${directory}/handles`),
    admission: ten.port,
  });
  const evidence = createHarnessEvidenceHolder({
    adapter: handle.harness,
    artifact: handle.artifactDigest,
    platform: handle.platform,
    machine: handle.machine,
    scope: 'conversation:1',
    maxEvents: 32,
    maxCaptureBytes: 1024,
    context: ten.owner.c,
    state: fileState,
    admission: ten.port,
    owners: { handles, current: ten.owner.host, verification: nine.runtime },
  });
  const six = transportFixture(`${directory}/six`);
  const fence = value(six.api.acquire('r11:process:acquire', '', 500));
  const subject = value(canonical([handle.harness, handle.artifactDigest, handle.platform, handle.machine,
    handle.launch, handle.run, handle.step, handle.input, handle.incarnation, handle.processIdentity])).bytes;
  process.stdout.write(JSON.stringify({
    ownerRead: nine.runtime.inspectCurrent().kind,
    subject,
    before: read('before'),
    resume: evidence.resume(handle, 24),
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
