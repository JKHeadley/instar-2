import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, groundingHistory, before, type JournalRecord, type PreviewPorts } from './journal-test-worker.js';
import { makeTestCopy } from './test-copy.js';

const key = new Uint8Array(32).fill(47), now = Date.UTC(2026, 9, 20, 15);
const operator = '7654321', bot = '87654321', testBot = '12345678';
const fact = 'The brass key is in the green drawer.';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const genesis = { kind: 'genesis' as const, origin: 'test' as const, bot, chat: operator, operator,
  grant: 'grant:fixture', configurationDigest: 'sha256:fixture', expires: now + 86400000,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 };
const update = (n: number, text: string) => ({ update_id: n, message: { message_id: n,
  chat: { id: Number(operator), type: 'private' }, from: { id: Number(operator) }, text, date: now / 1000 } });
function ports(packets: string[], sends: number[]): PreviewPorts {
  return { now: () => now, stopped: () => false, origin: 'test', timeZone: 'UTC', checkOutbound: () => {},
    model: async input => { packets.push(input.context); return JSON.stringify({ reply: `Received: ${input.question}`, memory: [] }); },
    send: async input => { sends.push(input.update); return sends.length; } };
}
async function source() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'test-copy-order-'))); roots.push(root);
  const sourceRoot = join(root, 'source');
  const journal = openPreviewJournal(join(sourceRoot, 'journal.encrypted'), key, genesis);
  try {
    const worker = createJournalWorker(journal, ports([], []));
    worker.intake([update(100, fact)]); await worker.drain();
    expect(journal.view.memory).toEqual([]);
  } finally { journal.close(); }
  return { root, sourceRoot };
}

it.each([false, true].flatMap(compacted => [1, 101].map(wire => ({ compacted, wire }))))(
  'grounds ordinary copied history at wire $wire, compacted=$compacted, then survives another restart', async ({ compacted, wire }) => {
    const { root, sourceRoot } = await source(), copyRoot = join(root, 'copy');
    const original = readFileSync(join(sourceRoot, 'journal.encrypted'));
    makeTestCopy({ sourceRoot, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now });
    const path = join(copyRoot, 'journal.encrypted');
    let journal = openPreviewJournal(path, key);
    const packets: string[] = [], sends: number[] = [];
    try {
      if (compacted) { journal.compact(); journal.close(); journal = openPreviewJournal(path, key); }
      let worker = createJournalWorker(journal, ports(packets, sends));
      const incoming = update(wire, 'Where is the brass key?');
      expect(worker.intake([incoming])).toBe(wire + 1); await worker.drain();
      const turn = journal.view.order.at(-1)!;
      expect(turn.id).toBe(`telegram:${testBot}:update:${wire}`);
      expect(JSON.parse(turn.raw)).toEqual(incoming);
      expect(packets.at(-1)).toContain(fact);
      expect(JSON.stringify(JSON.parse(packets.at(-1)!).memorySearch)).toContain(fact);
      expect(turn.update).toBe(101);
      expect(turn.grounding?.history).toContain(`telegram:${bot}:update:100`);
      expect(journal.view.memory).toEqual([]);
      worker.intake([incoming]); await worker.drain(); expect(sends).toHaveLength(1);
      journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
      worker = createJournalWorker(journal, ports(packets, sends));
      worker.intake([incoming]); await worker.drain(); expect(sends).toHaveLength(1);
      const edited = { update_id: wire + 1, edited_message: { ...incoming.message, text: 'Which drawer holds the brass key?' } };
      expect(worker.intake([edited])).toBe(wire + 2); await worker.drain();
      const edit = journal.view.order.at(-1)!;
      expect(edit.editOf).toBe(turn.id); expect(edit.update).toBe(102);
      expect(sends).toHaveLength(1); // Edits revise history without sending a second reply.
      expect(groundingHistory(journal.view, edit.update).map(item => item.id)).not.toContain(turn.id);
      expect(groundingHistory(journal.view, before(edit.update)).map(item => item.id)).toContain(turn.id);
    } finally { journal.close(); }
    expect(readFileSync(join(sourceRoot, 'journal.encrypted'))).toEqual(original);
  });

it('refuses a forged history position and keeps raw duplicate identity separate from chronological position', async () => {
  const { root, sourceRoot } = await source(), copyRoot = join(root, 'copy');
  makeTestCopy({ sourceRoot, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now });
  const journal = openPreviewJournal(join(copyRoot, 'journal.encrypted'), key);
  try {
    const row = { kind: 'intake' as const, id: `telegram:${testBot}:update:1`, update: 1,
      text: 'A new message', raw: JSON.stringify(update(1, 'A new message')), accepted: true, cursor: 2, at: now };
    for (const historyUpdate of [1, 100, 102, NaN])
      expect(() => journal.append({ ...row, historyUpdate })).toThrow('intake history order');
    journal.append({ ...row, historyUpdate: 101 });
    journal.append({ ...row, historyUpdate: 101 });
    expect(journal.view.order).toHaveLength(2);
    expect(() => journal.append({ ...row, historyUpdate: 102 })).toThrow('update collision');
  } finally { journal.close(); }
});

