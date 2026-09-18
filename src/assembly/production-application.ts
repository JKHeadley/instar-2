import type { FactEnvelope } from '../facts/index.js';
import type { Result } from '../index.js';
import type { ProductionInstallation } from './production-installation.js';
import { bootProductionInstallation } from './production-boot.js';
import type { ProductionBoot, ProductionBootHost } from './production-boot.js';
import { composeProductionOwners } from './production-composition.js';
import type { ProductionOwnerComposition, ProductionOwnerCompositionInput } from './production-composition.js';
import type { ProductionStorage } from './production-storage.js';
import { boundary, ensure, take } from './boundary.js';

export interface ProductionApplicationHost extends Omit<ProductionBootHost, 'compose'> {
  /** Installation policy and confined physical ports. The factory, rather than
   * this host, constructs all ordinary conversation owner ports. */
  /** Keep mutable owner contexts behind a closure: Result values are deeply sealed. */
  configure(installation: ProductionInstallation, storage: ProductionStorage): Result<() => Readonly<{
    owners: ProductionOwnerCompositionInput;
    manifest: string;
    scope: string;
    installationFact: FactEnvelope;
  }>>;
}
export interface ProductionApplication {
  readonly boot: ProductionBoot;
  readonly owners: ProductionOwnerComposition;
  close(): void;
}

/** Installed entry point shared by first boot and recovery. No caller can poll
 * or start work through this entry until Eleven and the public Ten boot admit
 * the actual constructed composition. */
export function bootProductionApplication(record: unknown, host: ProductionApplicationHost): Result<ProductionApplication> {
  return boundary('ProductionApplication', null, host.context, () => {
    let owners: ProductionOwnerComposition | undefined;
    const boot = take(bootProductionInstallation(record, { ...host,
      compose: (installation, storage) => boundary('ProductionApplicationComposition', null, host.context, () => {
        const configured = take(host.configure(installation, storage))();
        ensure(configured.owners.run.admission === host.runAdmission,
          'run-admission: configured owner differs from admitted binding');
        ensure(configured.owners.intake.storage === storage.segment,
          'intake: actual installed durable segment required');
        ensure(configured.owners.assembly.persistence === storage.persistence,
          'persistence: actual installed storage custodian required');
        ensure(configured.installationFact.kind === 'assembly-ProductionInstallation',
          'installation: signed immutable configuration required');
        owners = take(composeProductionOwners(configured.owners));
        return { composition: owners.composition, manifest: configured.manifest, scope: configured.scope };
      }) }));
    ensure(owners, 'production owner composition unavailable');
    return Object.freeze({ boot, owners, close: boot.close });
  });
}
