/** A promise the reply actually delivers must close (Rule 10).
 *
 * Live 2026-10-03, group A in room two (results `A-proofroom2-20261003-022222`, build cint-L36 4228d0c5),
 * check A5b FAILED. A5 asked for a promise of three tomato watering tips; the agent promised, and
 * `agentPromises` gained `{action: promised, closed: false}` (A5a PASSED). A5b asked for the tips, the next
 * reply gave exactly three "as promised" — and the promise was still `closed: false` after its receipt
 * (`inspect-a5b.json`, recorded in the fixture).
 *
 * The live answer row was not readable, so which declaration the live call made is UNCONFIRMED. Replayed on
 * the same recorded packet through the same envelope, protocol and reader, claude-sonnet-5 named commitment 0
 * and declared `fulfilled` in five of six calls — but it chose the `quote` three different ways, and two of
 * them lost the declaration; either could explain the live failure:
 *
 *   1. the whole reply as the excerpt. The fulfilment quote shared the 500-byte bound written for a promise
 *      SENTENCE, so an excerpt over that bound was refused: the same answer shape closed the promise at 413
 *      bytes and was refused at 526 (the live reply was 610). Only the reply's length decided whether a
 *      delivered promise was recorded as delivered. Fixed in code: a fulfilment quote is now bounded by the
 *      reply it must appear in, which is the bound that was always doing the work.
 *   2. the promise's own sentence, copied from the packet. That is not carried by the reply as sent, and it
 *      stays refused — accepting it would let any reply close any offered promise by echoing the packet back.
 *      Fixed in the protocol: ANSWER_PROTOCOL now says the quote is an exact excerpt of this reply, not the
 *      promise. Six real calls under the first, longer wording all quoted their reply and closed the promise;
 *      that wording broke the measured context floor (cint-L38), so it was shortened, and six more real calls
 *      under the short wording -- four delivering the tips, two delivering nothing -- closed exactly the
 *      delivered ones. The old malformed output is still refused, asserted below.
 *
 * Every case replays recorded shapes: the live turns, and the verbatim claude-sonnet-5 outputs on that packet.
 * The floor is proved on both sides — a quote the reply does not carry is refused and counted, a reply that
 * delivers nothing closes nothing, and the bound stays finite and byte-exact. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { REPLY_EXCERPT_LIMIT, fulfillmentProposals, promiseProposals } from './agent-commitment.js';
import { ANSWER_PROTOCOL } from './briefing.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/promise-fulfilment-a5b-2026-10-03.json', import.meta.url), 'utf8')) as {
  turns: { update: number; message: string; sent: string; answer: string }[];
  agentPromisesAfterA5: { id: number; quote: string; action: string; closed: boolean }[];
  agentPromisesAfterA5b: { id: number; quote: string; action: string; closed: boolean }[];
  recordedAnswers: { run: string; replyBytes: number; quoteBytes: number | null; quotesTheReply: boolean;
    note: string; output: { reply: string; fulfilled?: { id: number; quote: string }[] } }[];
  clarifiedProtocol: { wording: string; answers: { run: string; quotesTheReply: boolean;
    output: { reply: string; fulfilled?: { id: number; quote: string }[] } }[] };
  trimmedProtocol: { wording: string;
    delivered: { run: string; quotesTheReply: boolean; output: { reply: string; fulfilled?: { id: number; quote: string }[] } }[];
    undelivered: { run: string; message: string; output: { reply: string; fulfilled?: unknown } }[] };
};
const [A5, A5B] = recorded.turns as [typeof recorded.turns[number], typeof recorded.turns[number]];
const PROMISE = recorded.agentPromisesAfterA5[0]!.quote;
/** The recorded answers that quoted this reply (whatever their length), and the one that quoted the promise. */
const carried = recorded.recordedAnswers.filter(item => item.quotesTheReply);
const uncarried = recorded.recordedAnswers.filter(item => !item.quotesTheReply);

const key = new Uint8Array(32).fill(23);
const now = 1791019493578;
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 };
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-fulfilment-')));
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text, date: Math.floor(now / 1000) } });

/** The recorded exchange: A5's promise, then A5b answered by `answerA5b` — the model's own output shape,
 * given the commitment ids the packet actually offered, exactly as the live launcher passes them. */
