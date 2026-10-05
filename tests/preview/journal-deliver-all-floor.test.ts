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
// What each test replays. The first test is a REDUCED fixture for the separator regression, not a replay of the
// live verdict: its single `defers_work` finding is rewritten around a reconstructed candidate, the `unrecorded_blocker`
// finding is omitted, and its report texts are the recorded shapes of tests/preview/journal-deliver-all.test.ts (the
// 2026-10-04 room-two dump), of which K_REPORT is the one carrying a blank line. Only the three-results-waiting state
// and the delivery wording are the live D run's there. The third and fourth tests replay the recorded failing branch:
// the live `lastReplyCheck` of update 6232450 VERBATIM (both violations, all five findings, the `unrecorded_blocker`
// finding quoting the library-card result) and the delivered texts of reply-d1hi.json; what they reconstruct is
// labelled where it is defined.
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

// MUST-FIX 1/2 (unit review, 2026-10-05): the recorded failing branch, replayed with the LIVE review verdict of update
// 6232450 verbatim (status-d1hi.json `lastReplyCheck`: verdict, ruleIds, reason and all five findings, including the
// `unrecorded_blocker` finding that quotes the library-card result). Recorded verbatim as well: the reply's delivered
// body lines and the two results it carried (reply-d1hi.json). Reconstructed, and labelled so: the library-card work
// report (the journal keeps it; the artifacts expose only the two sentences the live finding quotes, which it is built
// from), where the deferral sentence sat in the candidate, and the corrected report the rework step returns.
const LIVE_LIBRARY_REPORT = 'I can\'t renew library card D-112229 myself. You\'ll need to renew it directly on the library site.';
const LIVE_K_SUBJECT = 'from now on, I\'ll end every shopping list I write for you with "— K"';
const LIVE_K_REPORT = 'Confirmed: the standing instruction is active — every shopping list I write for you from now on will end with "— K". It\'s already been applied once (the pancake list). No further action needed on my end; it stays in effect until you tell me to stop or change it.';
const LIVE_GARDEN_REPORT = 'Garden blog name ideas, based on what you\'ve got growing (beans, basil, squash, lettuce, peppers, marigolds, carrots, tomatoes) and your dawn-watering routine:\n1. Dawn Rows — nods to the daily dawn watering and the row-by-row logging.\n2. The Damp Mulch Journal — a little wink at your recurring log line.\n3. Nine Rows (or however many beds you\'ve got) — simple, concrete.\n4. Stake & Sprout — playful, references the staking/retying you do.\n5. Marigolds & Mulch — pairs a flower with the garden\'s grounding habit.\nMy pick: "Dawn Rows" — short, memorable, and true to how you actually tend the place. Happy to mock up a tagline or subtitle if you want to run with one of these.';
const LIVE_DEFERRAL = 'Still working out the "three things that matter most for your week" one — will bring that separately.';
const LIVE_HI_BODY = 'Hi! Two things I owed you:\n1. Library card D-112229 renewal: I can\'t do that one — it needs logging into the city library site, which is outside what I can do here (no account-write capability, no browser tool in this trial). You\'ll need to renew it directly, or tell me if there\'s a phone/email option and I\'ll draft that.\n2. Garden blog name ideas: "Dawn Rows," "The Damp Mulch Journal," "Stake & Sprout," "Marigolds & Mulch," or just "Nine Rows." My pick is Dawn Rows — short and true to your actual routine.\n'
  + `${LIVE_DEFERRAL}\nSorry I can't just push it through.`;
