import { expect, it } from 'vitest';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { createJournalWorker, openPreviewJournal, pendingUnknownCalls } from './journal-test-worker.js';
import type { JournalRecord } from './journal.js';

// Live proof room 2 (2026-10-02 02:31 PDT): a rolling summary came to rest on a fired reminder's due turn, whose
// update is synthetic (6230515.0009765625). The next answer's reserve row carried that frontier; the journal wrote
// it, then its own reader refused it as "not a safe integer", so the runner re-wrote it every pass and status
// could no longer open the journal. Rule 2 of the purpose: nothing that mattered is silently lost.
const key = new Uint8Array(32).fill(41);
const start = Date.UTC(2026, 8, 26, 17); // Saturday 10:00 in Los Angeles.
const friday9 = Date.UTC(2026, 9, 2, 16); // Friday 2026-10-02 09:00 in Los Angeles.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:synthetic-frontier', configurationDigest: 'sha256:synthetic-frontier', expires: Date.UTC(2026, 9, 10),
  maxCalls: 40, maxReplies: 12, maxTurns: 12, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const priya = 'remind me Friday at 9 am to call Priya';
type Input = { id: string; question: string };
const decide = (input: Input) => {
  if (input.id.startsWith('requested-action:')) return `Doing what you asked: ${priya}.`;
  if (input.question === priya) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: priya, when: 'Friday at 9 am', remind: true }] });
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-synthetic-frontier-')));

/** A due turn fired and answered, then a rolling summary that ends exactly on it, then the operator speaks. */
async function summaryOnDueTurn(root: string) {
  const state = { now: start, sent: [] as string[] };
  const path = join(root, 'journal.encrypted');
  const ports = { now: () => state.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => decide(input), checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { state.sent.push(value.expectedText); return state.sent.length; } };
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, ports);
  // Long earlier messages, so the next answer's packet must ground on the rolling summary instead of verbatim history.
  const long = (n: number) => `Background note ${n}: ${'the garden plan covers tomatoes, beans and the north fence. '.repeat(70)}`;
  worker.intake([update(1, long(1)), update(2, long(2)), update(3, priya)]); await worker.drain();
  state.now = friday9; await worker.sendRequested();
  const due = journal.view.order.find(turn => turn.requestedAction)!;
  expect(due.update).toBe(3 + 1 / 1024);
  expect(due.sent).toBeDefined();
  // The summary pass settles exactly on the due turn (the shape the live room recorded at its row 996).
  journal.append({ kind: 'summary-reserve', through: due.update, at: state.now });
  journal.append({ kind: 'summary', through: due.update, text: `The operator asked: ${priya}. It was done on Friday at 9.`, at: state.now });
  state.now = friday9 + 60_000;
  worker.intake([update(4, 'thanks, what is next?')]);
  return { journal, worker, path, due, state };
}

