// Part twenty-one (recall doorway, draft) — the minimal recall contract.
// Remembering (recall) and permission to reveal are separate: every recalled exchange
// carries its own visibility, and only `mayReveal` decides what reaches an audience.
import type { BoundaryContext, Result } from '../index.js';
import type { AppendReceipt, FactContext, FactStorePort } from '../facts/index.js';

export const recallExchangeKind = 'recall-exchange';
export type SpeakerRole = 'user' | 'agent' | 'system';
/** public: anyone; participants: only an audience wholly inside `audience`; private: never revealed. */
export type Visibility = 'public' | 'participants' | 'private';

/** Caller input for one captured message. `at` is the part-one clock value input. */
export interface ExchangeInput {
  readonly conversation: string;   // stable conversation key, e.g. telegram:<chat>:<topic>
  readonly session: string;        // the session/run that observed it
  readonly messageId: string;      // provider-minted id; (conversation, messageId) is the idempotency key
  readonly speakerId: string;
  readonly speakerName: string;
  readonly speakerRole: SpeakerRole;
  readonly text: string;
  readonly visibility: Visibility;
  readonly audience: readonly string[]; // principal ids allowed to see it (participants visibility)
}
/** A decoded, stored exchange. `at` is the signed envelope clock in unix ms. */
export interface RecalledExchange extends Omit<ExchangeInput, 'text'> {
  readonly factId: string; readonly machine: string; readonly at: number; readonly text: string;
  readonly redactions: number;
}
export interface CaptureReceipt {
  readonly factId: string; readonly duplicate: boolean; readonly redactions: number;
  readonly durability: AppendReceipt['durability'] | { readonly kind: 'already-recorded' };
}
/** Everything capture needs: the part-two store and the signing identity of the recorder. */
export interface RecallWriter {
  readonly context: FactContext; readonly store: FactStorePort; readonly machine: string;
  readonly privateKey: string;
  /** The verified recorder principal and its provenance, as JSON inputs for the envelope. */
  readonly principal: unknown; readonly provenance: unknown;
}

/** Semantic reranking is optional and replaceable. The production binding is the
 * judgment doorway; tests bind a deterministic stand-in. Returns candidate indexes,
 * best first; any index not returned keeps its lexical order after the returned ones. */
export interface RecallRerankPort {
  readonly id: string;
  /** Declared charge of one call in the spend port's unit. */
  readonly chargePerCall: number;
  rerank(query: string, candidates: readonly string[]): Result<readonly number[]> | Promise<Result<readonly number[]>>;
}
/** Reserve-before-call spend authority (production binding: part six's reservation). */
export interface RecallSpendPort { reserve(amount: number): boolean }

export interface RecallBounds {
  readonly maxScan: number;          // most-recent exchanges SCORED per query (the whole store is still read and sorted)
  readonly maxResults: number;       // exchanges returned
  readonly maxRerankCandidates: number;
  readonly maxChars: number;         // rendered grounding block bound
  readonly maxCharsPerExchange: number;
}
export const defaultRecallBounds: RecallBounds = Object.freeze({
  maxScan: 5000, maxResults: 8, maxRerankCandidates: 20, maxChars: 4000, maxCharsPerExchange: 600,
});
export interface RecallQuery {
  readonly text: string;
  /** Exchanges not to return (e.g. the message being answered), by capture identity. */
  readonly exclude?: readonly { readonly conversation: string; readonly messageId: string }[];
  readonly bounds?: Partial<RecallBounds>;
}
export type RecallStrategy = 'none' | 'lexical-strict' | 'lexical-loose' ;
export interface RecallHit { readonly exchange: RecalledExchange; readonly score: number }
export interface RecallManifest {
  readonly strategy: RecallStrategy;
  readonly rerank: 'not-configured' | 'used' | 'failed' | 'over-budget' | 'stopped' | 'not-needed';
  readonly stored: number; readonly scanned: number; readonly unreadable: number; readonly matched: number;
  readonly charge: number;
}
export interface RecallResult { readonly hits: readonly RecallHit[]; readonly manifest: RecallManifest }
export interface RecallReader {
  readonly context: BoundaryContext; readonly store: FactStorePort;
  readonly reranker?: RecallRerankPort; readonly spend?: RecallSpendPort;
  /** The stop floor: while true no model spend happens and grounding is refused, including
   * when the stop is asserted while recall is in flight (checked again before grounding returns). */
  readonly stopped: () => boolean;
}

/** Who the answer will be shown to. The agent itself is never part of the audience. */
export interface Audience { readonly conversation: string; readonly participants: readonly string[] }
export type RevealVerdict = Readonly<{ reveal: true } | { reveal: false; reason: 'private' | 'outside-audience' | 'no-audience' }>;

export interface GroundingRequest extends RecallQuery { readonly audience: Audience }
export interface GroundingEntry {
  readonly factId: string; readonly at: number; readonly conversation: string;
  readonly speakerName: string; readonly speakerRole: SpeakerRole; readonly text: string;
}
export interface Grounding {
  /** Rendered, bounded block for the model: quoted history, never instructions. Empty when nothing is revealable. */
  readonly text: string;
  readonly revealed: readonly GroundingEntry[];
  /** Recalled but not revealable to this audience: audit only, never rendered. Covers the hits the
   * render loop examined (it stops once `maxResults` are revealed), not every recalled hit. */
  readonly withheld: readonly { readonly factId: string; readonly reason: string }[];
  /** `truncated`: an entry was dropped for `maxChars` or an entry's text was cut to `maxCharsPerExchange`. */
  readonly manifest: RecallManifest & { readonly truncated: boolean };
}
