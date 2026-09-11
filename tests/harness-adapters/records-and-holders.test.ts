import { expect, it } from 'vitest';
import {
  compareHarnessAdapterRecords,
  createHarnessEvidenceHolder,
  createRuntimeHandleHolder,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
  harnessAdapterIdentity,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/index.js';
import { transportFixture } from '../transport/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { decodedEvent, decodedHandle, digest, eventInput, handleInput } from './fixture.js';

it('P13-NF-01 records are closed, total, migrated before comparison, canonical, and immutable', () => {
  const f = assemblyRuntimeFixture();
  const handle = value(decodeHarnessRuntimeHandle(handleInput(), f.c));
  expect(Object.isFrozen(handle)).toBe(true);
  expect(harnessAdapterIdentity(handle).canonicalHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  refused(decodeHarnessRuntimeHandle({ ...handleInput(), surprise: true }, f.c), 'closed fields');
  refused(decodeHarnessRuntimeHandle({ ...handleInput(), acquiredAt: Infinity }, f.c), 'finite JSON data');
  refused(decodeHarnessRuntimeHandle(Object.create({ ...handleInput() }), f.c));

  const current = eventInput('heartbeat');
  const { sourceClock: _sourceClock, observedAt: _observedAt, freshFor: _freshFor, ...prior } = current;
  const v1 = { ...prior, schemaVersion: 1, at: 10 };
  const migrated = value(decodeHarnessRuntimeEvent(v1, f.c));
  expect(migrated).toMatchObject({ schemaVersion: 2, sourceClock: 10, observedAt: 10, freshFor: 0 });
  expect(value(compareHarnessAdapterRecords('HarnessRuntimeEvent', v1, migrated, f.c)).equal).toBe(true);
  expect(value(compareHarnessAdapterRecords('HarnessRuntimeEvent', migrated, { ...migrated, diagnosticCode: 'changed' }, f.c))).toMatchObject({
    equal: false, conflict: { kind: 'immutable-disagreement' },
  });
});

it('P13-NF-15 P13-NF-24 P13-NF-25 P13-NF-28 machine-local custody is bounded, conflict-safe, restartable, and grants no remote adoption', () => {
  const f = assemblyRuntimeFixture();
  const holder = createRuntimeHandleHolder({ adapter: 'adapter:claude-code', machine: 'machine-a', maxHandles: 1, context: f.c });
  const handle = decodedHandle(f);
  expect(holder.put(handle).disposition).toBe('stored');
  expect(holder.put(handle).disposition).toBe('duplicate');
  expect(holder.put(decodedHandle(f, { processIdentity: 'process:reused' })).disposition).toBe('refused');
  expect(holder.put(decodedHandle(f, { id: 'handle:2', launch: 'launch:2' })).reason).toContain('capacity');
  expect(value(holder.snapshot('snapshot:1', 20)).handles).toEqual([handle]);

  const six = transportFixture();
  const fence = value(six.api.acquire('acquire', '', 500));
  expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: 'machine-b', incarnation: handle.incarnation,
    fence, liveness: { state: 'live', reason: 'fixture', event: 'event:live' },
    resume: { state: 'eligible', reason: 'fixture', event: 'event:resume' } }, holder)).toMatchObject({
    disposition: 'unsupported', handle: null,
  });
  expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine, incarnation: handle.incarnation,
    fence, liveness: { state: 'unknown', reason: 'timeout', event: '' },
    resume: { state: 'eligible', reason: 'fixture', event: 'event:resume' } }, holder).disposition).toBe('refused');
  const exactHolder = createRuntimeHandleHolder({ adapter: 'adapter:claude-code', machine: 'machine-a', maxHandles: 1, context: f.c });
  const exact = decodedHandle(f, { incarnation: fence.incarnation });
  exactHolder.put(exact);
  expect(sameMachineReconnectCandidate({ launch: exact.launch, machine: exact.machine, incarnation: exact.incarnation,
    fence, liveness: { state: 'live', reason: 'fresh probe', event: 'event:live' },
    resume: { state: 'eligible', reason: 'structured compatibility', event: 'event:resume' } }, exactHolder).disposition).toBe('reconnect');
});

it('P13-NF-51 pane classifications grant nothing and confirmed structured poison forbids resume', () => {
  const f = assemblyRuntimeFixture();
  const handle = decodedHandle(f);
  const holder = createHarnessEvidenceHolder({ machine: 'machine-a', maxEvents: 4, maxCaptureBytes: 8 });
  refused(decodeHarnessRuntimeEvent({ ...eventInput('diagnostic'), kind: 'pane-says-poisoned' }, f.c), 'unsupported value');
  expect(holder.resume(handle).state).toBe('unknown');
  holder.admit(decodedEvent(f, 'diagnostic', { diagnosticCode: 'transcript-resume-compatible' }));
  expect(holder.resume(handle).state).toBe('eligible');
  holder.admit(decodedEvent(f, 'diagnostic', { id: 'event:poison', observedAt: 20, diagnosticCode: 'transcript-poison-confirmed' }));
  expect(holder.resume(handle).state).toBe('poisoned');
});

it('P13-NF-29 P13-NF-30 P13-NF-31 P13-NF-32 P13-NF-33 P13-NF-34 structured evidence keeps liveness, progress, output, and completion distinct under finite bounds', () => {
  const f = assemblyRuntimeFixture();
  const handle = decodedHandle(f);
  const holder = createHarnessEvidenceHolder({ machine: 'machine-a', maxEvents: 8, maxCaptureBytes: 8 });
  const heartbeat = decodedEvent(f, 'heartbeat');
  expect(holder.admit(heartbeat)).toMatchObject({ disposition: 'recorded', progress: false });
  expect(holder.liveness(handle, 20).state).toBe('live');
  expect(holder.liveness(handle, 31).state).toBe('unknown');
  expect(holder.admit(decodedEvent(f, 'probe-failed', { id: 'event:probe-timeout' })).progress).toBe(false);
  expect(holder.liveness(handle, 31).state).toBe('unknown');

  const work = decodedEvent(f, 'work-transition');
  expect(holder.admit(work)).toMatchObject({ disposition: 'recorded', progress: true });
  expect(holder.admit(decodedEvent(f, 'work-transition', { id: 'event:work-churn' }))).toMatchObject({ progress: false });
  const chunk = decodedEvent(f, 'output-chunk');
  expect(holder.admit(chunk)).toMatchObject({ disposition: 'recorded', progress: true });
  expect(holder.admit(decodedEvent(f, 'output-chunk', { id: 'event:chunk-churn' }))).toMatchObject({ disposition: 'duplicate', progress: false });
  expect(holder.admit(decodedEvent(f, 'output-chunk', { id: 'event:chunk-conflict', output: { ...eventInput('output-chunk').output as object, digest: digest('c') } })).disposition).toBe('refused');

  const pending = decodedEvent(f, 'turn-closed', { id: 'event:pending', childrenState: 'pending' });
  holder.admit(pending);
  expect(holder.completion(handle).state).toBe('pending');
  const complete = decodedEvent(f, 'turn-closed', { id: 'event:complete', observedAt: 40 });
  holder.admit(complete);
  expect(holder.completion(handle).state).toBe('complete');
  holder.admit(decodedEvent(f, 'process-exited', { id: 'event:exit', observedAt: 50 }));
  expect(holder.liveness(handle, 50).state).toBe('dead');
  expect(holder.events(handle.launch)).toHaveLength(8);
});