it('answers after a summary that ends on a fired reminder, and the journal reopens with the synthetic frontier', async () => {
  const root = tmp();
  try {
    const { journal, worker, path, due, state } = await summaryOnDueTurn(root);
    await worker.drain();
    const next = journal.view.turns.get(journal.view.order.at(-1)!.id)!;
    expect(next.update).toBe(4);
    expect(next.grounding?.compactedThrough).toBe(due.update);
    expect(next.sent).toBeDefined();
    expect(state.sent.at(-1)).toBe('Noted.');
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.turns.get(next.id)).toMatchObject({ reserved: true, answer: 'Noted.' });
    expect(reopened.view.refusedReserveRows).toBeUndefined();
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a record its own reader would refuse before it reaches the file, leaving the live projection untouched', async () => {
  const root = tmp();
  try {
    const { journal, path, due } = await summaryOnDueTurn(root);
    const turn = journal.view.order.at(-1)!;
    const size = statSync(path).size, calls = journal.view.calls, floor = journal.view.clockFloor, reserved = turn.reserved;
    // Bad: a frontier at or past the turn it grounds, and a frontier off the journal's update grid.
    for (const compactedThrough of [turn.update, due.update + 0.1]) {
      expect(() => journal.append({ kind: 'reserve', id: turn.id, grounding: { compactedThrough, history: [], recalled: [] },
        at: friday9 + 3600_000 } as unknown as JournalRecord)).toThrow('preview journal: compacted grounding order');
      expect(statSync(path).size).toBe(size);
    }
    // Any other refused record: an answer for a turn that was never reserved.
    expect(() => journal.append({ kind: 'answer', id: turn.id, state: 'complete', text: 'x', at: friday9 + 3600_000 } as unknown as JournalRecord))
      .toThrow();
    expect(statSync(path).size).toBe(size);
    expect(journal.view.calls).toBe(calls);
    expect(journal.view.clockFloor).toBe(floor);
    expect(journal.view.turns.get(turn.id)?.reserved).toBe(reserved);
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.calls).toBe(calls);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// The exact frame format, so the test can write what an earlier build wrote without going through today's guard.
const frameLimit = 4 * 1024 * 1024;
function rows(path: string) {
  const sealed = readFileSync(path), out: { row: JournalRecord; offset: number }[] = [];
  for (let offset = 0; sealed.length - offset >= 4;) {
    const length = sealed.readUInt32BE(offset), bytes = sealed.subarray(offset + 4, offset + 4 + length);
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(`preview-journal:${offset}`)); cipher.setAuthTag(bytes.subarray(12, 28));
    const plain = Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]);
    out.push({ row: JSON.parse((plain[0] === 1 ? brotliDecompressSync(plain.subarray(1), { maxOutputLength: frameLimit }) : plain).toString('utf8')), offset });
    offset += 4 + length;
  }
  return out;
}
function appendLegacy(path: string, row: JournalRecord) {
  const offset = statSync(path).size, nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(row))), cipher.final()]);
  const bytes = Buffer.concat([nonce, cipher.getAuthTag(), body]), prefix = Buffer.alloc(4); prefix.writeUInt32BE(bytes.length);
  const fd = openSync(path, 'a'); try { writeSync(fd, Buffer.concat([prefix, bytes])); } finally { closeSync(fd); }
}

