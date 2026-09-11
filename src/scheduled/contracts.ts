import type { BoundaryContext, Clock, Hash, Result } from '../index.js';
import type { LocalCapabilityPackage } from '../assembly/index.js';

export type ScheduledPriority = 'low' | 'maintenance' | 'medium' | 'high' | 'critical';
export type ScheduledPlacement = 'global-once' | 'every-eligible-machine';
export type ScheduledCatchUp = 'none' | 'latest';
export type ScheduledSupervision = 'tier0' | 'tier1' | 'tier2';

export interface NormalizedCronV1 {
  readonly expression: string;
  readonly fields: readonly [readonly number[], readonly number[], readonly number[], readonly number[], readonly number[]];
  readonly dayOfMonthUnrestricted: boolean;
  readonly dayOfWeekUnrestricted: boolean;
}

export type ScheduledCalendar = Readonly<{
  kind: 'recurring'; expression: string; timeZone: string;
}> | Readonly<{
  kind: 'one-shot'; at: string;
}>;

// This is a Part Ten package resource, not a new constitutional record or fact kind.
export interface ScheduledWorkManifest {
  readonly type: 'ScheduledWorkManifest';
  readonly schemaVersion: 2;
  readonly identity: Readonly<{
    jobId: string; displayName: string; accountableOwner: string; packageVersion: string; contentDigest: Hash;
  }>;
  readonly schedule: ScheduledCalendar & Readonly<{
    activationInstant: string; timeZoneDataVersion: string; calendarPolicyVersion: string; currentLatenessCutoffMs: number;
  }>;
  readonly work: Readonly<{
    entryPoint: string; bodyDigest: Hash; resultDestination: string; groundingContract: string; predecessors: readonly string[];
  }>;
  readonly authority: Readonly<{
    systemPrincipal: string; standingGrant: string; scope: string; operationClasses: readonly string[]; authorizations: readonly string[];
  }>;
  readonly bounds: Readonly<{
    runBudget: string; exitTest: string; durationMs: number; attempts: number; concurrency: number;
    tokens: number; money: number; bytes: number; notifications: number;
  }>;
  readonly admission: Readonly<{
    priority: ScheduledPriority; eligibleAssemblies: readonly string[]; eligibleMachines: readonly string[];
    requiredCapabilities: readonly string[]; capacityEvidencePolicy: string; placement: ScheduledPlacement;
    catchUp: ScheduledCatchUp; classWeights: Readonly<Record<ScheduledPriority, number>>; creditCap: number;
    promotionAfterMs: number; minimumMaintenanceShare: number; maxHighPriorityEligibilityToAdmissionMs: number;
  }>;
  readonly intelligence: Readonly<{
    route: string; floor: string; profile: string; supervision: ScheduledSupervision;
    businessSteps: readonly string[]; capturePolicy: string; gradingPolicy: string;
    failureDirection: 'closed' | 'open'; postCompletionLearning: 'off' | 'required';
  }>;
  readonly effectsAndProof: Readonly<{
    operations: readonly string[]; operationIdentityPolicy: string; verificationPlan: string;
    acceptedOutcomeEvidence: readonly string[]; uncertaintyOwner: string;
  }>;
  readonly recovery: Readonly<{
    parentDuty: string; rollingBudget: string; loopPolicy: string; backoffPolicy: string;
    breakerOutcomeWindow: string; recoveryPolicy: string; maxOverdueAgeMs: number; exhaustionDestination: string;
  }>;
  readonly presentation: Readonly<{
    destination: string; pushPolicy: string; description: string;
  }>;
  readonly activation: Readonly<{
    requiredChecks: readonly string[]; semanticReview: string; assemblyCompatibility: string;
    holderProof: string; rollout: 'dark' | 'dry-run' | 'active';
  }>;
}

export interface ScheduledManifestIdentity {
  readonly jobId: string;
  readonly canonicalHash: Hash;
  readonly canonicalBytes: string;
}

export interface ScheduledOccurrencePlan {
  readonly namespaceVersion: string;
  readonly installationId: string;
  readonly jobInstanceId: string;
  readonly scheduledInstant: string;
  readonly scheduledAtMs: number;
  readonly eventId: Hash;
  readonly tickBytes: string;
  readonly tickHash: Hash;
  readonly disposition: 'not-yet-due' | 'current' | 'missed';
}

export interface ScheduledWorkPackagePort {
  readonly owner: 'part-fifteen';
  decode(input: unknown, context: BoundaryContext): Result<ScheduledWorkManifest>;
  identity(input: unknown, context: BoundaryContext): Result<ScheduledManifestIdentity>;
  compare(left: unknown, right: unknown, context: BoundaryContext): Result<'equal' | 'different'>;
  admitPackageResource(input: Readonly<{
    package: LocalCapabilityPackage; manifestPath: string; manifestBytes: string;
    existingManifests: readonly ScheduledWorkManifest[];
  }>, context: BoundaryContext): Result<ScheduledWorkManifest>;
  planOccurrence(input: Readonly<{
    manifest: unknown; namespaceVersion: string; installationId: string; targetMachineId?: string;
    scheduledInstant: string; asOf: Clock;
  }>, context: BoundaryContext): Result<ScheduledOccurrencePlan>;
}