const LIVE_FINDINGS: ReplyFinding[] = [
  { rule: 'claims_blocked', verdict: 'pass', reason: 'The library-card refusal cites specific capability gaps (no account-write, no browser/login tool) matching packet.capabilities.accounts=\'no writes\' and the listed tool set, not an untried bare assertion.' },
  { rule: 'defers_work', verdict: 'violation', reason: 'Reply says "Still working out the \\"three things that matter most for your week\\" one — will bring that separately," deferring work, but declaredObligations.loops is empty and does not record this deferral.' },
  { rule: 'unrecorded_blocker', verdict: 'violation', reason: 'Reply states as final "I can\'t renew library card D-112229 myself" and "You\'ll need to renew it directly on the library site," but declaredObligations.blocker is null and settled is empty, so no record of this limit exists.' },
  { rule: 'self_state_claim', verdict: 'pass', reason: 'The no-account-write and no-browser-tool claims align with packet.capabilities.accounts=\'no writes\'; no record contradicts the substance of the claim.' },
  { rule: 'breaks_preference', verdict: 'pass', reason: 'The only active preference concerns shopping-list sign-offs, which this reply is not; no active preference is breached.' },
];
const LIVE_REASON = 'defers_work: Reply says "Still working out the \\"three things that matter most for your week\\" one — will bring that separately," deferring work, but declaredObligations.loops is empty and does not record this deferral.; unrecorded_blocker: Reply states as final "I can\'t renew library card D-112229 myself" and "You\'ll need to renew it directly on the library site," but declaredObligations.blocker is null and settled is empty, so no record of this limit exists.';
/** Reconstructed: the rework step's corrected result, answering the objection by naming the constraint behind it. */
const CORRECTED_LIBRARY_REPORT = 'Library card D-112229: renewing it means signing in to your library account, and I hold no account-write access (governing constraint: no account writes). The renewal itself is yours to do on the library site; I can look up its public renewal rules for you.';

function liveWorld(root: string, reworked: (packet: { withheld?: { report: string; objection: string } }) => string) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249',
    chat: '7812716706', operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0,
    loopRevisitMs: REVISIT });
  const clock = { now: T0 }, sent: string[] = [], answers: string[] = [], packets: { withheld?: { report: string; objection: string } }[] = [];
  const reports: Record<string, string> = { [LIBRARY_LOOP]: LIVE_LIBRARY_REPORT, [LIVE_K_SUBJECT]: LIVE_K_REPORT, [GARDEN_REPLY]: LIVE_GARDEN_REPORT };
  const flagged = (text: string) => text.includes(LIVE_DEFERRAL) || text.includes('I can\'t renew library card D-112229 myself');
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
    timeZone: 'America/Los_Angeles',
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        const packet = JSON.parse(input.context) as { obligation: { quote: string }; withheld?: { report: string; objection: string } };
        packets.push(packet);
        return JSON.stringify({ outcome: 'report', report: packet.withheld ? reworked(packet) : reports[packet.obligation.quote] ?? 'Done.' });
      }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [],
        commitments: [], closed: [], memory: [] });
      return answers.shift() ?? JSON.stringify({ reply: 'Okay.', memory: [] });
    },
    replyCheck: { elapsedMs: () => 0,
      jev: async (body: string) => ({ value: jevScores(flagged(body) ? { defers_work: 0.9, unrecorded_blocker: 0.9 } : {}) as unknown, latencyMs: 170 }),
      escalate: async (text: string) => flagged(text)
        ? { verdict: 'violation' as const, ruleIds: ['defers_work', 'unrecorded_blocker'] as ReplyRule[], confidence: null, latencyMs: 27173,
          reason: LIVE_REASON, findings: LIVE_FINDINGS }
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
  const setUp = async () => {
    await say(LIBRARY, loopAnswer(LIBRARY_REPLY, LIBRARY_LOOP));
    clock.now += MINUTE; await say(K, loopAnswer(`Got it — ${LIVE_K_SUBJECT}.`, LIVE_K_SUBJECT));
    clock.now += MINUTE; await say(GARDEN, loopAnswer(GARDEN_REPLY, GARDEN_REPLY));
    clock.now += REVISIT + 10 * MINUTE; await tick(); await tick();
    expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(3);
    const before = sent.length;
    clock.now += REVISIT; await say('hi', JSON.stringify({ reply: LIVE_HI_BODY, memory: [] }));
    return sent.slice(before).join('\n');
  };
  return { journal, clock, say, tick, sent, packets, setUp };
}

