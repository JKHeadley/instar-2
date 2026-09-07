import type { ActionFloor, BoundaryContext, Decision, Hash, OwnedReference, Result, RunReference } from '../index.js';
import type { AppendReceipt, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import type { DispatchClaim, FenceToken, TransportAuthority, TransportHost } from '../transport/index.js';

declare const owned: unique symbol;
interface Owned { readonly [owned]: 'part-seven' }
export interface Capture { readonly reference: string; readonly hash: Hash }
declare const capacityOwned: unique symbol;
export interface CaptureCapacity { readonly [capacityOwned]: 'part-ten'; readonly id: string; readonly maxBytes: number }
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
  // Present exactly when the question was admitted for dispatch THROUGH EIGHT
  // (docs/11 step 6): the registered operation's addressing, from which the
  // effectRequest identity derives as request:hash([account, conversation,
  // semanticMessage]). Absent on the pre-adoption direct-model composition.
  readonly account?: string; readonly conversation?: string;
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
  // With a key, the durable capacity commitment is BOUND to that key and the
  // call is idempotent: a recovered process re-derives the SAME committed slot
  // (same budget) instead of demanding a second one. Never releases capacity.
  reserve(maxBytes: number, key?: string): Result<CaptureCapacity>;
  putReserved(capacity: CaptureCapacity, bytes: string): Result<Capture>;
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
  // Adapter-owned evidence of received-but-unusable output. This never grants
  // answer eligibility; independently valid usage survives capture limitations.
  readonly limitation?: { readonly kind: 'transport-threw' | 'invalid-provider-observation' | 'response-byte-limit'; readonly observedBytesAtLeast: number | null };
}
export interface ModelExchange {
  readonly claim: DispatchClaim; readonly fence: FenceToken; readonly bytes: string;
  readonly deadline: number; readonly incarnation: string;
  // Guarded executor handoff: called only after consuming six's actual claim,
  // before invoking the provider. Failure prevents invocation, retaining exposure.
  readonly recordDispatch: () => Result<void>;
}
export interface ModelAdapterPort {
  readonly owner: 'part-ten';
  describe(): ModelDescription;
  prepare(input: unknown): Result<string>;
  exchange(input: ModelExchange): Promise<Result<ProviderObservation>>;
}
// Consumer requirements for EIGHT's admitted-dispatch doorway (docs/11 step 6:
// "Dispatch through part eight's effect boundary to the model adapter against
// that reservation"). Seven prepares the bounded call and reserves via six with
// the exact shape eight's adopt requires; the realization binds eight's REAL
// EffectDoorway over the SAME transport authority (adopt -> dispatch -> the
// registered adapter). Eight owns settlement; nothing here settles or releases.
export interface DispatchMessage {
  readonly type: 'OutboundMessage'; readonly schemaVersion: 1; readonly id: string;
  readonly semanticMessage: string; readonly run: string; readonly speaker: string;
  readonly account: string; readonly conversation: string; readonly text: string;
  readonly purpose: 'ordinary-reply'; readonly sourceResult: string;
}
export interface AdoptedDispatch { readonly request: string; readonly digest: string }
export interface EffectDispatchPort {
  readonly owner: 'part-eight';
  describe(): { readonly definition: string; readonly account: string; readonly conversation: string;
    readonly maxCharge: number; readonly durability: 'replicated' | 'local-durable'; readonly replicas: number };
  // The persisted adopted request, refusing when eight holds none (recovery reads
  // this FIRST: a replacement process re-dispatches the persisted request, never re-adopts).
  adopted(request: string): Result<AdoptedDispatch>;
  adopt(input: { readonly definition: string; readonly message: DispatchMessage; readonly run: RunReference;
    readonly pending: string; readonly attempt: string; readonly verificationOwner: string;
    readonly obligation: string; readonly closure: readonly string[] }): Result<AdoptedDispatch>;
  // A COMMAND channel only. The port's return value is never evidence: seven
  // reads eight's durable terminal observation from the SHARED verified history
  // and re-reads its bytes through content-addressed capture custody, so a
  // conforming-but-fake or substituting port cannot mint provider evidence.
  // The composition must persist eight's observation captures through custody
  // seven's capture port can read — enforced fail-closed, not trusted.
  dispatch(adopted: AdoptedDispatch, fence: FenceToken): Result<{ readonly operation: string }>;
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
  // When bound, the model dispatch routes THROUGH EIGHT (docs/11 step 6) and the
  // operation becomes settleable through eight's evidence-checked path. Absent =
  // the pre-adoption direct-model composition, byte-identical to before.
  readonly effects?: EffectDispatchPort;
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
