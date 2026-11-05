/**
 * ReplicatedRecordEmitter — the GENERIC journal-backed SEND emitter (WS2 send-side).
 *
 * Carried from 1.x `src/core/ReplicatedRecordEmitter.ts` (carryover row 40, One Memory). The 1.x
 * spec: docs/specs/WS2-SEND-SIDE-EMISSION-SPEC.md §4; the substrate it rides is
 * docs/specs/multi-machine-replicated-store-foundation.md §4 (the envelope + flag-gated emission)
 * and §7.2 (the `observed` last-writer-witness).
 *
 * THE GAP THIS CLOSES (1.x): every memory manager already calls an internal
 * `emitter.emitPut(record)` / `emitter.emitDelete(...)` hook on each write, behind a
 * `*ReplicationEmitter | null` seam — but server.ts never constructed the concrete emitter those
 * hooks call, so the hooks fired into a no-op and nothing reached the journal own-streams. This
 * class IS that concrete emitter.
 *
 * THE 2.0 SHAPE: the one store is `relationships`; the "journal own-stream" is the private
 * conversation's own encrypted journal (`relationship-emit` frames, one writer per lineage, Rule 31);
 * the per-store `multiMachine.stateSync.<store>.enabled` flag — a configuration boolean — is replaced
 * by the sealed group disclosure grant that names this root as the source of a carry: emission is
 * dark unless an operator-granted, unexpired, unrevoked disclosure exists for this root (no caller
 * boolean authority). The HLC clock is read from the journal's own emit history, so a restart never
 * ticks backwards. The `observed` witness is the newest HLC this root has already emitted for the key
 * (its own prior; peer records never flow back into a private root in 2.0, so the witness is sound by
 * construction and a receiver that holds a newer version flags, never clobbers — §7.2 err-toward-flag).
 *
 * SAFETY: NEVER throws into the caller (the hooks are best-effort). A refused grant, an unregistered
 * store, a degenerate (null) recordKey, a builder that returns null or throws (e.g. a record over its
 * per-entry byte cap) — every one is a counted no-op, never an exception that would break the local
 * write the agent is performing. Emission is SINGLE-ORIGIN by construction: it stamps `origin = this
 * root's carry origin` and the journal writes only this root's own stream (anti-forgery holds end-to-end:
 * the receiver binds the origin to the predecessor it read, never to a payload field).
 */

import type { DisclosureVerdict } from './group-disclosure.js';
import type { JournalView, openPreviewJournal } from './journal.js';
import { cleanEnvelopeData, type RelationshipEmit } from './relationship-applier.js';
import { journalRelationships } from './relationship-journal.js';
import {
  RELATIONSHIP_KIND_REGISTRATION, RELATIONSHIP_MAX_ENTRY_BYTES, RELATIONSHIP_RECORD_KIND, RELATIONSHIP_STORE_KEY,
  buildRelationshipRecordData, buildRelationshipTombstoneFromKey, compareHlc, deriveRelationshipRecordKey, originRecordFromData,
  type EnvelopeValidationCounters, type HlcTimestamp,
} from './relationship-store.js';

/** What the journal did with an emitted record (1.x `CoherenceJournal.emitReplicatedRecord`'s outcome). */
export type JournalEmitOutcome = 'accepted' | 'rejected:schema' | 'rejected:oversize' | 'rejected:kind' | 'rejected:refused';

/** The minimal journal seam the emitter needs (so it is unit-testable with a fake). */
export interface ReplicatedRecordEmitterJournal {
  /** Append a built replicated-record envelope `data` for `kind` (no-op when the
   *  kind is not a registered replicated kind; never throws). Returns what the journal
   *  did with it; a seam that returns nothing (a test fake predating the outcome)
   *  yields the `unconfirmed` emit outcome. */
  emitReplicatedRecord(kind: string, data: Record<string, unknown>): JournalEmitOutcome | void;
}

/** The minimal HLC seam (only `tick()` is needed on the author side). */
export interface ReplicatedRecordEmitterClock {
  /** Local-event advance — strictly greater than every prior tick/receive (§3.2.1). */
  tick(): HlcTimestamp;
}

/** The replicated-kind registry seam: resolves a store to the journal kind it rides (1.x
 *  `ReplicatedKindRegistry.getByStore`). 2.0 has one registered store. */
export interface ReplicatedKindRegistry {
  getByStore(store: string): { kind: string } | undefined;
}

