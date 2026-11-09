import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { preferenceSentence } from './journal.js';

/** Proof D5c (preswitch-train-220-32b3a954-20261108-175208, D-proofroom4-ps, update 46041015): the operator sent the
 * message below and the summary writer quoted only its clause, so the stored preference dropped "From now on,"
 * (9 of the last 40 D sets). A stated preference is stored in the operator's own words: the whole sentence. */
const MESSAGE = 'From now on, end every shopping list you write for me with "— K".';
const RECORDED_CLAUSE = 'end every shopping list you write for me with "— K"';

const key = new Uint8Array(32).fill(41);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

type Item = { mode: string; quote: string; source?: number; replacement?: string };
/** Replays messages through one journal; `answers` gives the memory items the reply decision proposes per message
 * (source is the 1-based message index, default the message itself). `reopen` reopens the journal before the last. */
const run = async (messages: string[], answers: Record<string, (string | Item)[]>, reopen = false) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-verbatim-')));
  const seen: { preferences?: { text: string; source: string }[] }[] = [];
  const turnId = (n: number) => `telegram:12345678:update:${n}`;
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; context: string; question?: string }) => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator set a list style.', people: [], memory: [] });
      seen.push(packet);
      // The recorded live shape: the reply decision quotes only the clause, beside its reply.
      const items = answers[input.question ?? ''];
      return items ? JSON.stringify({ reply: 'Got it.', memory: items.map(item => typeof item === 'string'
        ? { mode: 'prefer', source: input.id, quote: item }
        : { ...item, source: item.source === undefined ? input.id : turnId(item.source) }) })
        : 'Understood.';
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    for (const [n, text] of messages.entries()) {
      if (reopen && n === messages.length - 1) { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); }
      worker.intake([update(n + 1, text)]); await worker.drain();
    }
    const result = { memory: journal.view.memory.map(item => ({ ...item })), last: seen.at(-1)?.preferences,
      ids: journal.view.order.map(turn => turn.id) };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
};

it('stores the recorded D5 preference with the operator lead-in, not the model clause', async () => {
  const { memory, last, ids } = await run([MESSAGE, 'Anything new?'], { [MESSAGE]: [RECORDED_CLAUSE] });
  expect(memory.filter(item => item.mode === 'prefer').map(item => item.quote)).toEqual([MESSAGE]);
  expect(last).toEqual([{ text: MESSAGE, source: ids[0] }]);
});

it('keeps only the sentence that holds a single instruction; two instructions of one sentence keep their own clauses', async () => {
  const text = 'Thanks for that. From now on, keep replies short and use bullet points. Is it raining?';
  const { memory } = await run([text, 'Anything new?'], { [text]: ['keep replies short', 'use bullet points'] });
  expect(memory.filter(item => item.mode === 'prefer').map(item => item.quote)).toEqual(['keep replies short', 'use bullet points']);
  const single = 'Thanks for that. From now on, keep replies short. Is it raining?';
  const one = await run([single, 'Anything new?'], { [single]: ['keep replies short'] });
  expect(one.memory.filter(item => item.mode === 'prefer').map(item => item.quote)).toEqual(['From now on, keep replies short.']);
});

it('Rule 93: correcting one of two instructions in one sentence keeps the other across a reopen', async () => {
  const text = 'Thanks for that. From now on, keep replies short and use bullet points. Is it raining?';
  const replacement = 'Give detailed explanations from now on.';
  const { last, ids } = await run([text, replacement, 'What style will you use?'], {
    [text]: ['keep replies short', 'use bullet points'],
    [replacement]: [{ mode: 'correct', source: 1, quote: 'keep replies short', replacement }] }, true);
  expect(last).toEqual([{ text: 'use bullet points', source: ids[0] }, { text: replacement, source: ids[1] }]);
});

