import { hashBytes } from '../facts/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { decodeLocalCapabilityPackage, safePackagePath } from './records.js';
import type { AssemblyDecodeContext, CurrentAssemblyFact, LocalCapabilityPackage, PackageArchiveEntry, PackageStageResult, PackageTransition } from './contracts.js';

export function stageLocalCapability(input: unknown, archive: readonly PackageArchiveEntry[], installed: readonly LocalCapabilityPackage[], context: AssemblyDecodeContext) {
  return boundary('LocalCapabilityStage', input, context, () => {
    const pkg = take(decodeLocalCapabilityPackage(input, context));
    ensure(archive.length === pkg.entrypoints.length, 'package archive/entrypoint inventory differs');
    const paths = new Set<string>();
    for (const entry of archive) {
      ensure(entry.kind === 'file' && safePackagePath(entry.path) && !paths.has(entry.path), 'unsafe or duplicate archive entry'); paths.add(entry.path);
      ensure(hashBytes(entry.bytes) === entry.digest, 'archive bytes differ from content digest');
      const declared = pkg.entrypoints.find(candidate => candidate.path === entry.path); ensure(declared && declared.digest === entry.digest, 'archive entry is undeclared or changed');
    }
    ensure(!installed.some(other => other.namespace !== pkg.namespace && other.declarationIds.some(id => pkg.declarationIds.includes(id))), 'package declaration namespace collision');
    const byNamespace = new Map([...installed, pkg].map(value => [value.namespace, value])); const visiting = new Set<string>(), visited = new Set<string>(), order: string[] = [];
    const walk = (current: LocalCapabilityPackage): void => {
      ensure(!visiting.has(current.namespace), 'cyclic package dependency'); if (visited.has(current.namespace)) return; visiting.add(current.namespace);
      for (const dependency of current.dependencies) { const resolved = byNamespace.get(dependency.package); ensure(resolved && resolved.contentDigest === dependency.digest, 'missing or mutable package dependency'); walk(resolved); }
      visiting.delete(current.namespace); visited.add(current.namespace); order.push(current.namespace);
    };
    walk(pkg); return freeze({ package: pkg, entries: archive, dependencyOrder: order } satisfies PackageStageResult);
  });
}

export function resolveActivePackage(namespace: string, rows: readonly CurrentAssemblyFact[], context: AssemblyDecodeContext) {
  return boundary('LocalCapabilityActivationResolution', namespace, context, () => {
    const packages = rows.filter(row => row.record.type === 'LocalCapabilityPackage' && row.record.namespace === namespace);
    ensure(packages.length > 0, 'local package missing from signed history');
    ensure(packages.every(row => row.conflicts.length === 0 && row.taint.length === 0), 'local package history is conflicted or tainted');
    const transitions = rows.filter((row): row is CurrentAssemblyFact & { record: PackageTransition } => row.record.type === 'PackageTransition' && row.record.package === namespace && row.record.to === 'active');
    ensure(transitions.length === 1 && transitions[0]!.conflicts.length === 0 && transitions[0]!.taint.length === 0, 'active package transition missing or ambiguous');
    const pkg = packages.find(row => row.record.type === 'LocalCapabilityPackage' && row.record.contentDigest === transitions[0]!.record.observedArtifactDigest);
    ensure(pkg?.record.type === 'LocalCapabilityPackage', 'active switch digest differs from immutable package'); return freeze(pkg.record);
  });
}
