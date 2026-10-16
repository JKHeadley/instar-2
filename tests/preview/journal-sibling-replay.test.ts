import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { parseReplyReviewVerdict } from './reply-check.js';

// Exact projection rows and model outputs from the stopped forum proof copy; no live root or credentials.
const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/twosession-1015.json.gz', import.meta.url))).toString()) as {
  rows: JournalRecord[]; outputs: { id: string; output: string }[];
};
const packetOf = (prompt: string) => JSON.parse(JSON.parse(prompt).messages.find((m: { role: string }) => m.role === 'context').content).packet;

it.each([
  { update: 715676486, limit: 32768 }, { update: 715676488, limit: 32768 },
  { update: 715676486, limit: 24500 },
])('grounds the recorded scoped-tool answer for $update within $limit bytes', async ({ update, limit }) => {
  const root = mkdtempSync(join(tmpdir(), 'sibling-replay-'));
  const rows = capture.rows;
  const id = `telegram:8994258214:update:${update}`;
  const index = rows.findIndex(row => row.kind === 'reserve' && row.id === id);
  const recorded = rows[index] as Extract<JournalRecord, { kind: 'reserve' }>;
  const original = packetOf(recorded.prompt!);
  expect(original.audience.operatorOnlyVerified).toBe(true);
  expect(original.actionFacts).toBeUndefined(); // The actual red input, not an invented failing packet.
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(29), rows[0] as Extract<JournalRecord, { kind: 'genesis' }>);
  try {
    for (const row of rows.slice(1, index)) {
      // The capture's signatures bind its storage key. Replay receipt facts into an isolated test-key
      // journal using the legacy unsigned record shape; never import the proof installation's key.
      if (row.kind === 'intent' || row.kind === 'held-notice-intent') {
        const { provenance: _originalSignature, ...record } = row;
        journal.append(record);
      } else journal.append(row);
    }
    expect(journal.view.operatorRequests).toEqual([]);
    expect(journal.view.actionEffects ?? []).toEqual([]);
    journal.view.limits.maxBytes = limit;
    let dispatched: string | undefined;
    const worker = createJournalWorker(journal, {
      now: () => recorded.at, stopped: () => false, timeZone: 'America/Los_Angeles',
      groupDisclosure: async () => true, toolRoute: () => true,
      sources: () => original.sources ?? [],
      prepareModel: input => prepareJournalEnvelope(input, JSON.parse(recorded.prompt!).model, journal.view.genesis.grant, recorded.at, limit),
      replyCheck: { elapsedMs: () => 0,
        jev: async () => ({ value: JSON.parse(capture.outputs.find(row => row.id === (update === 715676486
          ? 'jev-reply-check:5dff7824f241cdb0' : 'jev-reply-check:d5bdca75ae9d2a67'))!.output), latencyMs: 0 }),
        escalate: async (_text, _id, _prompt, rules) => {
          const answer = readAnswer(capture.outputs.find(row => row.id === `${id}:reply-review`)!.output);
          if (!answer.ok) throw Error('recorded review unreadable');
          return { ...parseReplyReviewVerdict(answer.value, [...rules ?? []]), confidence: null, latencyMs: 0 };
        },
      },
      model: async input => {
        if (input.id !== id) return { state: 'uncertain' };
        dispatched = input.prepared;
        // Replay the recorded answer through the unchanged reader/reviewer. This asserts dispatch grounding,
        // not that an old recorded model response changes when given new input.
        return capture.outputs.find(row => row.id === id)!.output;
      },
      checkOutbound: () => {}, send: async () => 999,
    });
    await worker.drain();
    expect(dispatched).toBeDefined();
    expect(journal.view.turns.get(id)!.prompt).toBe(dispatched);
    expect(journal.view.turns.get(id)!.sent).toBeDefined();
    expect(journal.view.turns.get(id)!.held).toBeUndefined();
    const packet = packetOf(dispatched!);
    expect(Buffer.byteLength(dispatched!)).toBeLessThanOrEqual(limit);
    expect(packet.audience.conversation).toBe(original.audience.conversation);
    const words = packet.actionFacts?.siblingWords;
    process.stdout.write(`${JSON.stringify({ update, limit, bytes: Buffer.byteLength(dispatched!),
      sha256: createHash('sha256').update(dispatched!).digest('hex'), siblingWords: words,
      held: journal.view.turns.get(id)!.held, sent: journal.view.turns.get(id)!.sent })}\n`);
    if (limit < 32768) {
      expect(words).toBeUndefined();
      return;
    }
    expect(words?.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'statement', topic: '3',
      source: 'telegram:8994258214:update:715676485', excerpt: expect.stringContaining('Approval requested: may the test build machine') })]));
    if (update === 715676488) expect(words?.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'promise', topic: '3',
      state: 'open', excerpt: "I will not restart it before 5 pm Pacific tomorrow, October 16, and even after that time, I won't restart it without your explicit go-ahead first." })]));
    expect(words.items.every((item: { at: string }) => /^2026-10-15 22:0[013] PDT$/u.test(item.at))).toBe(true);
    expect(words.guidance).toContain('Reconcile your answer');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 120000);