/** A builder closure: produce the disclosure-minimized envelope `data` for this write
 *  given the freshly-ticked `hlc`, this machine's `origin`, and the `observed` witness
 *  (absent ⇒ no prior witness). Returns null to SKIP (a degenerate record with no
 *  stable identity surface). May THROW on an over-cap record — the emitter catches it. */
export type BuildRecordData = (
  hlc: HlcTimestamp,
  origin: string,
  observed: HlcTimestamp | undefined,
) => Record<string, unknown> | null;

/** The DI'd seams (asserted real, never null/no-op, by the wiring-integrity test). */
export interface ReplicatedRecordEmitterSeams {
  /** The journal append sink. */
  journal: ReplicatedRecordEmitterJournal;
  /** The author-side HLC clock (persisted in the journal; one per lineage). */
  clock: ReplicatedRecordEmitterClock;
  /** The replicated-kind registry — resolves store → journal kind; the emitter only
   *  emits a registered store. */
  registry: ReplicatedKindRegistry;
  /** This root's origin id (stamped on every emitted record — single-origin). */
  origin: string;
  /**
   * The dark-by-default gate (1.x: the per-store stateSync flag). In 2.0 it is the resolved group
   * disclosure for this root as a carry SOURCE: a sealed, unexpired, unrevoked operator grant. A
   * getter so a live revocation is honored on the next emit without reconstructing the emitter.
   */
  permission: () => DisclosureVerdict;
  /**
   * The last-writer-witness source (§7.2): the MAX HLC over every origin record this
   * root CURRENTLY holds for (store, recordKey). Sound by construction: it can only witness
   * a version provably in the journal, so a version it never held is simply absent ⇒ the
   * receiver's merge flags concurrent (err-toward-flag), never a silent clobber. Returns
   * undefined when none is held (the first write of a key) ⇒ `observed` omitted. Best-effort;
   * throwing is caught.
   */
  loadWitness: (store: string, recordKey: string) => HlcTimestamp | undefined;
  /** Optional structured logger (default no-op). */
  log?: (event: string, detail: Record<string, unknown>) => void;
}

/** What one `emit` call did. `emitted` ⇔ the journal reported `accepted` (enqueued). */
export type EmitOutcome =
  | 'emitted'
  /** The journal seam returned nothing (a test fake predating outcomes): counted as
   *  emitted in the legacy stats, but never treated as confirmed acceptance. */
  | 'unconfirmed'
  | 'disabled'
  | 'skipped'
  | `dropped:${Exclude<JournalEmitOutcome, 'accepted'>}`
  | 'error';

export interface EmitResult {
  outcome: EmitOutcome;
  /** The HLC this emit ticked, present whenever the tick happened. */
  hlc?: HlcTimestamp;
  /** For `disabled`: the grant resolver's own reason, so a dark emitter is never silent about why. */
  reason?: string;
}

export interface EmitOptions {
  /**
   * When present, REPLACES the witness read: the emit carries exactly this `observed`
   * (`null` ⇒ no witness, and no witness read at all). Used for a write discovered AFTER
   * the fact (the replicated-store reconciler): `observed` claims what the author had
   * seen when WRITING, and an out-of-process writer never saw peer records (they live
   * only in the journal replica streams), so the emit-time witness could make a stale
   * local write look sequential-after a newer peer version and silently win. With no
   * witness every peer version is concurrent ⇒ flagged (or, when byte-identical,
   * collapsed by the union), never silently superseded (§7.2 err-toward-flag).
   */
  observed?: HlcTimestamp | null;
}

/** One accepted own emit, reported to every registered observer. */
export interface EmittedRecordEvent {
  store: string;
  recordKey: string;
  op: 'put' | 'delete';
  hlc: HlcTimestamp;
  /** The exact built envelope `data` that was appended. */
  data: Record<string, unknown>;
}

/** Lifetime counters for observability (mirrors the journal's degradation style). */
export interface ReplicatedRecordEmitterStats {
  /** Records appended to the journal. */
  emitted: number;
  /** No-ops because the store was disabled (dark): no resolved grant names this root as a source. */
  storeDisabled: number;
  /** No-ops because the recordKey was null/degenerate or the builder returned null. */
  skipped: number;
  /** Builder/journal throws caught (never propagated to the manager). */
  errors: number;
  /** The journal refused the record (rate cap, lock-out, schema, oversize, dedupe). */
  dropped: number;
  /** Emit observers that threw (caught; never affects the emit). */
  observerErrors: number;
}

