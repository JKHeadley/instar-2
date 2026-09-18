import type { ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import { freeze } from './boundary.js';
import { assemblyKindFor } from './records.js';
import type { AssemblyStoredRecordName } from './contracts.js';

const views: Readonly<Record<string, readonly AssemblyStoredRecordName[]>> = Object.freeze({
  'assembly-package-admission': ['AssemblyManifest', 'AssemblyAdmission', 'LocalCapabilityPackage', 'PackageTransition'],
  'adapter-parity': ['AdapterEvidenceContract', 'AdapterConformance', 'HarnessLaunchSpec', 'ContextDeliverySpecification', 'HarnessObservation'],
  'storage-audit': ['StoreCustodyPolicy', 'StorageAccessObservation'],
  'growth-episode': ['GrowthPolicy', 'GrowthObservation'],
});
export function assemblyProjectionDefinitions(generation: ProjectionGeneration): readonly ProjectionDefinition[] {
  return freeze(Object.entries(views).map(([id, folds]) => ({ id, class: 'informational' as const,
    retention: 'all-identities' as const, stalenessBound: 60_000,
    decisions: Object.fromEntries(generation.kinds.map(kind => {
      const name = (Object.values(views).flat() as AssemblyStoredRecordName[]).find(candidate => assemblyKindFor(candidate) === kind);
      return [kind, name && folds.includes(name)
        ? { kind: 'folds' as const, merge: 'set-union' as const, identity: 'record.id', value: 'record' }
        : { kind: 'ignores' as const, reason: 'not an input to this Part Ten view; source status remains on the signed spine' }];
    })),
  })));
}
