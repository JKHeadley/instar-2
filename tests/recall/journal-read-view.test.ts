import { expect, it } from 'vitest';
import { rebuildJournalHistoryReadView, type JournalHistorySnapshot, type ConversationHistoryReadPort } from '../../src/recall/journal-read-view.js';
import { factsFixture, value, refused } from '../facts/fixtures.js';
import type { RecalledExchange } from '../../src/recall/contracts.js';

const row = (id: string, conversation = 'one', at = 10): RecalledExchange => ({ conversation,
  messageId: id, at, text: `message ${id}`, factId: id, session: 'session', machine: 'machine',
  speakerId: 'person', speakerName: 'Person', speakerRole: 'user', visibility: 'participants', audience: ['person'], redactions: 0 });
const snapshot = (): JournalHistorySnapshot<{ state: string }> => ({ revision: 'r1',
  messages: [row('1'), row('2'), row('3'), row('1', 'two')],
  summaries: [{ id: 's1', conversation: 'one', text: 'first two', at: 12, covers: ['1', '2'] }],
  work: [{ conversation: 'one', value: { state: 'pending' } }] });

it('matches the fact-store latest/work consumer shape and isolates conversations', () => {
  const view = value(rebuildJournalHistoryReadView(snapshot, factsFixture().c));
  const consumer: ConversationHistoryReadPort<{ state: string }> = view;
  expect(value(consumer.latest('one', 2)).map(row => row.messageId)).toEqual(['3', '2']);
  expect(value(consumer.latest('two', 5)).map(row => row.messageId)).toEqual(['1']);
  expect(value(consumer.latest('absent', 5))).toEqual([]);
  expect(value(consumer.latest('one', 0))).toEqual([]);
  expect(consumer.work('one')).toEqual([{ state: 'pending' }]);
  expect(consumer.work('two')).toEqual([]);
  for (const limit of [-1, 1.5, NaN, Infinity, 50_001]) refused(consumer.latest('one', limit), 'read limit');
  expect(value(consumer.latest('one', 50_000))).toHaveLength(3);
});

it('returns full coverage through the target, with only an eligible accepted prefix', () => {
  const view = value(rebuildJournalHistoryReadView(snapshot, factsFixture().c));
  expect(value(view.coverage('one', '1'))).toMatchObject({ summary: null, covered: ['1'], messages: [row('1')] });
  expect(value(view.coverage('one', '2'))).toMatchObject({ summary: { id: 's1' }, covered: ['1', '2'], messages: [] });
  expect(value(view.coverage('one', '3'))).toMatchObject({ summary: { id: 's1' }, covered: ['1', '2', '3'], messages: [row('3')] });
  refused(view.coverage('two', '3'), 'target absent');
  expect(view.summaries('one')).toHaveLength(1);
  expect(view.summaries('two')).toEqual([]);
});

it('rejects holes, missing targets, duplicate identities and owner-read failure instead of claiming coverage', () => {
  const c = factsFixture().c;
  for (const covers of [[], ['2'], ['1', '3'], ['1', '2', '3', '4']]) {
    const source = snapshot();
    refused(rebuildJournalHistoryReadView(() => ({ ...source, summaries: [{ ...source.summaries[0]!, covers }] }), c), 'complete history prefix');
  }
  refused(rebuildJournalHistoryReadView(() => ({ ...snapshot(), messages: [row('1'), row('1')] }), c), 'duplicate');
  refused(rebuildJournalHistoryReadView(() => { throw Error('journal unavailable'); }, c), 'journal unavailable');
});

it('detaches one read atomically, retains old revisions and freezes nested results without freezing the owner', () => {
  const source = snapshot(); let reads = 0;
  const old = value(rebuildJournalHistoryReadView(() => { reads++; return source; }, factsFixture().c));
  (source.work[0]!.value).state = 'done';
  expect(old.work('one')).toEqual([{ state: 'pending' }]);
  expect(Object.isFrozen(source.work[0]!.value)).toBe(false);
  expect(Object.isFrozen(old.work('one')[0])).toBe(true);
  expect(Object.isFrozen(old.summaries('one')[0]?.covers)).toBe(true);
  old.coverage('one', '3'); old.latest('one', 2);
  expect(reads).toBe(1);
  expect(value(rebuildJournalHistoryReadView(() => ({ ...source, revision: 'r2' }), factsFixture().c)).work('one')).toEqual([{ state: 'done' }]);
  expect(old.revision).toBe('r1');
});

it('redacts legacy secrets in messages, summaries and owner-folded work', () => {
  const secret = `sk-${'a'.repeat(30)}`;
  const source = snapshot();
  const view = value(rebuildJournalHistoryReadView(() => ({ ...source, messages: [{ ...row('1'), text: secret }],
    summaries: [{ ...source.summaries[0]!, text: secret, covers: ['1'] }], work: [{ conversation: 'one', value: { state: secret } }] }), factsFixture().c));
  expect(JSON.stringify([value(view.latest('one', 1)), view.summaries('one'), view.work('one')])).not.toContain(secret);
  refused(rebuildJournalHistoryReadView(() => ({ ...source, summaries: [], messages: [{ ...row('1'), messageId: secret }] }), factsFixture().c), 'credential-shaped');
});

it('orders by recorded time, supports different machine lineages and chooses the widest eligible prefix', () => {
  const source = snapshot();
  const view = value(rebuildJournalHistoryReadView(() => ({ ...source,
    messages: [row('3', 'one', 30), row('1', 'one', 10), { ...row('2', 'one', 20), machine: 'other-machine' }],
    summaries: [...source.summaries, { id: 's2', conversation: 'one', text: 'all three', covers: ['1', '2', '3'], at: 40 }] }), factsFixture().c));
  expect(value(view.latest('one', 3)).map(row => row.messageId)).toEqual(['3', '2', '1']);
  expect(value(view.coverage('one', '2')).summary?.id).toBe('s1');
  expect(value(view.coverage('one', '3')).summary?.id).toBe('s2');
});
