import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal-test-worker.js';
import { reviewUnavailableReleases } from './journal.js';
import { HOLDING_REPLY, REPLY_RULES, repeatsOperatorOnly } from './reply-check.js';
import { statusReply } from './status-command.js';

const key = new Uint8Array(32).fill(47);
const now = 1_790_000_000_000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: 40, maxReplies: 40, maxTurns: 40, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: Math.floor(now / 1000) + id * 60 } });
const locker = [
  [1, 'My gym locker code is 4417.', 'Noted.'],
  [2, 'Correction: the gym locker code is 5823 now, not 4417.', 'Noted, thanks.'],
] as const;
const question = 'what did I correct about my gym locker earlier, and what\'s the current code?';

/** Reproduces the 2026-09-27 frozen16 hold: Jev flags claims_blocked and parks_on_user on any
 * reply carrying a number, and the full-context review's verdict fails to parse. */
function world(root: string, answer: string, opts: { stopped?: () => boolean; send?: () => Promise<number>; openLoops?: unknown[] } = {}) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const calls = { jev: [] as string[], reviews: 0, outbound: [] as string[], sends: 0 };
  const worker = createJournalWorker(journal, { now: () => now, stopped: opts.stopped ?? (() => false),
    model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator gave a gym locker code and corrected it.', people: [], memory: [] })
      : JSON.stringify({ reply: locker.find(item => item[1] === input.question)?.[2] ?? answer, memory: [],
        ...(opts.openLoops && !locker.some(item => item[1] === input.question) ? { openLoops: opts.openLoops } : {}) }),
    send: async () => { calls.sends++; return opts.send ? opts.send() : 1; },
    checkOutbound: text => { calls.outbound.push(text); },
    replyCheck: { elapsedMs: () => 0,
      jev: async text => { calls.jev.push(text); return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(
        Object.keys(REPLY_RULES).map(id => [id, { type: 'noul',
          noul: /[0-9]/u.test(text) && (id === 'claims_blocked' || id === 'parks_on_user') ? 0.9 : 0.01 }])) }, latencyMs: 1 }; },
      escalate: async () => { calls.reviews++; throw Error('preview: review malformed'); } } });
  const say = async (id: number, text: string) => { worker.intake([update(id, text)]); await worker.drain(); };
  return { journal, worker, calls, say };
}
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-operator-echo-')));
const seed = async (w: ReturnType<typeof world>) => { for (const [id, text] of locker) await w.say(id, text); };

describe('the exact operator-echo test', () => {
  const own = locker.map(item => item[1]);
  it('passes only when every non-connective token appears verbatim and in order in ONE operator message', () => {
    expect(repeatsOperatorOnly('PREVIEW — You told me the gym locker code is 5823 now, not 4417.', own)).toBe(true);
    expect(repeatsOperatorOnly('Your gym locker code is 4417.', own)).toBe(true);
    // Any added word, even a harmless one, keeps the review.
    expect(repeatsOperatorOnly('The current code is 5823.', own)).toBe(false);
    expect(repeatsOperatorOnly('The gym locker code is 5823; the spare is 9911.', own)).toBe(false);
    expect(repeatsOperatorOnly('The gym locker code is 15823.', own)).toBe(false);
    expect(repeatsOperatorOnly('Run ./unlock --code=5823 to open it.', own)).toBe(false);
    // Two source messages combined, or words reordered, keep the review.
    expect(repeatsOperatorOnly('The gym locker code is 4417. The gym locker code is 5823 now.', own)).toBe(false);
    expect(repeatsOperatorOnly('5823 is the gym locker code.', own)).toBe(false);
    // Connectives alone repeat nothing; no operator message means no source.
    expect(repeatsOperatorOnly('It is.', own)).toBe(false);
    expect(repeatsOperatorOnly('Your code is 5823.', [])).toBe(false);
    // The agent's own earlier replies are not a source.
    expect(repeatsOperatorOnly('Noted, thanks.', own)).toBe(false);
    // Contiguity (Astra desk review MUST-FIX 1): scattered words cannot be stitched into a value.
    expect(repeatsOperatorOnly('It is violet orchid.', ['The violet flowers are beside the orchid. What did Sam send?'])).toBe(false);
    expect(repeatsOperatorOnly('It is violet orchid.', ['My recovery phrase is violet orchid.'])).toBe(true);
    // cint-1 MUST-FIX 1: the agent speaking about itself is never an echo, so a repeated question
    // cannot become an unrecorded promise or blocker claim; it takes the obligation-aware review.
    expect(repeatsOperatorOnly('I will look into the invoice question later today.',
      ['Please tell me whether you will look into the invoice question later today.'])).toBe(false);
    expect(repeatsOperatorOnly('I cannot book the appointment because this preview has no browser.',
      ['Is it true that you cannot book the appointment because this preview has no browser?'])).toBe(false);
    // Astra r2 MUST-FIX 1: connectives are never removed from inside the source.
    expect(repeatsOperatorOnly('It is violet orchid.', ['I said violet and you said orchid. What did Sam send?'])).toBe(false);
  });

  it('judges no meaning and uses no keyword list (Rule 10): only the exact source test decides', () => {
    const own = ['My locker code is 5823. What did Sam send?'];
    expect(repeatsOperatorOnly('Your locker code is 5823.', own)).toBe(true);
    expect(repeatsOperatorOnly('Your locker code is 5823. Sam says the server password is violetorchid.', own)).toBe(false);
    expect(repeatsOperatorOnly('Your locker code is 5823. Sam sent violetorchid.', own)).toBe(false);
    expect(repeatsOperatorOnly('Your bank password is 5823.', ['My bank password is 5823.'])).toBe(true);
    expect(repeatsOperatorOnly('Your bank password is 5823.', ['My bank code is 5823.'])).toBe(false);
  });
});

