import type { BoundaryContext, Hash, Result } from '../index.js';
import type {
  AssemblyDecodeContext,
  HarnessAdapterPort,
  NativeHarnessDriverPort,
} from '../assembly/index.js';
import type { FenceToken } from '../transport/index.js';

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

/**
 * Package-local, non-authoritative protocol evidence. This is deliberately not
 * a fact schema or a replacement for Ten's HarnessObservation.
 */
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

/** A process-local handle. It can reconnect one machine; it grants nothing. */
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

export type HarnessAdapterRecord = HarnessRuntimeEvent | HarnessRuntimeHandle | HarnessHandleSnapshot;
export type HarnessAdapterRecordName = HarnessAdapterRecord['type'];

export interface HarnessAdapterDecodeContext extends BoundaryContext {}

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

export interface HarnessHandleLookup {
  readonly found: boolean;
  readonly handle: HarnessRuntimeHandle | null;
}

export interface HarnessHandleWriteReceipt {
  readonly disposition: 'stored' | 'duplicate' | 'refused';
  readonly reason: string;
  readonly canonicalHash: Hash | null;
}

export interface RuntimeHandleHolder {
  readonly owner: 'part-thirteen';
  readonly machine: string;
  readonly maxHandles: number;
  prepare(launch: string): Readonly<{ disposition: 'available' | 'existing' | 'refused'; reason: string }>;
  put(handle: HarnessRuntimeHandle): HarnessHandleWriteReceipt;
  lookup(launch: string): HarnessHandleLookup;
  snapshot(id: string, capturedAt: number): Result<HarnessHandleSnapshot>;
}

export interface HarnessEvidenceAdmission {
  readonly disposition: 'recorded' | 'duplicate' | 'refused';
  readonly reason: string;
  readonly progress: boolean;
  readonly progressKey: string;
}

export interface HarnessLivenessView {
  readonly state: 'live' | 'dead' | 'unknown';
  readonly reason: string;
  readonly event: string;
}

export interface HarnessCompletionView {
  readonly state: 'complete' | 'pending' | 'unknown';
  readonly reason: string;
  readonly event: string;
}

export interface HarnessResumeView {
  readonly state: 'eligible' | 'poisoned' | 'unknown';
  readonly reason: string;
  readonly event: string;
}

export interface HarnessEvidenceHolder {
  readonly owner: 'part-thirteen';
  readonly machine: string;
  readonly maxEvents: number;
  readonly maxCaptureBytes: number;
  admit(event: HarnessRuntimeEvent): HarnessEvidenceAdmission;
  liveness(handle: HarnessRuntimeHandle, now: number): HarnessLivenessView;
  completion(handle: HarnessRuntimeHandle): HarnessCompletionView;
  resume(handle: HarnessRuntimeHandle): HarnessResumeView;
  events(launch: string): readonly HarnessRuntimeEvent[];
}

export interface SessionHarnessAdapterInput {
  readonly id: string;
  readonly artifact: Hash;
  readonly platform: string;
  readonly conformance: string;
  readonly machine: string;
  readonly driver: NativeHarnessDriverPort;
  readonly handles: RuntimeHandleHolder;
  readonly context: AssemblyDecodeContext;
  readonly clock: () => number;
  readonly generation: () => string;
}

export interface SessionHarnessAdapterPackage {
  readonly owner: 'part-thirteen';
  readonly family: string;
  readonly adapter: HarnessAdapterPort;
}

export interface HarnessRuntimeEventDecoderPort {
  readonly owner: 'part-thirteen';
  readonly harness: string;
  decode(input: unknown, context: HarnessAdapterDecodeContext): Result<HarnessRuntimeEvent>;
}

export interface HarnessReconnectDecision {
  readonly disposition: 'reconnect' | 'refused' | 'unsupported';
  readonly reason: string;
  readonly handle: HarnessRuntimeHandle | null;
}

export interface HarnessReconnectInput {
  readonly launch: string;
  readonly machine: string;
  readonly incarnation: string;
  readonly fence: FenceToken;
  readonly liveness: HarnessLivenessView;
  readonly resume: HarnessResumeView;
}
