/** Carryover row 40: imported channel items (`--agent-state-dir`) count as interactions of a person the operator
 *  already named, in the private root's own relationship view only. They never create a record, never add a name
 *  channel, obey the operator's correct/forget rows, and never cross the group boundary (Rules 10, 32, 49, 95). */
import { afterEach, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { importChannelItems } from './journal-test-worker.js';
import { buildCarriedMemory } from './group-carry.js';
import { resolveGroupDisclosure } from './group-disclosure.js';
import { now, sealKey, scope, records, authority } from './group-carry-fixture.js';
import { peopleWorld, place } from './relationship-carry-fixture.js';
import { importedItemId, journalRelationshipManager, journalRelationships } from './relationship-journal.js';
import { deriveRelationshipRecordKey } from './relationship-store.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const world = async () => { const dir = place('relationship-journal-'); dirs.push(dir); return peopleWorld(dir); };
const account = 'echo-agent@example.test';
const row = (id: string, from: string, text: string, at = now - 1000, conversation = 'Bridge works') =>
  ({ source: 'conversation', account, id, from, at, text, conversation });
const sam = (view: ReturnType<typeof journalRelationships>) => view.find(item => item.record.name === 'Sam Ruiz')!;

it('an imported item from the person, or naming them exactly, is an interaction of the known record; unknown senders create nothing and no name channel is added', async () => {
  const w = await world();
  const before = sam(journalRelationships(w.source.view, now));
  expect(importChannelItems(w.source, [
    row('m-1', 'Sam Ruiz <sam.ruiz@example.test>', 'The bridge inspection is moved to Monday.', now - 1500),
    row('m-2', 'ops@example.test', 'Reminder: Sam Ruiz owns the inspection report.', now - 1000),
    row('m-3', 'Zed Quill <zed@example.test>', 'Lunch?', now - 900),
    row('m-4', 'ops@example.test', 'Samuel Ruizova is a different person; a longer name is not a mention.', now - 800),
  ], account, now)).toBe(4);
  const view = journalRelationships(w.source.view, now);
  expect(view.map(item => item.record.name).sort()).toEqual(['Ana Lima', 'Sam Ruiz']);
  const after = sam(view);
  expect(after.record.channels).toEqual(before.record.channels);
  expect(after.record.interactionCount).toBe(before.record.interactionCount + 2);
  expect(after.record.firstInteraction).toBe(before.record.firstInteraction);
  expect(after.record.lastInteraction).toBe(new Date(now - 1000).toISOString());
  expect(after.record.recentInteractions.slice(-2)).toEqual([
    { timestamp: new Date(now - 1500).toISOString(), channel: 'import:conversation/Bridge works', summary: 'The bridge inspection is moved to Monday.' },
    { timestamp: new Date(now - 1000).toISOString(), channel: 'import:conversation/Bridge works', summary: 'Reminder: Sam Ruiz owns the inspection report.' }]);
  expect(after.sources.slice(-2)).toEqual([importedItemId({ ...row('m-1', '', ''), at: 0 } as never), importedItemId({ ...row('m-2', '', ''), at: 0 } as never)]);
  expect(after.latestSource).toBe(before.latestSource);
  expect(after.at).toBe(now - 1000);
  // The identity surface is unchanged, so the recordKey the carry would derive is unchanged.
  expect(deriveRelationshipRecordKey(after.record.channels)).toBe(deriveRelationshipRecordKey(before.record.channels));
  const manager = journalRelationshipManager(w.source.view, now);
  expect(manager.getContextForPerson(after.record.id)).toContain('Total interactions: 4');
  expect(manager.resolveByName('Zed Quill')).toEqual([]);
  w.source.close(); w.destination.close();
});

it('a corrected or forgotten imported item is withheld from the record while the item stays in the journal', async () => {
  const w = await world();
  const items = [row('m-1', 'Sam Ruiz <sam@example.test>', 'The bridge inspection is moved to Monday.', now - 1500),
    row('m-2', 'Sam Ruiz <sam@example.test>', 'Actually Tuesday.', now - 1400)];
  importChannelItems(w.source, items, account, now);
  const first = importedItemId({ ...items[0]!, at: 0 } as never), second = importedItemId({ ...items[1]!, at: 0 } as never);
  expect(sam(journalRelationships(w.source.view, now)).record.interactionCount).toBe(4);
  w.source.view.memory.push({ mode: 'forget', source: first, trigger: w.ids.confirm, quote: 'bridge inspection is moved' });
  const forgotten = sam(journalRelationships(w.source.view, now));
  expect(forgotten.record.interactionCount).toBe(3);
  expect(JSON.stringify(forgotten.record)).not.toContain('Monday');
  w.source.view.memory.push({ mode: 'correct', source: second, trigger: w.ids.confirm, quote: 'Actually Tuesday.', replacement: 'Wednesday.' });
  expect(sam(journalRelationships(w.source.view, now)).record.interactionCount).toBe(2);
  expect(w.source.view.channelItems.size).toBe(2);
  w.source.close(); w.destination.close();
});

it('imported history never crosses the group boundary: the carry refuses a source journal that holds imports', async () => {
  const w = await world();
  importChannelItems(w.source, [row('m-1', 'Sam Ruiz <sam@example.test>', 'The bridge inspection is moved to Monday.')], account, now);
  const permission = resolveGroupDisclosure(scope, authority(), now, records, sealKey);
  if (permission.kind !== 'resolved') throw Error(permission.reason);
  expect(() => buildCarriedMemory(w.source.view, scope, permission, now)).toThrow(/not this operator private journal/u);
  w.source.close(); w.destination.close();
});
