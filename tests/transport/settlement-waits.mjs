import assert from 'node:assert/strict';
import { joint } from './settlement-joint.mjs';
import { effects, fixtures, factFixtures } from './effect-pin.mjs';
import { createFactStore } from '../../dist/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies } from '../../dist/transport/index.js';
const { value, refused } = fixtures;
const [phase, clock] = process.argv.slice(2);
const at = Number(clock), j = joint(), { f } = j;
f.assess('happened', 7); j.quiescent();
const settlement = j.settlement();
if (phase === 'duplicate') assert.equal(value(j.api.settle(f.fence, settlement)).released, 13);
// A refusal boundary would swallow a thrown assertion and report only a missing
// count, so record every guarded-wait violation and check the list at the end.
const guarded = [];
const outside = site => { if (f.assessmentGuardActive()) guarded.push(site); };
let reads = 0, writes = 0, decisions = 0;
const originalCurrent = j.host.current, originalProof = j.host.accountingDurability;
Object.assign(j.host, {
  current() { if (f.assessmentGuardActive()) decisions++; return originalCurrent(); },
  accountingDurability: { owner: 'part-ten', ensure(facts) {
    outside('accounting custody proof'); reads++;
    const proof = originalProof.ensure(facts);
    if (phase === 'duplicate') f.time(at); // Advance at the real accounting proof's return.
    return proof;
  } },
});
const store = Object.fromEntries(Object.entries(j.spine.store).map(([name, method]) => [name, (...args) => {
  outside(`P2 ${name}`);
  return method(...args);
}]));
const spine = { store, append(record, required) {
  outside('accounting append'); writes++;
  const receipt = j.spine.append(record, required);
  if (phase === 'first') f.time(at); // Evidence expires AFTER the actual durable append.
  return receipt;
} };
const api = createTransportAuthority(j.host, spine, j.c, effects.consumeEffectSettlement);
const result = api.settle(f.fence, settlement);
// The counterexample: with consequential accounting inside eight's guard these
// sites run while it is held, and an expiry during the wait still releases credit.
assert.deepEqual(guarded, [], `six waited inside the current-assessment guard: ${guarded.join(', ')}`);
assert.equal(writes, phase === 'first' ? 1 : 0);
assert.equal(reads, phase === 'duplicate' ? 1 : 0);
assert.equal(j.applications().length, 1);
if (at <= 200) {
  assert.equal(value(result).released, 13);
  assert.ok(decisions > 0); // The final decision itself DID run inside the guard.
  refused(j.fresh(94), 'spend bound'); value(j.fresh(93)); value(api.inspect());
} else {
  refused(result, 'expired'); assert.equal(decisions, 0);
  refused(j.fresh(93), 'unresolved'); refused(j.fresh(0), 'unresolved');
  // A new host/owner registration and real reopened P2 store have no live
  // qualification. A durable prepared row cannot reconstruct that authority.
  const host = { ...j.host };
  const ctx = { ...f.ctx, ownedBodies: [...f.ctx.ownedBodies.filter(r => r.owner !== 'part-six'),
    ...value(registerTransportBodies(host, j.c, effects.consumeEffectSettlement))] };
  const reopened = createFactStore(ctx, f.replicas.storage);
  const next = createTransportAuthority(host, createTransportSpine(host, { context: ctx, privateKey: factFixtures.privateKey }, reopened), j.c, effects.consumeEffectSettlement);
  value(next.inspect());
  refused(next.reserve({ command: 'reopened-preparation-bypass', fence: f.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'new-after-failed-finalization' }, attempt: 'fresh-attempt',
    payloadDigest: j.reservation.digest, charge: 93, run: f.run, semanticMessage: 'new-semantic', durability: 'local-durable', replicas: 0 }), 'unresolved');
}
assert.equal(f.calls(), 1);
console.log(JSON.stringify({ phase, at, finalized: at <= 200, applications: 1, calls: 1 }));
