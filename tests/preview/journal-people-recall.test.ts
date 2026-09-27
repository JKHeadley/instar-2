import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(42);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 14500, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const addTurn = (journal: ReturnType<typeof openPreviewJournal>, n: number, text: string) =>
  journal.append({ kind: 'intake', id: id(n), update: n, text,
    raw: JSON.stringify({ message: { from: { id: 7654321 }, date: 1790000000 + n, text } }),
    accepted: true, cursor: n + 1, at: 1790000000000 + n });
const probe = (journal: ReturnType<typeof openPreviewJournal>, question: string) => {
  const refuse = () => { throw Error('probe must not call or send'); };
  const result = createJournalWorker(journal, { now: () => 1790000010000, stopped: () => false,
    model: refuse, send: refuse, checkOutbound: refuse }).probe(question);
  if ('reason' in result) throw Error(result.reason);
  return result.context;
};
const names = (context: string) => (JSON.parse(context) as { people?: { mentions: { person: string }[] }[] })
  .people?.flatMap(item => item.mentions.map(mention => mention.person)) ?? [];

// int12 briefly partitioned person notes into an 8 KiB active set plus an archive reachable
// only by "Search memory NAME"; Aster was the archived note. Ordinary recall now reads every
// retained note within the packet bound, and a legacy reservation's peopleUsed still replays.
it('recalls a formerly archived person note by ordinary question, honors forget, and replays legacy use records', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-people-recall-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const notes = ['Aster planted the blue flag.', 'Beryl planted the red flag.', 'Cedar planted the green flag.']
      .map((text, index) => `${text} ${String.fromCharCode(97 + index).repeat(3200)}`);
    notes.forEach((text, index) => addTurn(journal, index + 1, text));
    for (const n of [1, 2, 3]) {
      journal.append({ kind: 'reserve', id: id(n), at: 1790000000001 + n });
      journal.append({ kind: 'answer', id: id(n), text: 'Noted.', at: 1790000000001 + n });
      journal.append({ kind: 'intent', id: id(n), text: 'PREVIEW — Noted.', chat: genesis.chat,
        update: n, grant: genesis.grant, at: 1790000000001 + n });
      journal.append({ kind: 'sent', id: id(n), message: n, at: 1790000000001 + n });
    }
    journal.append({ kind: 'summary-reserve', through: 3, at: 1790000000004 });
    journal.append({ kind: 'summary', through: 3, text: 'Aster, Beryl and Cedar were discussed.', people: [
      { name: 'Aster', source: id(1), quote: notes[0]! }, { name: 'Beryl', source: id(2), quote: notes[1]! },
      { name: 'Cedar', source: id(3), quote: notes[2]! }], at: 1790000000005 });
    addTurn(journal, 4, 'Tell me about Beryl');
    journal.append({ kind: 'reserve', id: id(4), peopleUsed: [1], at: 1790000000006 });
    const aster = probe(journal, 'Tell me about Aster');
    expect(names(aster)).toEqual(['Aster']);
    expect(aster).not.toContain('Search memory');
    expect(Buffer.byteLength(aster)).toBeLessThanOrEqual(genesis.maxBytes);
    journal.close();

    journal = openPreviewJournal(path, key);
    expect(names(probe(journal, 'Tell me about Aster'))).toEqual(['Aster']);
    expect(names(probe(journal, 'Tell me about Cedar'))).toEqual(['Cedar']);
    addTurn(journal, 5, 'Forget the blue flag claim about Aster.');
    journal.append({ kind: 'reserve', id: id(5), at: 1790000010001 });
    journal.append({ kind: 'answer', id: id(5), text: 'Understood.', memory: [
      { mode: 'forget', source: id(1), quote: 'Aster planted the blue flag.', trigger: id(5) }], at: 1790000010002 });
    expect(names(probe(journal, 'Tell me about Aster'))).toEqual([]);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(names(probe(journal, 'Tell me about Aster'))).toEqual([]);
    expect(journal.view.people).toHaveLength(3); // The encrypted original remains.
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
