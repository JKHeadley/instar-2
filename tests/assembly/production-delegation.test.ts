// @ts-nocheck -- isolated installed-host evidence uses explicit fixture standing, never a live installation.
import { canonical, decode } from '../../src/index.js';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate as yieldToRunner } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { delegationFactSchema, placeDelegation } from '../../src/rungraph/index.js';
import { createThreadlineKeyCustody, threadlineIdentityFromSeeds, threadlineParserDeclarationId,
  threadlineAuthenticationMethod, threadlineIntakeRoute } from '../../src/transport/index.js';
import { createProductionDelegatedWorker } from '../../src/assembly/production-delegated-work.js';
import { createProductionIntakeCaptures } from '../../src/assembly/production-captures.js';
import { decodeOutboundMessage, createEffectSpine, installOperationDefinition } from '../../src/effects/index.js';
import { verificationInput } from '../verification/fixture.js';
import { installedFixtureHost } from './production-boot-installed-fixture.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { value, refused, json, privateKey } from '../facts/fixtures.js';
import { openPreviewJournal } from '../preview/journal.js';
import { CollaborationSurfacer } from '../preview/collaboration-hub.js';
import { connectProductionCollaboration } from '../preview/production-collaboration.js';
import { createAttentionSurface } from '../preview/attention-surface.js';

function witnessOperation(state, api, operation) {
  const f = state.f, rows = value(api.inspect());
  const response = rows.find(row => row.record.type === 'OperationObservation'
    && row.record.operation === operation && row.record.stage === 'response').record;
  const request = rows.find(row => row.record.type === 'EffectRequest' && row.record.id === response.request).record;
  if (!value(state.runtime.inspectCurrent()).some(row => row.record.type === 'VerificationPlan' && row.record.id === 'delegated-context-plan')) {
    const plan = verificationInput('VerificationPlan');
    value(state.runtime.record('VerificationPlan', { ...plan, id: 'delegated-context-plan',
      subject: { ...plan.subject, generation: f.run.generation.id },
      bar: { ...plan.bar, version: 'live-input-bar', sources: ['probe'] } }));
  }
  for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 0], ['old-executor-quiescent', null]]) {
    if (f.evidence.some(item => item.id === `${operation}:${predicate}`)) continue;
    const capture = response.capture;
    f.ctx.decode.captures[capture.reference] = f.ctx.captures[capture.reference].bytes;
    const evidence = value(decode('Evidence', f.evidenceInput({ id: `${operation}:${predicate}`, capture,
      claim: { subject: operation, predicate, value: { digest: request.digest, ...(amount === null ? {} : { amount }) } },
      source: 'probe', observedAt: f.deps.clock(), freshFor: 100, strength: 'proof' }), f.ctx.decode));
    f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
  }
}

