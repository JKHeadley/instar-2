import { expect, it } from 'vitest';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
} from '../../src/harness-adapters/holder.js';
import { correlatedRecoveryProgress, preventiveCompactionDisposition }
  from '../../src/harness-adapters/regression-boundaries.js';
import type {
  HarnessAdapterStateStorePort,
  HarnessEvidenceStateStorePort,
} from '../../src/harness-adapters/holder.js';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { a2Fixture } from './a2-fixture.js';
import { attemptInput, witnessedEvent } from './fixture.js';

it('A2-UNIT P13-NF-28 P13-NF-39 durable holders reread current custody and keep attempts total', () => {
  const f = a2Fixture();
  const { state: _state, evidence: _evidence, observedAt: _observedAt, ...attempt } = attemptInput() as import('../../src/harness-adapters/contracts.js').HarnessOperationAttempt;
  expect(f.handles.beginAttempt(attempt)).toMatchObject({ disposition: 'started' });
  expect(f.handles.beginAttempt({ ...attempt, subjectDigest: f.handle.artifactDigest }))
    .toMatchObject({ disposition: 'refused' });
  expect(f.handles.finishAttempt('operation:missing', 'evidence:missing', 12))
    .toMatchObject({ disposition: 'refused' });

  const second = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 4,
    maxAttempts: 8, context: f.owner.c, state: f.handleState, admission: f.port });
  expect(second.lookup(f.handle.launch)).toMatchObject({ state: 'found', handle: f.handle });
  expect(second.finishAttempt('operation:launch', 'process:observed', 12)).toMatchObject({ disposition: 'observed' });
  expect(f.handles.beginAttempt(attempt)).toMatchObject({ disposition: 'existing', attempt: { state: 'observed' } });
});

it('A2-UNIT REVIEW-F1 REVIEW-F2 P13-NF-24 P13-NF-32 later pending input defeats an older closure across concurrent holder views', () => {
  const f = a2Fixture();
  const first = witnessedEvent(f, 'turn-closed', { id: 'closure:old', streamState: 'closed',
    childrenState: 'closed', sourceClock: 20, observedAt: 20 });
  expect(f.evidence.admit(first).disposition).toBe('recorded');
  f.owner.time(25);
  expect(f.evidence.completion(f.handle, 25).state).toBe('complete');

  const peer = createHarnessEvidenceHolder({ adapter: 'native', artifact: f.handle.artifactDigest,
    platform: f.handle.platform, machine: f.handle.machine, scope: 'conversation:1', maxEvents: 32, maxCaptureBytes: 1024,
    context: f.owner.c, state: f.evidenceState, admission: f.port,
    owners: { handles: f.handles, current: f.owner.host } });
  const pending = witnessedEvent(f, 'input-accepted', { id: 'input:new', sourceClock: 30,
    observedAt: 30, streamState: 'open' });
  expect(peer.admit(pending).disposition).toBe('recorded');
  f.owner.time(30);
  expect(f.evidence.completion(f.handle, 30)).toMatchObject({ state: 'pending' });
});

it('A2-UNIT REVIEW-F1 P13-NF-32 a disputed later pending input cannot restore completion', () => {
  const f = a2Fixture();
  const closure = witnessedEvent(f, 'turn-closed', { id: 'closure:old', streamState: 'closed',
    childrenState: 'closed', sourceClock: 20, observedAt: 20 });
  const pending = witnessedEvent(f, 'input-accepted', { id: 'input:disputed', sourceClock: 30, observedAt: 30 });
  f.evidence.admit(closure);
  f.evidence.admit(pending);
  const source = value(f.owner.c.history!.lookup(pending.sourceEvidence[0]!))!.record!;
  if (source.type !== 'HarnessObservation') throw new Error('expected harness observation');
  const conflict = value(decodeAssemblyRecord(source.type, { ...source, detail: `${source.detail}:conflict` },
    { ...f.owner.c, validateReferences: false }));
  value(f.owner.spine.append(conflict));
  f.owner.time(30);
  expect(f.evidence.completion(f.handle, 30)).toMatchObject({ state: 'pending', event: 'input:disputed' });
});

