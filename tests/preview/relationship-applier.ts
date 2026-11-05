/**
 * JournalSyncApplier — the RECEIVE (and own-stream SERVE) side of coherence
 * journal replication (P1.3 of multi-machine coherence).
 *
 * Carried from 1.x `src/core/JournalSyncApplier.ts` (carryover row 40, One Memory). The 1.x spec:
 * docs/specs/COHERENCE-JOURNAL-SPEC.md §3.4 (replication trust model — ALL seven rules), §3.1
 * (stream/meta layout), §5 (trust model).
 *
 * This class is PURE and MESH-INDEPENDENT. It owns journal state only; the runner wires the
 * `refresh-group` command and the idle-cycle refresh on top of it. It NEVER imports the server,
 * the Telegram bridge or the lease — it is the engine those call.
 *
 * THE 2.0 SHAPE. 1.x kept peer replica files (`peers/<machine>.<kind>.jsonl` + a meta sidecar) and
 * fsynced them before acknowledging. 2.0 has one encrypted, append-only journal per conversation and
 * replicates it whole, so:
 *   - the SERVED stream is the private predecessor's `relationship-emit` frames (its own encrypted
 *     journal, replayed from sealed bytes: durably-flushed-only by construction), read either from
 *     the predecessor's journal on this machine or from its verified replica copy on the other one;
 *   - the REPLICA is the group root's own journal: one `group-carry-refresh` frame per applied batch,
 *     written through the journal's durable append (the receive-side §4.1 ack-after-durable-commit
 *     rule is the journal's fsync), re-validated record by record on every replay and refused whole
 *     (`group lineage refused`) when any record does not pass the store schema;
 *   - the meta sidecar's `lastHeldSeq` is the last refresh frame's `through`; status is in-memory.
 *
 * Trust model enforced (§3.4):
 *  1. FIRST-HOP SENDER BINDING — every entry's `machine` and its envelope `origin` must === the
 *     predecessor this receiver actually read (`carryOrigin(scope)`), NEVER a payload field. A
 *     forged entry is rejected + counted and stops the batch.
 *  2. SCHEMA-VALIDATED APPLY — per entry: parseable + size-cap, seq exactly lastHeldSeq+1, ts
 *     parses, kind known, data passes the relationship store schema through the generic envelope
 *     validator. ANY failure marks the stream `suspect` and STOPS the batch at the last valid line.
 *     `suspect` self-clears after K=20 consecutive valid in-order applies.
 *  3. LINEAGE FENCING — a predecessor whose genesis identity differs from the one the first refresh
 *     recorded is REFUSED (1.x quarantined the old replica and started fresh; 2.0's group root never
 *     adopts a second predecessor history under the same scope: Rule 95 fail direction). The initial
 *     carry's scope is already fixed; a different source root is `predecessor already fixed`.
 *  4. TRUNCATION SIGNALS — kept as code: a batch may carry `oldestRetainedSeq`; the 2.0 served stream
 *     is never truncated (emits survive compaction in the snapshot), so the gap path is dormant.
 *
 * The applier is tolerant + bounded everywhere and NEVER throws into its caller; degradation is
 * surfaced via counters and per-stream status.
 */

import { createHash } from 'node:crypto';
import type { GroupCarryScope, DisclosureVerdict } from './group-disclosure.js';
import type { JournalView, openPreviewJournal } from './journal.js';
import { carryOrigin, guardGroupCarry, type CarriedMemory } from './group-carry.js';
import {
  RELATIONSHIP_KIND_REGISTRATION, RELATIONSHIP_MAX_ENTRY_BYTES, RELATIONSHIP_RECORD_KIND, RELATIONSHIP_STORE_KNOWN_FIELDS,
  RELATIONSHIP_TOMBSTONE_KNOWN_FIELDS, RESERVED_ENVELOPE_FIELDS, compareHlc, originRecordFromData, validateReplicatedEnvelope,
  type EnvelopeValidationCounters, type HlcTimestamp, type OriginRecord, type ReplicatedOp, type StoreFieldSchema,
} from './relationship-store.js';

// ---- tunables (§3.4) -------------------------------------------------------

/** Per-entry size cap on the receive side (§3.4 rule 2). Mirrors the writer's cap (source of truth:
 *  relationship-store.ts RELATIONSHIP_MAX_ENTRY_BYTES). */
export const APPLIER_MAX_ENTRY_BYTES = RELATIONSHIP_MAX_ENTRY_BYTES;
/** Consecutive valid in-order applies that self-clear `suspect` (§3.4 rule 2). */
export const SUSPECT_CLEAR_THRESHOLD = 20;
/** Default serve-batch size cap (§3.4 rule 5 — journalSyncMaxBatchBytes): one refresh frame rides the
 *  same whole-snapshot ceiling as the initial carry (group-carry.ts CARRY_MAX_BYTES; a value, not an import,
 *  because the two modules import each other and this is read at module load). */
export const DEFAULT_MAX_BATCH_BYTES = 128 * 1024;

// ---- public types ----------------------------------------------------------

