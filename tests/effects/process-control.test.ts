import { once } from 'node:events';
import { expect, it } from 'vitest';
import { consumeOutcome } from '../../src/index.js';
import { createEffectDoorway, decodeProcessControlPayload } from '../../src/effects/index.js';
import { processControlFixture, startOwnProcessFixture } from './process-control-fixture.js';
import { value, refused } from './fixture.js';

it('P8-NF-14 P8-NF-49 exact owned fixture process crosses durable Eight/Six dispatch and independent Nine settlement once', async () => {
  const own = await startOwnProcessFixture();
  try {
    const f = processControlFixture(own.target, own.kernel), q = f.prepare();
    const observed = value(f.api.dispatch(q, f.fence));
    expect(observed.stage).toBe('response');
    const [code, signal] = await own.exit;
    expect(code).toBeNull(); expect(signal).toBe('SIGTERM');
    const acceptance = value(f.api.inspect()).find(row => row.record.type === 'OperationObservation'
      && row.record.stage === 'executor-accepted');
    expect(acceptance).toBeDefined();
    expect(value(f.peer.read()).some(fact => fact.id === acceptance!.fact.id)).toBe(true);
    const rehydrated = createEffectDoorway(f.composition);
    expect(value(rehydrated.dispatch(q, f.fence)).id).toBe(observed.id);
    f.recordIndependentEvidence(observed.operation, q.digest, signal);
    const settlement = value(rehydrated.settle(observed.operation));
    expect(consumeOutcome(settlement.outcome, { happened: () => 'happened', 'did-not-happen': () => 'no', uncertain: () => 'unknown' })).toBe('happened');
    expect(settlement.delayedExecutionExcluded).toBe(true);
    expect(settlement.finalCharge).toBe(0);
    expect(value(f.store.read()).some(fact => fact.kind === 'verification-VerificationAssessment')).toBe(true);
  } finally { own.close(); }
}, 60000);

it('raw or copied driver invocation cannot bypass the one-use owner handoff', () => {
  let calls = 0;
  const f = processControlFixture(undefined, { signal: () => { calls++; return { state: 'signalled', detail: 'fixture' }; },
    observe: () => ({ state: 'running', detail: 'fixture' }) });
  refused(f.adapter.invokeProcess!({ operation: 'raw', claim: 'raw', digest: 'raw', payload: f.payload }), 'current Eight/Six');
  expect(calls).toBe(0);
}, 30000);

