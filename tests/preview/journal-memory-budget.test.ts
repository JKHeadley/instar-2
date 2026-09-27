import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, projectMemoryBudget, PREVIEW_MEMORY_BUDGET_BYTES } from './journal.js';

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
  return JSON.parse(result.context) as { people?: { mentions: { person: string }[] }[];
    preferences?: { text: string }[]; historyMode: string; capability: string };
};
const names = (packet: ReturnType<typeof probe>) => packet.people?.flatMap(item => item.mentions.map(mention => mention.person)) ?? [];

it('archives the least recently used inferred note, searches it on request, and replays use order', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-budget-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const aster = `Aster planted the blue flag. ${'a'.repeat(3200)}`;
    const beryl = `Beryl planted the red flag. ${'b'.repeat(3200)}`;
    const cedar = `Cedar planted the green flag. ${'c'.repeat(3200)}`;
    addTurn(journal, 1, aster); addTurn(journal, 2, beryl); addTurn(journal, 3, cedar);
    for (const n of [1, 2, 3]) {
      journal.append({ kind: 'reserve', id: id(n), at: 1790000000001 + n });
      journal.append({ kind: 'answer', id: id(n), text: 'Noted.', at: 1790000000001 + n });
      journal.append({ kind: 'intent', id: id(n), text: 'PREVIEW — Noted.', chat: genesis.chat,
        update: n, grant: genesis.grant, at: 1790000000001 + n });
      journal.append({ kind: 'sent', id: id(n), message: n, at: 1790000000001 + n });
    }
    journal.append({ kind: 'summary-reserve', through: 3, at: 1790000000004 });
    journal.append({ kind: 'summary', through: 3, text: 'Aster, Beryl and Cedar were discussed.', people: [
      { name: 'Aster', source: id(1), quote: aster }, { name: 'Beryl', source: id(2), quote: beryl },
      { name: 'Cedar', source: id(3), quote: cedar }], at: 1790000000005 });
    const first = projectMemoryBudget(journal.view);
    expect(first.active).toEqual([1, 2]);
    expect(first.archived).toEqual([0]);
    expect(first.activeBytes).toBeLessThanOrEqual(PREVIEW_MEMORY_BUDGET_BYTES);
    const ordinary = probe(journal, 'Tell me about Aster');
    expect(names(ordinary)).toEqual([]);
    expect(ordinary.capability).toContain('Search memory NAME');
    expect(ordinary.capability).toContain('A missing match does not prove absence');
    expect(names(probe(journal, 'Tell me about Beryl'))).toEqual(['Beryl']);
    expect(names(probe(journal, 'Search memory Aster'))).toContain('Aster');
    // The real worker records the exact archived note offered in its durable reservation.
    addTurn(journal, 4, 'Search memory Aster');
    await createJournalWorker(journal, { now: () => 1790000010000, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'Found it.', memory: [], dated: [] }),
      send: async () => 4, checkOutbound: () => {} }).drain();
    expect(journal.view.order[3]?.sent).toBe(4);
    expect(projectMemoryBudget(journal.view).active).toEqual([0, 2]);
    // A later durable use wins even if the host clock has moved backward.
    addTurn(journal, 5, 'Tell me about Beryl');
    journal.append({ kind: 'reserve', id: id(5), peopleUsed: [1], at: 1790000000001 });
    expect(projectMemoryBudget(journal.view).active).toEqual([0, 1]);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(projectMemoryBudget(journal.view).active).toEqual([0, 1]);
    expect(projectMemoryBudget(journal.view).archived).toEqual([2]);
    expect(names(probe(journal, 'Tell me about Aster'))).toContain('Aster');
    expect(names(probe(journal, 'Tell me about Beryl'))).toContain('Beryl');
    expect(names(probe(journal, 'Tell me about Cedar'))).toEqual([]);
    expect(names(probe(journal, 'Search memory Cedar'))).toContain('Cedar');
    addTurn(journal, 6, 'Forget the blue flag claim about Aster.');
    journal.append({ kind: 'reserve', id: id(6), at: 1790000010001 });
    journal.append({ kind: 'answer', id: id(6), text: 'Understood.', memory: [
      { mode: 'forget', source: id(1), quote: 'Aster planted the blue flag.', trigger: id(6) }],
      at: 1790000010002 });
    expect(names(probe(journal, 'Search memory Aster'))).toEqual([]);
    expect(projectMemoryBudget(journal.view).active).not.toContain(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('releases corrected and forgotten pinned content while retaining its journal evidence', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-retire-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const first = `Use concise answers ${'a'.repeat(4100)}`;
    const replacement = `Use concise answers ${'b'.repeat(4100)}`;
    addTurn(journal, 1, first);
    journal.append({ kind: 'reserve', id: id(1), at: 1790000000001 });
    journal.append({ kind: 'answer', id: id(1), text: 'Understood.', memory: [
      { mode: 'prefer', source: id(1), quote: first, trigger: id(1) }], at: 1790000000002 });
    expect(projectMemoryBudget(journal.view).pinnedBytes).toBe(Buffer.byteLength(first));
    addTurn(journal, 2, replacement);
    journal.append({ kind: 'reserve', id: id(2), at: 1790000000003 });
    journal.append({ kind: 'answer', id: id(2), text: 'Updated.', memory: [
      { mode: 'correct', source: id(1), quote: first, trigger: id(2), replacement }], at: 1790000000004 });
    expect(projectMemoryBudget(journal.view).pinnedBytes).toBe(Buffer.byteLength(replacement));
    addTurn(journal, 3, 'Forget my answer style preference.');
    journal.append({ kind: 'reserve', id: id(3), at: 1790000000005 });
    journal.append({ kind: 'answer', id: id(3), text: 'Forgotten.', memory: [
      { mode: 'forget', source: id(2), quote: replacement, trigger: id(3) }], at: 1790000000006 });
    expect(projectMemoryBudget(journal.view).pinnedBytes).toBe(0);
    const note = 'Aster planted a blue flag.';
    addTurn(journal, 4, note);
    journal.append({ kind: 'summary-reserve', through: 4, at: 1790000000007 });
    journal.append({ kind: 'summary', through: 4, text: 'The operator discussed Aster.',
      commitments: [{ in: 'message', source: id(1), quote: first }],
      people: [{ name: 'Aster', source: id(4), quote: note }], at: 1790000000008 });
    expect(projectMemoryBudget(journal.view)).toMatchObject({ pinnedBytes: 0, active: [0], archived: [] });
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.memory).toHaveLength(3);
    expect(projectMemoryBudget(journal.view)).toMatchObject({ pinnedBytes: 0, active: [0], archived: [] });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps operator preferences pinned and reports an honest over-budget state', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-pin-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const preference = `Use concise answers ${'x'.repeat(PREVIEW_MEMORY_BUDGET_BYTES)}`;
    addTurn(journal, 1, preference);
    journal.append({ kind: 'reserve', id: id(1), at: 1790000000001 });
    journal.append({ kind: 'answer', id: id(1), text: 'Understood.', memory: [
      { mode: 'prefer', source: id(1), quote: preference, trigger: id(1) }], at: 1790000000002 });
    const budget = projectMemoryBudget(journal.view);
    expect(budget.pinnedBytes).toBeGreaterThan(PREVIEW_MEMORY_BUDGET_BYTES);
    expect(budget.activeBytes).toBe(budget.pinnedBytes);
    expect(budget.archived).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
