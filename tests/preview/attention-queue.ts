/** Carryover row 88. Adapted from 1.x TelegramAdapter attention methods,
 * AttentionConditionStore and RemoteAckStore. One journal, one writer; no files,
 * clocks, network sends or swallowed persistence failures in these stores.
 * R7/31/32: event history is retained by the encrypted journal and its replica.
 * R28: acknowledgements consume the installed surface's verified operator receipt.
 * R52/53/87: the queue is a pull surface; routing never creates an event topic.
 */
import { ATTENTION_STATUSES, ATTENTION_PRIORITIES } from './attention-vocabulary.js';
import type { AttentionItem } from './attention-vocabulary.js';

export interface AttentionConditionIdentity { producer: string; conditionType: string; subject: string; scope?: string }
export interface AttentionConditionObservation { itemId: string; episode: number; shouldRaise: boolean }
export interface AttentionConditionRecord extends AttentionConditionIdentity {
  key: string; scope: string; active: boolean; episode: number; itemId: string; firstSeenAt: number; lastSeenAt: number; clearedAt?: number;
}
export interface PendingRemoteAck {
  itemId: string; targetMachineId: string; status: AttentionItem['status']; operatorUid: string;
  authority: string; revision: number; enqueuedAt: number; attempts: number;
  lastOutcome: 'pending' | 'unreachable' | 'rejected' | 'stale-superseded' | 'delivered' | 'exhausted';
  nextAttemptAt: number;
}
export interface AttentionState {
  items: AttentionItem[]; conditions: AttentionConditionRecord[]; acknowledgements: PendingRemoteAck[];
  conditionCapacity?: { observations: number; lastKey: string; at: number };
}
export type AttentionRecord = { kind: 'attention'; at: number } & (
  | { action: 'item'; item: AttentionItem }
  | { action: 'condition'; condition: AttentionConditionRecord }
  | { action: 'condition-capacity'; key: string }
  | { action: 'ack'; ack: PendingRemoteAck }
  | { action: 'apply'; itemId: string; targetMachineId: string; revision: number; authority: string });
export interface AttentionJournal {
  state(): AttentionState | undefined;
  append(record: AttentionRecord): void;
}
export const emptyAttentionState = (): AttentionState => ({ items: [], conditions: [], acknowledgements: [] });
const activeAck = (a: PendingRemoteAck) => a.lastOutcome === 'pending' || a.lastOutcome === 'unreachable';
const text = (s: unknown, max = 1024): s is string => typeof s === 'string' && s.length > 0 && s.length <= max;
const count = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
const check = (condition: unknown, reason: string): void => { if (!condition) throw Error(`attention: ${reason}`); };
const clone = <T>(value: T): T => structuredClone(value);
const sameAck = (a: PendingRemoteAck, b: { itemId: string; targetMachineId: string }) => a.itemId === b.itemId && a.targetMachineId === b.targetMachineId;

/** Validate before fsync and on replay. An invalid event never poisons the journal.
 * Exact revision references prevent a delayed DONE from hiding a new escalation. */
