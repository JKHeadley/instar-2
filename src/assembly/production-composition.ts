import { admitAcceptedProviderReply, createSequentialServingAdmission } from '../transport/index.js';
import type { FenceToken, LoopPolicy } from '../transport/index.js';
import type { Result } from '../index.js';
import { createIntakePort } from '../intake/index.js';
import type { IntakeDependencies } from '../intake/index.js';
import { createScheduledRunner } from '../scheduled/index.js';
import type { ScheduledRunnerDependencies } from '../scheduled/index.js';
import { createRunGraph } from '../rungraph/index.js';
import type { AcceptedProviderAnswerReadPort, AcceptedProviderAnswerView, RunGraphDependencies } from '../rungraph/index.js';
import { createOperatorSurface } from '../operator/index.js';
import type { OperatorSurfaceComposition, MinimalDependency } from '../operator/index.js';
import { createEffectDoorway } from '../effects/index.js';
import type { EffectComposition } from '../effects/index.js';
import { createProductionGroundingReader } from './context-delivery.js';
import type { ProductionGroundingReaderInput } from './context-delivery.js';
import { createProductionProviderOwners } from './production-provider-owners.js';
import type { ProductionProviderOwnersInput } from './production-provider-owners.js';
import { createProductionMinimalResponder } from './production-responder.js';
import { isProductionTelegramCustodian } from './production-telegram.js';
import { createTelegramReplyOperationAdapter } from '../conversation/index.js';
import { createEffectAssessmentPort } from '../verification/index.js';
import type { TelegramBotApiCustodianPort } from '../conversation/index.js';
import type { AssemblyComposition, AssemblyProductionComposition } from './contracts.js';
import { boundary, ensure, take } from './boundary.js';

export interface ProductionOwnerCompositionInput {
  readonly assembly: Omit<AssemblyComposition, 'production' | 'model'>;
  readonly grounding: ProductionGroundingReaderInput;
  readonly run: Omit<RunGraphDependencies, 'grounding' | 'assemblyHistory'>;
  readonly intake: IntakeDependencies;
  readonly scheduled?: Readonly<{ intake: IntakeDependencies;
    runner: Omit<ScheduledRunnerDependencies, 'intake'> }>;
  readonly telegram: TelegramBotApiCustodianPort;
  readonly provider: Omit<ProductionProviderOwnersInput, 'judgment'> & Readonly<{
    judgment: Omit<ProductionProviderOwnersInput['judgment'], 'runs'>;
  }>;
  readonly effect: EffectComposition;
  readonly operator: Omit<OperatorSurfaceComposition, 'intake'>;
  readonly bindings: Omit<AssemblyProductionComposition, 'surface' | 'verifiedActIntake' | 'run'
    | 'lease' | 'judgment' | 'effect' | 'verification' | 'minimalResponder'>;
  readonly names: Readonly<{ intake: string; run: string; lease: string; judgment: string;
    effect: string; verification: string; responder: string }>;
  readonly budgets: AssemblyProductionComposition['minimalResponder']['budgets'];
  readonly repairOwner: string;
  dependencies(): Readonly<Record<MinimalDependency, boolean>>;
}

const issued = new WeakSet<object>();
export const isProductionOwnerComposition = (composition: object): boolean => issued.has(composition);

/** Install the actual owner constructors over the same admitted native reader
 * and signed store. Held installation bindings are supplied separately; this
 * constructor fabricates no admission, witness, or protection evidence. */
