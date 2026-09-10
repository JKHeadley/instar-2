import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { typedEffectFixture, value } from './typed-effect-fixture.js';
import { payloadInput } from './payload-fixtures.js';
import { consumeEffectSettlement, createEffectDoorway, decodeEffectPayload,
  effectOperationContracts, registerEffectBodies } from '../../src/effects/index.js';
import { createFactStore, decodeHistoricalBody } from '../../src/facts/index.js';
import type { CapturedContent } from '../../src/facts/index.js';
import type { ConversationEffectKind } from '../../src/effects/index.js';
import { registerTransportBodies } from '../../src/transport/index.js';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

const mode = process.argv.at(-3)!, directory = process.argv.at(-2)!, kind = process.argv.at(-1)! as ConversationEffectKind;
const contract = effectOperationContracts[kind];
if (!contract) throw new Error('typed payload kind required');
const effect = typedEffectFixture(mode === 'start' ? directory : `${directory}-reader-seed`, 'executor:1', {
  payloadKind: kind, inputSchema: contract.inputSchema, canonicalization: contract.canonicalization,
  observationCapabilities: contract.observations,
}, [kind]);

if (mode === 'start') {
  const adapter = { ...effect.composition.adapter, invokePayload: (input: Parameters<NonNullable<typeof effect.composition.adapter.invokePayload>>[0]) => {
    appendFileSync(join(directory, 'calls.jsonl'), `${JSON.stringify({ operation: input.operation, digest: input.digest })}\n`);
    const result = effect.composition.adapter.invokePayload!(input);
    writeFileSync(join(directory, 'ready.json'), JSON.stringify({ ready: true, kind }));
    process.kill(process.pid, 'SIGSTOP');
    return result;
  } };
  const api = createEffectDoorway({ ...effect.composition, adapter });
  const payload = value(decodeEffectPayload(payloadInput(kind, effect.host), effect.host));
  const request = value(api.preparePayload({ definition: effect.d.id, payload, run: effect.run, pending: payload.sourceResult,
    attempt: 'attempt:1', verificationOwner: 'verifier:1', obligation: effect.obligation, closure: [], fence: effect.fence }));
  value(api.dispatch(request, effect.fence));
  throw new Error('restart cut not reached');
}

const custody = createEffectFileCaptures([join(directory, 'origin-captures'), join(directory, 'peer-captures')], effect.success);
let store: ReturnType<typeof createFactStore>;
const host = { ...effect.host, incarnation: 'executor:2', capture: custody.capture,
  referenceFacts: () => store.readForProjection(), current: () => {
    const current = effect.host.current();
    return { ...current, decode: { ...current.decode, captures: { ...current.decode.captures,
      ...Object.fromEntries(Object.entries(custody.captures as Record<string, CapturedContent>).flatMap(([reference, captured]) =>
        captured.status === 'available' && captured.bytes !== null ? [[reference, captured.bytes]] : [])) } } };
  } };
const transportHost = { ...effect.transportHost, incarnation: 'executor:2' };
const context = { ...effect.ctx, get captures() { return custody.captures; }, ownedBodies: [
  ...(effect.ctx.ownedBodies ?? []).filter(registration => !['part-eight', 'part-six'].includes(registration.owner)),
  ...value(registerEffectBodies(host)),
  ...value(registerTransportBodies(transportHost, effect.host.boundary, consumeEffectSettlement)),
] };
store = createFactStore(context, createTransportFileStorage(join(directory, 'origin'), effect.success));
const facts = value(store.read());
const payloadFact = facts.find(fact => fact.kind === 'effect-EffectPayload');
if (!payloadFact) throw new Error('durable typed payload missing after restart');
const historical = value(decodeHistoricalBody(payloadFact, { ...context, facts }, context.decode));
const calls = existsSync(join(directory, 'calls.jsonl'))
  ? readFileSync(join(directory, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).length : 0;
const types = facts.filter(fact => fact.kind.startsWith('effect-'))
  .map(fact => (fact.body as { record?: { type?: string } }).record?.type).filter(Boolean);
console.log(JSON.stringify({ kind, calls, newCalls: effect.calls(), recovered: types.includes('EffectRequest'),
  taints: historical.taint, types }));
process.exit(0);