export class ReplicatedRecordEmitter {
  private readonly seams: ReplicatedRecordEmitterSeams;
  private readonly stats: ReplicatedRecordEmitterStats = {
    emitted: 0,
    storeDisabled: 0,
    skipped: 0,
    errors: 0,
    dropped: 0,
    observerErrors: 0,
  };
  private readonly observers: Array<(ev: EmittedRecordEvent) => void> = [];

  constructor(seams: ReplicatedRecordEmitterSeams) {
    // Wiring-integrity preconditions: the seams MUST be real, not null/no-op.
    if (!seams) throw new Error('ReplicatedRecordEmitter: seams are required');
    if (!seams.journal || typeof seams.journal.emitReplicatedRecord !== 'function') {
      throw new Error('ReplicatedRecordEmitter: journal.emitReplicatedRecord seam must be a function (not a no-op)');
    }
    if (!seams.clock || typeof seams.clock.tick !== 'function') {
      throw new Error('ReplicatedRecordEmitter: clock.tick seam must be a function');
    }
    if (!seams.registry) throw new Error('ReplicatedRecordEmitter: registry seam is required (not null)');
    if (typeof seams.origin !== 'string' || seams.origin.length === 0) {
      throw new Error('ReplicatedRecordEmitter: origin must be a non-empty string');
    }
    if (typeof seams.permission !== 'function') throw new Error('ReplicatedRecordEmitter: permission seam must be a function');
    if (typeof seams.loadWitness !== 'function') throw new Error('ReplicatedRecordEmitter: loadWitness seam must be a function (not a no-op)');
    this.seams = seams;
  }

  /** The HLC clock this emitter ticks (the reconciler fences against the SAME instance). */
  get clock(): ReplicatedRecordEmitterClock {
    return this.seams.clock;
  }

  /**
   * Register an observer told about EVERY accepted own emit (in-process hook or
   * reconciler), synchronously, after the journal accepted it. Observer exceptions are
   * caught and counted. Returns an unsubscribe function.
   */
  addEmitObserver(fn: (ev: EmittedRecordEvent) => void): () => void {
    this.observers.push(fn);
    return () => {
      const i = this.observers.indexOf(fn);
      if (i >= 0) this.observers.splice(i, 1);
    };
  }

  /** Read-only stats (for observability + the wiring-integrity assertions). */
  getStats(): Readonly<ReplicatedRecordEmitterStats> {
    return { ...this.stats };
  }

  /**
   * Emit one replicated record for (store, recordKey). The single generic path for a
   * put OR a delete — the only difference is the `build` closure (a put builder vs a
   * tombstone builder). Never throws into the caller.
   *
   * Order (§4): dark gate → degenerate guard → witness → tick → build → append.
   */
  emit(store: string, recordKey: string | null | undefined, build: BuildRecordData, opts?: EmitOptions): EmitResult {
    let hlc: HlcTimestamp | undefined;
    try {
      // 1. Dark gate (the default). No resolved disclosure grant ⇒ a strict no-op, with the grant's own reason.
      const permission = this.seams.permission();
      if (permission.kind !== 'resolved') {
        this.stats.storeDisabled++;
        return { outcome: 'disabled', reason: permission.reason };
      }
      // 2. Only a registered store has a journal kind to ride.
      const reg = this.seams.registry.getByStore(store);
      if (!reg) {
        this.stats.skipped++;
        return { outcome: 'skipped' };
      }
      // 3. Degenerate guard — a null/empty recordKey has no stable identity surface.
      if (typeof recordKey !== 'string' || recordKey.length === 0) {
        this.stats.skipped++;
        return { outcome: 'skipped' };
      }
      // 4. Witness BEFORE the tick — the HLC this machine had already merged for the
      //    key (own prior + applied peers). Best-effort; a witness read fault degrades
      //    to "no witness" (flag-on-conflict, the safe direction), never a throw.
      //    An explicit `opts.observed` replaces the read (see EmitOptions).
      let observed: HlcTimestamp | undefined;
      if (opts && 'observed' in opts) {
        observed = opts.observed ?? undefined;
      } else {
        try {
          observed = this.seams.loadWitness(store, recordKey);
        } catch (e) { /* a witness read fault degrades to no-witness ⇒ flag-on-conflict (the safe merge direction, §7.2); never blocks the emit. */
          observed = undefined;
          this.log('witness-read-failed', { store, error: (e as Error)?.message });
        }
      }
      // 5. Tick AFTER the witness so hlc > observed (a clean sequential position).
      hlc = this.seams.clock.tick();
      // 6. Build the disclosure-minimized envelope data (store-specific).
      const data = build(hlc, this.seams.origin, observed);
      if (data === null || data === undefined) {
        this.stats.skipped++;
        return { outcome: 'skipped', hlc };
      }
      // 7. Append. The journal validates + op-key-dedupes + enqueues (non-blocking).
      const journalOutcome = this.seams.journal.emitReplicatedRecord(reg.kind, data);
      if (journalOutcome === undefined) {
        this.stats.emitted++;
        return { outcome: 'unconfirmed', hlc };
      }
      if (journalOutcome !== 'accepted') {
        this.stats.dropped++;
        return { outcome: `dropped:${journalOutcome}`, hlc };
      }
      this.stats.emitted++;
      this.notify({ store, recordKey, op: data.op === 'delete' ? 'delete' : 'put', hlc, data });
      return { outcome: 'emitted', hlc };
    } catch (e) { /* the manager's write must NEVER fail because replication did — a builder throw (e.g. over-cap) / journal fault is a counted no-op, surfaced via stats + the log, never propagated (the safety is structural, not per-caller). */
      this.stats.errors++;
      this.log('emit-failed', { store, error: (e as Error)?.message });
      return { outcome: 'error', ...(hlc ? { hlc } : {}) };
    }
  }

