import { it, expect } from 'vitest';
import { ALLOWED_OBLIGATION_STATES, DECLARED_BOUNDS, OPEN_OBLIGATION_STATES, acrossExecutions, adjacentPairs, withinExecution } from './acceptance.js';
import type { SliceReport } from './acceptance.js';
import { JUDGMENT_BOUNDARIES, REPLY_BOUNDARIES, SLICE_INPUT } from './harness.js';
import { minimalPlaneProjectionIds } from './plane-fixture.js';

const OPERATION = 'operation:sha256:aa';
const DIGEST = 'sha256:bb';

function report(overrides: Partial<SliceReport> = {}): SliceReport {
  const base: SliceReport = {
    boot: 2, profile: 'reply', adapter: 'telegram-slice', registerChecks: ['extract', 'force', 'current'],
    steps: [{ step: 'intake', state: 'admitted' }],
    identityTrail: { logicalId: ['lid'], run: ['run:1'], request: ['request:1'], operation: [OPERATION], semanticMessage: ['sm:1'] },
    boundariesReached: ['preservation'], cutsFired: [{ boot: 1, boundary: 'preservation' }],
    intake: { logicalId: 'lid', rawHash: 'sha256:input', receipt: 'machine-a:0:6', boundOperator: true, arrivalAt: 1006 },
    preservedInput: { capture: 'sha256:input', bytes: SLICE_INPUT },
    run: { id: 'run:1', owner: 'bob', opening: 'machine-a:0:8' }, grounding: 'absent',
    judgment: { request: null, logicalKey: null, resolution: null, disposition: null, capture: null, meter: null },
    reply: { semanticMessage: 'sm:1', basis: 'run-record', text: 'ok' },
    outbound: { request: 'request:1', digest: DIGEST, semanticMessage: 'sm:1', operation: OPERATION, charge: 20, observations: ['response'] },
    settlement: { outcome: 'happened', finalCharge: '3', retainedExposure: 3, delayedExecutionExcluded: true },
    deliveryEvidence: [{ operation: OPERATION, stage: 'service-applied', decisive: 'decisive', value: 'happened' }],
    obligations: [{ operation: OPERATION, state: 'settled-happened', owner: 'part-eight', blocker: 'none', exposure: '3' }],
    externalApplications: [{ operation: OPERATION, digest: DIGEST, semanticMessage: 'sm:1', messageId: 'service-message:1' }],
    charges: [{ operation: OPERATION, charge: 3 }], serviceInbound: 1,
    operations: [OPERATION], semanticKeys: ['sm:1'], routes: ['bot:slice/chat:slice'],
    adapterCapabilities: { decisiveNonOccurrence: { status: 'supported' }, exclusionOfDelayedExecution: { status: 'supported' } },
    declaredStage: 'service-applied',
    rebuilds: minimalPlaneProjectionIds.map(id => ({ projection: id, hash: `sha256:${id}`, resumedHash: `sha256:${id}`,
      equal: 'equal', folded: 0, resumedFrom: null, values: {}, conflicts: [], taint: [] })),
    accounting: { facts: 30, bytes: 90000, boots: 2, attempts: 3, notifications: 1, tokens: null, money: 3,
      peakRssBytes: 250_000_000, peakRssSamples: 24, durationMs: 21_000, measuredBoots: 1,
      perBootDurationMs: [{ boot: 1, durationMs: 9000, bounded: true }, { boot: 2, durationMs: 12_000, bounded: false }] },
  };
  return { ...base, ...overrides };
}

it('P11-NF-45 the within-execution predicate accepts a complete execution and refuses a changed logical identity', () => {
  expect(withinExecution(report(), SLICE_INPUT)).toEqual([]);
  const drifted = withinExecution(report({ identityTrail: { logicalId: ['lid'], run: ['run:1', 'run:2'] } }), SLICE_INPUT);
  expect(drifted.some(v => v.includes('logical identity run changed through takeover'))).toBe(true);
});