it('A2-UNIT R3-F01 P13-NF-24 P13-NF-32 P13-NF-34 disputed exact-subject pending fields never restore an older closure', () => {
  for (const kind of ['input-accepted', 'context-consumed', 'heartbeat', 'diagnostic', 'probe-failed'] as const) {
    const f = a2Fixture();
    f.evidence.admit(witnessedEvent(f, 'turn-closed', { id: `r3:closure:${kind}`,
      sourceClock: 10, observedAt: 10, streamState: 'closed', childrenState: 'closed' }));
    const pending = witnessedEvent(f, kind, { id: `r3:pending:${kind}`,
      sourceClock: 20, observedAt: 20, streamState: 'open', childrenState: 'pending',
      unresolvedOperations: ['operation:still-unsettled'] });
    expect(f.evidence.admit(pending).disposition).toBe('recorded');
    f.owner.time(20);
    expect(f.evidence.completion(f.handle, 20), `${kind}:current`).toMatchObject({ state: 'pending' });
    const source = value(f.owner.c.history!.lookup(pending.sourceEvidence[0]!))!.record!;
    if (source.type !== 'HarnessObservation') throw new Error('expected harness observation');
    value(f.owner.spine.append(value(decodeAssemblyRecord(source.type,
      { ...source, detail: `${source.detail}:disputed` }, { ...f.owner.c, validateReferences: false }))));
    expect(f.evidence.completion(f.handle, 20), `${kind}:disputed`).toMatchObject({ state: 'pending' });
  }
});

it('A2-UNIT R3-F04 P13-NF-01 P13-NF-15 P13-NF-39 malformed replay clocks refuse before retained attempt time is restored', () => {
  for (const attemptedAt of [-1, Number.NaN, Number.POSITIVE_INFINITY, 'yesterday', null, undefined]) {
    const f = a2Fixture();
    const { state: _state, evidence: _evidence, observedAt: _observedAt, ...attempt } =
      attemptInput() as import('../../src/harness-adapters/contracts.js').HarnessOperationAttempt;
    expect(f.handles.beginAttempt(attempt as never)).toMatchObject({ disposition: 'started' });
    expect(f.handles.beginAttempt({ ...attempt, attemptedAt } as never), String(attemptedAt))
      .toMatchObject({ disposition: 'refused', attempt: null });
  }
});

it('A2-UNIT REVIEW-F3 P13-NF-29 P13-NF-33 newest probe failure is unknown and exit is evidence, never a Run mutation', () => {
  const f = a2Fixture();
  f.evidence.admit(witnessedEvent(f, 'heartbeat', { id: 'heartbeat:old', sourceClock: 20, observedAt: 20 }));
  f.evidence.admit(witnessedEvent(f, 'probe-failed', { id: 'probe:new', sourceClock: 30, observedAt: 30 }));
  f.owner.time(30);
  expect(f.evidence.liveness(f.handle, 30)).toMatchObject({ state: 'unknown', event: 'probe:new' });
  f.evidence.admit(witnessedEvent(f, 'process-exited', { id: 'exit:current', sourceClock: 40, observedAt: 40 }));
  f.owner.time(40);
  expect(f.evidence.liveness(f.handle, 40)).toMatchObject({ state: 'dead', event: 'exit:current' });
});

it('A2-UNIT REVIEW-F8 P13-NF-31 P13-NF-34 output stays held on the named Part Two read seam and compaction exposes no action', () => {
  const f = a2Fixture();
  expect(f.evidence.admit(witnessedEvent(f, 'output-chunk')).reason)
    .toBe('NON-EXECUTABLE-UNTIL-design-17-harness-adapters-seam-request-part-two-capture-read.md');
  expect(preventiveCompactionDisposition({ panePercentage: 95, work: 'idle', elapsed: 100,
    spaced: true, dryRun: false })).toMatchObject({ capability: 'unsupported', action: 'none' });
  expect(correlatedRecoveryProgress(f.handle.processIdentity,
    [{ worker: f.handle.processIdentity, before: 1, after: 2 }])).toMatchObject({ state: 'pending' });
});

