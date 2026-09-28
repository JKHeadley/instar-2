import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelItems, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(71);
const now = 1_790_000_000_000;
const firstNames = ['Sam', 'Alex', 'Maya', 'Jordan'];
const surnames = ['Alvarez', 'Becker', 'Chen', 'Das', 'Ellis', 'Farah', 'Gomez', 'Hale', 'Ibrahim', 'Jones', 'Kaur', 'Lopez'];
const roles = ['architect', 'baker', 'chemist', 'designer', 'editor', 'farmer', 'geologist', 'historian', 'illustrator', 'journalist', 'keeper', 'librarian'];

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-people-depth-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:offline-people', configurationDigest: 'sha256:offline-people', expires: now + 1_000_000,
    maxCalls: 500, maxReplies: 250, maxTurns: 250, maxBytes: 24_000, cursor: 0 };
  const journal = openPreviewJournal(path, key, genesis);
  const summarize = (context: string) => {
    const packet = JSON.parse(context) as { history: { id: string; user: string }[] };
    return JSON.stringify({ summary: 'Earlier operator messages are retained in their source-backed person notes.',
      people: packet.history.flatMap(item => {
        const name = firstNames.flatMap(first => surnames.map(last => `${first} ${last}`))
          .find(candidate => item.user.includes(candidate));
        return name ? [{ name, source: item.id, quote: item.user }] : [];
      }), commitments: [], memory: [] });
  };
  const ports = { now: () => now, stopped: () => false,
    model: async ({ id, context }: { id: string; context: string }) => id.startsWith('summary:')
      ? summarize(context) : 'Acknowledged.', send: async () => 1, checkOutbound: () => {} };
  const worker = createJournalWorker(journal, ports);
  const append = (id: number, text: string) => {
    const turnId = `telegram:12345678:update:${id}`;
    const raw = JSON.stringify({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text, date: Math.floor(now / 1000) - 86400 + id * 30 } });
    journal.append({ kind: 'intake', id: turnId, update: id, text, raw, accepted: true, cursor: id + 1, at: now });
    journal.append({ kind: 'reserve', id: turnId, at: now });
    journal.append({ kind: 'answer', id: turnId, text: 'Acknowledged.', state: 'complete', at: now });
    journal.append({ kind: 'intent', id: turnId, text: 'Acknowledged.', chat: genesis.chat, update: id, grant: genesis.grant, at: now });
    journal.append({ kind: 'sent', id: turnId, message: id, at: now });
  };
  return { root, path, journal, worker, ports, append };
}

