import * as publicApi from '../../src/harness-adapters/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { checkP13DependencyCitations } from '../../scripts/check-p13-contract-map.mjs';
import {
  compareHarnessAdapterRecords,
  decodeHarnessAdapterStateSnapshot,
  decodeHarnessHandleSnapshot,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
} from '../../src/harness-adapters/index.js';
import { value } from '../facts/fixtures.js';
import { attemptInput, eventInput, handleInput, harnessFixture, witnessedEvent } from './fixture.js';

const matching = harnessFixture();
const obsolete = harnessFixture();
const first = matching.port.beginAttempt(attemptInput(), [], 2);
const original = witnessedEvent(matching, 'output-chunk', { sourceEvidence: ['observation:output-original'] });
const repeated = witnessedEvent(matching, 'output-chunk', {
  id: 'event:republished', sourceEvidence: ['observation:output-republished'],
  output: { ...original.output!, captureReference: 'capture:other' },
});
const outputOwner = harnessFixture();

const disputed = harnessFixture();
const disputedEvent = witnessedEvent(disputed);
const disputedRow = value(disputed.owner.c.history!.lookup(disputedEvent.sourceEvidence[0]!))!;
value(disputed.owner.spine.append(value(decodeAssemblyRecord('HarnessObservation', {
  ...disputedRow.record, detail: 'different signed claim',
}, { ...disputed.owner.c, validateReferences: false }))));
const obsoleteRetained = harnessFixture();
const obsoleteEvent = witnessedEvent(obsoleteRetained, 'heartbeat', {}, 'generation:obsolete');
const foreignFixture = harnessFixture();
const foreignEvent = value(decodeHarnessRuntimeEvent(eventInput('heartbeat', {
  harness: 'foreign', machine: 'machine-b',
}), foreignFixture.owner.c));
const unwitnessedFixture = harnessFixture();
const unwitnessed = value(decodeHarnessRuntimeEvent(eventInput('output-chunk'), unwitnessedFixture.owner.c));
const unwitnessedRepeat = { ...unwitnessed, id: 'event:unwitnessed-repeat', sourceEvidence: ['nonexistent'],
  output: { ...unwitnessed.output!, captureReference: 'nonexistent' } };
const workOne = eventInput('work-transition', {
  id: 'event:work-one', workSubject: 'subject:x', predecessor: 'pre', workPhase: 'phase',
});
const workTwo = eventInput('work-transition', {
  id: 'event:work-two', workSubject: 'subject', predecessor: 'x:pre', workPhase: 'phase',
});
const v2 = { ...eventInput('heartbeat'), freshFor: 0 };
const { sourceClock, observedAt: _observedAt, freshFor: _freshFor, ...rest } = v2 as any;
const v1 = { ...rest, schemaVersion: 1, at: sourceClock };
const state = (events: unknown[]) => ({
  type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state:migration', adapter: 'native',
  machine: 'machine-a', revision: 0, maxHandles: 1, maxAttempts: 2, maxEvents: 3,
  maxCaptureBytes: 50, handles: [handleInput()], attempts: [attemptInput()], events,
});
const repeatedFixture = harnessFixture();
const launch = value(repeatedFixture.owner.c.history!.lookup('launch:1'))!.record as any;
const repeatedManifest = [launch.contextManifest[0], {
  ...launch.contextManifest[0], class: 'another-class', reference: 'context:another',
}];
const repeatedLaunch = value(repeatedFixture.owner.runtime.record('HarnessLaunchSpec', {
  ...launch, id: 'launch:repeated-digest', incarnation: 'worker-incarnation:repeated',
  contextManifest: repeatedManifest,
}));
const firstHandle = handleInput();
const conflictingHandle = handleInput({
  launch: 'launch:second', run: 'run:second', step: 'step:second', input: 'intake:second',
  incarnation: 'incarnation:second', processIdentity: 'pid:second',
  launchOperation: 'operation:second', launchClaim: 'claim:second',
});
const distinctHandle = { ...conflictingHandle, id: 'handle:second' };
const handleSnapshot = (handles: unknown[]) => ({
  type: 'HarnessHandleSnapshot', schemaVersion: 1, id: 'snapshot', adapter: 'native',
  machine: 'machine-a', capturedAt: 20, maxHandles: 2, handles,
});
const adapterStateSnapshot = (handles: unknown[]) => ({
  type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state', adapter: 'native',
  machine: 'machine-a', revision: 0, maxHandles: 2, maxAttempts: 0, maxEvents: 0,
  maxCaptureBytes: 0, handles, attempts: [], events: [],
});

