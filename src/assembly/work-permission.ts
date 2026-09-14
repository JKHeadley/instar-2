import { ensure } from './boundary.js';
import type { AssemblyComposition, AssemblyRecordName } from './contracts.js';

type AssemblyWorkHost = Pick<AssemblyComposition['host'], 'current'>;

/**
 * Additive copy of the landed AssemblyRuntime record-admission stop predicate.
 * Keep this expression in parity with service.ts without changing that owner.
 */
export function ensureAssemblyWorkPermitted(host: AssemblyWorkHost, name: AssemblyRecordName): void {
  ensure(!host.current().stopped || name === 'HarnessObservation' || name === 'StorageAccessObservation'
    || name === 'GrowthObservation' || name === 'AssemblyAdmission', 'stop inhibits new assembly work');
}