/** The replicated kinds this receiver applies (1.x JOURNAL_KINDS: the five lifecycle kinds plus the
 *  registered `*-record` kinds; 2.0 carries one). */
export const JOURNAL_KINDS: readonly string[] = Object.freeze([RELATIONSHIP_RECORD_KIND]);
export type JournalKind = typeof RELATIONSHIP_RECORD_KIND;

/** One served line of the predecessor's own stream (1.x CoherenceJournal JournalEntry). */
export interface JournalEntry { seq: number; ts: string; machine: string; kind: string; topic?: number; data: Record<string, unknown> }

/** One emitted relationship record as the private root's journal keeps it (`relationship-emit` frame body). */
export interface RelationshipEmit { seq: number; recordKey: string; op: ReplicatedOp; hlc: HlcTimestamp; data: Record<string, unknown> }

/** One applied batch as the group root's journal keeps it (`group-carry-refresh` frame body). `records` are the
 *  validated envelope `data` of emits `from+1 .. through`, in order; `lineage` is the predecessor's genesis identity. */
export interface CarriedRefresh { scope: GroupCarryScope; lineage: string; from: number; through: number; records: string[]; at: number; digest: string }

/** Per-stream replication status surfaced to the caller (§3.4 rule 4). `lineage-refused` is the 2.0 word for
 *  1.x `reset-flapping`: a predecessor that is no longer the one this root carried. */
export type StreamReplStatus = 'current' | 'behind' | 'gapped' | 'suspect' | 'lineage-refused';

/** One stream's apply bookkeeping (1.x: persisted in the peer meta sidecar; 2.0: `lastHeldSeq` and the
 *  incarnation are read from the refresh frames, the rest is per-instance). */
export interface PeerKindState {
  /** Highest contiguously-applied seq held locally for this peer+kind. */
  lastHeldSeq: number;
  status: StreamReplStatus;
  /** Consecutive valid in-order applies since the stream last went `suspect`. */
  consecutiveValid: number;
  /** Gap sentinels recorded by truncation fast-forwards (§3.4 rule 4). */
  gaps: GapSentinel[];
}

/** A recorded hole in a replica stream (rule 4) — meta bookkeeping, NOT a line. */
export interface GapSentinel {
  /** First seq known-missing (the old lastHeldSeq+1). */
  fromSeq: number;
  /** Last seq known-missing (oldestRetainedSeq-1). */
  toSeq: number;
  /** When this machine recorded the gap. */
  recordedAt: string;
}

/** The peer meta (§3.1) — incarnation top-level. */
export interface PeerMeta {
  incarnation: string;
  /** Per-kind apply bookkeeping. */
  kinds: Partial<Record<JournalKind, PeerKindState>>;
  /** Sticky once the predecessor's lineage was seen to differ (surfaced once). */
  lineageRefused: boolean;
}

/** A divergence signal: the predecessor's genesis identity is not the one this root carried (rule 3). */
export interface DivergenceSignal {
  machineId: string;
  kind: JournalKind;
  oldIncarnation: string;
  newIncarnation: string;
  at: string;
}

/** One stream's slice of an inbound batch. */
export interface ApplyBatchStream {
  kind: JournalKind;
  incarnation: string;
  entries: JournalEntry[];
  /** Optional truncation watermark (§3.4 rule 4). */
  oldestRetainedSeq?: number;
}

/** Result of an apply() call — never thrown, fully observable. */
export interface ApplyResult {
  /** Total entries durably appended across all streams in this call. */
  applied: number;
  /** Entries rejected by first-hop sender binding (rule 1). */
  forgedEntries: number;
  /** Entries dropped as duplicates (seq <= lastHeldSeq) — silent (rule 2). */
  duplicates: number;
  /** Entries failing schema/seq/size/ts validation (rule 2). */
  invalidEntries: number;
  /** Streams marked suspect in this call (rule 2). */
  suspectStreams: number;
  /** Streams refused for a changed predecessor lineage in this call (rule 3). */
  quarantined: number;
  /** Truncation gaps recorded in this call (rule 4). */
  gapsRecorded: number;
  /** Append batches the journal refused (never thrown). */
  guardSkips: number;
  /** Divergence signals emitted in this call (rule 3). */
  signals: DivergenceSignal[];
  /** Per-stream final status after this call. */
  statuses: Record<string, StreamReplStatus>;
}

/** Aggregate degradation counters (lifetime). */
export interface ApplierDegradation {
  applied: number;
  forgedEntries: number;
  duplicates: number;
  invalidEntries: number;
  suspectMarks: number;
  quarantines: number;
  gapsRecorded: number;
  guardSkips: number;
  appendErrors: number;
  signals: number;
}

/** The replicated-kind registry seam (1.x ReplicatedKindRegistry's receive half). */
export interface ReplicatedKindRegistry {
  getByKind(kind: string): { schema: StoreFieldSchema } | undefined;
  isReplicatedKind(kind: string): boolean;
}

/** The one registration of 2.0. */
export const relationshipReceiveRegistry: ReplicatedKindRegistry = Object.freeze({
  getByKind: (kind: string) => kind === RELATIONSHIP_RECORD_KIND ? { schema: RELATIONSHIP_KIND_REGISTRATION.schema } : undefined,
  isReplicatedKind: (kind: string) => kind === RELATIONSHIP_RECORD_KIND,
});