export function applyAttentionRecord(previous: AttentionState | undefined, row: AttentionRecord, operator: string): AttentionState {
  const next = clone(previous ?? emptyAttentionState());
  check(count(row.at), 'invalid clock');
  if (row.action === 'item') {
    const x = row.item, old = next.items.find(i => i.id === x.id);
    check(text(x.id, 512) && text(x.title, 200) && typeof x.summary === 'string' && x.summary.length <= 4000
      && (x.description === undefined || typeof x.description === 'string' && x.description.length <= 16000)
      && text(x.category, 120) && ATTENTION_PRIORITIES.includes(x.priority) && ATTENTION_STATUSES.includes(x.status)
      && count(x.createdAt) && count(x.updatedAt) && x.createdAt <= x.updatedAt && x.updatedAt === row.at
      && x.revision === (old?.revision ?? 0) + 1 && x.status === 'OPEN'
      && (old === undefined || x.createdAt === old.createdAt)
      && (x.lane === undefined || x.lane === 'agent-health')
      && (x.machineId === undefined || text(x.machineId, 120)), 'invalid item or revision');
    check(old || next.items.length < 2000, 'item capacity reached; existing items retained');
    if (old) next.items[next.items.indexOf(old)] = clone(x); else next.items.push(clone(x));
  } else if (row.action === 'condition') {
    const c = row.condition, old = next.conditions.find(i => i.key === c.key);
    check(text(c.producer, 120) && text(c.conditionType, 120) && text(c.subject, 512) && text(c.scope, 120)
      && c.key === attentionConditionKey(c) && count(c.episode) && c.episode > 0
      && c.itemId === `${c.key}:ep-${c.episode}` && typeof c.active === 'boolean'
      && count(c.firstSeenAt) && c.lastSeenAt === row.at && c.firstSeenAt <= c.lastSeenAt
      && (old ? c.firstSeenAt === old.firstSeenAt && c.episode === old.episode + Number(!old.active && c.active)
        : c.episode === 1 && c.active)
      && (c.active ? c.clearedAt === undefined : c.clearedAt === row.at), 'invalid condition episode');
    if (old) next.conditions[next.conditions.indexOf(old)] = clone(c); else next.conditions.push(clone(c));
  } else if (row.action === 'condition-capacity') {
    check(text(row.key, 4096), 'invalid capacity identity');
    next.conditionCapacity = { observations: (next.conditionCapacity?.observations ?? 0) + 1, lastKey: row.key, at: row.at };
  } else if (row.action === 'ack') {
    const a = row.ack, old = next.acknowledgements.find(i => sameAck(i, a));
    check(text(a.itemId, 512) && text(a.targetMachineId, 120) && ATTENTION_STATUSES.includes(a.status)
      && a.operatorUid === operator && text(a.authority, 256) && count(a.revision) && a.revision > 0
      && count(a.enqueuedAt) && a.enqueuedAt <= row.at && count(a.attempts) && a.attempts <= 50
      && count(a.nextAttemptAt) && ['pending', 'unreachable', 'rejected', 'stale-superseded', 'delivered', 'exhausted'].includes(a.lastOutcome),
    'invalid acknowledgement or operator');
    check(old || next.acknowledgements.length < 2000, 'acknowledgement capacity reached; existing intents retained');
    const refresh = a.lastOutcome === 'pending' && a.attempts === 0;
    check(refresh || old && activeAck(old) && a.authority === old.authority && a.revision === old.revision
      && a.status === old.status && a.enqueuedAt === old.enqueuedAt && a.attempts === old.attempts + 1
      && ['unreachable', 'rejected', 'stale-superseded', 'exhausted'].includes(a.lastOutcome), 'invalid acknowledgement transition');
    if (old) next.acknowledgements[next.acknowledgements.indexOf(old)] = clone(a); else next.acknowledgements.push(clone(a));
  } else if (row.action === 'apply') {
    const a = next.acknowledgements.find(i => sameAck(i, row)), item = next.items.find(i => i.id === row.itemId);
    check(a && activeAck(a) && a.operatorUid === operator && a.authority === row.authority && a.revision === row.revision
      && item && item.revision === a.revision, 'acknowledgement absent, unauthorized or superseded');
    item!.status = a!.status; item!.updatedAt = row.at; item!.revision++;
    // Atomic projection: no crash window between applying the status and recording delivery.
    a!.lastOutcome = 'delivered';
  } else throw Error('attention: unknown action');
  return next;
}

function segment(value: string): string { return encodeURIComponent(value.trim() || 'unknown'); }
export function attentionConditionKey(identity: AttentionConditionIdentity): string {
  return [segment(identity.producer), segment(identity.conditionType), segment(identity.subject), segment(identity.scope ?? 'global')].join(':');
}
/** 1.x episode algorithm, with durable append replacing private JSON and no eviction of history. */
export class AttentionConditionStore {
  constructor(private readonly journal: AttentionJournal, private readonly now: () => number, private readonly maxRecords = 2000) {}
  observe(identity: AttentionConditionIdentity): AttentionConditionObservation {
    const key = attentionConditionKey(identity), now = this.now(), rows = this.journal.state()?.conditions ?? [];
    const current = rows.find(row => row.key === key);
    if (current?.active) {
      this.journal.append({ kind: 'attention', action: 'condition', at: now, condition: { ...current, lastSeenAt: now } });
      return { itemId: current.itemId, episode: current.episode, shouldRaise: false };
    }
    // Keep the tuned stable overflow identity, but retain inactive episode counters too (R7).
    if (!current && rows.length >= this.maxRecords) {
      this.journal.append({ kind: 'attention', action: 'condition-capacity', key, at: now });
      return { itemId: `${key}:capacity`, episode: 1, shouldRaise: true };
    }
    const episode = (current?.episode ?? 0) + 1, itemId = `${key}:ep-${episode}`;
    this.journal.append({ kind: 'attention', action: 'condition', at: now, condition: {
      ...identity, key, scope: identity.scope ?? 'global', active: true, episode, itemId,
      firstSeenAt: current?.firstSeenAt ?? now, lastSeenAt: now } });
    return { itemId, episode, shouldRaise: true };
  }
  clear(identity: AttentionConditionIdentity): boolean {
    const current = this.journal.state()?.conditions.find(c => c.key === attentionConditionKey(identity));
    if (!current?.active) return false;
    const at = this.now();
    this.journal.append({ kind: 'attention', action: 'condition', at, condition: { ...current, active: false, lastSeenAt: at, clearedAt: at } });
    return true;
  }
  clearSubject(producer: string, subject: string): number {
    let cleared = 0;
    for (const record of this.journal.state()?.conditions ?? []) {
      if (record.producer !== producer || record.subject !== subject || !record.active) continue;
      if (this.clear(record)) cleared++;
    }
    return cleared;
  }
}