it('scores source attribution for 48 people across 160 turns, repeated summaries, and replay', async () => {
  const run = fixture();
  let replay: ReturnType<typeof openPreviewJournal> | undefined;
  try {
    const people = firstNames.flatMap(first => surnames.map((last, index) => ({
      name: `${first} ${last}`, role: roles[index]!, news: `visited ${surnames[(index + 3) % surnames.length]} harbor` })));
    const sourceByName = new Map<string, number[]>();
    for (let id = 1; id <= 160; id++) {
      const person = people[(id - 1) % people.length]!;
      const text = id <= 48 ? `${person.name} is my ${person.role}; we met through the neighborhood archive.`
        : id <= 96 ? `Recent news about ${person.name}: ${person.news} after the spring meeting.`
          : `Ordinary conversation ${id} about errands, weather, budgets, and plans.`;
      run.append(id, text);
      if (id <= 96) sourceByName.set(person.name, [...sourceByName.get(person.name) ?? [], id]);
      if (id % 4 === 0) await run.worker.summarizeIfNeeded(true);
    }
    await run.worker.summarizeIfNeeded(true);
    expect(run.journal.view.summaries.length).toBeGreaterThan(20);
    importChannelItems(run.journal, [{ source: 'conversation', account: 'agent@example.test', id: 'same-first-name',
      from: 'office@example.test', at: now - 3600_000, text: 'Sam Becker won a regional award.' }],
    'agent@example.test', now);
    run.journal.close();
    replay = openPreviewJournal(run.path, key);
    const worker = createJournalWorker(replay, run.ports);
    let correct = 0, contaminated = 0;
    for (const person of people) {
      const probe = worker.probe(`Tell me about ${person.name}: what is their role and recent news?`);
      if ('reason' in probe) throw Error(probe.reason);
      const packet = JSON.parse(probe.context) as { historyMode: string;
        people?: { source: string; message: string; mentions: { person: string }[] }[] };
      expect(packet.historyMode).toBe('summary-plus-recent');
      const target = packet.people?.filter(item => item.mentions.some(mention => mention.person === person.name)) ?? [];
      const sources = new Set(target.map(item => item.source));
      const expected = sourceByName.get(person.name)!;
      if (expected.every(id => sources.has(`telegram:12345678:update:${id}`))
        && target.some(item => item.message.includes(`my ${person.role}`))
        && target.some(item => item.message.includes(person.news))) correct++;
      if (target.some(item => !expected.some(id => item.source === `telegram:12345678:update:${id}`)
        && !(item.source === 'conversation' && item.message.includes(person.name)))) contaminated++;
    }
    process.stdout.write(`people attribution: ${correct}/${people.length} complete, ${contaminated}/${people.length} contaminated; ${replay.view.summaries.length} summaries, 160 turns\n`);
    expect(correct).toBe(people.length);
    expect(contaminated).toBe(0);
    const ambiguous = worker.probe('What has Sam been doing?');
    if ('reason' in ambiguous) throw Error(ambiguous.reason);
    const sameName = JSON.parse(ambiguous.context) as { people?: { mentions: { person: string }[] }[] };
    expect(new Set(sameName.people?.flatMap(item => item.mentions.map(mention => mention.person))).size)
      .toBeGreaterThan(1);
  } finally { replay?.close(); try { run.journal.close(); } catch { /* already closed */ }
    rmSync(run.root, { recursive: true, force: true }); }
}, 120_000);

it.each(['valid', 'missing', 'wrong'] as const)('binds identical person quotes only to an unambiguous source (%s)', async sourceMode => {
  const run = fixture();
  try {
    const duplicate = 'Sam Alvarez is my architect.';
    run.append(1, duplicate); run.append(2, duplicate);
    const worker = createJournalWorker(run.journal, { ...run.ports, model: async ({ id, context }) => {
      if (!id.startsWith('summary:')) return 'Acknowledged.';
      const packet = JSON.parse(context) as { history: { id: string; user: string }[] };
      return JSON.stringify({ summary: 'Two messages mention Sam Alvarez.', people: packet.history.map(item => ({
        name: 'Sam Alvarez', quote: item.user, ...(sourceMode === 'missing' ? {}
          : { source: sourceMode === 'valid' ? item.id : 'telegram:12345678:update:999' }) })) });
    } });
    await worker.summarizeIfNeeded(true);
    expect(run.journal.view.people.map(note => note.source)).toEqual(sourceMode === 'valid'
      ? ['telegram:12345678:update:1', 'telegram:12345678:update:2'] : []);
  } finally { run.journal.close(); rmSync(run.root, { recursive: true, force: true }); }
});

it('keeps a source-less legacy note when its quote belongs to one shown message', async () => {
  const run = fixture();
  try {
    run.append(1, 'Sam Alvarez is my architect.');
    const worker = createJournalWorker(run.journal, { ...run.ports, model: async ({ id, context }) => {
      if (!id.startsWith('summary:')) return 'Acknowledged.';
      const packet = JSON.parse(context) as { history: { user: string }[] };
      return JSON.stringify({ summary: 'Sam Alvarez is the architect.',
        people: [{ name: 'Sam Alvarez', quote: packet.history[0]!.user }] });
    } });
    await worker.summarizeIfNeeded(true);
    expect(run.journal.view.people.map(note => note.source)).toEqual(['telegram:12345678:update:1']);
  } finally { run.journal.close(); rmSync(run.root, { recursive: true, force: true }); }
});
