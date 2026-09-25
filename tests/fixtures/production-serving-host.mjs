import fs from 'node:fs';
import { createDecipheriv, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { extractTelegramUpdate } from '../../src/conversation/index.js';
import { runIdFor } from '../../src/rungraph/index.js';
import { runAdmission } from '../../src/rungraph/rungraph.js';
import { createProductionConversationHost, runConversationDriver } from '../../src/assembly/index.js';
import { turns, exactTelegramApiAcceptance } from '../../src/assembly/production-conversation-driver.js';
import { recordedCheckpoint } from '../assembly/production-boot-checkpoint.js';
import { runRecordedConversation, createRecordedServingPlan,
  recordedResponseEvidenceContract } from '../assembly/production-boot-trace.js';
import { registerProviderResponseEvidenceBounds } from '../../src/assembly/provider-invocation.js';
import { localProvider } from '../model-provider/http-provider.js';
import { value, privateKey, json } from '../facts/fixtures.js';

function durableJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data));
  const file = fs.openSync(path, 'r');
  try { fs.fsyncSync(file); } finally { fs.closeSync(file); }
  const directory = fs.openSync(dirname(path), 'r');
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}

/** Observe the already fsynced encrypted owner segment at its directory sync.
 * The decrypted bytes identify a test cut; no production owner is replaced. */
function recordCut(root, stage, checkpointPath, current) {
  const target = stage.includes('claim-kill') ? 'dispatch-claimed' : 'consumed';
  const provider = stage.startsWith('provider-');
  let pending = false;
  return { ...productionStorageIO,
    renameSync(from, to) {
      productionStorageIO.renameSync(from, to);
      if (to !== `${root}/facts.encrypted`) return;
      const sealed = JSON.parse(fs.readFileSync(to, 'utf8'));
      const cipher = createDecipheriv('aes-256-gcm', Buffer.from('13'.repeat(32), 'hex'),
        Buffer.from(sealed.nonce, 'hex'));
      cipher.setAAD(Buffer.from('machine-a:store:fact:facts'));
      cipher.setAuthTag(Buffer.from(sealed.tag, 'hex'));
      const raw = Buffer.concat([cipher.update(Buffer.from(sealed.ciphertext, 'base64')),
        cipher.final()]).toString('utf8');
      const rows = JSON.parse(raw).map(bytes => JSON.parse(bytes));
      const last = rows.at(-1);
      pending = last?.kind === 'transport-AdmissionReservation'
        && last.body.record.state === target
        && (provider ? rows.some(row => row.kind === 'effect-provider-ProviderEffectRequest'
          && row.body.record.id === last.body.record.request)
          : rows.some(row => row.kind === 'effect-EffectRequest'
            && row.body.record.id === last.body.record.request
            && rows.some(message => message.kind === 'effect-OutboundMessage'
              && message.body.record.id === row.body.record.message
              && message.body.record.purpose === 'ordinary-reply')));
    },
    fsyncSync(fd) {
      productionStorageIO.fsyncSync(fd);
      if (pending) {
        pending = false;
        durableJSON(checkpointPath, recordedCheckpoint(current(), stage));
        process.kill(process.pid, 'SIGKILL');
      }
    },
  };
}

/** Extend only the recorded offline Telegram response before constructing the
 * existing installed owner fixture. Each update remains captured and witnessed
 * by the real Ten custodian when it polls; no production owner is replaced. */
export async function installedServingFixture(root, route, options = {}) {
  const { installedFixtureHost } = await import('../assembly/production-boot-installed-fixture.js');
  const response = JSON.parse(fs.readFileSync('tests/assembly/telegram-recorded/poll-0.json', 'utf8'));
  if (!options.singleUpdate) {
    const next = structuredClone(response.result[0]);
    next.update_id += 1;
    next.message.message_id += 1;
    next.message.text = 'Distinct follow up';
    response.result.push(next);
  }
  const { singleUpdate: _singleUpdate, sequentialPoll: _sequentialPoll, ...rest } = options;
  return installedFixtureHost(root, route, { ...rest, pollResponse: request => {
    options.onPoll?.(request.body.offset);
    const eligible = response.result.filter(update => update.update_id >= request.body.offset);
    const next = options.sequentialPoll ? eligible.slice(0, 1) : eligible;
    return JSON.stringify({ ...response,
      result: next });
  } });
}

/** The existing installed fixture starts with a binding for another route.
 * Author an independent target grant and binding for the recorded bot user. */
