/**
 * RelationshipManager — Core system for tracking everyone the agent interacts with.
 * Ported from 1.x `src/core/RelationshipManager.ts` (JKHeadley/instar 4f88880a).
 *
 * Relationships are fundamental, not a plugin. Same tier as identity and memory.
 * Every person the agent interacts with — across any channel/platform — gets a
 * relationship record that grows over time.
 *
 * Architecture (2.0):
 * - One record per person, held by an injected store port. The 1.x manager wrote one
 *   plaintext JSON file per person under `.instar/relationships/`; in 2.0 the durable
 *   record is the encrypted journal, read through `relationship-journal.ts`, and this
 *   manager works over whatever records the port gives it (an in-memory port by default).
 * - Cross-platform identity resolution via channel index
 * - Auto-enrichment from every interaction
 * - Context injection before any interaction with a known person
 *
 * Not carried: the LLM-supervised `findOrCreateAsync`/`findDuplicatesAsync` prompts. In
 * 2.0 whether two names are one person is the model's judgment inside the journal's
 * summary pass and it takes effect only on a verified operator confirmation
 * (`PersonMerge.confirmation`, journal.ts mergeCandidates/activePersonMerges); the 1.x
 * prompt-and-regex decision ("MATCH:N"/"NEW") is the kind of literal classifier Rule 10
 * keeps out of the live runner. The heuristic single-match link is kept as the manager's
 * own behavior because the ported tests specify it; the journal projection never calls it.
 */

import { deriveRelationshipRecordKey, RELATIONSHIP_STORE_KEY } from './relationship-store.js';
import type { RelationshipRecord, InteractionSummary, UserChannel } from './relationship-store.js';
export type { RelationshipRecord, InteractionSummary, UserChannel } from './relationship-store.js';

/** Maximum number of channels per relationship record. */
const MAX_CHANNELS = 50;
/** Maximum length of notes field. */
const MAX_NOTES_LENGTH = 10_000;

/** The manager's configuration (1.x RelationshipManagerConfig without the file directory,
 *  the deletion-intent directory and the LLM provider). */
export interface RelationshipManagerConfig {
  /** Maximum recent interactions to keep per relationship */
  maxRecentInteractions: number;
}

/** Where records persist. 1.x wrote `<id>.json` files; 2.0 injects the store so the
 *  manager has no filesystem of its own. The default port is in memory. */
export interface RelationshipStorePort {
  /** Every record present at construction (the 1.x `loadAll`). */
  load(): RelationshipRecord[];
  /** Persist one record (the 1.x atomic write-then-rename). Must throw on failure. */
  save(record: RelationshipRecord): void;
  /** Remove one record by id (the 1.x file unlink). Absence is not an error. */
  remove(id: string): void;
}

/** Clock and identity ports: no ambient Date or randomUUID in the manager. */
export interface RelationshipManagerPorts {
  now: () => number;
  id: () => string;
}

/** An in-memory store port: records live only for this manager's lifetime. */
export function memoryRelationshipStore(initial: readonly RelationshipRecord[] = []): RelationshipStorePort & { records(): RelationshipRecord[] } {
  const records = new Map(initial.map(record => [record.id, structuredClone(record)]));
  return {
    load: () => [...records.values()].map(record => structuredClone(record)),
    save: record => { records.set(record.id, structuredClone(record)); },
    remove: id => { records.delete(id); },
    records: () => [...records.values()].map(record => structuredClone(record)),
  };
}

/**
 * WS2.3 cross-machine replication seam (additive, dark by default). The manager
 * routes EVERY persistence mutation through its single `save()` funnel and EVERY
 * deletion through `delete()`/`mergeRelationships()`; when a replication emitter is
 * injected, it emits a disclosure-minimized `relationship-record` envelope (`put` on
 * save, `delete` tombstone on delete) so a relationship learned on one machine
 * replicates to the others. PURE-INJECTED so the manager stays testable (default
 * NOT injected ⇒ a strict no-op, byte-identical single-machine behavior). The
 * emitter NEVER throws out of a mutation — a replication failure must never break a
 * local write (the emitter swallows + counts internally), so the manager calls it
 * best-effort.
 */
export interface RelationshipReplicationEmitter {
  /** Emit a `put` for a persisted record (called from the save funnel). */
  emitPut(record: RelationshipRecord): void;
  /** Emit a `delete` tombstone for a removed person, keyed on their channel set
   *  (called from delete + the merged-record half of mergeRelationships). */
  emitDelete(channels: UserChannel[], deletedAt: string): void;
}

