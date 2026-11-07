/** Recorded-shape replay of live proof 5a5fdc91 room four D1c. Reply bytes, the answer reason and the status counters
 * are recorded (fixture). The raw model declarations were not in the evidence: the declarations below are stand-ins. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/held-result-delivery-1106.json', import.meta.url), 'utf8')) as {
  'reply-d1': { reply: string; update: number }; 'reply-d1hi': { reply: string; update: number }; 'reply-dfill-1': { reply: string; update: number };
  'answerReason-d1hi': string; status: Record<string, { awaitingDelivery: number; workInFlight: number; rejectedDeclarations: number }>;
};
const REQUEST = 'think over which three of the things I have told you matter most for planning my week, and give me that answer in a later message, not in this reply';
const RESTATED = "I have it as an open item: which three of the things you've told me matter most for planning your week.";
const REPORT = 'Only one thing so far: the library card D-4 renewal. Activation ends in about 5 and a half days.';
const key = new Uint8Array(32).fill(41);
const T0 = 1794000000000;
type Decide = (keys: string[], retry: boolean) => Record<string, unknown>;

async function sequence(decide: Decide, options: { unknownSend?: boolean } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'held-result-'))), path = join(root, 'journal.encrypted');
  let now = T0, hiCalls = 0, rework = 0, sending = false;
  const sent: string[] = [];
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 65536, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, prepareModel: input => input.context,
    model: async ({ id, question, context }) => {
      if (id.startsWith('obligation:')) { if (sending) rework++; return JSON.stringify({ outcome: 'report', report: REPORT }); }
      if (question === REQUEST) return JSON.stringify({ reply: fixture['reply-d1'].reply, memory: [],
        openLoops: [{ kind: 'judgment', quote: RESTATED, waitsOn: 'nothing' }] });
      const keys = (JSON.parse(context) as { pendingReports?: { items: { key: string }[] } }).pendingReports?.items.map(item => item.key) ?? [];
      if (question === 'hi') { hiCalls++; return JSON.stringify({ reply: fixture['reply-d1hi'].reply, memory: [], ...decide(keys, hiCalls > 1) }); }
      return JSON.stringify({ reply: fixture['reply-dfill-1'].reply, memory: [], ...(keys.length ? decide(keys, context.includes('declaration was refused')) : {}) });
    },
    send: async ({ text }) => { if (options.unknownSend && sending) return null; sent.push(text); return sent.length; }, checkOutbound: () => {} });
  const say = async (update: number, text: string) => {
    worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(now / 1000) } }]);
    await worker.drain();
  };
  await say(fixture['reply-d1'].update, REQUEST);
  const source = journal.view.order[0]!.id;
  journal.append({ kind: 'summary-reserve', through: fixture['reply-d1'].update, maxInputTokens: 65536, maxOutputTokens: 2048, at: now });
  journal.append({ kind: 'summary', through: fixture['reply-d1'].update, text: 'The operator asked for a later planning answer.',
    commitments: [{ in: 'message', source, quote: REQUEST, owner: 'agent', waitsOn: 'nothing' }], at: now });
  now += LOOP_REVISIT_MS + 60_000;
  for (let i = 0; i < 3; i++) await worker.workObligations();
  expect(loopHealth(journal.view, now).awaitingDelivery).toBe(fixture.status['status-d1hi-before']!.awaitingDelivery);
  sending = true;
  await say(fixture['reply-d1hi'].update, 'hi');
  const work = async () => { for (let i = 0; i < 4; i++) { now += LOOP_REVISIT_MS + 60_000; await worker.workObligations(); } };
  const later = async (count: number) => { for (let i = 1; i <= count; i++) { await say(fixture['reply-d1hi'].update + i, `garden log ${i}`); await work(); } };
  const close = () => { journal.close(); rmSync(root, { recursive: true, force: true }); };
  return { journal, path, sent, later, work, close, health: () => loopHealth(journal.view, now), reworked: () => rework, hiCalls: () => hiCalls, at: () => now };
}
const follow = (text: string) => text.split('Follow-up on "').length - 1;

it('live D1c: a reply in the model\'s own words delivers both waiting results once, and later turns stay clear', async () => {
  // Live shape: the first answer writes its own words and leaves the results undecided or misdeclared; the one re-ask decides them.
  const run = await sequence((keys, retry) => retry ? { carriedReports: keys } : { fulfilled: [{ id: 0, quote: 'Hi Justin!' }, { id: 1, quote: 'Hi Justin!' }] });
  try {
    const reply = run.sent.at(-1)!;
    expect(reply).toContain(fixture['reply-d1hi'].reply);
    expect(follow(reply)).toBe(2);
    expect(reply).not.toContain(REPORT);
    expect(run.health().awaitingDelivery).toBe(0);
    expect(run.health().workInFlight).toBe(0);
    await run.later(14);
    expect(run.reworked()).toBe(0);
    expect(run.health().awaitingDelivery).toBe(0);
    expect(run.sent.slice(-14).every(text => !text.includes('Follow-up on "'))).toBe(true);
    run.journal.close();
    const reopened = openPreviewJournal(run.path, key);
    expect(loopHealth(reopened.view, run.at()).awaitingDelivery).toBe(0);
    expect(await createJournalWorker(reopened, { now: run.at, stopped: () => false, model: async () => { throw Error('no rework after delivery'); },
      send: async () => { throw Error('no resend after restart'); }, checkOutbound: () => {} }).workObligations()).toBe(false);
    reopened.close();
  } finally { run.close(); }
});
it('a model that omits the results entirely is asked once, then the runner attaches what it selects verbatim', async () => {
  const run = await sequence((keys, retry) => retry ? { selectedReports: keys } : {});
  try {
    expect(run.hiCalls()).toBe(2);
    expect(run.sent.at(-1)).toContain(REPORT);
    expect(follow(run.sent.at(-1)!)).toBe(2);
    expect(run.health().awaitingDelivery).toBe(0);
  } finally { run.close(); }
});
it('a genuine objection still returns the result to owned work, and the corrected result then leaves with the next reply', async () => {
  let objected = false;
  const run = await sequence(keys => { if (objected) return { selectedReports: keys };
    objected = true; return { rejectedReports: keys.map(item => ({ key: item, objection: 'The activation end is vague.' })) }; });
  try {
    expect(follow(run.sent.at(-1)!)).toBe(0);
    await run.work();
    expect(run.reworked()).toBeGreaterThan(0);
    expect(run.health().awaitingDelivery).toBe(2);
    await run.later(1);
    expect(follow(run.sent.at(-1)!)).toBe(2);
    expect(run.health().awaitingDelivery).toBe(0);
  } finally { run.close(); }
});
it('a model that never decides appends nothing: the current mind still has to judge a stored report', async () => {
  const run = await sequence(() => ({}));
  try {
    expect(run.hiCalls()).toBe(2);
    expect(run.sent.at(-1)).toBe(fixture['reply-d1hi'].reply);
    expect(run.health().awaitingDelivery).toBe(2);
  } finally { run.close(); }
});
it('a result declared both selected and carried is undecided: nothing is attached and it stays owed', async () => {
  const run = await sequence(keys => ({ selectedReports: keys, carriedReports: keys }));
  try {
    expect(follow(run.sent.at(-1)!)).toBe(0);
    expect(run.health().awaitingDelivery).toBe(2);
    expect(run.reworked()).toBe(0);
  } finally { run.close(); }
});
it('a carried result stays undelivered when the reply outcome is unknown, and is never re-worked or sent again', async () => {
  const run = await sequence(keys => ({ carriedReports: keys }), { unknownSend: true });
  try {
    expect(run.health().awaitingDelivery).toBe(0);
    expect(run.health().deliveryUnknown).toBe(2);
    expect(run.journal.view.closed.size).toBe(0);
    await run.work();
    expect(run.reworked()).toBe(0);
  } finally { run.close(); }
});
