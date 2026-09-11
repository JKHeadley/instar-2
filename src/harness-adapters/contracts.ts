import type { Hash, Result } from '../index.js';
import type { AssemblyDecodeContext, AssemblyHost } from '../assembly/index.js';

declare const harnessAdapterOwned: unique symbol;
interface HarnessAdapterOwned { readonly [harnessAdapterOwned]: 'part-thirteen-implementation' }

export type HarnessRuntimeEventKind =
  | 'process-started'
  | 'probe-live'
  | 'probe-failed'
  | 'input-accepted'
  | 'context-consumed'
  | 'heartbeat'
  | 'work-transition'
  | 'output-chunk'
  | 'turn-closed'
  | 'process-exited'
  | 'diagnostic';

export interface HarnessOutputRange {
  readonly start: number;
  readonly end: number;
  readonly byteCount: number;
  readonly digest: Hash;
  readonly captureReference: string;
  readonly truncated: boolean;
}

/** Package-local protocol evidence. It is not a fact, permission, or owner state. */
export interface HarnessRuntimeEvent extends HarnessAdapterOwned {
  readonly type: 'HarnessRuntimeEvent';
  readonly schemaVersion: 2;
  readonly id: string;
  readonly harness: string;
  readonly artifactDigest: Hash;
  readonly platform: string;
  readonly machine: string;
  readonly launch: string;
  readonly run: string;
  readonly step: string;
  readonly input: string;
  readonly incarnation: string;
  readonly processIdentity: string;
  readonly operation: string;
  readonly kind: HarnessRuntimeEventKind;
  readonly sourceClock: number;
  readonly observedAt: number;
  readonly freshFor: number;
  readonly sourceEvidence: readonly string[];
  readonly predecessor: string;
  readonly workSubject: string;
  readonly workPhase: string;
  readonly output: HarnessOutputRange | null;
  readonly streamState: 'open' | 'closed' | 'unknown';
  readonly childrenState: 'none' | 'closed' | 'pending' | 'unknown';
  readonly unresolvedOperations: readonly string[];
  readonly exitStatus: number | null;
  readonly diagnosticCode: string;
}

/** A machine-local process handle record. It grants no authority. */
export interface HarnessRuntimeHandle extends HarnessAdapterOwned {
  readonly type: 'HarnessRuntimeHandle';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly harness: string;
  readonly artifactDigest: Hash;
  readonly platform: string;
  readonly machine: string;
  readonly launch: string;
  readonly run: string;
  readonly step: string;
  readonly input: string;
  readonly inputDigest: Hash;
  readonly incarnation: string;
  readonly processIdentity: string;
  readonly launchOperation: string;
  readonly launchClaim: string;
  readonly acquiredAt: number;
  readonly contextDigests: readonly Hash[];
  readonly dependencyFacts: readonly string[];
}

export interface HarnessHandleSnapshot extends HarnessAdapterOwned {
  readonly type: 'HarnessHandleSnapshot';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly adapter: string;
  readonly machine: string;
  readonly capturedAt: number;
  readonly maxHandles: number;
  readonly handles: readonly HarnessRuntimeHandle[];
}

export interface HarnessOperationAttempt {
  readonly kind: 'launch' | 'delivery';
  readonly operation: string;
  readonly launch: string;
  readonly incarnation: string;
  readonly subjectDigest: Hash;
  readonly state: 'pending' | 'observed';
  readonly evidence: string;
  readonly attemptedAt: number;
  readonly observedAt: number | null;
}

/** Package-local journal image retained as an owned record for Slice A2. */
export interface HarnessAdapterStateSnapshot extends HarnessAdapterOwned {
  readonly type: 'HarnessAdapterStateSnapshot';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly adapter: string;
  readonly machine: string;
  readonly revision: number;
  readonly maxHandles: number;
  readonly maxAttempts: number;
  readonly maxEvents: number;
  readonly maxCaptureBytes: number;
  readonly handles: readonly HarnessRuntimeHandle[];
  readonly attempts: readonly HarnessOperationAttempt[];
  readonly events: readonly HarnessRuntimeEvent[];
}

export type HarnessAdapterRecord = HarnessRuntimeEvent | HarnessRuntimeHandle |
  HarnessHandleSnapshot | HarnessAdapterStateSnapshot;
export type HarnessAdapterRecordName = HarnessAdapterRecord['type'];
export interface HarnessAdapterDecodeContext extends AssemblyDecodeContext {}

export interface HarnessAdapterIdentity {
  readonly id: string;
  readonly logicalKey: string;
  readonly canonicalHash: Hash;
}

export interface HarnessAdapterComparison {
  readonly equal: boolean;
  readonly conflict?: Readonly<{
    logicalKey: string;
    kind: 'immutable-disagreement';
    hashes: readonly Hash[];
  }>;
}

export interface HarnessAttemptAdmission {
  readonly disposition: 'started' | 'existing' | 'observed' | 'duplicate' | 'refused';
  readonly reason: string;
  readonly attempt: HarnessOperationAttempt | null;
}

export interface HarnessProgressIdentity {
  readonly disposition: 'advancing' | 'duplicate' | 'conflict' | 'non-progress';
  readonly reason: string;
  readonly key: string;
}

export interface HarnessObservationAdmission {
  readonly disposition: 'recorded' | 'duplicate' | 'refused';
  readonly reason: string;
  readonly progress: boolean;
  readonly progressKey: string;
  readonly event: HarnessRuntimeEvent | null;
}

/**
 * Slice A1 is stateless: callers supply already retained records. Durable journal
 * reading, rotation, and all lifecycle decisions belong to Slice A2.
 */
export interface HarnessAdmissionPort {
  readonly owner: 'part-thirteen';
  beginAttempt(input: unknown, retained: readonly unknown[], maximum: number): HarnessAttemptAdmission;
  finishAttempt(operation: unknown, evidence: unknown, observedAt: unknown,
    retained: readonly unknown[]): HarnessAttemptAdmission;
  admitObservation(event: unknown, retained: readonly unknown[], maximum: number): HarnessObservationAdmission;
  progressIdentity(event: unknown, retained: readonly unknown[]): HarnessProgressIdentity;
}

export interface HarnessAdmissionInput {
  readonly adapter: string;
  readonly artifact: Hash;
  readonly platform: string;
  readonly machine: string;
  readonly context: HarnessAdapterDecodeContext;
  /** Part Ten's landed host read supplies the current register generation. */
  readonly current: Pick<AssemblyHost, 'current'>;
}

export interface HarnessRuntimeEventDecoderPort {
  readonly owner: 'part-thirteen';
  readonly harness: string;
  decode(input: unknown, context: HarnessAdapterDecodeContext): Result<HarnessRuntimeEvent>;
}
