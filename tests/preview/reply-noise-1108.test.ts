/** reply-noise-1108: the live 217 real-task reply of 2026-11-08 11:54 PST ended with three "Follow-up on ...: answered above."
 * lines about older promises it never answered. Promise wording and the marker tail are recorded (the brief's capture). Whether a
 * passage gives an owed result is the answering model's judgment (Rules 4, 10, 86): the runner keeps only its exact checks (the
 * quote is in the reply, the item was offered, the final text, the send receipt), and the repaired selection guidance tells the
 * model what carrying claims. The model's raw 11:54 declarations were not available here, so these stub tests prove only the
 * runner side; the real-model replay of the recorded 11:54 context is the desk's (see the repair report). */
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';

const PROMISES = [
  'CI is still running on it, so it is not merged.',
  'Once #2897 is merged, I can rebase #2882 onto main so Docs Coverage passes.',
  'Please read what they say, fix what is yours to fix, and get it ready to merge.',
] as const;
const REPORTS = [
  'CI finished green on #2897 and it is merged.',
  'Rebased #2882 onto main; Docs Coverage now passes.',
  'Read all review comments on #2882, fixed the two that were mine, and it is ready to merge.',
] as const;
const TASK = 'what changed in the launcher today?';
const ANSWER = 'Today the launcher gained a retry when the first model call is refused. Nothing else in it changed.';
const RECORDED_TAIL = PROMISES.map(quote => `Follow-up on "${quote}": answered above.`);
const key = new Uint8Array(32).fill(43);
const T0 = 1794200000000;
type Decide = (keys: string[], retry: boolean) => Record<string, unknown>;

async function run(decide: Decide, reply = ANSWER, seen: string[] = []) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-noise-'))), path = join(root, 'journal.encrypted');
  let now = T0, calls = 0;
  const sent: string[] = [];
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 65536, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, prepareModel: input => input.context,
    model: async ({ id, question, context }) => {
      if (id.startsWith('obligation:')) {
        const index = PROMISES.findIndex(quote => question.includes(quote) || context.includes(quote));
        return JSON.stringify({ outcome: 'report', report: REPORTS[index]! });
      }
      if (question !== TASK) return JSON.stringify({ reply: 'Noted.', memory: [] });
      calls++; seen.push(context);
      const keys = (JSON.parse(context) as { pendingReports?: { items: { key: string }[] } }).pendingReports?.items.map(item => item.key) ?? [];
      return JSON.stringify({ reply, memory: [], ...decide(keys, calls > 1) });
    },
    send: async ({ text }) => { sent.push(text); return sent.length; }, checkOutbound: () => {} });
  const say = async (update: number, text: string) => {
    worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(now / 1000) } }]);
    await worker.drain();
  };
  for (const [index, quote] of PROMISES.entries()) await say(100 + index, quote);
  const sources = journal.view.order.map(turn => turn.id);
  journal.append({ kind: 'summary-reserve', through: 102, maxInputTokens: 65536, maxOutputTokens: 2048, at: now });
  journal.append({ kind: 'summary', through: 102, text: 'Three pieces of PR work are owed.',
    commitments: PROMISES.map((quote, index) => ({ in: 'message' as const, source: sources[index]!, quote, owner: 'agent' as const, waitsOn: 'nothing' as const })), at: now });
  for (let i = 0; i < 4; i++) { now += LOOP_REVISIT_MS + 60_000; await worker.workObligations(); }
  const owedBefore = loopHealth(journal.view, now).awaitingDelivery;
  await say(200, TASK);
  return { sent, journal, owedBefore, calls: () => calls, health: () => loopHealth(journal.view, now),
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}
const markers = (text: string) => text.split('": answered above.').length - 1;
const COMBINED = `${ANSWER} CI finished green, so #2897 is merged. #2882 is rebased and Docs Coverage passes. The review fixes on #2882 are done.`;

it('reply-noise-1108: the model judges each offered item with its promise, its stored result and the repaired guidance', async () => {
  const seen: string[] = [];
  const r = await run(keys => ({ selectedReports: keys }), ANSWER, seen);
  try {
    const offered = (JSON.parse(seen[0]!) as { pendingReports: { guidance: string; items: { subject: string; text: string }[] } }).pendingReports;
    expect(offered.items.map(item => item.text).sort()).toEqual([...REPORTS].sort());
    for (const item of offered.items) expect(PROMISES.some(quote => item.subject.includes(quote))).toBe(true);
    expect(offered.guidance).toContain('carry an item only when your reply alone tells the operator its result; one passage may give several.');
    expect(offered.guidance).toContain('An item your reply does not answer is selected or rejected, never carried.');
  } finally { r.close(); }
});
it('reply-noise-1108: selected results are delivered verbatim, each once, with no "answered above" line', async () => {
  const r = await run(keys => ({ selectedReports: keys }));
  try {
    expect(r.owedBefore).toBe(3);
    const reply = r.sent.at(-1)!;
    for (const report of REPORTS) expect(reply.split(report).length - 1).toBe(1);
    for (const line of RECORDED_TAIL) expect(reply).not.toContain(line);
    expect(markers(reply)).toBe(0);
    expect(r.calls()).toBe(1);
    expect(r.health().awaitingDelivery).toBe(0);
  } finally { r.close(); }
});
it('reply-noise-1108: one passage that truthfully gives three different results delivers all three in one call', async () => {
  const r = await run(keys => ({ carriedReports: keys.map(item => ({ key: item, quote: COMBINED })) }), COMBINED);
  try {
    expect(markers(r.sent.at(-1)!)).toBe(3);
    expect(r.calls()).toBe(1);
    expect(r.health().awaitingDelivery).toBe(0);
  } finally { r.close(); }
});
it('reply-noise-1108: a reply whose own words give each result keeps one marker per result', async () => {
  const quotes = ['CI finished green, so #2897 is merged.', '#2882 is rebased and Docs Coverage passes.', 'The review fixes on #2882 are done.'];
  const r = await run(keys => ({ carriedReports: keys.map((item, index) => ({ key: item, quote: quotes[index]! })) }), COMBINED);
  try {
    expect(markers(r.sent.at(-1)!)).toBe(3);
    expect(r.calls()).toBe(1);
    expect(r.health().awaitingDelivery).toBe(0);
  } finally { r.close(); }
});
