import { expect, it } from 'vitest';
import { createSequentialServingAdmission, createTransportAuthority, invokeConsumedDispatch } from '../../src/transport/index.js';
import { acceptedReplyOpening } from '../../src/rungraph/accepted-reply.js';
import { withRunPairAdmission } from '../../src/transport/run-pair.js';
import { canonical } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import type { AdmissionReservation, RunPairAdmission, ServingBinding, TransportFact } from '../../src/transport/index.js';
import { transportFixture, value, refused } from './fixture.js';

// Synthetic Four/Five facts in this transport fixture exercise Six's signed
// boundary. The installed owner and real-bin joins have separate suites.
function serving(overrides: Partial<ServingBinding> = {}) {
  const f = transportFixture(undefined, 'worker:1', 'authority:1', true);
  const installation = f.append('assembly-ProductionInstallation',
    { record: { type: 'TestServingInstallation', schemaVersion: 1,
      id: 'installation:1', generation: 'generation:1' } });
  const conversation = f.append('conversation-binding', {
    channel: 'telegram:v1:bot:1:chat:1', sender: 'person:1', identityEpoch: 'epoch:1',
  });
  const fence = value(f.api.acquire('lease:1', '', 500));
  const port = createSequentialServingAdmission(f.api, f.c);
  const binding: ServingBinding = { installation: installation.id, conversation: conversation.id,
    ceiling: 47, maxTurns: 3, maxReplies: 1, expires: 500, providerMax: 20,
    replyMax: 5, errorLimit: 3, totalErrorLimit: 5, ...overrides };
  value(port.bind('serving:1', fence, binding));
  const inbound = (number: number, logicalId = `original:${number}`) => {
    const receipt = f.append('intake-receipt', {});
    const input = f.append('intake-admitted', { logicalId, receipt: receipt.id,
      binding: conversation.id, channel: 'telegram:v1:bot:1:chat:1', sender: 'person:1',
      identityEpoch: 'epoch:1', eventId: String(number) }, [receipt.id, conversation.id]);
    const run = `run:${number}:${input.id}`;
    f.append('run-opening', { run, record: { type: 'TestServingRun', schemaVersion: 1,
      id: run, opening: { id: input.id }, owner: 'one', scope: 'one',
      generation: 'generation:1', resultDestination: 'conversation:1' } }, [input.id]);
    return { input, run };
  };
  const admit = (number: number) => {
    const turn = inbound(number);
    value(port.admitTurn(`turn:${number}`, fence, turn.input.id, turn.run));
    return turn;
  };
  const providerRequest = (id: string) => f.append('effect-provider-ProviderEffectRequest', {
    record: { type: 'TestServingProviderRequest', schemaVersion: 1, id, obligation: '' },
  });
  const execute = (turn: ReturnType<typeof inbound>, charge: number) => {
    providerRequest(`request:${turn.run}`);
    value(f.api.schedule(`schedule:${turn.run}`, fence, { owner: 'part-five', name: 'Run', id: turn.run }, f.policy));
    const reservation = value(f.api.reserve(f.input(fence, { command: `reserve:${turn.run}`, run: {
      owner: 'part-five', name: 'Run', id: turn.run }, request: { owner: 'part-eight', name: 'EffectRequest',
      id: `request:${turn.run}` }, attempt: `attempt:${turn.run}`, semanticMessage: `semantic:${turn.run}`, charge })));
    const claim = value(f.api.claim(`claim:${turn.run}`, fence, reservation.operation));
    value(f.api.consume(claim, fence));
    value(port.retire(`retire:${turn.run}`, fence, turn.run, reservation.operation));
    return reservation;
  };
  return { f, port, fence, binding, inbound, admit, execute, providerRequest };
}

it('keeps UNKNOWN exposure across distinct turns and refuses the next maximum at the parent ceiling', () => {
  const s = serving();
  const one = s.admit(1); s.execute(one, 20);
  const two = s.admit(2); s.execute(two, 3);
  const rows = value(s.f.api.inspect()).filter((row): row is TransportFact & { record: AdmissionReservation } =>
    row.record.type === 'AdmissionReservation');
  const latest = [...new Map(rows.map(row => [row.record.operation, row.record])).values()];
  expect(latest.reduce((sum, row) => sum + row.charge, 0)).toBe(23);
  expect(value(s.port.inspect())).toMatchObject({ turns: 2, slot: null });
  const three = s.inbound(3);
  expect(refused(s.port.admitTurn('turn:3', s.fence, three.input.id, three.run)))
    .toContain('serving parent exposure exhausted');
});

