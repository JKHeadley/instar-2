import { consumeOutcome } from '../index.js';
import type { Refused } from '../index.js';
import type { AggregateChildDisposition, EffectSettlement, OrderedEffectAggregate } from './contracts.js';
import { ensure, freeze } from './boundary.js';

type Child = OrderedEffectAggregate['children'][number];
type ChildSettlement = OrderedEffectAggregate['settlements'][number];

function outcome(settlement: EffectSettlement): 'happened' | 'did-not-happen' | 'uncertain' {
  return consumeOutcome(settlement.outcome, { happened: () => 'happened' as const,
    'did-not-happen': () => 'did-not-happen' as const, uncertain: () => 'uncertain' as const });
}

export function demandedStageMet(child: Child, settlement: EffectSettlement): boolean {
  const state = outcome(settlement);
  if (child.demandedStage === 'occurrence') return state === 'happened';
  if (child.demandedStage === 'non-occurrence') return state === 'did-not-happen';
  if (child.demandedStage === 'quiescence') return settlement.delayedExecutionExcluded;
  if (child.demandedStage === 'charge') return settlement.finalCharge !== null;
  return state !== 'uncertain' && settlement.delayedExecutionExcluded && settlement.finalCharge !== null;
}

export function childFromSettlement(child: Child, settlement: EffectSettlement): ChildSettlement {
  ensure(settlement.request === child.request && settlement.digest === child.digest, 'aggregate settlement belongs to another child');
  const state = outcome(settlement);
  const disposition: AggregateChildDisposition = state === 'uncertain' ? 'uncertain'
    : demandedStageMet(child, settlement) ? 'satisfied'
      : state === 'did-not-happen' && child.demandedStage === 'occurrence' ? 'refused' : 'partial';
  return freeze({ request: child.request, settlement: settlement.id, assessment: settlement.acceptance,
    disposition, applied: state === 'happened', ...(settlement.refusal ? { refusal: settlement.refusal } : {}) });
}

export function childFromRefusal(child: Child, refusal: Refused): ChildSettlement {
  return freeze({ request: child.request, settlement: '', assessment: '', disposition: 'refused' as const,
    applied: false, refusal: { reason: refusal.reason, detail: refusal.detail, site: refusal.site,
      failDirection: refusal.failDirection, preserved: refusal.preserved } });
}

export function aggregateState(children: readonly Child[], settlements: readonly ChildSettlement[]): OrderedEffectAggregate['state'] {
  const states = new Map(settlements.map(row => [row.request, row]));
  const required = children.filter(child => child.required).map(child => states.get(child.request)!);
  if (required.length && required.every(row => row.disposition === 'satisfied')) return 'satisfied';
  if (settlements.some(row => row.disposition === 'uncertain')) return 'uncertain';
  if (settlements.some(row => row.disposition === 'partial' || row.applied)) return 'partial';
  const refusedRequired = required.some(row => row.disposition === 'refused');
  if (refusedRequired && !settlements.some(row => row.disposition === 'satisfied')) return 'refused';
  if (settlements.some(row => row.disposition !== 'pending')) return 'partial';
  return 'pending';
}

export function aggregateObligations(children: readonly Child[], settlements: readonly ChildSettlement[]) {
  const states = new Map(settlements.map(row => [row.request, row]));
  const openEvidence = children.filter(child => states.get(child.request)?.disposition !== 'satisfied').map(child => child.request);
  const openCharge = children.filter(child => {
    const row = states.get(child.request); return row?.disposition === 'pending' || row?.disposition === 'partial' || row?.disposition === 'uncertain';
  }).map(child => child.request);
  const openRecovery = children.filter(child => {
    const row = states.get(child.request); return row?.disposition === 'partial' || row?.disposition === 'uncertain' || row?.disposition === 'refused';
  }).map(child => child.request);
  return freeze({ openEvidence, openCharge, openRecovery });
}

export function childInhibited(aggregate: OrderedEffectAggregate, order: number): boolean {
  const states = new Map(aggregate.settlements.map(row => [row.request, row]));
  return aggregate.children.some(child => child.order < order && child.inhibitLater
    && ['refused', 'uncertain', 'partial'].includes(states.get(child.request)?.disposition ?? 'pending'));
}
