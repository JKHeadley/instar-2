/** One delivered reminder must never make a conversation unreadable.
 *
 * The proof room at build 30bda628 (root proofroom-2026-10-01) could not be opened by its own build: every
 * command, `status` included, refused with "preview journal: unsupported promise proposal". The row it
 * refused was the agent's own reminder delivery — a requested-action turn — whose model output claimed
 * `fulfills` against commitment 1, a reminder the OPERATOR asked for, which carries no `agentPromise`. The
 * writer offered every agent-OWNED commitment; the replay accepted only agent PROMISES. The recorded row is
 * replayed from its fixture below: the writer must refuse the claim, the reply must still go out, the count
 * must be visible, and a journal that already holds such a row must still open. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { REPLY_RULES } from './reply-check.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/proofroom-fulfills-715673050-2026-10-01.json', import.meta.url), 'utf8')) as {
  update: number; text: string; fulfills: { id: number; quote: string }[]; commitment: { id: number; agentPromise: null } };
const DELIVERY = recorded.text;
const QUOTE = recorded.fulfills[0]!.quote;
const REQUEST = 'remind me tomorrow at 9 am to take a short walk';

const key = new Uint8Array(32).fill(13);
const start = Date.UTC(2026, 8, 26, 17); // Saturday 10:00 in Los Angeles.
const due = Date.UTC(2026, 8, 27, 17); // Sunday 10:00 in Los Angeles, past the 09:00 request.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:fulfills', configurationDigest: 'sha256:fulfills', expires: Date.UTC(2026, 9, 10),
  maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 9000, cursor: 0 };
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-fulfills-')));
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const status = (root: string) => {
  const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', root],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
    encoding: 'utf8', timeout: 30000 });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { obligations: { rejectedDeclarations: number }; commitments: { total: number; open: number } };
};

/** The proof room's own shape: the operator asks for a reminder, the conversation compacts so the summary
 * records that request as a commitment, and the due turn delivers it. `claim` decides whether the answering
 * model proposes the recorded `fulfills` against that commitment. */
async function deliverReminder(root: string, claim: boolean) {
  const state = { now: start, offered: [] as { id: number; owner?: string }[] };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const worker = createJournalWorker(journal, { now: () => state.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('summary:'))
        return JSON.stringify({ summary: 'The operator asked for a short walk reminder.', people: [],
          commitments: [{ in: 'message', quote: REQUEST, waitsOn: 'nothing' }], closed: [] });
      if (input.id.startsWith('requested-action:')) {
        state.offered = ((JSON.parse(input.context) as { commitments?: { items: { id: number; owner?: string }[] }[] })
          .commitments ?? []).flatMap(group => group.items);
        if (!claim || !state.offered.length) return DELIVERY;
        return JSON.stringify({ reply: DELIVERY, promises: [], fulfilled: [{ id: state.offered[0]!.id, quote: QUOTE }] });
      }
      if (input.question === REQUEST)
        return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: REQUEST, when: 'tomorrow at 9 am', remind: true }] });
      return 'Noted.';
    },
    send: async () => 1, checkOutbound: () => {} });
  const say = async (id: number, text: string) => {
    worker.intake([update(id, text)]); await worker.drain(); await worker.summarizeIfNeeded();
  };
  await say(1, REQUEST);
  for (let id = 2; id < 24; id++) await say(id, `ordinary turn ${id}: errands and plans ${'x'.repeat(40)}`);
  state.now = due;
  await worker.sendRequested();
  const delivery = journal.view.order.find(turn => turn.requestedAction !== undefined)!;
  return { journal, worker, state, delivery };
}

