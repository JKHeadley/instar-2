// Plan row #585 (live build sb-w4-d1b ceeb91f3, group D short, 2026-10-05 11:22-12:18, room two, 15-minute root
// proofroom2-dshort15-20261005-112153, results D-proofroom2-20261005-112229): D1c FAILED. Three finished results
// waited (status d1-24h: `awaitingDelivery: 3`, `deliveryInhibition: "no grant for unsolicited sends; 3 finished
// results wait for your next message"`), the reply to "hi" (update 6232450) carried two of them under the product's
// own `Follow-up on "` wording — and afterwards `awaitingDelivery` was 2, not 0: only ONE result was marked
// delivered although the operator had received two in full.
//
// The cause is in the claim-scoped floor, not in the delivery rule. That turn's contextual review returned
// `violation` on `defers_work` and `unrecorded_blocker` (status d1hi `lastReplyCheck`), so the floor excised the
// sentences carrying those named claims and sent the rest (`claimScopedWithholds` after the turn: `trimmed: 1,
// sentencesRemoved: 3, unlocatedClaims: 1`). `exciseNamedClaims` then re-joined every KEPT segment with a
// NORMALIZED separator — a blank line became one newline, a wide gap one space — so passages no reviewer had
// named came back rewritten. The recorded reply shows it: the runner appends each result as `\n\nFollow-up on …`
// and the delivered text carries a single newline there. A result whose own text spans such a separator therefore
// no longer occurred verbatim in the sent reply, and `sentObligations` — which decides the claims "against the
// reply exactly as it is written" — dropped it. The result had reached the operator in full and was never marked
// delivered; its commitment stayed open and the same text would be attached and reflowed again on every later
// reply (Rules 2, 4, 8, 22, 46, 86, 92).
//
// The recorded shapes replayed here: the three-results-waiting state and the delivery wording are the live D run's;
// the report texts are the recorded shapes of tests/preview/journal-deliver-all.test.ts (the 2026-10-04 room-two
// dump), of which K_REPORT is the one carrying a blank line; the review verdict shape, its rule ids and the
// finding/reason shape are the live `lastReplyCheck` of update 6232450. The candidate body is reconstructed (the
// journal keeps reply bodies; `status`/`inspect` expose only their digest) and carries the named claim verbatim.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, claimScopedWithholds } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { loopHealth } from './obligations.js';
import { exciseNamedClaims, type ReplyFinding, type ReplyRule } from './reply-check.js';

const key = new Uint8Array(32).fill(53);
const T0 = 1791224556290, MINUTE = 60_000, REVISIT = 15 * MINUTE;

const LIBRARY = 'Can you renew my library card D-112229 on the city library website?';
const LIBRARY_REPLY = 'I can\'t do that one — renewing your library card means logging into the city library\'s website with your own account credentials.';
const LIBRARY_LOOP = 'I can\'t do that one — renewing your library card means logging into the city library\'s website with your own account credentials.';
/** commitment:0's recorded work report (journal-deliver-all.test.ts, 2026-10-04 room-two dump), one paragraph. */
const LIBRARY_REPORT = 'I can\'t renew your library card D-112229 on the city library website — that requires logging into your account with your own credentials and submitting a form, which counts as an account write on a third-party site. If it helps, I can look up the library\'s renewal policy, requirements, or hours from their public pages instead — just let me know.';
const K = 'From now on, end every shopping list you write for me with "— K".';
const K_REPLY = 'Got it — from now on, I\'ll end every shopping list I write for you with "— K".';
/** commitment:1's recorded work report: the acknowledgement again plus a new note AFTER A BLANK LINE. */
const K_REPORT = 'Got it — from now on I\'ll end every shopping list I write for you with "— K".\n\n(Quick note on the library-card task: that was a one-off capability refusal — I don\'t have account-write access to do it — and I already gave you the complete answer plus an offer to look up public renewal info instead.)';
const GARDEN = 'One more open item, and again no answer now please: work out a better name for my garden blog and tell me in a later message. Just confirm it is on your list.';
const GARDEN_REPLY = 'Got it — added to the list: come up with a better name for your garden blog and give it to you in a later message.';
/** commitment:2's report, shaped like the live one (update 6232450): an intro line, a numbered list, then a pick. */
const GARDEN_REPORT = 'Garden blog name ideas, based on what you\'ve got growing and your dawn-watering routine:\n\n1. Dawn Rows — nods to the daily dawn watering and the row-by-row logging.\n2. The Damp Mulch Journal — a little wink at your recurring log line.\n3. Stake & Sprout — playful, references the staking you do.\n\nMy pick: "Dawn Rows" — short, memorable, and true to how you actually tend the place.';

