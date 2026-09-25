// @ts-nocheck -- installed owner fixture records genuine Four/Five/Six facts.
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
// @ts-expect-error Offline Node fixture outside the TypeScript source graph.
import { installedServingFixture, installServingBinding } from '../fixtures/production-serving-host.mjs';
import { extractTelegramUpdate, createTelegramIngress } from '../../src/conversation/index.js';
import { runIdFor } from '../../src/rungraph/index.js';
import { turns, exactTelegramApiAcceptance } from '../../src/assembly/production-conversation-driver.js';
import { runRecordedConversation } from '../assembly/production-boot-trace.js';
import { createRecordedServingPlan, recordedResponseEvidenceContract } from '../assembly/production-boot-trace.js';
import { createProductionConversationHost } from '../../src/assembly/production-conversation-host.js';
import { registerProviderResponseEvidenceBounds } from '../../src/assembly/provider-invocation.js';
import { value, refused } from '../facts/fixtures.js';

it('binds real Four/Five input to genuine Six and keeps the slot until host quiescence', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-port-')));
  try {
    const active = new Set();
    const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not run during construction'); } });
    const built = fixture.boot();
    const app = built.application;
    expect(app.owners.serving.owner).toBe('part-six');
    expect(value(app.owners.serving.inspect()).binding).toBeNull();
    const batch = value(built.api.poll({ token: built.declaration.token, apiVersion: built.declaration.apiVersion,
      offset: 0, limit: 100, timeout: 0 }));
    const route = extractTelegramUpdate(batch.updates[0], built.declaration).route;
    expect(value(app.owners.transport.inspect()).map(row => row.record.type)).toEqual(['Lease']);
    const binding = installServingBinding(built, batch.updates[0]);
    const installation = value(built.f.store.read()).find(row => row.kind === 'assembly-ProductionInstallation');
    value(app.owners.serving.registerQuiescence(run => !active.has(run)));
    value(app.owners.serving.bind('serving:installed', built.f.effects.fence, {
      installation: installation.id, conversation: binding.id, ceiling: 100, maxTurns: 2,
      maxReplies: 1, expires: 500, providerMax: 20, replyMax: 5,
      errorLimit: 3, totalErrorLimit: 5 }));
    const received = value(app.owners.intake.receive(batch.updates[0], route));
    expect(received.kind).toBe('admitted');
    const input = value(built.f.store.read()).find(row => row.id === received.fact.id);
    expect(input.body.binding).toBe(binding.id);
    built.f.bindIntake(input);
    const run = value(app.owners.run.open(built.f.run));
    expect(run.run.id).toBe(built.f.id);
    const admitted = value(app.owners.serving.admitTurn('turn:real:1', built.f.effects.fence,
      input.id, run.run.id));
    expect(admitted).toMatchObject({ action: 'admit', input: input.id, provider: run.run.id });
    expect(value(app.owners.serving.inspect()).slot).toBe(run.run.id);
    active.add(run.run.id);
    expect(refused(app.owners.serving.retire('retire:real:1', built.f.effects.fence, run.run.id, '')))
      .toContain('local executor has not returned or terminated');
    const raw = batch.updates[1], nextRoute = extractTelegramUpdate(raw, built.declaration).route;
    const received2 = value(app.owners.intake.receive(raw, nextRoute));
    expect(received2.kind).toBe('admitted');
    const input2 = value(built.f.store.read()).find(row => row.id === received2.fact.id);
    expect(input2.body.binding).toBe(binding.id);
    const reference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
    const nextRun = { ...built.f.run, id: runIdFor(reference(input2)), opening: reference(input2),
      intent: { type: 'Intent', id: input2.body.intent.id, fact: reference(input2), field: 'intent' },
      authority: { resolution: reference(input2), grants: [] },
      resultDestination: { ...built.f.run.resultDestination, route: reference(input2) } };
    const opened2 = value(app.owners.run.open(nextRun));
    expect(refused(app.owners.serving.admitTurn('turn:real:2', built.f.effects.fence, input2.id, opened2.run.id)))
      .toContain('serving slot unavailable');
    active.delete(run.run.id);
    value(app.owners.serving.retire('retire:real:1', built.f.effects.fence, run.run.id, ''));
    value(app.owners.serving.admitTurn('turn:real:2', built.f.effects.fence, input2.id, opened2.run.id));
    expect(value(app.owners.serving.inspect())).toMatchObject({ turns: 2, slot: opened2.run.id });
    app.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it.each([
  ['first UNKNOWN, second accepted', true, ['provider-dispatched-unknown', 'api-accepted'], 1, 24],
  ['two accepted replies', false, ['api-accepted', 'api-accepted'], 2, 8],
])('runs installed provider turns with %s and distinct Ten launches', async (_label, firstUnknown, phases, replies, exposure) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-two-launches-')));
  try {
    let configured, built, invoked = 0;
    const route = Object.freeze({ provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async bytes => {
        if (++invoked === 1 && firstUnknown) return { state: 'uncertain', bytes: null, providerOperation: null,
          usage: { inputTokens: null, outputTokens: null, charge: null, source: 'offline uncertainty' }, retryBlocked: false };
        const answer = JSON.stringify(built.f.decisionInput());
        return { state: 'complete', bytes: answer, providerOperation: `recorded-provider-operation:${invoked}`,
          usage: { inputTokens: 11, outputTokens: 9, charge: 3, source: 'authenticated local provider receipt' },
          retryBlocked: false, responseEvidenceDraft: configured.responseDraft(bytes, answer) };
      } });
    registerProviderResponseEvidenceBounds(route, recordedResponseEvidenceContract);
    const pollOffsets = [];
    const fixture = await installedServingFixture(root, route, { sequentialPoll: true, dynamicReplyResponse: true,
      onPoll: offset => pollOffsets.push(offset) });
    built = fixture.boot(); const app = built.application;
    const batch = value(built.api.poll({ token: built.declaration.token,
      apiVersion: built.declaration.apiVersion, offset: 0, limit: 100, timeout: 0 }));
    expect(batch.updates).toHaveLength(1);
    const first = batch.updates[0];
    const binding = installServingBinding(built, first);
    const installation = value(built.f.store.read()).find(row => row.kind === 'assembly-ProductionInstallation');
    const target = extractTelegramUpdate(first, built.declaration).target;
    const received = value(app.owners.intake.receive(first, extractTelegramUpdate(first, built.declaration).route));
    expect(received.kind).toBe('admitted');
    const ingress = createTelegramIngress({ boundary: app.owners.composition.host.boundary,
      admitted: built.admitted, api: app.owners.telegram, intake: app.owners.intake,
      facts: app.owners.composition.spine.store, observer: built.owners.intake.author.principal.id });
    expect(value(ingress.currentOffset())).toBe(extractTelegramUpdate(first, built.declaration).updateId + 1);
    configured = createRecordedServingPlan(built, target);
    let clock = 100;
    const host = createProductionConversationHost({
      binding: { installation: installation.id, conversation: binding.id, ceiling: 100,
        maxTurns: 2, maxReplies: replies, expires: 500, providerMax: 20, replyMax: 5,
        errorLimit: 3, totalErrorLimit: 5 },
      fence: () => built.f.effects.fence, admitted: built.admitted,
      observer: built.owners.intake.author.principal.id, target, plan: configured.plan,
      capture: reference => built.storage.captures.read(reference),
      now: () => clock, stopped: () => false,
      executionQuiescent: () => true, maxContextTurns: 2, maxContextBytes: 4096,
      maxCycles: 4, baseBackoffMs: 1, maxBackoffMs: 2,
      yieldBoundary: async () => { await new Promise(resolve => setImmediate(resolve)); },
      sleep: async ms => { clock += ms; },
    });
    await host.run(app);
    expect(pollOffsets).toContain(extractTelegramUpdate(first, built.declaration).updateId + 1);
    const facts = value(built.f.store.read());
    expect(facts.filter(row => row.kind === 'intake-admitted')).toHaveLength(2);
    const folded = turns(facts, (observation, request) => exactTelegramApiAcceptance(
      observation, request, facts, reference => built.storage.captures.read(reference), target), response => {
      const receipt = response.body.record.receipt;
      return JSON.parse(built.storage.captures.read(receipt.reference)).state === 'complete';
    }, binding.id);
    expect(folded.map(turn => turn.phase)).toEqual(phases);
    expect(value(app.owners.serving.inspect())).toMatchObject({ turns: 2, replies });
    expect(facts.filter(row => row.kind === 'assembly-HarnessLaunchSpec')).toHaveLength(2);
    expect(facts.filter(row => row.kind === 'session-grounding')).toHaveLength(2);
    const secondGrounding = facts.find(row => row.kind === 'session-grounding'
      && row.body.record?.run === folded[1].providerRun);
    expect(secondGrounding.body.record.messages.some(message => message.fact.id === folded[0].opening)).toBe(true);
    if (!firstUnknown) {
      const acceptedBytes = built.storage.captures.read(folded[0].acceptedReply);
      expect(facts.some(row => row.kind === 'effect-OutboundMessage'
        && row.body.record?.run === folded[1].providerRun
        && row.body.record?.purpose === 'context-delivery'
        && row.body.record?.text.includes(acceptedBytes))).toBe(true);
    }
    expect(facts.filter(row => row.kind === 'judgment-provider-ProviderAnswerAcceptance')).toHaveLength(replies);
    expect(folded.filter(turn => turn.replyRun && turn.replyRun !== turn.providerRun)).toHaveLength(replies);
    expect(built.calls.filter(call => call === 'sendMessage')).toHaveLength(replies);
    const latest = new Map(value(app.owners.transport.inspect())
      .filter(row => row.record.type === 'AdmissionReservation')
      .map(row => [row.record.operation, row.record]));
    const applications = new Map(value(app.owners.transport.inspect())
      .filter(row => row.record.type === 'SettlementApplication')
      .map(row => [row.record.operation, row.record]));
    expect([...latest.values()].reduce((total, reservation) => total +
      (applications.get(reservation.operation)?.exposure ?? reservation.charge), 0)).toBe(exposure);
    expect([...applications.values()].filter(row => row.actualCharge === 3 && row.released === 17)).toHaveLength(replies);
    expect([...applications.values()].filter(row => row.actualCharge === 0 && row.released === 20)).toHaveLength(2);
    app.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 400000);

it('keeps the installed owner turn grounded after its context operation is consumed', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-grounded-')));
  try {
    const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not run at the grounding checkpoint'); } }, { singleUpdate: true });
    const built = fixture.boot();
    const batch = value(built.api.poll({ token: built.declaration.token, apiVersion: built.declaration.apiVersion,
      offset: 0, limit: 100, timeout: 0 }));
    const binding = installServingBinding(built, batch.updates[0]);
    const installation = value(built.f.store.read()).find(row => row.kind === 'assembly-ProductionInstallation');
    value(built.application.owners.serving.registerQuiescence(() => true));
    value(built.application.owners.serving.bind('serving:grounded', built.f.effects.fence, {
      installation: installation.id, conversation: binding.id, ceiling: 100, maxTurns: 2,
      maxReplies: 1, expires: 500, providerMax: 20, replyMax: 5,
      errorLimit: 3, totalErrorLimit: 5 }));
    const route = extractTelegramUpdate(batch.updates[0], built.declaration).route;
    const received = value(built.application.owners.intake.receive(batch.updates[0], route));
    const input = value(built.f.store.read()).find(row => row.id === received.fact.id);
    built.f.bindIntake(input);
    value(built.application.owners.run.open(built.f.run));
    value(built.application.owners.serving.admitTurn(`turn:${input.id}`,
      built.f.effects.fence, input.id, built.f.id));
    built.placeTurn(input);
    built.receive = () => {};
    const reached = new Error('grounding checkpoint reached');
    await expect(runRecordedConversation(built, { requests: [], respond() {} }, stage => {
      if (stage !== 'provider-grounded') return;
      const facts = value(built.f.store.read());
      expect(facts.filter(row => row.kind === 'effect-provider-ProviderEffectRequest')).toHaveLength(0);
      expect(facts.filter(row => row.kind === 'transport-AdmissionReservation'
        && ['dispatch-claimed', 'consumed'].includes(row.body.record?.state))).not.toHaveLength(0);
      expect(turns(facts, undefined, undefined, binding.id).at(0)?.phase).toBe('grounded');
      throw reached;
    })).rejects.toBe(reached);
    built.application.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