type Journal = ReturnType<typeof openPreviewJournal>;

export interface JournalSyncApplierConfig {
  /** The group root's journal: the one durable replica of the predecessor's relationship stream. */
  destination: Journal;
  /** The carry scope this root is fixed to; the replica is keyed by it, never by a payload field. */
  scope: GroupCarryScope;
  /** Optional clock override (tests). */
  now?: () => number;
  /** Optional logger; called once per failure class. */
  logger?: (msg: string) => void;
  /** Per-entry size cap override. Default APPLIER_MAX_ENTRY_BYTES. */
  maxEntryBytes?: number;
  /**
   * The replicated-kind registry (WS2 send-side receive half). Injected so the
   * applier can VALIDATE + APPLY a registered `*-record` kind a peer serves. The
   * registry is the SAME instance the journal writer reads (one source of truth).
   */
  replicatedRegistry?: ReplicatedKindRegistry;
  /**
   * Optional derived-index observer for replicated records. Called only after the
   * refresh frame has been durably appended, so the index tracks durable bytes,
   * never uncommitted inbound data.
   */
  onReplicatedRecordsCommitted?: (senderMachineId: string, kind: JournalKind, entries: JournalEntry[]) => void;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
/** Every field a stored record may carry: the store's own fields of either op branch plus the reserved envelope. */
const KNOWN_RECORD_FIELDS: ReadonlySet<string> = new Set([...RELATIONSHIP_STORE_KNOWN_FIELDS, ...RELATIONSHIP_TOMBSTONE_KNOWN_FIELDS, ...RESERVED_ENVELOPE_FIELDS]);
/** The validated form of an envelope: its store fields as the schema clamped them plus the envelope, nothing else. The
 *  1.x validator DROPS an unknown field (counted) rather than rejecting the record; 2.0 stores only this clean form, so a
 *  replayed line with any field outside it is a tamper, not a tolerated extra. Null when the envelope does not validate. */
export function cleanEnvelopeData(data: Record<string, unknown>, counters: EnvelopeValidationCounters = uncountedCounters): Record<string, unknown> | null {
  const result = validateReplicatedEnvelope(data, RELATIONSHIP_KIND_REGISTRATION.schema, counters);
  if (!result.ok) return null;
  const envelope = result.envelope;
  return { ...result.storeFields, recordKey: envelope.recordKey, hlc: envelope.hlc, op: envelope.op, origin: envelope.origin,
    ...(envelope.observed !== undefined ? { observed: envelope.observed } : {}) };
}
const onlyKnownFields = (data: Record<string, unknown>) => Object.keys(data).every(field => KNOWN_RECORD_FIELDS.has(field));
const hashBody = (value: unknown) => sha256(JSON.stringify(value));
const uncountedCounters: EnvelopeValidationCounters = { bumpSchemaReject() {}, bumpDroppedField() {}, bumpJailReject() {} };
const uncounted = uncountedCounters;

/** The predecessor's lineage identity: its genesis binding, never its path or cursor. A re-seeded root at the same
 *  path has a different identity and is refused as a changed predecessor. */
export function lineageOf(view: JournalView): string {
  const g = view.genesis;
  return sha256(JSON.stringify([g.bot, g.chat, g.operator, g.grant ?? null, g.configurationDigest ?? null, g.origin ?? 'production']));
}

export class JournalSyncApplier {
  private readonly destination: Journal;
  private readonly scope: GroupCarryScope;
  private readonly now: () => number;
  private readonly logger: ((msg: string) => void) | undefined;
  private readonly maxEntryBytes: number;
  /** The replicated-kind registry (WS2 send-side receive half). Settable because the
   *  applier may be constructed before the registry is populated. */
  private replicatedRegistry: ReplicatedKindRegistry | undefined;
  private replicatedCommitObserver: ((senderMachineId: string, kind: JournalKind, entries: JournalEntry[]) => void) | undefined;

  /** In-memory meta per predecessor origin (the persisted half is read from the refresh frames). */
  private metaCache = new Map<string, PeerMeta>();

  private degradation: ApplierDegradation = {
    applied: 0,
    forgedEntries: 0,
    duplicates: 0,
    invalidEntries: 0,
    suspectMarks: 0,
    quarantines: 0,
    gapsRecorded: 0,
    guardSkips: 0,
    appendErrors: 0,
    signals: 0,
  };
  private loggedClasses = new Set<string>();

  constructor(config: JournalSyncApplierConfig) {
    this.destination = config.destination;
    this.scope = config.scope;
    this.now = config.now ?? (() => Date.now());
    this.logger = config.logger;
    this.maxEntryBytes = config.maxEntryBytes ?? APPLIER_MAX_ENTRY_BYTES;
    this.replicatedRegistry = config.replicatedRegistry ?? relationshipReceiveRegistry;
    this.replicatedCommitObserver = config.onReplicatedRecordsCommitted;
  }