/**
 * WS2.3 union-read seam (REQ-M7). The peer-read surface — "what do my OTHER machines
 * know about this person" — resolves THROUGH the bypass-proof union read, so no
 * caller reads a raw replica around the no-clobber rule. It returns the FOREIGN,
 * READ-ONLY rendered context blocks (each already wrapped in the
 * `<replicated-untrusted-data>` envelope). It is DISTINCT from the local-authoritative
 * resolveByChannel/get/getContextForPerson — identity RESOLUTION of an inbound
 * principal is LOCAL-ONLY (REQ-M14) and must NEVER read a foreign binding. Absent ⇒
 * no peer view (the single-machine no-op).
 */
export interface RelationshipPeerReadSeam {
  /** Render the FOREIGN replicated context for the person reached by these channels
   *  (the union of every peer's replica for the matching identity surface), or [] when
   *  dark / no peer knows them. The result is quoted untrusted data, never authoritative. */
  peerContextForChannels(channels: UserChannel[]): string[];
}

/** 1.x validated a UUID so a record id could never name a path. The same structural
 *  rule holds for every port: an id is a bounded slug, never path-shaped. */
const RELATIONSHIP_ID_RE = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;

/** Deletion intents (1.x DeletionIntentLog) bracketed a file removal so a delete replicated from
 *  a process without an emitter. 2.0 has no second writer process; the journal is the one record.
 *  The store key is kept so a tombstone names the same store the 1.x spec does. */
export const RELATIONSHIP_DELETION_STORE = RELATIONSHIP_STORE_KEY;

export class RelationshipManager {
  private relationships: Map<string, RelationshipRecord> = new Map();
  /** Maps "channel_type:identifier" -> relationship ID for cross-platform resolution */
  private channelIndex: Map<string, string> = new Map();
  /** Maps normalized name -> set of relationship IDs for fuzzy name resolution */
  private nameIndex: Map<string, Set<string>> = new Map();
  private config: RelationshipManagerConfig;
  private store: RelationshipStorePort;
  private ports: RelationshipManagerPorts;
  /** WS2.3 replication emitter (injected, dark by default). Absent ⇒ strict no-op. */
  private replication: RelationshipReplicationEmitter | undefined;
  /** WS2.3 union-read seam (injected, dark by default). Absent ⇒ no peer view. */
  private peerRead: RelationshipPeerReadSeam | undefined;
  /** Channel links refused at the MAX_CHANNELS cap (the 1.x console warning, counted instead). */
  readonly refusedChannelLinks: { id: string; channel: UserChannel }[] = [];

  constructor(config: RelationshipManagerConfig, ports: RelationshipManagerPorts,
    store: RelationshipStorePort = memoryRelationshipStore(), replication?: RelationshipReplicationEmitter) {
    this.config = config;
    this.ports = ports;
    this.store = store;
    this.replication = replication;
    this.loadAll();
  }

  /**
   * Late-bind the WS2.3 replication emitter (the host constructs the union
   * reader/journal/clock AFTER the manager). Idempotent; passing undefined detaches
   * (back to single-machine no-op). The emit funnel checks `this.replication` per
   * mutation, so attaching mid-life takes effect on the next save/delete.
   */
  setReplicationEmitter(emitter: RelationshipReplicationEmitter | undefined): void {
    this.replication = emitter;
  }

  /** Late-bind the WS2.3 union-read seam (the host builds the union reader after the
   *  manager). Passing undefined detaches (no peer view). */
  setPeerReadSeam(seam: RelationshipPeerReadSeam | undefined): void {
    this.peerRead = seam;
  }

  /**
   * WS2.3 (REQ-M7/M14) — "what do my OTHER machines know about this person?" The
   * peer-read surface, READ-ONLY + neutralized: it returns FOREIGN replicated context
   * blocks (each already wrapped in `<replicated-untrusted-data>` and fully sanitized),
   * tagged by origin, resolved THROUGH the bypass-proof union reader. It is a SEPARATE
   * method from resolveByChannel/getContextForPerson — identity RESOLUTION of an
   * inbound principal stays LOCAL-ONLY (REQ-M14): this never makes a foreign record the
   * answer to "who is this". Returns [] when dark / no peer knows them.
   */
  peerContextForChannels(channels: UserChannel[]): string[] {
    return this.peerRead ? this.peerRead.peerContextForChannels(channels) : [];
  }

