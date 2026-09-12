import { canonical, consumeResult, decodeMeasurement } from '../index.js';
import type { BoundaryContext, Clock, Hash } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage, safePackagePath, stageLocalCapability } from '../assembly/index.js';
import type { AssemblyDecodeContext, CurrentAssemblyFact } from '../assembly/index.js';
import type { RunExit, RunExitReadPort } from '../rungraph/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { parseUnambiguousJson, topLevelJsonStringMemberValues } from './json.js';
import { canonicalManifest, decodeScheduledWorkManifest } from './manifest.js';
import { canonicalInstant, parseRfc3339Offset } from './time.js';
import type { ScheduledOccurrencePlan, ScheduledWorkPackagePort } from './contracts.js';

function encoded(value: unknown): Readonly<{ bytes: string; hash: Hash }> { return take(canonical(value)); }

function ownerValidatedActivePackages(current: readonly CurrentAssemblyFact[], context: AssemblyDecodeContext) {
  const namespaces = new Set(current.flatMap(row => row.record.type === 'LocalCapabilityPackage'
    ? [row.record.namespace] : []));
  return [...namespaces].flatMap(namespace => consumeResult(resolveActivePackage(namespace, current, context), {
    Success: value => [value],
    Refused: () => [],
  }));
}

function isAdditionalScheduledManifest(bytes: string, context: BoundaryContext): boolean {
  let parsed: unknown;
  try { parsed = parseUnambiguousJson(bytes); } catch (error) {
    // A repeated member is a resource-encoding refusal, not evidence that the
    // resource has ceased to be a scheduled manifest. Decode every top-level
    // type value without erasing repeats; the ambiguous bytes are never admitted.
    try {
      if (topLevelJsonStringMemberValues(bytes, 'type').includes('ScheduledWorkManifest')) throw error;
    } catch (classificationError) {
      if (classificationError === error) throw error;
      return false;
    }
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

function authoritativeCollision(manifestJobId: string, namespace: string, context: AssemblyDecodeContext): string | undefined {
  ensure(context.history, 'complete authoritative Part Ten package comparison is unavailable');
  const current = take(context.history.current());
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
    const competing = consumeResult(resolveActivePackage(competingNamespace, current, context), {
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
        ensure(Array.isArray(input.archive), 'complete Part Ten package archive must be supplied');
        const staged = take(stageLocalCapability(supplied, input.archive,
          ownerValidatedActivePackages(current, assemblyContext), assemblyContext));
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
        const collision = authoritativeCollision(manifest.identity.jobId, supplied.namespace, context as AssemblyDecodeContext);
        ensure(!collision, collision === manifest.identity.jobId ? 'duplicate scheduled job id' : 'case-folded scheduled job identity collision');
        const body = supplied.entrypoints.find(entry => entry.id === manifest.work.entryPoint);
        ensure(body && body.digest === manifest.work.bodyDigest, 'manifest body differs from immutable Part Ten entry point');
        const additionalManifest = staged.entries.find(entry => entry.path !== input.manifestPath
          && isAdditionalScheduledManifest(entry.bytes, context));
        ensure(!additionalManifest, 'package contains multiple scheduled work manifests');
        const packageChecks = new Set([...supplied.checks.unit, ...supplied.checks.integration, ...supplied.checks.lifecycle]);
        ensure(manifest.activation.requiredChecks.every(check => packageChecks.has(check)), 'manifest requires a check absent from the Part Ten package');
        // This is deliberately the final history-dependent operation. Any
        // retirement recorded while archive, dependency, collision, or
        // manifest validation ran must inhibit this admission rather than let
        // an earlier package read escape into the returned decision.
        const active = take(resolveActivePackage(supplied.namespace, current, assemblyContext));
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
