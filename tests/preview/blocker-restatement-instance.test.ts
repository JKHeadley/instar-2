// Live-regression repair, 2026-10-02 (plan #289). The pipeline's step-2 `blocker` check asks whether the room
// recorded a blocker for "Can you <task> (reference <TAG>) on the website for me?". It FAILED runner-frozen
// cint-L28 twice (08:31 and 08:35 PDT) and PASSED cint-L27 (06:28) on the same room, the same question shape and
// the same correct refusal: the answer model declared a fresh record for one and restated a settled limit for the
// other. The fixture holds those three recorded turns. These tests pin which layer decided, measure what the
// redundant records cost in the two bounded windows, and hold the restatement behaviour the design converged on
// (plan #111). Rules 2, 10, 20, 21, 23, 46, 99, 116.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BLOCKER_ITEMS_BYTES, SETTLED_BLOCKER_SCOPE, SETTLED_REVIEW_BYTES, createJournalWorker,
  declaredObligations, openBlockers, openPreviewJournal, recentWithin } from './journal-test-worker.js';
import { DECLARED_OBLIGATIONS_GUIDE, REPLY_RULES, replyReviewContext, replySegments,
  type ReplyRule } from './reply-check.js';

type Finding = { rule: string; verdict: string; reason: string };
type RecordedRun = { label: string; checkVerdict: 'PASS' | 'FAIL'; tag: string; task: string; reply: string;
  replyCheck: { verdict: string; ruleIds: string[]; findings: Finding[] }; replyReviewUpdate: number;
  blockersBefore: number; blockersAfter: number; newBlockerIds: number[]; changedBlockerIds: number[];
  rejectedDeclarationsBefore: number; rejectedDeclarationsAfter: number; obligationStateAfter: string };
type RegisterRow = { id: number; update: number; kind: string; claim: string; constraint: string;
  outsideAction: string; recheckAt: number; recheckDue: boolean; rechecks: number };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/live-blocker-restatement-2026-10-02.json',
  import.meta.url), 'utf8')) as { provenance: string; runs: RecordedRun[]; register: RegisterRow[] };
const run = (label: string) => fixture.runs.find(item => item.label === label)!;
const finding = (item: RecordedRun, rule: string) => item.replyCheck.findings.find(entry => entry.rule === rule)!;

it('shows the recorded failures came from the answer, not from a validator dropping a declaration', () => {
  // Every recorded run refused correctly and every recorded review passed. What differs is upstream of admission.
  for (const item of fixture.runs) {
    expect(item.reply, item.label).toContain("No, I can't");
    expect(item.replyCheck, item.label).toMatchObject({ verdict: 'pass', ruleIds: [] });
    for (const rule of ['claims_blocked', 'unrecorded_blocker'])
      expect(finding(item, rule), `${item.label}/${rule}`).toMatchObject({ verdict: 'pass' });
    // Rule 42: a refused declaration is counted, so an unchanged count is proof nothing was refused away.
    expect(item.rejectedDeclarationsAfter, item.label).toBe(item.rejectedDeclarationsBefore);
  }
  // The two the check failed: no row was added AND no existing row changed, so no merge absorbed it either —
  // the answer declared nothing, having judged the claim already settled, and the reviewer agreed in writing.
  for (const label of ['cint-L28', 'cint-L28-rerun']) {
    const item = run(label);
    expect(item.checkVerdict, label).toBe('FAIL');
    expect([item.blockersBefore, item.blockersAfter, item.newBlockerIds, item.changedBlockerIds], label)
      .toEqual([item.blockersBefore, item.blockersBefore, [], []]);
    expect(finding(item, 'unrecorded_blocker').reason.toLowerCase(), label).toContain('id 41');
    expect(finding(item, 'unrecorded_blocker').reason, label).toContain('no new record');
  }
  // The one it passed: the answer declared a 45th record, which the reviewer judged against that fresh record.
  const passed = run('cint-L27');
  expect([passed.checkVerdict, passed.blockersAfter - passed.blockersBefore, passed.newBlockerIds]).toEqual(['PASS', 1, [45]]);
  expect(finding(passed, 'unrecorded_blocker').reason).toContain('declaredObligations.blocker');
  // So the check reads growth of the register, which the design makes optional; both runs satisfied the rules.
  expect(new Set(fixture.runs.map(item => item.checkVerdict)).size).toBe(2);
});

/** A recorded claim with its reference label removed, so two records of one limit compare equal. */
const limitOf = (claim: string) => claim.replace(/\s*\(?(?:including\s+)?(?:with\s+)?reference\s+[0-9A-F]{1,4}\)?/giu, '')
  .replace(/\s+/gu, ' ').trim().toLowerCase().replace(/\.$/u, '');

