import { assessTelegramReplyResponse, createTelegramReplyOperationAdapter,
  installTelegramReplyOperation } from '../../src/conversation/index.js';
import type { TelegramProviderAcceptance } from '../../src/conversation/index.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import type { EffectAssessmentInput } from '../../src/effects/index.js';
import { value } from '../intake/fixtures.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';

type ResultSummary = Readonly<{ kind: string; detail?: string; stage?: string }>;

export interface Round20TwoHandleResult {
  readonly separateAdmission: boolean;
  readonly lostResponse: boolean;
  readonly distinctHandles: boolean;
  readonly sameConformance: boolean;
  readonly first: ResultSummary;
  readonly second: ResultSummary;
  readonly dispatch: ResultSummary;
  readonly providerCalls: number;
  readonly reservationStates: readonly string[];
}

const summarize = (result: Readonly<{ kind: string; detail?: string; value?: unknown }>): ResultSummary => {
  const stage = result.value !== null && typeof result.value === 'object' && 'stage' in result.value
    && typeof result.value.stage === 'string' ? result.value.stage : undefined;
  return {
    kind: result.kind,
    ...(result.detail === undefined ? {} : { detail: result.detail }),
    ...(stage === undefined ? {} : { stage }),
  };
};

/** Permanent import of rereview18's claim-two-handles.ts executable case. */
export function round20TwoHandleClaim(separateAdmission: boolean,
  lostResponse: boolean): Round20TwoHandleResult {
  const fixture = telegramPreparedOutbound(lostResponse);
  const admitted = separateAdmission ? value(fixture.telegram.admit()) : fixture.telegram.admitted;
  const definition = value(fixture.doorway.inspect()).find(row => row.record.type === 'OperationDefinition'
    && row.record.id === fixture.request.definition)?.record;
  if (definition?.type !== 'OperationDefinition') throw new Error('round20 operation definition is missing');
  value(installTelegramReplyOperation({
    id: definition.id,
    generation: definition.generation,
    admitted,
    target: fixture.target,
    speaker: definition.speaker,
    scopeDigest: definition.scopeDigest,
    durability: definition.durability,
    replicas: definition.replicas,
    lossModel: definition.lossModel,
    verificationBar: definition.verificationBar,
  }, fixture.effects.host, fixture.effects.spine));
  const secondAdapter = createTelegramReplyOperationAdapter(admitted, fixture.telegram.api,
    fixture.target, fixture.effects.host.boundary);
  let firstResult: ReturnType<typeof fixture.adapter.invoke> | undefined;
  let secondResult: ReturnType<typeof secondAdapter.invoke> | undefined;
  const doorway = createEffectDoorway({
    ...fixture.effects.composition,
    assessment: null,
    adapter: {
      ...fixture.adapter,
      invoke(input) {
        firstResult = fixture.adapter.invoke(input);
        secondResult = secondAdapter.invoke(input);
        return firstResult;
      },
    },
  });
  const dispatched = doorway.dispatch(fixture.request, fixture.effects.fence);
  if (firstResult === undefined || secondResult === undefined) {
    throw new Error('round20 concrete invocation interception did not run');
  }
  return {
    separateAdmission,
    lostResponse,
    distinctHandles: admitted !== fixture.telegram.admitted,
    sameConformance: admitted.conformance.id === fixture.telegram.admitted.conformance.id,
    first: summarize(firstResult),
    second: summarize(secondResult),
    dispatch: summarize(dispatched),
    providerCalls: fixture.telegram.calls.send.length,
    reservationStates: value(fixture.effects.transport.inspect())
      .filter(row => row.record.type === 'AdmissionReservation')
      .map(row => row.record.type === 'AdmissionReservation' ? row.record.state : 'unreachable'),
  };
}

type MutationOwner = 'control' | 'request' | 'reservation' | 'response';
type MutableRecord = Record<string, unknown>;

export interface Round20ValidationResult {
  readonly owner: MutationOwner;
  readonly key: string;
  readonly reuse: boolean;
  readonly expected: 'Success' | 'Refused';
  readonly result: ResultSummary;
  readonly appended: number;
  readonly providerCalls: number;
}

const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;

function changed(value: unknown): unknown {
  if (typeof value === 'string') return `${value}:mismatch`;
  if (typeof value === 'number') return 99;
  return { unexpected: true };
}

/** Permanent import of rereview18's 102-case full-record validation matrix. */
export async function round20IndependentValidationMatrix(): Promise<readonly Round20ValidationResult[]> {
  const seed = telegramResponseAssessmentFixture();
  const response = seed.effect.observations.find(row => row.stage === 'response');
  if (response === undefined) throw new Error('round20 seed response observation is missing');
  const paths: Array<readonly [Exclude<MutationOwner, 'control'>, string]> = [];
  for (const [owner, subject] of [
    ['request', seed.effect.request],
    ['reservation', seed.effect.reservation],
    ['response', response],
  ] as const) {
    for (const key of Object.keys(subject)) paths.push([owner, key]);
    paths.push([owner, 'extra']);
  }

  const results: Round20ValidationResult[] = [];
  for (const reuse of [false, true]) {
    for (const [owner, key] of [['control', ''] as const, ...paths]) {
      const fixture = telegramResponseAssessmentFixture();
      const first: TelegramProviderAcceptance | null = reuse
        ? value(assessTelegramReplyResponse({
          effect: fixture.effect,
          claim: 'provider-accepted',
          existing: null,
        }, fixture.dependencies))
        : null;
      const effect = clone(fixture.effect) as EffectAssessmentInput;
      if (owner !== 'control') {
        const target = (owner === 'response'
          ? effect.observations.find(row => row.stage === 'response')
          : effect[owner]) as unknown as MutableRecord | undefined;
        if (target === undefined) throw new Error(`round20 ${owner} mutation target is missing`);
        target[key] = key === 'extra' ? 'undeclared' : changed(target[key]);
      }
      const before = fixture.verification.rows.length;
      const result = assessTelegramReplyResponse({
        effect,
        claim: 'provider-accepted',
        existing: first?.assessment ?? null,
      }, fixture.dependencies);
      results.push({
        owner,
        key,
        reuse,
        expected: owner === 'control' ? 'Success' : 'Refused',
        result: summarize(result),
        appended: fixture.verification.rows.length - before,
        providerCalls: fixture.telegram.calls.send.length,
      });
      if (results.length % 8 === 0) await new Promise<void>(resolve => setImmediate(resolve));
    }
  }
  return results;
}
