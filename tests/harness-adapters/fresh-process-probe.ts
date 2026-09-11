import * as publicApi from '../../src/harness-adapters/index.js';
import { decodeHarnessRuntimeEvent } from '../../src/harness-adapters/index.js';
import { value } from '../facts/fixtures.js';
import { attemptInput, eventInput, harnessFixture, witnessedEvent } from './fixture.js';

const matching = harnessFixture();
const obsolete = harnessFixture();
const first = matching.port.beginAttempt(attemptInput(), [], 2);
const original = value(decodeHarnessRuntimeEvent(eventInput('output-chunk'), matching.owner.c));
const repeated = value(decodeHarnessRuntimeEvent(eventInput('output-chunk', {
  id: 'event:republished', output: { ...original.output!, captureReference: 'capture:other' },
}), matching.owner.c));
const outputOwner = harnessFixture();

process.stdout.write(JSON.stringify({
  matchingGeneration: matching.port.admitObservation(witnessedEvent(matching), [], 4).disposition,
  obsoleteGeneration: obsolete.port.admitObservation(
    witnessedEvent(obsolete, 'heartbeat', {}, 'generation:obsolete'), [], 4).disposition,
  malformedAttempt: matching.port.beginAttempt({ ...attemptInput(), kind: 'wrong' }, [], 2).disposition,
  contradictoryOperation: matching.port.beginAttempt({ ...attemptInput(), kind: 'delivery' }, [first.attempt!], 2).disposition,
  emptyFinish: matching.port.finishAttempt('operation:launch', '', 20, [first.attempt!]).disposition,
  repeatedOutput: matching.port.admitObservation(repeated, [original], 1).disposition,
  outputCustody: outputOwner.port.admitObservation(witnessedEvent(outputOwner, 'output-chunk'), [], 4),
  removed: ['createRuntimeHandleHolder', 'restoreRuntimeHandleHolder', 'createHarnessEvidenceHolder',
    'sameMachineReconnectCandidate', 'createMemoryHarnessAdapterStateStore', 'correlatedRecoveryProgress',
    'preventiveCompactionDisposition'].filter(name => name in publicApi),
}));