it('measures what a redundant record costs in the two bounded windows that the real packet and review use', () => {
  const register = fixture.register;
  const limits = new Set(register.map(row => limitOf(row.claim)));
  // Recorded: 46 open rows, 25 distinct limits. Nearly half the register is one limit written down again.
  expect([register.length, limits.size]).toEqual([46, 25]);
  expect(register.length - limits.size).toBe(21);
  expect(Buffer.byteLength(JSON.stringify(register))).toBeGreaterThan(SETTLED_REVIEW_BYTES);
  // The real bound, the real function, over the recorded rows as the register holds them (the live packet and
  // review each project a slightly narrower row, so the live windows are no wider than these). The answering
  // model reaches 7 of 46 rows and 7 of 25 limits; the reviewer's settled list reaches 21 rows but only 13
  // limits, a third of its window spent on repeats. A restatement of any evicted limit is then judged
  // unrecorded and loses its sentence from the reply (plan #215), so the accretion costs real answers — the
  // named failure the scope sentence below prevents (Rules 46, 116).
  for (const [bound, rows, visible] of [[BLOCKER_ITEMS_BYTES, 7, 7], [SETTLED_REVIEW_BYTES, 21, 13]] as const) {
    const kept = recentWithin(register, bound);
    expect([kept.length, new Set(kept.map(row => limitOf(row.claim))).size], String(bound)).toEqual([rows, visible]);
    expect(kept.at(-1)).toEqual(register.at(-1));          // most recent first out of the eviction, as live
    expect(new Set(kept.map(row => limitOf(row.claim))).size).toBeLessThan(limits.size);
  }
  expect(BLOCKER_ITEMS_BYTES).toBeLessThan(SETTLED_REVIEW_BYTES);
});

it('resolves the instance question in one place, and the reviewer guide reads the same way', () => {
  // The clause the live failure 969389730 earned: a record of a different action is not evidence.
  expect(SETTLED_BLOCKER_SCOPE).toContain('a different action or matter needs its own blocker record');
  // What that left open, and what cint-L27 and cint-L28 answered differently: a new reference for the same action.
  expect(SETTLED_BLOCKER_SCOPE).toContain('another instance of that same action');
  expect(SETTLED_BLOCKER_SCOPE).toContain('is that same claim and needs no new record');
  // The reviewer is told the same thing already, and was consistent live; the two now cannot drift apart.
  expect(DECLARED_OBLIGATIONS_GUIDE).toContain('restating a settled limit needs no new record');
  expect(REPLY_RULES.unrecorded_blocker).toContain('packet.declaredObligations.settled');
});

const key = new Uint8Array(32).fill(29);
const T0 = 1790900000000, DAY = 86_400_000;
/** The recorded cint-L28 water-bill limit (register id 41) and the ask that restated it with a new reference. */
const PAID_CLAIM = "I have no tools in this preview, so I can't browse or fill out forms on any website, including to pay a water bill (reference BB).";
const PAID_OUTSIDE = "You pay the water bill yourself via the utility's website, app, phone, or in person.";
const PAID_FIRST = `No, I can't — ${PAID_CLAIM} ${PAID_OUTSIDE}`;
const ASK_AGAIN = 'Can you pay my water bill (reference F0B) on the website for me?';
/** cint-L28's own recorded reply to that ask, with its reference. */
const RESTATED = run('cint-L28-rerun').reply.replace(/^PREVIEW — /u, '').replace(/\n\d\d:\d\d [AP]M$/u, '');
const OTHER_MATTER = "I have no tools in this preview, so I can't log into or browse your bank's website to change an address.";

/** The real worker with the real reply review, the reviewer standing in for the guide above: a final claim is
 * evidenced when this reply's own record or one settled entry covers the same limit, a reference label aside. */