  /** The per-entry byte cap for a kind (the registered record cap for a replicated kind). */
  private maxEntryBytesForKind(kind: JournalKind): number {
    return this.replicatedRegistry?.isReplicatedKind(kind)
      ? RELATIONSHIP_MAX_ENTRY_BYTES
      : this.maxEntryBytes;
  }

  getDegradation(): Readonly<ApplierDegradation> {
    return { ...this.degradation };
  }

  /** Inject the replicated-kind registry (WS2 send-side). Idempotent. */
  setReplicatedKindRegistry(registry: ReplicatedKindRegistry | undefined): void {
    this.replicatedRegistry = registry;
  }

  /**
   * Attach/replace the derived-index observer. The refresh frames remain authoritative; this observer
   * is only an incremental cache update.
   */
  setReplicatedRecordCommitObserver(observer: ((senderMachineId: string, kind: JournalKind, entries: JournalEntry[]) => void) | undefined): void {
    this.replicatedCommitObserver = observer;
  }

  // ---- advert state (for delta requests) ---------------------------------

  /** The seq this root holds through for the carried predecessor: the last refresh's `through`, else the
   *  initial carry's `emitsThrough` (emits before the carry are superseded by the snapshot), else 0. */
  lastHeldSeq(): number {
    const refreshes = this.destination.view.groupCarryRefreshes;
    return refreshes.at(-1)?.through ?? this.destination.view.groupCarry?.emitsThrough ?? 0;
  }

  /**
   * What this machine holds per peer stream — `{ machineId → { kind →
   * { incarnation, lastSeq } } }` — so the caller can compare against a peer's
   * advert and request only the missing ranges (§3.4 rule 5).
   */
  getAdvertState(): Record<string, Record<string, { incarnation: string; lastSeq: number }>> {
    const out: Record<string, Record<string, { incarnation: string; lastSeq: number }>> = {};
    for (const machineId of this.discoverPeerMachines()) {
      const meta = this.loadMeta(machineId);
      const perKind: Record<string, { incarnation: string; lastSeq: number }> = {};
      for (const kind of JOURNAL_KINDS as JournalKind[]) {
        const ks = meta.kinds[kind];
        // Surface a stream only if we hold something for it (lastHeldSeq > 0)
        // OR it has bookkeeping (a gap/suspect). A bare zero is "nothing held".
        if (ks && (ks.lastHeldSeq > 0 || ks.status !== 'current' || ks.gaps.length > 0)) {
          perKind[kind] = { incarnation: meta.incarnation, lastSeq: ks.lastHeldSeq };
        }
      }
      if (Object.keys(perKind).length > 0) out[machineId] = perKind;
    }
    return out;
  }

  /** Per-stream replication status (§3.4 rule 4 — caller drives gap pacing). */
  getStreamStatus(): Record<string, StreamReplStatus> {
    const out: Record<string, StreamReplStatus> = {};
    for (const machineId of this.discoverPeerMachines()) {
      const meta = this.loadMeta(machineId);
      if (meta.lineageRefused) {
        // A refused lineage surfaces that status across all its kinds.
        for (const kind of JOURNAL_KINDS as JournalKind[]) {
          if (meta.kinds[kind]) out[`${machineId}.${kind}`] = 'lineage-refused';
        }
      }
      for (const kind of JOURNAL_KINDS as JournalKind[]) {
        const ks = meta.kinds[kind];
        if (!ks) continue;
        const key = `${machineId}.${kind}`;
        if (out[key]) continue; // lineage-refused already wins
        out[key] = ks.status;
      }
    }
    return out;
  }

  // ---- apply (the RECEIVE side, §3.4 rules 1-4) --------------------------

  /**
   * Apply an inbound batch from `senderMachineId` (the predecessor origin this receiver READ,
   * `carryOrigin(scope)`). Implements §3.4 rules 1-4. Never throws; the result is fully
   * observable. The refresh frame derives from `senderMachineId` and the fixed scope only —
   * NEVER from any payload field.
   */
  apply(senderMachineId: string, batch: ApplyBatchStream[]): ApplyResult {
    const result: ApplyResult = {
      applied: 0,
      forgedEntries: 0,
      duplicates: 0,
      invalidEntries: 0,
      suspectStreams: 0,
      quarantined: 0,
      gapsRecorded: 0,
      guardSkips: 0,
      signals: [],
      statuses: {},
    };
    try {
      if (!senderMachineId || typeof senderMachineId !== 'string') return result;
      if (senderMachineId !== carryOrigin(this.scope)) return result;
      const meta = this.loadMeta(senderMachineId);

      for (const stream of batch || []) {
        try {
          this.applyStream(senderMachineId, meta, stream, result);
        } catch (e) {
          // A single bad stream slice must never poison the rest of the batch.
          this.log('apply-stream', `[journal-sync] applyStream failed for ${stream?.kind}: ${(e as Error)?.message}`);
        }
      }

      // Final per-stream statuses for the caller.
      for (const kind of JOURNAL_KINDS as JournalKind[]) {
        const ks = meta.kinds[kind];
        if (ks) {
          result.statuses[`${senderMachineId}.${kind}`] = meta.lineageRefused ? 'lineage-refused' : ks.status;
        }
      }
    } catch (e) {
      this.log('apply', `[journal-sync] apply failed (swallowed): ${(e as Error)?.message}`);
    }
    return result;
  }

