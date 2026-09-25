import { randomUUID } from 'node:crypto';
import { createTelegramIngress } from '../conversation/index.js';
import type { AdmittedTelegramAdapter, TelegramConversationTarget } from '../conversation/index.js';
import type { FenceToken, LoopPolicy, ServingBinding, SettlementApplication } from '../transport/index.js';
import type { AcceptedProviderReplyInput, RunView } from '../rungraph/index.js';
import type { ProviderAnswerAcceptanceInput, PreparedProviderJudgment, ProviderQuestionInput } from '../judgment/index.js';
import type { EffectRequest, EffectSettlement } from '../effects/index.js';
import type { FactEnvelope } from '../facts/index.js';
import type { OwnedReference } from '../index.js';
import type { ProductionApplication } from './production-application.js';
import type { ContextItem, ConversationDriverOptions, ConversationFact, ConversationTurn } from './production-conversation-driver.js';
import { runConversationDriver } from './production-conversation-driver.js';
import { ensure, take } from './boundary.js';

type ReplyRoute = Readonly<{ admitted: AdmittedTelegramAdapter; target: TelegramConversationTarget }>;
type ReplyOwners = ReturnType<ProductionApplication['owners']['reply']>;

/** Ten supplies bounded policy inputs. Each consequential operation below still
 * runs through the installed Four/Five/Six/Seven/Eight owner, never a host
 * supplied substitute for an owner method. */
export interface ProductionConversationPlan {
  open(turn: ConversationTurn, context: readonly ContextItem[]): unknown;
  grounding(turn: ConversationTurn): Readonly<{ worker: string; harness: string;
    reason: 'start' | 'resume'; ownership: Parameters<ProductionApplication['owners']['run']['ground']>[4] }>;
  pending(turn: ConversationTurn, ready: RunView, grounding: FactEnvelope): unknown;
  question(turn: ConversationTurn): ProviderQuestionInput;
  providerEffect(turn: ConversationTurn, prepared: PreparedProviderJudgment):
    Parameters<ProductionApplication['owners']['provider']['eight']['prepare']>[0];
  acceptance(turn: ConversationTurn, facts: readonly ConversationFact[],
    assessment: OwnedReference<'part-nine', 'VerificationAssessment'>,
    settlement: EffectSettlement, accounting: SettlementApplication):
    ProviderAnswerAcceptanceInput;
  replyOpening(turn: ConversationTurn, acceptance: OwnedReference<'part-seven', 'ProviderAnswerAcceptance'>):
    AcceptedProviderReplyInput;
  replyPolicy(turn: ConversationTurn): LoopPolicy;
  replyRoute(turn: ConversationTurn): ReplyRoute;
  replyEffect(turn: ConversationTurn, owners: ReplyOwners):
    Parameters<ReplyOwners['adapter']['prepare']>[1];
}
export interface ProductionConversationHostConfig {
  readonly binding: ServingBinding;
  readonly fence: () => FenceToken;
  readonly admitted: AdmittedTelegramAdapter;
  readonly observer: string;
  readonly target: Readonly<{ chatId: string; messageThreadId: number | null }>;
  readonly plan: ProductionConversationPlan;
  readonly capture: (reference: string) => string;
  readonly now: () => number;
  readonly stopped: () => boolean;
  /** Ten must report actual local callback/worker return, including recovery observers. */
  readonly executionQuiescent: (run: string) => boolean;
  readonly maxContextTurns: number; readonly maxContextBytes: number;
  readonly maxCycles: number; readonly baseBackoffMs: number; readonly maxBackoffMs: number;
  readonly yieldBoundary: () => Promise<void>; readonly sleep: (milliseconds: number) => Promise<void>;
  readonly signal?: AbortSignal;
  readonly diagnostic?: ConversationDriverOptions['diagnostic'];
  readonly nextAttempt?: () => string;
}

const facts = (application: ProductionApplication): readonly ConversationFact[] => {
  const entries = take(application.owners.composition.spine.store.readForProjection()).entries;
  ensure(entries.every(entry => !entry.taint.length && !entry.conflicts.length),
    'conversation host: owner projection tainted or conflicted');
  return entries.map(entry => entry.fact as ConversationFact);
};
const record = (fact: ConversationFact): Record<string, unknown> =>
  (fact.body as { record?: Record<string, unknown> }).record ?? {};

