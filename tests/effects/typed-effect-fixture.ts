import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, decode } from '../../src/index.js';
import type { Json, Result } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, FactSchema, FactStorePort, GovernedVersion, OwnedBodyRegistration } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import type { TransportHost } from '../../src/transport/index.js';
import { consumeEffectSettlement, createEffectDoorway, createEffectSpine, decodeOutboundMessage, effectOperationContracts, effectSchemas, installOperationDefinition, registerEffectBodies } from '../../src/effects/index.js';
import type { ConversationEffectKind, EffectComposition, EffectHost, EffectAssessmentPort, OperationAdapterPort } from '../../src/effects/index.js';
import { createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine,
  registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { factsFixture, privateKey, value, refused, json } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';
// @ts-expect-error Reference custody is outside pure core.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';
export { value, refused };

export function typedEffectFixture(directory = mkdtempSync(join(tmpdir(), 'p8-')), incarnation = 'executor:1', definitionOverrides: Record<string, unknown> = {},
  supportedKinds: readonly ConversationEffectKind[] = [],
  extensions?: (host: EffectHost) => Readonly<{ schemas: readonly FactSchema[]; ownedBodies: readonly OwnedBodyRegistration[] }>) {
  const f = factsFixture();
  // Separate agent executor and person approving the exact definition.
  f.grant({ id: 'agent-grant', grantee: f.bob });
  const register = { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'reply', 'telegram-fixture'] };
  const decodeContext = { ...f.ctx.decode, register };
  const boundary = { ...f.c, register };
  let now = 100, stopped = false;
  let authority: string[] = [], versions: GovernedVersion[] = [];
  let assessmentRevision = 0;
  let referenceStore: FactStorePort | undefined;
  let ctx!: FactContext;
  const result = <T>(run: () => T) => f.success(run());
  const custody = createEffectFileCaptures([join(directory, 'origin-captures'), join(directory, 'peer-captures')], result);
  const host: EffectHost = { machine: 'machine-a', incarnation, principal: f.bob, scope: f.scope, boundary,
    current: () => ({ decode: { ...decodeContext, captures: { ...decodeContext.captures,
      ...Object.fromEntries(Object.entries(custody.captures as Record<string, CapturedContent>).flatMap(([reference, captured]) =>
        captured.status === 'available' && captured.bytes !== null ? [[reference, captured.bytes]] : [])) } },
      clock: f.clock(now), stopped, versions, authority }),
    capture: custody.capture,
    referenceFacts: () => result(() => {
      if (!referenceStore) throw new Error('reference store not initialized');
      return value(referenceStore.read());
    }),
  };
  const verificationHost: VerificationHost = { machine: host.machine, principal: host.principal, scope: host.scope, boundary: host.boundary,
    current: () => {
      if (!referenceStore) throw new Error('verification fixture store not initialized');
      const evidenceCaptures: Record<string, CapturedContent> = Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) => [reference,
        { hash: hashBytes(bytes), bytes, status: 'available' as const, byteLength: Buffer.byteLength(bytes) }]));
      const facts = { ...ctx, facts: value(referenceStore.read()), captures: { ...ctx.captures, ...evidenceCaptures },
        folded: { ...ctx.folded, 'fixture-evidence': { epoch: 0, position: assessmentRevision } } };
      return { decode: { ...decodeContext, evidence: f.evidence, captures: f.captures }, clock: f.clock(now), generation: register.generation.id,
        stopped, facts, evidence: f.evidence };
    } };
  const transportHost: TransportHost = { domain: 'conversation:1', machine: host.machine, incarnation,
    authorityIncarnation: 'authority:1', principal: host.principal, scope: host.scope, maxLeaseTerm: 1000, budget: 100,
    monotonic: () => now, current: () => ({ decode: decodeContext, clock: f.clock(now), generation: register.generation, stopped }) };
  const extension = extensions?.(host) ?? { schemas: [], ownedBodies: [] };
  const witnessKinds = ['run-opening', 'run-transition', 'intake-admitted', 'intake-receipt',
    'judgment-JudgmentRequest', 'judgment-JudgmentAttemptRecord', 'semantic-message-admission',
    'conversation-route-generation', 'capture-record', 'conversation-message'];
  const witnessSchemas: FactSchema[] = witnessKinds.map(kind => ({ ...f.schema, kind,
    fields: { witness: { kind: 'text', maxLength: 65536 } } }));
  const resultSchema: FactSchema = { ...f.schema, kind: 'result-record', fields: {
    run: { kind: 'text', maxLength: 512 }, step: { kind: 'text', maxLength: 512 }, logicalEffect: { kind: 'text', maxLength: 512 },
    result: { kind: 'constitutional', type: 'Result' },
  } };
  ctx = { ...f.ctx, decode: decodeContext, get captures(): Record<string, CapturedContent> { return custody.captures; },
    schemas: [f.schema, resultSchema, ...witnessSchemas, ...transportSchemas(transportHost), ...effectSchemas(host),
      ...verificationSchemas(verificationHost), ...extension.schemas],
    ownedBodies: [...value(registerTransportBodies(transportHost, boundary, consumeEffectSettlement)), ...value(registerEffectBodies(host)),
      ...value(registerVerificationBodies(verificationHost)), ...extension.ownedBodies] };
  const peer = createFactStore(ctx, createTransportFileStorage(join(directory, 'peer'), result));
  const replicas = createEffectReplicaStorage(join(directory, 'origin'), { id: 'fixture-peer-directory', store: peer }, result);
  const store = createFactStore(ctx, replicas.storage);
  referenceStore = store;
  const author = { context: ctx, privateKey };
  const spine = createEffectSpine(host, author, store);
  const transport = createTransportAuthority(transportHost, createTransportSpine(transportHost, author, store), boundary);
  const note = (identity: string) => value(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(f.now), body: { identity, amount: '0' }, required: [] }, ctx, store, privateKey)).fact;
  const reference = (kind: string, witness: Record<string, unknown>) => value(authorAndAppend({ kind, schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(f.now), body: { witness: JSON.stringify(witness) }, required: [] }, ctx, store, privateKey)).fact;
  const sourceFor = (step: string, logical: string) => {
    const sourceResult = value(decode('Result', f.refusedInput({ detail: 'work pending effect realization', preserved: `capture:${logical}` }), decodeContext));
    const source = value(authorAndAppend({ kind: 'result-record', schemaVersion: 1, machine: host.machine,
      principal: json(host.principal), provenance: json(host.principal.provenance), at: json(f.now),
      body: { run: 'run:1', step, logicalEffect: logical, result: json(sourceResult) }, required: [] }, ctx, store, privateKey)).fact;
    const transition = reference('run-transition', { run: 'run:1', step: { id: step, run: 'run:1', operation: { key: logical }, evidence: [source.id] } });
    return { source, transition };
  };
  const kind = String(definitionOverrides.payloadKind ?? 'post-text');
  const stepId = `step:${kind}`, logicalEffect = `logical:${kind}:1`;
  const pending = sourceFor(stepId, logicalEffect).source;
  Object.assign(host, { fixtureSourceResult: pending.id });
  reference('run-opening', { type: 'Run', id: 'run:1', run: 'run:1' });
  if (kind === 'derive-transcript') reference('run-transition', { run: 'run:1', step: { id: 'step:transcript', run: 'run:1', operation: { key: 'logical:transcript-output' }, evidence: [pending.id] } });
  const mediaCapture = value(host.capture('media'));
  const audioCapture = value(host.capture('audio'));
  const inboundMediaBytes = JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'photo',
    platformFile: 'provider-file:1', mediaType: 'image/png' });
  const inboundMediaCapture = kind === 'fetch-inbound-media' ? value(host.capture(inboundMediaBytes)) : audioCapture;
  const submittedCapture = value(host.capture(JSON.stringify({ model: 'model:1' })));
  const responseCapture = value(host.capture(JSON.stringify({ transcript: 'fixture transcript' })));
  Object.assign(host, { fixtureMediaCapture: mediaCapture, fixtureAudioCapture: audioCapture,
    fixtureInboundMediaCapture: inboundMediaCapture, fixtureSubmittedCapture: submittedCapture,
    fixtureResponseCapture: responseCapture });
  if (['acknowledge', 'fetch-inbound-media', 'derive-transcript'].includes(kind)) {
    const intakeCapture = kind === 'fetch-inbound-media' ? inboundMediaCapture : audioCapture;
    reference('intake-receipt', { id: 'receipt:1', adapter: 'bot:fixture', ingress: JSON.stringify({ channel: 'chat:fixture',
      sender: 'sender:fixture', identityEpoch: 'epoch:1', eventId: 'event:1' }), rawHash: intakeCapture.hash, capture: intakeCapture });
    reference('intake-admitted', { id: 'intake:1', adapter: 'bot:fixture', channel: 'chat:fixture', receipt: 'receipt:1', binding: 'none' });
  }
  if (kind === 'derive-transcript') {
    reference('judgment-JudgmentRequest', { record: { type: 'JudgmentRequest', id: 'judgment-request:transcribe', run: 'run:1',
      step: 'step:transcript', question: audioCapture, context: audioCapture, submitted: submittedCapture } });
    reference('judgment-JudgmentAttemptRecord', { record: { type: 'JudgmentAttemptRecord', id: 'provider:transcribe',
      request: 'judgment-request:transcribe', phase: 'response-observed', operation: 'provider-operation:transcribe', receipt: responseCapture } });
  }
  reference('semantic-message-admission', { id: 'semantic:typed:1', run: 'run:1', sourceLineage: 'run:1',
    status: 'current', validFrom: 0, validUntil: 1000 });
  reference('conversation-route-generation', { id: 'conversation-route:1', account: 'bot:fixture', conversation: 'chat:fixture',
    status: 'current', validFrom: 0, validUntil: 1000 });
  if (kind === 'edit-message' || kind === 'react') reference('conversation-message', { id: 'message:7', message: 'message:7', account: 'bot:fixture', conversation: 'chat:fixture',
    status: 'current', validFrom: 0, validUntil: 1000 });
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
    ...(supportedKinds.length ? {
      describePayload: () => ({ kinds: supportedKinds, schemas: supportedKinds.map(kind => effectOperationContracts[kind].inputSchema),
        canonicalization: 'instar-canonical-json-v1' as const, observations: Object.fromEntries(supportedKinds.map(kind => [kind, effectOperationContracts[kind].observations])) }),
      invokePayload: (input: Parameters<NonNullable<OperationAdapterPort['invokePayload']>>[0]) => {
        calls++; invoke?.(); return f.success(JSON.stringify({ ok: true, operation: input.operation, kind: input.payload.kind })); },
    } : {}),
    observe: () => { queries++; return f.success(JSON.stringify({ status: 'unknown', reason: 'Telegram-shaped fixture has no decisive negative lookup' })); },
  };
  let verificationSpine: ReturnType<typeof createVerificationSpine> | undefined;
  let verificationRuntime: ReturnType<typeof createVerificationRuntime> | undefined;
  let realAssessment: EffectAssessmentPort | undefined;
  const verifier = () => {
    if (realAssessment && verificationSpine && verificationRuntime) return { verificationSpine, verificationRuntime, realAssessment };
    verificationSpine = createVerificationSpine(verificationHost, { context: ctx, privateKey }, store);
    verificationRuntime = createVerificationRuntime(verificationHost, verificationSpine);
    value(verificationRuntime.record('VerificationPlan', { ...verificationInput('VerificationPlan'), id: 'typed-effect-verification-plan',
      subject: { ...verificationInput('VerificationPlan').subject, generation: register.generation.id },
      bar: { ...verificationInput('VerificationPlan').bar, version: definition.verificationBar, sources: ['probe'] } }));
    realAssessment = createEffectAssessmentPort(verificationHost, verificationRuntime);
    return { verificationSpine, verificationRuntime, realAssessment };
  };
  let assessmentState: 'happened' | 'did-not-happen' | 'uncertain' = 'uncertain', finalCharge: number | null = null;
  let delayedExecutionExcluded = false, assessmentAvailable = true;
  const syncAssessmentEvidence = (operation: string, digest: string) => {
    f.evidence.splice(0, f.evidence.length, ...f.evidence.filter(item => !item.id.startsWith('typed-effect-evidence:')));
    const inputs = [
      ['occurred', 'operation-occurred', assessmentState === 'happened', undefined],
      ['not-occurred', 'operation-did-not-occur', assessmentState !== 'happened', undefined],
      ['quiescent', 'old-executor-quiescent', delayedExecutionExcluded, undefined],
      ['charged', 'charge-settled', finalCharge !== null, finalCharge ?? 0],
    ] as const;
    for (const [name, predicate, supported, amount] of inputs) f.evidence.push(value(decode('Evidence', f.evidenceInput({ id: `typed-effect-evidence:${operation}:${name}`,
      claim: { subject: operation, predicate, value: { digest, ...(amount === undefined ? {} : { amount }) } },
      source: 'probe', observedAt: f.clock(now), freshFor: 100, strength: supported ? 'proof' : 'inference' }), decodeContext)));
  };
  const withdrawn = <T>(): Result<T> => decode('Result', f.refusedInput({ detail: 'assessment withdrawn' }), decodeContext) as Result<T>;
  const assessor: EffectAssessmentPort = { owner: 'part-nine',
    assess: input => { if (!assessmentAvailable) throw new Error('assessment withdrawn');
      syncAssessmentEvidence(input.reservation.operation, input.request.digest); return verifier().realAssessment.assess(input); },
    read: (ref, input) => assessmentAvailable ? verifier().realAssessment.read(ref, input) : withdrawn(),
    consumeCurrent: (ref, input, consume) => assessmentAvailable ? verifier().realAssessment.consumeCurrent(ref, input, consume)
      : withdrawn(),
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
  return { ...f, directory, host, transportHost, ctx, store, peer, spine, transport, replicas, api, composition, note, reference, sourceFor,
    d, definition, message, pending, run, obligation, fence, prepare, requestId, messageDigest, externalAdmission, adopt,
    calls: () => calls, queries: () => queries, onInvoke: (fn: () => void) => { invoke = fn; },
    stop: () => { stopped = true; }, time: (v: number) => { now = v; },
    assess: (state: typeof assessmentState, charge: number | null, excluded = false) => {
      assessmentState = state; finalCharge = charge; delayedExecutionExcluded = excluded; assessmentRevision++;
    },
    withdrawAssessment: () => { assessmentAvailable = false; f.evidence.splice(0); },
    assessmentGuardActive: () => false,
    verificationHost, get verificationSpine() { return verifier().verificationSpine; },
    get verificationRuntime() { return verifier().verificationRuntime; }, get assessment() { return verifier().realAssessment; },
    versions: (v: GovernedVersion[]) => { versions = v; },
  };
}