async function replay(root: string, answerA5b: (offered: { id: number; owner?: string }[]) => string, message = A5B.message) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    prepareModel: input => input.context,
    model: async ({ question, context }) => {
      if (question === A5.message) return JSON.stringify({ reply: A5.answer, memory: [], promises: [{ quote: PROMISE }] });
      if (question !== message) return 'Noted.';
      const offered = ((JSON.parse(context) as { commitments?: { items?: { id: number; owner?: string }[] }[] })
        .commitments ?? []).flatMap(group => group.items ?? []);
      return answerA5b(offered);
    },
    send: async () => 1, checkOutbound: () => {} });
  worker.intake([update(A5.update, A5.message)]); await worker.drain();
  const promised = journal.view.commitments.findIndex(note => note.agentPromise !== undefined);
  worker.intake([update(A5B.update, message)]); await worker.drain();
  return { journal, promised, last: journal.view.order.at(-1)!,
    closed: () => journal.view.closed.has(promised), rejected: () => journal.view.rejectedObligations };
}

/** The live promise is recorded open after A5, as check A5a observed. */
const expectRecordedPromise = (w: Awaited<ReturnType<typeof replay>>) => {
  expect(w.promised).toBe(recorded.agentPromisesAfterA5[0]!.id);
  expect(w.journal.view.commitments[w.promised]!.agentPromise).toMatchObject({ action: 'promised', quote: PROMISE });
};

