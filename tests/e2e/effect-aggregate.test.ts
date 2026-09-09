import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts, effectPayloadIdentity, referencedPayloadFacts } from '../../src/effects/index.js';
import type { EffectRequest, TypedEffectPayload } from '../../src/effects/index.js';
import { digest } from '../fixtures.js';
import { effectFixture, refused, value } from '../effects/fixture.js';
import { typedEffectFixture } from '../effects/typed-effect-fixture.js';
import { payloadInput } from '../effects/payload-fixtures.js';
import { privateKey } from '../facts/fixtures.js';

function setup() {
  const contract = effectOperationContracts['post-text'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'post-text', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['post-text']);
  const makePayload = (logicalEffect: string, text: string): { payload: TypedEffectPayload; source: ReturnType<typeof f.sourceFor>['source'] } => {
    const step = `step:${logicalEffect}`, source = f.sourceFor(step, logicalEffect).source;
    const raw = { ...payloadInput('post-text', f.host), sourceResult: source.id, step, logicalEffect, text };
    const draft = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
    return { source, payload: value(decodeEffectPayload({ ...draft,
      ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, f.host)) };
  };
  const { payload: firstPayload, source: firstSource } = makePayload('logical:aggregate:first', 'first child');
  const first = value(f.api.preparePayload({ definition: f.d.id, payload: firstPayload, run: f.run,
    pending: firstSource.id, attempt: 'attempt:1', verificationOwner: 'reply-verifier',
    obligation: f.obligation, closure: [], fence: f.fence }));
  const { payload: secondPayload } = makePayload('logical:aggregate:second', 'second child');
  const payloadReceipt = value(f.spine.append(secondPayload, referencedPayloadFacts(secondPayload, f.host)));
  const firstPayloadFact = value(f.api.inspect()).find(row => row.record.type === 'EffectPayload' && row.record.id === firstPayload.id)!.fact.id;
  const closure = [...new Set([...first.closure.filter(id => id !== firstPayloadFact), payloadReceipt.fact.id,
    ...referencedPayloadFacts(secondPayload, f.host)])];
  const requestId = `request:${digest(['effect-payload', secondPayload.logicalEffect, secondPayload.semanticMessage, secondPayload.id])}`;
  const binding = { ...first.binding!, sourceVector: digest([...closure].sort()), payload: { id: secondPayload.id, digest: digest(secondPayload) },
    target: secondPayload.targetDigest, logicalEffect: secondPayload.logicalEffect, step: secondPayload.step,
    reservation: { ...first.binding!.reservation, request: requestId, attempt: 'attempt:2',
      semanticMessage: `effect-child:${digest([secondPayload.semanticMessage, secondPayload.logicalEffect])}` },
    claim: { ...first.binding!.claim, attempt: 'attempt:2' } };
  const second = { ...first, id: requestId, message: secondPayload.id, payload: secondPayload.id, payloadDigest: digest(secondPayload), pending: secondPayload.sourceResult,
    binding, attempt: 'attempt:2', digest: digest(binding), closure } as unknown as EffectRequest;
  value(f.spine.append(second, closure));
  const aggregate = value(f.api.createAggregate({ semanticMessage: first.semanticMessage, run: f.run,
    children: [
      { request: first, demandedStage: 'complete', inhibitLater: true, required: true },
      { request: second, demandedStage: 'complete', inhibitLater: true, required: true },
    ], reconciliationOwner: 'reconciler:aggregate' }));
  return { f, first, second, aggregate };
}

for (const cut of ['record', 'claim', 'settle'] as const) it(`P8-TP-AGGREGATE-RESTART durable ${cut} boundary restores ordered state without replay`, () => {
  const { f, first, second, aggregate } = setup();
  let doorway = cut === 'record' ? createEffectDoorway(f.composition) : f.api;
  expect(value(doorway.nextAggregateChild(aggregate.aggregate))?.id).toBe(first.id);
  const observation = value(doorway.dispatch(first, f.fence));
  if (cut === 'claim') doorway = createEffectDoorway(f.composition);
  f.assess('happened', 3, true);
  const settlement = value(doorway.settle(observation.operation));
  if (cut === 'settle') doorway = createEffectDoorway(f.composition);
  const partial = value(doorway.updateAggregate({ aggregate: aggregate.aggregate, request: first.id, settlement }));
  expect(partial.state).toBe('partial'); expect(value(doorway.nextAggregateChild(aggregate.aggregate))?.id).toBe(second.id);
  refused(doorway.updateAggregate({ aggregate: aggregate.aggregate, request: first.id, settlement }), 'replay forbidden');
  expect(f.calls()).toBe(1);
  expect(value(f.store.read()).at(-1)?.id).toBe(value(f.peer.read()).at(-1)?.id);
}, 30000);

for (const cut of ['record', 'claim', 'settle'] as const) it(`P8-TP-AGGREGATE-SIGKILL ${cut} cut reconstructs the durable aggregate in a fresh process`, async () => {
  const f = effectFixture();
  const rawProvenance = (p: typeof f.bob.provenance) => f.proof(p.authenticated.payload as object,
    p.authenticated.principal as { id: string; kind: string }, p.authenticated.recordType).input;
  const seed = { register: f.ctx.decode.register, captures: f.captures, preserved: f.c.preserved,
    principals: f.principals.map(p => ({ ...p, provenance: rawProvenance(p.provenance) })),
    grants: f.grants.map(g => ({ ...g, source: rawProvenance(g.source) })),
    authorizations: f.authorizations.map(a => ({ ...a, explicitYes: rawProvenance(a.explicitYes) })),
    versions: f.host.current().versions.map(v => ({ ...v, approvedIn: v.approvedIn.id })),
    clock: f.now, speaker: f.bob.id, scope: f.scope, machine: 'machine-a', site: f.c.site, keys: f.ctx.keys,
    genesis: f.ctx.genesis, privateKey, noteSchema: f.schema, pendingId: f.pending.id,
    definition: f.definition, message: f.message };
  const seedPath = join(f.directory, 'aggregate-seed.json'); writeFileSync(seedPath, JSON.stringify(seed), { mode: 0o600 });
  const directory = join(f.directory, 'aggregate-child');
  const args = [resolve('tests/effects/effect-aggregate-worker.mjs'), seedPath, directory];
  const child = spawn(process.execPath, [...args, 'start', cut], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; child.stderr.on('data', bytes => { stderr += String(bytes); });
  try {
    const ready = await new Promise<{ ready: boolean; operation: string; aggregate: string }>((resolveReady, reject) => {
      let output = ''; child.stdout.on('data', bytes => { output += String(bytes); if (output.includes('\n')) resolveReady(JSON.parse(output.trim())); });
      child.once('exit', code => reject(new Error(`aggregate child exited ${code}: ${stderr}`)));
    });
    expect(ready.ready).toBe(true);
    const exit = new Promise(resolveExit => child.once('exit', resolveExit)); child.kill('SIGKILL'); await exit;
    const resumed = spawnSync(process.execPath, [...args, 'recover', cut], { encoding: 'utf8', timeout: 30000 });
    expect(resumed.status, resumed.stderr).toBe(0);
    expect(JSON.parse(resumed.stdout)).toMatchObject({ operation: ready.operation, aggregate: ready.aggregate,
      state: cut === 'record' ? 'refused' : cut === 'settle' ? 'uncertain' : 'partial', replayRefused: true });
    const service = join(directory, 'aggregate-service.jsonl');
    expect(existsSync(service) ? readFileSync(service, 'utf8').trim().split('\n').length : 0).toBe(cut === 'record' ? 0 : 1);
    expect(readFileSync(join(directory, 'origin', 'facts.json'), 'utf8')).toBe(readFileSync(join(directory, 'peer', 'facts.json'), 'utf8'));
  } finally { child.kill('SIGKILL'); }
}, 30000);

it('P8-TP-AGGREGATE-PARTIAL an uncertain first child exposes evidence/charge/recovery and inhibits every later child', () => {
  const { f, first, second, aggregate } = setup(); f.onInvoke(() => { throw new Error('applied but receipt lost'); });
  const observation = value(f.api.dispatch(first, f.fence));
  const settlement = value(f.api.settle(observation.operation));
  const uncertain = value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: first.id, settlement }));
  expect(uncertain.state).toBe('uncertain'); expect(uncertain.openEvidence).toEqual([first.id, second.id]);
  expect(uncertain.openCharge).toEqual([first.id, second.id]); expect(uncertain.openRecovery).toContain(first.id);
  expect(value(f.api.nextAggregateChild(aggregate.aggregate))).toBeNull(); expect(f.calls()).toBe(1);
}, 30000);

