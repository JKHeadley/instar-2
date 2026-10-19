// @ts-nocheck -- this test-side composition deliberately joins independently typed owner fixtures.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '../../src/index.js';
import { generationOf } from '../../src/register/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import { createIntakePort, intakeStopRegistration, intakeWorkRegistration } from '../../src/intake/index.js';
import {
  admitTelegramAdapter, createTelegramIngress, createTelegramIntakeAdapter,
  createTelegramReplyOperationAdapter, installTelegramReplyOperation, renderTelegramHtml,
  telegramConversation, telegramParserDeclarationId,
} from '../../src/conversation/index.js';
import { createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import { createProductionTelegramCustodian } from '../../src/assembly/production-telegram.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createScheduledIntakeAdapter, createScheduledRunner, scheduledParserDeclarationId } from '../../src/scheduled/index.js';
import { readRecordFact, validateGrounding } from '../../src/rungraph/graph.js';
import { decodeSessionGrounding } from '../../src/rungraph/records.js';
import { conversationFixture } from '../conversation/fixture.js';
import { effectFixture } from '../effects/fixture.js';
import { createProductionBootOwnerFixture } from '../assembly/production-boot-owner-fixture.js';
import { json, privateKey, value } from '../facts/fixtures.js';
import { durablePreviewWrite, HOST_OUTAGE_TEXT, isHostOutageText, previewTurnId, stage2SidecarExists, openStage2State, validateStage2Successor } from './state.js';
import { stage2Activation, stage2InvocationBinding, stage2RouteFactory, encoded, subscriptionInvocationPolicy, OWNER_WINDOW_MS } from './stage2-provider.js';
import { stage2Lifecycle, stage2HistoricalStatus } from './stage2-owners.js';
import type { PreviewIntakeDisposition, PreviewState, PreviewTurn } from './state.js';

export const PREVIEW_LABEL = ''; // Retained identifier; new replies carry no preview label.
export const FIXED_LIMITED_RESPONSE = 'Your message was preserved and grounded. No model was called.';

/** Every item is a test substitution or dormant fixture descriptor, never production evidence. */
export const PREVIEW_STAND_IN_LEDGER = Object.freeze([
  Object.freeze({ name: 'fixture-governance-and-register', tier: 'simulated-authority',
    claims: 'test declaration and conformance authority only', liveEffect: 'fixture signatures satisfy code checks, not operator authority', replacementUnit: 'M3 Part B / M3-S' }),
  Object.freeze({ name: 'fixture-signing-and-standing-grants', tier: 'simulated-authority',
    claims: 'test identity, configured-principal binding, and target grant expiring with the trial only', liveEffect: 'authorizes the fixture-composed send path only', replacementUnit: 'M3 Part B / M3-S' }),
  Object.freeze({ name: 'fixture-clock-and-verification-host', tier: 'simulated-authority',
    claims: 'fixture causal time and recorded verification-host behavior only; wall time belongs to the outer trial gate', liveEffect: 'none', replacementUnit: 'M4 host' }),
  Object.freeze({ name: 'preview-route-hold-gate', tier: 'simulated-authority',
    claims: 'test-side exact route allowlist converts nonmatching captured routes into Four holds', liveEffect: 'prevents excluded Telegram inputs from reaching reply eligibility', replacementUnit: 'M3 Part B / M3-S' }),
  Object.freeze({ name: 'fixture-five-six-run-admission-capacity', tier: 'simulated-internal-operation',
    claims: 'fixture Five opening/grounding and fixture Six admission/capacity only', liveEffect: 'none', replacementUnit: 'M3-I capacity' }),
  Object.freeze({ name: 'fixture-context-assembler', tier: 'simulated-internal-operation',
    claims: 'bounded fixture context delivery only', liveEffect: 'none', replacementUnit: 'M4-L launch' }),
  Object.freeze({ name: 'fixture-run-file-storage-and-capture-custody', tier: 'simulated-custody',
    claims: 'fsynced machine-local plaintext test files returning local-durable success only', liveEffect: 'none', replacementUnit: 'M4 custody' }),
  Object.freeze({ name: 'fixture-in-memory-authority-and-capture-indexes', tier: 'simulated-custody',
    claims: 'fixture working indexes and durability-return helpers only; required captures are copied to the run files', liveEffect: 'none', replacementUnit: 'M4 custody' }),
  Object.freeze({ name: 'fixture-five-grounding-consumption', tier: 'simulated-internal-operation',
    claims: 'bounded test-owned context-consumption receipt only', liveEffect: 'none', replacementUnit: 'M4-L launch' }),
  Object.freeze({ name: 'fixture-native-launch-and-process-descriptor', tier: 'dormant-descriptor',
    claims: 'fixture launch and pid:42:start:1 descriptor are present but the Native delivery path is not invoked', liveEffect: 'none', replacementUnit: 'M4-L launch' }),
  Object.freeze({ name: 'fixture-context-delivery-nine-evidence', tier: 'dormant-descriptor',
    claims: 'happened, finalCharge 0, delayedExecutionExcluded true instrument exists but is not invoked', liveEffect: 'does not assess Telegram', replacementUnit: 'M4 G6, including Nine' }),
  Object.freeze({ name: 'fixture-independent-protection-posture', tier: 'dormant-descriptor',
    claims: 'fixture protected posture descriptor only', liveEffect: 'none', replacementUnit: 'M4 host / M5' }),
  Object.freeze({ name: 'fixture-model-and-persistence-descriptors', tier: 'dormant-descriptor',
    claims: 'dormant fixture descriptors only; model exchange is never called', liveEffect: 'none', replacementUnit: 'M4 G6, including Nine / M4 custody' }),
  Object.freeze({ name: 'fixture-effect-peer-directory', tier: 'live-safeguard-substitution',
    claims: 'same-machine second directory satisfies replicated(1) mechanically, not real replication',
    liveEffect: 'substitutes a safeguard on the real Telegram send', replacementUnit: 'M5' }),
  Object.freeze({ name: 'fixture-five-source-result', tier: 'simulated-authority',
    claims: 'fixed-response source marker only; not a model answer', liveEffect: 'feeds the fixed Telegram payload', replacementUnit: 'M4 G6, including Nine' }),
  Object.freeze({ name: 'fixture-reply-nine-assessor', tier: 'dormant-descriptor',
    claims: 'fixture assessor exists but the reply doorway is installed with assessment null', liveEffect: 'does not assess Telegram', replacementUnit: 'M4 G6, including Nine' }),
  Object.freeze({ name: 'real-telegram-effect', tier: 'real-external-effect',
    claims: 'a validated Telegram Bot API acceptance only; not delivery or reading', liveEffect: 'real sendMessage', replacementUnit: 'M5' }),
]);

export interface PreviewConfiguration {
  readonly root: string;
  readonly machine: string;
  readonly botId: string;
  readonly botUsername: string;
  readonly operatorSenderId: string;
  readonly chatId: string;
  readonly chatKind: 'private' | 'group-topic';
  readonly forum: boolean;
  readonly messageThreadId: number | null;
  readonly maxPollSeconds: number;
  readonly maxBatchItems: number;
  readonly maxContextTurns: number;
  readonly maxContextBytes: number;
}

export interface PreviewCompositionInput {
  readonly stage?: 1 | 2;
  readonly stage2?: any;
  readonly noticeOnly?: boolean;
  readonly configuration: PreviewConfiguration;
  readonly state: PreviewState;
  readonly storageKey: Uint8Array;
  readonly storageIO: unknown;
  readonly telegramIO?: unknown;
  readonly telegramIOFactory?: (storage: unknown) => unknown;
  readonly now?: () => number;
  readonly resolveSecret: (reference: Readonly<{ vault: string; name: string }>) => string;
  readonly hooks?: Readonly<{
    beforeIntakeIndex?: (candidate: Readonly<{ id: string; updateId: number }>) => void;
    afterIntake?: (turn: PreviewTurn) => void;
    beforeDispatch?: (turn: PreviewTurn) => void;
    afterDispatch?: (turn: PreviewTurn) => void;
    afterNoticePrepare?: (turn: PreviewTurn) => void;
  }>;
  /** Owner verified installed jobs and durable Run admission, supplied by preview tests/host. */
  readonly scheduledAuthority?: import('../../src/scheduled/index.js').ScheduledSourceAuthority;
  readonly scheduledStartOnce?: import('../../src/scheduled/index.js').ScheduledRunnerDependencies['startOnce'];
  readonly scheduledUsage?: () => import('../../src/scheduled/index.js').ScheduledUsageLevel;
}

const telegramSecret = Object.freeze({ type: 'SecretRef' as const, schemaVersion: 1 as const,
  vault: 'preview', name: 'telegram-bot-token' });

function expectedRoute(configuration: PreviewConfiguration) {
  const target = { chatId: configuration.chatId, forum: configuration.forum,
    messageThreadId: configuration.messageThreadId };
  return Object.freeze({ channel: telegramConversation(configuration.botId, target),
    sender: `telegram:v1:user:${configuration.operatorSenderId}`,
    identityEpoch: `telegram:v1:bot:${configuration.botId}:epoch:preview-stage-1`, eventId: null });
}

function seedSignedBinding(storage, fixture, route, trial): void {
  // This is fixture authority: its signed fact lineage uses the fixture's causal
  // clock. The preview state's real trial window remains the outer live gate.
  const clock = fixture.intake.f.now;
  const principal = fixture.intake.f.principal(route.sender, 'person');
  const authorGrant = fixture.intake.f.grant({ id: 'telegram-binding-author-grant',
    grantee: fixture.intake.f.alice, scope: fixture.intake.f.scope, issuedAt: clock });
  const grant = fixture.intake.f.grant({ id: 'preview-telegram-binding-grant',
    grantee: principal, scope: fixture.intake.f.scope, issuedAt: clock, expiresAt: trial.expiresAt });
  fixture.intake.syncCaptures();
  for (const [reference, bytes] of Object.entries(fixture.intake.f.captures)) {
    if (!storage.captures.preserve(reference, bytes)) throw new Error('preview: fixture authority capture changed');
  }
  const rootSchema = { ...fixture.intake.f.schema, kind: 'genesis-grant', fields: {
    grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const },
  } };
  const context = fixture.intake.context;
  Object.assign(context, { schemas: [...context.schemas.filter(schema => schema.kind !== rootSchema.kind), rootSchema] });
  const bindingCandidates = storage.segment.read().filter(fact => fact.kind === 'conversation-binding'
    && fact.body?.adapter === telegramParserDeclarationId && fact.body?.channel === route.channel);
  const superseded = new Set(bindingCandidates.map(fact => fact.body?.supersedes));
  const bindingHeads = bindingCandidates.filter(fact => !superseded.has(fact.id));
  if (bindingHeads.length > 1) throw new Error('preview: fixture binding authority has multiple heads');
  const priorHead = bindingHeads[0] ?? null;
  const grantFact = priorHead === null ? null : storage.segment.read().find(fact => fact.kind === 'genesis-grant'
    && fact.body?.grant?.id === priorHead.body?.grantId);
  const existingAuthor = storage.segment.read().find(fact => fact.kind === 'genesis-grant'
    && fact.body?.grant?.id === authorGrant.id && fact.body?.grant?.grantee?.id === authorGrant.grantee.id);
  if (priorHead?.body?.sender === route.sender && priorHead.body?.identityEpoch === route.identityEpoch
    && priorHead.body?.principalId === principal.id && priorHead.body?.scope !== undefined
    && grantFact?.body?.grant?.issuedAt?.value === clock.value
    && grantFact.body?.grant?.expiresAt === trial.expiresAt && existingAuthor) {
    Object.assign(context, { grants: [{ factId: existingAuthor.id, grant: authorGrant }, { factId: grantFact.id, grant }] });
    return;
  }

  const grantContext = { ...context, decode: { ...context.decode, provenance: authorGrant.source } };
  const root = existingAuthor ?? value(authorAndAppend({
      kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a', principal: json(fixture.intake.f.alice),
      provenance: json(authorGrant.source), at: json(clock), body: { grant: json(authorGrant) }, required: [],
    }, grantContext, createFactStore(grantContext, storage.segment), privateKey)).fact;
  Object.assign(context, { grants: [{ factId: root.id, grant: authorGrant }] });
  const targetContext = { ...context, decode: { ...context.decode, provenance: grant.source } };
  const existingTarget = storage.segment.read().find(fact => fact.kind === 'genesis-grant'
    && fact.body?.grant?.id === grant.id && fact.body?.grant?.grantee?.id === principal.id
    && fact.body?.grant?.expiresAt === trial.expiresAt);
  const target = existingTarget ?? value(authorAndAppend({
      kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a', principal: json(fixture.intake.f.alice),
      provenance: json(grant.source), at: json(clock), body: { grant: json(grant) }, required: [root.id],
    }, targetContext, createFactStore(targetContext, storage.segment), privateKey)).fact;
  Object.assign(context, { grants: [{ factId: root.id, grant: authorGrant }, { factId: target.id, grant }] });
  value(authorAndAppend({
    kind: 'conversation-binding', schemaVersion: 1, machine: 'machine-a', principal: json(fixture.intake.f.alice),
    provenance: json(fixture.intake.f.alice.provenance), at: json(clock), body: {
      adapter: telegramParserDeclarationId, channel: route.channel, sender: route.sender,
      identityEpoch: route.identityEpoch, principalId: principal.id, grantId: grant.id,
      scope: json(fixture.intake.f.scope), supersedes: priorHead?.id ?? 'none',
    }, required: [root.id, target.id],
  }, context, createFactStore(context, storage.segment), privateKey));
}