it('A2-UNIT P13-NF-24 P13-NF-28 journal read errors remain typed unknown and never become absence', () => {
  const f = a2Fixture();
  let fail = false;
  const broken: HarnessEvidenceStateStorePort = Object.freeze({
    owner: 'part-thirteen', id: 'a2:broken',
    load: () => { if (fail) throw new Error('EIO current journal'); return f.evidenceState.load(); },
    save: (expected: Parameters<HarnessAdapterStateStorePort['save']>[0],
      snapshot: Parameters<HarnessAdapterStateStorePort['save']>[1]) => f.evidenceState.save(expected, snapshot),
    loadValidationFloors: () => f.evidenceState.loadValidationFloors(),
    appendValidationFloor: (floor: Parameters<HarnessEvidenceStateStorePort['appendValidationFloor']>[0]) =>
      f.evidenceState.appendValidationFloor(floor),
  });
  const holder = createHarnessEvidenceHolder({ adapter: 'native', artifact: f.handle.artifactDigest,
    platform: f.handle.platform, machine: f.handle.machine, scope: 'conversation:1', maxEvents: 32, maxCaptureBytes: 1024,
    context: f.owner.c, state: broken, admission: f.port,
    owners: { handles: f.handles, current: f.owner.host } });
  fail = true;
  expect(holder.events(f.handle.launch)).toMatchObject({ state: 'unknown', events: [] });
  f.owner.time(20);
  expect(holder.liveness(f.handle, 20)).toMatchObject({ state: 'unknown' });
});

it('A2-UNIT R3-F05 P13-NF-24 P13-NF-32 owner evidence refused by local event capacity still defeats an older closure', () => {
  const f = a2Fixture();
  const holder = createHarnessEvidenceHolder({ adapter: 'native', artifact: f.handle.artifactDigest,
    platform: f.handle.platform, machine: f.handle.machine, scope: 'conversation:1', maxEvents: 1,
    maxCaptureBytes: 1024, context: f.owner.c, state: createMemoryHarnessAdapterStateStore('r3:capacity'),
    admission: f.port, owners: { handles: f.handles, current: f.owner.host } });
  expect(holder.admit(witnessedEvent(f, 'turn-closed', { id: 'r3:capacity:closure', sourceClock: 10,
    observedAt: 10, streamState: 'closed', childrenState: 'closed' }))).toMatchObject({ disposition: 'recorded' });
  expect(holder.admit(witnessedEvent(f, 'input-accepted', { id: 'r3:capacity:pending', sourceClock: 20,
    observedAt: 20, childrenState: 'pending', unresolvedOperations: ['operation:pending'] })))
    .toMatchObject({ disposition: 'refused', reason: expect.stringContaining('capacity') });
  f.owner.time(20);
  expect(holder.completion(f.handle, 20)).toMatchObject({ state: 'pending', event: 'observation:input-accepted' });
});

it('A2-UNIT R4-F01 R4-F02 P13-NF-24 P13-NF-29 P13-NF-32 P13-NF-33 every omitted owner phase constrains liveness and completion', () => {
  for (const kind of ['probe-failed', 'process-exited', 'heartbeat', 'diagnostic', 'input-accepted'] as const) {
    for (const custody of ['omitted', 'capacity'] as const) {
      const f = a2Fixture();
      const holder = createHarnessEvidenceHolder({ adapter: 'native', artifact: f.handle.artifactDigest,
        platform: f.handle.platform, machine: f.handle.machine, scope: 'conversation:1', maxEvents: 2,
        maxCaptureBytes: 1024, context: f.owner.c,
        state: createMemoryHarnessAdapterStateStore(`r4:${kind}:${custody}`), admission: f.port,
        owners: { handles: f.handles, current: f.owner.host } });
      holder.admit(witnessedEvent(f, 'heartbeat', { id: `r4:prior-live:${kind}:${custody}`,
        sourceEvidence: [`owner:r4:prior-live:${kind}:${custody}`], sourceClock: 10, observedAt: 10,
        streamState: 'closed', childrenState: 'closed' }));
      holder.admit(witnessedEvent(f, 'turn-closed', { id: `r4:prior-close:${kind}:${custody}`,
        sourceEvidence: [`owner:r4:prior-close:${kind}:${custody}`], sourceClock: 11, observedAt: 11,
        streamState: 'closed', childrenState: 'closed' }));
      const later = witnessedEvent(f, kind, { id: `r4:later:${kind}:${custody}`,
        sourceEvidence: [`owner:r4:later:${kind}:${custody}`], sourceClock: 20, observedAt: 20,
        streamState: 'open', childrenState: 'pending', unresolvedOperations: ['operation:r4:pending'] });
      if (custody === 'capacity') expect(holder.admit(later)).toMatchObject({ disposition: 'refused' });
      f.owner.time(21);
      expect(holder.completion(f.handle, 21), `${kind}:${custody}:completion`)
        .toMatchObject({ state: 'pending', event: later.sourceEvidence[0] });
      if (kind === 'probe-failed') expect(holder.liveness(f.handle, 21), `${kind}:${custody}:liveness`)
        .toMatchObject({ state: 'unknown', event: later.sourceEvidence[0] });
      if (kind === 'process-exited') expect(holder.liveness(f.handle, 21), `${kind}:${custody}:liveness`)
        .toMatchObject({ state: 'dead', event: later.sourceEvidence[0] });
    }
  }
}, 15_000);

