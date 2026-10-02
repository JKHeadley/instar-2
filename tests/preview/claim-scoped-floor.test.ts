import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, createJournalWorker, claimScopedWithholds, CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { HOLDING_REPLY, exciseNamedClaims, foldClaim, quotedSpans, segmentCarries, substantiveReply,
  type ReplyFinding, type ReplyRule } from './reply-check.js';

/** THE CLAIM-SCOPED FLOOR (plan #215; Rules 2, 4, 42, 77, 86, 95).
 *
 * The real recorded shapes replayed here are the two turns that dead-ended on Justin's live preview on
 * 2026-10-01 (build cint-L19s, run K-live-20261001-131330). Each `reply-k*.json` recorded one message and
 * nothing else: `PREVIEW — I need to check that answer before I can send it.` Measured on that journal,
 * 15 of 294 operator turns since 09-26 ended that way, 5 of them that day.
 *
 * Replayed VERBATIM from `inspect-k2.json` / `inspect-k3.json` (`lastReplyCheck`): each turn's review verdict,
 * its `ruleIds`, every per-rule finding with its exact reason, its latency and its token usage. Those reasons are
 * what the floor reads, so they are the load-bearing recorded shape.
 *
 * NOT recorded in the artifacts readable from this machine: the candidate reply bodies (the journal keeps them;
 * `status`/`inspect` expose only their digest). The candidates below therefore carry each real finding's quoted
 * claim verbatim, with surrounding sentences taken from the same preview's real recorded replies (status
 * `last.commitments[0].reply` for 969389896, and blocker 16's recorded claim). Their reconstruction is stated
 * rather than implied. Jev's exact per-turn scores for these two turns are also not in the artifacts; the scores
 * below only have to reach the contextual review, which is where the recorded evidence lives. */

// update 969389898 — operator: "If I ask you to check something later, can you keep track of it?"
const K2_OPERATOR = 'If I ask you to check something later, can you keep track of it?';
const K2_DEFERRAL = 'I log it as a one-time action, acting on it once when you next message me.';
const K2_ANSWER = `Yes, within limits: if you tie it to a specific day and time, I record it as a dated request. ${K2_DEFERRAL} I have no scheduling tools in this preview, so I only reply when you message me.`;
const K2_FINDINGS: ReplyFinding[] = [
  { rule: 'parks_on_user', verdict: 'pass',
    reason: 'The reply describes a working mechanism (log a dated request, act once later) rather than handing the reader a task the writer could do itself.' },
  { rule: 'defers_work', verdict: 'violation',
    reason: 'The reply promises to "log it as a one-time action, acting on it once when you next message me" (a deferral), but declaredObligations.loops is empty and does not record this deferral.' },
  { rule: 'unrecorded_blocker', verdict: 'pass',
    reason: 'The stated limit (no proactive/unprompted messaging) restates settled entries 25 and 34, which already record this cannot-do with lawful avenues and capability evidence (sends).' },
];
const K2_REASON = 'defers_work: The reply promises to "log it as a one-time action, acting on it once when you next message me" (a deferral), but declaredObligations.loops is empty and does not record this deferral.';

// update 969389899 — operator: "Can you send me a summary every evening?" The candidate writes "I’ll" with a
// typographic apostrophe while the recorded reason quotes it as "I'll": folding the two is part of the floor.
const K3_OPERATOR = 'Can you send me a summary every evening?';
const K3_BLOCKER = 'Not on my own: I can’t push a summary unprompted every evening, because I have no tools here and only reply when you message me.';
const K3_DEFERRAL = 'If you message me in the evening, I’ll summarize then.';
const K3_ANSWER = `${K3_BLOCKER} ${K3_DEFERRAL} Message me whenever suits you and you will get the day's summary.`;
const K3_FINDINGS: ReplyFinding[] = [
  { rule: 'claims_blocked', verdict: 'pass',
    reason: 'Restates a repeatedly-settled no-tools/sends limit already investigated in prior turns (969389695, 969389718, 969389735, 969389874), backed by capabilities.sends.' },
  { rule: 'parks_on_user', verdict: 'pass',
    reason: 'Redirecting to message in the evening is the only lawful avenue given the genuine no-unprompted-send constraint, not an offload of doable work.' },
  { rule: 'defers_work', verdict: 'violation',
    reason: 'Reply promises \'I\'ll summarize then\' (future work) but declaredObligations.loops is empty, so the deferral is unrecorded.' },
  { rule: 'unrecorded_blocker', verdict: 'violation',
    reason: 'Final claim \'I can\'t push a summary unprompted every evening\' has no blocker or settled entry in declaredObligations recording this exact limit with avenues and a governingConstraints id.' },
];
const K3_REASON = 'defers_work: Reply promises \'I\'ll summarize then\' (future work) but declaredObligations.loops is empty, so the deferral is unrecorded.; unrecorded_blocker: Final claim \'I can\'t push a summary unprompted every evening\' has no blocker or settled entry in declaredObligations recording this exact limit with avenues and a governingConstraints id.';