function restoreFactCaptures(storage, fixture): void {
  const references = new Set<string>();
  const visit = candidate => {
    if (Array.isArray(candidate)) { for (const item of candidate) visit(item); return; }
    if (candidate === null || typeof candidate !== 'object') return;
    if (typeof candidate.reference === 'string') references.add(candidate.reference);
    if (typeof candidate.rawHash === 'string') references.add(candidate.rawHash);
    for (const nested of Object.values(candidate)) visit(nested);
  };
  for (const fact of storage.segment.read()) visit(fact);
  for (const reference of references) {
    const bytes = storage.captures.read(reference);
    if (bytes !== null) fixture.intake.f.captures[reference] = bytes;
  }
  fixture.intake.syncCaptures();
}

const runDirectory = (configuration: PreviewConfiguration, turn: PreviewTurn) =>
  join(configuration.root, '.preview-runs', `${configuration.botId}-${turn.updateId}`);

function openRunFiles(directory: string, seedFacts: readonly unknown[] = [], seedCaptures: Readonly<Record<string, string>> = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const factsPath = join(directory, 'facts.json'), capturesPath = join(directory, 'captures.json');
  if (!existsSync(factsPath)) durablePreviewWrite(factsPath, seedFacts);
  if (!existsSync(capturesPath)) durablePreviewWrite(capturesPath, seedCaptures);
  const readFacts = () => JSON.parse(readFileSync(factsPath, 'utf8'));
  const readCaptures = () => JSON.parse(readFileSync(capturesPath, 'utf8'));
  return {
    factsPath, capturesPath,
    segment: { owner: 'part-ten' as const, read: readFacts, append: (bytes: string, expectedHead: string | null) => {
      const rows = readFacts();
      if ((rows.at(-1)?.contentHash ?? null) !== expectedHead) throw new Error('preview run store: compare-head failed');
      rows.push(JSON.parse(bytes)); durablePreviewWrite(factsPath, rows);
      return { kind: 'Success', value: { kind: 'local-durable' } };
    } },
    captures: { read: (reference: string) => readCaptures()[reference] ?? null,
      preserve: (reference: string, bytes: string) => {
        const rows = readCaptures();
        if (rows[reference] !== undefined && rows[reference] !== bytes) return false;
        rows[reference] = bytes; durablePreviewWrite(capturesPath, rows); return true;
      } },
  };
}

