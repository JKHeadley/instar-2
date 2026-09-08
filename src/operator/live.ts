import type { BoundaryContext, Result } from '../index.js';
import { operatorBoundary, requireOperator } from './boundary.js';
import type { MinimalDependency, MinimalPathState } from './contracts.js';

export const requiredMinimalDependencies = Object.freeze<readonly MinimalDependency[]>(['local-facts', 'register', 'identity-keys', 'clock',
  'lease', 'fence', 'replication-peer', 'conversation-binding', 'route', 'delivery-evidence']);

export function evaluateMinimalPath(input: Readonly<{ admitted: Readonly<Record<MinimalDependency, boolean>>;
  ordinaryUnavailable: readonly string[]; inputPreserved: boolean; repairOwner: string; maximumExposure: number }>,
context: BoundaryContext): Result<MinimalPathState> {
  return operatorBoundary('MinimalPathAdmission', context, () => {
    requireOperator(input.inputPreserved, 'P11-NF-33/38: authenticated accepted input was not preserved');
    requireOperator(input.repairOwner.trim().length > 0 && Number.isSafeInteger(input.maximumExposure) && input.maximumExposure >= 0,
      'P11-NF-35/38: outage requires an owner and retained finite exposure');
    const missing = requiredMinimalDependencies.filter(dependency => input.admitted[dependency] !== true);
    return Object.freeze({ admitted: missing.length === 0, missing: Object.freeze(missing),
      ordinaryUnavailable: Object.freeze([...input.ordinaryUnavailable]), responseEligible: missing.length === 0,
      preserved: true, repairOwner: input.repairOwner, maximumExposure: input.maximumExposure, replayCount: 0 as const });
  });
}

export function minimalResponse(state: MinimalPathState, input: Readonly<{ attributable: boolean; pending: readonly string[];
  blocked: readonly string[]; uncertain: readonly string[]; emergencyStop: boolean }>, context: BoundaryContext): Result<string> {
  return operatorBoundary('MinimalResponder', context, () => {
    requireOperator(state.preserved, 'P11-NF-33: minimal responder cannot speak for unpreserved input');
    requireOperator(state.responseEligible, `P11-NF-36: required minimal dependency unavailable: ${state.missing.join(', ')}`, 'stale-base');
    requireOperator(input.attributable, 'P11-NF-39: unknown identity may preserve but cannot speak as the agent', 'standing');
    if (input.emergencyStop) return 'Emergency stop was accepted on the admitted minimal authority path.';
    const details = [...input.pending.map(value => `pending: ${value}`), ...input.blocked.map(value => `blocked: ${value}`),
      ...input.uncertain.map(value => `uncertain: ${value}`)];
    return details.length ? `Limited response — ${details.join('; ')}. Repair owner: ${state.repairOwner}.`
      : 'The request was preserved and an attributable response is available.';
  });
}
