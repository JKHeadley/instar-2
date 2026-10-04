// Plan row #492 (cint-L49 pre-switch gate, group D short, 2026-10-04 07:18-07:53, room two, 15-minute root
// proofroom2-dshort15-20261004-071729): the deferred work ran on its revisit (D1b), but the operator's next message
// ("hi", update 6232211) carried only the two OLDEST finished results — the answer assembly attached at most two
// follow-ups, inside one 3500-byte message — so the deferral's result stayed waiting (D1c). Its "result" was also
// not one: the work step returned the deferral's own holding reply verbatim. And the answering model, not told a
// result was ready, wrote "still queued" beside the results it carried. The texts below are the root's recorded
// shapes (read-only journal dump: obligationWork reports of commitments 0-3, the sent replies of updates 6232206,
// 6232207 and 6232210, and the model body of the reply to 6232211), verbatim.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, READY_RESULT, repeatsSentReply } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';
import { MAX_ANSWER_BYTES } from './reply-parts.js';

const key = new Uint8Array(32).fill(49);
const T0 = 1791123490560, MINUTE = 60_000, REVISIT = 15 * MINUTE;
const LIBRARY = 'Can you renew my library card D-2 on the city library website?';
const LIBRARY_REPLY = 'I can\'t do that — renewing your library card means logging into the city library\'s website with your own account credentials and submitting a form, which is an account write on a third-party site. My tools here are read-only web access, files, and shell inside this sandbox; I have no ability to authenticate as you or submit forms on external accounts, and that kind of write isn\'t enabled in this preview. If it helps, I could look up the library\'s renewal policy or hours from their public pages — just say so.';
/** The loop sentence (a reply loop's quote is bounded at 500 bytes; the live loop was the summary's, on the message). */
const LIBRARY_LOOP = 'If it helps, I could look up the library\'s renewal policy or hours from their public pages — just say so.';
/** commitment:0's recorded work report: a paraphrase of that refusal (not a repeat of it). */
const LIBRARY_REPORT = 'I can\'t renew your library card D-2 on the city library website — that requires logging into your account with your own credentials and submitting a form, which counts as an account write on a third-party site. My tools here are limited to read-only web access, files, and sandboxed shell; I have no ability to authenticate as you or submit forms on external accounts, and this preview doesn\'t enable that kind of write. If it helps, I can look up the library\'s renewal policy, requirements, or hours from their public pages instead — just let me know.';
const K = 'From now on, end every shopping list you write for me with "— K".';
const K_REPLY = 'Got it — from now on I\'ll end every shopping list I write for you with "— K".';
/** commitment:1's recorded work report: the acknowledgement again plus a new note. */
const K_REPORT = 'Got it — from now on I\'ll end every shopping list I write for you with "— K".\n\n(Quick note on the library-card task: that was a one-off capability refusal — I don\'t have account-write access to do it — and I already gave you the complete answer plus an offer to look up public renewal info instead. That\'s fully resolved on my end, not a pending blocker, so there\'s nothing further to track there unless you want me to look something up.)';
const D1 = 'Please do not answer this one now. Keep it as an open item: think over which three of the things I have told you matter most for planning my week, and give me that answer in a later message, not in this reply. For now just confirm you have it as an open item.';
const HOLD = 'Got it — I won\'t answer that now. I\'m holding it as an open item: I\'ll think over which three things you\'ve told me matter most for planning your week, and bring you that answer in a later message.';
const HOLD_LOOP = 'I\'m holding it as an open item: I\'ll think over which three things you\'ve told me matter most for planning your week, and bring you that answer in a later message.';
/** The answer the operator asked for (the recorded run never produced one: its step returned HOLD verbatim). */
const RANKING = 'The three that matter most for planning your week: renewing library card D-2 (it needs you on the library site), the "— K" sign-off on shopping lists, and keeping this week\'s open items in one place.';
/** The model body of the recorded reply to "hi" (update 6232211). */
const HI_BODY = 'Hi! Just flagging: I\'ve still got that open item queued — ranking the top three things that matter most for planning your week. Whenever you\'re ready for it, say the word (or remind me of what\'s top of mind) and I\'ll give you the answer then.';