function fixtureCaptureBytes(owner): Record<string, string> {
  const captures: Record<string, string> = { ...owner.ctx.decode.captures };
  for (const [reference, row] of Object.entries(owner.ctx.captures)) if (typeof row?.bytes === 'string') captures[reference] = row.bytes;
  return captures;
}

function validateSavedGrounding(owner, groundingId: string) {
  const facts = value(owner.store.read());
  const groundingFact = facts.find(row => row.id === groundingId && row.kind === 'session-grounding');
  if (!groundingFact) throw new Error('preview: saved grounding fact missing');
  const decodeContext = { ...owner.deps.context, facts: { ...owner.ctx, facts } };
  const grounding = value(decodeSessionGrounding(readRecordFact(groundingFact), decodeContext));
  const view = value(owner.graph.read(owner.id));
  validateGrounding(grounding, view.run, view.head, view.pending, decodeContext);
  return grounding;
}

function writeRunProof(directory: string, owner, grounded, contextReferences: readonly string[], allowedIntakeIds: readonly string[]) {
  const captures = fixtureCaptureBytes(owner);
  const files = openRunFiles(directory);
  for (const [reference, bytes] of Object.entries(captures)) if (!files.captures.preserve(reference, bytes)) throw new Error('preview run capture changed');
  const facts = value(owner.store.read());
  const proof = { version: 1, run: owner.id, opening: owner.opening.id, grounding: grounded.id,
    contextReferences, allowedIntakeIds, stockGroundingValidation: 'passed',
    register: owner.ctx.decode.register, schemas: owner.ctx.schemas, captureReferences: Object.keys(captures).sort(),
    admissions: [...owner.admissions], versions: owner.owners.host.current().versions,
    intakeOwners: owner.deps.context.intakeOwners,
    facts: facts.map(row => ({ id: row.id, kind: row.kind, hash: row.contentHash })) };
  const path = join(directory, 'run-proof.json'); durablePreviewWrite(path, proof); return path;
}

function createOwner(files, context, facts, opening, recovery?) {
  return createProductionBootOwnerFixture(() => files.segment, { minimal: true,
    intake: { ...context, facts, opening }, ...(recovery ? { recovery } : {}) });
}

function establishFiveAndSix(directory: string, context, facts, opening, allowedIntakeIds: readonly string[], contextReferences: readonly string[]) {
  const seedCaptures: Record<string, string> = {};
  for (const [reference, row] of Object.entries(context.captures)) if (typeof row?.bytes === 'string') seedCaptures[reference] = row.bytes;
  const files = openRunFiles(directory, facts, seedCaptures);
  const owner = createOwner(files, context, facts, opening);
  const byId = new Map(facts.map(row => [row.id, row]));
  const admittedCapture = new Map(allowedIntakeIds.map(id => {
    const admitted = byId.get(id), receipt = admitted && byId.get(admitted.body.receipt);
    const reference = receipt?.body?.capture?.reference;
    if (!admitted || typeof reference !== 'string') throw new Error('preview: bounded grounding capture absent');
    return [id, { reference, hash: admitted.body.rawHash, sequence: admitted.segment.position }];
  }));
  const grounding = { owner: 'part-ten' as const, read: request => {
    const base = value(owner.deps.grounding.read(request));
    const messages = allowedIntakeIds.map(id => ({ fact: { owner: 'part-two', name: 'FactEnvelope', id },
      sequence: admittedCapture.get(id).sequence, capture: admittedCapture.get(id).reference,
      hash: admittedCapture.get(id).hash }));
    const consumption = owner.append('consumption', json({ worker: request.worker, harness: request.harness,
      hashes: JSON.stringify(messages.map(row => row.hash)),
      classes: JSON.stringify(owner.deps.groundingPolicy.briefingClasses) }), [opening.id]).fact;
    return owner.success({ ...base,
      messages,
      intake: { owner: 'part-two', name: 'FactEnvelope', id: opening.id },
      lastInbound: { owner: 'part-two', name: 'FactEnvelope', id: allowedIntakeIds.at(-1) },
      consumption: { owner: 'part-two', name: 'FactEnvelope', id: consumption.id },
      frontier: { [opening.machine]: { epoch: opening.segment.epoch, position: opening.segment.position } } });
  } };
  const graph = value(createRunGraph({ ...owner.deps, store: owner.store, grounding }));
  value(graph.open(owner.run));
  value(graph.ground(owner.id, 'w', owner.harnessId, 'start', owner.lease));
  const groundingFact = value(owner.store.read()).filter(row => row.kind === 'session-grounding').at(-1);
  const groundingRecord = groundingFact?.body?.record ?? groundingFact?.body;
  if (!groundingFact || JSON.stringify(groundingRecord.messages.map(row => row.fact.id)) !== JSON.stringify(allowedIntakeIds)) {
    throw new Error('preview: actual grounding context differs from bounded admitted context');
  }
  validateSavedGrounding(owner, groundingFact.id);
  return writeRunProof(directory, owner, { id: groundingFact.id }, contextReferences, allowedIntakeIds);
}

