/** Recorded-shape fixture, NOT replay: only reply/status bytes and update ids were supplied.
 * The summary, scheduled reports and model fulfillment decisions below are explicit stand-ins. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/duplicate-promise-d1-1106.json', import.meta.url), 'utf8')) as {
  'reply-d1': { reply: string; update: number }; 'reply-d1hi': { reply: string; update: number };
  'status-d1hi-before': { obligations: { awaitingDelivery: number } };
  'status-d1hi': { obligations: { awaitingDelivery: number } };
};
const REQUEST = 'think over which three of the things I have told you matter most for planning my week, and give me that answer in a later message, not in this reply';
const SHOPPING = 'From now on, end every shopping list you write for me with "— K".';
const PROMISE = "I'll give you that answer in a later message, not now.";
const EXCERPT = "the three things you've told me that matter most for planning your week";
const key = new Uint8Array(32).fill(23);
const T0 = 1794000000000;

for (const representation of ['summary', 'loop'] as const) {
  it(`closes the recorded D1 request and its ${representation} reply promise together, without resending after restart`, async () => {
    await scenario(representation, 'delivered');
  });
}
for (const neighbor of ['separate', 'unknown', 'omitted', 'invented', 'unfinished'] as const) {
  it(`preserves the ${neighbor} neighbor of a delivered request`, async () => {
    await scenario('loop', neighbor);
  });
}
async function scenario(representation: 'summary' | 'loop', mode: 'delivered' | 'separate' | 'unknown' | 'omitted' | 'invented' | 'unfinished') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'duplicate-promise-'))), path = join(root, 'journal.encrypted');
  let now = T0, promiseId = -1, requestId = -1, shoppingId = -1;
  const sent: string[] = [];
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 65536, cursor: 0 });
  const promise = mode === 'separate' ? 'I will also check the library opening hours.' : PROMISE;
  const firstReply = mode === 'separate' ? `${fixture['reply-d1'].reply} ${promise}` : fixture['reply-d1'].reply;
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, prepareModel: input => input.context,
    model: async ({ id, question, context }) => {
      if (id.startsWith('obligation:')) return JSON.stringify(mode === 'unfinished' && id.startsWith(`obligation:commitment:${promiseId}:`)
        ? { outcome: 'continue', note: 'A source still needs checking.', completion: [{ id: 'remaining', work: 'Check the remaining source', state: 'open' }] }
        : { outcome: 'report', report: 'Completed work for this recorded obligation.' });
      if (question === `${SHOPPING}\n${REQUEST}`) return JSON.stringify({ reply: firstReply, memory: [],
        ...(representation === 'loop' ? { openLoops: [{ kind: 'promise', quote: promise, waitsOn: 'nothing' }] } : {}) });
      if (question === 'hi') {
        const offered = (JSON.parse(context) as { commitments?: { items: { id: number }[] }[] }).commitments?.flatMap(group => group.items) ?? [];
        expect(offered.some(item => item.id === promiseId)).toBe(true);
        return JSON.stringify({ reply: fixture['reply-d1hi'].reply, memory: [], selectedReports: [`commitment:${requestId}`, `commitment:${shoppingId}`],
          ...(mode === 'omitted' || mode === 'separate' ? {} : { fulfilled: [{ id: promiseId,
            quote: mode === 'invented' ? 'This excerpt was never delivered.' : EXCERPT }] }) });
      }
      return JSON.stringify({ reply: 'Hello again.', memory: [] });
    },
    send: async ({ text }) => { if (mode === 'unknown' && now > T0) return null; sent.push(text); return sent.length; }, checkOutbound: () => {} });
  const say = async (update: number, text: string) => {
    worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(now / 1000) } }]);
    await worker.drain();
  };
  try {
    await say(fixture['reply-d1'].update, `${SHOPPING}\n${REQUEST}`);
    const source = journal.view.order[0]!.id;
    journal.append({ kind: 'summary-reserve', through: fixture['reply-d1'].update, maxInputTokens: 65536, maxOutputTokens: 2048, at: now });
    journal.append({ kind: 'summary', through: fixture['reply-d1'].update, text: 'The operator requested a later planning answer and a shopping sign-off.',
      commitments: [
        { in: 'message', source, quote: REQUEST, owner: 'agent', waitsOn: 'nothing' },
        { in: 'message', source, quote: SHOPPING, owner: 'agent', waitsOn: 'nothing' },
        ...(representation === 'summary' ? [{ in: 'reply' as const, source, quote: promise, owner: 'agent' as const, waitsOn: 'nothing' as const }] : []),
      ], at: now });
    requestId = journal.view.commitments.findIndex(note => note.quote === REQUEST);
    shoppingId = journal.view.commitments.findIndex(note => note.quote === SHOPPING);
    promiseId = journal.view.commitments.findIndex(note => note.quote === promise);
    expect(journal.view.commitments[promiseId]!.agentPromise).toBeUndefined();
    now += LOOP_REVISIT_MS + 60_000;
    for (let i = 0; i < 3; i++) expect(await worker.workObligations()).toBe(true);
    expect(loopHealth(journal.view, now).awaitingDelivery).toBe(mode === 'unfinished' ? 2 : fixture['status-d1hi-before'].obligations.awaitingDelivery);
    await say(fixture['reply-d1hi'].update, 'hi');
    const closes = mode === 'delivered';
    expect(journal.view.closed.has(requestId)).toBe(mode !== 'unknown');
    expect(journal.view.closed.has(shoppingId)).toBe(mode !== 'unknown');
    expect(journal.view.closed.has(promiseId)).toBe(closes);
    expect(loopHealth(journal.view, now).awaitingDelivery).toBe(closes || mode === 'unfinished' ? 0 : 1);
    if (closes) {
      expect(sent.at(-1)).toContain(EXCERPT);
      expect(fixture['status-d1hi'].obligations.awaitingDelivery).toBe(1); // historical failure stays unchanged
      await say(fixture['reply-d1hi'].update + 1, 'hello again');
      expect(sent.at(-1)).toBe('Hello again.');
    }
    journal.close();
    {
      const reopened = openPreviewJournal(path, key);
      expect(reopened.view.closed.has(promiseId)).toBe(closes);
      expect(loopHealth(reopened.view, now).awaitingDelivery).toBe(closes || mode === 'unfinished' ? 0 : 1);
      expect(await createJournalWorker(reopened, { now: () => now, stopped: () => false,
        model: async () => { throw Error('No rework after delivery'); }, send: async () => { throw Error('No resend after restart'); },
        checkOutbound: () => {} }).workObligations()).toBe(false);
      reopened.close();
    }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}
