/** Recorded-shape replay of live proof 5a5fdc91 room four D1c. Reply bytes, the answer reason and the status counters
 * are recorded (fixture). The raw model declarations were not in the evidence: the declarations below are stand-ins. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { loopHealth } from './obligations.js';
import { parseReplyRevision, replyRevisionQuestion, type ReplyRule } from './reply-check.js';
import { carriedProposals } from './agent-commitment.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/held-result-delivery-1106.json', import.meta.url), 'utf8')) as {
  'reply-d1': { reply: string; update: number }; 'reply-d1hi': { reply: string; update: number }; 'reply-dfill-1': { reply: string; update: number };
  'answerReason-d1hi': string; status: Record<string, { awaitingDelivery: number; workInFlight: number; rejectedDeclarations: number }>;
};
const REQUEST = 'think over which three of the things I have told you matter most for planning my week, and give me that answer in a later message, not in this reply';
const RESTATED = "I have it as an open item: which three of the things you've told me matter most for planning your week.";
const REPORT = 'Only one thing so far: the library card D-4 renewal. Activation ends in about 5 and a half days.';
const key = new Uint8Array(32).fill(41);
const T0 = 1794000000000;
/** Stand-in declaration: the words of the recorded hi reply that give the result. */
const GIVEN = "So far you've told me only one thing, so I can't honestly name three:";
const carry = (keys: string[], quote = GIVEN) => ({ carriedReports: keys.map(item => ({ key: item, quote })) });
type Decide = (keys: string[], retry: boolean) => Record<string, unknown>;
const RULES: ReplyRule[] = ['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self', 'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker'];
/** Synthetic reviewer and reviser (fault injection): a revision replaces the prose, or a named claim is cut from it. */
type Review = { revision?: string; renew?: (keys: string[]) => unknown; excise?: string; remainder?: 'pass' | 'incoherent' };

async function sequence(decide: Decide, options: { unknownSend?: boolean; review?: Review } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'held-result-'))), path = join(root, 'journal.encrypted');
  let now = T0, hiCalls = 0, rework = 0, sending = false, carriedOffered: { key: string; text: string }[] = [];
  const question = { at: '' };
  const sent: string[] = [], review = options.review;
  let revised = 0;
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 65536, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, prepareModel: input => review ? prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now) : input.context,
    model: async ({ id, question: asked, context }) => {
      const parsedContext = context; question.at = asked;
      if (id.startsWith('obligation:')) { if (sending) rework++; return JSON.stringify({ outcome: 'report', report: REPORT }); }
      if (asked === REQUEST) return JSON.stringify({ reply: fixture['reply-d1'].reply, memory: [],
        openLoops: [{ kind: 'judgment', quote: RESTATED, waitsOn: 'nothing' }] });
      const keys = (JSON.parse(parsedContext) as { pendingReports?: { items: { key: string }[] } }).pendingReports?.items.map(item => item.key) ?? [];
      if (asked === 'hi') { hiCalls++; return JSON.stringify({ reply: fixture['reply-d1hi'].reply, memory: [], ...decide(keys, hiCalls > 1) }); }
      return JSON.stringify({ reply: fixture['reply-dfill-1'].reply, memory: [], ...(keys.length ? decide(keys, parsedContext.includes('declaration was refused')) : {}) });
    },
    ...(review ? { replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(RULES.map(rule =>
        [rule, { type: 'noul', noul: sending && question.at === 'hi' && rule === 'defers_work' ? 0.9 : 0.02 }])) }, latencyMs: 0 }),
      escalate: async (_text: string, _id: string, _prompt?: string, _rules?: unknown, _deadline?: number, kind?: string) => {
        if (!sending || question.at !== 'hi') return { verdict: 'pass' as const, ruleIds: [] as ReplyRule[], confidence: null, latencyMs: 0 };
        if (kind === 'revision') return review.remainder === 'incoherent'
          ? { verdict: 'violation' as const, ruleIds: ['incoherent_remainder'] as ReplyRule[], confidence: null, latencyMs: 0 }
          : { verdict: 'pass' as const, ruleIds: [] as ReplyRule[], confidence: null, latencyMs: 0 };
        const reasonText = review.excise ? `The promise "${review.excise}" has no recorded loop.` : 'Correct the unsupported claim.';
        return { verdict: 'violation' as const, ruleIds: ['defers_work'] as ReplyRule[], confidence: null, latencyMs: 0, reason: reasonText,
          findings: [{ rule: 'defers_work' as const, verdict: 'violation' as const, reason: reasonText }] };
      },
      revise: async (input: { text: string; objections?: string[]; ruleIds: ReplyRule[]; carried?: { key: string; text: string }[] }) => { revised++;
        carriedOffered = input.carried ?? [];
        return { state: 'complete' as const, text: review.revision ?? input.text,
          ...(review.renew ? { carriedReports: review.renew(carriedOffered.map(item => item.key)) } : {}),
          dispositions: (input.objections ?? input.ruleIds).map(objection => ({ objection, decision: 'accept' as const, reason: 'Accepted.' })) }; } } } : {}),
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
  return { journal, path, sent, later, work, close, health: () => loopHealth(journal.view, now), reworked: () => rework, hiCalls: () => hiCalls, at: () => now, revisions: () => revised, offered: () => carriedOffered };
}
const follow = (text: string) => text.split('Follow-up on "').length - 1;