function recoverFiveAndSix(directory: string, context, facts, opening, expectedReferences: readonly string[]) {
  const proofPath = join(directory, 'run-proof.json');
  if (!existsSync(proofPath)) throw new Error('preview: durable Five/Six proof missing');
  const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
  if (JSON.stringify(proof.contextReferences) !== JSON.stringify(expectedReferences)) throw new Error('preview: recovered context differs');
  const files = openRunFiles(directory);
  const captureBytes = Object.fromEntries(proof.captureReferences.map(reference => {
    const bytes = files.captures.read(reference); if (bytes === null) throw new Error('preview: recovered run capture missing');
    return [reference, bytes];
  }));
  const before = files.segment.read().map(row => ({ id: row.id, kind: row.kind, hash: row.contentHash }));
  if (JSON.stringify(before) !== JSON.stringify(proof.facts)) throw new Error('preview: durable run facts changed');
  const owner = createOwner(files, context, facts, opening, { register: proof.register, schemas: proof.schemas,
    captureBytes, admissions: new Set(proof.admissions), intakeOwners: proof.intakeOwners });
  const after = value(owner.store.read()).map(row => ({ id: row.id, kind: row.kind, hash: row.contentHash }));
  if (JSON.stringify(after) !== JSON.stringify(proof.facts) || owner.id !== proof.run
    || !after.some(row => row.id === proof.grounding && row.kind === 'session-grounding')) {
    throw new Error('preview: Five/Six reconstruction differs from durable proof');
  }
  validateSavedGrounding(owner, proof.grounding);
  return proofPath;
}

export async function stage2GuardedProviderPath(input: PreviewCompositionInput) {
  return createPreviewComposition({ ...input, stage: 2 });
}

