// Live pre-switch sb-w4-updaterecord 04bed622, 2026-10-07 09:19-09:55, room four, 15-minute root
// proofroom4-dshort15-20261007-091933 (results preswitch-sb-w4-updaterecord-04bed622-20261007-091931/D-proofroom4-ps):
// D1c FAILED. Three finished results waited (status-d1hi-before.json `awaitingDelivery: 3`). The reply to "hi" (update
// 46039598) was objected to on the agent's OWN prose (`lastReplyCheck`: unrecorded_blocker on the library sentence,
// self_state_claim on "delivered the deferred answer"), so the one revision round ran (`modelCalls.byJudgment
// ['reply-revision']: 1`, guidance landing `revised: 1`). The reviser was handed the whole reply, the runner's three
// `Follow-up on "…"` result lines included, and folded the results into its own wording (reply-d1hi.json carries no
// `Follow-up on "`). No result then occurred verbatim in the sent reply, so all three went back to owned work as
// review-withheld (status-d1hi.json `awaitingDelivery: 0`, `dueWork: 3`) although no objection named them.
// Fix: the revision rewrites only the agent's prose; each result line it carried is attached again exactly as
// written, before the revision's own review, so that review sees the text that is sent (Rules 8, 22, 46, 86, 92).
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { loopHealth } from './obligations.js';
import type { ReplyFinding, ReplyRule } from './reply-check.js';

const key = new Uint8Array(32).fill(59);
const T0 = 1791390015431, MINUTE = 60_000, REVISIT = 15 * MINUTE;

const K = 'From now on, end every shopping list you write for me with "— K".';
const K_REPLY = 'Got it — from now on, I\'ll end every shopping list I write for you with "— K".';
const K_REPORT = 'Confirmed: the standing instruction is active — every shopping list I write for you from now on will end with "— K".';
const WEEK = 'One more open item, and again no answer now please: work out which three of the things I have told you matter most for planning my week and tell me in a later message. Just confirm it is on your list.';
const WEEK_REPLY = 'Got it — added to the list: work out which three things matter most for planning your week and give it to you in a later message.';
const WEEK_REPORT = 'The three things that matter most for planning your week:\n\n1. Library card D-4 renewal — still open.\n2. Your standing rule that every shopping list ends with "— K".\n3. The pancake shopping list, already drafted.';

/** The objected sentence of the candidate (the live self_state_claim quoted "delivered the deferred answer"). */
const SELF_CLAIM = 'I already delivered the deferred answer earlier in our conversation.';
const HI_BODY = `Hi Justin! ${SELF_CLAIM} Here is what I owe you.`;
const FINDINGS: ReplyFinding[] = [{ rule: 'self_state_claim', verdict: 'violation',
  reason: 'self_state_claim: Claims "delivered the deferred answer...in my next message" / "already completed earlier in our conversation", but history shows no prior message ever delivered that three-item ranking answer — only a confirmation of holding it open.' }];
/** The recorded revision (reply-d1hi.json, update 46039598): the reviser's own wording of the results, no runner lines. */
const REVISED = 'PREVIEW — Hi Justin! Since you just said hi, let me go ahead and give you that deferred answer now: the three things you\'ve told me that matter most for planning your week are (1) library card D-4\'s renewal; (2) your standing rule that every shopping list I write for you ends with "— K"; and (3) the pancake shopping list, which is already drafted and ready to use.\n\nLet me know if you want me to reorder these or add anything else.';

const loopAnswer = (reply: string, quote: string) => JSON.stringify({ reply, memory: [],
  openLoops: [{ kind: 'deferral', quote, waitsOn: 'nothing' }] });
const jevScores = (flagged: Partial<Record<ReplyRule, number>>) => ({ model: 'jev-1.13.0',
  answers: Object.fromEntries((['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self',
    'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker'] as ReplyRule[])
    .map(rule => [rule, { type: 'noul', noul: flagged[rule] ?? 0.02 }])) });

