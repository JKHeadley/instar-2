import type { Result } from '../index.js';
import type { HarnessLaunchSpec } from './contracts.js';
import { boundary, ensure } from './boundary.js';
import type { AssemblyDecodeContext } from './contracts.js';

/** The fixed monitor is an installed, independently trusted component. Until its
 * reviewed protocol and host trust reference are present, the production leaf is
 * unavailable. This port deliberately has no local process execution path. */
export interface ProductionLaunchBoundary {
  readonly state: 'monitor-unavailable';
  launch(specification: HarnessLaunchSpec, operation: string, claim: string): Result<never>;
  observe(operation: string, digest: string): Result<never>;
}

export function createProductionLaunchBoundary(context: AssemblyDecodeContext): ProductionLaunchBoundary {
  const unavailable = (site: string, subject: unknown): Result<never> => boundary(site, subject, context, () => {
    ensure(false, 'fixed native worker monitor and trusted installation are unavailable');
    throw Error('unreachable');
  });
  return Object.freeze({ state: 'monitor-unavailable' as const,
    launch: (specification: HarnessLaunchSpec, operation: string, claim: string) =>
      unavailable('ProductionNativeLaunch', { specification, operation, claim }),
    observe: (operation: string, digest: string) =>
      unavailable('ProductionNativeLaunchObservation', { operation, digest }),
  });
}