export function createPreviewComposition(input: PreviewCompositionInput) {
  const configuration = input.configuration;
  if (input.stage !== 2 && !input.noticeOnly && stage2SidecarExists(configuration.root)) throw Error('preview: stage2 sidecar excludes stage1');
  if (input.stage === 2 && stage2SidecarExists(configuration.root)) {
    const historical = stage2HistoricalStatus(configuration.root, input.state.read(), configuration);
    // Optional supplied deployment bindings must still name this history. This
    // is an immutable-byte comparison, not current activation or lease admission.
    if (input.stage2 && (encoded(input.stage2.activation).hash !== historical.activationDigest
      || encoded(subscriptionInvocationPolicy(input.stage2.model)).hash !== historical.policyDigest
      || encoded(input.stage2.profile).hash !== input.stage2.activation.profileDigest
      || input.stage2.cutoff !== historical.cutoff)) throw Error('preview: historical stage2 binding differs');
    if (historical.phase === 'reply-dispatch-unknown') {
      const sidecar = openStage2State({ root: configuration.root, state: input.state,
        activationDigest: historical.activationDigest, policyDigest: historical.policyDigest, cutoff: historical.cutoff,
        ownerFactsExist: () => true });
      const lifecycle = stage2Lifecycle({ sidecar, state: input.state, configuration,
        directory: join(configuration.root, '.preview-stage2'), now: input.stage2?.now ?? Date.now });
      return Object.freeze({ sidecar, terminal: lifecycle.terminal, resumeOne: lifecycle.resumeOne,
        resume: async () => { await lifecycle.resumeOne(); }, pollOnce: () => null, close: () => {} });
    }
    if (historical.terminalLatch) {
      const read = () => stage2HistoricalStatus(configuration.root, input.state.read(), configuration);
      return Object.freeze({ sidecar: Object.freeze({ read }), terminal: () => read().terminalLatch,
        resumeOne: async () => { read(); return false; }, resume: async () => { read(); },
        pollOnce: () => null, close: () => {} });
    }
  }
  const stateDocument = input.state.gate('admit');
  const stage2Now = input.stage2?.now ?? Date.now;
  const stage2Directory = join(configuration.root, '.preview-stage2');
  let sidecar, sidecarOptions;
  if (input.stage === 2) {
    const config = input.stage2;
    if (!config || configuration.botId !== '8820318295' || configuration.botUsername !== '@echo_mmtest_seam_b27x_bot'
      || configuration.operatorSenderId !== '7812716706' || configuration.chatId !== '7812716706'
      || configuration.chatKind !== 'private' || configuration.forum || configuration.messageThreadId !== null)
      throw Error('preview: stage2 deployment binding differs');
    const activationDigest = stage2Activation({ ...config, now: stage2Now(), trial: stateDocument.trial.id,
      configurationDigest: stateDocument.trial.configurationDigest });
    validateStage2Successor({ ...config, root: configuration.root, outer: stateDocument });
    sidecarOptions = { root: configuration.root, state: input.state, activationDigest,
      policyDigest: encoded(subscriptionInvocationPolicy(config.model)).hash, cutoff: config.cutoff,
      create: config.arm === true, ownerFactsExist: () => existsSync(join(stage2Directory, 'facts.json')) };
  }
  const fixture = conversationFixture({ botId: configuration.botId, skipInitialAdmission: true });
  const scheduledDeclaration = fixture.intake.r.declaration(scheduledParserDeclarationId, 'parsers', {
    fixture: 'P12-TELEGRAM-REPLY-CAPTURE', authenticationClass: [{ stimulusType: 'message', class: 'verified' }],
    eventIdAuthority: { mintedBy: 'scheduled package owner', uniquenessScope: 'job instance and system sender',
      replayWindow: 0, fallbackFingerprint: { policy: 'none', basis: 'occurrence hash required' } }, ackPolicy: 'never',
  }, { profile: fixture.intake.r.profile });
  const scheduledGoverned = fixture.intake.govern([...fixture.declarations, scheduledDeclaration]);
  const authorityInstant = input.now?.() ?? fixture.intake.f.now.value;
  if (!Number.isSafeInteger(authorityInstant) || authorityInstant < 0) throw new Error('preview: invalid authority clock');
  const context = fixture.intake.context;
  const previewRegister = { ...context.decode.register,
    generation: { owner: 'part-three', name: 'RegisterGeneration',
      id: value(generationOf(scheduledGoverned.governance.register, fixture.intake.r.context)).id },
    entries: [...new Set([...context.decode.register.entries, 'preview', scheduledParserDeclarationId])] };
  Object.assign(context, { decode: { ...context.decode, register: previewRegister } });
  const decodeContext = { ...context.decode, site: fixture.intake.f.c.site, preserved: fixture.intake.f.c.preserved };
  const storage = value(openProductionStorage({ root: configuration.root, machine: configuration.machine,
    key: input.storageKey, policy: 'preview-stage-1-isolated-local-custody', store: 'preview-stage-1-facts',
    context: decodeContext, io: input.storageIO }));
  try {
    if (sidecarOptions) {
      sidecar = openStage2State(sidecarOptions);
      if (!sidecar.read().selectedTurn && stateDocument.trial.expiresAt - stage2Now() < OWNER_WINDOW_MS)
        throw Error('preview: insufficient trial lifetime');
    }
    const route = expectedRoute(configuration);
    restoreFactCaptures(storage, fixture);
    seedSignedBinding(storage, fixture, route, stateDocument.trial);
    fixture.intake.setTime(authorityInstant);
    Object.assign(context, { genesis: { ...context.genesis, clock: fixture.intake.f.clock(authorityInstant) } });
    const declaration = Object.freeze({ ...fixture.declaration,
      bot: Object.freeze({ id: configuration.botId, username: configuration.botUsername, identityEpoch: 'preview-stage-1' }),
      token: telegramSecret, cursor: Object.freeze({ ...fixture.declaration.cursor,
        initialOffset: input.state.read().cursor.nextOffset, maxPollSeconds: configuration.maxPollSeconds,
        maxBatchItems: configuration.maxBatchItems }) });
    const chosenTelegramIO = input.telegramIO ?? input.telegramIOFactory?.(storage);
    const telegramIO = input.noticeOnly ? { invoke(request, credential) {
      if (request.method === 'sendMessage') input.state.gate('dispatch');
      return chosenTelegramIO.invoke(request, credential);
    } } : input.stage !== 2 ? chosenTelegramIO : { invoke(request, credential) {
      input.state.gate(request.method === 'getUpdates' ? 'poll' : 'dispatch');
      const d = sidecar.read();
      if (request.method === 'sendMessage' && (d.terminalLatch || stage2Now() >= d.ownerDeadline
        || input.stage2.active?.() === false)) throw Error('preview: physical reply gate closed');
      return chosenTelegramIO.invoke(request, credential);
    } };
    if (!telegramIO) throw new Error('preview: Telegram physical IO is required');
    const identityPlan = value(fixture.verification.inspectCurrent()).find(row => row.record.type === 'VerificationPlan')?.record;
    if (!identityPlan) throw new Error('preview: identity plan stand-in missing');
    const captures = Object.freeze({ owner: 'part-ten' as const, read: reference => storage.captures.read(reference),
      preserve: (reference, bytes) => { const saved = storage.captures.preserve(reference, bytes);
        if (saved && !reference.includes(':sealed-getMe:')) { fixture.intake.f.captures[reference] = bytes; fixture.intake.syncCaptures(); }
        return saved; } });
    const api = value(createProductionTelegramCustodian({ context: decodeContext, declaration,
      credential: telegramSecret, resolveSecret: input.resolveSecret, captures,
      machine: fixture.intake.deps.author.machine, now: () => fixture.intake.f.clock(100), freshFor: 50,
      identityEvidence: { verification: fixture.verification, plan: identityPlan.id,
        arm: identityPlan.arms.find(arm => arm.required).id, generation: 'generation:fixture' }, io: telegramIO }));
    input.state.gate('admit');
    const admitted = value(admitTelegramAdapter(declaration, { ...fixture.admissionDependencies, api }));
    const telegramIntakeAdapter = createTelegramIntakeAdapter(admitted, api);
    const allowlistedIntakeAdapter = Object.freeze({ ...telegramIntakeAdapter,
      authenticate(raw, capturedRoute, at) {
        if (capturedRoute.channel !== route.channel || capturedRoute.sender !== route.sender
          || capturedRoute.identityEpoch !== route.identityEpoch) {
          throw new Error('preview: route is outside the configured trial allowlist');
        }
        return telegramIntakeAdapter.authenticate(raw, capturedRoute, at);
      } });
    Object.assign(context, { ownedBodies: [value(intakeWorkRegistration(decodeContext, fixture.intake.deps.author.principal.id)),
      value(intakeStopRegistration(decodeContext, fixture.intake.deps.author.principal.id))] });
    const factContext = () => context;
    const intake = value(createIntakePort({ ...fixture.intake.deps, context: factContext,
      governance: scheduledGoverned.governance, adapter: allowlistedIntakeAdapter, storage: storage.segment,
      capture: { owner: 'part-ten', preserve: (bytes, _at) => {
        const parsed = JSON.parse(bytes), digest = hashBytes(bytes);
        const reference = `capture:telegram:update-${String(parsed.update_id)}:${digest.slice(7)}`;
        if (!captures.preserve(reference, bytes) || !captures.preserve(digest, bytes)) throw new Error('preview: intake custody failed');
        fixture.intake.f.captures[reference] = bytes; fixture.intake.f.captures[digest] = bytes; fixture.intake.syncCaptures();
        return fixture.intake.f.success({ reference, hash: digest });
      } },
      dedupGeneration: () => ({ reference: context.decode.register.generation,
        kinds: context.schemas.map(schema => schema.kind), lineages: { [fixture.intake.deps.author.machine]: {
          head: storage.segment.read().at(-1)?.segment ?? null, observedAt: authorityInstant, closed: false } } }) }));
    const scheduledAdapter = createScheduledIntakeAdapter(input.scheduledAuthority ?? {
      context: decodeContext, sources: () => [],
      verifySource: () => { throw Error('preview: no registered scheduled source'); },
      authorize: () => { throw Error('preview: no scheduled authority'); },
    });
    const scheduledIntake = value(createIntakePort({ ...fixture.intake.deps, context: factContext,
      governance: scheduledGoverned.governance, adapter: scheduledAdapter, storage: storage.segment,
      capture: { owner: 'part-ten', preserve: (bytes, _at) => {
        const digest = hashBytes(bytes), reference = `capture:scheduled:${digest.slice(7)}`;
        if (!captures.preserve(reference, bytes) || !captures.preserve(digest, bytes))
          throw Error('preview: scheduled intake custody failed');
        fixture.intake.f.captures[reference] = bytes; fixture.intake.f.captures[digest] = bytes;
        fixture.intake.syncCaptures();
        return fixture.intake.f.success({ reference, hash: digest });
      } },
      clock: () => fixture.intake.f.clock(input.now?.() ?? Date.now()),
      dedupGeneration: () => ({ reference: context.decode.register.generation,
        kinds: context.schemas.map(schema => schema.kind), lineages: { [fixture.intake.deps.author.machine]: {
          head: storage.segment.read().at(-1)?.segment ?? null, observedAt: input.now?.() ?? Date.now(), closed: false } } }) }));
    const scheduled = createScheduledRunner({ intake: scheduledIntake,
      sources: () => input.scheduledAuthority?.sources() ?? [],
      facts: () => createFactStore(factContext(), storage.segment).read(),
      clock: ms => fixture.intake.f.clock(ms), usage: input.scheduledUsage ?? (() => 'unknown'),
      stopped: () => input.state.read().stop !== null,
      capacity: () => { try { input.state.gate('admit'); return true; } catch { return false; } },
      startOnce: input.scheduledStartOnce ?? (() => { throw Error('preview: scheduled Run owner unavailable'); }),
      context: decodeContext });
    const facts = createFactStore(factContext(), storage.segment);
    const ingress = createTelegramIngress({ boundary: fixture.admissionDependencies.boundary,
      admitted, api, intake, facts, observer: fixture.intake.deps.author.principal.id });
    const target = Object.freeze({ chatId: configuration.chatId, forum: configuration.forum,
      messageThreadId: configuration.messageThreadId });

    const durableCandidates = () => {
      const rows = value(createFactStore(factContext(), storage.segment).read());
      const candidates = new Map<number, any>();
      const priority = { 'preserved-unresolved': 0, refused: 1, held: 2, stopped: 3,
        'admitted-unbound': 4, 'admitted-bound': 5 };
      const consider = (row, disposition: PreviewIntakeDisposition, body) => {
        const updateId = Number(body.eventId); if (!Number.isSafeInteger(updateId) || updateId < 0) return;
        const routeValue = { channel: body.channel, sender: body.sender, identityEpoch: body.identityEpoch, eventId: String(body.eventId) };
        const receipt = String(body.receipt ?? row.id);
        const candidate = { id: previewTurnId(configuration.botId, updateId), updateId, route: routeValue,
          receipt, preserved: row.id, disposition };
        const prior = candidates.get(updateId);
        if (!prior || priority[disposition] > priority[prior.disposition]) candidates.set(updateId, candidate);
      };
      for (const row of rows) {
        if (row.kind === 'intake-admitted') {
          const routeMatches = row.body.channel === route.channel && row.body.sender === route.sender
            && row.body.identityEpoch === route.identityEpoch;
          consider(row, row.body.binding !== 'none' && routeMatches ? 'admitted-bound' : 'admitted-unbound', row.body);
        } else if (row.kind === 'intake-held') consider(row, 'held', row.body);
        else if (row.kind === 'intake-stop' || row.kind === 'intake-stop-signal') consider(row, 'stopped', row.body);
        else if (row.kind === 'intake-mismatch') consider(row, 'refused', row.body);
        else if (row.kind === 'intake-receipt') {
          try { const inbound = JSON.parse(row.body.ingress); consider(row, 'preserved-unresolved', {
            ...inbound, receipt: row.id, eventId: inbound.eventId }); } catch { /* inert corrupt candidates remain in owner storage */ }
        }
      }
      return [...candidates.values()].sort((left, right) => left.updateId - right.updateId);
    };

    const reconcileDurableIntake = (runHooks = false) => {
      for (const candidate of durableCandidates()) {
        input.state.gate('admit');
        if (runHooks) input.hooks?.beforeIntakeIndex?.({ id: candidate.id, updateId: candidate.updateId });
        input.state.recordIntake(candidate);
        const turn = input.state.read().turns[candidate.id];
        if (runHooks) input.hooks?.afterIntake?.(turn);
        if (candidate.disposition === 'stopped') input.state.latchStop('operator');
      }
    };

    const buildContext = (turn: PreviewTurn) => {
      const candidates = Object.values(input.state.read().turns)
        .filter(row => row.disposition === 'admitted-bound' && row.updateId <= turn.updateId)
        .sort((left, right) => left.updateId - right.updateId);
      if (candidates.length > configuration.maxContextTurns) throw new Error('preview: context turn bound reached; admission paused');
      const currentFacts = value(createFactStore(factContext(), storage.segment).read());
      let total = 0;
      const records = candidates.map(candidate => {
        const admittedFact = currentFacts.find(row => row.kind === 'intake-admitted'
          && String(row.body.eventId) === String(candidate.updateId) && row.body.binding !== 'none');
        if (!admittedFact) throw new Error('preview: bounded context admission unavailable');
        const receipt = currentFacts.find(row => row.id === admittedFact.body.receipt && row.kind === 'intake-receipt');
        const reference = receipt?.body?.capture?.reference;
        const bytes = typeof reference === 'string' ? storage.captures.read(reference) : null;
        if (bytes === null) throw new Error('preview: prior context capture unavailable');
        total += Buffer.byteLength(bytes);
        if (total > configuration.maxContextBytes) throw new Error('preview: context byte bound reached; admission paused');
        return { admittedFact, reference, hash: hashBytes(bytes), bytes };
      });
      return { records, references: records.map(row => row.reference), allowedIntakeIds: records.map(row => row.admittedFact.id),
        digest: hashBytes(JSON.stringify(records.map(({ reference, hash }) => ({ reference, hash })))) };
    };

    const openingFor = (turn: PreviewTurn) => value(createFactStore(factContext(), storage.segment).read())
      .find(row => row.kind === 'intake-admitted' && String(row.body.eventId) === String(turn.updateId) && row.body.binding !== 'none');

    const ground = (turn: PreviewTurn) => {
      input.state.gate('admit');
      const currentFacts = value(createFactStore(factContext(), storage.segment).read());
      const opening = openingFor(turn);
      if (!opening) throw new Error('preview: Four input lacks the exact bound operator selection');
      const bounded = buildContext(turn);
      const proof = establishFiveAndSix(runDirectory(configuration, turn), factContext(), currentFacts, opening,
        bounded.allowedIntakeIds, bounded.references);
      recoverFiveAndSix(runDirectory(configuration, turn), factContext(), currentFacts, opening, bounded.references);
      input.state.advance(turn.id, 'intake-preserved', 'grounded', { contextReferences: bounded.references,
        contextDigest: bounded.digest, runEvidence: proof });
    };

    const exactApiAcceptance = (observation, effects, expectedText = FIXED_LIMITED_RESPONSE) => {
      if (observation.stage !== 'response') return false;
      const captured = effects.ctx.captures[observation.capture.reference];
      if (!captured || hashBytes(captured.bytes) !== observation.capture.hash) return false;
      try {
        const response = JSON.parse(captured.bytes), result = response.result;
        return response.ok === true && Number.isSafeInteger(result?.message_id) && result.message_id > 0
          && String(result?.chat?.id) === target.chatId
          && (target.messageThreadId === null || result.message_thread_id === target.messageThreadId)
          && result.text === expectedText;
      } catch { return false; }
    };

    const dispatchPrepared = (key: string, outbound: string, beforePhysical, afterPhysical,
      accountOutcome = true) => {
      input.state.gate('dispatch');
      input.state.reserveReply();
      const effectRoot = join(configuration.root, '.preview-effects', `${key}-${randomUUID()}`);
      mkdirSync(effectRoot, { recursive: true, mode: 0o700 });
      const effects = effectFixture(effectRoot, `preview-executor:${key}`);
      effects.host.boundary.register.entries.push('telegram-ordinary-reply', admitted.id);
      const conversation = telegramConversation(configuration.botId, target);
      const definition = { type: 'OperationDefinition', schemaVersion: 1, id: `preview-reply-definition:${key}`,
        feature: 'telegram-ordinary-reply', version: 'telegram:9.2:ordinary-reply:v1', adapter: admitted.id,
        account: admitted.account, conversation, generation: effects.host.current().decode.register.generation.id,
        speaker: effects.host.principal.id, scopeDigest: value(canonical(effects.host.scope)).hash,
        durability: 'replicated' as const, replicas: 1,
        lossModel: 'Same-machine fixture peer STAND-IN; shared disk loss is NOT covered.',
        maxBytes: declaration.limits.maxReplyBytes, maxCharge: declaration.limits.maxCharge,
        timeout: declaration.limits.timeout, verificationBar: 'preview-recorded-reply-bar' };
      const approvedIn = effects.authorize({ id: `preview-reply-approval:${key}`,
        artifact: effects.capture(value(canonical(definition)).bytes), base: `preview-reply-base:${key}` });
      effects.versions([{ id: definition.version, subject: definition.feature, content: json(definition),
        contentHash: value(canonical(definition)).hash, since: effects.pending.id, supersedes: [],
        approvedIn, base: approvedIn.base, landedIn: null }]);
      const installed = value(installTelegramReplyOperation({ id: definition.id, generation: definition.generation,
        admitted, target, speaker: definition.speaker, scopeDigest: definition.scopeDigest,
        durability: definition.durability, replicas: definition.replicas, lossModel: definition.lossModel,
        verificationBar: definition.verificationBar }, effects.host, effects.spine));
      const rendered = value(renderTelegramHtml(outbound, declaration, effects.host.boundary));
      const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1,
        id: `preview-reply:${key}`, semanticMessage: `preview-semantic:${key}`,
        run: effects.run.id, speaker: effects.host.principal.id, account: admitted.account, conversation,
        text: rendered, purpose: 'ordinary-reply', sourceResult: effects.pending.id }, effects.host));
      const adapter = createTelegramReplyOperationAdapter(admitted, api, target, effects.host.boundary);
      const doorway = createEffectDoorway({ ...effects.composition, adapter, assessment: null });
      const request = value(adapter.prepare(doorway, { definition: installed.id, message, run: effects.run,
        pending: effects.pending.id, attempt: `preview-attempt:${key}`,
        verificationOwner: 'preview-recorded-verifier', obligation: effects.obligation, closure: [], fence: effects.fence }));
      input.state.gate('dispatch');
      beforePhysical(request);
      const observation = value(doorway.dispatch(request, effects.fence));
      const accepted = exactApiAcceptance(observation, effects, outbound);
      afterPhysical(observation, accepted);
      if (!accepted) {
        if (accountOutcome) input.state.noteError();
        return false;
      }
      if (accountOutcome) input.state.noteSuccess();
      return true;
    };

    const dispatch = (turn: PreviewTurn, noticeText?: string) => {
      input.state.gate('dispatch');
      const currentFacts = value(createFactStore(factContext(), storage.segment).read());
      const opening = openingFor(turn); if (!opening) throw new Error('preview: durable opening unavailable');
      recoverFiveAndSix(runDirectory(configuration, turn), factContext(), currentFacts, opening, turn.contextReferences);
      const outbound = noticeText ? noticeText : FIXED_LIMITED_RESPONSE;
      return dispatchPrepared(String(turn.updateId), outbound, request => {
        input.state.advance(turn.id, 'grounded', 'dispatch-outcome-unknown', { replyOperation: request.id });
        if (noticeText) input.hooks?.afterNoticePrepare?.(input.state.read().turns[turn.id]);
      }, (observation, accepted) => {
        input.hooks?.afterDispatch?.(input.state.read().turns[turn.id]);
        input.state.advance(turn.id, 'dispatch-outcome-unknown',
          accepted ? 'api-accepted' : 'dispatch-outcome-unknown',
          { replyOperation: observation.operation, replyObservation: observation.id });
      });
    };

    const resumeOne = () => {
      reconcileDurableIntake(false);
      const pending = input.state.pending().sort((left, right) => left.updateId - right.updateId)[0];
      if (!pending) return false;
      const current = input.state.read().turns[pending.id];
      if (current.phase === 'intake-preserved') ground(current);
      else if (current.phase === 'grounded') { input.hooks?.beforeDispatch?.(current); dispatch(current); }
      return true;
    };
    const resume = () => { while (resumeOne()) { /* recorded/tests convenience; launcher uses resumeOne with yields */ } };
    const dispatchNotice = (turnId: string, text: string) => {
      const turn = input.state.read().turns[turnId];
      if (!input.noticeOnly || !turn || turn.disposition !== 'admitted-bound'
        || !['intake-preserved', 'grounded'].includes(turn.phase)) throw Error('preview: notice turn not eligible');
      input.state.gate('dispatch');
      if (turn.phase === 'intake-preserved') ground(turn);
      return dispatch(input.state.read().turns[turnId], text);
    };
    const dispatchHostNotice = (episodePath: string) => {
      if (!input.noticeOnly || episodePath !== join(configuration.root, 'host-watch.json'))
        throw Error('preview: host notice path refused');
      const state = input.state.gate('dispatch');
      const authority = state.trial.hostNotice;
      const episode = JSON.parse(readFileSync(episodePath, 'utf8'));
      if (!authority || authority.botId !== configuration.botId || authority.chatId !== configuration.chatId
        || !isHostOutageText(authority.message) || episode.version !== 1 || episode.open !== true
        || episode.phase !== 'prepared' || episode.trial !== state.trial.id
        || episode.configurationDigest !== state.trial.configurationDigest
        || episode.botId !== authority.botId || episode.chatId !== authority.chatId
        || episode.message !== authority.message || !/^[-a-f0-9]{36}$/.test(episode.id)
        || !Number.isSafeInteger(episode.failedAttempt) || episode.failedAttempt < 2
        || !Number.isSafeInteger(episode.firstFailure?.at)
        || !Number.isSafeInteger(episode.recoveryFailure?.at)
        || episode.firstFailure.at > episode.recoveryFailure.at
        || episode.recoveryFailure.at > episode.preparedAt
        || !(episode.recoveryFailure.code === null || Number.isSafeInteger(episode.recoveryFailure.code))
        || !(episode.recoveryFailure.signal === null || typeof episode.recoveryFailure.signal === 'string'))
        throw Error('preview: host notice authority differs');
      return dispatchPrepared(`host-${episode.id}`, HOST_OUTAGE_TEXT, request => {
        input.state.gate('dispatch');
        const latest = JSON.parse(readFileSync(episodePath, 'utf8'));
        if (JSON.stringify(latest) !== JSON.stringify(episode)) throw Error('preview: host episode changed');
        durablePreviewWrite(episodePath, { ...episode, phase: 'dispatch-outcome-unknown', operation: request.id });
      }, () => { /* uncertain and accepted outcomes are both one attempt */ }, false);
    };
    const pollOnce = () => {
      reconcileDurableIntake(false);
      input.state.gatePollCapacity(configuration.maxBatchItems);
      const cycle = value(ingress.pollOnce());
      input.state.completePoll(cycle.nextOffset);
      reconcileDurableIntake(true);
      return cycle;
    };

    if (sidecar) {
      const activationActive = () => {
        try { stage2Activation({ ...input.stage2, now: stage2Now(), trial: stateDocument.trial.id,
          configurationDigest: stateDocument.trial.configurationDigest });
          return input.stage2.active?.() !== false; } catch { return false; }
      };
      const messageTime = turn => {
        const opening = openingFor(turn), rows = storage.segment.read();
        const receipt = rows.find(row => row.id === opening?.body.receipt);
        const bytes = receipt && storage.captures.read(receipt.body.capture.reference);
        const parsed = bytes && JSON.parse(bytes);
        return typeof parsed?.message?.date === 'number' ? parsed.message.date * 1000 : 0;
      };
      const selectedContext = turn => {
        const bounded = buildContext(turn), opening = openingFor(turn);
        const records = bounded.records;
        const current = records.find(row => row.admittedFact.id === opening.id);
        const question = JSON.parse(current.bytes).message?.text;
        if (typeof question !== 'string' || question.length === 0) throw Error('preview: exact text unavailable');
        return { ...bounded, question, conversation: records.map(row => JSON.parse(row.bytes)),
          messages: records.map(row => ({ fact: { owner: 'part-two', name: 'FactEnvelope', id: row.admittedFact.id },
            sequence: row.admittedFact.segment.position, capture: row.reference, hash: row.hash })),
          seed: { ...factContext(), facts: storage.segment.read(), opening } };
      };
      const active = () => { try { input.state.gate('dispatch');
        const d = sidecar.read(); return activationActive() && !d.terminalLatch && (d.ownerDeadline === null || stage2Now() < d.ownerDeadline);
      } catch { return false; } };
      const lifecycle = stage2Lifecycle({ sidecar, state: input.state, now: stage2Now, configuration,
        invocationBinding: stage2InvocationBinding(input.stage2), activationActive, directory: stage2Directory, model: input.stage2.model, selectedContext, messageTime,
        reconcileIntake: reconcileDurableIntake, telegram: { api, admitted, target, declaration },
        routeFactory: stage2RouteFactory({ ...input.stage2, now: stage2Now, active,
          io: { ...input.stage2.io, execute: command => {
            if (command.args.includes('--print')) input.state.gateSpend();
            return input.stage2.io.execute(command);
          } } }),
        checkpoint: input.stage2.checkpoint });
      const advance = async () => {
        try { return await lifecycle.resumeOne(); }
        catch (error) { if (sidecar.read().phase === 'api-accepted') throw error;
          const stop = input.state.read().stop;
          const selected = input.state.read().turns[sidecar.read().selectedTurn];
          if (selected && ['intake-preserved', 'grounded'].includes(selected.phase) && !selected.failureClass)
            input.state.markFailure(selected.id, 'unknown', null);
          sidecar.hold(stop?.reason === 'expiry' || stage2Now() >= stateDocument.trial.expiresAt ? 'EXPIRED'
            : stop ? 'STOPPED' : error?.previewBound ? 'BOUND' : 'REFUSED',
            error?.previewBound ?? {}, sidecar.read().contextReferences); return false; }
      };
      return Object.freeze({ storage, api, admitted, intake, scheduledIntake, scheduled, ingress, declaration, target, sidecar,
        terminal: lifecycle.terminal, resumeOne: advance, resume: async () => { while (await advance()) await new Promise(resolve => setImmediate(resolve)); },
        pollOnce: () => { if (!active()) return null; return pollOnce(); }, reconcileDurableIntake,
        close: () => storage.close() });
    }
    return Object.freeze({ storage, api, admitted, intake, scheduledIntake, scheduled, ingress, declaration, target,
      standIns: PREVIEW_STAND_IN_LEDGER, reconcileDurableIntake, pollOnce, resumeOne, resume, dispatchNotice, dispatchHostNotice,
      close: () => storage.close() });
  } catch (error) { storage.close(); throw error; }
}
