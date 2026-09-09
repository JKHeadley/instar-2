import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createFactStore, prepareSnapshot } from '../../src/facts/index.js';
import type { CapturedContent } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
import { createEffectDoorway, createEffectSpine, decodeEffectPayload, effectOperationContracts, effectPayloadIdentity,
  referencedPayloadFacts, registerEffectBodies } from '../../src/effects/index.js';
import type { EffectRequest, TypedEffectPayload } from '../../src/effects/index.js';
import { digest } from '../fixtures.js';
import { privateKey } from '../facts/fixtures.js';
import { payloadInput } from '../effects/payload-fixtures.js';
import { typedEffectFixture, value } from '../effects/typed-effect-fixture.js';

const mode = process.env.P8_TYPED_FAULT_MODE;
const cut = process.env.P8_TYPED_FAULT_CUT;
const directory = process.env.P8_TYPED_FAULT_DIRECTORY;
const marker = (value: object) => process.stdout.write(`P8_TYPED_FAULT=${JSON.stringify(value)}\n`);
const pause = (value: object) => { marker(value); process.kill(process.pid, 'SIGSTOP'); throw new Error('fault child resumed'); };

it.skipIf(!mode || !cut || !directory)('typed aggregate fault child', () => {
  const statePath = join(directory!, 'typed-fault-state.json');
  const servicePath = join(directory!, 'typed-service.jsonl');
  if (mode === 'recover') {
    const originText = readFileSync(join(directory!, 'origin', 'facts.json'), 'utf8');
    expect(originText).toBe(readFileSync(join(directory!, 'peer', 'facts.json'), 'utf8'));
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as { first: string; second: string; firstDigest: string;
      secondDigest: string; firstPayload: string; secondPayload: string; aggregate?: string; maxCharge: number;
      captures: Record<string, CapturedContent> };
    // Reconstruct the real signed store and every owner port, then ask the
    // doorway for its recovered projection. Raw JSON is used only for the
    // independent origin/peer byte comparison above and the saved identifiers.
    const contract = effectOperationContracts['post-text'];
    const replacement = typedEffectFixture(undefined, 'typed-fault:2', { payloadKind: 'post-text', inputSchema: contract.inputSchema,
      canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['post-text']);
    let store: ReturnType<typeof createFactStore>;
    const host = { ...replacement.host, referenceFacts: () => store.read(), current: () => {
      const current = replacement.host.current();
      return { ...current, decode: { ...current.decode, captures: Object.fromEntries(Object.entries(state.captures)
        .filter(([, capture]) => capture.status === 'available' && capture.bytes !== null)
        .map(([reference, capture]) => [reference, capture.bytes!])) } };
    } };
    const ctx = { ...replacement.ctx, captures: state.captures,
      ownedBodies: [...(replacement.ctx.ownedBodies ?? []).filter(registration => registration.owner !== 'part-eight'),
        ...value(registerEffectBodies(host))] };
    store = createFactStore(ctx, { owner: 'part-ten', read: () => JSON.parse(originText), append: () => { throw new Error('read-only recovery'); } });
    const transport = createTransportAuthority(replacement.transportHost,
      createTransportSpine(replacement.transportHost, { context: ctx, privateKey }, store), host.boundary);
    const spine = createEffectSpine(host, { context: ctx, privateKey }, store);
    const api = createEffectDoorway({ ...replacement.composition, host, transport, spine });
    const signed = value(store.read());
    expect(signed).toHaveLength((JSON.parse(originText) as unknown[]).length);
    const conflicts = value(prepareSnapshot(signed, ctx)).entries.flatMap(entry => entry.conflicts);
    if (conflicts.length) throw new Error(`recovery projection conflicts: ${JSON.stringify(conflicts)}`);
    const rows = value(api.inspect()), requests = rows.flatMap(row => row.record.type === 'EffectRequest' ? [row.record] : []);
    expect(requests.map(request => request.id)).toEqual([state.first, state.second]);
    expect(requests.map(request => request.digest)).toEqual([state.firstDigest, state.secondDigest]);
    expect(requests.map(request => request.payload)).toEqual([state.firstPayload, state.secondPayload]);
    const aggregates = rows.flatMap(row => row.record.type === 'OrderedEffectAggregate' ? [row.record] : []);
    const serviceCalls = () => existsSync(servicePath)
      ? readFileSync(servicePath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    const before = serviceCalls();
    const first = requests[0]!, second = requests[1]!;
    if (cut === 'request') {
      expect(aggregates).toHaveLength(0); expect(before).toHaveLength(0);
      expect(api.dispatch(first as EffectRequest, replacement.fence).kind).toBe('Refused');
      expect(serviceCalls()).toEqual(before); expect(replacement.calls()).toBe(0);
      marker({ recovered: true, cut, requests: requests.length, calls: before.length,
        assessment: 'not-dispatched', remainingExposure: state.maxCharge * requests.length, replayRefused: true });
      return;
    }
    const aggregate = aggregates.at(-1)!;
    expect(aggregate.aggregate).toBe(state.aggregate);
    expect(aggregate.children.map(child => child.request)).toEqual([state.first, state.second]);
    if (cut === 'aggregate') {
      expect(before).toHaveLength(0); const next = value(api.nextAggregateChild(state.aggregate!)); expect(next?.id).toBe(state.first);
      expect(api.dispatch(next!, replacement.fence).kind).toBe('Refused');
      expect(serviceCalls()).toEqual(before); expect(replacement.calls()).toBe(0);
      marker({ recovered: true, cut, requests: requests.length, aggregate: state.aggregate, calls: before.length,
        assessment: aggregate.state, remainingExposure: state.maxCharge * requests.length, next: next?.id, replayRefused: true });
      return;
    }
    expect(before).toEqual([{ request: state.first, digest: state.firstDigest, order: 0 }]);
    expect(aggregate.state).toBe('uncertain'); expect(aggregate.settlements[0]?.disposition).toBe('uncertain');
    const firstObservations = rows.flatMap(row => row.record.type === 'OperationObservation' && row.record.request === state.first ? [row.record] : []);
    expect(firstObservations.map(record => record.stage)).toEqual(['executor-accepted']);
    expect(rows.filter(row => row.record.type === 'OperationObservation' && row.record.request === state.second)).toHaveLength(0);
    expect(rows.filter(row => row.record.type === 'EffectSettlement')).toHaveLength(0);
    expect(api.nextAggregateChild(state.aggregate!).kind).toBe('Refused');
    expect(value(api.dispatch(first as EffectRequest, replacement.fence)).id).toBe(firstObservations[0]!.id);
    expect(api.dispatch(second as EffectRequest, replacement.fence).kind).toBe('Refused');
    expect(serviceCalls()).toEqual(before); expect(replacement.calls()).toBe(0);
    marker({ recovered: true, cut, requests: requests.length, aggregate: state.aggregate, calls: before.length,
      firstCalls: before.filter(call => call.request === state.first).length,
      secondCalls: before.filter(call => call.request === state.second).length,
      assessment: aggregate.settlements[0]?.disposition, aggregateState: aggregate.state,
      remainingExposure: state.maxCharge * requests.length, ordering: 'first-unsettled-inhibits-second',
      first: state.first, second: state.second, replayRefused: true });
    return;
  }

  const contract = effectOperationContracts['post-text'];
  const f = typedEffectFixture(directory!, 'typed-fault:1', { payloadKind: 'post-text', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['post-text']);
  const makePayload = (logicalEffect: string, text: string): { payload: TypedEffectPayload; source: ReturnType<typeof f.sourceFor>['source'] } => {
    const step = `step:${logicalEffect}`, source = f.sourceFor(step, logicalEffect).source;
    const raw = { ...payloadInput('post-text', f.host), sourceResult: source.id, step, logicalEffect, text };
    const draft = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
    return { source, payload: value(decodeEffectPayload({ ...draft,
      ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, f.host)) };
  };
  const { payload: firstPayload, source: firstSource } = makePayload('logical:typed-fault:first', 'first typed child');
  const first = value(f.api.preparePayload({ definition: f.d.id, payload: firstPayload, run: f.run,
    pending: firstSource.id, attempt: 'typed-fault:attempt:1', verificationOwner: 'typed-fault:verifier',
    obligation: f.obligation, closure: [], fence: f.fence }));
  const { payload: secondPayload } = makePayload('logical:typed-fault:second', 'second typed child');
  const payloadReceipt = value(f.spine.append(secondPayload, referencedPayloadFacts(secondPayload, f.host)));
  const firstPayloadFact = value(f.api.inspect()).find(row => row.record.type === 'EffectPayload' && row.record.id === firstPayload.id)!.fact.id;
  const closure = [...new Set([...first.closure.filter(id => id !== firstPayloadFact), payloadReceipt.fact.id,
    ...referencedPayloadFacts(secondPayload, f.host)])];
  const requestId = `request:${digest(['effect-payload', secondPayload.logicalEffect, secondPayload.semanticMessage, secondPayload.id])}`;
  const binding = { ...first.binding!, sourceVector: digest([...closure].sort()), payload: { id: secondPayload.id, digest: digest(secondPayload) },
    target: secondPayload.targetDigest, logicalEffect: secondPayload.logicalEffect, step: secondPayload.step,
    reservation: { ...first.binding!.reservation, request: requestId, attempt: 'typed-fault:attempt:2',
      semanticMessage: `effect-child:${digest([secondPayload.semanticMessage, secondPayload.logicalEffect])}` },
    claim: { ...first.binding!.claim, attempt: 'typed-fault:attempt:2' } };
  const second = { ...first, id: requestId, message: secondPayload.id, payload: secondPayload.id,
    payloadDigest: digest(secondPayload), pending: secondPayload.sourceResult, binding, attempt: 'typed-fault:attempt:2',
    digest: digest(binding), closure } as unknown as EffectRequest;
  value(f.spine.append(second, closure));
  const baseState = { first: first.id, second: second.id, firstDigest: first.digest, secondDigest: second.digest,
    firstPayload: firstPayload.id, secondPayload: secondPayload.id, maxCharge: f.definition.maxCharge, captures: f.ctx.captures };
  writeFileSync(statePath, JSON.stringify(baseState));
  if (cut === 'request') pause(baseState);
  const aggregate = value(f.api.createAggregate({ semanticMessage: first.semanticMessage, run: f.run,
    children: [{ request: first, demandedStage: 'complete', inhibitLater: true, required: true },
      { request: second, demandedStage: 'complete', inhibitLater: true, required: true }],
    reconciliationOwner: 'typed-fault:reconciler' }));
  const fullState = { ...baseState, aggregate: aggregate.aggregate };
  writeFileSync(statePath, JSON.stringify(fullState));
  if (cut === 'aggregate') pause(fullState);
  f.onInvoke(() => {
    appendFileSync(servicePath, `${JSON.stringify({ request: first.id, digest: first.digest, order: 0 })}\n`);
    writeFileSync(statePath, JSON.stringify({ ...fullState, captures: f.ctx.captures }));
    pause(fullState);
  });
  value(f.api.dispatch(first, f.fence));
  throw new Error('applied cut did not stop inside the first provider invocation');
}, 60_000);
