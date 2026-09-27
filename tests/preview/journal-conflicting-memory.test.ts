import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeMemoryConflicts, createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(41);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1790000000 + id * 60 } });

it('asks once about two active birthday claims, then records the operator choice across replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-conflict-')));
  const path = join(root, 'journal.encrypted');
  const first = 'My birthday is March 2.';
  const second = 'My birthday is April 4.';
  const sends: string[] = [];
  const contexts: string[] = [];
  let proposedPair: { first: { source: string; quote: string }; second: { source: string; quote: string } } | undefined;
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      const packet = JSON.parse(input.context);
      contexts.push(input.context);
      if (input.question === second) {
        const old = packet.memoryCandidates.find((item: { message: string }) => item.message.includes(first));
        proposedPair = { first: { source: old.id, quote: first }, second: { source: input.id, quote: second } };
        return JSON.stringify({ reply: 'April 4 is right.', memory: [], dated: [],
          conflict: proposedPair });
      }
      if (input.question === 'What is my birthday before I answer?') {
        const pending = packet.openConflicts[0];
        return JSON.stringify({ reply: 'It is April 4.', memory: [], dated: [],
          conflict: { first: pending.first, second: pending.second } });
      }
      if (input.question === 'The first one is right.') {
        expect(packet.openConflicts).toHaveLength(1);
        return JSON.stringify({ reply: 'I will use March 2.', memory: [], dated: [],
          resolveConflict: { askedBy: packet.openConflicts[0].askedBy,
            winner: packet.openConflicts[0].first.source } });
      }
      if (input.question === 'When is my birthday?') {
        expect(input.context).not.toContain(second);
        expect(packet.memory).toMatchObject([{ mode: 'corrected', replacement: first }]);
        expect(packet.openConflicts).toBeUndefined();
        return JSON.stringify({ reply: 'March 2.', memory: [], dated: [] });
      }
      if (input.question === 'Check that disagreement again.')
        return JSON.stringify({ reply: 'Which is right?', memory: [], dated: [], conflict: proposedPair });
      return JSON.stringify({ reply: 'Okay.', memory: [], dated: [] });
    }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, first)]); await worker.drain();
    worker.intake([update(2, second)]); await worker.drain();
    expect(sends[1]).toContain('Which is right?');
    expect(sends[1]).not.toContain('April 4 is right.');
    expect(journal.view.conflicts).toMatchObject([{ asked: true }]);
    expect(journal.view.conflicts[0]?.answeredBy).toBeUndefined();
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    await worker.drain();
    expect(sends).toHaveLength(2);
    worker.intake([update(3, 'What is my birthday before I answer?')]); await worker.drain();
    expect(sends[2]).toContain('still have that conflict open');
    expect(sends.filter(text => text.includes('Which is right?'))).toHaveLength(1);
    worker.intake([update(4, 'The first one is right.')]); await worker.drain();
    expect(journal.view.conflicts[0]).toMatchObject({ asked: true, winner: journal.view.order[0]?.id,
      answeredBy: journal.view.order[3]?.id });
    expect(journal.view.memory).toMatchObject([{ mode: 'correct', source: journal.view.order[1]?.id,
      quote: second, replacement: first }]);
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(5, 'When is my birthday?')]); await worker.drain();
    expect(sends.filter(text => text.includes('Which is right?'))).toHaveLength(1);
    expect(sends.at(-1)).toContain('March 2.');
    expect(contexts.at(-1)).not.toContain(second);
    worker.intake([update(6, 'Check that disagreement again.')]); await worker.drain();
    expect(sends.filter(text => text.includes('Which is right?'))).toHaveLength(1);
    expect(journal.view.conflicts).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('forgets one conflict without exposing it after replay and retains an unrelated active pair', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-conflict-forget-')));
  const path = join(root, 'journal.encrypted');
  const march = 'My birthday is March 2.', april = 'My birthday is April 4.';
  const paris = 'My home city is Paris.', london = 'My home city is London.';
  const seen: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      const packet = JSON.parse(input.context);
      seen.push(input.context);
      if (input.question === april || input.question === london) {
        const first = input.question === april ? march : paris;
        const old = packet.memoryCandidates.find((item: { message: string }) => item.message.includes(first));
        return JSON.stringify({ reply: 'I should check.', memory: [], dated: [], conflict: {
          first: { source: old.id, quote: first }, second: { source: input.id, quote: input.question } } });
      }
      if (input.question === 'Remove the March 2 birthday from your memory.') {
        const old = packet.memoryCandidates.find((item: { message: string }) => item.message.includes(march));
        return JSON.stringify({ reply: 'Removed.', memory: [{ mode: 'forget', source: old.id, quote: march }], dated: [] });
      }
      return JSON.stringify({ reply: 'Okay.', memory: [], dated: [] });
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    for (const [id, statement] of [march, april, paris, london, 'Remove the March 2 birthday from your memory.'].entries()) {
      worker.intake([update(id + 1, statement)]); await worker.drain();
    }
    expect(journal.view.memory).toMatchObject([{ mode: 'forget', quote: march }]);
    expect(journal.view.conflicts).toHaveLength(2); // Encrypted history remains intact.
    expect(activeMemoryConflicts(journal.view)).toMatchObject([{ first: { quote: paris }, second: { quote: london } }]);
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(6, 'Which facts still conflict?')]); await worker.drain();
    const packet = JSON.parse(seen.at(-1)!);
    expect(packet.openConflicts).toMatchObject([{ first: { quote: paris }, second: { quote: london } }]);
    expect(seen.at(-1)).not.toContain(march);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['asked', 'held'] as const)('forgets a repeated fact before a %s conflict can resurface', async state => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-conflict-repeated-')));
  const path = join(root, 'journal.encrypted');
  const march = 'My birthday is March 2.', april = 'My birthday is April 4.';
  const sends: string[] = [], contexts: string[] = [];
  let journal = openPreviewJournal(path, key, genesis);
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      contexts.push(input.context);
      if (input.question === april) return JSON.stringify({ reply: 'I should check.', memory: [], dated: [], conflict: {
        first: { source: journal.view.order[1]!.id, quote: march }, second: { source: input.id, quote: april } } });
      if (input.question === 'Erase my March birthday from memory.') return JSON.stringify({ reply: 'Removed.', dated: [],
        memory: [{ mode: 'forget', source: journal.view.order[0]!.id, quote: march }] });
      return JSON.stringify({ reply: 'Okay.', memory: [], dated: [] });
    }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, march), update(2, march)]); await worker.drain();
    worker.intake([update(3, april)]);
    if (state === 'held') {
      const turn = journal.view.order[2]!;
      journal.append({ kind: 'reserve', id: turn.id, at: 1790000000000 });
      journal.append({ kind: 'answer', id: turn.id, text: 'question candidate', state: 'complete', at: 1790000000000,
        conflict: { first: { source: journal.view.order[1]!.id, quote: march },
          second: { source: turn.id, quote: april } } });
      journal.append({ kind: 'intent', id: turn.id, text: 'PREVIEW — holding reply', chat: genesis.chat,
        update: turn.update, grant: genesis.grant, at: 1790000000000 });
      journal.append({ kind: 'sent', id: turn.id, message: 3, at: 1790000000000 });
    } else await worker.drain();
    expect(activeMemoryConflicts(journal.view)).toHaveLength(1);
    worker.intake([update(4, 'Erase my March birthday from memory.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'forget', source: journal.view.order[0]!.id }]);
    expect(journal.view.conflicts).toHaveLength(1); // Audit history remains encrypted and intact.
    expect(activeMemoryConflicts(journal.view)).toEqual([]);
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    expect(activeMemoryConflicts(journal.view)).toEqual([]);
    const before = sends.length;
    worker.intake([update(5, 'What is my birthday?')]); await worker.drain();
    const packet = JSON.parse(contexts.at(-1)!);
    expect(packet.openConflicts).toBeUndefined();
    expect(contexts.at(-1)).not.toContain(march);
    expect(sends.slice(before).join(' ')).not.toContain(march);
    expect(sends.slice(before).join(' ')).not.toContain('Which is right?');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('does not create a conflict from unrelated facts or unverified source IDs', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-no-conflict-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.question === 'My birthday is April 4.'
        ? JSON.stringify({ reply: 'I choose April 4.', memory: [], dated: [],
          conflict: { first: { source: 'invented', quote: 'My birthday is March 2.' },
            second: { source: input.id, quote: 'My birthday is April 4.' } } })
        : JSON.stringify({ reply: 'Okay.', memory: [], dated: [] }),
      send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(1, 'Riley’s birthday is March 2.')]); await worker.drain();
    worker.intake([update(2, 'My birthday is April 4.')]); await worker.drain();
    expect(journal.view.conflicts).toEqual([]);
    expect(sends[1]).toContain('could not verify');
    expect(sends[1]).not.toContain('I choose April 4.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('answers normally when the model finds no disagreement between active facts', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-compatible-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'Understood.', memory: [], dated: [] }),
      send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(1, 'My birthday is March 2.'), update(2, 'Riley’s birthday is April 4.')]);
    await worker.drain();
    expect(journal.view.conflicts).toEqual([]);
    expect(sends).toHaveLength(2);
    expect(sends.every(text => !text.includes('Which is right?'))).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a conflict question that would exceed the encoded reply bound', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-conflict-size-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const first = `My birthday is March 2. ${'&'.repeat(450)}`;
    const second = `My birthday is April 4. ${'&'.repeat(450)}`;
    const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        return input.question === second ? JSON.stringify({ reply: 'April 4.', memory: [], dated: [],
          conflict: { first: { source: packet.memoryCandidates[0].id, quote: first },
            second: { source: input.id, quote: second } } })
          : JSON.stringify({ reply: 'Okay.', memory: [], dated: [] });
      }, send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(1, first), update(2, second)]); await worker.drain();
    expect(journal.view.conflicts).toEqual([]);
    expect(sends[1]).toContain('could not verify');
    expect(sends[1]).not.toContain('Which is right?');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps an unknown question send fenced and ignores an unaccepted answer', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-conflict-unknown-')));
  const path = join(root, 'journal.encrypted');
  const first = 'My birthday is March 2.', second = 'My birthday is April 4.';
  let sends = 0;
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      const packet = JSON.parse(input.context);
      if (input.question === second) return JSON.stringify({ reply: 'I pick April 4.', memory: [], dated: [],
        conflict: { first: { source: packet.memoryCandidates[0].id, quote: first },
          second: { source: input.id, quote: second } } });
      return JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
        ...(packet.openConflicts?.length ? { resolveConflict: { askedBy: packet.openConflicts[0].askedBy,
          winner: packet.openConflicts[0].first.source } } : {}) });
    }, send: async () => { sends++; return sends === 2 ? null : sends; }, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, first), update(2, second)]); await worker.drain();
    expect(journal.view.conflicts[0]?.asked).toBe(true);
    expect(journal.view.order[1]?.intent).toContain('Which is right?');
    expect(journal.view.order[1]?.sent).toBeUndefined();
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.drain();
    expect(sends).toBe(2);
    worker.intake([update(3, 'The first one is right.', 999)]); await worker.drain();
    expect(journal.view.conflicts[0]?.answeredBy).toBeUndefined();
    expect(sends).toBe(2);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('leaves the question open when a claimed answer names no member of the pair', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-conflict-bad-choice-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const first = 'My birthday is March 2.', second = 'My birthday is April 4.';
    const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.question === second) return JSON.stringify({ reply: 'April 4 wins.', memory: [], dated: [],
          conflict: { first: { source: packet.memoryCandidates[0].id, quote: first },
            second: { source: input.id, quote: second } } });
        if (input.question === 'The third one is right.') return JSON.stringify({ reply: 'Saved.', memory: [], dated: [],
          resolveConflict: { askedBy: packet.openConflicts[0].askedBy, winner: 'invented' } });
        return JSON.stringify({ reply: 'Okay.', memory: [], dated: [] });
      }, send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(1, first), update(2, second), update(3, 'The third one is right.')]);
    await worker.drain();
    expect(journal.view.conflicts[0]?.answeredBy).toBeUndefined();
    expect(journal.view.memory).toEqual([]);
    expect(sends[2]).toContain('could not verify');
    expect(sends[2]).not.toContain('Saved.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('asks on a later turn if the first checked send carried a holding reply instead of the question', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-conflict-held-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sends: string[] = [];
    let worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => input.question === 'For future answers, use a concise style.'
        ? JSON.stringify({ reply: 'I will be concise.', memory: [{ mode: 'prefer', source: input.id,
          quote: input.question }], dated: [] })
        : JSON.stringify({ reply: 'March 2 is right.', memory: [], dated: [] }),
      send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    const first = 'My birthday is March 2.', second = 'My birthday is April 4.';
    worker.intake([update(1, first)]); await worker.drain();
    worker.intake([update(2, second)]);
    const old = journal.view.order[0]!, turn = journal.view.order[1]!;
    journal.append({ kind: 'reserve', id: turn.id, at: 1790000000000 });
    journal.append({ kind: 'answer', id: turn.id, text: 'question candidate', state: 'complete', at: 1790000000000,
      conflict: { first: { source: old.id, quote: first }, second: { source: turn.id, quote: second } } });
    journal.append({ kind: 'intent', id: turn.id, text: 'PREVIEW — holding reply', chat: genesis.chat,
      update: turn.update, grant: genesis.grant, at: 1790000000000 });
    journal.append({ kind: 'sent', id: turn.id, message: 2, at: 1790000000000 });
    expect(journal.view.conflicts[0]?.asked).toBe(false);
    worker.intake([update(3, 'For future answers, use a concise style.')]); await worker.drain();
    expect(sends.at(-1)).toContain('I will be concise.');
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer', quote: 'For future answers, use a concise style.' }]);
    expect(journal.view.conflicts[0]?.asked).toBe(false);
    journal.close();
    const replay = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(replay.view.memory).toMatchObject([{ mode: 'prefer' }]);
    worker = createJournalWorker(replay, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const open = JSON.parse(input.context).openConflicts as { asked: boolean; first: unknown; second: unknown }[];
        expect(open).toMatchObject([{ asked: false }]);
        // The model reads the unasked conflict as data and chooses to ask only when the message concerns it.
        return input.question === 'What is two plus two?' ? JSON.stringify({ reply: 'Four.', memory: [], dated: [] })
          : JSON.stringify({ reply: 'March 2 is right.', memory: [], dated: [],
            conflict: { first: open[0]!.first, second: open[0]!.second } });
      }, send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(4, 'What is two plus two?')]); await worker.drain();
    expect(sends.at(-1)).toContain('Four.');
    expect(sends.at(-1)).not.toContain('Which is right?');
    expect(replay.view.conflicts[0]?.asked).toBe(false);
    worker.intake([update(5, 'What is my birthday?')]); await worker.drain();
    expect(sends.at(-1)).toContain('Which is right?');
    expect(replay.view.conflicts).toHaveLength(1);
    expect(replay.view.conflicts[0]?.asked).toBe(true);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
