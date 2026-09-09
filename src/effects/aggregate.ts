import { consumeOutcome } from '../index.js';
import type { Refused } from '../index.js';
import type { EffectSettlement } from './contracts.js';
import type { EffectPayloadKind } from './payloads.js';
import { ensure, freeze } from './boundary.js';

declare const aggregateOwned: unique symbol;
interface AggregateOwned { readonly [aggregateOwned]: 'part-eight' }
export type AggregateEvidenceStage = 'occurrence' | 'non-occurrence' | 'quiescence' | 'charge' | 'complete';
export type AggregateChildDisposition = 'pending' | 'partial' | 'satisfied' | 'refused' | 'uncertain';
export interface OrderedEffectAggregate extends AggregateOwned {
  readonly type: 'OrderedEffectAggregate'; readonly schemaVersion: 1; readonly id: string;
  readonly aggregate: string; readonly revision: number; readonly predecessor: string;
  readonly semanticMessage: string; readonly run: string;
  readonly children: readonly Readonly<{ order: number; request: string; digest: string; payloadKind: EffectPayloadKind;
    demandedStage: AggregateEvidenceStage; inhibitLater: boolean; required: boolean }>[];
  readonly settlements: readonly Readonly<{ request: string; settlement: string; assessment: string;
    disposition: AggregateChildDisposition; applied: boolean;
    refusalFact?: string;
    refusal?: Readonly<Pick<Refused, 'reason' | 'detail' | 'site' | 'failDirection' | 'preserved'>> }>[];
  readonly state: 'pending' | 'partial' | 'satisfied' | 'refused' | 'uncertain';
  readonly openEvidence: readonly string[]; readonly openCharge: readonly string[]; readonly openRecovery: readonly string[];
  readonly reconciliationOwner: string;
}
type SettlementWithRefusal = EffectSettlement & Readonly<{ refusal?: Readonly<Pick<Refused,
  'reason' | 'detail' | 'site' | 'failDirection' | 'preserved'>> }>;

type Child = OrderedEffectAggregate['children'][number];
type ChildSettlement = OrderedEffectAggregate['settlements'][number];

function outcome(settlement: EffectSettlement): 'happened' | 'did-not-happen' | 'uncertain' {
  return consumeOutcome(settlement.outcome, { happened: () => 'happened' as const,
    'did-not-happen': () => 'did-not-happen' as const, uncertain: () => 'uncertain' as const });
}

export function aggregateEvidenceStage(value: unknown): value is AggregateEvidenceStage {
  return typeof value === 'string' && ['occurrence', 'non-occurrence', 'quiescence', 'charge', 'complete'].includes(value);
}

export function demandedStageMet(child: Child, settlement: EffectSettlement): boolean {
  const state = outcome(settlement);
  if (child.demandedStage === 'occurrence') return state === 'happened';
  if (child.demandedStage === 'non-occurrence') return state === 'did-not-happen';
  if (child.demandedStage === 'quiescence') return settlement.delayedExecutionExcluded;
  if (child.demandedStage === 'charge') return settlement.finalCharge !== null;
  return state !== 'uncertain' && settlement.delayedExecutionExcluded && settlement.finalCharge !== null;
}

export function childFromSettlement(child: Child, settlement: SettlementWithRefusal): ChildSettlement {
  ensure(settlement.request === child.request && settlement.digest === child.digest, 'aggregate settlement belongs to another child');
  const state = outcome(settlement);
  const closuresComplete = settlement.finalCharge !== null && settlement.delayedExecutionExcluded;
  const disposition: AggregateChildDisposition = state === 'uncertain' ? 'uncertain'
    : demandedStageMet(child, settlement) && closuresComplete ? 'satisfied'
      : state === 'did-not-happen' && child.demandedStage === 'occurrence' ? 'refused' : 'partial';
  return freeze({ request: child.request, settlement: settlement.id, assessment: settlement.acceptance,
    disposition, applied: state === 'happened', ...(settlement.refusal ? { refusal: settlement.refusal } : {}) });
}

export function childFromRefusal(child: Child, refusal: Refused, refusalFact: string): ChildSettlement {
  return freeze({ request: child.request, settlement: '', assessment: '', disposition: 'refused' as const,
    applied: false, refusalFact, refusal: { reason: refusal.reason, detail: refusal.detail, site: refusal.site,
      failDirection: refusal.failDirection, preserved: refusal.preserved } });
}

export function aggregateState(children: readonly Child[], settlements: readonly ChildSettlement[]): OrderedEffectAggregate['state'] {
  const states = new Map(settlements.map(row => [row.request, row]));
  const required = children.filter(child => child.required).map(child => states.get(child.request)!);
  if (settlements.some(row => row.disposition === 'uncertain')) return 'uncertain';
  if (settlements.some(row => row.disposition === 'partial')) return 'partial';
  if (required.length && required.every(row => row.disposition === 'satisfied')
    && settlements.every(row => row.disposition === 'satisfied' || row.disposition === 'refused')) return 'satisfied';
  if (settlements.some(row => row.applied)) return 'partial';
  const refusedRequired = required.some(row => row.disposition === 'refused');
  if (refusedRequired && !settlements.some(row => row.disposition === 'satisfied')) return 'refused';
  if (settlements.some(row => row.disposition !== 'pending')) return 'partial';
  return 'pending';
}

export function aggregateObligations(children: readonly Child[], settlements: readonly ChildSettlement[],
  resolve?: (id: string) => EffectSettlement) {
  const states = new Map(settlements.map(row => [row.request, row]));
  const evidence = (child: Child, row: ChildSettlement | undefined): boolean => row?.settlement && resolve
    ? demandedStageMet(child, resolve(row.settlement)) : row?.disposition === 'satisfied';
  const openEvidence = children.filter(child => !evidence(child, states.get(child.request))).map(child => child.request);
  const openCharge = children.filter(child => {
    const row = states.get(child.request);
    if (row?.settlement && resolve) {
      const settlement = resolve(row.settlement);
      return outcome(settlement) === 'uncertain' || settlement.finalCharge === null;
    }
    return row?.disposition === 'pending' || row?.disposition === 'partial' || row?.disposition === 'uncertain';
  }).map(child => child.request);
  const openRecovery = children.filter(child => {
    const row = states.get(child.request);
    if (row?.settlement && resolve) {
      const settlement = resolve(row.settlement);
      return outcome(settlement) === 'uncertain' || !settlement.delayedExecutionExcluded;
    }
    return row?.disposition === 'partial' || row?.disposition === 'uncertain' || row?.disposition === 'refused';
  }).map(child => child.request);
  return freeze({ openEvidence, openCharge, openRecovery });
}

export function childInhibited(aggregate: OrderedEffectAggregate, order: number): boolean {
  const states = new Map(aggregate.settlements.map(row => [row.request, row]));
  return aggregate.children.some(child => child.order < order && child.inhibitLater
    && ['refused', 'uncertain', 'partial'].includes(states.get(child.request)?.disposition ?? 'pending'));
}