it('P8-TP-AGGREGATE-INFLIGHT-REBUILD a replacement doorway never presents or selects a claimed child as pending', () => {
  const { f, first, aggregate } = setup();
  value(f.api.dispatch(first, f.fence));
  const replacement = createEffectDoorway(f.composition);
  const current = value(replacement.inspect()).filter(row => row.record.type === 'OrderedEffectAggregate').at(-1)!.record;
  expect(current.type).toBe('OrderedEffectAggregate');
  if (current.type !== 'OrderedEffectAggregate') throw new Error('aggregate fixture');
  expect(current.state).toBe('uncertain'); expect(current.settlements[0]?.disposition).toBe('uncertain');
  refused(replacement.nextAggregateChild(aggregate.aggregate), 'in-flight child');
  expect(f.calls()).toBe(1);
}, 30000);

it('P8-TP-ACK P8-TP-BOUND-REFUSAL decorative acknowledgment refusal stays non-terminal and cannot be marked required', () => {
  const contract = effectOperationContracts.acknowledge;
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'acknowledge', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['acknowledge']);
  const raw = { ...payloadInput('acknowledge', f.host), sourceResult: f.pending.id };
  const draft = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  const payload = value(decodeEffectPayload({ ...draft,
    ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, f.host));
  const request = value(f.api.preparePayload({ definition: f.d.id, payload, run: f.run, pending: f.pending.id,
    attempt: 'ack:1', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
  refused(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: false, required: true }], reconciliationOwner: 'reconciler' }), 'cannot terminalize');
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: false, required: false }], reconciliationOwner: 'reconciler' }));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'decorative provider unavailable' }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('fixture refusal');
  const refusalFact = value(f.api.recordRefusal(request, refusal));
  const updated = value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, refusal, refusalFact: refusalFact.id, fence: f.fence }));
  expect(updated.state).toBe('partial'); expect(updated.openRecovery).toEqual([request.id]);
  expect(f.calls()).toBe(0);
});