it('selects the current synthetic accepted pair after an earlier UNKNOWN turn without reusing its exposure', () => {
  const s = serving({ ceiling: 100, maxReplies: 2 });
  s.execute(s.admit(1), 20);
  const two = s.admit(2);
  value(s.f.api.schedule('schedule:second-provider', s.fence,
    { owner: 'part-five', name: 'Run', id: two.run }, s.f.policy));
  const obligation = value(s.f.api.inspect()).filter(row => row.record.type === 'LoopRecord'
    && row.record.run === two.run).at(-1)!;
  const providerId = 'request:second-provider';
  const providerFact = s.f.append('effect-provider-ProviderEffectRequest', { record: {
    type: 'TestServingProviderRequest', schemaVersion: 1, id: providerId,
    obligation: obligation.fact.id } });
  const provider = value(s.f.api.reserve(s.f.input(s.fence, { command: 'reserve:second-provider',
    run: { owner: 'part-five', name: 'Run', id: two.run },
    request: { owner: 'part-eight', name: 'EffectRequest', id: providerId },
    attempt: 'attempt:second-provider', semanticMessage: 'semantic:second-provider', charge: 3 })));
  value(s.f.api.consume(value(s.f.api.claim('claim:second-provider', s.fence, provider.operation)), s.fence));
  const answer = 'accepted second answer';
  const question = s.f.append('judgment-provider-ProviderJudgmentRequest', { record: {
    type: 'TestServingJudgmentRequest', schemaVersion: 1, id: 'question:second',
    run: two.run, predecessor: two.run, effectRequest: providerId,
  } }, [providerFact.id]);
  const acceptance = s.f.append('judgment-provider-ProviderAnswerAcceptance', { record: {
    type: 'TestServingAcceptance', schemaVersion: 1, id: 'acceptance:second',
    request: 'question:second', operation: provider.operation, answerDigest: hashBytes(answer),
  } }, [question.id]);
  const replyRun = 'reply:second';
  const opened = s.f.append('run-opening', { run: replyRun, record: {
    type: 'TestServingRun', schemaVersion: 1, id: replyRun, opening: { id: acceptance.id },
    owner: 'one', scope: 'one', generation: 'generation:1', resultDestination: 'conversation:1',
  } }, [acceptance.id, obligation.fact.id]);
  const joined = acceptedReplyOpening(value(s.f.store.read()), replyRun);
  const pair = { type: 'RunPairAdmission', schemaVersion: 1, profile: 'provider-reply-v1',
    domain: s.f.host.domain, command: 'pair:second', ...joined,
    predecessor: s.f.head(), authority: s.f.host.authorityIncarnation,
    tick: s.f.host.monotonic(), originalPredecessor: joined.predecessor,
    budget: s.binding.ceiling, replyPolicy: s.f.policy } as unknown as RunPairAdmission;
  withRunPairAdmission(s.f.host, pair, () => value(s.f.spine.append(pair,
    [pair.predecessor, opened.id, acceptance.id, obligation.fact.id])));
  value(s.f.api.schedule('schedule:second-reply', s.fence,
    { owner: 'part-five', name: 'Run', id: replyRun }, s.f.policy));
  const message = { type: 'TestServingOutboundMessage', schemaVersion: 1,
    id: 'message:second', run: replyRun, text: answer, purpose: 'ordinary-reply',
    sourceResult: acceptance.id, semanticMessage: 'semantic:second-reply' };
  s.f.append('effect-OutboundMessage', { record: message });
  const digest = value(canonical(message)).hash;
  const request = { type: 'TestServingEffectRequest', schemaVersion: 1,
    id: 'effect:second-reply', run: replyRun, message: message.id,
    digest, attempt: 'attempt:second-reply' };
  s.f.append('effect-EffectRequest', { record: request });
  const reply = value(s.f.api.reserve(s.f.input(s.fence, { command: 'reserve:second-reply',
    run: { owner: 'part-five', name: 'Run', id: replyRun },
    request: { owner: 'part-eight', name: 'EffectRequest', id: request.id },
    payloadDigest: digest, attempt: request.attempt, semanticMessage: message.semanticMessage,
    charge: 5 })));
  const claim = value(s.f.api.claim('claim:second-reply', s.fence, reply.operation));
  value(s.f.api.consume(claim, s.fence));
  let sends = 0;
  value(invokeConsumedDispatch(s.f.api, claim, s.fence, s.f.c, () => ++sends));
  expect(sends).toBe(1);
  value(s.port.retire('retire:second', s.fence, two.run, reply.operation));
  const latest = new Map(value(s.f.api.inspect()).flatMap(row => row.record.type === 'AdmissionReservation'
    ? [[row.record.operation, row.record] as const] : []));
  expect([...latest.values()].reduce((sum, row) => sum + row.charge, 0)).toBe(28);
  expect(value(s.port.inspect())).toMatchObject({ turns: 2, replies: 1, slot: null });
  s.f.append('run-transition', { run: two.run, record: { type: 'TestServingRunTransition',
    schemaVersion: 1, id: 'terminal:second', to: 'completed' } });
  const three = s.inbound(3);
  value(s.port.admitTurn('turn:synthetic:3', s.fence, three.input.id, three.run));
  value(s.f.api.schedule('schedule:third-provider', s.fence,
    { owner: 'part-five', name: 'Run', id: three.run }, s.f.policy));
  s.providerRequest('request:third-provider');
  const third = value(s.f.api.reserve(s.f.input(s.fence, { command: 'reserve:third-provider',
    run: { owner: 'part-five', name: 'Run', id: three.run },
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'request:third-provider' },
    attempt: 'attempt:third-provider', semanticMessage: 'semantic:third-provider', charge: 1 })));
  const thirdClaim = value(s.f.api.claim('claim:third-provider', s.fence, third.operation));
  value(s.f.api.consume(thirdClaim, s.fence));
  let providers = 0;
  value(invokeConsumedDispatch(s.f.api, thirdClaim, s.fence, s.f.c, () => ++providers));
  expect(providers).toBe(1);
});

