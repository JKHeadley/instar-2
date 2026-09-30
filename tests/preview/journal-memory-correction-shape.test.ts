import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, MEMORY_ITEM_SHAPE, MEMORY_UNDECIDED_REPLY } from './journal-test-worker.js';

// Live proof K13b (Rule 7) on cint-L7, update 969389737 (and cint-L6, 969389720): once one correction had been
// recorded, packet.memory showed it as a display row {mode:"corrected", source, sourceKind, sourceLabel, trigger,
// replacement}, and the answer guidance named the decision item only in terse prose. The real model (claude-sonnet-5,
// thinking off) copied the display row. The validator refused it, and the operator got the undecided notice.
// The model outputs below are the recorded replay of that stored prompt, before and after the guidance states the
// exact item shape (3 of 3 replays with the new guidance gave the valid shape); only the ids are this test's.
const key = new Uint8Array(32).fill(53);
const start = Date.UTC(2026, 8, 30, 9, 0);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:memory-correction-shape', configurationDigest: 'sha256:memory-correction-shape', expires: Date.UTC(2026, 9, 10),
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const shedSet = 'My garden shed padlock code is 2958.';
const shedFix = 'Correction: my garden shed padlock code is 2093.';
const padSet = 'For this test, the code for my padlock P-021044 is 5186.';
const padFix = 'Correction: the code for my padlock P-021044 is 2093.';
type Input = { id: string; question: string; context: string };
type Packet = { memoryDecision?: string; memory?: { mode: string }[]; memoryCandidates?: { id: string; message: string }[] };

const world = (root: string) => {
  const contexts = new Map<string, Packet>(), sent: string[] = [];
  const candidate = (packet: Packet, message: string) => packet.memoryCandidates?.find(item => item.message === message)?.id;
  const ports = { now: () => start + 30 * 60_000, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      const packet = JSON.parse(input.context) as Packet;
      contexts.set(input.question, packet);
      if (input.question === shedFix) return JSON.stringify({ reply: 'Got it — your garden shed padlock code is now 2093.',
        memory: [{ mode: 'correct', source: candidate(packet, shedSet), quote: 'My garden shed padlock code is 2958.',
          replacement: 'my garden shed padlock code is 2093.' }] });
      if (input.question === padFix) {
        const source = candidate(packet, padSet)!;
        // Recorded: with only the terse prose guidance, the model mirrors packet.memory's display row.
        if (!packet.memoryDecision?.includes('"quote":') && packet.memory?.some(item => item.mode === 'corrected'))
          return JSON.stringify({ reply: 'Noted — correction accepted: your padlock P-021044 code is now 2093 (replacing the 5186 you gave me a moment ago).',
            memory: [{ mode: 'corrected', source, sourceKind: 'operator-stated', sourceLabel: `conversation:operator/main chat/#${source}`,
              trigger: input.id, replacement: 'my padlock P-021044 code is 2093' }] });
        // Recorded: with the exact item shape stated, the model returns an exact old clause and replacement.
        return JSON.stringify({ reply: 'Got it — padlock P-021044 is now 2093 (it was 5186).',
          memory: [{ mode: 'correct', source, quote: 'the code for my padlock P-021044 is 5186',
            replacement: 'the code for my padlock P-021044 is 2093' }] });
      }
      return JSON.stringify({ reply: `Noted: ${input.question}`, memory: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  return { journal, worker: createJournalWorker(journal, ports), contexts, sent };
};

it('records a later correction when a prior recorded correction is on display (K13b, Rule 7)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-correction-shape-')));
  try {
    const w = world(root);
    for (const [id, text] of [[1, shedSet], [2, shedFix], [3, padSet], [4, padFix]] as const) {
      w.worker.intake([update(id, text)]); await w.worker.drain();
    }
    // The confusable display is really there: the first correction is shown as mode "corrected".
    const packet = w.contexts.get(padFix)!;
    expect(packet.memory?.map(item => item.mode)).toEqual(['corrected']);
    const turn = w.journal.view.order.find(item => item.text === padFix)!;
    expect(turn.memoryPending).toBeUndefined();
    expect(turn.memoryUndecided).toBeUndefined();
    expect(w.sent.at(-1)).not.toBe(MEMORY_UNDECIDED_REPLY);
    const pad = w.journal.view.order.find(item => item.text === padSet)!;
    expect(w.journal.view.memory).toEqual(expect.arrayContaining([expect.objectContaining({ mode: 'correct', source: pad.id,
      quote: 'the code for my padlock P-021044 is 5186', replacement: 'the code for my padlock P-021044 is 2093', trigger: turn.id })]));
    expect(packet.memoryDecision).toContain(MEMORY_ITEM_SHAPE);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('still refuses the display-shape echo itself: the validator is not widened', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-correction-echo-')));
  try {
    const w = world(root);
    for (const [id, text] of [[1, shedSet], [2, shedFix], [3, padSet]] as const) {
      w.worker.intake([update(id, text)]); await w.worker.drain();
    }
    const pad = w.journal.view.order.find(item => item.text === padSet)!;
    // The exact recorded echo, answered directly: mode "corrected", no quote, a paraphrased replacement.
    const echo = { reply: 'Noted — correction accepted.', memory: [{ mode: 'corrected', source: pad.id, sourceKind: 'operator-stated',
      trigger: 'telegram:12345678:update:4', replacement: 'my padlock P-021044 code is 2093' }] };
    const refused = createJournalWorker(w.journal, { now: () => start + 40 * 60_000, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: Input) => input.id.startsWith('summary:') ? { state: 'complete' as const, failureClass: 'malformed' as const }
        : JSON.stringify(echo),
      checkOutbound: () => {}, send: async (value: { expectedText: string }) => { w.sent.push(value.expectedText); return w.sent.length; } });
    refused.intake([update(4, padFix)]); await refused.drain(); await refused.drain(); await refused.drain();
    const turn = w.journal.view.order.find(item => item.text === padFix)!;
    expect(turn.memoryPending).toBe(true);
    expect(w.journal.view.memory.some(change => change.trigger === turn.id)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