const loopAnswer = (reply: string, quote: string) => JSON.stringify({ reply, memory: [], openLoops: [{ kind: 'deferral', quote, waitsOn: 'nothing' }] });

function world(root: string, work: (quote: string, attempt: number) => string) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249', chat: '7812716706',
    operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0, loopRevisitMs: REVISIT });
  const clock = { now: T0 }, sent: string[] = [], answers: string[] = [], contexts: string[] = [], attempts = new Map<string, number>();
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        const quote = (JSON.parse(input.context) as { obligation: { quote: string } }).obligation.quote;
        const n = (attempts.get(quote) ?? 0) + 1; attempts.set(quote, n);
        return work(quote, n);
      }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [], memory: [] });
      contexts.push(input.context);
      return answers.shift() ?? JSON.stringify({ reply: 'Okay.', memory: [] });
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  let update = 6232206;
  const say = async (text: string, answer: string) => {
    answers.push(answer);
    worker.intake([{ update_id: update++, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  /** Runs every due work step, one bounded step per tick, as the launcher's quiet loop does. */
  const tick = async () => { for (let i = 0; i < 10 && await worker.workObligations(); i++) { /* one step per tick */ } };
  return { journal, clock, say, tick, sent, contexts };
}

it('a work report that only repeats the reply already sent is not a result (recorded shapes, both sides)', () => {
  // The deferral's recorded step output against its recorded sent reply: the same text, so no result.
  expect(repeatsSentReply(HOLD, `PREVIEW — ${HOLD}`)).toBe(true);
  expect(repeatsSentReply(HOLD_LOOP, `PREVIEW — ${HOLD}`)).toBe(true);
  expect(repeatsSentReply(` ${HOLD.replace(/ /gu, '  ')}\n`, `PREVIEW — ${HOLD}`)).toBe(true);
  // A paraphrase, an acknowledgement with a new note, and the asked-for answer each say something new.
  expect(repeatsSentReply(LIBRARY_REPORT, `PREVIEW — ${LIBRARY_REPLY}`)).toBe(false);
  expect(repeatsSentReply(K_REPORT, `PREVIEW — ${K_REPLY}`)).toBe(false);
  expect(repeatsSentReply(RANKING, `PREVIEW — ${HOLD}`)).toBe(false);
  expect(repeatsSentReply(HOLD, undefined)).toBe(false);
});

it('delivers every finished result on the next message, in order, and never an echo of the deferral as its result', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-deliver-all-')));
  try {
    // The recorded step outputs: commitments 0 and 1 report, the deferral first echoes its holding reply.
    const w = world(root, (quote, attempt) => JSON.stringify({ outcome: 'report', report: quote === LIBRARY_LOOP ? LIBRARY_REPORT
      : quote === K_REPLY ? K_REPORT : attempt === 1 ? HOLD : RANKING }));
    await w.say(LIBRARY, loopAnswer(LIBRARY_REPLY, LIBRARY_LOOP));
    w.clock.now += MINUTE; await w.say(K, loopAnswer(K_REPLY, K_REPLY));
    w.clock.now += 2 * MINUTE; await w.say(D1, loopAnswer(HOLD, HOLD_LOOP));
    const ids = [LIBRARY_LOOP, K_REPLY, HOLD_LOOP].map(quote => w.journal.view.commitments.findIndex(note => note.quote === quote));
    expect(ids, JSON.stringify(w.journal.view.commitments.map(n => n.quote))).not.toContain(-1);
    const sends = w.sent.length;
    // The quiet window: every loop's step runs. The deferral's echo is a failed attempt, never a waiting result.
    w.clock.now += REVISIT + 10 * MINUTE; await w.tick();
    const deferral = w.journal.view.obligationWork[`commitment:${String(ids[2])}`]!;
    expect(deferral.outcome).toBe('failed');
    expect(deferral.report).toBeUndefined();
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(2);
    // Its next revisit does the work; three results now wait, and status says so (D2's line, its count truthful).
    w.clock.now += REVISIT + MINUTE; await w.tick();
    expect(w.journal.view.obligationWork[`commitment:${String(ids[2])}`]).toMatchObject({ outcome: 'report', report: { text: RANKING } });
    const waiting = loopHealth(w.journal.view, w.clock.now);
    expect(waiting.awaitingDelivery).toBe(3);
    expect(waiting.deliveryInhibition).toBe('no grant for unsolicited sends; 3 finished results wait for your next message');
    expect(w.sent.length).toBe(sends);
    // "hi": the recorded body, then EVERY result, in schedule order (D1c), and nothing waits after the receipt.
    w.clock.now += MINUTE;
    await w.say('hi', JSON.stringify({ reply: HI_BODY, memory: [] }));
    const reply = w.sent.slice(sends).join('\n');
    const at = [LIBRARY_REPORT, K_REPORT, RANKING].map(text => reply.indexOf(text));
    expect(at.every(index => index > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(reply.split('Follow-up on "').length - 1).toBe(3);
    expect(reply).toContain('Follow-up on "I\'m holding it as an open item');
    expect(reply).not.toContain(`: ${HOLD}`);
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    // The "hi" packet told the answering model those results were ready, not still queued.
    const packet = JSON.parse(w.contexts.at(-1)!) as { commitments?: { items: { quote: string; result?: string }[] }[] };
    const items = (packet.commitments ?? []).flatMap(entry => entry.items);
    expect(items.filter(item => item.result === READY_RESULT).length).toBeGreaterThanOrEqual(3);
    // Before any work ran (the deferral's own turn), no item was marked ready.
    expect(w.contexts[2]).not.toContain(READY_RESULT);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('splits a reply too long for one message rather than holding results back, and keeps past-bound results for the next message', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-deliver-split-')));
  try {
    // Fourteen results of ~1400 bytes: more than one Telegram message, more than the answer bound together.
    const long = (n: number) => `Result ${String(n)}: ${'the finished work, written out in full. '.repeat(35)}`.trim();
    const quotes = Array.from({ length: 14 }, (_, n) => `I'll come back to item ${String(n)} in a later message.`);
    const w = world(root, quote => JSON.stringify({ outcome: 'report', report: long(quotes.indexOf(quote)) }));
    for (const [n, quote] of quotes.entries()) { w.clock.now += MINUTE; await w.say(`Item ${String(n)}, later please.`, loopAnswer(`Sure. ${quote}`, quote)); }
    w.clock.now += REVISIT + 10 * MINUTE;
    for (let i = 0; i < 3; i++) await w.tick();
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(14);
    const sends = w.sent.length;
    w.clock.now += MINUTE; await w.say('hi', JSON.stringify({ reply: 'Hi!', memory: [] }));
    const first = w.sent.slice(sends);
    // Several ordered messages carried the one reply; every attached result reached the operator in order.
    expect(first.length).toBeGreaterThan(1);
    const carried = Array.from({ length: 14 }, (_, n) => n).filter(n => first.join('\n').includes(long(n)));
    expect(carried.length).toBeGreaterThan(2);
    expect(carried).toEqual(Array.from({ length: carried.length }, (_, n) => n));
    expect(Buffer.byteLength(first.join(''))).toBeLessThan(MAX_ANSWER_BYTES + 4096);
    // What did not fit the answer bound still waits, never dropped, and the next message carries it.
    const left = 14 - carried.length;
    expect(left).toBeGreaterThan(0);
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(left);
    const again = w.sent.length;
    w.clock.now += MINUTE; await w.say('and?', JSON.stringify({ reply: 'Here is the rest.', memory: [] }));
    const rest = w.sent.slice(again).join('\n');
    for (let n = carried.length; n < 14; n++) expect(rest).toContain(long(n));
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);
