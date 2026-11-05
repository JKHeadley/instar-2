/**
 * The journal's people as relationship records (carryover row 40, One Memory).
 *
 * 1.x kept a RelationshipManager store beside memory: one JSON file per person, grown on
 * every interaction. 2.0 already records people inside the encrypted journal: a summary
 * pass names each person with an exact quote from the operator's own message
 * (`PersonNote`), source-backed attribute changes (`PersonAttribute`), and operator-confirmed
 * identity links (`PersonMerge`). This module reads those rows into the 1.x record shape so
 * the ported manager, context block, staleness and replicated-store projection work over
 * the journal without a second store. It is a projection: nothing here writes.
 *
 * What a record means here: a person the operator has TALKED ABOUT in this conversation
 * lineage. Its identity surface is the set of names the operator confirmed belong together
 * (`channels` of type `name`), so the same person projects to the same recordKey from any
 * root that knows the same names (REQ-D17 by name rather than by handle, because a
 * mentioned third party has no handle the journal verified). Where they were mentioned
 * (topic) is kept per interaction, not in the identity surface, so a mention in a new
 * topic never splits the person. Corrected or forgotten mentions are projected out exactly
 * as the journal's own packet does (Rules 32, 49): the audit row stays, the record forgets.
 */
import { redact } from '../../src/recall/redact.js';
import { activePersonMerges, operatorWriter, probeTurn, retractedTurn, type JournalView, type PersonNote } from './journal.js';
import { RelationshipManager, normalizeRelationshipName, relationshipSignificance, type RelationshipRecord,
  type RelationshipStorePort, type UserChannel } from './relationship-manager.js';

/** The 1.x default for a journal-backed manager. */
export const JOURNAL_RECENT_INTERACTIONS = 10;

/** A projected record with the journal sources it was read from. */
export interface JournalRelationship { record: RelationshipRecord; sources: string[]; latestSource: string; at: number }

const affected = (view: JournalView, note: { source: string; quote: string }) => retractedTurn(view, note.source)
  || view.memory.some(change => (change.mode === 'correct' || change.mode === 'forget') && (
    change.in !== 'reply' && change.source === note.source && (change.quote.includes(note.quote) || note.quote.includes(change.quote))
    || change.mode === 'correct' && change.trigger === note.source && change.replacement !== undefined
      && (change.replacement.includes(note.quote) || note.quote.includes(change.replacement))));

/** A mention counts only from an accepted, non-probe operator message that is still standing. */
const own = (view: JournalView, note: PersonNote) => {
  const turn = view.turns.get(note.source);
  return turn !== undefined && turn.accepted && operatorWriter(view, turn, true) && !probeTurn(view, turn) && !affected(view, note);
};

const topicChannel = (view: JournalView, source: string) => {
  const turn = view.turns.get(source);
  return view.genesis.forum === true ? `telegram-topic:${turn?.thread === undefined ? 'general' : String(turn.thread)}` : 'telegram-private';
};

/** Every person the journal knows, as 1.x relationship records. Operator-confirmed merges join
 *  notes into one record; a later confirmation that was itself corrected or forgotten no longer joins. */
export function journalRelationships(view: JournalView, now: number, maxRecent = JOURNAL_RECENT_INTERACTIONS): JournalRelationship[] {
  const people = view.people;
  const eligible = people.map((note, index) => ({ note, index })).filter(({ note }) => own(view, note));
  // Union-find over note indexes: same normalized name, or an active operator-confirmed link.
  const parent = new Map<number, number>();
  const find = (i: number): number => { const p = parent.get(i); if (p === undefined || p === i) return i; const root = find(p); parent.set(i, root); return root; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb)); };
  const byName = new Map<string, number>();
  for (const { note, index } of eligible) {
    parent.set(index, parent.get(index) ?? index);
    const key = normalizeRelationshipName(note.name);
    const first = byName.get(key);
    if (first === undefined) byName.set(key, index); else union(first, index);
  }
  const standing = new Set(eligible.map(item => item.index));
  for (const link of activePersonMerges(view)) if (standing.has(link.left) && standing.has(link.right)) union(link.left, link.right);
  const groups = new Map<number, { note: PersonNote; index: number }[]>();
  for (const item of eligible) { const root = find(item.index); groups.set(root, [...groups.get(root) ?? [], item]); }
  const time = (source: string) => view.turns.get(source)!.at;
  const out: JournalRelationship[] = [];
  for (const [root, members] of groups) {
    const ordered = [...members].sort((a, b) => time(a.note.source) - time(b.note.source) || a.index - b.index);
    const counts = new Map<string, number>();
    for (const { note } of ordered) counts.set(note.name, (counts.get(note.name) ?? 0) + 1);
    const name = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const aliases = [...new Set(ordered.map(({ note }) => normalizeRelationshipName(note.name)))].filter(Boolean);
    const channels: UserChannel[] = aliases.map(alias => ({ type: 'name', identifier: alias }));
    const names = new Set(ordered.map(({ note }) => note.name));
    const current = view.personAttributes.filter(item => names.has(item.name) && item.status === 'current'
      && view.turns.get(item.source) !== undefined && !affected(view, item));
    // The latest value of each attribute kind stands; earlier values remain journal history.
    const latest = new Map<string, string>();
    for (const item of [...current].sort((a, b) => time(a.source) - time(b.source))) latest.set(item.attribute, redact(item.value).text);
    const first = ordered[0]!, last = ordered.at(-1)!;
    const record: RelationshipRecord = {
      id: `person:${root}`,
      name: redact(name).text,
      channels,
      firstInteraction: new Date(time(first.note.source)).toISOString(),
      lastInteraction: new Date(time(last.note.source)).toISOString(),
      interactionCount: ordered.length,
      themes: [...latest.keys()],
      notes: [...latest.entries()].map(([attribute, value]) => `${attribute}: ${value}`).join('; '),
      significance: 1,
      recentInteractions: ordered.slice(-maxRecent).map(({ note }) => ({
        timestamp: new Date(time(note.source)).toISOString(), channel: topicChannel(view, note.source), summary: redact(note.quote).text })),
    };
    record.significance = relationshipSignificance(record, now);
    out.push({ record, sources: ordered.map(({ note }) => note.source), latestSource: last.note.source, at: time(last.note.source) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** A read-only store port over the journal's people: the journal is the record, so a write here is a programming error. */
export function journalRelationshipStore(view: JournalView, now: number): RelationshipStorePort {
  const records = journalRelationships(view, now).map(item => item.record);
  const refuse = () => { throw Error('journal relationships are read-only: the journal is the record'); };
  return { load: () => records, save: refuse, remove: refuse };
}

/** The ported manager over the journal's people (resolveByName, getContextForPerson, getStaleRelationships). */
export function journalRelationshipManager(view: JournalView, now: number): RelationshipManager {
  return new RelationshipManager({ maxRecentInteractions: JOURNAL_RECENT_INTERACTIONS },
    { now: () => now, id: () => { throw Error('journal relationships are read-only: the journal is the record'); } },
    journalRelationshipStore(view, now));
}
