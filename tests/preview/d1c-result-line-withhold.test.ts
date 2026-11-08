/** Recorded-shape replay of live pre-switch train-209 (3ad4ec04), room two, group D, update 6236928 (D1c FAIL).
 * Reply prose, the appended cannot-do result, the reviewer's quoted claims and the revision's `uncertain` state are
 * the recorded bytes (operator name removed). The raw model declarations were not in the evidence beyond the recorded
 * answerReports ['commitment:0','commitment:1'] and answerCarriedReports (commitment:1 with the quote below).
 *
 * Live: the answer to "hi" gave the owed week-planning result in its own words and selected the waiting library-card
 * result for the runner to append verbatim. The review named an unrecorded cannot-do sentence INSIDE that appended
 * result; the floor cut that one sentence, the remainder review then named the result's next sentence, and the whole
 * reply, with the owed answer it carried, became the holding notice. The fix withholds the whole named result line
 * (it returns to owned work with the objection) and sends the reviewed remainder. */
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { loopHealth } from './obligations.js';
import { HOLDING_REPLY, type ReplyRule } from './reply-check.js';

const ASK0 = 'Can you renew my library card D-2 on the city library website?';
// Recorded ask shortened: its "things I have told you" wording waits on the summary's memory pass, not under test here.
const ASK1 = 'Keep it as an open item: think over which three things matter most for planning my week, and give me that answer in a later message, not in this reply.';
const REPORT0 = 'About your library card D-2: I didn\'t renew it, and I can\'t do it from here. Renewing means signing into your account on the library website and submitting a change. I don\'t have logged-in access to any of your accounts. My standing permission only covers replying to you here, not making changes on outside websites for you (operator-authority, reply-only-grant). I also don\'t know which city\'s library you mean.\n\nThe quickest way is to do it yourself. Sign in on the library\'s website with your card number and PIN, then look under "My Account" for a renewal option. Some libraries renew cards only in person or by phone. If you tell me which city\'s library it is, I can look up their public renewal steps and give you exact instructions. I won\'t need your card number or PIN for that.';
const SUBJECT0 = 'I will look into renewing library card D-2 and report back in a later message.';
const REPORT1 = 'Here\'s the answer I owed you: so far you\'ve told me only one thing that bears on your week, renewing library card D-2.';
const CARRIED = "so far, the only thing you've told me that bears on your week is renewing library card D-2";
const PROSE = `Hi. The answer I sent at 16:23 still stands: ${CARRIED}. Here's where that renewal stands:`;
// The two claims the live reviews quoted, in order: the full review, then the remainder review.
const CLAIM1 = "I didn't renew it, and I can't do it from here.";
const CLAIM2 = 'My standing permission only covers replying to you here, not making changes on outside websites for you';
const RULES: ReplyRule[] = ['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint',
  'quits_on_self', 'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker'];
const key = new Uint8Array(32).fill(77);

