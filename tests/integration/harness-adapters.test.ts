import { expect, it } from 'vitest';
import { decodeHarnessRuntimeEvent } from '../../src/harness-adapters/index.js';
import { intakeFixture, message, route, value } from '../intake/fixtures.js';
import { attemptInput, digest, eventInput, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';

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
  const original = value(decodeHarnessRuntimeEvent(eventInput('output-chunk'), f.owner.c));
  const repeated = value(decodeHarnessRuntimeEvent(eventInput('output-chunk', {
    id: 'event:republished', output: { ...original.output!, captureReference: 'capture:other' },
  }), f.owner.c));
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

it('A1-INTEGRATION R5-F9 P13-NF-24 P13-NF-46 executes the landed Part Four custody-read failure arm without an invented grant', () => {
  const f = intakeFixture(); f.bind(); const port = f.port(); value(port.receive(message(), route));
  const receipt = f.facts().find(row => row.kind === 'intake-receipt')!;
  const before = JSON.stringify(f.frames);
  Object.assign(f.storage, { read: () => { const error = new Error('EACCES'); Object.assign(error, { code: 'EACCES' }); throw error; } });
  expect(port.recover(receipt.id)).toMatchObject({ kind: 'Refused', preserved: receipt.id });
  expect(JSON.stringify(f.frames)).toBe(before);
});