it('P11-NF-45 rebuild divergence at one pinned vector fails, and equal canonical bytes pass', () => {
  const rebuilds = minimalPlaneProjectionIds.map((id, index) => ({ projection: id, hash: `sha256:${id}`,
    resumedHash: index === 0 ? 'sha256:different' : `sha256:${id}`, equal: index === 0 ? 'pinned rebuild divergence' : 'equal',
    folded: 0, resumedFrom: null, values: {}, conflicts: [], taint: [] }));
  const violations = withinExecution(report({ rebuilds }), SLICE_INPUT);
  expect(violations.some(v => v.includes('checkpoint rebuild differs from genesis rebuild'))).toBe(true);
  expect(withinExecution(report(), SLICE_INPUT)).toEqual([]);
});

it('P11-NF-45 separate executions are compared semantically and are never forced byte-identical', () => {
  const control = report();
  const cut = report({ reply: { semanticMessage: 'sm:1', basis: 'judgment-resolution', text: 'a different rendering' },
    boot: 4, cutsFired: [{ boot: 1, boundary: 'external-send' }],
    rebuilds: minimalPlaneProjectionIds.map(id => ({ projection: id, hash: `sha256:cut-${id}`, resumedHash: `sha256:cut-${id}`,
      equal: 'equal', folded: 0, resumedFrom: null, values: {}, conflicts: [], taint: [] })) });
  expect(acrossExecutions(control, cut)).toEqual([]);
  // A position-derived run id may legitimately differ between two executions...
  expect(acrossExecutions(control, report({ run: { id: 'run:2', owner: 'bob', opening: 'x' } }))).toEqual([]);
  // A digest over position-derived references may also differ between executions.
  expect(acrossExecutions(control, report({ outbound: { request: 'request:1', digest: 'sha256:other',
    semanticMessage: 'sm:1', operation: OPERATION, charge: 20, observations: ['response'] } }))).toEqual([]);
  // ...but the CONTENT-derived outbound identities may not.
  expect(acrossExecutions(control, report({ outbound: { request: 'request:2', digest: DIGEST,
    semanticMessage: 'sm:1', operation: OPERATION, charge: 20, observations: ['response'] } }))
    .some(v => v.includes('outbound operation identity differs'))).toBe(true);
  // Nor may a logical identity drift THROUGH a takeover inside one execution.
  expect(acrossExecutions(control, report({ identityTrail: { run: ['run:1', 'run:2'] } }))
    .some(v => v.includes('run identity changed through takeover'))).toBe(true);
});

it('P11-NF-48 an ownerless or unknown obligation state fails; owned-pending states pass', () => {
  expect(withinExecution(report({ obligations: [{ operation: OPERATION, state: 'owned-uncertain', owner: 'part-eight', blocker: 'adapter-evidence', exposure: '20' }],
    settlement: null }), SLICE_INPUT)).toEqual([]);
  const bad = withinExecution(report({ obligations: [{ operation: OPERATION, state: 'quietly-dropped', owner: '', blocker: 'none', exposure: '0' }] }), SLICE_INPUT);
  expect(bad.some(v => v.includes('outside the allowed set'))).toBe(true);
  expect(bad.some(v => v.includes('ownerless obligation'))).toBe(true);
  expect(ALLOWED_OBLIGATION_STATES).toContain('owned-pending-unadmitted');
});

it('P11-NF-48 an unsettled operation may not release its retained exposure', () => {
  const released = withinExecution(report({ settlement: null,
    obligations: [{ operation: OPERATION, state: 'owned-uncertain', owner: 'part-eight', blocker: 'adapter-evidence', exposure: '0' }] }), SLICE_INPUT);
  expect(released.some(v => v.includes('unsettled operation released exposure'))).toBe(true);
  const unknownCharge = withinExecution(report({ settlement: { outcome: 'uncertain', finalCharge: null, retainedExposure: 1, delayedExecutionExcluded: false },
    obligations: [{ operation: OPERATION, state: 'owned-uncertain', owner: 'part-eight', blocker: 'adapter-evidence', exposure: '20' }] }), SLICE_INPUT);
  expect(unknownCharge.some(v => v.includes('unknown final charge did not retain maximum exposure'))).toBe(true);
});