// These are captured journal rows, including uncertain writers, undecided Jev checks, stronger
// reviews and actual delivery records. The copy must retain their positions and use their history.
it.each([false, true])('grounds a new low wire update in the recorded proof-room journal (compacted=%s)', async compacted => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as {
    genesis: Omit<typeof genesis, 'kind' | 'origin' | 'expires' | 'cursor'>; rows: JournalRecord[] };
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'test-copy-recorded-'))); roots.push(root);
  const sourceRoot = join(root, 'source'), copyRoot = join(root, 'copy');
  const source = openPreviewJournal(join(sourceRoot, 'journal.encrypted'), key,
    { ...captured.genesis, kind: 'genesis', expires: now + 86400000, cursor: 0 });
  try { for (const row of captured.rows) source.append(row); } finally { source.close(); }
  makeTestCopy({ sourceRoot, root: copyRoot, key, binding: { bot: testBot, chat: captured.genesis.operator }, now });
  const path = join(copyRoot, 'journal.encrypted');
  let journal = openPreviewJournal(path, key);
  const packets: string[] = [];
  try {
    if (compacted) { journal.compact(); journal.close(); journal = openPreviewJournal(path, key); }
    const summaries = structuredClone(journal.view.summaries);
    const prior = journal.view.order.at(-1)!;
    const worker = createJournalWorker(journal, { ...ports(packets, []), origin: 'production' });
    const incoming = update(1, 'What is my test marker?');
    incoming.message.chat.id = Number(captured.genesis.chat);
    incoming.message.from.id = Number(captured.genesis.operator);
    worker.intake([incoming]); await worker.drain();
    const turn = journal.view.order.at(-1)!;
    expect(turn.update).toBe(prior.update + 1);
    expect(turn.id).toBe(`telegram:${testBot}:update:1`);
    expect(journal.view.cursor).toBe(2);
    expect(packets.length, JSON.stringify(turn)).toBeGreaterThan(0);
    expect(packets.at(-1)).toContain('probe-5f1ba73c');
    const packet = JSON.parse(packets.at(-1)!);
    expect(packet.memorySummary?.text ?? packet.summary?.text).toBeDefined();
    expect(turn.grounding?.history).toContain(prior.id);
    expect(journal.view.summaries).toEqual(summaries);
  } finally { journal.close(); }
});

const recordedShapes = (JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] }).otherShapes;
// Reuse the captured bytes as model-port responses to test the ordering path regardless of outcome.
// The empty sample was captured in context; this does not claim an empty bubble was delivered by Telegram.
it.each(recordedShapes)('offers copied history before interpreting captured $kind ($id)', async shape => {
  const { root, sourceRoot } = await source(), copyRoot = join(root, 'copy');
  makeTestCopy({ sourceRoot, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now });
  const journal = openPreviewJournal(join(copyRoot, 'journal.encrypted'), key), packets: string[] = [];
  try {
    const worker = createJournalWorker(journal, { ...ports([], []), model: async input => {
      packets.push(input.context); return shape.raw;
    }, send: async input => { expect(input.expectedText.trim()).not.toBe(''); return 1; } });
    worker.intake([update(1, 'Where is the brass key?')]); await worker.drain();
    expect(packets.length).toBeGreaterThan(0);
    expect(packets.every(packet => packet.includes(fact))).toBe(true);
    expect(journal.view.order.at(-1)?.grounding?.history).toContain(`telegram:${bot}:update:100`);
  } finally { journal.close(); }
});

it('does not link an edit from the test bot to a source-bot message with the same private-chat message number', async () => {
  const { root, sourceRoot } = await source(), copyRoot = join(root, 'copy');
  makeTestCopy({ sourceRoot, root: copyRoot, key, binding: { bot: testBot, chat: operator }, now });
  const journal = openPreviewJournal(join(copyRoot, 'journal.encrypted'), key);
  try {
    const worker = createJournalWorker(journal, ports([], []));
    worker.intake([{ update_id: 1, edited_message: { ...update(100, 'A test-bot edit').message } }]);
    const turn = journal.view.order.at(-1)!;
    expect(turn.update).toBe(101); expect(turn.editOf).toBeUndefined();
    expect(turn.text).toContain('I do not have the original in my history');
    expect(groundingHistory(journal.view, turn.update).map(item => item.text)).toContain(fact);
  } finally { journal.close(); }
});
