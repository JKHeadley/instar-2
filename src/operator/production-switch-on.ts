import type { BoundaryContext, Result } from '../index.js';
import type { MinimalDependency } from './contracts.js';
import { requiredMinimalDependencies } from './live.js';
import { operatorBoundary, requireOperator } from './boundary.js';

export interface ProductionSwitchOnPosture {
  readonly owner: 'part-eleven';
  readonly serve: boolean;
  readonly missing: readonly string[];
  readonly repairOwner: string;
}

/** Boot posture is separate from accepted-input posture: before poll there is
 * no input for which the process may claim preservation or promise a reply. */
export function productionSwitchOnPosture(input: Readonly<{
  admitted: Readonly<Record<MinimalDependency, boolean>>;
  unavailableAdapters: readonly string[];
  repairOwner: string;
}>, context: BoundaryContext): Result<ProductionSwitchOnPosture> {
  return operatorBoundary('ProductionSwitchOnPosture', context, () => {
    requireOperator(input.admitted && requiredMinimalDependencies.every(name => typeof input.admitted[name] === 'boolean'),
      'switch-on: each required binding needs a current admission verdict');
    requireOperator(typeof input.repairOwner === 'string' && input.repairOwner.trim().length > 0,
      'switch-on: repair owner required');
    requireOperator(Array.isArray(input.unavailableAdapters) && input.unavailableAdapters.every(name =>
      typeof name === 'string' && name.trim().length > 0), 'switch-on: named adapter refusals required');
    const missing = Object.freeze([...new Set([...requiredMinimalDependencies.filter(name => !input.admitted[name]),
      ...input.unavailableAdapters])]);
    return Object.freeze({ owner: 'part-eleven' as const, serve: missing.length === 0, missing, repairOwner: input.repairOwner });
  });
}
