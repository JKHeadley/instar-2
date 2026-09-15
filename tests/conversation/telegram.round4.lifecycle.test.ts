import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import {
  createTelegramReplyOperationAdapter, installTelegramReplyOperation,
} from '../../src/conversation/index.js';
import { createEffectDoorway, createEffectSpine } from '../../src/effects/index.js';
import { createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { value } from '../intake/fixtures.js';
import { telegramOutbound } from './round3-fixture.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference fsync capture host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';
// @ts-expect-error Reference replica host is JavaScript, outside pure core compilation.
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';

it('P12-NF-28 P12-NF-33 P12-NF-38 round4 fsync-backed prepared outbox reconstructs and dispatches once', () => {
  const f = telegramOutbound();
  const result = <T>(run: () => T) => f.telegram.intake.f.success(run());
  const custody = createEffectFileCaptures([
    `${f.effects.directory}/origin-captures`, `${f.effects.directory}/peer-captures`,
  ], result);
  const host = { ...f.effects.host, capture: custody.capture };
  const context = { ...f.effects.ctx, get captures() { return custody.captures; } };
  const peer = createFactStore(context,
    createTransportFileStorage(`${f.effects.directory}/peer`, result));
  const replicas = createEffectReplicaStorage(`${f.effects.directory}/origin`,
    { id: 'fixture-peer-directory', store: peer }, result);
  const store = createFactStore(context, replicas.storage);
  const spine = createEffectSpine(host, { context, privateKey }, store);
  const transportHost = {
    domain: 'conversation:1', machine: host.machine, incarnation: host.incarnation,
    authorityIncarnation: 'authority:1', principal: host.principal, scope: host.scope,
    maxLeaseTerm: 1000, budget: 100, monotonic: () => 100,
    current: () => ({ decode: host.current().decode, clock: host.current().clock,
      generation: host.current().decode.register.generation, stopped: false }),
  };
  const transport = createTransportAuthority(transportHost,
    createTransportSpine(transportHost, { context, privateKey }, store), host.boundary);
  const facts = value(store.read());
  const definition = (facts.find(row => row.kind === 'effect-OperationDefinition'
    && (row.body as any).record.id === f.request.definition)!.body as any).record;
  const readmitted = value(f.telegram.admit());
  expect(value(installTelegramReplyOperation({
    id: definition.id, generation: definition.generation, admitted: readmitted, target: f.target,
    speaker: definition.speaker, scopeDigest: definition.scopeDigest, durability: definition.durability,
    replicas: definition.replicas, lossModel: definition.lossModel, verificationBar: definition.verificationBar,
  }, host, spine)).id).toBe(definition.id);
  const adapter = createTelegramReplyOperationAdapter(readmitted, f.telegram.api, f.target, host.boundary);
  const doorway = createEffectDoorway({ host, spine, transport, durability: replicas.durability,
    custody: custody.custody, adapter, assessment: null });
  expect(value(doorway.dispatch(f.request, f.effects.fence)).stage).toBe('response');
  expect(f.telegram.calls.send).toHaveLength(1);
  expect(value(transport.inspect()).filter(row => row.record.type === 'AdmissionReservation')
    .map(row => row.record.type === 'AdmissionReservation' ? row.record.state : '')).toContain('consumed');
});

it('P12-NF-28 P12-NF-33 P12-NF-38 round4 recovered executor acceptance remains non-replaying after response-record loss', () => {
  const f = telegramOutbound();
  let suppressResponse = false;
  const spine = { ...f.effects.spine,
    append(...args: Parameters<typeof f.effects.spine.append>) {
      if (suppressResponse) throw new Error('response-record cut');
      return f.effects.spine.append(...args);
    },
  };
  const adapter = { ...f.adapter,
    invoke(input: Parameters<typeof f.adapter.invoke>[0]) {
      const response = f.adapter.invoke(input);
      suppressResponse = true;
      return response;
    },
  };
  const firstDoorway = createEffectDoorway({ ...f.effects.composition, spine, adapter, assessment: null });
  expect(value(firstDoorway.dispatch(f.request, f.effects.fence)).stage).toBe('executor-accepted');
  suppressResponse = false;
  expect(f.telegram.calls.send).toHaveLength(1);

  const facts = value(f.effects.spine.store.read());
  const definition = (facts.find(row => row.kind === 'effect-OperationDefinition'
    && (row.body as any).record.id === f.request.definition)!.body as any).record;
  const readmitted = value(f.telegram.admit());
  expect(installTelegramReplyOperation({
    id: definition.id, generation: definition.generation, admitted: readmitted, target: f.target,
    speaker: definition.speaker, scopeDigest: definition.scopeDigest, durability: definition.durability,
    replicas: definition.replicas, lossModel: definition.lossModel, verificationBar: definition.verificationBar,
  }, f.effects.host, f.effects.spine).kind).toBe('Success');
  const rebuilt = createTelegramReplyOperationAdapter(readmitted, f.telegram.api, f.target,
    f.effects.host.boundary);
  const acceptance = facts.filter(row => row.kind === 'effect-OperationObservation')
    .map(row => (row.body as any).record).find(row => row.stage === 'executor-accepted');
  expect(rebuilt.invoke({ operation: acceptance.operation, claim: acceptance.claim,
    digest: f.request.digest, message: f.message }).kind).toBe('Refused');
  expect(f.telegram.calls.send).toHaveLength(1);
});