function ownerOperations(application: ProductionApplication, config: ProductionConversationHostConfig,
  fence: FenceToken): Pick<ConversationDriverOptions, 'pollOnce' | 'ground' | 'dispatchProvider'
    | 'acceptAndPrepareReply' | 'dispatchReply'> {
  const owners = application.owners, plan = config.plan;
  const ingress = createTelegramIngress({ boundary: owners.composition.host.boundary,
    admitted: config.admitted, api: owners.telegram, intake: owners.intake,
    facts: owners.composition.spine.store, observer: config.observer });
  return {
    pollOnce: () => { take(ingress.pollOnce()); },
    ground: (turn, context) => {
      const ready = take(owners.run.open(plan.open(turn, context)));
      if (!turn.providerRun) return;
      const g = plan.grounding(turn);
      const grounded = take(owners.run.ground(ready.run.id, g.worker, g.harness, g.reason, g.ownership));
      take(owners.run.transition(plan.pending(turn, ready, grounded)));
    },
    dispatchProvider: async (turn, guard) => {
      const prepared = take(owners.provider.seven.prepare(plan.question(turn), fence));
      const request = take(owners.provider.eight.prepare(plan.providerEffect(turn, prepared), fence));
      guard();
      take(await owners.provider.eight.dispatch(request, fence));
    },
    acceptAndPrepareReply: turn => {
      const operation = take(owners.transport.inspect()).filter(row =>
        row.record.type === 'AdmissionReservation' && row.record.run === turn.providerRun
          && row.record.state === 'consumed').at(-1)?.record;
      ensure(operation?.type === 'AdmissionReservation', 'conversation host: consumed provider operation absent');
      const assessment = take(owners.provider.eight.assessResponse(operation.operation));
      const settlement = take(owners.provider.eight.settle(operation.operation, assessment));
      const settle = owners.transport.settle as (token: FenceToken, value: EffectSettlement) =>
        import('../index.js').Result<SettlementApplication>;
      const accounting = take(settle(fence, settlement));
      const acceptance = take(owners.provider.seven.recordProviderAnswerAcceptance(
        plan.acceptance(turn, facts(application), assessment, settlement, accounting),
        owners.provider.responseAssessment, fence));
      const reply = take(owners.run.openAcceptedProviderReply(plan.replyOpening(turn, acceptance)));
      take(owners.admitReply(`reply:${turn.opening}`, fence, reply.run.id, plan.replyPolicy(turn)));
      const route = plan.replyRoute(turn), replyOwners = owners.reply(route.admitted, route.target);
      take(replyOwners.adapter.prepare(replyOwners.doorway, plan.replyEffect(turn, replyOwners)));
    },
    dispatchReply: (turn, guard) => {
      const route = plan.replyRoute(turn), replyOwners = owners.reply(route.admitted, route.target);
      const request = facts(application).find(fact => fact.kind === 'effect-EffectRequest'
        && record(fact).run === turn.replyRun);
      ensure(request, 'conversation host: prepared reply request absent');
      guard();
      take(replyOwners.doorway.dispatch(record(request) as unknown as EffectRequest, fence));
    },
  };
}

/** Install as `host.run`; the existing bin and boot script already call it. */
export function createProductionConversationHost(config: ProductionConversationHostConfig):
  Readonly<{ run(application: ProductionApplication): Promise<void> }> {
  return Object.freeze({ async run(application: ProductionApplication) {
    const owners = application.owners, fence = config.fence();
    const installation = facts(application).find(fact => fact.id === config.binding.installation);
    ensure(installation?.kind === 'assembly-ProductionInstallation'
      && record(installation).id === application.boot.installation.id,
    'conversation host: installation fact differs from admitted boot');
    take(owners.serving.registerQuiescence(config.executionQuiescent));
    take(owners.serving.bind(`serving:${application.boot.installation.id}`, fence, config.binding));
    await runConversationDriver(application, { ...ownerOperations(application, config, fence),
      serving: { port: owners.serving, fence }, generation: application.boot.installation.generation,
      conversation: config.binding.conversation,
      lease: fence.assignment, expiresAt: config.binding.expires,
      replyLimit: config.binding.maxReplies, errorLimit: config.binding.errorLimit,
      totalErrorLimit: config.binding.totalErrorLimit, maxContextTurns: config.maxContextTurns,
      maxContextBytes: config.maxContextBytes, telegramTarget: config.target, capture: config.capture,
      now: config.now, stopped: config.stopped, maxCycles: config.maxCycles,
      baseBackoffMs: config.baseBackoffMs, maxBackoffMs: config.maxBackoffMs,
      yieldBoundary: config.yieldBoundary, sleep: config.sleep,
      ...(config.signal ? { signal: config.signal } : {}),
      ...(config.diagnostic ? { diagnostic: config.diagnostic } : {}),
      nextAttempt: config.nextAttempt ?? randomUUID });
  } });
}
