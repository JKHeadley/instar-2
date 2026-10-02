import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests, MEMORY_UNDECIDED_REPLY } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

// Plan row #256, live proof room 2 on cint-L23 e26a8c1b (2026-10-01 23:22 PDT). The root's context limit was 409600
// bytes and its packet 148373, so nothing was under size pressure, but the carried rolling summary had outgrown the
// 24 KiB summary prompt: the next span (update 6230388, a 1500-byte garden log) could not be prepared at all, and its
// preflight refusal was held on that turn. "Actually, cancel the bird feeder one." (update 6230467) then waited with
// no reply, no model call, no summary failure and no reservation, and the 11:36 pm reminder it may have cancelled
// never fired (Rules 2, 10, 15, 57, 93, 95). The texts below are the recorded messages; the prompt envelope is the
// launcher's real one, so the preflight refusal is the real one. The summary prompt ceiling is now three quarters of the
// context limit (w3-summaryfit): under the room's own 409600 bytes it is 64 KiB and that span is summarized
// (summary-fit.test.ts). This file keeps proving the settle path for a span that cannot be prepared, so its root uses
// a 32 KiB limit, whose ceiling is the 24 KiB the room had.
const key = new Uint8Array(32).fill(43);
const start = Date.UTC(2026, 9, 2, 6, 0); // 23:00 in Los Angeles on 2026-10-01.
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:correction-stall', configurationDigest: 'sha256:correction-stall', expires: Date.UTC(2026, 9, 10),
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text, date: Math.floor(start / 1000) + id * 60 } });
// The recorded filler shape: 1500 bytes, cut off partway through row 11.
const row = (n: number) => `Row ${n} of the beans looked steady today; watered at dawn, mulch still damp, one stake retied, no pests seen, soil loose after the light rain. `;
const gardenLog = (n: number) => `Garden log ${n}: a quiet note for the record, nothing to act on. ${Array.from({ length: 12 }, (_, i) => row(i + 1)).join('')}`.slice(0, 1500);
const ra1 = 'Remind me today at 11:36 pm to refill the bird feeder';
const ra2 = 'Tell me today at 11:36 pm what I asked you to remember';
const ra3 = 'Actually, cancel the bird feeder one.';
const walk = 'Remind me today at 11:50 pm to take a short walk';
const ra1b = 'Remind me today at 11:45 pm to refill the bird bath';
const ra3b = 'Actually, cancel the bird bath one.';
const longLog = `Garden log 90: a quiet note for the record, nothing to act on. ${Array.from({ length: 48 }, (_, i) => row(i + 1)).join('')}`.slice(0, 6000);
type Input = { id: string; question: string; context: string };
type Reminder = { id: string; quote: string };

/** `bigSummary`: the accepted summary carries the recorded size of the live one (most of the 24 KiB summary prompt).
 * `decides`: whether the cancel's own answer decides it (the model may also leave it undecided). */
