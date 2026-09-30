import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal } from './journal-test-worker.js';

// Rule 19: an ordinary pushback that names no memory target reaches the operator as
// the model's own answer. Rule 7: an unresolved decision writes nothing. Rule 10: a
// lexical cue still schedules judgment for direct requests.
const key = new Uint8Array(32).fill(23);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const standGround = JSON.stringify({ reply: "It's 51 — 17 × 3 = 51.", memory: [], memoryDisposition: 'unresolved' });

const run = async (pushback: string, decision: (packet: { memoryCandidates?: { id: string }[] }) => string) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-uncued-unresolved-')));
  const path = join(root, 'journal.encrypted');
  const sends: string[] = [], summaries: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) {
        summaries.push(input.id);
        return JSON.stringify({ summary: 'A memory request has no known target.', people: [], memory: [],
          memoryDisposition: 'unresolved' });
      }
      if (input.question === 'What is 17 × 3?') return '51';
      return decision(JSON.parse(input.context));
    }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
  let journal = openPreviewJournal(path, key, genesis);
  let worker = createJournalWorker(journal, ports);
  worker.intake([update(1, 'What is 17 × 3?')]); await worker.drain();
  const memoryBefore = JSON.stringify(journal.view.memory);
  worker.intake([update(2, pushback)]); await worker.drain(); await worker.drain();
  const first = { sends: [...sends], summaries: [...summaries], turn: { ...journal.view.order[1]! },
    memoryChanged: JSON.stringify(journal.view.memory) !== memoryBefore };
  journal.close();
  journal = openPreviewJournal(path, key);
  worker = createJournalWorker(journal, ports);
  await worker.drain();
  const replay = { sends: [...sends], turn: { ...journal.view.order[1]! },
    memoryChanged: JSON.stringify(journal.view.memory) !== memoryBefore };
  journal.close();
  rmSync(root, { recursive: true, force: true });
  return { first, replay };
};

it('answers an uncued pushback with the model reply when its memory target is unresolved', async () => {
  const { first, replay } = await run('No, it\'s 41.', () => standGround);
  expect(first.sends).toHaveLength(2);
  expect(first.sends[1]).toContain('51');
  expect(first.sends[1]).not.toContain(MEMORY_UNDECIDED_REPLY);
  expect(first.turn.held).toBeUndefined();
  expect(first.turn.memoryPending).toBeUndefined();
  expect(first.turn.memoryUndecided).toBeUndefined();
  expect(first.summaries).toEqual([]);
  expect(first.memoryChanged).toBe(false);
  expect(replay.sends).toEqual(first.sends);
  expect(replay.turn).toMatchObject({ sent: first.turn.sent, answer: first.turn.answer });
  expect(replay.turn.held).toBeUndefined();
  expect(replay.memoryChanged).toBe(false);
}, 10000);

it('still holds a cued request whose memory target is unresolved', async () => {
  const { first, replay } = await run('Actually, forget the thing I said.', () => standGround);
  expect(first.sends.some(text => text.includes("It's 51"))).toBe(false);
  expect(first.turn.memoryPending).toBe(true);
  expect(first.sends.slice(1).every(text => text.includes(MEMORY_UNDECIDED_REPLY))).toBe(true);
  expect(first.memoryChanged).toBe(false);
  expect(replay.sends.some(text => text.includes("It's 51"))).toBe(false);
  expect(replay.memoryChanged).toBe(false);
}, 10000);

it('still rejects an uncued decision carrying an invalid memory proposal', async () => {
  const { first } = await run('No, it\'s 41.', () => JSON.stringify({ reply: "It's 51 — 17 × 3 = 51.",
    memory: [{ mode: 'forget', source: 'turn:unoffered', quote: 'What is 17 × 3?' }] }));
  expect(first.sends.some(text => text.includes("It's 51"))).toBe(false);
  expect(first.turn.memoryPending).toBe(true);
  expect(first.memoryChanged).toBe(false);
}, 10000);
