import type { ActionFloor, BoundaryContext, Decision, Hash, OwnedReference, Result, RunReference } from '../index.js';
import type { AppendReceipt, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import type { DispatchClaim, FenceToken, TransportAuthority, TransportHost } from '../transport/index.js';

declare const owned: unique symbol;
interface Owned { readonly [owned]: 'part-seven' }
export interface Capture { readonly reference: string; readonly hash: Hash }
interface Row { readonly schemaVersion: 1; readonly id: string; readonly request: string; readonly predecessor: string }
export interface JudgmentRequest extends Row, Owned {
  readonly type: 'JudgmentRequest'; readonly logicalKey: string; readonly inputDigest: string;
  readonly run: string; readonly step: string; readonly ordinal: number;
  readonly semanticMessage: string; readonly effectRequest: string;
  readonly point: string; readonly consumer: 'advisory'; readonly generation: string;
  readonly incarnation: string; readonly deadline: number;
  readonly question: Capture; readonly context: Capture; readonly submitted: Capture;
  readonly route: string; readonly evidence: readonly string[];
  readonly maxInputBytes: number; readonly maxOutputBytes: number; readonly maxCharge: number;
}
export interface JudgmentAttemptRecord extends Row, Owned {
  readonly type: 'JudgmentAttemptRecord'; readonly attempt: string;
  readonly phase: 'prepared' | 'dispatch-observed' | 'response-observed' | 'accounting-observed' | 'decode-observed';
  readonly operation?: string; readonly reservation?: string;
  readonly receipt?: Capture;
}
export interface JudgmentResolution extends Row, Owned {
  readonly type: 'JudgmentResolution'; readonly attempt: string;
  readonly disposition: 'decided' | 'refused'; readonly response: string; readonly accounting: string; readonly decoded: string;
}
export type JudgmentRecord = JudgmentRequest | JudgmentAttemptRecord | JudgmentResolution;
export interface JudgmentFact { readonly fact: FactEnvelope; readonly record: JudgmentRecord }
// Concrete custody belongs to ten. No delete, network fetch or release-pin capability.
export interface JudgmentCapturePort {
  readonly owner: 'part-ten';
  put(bytes: string, maxBytes: number): Result<Capture>;
  read(capture: Capture): Result<string>;
}
// Consumer requirements for ten's approved describe/prepare/exchange port.
// The slice supplies only a deterministic fake-provider realization.
export interface ModelDescription {
  readonly owner: 'part-ten'; readonly provider: string; readonly model: string; readonly route: string;
  readonly automaticRetries: 0; readonly maxInputBytes: number; readonly maxOutputBytes: number;
  readonly maxCharge: number; readonly measured: false; readonly basis: string;
}
export interface ProviderObservation {
  readonly state: 'complete' | 'rejected' | 'uncertain'; readonly bytes: string | null;
  readonly providerOperation: string | null;
  readonly usage: { readonly inputTokens: number | null; readonly outputTokens: number | null; readonly charge: number | null; readonly source: string };
  readonly retryBlocked: boolean;
}
export interface ModelExchange {
  readonly claim: DispatchClaim; readonly fence: FenceToken; readonly bytes: string;
  readonly deadline: number; readonly incarnation: string;
}
export interface ModelAdapterPort {
  readonly owner: 'part-ten';
  describe(): ModelDescription;
  prepare(input: unknown): Result<string>;
  exchange(input: ModelExchange): Promise<Result<ProviderObservation>>;
}
export interface JudgmentHost {
  readonly transport: TransportHost; readonly point: string; readonly floor: ActionFloor;
  readonly description: ModelDescription;
  // Ten refreshes P1's live evidence context from P2's verified fact statuses.
  // This is a disposable context fold, never a second accounting authority.
  refreshFacts(): Result<void>;
}
export interface JudgmentSpine {
  readonly store: FactStorePort;
  append(record: JudgmentRecord, attachments?: Readonly<Record<string, unknown>>): Result<AppendReceipt>;
}
export interface JudgmentPorts {
  readonly host: JudgmentHost; readonly authority: TransportAuthority;
  readonly spine: JudgmentSpine; readonly captures: JudgmentCapturePort;
  readonly model: ModelAdapterPort; readonly boundary: BoundaryContext;
}
export interface QuestionInput {
  readonly id: string; readonly run: RunReference; readonly step: string; readonly ordinal: number;
  readonly semanticMessage: string;
  readonly effectRequest: OwnedReference<'part-eight', 'EffectRequest'>;
  readonly question: string; readonly context: string; readonly evidence: readonly string[]; readonly deadline: number;
}
export interface RecordedAnswer {
  readonly resolution: OwnedReference<'part-seven', 'JudgmentResolution'>;
  readonly decision: Decision;
  // This is NOT five's conditional run acceptance or permission for a business effect.
}
export interface JudgmentDoorway {
  judge(input: QuestionInput, fence: FenceToken): Promise<Result<RecordedAnswer>>;
  resumeRecording(request: string): Result<OwnedReference<'part-seven', 'JudgmentResolution'>>;
  readAnswer(request: string, fence: FenceToken): Result<RecordedAnswer>;
  inspect(): Result<readonly JudgmentFact[]>;
}
export interface JudgmentAuthor { readonly context: FactContext; readonly privateKey: string }