it('the live answer shape — the whole reply quoted as the excerpt — closes the promise it delivered', async () => {
  const root = origin();
  try {
    // The reply actually sent live (610 bytes of body), with a SYNTHETIC declaration of the whole-reply shape
    // the recorded claude-sonnet-5 answers showed (commitment 0, the whole reply as the quote). The live
    // call's own declaration was not recoverable; this proves the bound on the live reply's length only.
    const w = await replay(root, offered => JSON.stringify({ reply: A5B.answer, memory: [], promises: [],
      fulfilled: [{ id: offered.find(item => item.owner === 'agent')!.id, quote: A5B.answer }] }));
    expectRecordedPromise(w);
    expect(Buffer.byteLength(A5B.answer)).toBeGreaterThan(500);
    expect(w.last.intent).toBe(A5B.sent);
    expect(w.last.proposedFulfills).toEqual([{ id: w.promised, quote: A5B.answer }]);
    expect(w.last.intentFulfills).toEqual([w.promised]);
    expect(w.rejected()).toBe(0);
    // What check A5b reads: the promise is closed after the delivering reply's receipt.
    expect(w.closed()).toBe(true);
    expect(recorded.agentPromisesAfterA5b[0]!.closed).toBe(false); // what the live run recorded instead
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('every recorded answer that quoted its own reply closes the promise, at any length', async () => {
  // Six real claude-sonnet-5 calls on this packet produced quotes of 51, 83, 413, 526 and 687-byte replies.
  // Only the 526-byte whole-reply quote was refused before the fix; the 413-byte one, the same shape, was not.
  expect(carried.map(item => item.quoteBytes! > 500)).toEqual([true, false, false, false]);
  for (const item of carried) {
    const root = origin();
    try {
      const w = await replay(root, () => JSON.stringify(item.output));
      expectRecordedPromise(w);
      expect(w.last.proposedFulfills, item.run).toEqual(item.output.fulfilled);
      expect(w.closed(), item.run).toBe(true);
      expect(w.rejected(), item.run).toBe(0);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}, 60000);

it('a reply that delivers nothing closes nothing, and the promise stays open', async () => {
  const root = origin();
  try {
    const w = await replay(root, () => JSON.stringify({ reply: 'PREVIEW-case: I have not given the tips yet.', memory: [], promises: [] }));
    expectRecordedPromise(w);
    expect(w.last.proposedFulfills).toBeUndefined();
    expect(w.last.intentFulfills).toEqual([]);
    expect(w.closed()).toBe(false);
    expect(w.rejected()).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('a recorded answer that quoted the promise instead of its own reply is still refused, counted, and closes nothing', async () => {
  // Reproduction 6, verbatim (under the earlier protocol wording): the tips were delivered, commitment 0 was
  // named — and the quote was the promise's own sentence, copied from the packet, which this reply does not
  // carry. Accepting that would let any reply close any offered promise by echoing the packet back, so it
  // stays refused; the protocol wording, not the floor, is what now steers the model away from it.
  expect(uncarried).toHaveLength(1);
  for (const item of uncarried) {
    const root = origin();
    try {
      expect(item.output.fulfilled![0]!.quote).toBe(PROMISE);
      const w = await replay(root, () => JSON.stringify(item.output));
      expectRecordedPromise(w);
      expect(item.output.reply.includes(PROMISE), item.run).toBe(false);
      expect(w.last.intent, item.run).toContain(item.output.reply); // the reply itself still goes out in full
      expect(w.last.proposedFulfills, item.run).toBeUndefined();
      expect(w.closed(), item.run).toBe(false);
      expect(w.rejected(), item.run).toBe(1); // visible, never silently lost (Rule 2)
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}, 30000);

it('under the first clarified wording every real answer quotes its own reply and closes the promise', async () => {
  // Six real claude-sonnet-5 calls on the recorded A5b packet, each sent that earlier, longer wording.
  const clarified = recorded.clarifiedProtocol;
  expect(ANSWER_PROTOCOL).not.toContain(clarified.wording);
  expect(clarified.answers).toHaveLength(6);
  for (const item of clarified.answers) {
    expect(item.quotesTheReply, item.run).toBe(true);
    expect(item.output.fulfilled![0]!.quote, item.run).not.toBe(PROMISE);
    const root = origin();
    try {
      const w = await replay(root, () => JSON.stringify(item.output));
      expectRecordedPromise(w);
      expect(w.last.proposedFulfills, item.run).toEqual(item.output.fulfilled);
      expect(w.closed(), item.run).toBe(true);
      expect(w.rejected(), item.run).toBe(0);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}, 60000);

it('under the shortened wording a delivered promise closes and an undelivered one stays open', async () => {
  // Six real claude-sonnet-5 calls, each sent the wording asserted here: four on the recorded A5b packet,
  // two with A5b's operator text replaced so that the reply delivers nothing.
  const trimmed = recorded.trimmedProtocol;
  expect(ANSWER_PROTOCOL).toContain(trimmed.wording);
  expect(trimmed.delivered).toHaveLength(4);
  expect(trimmed.undelivered).toHaveLength(2);
  for (const item of trimmed.delivered) {
    expect(item.quotesTheReply, item.run).toBe(true);
    expect(item.output.fulfilled![0]!.quote, item.run).not.toBe(PROMISE);
    const root = origin();
    try {
      const w = await replay(root, () => JSON.stringify(item.output));
      expectRecordedPromise(w);
      expect(w.last.proposedFulfills, item.run).toEqual(item.output.fulfilled);
      expect(w.closed(), item.run).toBe(true);
      expect(w.rejected(), item.run).toBe(0);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  for (const item of trimmed.undelivered) {
    // Neither real answer declared a fulfilment. Each did add one openLoops item (kind promise) that the
    // obligation reader refused; the refusal is counted, not lost, and it is outside the fulfilment clause.
    expect(item.output.fulfilled, item.run).toBeUndefined();
    const root = origin();
    try {
      const w = await replay(root, () => JSON.stringify(item.output), item.message);
      expectRecordedPromise(w);
      expect(w.last.proposedFulfills, item.run).toBeUndefined();
      expect(w.last.intentFulfills, item.run).toEqual([]);
      expect(w.closed(), item.run).toBe(false);
      expect(w.rejected(), item.run).toBe(1);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}, 60000);

it('the bound is still finite, decides on exact bytes, and leaves the promise sentence bound alone', () => {
  const supported = () => true;
  const at = 'x'.repeat(REPLY_EXCERPT_LIMIT), over = 'x'.repeat(REPLY_EXCERPT_LIMIT + 1);
  expect(fulfillmentProposals([{ id: 0, quote: at }], at, supported)).toEqual([{ id: 0, quote: at }]);
  expect(fulfillmentProposals([{ id: 0, quote: over }], over, supported)).toBeUndefined();
  // A multi-byte character counts its bytes, not its characters, on both sides of the bound.
  const dashes = '\u2014'.repeat(Math.floor(REPLY_EXCERPT_LIMIT / 3));
  const em = `${dashes}${'x'.repeat(REPLY_EXCERPT_LIMIT - Buffer.byteLength(dashes))}`;
  expect(Buffer.byteLength(em)).toBe(REPLY_EXCERPT_LIMIT);
  expect(em.length).toBeLessThan(REPLY_EXCERPT_LIMIT);
  expect(fulfillmentProposals([{ id: 0, quote: em }], em, supported)).toEqual([{ id: 0, quote: em }]);
  expect(fulfillmentProposals([{ id: 0, quote: `${em}\u2014` }], `${em}\u2014`, supported)).toBeUndefined();
  // The live excerpt that was refused is admitted; a promise SENTENCE keeps its own 500-byte bound.
  expect(fulfillmentProposals([{ id: 0, quote: A5B.answer }], A5B.answer, supported)).toEqual([{ id: 0, quote: A5B.answer }]);
  const sentence = 'y'.repeat(500), longer = 'y'.repeat(501);
  expect(promiseProposals([{ quote: sentence }], sentence)).toEqual([{ quote: sentence }]);
  expect(promiseProposals([{ quote: longer }], longer)).toBeUndefined();
});
