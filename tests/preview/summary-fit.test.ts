import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { createJournalWorker, openPreviewJournal, reportJournalCap, summaryPromptBytes, MEMORY_UNDECIDED_REPLY, SUMMARY_UNKNOWN_RECOVERY_MS } from './journal-test-worker.js';

// Plan row #259 (w3-summaryfit). A rolling-summary pass must always be able to run and advance the frontier by at
// least one turn, on any root whose turns fit the per-message bound (a 4096-character message, a 4096-byte reply).
// Two live roots broke it (live build cint-L23 e26a8c1b, 2026-10-02 00:10 PDT), both replayed read-only on copies with
// the launcher's real envelope:
// - Justin's preview: 328 turns, 409600-byte limit, no accepted summary ever. A summary call of 2026-09-26 21:25
//   (update 969389576) ended UNKNOWN; every later span had to end past it, so the shortest one ran from the first turn
//   and never fit the 24 KiB summary prompt. No summary call was made in the five days after.
// - Proof room 2: 63 summaries, then the carried summary (block 9295 bytes: 3214 bytes of prose and 20 memory items)
//   left no span preparable. The smallest summary prompt across 974 variants was 25272 bytes, over 24576.
// The fixtures keep the recorded shapes (sizes, row kinds, the proof room's own garden-log texts); Justin's message
// text is private and is not copied here.
const key = new Uint8Array(32).fill(59);
const at = Date.UTC(2026, 9, 2, 7, 0);
const genesis = (maxBytes = 409600) => ({ kind: 'genesis' as const, bot: '8820318295', chat: '7654321', operator: '7654321',
  grant: 'grant:summary-fit', configurationDigest: 'sha256:summary-fit', expires: Date.UTC(2026, 9, 30),
  maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes, cursor: 0 });
const idOf = (n: number) => `telegram:8820318295:update:${String(n)}`;
const raw = (n: number, text: string) => JSON.stringify({ update_id: n,
  message: { message_id: n, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at / 1000) + n } });