process.stdout.write(JSON.stringify({
  matchingGeneration: matching.port.admitObservation(witnessedEvent(matching), [], 4).disposition,
  obsoleteGeneration: obsolete.port.admitObservation(
    witnessedEvent(obsolete, 'heartbeat', {}, 'generation:obsolete'), [], 4).disposition,
  malformedAttempt: matching.port.beginAttempt({ ...attemptInput(), kind: 'wrong' }, [], 2).disposition,
  contradictoryOperation: matching.port.beginAttempt({ ...attemptInput(), kind: 'delivery' }, [first.attempt!], 2).disposition,
  emptyFinish: matching.port.finishAttempt('operation:launch', '', 20, [first.attempt!]).disposition,
  repeatedOutput: matching.port.admitObservation(repeated, [original], 1).disposition,
  outputCustody: outputOwner.port.admitObservation(witnessedEvent(outputOwner, 'output-chunk'), [], 4),
  disputedDuplicate: disputed.port.admitObservation(disputedEvent, [disputedEvent], 2).disposition,
  obsoleteDuplicate: obsoleteRetained.port.admitObservation(obsoleteEvent, [obsoleteEvent], 2).disposition,
  foreignDuplicate: foreignFixture.port.admitObservation(foreignEvent, [foreignEvent], 2).disposition,
  unwitnessedOutputDuplicate: unwitnessedFixture.port.admitObservation(unwitnessedRepeat, [unwitnessed], 1).disposition,
  distinctWorkIdentity: matching.port.progressIdentity(workTwo, [workOne]).disposition,
  nestedMigration: compareHarnessAdapterRecords('HarnessAdapterStateSnapshot', state([v1]), state([v2]), matching.owner.c).kind,
  snapshotClockControl: decodeHarnessHandleSnapshot({
    type: 'HarnessHandleSnapshot', schemaVersion: 1, id: 'snapshot:clock', adapter: 'native',
    machine: 'machine-a', capturedAt: 10, maxHandles: 1, handles: [handleInput()],
  }, matching.owner.c).kind,
  snapshotClockRefusal: decodeHarnessHandleSnapshot({
    type: 'HarnessHandleSnapshot', schemaVersion: 1, id: 'snapshot:clock', adapter: 'native',
    machine: 'machine-a', capturedAt: 9, maxHandles: 1, handles: [handleInput()],
  }, matching.owner.c).kind,
  nestedV1: decodeHarnessAdapterStateSnapshot(state([v1]), matching.owner.c).kind,
  repeatedOwnerLaunch: value(repeatedFixture.owner.runtime.resolve(repeatedLaunch)).admitted,
  repeatedHandleDigests: decodeHarnessRuntimeHandle(handleInput({
    contextDigests: repeatedManifest.map((entry: { digest: string }) => entry.digest) as any,
  }), repeatedFixture.owner.c).kind,
  conflictingHandleSnapshot: decodeHarnessHandleSnapshot(
    handleSnapshot([firstHandle, conflictingHandle]), matching.owner.c).kind,
  conflictingStateSnapshot: decodeHarnessAdapterStateSnapshot(
    adapterStateSnapshot([firstHandle, conflictingHandle]), matching.owner.c).kind,
  distinctHandleSnapshot: decodeHarnessHandleSnapshot(
    handleSnapshot([firstHandle, distinctHandle]), matching.owner.c).kind,
  distinctStateSnapshot: decodeHarnessAdapterStateSnapshot(
    adapterStateSnapshot([firstHandle, distinctHandle]), matching.owner.c).kind,
  contractMapRequiredPairs: checkP13DependencyCitations().requiredPairs,
  removed: ['createRuntimeHandleHolder', 'restoreRuntimeHandleHolder', 'createHarnessEvidenceHolder',
    'sameMachineReconnectCandidate', 'createMemoryHarnessAdapterStateStore', 'correlatedRecoveryProgress',
    'preventiveCompactionDisposition'].filter(name => name in publicApi),
}));
