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
    const current = context.history ? take(context.history.current()) : rows;
    const packages = current.filter(row => row.record.type === 'LocalCapabilityPackage' && row.record.namespace === namespace);
    ensure(packages.length > 0, 'local package missing from signed history');
    const transitions = current.filter((row): row is CurrentAssemblyFact & { record: PackageTransition } => row.record.type === 'PackageTransition' && row.record.package === namespace);
    const superseded = new Set(transitions.flatMap(row => [...row.record.predecessors, ...row.record.dependencyFacts]));
    const heads = transitions.filter(row => !superseded.has(row.fact.id));
    ensure(heads.length === 1 && heads[0]!.record.to === 'active' && heads[0]!.conflicts.length === 0 && heads[0]!.taint.length === 0,
      'active package transition missing or ambiguous');
    const transition = heads[0]!;
    if (context.history) {
      const transitionVerdict = take(context.history.resolve(transition.record));
      ensure(transitionVerdict.admitted, transitionVerdict.conflicts[0]?.detail ?? `transition dependency missing: ${transitionVerdict.missing[0] ?? 'unknown'}`);
    }
    const matching = packages.filter((row): row is CurrentAssemblyFact & { record: LocalCapabilityPackage } =>
      row.record.type === 'LocalCapabilityPackage' && row.record.contentDigest === transition.record.observedArtifactDigest);
    ensure(matching.every(row => row.conflicts.length === 0 && row.taint.length === 0), 'active package is conflicted or tainted');
    ensure(matching.length === 1, 'active switch digest differs from immutable package'); const pkg = matching[0]!;
    if (context.history) {
      const packageVerdict = take(context.history.resolve(pkg.record));
      ensure(packageVerdict.admitted, packageVerdict.conflicts[0]?.detail ?? `package dependency missing: ${packageVerdict.missing[0] ?? 'unknown'}`);
    }
    const supportedPorts = new Set(['HarnessAdapterPort', 'ModelAdapterPort', 'PersistenceAdapterPort', 'OperationAdapterPort', 'IntakePort', 'AgentTransportPort']);
    ensure(pkg.record.portRequirements.every(requirement => supportedPorts.has(requirement.port) && requirement.version === '1'), 'required adapter port is unavailable');
    return freeze(pkg.record);
  });
}
