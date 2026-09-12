import { expect, it } from 'vitest';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import {
  compareHarnessAdapterRecords,
  decodeHarnessAdapterStateSnapshot,
  decodeHarnessHandleSnapshot,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
} from '../../src/harness-adapters/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { intakeFixture, message, route, value } from '../intake/fixtures.js';
import { attemptInput, digest, eventInput, handleInput, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';

it('A1-INTEGRATION R5-F4 R5-F5 R5-F6 P13-NF-05 P13-NF-15 P13-NF-25 P13-NF-29 P13-NF-39 uses real Part Ten history and keeps operation identity total', () => {
  const matching = harnessFixture();
  expect(matching.port.admitObservation(witnessedEvent(matching), [], 4).disposition).toBe('recorded');
  const obsolete = harnessFixture();
  expect(obsolete.port.admitObservation(witnessedEvent(obsolete, 'heartbeat', {}, 'generation:obsolete'), [], 4).disposition).toBe('refused');

  const first = matching.port.beginAttempt(attemptInput(), [], 2);
  expect(first.disposition).toBe('started');
  expect(matching.port.beginAttempt({ ...attemptInput(), subjectDigest: 'bad' }, [], 2).disposition).toBe('refused');
  expect(matching.port.beginAttempt(attemptInput({ kind: 'delivery' }), [first.attempt!], 2).disposition).toBe('refused');
  expect(matching.port.finishAttempt('operation:launch', '', 20, [first.attempt!]).disposition).toBe('refused');
});
it('A1-INTEGRATION R5-F7 R5-F8 P13-NF-30 P13-NF-31 P13-NF-33 P13-NF-34 deduplicates declared progress identity without inventing output custody', () => {
  const f = harnessFixture();
  const original = witnessedEvent(f, 'output-chunk', { sourceEvidence: ['observation:output-original'] });
  const repeated = witnessedEvent(f, 'output-chunk', {
    id: 'event:republished', sourceEvidence: ['observation:output-republished'],
    output: { ...original.output!, captureReference: 'capture:other' },
  });
  const changed = value(decodeHarnessRuntimeEvent(eventInput('output-chunk', {
    id: 'event:changed', output: { ...original.output!, digest: digest('changed') },
  }), f.owner.c));
  expect(f.port.admitObservation(repeated, [original], 1).disposition).toBe('duplicate');
  expect(f.port.progressIdentity(changed, [original]).disposition).toBe('conflict');
  expect(f.port.admitObservation(witnessedEvent(f, 'output-chunk', { id: 'event:witnessed' }), [], 4))
    .toMatchObject({ disposition: 'refused', reason: expect.stringContaining('NON-EXECUTABLE-UNTIL-slice-A2') });
  const exit = value(decodeHarnessRuntimeEvent(eventInput('process-exited'), f.owner.c));
  expect(exit.exitStatus).toBe(0);
  expect(f.port.progressIdentity(exit, []).disposition).toBe('non-progress');
});

it('A1-INTEGRATION R6-F1 R6-F2 R6-F3 R6-F4 R6-F6 replays all data-validation findings through real Part Ten history', () => {
  const disputed = harnessFixture();
  const event = witnessedEvent(disputed);
  const row = value(disputed.owner.c.history!.lookup(event.sourceEvidence[0]!))!;
  value(disputed.owner.spine.append(value(decodeAssemblyRecord('HarnessObservation', {
    ...row.record, detail: 'different signed claim',
  }, { ...disputed.owner.c, validateReferences: false }))));
  expect(disputed.port.admitObservation(event, [event], 2).disposition).toBe('refused');

  const f = harnessFixture();
  const workOne = eventInput('work-transition', {
    id: 'event:work-one', workSubject: 'subject:x', predecessor: 'pre', workPhase: 'phase',
  });
  const workTwo = eventInput('work-transition', {
    id: 'event:work-two', workSubject: 'subject', predecessor: 'x:pre', workPhase: 'phase',
  });
  expect(f.port.progressIdentity(workTwo, [workOne]).disposition).toBe('advancing');

  const v2 = { ...eventInput('heartbeat'), freshFor: 0 };
  const { sourceClock, observedAt: _observedAt, freshFor: _freshFor, ...rest } = v2 as any;
  const v1 = { ...rest, schemaVersion: 1, at: sourceClock };
  const state = (events: unknown[]) => ({
    type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state:migration', adapter: 'native',
    machine: 'machine-a', revision: 0, maxHandles: 1, maxAttempts: 2, maxEvents: 3,
    maxCaptureBytes: 50, handles: [handleInput()], attempts: [attemptInput()], events,
  });
  expect(decodeHarnessAdapterStateSnapshot(state([v1]), f.owner.c).kind).toBe('Success');
  expect(value(compareHarnessAdapterRecords('HarnessAdapterStateSnapshot', state([v1]), state([v2]), f.owner.c)))
    .toEqual({ equal: true });
  expect(decodeHarnessHandleSnapshot({
    type: 'HarnessHandleSnapshot', schemaVersion: 1, id: 'snapshot:clock', adapter: 'native',
    machine: 'machine-a', capturedAt: 9, maxHandles: 1, handles: [handleInput()],
  }, f.owner.c).kind).toBe('Refused');

  const launch = value(f.owner.c.history!.lookup('launch:1'))!.record as any;
  const repeatedManifest = [launch.contextManifest[0], {
    ...launch.contextManifest[0], class: 'another-class', reference: 'context:another',
  }];
  const repeatedLaunch = value(f.owner.runtime.record('HarnessLaunchSpec', {
    ...launch, id: 'launch:repeated-digest', incarnation: 'worker-incarnation:repeated',
    contextManifest: repeatedManifest,
  }));
  expect(value(f.owner.runtime.resolve(repeatedLaunch))).toMatchObject({ admitted: true });
  expect(decodeHarnessRuntimeHandle(handleInput({
    contextDigests: repeatedManifest.map((entry: { digest: string }) => entry.digest) as any,
  }), f.owner.c).kind).toBe('Success');
});

it('A1-INTEGRATION R5-F9 P13-NF-24 P13-NF-46 executes the landed Part Four custody-read failure arm without an invented grant', () => {
  const f = intakeFixture();
  const interrupted = value(createIntakePort({ ...f.deps, storage: { ...f.storage,
    append(bytes, head) {
      const receipt = f.storage.append(bytes, head);
      if ((JSON.parse(bytes) as { kind?: string }).kind === 'intake-receipt') throw new Error('cut-after-durable-receipt');
      return receipt;
    },
  } }));
  expect(interrupted.receive(message(), route).kind).toBe('Refused');
  const receipt = f.facts()[0]!;
  const before = JSON.stringify(f.frames);
  const broken = value(createIntakePort({ ...f.deps, storage: { ...f.storage,
    read() { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); },
  } }));
  expect(broken.recover(receipt.id)).toMatchObject({ kind: 'Refused', preserved: receipt.id });
  expect(JSON.stringify(f.frames)).toBe(before);
  expect(value(f.port().recover(receipt.id)).kind).toBe('admitted');
});