function completeRecordedWork(h, localRun, bindResult = true) {
  const { f, runtime } = h.built, run = value(h.built.application.owners.run.read(localRun));
  const api = h.built.application.owners.composition.production.effect.port;
  const request = h.workRequests.get(localRun);
  const reservation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
    && row.record.request === request.id).at(-1).record;
  witnessOperation(h.built, api, reservation.operation);
  const plan = verificationInput('VerificationPlan');
  value(runtime.record('VerificationPlan', { ...plan, id: run.run.exitTest.check,
    subject: { ...plan.subject, governed: run.run.exitTest.subject, generation: run.run.generation.id },
    bar: { ...plan.bar, version: run.run.exitTest.version, subjectDigest: run.run.exitTest.acceptance, sources: ['probe'] } }));
  const probe = { ...verificationInput('ProbeRecord'), id: `completion:${localRun}`,
    plan: run.run.exitTest.check, planVersion: run.run.exitTest.version, subject: run.run.exitTest.subject,
    run: localRun, operation: reservation.operation, startedAt: 100, completedAt: 100,
    witnesses: [`completion-witness:${localRun}`] };
  const witness = value(decode('Evidence', f.evidenceInput({ id: probe.witnesses[0], observedAt: f.deps.clock(),
    claim: { subject: probe.subject, predicate: 'probe-passed', value: {
      challengeDigest: probe.challengeDigest, subjectDigest: run.run.exitTest.acceptance,
      plan: probe.plan, planVersion: probe.planVersion, arm: probe.arm, slot: probe.slot,
      attempt: probe.attempt, run: localRun, operation: probe.operation, comparison: probe.comparison } },
    source: 'probe', freshFor: 1000, strength: 'proof' }), f.ctx.decode));
  f.evidence.push(witness); f.append('evidence-record', json({ evidence: witness }), [run.run.opening.id]);
  value(runtime.record('ProbeRecord', probe));
  const check = value(decode('Evidence', f.evidenceInput({ id: `exit-check:${localRun}`, observedAt: f.deps.clock(),
    claim: { subject: run.run.exitTest.subject, predicate: `exit:${probe.plan}:${probe.planVersion}`,
      value: run.run.exitTest.acceptance }, source: 'probe', freshFor: 1000, strength: 'proof' }), f.ctx.decode));
  f.evidence.push(check);
  const outcome = { terminal: 'completed', result: 'Bounded native context consumed' };
  const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value: outcome,
    capacity: { kind: 'none' } }, f.ctx.decode));
  const resultFact = f.append('result-record', json({ result }), [run.run.opening.id]).fact;
  const checkFact = f.append('evidence-record', json({ evidence: check }),
    [run.run.opening.id, ...(bindResult ? [resultFact.id] : [])]).fact;
  const ref = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
  h.setCompletion({ result: { type: 'Result', id: `result:${localRun}`, fact: ref(resultFact), field: 'result' },
    check: ref(checkFact), evidence: [{ type: 'Evidence', id: check.id, fact: ref(checkFact), field: 'evidence' }] });
  return { outcome, reservation };
}