  private applyStream(
    senderMachineId: string,
    meta: PeerMeta,
    stream: ApplyBatchStream,
    result: ApplyResult,
  ): void {
    if (!stream || !JOURNAL_KINDS.includes(stream.kind)) {
      // Unknown / ignorable kind: nothing applied, no poisoning (forward-compat).
      return;
    }
    const kind = stream.kind;
    const incarnation = typeof stream.incarnation === 'string' ? stream.incarnation : '';

    // A stream is never evidence of its own predecessor identity (Rules 31, 95, 117).
    if (!meta.incarnation) {
      this.markRefused(meta, senderMachineId, kind, incarnation, result); return;
    }

    // §3.4 rule 3 — LINEAGE FENCING. A KNOWN predecessor arriving with a different genesis identity is
    // refused whole: no quarantine, no fresh start, nothing written (Rule 95 fail direction).
    if (incarnation !== meta.incarnation) {
      this.markRefused(meta, senderMachineId, kind, incarnation, result);
      return;
    }

    const ks = this.ensureKind(meta, kind);

    // §3.4 rule 4 — TRUNCATION SIGNAL. If our next-needed seq fell below what the peer still retains, record a gap
    // sentinel + mark gapped. 1.x then fast-forwarded lastHeldSeq past the hole; 2.0 does not: the group journal's
    // refresh frames are contiguous by replay rule, and the served stream is never truncated (emits survive compaction
    // in the snapshot), so a watermark above the held seq is a signal to surface, and nothing past the hole is applied.
    if (typeof stream.oldestRetainedSeq === 'number' && Number.isFinite(stream.oldestRetainedSeq)) {
      const nextNeeded = ks.lastHeldSeq + 1;
      if (nextNeeded < stream.oldestRetainedSeq) {
        ks.gaps.push({
          fromSeq: nextNeeded,
          toSeq: stream.oldestRetainedSeq - 1,
          recordedAt: new Date(this.now()).toISOString(),
        });
        // Bound the gap record (No Unbounded Loops) — keep the most recent few.
        if (ks.gaps.length > 16) ks.gaps.splice(0, ks.gaps.length - 16);
        ks.status = 'gapped';
        ks.consecutiveValid = 0;
        this.degradation.gapsRecorded++;
        result.gapsRecorded++;
        return;
      }
    }

    // §3.4 rules 1 + 2 — validate every entry IN ORDER, append durably, stop at
    // the first failure (suspect), skip duplicates silently.
    const toAppend: JournalEntry[] = [];
    let stopped = false;
    for (const entry of stream.entries || []) {
      const verdict = this.validateEntry(senderMachineId, kind, entry, ks.lastHeldSeq + toAppend.length);
      if (verdict === 'forged') {
        this.degradation.forgedEntries++;
        result.forgedEntries++;
        // Rule 1: a forged entry is rejected + counted. It is NOT a torn write
        // (it's a trust violation), so it does NOT mark the stream suspect; we
        // simply do not append it and stop the batch (cannot trust ordering past it).
        stopped = true;
        break;
      }
      if (verdict === 'duplicate') {
        this.degradation.duplicates++;
        result.duplicates++;
        continue; // silent drop, keep scanning (rule 2)
      }
      if (verdict === 'invalid') {
        this.degradation.invalidEntries++;
        result.invalidEntries++;
        // Rule 2: ANY failure marks suspect + STOPS the batch at the last valid.
        this.markSuspect(ks);
        this.degradation.suspectMarks++;
        result.suspectStreams++;
        stopped = true;
        break;
      }
      // valid + in order → queue for durable append.
      toAppend.push(entry);
    }

    if (toAppend.length === 0) {
      if (stopped && ks.status === 'current') ks.status = 'behind';
      return; // nothing to durably write (all dup/forged/invalid, or empty)
    }

    const appendedCount = this.durablyAppend(senderMachineId, meta, kind, ks.lastHeldSeq, toAppend, result);
    if (appendedCount > 0) {
      ks.lastHeldSeq += appendedCount;
      // §3.4 rule 2 — `suspect` self-clears after K consecutive valid in-order
      // applies. A clean apply that advances the stream out of `gapped` returns
      // it to `current`/`behind` honestly.
      if (ks.status === 'suspect') {
        ks.consecutiveValid += appendedCount;
        if (ks.consecutiveValid >= SUSPECT_CLEAR_THRESHOLD) {
          ks.status = 'current';
          ks.consecutiveValid = 0;
        }
      } else if (ks.status === 'gapped') {
        // A clean apply after a gap returns the stream to current (the hole is
        // recorded in meta; the read API reports it honestly via the sentinel).
        ks.status = 'current';
        ks.consecutiveValid = 0;
      } else {
        ks.consecutiveValid += appendedCount;
        ks.status = 'current';
      }
    }

    // If the batch stopped short (invalid/forged) the stream is "behind" the
    // peer's advert from the caller's POV — but suspect status wins.
    if (stopped && ks.status === 'current') {
      ks.status = 'behind';
    }
  }