/** The model body of the reply to "hi", carrying one sentence the live review named under `defers_work`. */
const DEFERRED_CLAIM = 'Still working out the "three things that matter most for your week" one — will bring that separately.';
const HI_BODY = `Hi! Two things I owed you, and they follow below. ${DEFERRED_CLAIM} Sorry I can't just push the library one through.`;
/** The live verdict shape of update 6232450 (status d1hi `lastReplyCheck`), with this candidate's quoted claim. */
const HI_FINDINGS: ReplyFinding[] = [
  { rule: 'claims_blocked', verdict: 'pass', reason: 'The library-card refusal cites a recorded account-write limit.' },
  { rule: 'defers_work', verdict: 'violation',
    reason: `defers_work: Reply says "${DEFERRED_CLAIM}", deferring work, but declaredObligations.loops is empty and does not record this deferral.` },
];
const HI_REASON = HI_FINDINGS[1]!.reason;

const loopAnswer = (reply: string, quote: string) => JSON.stringify({ reply, memory: [],
  openLoops: [{ kind: 'deferral', quote, waitsOn: 'nothing' }] });
const jevScores = (flagged: Partial<Record<ReplyRule, number>>) => ({ model: 'jev-1.13.0',
  answers: Object.fromEntries((['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self',
    'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker'] as ReplyRule[])
    .map(rule => [rule, { type: 'noul', noul: flagged[rule] ?? 0.02 }])) });

/** The run: three deferrals, their work steps, then "hi". Only the "hi" candidate is reviewed as a violation —
 * exactly the live shape, where every earlier reply passed and the floor fired once, on the delivering reply. */