it('a revision of the agent\'s prose keeps every result line verbatim, so the results are delivered, not withheld (Rules 8, 22, 92)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-revision-results-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8993213212',
      chat: '7812716706', operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0,
      loopRevisitMs: REVISIT });
    const clock = { now: T0 }, sent: string[] = [], answers: string[] = [], revisedDrafts: string[] = [], revisionReviews: string[] = [];
    const reports: Record<string, string> = { [K_REPLY]: K_REPORT, [WEEK_REPLY]: WEEK_REPORT };
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
        jev: async (body: string) => ({ value: jevScores(body.includes(SELF_CLAIM) ? { claims_blocked: 0.6 } : {}) as unknown,
          latencyMs: 207 }),
        escalate: async (text: string, _id: string, _prompt?: string, _rules?: unknown, _deadline?: number, kind?: string) => {
          if (kind === 'revision') { revisionReviews.push(text); return { verdict: 'pass' as const, ruleIds: [] as ReplyRule[], confidence: null, latencyMs: 9000 }; }
          return text.includes(SELF_CLAIM)
            ? { verdict: 'violation' as const, ruleIds: ['self_state_claim'] as ReplyRule[], confidence: null, latencyMs: 19669,
              reason: FINDINGS[0]!.reason, findings: FINDINGS }
            : { verdict: 'pass' as const, ruleIds: [] as ReplyRule[], confidence: null, latencyMs: 9000 };
        },
        revise: async (input: { text: string }) => { revisedDrafts.push(input.text);
          return { state: 'complete' as const, text: REVISED,
            dispositions: [{ objection: 'self_state_claim', decision: 'accept' as const, reason: 'Nothing was delivered earlier.' }] }; } },
      send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; },
      checkOutbound: () => {} });
    let update = 46039594;
    const say = async (text: string, answer: string) => {
      answers.push(answer);
      worker.intake([{ update_id: update++, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 },
        text, date: Math.floor(clock.now / 1000) } }]);
      await worker.drain();
    };
    await say(K, loopAnswer(K_REPLY, K_REPLY));
    clock.now += 2 * MINUTE; await say(WEEK, loopAnswer(WEEK_REPLY, WEEK_REPLY));
    clock.now += REVISIT + 10 * MINUTE;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 10 && await worker.workObligations(); i++) { /* one step per tick */ }
    expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(2);
    const before = sent.length;
    clock.now += MINUTE; await say('hi', JSON.stringify({ reply: HI_BODY, memory: [] }));
    const reply = sent.slice(before).join('\n');
    // The reviser saw only the agent's prose: no runner result line was offered for rewording.
    expect(revisedDrafts).toHaveLength(1);
    expect(revisedDrafts[0]).toContain(SELF_CLAIM);
    expect(revisedDrafts[0]).not.toContain('Follow-up on "');
    // The revision was sent, with each result attached again verbatim, and its review judged exactly that text.
    expect(reply).toContain('give you that deferred answer now');
    expect(reply).not.toContain(SELF_CLAIM);
    expect(reply.split('Follow-up on "').length - 1).toBe(2);
    for (const text of [K_REPORT, WEEK_REPORT]) expect(reply).toContain(text);
    expect(revisionReviews).toHaveLength(1);
    for (const text of [K_REPORT, WEEK_REPORT]) expect(revisionReviews[0]).toContain(text);
    // D1c: nothing waits afterwards, nothing went back to owned work, and each result is delivered by this reply.
    const health = loopHealth(journal.view, clock.now);
    expect(health.awaitingDelivery).toBe(0);
    expect(health.dueWork).toBe(0);
    const hi = journal.view.order.at(-1)!;
    expect(Object.values(journal.view.obligationWork).map(work => [work.report?.delivered, work.withheld])).toEqual([[hi.id, undefined], [hi.id, undefined]]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);