  /**
   * Per-entry verdict (§3.4 rules 1 + 2). `expectedSeq` is lastHeldSeq + count
   * already queued this batch, so seq must be exactly contiguous.
   */
  private validateEntry(
    senderMachineId: string,
    kind: JournalKind,
    entry: JournalEntry,
    lastHeldSeq: number,
  ): 'valid' | 'forged' | 'duplicate' | 'invalid' {
    if (!entry || typeof entry !== 'object') return 'invalid';

    // Rule 1: FIRST-HOP SENDER BINDING. entry.machine must === the sender, and so must the
    // envelope's own origin: a record claiming another predecessor is forged, not malformed.
    if (typeof entry.machine !== 'string' || entry.machine !== senderMachineId) {
      return 'forged';
    }
    if (entry.data && typeof entry.data === 'object' && (entry.data as Record<string, unknown>).origin !== senderMachineId) {
      return 'forged';
    }

    // Size cap (parseable ≤ cap). The line we'd write is the serialized entry.
    let line: string;
    try {
      line = JSON.stringify(entry);
    } catch {
      return 'invalid';
    }
    if (Buffer.byteLength(line, 'utf-8') > this.maxEntryBytesForKind(kind)) return 'invalid';

    // kind binding — the entry must belong to the stream slice it arrived in.
    if (entry.kind !== kind) return 'invalid';

    // seq must be a finite integer; <= lastHeld is a duplicate (silent drop),
    // != lastHeld+1 (a forward gap) is invalid (stop the batch).
    const seq = entry.seq;
    if (typeof seq !== 'number' || !Number.isFinite(seq) || Math.floor(seq) !== seq) return 'invalid';
    if (seq <= lastHeldSeq) return 'duplicate';
    if (seq !== lastHeldSeq + 1) return 'invalid';

    // ts must parse.
    if (typeof entry.ts !== 'string' || Number.isNaN(Date.parse(entry.ts))) return 'invalid';

    // topic, when present, must be a finite number.
    if (entry.topic !== undefined && (typeof entry.topic !== 'number' || !Number.isFinite(entry.topic))) {
      return 'invalid';
    }

    // data must pass the kind's typed schema.
    if (!this.validateData(kind, entry.data)) return 'invalid';

    return 'valid';
  }

  /**
   * §3.2 typed schema validation. A registered replicated `*-record` kind validates through the
   * GENERIC envelope validator + its store schema — the SAME strict discipline the writer applied
   * (reject free text / unknown fields, jail path-shaped fields, validate hlc + observed). The
   * counters are a no-op here — the applier surfaces receive degradation via its own
   * ApplierDegradation counters / suspect status, not these per-field bumps.
   */
  private validateData(kind: JournalKind, data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const raw = data as Record<string, unknown>;
    const reg = this.replicatedRegistry?.getByKind(kind);
    if (reg) {
      return validateReplicatedEnvelope(raw, reg.schema, uncounted).ok;
    }
    return false;
  }

  // ---- lineage fencing (§3.4 rule 3) -------------------------------------

  private markRefused(meta: PeerMeta, senderMachineId: string, kind: JournalKind, newIncarnation: string, result: ApplyResult): void {
    const oldIncarnation = meta.incarnation;
    this.degradation.quarantines++;
    result.quarantined++;
    this.ensureKind(meta, kind);
    if (!meta.lineageRefused) {
      meta.lineageRefused = true;
      const signal: DivergenceSignal = {
        machineId: senderMachineId,
        kind,
        oldIncarnation,
        newIncarnation,
        at: new Date(this.now()).toISOString(),
      };
      result.signals.push(signal);
      this.degradation.signals++;
      this.log(
        `diverge-${senderMachineId}`,
        `[journal-sync] divergence: predecessor ${senderMachineId} lineage ${newIncarnation.slice(0, 8)} differs from carried ${oldIncarnation.slice(0, 8)}; refused`,
      );
    }
  }

  // ---- durable append (§4.1 — ack-after-fsync) ---------------------------

  /**
   * Append the validated entries as ONE `group-carry-refresh` frame through the destination journal's
   * durable append (its fsync is the ack-after-durable boundary: nothing past the append treats the
   * entries as committed until the journal returned). Returns the number of entries durably committed
   * (0 if the journal refused). Never throws.
   */
  private durablyAppend(senderMachineId: string, meta: PeerMeta, kind: JournalKind, from: number, entries: JournalEntry[], result: ApplyResult): number {
    const at = this.now();
    // Only the validated form is written (validateEntry already accepted every entry): an unknown field a sender
    // smuggled is dropped here, exactly as the 1.x validator dropped it, and can never be served from this journal.
    const body = { scope: this.scope, lineage: meta.incarnation, from, through: from + entries.length,
      records: entries.map(entry => JSON.stringify(cleanEnvelopeData(entry.data))), at };
    const refresh: CarriedRefresh = { ...body, digest: hashBody(body) };
    let committed = 0;
    try {
      if (this.destination.readOnly) throw Error('reader cannot append');
      this.destination.append({ kind: 'group-carry-refresh', refresh, at });
      committed = entries.length;
    } catch (e) {
      // The journal refused the frame (posture, replay validation, stop): nothing landed — the caller advances nothing.
      this.degradation.guardSkips++;
      result.guardSkips++;
      this.degradation.appendErrors++;
      this.log('append', `[journal-sync] refresh append refused for ${kind}: ${(e as Error)?.message}`);
      committed = 0;
    }

    if (committed > 0) {
      this.degradation.applied += committed;
      result.applied += committed;
      this.notifyReplicatedRecordsCommitted(senderMachineId, kind, entries);
    }
    return committed;
  }

