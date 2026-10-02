import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { createJournalWorker, openPreviewJournal, summaryPromptBytes, SUMMARY_UNKNOWN_RECOVERY_MS } from './journal-test-worker.js';

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
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at / 1000) + n } });
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
const world = (journal: Journal, write: (input: Input) => object, clock = { now: at + 10_000_000, elapsed: 0 }) => {
  const calls: string[] = [], prepared: string[] = [], sentBytes: number[] = [];
  const worker = createJournalWorker(journal, { now: () => clock.now, elapsed: () => clock.elapsed, stopped: () => false,
    timeZone: 'America/Los_Angeles',
    prepareModel: input => {
      if (input.id.startsWith('summary:')) prepared.push(input.id);
      return prepareJournalEnvelope(input, 'claude-opus-5-5', journal.view.genesis.grant, clock.now, journal.view.limits.maxBytes);
    },
    model: async (input: Input) => {
      calls.push(input.id);
      sentBytes.push(Buffer.byteLength(input.prepared ?? '') + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT));
      return JSON.stringify({ people: [], commitments: [], memory: [], questions: [], ...write(input) });
    },
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    send: async () => journal.view.replies + 1, checkOutbound: () => {} });
  return { worker, calls, prepared, sentBytes, clock };
};
const plain = () => ({ summary: 'The operator kept a running log of ordinary errands and garden notes.' });

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
    const w = world(journal, big);
    await w.worker.summarizeIfNeeded(true);
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
  // The carried summary's own accept bounds: prose at most 8192 bytes, at most 20 memory items of 300 bytes. The turn:
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
      const w = world(journal, carried);
      await w.worker.summarizeIfNeeded(true);
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