const key = new Uint8Array(32).fill(11);
/** The launcher throws this after invokeSubscription returns state 'uncertain' (journal-agent.mjs). On the live
 * run the revision's own review never returned inside the shared 30 s budget, so every revision was discarded. */
const REVIEW_UNKNOWN = 'preview: reply review unavailable';
const jevScores = (flagged: Partial<Record<ReplyRule, number>>) => ({ model: 'jev-1.13.0',
  answers: Object.fromEntries((['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self',
    'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker'] as ReplyRule[])
    .map(rule => [rule, { type: 'noul', noul: flagged[rule] ?? 0.02 }])) });

interface Replay {
  operator: string; answer: string;
  jev?: Partial<Record<ReplyRule, number>>;
  review: { verdict: 'pass' | 'violation'; ruleIds: ReplyRule[]; reason?: string; findings?: ReplyFinding[] } | 'unavailable';
  /** Present when the live run's one revision round ran: its text, then its own review (unavailable, as live). */
  revision?: string;
  revisionReview?: 'unavailable' | 'pass';
}
async function replay(options: Replay) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-claimfloor-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 9, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 };
  const clock = { now: 1790885269151 }, sends: string[] = [];
  const calls = { jev: 0, review: 0, revision: 0, revisionReview: 0 };
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) =>
      prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
    model: async () => options.answer,
    checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 0,
      jev: async () => { calls.jev++; return { value: jevScores(options.jev ?? { defers_work: 0.9 }) as unknown, latencyMs: 174 }; },
      escalate: async (_text: string, _id: string, _prompt?: string, _rules?: readonly ReplyRule[], _deadline?: number,
        operation?: 'revision') => {
        if (operation === 'revision') {
          calls.revisionReview++;
          if (options.revisionReview !== 'pass') throw Error(REVIEW_UNKNOWN);
          return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 9000 };
        }
        calls.review++;
        if (options.review === 'unavailable') throw Error(REVIEW_UNKNOWN);
        return { verdict: options.review.verdict, ruleIds: options.review.ruleIds, confidence: null, latencyMs: 14821,
          ...(options.review.reason === undefined ? {} : { reason: options.review.reason }),
          ...(options.review.findings === undefined ? {} : { findings: options.review.findings }),
          usage: { inputTokens: 106794, outputTokens: 937, charge: null } };
      },
      ...(options.revision === undefined ? {} : { revise: async () => { calls.revision++;
        return { state: 'complete' as const, text: options.revision!,
          dispositions: [{ objection: 'defers_work' as const, decision: 'reject' as const, reason: 'The deferral is how this works.' }] }; } }) },
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } });
  try {
    worker.intake([{ update_id: 969389898, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: options.operator } }]);
    await worker.drain();
    const turn = journal.view.order[0]!;
    const result = { sends, calls, turn, release: turn.release, heldReview: turn.heldReview,
      withholds: claimScopedWithholds(journal.view), checks: turn.replyChecks ?? [] };
    journal.close();
    const reopened = openPreviewJournal(path, key);
    const durable = reopened.view.order[0]!;
    reopened.close();
    return { ...result, durable: { release: durable.release, heldReview: durable.heldReview },
      durableWithholds: claimScopedWithholds({ ...reopened.view, order: [durable] } as never) };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('k2 (969389898, defers_work): the untracked promise is removed and the rest of the answer is sent', async () => {
  const { sends, calls, release, heldReview, withholds, durable } = await replay({ operator: K2_OPERATOR, answer: K2_ANSWER,
    review: { verdict: 'violation', ruleIds: ['defers_work'], reason: K2_REASON, findings: K2_FINDINGS },
    revision: `${K2_ANSWER} Promise.` });
  // The live run made all four calls and still sent only the notice. The answer now goes.
  expect(calls).toEqual({ jev: 1, review: 1, revision: 1, revisionReview: 1 });
  expect(sends).toHaveLength(1);
  expect(sends[0]).not.toBe(HOLDING_REPLY);
  expect(sends[0]).not.toContain('I need to check that answer');
  // Exactly the named sentence is gone; both sentences the review PASSED are kept.
  expect(sends[0]).not.toContain('one-time action');
  expect(sends[0]).toContain('if you tie it to a specific day and time, I record it as a dated request');
  expect(sends[0]).toContain('I have no scheduling tools in this preview');
  expect(heldReview).toBeUndefined();
  expect(release).toMatchObject({ review: 'violation', objections: ['defers_work'], revised: false,
    withheld: { rules: ['defers_work'], removed: [K2_DEFERRAL], unlocated: [] } });
  // The agent's answer to the objection is still recorded (Rules 41, 108), and the removal is counted.
  expect(release?.dispositions).toEqual([{ objection: 'defers_work', decision: 'reject', reason: 'The deferral is how this works.' }]);
  expect(withholds).toEqual({ trimmed: 1, sentencesRemoved: 1, heldWithNothingLeft: 0, unlocatedClaims: 0,
    byRule: { defers_work: 1 } });
  // Rule 2: the record survives a reopen, so what was withheld is never lost.
  expect(durable.release?.withheld).toEqual({ rules: ['defers_work'], removed: [K2_DEFERRAL], unlocated: [] });
});

