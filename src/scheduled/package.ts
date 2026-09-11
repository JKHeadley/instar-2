import { canonical, consumeResult } from '../index.js';
import type { BoundaryContext, Clock, Hash } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { safePackagePath } from '../assembly/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { canonicalManifest, decodeScheduledWorkManifest } from './manifest.js';
import { canonicalInstant, parseRfc3339Offset } from './time.js';
import type { ScheduledOccurrencePlan, ScheduledWorkPackagePort } from './contracts.js';

function encoded(value: unknown): Readonly<{ bytes: string; hash: Hash }> { return take(canonical(value)); }

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
        ensure(safePackagePath(input.manifestPath), 'manifest path is not a safe Part Ten package path');
        const manifestEntry = input.package.entrypoints.find(entry => entry.path === input.manifestPath);
        ensure(manifestEntry && manifestEntry.digest === hashBytes(input.manifestBytes), 'manifest bytes differ from the Part Ten package entry');
        let parsed: unknown; try { parsed = JSON.parse(input.manifestBytes); } catch { throw new Error('manifest resource is not JSON'); }
        const manifest = take(decodeScheduledWorkManifest(parsed, context));
        ensure(manifest.identity.accountableOwner === input.package.ownerPrincipal, 'manifest owner differs from Part Ten package owner');
        ensure(manifest.identity.packageVersion === input.package.version && manifest.identity.contentDigest === input.package.contentDigest,
          'manifest package version or content digest differs from Part Ten authority');
        ensure(input.package.declarationIds.includes(manifest.identity.jobId), 'matching Part Ten feature declaration is absent');
        const collision = input.existingManifests.find(existing => existing.identity.jobId.toLowerCase() === manifest.identity.jobId.toLowerCase());
        ensure(!collision, collision?.identity.jobId === manifest.identity.jobId ? 'duplicate scheduled job id' : 'case-folded scheduled job identity collision');
        const body = input.package.entrypoints.find(entry => entry.id === manifest.work.entryPoint);
        ensure(body && body.digest === manifest.work.bodyDigest, 'manifest body differs from immutable Part Ten entry point');
        const packageChecks = new Set([...input.package.checks.unit, ...input.package.checks.integration, ...input.package.checks.lifecycle]);
        ensure(manifest.activation.requiredChecks.every(check => packageChecks.has(check)), 'manifest requires a check absent from the Part Ten package');
        return manifest;
      });
    },
    planOccurrence(input: Parameters<ScheduledWorkPackagePort['planOccurrence']>[0], context: BoundaryContext) {
      return boundary('ScheduledOccurrencePlanning', input, context, () => {
        const manifest = take(decodeScheduledWorkManifest(input.manifest, context));
        ensure(manifest.schedule.kind === 'one-shot', 'recurring planning requires the unlanded pinned-calendar adapter seam');
        const scheduledInstant = canonicalInstant(input.scheduledInstant);
        ensure(scheduledInstant === canonicalInstant(manifest.schedule.at), 'one-shot instant differs from the immutable manifest');
        const scheduledAtMs = parseRfc3339Offset(scheduledInstant); const activationAt = parseRfc3339Offset(manifest.schedule.activationInstant);
        ensure(scheduledAtMs >= activationAt, 'occurrence precedes package activation');
        ensure(input.asOf.type === 'Measurement' && input.asOf.subject.kind === 'clock' && input.asOf.unit === 'unix-ms', 'asOf must be a decoded Clock');
        const disposition = input.asOf.value < scheduledAtMs ? 'not-yet-due' as const
          : input.asOf.value - scheduledAtMs <= manifest.schedule.currentLatenessCutoffMs ? 'current' as const : 'missed' as const;
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
