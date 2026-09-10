import { readFileSync } from 'node:fs';
import { consumeResult, decode, decodeMeasurement } from '../../dist/index.js';
import { createFactStore } from '../../dist/facts/index.js';
import { createRunClosureGraph, runClosureFactSchemas, runFactSchemas } from '../../dist/rungraph/index.js';
import { governanceFixture } from './rungraph-closure-fixture-loader.mjs';

const seed = JSON.parse(readFileSync(0, 'utf8'));
const take = result => consumeResult(result, { Success: value => value, Refused: refusal => { throw new Error(refusal.detail); } });
const result = value => take(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value, capacity: { kind: 'none' } }, types));
const types = seed.context.decode;
const now = take(decodeMeasurement('clock', seed.context.genesis.clock, types));
const base = { ...seed.context, genesis: { ...seed.context.genesis, clock: now },
  schemas: seed.context.schemas.map(schema => ({ ...schema, scope: take(decode('Scope', schema.scope, types)) })) };
let decodeContext = { site: base.site, preserved: base.preserved, register: types.register, types, facts: base,
  stimulusKinds: seed.stimulusKinds ?? ['stimulus'], evidenceSources: { settlement: 'probe', exit: 'probe' } };
const owned = take(runFactSchemas(decodeContext));
const closureOwned = take(runClosureFactSchemas(decodeContext));
const context = { ...base, ownedBodies: [...owned.registrations, ...closureOwned.registrations] };
decodeContext = { ...decodeContext, facts: context };
const unavailable = () => { throw new Error('cold observer attempted a write'); };
const store = createFactStore(context, { owner: 'part-ten',
  read: () => readFileSync(seed.spine, 'utf8').split('\n').filter(Boolean).map(JSON.parse), append: unavailable });
const graph = take(createRunClosureGraph({ governance: governanceFixture(decodeContext), context: decodeContext, store,
  generation: () => seed.generation, clock: () => now, groundingPolicy: seed.policy,
  writer: { owner: 'part-ten', append: unavailable },
  admission: { owner: 'part-six', execution: () => result(seed.execution), reservation: () => result(seed.opening),
    create: unavailable, commit: unavailable, verify: reference => {
      if (!seed.admissions.includes(reference.id)) throw new Error('missing owner witness');
      return result(reference);
    } },
  grounding: { owner: 'part-ten', read: unavailable }, settlement: { owner: 'part-eight', read: reference => seed.settlement
    ? result({ record: reference, outcome: seed.settlement.outcome, claimClosed: seed.settlement.claimClosed,
    chargeSettled: seed.settlement.chargeSettled }) : unavailable() },
  control: { owner: 'part-four', verify: () => result(seed.control.standing ?? seed.control) },
  exitCheck: { owner: 'part-nine', verify: exit => result(exit.check) },
  continuitySend: { owner: 'part-eight', verify: send => {
    if (!seed.sendWitnesses?.includes(send.id)) throw new Error('missing send owner witness');
    return result(send);
  } },
}));
const view = consumeResult(graph.read(seed.id), { Success: value => ({ kind: 'accepted', state: value.state, blockedOn: value.blockedOn }),
  Refused: refusal => ({ kind: 'refused', detail: refusal.detail }) });
const continuity = seed.accounting ? consumeResult(graph.recordContinuity(seed.accounting, seed.lease), {
  Success: value => ({ kind: 'accepted', id: value.id }), Refused: refusal => ({ kind: 'refused', detail: refusal.detail }),
}) : undefined;
const exhaustion = seed.exhaustion ? consumeResult(graph.recordExhaustion(seed.exhaustion, seed.lease), {
  Success: value => ({ kind: 'accepted', id: value.id }), Refused: refusal => ({ kind: 'refused', detail: refusal.detail }),
}) : undefined;
const transition = seed.transition ? consumeResult(graph.transition(seed.transition), {
  Success: value => ({ kind: 'accepted', state: value.state }), Refused: refusal => ({ kind: 'refused', detail: refusal.detail }),
}) : undefined;
const unreachable = seed.unreachable ? consumeResult(graph.recordUnreachableExit(seed.unreachable, seed.lease), {
  Success: value => ({ kind: 'accepted', id: value.id }), Refused: refusal => ({ kind: 'refused', detail: refusal.detail }),
}) : undefined;
const send = seed.send ? consumeResult(graph.verifyContinuitySend(seed.verifyAccounting, seed.send), {
  Success: value => ({ kind: 'accepted', value }), Refused: refusal => ({ kind: 'refused', detail: refusal.detail }),
}) : undefined;
process.stdout.write(JSON.stringify({ view, continuity, exhaustion, transition, unreachable, send }));