it('the recorded row is the live defect: a reminder delivery claiming a commitment that is not an agent promise', async () => {
  const root = origin();
  try {
    const w = await deliverReminder(root, true);
    // The delivery turn is a self-initiated requested action on the 1/1024 synthetic grid, as recorded.
    expect(w.delivery.requestedAction).toBeDefined();
    expect(w.delivery.update % 1).toBeCloseTo(recorded.update % 1, 9);
    // The claimed commitment reads as agent-owned in the packet and carries no promise in the journal.
    const claimed = w.state.offered[0]!;
    expect(claimed.owner).toBe('agent');
    expect(w.journal.view.commitments[claimed.id]?.agentPromise).toBe(recorded.commitment.agentPromise ?? undefined);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses the claim at the writer, still delivers the reminder, counts it, and keeps the journal readable', async () => {
  const root = origin();
  try {
    const w = await deliverReminder(root, true);
    const claimed = w.state.offered[0]!.id;
    // The reminder itself went out in full; only the claim about it was refused.
    expect(w.delivery.answer).toBe(DELIVERY);
    expect(w.delivery.intent).toContain(QUOTE);
    expect(w.delivery.sent).toBe(1);
    expect(w.delivery.proposedFulfills).toBeUndefined();
    expect(w.delivery.answerRejected).toEqual({ fulfills: 1 });
    expect(w.journal.view.rejectedObligations).toBe(1);
    // A claim the rule refuses never becomes a commitment change.
    expect(w.journal.view.closed.has(claimed)).toBe(false);
    w.journal.close();
    // The conversation still replays from its own bytes, and its own build can still read it.
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(reopened.view.rejectedObligations).toBe(1);
    expect(reopened.view.closed.has(claimed)).toBe(false);
    reopened.close();
    const seen = status(root);
    expect(seen.obligations.rejectedDeclarations).toBe(1);
    expect(seen.commitments.open).toBeGreaterThan(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('a refused fulfillment claim or a refused deferral never holds the reply when the reviewer is down', async () => {
  // Rules 77, 86, 95: the recorded row's text and claim, answered to the operator with reply review wired: Jev
  // passes every rule in its recorded answer shape, and the contextual reviewer is unavailable.
  for (const deferral of [false, true]) {
    const root = origin();
    try {
      const calls = { jev: 0, reviews: 0, sends: 0 };
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxBytes: 32768 });
      const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, timeZone: 'America/Los_Angeles',
        prepareModel: input => input.context,
        model: async () => JSON.stringify({ reply: DELIVERY, promises: [], fulfilled: recorded.fulfills,
          ...(deferral ? { openLoops: [{ kind: 'deferral', quote: 'A clause that was never in this reply.', waitsOn: 'nothing' }] } : {}) }),
        send: async () => ++calls.sends, checkOutbound: () => {},
        replyCheck: { elapsedMs: () => 0,
          jev: async () => { calls.jev++; return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(
            Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 1 }; },
          escalate: async () => { calls.reviews++; throw Error('preview: reply review unavailable'); } } });
      worker.intake([update(1, 'Please give me the short walk reminder now.')]);
      await worker.drain();
      const turn = journal.view.order[0]!;
      // Either way the claim is refused, counted, and closes nothing.
      expect(turn.answer).toBe(DELIVERY);
      expect(turn.proposedFulfills).toBeUndefined();
      expect(journal.view.closed.size).toBe(0);
      if (!deferral) {
        // The ordinary route: Jev passes it, no paid review is forced, and the reply goes out once.
        expect(turn.answerRejected).toEqual({ fulfills: 1 });
        expect(journal.view.rejectedObligations).toBe(1);
        expect(turn.replyChecks?.map(row => [row.path, row.verdict])).toEqual([['jev', 'pass']]);
        expect(calls).toEqual({ jev: 1, reviews: 0, sends: 1 });
        expect(turn.held).toBeUndefined();
        expect(turn.sent).toBe(1);
        expect(turn.intent).toContain(QUOTE);
      } else {
        // A refused deferral still skips Jev and forces the contextual review. Only that review's violation may
        // hold the reply (Rule 86); when it cannot decide, reachability fails open (Rules 77, 95), so the reply
        // goes out once and the declaration stays refused, never accepted (Rule 42).
        expect(turn.answerRejected).toEqual({ loops: 1, fulfills: 1 });
        expect(journal.view.rejectedObligations).toBe(2);
        expect(calls.jev).toBe(0);
        expect(calls.reviews).toBeGreaterThan(0);
        expect(turn.replyChecks?.at(-1)).toEqual(expect.objectContaining({ path: 'subscription', verdict: 'unavailable' }));
        expect(turn.held).toBeUndefined();
        expect(turn.release).toMatchObject({ review: 'unavailable' });
        expect(turn.sent).toBe(1);
        expect(calls.sends).toBe(1);
      }
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('replays a journal already holding the refused claim: ignored as a claim, counted, still readable', async () => {
  const root = origin();
  try {
    const w = await deliverReminder(root, false);
    const claimed = w.state.offered[0]!.id;
    expect(w.journal.view.commitments[claimed]?.agentPromise).toBeUndefined();
    // Exactly the row the writer appended before it shared the support rule.
    const stranded = 'telegram:12345678:update:30';
    w.worker.intake([update(30, 'Please send it again')]);
    w.journal.append({ kind: 'reserve', id: stranded, at: due });
    w.journal.append({ kind: 'answer', id: stranded, text: DELIVERY, state: 'complete',
      fulfills: [{ id: claimed, quote: QUOTE }], at: due });
    w.journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const turn = reopened.view.turns.get(stranded)!;
    expect(turn.answer).toBe(DELIVERY);
    expect(turn.proposedFulfills).toBeUndefined();
    expect(reopened.view.closed.has(claimed)).toBe(false);
    expect(reopened.view.rejectedObligations).toBe(1);
    reopened.close();
    expect(status(root).obligations.rejectedDeclarations).toBe(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('still accepts a fulfillment claim on the agent own promise it was always for', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, timeZone: 'America/Los_Angeles',
      prepareModel: input => input.context,
      model: async input => {
        if (input.id.startsWith('summary:')) return 'A plain summary.';
        if (input.question === 'Promise') return JSON.stringify({ reply: 'I will remind you to walk at 5:22.',
          promises: [{ quote: 'I will remind you to walk at 5:22.' }], fulfilled: [] });
        const items = ((JSON.parse(input.context) as { commitments?: { items: { id: number; owner?: string }[] }[] })
          .commitments ?? []).flatMap(group => group.items).filter(item => item.owner === 'agent');
        return items.length ? JSON.stringify({ reply: DELIVERY, promises: [], fulfilled: [{ id: items[0]!.id, quote: QUOTE }] })
          : 'Noted.';
      },
      send: async () => 1, checkOutbound: () => {} });
    const say = async (id: number, text: string) => {
      worker.intake([update(id, text)]); await worker.drain(); await worker.summarizeIfNeeded();
    };
    await say(1, 'Promise');
    expect(journal.view.commitments[0]?.agentPromise?.owner).toBe('agent');
    await say(2, 'Please remind me about the walk');
    expect(journal.view.order[1]?.answerRejected).toBeUndefined();
    expect(journal.view.order[1]?.proposedFulfills).toEqual([{ id: 0, quote: QUOTE }]);
    expect(journal.view.closed.get(0)?.source).toBe('telegram:12345678:update:2');
    expect(journal.view.rejectedObligations).toBe(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
