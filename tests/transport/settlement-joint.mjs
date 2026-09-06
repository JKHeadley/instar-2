import assert from 'node:assert/strict';
import { effects, fixtures, bindings, effectCommit } from './effect-pin.mjs';
import { createTransportAuthority } from '../../dist/transport/index.js';
import { decode } from '../../dist/index.js';
const { value, refused } = fixtures;

export function joint() {
  const f = fixtures.effectFixture();
  const [host, spine, c] = bindings.get(f.transport);
  const api = createTransportAuthority(host, spine, c, effects.consumeEffectSettlement);
  const request = f.prepare(); value(f.api.dispatch(request, f.fence));
  const reservation = value(api.inspect()).filter(v => v.record.type === 'AdmissionReservation').at(-1).record;
  let excluded = false, negative = false;
  const original = f.composition.assessment;
  // Still the real eight producer, with an explicitly test-only independent nine
  // assessor. The adapter supplies neither this verdict nor the quiescence proof.
  const assessment = { ...original, read(ref, input) {
    const proof = value(original.read(ref, input));
    let outcome = proof.outcome;
    if (negative) {
      const id = 'independent-non-occurrence';
      if (!f.evidence.some(e => e.id === id)) f.evidence.push(value(decode('Evidence', f.evidenceInput({ id,
        claim: { subject: input.reservation.operation, predicate: input.request.digest, value: 'did-not-happen' },
        strength: 'proof', freshFor: 100 }), f.ctx.decode)));
      outcome = value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: 'did-not-happen', evidence: [id] }, f.ctx.decode));
    }
    return f.success({ ...proof, outcome, delayedExecutionExcluded: excluded });
  } };
  const producer = effects.createEffectDoorway({ ...f.composition, assessment });
  const settlement = () => value(producer.settle(reservation.operation));
  const applications = () => value(api.inspect()).filter(v => v.record.type === 'SettlementApplication');
  const fresh = (charge = 20, overrides = {}) => api.reserve({ command: 'fresh', fence: f.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'fresh-request' }, attempt: 'fresh-attempt',
    payloadDigest: reservation.digest, charge, run: f.run, semanticMessage: 'fresh-semantic-key',
    durability: 'replicated', replicas: 1, ...overrides });
  return { f, host, spine, c, api, producer, reservation, settlement, applications, fresh,
    quiescent: () => { excluded = true; }, negative: () => { negative = true; excluded = true; } };
}

export function integration() {
  const j = joint(), { f, api, reservation, settlement, applications, fresh } = j;
  const s1 = settlement();
  refused(api.settle(f.fence, JSON.parse(JSON.stringify(s1))), 'live eight-owned');
  for (const key of ['operation', 'reservation', 'claim', 'digest'])
    refused(api.settle(f.fence, { ...s1, [key]: 'changed' }), 'live eight-owned');
  refused(f.transport.settle(f.fence, s1), 'not installed');
  const first = value(api.settle(f.fence, s1));
  assert.equal(first.exposure, 20); assert.equal(first.released, 0);
  assert.deepEqual({ ...value(api.settle(f.fence, settlement())) }, { ...first });
  assert.equal(applications().length, 1);
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
    candidate = r; throw Error('injected pre-append failure');
  } }, j.c, effects.consumeEffectSettlement);
  refused(capture.settle(f.fence, s3), 'pre-append failure');
  for (const key of ['operation', 'request', 'reservation', 'claim', 'digest', 'settlementHash'])
    refused(j.spine.append({ ...candidate, [key]: 'changed' }, [candidate.predecessor, candidate.settlementFact]));
  refused(j.spine.append({ ...candidate, exposure: 0, released: 20 }, [candidate.predecessor, candidate.settlementFact]), 'accounting differs');
  refused(j.spine.append(candidate, [candidate.predecessor, candidate.settlementFact]), 'live eight settlement');
  const lostAck = createTransportAuthority(j.host, { ...j.spine, append(r, required) {
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
  assert.equal(value(fresh(93)).charge, 93); // Exactly 100 exposure, not 80 or 113.
  assert.equal(f.calls(), 1);

  const cap = joint(); cap.f.assess('happened', 120); cap.quiescent();
  const violation = value(cap.api.settle(cap.f.fence, cap.settlement()));
  assert.equal(violation.exposure, 120); assert.equal(violation.capViolation, 1); assert.equal(violation.released, 0);
  refused(cap.fresh(0), 'spend bound');

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
if (process.argv[2] === 'integration') console.log(JSON.stringify(integration()));