it('A2-UNIT R2-F01 P13-NF-29 P13-NF-32 unordered and delayed evidence never earns liveness or completion', () => {
  for (const failureId of ['aaa-failure', 'zzz-failure']) {
    const f = a2Fixture();
    f.evidence.admit(witnessedEvent(f, 'heartbeat', { id: 'mid-heartbeat', sourceClock: 20, observedAt: 20 }));
    f.evidence.admit(witnessedEvent(f, 'probe-failed', { id: failureId, sourceClock: 20, observedAt: 20 }));
    f.owner.time(21);
    expect(f.evidence.liveness(f.handle, 21), failureId).toMatchObject({ state: 'unknown' });
  }

  for (const inputId of ['aaa-input', 'zzz-input']) {
    const f = a2Fixture();
    f.evidence.admit(witnessedEvent(f, 'turn-closed', { id: 'mid-closure', sourceClock: 20,
      observedAt: 20, streamState: 'closed', childrenState: 'closed' }));
    f.evidence.admit(witnessedEvent(f, 'input-accepted', { id: inputId, sourceClock: 20,
      observedAt: 20, streamState: 'open', unresolvedOperations: ['operation:unsettled'] }));
    f.owner.time(21);
    expect(f.evidence.completion(f.handle, 21), inputId).toMatchObject({ state: 'pending' });
  }

  const delayed = a2Fixture();
  delayed.evidence.admit(witnessedEvent(delayed, 'probe-failed', {
    id: 'newer-source-failure', sourceClock: 20, observedAt: 20,
  }));
  delayed.evidence.admit(witnessedEvent(delayed, 'heartbeat', {
    id: 'delayed-old-heartbeat', sourceClock: 10, observedAt: 30,
  }));
  delayed.owner.time(31);
  expect(delayed.evidence.liveness(delayed.handle, 31)).toMatchObject({ state: 'unknown' });
});

it('A2-UNIT R2-F03 R2-F04 P13-NF-05 P13-NF-29 rejects foreign holder tuples and stale caller clocks', () => {
  const f = a2Fixture();
  const foreign = createHarnessEvidenceHolder({ adapter: 'native', artifact: f.handle.artifactDigest,
    platform: 'linux-x64', machine: f.handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:foreign-tuple'), admission: f.port,
    owners: { handles: f.handles, current: f.owner.host } });
  expect(foreign.admit(witnessedEvent(f, 'heartbeat', { id: 'foreign-tuple' })))
    .toMatchObject({ disposition: 'refused' });
  f.owner.time(20);
  expect(foreign.liveness(f.handle, 20)).toMatchObject({ state: 'unknown' });

  f.evidence.admit(witnessedEvent(f, 'heartbeat', { id: 'fresh-at-twenty', sourceClock: 20, freshFor: 100 }));
  f.owner.time(200);
  expect(f.evidence.liveness(f.handle, 21)).toMatchObject({ state: 'unknown' });
  expect(f.evidence.liveness(f.handle, 200)).toMatchObject({ state: 'unknown' });
});