  /** Normalize a name for fuzzy matching: lowercase, trim, collapse whitespace, strip leading @ */
  private normalizeName(name: string): string {
    return normalizeRelationshipName(name);
  }

  /** Add a record to the name index */
  private indexName(id: string, name: string): void {
    const key = this.normalizeName(name);
    if (!key) return;
    let ids = this.nameIndex.get(key);
    if (!ids) {
      ids = new Set();
      this.nameIndex.set(key, ids);
    }
    ids.add(id);
  }

  /** Remove a record from the name index */
  private unindexName(id: string, name: string): void {
    const key = this.normalizeName(name);
    const ids = this.nameIndex.get(key);
    if (ids) {
      ids.delete(id);
      if (ids.size === 0) this.nameIndex.delete(key);
    }
  }

  /**
   * Read every relationship record from a store port WITHOUT constructing a manager
   * (no index, no write). Same acceptance rules as `loadAll`: a record whose id is
   * invalid or that is not an object is counted in `skipped`, never returned.
   */
  static readAll(store: Pick<RelationshipStorePort, 'load'>): { records: RelationshipRecord[]; skipped: number } {
    const records: RelationshipRecord[] = [];
    let skipped = 0;
    for (const data of store.load()) {
      if (!data || typeof data.id !== 'string' || !RELATIONSHIP_ID_RE.test(data.id) || typeof data.name !== 'string') {
        skipped++;
        continue;
      }
      records.push(data);
    }
    return { records, skipped };
  }

  private validateId(id: string): void {
    if (!RELATIONSHIP_ID_RE.test(id)) {
      throw new Error(`RelationshipManager: invalid record ID format: ${id}`);
    }
  }

  // ── Core Operations ────────────────────────────────────────────────

  /**
   * Find or create a relationship from an incoming interaction.
   * Resolves cross-platform: if the same person messages from Telegram and email,
   * this returns the same relationship.
   */
  findOrCreate(name: string, channel: UserChannel): RelationshipRecord {
    const channelKey = `${channel.type}:${channel.identifier}`;

    // Try to resolve by channel first (strongest signal)
    const existingId = this.channelIndex.get(channelKey);
    if (existingId) {
      const existing = this.relationships.get(existingId);
      if (existing) return existing;
      // Channel index is stale — clean it up and fall through
      this.channelIndex.delete(channelKey);
    }

    // Try name resolution before creating (prevents ColonistOne-style duplicates)
    const nameMatches = this.resolveByName(name);
    if (nameMatches.length === 1) {
      // Unambiguous name match — link the new channel and return
      const match = nameMatches[0]!;
      this.linkChannel(match.id, channel);
      return match;
    }

    // Create new relationship (no match, or ambiguous name)
    const now = new Date(this.ports.now()).toISOString();
    const record: RelationshipRecord = {
      id: this.ports.id(),
      name,
      channels: [channel],
      firstInteraction: now,
      lastInteraction: now,
      interactionCount: 0,
      themes: [],
      notes: '',
      significance: 1,
      recentInteractions: [],
    };

    this.relationships.set(record.id, record);
    this.channelIndex.set(channelKey, record.id);
    this.indexName(record.id, name);
    this.save(record);
    return record;
  }

  /**
   * Resolve a channel identifier to an existing relationship, or null.
   */
  resolveByChannel(channel: UserChannel): RelationshipRecord | null {
    const channelKey = `${channel.type}:${channel.identifier}`;
    const id = this.channelIndex.get(channelKey);
    return id ? this.relationships.get(id) ?? null : null;
  }

