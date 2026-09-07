import { afterEach, expect, it } from 'vitest';
import { consumeOutcome } from '../../src/index.js';
import { consumeEffectSettlement, createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import { effectFixture, value, refused } from './fixture.js';
import type { AdmissionReservation } from '../../src/transport/index.js';

// Real fsync/signature/rebuild scenarios, not the operation's logical deadline.
// CI measured 5.6–10.7 seconds for these complete multi-stage fixtures. Allow
// 30 seconds per fixture including shared-runner contention (a later x64 run
// measured 15.3 seconds). No production bound or assertion is relaxed.
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

it('P8-NF-06 P8-NF-08 P8-NF-13 P8-NF-40 exact attributable reply survives the real owner path', () => {
  const f = effectFixture(), q = f.prepare();
  const observation = value(f.api.dispatch(q, f.fence));
  expect(observation.stage).toBe('response'); expect(f.calls()).toBe(1);
  expect(value(f.peer.read()).map(v => v.id)).toContain(value(f.store.read()).at(-1)!.id);
  expect(value(f.api.dispatch(q, f.fence)).id).toBe(observation.id); expect(f.calls()).toBe(1);
  refused(decodeOutboundMessage({ ...f.message, speaker: 'alice' }, f.host), 'speaker');
  refused(decodeOutboundMessage({ ...f.message, hidden: 'secret' }, f.host), 'undeclared');
  const changed = value(decodeOutboundMessage({ ...f.message, text: 'Different payload.' }, f.host));
  refused(f.api.prepare({ definition: f.d.id, message: changed, run: f.run, pending: f.pending.id,
    attempt: 'new', verificationOwner: 'verifier', obligation: f.obligation, closure: [], fence: f.fence }), 'collision');
  expect(f.calls()).toBe(1);
}, 30000);

it('P8-NF-25 P8-NF-26 demand is required before invocation, not inferred from a lease', () => {
  const f = effectFixture(); f.replicas.enable(false);
  expect(() => f.prepare()).toThrow('replicated demand'); expect(f.calls()).toBe(0);
  f.replicas.enable(true); const q = f.prepare();
  f.replicas.enable(false); refused(f.api.dispatch(q, f.fence)); expect(f.calls()).toBe(0);
  f.replicas.enable(true);
  // The failed claim acknowledgement is now uncertain, not a replay license.
  refused(f.api.dispatch(q, f.fence), 'uncertain'); expect(f.calls()).toBe(0);
}, 30000);

it('P8-NF-14 P8-NF-18 P8-NF-22 P8-NF-31 P8-NF-35 crash-shaped lost response stays observer-only with maximum exposure', () => {
  const f = effectFixture(), q = f.prepare();
  f.onInvoke(() => { throw new Error('lost response after service applied'); });
  const o = value(f.api.dispatch(q, f.fence)); expect(o.stage).toBe('unknown');
  const replacement = createEffectDoorway(f.composition);
  expect(value(replacement.dispatch(q, f.fence)).id).toBe(o.id); expect(f.calls()).toBe(1);
  const op = value(f.transport.inspect()).filter(v => v.record.type === 'AdmissionReservation').at(-1)!.record;
  if (op.type !== 'AdmissionReservation') throw new Error('fixture reservation');
  refused(f.transport.claim('fresh-claim', f.fence, op.operation));
  refused(f.transport.reserve({ command: 'fresh-key', fence: f.fence, request: { owner: 'part-eight', name: 'EffectRequest', id: 'fresh' },
    attempt: 'fresh', payloadDigest: q.digest, charge: 20, run: { ...f.run, id: 'fresh-run' }, semanticMessage: q.semanticMessage,
    durability: 'replicated', replicas: 1 }));
  f.time(110); value(f.transport.recover('observe', f.fence, op.operation, replacement));
  expect(f.queries()).toBe(1); expect(f.calls()).toBe(1);
  const settlement = value(replacement.settle(op.operation));
  expect(consumeOutcome(settlement.outcome, { happened: () => 'bad', 'did-not-happen': () => 'bad', uncertain: () => 'uncertain' })).toBe('uncertain');
  expect(settlement.retainedExposure).toBe(20); expect(settlement.retryEligible).toBe(false);
}, 30000);

it('P8-NF-21 P8-NF-23 P8-NF-38 duplicate settlement returns one record and absent assessor cannot bless the send', () => {
  const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
  refused(createEffectDoorway({ ...f.composition, assessment: null }).settle(o.operation), 'assessor unavailable');
  f.assess('happened', 0);
  const a = value(f.api.settle(o.operation)), b = value(f.api.settle(o.operation));
  expect(a.id).toBe(b.id);
  expect(value(f.api.inspect()).filter(v => v.record.type === 'EffectSettlement')).toHaveLength(1);
  expect(f.calls()).toBe(1);
  f.assess('uncertain', null); refused(f.api.settle(o.operation), 'disagreement');
  // P6 has no settlement-consumption API yet: zero release is honest, not a
  // mocked credit decrement claimed as the owner's accounting implementation.
  const reservations = value(f.transport.inspect()).filter(v => v.record.type === 'AdmissionReservation');
  expect(reservations.at(-1)!.record).toMatchObject({ charge: 20, state: 'consumed' });
}, 30000);

it('P8-NF-15 P8-NF-16 P8-NF-17 stop during durability wait prevents the actual call', () => {
  const f = effectFixture(), q = f.prepare();
  const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
    const receipts = f.composition.durability.ensure(facts); f.stop(); return receipts;
  } } });
  refused(api.dispatch(q, f.fence), 'stop'); expect(f.calls()).toBe(0);
}, 30000);

