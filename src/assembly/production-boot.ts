import type { BoundaryContext, DecodeContext, Result, SecretRef } from '../index.js';
import type { MinimalDependency } from '../operator/index.js';
import { requiredMinimalDependencies } from '../operator/index.js';
import { productionSwitchOnPosture } from '../operator/index.js';
import type { ProductionSwitchOnPosture } from '../operator/index.js';
import { boundary, encoded, ensure, take } from './boundary.js';
import { decodeProductionInstallation } from './production-installation.js';
import type { ProductionInstallation } from './production-installation.js';
import { openProductionStorage } from './production-storage.js';
import type { ProductionStorage, ProductionStorageIO } from './production-storage.js';
import { bootProductionAssembly } from './production.js';
import type { AssemblyComposition, AssemblyProductionCoordinator } from './contracts.js';
import type { RunAdmissionPort } from '../rungraph/index.js';
import { productionBindingHolds } from './production-holds.js';
import { isProductionOwnerComposition } from './production-composition.js';

export const productionBootHolds = Object.freeze([
  ...productionBindingHolds,
  'NON-EXECUTABLE-UNTIL-replicated-storage-second-machine',
  'NON-EXECUTABLE-UNTIL-package-switch-rollback',
  'NON-EXECUTABLE-UNTIL-other-conversation-platforms',
  'NON-EXECUTABLE-UNTIL-multiple-bots',
  'NON-EXECUTABLE-UNTIL-live-path-unit-compaction',
  'NON-EXECUTABLE-UNTIL-traces-beyond-launch-message-provider-call',
]);

export interface ProductionBootHost {
  readonly context: DecodeContext & BoundaryContext;
  /** Ten's custody host resolves references; this port never reaches a worker. */
  resolveSecret(reference: SecretRef): string;
  readonly storagePolicy: string;
  readonly store: string;
  readonly storageIO: ProductionStorageIO;
  readonly repairOwner: string;
  /** U4-F: absent until the separate Six production admission slice lands.
   * The recorded lifecycle alone supplies the landed fixture binding. */
  readonly runAdmission?: RunAdmissionPort | null;
  /** Installed hosts report their unavailable real bindings; omission stays closed. */
  readonly missingBindings?: readonly string[];
  /** Current dependency observations, before any external operation. U4-C
   * leaves replication-peer absent in the installed host. No peer is invented. */
  dependencies(): Readonly<Record<MinimalDependency, boolean>>;
  compose(installation: ProductionInstallation, storage: ProductionStorage): Result<Readonly<{
    composition: AssemblyComposition; manifest: string; scope: string;
  }>>;
}
export interface ProductionBoot {
  readonly owner: 'part-ten';
  readonly installation: ProductionInstallation;
  readonly posture: ProductionSwitchOnPosture;
  readonly coordinator: AssemblyProductionCoordinator;
  close(): void;
}

/** One entry for initial start and restart. Only the returned coordinator may
 * drive owners; construction never polls Telegram or invokes a provider. */
export function bootProductionInstallation(record: unknown, host: ProductionBootHost): Result<ProductionBoot> {
  return boundary('ProductionInstallationBoot', null, host.context, () => {
    const installation = take(decodeProductionInstallation(record, host.context));
    // Resolve all required references before opening a network-capable owner.
    const secrets = new Map<string, string>();
    for (const [name, reference] of [['bot-credential', installation.botCredential],
      ['provider-credential', installation.providerCredential], ['storage-key', installation.storageCredential]] as const) {
      let bytes: string;
      try { bytes = host.resolveSecret(reference); } catch { throw new Error(`${name}: SecretRef unresolvable`); }
      ensure(typeof bytes === 'string' && bytes.length > 0 && bytes.length <= 8192, `${name}: SecretRef unresolvable`);
      secrets.set(name, bytes);
    }
    const keyText = secrets.get('storage-key')!;
    ensure(/^[a-f0-9]{64}$/.test(keyText), 'storage-key: 32-byte lowercase hex SecretRef required');
    const key = Buffer.from(keyText, 'hex');
    let storage: ProductionStorage;
    try { storage = take(openProductionStorage({ root: installation.storageRoot, machine: installation.machineIdentity,
      key, policy: host.storagePolicy, store: host.store, context: host.context, io: host.storageIO })); }
    finally { key.fill(0); secrets.clear(); }
    try {
      const admission = host.runAdmission;
      const missingAdmission = !admission || admission.owner !== 'part-six'
        || ['create', 'commit', 'verify', 'execution', 'reservation'].some(name =>
          typeof admission[name as keyof RunAdmissionPort] !== 'function');
      const posture = take(productionSwitchOnPosture({ admitted: host.dependencies(),
        unavailableAdapters: [...(missingAdmission ? ['run-admission'] : []), ...(host.missingBindings ?? productionBindingHolds)],
        repairOwner: host.repairOwner }, host.context));
      ensure(posture.serve, `switch-on refused: missing binding ${posture.missing.join(', ')}`);
      const built = take(host.compose(installation, storage));
      const composition = built.composition;
      const records = take(composition.spine.store.readForProjection()).entries.filter(row =>
        row.fact.kind === 'assembly-ProductionInstallation'
        && (row.fact.body as { record?: { id?: string } }).record?.id === installation.id);
      ensure(records.length === 1 && !records[0]!.taint.length && !records[0]!.conflicts.length
        && encoded(records[0]!.fact.body).bytes === encoded({ record: installation }).bytes,
      'installation: exact immutable signed configuration required');
      ensure(composition.host.machine === installation.machineIdentity, 'machine-identity: composition differs');
      ensure(composition.host.current().generation === installation.generation, 'register: stale composition generation');
      ensure(composition.persistence === storage.persistence, 'persistence: actual storage custodian required');
      ensure(composition.model && typeof composition.model.describe === 'function', 'model: null adapter refused');
      const description = composition.model.describe();
      ensure(description.route === installation.providerRoute, 'provider-route: configuration differs');
      ensure(!/mock|fixture|test-only|local-test/i.test(encoded(description).bytes), 'model: mock or test-only adapter refused');
      ensure(composition.harnesses.length > 0, 'harness: null adapter refused');
      for (const adapter of composition.harnesses) {
        ensure(adapter && typeof adapter.describe === 'function', 'harness: null adapter refused');
        ensure(!/mock|fixture|test-only/i.test(encoded(adapter.describe()).bytes), `harness: mock or test-only adapter refused: ${adapter.id}`);
      }
      ensure(isProductionOwnerComposition(composition), 'composition: actual production owner constructors required');
      const coordinator = take(bootProductionAssembly(composition, built.manifest, built.scope));
      // The public boot resolves signed history and actual live handles. An
      // optimistic preflight cannot substitute for these owner admissions.
      const admitted = Object.fromEntries(requiredMinimalDependencies.map(name => [name,
        coordinator.handles.dependencies[name].current === true])) as Record<MinimalDependency, boolean>;
      const current = take(productionSwitchOnPosture({ admitted, unavailableAdapters: [], repairOwner: host.repairOwner }, host.context));
      ensure(current.serve, `switch-on refused: missing binding ${current.missing.join(', ')}`);
      return Object.freeze({ owner: 'part-ten' as const, installation, posture: current, coordinator, close: storage.close });
    } catch (error) { storage.close(); throw error; }
  });
}
