import { canonical, consumeResult, decodeMeasurement } from '../index.js';
import type { BoundaryContext, Clock, Hash } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage, safePackagePath } from '../assembly/index.js';
import type { AssemblyDecodeContext, CurrentAssemblyFact, PackageTransition } from '../assembly/index.js';
import type { RunExit, RunExitReadPort } from '../rungraph/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { parseUnambiguousJson } from './json.js';
import { canonicalManifest, decodeScheduledWorkManifest } from './manifest.js';
import { canonicalInstant, parseRfc3339Offset } from './time.js';
import type { ScheduledOccurrencePlan, ScheduledWorkPackagePort } from './contracts.js';

function encoded(value: unknown): Readonly<{ bytes: string; hash: Hash }> { return take(canonical(value)); }

function authoritativeCollision(manifestJobId: string, namespace: string, context: AssemblyDecodeContext): string | undefined {
  ensure(context.history, 'complete authoritative Part Ten package comparison is unavailable');
  const current = take(context.history.current());
  const transitions = current.filter((row): row is CurrentAssemblyFact & { record: PackageTransition } =>
    row.record.type === 'PackageTransition');
  const superseded = new Set(transitions.flatMap(row => [...row.record.predecessors, ...row.record.dependencyFacts]));
  const activeNamespaces = new Set(transitions.filter(row => !superseded.has(row.fact.id) && row.record.to === 'active')
    .map(row => row.record.package));
  const competingNamespaces = new Set(current.filter((row): row is CurrentAssemblyFact & {
    record: import('../assembly/index.js').LocalCapabilityPackage;
  } => row.record.type === 'LocalCapabilityPackage'
      && row.record.namespace !== namespace
      && activeNamespaces.has(row.record.namespace)
      && row.record.declarationIds.some(id => id.toLowerCase() === manifestJobId.toLowerCase()))
    .map(row => row.record.namespace));
  for (const competingNamespace of competingNamespaces) {
    const competing = take(resolveActivePackage(competingNamespace, current, context));
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
        ensure(Object.keys(candidate).every(key => ['package', 'manifestPath', 'manifestBytes', 'existingManifests'].includes(key))
          && ['package', 'manifestPath', 'manifestBytes', 'existingManifests'].every(key => Object.hasOwn(candidate, key)), 'package admission input has missing or unexpected fields');
        const supplied = take(decodeLocalCapabilityPackage(input.package, context as AssemblyDecodeContext));
        const active = take(resolveActivePackage(supplied.namespace, [], context as AssemblyDecodeContext));
        ensure(encoded(active).bytes === encoded(supplied).bytes, 'supplied package differs from current Part Ten package');
        ensure(safePackagePath(input.manifestPath), 'manifest path is not a safe Part Ten package path');
        const manifestEntry = active.entrypoints.find(entry => entry.path === input.manifestPath);
        ensure(manifestEntry && manifestEntry.digest === hashBytes(input.manifestBytes), 'manifest bytes differ from the Part Ten package entry');
        const parsed = parseUnambiguousJson(input.manifestBytes);
        const manifest = take(decodeScheduledWorkManifest(parsed, context));
        ensure(manifest.identity.accountableOwner === active.ownerPrincipal, 'manifest owner differs from Part Ten package owner');
        ensure(manifest.identity.packageVersion === active.version && manifest.identity.contentDigest === active.contentDigest,
          'manifest package version or content digest differs from Part Ten authority');
        ensure(active.declarationIds.includes(manifest.identity.jobId), 'matching Part Ten feature declaration is absent');
        ensure(Array.isArray(input.existingManifests), 'caller manifest collision copy must be a list');
        ensure(input.existingManifests.length === 0, 'caller manifest collision copy carries no authority');
        const collision = authoritativeCollision(manifest.identity.jobId, active.namespace, context as AssemblyDecodeContext);
        ensure(!collision, collision === manifest.identity.jobId ? 'duplicate scheduled job id' : 'case-folded scheduled job identity collision');
        const body = active.entrypoints.find(entry => entry.id === manifest.work.entryPoint);
        ensure(body && body.digest === manifest.work.bodyDigest, 'manifest body differs from immutable Part Ten entry point');
        const packageChecks = new Set([...active.checks.unit, ...active.checks.integration, ...active.checks.lifecycle]);
        ensure(manifest.activation.requiredChecks.every(check => packageChecks.has(check)), 'manifest requires a check absent from the Part Ten package');
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