export function installServingBinding(built, raw) {
  const extracted = extractTelegramUpdate(raw, built.declaration), route = extracted.route;
  const existing = value(built.f.store.read()).find(row => row.kind === 'conversation-binding'
    && row.body.channel === route.channel && row.body.sender === route.sender);
  if (existing) {
    built.t.intake.syncCaptures();
    for (const [reference, captured] of Object.entries(built.t.intake.context.captures))
      if (captured.bytes !== null && captured.bytes !== undefined)
        built.storage.captures.preserve(reference, captured.bytes);
    Object.assign(built.f.ctx.captures, built.t.intake.context.captures);
    Object.assign(built.f.ctx.decode.captures, built.t.intake.context.decode.captures);
    const principal = built.t.intake.f.principal(extracted.principal.id, 'person');
    if (!built.f.ctx.decode.principals.some(row => row.id === principal.id))
      built.f.ctx.decode.principals.push(principal);
    return existing;
  }
  const original = value(built.f.store.read()).find(row => row.kind === 'conversation-binding');
  const owner = original.principal;
  const principal = built.t.intake.f.principal(extracted.principal.id, 'person');
  const grant = built.t.intake.f.grant({ id: 'serving-target-grant', grantee: principal, scope: built.f.scope });
  built.t.intake.syncCaptures();
  for (const [reference, captured] of Object.entries(built.t.intake.context.captures))
    if (captured.bytes !== null && captured.bytes !== undefined)
      built.storage.captures.preserve(reference, captured.bytes);
  const schema = { ...built.f.ctx.schemas.find(row => row.kind === 'note'), kind: 'genesis-grant',
    fields: { grant: { kind: 'constitutional', type: 'StandingGrant' } } };
  Object.assign(built.f.ctx.captures, built.t.intake.context.captures);
  Object.assign(built.f.ctx.decode.captures, built.t.intake.context.decode.captures);
  Object.assign(built.f.ctx, { schemas: [...built.f.ctx.schemas, schema],
    decode: { ...built.f.ctx.decode, principals: [...built.f.ctx.decode.principals, principal] } });
  const grantContext = { ...built.f.ctx, decode: { ...built.f.ctx.decode, provenance: grant.source } };
  const target = value(authorAndAppend({ kind: 'genesis-grant', schemaVersion: 1,
    machine: built.f.host.machine, principal: json(owner), provenance: json(grant.source),
    at: json(built.f.now), required: original.predecessors.required,
    body: { grant: json(grant) } }, grantContext,
  createFactStore(grantContext, built.storage.segment), privateKey)).fact;
  const context = { ...built.f.ctx, decode: { ...built.f.ctx.decode, provenance: owner.provenance } };
  return value(authorAndAppend({ kind: 'conversation-binding', schemaVersion: 1,
    machine: built.f.host.machine, principal: json(owner), provenance: json(owner.provenance),
    at: json(built.f.now), required: [...original.predecessors.required, target.id],
    body: { ...original.body, channel: route.channel, sender: route.sender,
      identityEpoch: route.identityEpoch, principalId: extracted.principal.id,
      grantId: grant.id } }, context,
  createFactStore(context, built.storage.segment), privateKey)).fact;
}

/** Loaded by the real bin in the process test. Only physical IO is recorded;
 * admission, polling and driver progress use the installed owner factory. */
