import fs from 'node:fs';
import { decode } from '../../src/index.js';
import {
  decodeHarnessRuntimeHandle,
  decodeHarnessValidationFloor,
} from '../../src/harness-adapters/index.js';
import type { HarnessAdapterStateSnapshot } from '../../src/harness-adapters/contracts.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { harnessFixture } from './fixture.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

const [mode, cut, directory, field, history = 'prefix'] = process.argv.slice(2);
if (!mode || !cut || !directory || !field) {
  throw new Error('mode, cut, directory, field, and optional history are required');
}

const dump = (name: string, data: unknown) =>
  fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(data));
const read = (name: string): unknown => JSON.parse(fs.readFileSync(`${directory}/${name}.json`, 'utf8'));

if (mode === 'seed') {
  const retained = createMemoryHarnessAdapterStateStore(`r12:natural-eio:${field}`);
  let blockedLocalAppend = false;
  const failLocalPoisonAppend: HarnessEvidenceStateStorePort = Object.freeze({
    ...retained,
    save(expected: Parameters<HarnessEvidenceStateStorePort['save']>[0],
      snapshot: Parameters<HarnessEvidenceStateStorePort['save']>[1]) {
      if (snapshot.events.some(event => event.diagnosticCode.startsWith('transcript-poison:'))) {
        blockedLocalAppend = true;
        throw new Error('injected EIO before local poison event append');
      }
      retained.save(expected, snapshot);
    },
  });
  const fixture = round9PoisonPrefixFixture({ eventState: failLocalPoisonAppend });
  if (!blockedLocalAppend) throw new Error('local poison-event append was not attempted');
  const original = retained.loadValidationFloors()[0] as Record<string, unknown>;
  if (!original) throw new Error('validation floor was not retained before local append');
  const floor = field === 'control'
    ? value(decodeHarnessValidationFloor(original))
    : value(decodeHarnessValidationFloor({
        ...original,
        [field]: field === 'artifact'
          ? `sha256:${'1'.repeat(64)}`
          : `foreign:${String(original[field])}`,
      }));

  const eventState = createHarnessAdapterFileState(`${directory}/events`) as HarnessEvidenceStateStorePort;
  eventState.save(null, retained.load() as HarnessAdapterStateSnapshot);
  for (const candidate of retained.loadPoisonCandidates()) eventState.appendPoisonCandidate(candidate as never);
  eventState.appendValidationFloor(floor);

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
  if (handles.put(fixture.handle).disposition !== 'stored') throw new Error('runtime handle was not retained');

  dump('handle', fixture.handle);
  dump('ten-full', fixture.fullTen);
  dump('ten-prefix', fixture.tenPrefix);
  dump('nine-full', fixture.fullNine);
  dump('nine-prefix', fixture.planPrefix);
  dump('nine-evidence', fixture.nineEvidence);
  const six = transportFixture(`${directory}/six`);
  value(six.api.acquire('r12:restart:fence', '', 500));

  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const descriptor = fs.openSync(`${directory}/${name}`, 'r');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
  }
  const descriptor = fs.openSync(directory, 'r');
  fs.fsyncSync(descriptor);
  fs.closeSync(descriptor);
  if (cut === 'kill') process.kill(process.pid, 'SIGKILL');
  process.stdout.write(JSON.stringify({
    blockedLocalAppend,
    localPoison: (eventState.load() as HarnessAdapterStateSnapshot)
      .events.some(event => event.id === fixture.poison.id),
    floorCount: eventState.loadValidationFloors().length,
    candidateCount: eventState.loadPoisonCandidates().length,
  }));
} else if (mode === 'recover') {
  const ten = harnessFixture();
  ten.owner.time(24);
  ten.owner.raw.splice(0, ten.owner.raw.length, ...(read(`ten-${history}`) as unknown[]));
  const handle = value(decodeHarnessRuntimeHandle(read('handle'), ten.owner.c));
  const nine = verificationRuntimeFixture();
  nine.time(24);
  nine.setGeneration('generation:fixture');
  nine.bytes.push(...(read(`nine-${history}`) as unknown[]));
  nine.setEvidence((read('nine-evidence') as unknown[])
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
  const eventState = createHarnessAdapterFileState(`${directory}/events`) as HarnessEvidenceStateStorePort;
  const evidence = createHarnessEvidenceHolder({
    adapter: handle.harness,
    artifact: handle.artifactDigest,
    platform: handle.platform,
    machine: handle.machine,
    scope: 'conversation:1',
    maxEvents: 32,
    maxCaptureBytes: 1024,
    context: ten.owner.c,
    state: eventState,
    admission: ten.port,
    owners: { handles, current: ten.owner.host, verification: nine.runtime },
  });
  const six = transportFixture(`${directory}/six`);
  const fence = value(six.api.acquire('r12:restart:fence', '', 500));
  process.stdout.write(JSON.stringify({
    nineRead: nine.runtime.inspectCurrent().kind,
    tenRead: ten.owner.c.history!.current().kind,
    localPoison: (eventState.load() as HarnessAdapterStateSnapshot)
      .events.some(event => event.id === 'r9:event:transcript-poison'),
    floorCount: eventState.loadValidationFloors().length,
    candidateCount: eventState.loadPoisonCandidates().length,
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
} else {
  throw new Error(`unsupported mode: ${mode}`);
}