const world = (root: string, opts: { bigSummary: boolean; decides: boolean }, clock = { now: start + 20 * 60_000 }, first = true) => {
  const calls: Input[] = [], sent: string[] = [], offered: string[][] = [];
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: (input: Input) => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, clock.now, genesis.maxBytes),
    model: async (input: Input) => {
      calls.push(input);
      const packet = JSON.parse(input.context) as { reminders?: Reminder[] };
      if (input.id.startsWith('summary:')) {
        const text = opts.bigSummary
          ? Array.from({ length: 60 }, (_, i) => `Garden log ${i + 1} recorded steady bean rows, dawn watering and one retied stake.`).join(' ').slice(0, 8150)
          : 'The operator asked for a bird feeder reminder and then cancelled it.';
        // The live carried summary also kept memory items quoting the garden logs (3615 bytes recorded).
        const memoryItems = opts.bigSummary ? [1, 2, 3].flatMap(n => Array.from({ length: 7 }, (_, i) =>
          ({ source: `telegram:8989505249:update:${n}`, quote: row(i + 1).trim() }))) : [];
        return JSON.stringify({ summary: text, memoryItems, people: [], memory: [], commitments: [], questions: [],
          cancelReminders: (packet.reminders ?? []).filter(item => item.quote.includes('bird feeder')).map(item => item.id) });
      }
      if (input.question === ra1) return JSON.stringify({ reply: 'Okay, 11:36 pm today.', memory: [], dated: [{ quote: ra1, when: 'today at 11:36 pm', remind: true }] });
      if (input.question === ra1b) return JSON.stringify({ reply: 'Okay, 11:45 pm today.', memory: [], dated: [{ quote: ra1b, when: 'today at 11:45 pm', remind: true }] });
      if (input.question === walk) return JSON.stringify({ reply: 'Okay, 11:50 pm today.', memory: [], dated: [{ quote: walk, when: 'today at 11:50 pm', remind: true }] });
      if (input.question === ra3 || input.question === ra3b) {
        const target = input.question === ra3 ? 'bird feeder' : 'bird bath';
        const listed = packet.reminders ?? [];
        offered.push(listed.map(item => item.quote));
        // Undecided: the answer gives no memory decision for a cued correction, the shape the runner holds as pending.
        return opts.decides
          ? JSON.stringify({ reply: 'Done, the bird feeder reminder is cancelled.', memory: [], dated: [],
            // cint-L27: the answer path admits a cancellation only against the operator's own withdrawing words
            // (w3-reminderwords); the summary path above keeps its ids-only shape.
            cancelReminders: listed.filter(item => item.quote.includes(target)).map(item => ({ id: item.id, quote: `cancel the ${target} one` })) })
          : JSON.stringify({ reply: 'Okay.', dated: [] });
      }
      return JSON.stringify({ reply: `Noted: ${input.question.slice(0, 40)}`, memory: [], dated: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = first ? openPreviewJournal(join(root, 'journal.encrypted'), key, genesis) : openPreviewJournal(join(root, 'journal.encrypted'), key);
  return { journal, worker: createJournalWorker(journal, ports), calls, sent, offered };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-correction-stall-${name}-`)));
const pushes = (sent: string[]) => sent.filter(text => text.startsWith('PREVIEW — You asked on'));
const turnOf = (w: ReturnType<typeof world>, text: string) => w.journal.view.order.find(turn => turn.text === text)!;

/** The recorded sequence up to the cancel: garden logs carried by a summary near the summary prompt cap, one more
 * garden log, then the two reminder messages. */
const liveShape = async (w: ReturnType<typeof world>) => {
  for (let n = 1; n <= 3; n++) { w.worker.intake([update(n, gardenLog(n))]); await w.worker.drain(); }
  await w.worker.summarizeIfNeeded(true);
  expect(w.journal.view.summaries).toHaveLength(1);
  w.worker.intake([update(4, gardenLog(4))]); await w.worker.drain();
  w.worker.intake([update(5, ra1)]); await w.worker.drain();
  w.worker.intake([update(6, ra2)]); await w.worker.drain();
  expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([ra1]);
};
const summaryCalls = (w: ReturnType<typeof world>) => w.calls.filter(input => input.id.startsWith('summary:')).map(input => input.id);

it('answers a cancel whose own summary span cannot be prepared, withdraws its reminder, and never fires it', async () => {
  const root = tmp('own-span');
  try {
    const clock = { now: start + 20 * 60_000 };
    let w = world(root, { bigSummary: true, decides: true }, clock);
    await liveShape(w);
    w.worker.intake([update(7, ra3)]); await w.worker.drain();
    const cancel = turnOf(w, ra3);
    // The real preflight refused the span that ends at the cancel: no call was made for it and no summary covers it.
    expect(summaryCalls(w)).not.toContain('summary:7');
    expect(w.journal.view.summaries.some(summary => summary.through >= 7)).toBe(false);
    expect(cancel.memoryUndecided).toBe(true);
    expect(cancel.held).toBeUndefined();
    expect(w.calls.at(-1)!.question).toBe(ra3);
    // The open request was offered to the answer, which decided the cancel.
    expect(w.offered).toEqual([[ra1]]);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(openRequests(w.journal.view)).toEqual([]);
    expect(w.sent.at(-1)).toContain('Cancelled request');
    // Past the due minute it never fires, before or after a restart, and nothing is sent twice.
    clock.now = Date.UTC(2026, 9, 2, 6, 40);
    await w.worker.drain(); await w.worker.sendRequested();
    expect(pushes(w.sent)).toEqual([]);
    w.journal.close();
    w = world(root, { bigSummary: true, decides: true }, clock, false);
    // The answer's own reservation durably ended the refusal hold on the cancel.
    expect(turnOf(w, ra3).held).toBeUndefined();
    await w.worker.drain(); await w.worker.sendRequested();
    expect(w.sent).toEqual([]);
    expect(w.calls).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.requestedAction)).toEqual([]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** The exact live state: the summary frontier is stuck on an earlier, already answered turn; a later reminder and a
 * later cancel follow (live: 6230388 held, then 6230465 and 6230467). */
const stuckFrontier = async (root: string, clock: { now: number }, decides: boolean) => {
  const w = world(root, { bigSummary: true, decides }, clock);
  await liveShape(w);
  // The fixture's carried summary is smaller than the live one (9295 bytes); a longer garden log makes up the
  // difference so the summary prompt can no longer hold the next span, as on the live root.
  w.worker.intake([update(7, longLog)]); await w.worker.drain();
  expect(turnOf(w, longLog).intent).toBeDefined();
  w.worker.intake([update(8, ra1b)]); await w.worker.drain();
  expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([ra1, ra1b]);
  return w;
};

it('decides a later cancel while the frontier is stuck on an earlier answered turn (the live shape)', async () => {
  const root = tmp('live-shape');
  try {
    const clock = { now: start + 20 * 60_000 };
    const w = await stuckFrontier(root, clock, true);
    const before = summaryCalls(w).length;
    w.worker.intake([update(9, ra3b)]); await w.worker.drain();
    expect(summaryCalls(w)).toHaveLength(before);
    // The live state: the refusal is held on the earlier, already answered turn that starts the span (6230388).
    expect(turnOf(w, gardenLog(4))).toMatchObject({ held: 'summary oversized turn' });
    expect(turnOf(w, gardenLog(4)).intent).toBeDefined();
    expect(turnOf(w, ra3b)).toMatchObject({ memoryUndecided: true });
    expect(turnOf(w, ra3b).held).toBeUndefined();
    expect(w.offered).toEqual([[ra1, ra1b]]);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([ra1]);
    expect(w.sent.at(-1)).toContain('Cancelled request');
    // cint-L27 (w3-cancelpath): the cancel named the bird bath and only that. The bird-feeder request it did
    // not withdraw stands and falls due. It used to be held for good by the cancel's own undecided memory
    // state, so a withdrawal of one request silently killed every earlier one (Rules 2, 57, 93, 95).
    clock.now = Date.UTC(2026, 9, 2, 6, 50);
    await w.worker.drain(); await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain(ra1);
    expect(pushes(w.sent)[0]).not.toContain('bird bath');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('records an undecidable cancel as undecided with the plain notice, and every request it did not withdraw still fires', async () => {
  const root = tmp('undecided');
  try {
    const clock = { now: start + 20 * 60_000 };
    const w = await stuckFrontier(root, clock, false);
    w.worker.intake([update(9, ra3b)]); await w.worker.drain();
    const cancel = turnOf(w, ra3b);
    expect(cancel.memoryUndecided).toBe(true);
    expect(cancel.held).toBeUndefined();
    expect(w.sent.at(-1)).toContain(MEMORY_UNDECIDED_REPLY);
    expect(w.sent.at(-1)).not.toContain('Cancelled request');
    w.worker.intake([update(10, walk)]); await w.worker.drain();
    expect(turnOf(w, walk).intent).toBeDefined();
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([ra1, ra1b, walk]);
    clock.now = Date.UTC(2026, 9, 2, 6, 51); // past every due minute
    await w.worker.drain(); await w.worker.sendRequested(); await w.worker.sendRequested();
    // A request made before the cancel may have been withdrawn, so it waits for the cancel's own reply -- and
    // no longer than that. Nothing was withdrawn here, so every request the operator really made falls due,
    // in one grouped notice (Rules 2, 52, 57, 93, 95). cint-L27 (w3-cancelpath): before, only the request
    // made AFTER the cancel ever fired, and the two earlier ones died with it.
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain(walk);
    expect(pushes(w.sent)[0]).toContain('bird bath');
    expect(pushes(w.sent)[0]).toContain('bird feeder');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('still decides the cancel by the summary when the summary prompt has room (no undecided record)', async () => {
  const root = tmp('summary-room');
  try {
    const w = world(root, { bigSummary: false, decides: true });
    await liveShape(w);
    w.worker.intake([update(7, ra3)]); await w.worker.drain();
    const cancel = turnOf(w, ra3);
    expect(cancel.memoryUndecided).toBeUndefined();
    expect(w.journal.view.summaries.some(summary => summary.memoryFor?.includes(cancel.id))).toBe(true);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(w.journal.view.order.some(turn => turn.held === 'summary oversized turn')).toBe(false);
    expect(cancel.intent).toBeDefined();
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('recovers a root the old build left stalled: one drain after restart settles and answers the held cancel once', async () => {
  const root = tmp('restart');
  try {
    const clock = { now: start + 20 * 60_000 };
    let w = await stuckFrontier(root, clock, true);
    // The durable state the old build left on proof room 2: the later cancel intaken and held pending.
    w.worker.intake([update(9, ra3b)]);
    w.journal.append({ kind: 'hold', id: turnOf(w, ra3b).id, reason: 'memory correction pending', at: clock.now });
    w.journal.close();
    w = world(root, { bigSummary: true, decides: true }, clock, false);
    await w.worker.drain();
    expect(turnOf(w, ra3b)).toMatchObject({ memoryUndecided: true });
    expect(turnOf(w, ra3b).held).toBeUndefined();
    expect(w.sent.filter(text => text.includes('Cancelled request'))).toHaveLength(1);
    w.journal.close();
    w = world(root, { bigSummary: true, decides: true }, clock, false);
    await w.worker.drain();
    expect(w.sent).toEqual([]);
    expect(w.calls.filter(input => input.question === ra3b)).toEqual([]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
