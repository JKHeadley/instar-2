import type { BoundaryContext, Result } from '../index.js';
import { operatorBoundary, requireOperator } from './boundary.js';
import type { MinimalDependency, MinimalPathState } from './contracts.js';

export const requiredMinimalDependencies = Object.freeze<readonly MinimalDependency[]>(['local-facts', 'register', 'identity-keys', 'clock',
  'lease', 'fence', 'replication-peer', 'conversation-binding', 'route', 'delivery-evidence']);

export function evaluateMinimalPath(input: Readonly<{ admitted: Readonly<Record<MinimalDependency, boolean>>;
  ordinaryUnavailable: readonly string[]; inputPreserved: boolean; repairOwner: string; maximumExposure: number }>,
context: BoundaryContext): Result<MinimalPathState> {
  return operatorBoundary('MinimalPathAdmission', context, () => {
    requireOperator(typeof input.inputPreserved === 'boolean', 'P11-NF-33/38: preservation must be a boolean');
    requireOperator(input.inputPreserved === true, 'P11-NF-33/38: authenticated accepted input was not preserved');
    requireOperator(input.admitted !== null && typeof input.admitted === 'object'
      && requiredMinimalDependencies.every(dependency => typeof input.admitted[dependency] === 'boolean'),
    'P11-NF-35/36: every minimal dependency admission must be a boolean');
    requireOperator(Array.isArray(input.ordinaryUnavailable)
      && input.ordinaryUnavailable.every(value => typeof value === 'string'),
    'P11-NF-35/36: ordinary dependency outages must be a text list');
    requireOperator(typeof input.repairOwner === 'string' && input.repairOwner.trim().length > 0
      && Number.isSafeInteger(input.maximumExposure) && input.maximumExposure >= 0,
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
    requireOperator(typeof state.preserved === 'boolean' && typeof state.admitted === 'boolean'
      && typeof state.responseEligible === 'boolean' && typeof input.attributable === 'boolean'
      && typeof input.emergencyStop === 'boolean',
    'P11-NF-33/36/39: response flags must be booleans');
    requireOperator(Array.isArray(state.missing) && new Set(state.missing).size === state.missing.length
      && state.missing.every(dependency => requiredMinimalDependencies.includes(dependency)),
    'P11-NF-35/36: response state has an invalid minimal-dependency set', 'stale-base');
    requireOperator(Array.isArray(state.ordinaryUnavailable)
      && state.ordinaryUnavailable.every(value => typeof value === 'string'),
    'P11-NF-35/36: response state has invalid ordinary dependency outages', 'stale-base');
    requireOperator(typeof state.repairOwner === 'string' && state.repairOwner.trim().length > 0
      && Number.isSafeInteger(state.maximumExposure) && state.maximumExposure >= 0 && state.replayCount === 0,
    'P11-NF-35/38/48/50: response requires an owner, retained finite exposure, and zero replay');
    requireOperator([input.pending, input.blocked, input.uncertain].every(values => Array.isArray(values)
      && values.every(value => typeof value === 'string')),
    'P11-NF-34/36: response details must be text lists');
    requireOperator(state.preserved === true, 'P11-NF-33: minimal responder cannot speak for unpreserved input');
    const responseEligible = state.missing.length === 0;
    requireOperator(state.admitted === responseEligible && state.responseEligible === responseEligible,
      'P11-NF-36: minimal response state contradicts admitted dependencies', 'stale-base');
    requireOperator(responseEligible, `P11-NF-36: required minimal dependency unavailable: ${state.missing.join(', ')}`, 'stale-base');
    requireOperator(input.attributable === true, 'P11-NF-39: unknown identity may preserve but cannot speak as the agent', 'standing');
    if (input.emergencyStop === true) return 'Emergency stop requires independently verified surface completion; the request remains preserved.';
    const details = [...input.pending.map(value => `pending: ${value}`), ...input.blocked.map(value => `blocked: ${value}`),
      ...input.uncertain.map(value => `uncertain: ${value}`)];
    return details.length ? `Limited response — ${details.join('; ')}. Repair owner: ${state.repairOwner}.`
      : 'The request was preserved and an attributable response is available.';
  });
}
