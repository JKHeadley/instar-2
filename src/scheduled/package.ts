import { canonical, consumeResult, decodeMeasurement } from '../index.js';
import type { BoundaryContext, Clock, Hash } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage, safePackagePath, stageLocalCapability } from '../assembly/index.js';
import type { AssemblyDecodeContext, CurrentAssemblyFact, LocalCapabilityPackage } from '../assembly/index.js';
import type { RunExit, RunExitReadPort } from '../rungraph/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { inspectTopLevelJsonStringMemberValues, parseUnambiguousJson } from './json.js';
import { canonicalManifest, decodeScheduledWorkManifest } from './manifest.js';
import { canonicalInstant, parseRfc3339Offset } from './time.js';
import type { ScheduledOccurrencePlan, ScheduledWorkPackagePort } from './contracts.js';

function encoded(value: unknown): Readonly<{ bytes: string; hash: Hash }> { return take(canonical(value)); }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }

type PackageResolution = ReturnType<typeof resolveActivePackage>;

function packageResolutions(current: readonly CurrentAssemblyFact[], context: AssemblyDecodeContext) {
  const namespaces = new Set(current.flatMap(row => row.record.type === 'LocalCapabilityPackage'
    ? [row.record.namespace] : []));
  return new Map([...namespaces].sort().map(namespace => [namespace,
    resolveActivePackage(namespace, current, context)]));
}

function ownerValidatedActivePackages(resolutions: ReadonlyMap<string, PackageResolution>) {
  return [...resolutions.values()].flatMap(result => consumeResult(result, {
    Success: value => [value],
    Refused: () => [],
  }));
}

function assemblyFrontier(rows: readonly CurrentAssemblyFact[]): Hash {
  return encoded([...rows].map(row => ({
    fact: row.fact.id,
    content: row.fact.contentHash,
    segment: row.fact.segment,
    predecessors: row.fact.predecessors,
    taint: [...row.taint].sort(),
    conflicts: [...row.conflicts].map(conflict => ({ ...conflict, facts: [...conflict.facts].sort() }))
      .sort((left, right) => compareText(`${left.key}:${left.kind}:${left.facts.join(',')}`,
        `${right.key}:${right.kind}:${right.facts.join(',')}`)),
  })).sort((left, right) => compareText(left.fact, right.fact))).hash;
}

function isAdditionalScheduledManifest(bytes: string, context: BoundaryContext): boolean {
  let parsed: unknown;
  try { parsed = parseUnambiguousJson(bytes); } catch (error) {
    // Once a top-level scheduled kind has been decoded, retain the original
    // resource refusal even when malformed trailing bytes stop classification.
    const declaredTypes = inspectTopLevelJsonStringMemberValues(bytes, 'type').values;
    if (declaredTypes.includes('ScheduledWorkManifest')) throw error;
    return false;
  }
  return consumeResult(decodeScheduledWorkManifest(parsed, context), {
    Success: () => true,
    Refused: refusal => {
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        && (parsed as Record<string, unknown>).type === 'ScheduledWorkManifest') throw new Error(refusal.detail);
      return false;
    },
  });
}

function authoritativeCollision(manifestJobId: string, namespace: string, current: readonly CurrentAssemblyFact[],
  resolutions: ReadonlyMap<string, PackageResolution>): string | undefined {
  const competingNamespaces = new Set(current.filter((row): row is CurrentAssemblyFact & {
    record: import('../assembly/index.js').LocalCapabilityPackage;
  } => row.record.type === 'LocalCapabilityPackage' && row.record.namespace !== namespace)
    .map(row => row.record.namespace));
  for (const competingNamespace of competingNamespaces) {
    const potentiallyConflicting = current.some(row => row.record.type === 'LocalCapabilityPackage'
      && row.record.namespace === competingNamespace
      && row.record.declarationIds.some(id => id.toLowerCase() === manifestJobId.toLowerCase()));
    if (!potentiallyConflicting) continue;
    // Part Ten's current public resolver returns an active package or one generic
    // refusal. Only the owner may distinguish proved-inactive history from an
    // unresolved, conflicted, tainted, or ambiguous lifecycle.
    const resolution = resolutions.get(competingNamespace);
    ensure(resolution, 'competing package activity requires a Part Ten owner-issued activity resolution');
    const competing = consumeResult(resolution, {
      Success: value => value,
      Refused: () => undefined,
    });
    if (!competing) {
      ensure(false, 'competing package activity requires a Part Ten owner-issued activity resolution');
    }
    const jobId = competing.declarationIds.find(id => id.toLowerCase() === manifestJobId.toLowerCase());
    if (jobId) return jobId;
  }
  return undefined;
}