it('unknown process evidence cannot settle occurrence or release exposure', () => {
  const f = processControlFixture(), q = f.prepare(), observation = value(f.api.dispatch(q, f.fence));
  refused(f.api.settle(observation.operation)); // no independent evidence means no settlement
  expect(value(f.api.inspect()).some(row => row.record.type === 'EffectSettlement')).toBe(false);
  expect(value(f.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation').at(-1)?.record)
    .toMatchObject({ state: 'consumed', charge: 0 });
}, 30000);

it('P8-NF-13 closed process decoder refuses target ambiguity, wrong signal, extra fields and machine substitution', () => {
  const f = processControlFixture();
  for (const changed of [{ hidden: true }, { signal: 'SIGSTOP' }, { action: 'interrupt' },
    { target: { ...f.payload.target, pid: 0 } }, { target: { ...f.payload.target, machine: 'other' } },
    { target: { ...f.payload.target, argvDigest: 'not-a-digest' } }]) refused(decodeProcessControlPayload({ ...f.payload, ...changed }, f.host));
}, 30000);

it('legacy adapter refuses unsupported process payload before claim or mutation', () => {
  const f = processControlFixture();
  const api = createEffectDoorway({ ...f.composition, adapter: { ...f.adapter, describe: () => ({
    contract: 'legacy', account: f.payload.account, conversation: f.payload.conversation,
    maxCharge: 0, timeout: 100, hiddenRetries: 0 }) } });
  refused(api.prepare({ definition: f.d.id, message: f.payload, run: f.run, pending: f.pending.id,
    attempt: 'process-attempt:1', verificationOwner: 'process-verifier', obligation: f.obligation, closure: [], fence: f.fence }), 'does not support');
  expect(value(f.transport.inspect()).some(row => row.record.type === 'AdmissionReservation')).toBe(false);
}, 30000);

it('stop and expired payload refuse before the real kernel port', () => {
  for (const reason of ['stop', 'expiry'] as const) {
    let calls = 0;
    const f = processControlFixture(undefined, { signal: () => { calls++; return { state: 'signalled', detail: 'fixture' }; },
      observe: () => ({ state: 'running', detail: 'fixture' }) });
    const q = f.prepare();
    if (reason === 'stop') f.stop(); else f.time(500);
    refused(f.api.dispatch(q, f.fence)); expect(calls).toBe(0);
  }
}, 60000);

it('changed target or supervision result cannot act through a trusted owner binding', () => {
  for (const field of ['target', 'sourceResult'] as const) {
    let calls = 0;
    const f = processControlFixture(undefined, { signal: () => { calls++; return { state: 'signalled', detail: 'fixture' }; },
      observe: () => ({ state: 'running', detail: 'fixture' }) });
    const replacement = field === 'target' ? { target: { ...f.payload.target, pid: 3001 } }
      : { sourceResult: f.note('unrelated source result').id };
    const payload = value(decodeProcessControlPayload({ ...f.payload, ...replacement }, f.host));
    const q = value(f.api.prepare({ definition: f.d.id, message: payload, run: f.run, pending: f.pending.id,
      attempt: 'process-attempt:1', verificationOwner: 'process-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
    const observation = value(f.api.dispatch(q, f.fence));
    const capture = f.ctx.captures![observation.capture.reference];
    expect(JSON.parse(capture!.bytes as string)).toMatchObject({ type: 'process-control-refusal', state: 'refused' });
    expect(calls).toBe(0);
  }
}, 60000);

it('a lost kernel response remains UNKNOWN and never signals twice after reconstruction', () => {
  let calls = 0;
  const f = processControlFixture(undefined, { signal: () => { calls++; throw Error('lost after syscall'); },
    observe: () => ({ state: 'unknown', detail: 'unavailable' }) });
  const q = f.prepare(), observation = value(f.api.dispatch(q, f.fence));
  expect(JSON.parse(f.ctx.captures![observation.capture.reference]!.bytes as string)).toMatchObject({ state: 'unknown' });
  expect(value(createEffectDoorway(f.composition).dispatch(q, f.fence)).id).toBe(observation.id);
  expect(calls).toBe(1); refused(f.api.settle(observation.operation));
}, 30000);

it('process payload and durable preparation retain argument identity without secret argument bytes', async () => {
  const secret = 'fixture-secret-only-do-not-persist';
  const own = await startOwnProcessFixture('worker:fixture', [secret, 'α', 'two words']);
  try {
    const f = processControlFixture(own.target, own.kernel);
    f.prepare();
    expect(own.target.argvDigest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(JSON.stringify(own.target)).not.toContain(secret);
    expect(JSON.stringify(value(f.store.read()))).not.toContain(secret);
  } finally { own.close(); }
}, 30000);

it('an accepted source and target cannot authorize a substituted signal, step or deadline', () => {
  for (const patch of [{ signal: 'SIGKILL' }, { step: 'unreviewed-step' }, { deadline: 499 }]) {
    let calls = 0;
    const f = processControlFixture(undefined, { signal: () => { calls++; return { state: 'signalled', detail: 'fixture' }; },
      observe: () => ({ state: 'running', detail: 'fixture' }) });
    const payload = value(decodeProcessControlPayload({ ...f.payload, ...patch }, f.host));
    const q = value(f.api.prepare({ definition: f.d.id, message: payload, run: f.run, pending: f.pending.id,
      attempt: 'process-attempt:1', verificationOwner: 'process-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
    const observation = value(f.api.dispatch(q, f.fence));
    expect(JSON.parse(f.ctx.captures![observation.capture.reference]!.bytes as string)).toMatchObject({ state: 'refused' });
    expect(calls).toBe(0);
  }
}, 60000);

it('nonfatal SIGINT needs the child acknowledgment and actuator exit, and never means target exit', async () => {
  const own = await startOwnProcessFixture('worker:fixture', [], true);
  const neighbor = await startOwnProcessFixture();
  try {
    const f = processControlFixture(own.target, own.kernel, { signal: 'SIGINT' });
    const acknowledgment = once(own.child.stdout, 'data');
    const q = f.prepare(), observed = value(f.api.dispatch(q, f.fence));
    const receipt = JSON.parse(f.ctx.captures![observed.capture.reference]!.bytes as string);
    expect(receipt).toMatchObject({ state: 'signalled', actuatorExit: { code: 0, signal: null } });
    refused(f.api.settle(observed.operation)); // Receipt alone cannot settle.
    const [bytes] = await acknowledgment;
    expect(own.kernel.observe(own.target).state).toBe('running');
    expect(neighbor.kernel.observe(neighbor.target).state).toBe('running');
    expect(() => f.recordNonfatalEvidence(observed.operation, q.digest, String(bytes),
      { ...receipt.actuatorExit, code: null })).toThrow('wait status');
    expect(() => f.recordNonfatalEvidence(observed.operation, q.digest,
      JSON.stringify({ pid: neighbor.target.pid, signal: 'SIGINT', seq: 1 }), receipt.actuatorExit)).toThrow('acknowledgment');
    f.recordNonfatalEvidence(observed.operation, q.digest, String(bytes), receipt.actuatorExit);
    const restarted = createEffectDoorway(f.composition);
    const settled = value(restarted.settle(observed.operation));
    expect(consumeOutcome(settled.outcome, { happened: () => true, 'did-not-happen': () => false, uncertain: () => false })).toBe(true);
    expect(settled).toMatchObject({ delayedExecutionExcluded: true, finalCharge: 0 });
    expect(value(restarted.dispatch(q, f.fence)).id).toBe(observed.id);
    expect(own.kernel.observe(own.target).state).toBe('running');
    expect(own.child.exitCode).toBeNull(); expect(own.child.signalCode).toBeNull();
  } finally { own.close(); neighbor.close(); }
}, 60000);