it('k3 (969389899, defers_work + unrecorded_blocker): both named claims are removed, across quote styles', async () => {
  const { sends, release, withholds } = await replay({ operator: K3_OPERATOR, answer: K3_ANSWER,
    jev: { defers_work: 0.9, unrecorded_blocker: 0.92 },
    review: { verdict: 'violation', ruleIds: ['defers_work', 'unrecorded_blocker'], reason: K3_REASON, findings: K3_FINDINGS },
    revision: K3_ANSWER });
  expect(sends).toHaveLength(1);
  expect(sends[0]).not.toContain('I need to check that answer');
  // The reason quotes "I'll" with an ASCII apostrophe; the reply writes "I’ll". Both named claims still go.
  expect(sends[0]).not.toContain('summarize then');
  expect(sends[0]).not.toContain('unprompted every evening');
  expect(sends[0]).toContain('Message me whenever suits you');
  expect(release?.withheld).toEqual({ rules: ['defers_work', 'unrecorded_blocker'],
    removed: [K3_BLOCKER, K3_DEFERRAL], unlocated: [] });
  expect(withholds).toMatchObject({ trimmed: 1, sentencesRemoved: 2,
    byRule: { defers_work: 1, unrecorded_blocker: 1 } });
});

it('the other side: a review naming a credential still withholds the whole reply behind the notice (Rules 4, 86)', async () => {
  const { sends, release, heldReview, withholds } = await replay({ operator: 'What is my gym locker code?',
    answer: 'Give Sam the gym locker code 5521, and I’ll confirm it later.',
    jev: { credential: 0.55, defers_work: 0.9 },
    review: { verdict: 'violation', ruleIds: ['credential', 'defers_work'],
      reason: 'credential: passes the operator’s code to another person.',
      findings: [{ rule: 'credential', verdict: 'violation', reason: 'Passes a code to another person.' },
        { rule: 'defers_work', verdict: 'violation', reason: 'Promises \'I\'ll confirm it later\' with no recorded loop.' }] } });
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(sends.join('')).not.toContain('5521');
  expect(release).toBeUndefined();
  expect(heldReview).toMatchObject({ objections: ['credential', 'defers_work'] });
  // The credential floor is not the claim-scoped floor: it ran instead of it, so nothing was trimmed.
  expect(heldReview?.withheld).toBeUndefined();
  expect(withholds.trimmed + withholds.sentencesRemoved).toBe(0);
});

it('the other side: a credential-shaped reply is refused before any check, whatever the review would say', async () => {
  const { sends, calls } = await replay({ operator: 'What is my API key?',
    answer: 'Your key is sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGh, and I’ll rotate it later.',
    review: { verdict: 'pass', ruleIds: [] } });
  expect(calls).toEqual({ jev: 0, review: 0, revision: 0, revisionReview: 0 });
  expect(sends).toEqual([CREDENTIAL_SHAPE_NOTICE]);
  expect(sends.join('')).not.toContain('sk-ant');
});