function fixture(withWork = false, forum = false, provider = false, shapeIndex = 0) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-delegation-')));
  const identity = threadlineIdentityFromSeeds(new Uint8Array(32).fill(61), new Uint8Array(32).fill(62));
  const queue = [], sent = [];
  const workRequests = new Map();
  const providerRequests = [];
  let completion = null;
  let epoch = 'enrollment:fixture', built, policy, grantReference;
  const advertisement = () => ({ agent: 'bob', machine: 'machine-a', harness: 'native', model: 'model',
    transport: 'threadline-ref-v2', capabilities: ['work'], observedAt: 100, freshFor: 1000, capacity: 1, trust: 'trusted' });
  const poll = JSON.parse(readFileSync('tests/assembly/telegram-recorded/poll-0.json', 'utf8'));
  if (forum) Object.assign(poll.result[0].message, { chat: { id: -1007654321000, type: 'supergroup', is_forum: true }, message_thread_id: 42 });
  const installed = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route',
    disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
    invoke: async (bytes, bounds) => {
      if (!provider) throw Error('no model/provider call is permitted');
      providerRequests.push({ bytes, bounds });
      // Historical raw output reaches the actual provider dispatch. Without
      // independent usage/settlement evidence it must remain unknown; this is
      // not evidence that a foreign output passed Seven's Decision parser.
      const corpus = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8'));
      return { state: 'complete', bytes: corpus.otherShapes[shapeIndex].raw, providerOperation: 'isolated-recorded-shape', retryBlocked: false,
        usage: { inputTokens: null, outputTokens: null, charge: null, source: 'recorded replay; no inferred usage' } };
    } }, {
    ...(forum ? { pollResponse: JSON.stringify(poll) } : {}),
    mutate(state, owners) {
      const { f, t } = state, c = f.ctx;
      const parser = t.intake.r.declaration(threadlineParserDeclarationId, 'parsers', { fixture: 'check',
        authenticationClass: [{ stimulusType: 'message', class: 'channel-attested' }],
        eventIdAuthority: { mintedBy: 'Threadline authenticated protocol envelope key and attempt',
          uniquenessScope: 'channel, sender, enrollment, key, attempt', replayWindow: 0,
          fallbackFingerprint: { policy: 'none', basis: 'signed protocol identities required' } }, ackPolicy: 'bound-only' },
      { profile: t.intake.r.profile });
      owners.intake.governance = t.intake.govern([...t.declarations, parser]).governance;
      c.decode.register = { ...c.decode.register, entries: [...c.decode.register.entries, threadlineParserDeclarationId],
        methods: [...c.decode.register.methods, threadlineAuthenticationMethod] };
      f.deps.context.register = c.decode.register;
      c.schemas = [...c.schemas, delegationFactSchema(f.schema), { ...f.schema, kind: 'delegation-standing',
        fields: { grant: { kind: 'constitutional', type: 'StandingGrant' } } }];
      const grant = f.grants.find(row => row.id === 'live-input-agent-grant');
      const grantContext = { ...c, decode: { ...c.decode, provenance: grant.source } };
      const fact = value(authorAndAppend({ kind: 'delegation-standing', schemaVersion: 1, body: json({ grant }),
        machine: 'machine-a', principal: json(f.alice), provenance: json(grant.source), at: json(f.deps.clock()), required: [] },
      grantContext, createFactStore(grantContext, state.storage.segment), privateKey)).fact;
      grantReference = { type: 'StandingGrant', id: grant.id,
        fact: { owner: 'part-two', name: 'FactEnvelope', id: fact.id }, field: 'grant' };
      f.run.authority.grants = [grantReference];
      f.run.budget.maxChildren = 2; f.run.budget.maxDepth = 3;
      policy = structuredClone(f.run);
      const keys = createThreadlineKeyCustody({ principal: 'bob', identity,
        peer: principal => principal === 'bob' && epoch ? identity.public : undefined, random: randomBytes });
      owners.delegation = { keys, capture: createProductionIntakeCaptures({ custody: state.storage.captures, context: f.c, metadata: c.captures, decodeCaptures: c.decode.captures }), epoch: () => epoch, policyRun: () => policy.id,
        relay: { submit(frame) { queue.push(frame); sent.push(frame); return 'accepted'; },
          collect(principal) { const selected = queue.filter(frame => frame.recipient === principal);
            for (const frame of selected) queue.splice(queue.indexOf(frame), 1); return selected; } },
        context: () => ({ ...f.deps.context, facts: { ...c, facts: value(f.store.read()) } }),
        advertisement, advertisements: () => [advertisement()],
        fence: () => f.effects.fence, work: {
          placement(contract, run) {
            if (!withWork) throw Error('no installed work prepared yet');
            const opening = value(f.store.read()).find(row => row.id === run.run.opening.id);
            state.placeTurn(opening); Object.assign(f.run, run.run);
            return f.success(f.lease);
          },
          plan(contract, run) {
            const opening = value(f.store.read()).find(row => row.id === run.run.opening.id);
            const api = state.application.owners.composition.production.effect.port;
            const contextResponse = value(api.inspect()).filter(row => row.record.type === 'OperationObservation'
              && row.record.stage === 'response' && value(api.inspect()).some(q => q.record.type === 'EffectRequest'
                && q.record.id === row.record.request && q.record.run === run.run.id)).at(-1).record;
            witnessOperation(state, api, contextResponse.operation);
            value(f.effects.transport.settle(f.effects.fence, value(api.settle(contextResponse.operation))));
            const deliveredContext = value(api.inspect()).filter(row => row.record.type === 'OutboundMessage'
              && row.record.run === run.run.id && row.record.context).at(-1).record.context;
            const message = value(decodeOutboundMessage({ ...f.effects.message(run.run.id, contract.task.question),
              id: `work:${contract.id}`, semanticMessage: `work:${contract.id}`, text: contract.task.question,
              sourceResult: opening.id, context: deliveredContext }, f.owners.host));
            const obligation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'LoopRecord'
              && row.record.run === run.run.id).at(-1).fact.id;
            const request = value(f.effects.api.prepare({ definition: 'live-input-definition:1', message,
              run: { owner: 'part-five', name: 'Run', id: run.run.id }, pending: run.run.opening.id,
              attempt: `attempt:${contract.id}`, verificationOwner: 'probe', obligation, closure: [], fence: f.effects.fence }));
            workRequests.set(run.run.id, request);
            const reservation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
              && row.record.request === request.id).at(-1);
            return f.success({ ownership: f.lease, operation: { key: request.semanticMessage, digest: request.digest,
              classification: run.run.opening }, reservation: { owner: 'part-six', name: 'AdmissionReservation', id: reservation.fact.id } });
          },
          settlement(contract, run) {
            const request = workRequests.get(run.run.id);
            const reservation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
              && row.record.request === request.id).at(-1);
            const api = state.application.owners.composition.production.effect.port;
            const settled = value(api.settle(reservation.record.operation));
            value(f.effects.transport.settle(f.effects.fence, settled));
            const fact = value(f.effects.api.inspect()).find(row => row.record.type === 'EffectSettlement' && row.record.id === settled.id).fact;
            return f.success({ fact: { owner: 'part-two', name: 'FactEnvelope', id: fact.id },
              outcome: { type: 'Outcome', id: `outcome:${fact.id}`, fact: { owner: 'part-two', name: 'FactEnvelope', id: fact.id }, field: 'outcome' } });
          }, completion: () => f.success(completion) } };
      if (provider) {
        c.decode.register.entries.push('provider-call');
        owners.delegation.provider = { definition: 'delegated-provider-definition', verificationOwner: 'probe',
          context: (_contract, run) => {
            const api = state.application.owners.composition.production.effect.port;
            const response = value(api.inspect()).filter(row => row.record.type === 'OperationObservation' && row.record.stage === 'response'
              && value(api.inspect()).some(q => q.record.type === 'EffectRequest' && q.record.id === row.record.request && q.record.run === run.run.id)).at(-1);
            witnessOperation(state, api, response.record.operation);
            return 'Recorded context through the native grounding owner.';
          }, evidence: () => ['e1', 'e2'] };
      }
    } });
  try {
    built = installed.boot();
    built.receive(built.application);
    built.f.run.authority.grants = [grantReference];
    built.f.run.budget.maxChildren = 2; built.f.run.budget.maxDepth = 3;
    policy = structuredClone(built.f.run);
    value(built.application.owners.run.open(built.f.run));
    if (withWork) value(built.application.owners.run.ground(built.f.id, 'w', 'native', 'start', built.f.lease));
    const parent = built.f.id, composition = built.application.owners.delegation;
    const request = { intent: 'fixture:delegated-task', recipient: 'bob', question: 'Perform the bounded recorded work',
      method: ['no provider calls'], scope: ['project-a'], actions: ['harness-live-input'], budget: 1,
      exitTest: { check: policy.exitTest.check, version: policy.exitTest.version, evidence: policy.exitTest.evidenceKinds },
      placement: value(placeDelegation(['work'], [advertisement()], 100, built.f.c)), conversation: 'recorded-thread',
      resultDestination: { run: parent, edge: null }, childLimit: { maxChildren: 0, maxDepth: 3 },
      collectionCadence: 1000, durability: 'local-durable', sequence: 1 };
    return { root, built, parent, composition, request, sent, workRequests, providerRequests, setCompletion: next => { completion = next; }, setEpoch: next => { epoch = next; },
      close() { built.application.close(); rmSync(root, { recursive: true, force: true }); } };
  } catch (error) { built?.application.close(); rmSync(root, { recursive: true, force: true }); throw error; }
}