it('P11-NF-47 evidence may not outrun its source or the adapter declaration', () => {
  const inflated = withinExecution(report({ deliveryEvidence: [{ operation: OPERATION, stage: 'read-by-a-human', decisive: 'decisive', value: 'happened' }] }), SLICE_INPUT);
  expect(inflated.some(v => v.includes("beyond the adapter's declared stage"))).toBe(true);
  const invented = withinExecution(report({ externalApplications: [], deliveryEvidence: [{ operation: OPERATION, stage: 'service-applied', decisive: 'decisive', value: 'happened' }] }), SLICE_INPUT);
  expect(invented.some(v => v.includes('claims application with no journal row'))).toBe(true);
  const opaque = withinExecution(report({ adapter: 'telegram-opaque', externalApplications: [], settlement: null,
    adapterCapabilities: { decisiveNonOccurrence: { status: 'unsupported' }, exclusionOfDelayedExecution: { status: 'unsupported' } },
    obligations: [{ operation: OPERATION, state: 'owned-uncertain', owner: 'part-eight', blocker: 'adapter-evidence', exposure: '20' }],
    deliveryEvidence: [{ operation: OPERATION, stage: 'service-applied', decisive: 'indecisive', value: 'did-not-happen' }] }), SLICE_INPUT);
  expect(opaque.some(v => v.includes('adapter that declares it unsupported'))).toBe(true);
});

it('P11-NF-45 a duplicated external application for one semantic identity fails', () => {
  const twice = withinExecution(report({ externalApplications: [
    { operation: OPERATION, digest: DIGEST, semanticMessage: 'sm:1', messageId: 'service-message:1' },
    { operation: 'operation:sha256:cc', digest: DIGEST, semanticMessage: 'sm:1', messageId: 'service-message:2' }] }), SLICE_INPUT);
  expect(twice.some(v => v.includes('external applications for semantic identity'))).toBe(true);
  const forked = withinExecution(report({ operations: [OPERATION, 'operation:sha256:cc'] }), SLICE_INPUT);
  expect(forked.some(v => v.includes('more than one six-owned operation'))).toBe(true);
});

it('P11-NF-50 accounting outside a declared finite bound fails, and a complete sample passes', () => {
  expect(withinExecution(report(), SLICE_INPUT)).toEqual([]);
  const base = report().accounting;
  const over = withinExecution(report({ accounting: { ...base, notifications: 4 } }), SLICE_INPUT);
  expect(over.some(v => v.includes('notification count beyond the declared bound'))).toBe(true);
  expect(DECLARED_BOUNDS.maxNotifications).toBe(1);
  const missing = withinExecution(report({ accounting: { ...base, facts: Number.NaN } }), SLICE_INPUT);
  expect(missing.some(v => v.includes('accounting facts is missing'))).toBe(true);
});

it('P11-NF-44 the schedule enumerates every adjacent pair of the declared boundaries', () => {
  const pairs = adjacentPairs(REPLY_BOUNDARIES);
  expect(pairs).toHaveLength(REPLY_BOUNDARIES.length - 1);
  for (let i = 0; i + 1 < REPLY_BOUNDARIES.length; i++) expect(pairs[i]).toEqual([REPLY_BOUNDARIES[i], REPLY_BOUNDARIES[i + 1]]);
  expect(adjacentPairs(JUDGMENT_BOUNDARIES)).toHaveLength(JUDGMENT_BOUNDARIES.length - 1);
  expect(adjacentPairs([])).toEqual([]);
});