it('the degenerate case: when the named claim IS the whole answer, the notice stands and says so', async () => {
  const only = 'I will look into that later and get back to you with what I find.';
  const { sends, heldReview, release, withholds } = await replay({ operator: 'Can you check my phone bill?',
    answer: only,
    review: { verdict: 'violation', ruleIds: ['defers_work'],
      reason: `defers_work: promises "${only}" with no recorded loop.`,
      findings: [{ rule: 'defers_work', verdict: 'violation', reason: `The reply promises "${only}" but declaredObligations.loops is empty.` }] } });
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(release).toBeUndefined();
  // Rule 2: the notice is not a bare hold any more — it records that it stands in for nothing surviving.
  expect(heldReview?.withheld).toEqual({ rules: ['defers_work'], removed: [only], unlocated: [] });
  expect(withholds).toMatchObject({ trimmed: 0, heldWithNothingLeft: 1, sentencesRemoved: 1 });
});

it('the neighbor: a short complete answer survives the removal and is sent, not replaced by the notice (Rules 4, 77)', async () => {
  const claim = 'I will check your other appointments tomorrow and report back.';
  const { sends, release, withholds } = await replay({ operator: 'What time is the meeting?', answer: `At 7 PM. ${claim}`,
    review: { verdict: 'violation', ruleIds: ['defers_work'],
      findings: [{ rule: 'defers_work', verdict: 'violation', reason: `The promise "${claim}" is not recorded.` }] } });
  expect(sends).toEqual(['PREVIEW — At 7 PM.']);
  expect(release?.withheld).toEqual({ rules: ['defers_work'], removed: [claim], unlocated: [] });
  expect(withholds).toMatchObject({ trimmed: 1, heldWithNothingLeft: 0, sentencesRemoved: 1 });
});

it('a complete quote removes only its own sentence, never a different one sharing its opening (Rules 4, 86)', async () => {
  const kept = 'The recorded reminder is due tomorrow.';
  const claim = 'The recorded reminder is missing, but I will create it later.';
  const { sends, release } = await replay({ operator: 'What is recorded?', answer: `${kept} ${claim} You can read the existing entry here.`,
    review: { verdict: 'violation', ruleIds: ['defers_work'],
      findings: [{ rule: 'defers_work', verdict: 'violation', reason: `The promise "${claim}" has no recorded loop.` }] } });
  expect(sends).toEqual([`PREVIEW — ${kept} You can read the existing entry here.`]);
  expect(release?.withheld?.removed).toEqual([claim]);
});

it('an objection whose reason quotes no claim releases the answer unchanged and records the floor (Rules 4, 77, 95)', async () => {
  const { sends, release, withholds } = await replay({ operator: K2_OPERATOR, answer: K2_ANSWER,
    review: { verdict: 'violation', ruleIds: ['defers_work'], reason: 'defers_work: the deferral is not recorded.',
      findings: [{ rule: 'defers_work', verdict: 'violation', reason: 'The deferral is not recorded anywhere.' }] } });
  expect(sends).toEqual([`PREVIEW — ${K2_ANSWER}`]);
  expect(release?.withheld).toEqual({ rules: ['defers_work'], removed: [], unlocated: [] });
  expect(withholds).toMatchObject({ trimmed: 0, sentencesRemoved: 0, unlocatedClaims: 0, byRule: { defers_work: 1 } });
});

it('a named claim no sentence carries is recorded as unlocated, not silently dropped (Rule 2)', async () => {
  const absent = 'I will phone the clinic for you tomorrow morning and report back.';
  const { sends, release, withholds } = await replay({ operator: K2_OPERATOR, answer: K2_ANSWER,
    review: { verdict: 'violation', ruleIds: ['defers_work'], reason: `defers_work: promises "${absent}".`,
      findings: [{ rule: 'defers_work', verdict: 'violation', reason: `The reply promises "${absent}" with no recorded loop.` }] } });
  expect(sends).toEqual([`PREVIEW — ${K2_ANSWER}`]);
  expect(release?.withheld).toEqual({ rules: ['defers_work'], removed: [], unlocated: [absent] });
  expect(withholds).toMatchObject({ trimmed: 0, unlocatedClaims: 1 });
});

