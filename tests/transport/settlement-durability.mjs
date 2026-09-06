import assert from 'node:assert/strict';
import { joint } from './settlement-joint.mjs';
import { effects, fixtures, factFixtures } from './effect-pin.mjs';
import { canonical } from '../../dist/index.js';
import { createFactStore } from '../../dist/facts/index.js';
import { createTransportAuthority, createTransportSpine } from '../../dist/transport/index.js';
const { value, refused } = fixtures;
const hash = input => value(canonical(input)).hash;

export function durabilityCut() {
  const j = joint(), { f } = j;
  f.assess('happened', 7); j.quiescent();
  const settlement = j.settlement();
  const dropping = createTransportAuthority(j.host, { ...j.spine, append(r, required) {
    // Eight has completed all its evidence durability/custody rechecks. Lose
    // the real peer ONLY at six's subsequent accounting append.
    assert.equal(f.assessmentGuardActive(), true);
    assert.equal(r.type, 'SettlementApplication'); f.replicas.enable(false);
    const receipt = j.spine.append(r, required);
    assert.equal(value(receipt).durability.kind, 'local-durable');
    return receipt;
  } }, j.c, effects.consumeEffectSettlement);
  refused(dropping.settle(f.fence, settlement), 'original accounting durability demand unmet');
  assert.equal(j.applications().length, 1);
  assert.equal(value(f.peer.read()).filter(v => v.kind === 'transport-SettlementApplication').length, 0);

  // Reopen the real origin journal through new P2 and six instances. No fresh
  // settlement consumption is needed to expose the old bug's unsupported spend.
  const store = createFactStore(f.ctx, f.replicas.storage);
  const spine = createTransportSpine(j.host, { context: f.ctx, privateKey: factFixtures.privateKey }, store);
  const restored = createTransportAuthority(j.host, spine, j.c, effects.consumeEffectSettlement);
  const fresh = (charge, overrides = {}) => restored.reserve({ command: 'fresh-after-local-accounting', fence: f.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'weaker-new-operation' }, attempt: 'fresh-attempt',
    payloadDigest: j.reservation.digest, charge, run: f.run, semanticMessage: 'fresh-semantic',
    durability: 'local-durable', replicas: 0, ...overrides });
  refused(fresh(93), 'accounting durability');
  refused(fresh(0), 'accounting durability');
  assert.equal(value(restored.inspect()).filter(v => v.record.type === 'AdmissionReservation' && v.record.state === 'prepared').length, 1);

  // Bypassing six's command API still meets the owner validator inside P2.
  const operation = `operation:${hash([j.host.domain, 'raw-new-request', 'raw-attempt'])}`;
  const raw = { ...j.reservation, command: 'raw-new-admission', predecessor: value(restored.inspect()).at(-1).fact.id,
    operation, request: 'raw-new-request', attempt: 'raw-attempt', semanticMessage: 'raw-new-semantic',
    deliveryAttempt: `delivery:${hash([operation, 'raw-new-semantic'])}`, state: 'prepared', executor: '',
    charge: 93, durability: 'local-durable', replicas: 0 };
  refused(spine.append(raw, [raw.predecessor]), 'accounting durability');

  // A duplicate must check the ACCOUNTING row too, even when eight just proved
  // its own settlement. Withdraw at the distinct six proof boundary.
  f.replicas.enable(true);
  const original = j.host.accountingDurability;
  Object.assign(j.host, { accountingDurability: { owner: 'part-ten', ensure(facts) {
    assert.equal(facts[0].kind, 'transport-SettlementApplication');
    f.replicas.enable(false); return original.ensure(facts);
  } } });
  refused(restored.settle(f.fence, j.settlement()), 'original accounting durability demand unmet');
  assert.equal(j.applications().length, 1);
  Object.assign(j.host, { accountingDurability: original }); f.replicas.enable(true);
  const accepted = value(restored.settle(f.fence, j.settlement()));
  assert.equal(accepted.exposure, 7); assert.equal(accepted.released, 13);
  assert.equal(j.applications().length, 1);
  assert.equal(value(f.peer.read()).filter(v => v.kind === 'transport-SettlementApplication').length, 1);
  refused(fresh(94), 'spend bound'); assert.equal(value(fresh(93)).charge, 93);
  assert.equal(f.calls(), 1);
  return { applications: 1, exposure: 7, released: 13, calls: 1 };
}
if (process.argv[2] === 'integration') console.log(JSON.stringify(durabilityCut()));