export function composeProductionOwners(input: ProductionOwnerCompositionInput) {
  return boundary('ProductionOwnerComposition', null, input.assembly.host.boundary, () => {
    ensure(input.assembly?.spine?.store, 'assembly: signed store required');
    ensure(input.run, 'run: null owner configuration refused');
    ensure(input.effect?.spine, 'effect: null owner configuration refused');
    ensure(input.provider?.judgment && input.provider.verification && input.provider.route, 'provider: null owner configuration refused');
    ensure(input.operator, 'operator: null owner configuration refused');
    ensure(Array.isArray(input.assembly.harnesses) && input.assembly.harnesses.length > 0
      && input.assembly.harnesses.every(adapter => adapter && typeof adapter.describe === 'function'), 'harness: null adapter refused');
    const store = input.assembly.spine.store;
    ensure(input.telegram && isProductionTelegramCustodian(input.telegram), 'telegram: actual confined custodian required');
    ensure(input.run.store === store && input.provider.judgment.store === store
      && input.effect.spine.store === store, 'production owners: shared signed store required');
    ensure(input.assembly.harnesses.includes(input.grounding.harness), 'harness: actual grounding adapter required');
    const intake = take(createIntakePort(input.intake));
    const scheduledIntake = input.scheduled ? (() => {
      ensure(input.scheduled!.intake.storage === input.intake.storage
        && input.scheduled!.intake.context === input.intake.context,
      'scheduled and Telegram Four ports require one durable store and live context');
      return take(createIntakePort(input.scheduled!.intake));
    })() : undefined;
    const scheduled = scheduledIntake && input.scheduled
      ? createScheduledRunner({ ...input.scheduled.runner, intake: scheduledIntake }) : undefined;
    let acceptedTarget: AcceptedProviderAnswerReadPort | undefined;
    const acceptedAnswer: AcceptedProviderAnswerReadPort = Object.freeze({ owner: 'part-eight' as const,
      consumeAcceptedProviderAnswer<T>(reference: import('../index.js').OwnedReference<'part-seven', 'ProviderAnswerAcceptance'>,
        consumer: (view: AcceptedProviderAnswerView) => T): Result<T> {
        ensure(acceptedTarget, 'accepted-answer owners are not yet composed');
        return acceptedTarget.consumeAcceptedProviderAnswer(reference, consumer);
      } });
    const run = take(createRunGraph({ ...input.run, acceptedAnswer,
      assemblyHistory: input.grounding.runtime.history!, grounding: createProductionGroundingReader(input.grounding) }));
    const provider = take(createProductionProviderOwners({ ...input.provider,
      judgment: { ...input.provider.judgment, runs: run } }));
    acceptedTarget = provider.eight;
    const effect = createEffectDoorway(input.effect);
    const surface = take(createOperatorSurface({ ...input.operator,
      intake: { owner: 'part-four', operation: 'admitVerifiedAct', port: intake } }));
    const responder = createProductionMinimalResponder({ id: input.names.responder, budgets: input.budgets,
      repairOwner: input.repairOwner, store, runs: run, context: input.assembly.host.boundary,
      dependencies: input.dependencies });
    const production: AssemblyProductionComposition = Object.freeze({ ...input.bindings, surface,
      verifiedActIntake: { owner: 'part-four' as const, id: input.names.intake,
        operation: 'admitVerifiedAct' as const, port: intake },
      run: { id: input.names.run, port: run },
      lease: { id: input.names.lease, port: input.provider.judgment.authority },
      judgment: { id: input.names.judgment, port: provider.legacyJudgment },
      effect: { id: input.names.effect, port: effect },
      verification: { id: input.names.verification, port: provider.nine },
      minimalResponder: responder });
    const composition: AssemblyComposition = Object.freeze({ ...input.assembly, model: provider.model, production });
    issued.add(composition);
    const reply = (admitted: Parameters<typeof createTelegramReplyOperationAdapter>[0],
      target: Parameters<typeof createTelegramReplyOperationAdapter>[2]) => {
      const adapter = createTelegramReplyOperationAdapter(admitted, input.telegram, target, input.assembly.host.boundary);
      const doorway = createEffectDoorway({ ...input.effect, adapter,
        assessment: createEffectAssessmentPort(input.provider.verification, provider.nine) });
      return Object.freeze({ adapter, doorway });
    };
    const admitReply = (command: string, fence: FenceToken, replyRun: string, policy: LoopPolicy) =>
      admitAcceptedProviderReply(input.provider.judgment.authority, run, command, fence,
        { owner: 'part-five', name: 'Run', id: replyRun }, policy, input.assembly.host.boundary);
    const serving = createSequentialServingAdmission(input.provider.judgment.authority, input.assembly.host.boundary);
    return Object.freeze({ composition, intake, scheduledIntake, scheduled, run, provider, responder,
      reply, admitReply, serving, transport: input.provider.judgment.authority, telegram: input.telegram });
  });
}

export type ProductionOwnerComposition = ReturnType<typeof composeProductionOwners> extends Result<infer T> ? T : never;