function world(root: string, reports: Record<string, string>) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249',
    chat: '7812716706', operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0,
    loopRevisitMs: REVISIT });
  const clock = { now: T0 }, sent: string[] = [], answers: string[] = [];
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
    timeZone: 'America/Los_Angeles',
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        const { obligation } = JSON.parse(input.context) as { obligation: { quote: string } };
        return JSON.stringify({ outcome: 'report', report: reports[obligation.quote] ?? 'Done.' });
      }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [],
        commitments: [], closed: [], memory: [] });
      return answers.shift() ?? JSON.stringify({ reply: 'Okay.', memory: [] });
    },
    replyCheck: { elapsedMs: () => 0,
      jev: async (body: string) => ({ value: jevScores(body.includes(DEFERRED_CLAIM) ? { defers_work: 0.9 } : {}) as unknown,
        latencyMs: 170 }),
      escalate: async (text: string) => text.includes(DEFERRED_CLAIM)
        ? { verdict: 'violation' as const, ruleIds: ['defers_work'] as ReplyRule[], confidence: null, latencyMs: 27173,
          reason: HI_REASON, findings: HI_FINDINGS }
        : { verdict: 'pass' as const, ruleIds: [] as ReplyRule[], confidence: null, latencyMs: 9000 } },
    send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; },
    checkOutbound: () => {} });
  let update = 6232434;
  const say = async (text: string, answer: string) => {
    answers.push(answer);
    worker.intake([{ update_id: update++, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 },
      text, date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  const tick = async () => { for (let i = 0; i < 10 && await worker.workObligations(); i++) { /* one step per tick */ } };
  return { journal, clock, say, tick, sent, worker };
}

it('the claim-scoped floor removes only what it named: every other result still rides the reply and is marked delivered exactly once (Rules 2, 8, 22, 46, 86, 92)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-deliver-floor-')));
  try {
    const w = world(root, { [LIBRARY_LOOP]: LIBRARY_REPORT, [K_REPLY]: K_REPORT, [GARDEN_REPLY]: GARDEN_REPORT });
    await w.say(LIBRARY, loopAnswer(LIBRARY_REPLY, LIBRARY_LOOP));
    w.clock.now += MINUTE; await w.say(K, loopAnswer(K_REPLY, K_REPLY));
    w.clock.now += 2 * MINUTE; await w.say(GARDEN, loopAnswer(GARDEN_REPLY, GARDEN_REPLY));
    expect(w.journal.view.commitments.map(note => note.quote)).toEqual([LIBRARY_LOOP, K_REPLY, GARDEN_REPLY]);
    // The quiet window: every loop's step runs, so three finished results wait for the next message (D1b, D2).
    w.clock.now += REVISIT + 10 * MINUTE; await w.tick(); await w.tick();
    const waiting = loopHealth(w.journal.view, w.clock.now);
    expect(waiting.awaitingDelivery).toBe(3);
    expect(waiting.deliveryInhibition).toBe('no grant for unsolicited sends; 3 finished results wait for your next message');
    const sends = w.sent.length;
    // "hi": the floor fires on this reply and removes the one sentence it named.
    w.clock.now += MINUTE; await w.say('hi', JSON.stringify({ reply: HI_BODY, memory: [] }));
    const reply = w.sent.slice(sends).join('\n');
    const withholds = claimScopedWithholds(w.journal.view);
    expect(withholds.trimmed).toBe(1);
    expect(withholds.sentencesRemoved).toBe(1);
    expect(reply).not.toContain(DEFERRED_CLAIM);
    // D1c: the product's own wording, every result still carried, and nothing left waiting afterwards.
    expect(reply).toContain('Follow-up on "');
    expect(reply.split('Follow-up on "').length - 1).toBe(3);
    for (const text of [LIBRARY_REPORT, K_REPORT, GARDEN_REPORT]) expect(reply).toContain(text);
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    // Marked exactly once: each result is delivered by this one reply, and each commitment closed by it.
    const hi = w.journal.view.order.at(-1)!;
    const delivered = Object.values(w.journal.view.obligationWork).map(entry => entry.report?.delivered);
    expect(delivered).toEqual([hi.id, hi.id, hi.id]);
    expect([...w.journal.view.closed.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    // Nothing is attached a second time: a later message carries no follow-up at all.
    const after = w.sent.length;
    w.clock.now += MINUTE; await w.say('thanks', JSON.stringify({ reply: 'Any time.', memory: [] }));
    expect(w.sent.slice(after).join('\n')).not.toContain('Follow-up on "');
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);

it('excising nothing returns the body unchanged, and a removal never reflows the text around it (Rules 4, 86)', () => {
  // The runner appends each finished result as "\n\nFollow-up on …", and a report may itself carry a blank line.
  const body = `Hi! Two things I owed you. ${DEFERRED_CLAIM}\n\nFollow-up on "${K_REPLY}": ${K_REPORT}`;
  expect(exciseNamedClaims(body, []).text).toBe(body);
  expect(exciseNamedClaims(body, ['a claim this reply does not carry at all'])).toMatchObject({ text: body, removed: [] });
  const cut = exciseNamedClaims(body, [DEFERRED_CLAIM]);
  expect(cut.removed).toEqual([DEFERRED_CLAIM]);
  // What the floor did not name keeps its own separators, so the result still occurs verbatim in the sent reply.
  expect(cut.text).toBe(`Hi! Two things I owed you.\n\nFollow-up on "${K_REPLY}": ${K_REPORT}`);
  expect(cut.text).toContain(K_REPORT);
});