  private notify(ev: EmittedRecordEvent): void {
    for (const fn of this.observers) {
      try {
        fn(ev);
      } catch (e) { /* an observer is bookkeeping; its fault must never undo or fail an accepted emit. Counted + logged. */
        this.stats.observerErrors++;
        this.log('observer-failed', { store: ev.store, error: (e as Error)?.message });
      }
    }
  }

  private log(event: string, detail: Record<string, unknown>): void {
    this.seams.log?.(event, detail);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 2.0 seams: the journal as own-stream, clock and witness (carryover row 40)
// ───────────────────────────────────────────────────────────────────────────

type Journal = ReturnType<typeof openPreviewJournal>;

/** The one registered store of 2.0 (1.x `ReplicatedKindRegistry` with the relationship registration). */
export const relationshipKindRegistry: ReplicatedKindRegistry = Object.freeze({
  getByStore: (store: string) => store === RELATIONSHIP_STORE_KEY ? { kind: RELATIONSHIP_KIND_REGISTRATION.kind } : undefined,
});

/** 1.x HybridLogicalClock.tick: strictly after `previous` and never behind the wall clock. */
export function tickAfter(previous: HlcTimestamp | undefined, physicalNow: number, node: string): HlcTimestamp {
  const floor = Number.isSafeInteger(physicalNow) && physicalNow > 0 ? physicalNow : 0;
  if (!previous) return { physical: floor, logical: 0, node };
  const physical = Math.max(floor, previous.physical);
  return { physical, logical: physical === previous.physical ? previous.logical + 1 : 0, node };
}

/** The newest HLC this root has emitted (its persisted clock state), or undefined before any emit. */
export const lastEmittedHlc = (view: JournalView): HlcTimestamp | undefined => view.relationshipEmits.at(-1)?.hlc;

/** The author-side clock, persisted in the journal: a restart continues from the newest emitted HLC. */
export function journalHlcClock(view: JournalView, now: () => number, node: string): ReplicatedRecordEmitterClock {
  return { tick: () => tickAfter(lastEmittedHlc(view), now(), node) };
}

/** The §7.2 witness over this root's own stream: the MAX HLC it has emitted for the key. */
export const ownWitness = (view: JournalView) => (store: string, recordKey: string): HlcTimestamp | undefined => {
  if (store !== RELATIONSHIP_STORE_KEY) return undefined;
  let max: HlcTimestamp | undefined;
  for (const emit of view.relationshipEmits) if (emit.recordKey === recordKey && (!max || compareHlc(emit.hlc, max) > 0)) max = emit.hlc;
  return max;
};

const uncounted: EnvelopeValidationCounters = { bumpSchemaReject() {}, bumpDroppedField() {}, bumpJailReject() {} };

/** The journal as the own-stream sink: one `relationship-emit` frame per accepted record, validated by the
 *  store schema BEFORE it is written (the writer applies the same strict discipline the receiver will). */
export function journalEmitSink(journal: Journal, now: () => number): ReplicatedRecordEmitterJournal {
  return {
    emitReplicatedRecord(kind, data) {
      if (kind !== RELATIONSHIP_RECORD_KIND) return 'rejected:kind';
      if (Buffer.byteLength(JSON.stringify(data)) > RELATIONSHIP_MAX_ENTRY_BYTES) return 'rejected:oversize';
      // The writer stores the validated form only (the 1.x validator dropped unknown fields; here they never enter the stream).
      const clean = cleanEnvelopeData(data), record = clean && originRecordFromData(clean, uncounted);
      if (!record || !clean) return 'rejected:schema';
      const emit: RelationshipEmit = { seq: journal.view.relationshipEmits.length + 1, recordKey: record.envelope.recordKey,
        op: record.envelope.op, hlc: record.envelope.hlc, data: clean };
      try { journal.append({ kind: 'relationship-emit', emit, at: now() }); } catch { return 'rejected:refused'; }
      return 'accepted';
    },
  };
}

/** The wired emitter for one private root: journal sink, journal clock, own witness, grant gate. */
export function createRelationshipEmitter(journal: Journal, input: { now: () => number; origin: string;
  permission: () => DisclosureVerdict; log?: (event: string, detail: Record<string, unknown>) => void }): ReplicatedRecordEmitter {
  return new ReplicatedRecordEmitter({ journal: journalEmitSink(journal, input.now), clock: journalHlcClock(journal.view, input.now, input.origin),
    registry: relationshipKindRegistry, origin: input.origin, permission: input.permission, loadWitness: ownWitness(journal.view),
    ...(input.log ? { log: input.log } : {}) });
}

/** The store fields of an envelope, apart from the clock and witness, for change detection. */
const storeFields = (data: Record<string, unknown>) => { const { hlc: _hlc, observed: _observed, ...fields } = data; return JSON.stringify(fields); };

export interface EmittedChanges { puts: string[]; deletes: string[]; results: EmitResult[] }

/**
 * The 1.x manager's save funnel, driven from the journal: emit a `put` for every person record whose
 * projection changed since the last emit (new person, new attribute, merge, new mention) and a `delete`
 * tombstone for every recordKey the projection no longer holds (forgotten, corrected, or merged into a
 * wider name set). Idempotent: an unchanged projection emits nothing. Imported channel items are left out
 * of the emitted projection: they are the private root's own view and never cross the group boundary.
 */
export function emitRelationshipChanges(journal: Journal, emitter: ReplicatedRecordEmitter, now: number, origin: string): EmittedChanges {
  const out: EmittedChanges = { puts: [], deletes: [], results: [] };
  const last = new Map<string, RelationshipEmit>();
  for (const emit of journal.view.relationshipEmits) last.set(emit.recordKey, emit);
  const current = new Map<string, Record<string, unknown>>();
  const probe: HlcTimestamp = { physical: 0, logical: 0, node: origin };
  for (const person of journalRelationships(journal.view, now, undefined, { imports: false })) {
    const recordKey = deriveRelationshipRecordKey(person.record.channels);
    if (recordKey === null) continue;
    let data: Record<string, unknown> | null = null;
    try { data = buildRelationshipRecordData({ record: person.record, origin, hlc: probe }); } catch { data = null; }
    if (data) current.set(recordKey, data);
  }
  for (const [recordKey, data] of current) {
    const previous = last.get(recordKey);
    if (previous && previous.op === 'put' && storeFields(previous.data) === storeFields(data)) continue;
    const record = journalRelationships(journal.view, now, undefined, { imports: false })
      .find(person => deriveRelationshipRecordKey(person.record.channels) === recordKey)!.record;
    const result = emitter.emit(RELATIONSHIP_STORE_KEY, recordKey, (hlc, emitOrigin, observed) =>
      buildRelationshipRecordData({ record, origin: emitOrigin, hlc, ...(observed ? { observed } : {}) }));
    out.results.push(result); if (result.outcome === 'emitted') out.puts.push(recordKey);
  }
  const deletedAt = new Date(now).toISOString();
  for (const [recordKey, previous] of last) {
    if (previous.op !== 'put' || current.has(recordKey)) continue;
    const result = emitter.emit(RELATIONSHIP_STORE_KEY, recordKey, (hlc, emitOrigin, observed) =>
      buildRelationshipTombstoneFromKey({ recordKey, hlc, origin: emitOrigin, deletedAt, ...(observed ? { observed } : {}) }));
    out.results.push(result); if (result.outcome === 'emitted') out.deletes.push(recordKey);
  }
  return out;
}
