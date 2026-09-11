import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import type { HarnessObservation } from '../../src/assembly/index.js';
import {
  createClaudeCodeHarnessAdapter,
  createCodexHarnessAdapter,
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  createSessionHarnessAdapter,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/index.js';
import { effectFixture } from '../effects/fixture.js';
import { assemblyInput } from '../assembly/fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { adapterFixture, decodedEvent, decodedHandle, digest } from '../harness-adapters/fixture.js';

type Outcome<T> = Readonly<{ status: 'accepted'; value: T } | { status: 'refused'; detail: string }>;
const outcome = <T>(result: Result<T>): Outcome<T> => consumeResult<T, Outcome<T>>(result, {
  Success: value => ({ status: 'accepted', value }),
  Refused: refusal => ({ status: 'refused', detail: refusal.detail }),
});

function consumption(h: ReturnType<typeof adapterFixture>, id: string, changes: Record<string, unknown> = {}) {
  const delivery = value(h.f.runtime.record('HarnessObservation', {
    ...assemblyInput('HarnessObservation'), id: 'delivery:1', launch: h.spec.id, run: h.spec.run,
    step: h.spec.step, input: h.spec.input, incarnation: h.spec.incarnation,
    phase: 'input-accepted', observedAt: 20,
  })) as HarnessObservation;
  return value(h.f.runtime.record('HarnessObservation', {
    ...assemblyInput('HarnessObservation'), id, launch: h.spec.id, run: h.spec.run, step: h.spec.step,
    input: h.spec.input, incarnation: h.spec.incarnation, sourceEvidence: ['provider:model-request:1'],
    boundaryEvidence: 'provider:model-request:1', contextDigests: h.spec.contextManifest.map(row => row.digest),
    generation: 'generation:fixture', phase: 'context-consumed', observedAt: 20, freshFor: 100, ...changes,
  })) as HarnessObservation;
}

describe('round-2 signed-history adapter regressions', () => {
  it('REVIEW-F1 REVIEW-F12 accepts either owner alias and refuses stale, future, wrong-step, wrong-digest, and wrong-generation consumption', () => {
    for (const [label, changes] of [
      ['stale', { observedAt: 0, freshFor: 1 }],
      ['future', { observedAt: 1_000 }],
      ['step', { step: 'step:foreign' }],
      ['digest', { contextDigests: [digest('e')] }],
      ['generation', { generation: 'generation:foreign' }],
    ] as const) {
      const h = adapterFixture();
      value(h.package.adapter.launch(h.spec, 'operation:launch', 'claim:launch'));
      const source = consumption(h, `model-context:${label}`, changes);
      h.observeAs('context-consumed', source.id);
      expect(outcome(h.package.adapter.observe({ launch: h.spec.id, delivery: 'delivery:1', operation: `observe:${label}` })).status).toBe('refused');
    }

    const h = adapterFixture();
    value(h.package.adapter.launch(h.spec, 'operation:launch', 'claim:launch'));
    const source = consumption(h, 'model-context:fresh');
    const row = value(h.f.c.history!.lookup(source.id))!;
    h.observeAs('context-consumed', source.id);
    expect(value(h.package.adapter.observe({ launch: h.spec.id, delivery: 'delivery:1', operation: 'observe:alias' }))).toEqual(source);
    h.observeAs('context-consumed', row.fact.id);
    expect(value(h.package.adapter.observe({ launch: h.spec.id, delivery: 'delivery:1', operation: 'observe:fact' }))).toEqual(source);
  });

  it('REVIEW-F2 P13-NF-04 EXECUTABLE-LOCAL-ARM re-resolves current conformance before describe and launch', () => {
    const h = adapterFixture();
    expect(h.package.adapter.describe().contextModes).toEqual(['advisory']);
    const original = value(h.f.c.history!.lookup('conformance:claude-code'))!.record!;
    const conflict = value(decodeAssemblyRecord('AdapterConformance', { ...original,
      limitations: ['different signed limitation'] }, { ...h.f.c, validateReferences: false }));
    value(h.f.spine.append(conflict));
    expect(value(h.f.c.history!.resolve(original)).admitted).toBe(false);
    expect(() => h.package.adapter.describe()).toThrow(/partial, tainted, or conflicted|not admitted/);
    refused(h.package.adapter.launch(h.spec, 'operation:launch', 'claim:launch'), 'conflict');
    expect(h.calls.launch).toBe(0);
  });

  it('REVIEW-F4 requires exact holder evidence and a current owner-accepted Six fence', () => {
    const h = adapterFixture(), six = transportFixture();
    const fence = value(six.api.acquire('acquire', '', 500));
    const handle = decodedHandle(h.f, { incarnation: fence.incarnation });
    expect(h.handles.put(handle).disposition).toBe('stored');
    const state = createMemoryHarnessAdapterStateStore('f4-evidence');
    const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, machine: handle.machine, maxEvents: 8,
      maxCaptureBytes: 32, context: h.f.c, state });
    const other = { incarnation: 'incarnation:other', processIdentity: 'process:other' };
    evidence.admit(decodedEvent(h.f, 'heartbeat', other));
    evidence.admit(decodedEvent(h.f, 'diagnostic', { ...other, id: 'resume:other', diagnosticCode: 'transcript-resume-compatible' }));
    expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine, incarnation: handle.incarnation,
      fence, now: 20, evidence, authority: six.api }, h.handles).disposition).toBe('refused');

    evidence.admit(decodedEvent(h.f, 'heartbeat', { id: 'live:exact', incarnation: handle.incarnation }));
    evidence.admit(decodedEvent(h.f, 'diagnostic', { id: 'resume:exact', incarnation: handle.incarnation,
      diagnosticCode: 'transcript-resume-compatible' }));
    six.advance(501);
    expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine, incarnation: handle.incarnation,
      fence, now: 20, evidence, authority: six.api }, h.handles)).toMatchObject({ disposition: 'refused', handle: null });

    const neighbor = transportFixture(), current = value(neighbor.api.acquire('acquire', '', 500));
    const exactHandle = decodedHandle(h.f, { id: 'handle:neighbor', incarnation: current.incarnation });
    const exactHandles = createRuntimeHandleHolder({ adapter: exactHandle.harness, machine: exactHandle.machine,
      maxHandles: 1, maxAttempts: 2, context: h.f.c, state: createMemoryHarnessAdapterStateStore('f4-handles') });
    exactHandles.put(exactHandle);
    const exactEvidence = createHarnessEvidenceHolder({ adapter: exactHandle.harness, machine: exactHandle.machine,
      maxEvents: 4, maxCaptureBytes: 8, context: h.f.c, state: createMemoryHarnessAdapterStateStore('f4-neighbor') });
    exactEvidence.admit(decodedEvent(h.f, 'heartbeat', { id: 'live:neighbor', incarnation: exactHandle.incarnation }));
    exactEvidence.admit(decodedEvent(h.f, 'diagnostic', { id: 'resume:neighbor', incarnation: exactHandle.incarnation,
      diagnosticCode: 'transcript-resume-compatible' }));
    expect(sameMachineReconnectCandidate({ launch: exactHandle.launch, machine: exactHandle.machine,
      incarnation: exactHandle.incarnation, fence: current, now: 20, evidence: exactEvidence,
      authority: neighbor.api }, exactHandles).disposition).toBe('reconnect');
  });

  it('REVIEW-F11 branded factories preserve the caller platform as an independent tuple member', () => {
    for (const family of ['claude-code', 'codex'] as const) {
      const h = adapterFixture(family), id = h.id;
      const conformance = value(h.f.runtime.record('AdapterConformance', {
        ...assemblyInput('AdapterConformance'), id: `conformance:${family}:darwin`, adapter: id,
        artifact: digest('4'), platform: 'darwin-arm64', mode: 'advisory',
      }));
      const state = createMemoryHarnessAdapterStateStore(`platform:${family}`);
      const handles = createRuntimeHandleHolder({ adapter: id, machine: 'machine-a', maxHandles: 2, maxAttempts: 4,
        context: h.f.c, state });
      const input = { id, artifact: digest('4'), platform: 'darwin-arm64', conformance: conformance.id,
        machine: 'machine-a', driver: h.driver, handles, context: h.f.c, clock: () => 20,
        generation: () => 'generation:fixture' };
      expect(createSessionHarnessAdapter(input).adapter.describe().platform).toBe('darwin-arm64');
      const branded = family === 'claude-code' ? createClaudeCodeHarnessAdapter(input) : createCodexHarnessAdapter(input);
      expect(branded.adapter.describe().platform).toBe('darwin-arm64');
    }
  });

  it('REVIEW-F9 P13-NF-39 executes Eight and Six same-request closure without granting retry', () => {
    const f = effectFixture(), request = f.prepare(), observation = value(f.api.dispatch(request, f.fence));
    f.assess('happened', 3);
    const settlement = value(f.api.settle(observation.operation));
    expect(settlement.retryEligible).toBe(false);
    expect(value(f.api.dispatch(request, f.fence)).id).toBe(observation.id);
    expect(f.calls()).toBe(1);
    refused(f.transport.claim('retry-after-settlement', f.fence, observation.operation), 'claim already issued');
  }, 30_000);

  it('REVIEW-F8 P13-NF-37 EXECUTABLE-BOUNDED-OBSERVATION-ARM uses real Six to stop at the bound without invoking an observer', () => {
    const f = transportFixture(), { token, reservation } = f.prepared();
    value(f.api.claim('claim', token, reservation.operation));
    f.advance(100);
    let calls = 0;
    const recovered = value(f.api.recover('bounded-observe', token, reservation.operation, {
      owner: 'part-eight', observe: () => { calls++; throw new Error('observer must not run beyond the bound'); },
    }));
    expect(recovered.disposition).toBe('stopped-at-bound');
    expect(calls).toBe(0);
    expect(value(f.api.inspect()).map(row => row.record).some(record =>
      record.type === 'RecoveryRecord' && record.disposition === 'stopped-at-bound')).toBe(true);
  });

  it('REVIEW-F8 P13-NF-46 P13-NF-52 EXECUTABLE-NO-PREVENTIVE-COMPACTION-ARM exposes no ungranted preventive action', () => {
    const h = adapterFixture();
    expect(h.package.adapter.describe().interruptionModes).toEqual([]);
    expect('compact' in h.package.adapter).toBe(false);
    expect(h.calls).toEqual({ launch: 0, deliver: 0, observe: 0 });
  });
});
