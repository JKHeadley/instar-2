/** What the commitment and beacon modules need from their host. The core holds no
 * ambient clock, timer, file or log; `tests/preview/commitment-host.ts` binds these to the
 * owner journal, and every durable write goes through it (Rule 116: no second store). */
export interface CommitmentClock { now(): number; iso(ms: number): string; parse(iso: string): number }
export interface CommitmentTimers {
  /** Bounded, cancellable, never holds the process open. */
  after(ms: number, run: () => void): { cancel(): void };
  every(ms: number, run: () => void): { cancel(): void };
}
export interface CommitmentStoreSnapshot<Row = unknown> {
  version: number; commitments: Row[]; lastModified: string;
  replicationSeq?: number; storeIncarnation?: string;
  blockerEpisodeDropBuckets?: Record<string, { request: number; clear: number }>;
}
export type CommitmentStoreSave = { state: 'committed' } | { state: 'failed'; errorClass: 'mkdir' | 'temp-write' | 'rename' | 'journal-refused' };
export interface CommitmentStorePort<Row = unknown> {
  load(): CommitmentStoreSnapshot<Row> | null;
  /** `changed` is every row altered since the last durable save. Failure leaves nothing applied. */
  save(store: CommitmentStoreSnapshot<Row>, changed: readonly Row[]): CommitmentStoreSave;
  readHighWater(): number | null;
  writeHighWater(seq: number): void;
}
export interface BehavioralRulesPort { exists(): boolean; write(content: string): void; remove(): void }
export interface DegradationEvent { feature: string; primary: string; fallback: string; reason: string; impact: string }
export interface CommitmentTrackerPorts {
  clock: CommitmentClock;
  timers: CommitmentTimers;
  store: CommitmentStorePort<import('./CommitmentTracker.js').Commitment>;
  behavioralRules: BehavioralRulesPort;
  expiryLedger: { append(row: Record<string, unknown>): void };
  /** A read only: whether a promised file now exists on the owner's host. */
  fileExists(path: string): boolean;
  log(...parts: unknown[]): void;
  degraded(event: DegradationEvent): void;
}
/** PromiseBeacon's durable bookkeeping; rows go in the owner journal in production. */
export interface BeaconStatePort {
  loadHot(id: string): unknown;
  saveHot(id: string, hot: unknown): void;
  loadAggregate(topicId: number): unknown;
  saveAggregate(topicId: number, state: unknown): void;
  aggregateTopics(): readonly number[];
}
export interface BeaconPorts {
  clock: CommitmentClock & { minutesOfDay(ms: number): number };
  timers: CommitmentTimers;
  state: BeaconStatePort;
  log(...parts: unknown[]): void;
  degraded(event: DegradationEvent): void;
}
/** A delivery attempt's typed result. An ambiguous outcome keeps its logical send id. */
export type DeliveryOutcome =
  | { delivered: true; outcome: 'delivered' }
  | { delivered: false; outcome: 'already-delivered-recently' }
  | { delivered: false; outcome: 'not-delivered'; reason: string; detail?: string;
    originHold?: { operationId: string | null; outcome: string; reason: string; logicalReplaySafe?: boolean };
    permanent?: boolean; standDown?: boolean;
    /** The doorway knows nothing reached the transport or the transport refused it. Absent means it may have. */
    definite?: boolean };
/** A send that the transport holds under its original operation. Not a failure, not a delivery. */
export class TelegramOriginHoldError extends Error {
  readonly terminalForCallerRetry = true;
  constructor(readonly reason: string, readonly operationId: string | null = null, readonly outcome: string = 'held') {
    super(`Telegram message held: ${reason}`);
    this.name = 'TelegramOriginHoldError';
  }
}
export interface ConfigWatchPort { get(path: string, fallback: unknown): unknown; set(path: string, value: unknown): void }
export interface ComponentHealth { status: 'healthy' | 'degraded' | 'unhealthy'; message: string; lastCheck: string }

type Listener = (...args: never[]) => void;
/** The small part of node's EventEmitter these modules use; `node:events` is host I/O surface. */
export class CommitmentEmitter {
  private readonly listeners = new Map<string, Listener[]>();
  on(event: string, listener: (...args: never[]) => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }
  emit(event: string, ...args: unknown[]): boolean {
    const found = this.listeners.get(event) ?? [];
    for (const listener of found) (listener as (...args: unknown[]) => void)(...args);
    return found.length > 0;
  }
}
