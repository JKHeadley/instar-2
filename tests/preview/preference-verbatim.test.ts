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

const run = async (messages: string[], clauses: Record<string, string[]>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-verbatim-')));
  const seen: { preferences?: { text: string; source: string }[] }[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; context: string; question?: string }) => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator set a list style.', people: [], memory: [] });
      seen.push(packet);
      // The recorded live shape: the reply decision quotes only the clause, beside its reply.
      const quotes = clauses[input.question ?? ''];
      return quotes ? JSON.stringify({ reply: 'Got it.', memory: quotes.map(quote => ({ mode: 'prefer', source: input.id, quote })) })
        : 'Understood.';
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, ports);
    for (const [n, text] of messages.entries()) { worker.intake([update(n + 1, text)]); await worker.drain(); }
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

it('keeps only the sentence that holds the clause, and two clauses of one sentence store it once', async () => {
  const text = 'Thanks for that. From now on, keep replies short and use bullet points. Is it raining?';
  const { memory } = await run([text, 'Anything new?'], { [text]: ['keep replies short', 'use bullet points'] });
  expect(memory.filter(item => item.mode === 'prefer').map(item => item.quote))
    .toEqual(['From now on, keep replies short and use bullet points.']);
});

it('widens to the sentence verbatim and otherwise leaves the clause unchanged', () => {
  expect(preferenceSentence(MESSAGE, RECORDED_CLAUSE)).toBe(MESSAGE);
  expect(preferenceSentence(MESSAGE, MESSAGE)).toBe(MESSAGE);
  expect(preferenceSentence('Hi.\nAlways sign "J."\nBye', 'sign "J."')).toBe('Always sign "J."');
  expect(preferenceSentence('Short please.', 'not in the message')).toBe('not in the message');
  const long = `Please ${'very '.repeat(250)}short replies.`;
  expect(preferenceSentence(long, 'short replies')).toBe('short replies');
});
