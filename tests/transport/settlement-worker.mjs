import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { joint } from './settlement-joint.mjs';
import { effects, fixtures, bindings, replicaHost, captureHost, factFixtures } from './effect-pin.mjs';
import { decode } from '../../dist/index.js';
import { createFactStore } from '../../dist/facts/index.js';
import { createTransportAuthority, createTransportSpine, registerTransportBodies } from '../../dist/transport/index.js';
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
const { value, refused } = fixtures;
const [mode, seedPath, cut] = process.argv.slice(2);
if (mode === 'start') {
  const j = joint(), { f } = j;
  if (cut !== 'held') { f.assess('happened', 7); j.quiescent(); }
  const settlement = j.settlement();
  // Serializable fixture inputs for the fresh process. NOT authority issued to it.
  writeFileSync(seedPath, JSON.stringify({ directory: f.directory, settlement, captures: f.ctx.decode.captures,
    factCaptures: f.ctx.captures, evidence: f.evidence, cut }), { mode: 0o600 });
  const api = createTransportAuthority(j.host, { ...j.spine, append(r, required) {
    if (cut === 'local-only') f.replicas.enable(false);
    const receipt = value(j.spine.append(r, required));
    assert.equal(receipt.durability.kind, cut === 'local-only' ? 'local-durable' : 'replicated');
    writeSync(1, JSON.stringify({ ready: true, exposure: r.exposure }) + '\n');
    process.kill(process.pid, 'SIGSTOP'); // Killed before caller receives application ACK.
    throw Error('test must kill this worker');
  } }, j.c, effects.consumeEffectSettlement);
  value(api.settle(f.fence, settlement));
} else {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  // Real fixture public composition supplies deterministic signing/identity inputs;
  // the target store is independently reopened from disk, not copied RAM state.
  const f = fixtures.effectFixture();
  Object.assign(f.ctx.decode.captures, seed.captures);
  const custody = captureHost.createEffectFileCaptures([join(seed.directory, 'origin-captures'), join(seed.directory, 'peer-captures')], run => f.success(run()));
  for (const e of seed.evidence) if (!f.evidence.some(old => old.id === e.id)) f.evidence.push(value(decode('Evidence', e, f.ctx.decode)));
  const [oldHost, , c] = bindings.get(f.transport);
  const host = { ...oldHost, incarnation: 'replacement', authorityIncarnation: 'authority:replacement', monotonic: () => 110 };
  const ctx = { ...f.ctx, get captures() { return custody.captures; }, ownedBodies: [...value(registerTransportBodies(host, c, effects.consumeEffectSettlement)), ...value(effects.registerEffectBodies(f.host))] };
  const result = run => f.success(run());
  const peer = createFactStore(ctx, createTransportFileStorage(join(seed.directory, 'peer'), result));
  const replicas = replicaHost.createEffectReplicaStorage(join(seed.directory, 'origin'), { id: 'fixture-peer-directory', store: peer }, result);
  if (seed.cut === 'local-only') replicas.enable(false);
  Object.assign(host, { accountingDurability: replicas.durability });
  const store = createFactStore(ctx, replicas.storage);
  const spine = createTransportSpine(host, { context: ctx, privateKey: factFixtures.privateKey }, store);
  const api = createTransportAuthority(host, spine, c, effects.consumeEffectSettlement);
  const before = value(api.inspect());
  assert.equal(before.filter(v => v.record.type === 'SettlementApplication').length, 1);
  const fence = value(api.acquire('takeover', before.at(-1).fact.id, 500));
  if (seed.cut === 'local-only') {
    assert.equal(value(peer.read()).filter(f => f.kind === 'transport-SettlementApplication').length, 0);
    const old = before.filter(v => v.record.type === 'AdmissionReservation').at(-1).record;
    refused(api.reserve({ command: 'unsupported-release', fence, request: { owner: 'part-eight', name: 'EffectRequest', id: 'weaker-request' },
      attempt: 'weaker-attempt', payloadDigest: old.digest, charge: 93, run: f.run, semanticMessage: 'weaker-key', durability: 'local-durable', replicas: 0 }), 'accounting durability');
    replicas.enable(true); // Resume original proof; never dispatch again.
  }
  refused(api.settle(fence, seed.settlement), 'live eight-owned');
  const s = seed.settlement;
  // Explicit restart-only nine stand-in: its decoded view is immutable and has
  // no mutation path. The synchronous guard checks the exact operation binding;
  // neither serialized settlement JSON nor this fixture is production authority.
  const current = Object.freeze({ outcome: value(decode('Outcome', s.outcome, f.ctx.decode)), finalCharge: s.finalCharge,
    delayedExecutionExcluded: s.delayedExecutionExcluded, required: Object.freeze([s.acceptance]) });
  const readCurrent = (ref, input) => {
    assert.equal(ref.id, s.acceptance);
    assert.equal(input.request.id, s.request); assert.equal(input.request.digest, s.digest);
    assert.equal(input.reservation.operation, s.operation); assert.equal(input.claim, s.claim);
    return current;
  };
  const assessment = { owner: 'part-nine',
    assess: () => f.success({ owner: 'part-nine', name: 'VerificationAssessment', id: s.acceptance }),
    read: (ref, input) => f.success(readCurrent(ref, input)),
    consumeCurrent: (ref, input, consume) => f.success(consume(readCurrent(ref, input))) };
  const producer = effects.createEffectDoorway({ ...f.composition, transport: api, durability: replicas.durability, custody: custody.custody, assessment,
    spine: effects.createEffectSpine(f.host, { context: ctx, privateKey: factFixtures.privateKey }, store) });
  const issued = value(producer.settle(s.operation));
  const application = value(api.settle(fence, issued));
  assert.equal(value(api.inspect()).filter(v => v.record.type === 'SettlementApplication').length, 1);
  const old = before.filter(v => v.record.type === 'AdmissionReservation').at(-1).record;
  refused(api.claim('repeat', fence, old.operation), 'already issued');
  const request = charge => api.reserve({ command: 'next', fence, request: { owner: 'part-eight', name: 'EffectRequest', id: 'new-request' },
    attempt: 'new-attempt', payloadDigest: old.digest, charge, run: f.run, semanticMessage: 'new-key', durability: 'replicated', replicas: 1 });
  if (seed.cut === 'held') { assert.equal(application.exposure, 20); refused(request(1), 'unresolved'); }
  else { assert.equal(application.exposure, 7); refused(request(94), 'spend bound'); value(request(93)); }
  console.log(JSON.stringify({ applications: 1, exposure: application.exposure, released: application.released, calls: f.calls() }));
}
