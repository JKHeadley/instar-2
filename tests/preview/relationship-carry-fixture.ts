/** A private preview journal whose summary rows named people, beside an empty group root, for the One Memory carry tests. */
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { now, key, scope } from './group-carry-fixture.js';

export const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
  grant: 'TEST-lineage', configurationDigest: 'sha256:test', expires: now + 86400000,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 };
export const update = (id: number, text: string, forum = false) => ({ update_id: id, message: { message_id: id,
  chat: { id: Number(forum ? scope.chat : scope.operator), type: forum ? 'supergroup' : 'private', ...(forum ? { is_forum: true } : {}) },
  from: { id: Number(scope.operator) }, text } });
export const place = (prefix = 'relationship-carry-') => realpathSync(mkdtempSync(join(tmpdir(), prefix)));

/** Three accepted operator messages; the people, one attribute each and one operator-confirmed link are the
 *  projection the journal's summary pass would have recorded (unit-level view state, as the carry tests use). */
export async function peopleWorld(dir: string, options: { extraSamMention?: boolean } = {}) {
  const path = join(dir, 'source.encrypted'), target = join(dir, 'destination.encrypted');
  const writer = openPreviewJournal(path, key, { ...genesis });
  let sent = 10;
  const worker = createJournalWorker(writer, { now: () => now - 2000, stopped: () => false,
    model: async () => 'Noted.', send: async () => ++sent, checkOutbound: () => {} });
  worker.intake([update(1, 'I met Sam Ruiz at the arboretum today; he is an engineer.'),
    update(2, 'Sam said the bridge opens Friday.'), update(3, 'Ana Lima moved to Lisbon.'),
    update(4, 'Actually, Sam Ruiz and Sam are the same person.')]);
  await worker.drain();
  writer.close();
  const source = openPreviewJournal(path, key);
  const [sam, sam2, ana, confirm] = source.view.order.map(turn => turn.id) as [string, string, string, string];
  source.view.people.push({ name: 'Sam Ruiz', source: sam, quote: 'Sam Ruiz' }, { name: 'Sam', source: sam2, quote: 'Sam' },
    { name: 'Ana Lima', source: ana, quote: 'Ana Lima' });
  if (options.extraSamMention) source.view.people.push({ name: 'Sam Ruiz', source: ana, quote: 'Lisbon' });
  source.view.personAttributes.push(
    { name: 'Sam Ruiz', attribute: 'job', value: 'engineer', status: 'current', source: sam, quote: 'he is an engineer' },
    { name: 'Ana Lima', attribute: 'city', value: 'Lisbon', status: 'current', source: ana, quote: 'moved to Lisbon' });
  source.view.personMerges.push({ left: 0, right: 1, trigger: confirm, confirmation: 'Actually, Sam Ruiz and Sam are the same person.' });
  const destination = openPreviewJournal(target, key, { ...genesis, chat: scope.chat, forum: true });
  return { path, target, source, destination, ids: { sam, sam2, ana, confirm } };
}
