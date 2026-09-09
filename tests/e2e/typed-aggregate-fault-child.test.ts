import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decodeEffectPayload, effectOperationContracts, effectPayloadIdentity, referencedPayloadFacts } from '../../src/effects/index.js';
import type { EffectRequest, TypedEffectPayload } from '../../src/effects/index.js';
import { digest } from '../fixtures.js';
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
    const facts = JSON.parse(originText) as Record<string, unknown>[];
    const records = facts.map(fact => (fact.body as { record?: Record<string, unknown> }).record).filter(Boolean) as Record<string, unknown>[];
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as { first: string; second: string; firstDigest: string;
      secondDigest: string; firstPayload: string; secondPayload: string; aggregate?: string; maxCharge: number };
    const requests = records.filter(record => record.type === 'EffectRequest');
    expect(requests.map(request => request.id)).toEqual([state.first, state.second]);
    expect(requests.map(request => request.digest)).toEqual([state.firstDigest, state.secondDigest]);
    expect(requests.map(request => request.payload)).toEqual([state.firstPayload, state.secondPayload]);
    const aggregates = records.filter(record => record.type === 'OrderedEffectAggregate');
    const calls = existsSync(servicePath) ? readFileSync(servicePath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    if (cut === 'request') {
      expect(aggregates).toHaveLength(0); expect(calls).toHaveLength(0);
      marker({ recovered: true, cut, requests: 2, calls: 0, assessment: 'not-dispatched', remainingExposure: state.maxCharge * 2 });
      return;
    }
    const aggregate = aggregates.at(-1)!;
    expect(aggregate.aggregate).toBe(state.aggregate);
    expect((aggregate.children as Record<string, unknown>[]).map(child => child.request)).toEqual([state.first, state.second]);
    if (cut === 'aggregate') {
      expect(calls).toHaveLength(0);
      marker({ recovered: true, cut, requests: 2, aggregate: state.aggregate, calls: 0,
        assessment: 'pending', remainingExposure: state.maxCharge * 2, next: state.first });
      return;
    }
    expect(calls).toEqual([{ request: state.first, digest: state.firstDigest, order: 0 }]);
    const firstObservations = records.filter(record => record.type === 'OperationObservation' && record.request === state.first);
    expect(firstObservations.map(record => record.stage)).toEqual(['executor-accepted']);
    expect(records.filter(record => record.type === 'OperationObservation' && record.request === state.second)).toHaveLength(0);
    expect(records.filter(record => record.type === 'EffectSettlement')).toHaveLength(0);
    marker({ recovered: true, cut, requests: 2, aggregate: state.aggregate, calls: 1, firstCalls: 1, secondCalls: 0,
      assessment: 'uncertain', aggregateState: 'uncertain', remainingExposure: state.maxCharge * 2,
      ordering: 'first-unsettled-inhibits-second', first: state.first, second: state.second });
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
    firstPayload: firstPayload.id, secondPayload: secondPayload.id, maxCharge: f.definition.maxCharge };
  writeFileSync(statePath, JSON.stringify(baseState));
  if (cut === 'request') pause(baseState);
  const aggregate = value(f.api.createAggregate({ semanticMessage: first.semanticMessage, run: f.run,
    children: [{ request: first, demandedStage: 'complete', inhibitLater: true, required: true },
      { request: second, demandedStage: 'complete', inhibitLater: true, required: true }],
    reconciliationOwner: 'typed-fault:reconciler' }));
  const fullState = { ...baseState, aggregate: aggregate.aggregate };
  writeFileSync(statePath, JSON.stringify(fullState));
  if (cut === 'aggregate') pause(fullState);
  f.onInvoke(() => { appendFileSync(servicePath, `${JSON.stringify({ request: first.id, digest: first.digest, order: 0 })}\n`); pause(fullState); });
  value(f.api.dispatch(first, f.fence));
  throw new Error('applied cut did not stop inside the first provider invocation');
}, 60_000);