it('a single-instruction sentence stored whole still retires on a clause-only correction', async () => {
  const text = 'Thanks for that. From now on, keep replies short. Is it raining?';
  const replacement = 'Give detailed explanations from now on.';
  const { last, ids } = await run([text, replacement, 'What style will you use?'], {
    [text]: ['keep replies short'],
    [replacement]: [{ mode: 'correct', source: 1, quote: 'keep replies short', replacement }] }, true);
  expect(last).toEqual([{ text: replacement, source: ids[1] }]);
});

it.each([['clause first', ['keep replies short', 'From now on, keep replies short.']],
  ['sentence first', ['From now on, keep replies short.', 'keep replies short']]])(
  'a clause and its own sentence proposed together store the sentence once (%s)', async (_order, quotes) => {
    const text = 'From now on, keep replies short.';
    const { memory, last, ids } = await run([text, 'Anything new?'], { [text]: quotes });
    expect(memory.filter(item => item.mode === 'prefer').map(item => item.quote)).toEqual([text]);
    expect(last).toEqual([{ text, source: ids[0] }]);
  });

it('Rule 93: correcting an unrelated fact in the same sentence keeps the preference across a reopen', async () => {
  // Astra round 2: the model selected only the preference clause; a later fact correction quoting another part of
  // that sentence corrects the fact and must not retire the preference stored for the sentence.
  const first = 'My name is Alex, and please keep replies short.';
  const fix = 'Correction: My name is Sam.';
  const { memory, last, ids } = await run([first, fix, 'What style will you use?'], {
    [first]: ['keep replies short'],
    [fix]: [{ mode: 'correct', source: 1, quote: 'My name is Alex', replacement: 'My name is Sam' }] }, true);
  expect(memory.filter(item => item.mode !== 'remember')).toEqual([
    { mode: 'prefer', source: ids[0], quote: first, clause: 'keep replies short', trigger: ids[0] },
    { mode: 'correct', source: ids[0], quote: 'My name is Alex', replacement: 'My name is Sam', trigger: ids[1] }]);
  // The preference stays; the corrected fact inside its sentence is withheld by the existing correction projection.
  expect(last).toEqual([{ text: '[withheld: operator correction or forgetting], and please keep replies short.', source: ids[0] }]);
});

it.each([['clause first', ['keep replies short', 'From now on, keep replies short.']],
  ['sentence first', ['From now on, keep replies short.', 'keep replies short']]])(
  'a coalesced sentence keeps its selected clause as the retirement target (%s)', async (_order, quotes) => {
    const text = 'From now on, keep replies short.';
    const replacement = 'Give detailed explanations from now on.';
    const { last, ids } = await run([text, replacement, 'What style will you use?'], {
      [text]: quotes, [replacement]: [{ mode: 'correct', source: 1, quote: 'keep replies short', replacement }] }, true);
    expect(last).toEqual([{ text: replacement, source: ids[1] }]);
  });

it('still refuses a genuine raw repeat and a clause the message does not hold', async () => {
  const text = 'From now on, keep replies short.';
  const repeat = await run([text, 'Anything new?'], { [text]: ['keep replies short', 'keep replies short'] });
  expect(repeat.memory.filter(item => item.mode === 'prefer')).toEqual([]);
  const absent = await run([text, 'Anything new?'], { [text]: ['keep replies short', 'use bullet points'] });
  expect(absent.memory.filter(item => item.mode === 'prefer')).toEqual([]);
});

it('widens to the sentence verbatim and otherwise leaves the clause unchanged', () => {
  expect(preferenceSentence(MESSAGE, RECORDED_CLAUSE)).toBe(MESSAGE);
  expect(preferenceSentence(MESSAGE, MESSAGE)).toBe(MESSAGE);
  expect(preferenceSentence('Hi.\nAlways sign "J."\nBye', 'sign "J."')).toBe('Always sign "J."');
  expect(preferenceSentence('Short please.', 'not in the message')).toBe('not in the message');
  const long = `Please ${'very '.repeat(250)}short replies.`;
  expect(preferenceSentence(long, 'short replies')).toBe('short replies');
});