it('counts zero-charge turns and rejects duplicate or relabelled original ingress', () => {
  const s = serving({ ceiling: 25, maxTurns: 2, providerMax: 0, replyMax: 0, maxReplies: 0 });
  const one = s.admit(1);
  expect(value(s.port.admitTurn('changed-command', s.fence, one.input.id, one.run)).input).toBe(one.input.id);
  s.execute(one, 0);
  const relabelled = s.inbound(101, 'original:1');
  expect(refused(s.port.admitTurn('relabel', s.fence, relabelled.input.id, relabelled.run)))
    .toContain('original inbound already admitted');
  s.execute(s.admit(2), 0);
  const third = s.inbound(3);
  expect(refused(s.port.admitTurn('turn:3', s.fence, third.input.id, third.run)))
    .toContain('serving slot unavailable');
});

it('serializes two genuine Six API objects and requires local executor return for UNKNOWN retirement', () => {
  const s = serving();
  const other = createSequentialServingAdmission(createTransportAuthority(s.f.host, s.f.spine, s.f.c), s.f.c);
  const one = s.inbound(1), two = s.inbound(2);
  value(s.port.admitTurn('turn:1', s.fence, one.input.id, one.run));
  expect(refused(other.admitTurn('turn:2', s.fence, two.input.id, two.run)))
    .toContain('serving slot unavailable');
  value(s.f.api.schedule('schedule:active', s.fence, { owner: 'part-five', name: 'Run', id: one.run }, s.f.policy));
  s.providerRequest('request:active');
  const prepared = value(s.f.api.reserve(s.f.input(s.fence, { command: 'reserve:active', run: {
    owner: 'part-five', name: 'Run', id: one.run }, request: { owner: 'part-eight', name: 'EffectRequest',
    id: 'request:active' }, attempt: 'attempt:active', semanticMessage: 'semantic:active', charge: 1 })));
  value(s.f.api.consume(value(s.f.api.claim('claim:active', s.fence, prepared.operation)), s.fence));
  s.f.active.add(one.run);
  expect(refused(s.port.retire('retire:1', s.fence, one.run, prepared.operation)))
    .toContain('local executor has not returned');
  s.f.active.delete(one.run);
  value(s.port.retire('retire:1', s.fence, one.run, prepared.operation));
  value(other.admitTurn('turn:2', s.fence, two.input.id, two.run));
  expect(value(other.inspect()).slot).toBe(two.run);
});

