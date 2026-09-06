import assert from 'node:assert/strict';
import { effects, fixtures, bindings, effectCommit } from './effect-pin.mjs';
import { createTransportAuthority, registerTransportBodies } from '../../dist/transport/index.js';
import { decode } from '../../dist/index.js';
import { createFactStore } from '../../dist/facts/index.js';
const { value, refused } = fixtures;

export function joint() {
  const f = fixtures.effectFixture();
  const [host, spine, c] = bindings.get(f.transport);
  Object.assign(host, { accountingDurability: f.replicas.durability });
  const api = createTransportAuthority(host, spine, c, effects.consumeEffectSettlement);
  const request = f.prepare(); value(f.api.dispatch(request, f.fence));
  const reservation = value(api.inspect()).filter(v => v.record.type === 'AdmissionReservation').at(-1).record;
  let excluded = false, negative = false;
  const original = f.composition.assessment;
  // Still the real eight producer, with an explicitly test-only independent nine
  // assessor. The adapter supplies neither this verdict nor the quiescence proof.
  const view = (proof, input) => {
    let outcome = proof.outcome;
    if (negative) {
      const id = 'independent-non-occurrence';
      if (!f.evidence.some(e => e.id === id)) f.evidence.push(value(decode('Evidence', f.evidenceInput({ id,
        claim: { subject: input.reservation.operation, predicate: input.request.digest, value: 'did-not-happen' },
        strength: 'proof', freshFor: 100 }), f.ctx.decode)));
      outcome = value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: 'did-not-happen', evidence: [id] }, f.ctx.decode));
    }
    return Object.freeze({ ...proof, outcome, delayedExecutionExcluded: excluded });
  };
  const assessment = { ...original,
    read: (ref, input) => f.success(view(value(original.read(ref, input)), input)),
    consumeCurrent: (ref, input, consume) => original.consumeCurrent(ref, input, proof => consume(view(proof, input))),
  };
  const producer = effects.createEffectDoorway({ ...f.composition, assessment });
  const settlement = () => value(producer.settle(reservation.operation));
  const applications = () => value(api.inspect()).filter(v => v.record.type === 'SettlementApplication');
  const fresh = (charge = 20, overrides = {}) => api.reserve({ command: 'fresh', fence: f.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'fresh-request' }, attempt: 'fresh-attempt',
    payloadDigest: reservation.digest, charge, run: f.run, semanticMessage: 'fresh-semantic-key',
    durability: 'replicated', replicas: 1, ...overrides });
  return { f, host, spine, c, api, producer, reservation, settlement, applications, fresh,
    quiescent: () => { assert.equal(f.assessmentGuardActive(), false); excluded = true; },
    negative: () => { assert.equal(f.assessmentGuardActive(), false); negative = true; excluded = true; } };
}