it('live D1c: a reply in the model\'s own words delivers both waiting results once, and later turns stay clear', async () => {
  // Live shape: the first answer writes its own words and leaves the results undecided or misdeclared; the one re-ask decides them.
  const run = await sequence((keys, retry) => retry ? carry(keys) : { fulfilled: [{ id: 0, quote: 'Hi Justin!' }, { id: 1, quote: 'Hi Justin!' }] });
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
  const run = await sequence(keys => ({ selectedReports: keys, ...carry(keys) }));
  try {
    expect(follow(run.sent.at(-1)!)).toBe(0);
    expect(run.health().awaitingDelivery).toBe(2);
    expect(run.reworked()).toBe(0);
  } finally { run.close(); }
});
it('a carried result stays undelivered when the reply outcome is unknown, and is never re-worked or sent again', async () => {
  const run = await sequence(keys => carry(keys), { unknownSend: true });
  try {
    expect(run.health().awaitingDelivery).toBe(0);
    expect(run.health().deliveryUnknown).toBe(2);
    expect(run.journal.view.closed.size).toBe(0);
    await run.work();
    expect(run.reworked()).toBe(0);
  } finally { run.close(); }
});

// Rules 8, 26. Reply bytes are recorded; declarations, reviewer and revision are synthetic fault injection.
const KEPT = 'For your week, renew library card D-4; you have only told me that one priority.';
const LOST = 'Hello Justin. Good to hear from you.';
const heldCleanly = (run: Awaited<ReturnType<typeof sequence>>) => {
  expect(run.health().awaitingDelivery).toBe(2);
  expect(run.journal.view.closed.size).toBe(0);
  expect(run.reworked()).toBe(0);
  expect(Object.values(run.journal.view.obligationWork).every(work => work.report !== undefined && work.report.delivered === undefined && work.report.boundTo === undefined)).toBe(true);
};
it('review repro, retained: a revision that renews the words for each result delivers both and closes with those words', async () => {
  const run = await sequence(keys => carry(keys), { review: { revision: KEPT, renew: keys => keys.map(item => ({ key: item, quote: KEPT })) } });
  try {
    expect(run.revisions()).toBe(1);
    expect(run.offered().map(item => item.text)).toEqual([REPORT, REPORT]);
    expect(run.sent.at(-1)).toContain(KEPT);
    expect(follow(run.sent.at(-1)!)).toBe(2);
    expect(run.health().awaitingDelivery).toBe(0);
    expect([...run.journal.view.closed.values()].map(item => item.quote)).toEqual([KEPT, KEPT]);
    run.journal.close();
    const reopened = openPreviewJournal(run.path, key);
    expect(reopened.view.closed.size).toBe(2);
    reopened.close();
  } finally { run.close(); }
});
it('review repro, removed: a revision that drops the answer keeps both results owed, sends no marker, and the next reply delivers them once', async () => {
  let held = true;
  const run = await sequence(keys => held ? carry(keys) : { selectedReports: keys }, { review: { revision: LOST } });
  try {
    expect(run.sent.at(-1)).toContain(LOST);
    expect(follow(run.sent.at(-1)!)).toBe(0);
    expect(run.sent.at(-1)).not.toContain('answered above.');
    heldCleanly(run);
    run.journal.close();
    const reopened = openPreviewJournal(run.path, key);
    expect(loopHealth(reopened.view, run.at()).awaitingDelivery).toBe(2);
    reopened.close();
  } finally { run.close(); }
  held = false;
});
it('the owed result survives to the next reply after a revision removed it, and is delivered exactly once', async () => {
  let turn = 0;
  const run = await sequence(keys => turn++ === 0 ? carry(keys) : { selectedReports: keys }, { review: { revision: LOST } });
  try {
    heldCleanly(run);
    await run.later(2);
    const messages = run.sent.filter(text => text.includes(REPORT));
    expect(messages).toHaveLength(1);
    expect(follow(messages[0]!)).toBe(2);
    expect(run.health().awaitingDelivery).toBe(0);
    expect(run.journal.view.closed.size).toBe(2);
  } finally { run.close(); }
});
it('a revision that keeps the declared words needs no renewal; a renewal quoting words it does not hold counts for nothing', async () => {
  const keptWords = `Hi Justin. ${GIVEN} Only the library card D-4 so far.`;
  const kept = await sequence(keys => carry(keys), { review: { revision: keptWords } });
  try {
    expect(follow(kept.sent.at(-1)!)).toBe(2);
    expect(kept.health().awaitingDelivery).toBe(0);
  } finally { kept.close(); }
  const invented = await sequence(keys => carry(keys), { review: { revision: LOST, renew: keys => keys.map(item => ({ key: item, quote: 'Renew library card D-4 this week.' })) } });
  try {
    expect(follow(invented.sent.at(-1)!)).toBe(0);
    heldCleanly(invented);
  } finally { invented.close(); }
});
it('the runner\'s own line is never the evidence: wording the marker repeats does not show the reply gave the result', async () => {
  const echoed = `${LOST}\n\nFollow-up on "${RESTATED}": answered above.`;
  const run = await sequence(keys => carry(keys), { review: { revision: echoed, renew: keys => keys.map(item => ({ key: item, quote: RESTATED })) } });
  try {
    heldCleanly(run);
  } finally { run.close(); }
  // At the answer too: a key list without quoted words, or a quote only the marker holds, is undecided.
  expect(carriedProposals(['commitment:0'], LOST)).toEqual([]);
  expect(carriedProposals([{ key: 'commitment:0', quote: 'not in this reply' }], LOST)).toEqual([]);
  expect(carriedProposals([{ key: 'commitment:0', quote: 'Good to hear from you.' }], LOST)).toEqual([{ key: 'commitment:0', quote: 'Good to hear from you.' }]);
  const bare = await sequence(keys => ({ carriedReports: keys }));
  try {
    expect(bare.hiCalls()).toBe(2);
    expect(follow(bare.sent.at(-1)!)).toBe(0);
    expect(bare.health().awaitingDelivery).toBe(2);
  } finally { bare.close(); }
});
it.each([
  ['the cut sentence held the declared words: marker gone, results owed', GIVEN, 0, 2],
  ['the cut sentence did not: the words and markers stay, results delivered', "I have nothing from you for spots 2 and 3, and I won't make things up to fill them.", 2, 0]
] as const)('claim excision, %s', async (_name, claim, lines, owed) => {
  const run = await sequence(keys => carry(keys), { review: { excise: claim, remainder: 'pass' } });
  try {
    expect(run.sent.at(-1)).not.toContain(claim);
    expect(run.sent.at(-1)).toContain('Renewing library card D-4');
    expect(run.journal.view.order.at(-1)!.release?.withheld?.removed).toHaveLength(1);
    expect(follow(run.sent.at(-1)!)).toBe(lines);
    expect(run.health().awaitingDelivery).toBe(owed);
    expect(run.journal.view.closed.size).toBe(2 - owed);
    expect(run.reworked()).toBe(0);
  } finally { run.close(); }
});
it('results-only: rejected prose takes its marker with it; only the verbatim result leaves and the own-words result stays owed', async () => {
  const run = await sequence(keys => ({ selectedReports: [keys[0]], ...carry([keys[1]!]) }), { review: { excise: GIVEN, remainder: 'incoherent' } });
  try {
    const reply = run.sent.at(-1)!;
    expect(reply).toContain(REPORT);
    expect(reply).not.toContain('answered above.');
    expect(follow(reply)).toBe(1);
    expect(run.health().awaitingDelivery).toBe(1);
    expect(run.journal.view.closed.size).toBe(1);
    expect(run.reworked()).toBe(0);
  } finally { run.close(); }
});
it('the revision call asks for renewed words only when it has own-words results, and reads them back', () => {
  expect(replyRevisionQuestion(['defers_work'])).not.toContain('carriedReports');
  expect(replyRevisionQuestion(['defers_work'], undefined, undefined, [{ key: 'commitment:0', text: REPORT }])).toContain('carriedReports');
  const given = [{ key: 'commitment:0', quote: KEPT }];
  expect(parseReplyRevision(JSON.stringify({ reply: KEPT, carriedReports: given }), ['defers_work']).carriedReports).toEqual(given);
  expect(parseReplyRevision(KEPT, ['defers_work']).carriedReports).toBeUndefined();
});

it('an unrelated reply can defer every finished result without a re-ask or work attempt', async () => {
  const run = await sequence(keys => ({ deferredReports: keys }));
  try {
    expect(run.hiCalls()).toBe(1);
    await run.work();
    heldCleanly(run);
  } finally { run.close(); }
});
it('reply review removing a verbatim report leaves the stored result waiting, not rejected', async () => {
  const run = await sequence(keys => ({ selectedReports: keys }), { review: { excise: REPORT } });
  try {
    await run.work();
    heldCleanly(run);
  } finally { run.close(); }
});