  /**
   * Resolve by name using fuzzy matching. Returns all matches.
   * Handles: case differences, leading @, underscores vs hyphens vs spaces.
   * Port of Portal's _find_existing_person() pattern.
   */
  resolveByName(name: string): RelationshipRecord[] {
    const key = this.normalizeName(name);
    if (!key) return [];

    const results: RelationshipRecord[] = [];
    const seen = new Set<string>();

    // Exact normalized match
    const exactIds = this.nameIndex.get(key);
    if (exactIds) {
      for (const id of exactIds) {
        const r = this.relationships.get(id);
        if (r && !seen.has(id)) {
          results.push(r);
          seen.add(id);
        }
      }
    }

    // Collapsed match (remove all separators): catches "ColonistOne" vs "colonist one"
    const collapsed = key.replace(/\s/g, '');
    for (const [indexKey, ids] of this.nameIndex) {
      if (indexKey.replace(/\s/g, '') === collapsed) {
        for (const id of ids) {
          if (!seen.has(id)) {
            const r = this.relationships.get(id);
            if (r) {
              results.push(r);
              seen.add(id);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Get a relationship by ID.
   */
  get(id: string): RelationshipRecord | null {
    return this.relationships.get(id) ?? null;
  }

  /**
   * Get all relationships, optionally sorted by significance or recency.
   */
  getAll(sortBy: 'significance' | 'recent' | 'name' = 'significance'): RelationshipRecord[] {
    const all = Array.from(this.relationships.values());
    switch (sortBy) {
      case 'significance':
        return all.sort((a, b) => b.significance - a.significance);
      case 'recent':
        return all.sort((a, b) => b.lastInteraction.localeCompare(a.lastInteraction));
      case 'name':
        return all.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  /**
   * Detect potential duplicate relationships that could be merged.
   * Port of Portal's find_potential_duplicates() pattern.
   * Returns groups of records that likely represent the same person,
   * with a reason string explaining why they were flagged.
   */
  findDuplicates(): Array<{ records: RelationshipRecord[]; reason: string }> {
    const groups: Array<{ records: RelationshipRecord[]; reason: string }> = [];
    const seen = new Set<string>();

    // Check for name collisions (same normalized name, different records)
    for (const [key, ids] of this.nameIndex) {
      if (ids.size > 1) {
        const records = Array.from(ids)
          .map((id) => this.relationships.get(id))
          .filter((r): r is RelationshipRecord => r != null);
        if (records.length > 1) {
          const groupKey = Array.from(ids).sort().join(',');
          if (!seen.has(groupKey)) {
            seen.add(groupKey);
            groups.push({
              records,
              reason: `Same normalized name: "${key}"`,
            });
          }
        }
      }
    }

    // Check for collapsed-name collisions (e.g., "colonist one" vs "colonistone")
    const collapsedMap = new Map<string, Set<string>>();
    for (const [key, ids] of this.nameIndex) {
      const collapsed = key.replace(/\s/g, '');
      let existing = collapsedMap.get(collapsed);
      if (!existing) {
        existing = new Set();
        collapsedMap.set(collapsed, existing);
      }
      for (const id of ids) existing.add(id);
    }

    for (const [collapsed, ids] of collapsedMap) {
      if (ids.size > 1) {
        const groupKey = Array.from(ids).sort().join(',');
        if (!seen.has(groupKey)) {
          seen.add(groupKey);
          const records = Array.from(ids)
            .map((id) => this.relationships.get(id))
            .filter((r): r is RelationshipRecord => r != null);
          if (records.length > 1) {
            groups.push({
              records,
              reason: `Similar collapsed name: "${collapsed}"`,
            });
          }
        }
      }
    }

    return groups;
  }

  // ── Enrichment ─────────────────────────────────────────────────────

  /**
   * Record an interaction with a person. Updates recency, count, and interaction log.
   */
  recordInteraction(
    id: string,
    interaction: InteractionSummary,
  ): void {
    const record = this.relationships.get(id);
    if (!record) return;

    record.lastInteraction = interaction.timestamp;
    record.interactionCount++;

    // Add to recent interactions, trim to max
    record.recentInteractions.push(interaction);
    if (record.recentInteractions.length > this.config.maxRecentInteractions) {
      record.recentInteractions = record.recentInteractions.slice(
        -this.config.maxRecentInteractions,
      );
    }

    // Merge new topics into themes
    if (interaction.topics) {
      for (const topic of interaction.topics) {
        if (!record.themes.includes(topic)) {
          record.themes.push(topic);
        }
      }
      // Keep themes manageable
      if (record.themes.length > 20) {
        record.themes = record.themes.slice(-20);
      }
    }

    // Auto-derive significance from frequency and recency
    record.significance = this.calculateSignificance(record);

    this.save(record);
  }

  /**
   * Update notes or other metadata for a relationship.
   */
  updateNotes(id: string, notes: string): void {
    const record = this.relationships.get(id);
    if (!record) return;
    record.notes = notes.slice(0, MAX_NOTES_LENGTH);
    this.save(record);
  }

  /**
   * Update the arc summary for a relationship.
   */
  updateArcSummary(id: string, arcSummary: string): void {
    const record = this.relationships.get(id);
    if (!record) return;
    record.arcSummary = arcSummary;
    this.save(record);
  }

  /**
   * Link a new channel to an existing relationship (cross-platform identity merge).
   * Returns false when the link was refused at the channel cap (recorded in
   * `refusedChannelLinks`; the 1.x console warning carried the same fact).
   */
  linkChannel(id: string, channel: UserChannel): boolean {
    const record = this.relationships.get(id);
    if (!record) return false;

    const channelKey = `${channel.type}:${channel.identifier}`;

    // Check if this channel is already linked to someone else
    const existingId = this.channelIndex.get(channelKey);
    if (existingId && existingId !== id) {
      // Merge the other record into this one
      this.mergeRelationships(id, existingId);
      return true;
    }

    if (!record.channels.some((c) => c.type === channel.type && c.identifier === channel.identifier)) {
      if (record.channels.length >= MAX_CHANNELS) {
        this.refusedChannelLinks.push({ id, channel });
        return false;
      }
      record.channels.push(channel);
      this.channelIndex.set(channelKey, id);
      this.save(record);
    }
    return true;
  }

  /**
   * Merge two relationship records (when we discover two channels are the same person).
   */
  mergeRelationships(keepId: string, mergeId: string): void {
    const keep = this.relationships.get(keepId);
    const merge = this.relationships.get(mergeId);
    if (!keep || !merge) return;

    // WS2.3: snapshot the MERGED person's STANDALONE channel set BEFORE we fold its
    // channels into the survivor — the coherent put(survivor)+delete(merged) pair the
    // merge emits keys the tombstone on this OLD set. After the fold the survivor's
    // channel set (and therefore its recordKey) SUBSUMES these, so the tombstone's
    // recordKey is DISTINCT from the survivor's new recordKey — no replication loop,
    // no tombstone that suppresses the survivor (the survivor's `put` carries the
    // consolidated identity; the tombstone only retires the merged's standalone replica).
    const mergedChannelsBefore = [...merge.channels];

    // Merge channels (respect MAX_CHANNELS cap)
    for (const channel of merge.channels) {
      if (keep.channels.length >= MAX_CHANNELS) break;
      if (!keep.channels.some((c) => c.type === channel.type && c.identifier === channel.identifier)) {
        keep.channels.push(channel);
      }
      this.channelIndex.set(`${channel.type}:${channel.identifier}`, keepId);
    }

    // Merge interaction history
    keep.recentInteractions = [...keep.recentInteractions, ...merge.recentInteractions]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(-this.config.maxRecentInteractions);

    // Merge themes (cap at 20 to match recordInteraction behavior)
    for (const theme of merge.themes) {
      if (keep.themes.length >= 20) break;
      if (!keep.themes.includes(theme)) keep.themes.push(theme);
    }

    // Take the earlier first interaction
    if (merge.firstInteraction < keep.firstInteraction) {
      keep.firstInteraction = merge.firstInteraction;
    }

    // Sum interaction counts
    keep.interactionCount += merge.interactionCount;

    // Merge notes (cap total length)
    if (merge.notes && merge.notes !== keep.notes) {
      keep.notes = keep.notes
        ? `${keep.notes}\n\n[Merged from ${merge.name}]: ${merge.notes}`.slice(0, MAX_NOTES_LENGTH)
        : merge.notes.slice(0, MAX_NOTES_LENGTH);
    }

    // Merge category (keep existing, or take from merged)
    if (!keep.category && merge.category) {
      keep.category = merge.category;
    }

    // Merge tags
    if (merge.tags) {
      if (!keep.tags) keep.tags = [];
      for (const tag of merge.tags) {
        if (!keep.tags.includes(tag)) keep.tags.push(tag);
      }
    }

    keep.significance = this.calculateSignificance(keep);
    this.save(keep); // emits the survivor `put` (now carrying the consolidated channel set)

    // Delete the merged record and clean up name index.
    const mergedDeletedAt = new Date(this.ports.now()).toISOString();
    this.unindexName(mergeId, merge.name);
    this.relationships.delete(mergeId);
    this.deleteStored(mergeId);

    // WS2.3: emit the merged record's TOMBSTONE keyed on its OLD standalone channel
    // set so peers retire its standalone replica — the `delete` half of the coherent
    // put+delete pair. Best-effort; strict no-op when dark. The survivor's recordKey
    // (now subsuming these channels) differs from this tombstone's recordKey, so the
    // tombstone can never suppress the survivor (no dangling tombstone, no loop).
    if (this.replication) {
      try {
        this.replication.emitDelete(mergedChannelsBefore, mergedDeletedAt);
      } catch {
        // Additive replication never breaks the local merge; the emitter records its own failures.
      }
    }
  }

  /**
   * Delete a relationship and its stored record.
   */
  delete(id: string): boolean {
    const record = this.relationships.get(id);
    if (!record) return false;

    // Snapshot the channel set BEFORE we mutate the indexes — the WS2.3 tombstone is
    // keyed on the channel-set identity surface (REQ-D4/D17), not the local id.
    const channels = [...record.channels];

    // Remove channel index entries
    for (const channel of record.channels) {
      const channelKey = `${channel.type}:${channel.identifier}`;
      if (this.channelIndex.get(channelKey) === id) {
        this.channelIndex.delete(channelKey);
      }
    }

    // Remove name index entry
    this.unindexName(id, record.name);

    const deletedAt = new Date(this.ports.now()).toISOString();
    this.relationships.delete(id);
    this.deleteStored(id);

    // WS2.3 (§4.2 REQ-D4): a delete propagates as a `relationship-record` `op:'delete'`
    // TOMBSTONE keyed on the channel-set identity surface so it reaches the same human's
    // record on every machine (incl. an offline-then-rejoining peer, §4.3) — never a
    // record absence that cannot distinguish "deleted" from "never replicated". Emitted
    // AFTER the durable local delete; best-effort; strict no-op when dark.
    if (this.replication) {
      try {
        this.replication.emitDelete(channels, deletedAt);
      } catch {
        // Additive replication never breaks the local delete.
      }
    }
    return true;
  }

  /**
   * Update the category for a relationship.
   */
  updateCategory(id: string, category: string): void {
    const record = this.relationships.get(id);
    if (!record) return;
    record.category = category;
    this.save(record);
  }

  /**
   * Add tags to a relationship (deduplicates).
   */
  addTags(id: string, tags: string[]): void {
    const record = this.relationships.get(id);
    if (!record) return;
    if (!record.tags) record.tags = [];
    for (const tag of tags) {
      if (!record.tags.includes(tag)) {
        record.tags.push(tag);
      }
    }
    this.save(record);
  }

  /**
   * Remove tags from a relationship.
   */
  removeTags(id: string, tags: string[]): void {
    const record = this.relationships.get(id);
    if (!record || !record.tags) return;
    record.tags = record.tags.filter((t) => !tags.includes(t));
    this.save(record);
  }

  // ── Context Generation ─────────────────────────────────────────────

  /**
   * Generate context string for injection into a model session before interacting
   * with a known person. This is what makes the agent "know" who it's talking to.
   */
  getContextForPerson(id: string): string | null {
    const record = this.relationships.get(id);
    if (!record) return null;
    return relationshipContext(record);
  }

  /**
   * Find relationships that haven't been contacted in a while.
   */
  getStaleRelationships(daysThreshold: number = 14): RelationshipRecord[] {
    return staleRelationships(this.getAll('recent'), daysThreshold, this.ports.now());
  }

  // ── Persistence ────────────────────────────────────────────────────

  private loadAll(): void {
    for (const data of this.store.load()) {
      try {
        this.validateId(data.id);
        this.relationships.set(data.id, data);
        this.indexName(data.id, data.name);
        for (const channel of (data.channels ?? [])) {
          this.channelIndex.set(`${channel.type}:${channel.identifier}`, data.id);
        }
      } catch {
        // Skip corrupted records (the 1.x tolerant read; readAll counts them)
      }
    }
  }

  private save(record: RelationshipRecord): void {
    this.validateId(record.id);
    this.store.save(record);
    // WS2.3 (ws23-relationships-userregistry-security §5 REQ-M3/M4): the single
    // persistence funnel is the ONE place a `relationship-record` `put` is emitted,
    // so every mutator (findOrCreate, updateNotes, linkChannel, addTags, …) replicates
    // through it without per-method wiring. Best-effort + AFTER the durable local
    // write succeeded: a replication failure must NEVER break the local write (the
    // injected emitter swallows + counts internally). Strict no-op when no emitter is
    // injected (the dark default).
    if (this.replication) {
      try {
        this.replication.emitPut(record);
      } catch {
        // Replication is additive; a local write must never fail because cross-machine
        // emission did. The emitter records its own failures.
      }
    }
  }

  private deleteStored(id: string): void {
    this.validateId(id);
    this.store.remove(id);
  }

  // ── Internal ───────────────────────────────────────────────────────

  private calculateSignificance(record: RelationshipRecord): number {
    return relationshipSignificance(record, this.ports.now());
  }
}

// ── Pure functions shared with the journal projection ──────────────────────

/** Normalize a name for fuzzy matching: lowercase, trim, collapse whitespace, strip leading @ */
export function normalizeRelationshipName(name: string): string {
  return name.trim().toLowerCase().replace(/^@/, '').replace(/[\s_-]+/g, ' ');
}

/** The 1.x significance derivation, with the clock injected. */
export function relationshipSignificance(record: RelationshipRecord, now: number): number {
  // Significance is derived from:
  // - Interaction frequency (count)
  // - Recency (how recently they interacted)
  // - Theme depth (variety of topics)
  const lastInteraction = new Date(record.lastInteraction).getTime();
  const daysSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60 * 24);

  let score = 0;

  // Frequency component (0-4 points)
  if (record.interactionCount >= 50) score += 4;
  else if (record.interactionCount >= 20) score += 3;
  else if (record.interactionCount >= 5) score += 2;
  else if (record.interactionCount >= 2) score += 1;

  // Recency component (0-3 points)
  if (daysSinceLastInteraction < 1) score += 3;
  else if (daysSinceLastInteraction < 7) score += 2;
  else if (daysSinceLastInteraction < 30) score += 1;

  // Theme depth (0-3 points)
  if (record.themes.length >= 10) score += 3;
  else if (record.themes.length >= 5) score += 2;
  else if (record.themes.length >= 2) score += 1;

  return Math.min(10, Math.max(1, score));
}

/** Relationships last seen before the threshold, significant enough to notice (1.x getStaleRelationships). */
export function staleRelationships(records: readonly RelationshipRecord[], daysThreshold: number, now: number): RelationshipRecord[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  const cutoffStr = cutoff.toISOString();
  return [...records].sort((a, b) => b.lastInteraction.localeCompare(a.lastInteraction)).filter(
    (r) => r.lastInteraction < cutoffStr && r.significance >= 3,
  );
}

/** The 1.x getContextForPerson block for a LOCAL-authoritative record. */
export function relationshipContext(record: RelationshipRecord): string {
  // Sanitize user-controlled strings to prevent XML/prompt injection
  const sanitize = (s: string): string =>
    s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const safeName = sanitize(record.name);

  const lines: string[] = [
    `<relationship_context person="${safeName}">`,
    `Name: ${safeName}`,
    `Known since: ${record.firstInteraction}`,
    `Last interaction: ${record.lastInteraction}`,
    `Total interactions: ${record.interactionCount}`,
    `Significance: ${record.significance}/10`,
  ];

  // Cross-platform presence summary
  if (record.channels.length > 1) {
    const platforms = [...new Set(record.channels.map((c) => c.type))];
    lines.push(`Platforms: ${platforms.map(sanitize).join(', ')}`);
  }

  if (record.category) {
    lines.push(`Category: ${sanitize(record.category)}`);
  }

  if (record.tags && record.tags.length > 0) {
    lines.push(`Tags: ${record.tags.map(sanitize).join(', ')}`);
  }

  if (record.themes.length > 0) {
    lines.push(`Key themes: ${record.themes.map(sanitize).join(', ')}`);
  }

  if (record.communicationStyle) {
    lines.push(`Communication style: ${sanitize(record.communicationStyle)}`);
  }

  if (record.arcSummary) {
    lines.push(`Relationship arc: ${sanitize(record.arcSummary)}`);
  }

  if (record.notes) {
    lines.push(`Notes: ${sanitize(record.notes)}`);
  }

  if (record.recentInteractions.length > 0) {
    lines.push('Recent interactions:');
    for (const interaction of record.recentInteractions.slice(-5)) {
      lines.push(`  - [${sanitize(interaction.timestamp)}] ${sanitize(interaction.summary)}`);
    }
  }

  lines.push('</relationship_context>');
  return lines.join('\n');
}

/** The identity surface of a record, for callers keying tombstones and peer reads. */
export const relationshipRecordKey = (record: Pick<RelationshipRecord, 'channels'>) => deriveRelationshipRecordKey(record.channels);