  private notifyReplicatedRecordsCommitted(senderMachineId: string, kind: JournalKind, entries: JournalEntry[]): void {
    if (!this.replicatedRegistry?.isReplicatedKind(kind) || !this.replicatedCommitObserver) return;
    if (entries.length === 0) return;
    try {
      this.replicatedCommitObserver(senderMachineId, kind, entries);
    } catch (e) { /* derived-index observer failure must never endanger replica durability or ack accounting; parity/rebuild falls back to the journal. */
      this.log('replicated-commit-observer', `[journal-sync] replicated commit observer failed for ${kind}: ${(e as Error)?.message}`);
    }
  }

  // ---- SERVE side (§3.4 rule 5/7 — own stream only, durably-flushed only) -

  /**
   * Build a delta batch from the PREDECESSOR's OWN stream for a receiver that is behind (§3.4 rule 5).
   * Reads the replayed journal view (sealed bytes, never a queue) so only durably written entries are
   * served. First-hop only: this serves exactly one own stream of one kind.
   */
  buildServeBatch(
    source: JournalView,
    fromSeq: number,
    ownMachineId: string,
    maxBatchBytes = DEFAULT_MAX_BATCH_BYTES,
  ): ApplyBatchStream {
    return serveRelationshipEmits(source, fromSeq, ownMachineId, maxBatchBytes);
  }

  // ---- meta (load / cache) -----------------------------------------------

  private ensureKind(meta: PeerMeta, kind: JournalKind): PeerKindState {
    let ks = meta.kinds[kind];
    if (!ks) {
      ks = { lastHeldSeq: this.lastHeldSeq(), status: 'current', consecutiveValid: 0, gaps: [] };
      meta.kinds[kind] = ks;
    }
    return ks;
  }

  private markSuspect(ks: PeerKindState): void {
    ks.status = 'suspect';
    ks.consecutiveValid = 0;
  }

  private loadMeta(machineId: string): PeerMeta {
    const cached = this.metaCache.get(machineId);
    if (cached) return cached;
    // Bind to the initial carry; older carries can reuse an already retained refresh identity.
    const refreshes = this.destination.view.groupCarryRefreshes;
    const meta: PeerMeta = { incarnation: this.destination.view.groupCarry?.lineage ?? refreshes[0]?.lineage ?? '', kinds: {}, lineageRefused: false };
    if (refreshes.length) this.ensureKind(meta, RELATIONSHIP_RECORD_KIND);
    this.metaCache.set(machineId, meta);
    return meta;
  }

  // ---- peer discovery ----------------------------------------------------

  /** The one predecessor this root carries, once anything of it is held. */
  private discoverPeerMachines(): string[] {
    const origin = carryOrigin(this.scope);
    return this.metaCache.has(origin) || this.destination.view.groupCarryRefreshes.length ? [origin] : [];
  }