it('opens a journal an earlier build damaged: the first reservation stands and its refused copies are counted, never applied', async () => {
  const root = tmp();
  try {
    const { journal, path, due } = await summaryOnDueTurn(root);
    const turn = journal.view.order.at(-1)!, before = journal.view.calls;
    journal.close();
    // What the earlier build left: its reserve row (synthetic frontier), then the same row again on every pass,
    // with no call, outcome or answer between them (live room 2 rows 1006-1389: 371 copies).
    const reserve = { kind: 'reserve', id: turn.id, grounding: { compactedThrough: due.update, history: [], recalled: [] },
      at: friday9 + 61_000 } as unknown as JournalRecord;
    for (let copy = 0; copy < 4; copy++) appendLegacy(path, { ...reserve, at: friday9 + 61_000 + copy * 5600 } as JournalRecord);
    expect(rows(path).filter(item => item.row.kind === 'reserve' && item.row.id === turn.id)).toHaveLength(4);
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    expect(reopened.view.refusedReserveRows).toBe(3);
    expect(reopened.view.calls).toBe(before + 1);
    // Honestly pending: the one reservation has no outcome, so it is an UNKNOWN answer, never repeated.
    expect(reopened.view.turns.get(turn.id)).toMatchObject({ reserved: true });
    expect(reopened.view.turns.get(turn.id)?.answer).toBeUndefined();
    expect(pendingUnknownCalls(reopened.view)).toContain(`answer:${turn.id}`);
    // Every earlier turn and reply is intact.
    expect(reopened.view.order.filter(item => item.sent !== undefined).map(item => item.update)).toEqual([1, 2, 3, due.update]);
    reopened.close();
    // A new writer may never add such a copy: the repeat is refused before the write.
    const writer = openPreviewJournal(path, key), size = statSync(path).size;
    expect(() => writer.append({ ...reserve, at: friday9 + 90_000 } as JournalRecord)).toThrow('preview journal: repeated reservation');
    expect(statSync(path).size).toBe(size);
    writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('runs a lookup turn after a summary that ends on a fired reminder: the lookup row passes project-before-write and replays', async () => {
  // cint-L27: w3-recallrank's `lookup` row carries the second packet's grounding, so it meets the same synthetic
  // frontier as the reserve; its reducer holds it to the reserve's own test and compares update ids numerically.
  const root = tmp();
  try {
    const state = { now: start, sent: [] as string[] };
    const path = join(root, 'journal.encrypted');
    const asked = 'who was it I wanted to ring?';
    const inputs: { question: string; context: string }[] = [];
    const ports = { now: () => state.now, stopped: () => false, timeZone: 'America/Los_Angeles', checkOutbound: () => {},
      model: async (input: Input & { context: string }) => {
        if (input.question !== asked) return decide(input);
        inputs.push({ question: input.question, context: input.context });
        return inputs.length === 1 ? JSON.stringify({ lookup: ['call Priya', 'remind me Friday'] })
          : JSON.stringify({ reply: 'You wanted to call Priya.', memory: [], dated: [] });
      },
      send: async (value: { expectedText: string }) => { state.sent.push(value.expectedText); return state.sent.length; } };
    const journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, ports);
    const long = (n: number) => `Background note ${n}: ${'the garden plan covers tomatoes, beans and the north fence. '.repeat(70)}`;
    worker.intake([update(1, long(1)), update(2, long(2)), update(3, priya)]); await worker.drain();
    state.now = friday9; await worker.sendRequested();
    const due = journal.view.order.find(turn => turn.requestedAction)!;
    expect(due.update).toBe(3 + 1 / 1024);
    journal.append({ kind: 'summary-reserve', through: due.update, at: state.now });
    journal.append({ kind: 'summary', through: due.update, text: 'The operator keeps garden notes.', at: state.now });
    state.now = friday9 + 60_000;
    worker.intake([update(4, asked)]); await worker.drain();
    const next = journal.view.turns.get(journal.view.order.at(-1)!.id)!;
    expect(next.update).toBe(4);
    expect(inputs).toHaveLength(2);
    expect((JSON.parse(inputs[0]!.context) as { memoryLookup?: unknown }).memoryLookup).toBe('offered');
    expect(next.lookup?.words).toEqual(['call Priya', 'remind me Friday']);
    expect(next.lookup!.found.length).toBeGreaterThan(0);
    expect(next.grounding?.compactedThrough).toBe(due.update);
    expect(next.sent).toBeDefined();
    expect(state.sent.at(-1)).toBe('You wanted to call Priya.');
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.turns.get(next.id)?.lookup).toEqual(next.lookup);
    expect(reopened.view.turns.get(next.id)?.grounding?.compactedThrough).toBe(due.update);
    expect(reopened.view.refusedReserveRows).toBeUndefined();
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds a lookup row\'s grounding frontier to the reserve\'s test: a synthetic update passes, off-grid or not-earlier is refused before the write', async () => {
  const root = tmp();
  try {
    const { journal, path, due } = await summaryOnDueTurn(root);
    const turn = journal.view.order.at(-1)!;
    const grounding = (compactedThrough: number) => ({ compactedThrough, history: [], recalled: [] });
    journal.append({ kind: 'reserve', id: turn.id, grounding: grounding(due.update), at: friday9 + 120_000 } as unknown as JournalRecord);
    const size = statSync(path).size, calls = journal.view.calls;
    const lookup = (compactedThrough: number) => ({ kind: 'lookup', id: turn.id, words: ['call Priya'], found: [due.id],
      grounding: grounding(compactedThrough), usage: { inputTokens: 10, outputTokens: 5, charge: null }, at: friday9 + 180_000 }) as unknown as JournalRecord;
    for (const bad of [turn.update, due.update + 0.1]) {
      expect(() => journal.append(lookup(bad))).toThrow('preview journal: compacted grounding order');
      expect(statSync(path).size).toBe(size);
      expect(journal.view.turns.get(turn.id)?.lookup).toBeUndefined();
    }
    journal.append(lookup(due.update));
    expect(journal.view.turns.get(turn.id)?.lookup).toEqual({ words: ['call Priya'], found: [due.id] });
    expect(journal.view.calls).toBe(calls + 1);
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.turns.get(turn.id)?.grounding?.compactedThrough).toBe(due.update);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
