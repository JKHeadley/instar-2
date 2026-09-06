import assert from 'node:assert/strict';
import { joint } from './settlement-joint.mjs';
import { effects, fixtures, factFixtures } from './effect-pin.mjs';
import { createFactStore } from '../../dist/facts/index.js';
import { createTransportAuthority, createTransportSpine } from '../../dist/transport/index.js';
const { value, refused } = fixtures;

// Reproduces `.instar/lanes/slice-six-gap.md` through six's PUBLIC authority:
// (a) an authentic eight settlement resolves ONE operation; (b) a resolved
// operation stops blocking its run while an unresolved one keeps blocking; and
// (c) a prepared operation whose fence is gone is closed on proof that no
// dispatch-claim exists, releasing its credit instead of wedging the run.
export function conditionalClose() {
  const j = joint(), { f, api, reservation } = j;
  const other = (charge, id, overrides = {}) => j.fresh(charge, { command: id, attempt: `${id}-attempt`,
    request: { owner: 'part-eight', name: 'EffectRequest', id: `${id}-request` }, semanticMessage: `${id}-semantic`, ...overrides });

  // (b) negative half: an UNRESOLVED first operation blocks its run, as today.
  refused(other(50, 'second'), 'unresolved');
  f.assess('happened', 7); j.quiescent();
  const applied = value(api.settle(f.fence, j.settlement()));
  assert.equal(applied.exposure, 7); assert.equal(applied.released, 13); assert.equal(applied.unresolved, 0); // (a)

  // (b) positive half: the same run reserves again once that operation resolved.
  const second = value(other(50, 'second'));
  assert.equal(second.state, 'prepared'); assert.equal(second.executor, '');
  refused(other(44, 'third'), 'unresolved'); // 7 + 50 + 44 is inside budget 100.

  // (c) The reserving fence is gone: a replacement holds a new committed epoch.
  value(api.release('release-for-takeover', f.fence));
  const head = value(api.inspect()).at(-1).fact.id;
  const takeover = value(api.acquire('takeover', head, 500));
  assert.notEqual(takeover.epoch, f.fence.epoch);
  refused(api.claim('claim-after-takeover', takeover, second.operation), 'stale fence at durable boundary');
  refused(other(44, 'third', { fence: takeover }), 'unresolved'); // The run is wedged.
  refused(api.close('close-under-dead-fence', f.fence, second.operation), 'stale or uncommitted fence');
  refused(api.close('close-unknown', takeover, 'operation:absent'), 'prepared, never-claimed');
  refused(api.close('close-dispatched', takeover, reservation.operation), 'prepared, never-claimed');

  const closed = value(api.close('close-stranded', takeover, second.operation));
  assert.equal(closed.state, 'closed'); assert.equal(closed.executor, ''); assert.equal(closed.charge, 50);
  assert.equal(closed.operation, second.operation); assert.equal(closed.digest, second.digest);

  // The credit is genuinely released: 7 + 0 + 93 is exactly the domain budget.
  refused(other(94, 'third', { fence: takeover }), 'spend bound');
  const third = value(other(93, 'third', { fence: takeover }));
  assert.equal(third.charge, 93);
  // A close is terminal, is not a settlement, and never reopens dispatch.
  refused(api.claim('claim-after-close', takeover, second.operation), 'already issued or reservation absent');
  refused(api.close('close-twice', takeover, second.operation), 'prepared, never-claimed');
  // A closed operation still blocks a NEW attempt of the same request or message.
  refused(other(1, 'same-request', { fence: takeover, request: { owner: 'part-eight', name: 'EffectRequest', id: second.request } }), 'unresolved');
  refused(other(1, 'same-message', { fence: takeover, semanticMessage: second.semanticMessage }), 'unresolved');

  // Raw P2 authoring cannot close a dispatched operation either: the owner
  // validator, not only the authority method, demands the absent-claim proof.
  const rows = value(api.inspect());
  const dispatched = rows.filter(v => v.record.type === 'AdmissionReservation' && v.record.operation === reservation.operation).at(-1).record;
  refused(j.spine.append({ ...dispatched, command: 'raw-close-dispatched', predecessor: rows.at(-1).fact.id,
    tick: dispatched.tick, state: 'closed', executor: '' }, [rows.at(-1).fact.id]), 'no dispatch-claim exists');

  // The closed state is rebuilt from disk by the real validator, not held in RAM.
  const store = createFactStore(f.ctx, f.replicas.storage);
  const spine = createTransportSpine(j.host, { context: f.ctx, privateKey: factFixtures.privateKey }, store);
  const reopened = createTransportAuthority(j.host, spine, j.c, effects.consumeEffectSettlement);
  const after = value(reopened.inspect()).filter(v => v.record.type === 'AdmissionReservation' && v.record.operation === second.operation).at(-1).record;
  assert.equal(after.state, 'closed');
  refused(reopened.close('close-after-reopen', takeover, second.operation), 'prepared, never-claimed');
  refused(reopened.claim('claim-after-reopen', takeover, second.operation), 'already issued or reservation absent');

  assert.equal(f.calls(), 1); // One external send in the whole sequence.
  return { closed: closed.state, released: closed.charge, reserved: third.charge, applications: j.applications().length, calls: f.calls() };
}
if (process.argv[1]?.endsWith('/settlement-close.mjs')) console.log(JSON.stringify(conditionalClose()));
