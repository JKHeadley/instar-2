import { existsSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, FactEnvelope, FactStorePort, GovernedVersion } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import type { TransportHost } from '../../src/transport/index.js';
import { createEffectDoorway, createEffectSpine, decodeOutboundMessage, effectSchemas, installOperationDefinition, registerEffectBodies } from '../../src/effects/index.js';
import type { EffectComposition, EffectHost, EffectAssessmentPort, OperationAdapterPort } from '../../src/effects/index.js';
import { factsFixture, privateKey, value, refused, json } from '../facts/fixtures.js';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';
// @ts-expect-error Reference custody is outside pure core.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';
export { value, refused };

export function effectFixture(directory = mkdtempSync(join(tmpdir(), 'p8-')), incarnation = 'executor:1', definitionOverrides: Record<string, unknown> = {}) {
  const f = factsFixture();
  // Separate agent executor and person approving the exact definition.
  f.grant({ id: 'agent-grant', grantee: f.bob });
  const register = { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'reply', 'telegram-fixture'] };
  const decodeContext = { ...f.ctx.decode, register };
  const boundary = { ...f.c, register };
  let now = 100, stopped = false;
  let authority: string[] = [], versions: GovernedVersion[] = [];
  let referenceStore: FactStorePort | undefined;
  const result = <T>(run: () => T) => f.success(run());
  const custody = createEffectFileCaptures([join(directory, 'origin-captures'), join(directory, 'peer-captures')], result);
  const commonSubjects = ['post-text', 'post-media', 'edit-message', 'react', 'create-topic', 'acknowledge',
    'fetch-inbound-media', 'derive-transcript', 'process-control', 'scheduler-control', 'account-route-change',
    'configuration-change', 'filesystem-mutation', 'git-mutation', 'infrastructure-notice'].map(kind =>
    ({ run: 'run:1', step: `step:${kind}`, logicalEffect: `logical:${kind}:1` }));
  const fake = (id: string, kind: string, witness: Record<string, unknown>) => ({ id, kind, body: { witness: JSON.stringify(witness) } }) as unknown as FactEnvelope;
  const referenceRows: FactEnvelope[] = [
    fake('run-opening:1', 'run-opening', { type: 'Run', id: 'run:1', run: 'run:1' }),
    ...commonSubjects.map((subject, index) => fake(`run-transition:${index}`, 'run-transition', { run: subject.run,
      step: { id: subject.step, run: subject.run, operation: { key: subject.logicalEffect }, evidence: ['five-owned pending and source result STAND-IN'] } })),
    fake('run-transition:transcript', 'run-transition', { run: 'run:1', step: { id: 'step:transcript', run: 'run:1', operation: { key: 'logical:transcript-output' }, evidence: ['five-owned pending and source result STAND-IN'] } }),
    { ...fake('five-owned pending and source result STAND-IN', 'result-record', {}), body: { run: 'run:1', subjects: commonSubjects,
      result: f.refusedInput({ detail: 'pending typed source' }) } } as unknown as FactEnvelope,
    fake('intake-admitted:1', 'intake-admitted', { id: 'intake:1', account: 'bot:fixture', conversation: 'chat:fixture' }),
    fake('intake-receipt:1', 'intake-receipt', { id: 'intake:1', account: 'bot:fixture', conversation: 'chat:fixture', platformFile: 'provider-file:1' }),
    fake('judgment-attempt:1', 'judgment-JudgmentAttemptRecord', { record: { type: 'JudgmentAttemptRecord', id: 'provider:transcribe', operation: 'provider:transcribe', run: 'run:1',
      step: 'step:transcript', model: 'model:1', sourceCapture: { reference: 'capture:audio', hash: hashBytes('audio') }, originatingIntake: 'intake:1' } }),
  ];
  const process = { machine: 'machine-a', processId: 'process:1', processIncarnation: 'process:1:incarnation:2', parentIdentity: 'parent:1',
    startIdentity: 'start:1', executable: '/usr/bin/node', arguments: ['worker.mjs'], status: 'current', validFrom: 0, validUntil: 1000 };
  referenceRows.push(fake('process-incarnation-fact', 'process-incarnation', { ...process, id: process.processIncarnation }),
    fake('process-parent-fact', 'process-parent', { ...process, id: process.parentIdentity }), fake('process-start-fact', 'process-start', { ...process, id: process.startIdentity }),
    fake('scheduler-fact', 'scheduler-job-generation', { id: 'job-generation:2', jobId: 'job:1', generation: 'job-generation:2', finiteScope: 'one-run', undoOperation: 'resume:job:1', reviewAt: 200, status: 'current', validFrom: 0, validUntil: 1000 }),
    fake('route-fact', 'account-route-generation', { id: 'route-generation:2', run: 'run:1', provider: 'telegram', fromAccount: 'bot:old', toAccount: 'bot:new', generation: 'route-generation:2', rollbackRoute: 'route:old', status: 'current', validFrom: 0, validUntil: 1000 }),
    fake('config-fact', 'configuration-target-state', { id: 'capture:config-prior', canonicalTarget: '/project/.instar/config.json', priorDigest: hashBytes('prior'), undoReference: 'capture:config-prior', status: 'current', validFrom: 0, validUntil: 1000 }),
    fake('filesystem-fact', 'filesystem-target-state', { id: 'policy:protected-targets:1', policy: 'policy:protected-targets:1', targets: [{ canonicalPath: '/project/state.json', resolvedPath: '/project/state.json', ancestryDigest: hashBytes('prior'), priorDigest: hashBytes('prior') }], status: 'current', validFrom: 0, validUntil: 1000 }),
    fake('git-fact', 'git-target-state', { id: 'sha:base', repository: '/project/repo', worktree: '/project/repo', ref: 'refs/heads/main', base: 'sha:base', targets: ['src/file.ts'], expectedHeads: [{ ref: 'refs/heads/main', digest: hashBytes('prior') }], rollbackConstraints: ['only-if-head-unchanged'], status: 'current', validFrom: 0, validUntil: 1000 }));
  const host: EffectHost = { machine: 'machine-a', incarnation, principal: f.bob, scope: f.scope, boundary,
    current: () => ({ decode: decodeContext, clock: f.clock(now), stopped, versions, authority }),
    capture: custody.capture,
    referenceFacts: () => result(() => [...referenceRows, ...(referenceStore ? value(referenceStore.read()) : [])]),
    resolvePath: path => result(() => { const suffix: string[] = []; let cursor = path;
      while (!existsSync(cursor)) { const parent = dirname(cursor); if (parent === cursor) break; suffix.unshift(basename(cursor)); cursor = parent; }
      return join(realpathSync(cursor), ...suffix); }),
  };
  const transportHost: TransportHost = { domain: 'conversation:1', machine: host.machine, incarnation,
    authorityIncarnation: 'authority:1', principal: host.principal, scope: host.scope, maxLeaseTerm: 1000, budget: 100,
    monotonic: () => now, current: () => ({ decode: decodeContext, clock: f.clock(now), generation: register.generation, stopped }) };
  const ctx: FactContext = { ...f.ctx, decode: decodeContext, get captures(): Record<string, CapturedContent> { return custody.captures; },
    schemas: [f.schema, ...transportSchemas(transportHost), ...effectSchemas(host)],
    ownedBodies: [...value(registerTransportBodies(transportHost, boundary)), ...value(registerEffectBodies(host))] };
  const peer = createFactStore(ctx, createTransportFileStorage(join(directory, 'peer'), result));
  const replicas = createEffectReplicaStorage(join(directory, 'origin'), { id: 'fixture-peer-directory', store: peer }, result);
  const store = createFactStore(ctx, replicas.storage);
  referenceStore = store;
  const author = { context: ctx, privateKey };
  const spine = createEffectSpine(host, author, store);
  const transport = createTransportAuthority(transportHost, createTransportSpine(transportHost, author, store), boundary);
  const note = (identity: string) => value(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(f.now), body: { identity, amount: '0' }, required: [] }, ctx, store, privateKey)).fact;
  const pending = note('five-owned pending and source result STAND-IN');
  authority = [pending.id];
  const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'reply-definition:1', feature: 'reply', version: 'reply-version:1',
    generation: register.generation.id, adapter: 'telegram-fixture', account: 'bot:fixture', conversation: 'chat:fixture',
    speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash, durability: 'replicated', replicas: 1,
    lossModel: 'Second local directory is a peer STAND-IN; shared disk loss is NOT covered.', maxBytes: 4096,
    maxCharge: 20, timeout: 100, verificationBar: 'reply-bar:1', ...definitionOverrides };
  const approvedIn = f.authorize({ id: 'reply-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'reply-base:1' });
  versions = [{ id: definition.version, subject: definition.feature, content: json(definition), contentHash: value(canonical(definition)).hash,
    since: pending.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }];
  const d = value(installOperationDefinition(definition, host, spine));
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'observation-policy', maxAttempts: 3,
    minDelay: 10, maxDuration: 1000, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, boundary));
  const fence = value(transport.acquire('acquire', '', 500));
  const run = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:1' };
  value(transport.schedule('schedule', fence, run, policy));
  const obligation = value(transport.inspect()).at(-1)!.fact.id;
  let calls = 0, queries = 0, invoke: (() => void) | undefined;
  const adapter: OperationAdapterPort = { owner: 'part-ten', id: 'telegram-fixture',
    describe: () => ({ contract: 'fixture-contract:1', account: definition.account, conversation: definition.conversation,
      maxCharge: 20, timeout: 100, hiddenRetries: 0 }),
    invoke: input => { calls++; invoke?.(); return f.success(JSON.stringify({ ok: true, result: { message_id: calls, chat: { id: input.message.conversation }, text: input.message.text } })); },
    observe: () => { queries++; return f.success(JSON.stringify({ status: 'unknown', reason: 'Telegram-shaped fixture has no decisive negative lookup' })); },
  };
  let assessmentState: 'happened' | 'uncertain' = 'uncertain';
  let finalCharge: number | null = null;
  let delayedExecutionExcluded = false, assessmentAvailable = true, assessmentGuards = 0;
  let acceptanceId = '';
  let assessmentEvidence = '';
  const mutableAssessment = () => { if (assessmentGuards) throw new Error('assessment held by synchronous consumer'); };
  const assessmentView = (ref: Parameters<EffectAssessmentPort['read']>[0], input: Parameters<EffectAssessmentPort['read']>[1]) => {
    if (!assessmentAvailable) throw new Error('assessment withdrawn');
    if (ref.id !== acceptanceId || !input.observations.length) throw new Error('assessment binding');
    return Object.freeze({ outcome: value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: assessmentState, evidence: [assessmentEvidence] }, decodeContext)),
      finalCharge, delayedExecutionExcluded, required: Object.freeze([acceptanceId]) });
  };
  // EXPLICIT nine stand-in. It records a note, not a counterfeit P9 fact/type.
  // No production claim or automatic retry may rely on this fixture composition.
  const assessor: EffectAssessmentPort = { owner: 'part-nine',
    assess: input => { mutableAssessment(); acceptanceId ||= note('independent nine assessment STAND-IN').id;
      const evidenceId = `assessment:${input.reservation.operation}:${assessmentState}`;
      if (!f.evidence.some(e => e.id === evidenceId)) f.evidence.push(value(decode('Evidence', f.evidenceInput({ id: evidenceId,
        claim: { subject: input.reservation.operation, predicate: input.request.digest, value: assessmentState },
        strength: 'observation', observedAt: f.clock(now), freshFor: 100 }), decodeContext)));
      assessmentEvidence = evidenceId;
      return f.success({ owner: 'part-nine', name: 'VerificationAssessment', id: acceptanceId }); },
    read: (ref, input) => f.success(assessmentView(ref, input)),
    consumeCurrent: (ref, input, consume) => {
      // Actual local non-waiting guard: no call through read/note/custody/storage.
      // Both fixture mutation paths and reentrant assess refuse while it is held.
      const current = assessmentView(ref, input);
      assessmentGuards++;
      try { return f.success(consume(current)); } finally { assessmentGuards--; }
    },
  };
  const composition: EffectComposition = { host, spine, transport, durability: replicas.durability, custody: custody.custody, adapter, assessment: assessor };
  const api = createEffectDoorway(composition);
  const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1, id: 'message:1', semanticMessage: 'five-semantic-message:1',
    run: run.id, speaker: f.bob.id, account: definition.account, conversation: definition.conversation,
    text: 'Here is the requested result.', purpose: 'ordinary-reply', sourceResult: pending.id }, host));
  const prepare = () => value(api.prepare({ definition: d.id, message, run, pending: pending.id,
    attempt: 'attempt:1', verificationOwner: 'reply-verifier', obligation, closure: [], fence }));
  // The EXTERNAL admission: six reserves the operation directly, at a caller's request,
  // using eight's derived request id (docs/11 step 5). `adopt` records eight's request
  // against it without a second reservation; `dispatch`/`settle` then apply unchanged.
  const requestId = `request:${value(canonical([message.account, message.conversation, message.semanticMessage])).hash}`;
  const messageDigest = value(canonical(message)).hash;
  const externalAdmission = (overrides: Record<string, unknown> = {}) => value(transport.reserve({ command: 'external-admit', fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: requestId }, attempt: 'attempt:1', payloadDigest: messageDigest,
    charge: definition.maxCharge, run, semanticMessage: message.semanticMessage,
    durability: definition.durability as 'local-durable' | 'replicated', replicas: definition.replicas as number, ...overrides }));
  const adopt = () => value(api.adopt({ definition: d.id, message, run, pending: pending.id,
    attempt: 'attempt:1', verificationOwner: 'reply-verifier', obligation, closure: [] }));
  return { ...f, directory, host, ctx, store, peer, spine, transport, replicas, api, composition, note,
    d, definition, message, pending, run, obligation, fence, prepare, requestId, messageDigest, externalAdmission, adopt,
    calls: () => calls, queries: () => queries, onInvoke: (fn: () => void) => { invoke = fn; },
    stop: () => { stopped = true; }, time: (v: number) => { now = v; },
    assess: (state: typeof assessmentState, charge: number | null, excluded = false) => {
      mutableAssessment();
      assessmentState = state; finalCharge = charge; delayedExecutionExcluded = excluded;
    },
    withdrawAssessment: () => { mutableAssessment(); assessmentAvailable = false; },
    assessmentGuardActive: () => assessmentGuards > 0,
    versions: (v: GovernedVersion[]) => { versions = v; },
  };
}