  private log(cls: string, msg: string): void {
    if (this.loggedClasses.has(cls)) return;
    this.loggedClasses.add(cls);
    this.logger?.(msg);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 2.0: serve, replay validation and the top-level refresh (carryover row 40)
// ───────────────────────────────────────────────────────────────────────────

/** The predecessor's own stream as served lines: emits with seq > fromSeq, ascending, byte-capped mid-batch
 *  (at least one entry is served when any exists, so an over-cap line never stalls the stream forever). */
export function serveRelationshipEmits(source: JournalView, fromSeq: number, ownMachineId: string, maxBatchBytes = DEFAULT_MAX_BATCH_BYTES): ApplyBatchStream {
  const out: ApplyBatchStream = { kind: RELATIONSHIP_RECORD_KIND, incarnation: lineageOf(source), entries: [] };
  const collected = source.relationshipEmits.filter(emit => emit.seq > fromSeq).sort((a, b) => a.seq - b.seq);
  let bytes = 0;
  for (const emit of collected) {
    const entry: JournalEntry = { seq: emit.seq, ts: new Date(emit.hlc.physical).toISOString(), machine: ownMachineId, kind: RELATIONSHIP_RECORD_KIND, data: emit.data };
    const lineBytes = Buffer.byteLength(JSON.stringify(entry), 'utf-8') + 1; // +newline
    if (out.entries.length > 0 && bytes + lineBytes > maxBatchBytes) break;
    out.entries.push(entry);
    bytes += lineBytes;
  }
  return out;
}

/** A `relationship-emit` frame as the writer and every replay admit it: contiguous seq, a validated envelope whose
 *  op, key and clock the frame restates exactly, and a clock strictly after the previous emit (one writer, one order). */
export function validRelationshipEmit(emit: RelationshipEmit, previous: RelationshipEmit | undefined, expectedSeq: number): boolean {
  if (!emit || typeof emit !== 'object' || emit.seq !== expectedSeq || typeof emit.recordKey !== 'string'
    || (emit.op !== 'put' && emit.op !== 'delete') || !emit.data || typeof emit.data !== 'object') return false;
  if (Buffer.byteLength(JSON.stringify(emit.data)) > RELATIONSHIP_MAX_ENTRY_BYTES || !onlyKnownFields(emit.data)) return false;
  const record = originRecordFromData(emit.data, uncounted);
  if (!record || record.envelope.op !== emit.op || record.envelope.recordKey !== emit.recordKey
    || JSON.stringify(record.envelope.hlc) !== JSON.stringify(emit.hlc)) return false;
  return previous === undefined || compareHlc(emit.hlc, previous.hlc) > 0;
}

/** Every record of a refresh frame, validated through the store schema and bound to the predecessor origin. */
export function refreshedRecords(refresh: CarriedRefresh): OriginRecord[] | null {
  const origin = carryOrigin(refresh.scope), out: OriginRecord[] = [];
  for (const text of refresh.records) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return null; }
    const data = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    const record = data && onlyKnownFields(data) ? originRecordFromData(data, uncounted) : null;
    if (!record || record.origin !== origin) return null;
    out.push(record);
  }
  return out;
}

/** A `group-carry-refresh` frame as every replay admits it: the fixed scope, one lineage, contiguous `from`/`through`,
 *  exact bytes under their digest, and every record a validated envelope from this predecessor (else the lineage is refused). */
export function validCarriedRefresh(refresh: CarriedRefresh, carry: CarriedMemory, previous: readonly CarriedRefresh[]): boolean {
  if (!refresh || typeof refresh !== 'object' || !Array.isArray(refresh.records) || refresh.records.length === 0) return false;
  const { digest, ...body } = refresh;
  if (digest !== hashBody(body) || Buffer.byteLength(JSON.stringify(refresh)) > DEFAULT_MAX_BATCH_BYTES + 4096) return false;
  if (JSON.stringify(refresh.scope) !== JSON.stringify(carry.scope) || !/^[a-f0-9]{64}$/u.test(refresh.lineage)) return false;
  const last = previous.at(-1);
  if ((carry.lineage !== undefined && carry.lineage !== refresh.lineage) || (last && last.lineage !== refresh.lineage)) return false;
  const from = last?.through ?? carry.emitsThrough ?? 0;
  if (refresh.from !== from || refresh.through !== from + refresh.records.length || !Number.isSafeInteger(refresh.at) || refresh.at <= 0) return false;
  return refreshedRecords(refresh) !== null;
}

export interface RefreshOutcome { result: ApplyResult; from: number; through: number; remaining: number; lineage: string }

/**
 * Continuous authorized refresh beyond the initial carry: apply the predecessor's relationship emits the group root
 * does not hold yet, under exactly the checks the carry itself requires (resolved grant for this scope, verified
 * operator-only audience, writer posture, stop, scope identity), onto a predecessor already fixed by the carry.
 * Never writes to the predecessor. A changed predecessor (another source root, or the same root re-seeded) and an
 * unauthorized one are refused before any read of its records.
 */
export function refreshGroupCarry(destination: Journal, source: Pick<Journal, 'view' | 'readOnly'>, scope: GroupCarryScope,
  permission: DisclosureVerdict, audienceVerified: boolean, now: number, stopped: () => boolean,
  maxBatchBytes = DEFAULT_MAX_BATCH_BYTES, logger?: (msg: string) => void): RefreshOutcome {
  guardGroupCarry(destination, source, scope, permission, audienceVerified, now, stopped);
  const previous = destination.view.groupCarry;
  if (!previous) throw Error('group carry: no predecessor carried');
  if (JSON.stringify(previous.scope) !== JSON.stringify(scope)) throw Error('group carry: predecessor already fixed');
  if (source.view.genesis.forum === true || source.view.genesis.operator !== scope.operator || source.view.genesis.chat !== scope.operator
    || source.view.genesis.bot !== scope.bot || source.view.groupCarry !== undefined || source.view.channelItems.size)
    throw Error('group carry: source is not this operator private journal');
  const lineage = lineageOf(source.view), held = previous.lineage ?? destination.view.groupCarryRefreshes[0]?.lineage;
  if (held === undefined) throw Error('group carry: predecessor lineage unavailable in retained carry evidence');
  if (held !== undefined && held !== lineage) throw Error('group carry: predecessor lineage changed');
  const applier = new JournalSyncApplier({ destination, scope, now: () => now, ...(logger ? { logger } : {}) });
  const from = applier.lastHeldSeq();
  const origin = carryOrigin(scope);
  const result = applier.apply(origin, [serveRelationshipEmits(source.view, from, origin, maxBatchBytes)]);
  const through = applier.lastHeldSeq();
  return { result, from, through, remaining: Math.max(0, source.view.relationshipEmits.length - through), lineage };
}