it('burns a consumed provider claim when its turn retired before the final call edge', () => {
  const s = serving();
  const turn = s.admit(1);
  value(s.f.api.schedule('schedule:late', s.fence, { owner: 'part-five', name: 'Run', id: turn.run }, s.f.policy));
  s.providerRequest('request:late');
  const prepared = value(s.f.api.reserve(s.f.input(s.fence, { command: 'reserve:late', run: {
    owner: 'part-five', name: 'Run', id: turn.run }, request: { owner: 'part-eight', name: 'EffectRequest',
    id: 'request:late' }, attempt: 'attempt:late', semanticMessage: 'semantic:late', charge: 1 })));
  const claim = value(s.f.api.claim('claim:late', s.fence, prepared.operation));
  value(s.f.api.consume(claim, s.fence));
  value(s.port.retire('retire:late', s.fence, turn.run, prepared.operation));
  let calls = 0;
  expect(refused(invokeConsumedDispatch(s.f.api, claim, s.fence, s.f.c, () => ++calls)))
    .toContain('outside active serving slot');
  expect(calls).toBe(0);
  expect(refused(invokeConsumedDispatch(s.f.api, claim, s.fence, s.f.c, () => ++calls)))
    .toContain('already attempted');
  expect(calls).toBe(0);
});

it('invokes the first provider through the final Six edge before any reply pair exists', () => {
  const s = serving();
  const turn = s.admit(1);
  value(s.f.api.schedule('schedule:first-edge', s.fence,
    { owner: 'part-five', name: 'Run', id: turn.run }, s.f.policy));
  s.providerRequest('request:first-edge');
  const prepared = value(s.f.api.reserve(s.f.input(s.fence, { command: 'reserve:first-edge', run: {
    owner: 'part-five', name: 'Run', id: turn.run }, request: { owner: 'part-eight', name: 'EffectRequest',
    id: 'request:first-edge' }, attempt: 'attempt:first-edge', semanticMessage: 'semantic:first-edge', charge: 1 })));
  const claim = value(s.f.api.claim('claim:first-edge', s.fence, prepared.operation));
  value(s.f.api.consume(claim, s.fence));
  let calls = 0;
  expect(value(invokeConsumedDispatch(s.f.api, claim, s.fence, s.f.c, () => ++calls))).toBe(1);
  expect(value(s.port.inspect()).slot).toBe(turn.run);
  expect(refused(invokeConsumedDispatch(s.f.api, claim, s.fence, s.f.c, () => ++calls)))
    .toContain('already attempted');
  expect(calls).toBe(1);
});

it('refuses an unbound same-run operation before it can claim spend', () => {
  const s = serving();
  const turn = s.admit(1);
  value(s.f.api.schedule('schedule:unbound', s.fence,
    { owner: 'part-five', name: 'Run', id: turn.run }, s.f.policy));
  expect(refused(s.f.api.reserve(s.f.input(s.fence, { command: 'reserve:unbound', run: {
    owner: 'part-five', name: 'Run', id: turn.run }, request: { owner: 'part-eight', name: 'EffectRequest',
    id: 'unbound' }, attempt: 'attempt:unbound', semanticMessage: 'semantic:unbound', charge: 1 }))))
    .toContain('serving operation requires its provider, context delivery, or exact accepted-answer reply request');
});

it('requires a fresh Ten quiescence report after a serving port is reconstructed', () => {
  const s = serving();
  const turn = s.admit(1);
  const host = s.f.host as { executionQuiescent?: (run: string) => boolean };
  delete host.executionQuiescent;
  const reopened = createSequentialServingAdmission(
    createTransportAuthority(s.f.host, s.f.spine, s.f.c), s.f.c);
  expect(refused(reopened.retire('retire:reopen', s.fence, turn.run, '')))
    .toContain('local executor has not returned');
  value(reopened.registerQuiescence(run => run === turn.run));
  value(reopened.retire('retire:reopen', s.fence, turn.run, ''));
  expect(value(reopened.inspect()).slot).toBeNull();
});