it('P11-NF-45 an execution that lost its accepted input fails the predicate', () => {
  const lost = withinExecution(report({ preservedInput: { capture: 'sha256:input', bytes: null } }), SLICE_INPUT);
  expect(lost.some(v => v.includes('accepted input was not preserved'))).toBe(true);
});

it('P11-NF-50 duration and memory are recorded across the whole execution, not one instant', () => {
  const base = report().accounting;
  expect(withinExecution(report(), SLICE_INPUT)).toEqual([]);
  // Duration must exist, be finite and sit inside its DECLARED bound.
  expect(withinExecution(report({ accounting: { ...base, durationMs: DECLARED_BOUNDS.maxDurationMs + 1 } }), SLICE_INPUT)
    .some(v => v.includes('recorded duration beyond the declared bound'))).toBe(true);
  expect(withinExecution(report({ accounting: { ...base, durationMs: Number.NaN } }), SLICE_INPUT)
    .some(v => v.includes('durationMs is missing'))).toBe(true);
  // Every boot of the execution must carry a duration row, killed boots included.
  expect(withinExecution(report({ accounting: { ...base, perBootDurationMs: base.perBootDurationMs.slice(1) } }), SLICE_INPUT)
    .some(v => v.includes('has no recorded duration row'))).toBe(true);
  expect(withinExecution(report({ accounting: { ...base, measuredBoots: 0 } }), SLICE_INPUT)
    .some(v => v.includes('no boot of this execution recorded a completed duration'))).toBe(true);
  // A single end-of-run RSS reading is NOT a high-water mark across boots.
  expect(withinExecution(report({ accounting: { ...base, peakRssSamples: 1 } }), SLICE_INPUT)
    .some(v => v.includes('peak memory is not measured across the execution'))).toBe(true);
  // `notifications` is an alias for the application count and must agree with it.
  expect(withinExecution(report({ accounting: { ...base, notifications: 0 } }), SLICE_INPUT)
    .some(v => v.includes('aliases'))).toBe(true);
});

it('P11-NF-50 token usage is required exactly when a judgment resolved', () => {
  const judged = { request: 'q:1', logicalKey: 'k', resolution: 'r:1', disposition: 'decided', capture: 'c', meter: 'm' };
  const tokens = { inputTokens: 17, outputTokens: 11 };
  const base = report().accounting;
  expect(withinExecution(report({ judgment: judged, accounting: { ...base, tokens } }), SLICE_INPUT)).toEqual([]);
  expect(withinExecution(report({ judgment: judged }), SLICE_INPUT)
    .some(v => v.includes('resolved judgment recorded no token usage'))).toBe(true);
  expect(withinExecution(report({ accounting: { ...base, tokens } }), SLICE_INPUT)
    .some(v => v.includes('token usage recorded without a judgment'))).toBe(true);
});

it('P11-NF-48 the progress floor refuses an execution that recorded nothing at all', () => {
  // The exact shape the desk demonstrated with two REAL executions: strip the owned
  // obligations from an honestly owned-pending report and it must stop passing.
  const pending = report({ settlement: null, reply: null, outbound: null, deliveryEvidence: [],
    externalApplications: [], charges: [], operations: [], semanticKeys: [], routes: [],
    obligations: [{ operation: 'pending:sm:1', state: 'owned-pending-no-answer', owner: 'part-seven', blocker: 'part-seven', exposure: '20' }],
    accounting: { ...report().accounting, notifications: 0 } });
  expect(withinExecution(pending, SLICE_INPUT)).toEqual([]);
  const empty = withinExecution({ ...pending, obligations: [] }, SLICE_INPUT);
  expect(empty.some(v => v.includes('recorded neither progress nor a reason for its absence'))).toBe(true);
  expect(empty.some(v => v.includes('rendered no attributable reply and recorded no owned-pending reason'))).toBe(true);
});