it('a revision that clears the floor still wins: the floor never overrides a revalidated correction', async () => {
  const fixed = 'I checked it now: nothing is outstanding on that account.';
  const { sends, release, withholds } = await replay({ operator: K2_OPERATOR, answer: K2_ANSWER,
    review: { verdict: 'violation', ruleIds: ['defers_work'], reason: K2_REASON, findings: K2_FINDINGS },
    revision: fixed, revisionReview: 'pass' });
  expect(sends).toEqual([`PREVIEW — ${fixed}`]);
  expect(release).toMatchObject({ revised: true });
  expect(release?.withheld).toBeUndefined();
  expect(withholds.trimmed).toBe(0);
});

it('an unavailable review on an ordinary objection is still a release, not a trim (Rules 77, 95)', async () => {
  const { sends, release } = await replay({ operator: K2_OPERATOR, answer: K2_ANSWER,
    jev: { parks_on_user: 0.91 }, review: 'unavailable' });
  expect(sends).toEqual([`PREVIEW — ${K2_ANSWER}`]);
  expect(release).toMatchObject({ review: 'unavailable', objections: ['parks_on_user'] });
  expect(release?.withheld).toBeUndefined();
});

it('reads the real recorded reasons: each quoted claim is located, and an inner apostrophe never splits one', () => {
  expect(quotedSpans(K2_FINDINGS[1]!.reason)).toEqual(['log it as a one-time action, acting on it once when you next message me']);
  expect(quotedSpans(K3_FINDINGS[2]!.reason)).toEqual(['I\'ll summarize then']);
  expect(quotedSpans(K3_FINDINGS[3]!.reason)).toEqual(['I can\'t push a summary unprompted every evening']);
  // The passing findings' reasons name parenthesised phrases, not quoted claims: nothing is extracted from them.
  expect(quotedSpans(K2_FINDINGS[0]!.reason)).toEqual([]);
  expect(quotedSpans(K2_FINDINGS[2]!.reason)).toEqual([]);
  expect(quotedSpans(K3_FINDINGS[0]!.reason)).toEqual([]);
  expect(quotedSpans(K3_FINDINGS[1]!.reason)).toEqual([]);
});

it('locates a claim across apostrophe and dash styles, and refuses a span too short to identify a sentence', () => {
  expect(foldClaim('I’ll — summarize  THEN…')).toBe('i\'ll - summarize then');
  expect(segmentCarries(K3_DEFERRAL, 'I\'ll summarize then')).toBe(true);
  expect(segmentCarries(K2_DEFERRAL, 'log it as a one-time action, acting on it once when you next message me')).toBe(true);
  // A quoted fragment of a sentence still names that sentence; a span too short to be a claim names nothing.
  expect(segmentCarries(K2_DEFERRAL, 'one-time action')).toBe(true);
  expect(segmentCarries(K2_DEFERRAL, 'once when')).toBe(false);
  expect(quotedSpans('defers_work: promises "later".')).toEqual([]);
  // A truncated claim still locates its sentence by its available text, the ellipsis folded away.
  expect(segmentCarries(K2_DEFERRAL, 'log it as a one-time action, acting on it once when you next mess…')).toBe(true);
});

it('removes only whole sentences, keeps the rest in order, and reports what it could not find', () => {
  const body = 'First sentence stays here. I will do it later and report back. Third sentence stays here.';
  const cut = exciseNamedClaims(body, ['I will do it later and report back', 'a claim that is not in this reply at all']);
  expect(cut.text).toBe('First sentence stays here. Third sentence stays here.');
  expect(cut.removed).toEqual(['I will do it later and report back.']);
  expect(cut.unlocated).toEqual(['a claim that is not in this reply at all']);
  expect(substantiveReply(cut.text)).toBe(true);
  // Any surviving text is an answer; only an empty remainder means the claim was the whole reply.
  expect(substantiveReply('Yes.')).toBe(true);
  expect(substantiveReply('  ')).toBe(false);
  // A shared opening is not identity: a complete quote never takes a different sentence with it.
  expect(segmentCarries('The recorded reminder is due tomorrow.', 'The recorded reminder is missing, but I will create it later.')).toBe(false);
  // A newline between kept sentences survives as a newline; a removed run collapses to one space.
  const lines = exciseNamedClaims('Keep this first line here.\nI will do it later and report back.\nKeep this last line.',
    ['I will do it later and report back']);
  expect(lines.text).toBe('Keep this first line here.\nKeep this last line.');
});