it('the actual production caller derives the offer from its Run, receives authenticated Four custody and opens one receiving Run', () => {
  const f = fixture();
  try {
    const contract = value(f.composition.delegate(f.parent, f.request));
    const rejected = f.composition.pump();
    if (rejected.length) value(f.composition.intake.receive(value(canonical(f.sent[0])).bytes, threadlineIntakeRoute(f.sent[0], 'enrollment:fixture')));
    expect(rejected).toEqual([]);
    const edge = f.composition.ledger.view().get(contract.id);
    if (!edge.acceptance) value(f.composition.authority.admit(contract, f.built.f.deps.clock().value));
    expect(edge.acceptance).toMatchObject({ recipient: 'bob' });
    expect(edge.executable).toBe(true);
    expect(value(f.built.application.owners.run.read(edge.acceptance.localRun)).state).toBe('ready');
    const before = f.sent.filter(frame => frame.kind === 'envelope').length;
    value(f.composition.collect(contract.id)); f.composition.pump();
    expect(f.sent.filter(frame => frame.kind === 'envelope')).toHaveLength(before);
    expect(f.composition.collectDue()).toHaveLength(1);
    expect(f.composition.collectDue()).toHaveLength(0);
    expect(f.sent.filter(frame => frame.kind === 'envelope')).toHaveLength(before);
  } finally { f.close(); }
}, 60000);