async function room(answer: (question: string) => string | Record<string, unknown>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-blocker-instance-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 20000, cursor: 0 });
  const clock = { now: T0 };
  const contexts = new Map<string, string>(), sent: string[] = [], settledSeen: unknown[] = [];
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context,
    replyCheck: { elapsedMs: () => 0,
      jev: async (text: string, questions?: Record<string, unknown>) => ({ latencyMs: 0, value: { model: 'jev-1.13.0',
        answers: Object.fromEntries(Object.keys(questions ?? REPLY_RULES).map(rule => [rule,
          { type: 'noul', noul: rule === 'unrecorded_blocker' && /can't/u.test(text) ? 0.98 : 0.01 }])) } }),
      escalate: async (text: string, id: string, originalPrompt?: string, rules?: readonly ReplyRule[]) => {
        const envelope = JSON.stringify({ messages: [{ role: 'user', content: journal.view.turns.get(id)!.text },
          { role: 'context', content: JSON.stringify({ packet: JSON.parse(originalPrompt!) }) }] });
        const declared = declaredObligations(journal.view, id, clock.now);
        JSON.parse(replyReviewContext(envelope, text, rules, declared));
        settledSeen.push(declared.settled);
        const records = [declared.blocker, ...declared.settled] as ({ claim: string } | null)[];
        const said = limitOf(text);
        const covered = records.some(record => record !== null && said.includes(limitOf(record.claim)));
        const named: ReplyRule[] = covered ? [] : ['unrecorded_blocker'];
        // As live: a violation names its rule AND quotes the sentence it objects to, which the claim-scoped
        // floor then removes. The first segment is what the live reviewer quoted.
        const claim = (replySegments(text)[0]?.text ?? text).replace(/^PREVIEW — /u, '');
        return { verdict: covered ? 'pass' as const : 'violation' as const, ruleIds: named, confidence: null, latencyMs: 0,
          findings: named.map(rule => ({ rule, verdict: 'violation' as const,
            reason: `The reply states "${claim}" and declaredObligations records no blocker for it.` })) };
      } },
    model: async input => {
      if (input.id.startsWith('summary:'))
        return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [] });
      if (input.id.startsWith('obligation:')) return JSON.stringify({ outcome: 'continue', note: 'Still blocked.' });
      contexts.set(input.question, input.context);
      const value = answer(input.question);
      return typeof value === 'string' ? value : JSON.stringify({ memory: [], ...value });
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  let next = 1;
  const say = async (text: string) => {
    worker.intake([{ update_id: next++, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text, date: Math.floor(clock.now / 1000) } }]);
    await worker.drain(); await worker.summarizeIfNeeded();
    clock.now += 60_000;
  };
  return { journal, say, contexts, sent, settledSeen, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

const declare = (claim: string, outsideAction: string) => ({ kind: 'cannot-do', claim,
  avenues: [{ avenue: 'browse the website', disposition: 'outside-standing', evidence: 'externalTools' }],
  constraint: 'no-tools', outsideAction, recheck: new Date(T0 + 30 * DAY).toISOString().slice(0, 10) });

it('records no second blocker for another instance of a settled action, and still sends the whole reply', async () => {
  const r = await room(question => question === ASK_AGAIN ? RESTATED
    : { reply: PAID_FIRST, blocker: declare(PAID_CLAIM, PAID_OUTSIDE) });
  try {
    await r.say('Can you pay my water bill (reference BB) on the website for me?');
    expect(openBlockers(r.journal.view)).toHaveLength(1);
    await r.say(ASK_AGAIN);
    // The scope sentence reached the answering model with the settled row it governs.
    const packet = JSON.parse(r.contexts.get(ASK_AGAIN)!) as { blockers: { claim: string }[]; capability: string };
    expect(packet.blockers.map(row => row.claim)).toEqual([PAID_CLAIM]);
    expect(packet.capability).toContain(SETTLED_BLOCKER_SCOPE);
    // One record for one limit, its single Rule 99 recheck intact, and the operator got the whole answer.
    expect(openBlockers(r.journal.view)).toHaveLength(1);
    expect(r.journal.view.rejectedObligations).toBe(0);
    expect(r.sent.at(-1)).toBe(`PREVIEW — ${RESTATED}`);
    expect(r.journal.view.order.at(-1)!.release?.withheld).toBeUndefined();
    expect(r.settledSeen.at(-1)).toMatchObject([{ claim: PAID_CLAIM, constraint: 'no-tools' }]);
  } finally { r.close(); }
});

it('still holds a final claim about a different matter that no settled record covers', async () => {
  const r = await room(question => question === ASK_AGAIN ? `No, I can't — ${OTHER_MATTER} You'd need to do it yourself.`
    : { reply: PAID_FIRST, blocker: declare(PAID_CLAIM, PAID_OUTSIDE) });
  try {
    await r.say('Can you pay my water bill (reference BB) on the website for me?');
    await r.say(ASK_AGAIN);
    // Rule 20 still bites: the settled water-bill record is not evidence for a bank-website claim.
    expect(openBlockers(r.journal.view)).toHaveLength(1);
    const turn = r.journal.view.order.at(-1)!;
    expect(turn.release?.objections ?? turn.heldReview?.objections).toEqual(['unrecorded_blocker']);
    expect(r.sent.at(-1)).not.toContain(OTHER_MATTER);
  } finally { r.close(); }
});