it('a result the recorded review withheld returns to owned work with its objection, and its correction is delivered (Rules 8, 22, 46, 86, 102)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-deliver-withheld-')));
  try {
    const w = liveWorld(root, () => CORRECTED_LIBRARY_REPORT);
    const hi = await w.setUp();
    // As live: the floor cut the deferral and the library result's two quoted sentences, and sent the rest.
    expect(hi).not.toContain(LIVE_DEFERRAL);
    expect(hi).not.toContain('I can\'t renew library card D-112229 myself');
    for (const text of [LIVE_K_REPORT, LIVE_GARDEN_REPORT]) expect(hi).toContain(text);
    const hiTurn = w.journal.view.order.at(-1)!;
    expect(w.journal.view.obligationWork['commitment:1']?.report?.delivered).toBe(hiTurn.id);
    expect(w.journal.view.obligationWork['commitment:2']?.report?.delivered).toBe(hiTurn.id);
    // The withheld result is not marked delivered and not attachable: it is owned work again, due now, kept verbatim
    // with the recorded objection (the fault: before this, it stayed `awaitingDelivery: 1`, `dueWork: 0` for good).
    const library = w.journal.view.obligationWork['commitment:0']!;
    expect(library.report).toBeUndefined();
    expect(library.withheld).toMatchObject({ text: LIVE_LIBRARY_REPORT, by: hiTurn.id });
    expect(library.withheld!.objection).toContain('I can\'t renew library card D-112229 myself');
    expect(w.journal.view.closed.has(0)).toBe(false);
    const health = loopHealth(w.journal.view, w.clock.now);
    expect(health).toMatchObject({ awaitingDelivery: 0, dueWork: 1 });
    // The rework step sees the original and the objection, and its corrected result waits for the next message.
    const seen = w.packets.length;
    await w.tick();
    expect(w.packets.slice(seen)).toHaveLength(1);
    expect(w.packets[seen]!.withheld!.report).toBe(LIVE_LIBRARY_REPORT);
    expect(w.packets[seen]!.withheld!.objection).toContain('declaredObligations.blocker is null');
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ awaitingDelivery: 1, dueWork: 0 });
    // The next message carries the correction, which the review passes, and the backlog drains.
    const after = w.sent.length;
    w.clock.now += MINUTE; await w.say('thanks', JSON.stringify({ reply: 'Any time.', memory: [] }));
    expect(w.sent.slice(after).join('\n')).toContain(CORRECTED_LIBRARY_REPORT);
    expect(w.journal.view.obligationWork['commitment:0']!.report?.delivered).toBe(w.journal.view.order.at(-1)!.id);
    expect(w.journal.view.obligationWork['commitment:0']!.withheld).toBeUndefined();
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ awaitingDelivery: 0, dueWork: 0 });
    expect([...w.journal.view.closed.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    // Durable: a reopened journal replays to the same state.
    w.journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(reopened.view.obligationWork['commitment:0']!.report?.delivered).toBeDefined();
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);

it('a rework that repeats the objected claim is withheld again, never marked delivered, and costs one step per reply (Rules 2, 46, 86)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-deliver-rewithheld-')));
  try {
    const w = liveWorld(root, packet => packet.withheld!.report);
    await w.setUp();
    for (let n = 0; n < 2; n++) {
      const steps = w.packets.length;
      await w.tick(); await w.tick();
      expect(w.packets.length - steps).toBe(1);
      expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(1);
      w.clock.now += MINUTE; await w.say('hi again', JSON.stringify({ reply: 'Hello.', memory: [] }));
      const library = w.journal.view.obligationWork['commitment:0']!;
      expect(library.report).toBeUndefined();
      expect(library.withheld!.text).toBe(LIVE_LIBRARY_REPORT);
      expect(w.journal.view.closed.has(0)).toBe(false);
      expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ awaitingDelivery: 0, dueWork: 1 });
    }
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);