export function integration() {
  const j = joint(), { f, api, reservation, settlement, applications, fresh } = j;
  const s1 = settlement();
  const counterfeit = (v, _boundary, consumer) => f.success(consumer(v));
  const bypass = createTransportAuthority(j.host, j.spine, j.c, counterfeit);
  refused(bypass.settle(f.fence, JSON.parse(JSON.stringify(s1))), 'fact-boundary registration');
  refused(registerTransportBodies(j.host, j.c, counterfeit), 'cannot be replaced');
  refused(api.settle(f.fence, JSON.parse(JSON.stringify(s1))), 'live eight-owned');
  for (const key of ['operation', 'reservation', 'claim', 'digest'])
    refused(api.settle(f.fence, { ...s1, [key]: 'changed' }), 'live eight-owned');
  refused(f.transport.settle(f.fence, s1), 'not installed');
  const first = value(api.settle(f.fence, s1));
  assert.equal(first.exposure, 20); assert.equal(first.released, 0);
  assert.deepEqual({ ...value(api.settle(f.fence, settlement())) }, { ...first });
  assert.equal(applications().length, 1);
  refused(bypass.settle(f.fence, s1), 'fact-boundary registration'); // Duplicate is not a bypass either.
  refused(fresh(), 'unresolved');
  f.assess('happened', 7);
  refused(api.settle(f.fence, s1), 'changed'); // Old authentic issuance also fails after reassessment.
  const s2 = settlement();
  assert.notEqual(s1.id, s2.id);
  const held = value(api.settle(f.fence, s2));
  assert.equal(held.exposure, 20); assert.equal(held.released, 0); // Possible delayed executor.
  refused(fresh(), 'unresolved');
  f.replicas.enable(false);
  refused(api.settle(f.fence, s2), 'demand unmet'); // Even a duplicate rechecks durability.
  f.replicas.enable(true);
  j.quiescent(); const s3 = settlement();
  let candidate;
  const capture = createTransportAuthority(j.host, { ...j.spine, append(r) {
    // Preparation, not the consequential decision: eight's non-waiting guard is
    // NOT held while six writes, so this storage wait cannot expire its evidence.
    assert.equal(f.assessmentGuardActive(), false);
    candidate = r; throw Error('injected pre-append failure');
  } }, j.c, effects.consumeEffectSettlement);
  refused(capture.settle(f.fence, s3), 'pre-append failure');
  for (const key of ['operation', 'request', 'reservation', 'claim', 'digest', 'settlementHash'])
    refused(j.spine.append({ ...candidate, [key]: 'changed' }, [candidate.predecessor, candidate.settlementFact]));
  refused(j.spine.append({ ...candidate, exposure: 0, released: 20 }, [candidate.predecessor, candidate.settlementFact]), 'accounting differs');
  refused(j.spine.append(candidate, [candidate.predecessor, candidate.settlementFact]), 'live eight settlement');
  const lostAck = createTransportAuthority(j.host, { ...j.spine, append(r, required) {
    assert.equal(f.assessmentGuardActive(), false);
    value(j.spine.append(r, required)); throw Error('injected lost acknowledgement');
  } }, j.c, effects.consumeEffectSettlement);
  refused(lostAck.settle(f.fence, s3), 'lost acknowledgement');
  const released = value(api.settle(f.fence, s3));
  assert.equal(released.exposure, 7); assert.equal(released.released, 13); assert.equal(released.unresolved, 0);
  assert.equal(applications().length, 3);
  assert.deepEqual({ ...value(api.settle(f.fence, settlement())) }, { ...released });
  assert.equal(applications().length, 3);
  refused(fresh(20, { request: { owner: 'part-eight', name: 'EffectRequest', id: reservation.request } }), 'unresolved');
  refused(fresh(20, { semanticMessage: reservation.semanticMessage }), 'unresolved');
  refused(api.claim('replay', f.fence, reservation.operation), 'already issued');
  refused(fresh(94), 'spend bound');
  const next = value(fresh(93));
  assert.equal(next.charge, 93); // Exactly 100 exposure, not 80 or 113.
  const originalReader = j.host.accountingDurability;
  let custodyReads = 0;
  Object.assign(j.host, { accountingDurability: { owner: 'part-ten', ensure(facts) {
    custodyReads++; assert.ok(custodyReads <= 4, 'projection recursively traversed custody');
    return originalReader.ensure(facts);
  } } });
  value(api.inspect()); value(api.inspect());
  const continued = value(api.claim('next-claim', f.fence, next.operation));
  value(api.consume(continued, f.fence)); value(api.inspect());
  assert.equal(custodyReads, 0); // Admission checked proof; reconstruction does not.
  assert.equal(f.calls(), 1);

  const cap = joint(); cap.f.assess('happened', 30); cap.quiescent();
  const violation = value(cap.api.settle(cap.f.fence, cap.settlement()));
  assert.equal(violation.exposure, 30); assert.equal(violation.capViolation, 1); assert.equal(violation.released, 0);
  assert.equal(violation.unresolved, 0); // Aggregate budget 100 is NOT exhausted.
  refused(cap.fresh(20), 'cap violation');
  refused(cap.fresh(0), 'cap violation');
  const reopened = createTransportAuthority(cap.host, { ...cap.spine, store: createFactStore(cap.f.ctx, cap.f.replicas.storage) }, cap.c, effects.consumeEffectSettlement);
  refused(reopened.reserve({ command: 'reopened-cap-bypass', fence: cap.f.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'fresh-after-cap-reopen' }, attempt: 'new-attempt',
    payloadDigest: cap.reservation.digest, charge: 20, run: cap.f.run, semanticMessage: 'fresh-after-cap-reopen',
    durability: 'local-durable', replicas: 0 }), 'cap violation');
  assert.equal(value(cap.api.settle(cap.f.fence, cap.settlement())).exposure, 30); // Accounting recovery remains available.
  cap.f.time(110);
  value(cap.api.recover('observe-cap-breach', cap.f.fence, cap.reservation.operation, cap.producer));
  assert.equal(cap.f.queries(), 1); assert.equal(cap.f.calls(), 1); // Observation, never dispatch.

  const unknown = joint(); unknown.f.assess('happened', null); unknown.quiescent();
  const unknownCharge = value(unknown.api.settle(unknown.f.fence, unknown.settlement()));
  assert.equal(unknownCharge.actualCharge, -1); assert.equal(unknownCharge.exposure, 20);
  refused(unknown.fresh(), 'unresolved');

  const no = joint(); no.f.assess('uncertain', 0); no.negative();
  const absent = value(no.api.settle(no.f.fence, no.settlement()));
  assert.equal(absent.released, 20); assert.equal(absent.retryEligible, 0);
  refused(no.fresh(20, { request: { owner: 'part-eight', name: 'EffectRequest', id: no.reservation.request } }), 'unresolved');
  return { effectCommit, applications: 3, exposure: released.exposure, released: released.released, calls: f.calls() };
}
if (process.argv[1]?.endsWith('/settlement-joint.mjs') && process.argv[2] === 'integration') console.log(JSON.stringify(integration()));