export async function createProductionHost() {
  const installation = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const action = process.env.INSTAR_SERVING_TEST_ACTION ?? 'binding';
  const checkpointPath = `${installation.storageRoot}/serving-pending-checkpoint.json`;
  const recovery = ['pending-resume', 'provider-resume', 'reply-resume', 'accepted-resume'].includes(action)
    ? JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) : undefined;
  const accepted = action.startsWith('accepted-');
  const http = action.startsWith('reply-') && action !== 'reply-resume'
    ? await localProvider() : null;
  const providerCut = action === 'provider-claim-kill' || action === 'provider-consume-kill';
  const replyCut = action === 'reply-claim-kill' || action === 'reply-consume-kill';
  const acceptedCut = action === 'accepted-reply-claim-kill' || action === 'accepted-reply-consume-kill';
  let fixture, acceptedPlan, acceptedBuilt;
  const route = Object.freeze({
    provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
    automaticRetries: 0, environment: 'local-test',
    invoke: async bytes => {
      if (action === 'provider-kill') {
        durableJSON(checkpointPath, recordedCheckpoint(fixture.state(), 'serving-provider-consumed'));
        process.kill(process.pid, 'SIGKILL');
      }
      if (http) {
        const response = await fetch(http.endpoint, { method: 'POST', body: bytes,
          headers: { Authorization: `Bearer ${http.credential}`, 'Content-Type': 'application/json' } });
        return response.json();
      }
      if (accepted) {
        const answer = JSON.stringify(acceptedBuilt.f.decisionInput());
        return { state: 'complete', bytes: answer, providerOperation: 'accepted-provider-operation',
          usage: { inputTokens: 11, outputTokens: 9, charge: 3, source: 'authenticated local provider receipt' },
          retryBlocked: false, responseEvidenceDraft: acceptedPlan.responseDraft(bytes, answer) };
      }
      throw Error('provider invocation is outside this binding test');
    },
  });
  if (accepted) registerProviderResponseEvidenceBounds(route, recordedResponseEvidenceContract);
  fixture = await installedServingFixture(installation.storageRoot, route, { ...(recovery ? { recovery } : {}),
    ...(providerCut || replyCut || acceptedCut ? { storageIO: recordCut(installation.storageRoot, action,
      checkpointPath, () => fixture.state()) } : {}),
    ...((action.startsWith('reply-') || accepted) ? { ...(accepted ? { sequentialPoll: true } : { singleUpdate: true }),
      ...(accepted ? { dynamicReplyResponse: true } : {}),
      physicalCheckpoint(stage, state) {
        if (action === 'accepted-resume') return;
        const target = action.endsWith('kill-before') ? 'reply-before-response' : 'reply-after-response';
        if (stage === target) {
          durableJSON(checkpointPath, recordedCheckpoint(state, stage));
          process.kill(process.pid, 'SIGKILL');
        }
      } } : {}) });
  return { ...fixture.host, async run(application) {
    const built = fixture.state(); built.application = application;
    if (accepted) {
      const raw = JSON.stringify(JSON.parse(fs.readFileSync(
        'tests/assembly/telegram-recorded/poll-0.json', 'utf8')).result[0]);
      const binding = installServingBinding(built, raw);
      const installationFact = value(built.f.store.read()).find(row => row.kind === 'assembly-ProductionInstallation');
      const target = extractTelegramUpdate(raw, built.declaration).target;
      acceptedBuilt = built;
      acceptedPlan = createRecordedServingPlan(built, target);
      let now = 100;
      const run = createProductionConversationHost({
        binding: { installation: installationFact.id, conversation: binding.id,
          ceiling: 100, maxTurns: 2, maxReplies: 2, expires: 500,
          providerMax: 20, replyMax: 5, errorLimit: 3, totalErrorLimit: 5 },
        fence: () => built.f.effects.fence, admitted: built.admitted,
        observer: built.owners.intake.author.principal.id, target, plan: acceptedPlan.plan,
        capture: reference => built.storage.captures.read(reference),
        now: () => now, stopped: () => false, executionQuiescent: () => true,
        maxContextTurns: 2, maxContextBytes: 4096, maxCycles: action === 'accepted-resume' ? 4 : 2,
        baseBackoffMs: 1, maxBackoffMs: 2, yieldBoundary: async () => {},
        sleep: async milliseconds => { now += milliseconds; }, nextAttempt: randomUUID,
      });
      await run.run(application);
      if (action !== 'accepted-resume') throw Error('accepted reply cut was not reached');
      const serving = value(application.owners.serving.inspect());
      const facts = value(built.f.store.read());
      const nextTurn = facts.filter(row => row.kind === 'intake-admitted').at(-1);
      if (!nextTurn || serving.turns !== 2) throw Error('recovered host did not drain distinct follow up');
      const folded = turns(facts, (observation, request) => exactTelegramApiAcceptance(
        observation, request, facts, reference => built.storage.captures.read(reference), target), response => {
        const receipt = response.body.record.receipt;
        return JSON.parse(built.storage.captures.read(receipt.reference)).state === 'complete';
      }, binding.id);
      fs.writeFileSync(`${installation.storageRoot}/serving-accepted-proof.json`, JSON.stringify({
        stage: recovery.stage, serving,
        first: recovery.run, second: runIdFor({ owner: 'part-two', name: 'FactEnvelope', id: nextTurn.id }),
        turns: folded.map(turn => ({ phase: turn.phase, providerRun: turn.providerRun,
          replyRun: turn.replyRun, opening: turn.opening })),
        groundings: facts.filter(row => row.kind === 'session-grounding').map(row => row.body.record.run),
        providerRequests: facts.filter(row => row.kind === 'effect-provider-ProviderEffectRequest').length,
        replyRequests: facts.filter(row => row.kind === 'effect-EffectRequest'
          && facts.some(message => message.kind === 'effect-OutboundMessage'
            && message.body.record?.id === row.body.record?.message
            && message.body.record?.purpose === 'ordinary-reply')).length,
        reservations: value(application.owners.transport.inspect()).filter(row =>
          row.record.type === 'AdmissionReservation').map(row => row.record),
        applications: value(application.owners.transport.inspect()).filter(row =>
          row.record.type === 'SettlementApplication').map(row => row.record),
        replies: value(built.f.store.read()).filter(row => row.kind === 'judgment-provider-ProviderAnswerAcceptance').length,
        calls: built.calls,
      }));
      return;
    }
    if (action.startsWith('reply-')) {
      if (action === 'reply-resume') {
        const rows = value(built.f.store.read());
        const request = rows.filter(row => row.kind === 'effect-EffectRequest').at(-1)?.body.record;
        if (!request) throw Error('recovered reply request absent');
        const raw = JSON.stringify(JSON.parse(fs.readFileSync(
          'tests/assembly/telegram-recorded/poll-0.json', 'utf8')).result[0]);
        const target = extractTelegramUpdate(raw, built.declaration).target;
        const { doorway } = application.owners.reply(built.admitted, target);
        let replay = 'accepted';
        try { value(doorway.dispatch(request, built.f.effects.fence)); }
        catch { replay = 'refused'; }
        fs.writeFileSync(`${installation.storageRoot}/serving-reply-proof.json`, JSON.stringify({
          stage: recovery.stage,
          replay,
          reservations: value(application.owners.transport.inspect()).filter(row =>
            row.record.type === 'AdmissionReservation').map(row => row.record),
          calls: built.calls,
        }));
        return;
      }
      await runRecordedConversation(built, http, async stage => {
        fs.writeFileSync(checkpointPath, JSON.stringify(recordedCheckpoint(built, stage)));
      });
      throw Error('reply kill checkpoint was not reached');
    }
    const batch = value(built.api.poll({ token: built.declaration.token,
        apiVersion: built.declaration.apiVersion, offset: 0, limit: 100, timeout: 0 }));
    const recorded = JSON.parse(fs.readFileSync('tests/assembly/telegram-recorded/poll-0.json', 'utf8'));
    const first = batch.updates[0] ?? JSON.stringify(recorded.result[0]);
    const binding = installServingBinding(built, first);
    const fact = value(built.f.store.read()).find(row => row.kind === 'assembly-ProductionInstallation');
    const target = extractTelegramUpdate(first, built.declaration).target;
    const servingBinding = { installation: fact.id, conversation: binding.id, ceiling: 100,
      maxTurns: 2, maxReplies: 1, expires: 500, providerMax: 20,
      replyMax: 5, errorLimit: 3, totalErrorLimit: 5 };
    if (action === 'provider-kill' || providerCut || action === 'provider-resume') {
      value(application.owners.serving.registerQuiescence(() => true));
      value(application.owners.serving.bind(`serving:${application.boot.installation.id}`,
        built.f.effects.fence, servingBinding));
      if (action === 'provider-kill' || providerCut) {
        const bindIntake = built.f.bindIntake;
        built.f.bindIntake = input => {
          bindIntake(input);
          const opened = value(application.owners.run.open(built.f.run));
          value(application.owners.serving.admitTurn(`turn:${input.id}`,
            built.f.effects.fence, input.id, opened.run.id));
        };
        await runRecordedConversation(built, { respond() {}, requests: [] },
          async stage => { recordedCheckpoint(built, stage); });
        throw Error('provider kill checkpoint was not reached');
      }
      const unavailableStep = () => { throw Error('uncertain provider must not be called again'); };
      await runConversationDriver(application, {
        serving: { port: application.owners.serving, fence: built.f.effects.fence },
        conversation: servingBinding.conversation,
        generation: application.boot.installation.generation, lease: built.f.effects.fence.assignment,
        expiresAt: servingBinding.expires, replyLimit: 1, errorLimit: 3, totalErrorLimit: 5,
        maxContextTurns: 2, maxContextBytes: 4096, telegramTarget: target,
        pollOnce: () => {}, ground: unavailableStep, dispatchProvider: unavailableStep,
        acceptAndPrepareReply: unavailableStep, dispatchReply: unavailableStep,
        capture: reference => built.storage.captures.read(reference),
        now: () => built.f.deps.clock().value, stopped: () => false,
        maxCycles: 1, baseBackoffMs: 1, maxBackoffMs: 2,
        yieldBoundary: async () => {}, sleep: async () => {}, nextAttempt: randomUUID,
      });
      const followUp = structuredClone(recorded.result[0]);
      followUp.update_id += 1;
      followUp.message.message_id += 1;
      followUp.message.text = 'Distinct follow up';
      const next = batch.updates[1] ?? JSON.stringify(followUp);
      const received = value(application.owners.intake.receive(next,
        extractTelegramUpdate(next, built.declaration).route));
      if (received.kind !== 'admitted') throw Error('distinct recovered input was not admitted');
      const input = value(built.f.store.read()).find(row => row.id === received.fact.id);
      const reference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
      const opening = reference(input);
      const run = { ...built.f.run, id: runIdFor(opening), opening,
        intent: { type: 'Intent', id: input.body.intent.id, fact: opening, field: 'intent' },
        authority: { resolution: opening, grants: [] },
        resultDestination: { ...built.f.run.resultDestination, route: opening } };
      const second = value(application.owners.run.open(run));
      value(application.owners.serving.admitTurn(`turn:${input.id}`,
        built.f.effects.fence, input.id, second.run.id));
      fs.writeFileSync(`${installation.storageRoot}/serving-provider-proof.json`, JSON.stringify({
        serving: value(application.owners.serving.inspect()),
        first: built.f.id,
        second: second.run.id,
        reservations: value(application.owners.transport.inspect()).filter(row =>
          row.record.type === 'AdmissionReservation').map(row => row.record),
        calls: built.calls,
      }));
      return;
    }
    if (action === 'pending-kill' || action === 'pending-resume') {
      value(application.owners.serving.registerQuiescence(() => true));
      value(application.owners.serving.bind(`serving:${application.boot.installation.id}`,
        built.f.effects.fence, servingBinding));
      if (action === 'pending-kill') fs.writeFileSync(checkpointPath,
        JSON.stringify(recordedCheckpoint(built, 'serving-poll-start')));
      const unavailableStep = () => { throw Error('no turn may be executed in the pending poll fixture'); };
      await runConversationDriver(application, {
        serving: { port: application.owners.serving, fence: built.f.effects.fence },
        conversation: servingBinding.conversation,
        generation: application.boot.installation.generation, lease: built.f.effects.fence.assignment,
        expiresAt: servingBinding.expires, replyLimit: 1, errorLimit: 3, totalErrorLimit: 5,
        maxContextTurns: 2, maxContextBytes: 4096, telegramTarget: target,
        pollOnce: () => { if (action === 'pending-kill') process.kill(process.pid, 'SIGKILL'); },
        ground: unavailableStep, dispatchProvider: unavailableStep,
        acceptAndPrepareReply: unavailableStep, dispatchReply: unavailableStep,
        capture: reference => built.storage.captures.read(reference),
        now: () => built.f.deps.clock().value, stopped: () => false,
        maxCycles: 1, baseBackoffMs: 1, maxBackoffMs: 2,
        yieldBoundary: async () => {}, sleep: async () => {},
        nextAttempt: () => action === 'pending-kill' ? `poll:killed:${randomUUID()}` : `poll:resumed:${randomUUID()}`,
      });
      fs.writeFileSync(`${installation.storageRoot}/serving-pending-proof.json`, JSON.stringify({
        serving: value(application.owners.serving.inspect()), calls: built.calls,
      }));
      return;
    }
    const unavailable = () => { throw Error('unexpected owner preparation after bounded first poll'); };
    const run = createProductionConversationHost({
      binding: servingBinding,
      fence: () => built.f.effects.fence, admitted: built.admitted,
      observer: built.owners.intake.author.principal.id,
      target, plan: { open: unavailable, grounding: unavailable, pending: unavailable,
        question: unavailable, providerEffect: unavailable, acceptance: unavailable,
        replyOpening: unavailable, replyPolicy: unavailable, replyRoute: unavailable,
        replyEffect: unavailable },
      capture: reference => built.storage.captures.read(reference),
      now: () => built.f.deps.clock().value, stopped: () => false,
      executionQuiescent: () => true,
      maxContextTurns: 2, maxContextBytes: 4096, maxCycles: 1,
      baseBackoffMs: 1, maxBackoffMs: 2,
      yieldBoundary: async () => {}, sleep: async () => {},
    });
    await run.run(application);
    fs.writeFileSync(`${installation.storageRoot}/serving-bin-proof.json`, JSON.stringify({
      owner: application.owners.serving.owner,
      serving: value(application.owners.serving.inspect()),
      intake: value(built.f.store.read()).filter(row => row.kind === 'intake-admitted').length,
      calls: built.calls,
    }));
  } };
}