it('P8-NF-46 exact zero byte and charge bounds cannot become defaults', () => {
  expect(() => effectFixture(undefined, 'executor:1', { maxBytes: 0 })).toThrow('finite operation bounds');
  const f = effectFixture(undefined, 'executor:1', { maxCharge: 0 });
  expect(() => f.prepare()).toThrow('adapter mode'); expect(f.calls()).toBe(0);
});

// --- Dispatch-against-provided-admission (the new eight seam) ---
// An operation ADMITTED AND RESERVED EXTERNALLY (by six, at a caller's request) is
// dispatched through eight's boundary and settled through eight's evidence-checked path,
// producing the authentic EffectSettlement six's settle() consumes. Every settlement,
// durability, custody and once-only rule is prepare's, reused byte-identically.
const adoptInput = (f: ReturnType<typeof effectFixture>, over: Record<string, unknown> = {}) => ({ definition: f.d.id,
  message: f.message, run: f.run, pending: f.pending.id, attempt: 'attempt:1',
  verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], ...over });
const admissions = (f: ReturnType<typeof effectFixture>): AdmissionReservation[] => value(f.transport.inspect()).filter(v => v.record.type === 'AdmissionReservation').map(v => v.record as AdmissionReservation);
const distinctOps = (f: ReturnType<typeof effectFixture>): number => new Set(admissions(f).map(r => r.operation)).size;

it('P8-NF-13 P8-NF-14 P8-NF-21 P8-NF-24 an externally admitted operation is dispatched and settled without a second six reservation', () => {
  const f = effectFixture();
  f.externalAdmission();
  expect(admissions(f)).toHaveLength(1);
  expect(admissions(f)[0]!.state).toBe('prepared');
  const q = f.adopt();
  expect(q.id).toBe(f.requestId); expect(q.digest).toBe(f.messageDigest);
  // adopt recorded eight's EffectRequest against the caller's admission and minted NO
  // second six reservation — still exactly one, the caller's.
  expect(admissions(f)).toHaveLength(1);
  expect(value(f.api.inspect()).some(v => v.record.type === 'EffectRequest' && v.record.id === q.id)).toBe(true);
  // Dispatch against the caller's admission invokes the adapter exactly once.
  const o = value(f.api.dispatch(q, f.fence)); expect(f.calls()).toBe(1); expect(o.stage).toBe('response');
  // Six's state transitions are separate append-only facts; there is still exactly ONE
  // operation (the caller's), now consumed — no second reservation was ever minted.
  expect(distinctOps(f)).toBe(1); expect(admissions(f).at(-1)!.state).toBe('consumed');
  // Settle through eight's existing evidence-checked path produces the authentic settlement.
  f.assess('happened', 3);
  const settlement = value(f.api.settle(o.operation));
  expect([settlement.operation, settlement.finalCharge, settlement.retryEligible]).toEqual([o.operation, 3, false]);
  // It is a genuine, LIVE eight issuance six's consumer accepts...
  expect(value(consumeEffectSettlement(settlement, f.host.boundary, s => s.id))).toBe(settlement.id);
  // ...and a copied JSON of it is refused as non-live, unchanged from the existing path.
  refused(consumeEffectSettlement(JSON.parse(JSON.stringify(settlement)), f.host.boundary, s => s), 'live');
}, 30000);

it('P8-NF-13 P8-NF-14 the admitted-dispatch seam refuses by name a missing or non-matching admission', () => {
  // No external admission exists at all.
  const a = effectFixture();
  refused(a.api.adopt(adoptInput(a)), 'no external admission');
  // An admission whose charge is not the caller-shown definition charge.
  const b = effectFixture(); b.externalAdmission({ charge: 7 });
  refused(b.api.adopt(adoptInput(b)), 'does not match the caller-shown');
  // An admission whose payload digest is not the message digest.
  const c = effectFixture(); c.externalAdmission({ payloadDigest: `sha256:${'e'.repeat(64)}` });
  refused(c.api.adopt(adoptInput(c)), 'does not match the caller-shown');
}, 30000);

it('P8-NF-14 P8-NF-21 P8-NF-24 a settlement for an undispatched admission refuses, and a second dispatch adds no effect', () => {
  const f = effectFixture(); f.externalAdmission(); const q = f.adopt();
  f.assess('happened', 3);
  // Undispatched: the admission exists and is adopted, but eight never claimed it.
  refused(f.api.settle(admissions(f).at(-1)!.operation), 'no claim');
  const o = value(f.api.dispatch(q, f.fence)); expect(f.calls()).toBe(1);
  // A second dispatch of the same admission re-derives the same observation and never
  // invokes the adapter again — no second effect, no second reservation.
  expect(value(f.api.dispatch(q, f.fence)).id).toBe(o.id); expect(f.calls()).toBe(1);
  expect(distinctOps(f)).toBe(1);
}, 30000);

it('P8-NF-25 P8-NF-26 the durability demand applies equally to the adopted-dispatch path', () => {
  const f = effectFixture(); f.externalAdmission();
  // The peer is lost AFTER the admission. adopt demands the same replicated durability
  // prepare does; an unmet peer refuses BEFORE any dispatch, exactly as prepare's path.
  f.replicas.enable(false);
  expect(() => f.adopt()).toThrow('replicated demand');
  expect(f.calls()).toBe(0);
}, 30000);
