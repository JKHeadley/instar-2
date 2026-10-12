import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { loopHealth } from './obligations.js';
import { HOLDING_REPLY, type ReplyRule } from './reply-check.js';

// d1c3-1012 brief: recorded D1c failure on cbc92478/7002feeb/4b125fec. The desk supplied
// the causal shape, not journal bytes or its update id: this reconstruction is explicitly
// NOT a verbatim live replay. One accepted-but-unchanged revision, an excised sentence
// leaving an empty list, incoherent_remainder, and a 466-character commitment:0 result line.
// Verbatim captured review/reply regressions remain in claim-scoped-floor and
// journal-revision-keeps-results (969389898/969389899 and 46039598).
const quote = 'I will bring you the finished plan in a later message.';
const prefix = `\n\nFollow-up on "${quote}": `;
const report = 'Your plan is ready. '.repeat(30).slice(0, 466 - prefix.length - 1) + '.';
const line = prefix + report;
const key = new Uint8Array(32).fill(63);
const rules: ReplyRule[] = ['raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint',
  'quits_on_self', 'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker'];

for (const mode of ['result', 'recorded-finding', 'none', 'credential', 'result-objected', 'unavailable', 'group', 'mixed-violation', 'pass', 'outbound-refused', 'unknown-send'] as const) {
  // Exact quoted claim and contextual finding from inspect-k2.json, update 969389898,
  // already captured in claim-scoped-floor.test.ts; surrounding list and result are constructed.
  const claim = mode === 'recorded-finding' ? 'I log it as a one-time action, acting on it once when you next message me.'
    : 'I will check the remaining details later and report back.';
  const prose = `Here is your result.\n\nNext steps:\n1. ${claim}`;
  it(`D1c result-only delivery and neighboring floor: ${mode}`, async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'd1c3-results-')));
    const path = join(root, 'journal.encrypted');
    const clock = { now: 1791796200000 };
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: mode === 'group' ? '-1007654321' : '7654321', ...(mode === 'group' ? { forum: true as const } : {}),
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600,
      cursor: 0, loopRevisitMs: 600_000 });
    const sent: string[] = [], reviews: string[] = [];
    let answer = JSON.stringify({ reply: quote, memory: [], openLoops: [{ kind: 'deferral', quote, waitsOn: 'nothing' }] });
    let checking = false, revisions = 0;
    const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
      model: async input => input.id.startsWith('obligation:') ? JSON.stringify({ outcome: 'report', report }) : answer,
      replyCheck: { elapsedMs: () => 0,
        jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(rules.map(rule =>
          [rule, { type: 'noul', noul: checking && rule === 'defers_work' ? 0.9 : 0.02 }])) }, latencyMs: 200 }),
        escalate: async (text, _id, _prompt, reviewRules, _deadline, kind) => {
          if (!checking) return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 };
          if (kind === 'revision') {
            reviews.push(text);
            expect(reviewRules).toContain('incoherent_remainder');
            expect(text).not.toContain(claim);
            if (mode === 'unavailable') throw Error('recorded review outcome uncertain');
            return { verdict: mode === 'pass' ? 'pass' : 'violation',
              ruleIds: mode === 'pass' ? [] : mode === 'mixed-violation' ? ['incoherent_remainder', 'credential'] : ['incoherent_remainder'], confidence: null, latencyMs: 1000 };
          }
          const reason = mode === 'recorded-finding'
            ? 'The reply promises to "log it as a one-time action, acting on it once when you next message me" (a deferral), but declaredObligations.loops is empty and does not record this deferral.'
            : `The promise "${claim}" has no recorded loop.`
            + (mode === 'result-objected' ? ' The claim "Your plan is ready." is also unsupported.' : '');
          return { verdict: 'violation', ruleIds: mode === 'credential' ? ['credential', 'defers_work'] : ['defers_work'],
            confidence: null, latencyMs: 1000, reason,
            findings: [{ rule: 'defers_work', verdict: 'violation', reason },
              ...(mode === 'credential' ? [{ rule: 'credential' as const, verdict: 'violation' as const, reason: 'A credential would leave.' }] : [])] };
        },
        revise: async input => { revisions++; return { state: 'complete', text: input.text,
          dispositions: (input.objections ?? input.ruleIds).map(objection => ({ objection, decision: 'accept' as const, reason: 'Accepted.' })) }; } },
      checkOutbound: () => { if (checking && mode === 'outbound-refused') throw Error('exact outbound refusal'); },
      send: async input => { sent.push(input.expectedText);
        if (checking && mode === 'unknown-send') throw Error('unknown transport outcome');
        return sent.length; } });
    const say = async (update: number) => {
      worker.intake([{ update_id: update, message: { chat: mode === 'group' ? { id: -1007654321, type: 'supergroup', is_forum: true } : { id: 7654321, type: 'private' },
        ...(mode === 'group' ? { message_thread_id: 7 } : {}), from: { id: 7654321 },
        text: checking ? 'hi' : 'Please prepare a plan for a later message.', date: Math.floor(clock.now / 1000) } }]);
      await worker.drain();
    };
    try {
      expect(line).toHaveLength(466);
      if (mode !== 'none') {
        await say(1); clock.now += 601_000;
        for (let i = 0; i < 10 && await worker.workObligations(); i++) { /* bounded foreground ticks */ }
        expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(1);
      }
      checking = true; answer = JSON.stringify({ reply: prose, memory: [] });
      const before = sent.length;
      await say(2);
      const turn = journal.view.order.at(-1)!;
      const replies = sent.slice(before);
      expect(revisions).toBe(1);
      if (mode === 'result' || mode === 'recorded-finding' || mode === 'unknown-send') {
        expect(reviews).toHaveLength(1);
        expect(reviews[0]).toContain('Next steps:');
        expect(replies).toEqual([line.trimStart()]);
        expect(turn.revision?.dispositions?.[0]?.decision).toBe('accept');
        expect(turn.revisionReview).toMatchObject({ verdict: 'violation', ruleIds: ['incoherent_remainder'] });
        expect(turn.release).toMatchObject({ review: 'violation', revised: false,
          reason: expect.stringContaining('rejected incoherent remainder withheld') });
        expect(turn.answerReports).toEqual(['commitment:0']);
        if (mode === 'result' || mode === 'recorded-finding') {
          expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(0);
          expect(journal.view.obligationWork['commitment:0']?.report?.delivered).toBe(turn.id);
        } else expect(journal.view.obligationWork['commitment:0']?.report?.delivered).toBeUndefined();
        await worker.drain();
        expect(sent.slice(before)).toEqual(replies); // never repeat a delivered or UNKNOWN send
      } else if (mode === 'outbound-refused') {
        expect(replies).toEqual([]);
        expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(1);
      } else if (mode === 'pass') {
        expect(replies[0]).toContain(report);
        expect(replies[0]).toContain('Next steps:');
        expect(replies[0]).not.toContain(claim);
      } else {
        expect(replies).toEqual([HOLDING_REPLY]);
        expect(turn.heldReview).toBeDefined();
      }
      journal.close();
      const reopened = openPreviewJournal(path, key);
      expect(reopened.view.order.at(-1)?.release).toEqual(turn.release);
      expect(reopened.view.order.at(-1)?.revisionReview).toEqual(turn.revisionReview);
      if (mode === 'result' || mode === 'recorded-finding') expect(loopHealth(reopened.view, clock.now).awaitingDelivery).toBe(0);
      reopened.close();
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }, 120_000);
}