it('P11-NF-48 an open obligation may not release the exposure it is holding', () => {
  const open = report({ settlement: null,
    obligations: [{ operation: OPERATION, state: 'owned-uncertain', owner: 'part-eight', blocker: 'adapter-evidence', exposure: '0' }] });
  expect(withinExecution(open, SLICE_INPUT).some(v => v.includes('released its exposure'))).toBe(true);
  // A grounding obligation carries no charge, so zero exposure is correct there.
  const grounding = report({ settlement: null, reply: null, outbound: null, deliveryEvidence: [], externalApplications: [],
    charges: [], operations: [], semanticKeys: [], routes: [], accounting: { ...report().accounting, notifications: 0 },
    obligations: [{ operation: 'grounding:run:1', state: 'owned-pending-unadmitted', owner: 'part-five', blocker: 'part-five', exposure: '0' }] });
  expect(withinExecution(grounding, SLICE_INPUT)).toEqual([]);
  expect(OPEN_OBLIGATION_STATES).toContain('owned-uncertain');
  expect(OPEN_OBLIGATION_STATES).not.toContain('settled-happened');
});

it('P11-NF-48 an ill-formed obligation is refused even when its state is allowed', () => {
  const broken = withinExecution(report({ obligations: [
    { operation: OPERATION, state: 'settled-happened', owner: 'part-eight', blocker: '', exposure: '3' }] }), SLICE_INPUT);
  expect(broken.some(v => v.includes("names no blocker"))).toBe(true);
  const noExposure = withinExecution(report({ obligations: [
    { operation: OPERATION, state: 'settled-happened', owner: 'part-eight', blocker: 'none', exposure: 'many' }] }), SLICE_INPUT);
  expect(noExposure.some(v => v.includes('no finite exposure'))).toBe(true);
});

it('P11-NF-48 an admitted outbound operation must carry an obligation, and a blocked one must name its blocker', () => {
  expect(withinExecution(report({ obligations: [
    { operation: 'operation:sha256:other', state: 'settled-happened', owner: 'part-eight', blocker: 'none', exposure: '3' }] }), SLICE_INPUT)
    .some(v => v.includes('admitted outbound operation with no recorded obligation'))).toBe(true);
  const blocked = report({ settlement: null, deliveryEvidence: [], externalApplications: [], charges: [],
    operations: [], semanticKeys: [], routes: [], accounting: { ...report().accounting, notifications: 0 },
    outbound: { request: 'request:1', digest: DIGEST, semanticMessage: 'sm:1', operation: null, charge: null, observations: [] },
    obligations: [{ operation: 'unreserved:request:1', state: 'owned-pending-unadmitted', owner: 'part-six', blocker: 'part-six', exposure: '20' }] });
  expect(withinExecution(blocked, SLICE_INPUT)).toEqual([]);
  expect(withinExecution({ ...blocked, obligations: [] }, SLICE_INPUT)
    .some(v => v.includes('six never admitted, with no owned-pending obligation'))).toBe(true);
});

it('P11-NF-45 the across-execution floor refuses an empty side without demanding outbound parity', () => {
  const control = report();
  // A cut that legitimately never reached a reply: NO outbound, but an owned reason.
  const earlyCut = report({ settlement: null, reply: null, outbound: null, deliveryEvidence: [], externalApplications: [],
    charges: [], operations: [], semanticKeys: [], routes: [], accounting: { ...report().accounting, notifications: 0 },
    obligations: [{ operation: 'pending:sm:1', state: 'owned-pending-no-answer', owner: 'part-seven', blocker: 'part-seven', exposure: '20' }] });
  expect(acrossExecutions(control, earlyCut)).toEqual([]);      // outbound parity is NOT demanded
  const silent = { ...earlyCut, obligations: [] };
  const violations = acrossExecutions(control, silent);
  expect(violations.some(v => v.includes('cut execution recorded no settlement and no owned obligation'))).toBe(true);
  expect(violations.some(v => v.includes('no owned-pending obligation explaining its absence'))).toBe(true);
});