it.each(['summary-writer', 'summary-uncertain', 'jev-undecided', 'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context'].map((kind, index) => ({ kind, index })))(
  'the installed provider branch submits $kind through Seven/Eight/Six once and retains unknown accounting', async ({ index }) => {
  const h = fixture(true, false, true, index);
  try {
    const f = h.built.f;
    const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'delegated-provider-definition', feature: 'provider-call',
      version: 'delegated-provider-version', generation: f.run.generation.id, adapter: 'route', account: 'test-provider',
      conversation: 'recorded provider', speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash,
      durability: 'local-durable', replicas: 0, lossModel: 'Isolated recorded bytes only.', maxBytes: 4096,
      maxCharge: 20, timeout: 100, verificationBar: 'provider-bar' };
    const approval = f.authorize({ id: 'isolated-provider-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'isolated-provider-base' });
    const current = f.owners.host.current;
    f.owners.host.current = () => ({ ...current(), versions: [...current().versions,
      { id: definition.version, subject: definition.feature, content: json(definition), contentHash: value(canonical(definition)).hash,
        since: f.opening.id, supersedes: [], approvedIn: approval, base: approval.base, landedIn: null }] });
    value(installOperationDefinition(definition, f.owners.host, createEffectSpine(f.owners.host, { context: f.ctx, privateKey }, f.store)));
    for (const evidence of [...f.evidence]) f.append('evidence-record', json({ evidence }));
    const plan = verificationInput('VerificationPlan');
    value(h.built.runtime.record('VerificationPlan', { ...plan, id: 'boot-provider-plan',
      subject: { ...plan.subject, generation: f.run.generation.id }, bar: { ...plan.bar, version: 'provider-bar', sources: ['probe'] } }));
    const contract = value(h.composition.delegate(h.parent, { ...h.request, actions: ['provider-call', 'harness-live-input'] }));
    h.composition.pump();
    const localRun = h.composition.ledger.view().get(contract.id).acceptance.localRun;
    value(h.composition.authority.start(contract, localRun, 100));
    expect(await h.composition.workAsync()).toEqual([]);
    expect(h.providerRequests).toHaveLength(1);
    expect(h.providerRequests[0].bounds).toMatchObject({ maxTokens: 128, timeout: 100, automaticRetries: 0 });
    expect(await h.composition.workAsync()).toEqual([]);
    expect(h.providerRequests).toHaveLength(1);
    expect(h.composition.ledger.view().get(contract.id)).toMatchObject({ owned: true, result: null });
  } finally { h.close(); }
}, 60000);

it('the installed journal consumer binds only the real Four parent, restores custody and preserves operator moves', async () => {
  const f = fixture(false, true);
  const update = JSON.parse(f.built.raw);
  const bot = String(f.built.t.declaration.bot.id), id = `telegram:${bot}:update:${update.update_id}`;
  const journal = openPreviewJournal(join(f.root, 'collaboration-journal'), new Uint8Array(32).fill(79), {
    kind: 'genesis', bot, chat: '-1007654321000', operator: String(update.message.from.id), forum: true,
    grant: 'isolated-production-journal', configurationDigest: 'sha256:offline', expires: 100000,
    maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const sent = [];
  const hub = new CollaborationSurfacer({ state: () => journal.view.collaboration, append: row => journal.append(row),
    admitted: () => true, now: () => 100, replicated: async () => true, operator: receipt => receipt === 'isolated-operator',
    topics: () => [{ topicId: 42, topicName: 'Build' }, { topicId: 43, topicName: 'Review' }],
    effect: async (id, effect) => { sent.push({ id, effect }); return { kind: 'accepted', id: sent.length, receipt: `isolated:${id}` }; } });
  const binding = connectProductionCollaboration({ owners: f.built.application.owners, hub, view: () => journal.view,
    append: row => journal.append(row), now: () => 100, admitted: () => true });
  try {
    await binding.maintain();
    const first = f.composition.ledger.view().size;
    expect(refused(binding.delegate(f.parent, f.request))).toMatch(/exact admitted conversation topic/);
    expect(f.sent).toHaveLength(0); // Durable parent edge may exist; no remote send without the origin.
    expect(f.composition.ledger.view().size).toBe(first + 1);
    journal.append({ kind: 'intake', id, update: update.update_id, raw: f.built.raw, text: update.message.text,
      accepted: true, thread: 42, cursor: update.update_id + 1, at: 100 });
    const contract = value(binding.delegate(f.parent, f.request));
    await binding.maintain();
    expect(f.composition.ledger.view().get(contract.id).acceptance).not.toBeNull();
    expect(hub.list().inbox).toHaveLength(0); // The actual local-agent guard suppresses self chatter.
    expect(hub.list().threads[0].parent).toBe(42);
    expect(journal.view.commitments).toHaveLength(0);
    expect(sent.some(row => row.effect.kind === 'topic')).toBe(false);
    await hub.bind({ threadId: contract.transport.conversation, targetTopicId: 43, operatorReceipt: 'isolated-operator' });
    f.composition.recover(); await binding.maintain();
    expect(hub.list().threads[0]).toMatchObject({ parent: 43, originTopic: 42 });
    expect(sent).toHaveLength(0);
    value(f.composition.cancel(contract.id, 'bounded task cancelled'));
    const count = f.sent.filter(frame => frame.kind === 'envelope').length;
    value(f.composition.cancel(contract.id, 'different retry wording'));
    expect(f.sent.filter(frame => frame.kind === 'envelope')).toHaveLength(count);
    let calls = 0;
    expect(f.composition.work(() => { calls++; return null; })).toEqual([]);
    expect(calls).toBe(0);
    expect(f.composition.ledger.view().get(contract.id).result).toBeNull();
    expect(f.composition.ledger.view().get(contract.id).owned).toBe(true);
    const attention = createAttentionSurface(journal, { now: () => 100, machine: 'machine-a', admitted: () => true,
      replicated: async () => true, delegations: () => [...f.composition.ledger.view().values()] });
    await attention.maintain();
    expect(attention.list().items.find(item => item.id.includes('delegation-cancel-pending'))).toMatchObject({ status: 'OPEN' });
    const size = journal.size; await attention.maintain(); expect(journal.size).toBe(size);
    const withoutOwner = createAttentionSurface(journal, { now: () => 100, machine: 'machine-a', admitted: () => true,
      replicated: async () => true });
    await withoutOwner.maintain();
    expect(journal.size).toBe(size); // Missing owner evidence cannot report recovery.
    expect(sent).toHaveLength(0);
  } finally { journal.close(); f.close(); }
}, 60000);

it('production callers refuse unknown parents, expanded scope and unknown collection without creating an edge', () => {
  const f = fixture();
  try {
    const before = f.composition.ledger.view().size;
    expect(refused(f.composition.delegate('run:unknown', f.request))).toMatch(/opening missing/);
    expect(refused(f.composition.delegate(f.parent, { ...f.request, scope: ['another-project'] }))).toMatch(/scope exceeds/);
    expect(refused(f.composition.collect('edge:unknown'))).toMatch(/unknown owned edge/);
    expect(f.composition.ledger.view().size).toBe(before);
    expect(f.sent).toHaveLength(0);
    f.composition.connectProjection({ custody() {}, origin() { f.built.f.stop(); } });
    expect(refused(f.composition.delegate(f.parent, f.request))).toMatch(/current accountable parent/);
    expect(f.sent).toHaveLength(0); // Projection cannot carry stale authority across its callback.
  } finally { f.close(); }
}, 60000);

it('forged or stale contracts, stop and an unavailable execution path never reach the worker', () => {
  const f = fixture();
  try {
    const contract = value(f.composition.delegate(f.parent, f.request));
    f.composition.pump();
    const edge = f.composition.ledger.view().get(contract.id);
    expect(refused(f.composition.authority.admit({ ...contract, budget: contract.budget + 1 }, 100)))
      .toMatch(/exact durable contract/);
    expect(refused(f.composition.authority.start(contract, 'run:forged', 100))).toMatch(/recipient mapping/);
    expect(refused(f.composition.authority.start(contract, edge.acceptance.localRun, 101))).toMatch(/future owner observation/);
    let calls = 0;
    expect(f.composition.work(() => { calls++; return null; })).toEqual([]);
    expect(calls).toBe(0);
    f.built.f.stop();
    expect(refused(f.composition.delegate(f.parent, { ...f.request, sequence: 2 }))).toMatch(/current accountable parent/);
    expect(refused(f.composition.authority.start(contract, edge.acceptance.localRun, 100))).toMatch(/installation stopped/);
    expect(f.composition.work(() => { calls++; return null; })).toEqual([]);
    expect(calls).toBe(0);
    expect(f.composition.ledger.view().get(contract.id).owned).toBe(true);
  } finally { f.close(); }
}, 60000);

it('unknown current key custody preserves Four intake but never accepts a receiving Run', () => {
  const f = fixture();
  try {
    const contract = value(f.composition.delegate(f.parent, f.request));
    f.setEpoch(null);
    expect(f.composition.pump()).toMatchObject([{ reason: 'intake-refused' }]);
    expect(f.composition.ledger.view().get(contract.id).acceptance).toBeNull();
    const held = value(f.built.f.store.read()).filter(row => row.kind === 'intake-held');
    expect(held.at(-1).body.reason).toBe('unresolved-sender');
    value(f.built.f.effects.transport.release('isolated-delegation-release', f.built.f.effects.fence));
    const sent = f.sent.length;
    expect(refused(f.composition.cancel(contract.id, 'old owner cannot cancel'))).toMatch(/lease|fence/);
    expect(f.sent).toHaveLength(sent);
    expect(f.composition.ledger.view().get(contract.id).cancellation).toBe('none');
  } finally { f.close(); }
}, 60000);


it('the configured production worker dispatches only the admitted Eight operation and retains an unverified result', async () => {
  const h = fixture(true);
  try {
    const contract = value(h.composition.delegate(h.parent, h.request));
    h.composition.pump();
    const localRun = h.composition.ledger.view().get(contract.id).acceptance.localRun;
    value(h.composition.authority.start(contract, localRun, 100));
    expect(value(h.built.application.owners.run.read(localRun)).pending).toHaveLength(1);
    value(h.composition.authority.start(contract, localRun, 100));
    let failure = null, calls = 0;
    const worker = createProductionDelegatedWorker({ graph: h.built.application.owners.run,
      effect: h.built.application.owners.composition.production.effect.port, transport: h.built.f.effects.transport,
      fence: () => h.built.f.effects.fence, recover: () => h.built.f.success(null) });
    expect(await h.composition.workAsync(async (...args) => {
      calls++;
      try { return await worker(...args); } catch (error) { failure = String(error); throw error; }
    })).toEqual([]);
    expect(failure).toBeNull();
    expect(calls).toBe(1);
    const request = h.workRequests.get(localRun);
    const observations = value(h.built.f.effects.api.inspect()).filter(row => row.record.type === 'OperationObservation'
      && row.record.request === request.id && row.record.stage === 'response');
    expect(observations).toHaveLength(1);
    expect(await h.composition.workAsync()).toEqual([]);
    expect(value(h.built.f.effects.api.inspect()).filter(row => row.record.type === 'OperationObservation'
      && row.record.request === request.id && row.record.stage === 'response')).toHaveLength(1);
    expect(h.composition.ledger.view().get(contract.id).owned).toBe(true);
  } finally { h.close(); }
}, 60000);

it('recorded completion passes real Eight settlement, Six accounting and Nine exit before returning once', async () => {
  const h = fixture(true);
  try {
    const contract = value(h.composition.delegate(h.parent, h.request)); h.composition.pump();
    const localRun = h.composition.ledger.view().get(contract.id).acceptance.localRun;
    expect(await h.composition.workAsync()).toEqual([]);
    const { outcome } = completeRecordedWork(h, localRun);
    value(h.composition.authority.reconcile(contract, localRun, 100));
    expect(value(h.built.application.owners.run.read(localRun)).state).toBe('completed');
    expect(await h.composition.workAsync()).toHaveLength(1);
    expect(await h.composition.workAsync()).toEqual([]);
    expect(value(h.composition.authority.collect(contract, localRun)).outcome).toEqual(outcome);
    h.built.f.stop();
    expect(value(h.composition.authority.collect(contract, localRun)).outcome).toEqual(outcome);
  } finally { h.close(); }
}, 60000);

it('an otherwise passing recorded exit check cannot close a different unbound result', async () => {
  const h = fixture(true);
  try {
    const contract = value(h.composition.delegate(h.parent, h.request)); h.composition.pump();
    const localRun = h.composition.ledger.view().get(contract.id).acceptance.localRun;
    expect(await h.composition.workAsync()).toEqual([]);
    completeRecordedWork(h, localRun, false);
    expect(refused(h.composition.authority.reconcile(contract, localRun, 100))).toMatch(/result must precede/);
    expect(value(h.built.application.owners.run.read(localRun)).state).not.toBe('completed');
    expect(h.composition.ledger.view().get(contract.id)).toMatchObject({ owned: true, result: null });
  } finally { h.close(); }
}, 60000);

it('cancellation collects already performed and checked work without replacing its actual terminal result', async () => {
  const h = fixture(true);
  const journal = openPreviewJournal(join(h.root, 'cancellation-health'), new Uint8Array(32).fill(82), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'isolated-cancellation',
    configurationDigest: 'sha256:offline', expires: 100000, maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const attention = createAttentionSurface(journal, { now: () => 100, machine: 'machine-a', admitted: () => true,
    replicated: async () => true, delegations: () => [...h.composition.ledger.view().values()] });
  try {
    // Physical fixture phases are synchronous; let Vitest consume its RPC
    // receipts between phases without changing the injected product clock.
    await yieldToRunner();
    const contract = value(h.composition.delegate(h.parent, h.request)); h.composition.pump();
    const localRun = h.composition.ledger.view().get(contract.id).acceptance.localRun;
    expect(await h.composition.workAsync()).toEqual([]);
    await yieldToRunner();
    const { outcome } = completeRecordedWork(h, localRun);
    await yieldToRunner();
    const responses = () => value(h.built.f.effects.api.inspect()).filter(row => row.record.type === 'OperationObservation'
      && row.record.stage === 'response').length;
    const before = responses();
    value(h.composition.cancel(contract.id, 'cancel after actual work returned'));
    await yieldToRunner();
    await attention.maintain();
    expect(attention.list().items.find(item => item.id.includes('delegation-cancel-pending'))?.status).toBe('OPEN');
    expect(await h.composition.workAsync()).toHaveLength(1);
    await yieldToRunner();
    expect(value(h.composition.authority.collect(contract, localRun)).outcome).toEqual(outcome);
    expect(h.composition.ledger.view().get(contract.id).cancellation).toBe('confirmed');
    await attention.maintain();
    expect(attention.list().items.find(item => item.id.includes('delegation-cancel-pending'))?.status).toBe('DONE');
    expect(await h.composition.workAsync()).toEqual([]);
    expect(responses()).toBe(before);
  } finally { journal.close(); h.close(); }
// Native signed-store verification is physical I/O. This wall-clock test bound
// is separate from the unchanged injected clock and execution/charge ceilings.
}, 120000);