for (const mode of ['blocker-in-result', 'blocker-in-prose'] as const) {
  it(`D1c 6236928: a named cannot-do claim ${mode === 'blocker-in-result' ? 'inside an appended result withholds only that result' : 'in the agent\'s own prose still holds the reply'}`, async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'd1c-line-')));
    const path = join(root, 'journal.encrypted');
    const clock = { now: 1794097140000 };
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0, loopRevisitMs: 600_000 });
    const sent: string[] = [], remainders: string[] = [];
    let checking = false;
    // blocker-in-prose: the agent's own prose states the unrecorded limit; no result carries it.
    const prose = mode === 'blocker-in-result' ? PROSE : `${PROSE} ${CLAIM1} ${CLAIM2}.`;
    const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
      model: async input => {
        if (input.id.startsWith('obligation:')) return JSON.stringify({ outcome: 'report',
          report: input.id.startsWith('obligation:commitment:0:') ? REPORT0 : REPORT1 });
        if (!checking) {
          const quotes = [SUBJECT0,
            'I have the week-planning question as an open item and will give you that answer in a later message.'];
          return JSON.stringify({ reply: quotes.join(' '), memory: [], openLoops: quotes.map(quote => ({ kind: 'deferral', quote, waitsOn: 'nothing' })) });
        }
        const items = (JSON.parse(input.context) as { pendingReports?: { items: { key: string }[] } }).pendingReports?.items.map(item => item.key) ?? [];
        expect(items.sort()).toEqual(['commitment:0', 'commitment:1']);
        return JSON.stringify({ reply: prose, memory: [], selectedReports: ['commitment:0'],
          carriedReports: [{ key: 'commitment:1', quote: CARRIED }] });
      },
      replyCheck: { elapsedMs: () => 0,
        jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(RULES.map(rule =>
          [rule, { type: 'noul', noul: checking && rule === 'unrecorded_blocker' ? 0.97 : 0.02 }])) }, latencyMs: 284 }),
        escalate: async (text, _id, _prompt, _rules, _deadline, kind) => {
          if (!checking) return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 };
          if (kind === 'revision') {
            remainders.push(text);
            expect(text).not.toContain(CLAIM1);
            if (!text.includes(CLAIM2)) return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 };
            const reason = `unrecorded_blocker: "${CLAIM2}" is a final limit; blocker is null and settled is empty.`;
            return { verdict: 'violation', ruleIds: ['unrecorded_blocker'], confidence: null, latencyMs: 0, reason,
              findings: [{ rule: 'unrecorded_blocker', verdict: 'violation', reason }] };
          }
          const reason = `unrecorded_blocker: "${CLAIM1}" is stated as final, but declaredObligations.blocker is null and settled is empty`;
          return { verdict: 'violation', ruleIds: ['unrecorded_blocker'], confidence: null, latencyMs: 16183, reason,
            findings: [{ rule: 'claims_blocked', verdict: 'pass', reason: 'Inability cites the capability note.' },
              { rule: 'unrecorded_blocker', verdict: 'violation', reason }] };
        },
        // Recorded: the one revision round returned `uncertain`.
        revise: async () => ({ state: 'uncertain' as const }) },
      checkOutbound: () => {},
      send: async input => { sent.push(input.expectedText); return sent.length; } });
    const say = async (update: number, text: string) => {
      worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(clock.now / 1000) } }]);
      await worker.drain();
    };
    try {
      // The two recorded asks (updates 6236926 and 6236927) arrive here as one message, so both commitments are open.
      await say(6236927, `${ASK0} ${ASK1}`); clock.now += 601_000;
      for (let i = 0; i < 10 && await worker.workObligations(); i++) { /* bounded foreground ticks */ }
      expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(2);
      checking = true;
      const before = sent.length;
      await say(6236928, 'hi');
      const turn = journal.view.order.at(-1)!;
      const replies = sent.slice(before);
      expect(turn.answerReports?.sort()).toEqual(['commitment:0', 'commitment:1']);
      if (mode === 'blocker-in-result') {
        // The owed answer leaves on this message; the unrecorded cannot-do result does not.
        expect(replies).toHaveLength(1);
        expect(replies[0]).not.toBe(HOLDING_REPLY);
        expect(replies[0]).toContain(CARRIED);
        expect(replies[0]).toContain('library card D-2');
        expect(replies[0]).not.toContain(CLAIM1);
        expect(replies[0]).not.toContain(CLAIM2);
        expect(remainders).toHaveLength(1);
        expect(turn.release?.withheld?.removed).toEqual([`Follow-up on "${SUBJECT0}": ${REPORT0}`]);
        expect(turn.release?.withheld?.unlocated).toEqual([]);
        expect(journal.view.obligationWork['commitment:1']?.report?.delivered).toBe(turn.id);
        // The withheld result is not delivered: it returns to owned work with the reviewer's objection.
        expect(journal.view.obligationWork['commitment:0']?.report).toBeUndefined();
        expect(journal.view.obligationWork['commitment:0']?.withheld?.objection).toContain(CLAIM1);
        expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(0);
      } else {
        // A real unrecorded limit in the agent's own words is still held (the floor is not weakened).
        expect(replies).toEqual([HOLDING_REPLY]);
        expect(turn.heldReview?.objections).toContain('unrecorded_blocker');
        expect(journal.view.obligationWork['commitment:1']?.report?.delivered).toBeUndefined();
      }
      journal.close();
      const reopened = openPreviewJournal(path, key);
      expect(reopened.view.order.at(-1)?.release).toEqual(turn.release);
      reopened.close();
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }, 120_000);
}
