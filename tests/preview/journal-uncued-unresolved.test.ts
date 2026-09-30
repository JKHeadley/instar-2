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

// Live canary-copy e2582787, update 969389782 (Rule 7): with the operator's reply-length preference on file, the real
// model (claude-sonnet-5) answered a plain marker question and re-stated that preference as a new "prefer" item whose
// quote is the earlier message's, not this one's. The recorded outputs are replayed below (only the ids are this test's):
// 1 of 8 replays of 969389782's stored prompt named this turn as the source; replays of 969389758 and 969389759 (the same
// notice on "What can you do in this chat?") named the earlier preference message itself. Before the fix the whole decision was refused and the operator got the
// undecided notice instead of the answer.
const preference = 'Your replies are too long — keep them to two sentences.';
const marker = 'Canary-copy check e2582787: my test marker is probe-a678998b. What is my test marker? Reply with the marker.';
const markerReply = 'Your test marker is "probe-a678998b." I don\'t store this independently — I only have it because it\'s in this turn\'s message.';
const echoRun = async (second: string, proposal: (id: string, first: string) => object[]) => {
  let first = '';
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-echo-')));
  const sends: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; question: string }) => {
      if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      if (input.question === preference) { first = input.id; return JSON.stringify({ reply: 'Understood — two sentences from now on.',
        memory: [{ mode: 'prefer', source: input.id, quote: preference }] }); }
      return JSON.stringify({ reply: markerReply, memory: proposal(input.id, first) });
    }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const worker = createJournalWorker(journal, ports);
  worker.intake([update(1, preference)]); await worker.drain();
  const memoryBefore = JSON.stringify(journal.view.memory);
  worker.intake([update(2, second)]); await worker.drain(); await worker.drain();
  const result = { sends: [...sends], turn: { ...journal.view.order[1]! }, memoryBefore,
    memoryAfter: JSON.stringify(journal.view.memory), preferences: journal.view.memory.filter(item => item.mode === 'prefer').length };
  journal.close();
  rmSync(root, { recursive: true, force: true });
  return result;
};

it('answers a plain question whose decision re-states a preference already on file (recorded shape)', async () => {
  const result = await echoRun(marker, id => [{ mode: 'prefer', source: id, quote: preference }]);
  expect(result.preferences).toBe(1);
  expect(result.sends).toHaveLength(2);
  expect(result.sends[1]).toContain('probe-a678998b');
  expect(result.sends[1]).not.toContain(MEMORY_UNDECIDED_REPLY);
  expect(result.turn.held).toBeUndefined();
  expect(result.turn.memoryPending).toBeUndefined();
  expect(result.memoryAfter).toBe(result.memoryBefore);
}, 10000);

it('answers a plain question whose decision re-states the preference under its original source (recorded shape)', async () => {
  const result = await echoRun(marker, (_id, first) => [{ mode: 'prefer', source: first, quote: preference }]);
  expect(result.sends[1]).toContain('probe-a678998b');
  expect(result.turn.held).toBeUndefined();
  expect(result.turn.memoryPending).toBeUndefined();
  expect(result.memoryAfter).toBe(result.memoryBefore);
}, 10000);

it('still refuses a plain question whose prefer item is not on file and not in the message', async () => {
  const result = await echoRun(marker, id => [{ mode: 'prefer', source: id, quote: 'Always answer me in French, please.' }]);
  expect(result.sends.some(text => text.includes('probe-a678998b'))).toBe(false);
  expect(result.turn.memoryPending).toBe(true);
  expect(result.memoryAfter).toBe(result.memoryBefore);
}, 10000);

it('still refuses the echo on a direct preference request', async () => {
  const result = await echoRun('Please keep your replies brief.', id => [{ mode: 'prefer', source: id, quote: preference }]);
  expect(result.sends.some(text => text.includes('probe-a678998b'))).toBe(false);
  expect(result.turn.memoryPending).toBe(true);
  expect(result.memoryAfter).toBe(result.memoryBefore);
}, 10000);
