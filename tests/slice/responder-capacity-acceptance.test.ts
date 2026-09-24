import { expect, it } from 'vitest';
import { withinExecution } from './acceptance.js';
import type { CapacityQuantities, SliceReport } from './acceptance.js';
import { SLICE_INPUT } from './harness.js';
import { minimalPlaneProjectionIds } from './plane-fixture.js';

const operation = 'operation:sha256:aa';
const digest = 'sha256:bb';
const quantities = (n: number): CapacityQuantities => ({ worker: n, memory: n, storage: n,
  queue: n, transport: n, effect: n });
const attributes = Object.freeze({ worker: 'installation', memory: 'installation', storage: 'installation',
  queue: 'installation', transport: 'installation', effect: 'installation' });

function report(): SliceReport {
  return {
    boot: 2, profile: 'reply', adapter: 'telegram-slice', registerChecks: ['extract', 'force', 'current'],
    steps: [{ step: 'intake', state: 'admitted' }],
    identityTrail: { logicalId: ['lid'], run: ['run:1'], request: ['request:1'], operation: [operation],
      semanticMessage: ['sm:1'] },
    boundariesReached: ['preservation'], cutsFired: [{ boot: 1, boundary: 'preservation' }],
    intake: { logicalId: 'lid', rawHash: 'sha256:input', receipt: 'machine-a:0:6', boundOperator: true, arrivalAt: 1006 },
    preservedInput: { capture: 'sha256:input', bytes: SLICE_INPUT },
    run: { id: 'run:1', owner: 'bob', opening: 'machine-a:0:8' }, grounding: 'absent',
    judgment: { request: null, logicalKey: null, resolution: null, disposition: null, capture: null, meter: null },
    reply: { semanticMessage: 'sm:1', basis: 'run-record', text: 'ok' },
    outbound: { request: 'request:1', digest, semanticMessage: 'sm:1', operation, charge: 20, observations: ['response'] },
    settlement: { outcome: 'happened', finalCharge: '3', retainedExposure: 3, delayedExecutionExcluded: true },
    deliveryEvidence: [{ operation, stage: 'service-applied', decisive: 'decisive', value: 'happened' }],
    obligations: [{ operation, state: 'settled-happened', owner: 'part-eight', blocker: 'none', exposure: '3' }],
    externalApplications: [{ operation, digest, semanticMessage: 'sm:1', messageId: 'service-message:1' }],
    charges: [{ operation, charge: 3 }], serviceInbound: 1,
    operations: [operation], semanticKeys: ['sm:1'], routes: ['bot:slice/chat:slice'],
    sixOperations: [{ operation, role: 'outbound-reply', run: 'run:1', state: 'consumed', charge: 20,
      application: { exposure: 3, released: 17, unresolved: 0, actualCharge: 3 }, resolved: true }],
    contextOperations: [], sourceCategory: 'installed',
    installationReservations: [{ capacity: 'capacity:one', reference: 'fact:capacity:one',
      history: ['fact:capacity:one'], installation: 'host', scope: 'scope:minimal',
      generation: 'generation:one', ordinaryDomain: 'conversation:one', responderDomain: 'responder:one',
      budgetPolicy: 'policy:one', units: { ...attributes, worker: 'worker', memory: 'byte', storage: 'byte',
        queue: 'slot', transport: 'message', effect: 'charge' }, windows: attributes,
      allocation: quantities(20), parent: quantities(100), parentRemainder: quantities(80),
      childUsage: quantities(0), state: 'held', usable: true, blocker: null }],
    capacitySourceReferences: ['fact:capacity:one'], selectedCapacityReferences: ['fact:capacity:one'],
    operationSourceReferences: [{ operation, initial: 'fact:operation:one', latest: 'fact:operation:one' }],
    adapterCapabilities: { decisiveNonOccurrence: { status: 'supported' },
      exclusionOfDelayedExecution: { status: 'supported' } }, declaredStage: 'service-applied',
    rebuilds: minimalPlaneProjectionIds.map(id => ({ projection: id, hash: `sha256:${id}`,
      resumedHash: `sha256:${id}`, equal: 'equal', folded: 0, resumedFrom: null, values: {}, conflicts: [], taint: [] })),
    accounting: { facts: 30, bytes: 90000, boots: 2, attempts: 3, notifications: 1, tokens: null,
      money: 3, peakRssBytes: 250_000_000, peakRssSamples: 24, durationMs: 21_000, measuredBoots: 1,
      perBootDurationMs: [{ boot: 1, durationMs: 9000, bounded: true },
        { boot: 2, durationMs: 12_000, bounded: false }] },
  };
}

it('P10-SI-27 accepts a complete installed capacity row and refuses a missing source row', () => {
  const complete = report();
  expect(withinExecution(complete, SLICE_INPUT)).toEqual([]);
  const omitted = withinExecution({ ...complete, installationReservations: [] }, SLICE_INPUT);
  expect(omitted).toContain('installation capacity source identity coverage differs');
  expect(omitted.some(reason => reason.includes('selected capacity reference is absent'))).toBe(true);
});

it('P10-SI-27 refuses a foreign operation omitted from both operation categories', () => {
  const complete = report();
  const omitted = withinExecution({ ...complete, operationSourceReferences: [...complete.operationSourceReferences,
    { operation: 'operation:foreign-run', initial: 'fact:foreign:one', latest: 'fact:foreign:two' }] }, SLICE_INPUT);
  expect(omitted).toContain('operation source identity coverage differs');
  const relabelled = withinExecution({ ...complete, operationSourceReferences: [
    { operation, initial: 'fact:capacity:one', latest: 'fact:capacity:one' }] }, SLICE_INPUT);
  expect(relabelled.some(reason => reason.includes('relabelled capacity'))).toBe(true);
});