/** 1.x RemoteAckStore's tuple identity and durable intent, with bounded backoff.
 * Terminal/exhausted evidence stays in the journal; an exhausted intent is visible,
 * never silently deleted. Revalidation belongs to the installed owner on drain. */
export class RemoteAckStore {
  constructor(private readonly journal: AttentionJournal, private readonly now: () => number) {}
  enqueue(intent: Omit<PendingRemoteAck, 'enqueuedAt' | 'attempts' | 'lastOutcome' | 'nextAttemptAt'>): PendingRemoteAck {
    const existing = this.journal.state()?.acknowledgements.find(a => sameAck(a, intent));
    if (existing && existing.authority === intent.authority && existing.revision === intent.revision && existing.status === intent.status) return clone(existing);
    const at = this.now();
    const entry: PendingRemoteAck = { ...intent, enqueuedAt: existing?.enqueuedAt ?? at, attempts: 0, lastOutcome: 'pending', nextAttemptAt: at };
    this.journal.append({ kind: 'attention', action: 'ack', ack: entry, at });
    return clone(entry);
  }
  recordAttempt(itemId: string, targetMachineId: string, outcome: 'unreachable' | 'rejected' | 'stale-superseded'): void {
    const entry = this.list().find(a => sameAck(a, { itemId, targetMachineId }));
    if (!entry) return;
    const at = this.now(), attempts = entry.attempts + 1;
    this.journal.append({ kind: 'attention', action: 'ack', at, ack: { ...entry, attempts,
      lastOutcome: attempts >= 50 && outcome === 'unreachable' ? 'exhausted' : outcome,
      nextAttemptAt: at + Math.min(300_000, 1000 * 2 ** Math.min(attempts, 9)) } });
  }
  list(): PendingRemoteAck[] { return clone((this.journal.state()?.acknowledgements ?? []).filter(activeAck)); }
  listForMachine(machine: string): PendingRemoteAck[] { return this.list().filter(e => e.targetMachineId === machine); }
  get size(): number { return this.list().length; }
}
export type NewAttentionItem = Omit<AttentionItem, 'createdAt' | 'updatedAt' | 'status' | 'revision'>;
export class AttentionQueue {
  readonly remoteAcks: RemoteAckStore;
  readonly conditions: AttentionConditionStore;
  constructor(private readonly journal: AttentionJournal, private readonly now: () => number) {
    this.remoteAcks = new RemoteAckStore(journal, now); this.conditions = new AttentionConditionStore(journal, now);
  }
  getAttentionItems(status?: AttentionItem['status']): AttentionItem[] {
    return clone((this.journal.state()?.items ?? []).filter(i => !status || i.status === status));
  }
  getAttentionItem(id: string): AttentionItem | undefined { return this.getAttentionItems().find(i => i.id === id); }
  createAttentionItem(item: NewAttentionItem): AttentionItem {
    const existing = this.getAttentionItem(item.id); if (existing) return existing;
    return this.upsertAttentionItem(item);
  }
  upsertAttentionItem(item: NewAttentionItem): AttentionItem {
    const old = this.getAttentionItem(item.id), at = this.now();
    const attention: AttentionItem = { ...item, status: 'OPEN', createdAt: old?.createdAt ?? at, updatedAt: at, revision: (old?.revision ?? 0) + 1 };
    this.journal.append({ kind: 'attention', action: 'item', item: attention, at });
    return clone(attention);
  }
  createOrReopenAgentHealthAttentionItem(item: NewAttentionItem): AttentionItem {
    check(item.lane === 'agent-health', 'agent-health lane required'); return this.upsertAttentionItem(item);
  }
  /** Single owner applies already durable intent; no network send and no model judgment.
   * The owner callback must revalidate the recorded operator grant each time. */
  drain(authorize: (ack: PendingRemoteAck) => boolean): { delivered: number; pending: number; rejected: number } {
    let delivered = 0, rejected = 0;
    for (const ack of this.remoteAcks.list()) {
      if (ack.nextAttemptAt > this.now()) continue;
      if (!authorize(ack)) { this.remoteAcks.recordAttempt(ack.itemId, ack.targetMachineId, 'rejected'); rejected++; continue; }
      const item = this.getAttentionItem(ack.itemId);
      if (!item) { this.remoteAcks.recordAttempt(ack.itemId, ack.targetMachineId, 'unreachable'); continue; }
      if (item.revision !== ack.revision) { this.remoteAcks.recordAttempt(ack.itemId, ack.targetMachineId, 'stale-superseded'); rejected++; continue; }
      this.journal.append({ kind: 'attention', action: 'apply', itemId: item.id, targetMachineId: ack.targetMachineId,
        revision: ack.revision, authority: ack.authority, at: this.now() }); delivered++;
    }
    return { delivered, pending: this.remoteAcks.size, rejected };
  }
}
