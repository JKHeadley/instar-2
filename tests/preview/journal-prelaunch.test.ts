import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, createModelLaunchBoundary, ModelNotStarted,
  ModelDisclosureRefused, MODEL_NOT_STARTED_HOLD, MODEL_NOT_STARTED_REPLY, pendingUnknownCalls,
  type JournalRecord } from './journal-test-worker.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const key = new Uint8Array(32).fill(71);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-1001234', operator: '7654321', forum: true as const,
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 8, maxTurns: 20, maxBytes: 32768, cursor: 0 };
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'prelaunch-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  return { path, journal: openPreviewJournal(path, key, genesis) };
}
const message = (id = 1) => ({ update_id: id, message: { message_id: id, chat: { id: -1001234, type: 'supergroup', is_forum: true },
  from: { id: 7654321 }, message_thread_id: 3, text: 'Please answer my question.' } });

it.each([false, true])('settles a pre-launch %s tool reservation and replies once in topic 3 across restart', async tools => {
  const { path, journal } = setup(), launch = createModelLaunchBoundary();
  const sent: { text: string; thread?: number }[] = [];
  let attempts = 0;
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async ({ id }: { id: string }) => launch.run(async () => {
      attempts++;
      if (tools) {
        journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: 15, at: 1000 });
        journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, calls: [], consistent: true, workspaceBytes: null, at: 1000 });
      }
      throw Error('subscription server policy requires reviewed effective configuration');
    }),
    send: async (input: { text: string; thread?: number }) => { sent.push(input); return 17; } };
  const worker = createJournalWorker(journal, ports);
  worker.intake([message()]); await worker.drain();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ thread: 3, text: MODEL_NOT_STARTED_REPLY });
  expect(sent[0]!.text).not.toMatch(/subscription|configuration|provider|policy/iu);
  expect(journal.view.calls).toBe(0);
  expect(pendingUnknownCalls(journal.view)).toEqual([]);
  expect(journal.view.tokenTotals.answer).toMatchObject({ inputTokens: 0, outputTokens: 0, unknownCalls: 0 });
  expect(journal.view.order[0]).toMatchObject({ held: MODEL_NOT_STARTED_HOLD, reserved: false, limitedSent: 17 });
  if (tools) expect(journal.view.toolTurns!.reservedCalls).toBe(0);
  journal.close();
  const reopened = openPreviewJournal(path, key);
  await createJournalWorker(reopened, ports).drain();
  expect(sent).toHaveLength(1); expect(attempts).toBe(1);
  expect(reopened.view.calls).toBe(0); expect(pendingUnknownCalls(reopened.view)).toEqual([]);
  reopened.close();
});

it.each(['throw', 'uncertain', 'later-refusal'])('retains UNKNOWN after launch: %s', async failure => {
  const { journal } = setup(), launch = createModelLaunchBoundary(); let sends = 0;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: () => launch.run(async () => {
      launch.started();
      if (failure === 'uncertain') return { state: 'uncertain' as const };
      if (failure === 'later-refusal') throw new ModelNotStarted();
      throw Error('subscription server policy requires reviewed effective configuration');
    }), send: async () => ++sends });
  worker.intake([message()]); await worker.drain();
  expect(journal.view.calls).toBe(1); expect(pendingUnknownCalls(journal.view)).toHaveLength(1);
  expect(journal.view.order[0]!.held).not.toBe(MODEL_NOT_STARTED_HOLD);
  expect(sends).toBe(failure === 'uncertain' ? 1 : 0);
  expect(journal.view.order[0]!.limited).toBeUndefined(); journal.close();
});

it('certifies uncertain before launch but preserves the disclosure-specific refusal', async () => {
  const launch = createModelLaunchBoundary();
  await expect(launch.run(async () => ({ state: 'uncertain' }))).rejects.toBeInstanceOf(ModelNotStarted);
  await expect(launch.run(async () => { throw new ModelDisclosureRefused(); })).rejects.toBeInstanceOf(ModelDisclosureRefused);
});

it('keeps a lost limited-send receipt non-repeatable and obeys stop before sending', async () => {
  const { journal, path } = setup(); let sends = 0, stopped = false;
  const ports = { now: () => 1000, stopped: () => stopped, checkOutbound: () => {},
    model: async () => { throw new ModelNotStarted(); },
    send: async () => { sends++; throw Error('receipt lost'); } };
  const worker = createJournalWorker(journal, ports);
  worker.intake([message()]); await worker.drain();
  expect(sends).toBe(1); journal.close();
  const reopened = openPreviewJournal(path, key);
  await createJournalWorker(reopened, ports).drain(); expect(sends).toBe(1);
  stopped = true;
  await expect(createJournalWorker(reopened, ports).drain()).rejects.toThrow();
  expect(sends).toBe(1); reopened.close();
});

it('replays the recorded proof-room outcomes unchanged before the new admission-failure path fires', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as {
    genesis: typeof genesis; rows: JournalRecord[] };
  const { journal } = setup(); journal.close();
  const root = mkdtempSync(join(tmpdir(), 'prelaunch-recorded-')); roots.push(root);
  const recorded = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...capture.genesis, kind: 'genesis', expires: genesis.expires, cursor: 0 });
  for (const row of capture.rows) recorded.append(row);
  expect(recorded.view.order).toHaveLength(22);
  expect(recorded.view.order.some(t => t.replyChecks?.some(c => c.verdict === 'unsure' || c.verdict === 'unavailable'))).toBe(true);
  const calls = recorded.view.calls, unknown = pendingUnknownCalls(recorded.view).length;
  // Replay exact captured decisions; append a new intake after them, without reinterpreting old UNKNOWNs.
  const last = recorded.view.order.at(-1)!;
  const id = `telegram:${recorded.view.genesis.bot}:update:${last.update + 1}`;
  recorded.append({ kind: 'intake', id, update: last.update + 1, text: 'Please answer.', raw: '{}', accepted: true, cursor: last.update + 2, at: last.at + 1 });
  recorded.append({ kind: 'reserve', id, at: last.at + 2 });
  recorded.append({ kind: 'hold', id, reason: MODEL_NOT_STARTED_HOLD, unusedModel: { corrections: [] }, at: last.at + 3 });
  expect(recorded.view.calls).toBe(calls); expect(pendingUnknownCalls(recorded.view)).toHaveLength(unknown);
  expect(recorded.view.turns.get(id)!.held).toBe(MODEL_NOT_STARTED_HOLD);
  const sent: string[] = [];
  await createJournalWorker(recorded, { now: () => last.at + 4, stopped: () => false, checkOutbound: () => {},
    model: async () => { throw Error('minimal path must not invoke a model'); },
    send: async input => { sent.push(input.text); return 19; } }).minimal();
  expect(sent).toContain(MODEL_NOT_STARTED_REPLY);
  recorded.close();
});
