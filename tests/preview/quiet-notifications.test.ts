import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, HELD_NOTICE_AFTER_MS, HELD_NOTICE_WINDOW_MS, OUTBOUND_DISPOSITIONS,
  REQUEST_ITEM_LIMIT, requestOverflowLine } from './journal-test-worker.js';

// Rules 52/87 and P-14: one push per conversation at a due point, overflow as a count line, no repeat of
// unchanged status, and every push classified at the one send boundary.
const key = new Uint8Array(32).fill(31);
const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17);
const sixPm = Date.UTC(2026, 8, 27, 1);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:quiet', configurationDigest: 'sha256:quiet', expires: Date.UTC(2026, 9, 10),
  maxCalls: 60, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, thread?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    date: Math.floor(start / 1000) + id * 60, ...(thread === undefined ? {} : { message_thread_id: thread }) } });
type Input = { id: string; question: string; context: string };
let dueRepeat = 1;
const decide = (input: Input) => {
  if (input.id.startsWith('requested-action:')) return JSON.stringify({ reply: 'Done. '.repeat(dueRepeat), memory: [], dated: [] });
  const reminder = /^remind me (today at \d+ ?[ap]m) to /u.exec(input.question);
  if (reminder) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: reminder[1], remind: true }] });
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
const withHarness = async (run: (h: { state: { now: number; sent: { text: string; disposition?: string }[] };
  journal: ReturnType<typeof openPreviewJournal>; worker: ReturnType<typeof createJournalWorker>; path: string }) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-quiet-')));
  const path = join(root, 'journal.encrypted');
  const state = { now: start, sent: [] as { text: string; disposition?: string }[] };
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, { now: () => state.now, stopped: () => false, timeZone: zone,
    model: async (input: Input) => decide(input), checkOutbound: () => {},
    send: async value => { state.sent.push({ text: value.expectedText, ...(value.disposition ? { disposition: value.disposition } : {}) });
      return state.sent.length; } });
  try { await run({ state, journal, worker, path }); } finally { journal.close(); rmSync(root, { recursive: true, force: true }); dueRepeat = 1; }
};
const tick = async (worker: ReturnType<typeof createJournalWorker>) => { await worker.drain(); await worker.sendRequested(); };

it('sends more due requests than are written out as one push with a count line, and none later', () => withHarness(async ({ state, journal, worker }) => {
  worker.intake(Array.from({ length: 16 }, (_, index) => update(10 + index, `remind me today at 5 pm to do task ${index}`, 9)));
  await tick(worker);
  const before = state.sent.length;
  state.now = sixPm; await tick(worker); await tick(worker); await tick(worker);
  const pushes = state.sent.slice(before);
  expect(pushes).toHaveLength(1);
  expect((pushes[0]!.text.match(/^PREVIEW — You asked on /gmu) ?? [])).toHaveLength(REQUEST_ITEM_LIMIT);
  expect(pushes[0]!.text).toContain(`\n${requestOverflowLine(16 - REQUEST_ITEM_LIMIT)}\n`);
  expect(journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(1);
}));

it('a due answer too long for one message goes out whole, in order, under its reason header, and is never pushed again', () => withHarness(async ({ state, journal, worker }) => {
  // Plan #466 (w4-statuslen): a long answer is split into a bounded run of messages (reply-parts.ts), never refused.
  dueRepeat = 900;
  worker.intake([update(1, 'remind me today at 5 pm to water the plants', 17)]);
  await tick(worker);
  const before = state.sent.length;
  state.now = sixPm; await tick(worker); await tick(worker);
  const pushes = state.sent.slice(before);
  expect(pushes).toHaveLength(2);
  for (const push of pushes) expect(Buffer.byteLength(push.text)).toBeLessThanOrEqual(4096);
  expect(pushes[0]!.text).toMatch(/^PREVIEW — You asked on .*\nDone\. Done\./u);
  expect(pushes[0]!.text.endsWith(' (1/2)')).toBe(true);
  expect(pushes[1]!.text).toMatch(/^PREVIEW \(2\/2\) — Done\./u);
  expect(pushes.map(push => push.disposition)).toEqual(['result', 'result']);
  const turn = journal.view.order.find(item => item.requestedAction)!;
  expect(turn.answer?.startsWith('Done.')).toBe(true);
  expect(turn.intent).toContain('Done. '.repeat(899).trim());
  await tick(worker);
  expect(state.sent.slice(before)).toHaveLength(2);
}));

it('never pushes a held backlog: unchanged status stays on the pull surface, across restart', () => withHarness(async ({ state, journal, worker, path }) => {
  worker.intake([update(1, 'one'), update(2, 'two'), update(3, 'three')]);
  for (const turn of journal.view.order) journal.append({ kind: 'hold', id: turn.id, reason: 'reply check unavailable', at: state.now });
  // Before this repair the backlog drew a pushed "I'm holding 3 answers" status line (Rule 87).
  state.now += HELD_NOTICE_AFTER_MS + 1; await worker.drain(); await worker.minimal();
  state.now += 3 * HELD_NOTICE_WINDOW_MS; await worker.drain(); await worker.drain();
  expect(state.sent).toHaveLength(0);
  expect(journal.view.order.filter(turn => turn.held === 'reply check unavailable')).toHaveLength(3);
  journal.close();
  const reopened = openPreviewJournal(path, key);
  const resumed = createJournalWorker(reopened, { now: () => state.now, stopped: () => false, timeZone: zone,
    model: async () => { throw Error('model ran'); }, checkOutbound: () => {}, send: async () => { throw Error('pushed status'); } });
  await resumed.drain(); await resumed.minimal();
  reopened.close();
}));

it('classifies every push at the one send boundary; status is never a pushed kind', () => withHarness(async ({ state, worker }) => {
  // Only the held status is pull-only; the boundary refuses to push any status kind.
  expect(Object.entries(OUTBOUND_DISPOSITIONS).filter(([, disposition]) => disposition === 'status').map(([kind]) => kind))
    .toEqual(['held-notice']);
  worker.intake([update(1, 'hello')]); await tick(worker);
  expect(state.sent.map(item => item.disposition)).toEqual(['result']);
}));