type Journal = ReturnType<typeof openPreviewJournal>;
/** One answered turn as the runner records it. */
const turn = (journal: Journal, n: number, text: string, reply: string) => {
  const id = idOf(n);
  journal.append({ kind: 'intake', id, update: n, text, raw: raw(n, text), accepted: true, cursor: n + 1, at: at + n });
  journal.append({ kind: 'reserve', id, at: at + n });
  journal.append({ kind: 'answer', id, text: reply, at: at + n });
  journal.append({ kind: 'intent', id, text: reply, chat: journal.view.genesis.chat, update: n,
    grant: journal.view.genesis.grant, at: at + n });
  journal.append({ kind: 'sent', id, message: n, at: at + n });
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-summary-fit-${name}-`)));
type Input = { id: string; question: string; context: string; prepared?: string };
/** The worker with the launcher's real envelope. `write` answers each summary call; every prepared summary prompt is
 * measured as sent (prepared stdin plus the system prompt). */
/** `answer` answers every non-summary call (an operator reply); `hold` is awaited before each summary call returns. */
const world = (journal: Journal, write: (input: Input) => object, clock = { now: at + 10_000_000, elapsed: 0 },
  opts: { answer?: (input: Input) => string; hold?: () => Promise<void> } = {}) => {
  const calls: string[] = [], prepared: string[] = [], sentBytes: number[] = [];
  const worker = createJournalWorker(journal, { now: () => clock.now, elapsed: () => clock.elapsed, stopped: () => false,
    timeZone: 'America/Los_Angeles',
    prepareModel: input => {
      if (input.id.startsWith('summary:')) prepared.push(input.id);
      return prepareJournalEnvelope(input, 'claude-opus-5-5', journal.view.genesis.grant, clock.now, journal.view.limits.maxBytes);
    },
    model: async (input: Input) => {
      calls.push(input.id);
      if (!input.id.startsWith('summary:') && opts.answer) return opts.answer(input);
      if (opts.hold) await opts.hold();
      sentBytes.push(Buffer.byteLength(input.prepared ?? '') + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT));
      return JSON.stringify({ people: [], commitments: [], memory: [], questions: [], ...write(input) });
    },
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    send: async () => journal.view.replies + 1, checkOutbound: () => {} });
  return { worker, calls, prepared, sentBytes, clock };
};
const plain = () => ({ summary: 'The operator kept a running log of ordinary errands and garden notes.' });
/** A carried summary as an older build accepted it, before this build's prose bound (w3-summarybound): its prose up
 * to that build's 8192 bytes. This build never writes one; it still has to summarize past one. */
const carryOld = (journal: Journal, through: number, summary: string, memoryItems: { source: string; quote: string }[]) => {
  journal.append({ kind: 'summary-reserve', through, maxInputTokens: 409600, maxOutputTokens: 2048, at: at + through });
  journal.append({ kind: 'summary', through, text: summary, ...(memoryItems.length ? { memoryItems } : {}),
    faithfulness: { path: 'exact', verdict: 'pass', score: null }, state: 'complete', at: at + through });
};

// The recorded size distribution of Justin's root: mostly short messages (46-100 bytes), replies of 70-700 bytes,
// and an occasional long message or reply (largest 3892 and 4141 bytes).
const justinText = (n: number) => n % 37 === 0 ? `Long note ${String(n)}: ${'plans, notes and a list to keep. '.repeat(110)}`.slice(0, 3892)
  : `Message ${String(n)}: a short question about today.`;
const justinReply = (n: number) => n % 41 === 0 ? `PREVIEW — ${'A careful, sourced answer with the detail asked for. '.repeat(80)}`.slice(0, 4096)
  : `PREVIEW — Answer ${String(n)}: ${'noted with its date and source. '.repeat(n % 3 === 0 ? 20 : 2)}`;

it('summarizes a root with hundreds of unsummarized turns behind an old UNKNOWN summary (Justin\'s shape)', async () => {
  const root = tmp('justin');
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    for (let n = 1; n <= 328; n++) {
      turn(journal, n, justinText(n), justinReply(n));
      // The recorded summary rows: one definite failure without a class (2026-09-26 15:37), then one call that came
      // back uncertain with no usage (2026-09-26 21:25). Neither was ever settled further.
      if (n === 19) {
        journal.append({ kind: 'summary-reserve', through: 19, at: at + n });
        journal.append({ kind: 'summary-failed', through: 19, at: at + n });
      }
      if (n === 31) {
        journal.append({ kind: 'summary-reserve', through: 31, at: at + n });
        journal.append({ kind: 'summary-uncertain', through: 31, state: 'uncertain',
          usage: { inputTokens: null, outputTokens: null, charge: null }, at: at + n });
      }
    }
    expect(journal.view.summaries).toHaveLength(0);
    expect(journal.view.summaryReservations.has(31)).toBe(true);
    const w = world(journal, plain);
    // The launcher's elapsed clock restarts with the process, so a restarted runner waits out the recovery pause once.
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toEqual([]);
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    await w.worker.summarizeIfNeeded(true);
    // The pass runs and advances: eight accepted frames, oldest first, each within the summary prompt ceiling.
    expect(w.calls.length).toBe(8);
    expect(journal.view.summaries.length).toBe(8);
    expect(journal.view.summaries[0]!.through).toBeGreaterThan(0);
    expect(journal.view.summaries.at(-1)!.through).toBeGreaterThan(31);
    expect(Math.max(...w.sentBytes)).toBeLessThanOrEqual(summaryPromptBytes(409600));
    // The UNKNOWN call is never dispatched again and keeps its charge; nothing is held for size.
    expect(w.prepared).not.toContain('summary:31');
    expect(journal.view.summaryReservations.has(31)).toBe(true);
    expect(journal.view.summaries.some(item => item.through === 31)).toBe(false);
    expect(journal.view.order.filter(item => item.held !== undefined)).toEqual([]);
    // Further passes catch the whole conversation up, bounded per pass.
    for (let pass = 0; pass < 20 && journal.view.summaries.at(-1)!.through < 328; pass++) await w.worker.summarizeIfNeeded(true);
    expect(journal.view.summaries.at(-1)!.through).toBe(328);
    expect(w.calls.filter(id => id === 'summary:31')).toEqual([]);
    expect(Math.max(...w.sentBytes)).toBeLessThanOrEqual(summaryPromptBytes(409600));
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

// Proof room 2's recorded garden-log filler (the same text as journal-correction-stall.test.ts).
const row = (n: number) => `Row ${String(n)} of the beans looked steady today; watered at dawn, mulch still damp, one stake retied, no pests seen, soil loose after the light rain. `;
const gardenLog = (n: number) => `Garden log ${String(n)}: a quiet note for the record, nothing to act on. ${Array.from({ length: 12 }, (_, i) => row(i + 1)).join('')}`.slice(0, 1500);

it('advances past a carried summary of the size that stopped proof room 2', async () => {
  const root = tmp('room2');
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    for (let n = 1; n <= 4; n++) turn(journal, n, gardenLog(n), `PREVIEW — Logged garden note ${String(n)}.`);
    // The recorded carried summary: prose and 20 memory items quoting the garden logs (about 300 bytes each). The live
    // block was 9295 bytes beside a 2849-byte capability note; this fixture's capability note is 1093 bytes, so its
    // prose is longer to reach the live smallest summary prompt (25272 bytes, over the old 24576-byte ceiling).
    const big = () => ({ summary: Array.from({ length: 60 }, (_, i) => `Garden log ${String(i + 1)} recorded steady bean rows, dawn watering and one retied stake.`)
      .join(' ').slice(0, 4100),
    memoryItems: [1, 2, 3, 4].flatMap(n => Array.from({ length: 5 }, (_, i) => ({ source: idOf(n), quote: `${row(i + 1)}${row(i + 2)}`.trim() }))) });
    carryOld(journal, 4, big().summary, big().memoryItems);
    const w = world(journal, plain);
    const carried = journal.view.summaries.at(-1)!;
    expect(carried.through).toBe(4);
    expect(Buffer.byteLength(carried.text)).toBeGreaterThan(3214);
    expect(carried.memoryItems).toHaveLength(20);
    // The next span is one more recorded garden log (live: update 6230388). Before this change its smallest summary
    // prompt was over the 24 KiB ceiling and no call was ever made for it again.
    turn(journal, 5, gardenLog(5), 'PREVIEW — Logged garden note 5.');
    const before = w.calls.length;
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls.slice(before)).toEqual(['summary:5']);
    expect(journal.view.summaries.at(-1)!.through).toBe(5);
    expect(w.sentBytes.at(-1)!).toBeGreaterThan(25272);
    expect(w.sentBytes.at(-1)!).toBeLessThanOrEqual(summaryPromptBytes(409600));
    expect(journal.view.order.filter(item => item.held !== undefined)).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('bounds the summary prompt for every carried summary up to its accept bound and one maximum-size turn', async () => {
  // The carried summary's accept bounds before w3-summarybound: prose at most 8192 bytes, at most 20 memory items of
  // 300 bytes, carried as an older build accepted them; this build rewrites that prose within its own bound. The turn:
  // a 4096-character message (ASCII, and 3-byte characters at 12288 bytes) with a 4096-byte reply.
  const clause = (n: number, i: number) => `Note ${String(n)}.${String(i)}: the "shed" key is under the blue pot; ${'details kept exactly. '.repeat(13)}`.slice(0, 300);
  const prose = (bytes: number) => `The operator said "keep this", and noted:\n${'A dated fact with its "source" and exact unit, 12 kg. '.repeat(160)}`.slice(0, bytes);
  const reply = `PREVIEW — ${'A complete answer to the long note. '.repeat(120)}`;
  let replyMax = reply.slice(0, 4096);
  while (Buffer.byteLength(replyMax) > 4096) replyMax = replyMax.slice(0, -1);
  expect(Buffer.byteLength(replyMax)).toBeGreaterThan(4090);
  const messages = [`Long message: ${'x'.repeat(4096)}`.slice(0, 4096), '漢'.repeat(4096)];
  const sizes: number[] = [];
  for (const textBytes of [0, 1000, 4000, 8192]) for (const items of [0, 10, 20]) for (const message of messages) {
    const root = tmp('bound');
    try {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
      for (let n = 1; n <= 4; n++) turn(journal, n, Array.from({ length: 5 }, (_, i) => clause(n, i)).join(' '), `PREVIEW — Kept note ${String(n)}.`);
      const carried = () => ({ summary: textBytes ? prose(textBytes) : 'Notes kept.',
        memoryItems: [1, 2, 3, 4].flatMap(n => Array.from({ length: 5 }, (_, i) => ({ source: idOf(n), quote: clause(n, i) }))).slice(0, items) });
      carryOld(journal, 4, carried().summary, carried().memoryItems);
      const w = world(journal, plain);
      expect(journal.view.summaries.at(-1)!.through).toBe(4);
      expect(journal.view.summaries.at(-1)!.memoryItems?.length ?? 0).toBe(items);
      if (textBytes) expect(Buffer.byteLength(journal.view.summaries.at(-1)!.text)).toBeGreaterThanOrEqual(textBytes - 2);
      expect(Array.from(message).length).toBe(4096);
      turn(journal, 5, message, replyMax);
      const before = w.calls.length;
      await w.worker.summarizeIfNeeded(true);
      // The one-turn span always runs and advances, and its prompt stays within the ceiling.
      expect(w.calls.slice(before), `${textBytes}/${items}/${Buffer.byteLength(message)}`).toEqual(['summary:5']);
      expect(journal.view.summaries.at(-1)!.through).toBe(5);
      sizes.push(w.sentBytes.at(-1)!);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  expect(sizes).toHaveLength(24);
  expect(Math.max(...sizes)).toBeLessThanOrEqual(summaryPromptBytes(409600));
}, 120000);

it('never repeats an UNKNOWN summary across a restart, and keeps every accepted frame', async () => {
  const root = tmp('restart');
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis());
    for (let n = 1; n <= 40; n++) turn(journal, n, justinText(n), justinReply(n));
    // The process ended inside a summary call: its reservation is all that was written.
    journal.append({ kind: 'summary-reserve', through: 4, at: at + 40 });
    journal.close();
    journal = openPreviewJournal(path, key);
    const clock = { now: at + 10_000_000, elapsed: 0 };
    let w = world(journal, plain, clock);
    // Inside the recovery pause nothing runs.
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toEqual([]);
    clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls.length).toBeGreaterThan(0);
    expect(w.prepared).not.toContain('summary:4');
    expect(journal.view.summaryReservations.has(4)).toBe(true);
    const frames = journal.view.summaries.map(item => item.through);
    expect(frames).not.toContain(4);
    journal.close();
    // A second restart keeps every frame and makes no call for anything already decided.
    journal = openPreviewJournal(path, key);
    expect(journal.view.summaries.map(item => item.through)).toEqual(frames);
    w = world(journal, plain, { now: at + 20_000_000, elapsed: 0 });
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toEqual([]);
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    for (let pass = 0; pass < 10; pass++) await w.worker.summarizeIfNeeded(true);
    expect(w.calls.filter(id => id === 'summary:4' || frames.includes(Number(id.split(':').at(-1))))).toEqual([]);
    expect(journal.view.summaries.slice(0, frames.length).map(item => item.through)).toEqual(frames);
    expect(journal.view.summaries.at(-1)!.through).toBe(40);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('does not summarize a short conversation under a large limit', async () => {
  const root = tmp('short');
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    for (let n = 1; n <= 12; n++) turn(journal, n, justinText(n), justinReply(n));
    const w = world(journal, plain);
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toEqual([]);
    expect(journal.view.summaries).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Plan row #262 (w3-summaryfit catch-up). Justin's root goes live 328 turns behind the summary frontier. The runner
// already starts the background summary pass (`summarizeIfNeeded()`, unforced) after every poll cycle's ordinary drain,
// with or without a new message, so the catch-up runs pass after pass while he is silent. These tests drive that call
// directly. What must not happen: a correction, preference or edit driving the whole catch-up synchronously before its
// reply is sent.
/** Justin's recorded shape, including the classless failure (2026-09-26 15:37) and the uncertain call with no usage
 * (update 969389576, 2026-09-26 21:25) that stays a reservation for the life of the root. */
const justinRoot = (path: string, maxCalls = 1000) => {
  const journal = openPreviewJournal(path, key, { ...genesis(), maxCalls });
  for (let n = 1; n <= 328; n++) {
    turn(journal, n, justinText(n), justinReply(n));
    if (n === 19) {
      journal.append({ kind: 'summary-reserve', through: 19, at: at + n });
      journal.append({ kind: 'summary-failed', through: 19, at: at + n });
    }
    if (n === 31) {
      journal.append({ kind: 'summary-reserve', through: 31, at: at + n });
      journal.append({ kind: 'summary-uncertain', through: 31, state: 'uncertain',
        usage: { inputTokens: null, outputTokens: null, charge: null }, at: at + n });
    }
  }
  return journal;
};
/** Summary-frame calls only (index-only calls carry `summary:index:`). */
const frames = (calls: string[]) => calls.filter(id => /^summary:\d+$/u.test(id));
const noted = () => JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
/** The recorded correction (proof room 2, update 6230467) and its two recorded answer shapes: one that decides it and
 * the undecided one (no memory decision), from journal-correction-stall.test.ts. */
const cancel = 'Actually, cancel the bird feeder one.';
const decidingAnswer = () => JSON.stringify({ reply: 'Done, the bird feeder reminder is cancelled.', memory: [], dated: [] });
const undecidedAnswer = () => JSON.stringify({ reply: 'Okay.', dated: [] });
const update = (n: number, text: string) => JSON.parse(raw(n, text)) as { update_id: number };

it('catches a far-behind root up pass after pass with no operator message, each pass within its call bound', async () => {
  const root = tmp('catchup');
  try {
    const journal = justinRoot(join(root, 'journal.encrypted'));
    const w = world(journal, plain);
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    const perPass: number[] = [], frontier: number[] = [];
    for (let pass = 0; pass < 12; pass++) {
      const before = w.calls.length;
      await w.worker.summarizeIfNeeded();
      perPass.push(frames(w.calls.slice(before)).length);
      frontier.push(journal.view.summaries.at(-1)?.through ?? -1);
    }
    // Ten passes (74 frames of at most four turns) bring the frontier to 297; the 31 turns after it fit under the 24 KiB
    // start threshold and stay as raw history, as in any chat. Later passes make no summary-frame call.
    expect(perPass.every(count => count <= 8)).toBe(true);
    expect(perPass).toEqual([8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 0, 0]);
    expect(frontier).toEqual([33, 65, 97, 129, 161, 193, 225, 257, 289, 297, 297, 297]);
    // Monotone, never re-dispatches the UNKNOWN, holds nothing for size.
    expect(frontier.every((value, i) => i === 0 || value >= frontier[i - 1]!)).toBe(true);
    expect(w.prepared).not.toContain('summary:31');
    expect(new Set(frames(w.calls)).size).toBe(frames(w.calls).length);
    expect(journal.view.order.filter(item => item.held !== undefined)).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('answers an operator message that arrives mid catch-up while the pass is still in flight', async () => {
  const root = tmp('midpass');
  try {
    const journal = justinRoot(join(root, 'journal.encrypted'));
    let release!: () => void;
    const gate = new Promise<void>(done => { release = done; });
    const w = world(journal, plain, undefined, { answer: noted, hold: () => gate });
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    let passDone = false;
    const pass = w.worker.summarizeIfNeeded().then(() => { passDone = true; });
    await new Promise(done => setImmediate(done));
    expect(frames(w.calls)).toHaveLength(1);
    w.worker.intake([update(329, 'Message 329: a short question about today.')]);
    await w.worker.drain();
    // The reply went out while the first summary call of the pass is still waiting on the model.
    const asked = journal.view.order.find(item => item.update === 329)!;
    expect(asked.sent).toBeDefined();
    expect(passDone).toBe(false);
    expect(frames(w.calls)).toHaveLength(1);
    release();
    await pass;
    expect(frames(w.calls)).toHaveLength(8);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

for (const [label, answer, reply] of [['decided by its answer', decidingAnswer, 'PREVIEW — Done, the bird feeder reminder is cancelled.'],
  ['left undecided by its answer', undecidedAnswer, MEMORY_UNDECIDED_REPLY]] as const)
  it(`answers a correction sent while the frontier is far behind without waiting for the catch-up (${label})`, async () => {
    const root = tmp('behind');
    try {
      const journal = justinRoot(join(root, 'journal.encrypted'));
      const w = world(journal, plain, undefined, { answer });
      w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
      w.worker.intake([update(329, cancel)]);
      await w.worker.drain();
      // No summary call is made before the reply: 328 turns lie between the frontier and the correction, more than one
      // pass can reach (8 x 4). It is settled undecided and answered.
      expect(frames(w.calls)).toEqual([]);
      const asked = journal.view.order.find(item => item.update === 329)!;
      expect(asked.memoryUndecided).toBe(true);
      expect(asked.held).toBeUndefined();
      expect(asked.sent).toBeDefined();
      expect(w.calls.at(-1)).not.toMatch(/^summary:/u);
      expect(asked.intent).toBe(reply);
      // The background catch-up continues afterwards, unforced, and is never asked to decide the settled request.
      await w.worker.summarizeIfNeeded();
      expect(frames(w.calls)).toHaveLength(8);
      expect(journal.view.summaries.some(item => item.memoryFor?.includes(asked.id))).toBe(false);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 120000);

it('settles a preference and an edit sent far behind without a synchronous catch-up', async () => {
  const root = tmp('behind-pref');
  try {
    const journal = justinRoot(join(root, 'journal.encrypted'));
    const w = world(journal, plain, undefined, { answer: noted });
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    w.worker.intake([update(329, 'From now on, keep each answer short.')]);
    await w.worker.drain();
    expect(frames(w.calls)).toEqual([]);
    const preference = journal.view.order.find(item => item.update === 329)!;
    expect(preference.memoryUndecided).toBe(true);
    expect(preference.sent).toBeDefined();
    // An edit of an old message (Telegram edited_message) is judged by the summary alone; far behind it is settled too.
    w.worker.intake([{ update_id: 330, edited_message: { message_id: 300, chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, date: Math.floor(at / 1000) + 300, edit_date: Math.floor(at / 1000) + 330,
      text: 'Message 300: a short question about tomorrow.' } }]);
    await w.worker.drain();
    expect(frames(w.calls)).toEqual([]);
    const edit = journal.view.order.find(item => item.update === 330)!;
    expect(edit.editOf).toBeDefined();
    expect(edit.memoryUndecided).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

// The other side of the boundary: a request within one pass of the frontier is still decided by its own summary.
for (const [count, settled] of [[32, false], [33, true]] as const)
  it(`a correction with ${String(count)} unsummarized turns up to it is ${settled ? 'settled at once' : 'decided by its own summary'}`, async () => {
    const root = tmp(`edge-${String(count)}`);
    try {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
      for (let n = 1; n < count; n++) turn(journal, n, `Message ${String(n)}: a short note.`, `PREVIEW — Noted ${String(n)}.`);
      const w = world(journal, plain, undefined, { answer: decidingAnswer });
      w.worker.intake([update(count, cancel)]);
      await w.worker.drain();
      const asked = journal.view.order.find(item => item.update === count)!;
      expect(asked.sent).toBeDefined();
      if (settled) {
        expect(frames(w.calls)).toEqual([]);
        expect(asked.memoryUndecided).toBe(true);
      } else {
        expect(frames(w.calls).length).toBeGreaterThan(0);
        expect(frames(w.calls).length).toBeLessThanOrEqual(8);
        expect(journal.view.summaries.at(-1)!.through).toBe(count);
        expect(journal.view.summaries.some(item => item.memoryFor?.includes(asked.id))).toBe(true);
        expect(asked.memoryUndecided).toBeUndefined();
      }
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60000);

it('stops a catch-up at the call cap with the existing cap report', async () => {
  const root = tmp('cap');
  try {
    // 330 calls already recorded (328 answers and the two old summary calls); twenty remain.
    const journal = justinRoot(join(root, 'journal.encrypted'), 350);
    expect(journal.view.calls).toBe(330);
    const w = world(journal, plain);
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    for (let pass = 0; pass < 6; pass++) await w.worker.summarizeIfNeeded();
    expect(journal.view.calls).toBe(350);
    expect(w.calls).toHaveLength(20);
    const frontier = journal.view.summaries.at(-1)!.through;
    expect(frontier).toBeLessThan(328);
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toHaveLength(20);
    const lines: string[] = [];
    expect(reportJournalCap(journal, w.clock.now, line => lines.push(line))).toBe('model attempt cap reached');
    expect(lines.at(-1)).toBe('PREVIEW — calls cap reached; work paused. Check status for held work.\n');
    expect(journal.view.summaries.at(-1)!.through).toBe(frontier);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('resumes a catch-up across a restart without repeating a decided call or losing a frame', async () => {
  const root = tmp('catchup-restart');
  const path = join(root, 'journal.encrypted');
  try {
    let journal = justinRoot(path);
    let w = world(journal, plain);
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    await w.worker.summarizeIfNeeded();
    await w.worker.summarizeIfNeeded();
    const kept = journal.view.summaries.map(item => item.through);
    expect(kept.at(-1)).toBe(65);
    // The process ends inside the next summary call: only its reservation was written.
    journal.append({ kind: 'summary-reserve', through: 69, at: at + 400 });
    const dispatched = new Set(frames(w.calls));
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.summaries.map(item => item.through)).toEqual(kept);
    w = world(journal, plain, { now: at + 20_000_000, elapsed: 0 });
    // The recovery pause still holds after the restart.
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toEqual([]);
    w.clock.elapsed += SUMMARY_UNKNOWN_RECOVERY_MS;
    for (let pass = 0; pass < 12; pass++) await w.worker.summarizeIfNeeded();
    expect(w.prepared).not.toContain('summary:69');
    expect(w.prepared).not.toContain('summary:31');
    expect(frames(w.calls).filter(id => dispatched.has(id))).toEqual([]);
    expect(journal.view.summaries.slice(0, kept.length).map(item => item.through)).toEqual(kept);
    expect(journal.view.summaryReservations.has(69)).toBe(true);
    expect(328 - journal.view.summaries.at(-1)!.through).toBeLessThanOrEqual(32);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('leaves a short chat unsummarized across repeated background passes', async () => {
  const root = tmp('short-passes');
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    for (let n = 1; n <= 12; n++) turn(journal, n, justinText(n), justinReply(n));
    const w = world(journal, plain);
    for (let pass = 0; pass < 5; pass++) await w.worker.summarizeIfNeeded();
    expect(w.calls).toEqual([]);
    expect(journal.view.summaries).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
