import type { Clock,FactEnvelopeReference,Result } from '../../index.js';
import type { CausalFrontier } from '../../facts/index.js';
import type {
  InboundRoute as LegacyInboundRoute,
  IntakeDependencies,
  IntakeDisposition as LegacyIntakeDisposition,
  IntakePort,
} from '../contracts.js';

export type { IntakeDependencies } from '../contracts.js';

export interface InboundRoute extends LegacyInboundRoute {
  readonly adapter?: string;
}

export type ConstitutionalReference<N extends string>=Readonly<{
  readonly type: N;
  readonly id: string;
  readonly fact: FactEnvelopeReference;
  readonly field: string;
}>;

export interface ScheduledInboundRoute extends InboundRoute {
  readonly adapter?: string;
}

export type ScheduledIntakeDisposition=Readonly<{
  readonly kind: 'scheduled-admitted';
  readonly logicalId: string;
  readonly fact: FactEnvelopeReference;
  readonly owner: string;
  readonly blockedOn: 'run-admission';
  readonly principal: ConstitutionalReference<'VerifiedPrincipal'>;
  readonly standing: ConstitutionalReference<'StandingGrant'>;
  readonly scheduledIdentity: Readonly<{
    readonly jobInstance: string;
    readonly scheduledInstant: Clock;
  }>;
}>;

export type IntakeDisposition=LegacyIntakeDisposition|ScheduledIntakeDisposition;

export interface ScheduledTickAdmission {
  readonly raw: string;
  readonly route: ScheduledInboundRoute;
  readonly discovery: FactEnvelopeReference;
}

export interface PendingScheduledAdmissionsInput {
  readonly owner: string;
  readonly frontier: CausalFrontier;
  readonly limit: number;
  readonly after: FactEnvelopeReference|null;
}

export type PendingScheduledAdmissions=Readonly<{
  readonly admissions: readonly FactEnvelopeReference[];
  readonly partial?: readonly FactEnvelopeReference[];
  readonly next: FactEnvelopeReference|null;
}>;

export interface ScheduledIntakePort extends IntakePort {
  receiveScheduledTick(input: ScheduledTickAdmission): Result<IntakeDisposition>;
  pendingScheduledAdmissions(input: PendingScheduledAdmissionsInput): Result<PendingScheduledAdmissions>;
}

export type ScheduledIntakeDependencies=IntakeDependencies;