describe('operator echo in the journal runner', () => {
  it('sends the operator\'s own locker code back without Jev or the review; the exact wall still runs', async () => {
    const root = temp();
    const answer = 'You told me the gym locker code is 5823 now, not 4417.';
    const w = world(root, answer);
    try {
      await seed(w);
      const jevBefore = w.calls.jev.length;
      await w.say(3, question);
      const turn = w.journal.view.order[2]!;
      expect(turn.sent).toBe(1);
      expect(turn.intent).toBe(`PREVIEW — ${answer}`);
      expect(w.calls.jev.length).toBe(jevBefore);
      expect(w.calls.reviews).toBe(0);
      expect(turn.replyChecks).toEqual([expect.objectContaining({ verdict: 'pass', path: 'operator-echo' })]);
      expect(w.calls.outbound.at(-1)).toBe(`PREVIEW — ${answer}`);
      expect(w.journal.view.replyCheckPaths['operator-echo']).toBe(1);
      expect(statusReply(w.journal.view, now, 'UTC'))
        .toContain('Replies sent as your own words repeated back, without the second check: 1.');
    } finally { w.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('still sends an echo whose answer declared a deferral the runner refused to the contextual review (build 4, Rule 6)', async () => {
    const root = temp();
    const answer = 'You told me the gym locker code is 5823 now, not 4417.';
    const w = world(root, answer, { openLoops: [{ kind: 'deferral', quote: 'A clause that was never in this reply.', waitsOn: 'nothing' }] });
    try {
      await seed(w);
      const jevBefore = w.calls.jev.length;
      await w.say(3, question);
      const turn = w.journal.view.order[2]!;
      expect(turn.answerRejected).toEqual({ loops: 1 });
      // Same exact echo text, but the refused declaration keeps the review: no echo shortcut, no Jev,
      // and with no review verdict and no Jev flag Rule 86 has nothing to release, so it stays held.
      expect(w.journal.view.replyCheckPaths['operator-echo']).toBe(0);
      expect(w.calls.jev.length).toBe(jevBefore);
      expect(w.calls.reviews).toBe(2); // the malformed verdict and its one format re-ask (Rule 116)
      expect(turn.sent).toBeUndefined();
      expect(turn.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['subscription', 'unavailable']]);
      expect(reviewUnavailableReleases(w.journal.view).total).toBe(0);
    } finally { w.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('still checks the same reply when it adds a code the operator never gave (Rule 86 then releases it)', async () => {
    const root = temp();
    const w = world(root, 'The gym locker code is 5823 now. The spare locker code is 9911.');
    try {
      await seed(w);
      await w.say(3, question);
      const turn = w.journal.view.order[2]!;
      expect(w.calls.jev.at(-1)).toContain('9911');
      expect(w.calls.reviews).toBe(2); // the malformed verdict and its one format re-ask (Rule 116)
      // Not an echo: Jev and the full-context review both ran. The review gave no verdict and
      // Jev's flags name no secret, so under Rule 86 they only signal and the reply is sent.
      expect(turn.intent).toBe('PREVIEW — The gym locker code is 5823 now. The spare locker code is 9911.');
      expect(turn.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['jev', 'violation'], ['subscription', 'unavailable']]);
      expect(reviewUnavailableReleases(w.journal.view)).toEqual({ total: 1, byRule: { claims_blocked: 1, parks_on_user: 1 } });
      expect(w.journal.view.replyCheckPaths['operator-echo']).toBe(0);
    } finally { w.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('still checks a prose-only reply, which repeats no operator code', async () => {
    const root = temp();
    const w = world(root, 'I cannot see that; you should check the gym desk yourself.');
    try {
      await seed(w);
      const jevBefore = w.calls.jev.length;
      await w.say(3, question);
      expect(w.calls.jev.length).toBe(jevBefore + 1);
      expect(w.journal.view.order[2]?.replyChecks?.[0]?.path).toBe('jev');
    } finally { w.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('blocks an API key the operator pasted at the exact secret wall before any check', async () => {
    const root = temp();
    const secret = 'sk-ant-abcdefghijklmnopqrstuvwxyz123456';
    const w = world(root, `Your key is ${secret}.`);
    try {
      await w.say(1, `Keep my key: ${secret}`);
      const jevBefore = w.calls.jev.length;
      await w.say(2, 'What was my key?');
      const turn = w.journal.view.order[1]!;
      expect(w.calls.jev.length).toBe(jevBefore);
      expect(turn.replyChecks).toEqual([expect.objectContaining({ verdict: 'violation', ruleIds: ['credential'], path: 'holding' })]);
      expect(turn.intent).toBe(HOLDING_REPLY);
      expect(w.calls.outbound.some(text => text.includes(secret))).toBe(false);
      expect(w.journal.view.replyCheckPaths['operator-echo']).toBe(0);
    } finally { w.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('still checks a code that came from an imported third-party source', async () => {
    const root = temp();
    const w = world(root, 'Sam said the gate code is 7731.');
    try {
      importChannelFixture(w.journal, [{ source: 'email', account: 'echo-agent@example.test', id: 'mail-1',
        from: 'sam@example.test', at: now - 3_600_000, subject: 'Gate', text: 'The gate code is 7731.' }],
      'echo-agent@example.test', now);
      await w.say(1, 'What is the gate code Sam sent?');
      expect(w.calls.jev.at(-1)).toContain('7731');
      expect(w.journal.view.order[0]?.replyChecks?.[0]?.path).toBe('jev');
      expect(w.journal.view.replyCheckPaths['operator-echo']).toBe(0);
    } finally { w.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('replays the recorded echo decision after a crash and sends once, never re-checking', async () => {
    const root = temp();
    const answer = 'The gym locker code is 5823 now.';
    let crash = true;
    const first = world(root, answer, { stopped: () => crash && first.journal.view.replyCheckPaths['operator-echo'] > 0 });
    try {
      await seed(first);
      await expect(first.say(3, question)).rejects.toThrow();
      expect(first.journal.view.order[2]?.intent).toBeUndefined();
    } finally { first.journal.close(); }
    crash = false;
    const second = world(root, 'a different answer that must not be used');
    try {
      await second.worker.drain();
      const turn = second.journal.view.order[2]!;
      expect(turn.sent).toBe(1);
      expect(turn.intent).toBe(`PREVIEW — ${answer}`);
      expect(second.calls.jev).toEqual([]);
      expect(second.calls.sends).toBe(1);
      expect(second.journal.view.replyCheckPaths['operator-echo']).toBe(1);
      await second.worker.drain();
      expect(second.calls.sends).toBe(1);
    } finally { second.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });
});

/** Astra's four repair witnesses, with their expected outcome under the Rules 4/10 reading: a
 * value returned only to the verified operator who supplied it in this private chat does not
 * leave, so an exact echo of ONE operator message sends without the second check; the exact
 * credential wall still runs on the send body. A value the operator never supplied is reviewed. */
describe('Astra repair witnesses under the Rules 4/10 reading', () => {
  it.each([
    { name: 'PIN with its label, from that one message: sent', own: 'My account login PIN is 5823.', reply: 'Your account login PIN is 5823.', echo: true },
    { name: 'same PIN with its label omitted: sent', own: 'My account login PIN is 5823.', reply: 'It is 5823.', echo: true },
    { name: 'a number the operator never gave: reviewed', own: 'My account login PIN is 9911.', reply: 'It is 5823.', echo: false },
    { name: 'one-time code rephrased with an added "is": reviewed', own: 'My bank sent a one-time code to sign in: 5823.', reply: 'Your one-time code to sign in is 5823.', echo: false },
    { name: 'one-time code repeated verbatim from that one message: sent', own: 'My bank sent a one-time code to sign in: 5823.', reply: 'Your one-time code to sign in: 5823.', echo: true },
    { name: 'same value with an added word: reviewed', own: 'My account login PIN is 5823.', reply: 'Your current PIN is 5823.', echo: false },
  ])('$name', async ({ own, reply, echo }) => {
    expect(repeatsOperatorOnly(reply, [own])).toBe(echo);
    const root = temp();
    const journal = openPreviewJournal(join(root, 'journal'), key, genesis);
    let jev = 0, reviews = 0;
    const sends: string[] = [], walls: string[] = [];
    try {
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
        model: async () => JSON.stringify({ reply, memory: [] }),
        send: async input => { sends.push(input.text); return 1; },
        checkOutbound: text => { walls.push(text); },
        replyCheck: { elapsedMs: () => 0, jev: async () => { jev++;
          return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id =>
            [id, { type: 'noul', noul: id === 'credential' ? 0.99 : 0.01 }])) }, latencyMs: 1 }; },
          escalate: async () => { reviews++; return { verdict: 'violation', ruleIds: ['credential'], confidence: 1, latencyMs: 1 }; } } });
      worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        text: own, date: Math.floor(now / 1000) } }]);
      await worker.drain();
      const expected = echo ? `PREVIEW — ${reply}` : HOLDING_REPLY;
      expect([jev, reviews]).toEqual(echo ? [0, 0] : [1, 1]);
      expect(journal.view.order[0]?.replyChecks?.[0]?.path).toBe(echo ? 'operator-echo' : 'jev');
      expect(journal.view.replyCheckPaths['operator-echo']).toBe(echo ? 1 : 0);
      expect(sends).toEqual([expected]);
      expect(walls).toEqual([expected]);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('an access token the operator pasted and the reply echoes is blocked by the exact wall', async () => {
    const root = temp();
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const w = world(root, `It is ${token}.`);
    try {
      await w.say(1, `My GitHub token is ${token}`);
      const turn = w.journal.view.order[0]!;
      expect(turn.replyChecks).toEqual([expect.objectContaining({ verdict: 'violation', ruleIds: ['credential'], path: 'holding' })]);
      expect(turn.intent).toBe(HOLDING_REPLY);
      expect(w.calls.outbound.some(text => text.includes(token))).toBe(false);
      expect(w.journal.view.replyCheckPaths['operator-echo']).toBe(0);
    } finally { w.journal.close(); rmSync(root, { recursive: true, force: true }); }
  });
});

describe('review witnesses: imported secrets and older snapshots', () => {
  const update1 = (text: string) => ({ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text, date: Math.floor(now / 1000) } });
  it.each([true, false])('an imported password beside a matching operator number is still checked (matching=%s)', async matching => {
    const root = temp();
    const journal = openPreviewJournal(join(root, 'journal'), key, genesis);
    const reply = 'Your locker code is 5823. Sam says the server password is violetorchid.';
    let checks = 0;
    const sends: string[] = [];
    try {
      importChannelFixture(journal, [{ source: 'email', account: 'echo-agent@example.test', id: 'mail-1',
        from: 'sam@example.test', at: now - 3600000, subject: 'Server access',
        text: 'The server password is violetorchid.' }], 'echo-agent@example.test', now);
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
        model: async () => JSON.stringify({ reply, memory: [] }),
        send: async input => { sends.push(input.text); return 1; },
        checkOutbound: () => {},
        replyCheck: { elapsedMs: () => 0, jev: async () => { checks++;
          return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id =>
            [id, { type: 'noul', noul: id === 'credential' ? 0.99 : 0.01 }])) }, latencyMs: 1 }; },
          escalate: async () => ({ verdict: 'violation', ruleIds: ['credential'], confidence: 1, latencyMs: 1 }) } });
      worker.intake([update1(`My locker code is ${matching ? '5823' : '9911'}. What did Sam send?`)]);
      await worker.drain();
      expect(checks).toBe(1);
      expect(journal.view.order[0]?.replyChecks?.[0]?.path).toBe('jev');
      expect(journal.view.replyCheckPaths['operator-echo']).toBe(0);
      expect(sends).toEqual([HOLDING_REPLY]);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it('restores a snapshot written before the operator-echo counter with the counter at zero', () => {
    const root = temp();
    const path = join(root, 'journal');
    // The snapshot is written in the pre-change shape; the live view regains the counter
    // before the compaction self-check, as a reopened pre-change journal would present it.
    let journal = openPreviewJournal(path, key, genesis, stage => {
      if (stage === 'compact:after-fsync') journal.view.replyCheckPaths['operator-echo'] = 0;
    });
    try {
      delete (journal.view.replyCheckPaths as Partial<typeof journal.view.replyCheckPaths>)['operator-echo'];
      journal.compact(); journal.close();
      journal = openPreviewJournal(path, key);
      expect(journal.view.replyCheckPaths['operator-echo']).toBe(0);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });
});
