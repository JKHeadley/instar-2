// @ts-nocheck -- this test-side composition deliberately joins independently typed owner fixtures.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '../../src/index.js';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import { createIntakePort, intakeStopRegistration, intakeWorkRegistration } from '../../src/intake/index.js';
import {
  admitTelegramAdapter, createTelegramIngress, createTelegramIntakeAdapter,
  createTelegramReplyOperationAdapter, installTelegramReplyOperation, renderTelegramHtml,
  telegramConversation,
} from '../../src/conversation/index.js';
import { createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import { createProductionTelegramCustodian } from '../../src/assembly/production-telegram.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { createProductionGroundingReader } from '../../src/assembly/context-delivery.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { conversationFixture } from '../conversation/fixture.js';
import { effectFixture } from '../effects/fixture.js';
import { createProductionBootOwnerFixture } from '../assembly/production-boot-owner-fixture.js';
import { json, value } from '../facts/fixtures.js';
import { previewTurnId } from './state.js';
import type { PreviewState, PreviewTurn } from './state.js';

export const PREVIEW_LABEL = 'PREVIEW — experimental test agent; production safeguards incomplete.';
export const FIXED_LIMITED_RESPONSE = `${PREVIEW_LABEL}\nYour message was preserved and grounded for this supervised trial. No model was called.`;

/** Nothing in this ledger is allowed to present itself as production evidence. */
export const PREVIEW_STAND_IN_LEDGER = Object.freeze([
  Object.freeze({ name: 'fixture-governance-and-register', claims: 'test declaration/conformance authority only', replaces: 'M3 Part B / M3-S' }),
  Object.freeze({ name: 'fixture-signing-and-standing-grants', claims: 'test identity and binding authority only', replaces: 'M3 Part B / M4 custody' }),
  Object.freeze({ name: 'fixture-clock-and-verification-host', claims: 'recorded freshness and assessment only', replaces: 'M4 host' }),
  Object.freeze({ name: 'fixture-five-six-run-admission', claims: 'recorded run opening, grounding, fence and reservation only', replaces: 'M3-I capacity / M4 host' }),
  Object.freeze({ name: 'fixture-context-assembler', claims: 'bounded preview context index; not Five production grounding evidence', replaces: 'M4-L launch' }),
  Object.freeze({ name: 'fixture-effect-peer-directory', claims: 'second local directory only; not a surviving replica', replaces: 'M4-L launch' }),
  Object.freeze({ name: 'fixture-nine-effect-assessor', claims: 'recorded assessment only; not independent live evidence', replaces: 'M4 G6, including Nine' }),
  Object.freeze({ name: 'fixture-five-source-result', claims: 'fixed-response source marker only; not a model answer', replaces: 'M4 G6, including Nine' }),
]);

export interface PreviewConfiguration {
  readonly root: string;
  readonly machine: string;
  readonly botId: string;
  readonly botUsername: string;
  readonly operatorSenderId: string;
  readonly chatId: string;
  readonly forum: boolean;
  readonly messageThreadId: number | null;
  readonly maxPollSeconds: number;
  readonly maxBatchItems: number;
  readonly maxContextTurns: number;
  readonly maxContextBytes: number;
}

export interface PreviewCompositionInput {
  readonly configuration: PreviewConfiguration;
  readonly state: PreviewState;
  readonly storageKey: Uint8Array;
  readonly storageIO: unknown;
  readonly telegramIO?: unknown;
  readonly telegramIOFactory?: (storage: unknown) => unknown;
  readonly resolveSecret: (reference: Readonly<{ vault: string; name: string }>) => string;
  readonly hooks?: Readonly<{
    afterIntake?: (turn: PreviewTurn) => void;
    beforeDispatch?: (turn: PreviewTurn) => void;
    afterDispatch?: (turn: PreviewTurn) => void;
  }>;
}

const telegramSecret = Object.freeze({ type: 'SecretRef' as const, schemaVersion: 1 as const,
  vault: 'preview', name: 'telegram-bot-token' });

function expectedRoute(configuration: PreviewConfiguration) {
  const target = { chatId: configuration.chatId, forum: configuration.forum,
    messageThreadId: configuration.messageThreadId };
  return Object.freeze({
    channel: telegramConversation(configuration.botId, target),
    sender: `telegram:v1:user:${configuration.operatorSenderId}`,
    identityEpoch: `telegram:v1:bot:${configuration.botId}:epoch:preview-stage-1`,
    eventId: null,
  });
}

function seedSignedBinding(storage, fixture, route): void {
  fixture.bind(route);
  const existing = new Set(storage.segment.read().map(row => row.id));
  for (const fact of fixture.intake.storage.read()) {
    if (existing.has(fact.id)) continue;
    const head = storage.segment.read().at(-1)?.contentHash ?? null;
    value(storage.segment.append(value(canonical(fact)).bytes, head));
    existing.add(fact.id);
  }
}

function restoreFactCaptures(storage, fixture): void {
  const references = new Set<string>();
  const visit = value => {
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    if (value === null || typeof value !== 'object') return;
    if (typeof value.reference === 'string') references.add(value.reference);
    for (const nested of Object.values(value)) visit(nested);
  };
  for (const fact of storage.segment.read()) visit(fact);
  for (const reference of references) {
    const bytes = storage.captures.read(reference);
    if (bytes !== null) fixture.intake.f.captures[reference] = bytes;
  }
  fixture.intake.syncCaptures();
}

function receiptCapture(facts, receiptId: string): string {
  const receipt = facts.find(row => row.id === receiptId && row.kind === 'intake-receipt');
  const reference = receipt?.body?.capture?.reference;
  if (typeof reference !== 'string' || reference.length === 0) throw new Error('preview: intake capture reference missing');
  return reference;
}

function runThroughFiveAndSix(context, facts, opening) {
  // The fixture supplies the named authority stand-ins, while createRunGraph/open/ground
  // and its Six admission callbacks are the landed owner implementations.
  const frames = [...facts];
  const segment = { owner: 'part-ten' as const, read: () => frames,
    append: (bytes: string, expectedHead: string | null) => {
      if ((frames.at(-1)?.contentHash ?? null) !== expectedHead) throw new Error('preview run segment: compare-head failed');
      frames.push(JSON.parse(bytes));
      return { kind: 'Success', value: { kind: 'local-durable' } };
    } };
  const owner = createProductionBootOwnerFixture(() => segment, {
    minimal: true,
    intake: { ...context, facts, opening },
  });
  const groundedOwners = owner.groundingFor({ spine: owner.spine, scope: 'scope:minimal' });
  const reader = createProductionGroundingReader({ scope: 'scope:minimal',
    runtime: groundedOwners.runtime, harness: groundedOwners.harness, context: groundedOwners.context,
    clock: groundedOwners.clock, sample: groundedOwners.sample });
  const graph = value(createRunGraph({ ...groundedOwners.graphDependencies,
    store: groundedOwners.spine.store, assemblyHistory: groundedOwners.history, grounding: reader }));
  const opened = value(graph.open(owner.run));
  const grounded = value(graph.ground(owner.id, 'w', owner.harnessId, 'start', owner.lease));
  return { owner, opened, grounded };
}

export function stage2GuardedProviderPath(): never {
  throw new Error('stage-2 guarded provider path is not installed; G6 exact-response acceptance is required');
}

export function createPreviewComposition(input: PreviewCompositionInput) {
  const configuration = input.configuration;
  input.state.gate('admit');
  const fixture = conversationFixture({ botId: configuration.botId, skipInitialAdmission: true });
  const context = fixture.intake.context;
  const previewRegister = { ...context.decode.register,
    entries: [...new Set([...context.decode.register.entries, 'preview'])] };
  Object.assign(context, { decode: { ...context.decode, register: previewRegister } });
  const decodeContext = { ...context.decode, site: fixture.intake.f.c.site, preserved: fixture.intake.f.c.preserved };
  const storage = value(openProductionStorage({
    root: configuration.root,
    machine: configuration.machine,
    key: input.storageKey,
    policy: 'preview-stage-1-isolated-local-custody',
    store: 'preview-stage-1-facts',
    context: decodeContext,
    io: input.storageIO,
  }));
  try {
    const route = expectedRoute(configuration);
    seedSignedBinding(storage, fixture, route);
    restoreFactCaptures(storage, fixture);
    const declaration = Object.freeze({
      ...fixture.declaration,
      bot: Object.freeze({ id: configuration.botId, username: configuration.botUsername, identityEpoch: 'preview-stage-1' }),
      token: telegramSecret,
      cursor: Object.freeze({ ...fixture.declaration.cursor, maxPollSeconds: configuration.maxPollSeconds,
        maxBatchItems: configuration.maxBatchItems }),
    });
    const telegramIO = input.telegramIO ?? input.telegramIOFactory?.(storage);
    if (!telegramIO) throw new Error('preview: Telegram physical IO is required');
    const identityPlan = value(fixture.verification.inspectCurrent())
      .find(row => row.record.type === 'VerificationPlan')?.record;
    if (!identityPlan) throw new Error('preview: identity plan stand-in missing');
    const captures = Object.freeze({ owner: 'part-ten' as const,
      read: reference => storage.captures.read(reference),
      preserve: (reference, bytes) => {
        const saved = storage.captures.preserve(reference, bytes);
        if (saved && !reference.includes(':sealed-getMe:')) {
          fixture.intake.f.captures[reference] = bytes;
          fixture.intake.syncCaptures();
        }
        return saved;
      } });
    const api = value(createProductionTelegramCustodian({
      context: decodeContext,
      declaration,
      credential: telegramSecret,
      resolveSecret: input.resolveSecret,
      captures,
      machine: fixture.intake.deps.author.machine,
      now: () => fixture.intake.f.clock(100),
      freshFor: 50,
      identityEvidence: { verification: fixture.verification, plan: identityPlan.id,
        arm: identityPlan.arms.find(arm => arm.required).id, generation: 'generation:fixture' },
      io: telegramIO,
    }));
    input.state.gate('admit');
    const admitted = value(admitTelegramAdapter(declaration, { ...fixture.admissionDependencies, api }));
    Object.assign(context, { ownedBodies: [
      value(intakeWorkRegistration(decodeContext, fixture.intake.deps.author.principal.id)),
      value(intakeStopRegistration(decodeContext, fixture.intake.deps.author.principal.id)),
    ] });
    // The physical store is read by FactStore/IntakePort. Repeating those same
    // frames in FactContext would counterfeit a second origin admission.
    const factContext = () => context;
    const intake = value(createIntakePort({
      ...fixture.intake.deps,
      context: factContext,
      governance: fixture.governed.governance,
      adapter: createTelegramIntakeAdapter(admitted, api),
      storage: storage.segment,
      capture: { owner: 'part-ten', preserve: (bytes, at) => {
        const captured = value(fixture.intake.deps.capture.preserve(bytes, at));
        if (!captures.preserve(captured.reference, bytes)) throw new Error('preview: intake custody failed');
        return fixture.intake.f.success(captured);
      } },
      dedupGeneration: () => ({ reference: context.decode.register.generation,
        kinds: context.schemas.map(schema => schema.kind),
        lineages: { [fixture.intake.deps.author.machine]: { head: storage.segment.read().at(-1)?.segment ?? null,
          observedAt: 100, closed: false } } }),
    }));
    const facts = createFactStore(factContext(), storage.segment);
    const ingress = createTelegramIngress({ boundary: fixture.admissionDependencies.boundary,
      admitted, api, intake, facts, observer: fixture.intake.deps.author.principal.id });
    const target = Object.freeze({ chatId: configuration.chatId, forum: configuration.forum,
      messageThreadId: configuration.messageThreadId });

    const buildContext = (turn: PreviewTurn) => {
      const document = input.state.read();
      const candidates = Object.values(document.turns)
        .filter(row => row.phase !== 'ignored-out-of-scope' && row.updateId <= turn.updateId)
        .sort((left, right) => left.updateId - right.updateId)
        .slice(-configuration.maxContextTurns);
      const currentFacts = value(createFactStore(factContext(), storage.segment).read());
      const references = candidates.map(row => receiptCapture(currentFacts, row.receipt));
      let total = 0;
      const rows = references.map(reference => {
        const bytes = storage.captures.read(reference);
        if (bytes === null) throw new Error('preview: prior context capture unavailable');
        total += Buffer.byteLength(bytes);
        if (total > configuration.maxContextBytes) throw new Error('preview: context bound reached; admission paused');
        return { reference, hash: hashBytes(bytes) };
      });
      return { references, digest: hashBytes(JSON.stringify(rows)) };
    };

    const ground = (turn: PreviewTurn) => {
      input.state.gate('admit');
      const currentFacts = value(createFactStore(factContext(), storage.segment).read());
      const opening = currentFacts.find(row => row.kind === 'intake-admitted'
        && String(row.body.eventId) === String(turn.route.eventId));
      if (!opening || opening.body.binding === 'none') throw new Error('preview: Four input lacks the exact bound operator selection');
      const prior = buildContext(turn);
      runThroughFiveAndSix(factContext(), currentFacts, opening);
      input.state.advance(turn.id, 'intake-preserved', 'grounded', {
        contextReferences: prior.references,
        contextDigest: prior.digest,
      });
    };

    const dispatch = (turn: PreviewTurn) => {
      input.state.gate('dispatch');
      input.state.reserveReply();
      const effectRoot = join(configuration.root, '.preview-effects', `${turn.updateId}-${randomUUID()}`);
      mkdirSync(effectRoot, { recursive: true, mode: 0o700 });
      const effects = effectFixture(effectRoot, `preview-executor:${turn.updateId}`);
      const registerEntries = effects.host.boundary.register.entries;
      registerEntries.push('telegram-ordinary-reply', admitted.id);
      const conversation = telegramConversation(configuration.botId, target);
      const definition = {
        type: 'OperationDefinition', schemaVersion: 1, id: `preview-reply-definition:${turn.updateId}`,
        feature: 'telegram-ordinary-reply', version: 'telegram:9.2:ordinary-reply:v1',
        adapter: admitted.id, account: admitted.account, conversation,
        generation: effects.host.current().decode.register.generation.id,
        speaker: effects.host.principal.id, scopeDigest: value(canonical(effects.host.scope)).hash,
        durability: 'replicated' as const, replicas: 1,
        lossModel: 'Second local directory is a peer STAND-IN; shared disk loss is NOT covered.',
        maxBytes: declaration.limits.maxReplyBytes, maxCharge: declaration.limits.maxCharge,
        timeout: declaration.limits.timeout, verificationBar: 'preview-recorded-reply-bar',
      };
      const approvedIn = effects.authorize({ id: `preview-reply-approval:${turn.updateId}`,
        artifact: effects.capture(value(canonical(definition)).bytes), base: `preview-reply-base:${turn.updateId}` });
      effects.versions([{ id: definition.version, subject: definition.feature, content: json(definition),
        contentHash: value(canonical(definition)).hash, since: effects.pending.id, supersedes: [],
        approvedIn, base: approvedIn.base, landedIn: null }]);
      const installed = value(installTelegramReplyOperation({
        id: definition.id, generation: definition.generation, admitted, target,
        speaker: definition.speaker, scopeDigest: definition.scopeDigest, durability: definition.durability,
        replicas: definition.replicas, lossModel: definition.lossModel, verificationBar: definition.verificationBar,
      }, effects.host, effects.spine));
      const rendered = value(renderTelegramHtml(FIXED_LIMITED_RESPONSE, declaration, effects.host.boundary));
      if (!rendered.startsWith(PREVIEW_LABEL)) throw new Error('preview: outbound label missing before preparation');
      const message = value(decodeOutboundMessage({
        type: 'OutboundMessage', schemaVersion: 1, id: `preview-reply:${turn.updateId}`,
        semanticMessage: `preview-semantic:${turn.updateId}`, run: effects.run.id,
        speaker: effects.host.principal.id, account: admitted.account, conversation,
        text: rendered, purpose: 'ordinary-reply', sourceResult: effects.pending.id,
      }, effects.host));
      const adapter = createTelegramReplyOperationAdapter(admitted, api, target, effects.host.boundary);
      const doorway = createEffectDoorway({ ...effects.composition, adapter, assessment: null });
      const request = value(adapter.prepare(doorway, {
        definition: installed.id, message, run: effects.run, pending: effects.pending.id,
        attempt: `preview-attempt:${turn.updateId}`, verificationOwner: 'preview-recorded-verifier',
        obligation: effects.obligation, closure: [], fence: effects.fence,
      }));
      input.state.gate('dispatch');
      // This durable mark intentionally precedes the irreversible boundary. A cut from
      // here onward is outcome-unknown and is never eligible for another send.
      input.state.advance(turn.id, 'grounded', 'dispatch-outcome-unknown', { replyOperation: request.id });
      const observation = value(doorway.dispatch(request, effects.fence));
      input.hooks?.afterDispatch?.(input.state.read().turns[turn.id]);
      input.state.advance(turn.id, 'dispatch-outcome-unknown', 'sent', {
        replyOperation: observation.operation,
        replyObservation: observation.id,
      });
    };

    const resume = () => {
      for (const pending of input.state.pending().sort((left, right) => left.updateId - right.updateId)) {
        let current = input.state.read().turns[pending.id];
        if (current.phase === 'intake-preserved') {
          ground(current);
          current = input.state.read().turns[pending.id];
        }
        if (current.phase === 'grounded') {
          input.hooks?.beforeDispatch?.(current);
          dispatch(current);
        }
      }
    };

    const pollOnce = () => {
      input.state.gate('poll');
      const cycle = value(ingress.pollOnce());
      for (const outcome of cycle.captured) {
        input.state.gate('admit');
        const id = previewTurnId(configuration.botId, outcome.updateId);
        const routeInScope = outcome.route.channel === route.channel && outcome.route.sender === route.sender
          && outcome.route.identityEpoch === route.identityEpoch;
        const inScope = routeInScope && outcome.intake === 'admitted';
        input.state.recordIntake({ id, updateId: outcome.updateId, route: outcome.route,
          receipt: outcome.receipt, preserved: outcome.preserved }, inScope);
        input.hooks?.afterIntake?.(input.state.read().turns[id]);
        if (routeInScope && outcome.intake === 'stopped') input.state.latchStop('operator');
      }
      resume();
      input.state.noteSuccess();
      return cycle;
    };

    return Object.freeze({
      storage, api, admitted, intake, ingress, declaration, target,
      standIns: PREVIEW_STAND_IN_LEDGER,
      pollOnce, resume,
      close: () => storage.close(),
    });
  } catch (error) {
    storage.close();
    throw error;
  }
}