export function createScheduledWorkPackagePort(): ScheduledWorkPackagePort {
  return Object.freeze({ owner: 'part-fifteen' as const,
    decode: decodeScheduledWorkManifest,
    identity(input: unknown, context: BoundaryContext) {
      return boundary('ScheduledManifestIdentity', input, context, () => {
        const value = canonicalManifest(input, context);
        return freeze({ jobId: value.manifest.identity.jobId, canonicalHash: value.hash, canonicalBytes: value.bytes });
      });
    },
    compare(left: unknown, right: unknown, context: BoundaryContext) {
      return boundary('ScheduledManifestComparison', { left, right }, context, () => {
        const a = canonicalManifest(left, context); const b = canonicalManifest(right, context);
        return a.bytes === b.bytes ? 'equal' as const : 'different' as const;
      });
    },
    admitPackageResource(input: Parameters<ScheduledWorkPackagePort['admitPackageResource']>[0], context: BoundaryContext) {
      return boundary('ScheduledPackageResourceAdmission', input, context, () => {
        const candidate = input as unknown as Record<string, unknown>;
        ensure(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'package admission input must be an object');
        ensure(Object.keys(candidate).every(key => ['package', 'archive', 'manifestPath', 'manifestBytes', 'existingManifests'].includes(key))
          && ['package', 'archive', 'manifestPath', 'manifestBytes', 'existingManifests'].every(key => Object.hasOwn(candidate, key)), 'package admission input has missing or unexpected fields');
        const supplied = take(decodeLocalCapabilityPackage(input.package, context as AssemblyDecodeContext));
        const assemblyContext = context as AssemblyDecodeContext;
        ensure(assemblyContext.history, 'complete authoritative Part Ten package comparison is unavailable');
        const current = take(assemblyContext.history.current());
        const initialFrontier = assemblyFrontier(current);
        const resolutions = packageResolutions(current, assemblyContext);
        ensure(Array.isArray(input.archive), 'complete Part Ten package archive must be supplied');
        const staged = take(stageLocalCapability(supplied, input.archive,
          ownerValidatedActivePackages(resolutions), assemblyContext));
        ensure(safePackagePath(input.manifestPath), 'manifest path is not a safe Part Ten package path');
        const manifestEntry = supplied.entrypoints.find(entry => entry.path === input.manifestPath);
        ensure(manifestEntry && manifestEntry.digest === hashBytes(input.manifestBytes), 'manifest bytes differ from the Part Ten package entry');
        const verifiedManifestEntry = staged.entries.find(entry => entry.path === input.manifestPath);
        ensure(verifiedManifestEntry?.bytes === input.manifestBytes, 'manifest bytes differ from the validated Part Ten archive');
        const parsed = parseUnambiguousJson(verifiedManifestEntry.bytes);
        const manifest = take(decodeScheduledWorkManifest(parsed, context));
        ensure(manifest.identity.accountableOwner === supplied.ownerPrincipal, 'manifest owner differs from Part Ten package owner');
        ensure(manifest.identity.packageVersion === supplied.version && manifest.identity.contentDigest === supplied.contentDigest,
          'manifest package version or content digest differs from Part Ten authority');
        ensure(supplied.declarationIds.includes(manifest.identity.jobId), 'matching Part Ten feature declaration is absent');
        ensure(Array.isArray(input.existingManifests), 'caller manifest collision copy must be a list');
        ensure(input.existingManifests.length === 0, 'caller manifest collision copy carries no authority');
        const collision = authoritativeCollision(manifest.identity.jobId, supplied.namespace, current, resolutions);
        ensure(!collision, collision === manifest.identity.jobId ? 'duplicate scheduled job id' : 'case-folded scheduled job identity collision');
        const body = supplied.entrypoints.find(entry => entry.id === manifest.work.entryPoint);
        ensure(body && body.digest === manifest.work.bodyDigest, 'manifest body differs from immutable Part Ten entry point');
        const additionalManifest = staged.entries.find(entry => entry.path !== input.manifestPath
          && isAdditionalScheduledManifest(entry.bytes, context));
        ensure(!additionalManifest, 'package contains multiple scheduled work manifests');
        const packageChecks = new Set([...supplied.checks.unit, ...supplied.checks.integration, ...supplied.checks.lifecycle]);
        ensure(manifest.activation.requiredChecks.every(check => packageChecks.has(check)), 'manifest requires a check absent from the Part Ten package');
        const observedFrontier = assemblyFrontier(take(assemblyContext.history.current()));
        // Pin one owner history frontier only after every earlier validation.
        // If history moved during any owner read, the caller must retry from a
        // fresh complete validation instead of combining facts from two views.
        const pinned = take(assemblyContext.history.current());
        const { history: _liveHistory, ...pinnedContext } = assemblyContext;
        // Preserve the selected package owner's narrower retirement refusal
        // when the final snapshot already proves that specific terminal state.
        const active: LocalCapabilityPackage = take(resolveActivePackage(supplied.namespace, pinned,
          { ...pinnedContext, validateReferences: false }));
        ensure(observedFrontier === initialFrontier && assemblyFrontier(pinned) === initialFrontier,
          'package admission history frontier moved');
        // Recheck every history-consequential predicate against that one
        // unchanged snapshot without another current-history read.
        const pinnedActive = ownerValidatedActivePackages(resolutions);
        take(stageLocalCapability(supplied, input.archive, pinnedActive,
          { ...pinnedContext, validateReferences: false }));
        const pinnedCollision = authoritativeCollision(manifest.identity.jobId, supplied.namespace, pinned, resolutions);
        ensure(!pinnedCollision, pinnedCollision === manifest.identity.jobId
          ? 'duplicate scheduled job id' : 'case-folded scheduled job identity collision');
        ensure(encoded(active).bytes === encoded(supplied).bytes, 'supplied package differs from current Part Ten package');
        return manifest;
      });
    },
    planOccurrence(input: Parameters<ScheduledWorkPackagePort['planOccurrence']>[0], context: BoundaryContext) {
      return boundary('ScheduledOccurrencePlanning', input, context, () => {
        const candidate = input as unknown as Record<string, unknown>;
        ensure(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'occurrence planning input must be an object');
        ensure(Object.keys(candidate).every(key => ['manifest', 'namespaceVersion', 'installationId', 'targetMachineId', 'scheduledInstant', 'asOf'].includes(key))
          && ['manifest', 'namespaceVersion', 'installationId', 'scheduledInstant', 'asOf'].every(key => Object.hasOwn(candidate, key)), 'occurrence planning input has missing or unexpected fields');
        ensure(typeof input.namespaceVersion === 'string' && input.namespaceVersion.length > 0, 'namespaceVersion must be nonempty text');
        ensure(typeof input.installationId === 'string' && input.installationId.length > 0, 'installationId must be nonempty text');
        const manifest = take(decodeScheduledWorkManifest(input.manifest, context));
        ensure(manifest.schedule.kind === 'one-shot', 'recurring planning requires the unlanded pinned-calendar adapter seam');
        const scheduledInstant = canonicalInstant(input.scheduledInstant);
        ensure(scheduledInstant === canonicalInstant(manifest.schedule.at), 'one-shot instant differs from the immutable manifest');
        const scheduledAtMs = parseRfc3339Offset(scheduledInstant); const activationAt = parseRfc3339Offset(manifest.schedule.activationInstant);
        ensure(scheduledAtMs >= activationAt, 'occurrence precedes package activation');
        const asOf = take(decodeMeasurement('clock', input.asOf, context as unknown as Parameters<typeof decodeMeasurement>[2]));
        const disposition = asOf.value < scheduledAtMs ? 'not-yet-due' as const
          : asOf.value - scheduledAtMs <= manifest.schedule.currentLatenessCutoffMs ? 'current' as const : 'missed' as const;
        let target = '';
        if (manifest.admission.placement === 'every-eligible-machine') {
          target = input.targetMachineId ?? ''; ensure(target.length > 0 && manifest.admission.eligibleMachines.includes(target), 'eligible target machine is required');
        } else ensure(input.targetMachineId === undefined, 'global-once occurrence cannot carry a target machine');
        const instance = encoded({ namespaceVersion: input.namespaceVersion, installationId: input.installationId,
          jobId: manifest.identity.jobId, placement: manifest.admission.placement, targetMachine: target });
        const jobInstanceId = `scheduled-instance:${instance.hash.slice(7)}`;
        const event = encoded({ namespaceVersion: input.namespaceVersion, jobInstanceId, scheduledInstant });
        const tick = encoded({ schemaVersion: 1, jobInstanceId, scheduledInstant, packageDigest: manifest.identity.contentDigest,
          calendarPolicyVersion: manifest.schedule.calendarPolicyVersion, timeZoneDataVersion: manifest.schedule.timeZoneDataVersion });
        return freeze({ namespaceVersion: input.namespaceVersion, installationId: input.installationId, jobInstanceId,
          scheduledInstant, scheduledAtMs, eventId: event.hash, tickBytes: tick.bytes, tickHash: tick.hash, disposition } satisfies ScheduledOccurrencePlan);
      });
    },
  });
}

export function consumeScheduledManifest<T>(result: ReturnType<ScheduledWorkPackagePort['decode']>, handlers: Readonly<{
  admitted(value: import('./contracts.js').ScheduledWorkManifest): T; refused(detail: string): T;
}>): T {
  return consumeResult(result, { Success: handlers.admitted, Refused: refusal => handlers.refused(refusal.detail) });
}

/** Resolve a scheduling disposition through Part Five; transport/control receipts are never business outcomes. */
export function readScheduledBusinessDisposition(owner: RunExitReadPort, run: unknown): import('../index.js').Result<Readonly<{
  fact: import('../index.js').FactEnvelopeReference; exit: RunExit;
}>> {
  return owner.readExit(run as Parameters<RunExitReadPort['readExit']>[0]);
}