it('names a planned Five Run in the durable step before Six acquires its slot', () => {
  const s = serving();
  const turn = s.inbound(1);
  value(s.port.start('step:planned', s.fence, 'attempt:planned', turn.run));
  expect(value(s.port.inspect())).toMatchObject({ slot: null, pendingAttempt: 'attempt:planned' });
  value(s.port.result('step:planned:done', s.fence, 'attempt:planned', 'success', ''));
  value(s.port.admitTurn('turn:planned', s.fence, turn.input.id, turn.run));
  value(s.port.retire('turn:planned:retire', s.fence, turn.run, ''));
  expect(value(s.port.inspect()).retired).toContain(turn.run);
  expect(refused(s.port.start('step:old', s.fence, 'attempt:old', turn.run)))
    .toContain('driver attempt unavailable');
});

it('refuses raw Two serving writes, a stale generation and authenticated stop', () => {
  const s = serving();
  const bound = value(s.port.inspect()).binding!;
  expect(refused(s.f.spine.append({ ...bound, action: 'start', command: 'raw:start',
    predecessor: s.f.head(), attempt: 'raw:1' }, [bound.installation, bound.conversation])))
    .toContain('serving record requires Six issuer');
  s.f.generation('generation:2');
  expect(refused(s.port.start('start:stale', s.fence, 'stale', '')))
    .toContain('register generation moved');
  s.f.generation('generation:1'); s.f.stop();
  expect(refused(s.port.start('start:stopped', s.fence, 'stopped', '')))
    .toContain('stop prohibits new admission');
});

it('recovers one killed pending attempt once and latches both breaker boundaries', () => {
  const s = serving({ errorLimit: 2, totalErrorLimit: 3 });
  value(s.port.start('start:1', s.fence, 'attempt:1', ''));
  value(s.port.result('result:1', s.fence, 'attempt:1', 'error', ''));
  value(s.port.start('start:2', s.fence, 'attempt:2', ''));
  const recovered = createSequentialServingAdmission(createTransportAuthority(s.f.host, s.f.spine, s.f.c), s.f.c);
  expect(value(recovered.inspect()).pendingAttempt).toBe('attempt:2');
  value(recovered.result('recovered:2', s.fence, 'attempt:2', 'error', ''));
  value(recovered.result('recovered:2', s.fence, 'attempt:2', 'error', ''));
  expect(value(recovered.inspect())).toMatchObject({ totalErrors: 2, consecutiveErrors: 2, stopped: true });
  expect(refused(recovered.start('start:3', s.fence, 'attempt:3', '')))
    .toContain('serving expired or breaker latched');

  const total = serving({ errorLimit: 3, totalErrorLimit: 2 });
  value(total.port.start('total:start:1', total.fence, 'total:1', ''));
  value(total.port.result('total:result:1', total.fence, 'total:1', 'error', ''));
  value(total.port.start('total:start:ok', total.fence, 'total:ok', ''));
  value(total.port.result('total:result:ok', total.fence, 'total:ok', 'success', ''));
  value(total.port.start('total:start:2', total.fence, 'total:2', ''));
  value(total.port.result('total:result:2', total.fence, 'total:2', 'error', ''));
  expect(value(total.port.inspect())).toMatchObject({ totalErrors: 2, consecutiveErrors: 1, stopped: true });
});

it('refuses a serving profile that cannot leave bounded record completion headroom', () => {
  const f = transportFixture(undefined, 'worker:1', 'authority:1', true);
  const installation = f.append('assembly-ProductionInstallation', { record: {
    type: 'TestServingInstallation', schemaVersion: 1, id: 'installation:wide', generation: 'generation:1' } });
  const conversation = f.append('conversation-binding', { channel: 'telegram:v1:bot:1:chat:1',
    sender: 'person:1', identityEpoch: 'epoch:1' });
  const fence = value(f.api.acquire('lease:wide', '', 500));
  const port = createSequentialServingAdmission(f.api, f.c);
  expect(refused(port.bind('serving:wide', fence, { installation: installation.id,
    conversation: conversation.id, ceiling: 100, maxTurns: 64, maxReplies: 0,
    expires: 500, providerMax: 0, replyMax: 0, errorLimit: 2, totalErrorLimit: 2 })))
    .toContain('record headroom exhausted');
});
