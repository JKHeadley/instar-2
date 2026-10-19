import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, projectMemoryClause } from './journal-test-worker.js';
import { memoryReport } from './memory-export.js';
import { readAnswer } from './answer-reading.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/memory-update-replaces-2026-10-13.json', import.meta.url), 'utf8'));
const oldId = 'telegram:8994258214:update:715675723', newId = 'telegram:8994258214:update:715675724';
const oldQuote = 'the desk test word is orchid-4138891c5620', newQuote = 'the desk test word is orchid-88c935deed4a';
const key = new Uint8Array(32).fill(83), now = capture.at;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
type Packet = { memoryDecision: string; formatReminder?: string; memoryCandidates?: { id: string; message: string }[] };
function world(answer: (packet: Packet, ordinal: number) => string) {
  const root = mkdtempSync(join(tmpdir(), 'memory-update-replaces-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8994258214', chat: '7812716706', operator: '7812716706',
    grant: 'grant:fixture', configurationDigest: 'sha256:fixture', expires: now + 86400000,
    maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 });
  const packets: Packet[] = [], sends: string[] = [];
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
    model: async (input: { context: string }) => {
      const packet = JSON.parse(input.context) as Packet; packets.push(packet);
      const raw = packets.length === 1 ? JSON.stringify({ reply: 'Saved.', memory: [{ mode: 'remember', source: oldId, quote: oldQuote }] })
        : answer(packet, packets.length - 1);
      const parsed = readAnswer(raw, { wrapped: 'accept', evidence: [newId] });
      return parsed.ok ? parsed.value : raw;
    }, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  const worker = createJournalWorker(journal, ports);
  const intake = (id: number, text: string) => worker.intake([{ ...capture.intake, update_id: id,
    message: { ...capture.intake.message, text, message_id: id } }]);
  return { journal, worker, path, packets, sends, intake, ports };
}
async function seed(w: ReturnType<typeof world>) {
  // The old clause/source are quoted verbatim by recorded frame 155; its intake is outside the desk excerpt.
  w.intake(715675723, `Please remember that ${oldQuote}.`); await w.worker.drain();
}
function checkGuidance(text: string, surface: 'answer' | 'repair' = 'answer') {
  expect(text).not.toContain('even with an older value');
  expect(text).toContain('same fact');
  // The compact answer packet and the declaration repair express the same rule differently.
  expect(text).toContain(surface === 'answer'
    ? 'Changed same fact: update with offered old source/quote and exact new clause; keep history. Errors use correct.'
    : 'Changing the same fact uses mode:"update" with offered old source/quote and exact new clause, never a second remember; correcting an error uses correct.');
  expect(text).toContain('mode:"remember"');
}

it('replays the recorded second-save shape and delivers guidance that distinguishes replacement from a new fact', async () => {
  const w = world(() => capture.savedAnswer);
  try {
    await seed(w); w.worker.intake([capture.intake]); await w.worker.drain();
    expect(w.packets[1]!.memoryCandidates).toContainEqual(expect.objectContaining({ id: oldId, message: oldQuote }));
    checkGuidance(w.packets[1]!.memoryDecision);
    // Replay is exact: this is the observed bad choice, not evidence that new instructions change model output.
    expect(w.journal.view.memory.filter(item => item.mode === 'remember')).toHaveLength(2);
    expect(w.journal.view.memory.at(-1)).toMatchObject({ mode: 'remember', source: newId, quote: newQuote });
  } finally { w.journal.close(); }
});

it.each(['direct restatement', 'explicit change'])('admits the recorded update declaration at the %s save turn, supersedes durably and recalls only the current fact', async kind => {
  // Frame 155 was returned at recall. Replay the exact bytes at the earlier save turn, where its replacement is grounded.
  const w = world(() => capture.updateAnswer);
  try {
    await seed(w);
    if (kind === 'direct restatement') w.worker.intake([capture.intake]);
    else w.intake(715675724, `Change it: ${newQuote}.`);
    await w.worker.drain();
    checkGuidance(w.packets[1]!.memoryDecision);
    expect(w.journal.view.memory).toContainEqual({ mode: 'correct', source: oldId, quote: oldQuote,
      replacement: newQuote, trigger: newId, historical: true });
    expect(w.journal.view.turns.get(newId)?.memoryPending).not.toBe(true);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    try {
      expect(projectMemoryClause(reopened.view, oldQuote, oldId)).not.toBe(oldQuote);
      const report = memoryReport(reopened.view);
      expect(report).toContain(newQuote); expect(report).not.toContain(oldQuote);
      const recalls: string[] = [];
      const worker = createJournalWorker(reopened, { ...w.ports, model: async input => {
        recalls.push(input.context);
        return JSON.stringify({ reply: newQuote, memory: [] });
      } });
      worker.intake([capture.recallIntake]); await worker.drain();
      const packet = JSON.parse(recalls[0]!) as { memoryCandidates: { message: string }[]; memory: { replacement?: string }[] };
      expect(packet.memoryCandidates.some(item => item.message.includes(oldQuote))).toBe(false);
      expect(packet.memory.some(item => item.replacement === newQuote)).toBe(true);
      expect(w.sends.at(-1)).toBe(newQuote);
      expect(reopened.view.conflicts).toHaveLength(0);
    } finally { reopened.close(); }
  } finally { w.journal.close(); }
});

it('keeps the declaration-repair instruction consistent instead of turning an invalid update into a second fact', async () => {
  const w = world((_packet, ordinal) => ordinal === 1 ? capture.badRepair : capture.updateAnswer);
  try {
    await seed(w); w.worker.intake([capture.intake]); await w.worker.drain();
    // Frame 161 cites the recall turn as a save source: the exact source validator must still reject it here.
    expect(w.packets).toHaveLength(3);
    checkGuidance(w.packets[2]!.formatReminder!, 'repair');
    expect(w.journal.view.memory.filter(item => item.mode === 'remember')).toHaveLength(1);
    expect(w.journal.view.memory.at(-1)).toMatchObject({ historical: true, replacement: newQuote });
  } finally { w.journal.close(); }
});

it('keeps two unrelated saved facts separate', async () => {
  const other = 'my spare key is with Morgan';
  const w = world(() => JSON.stringify({ reply: 'Saved.', memory: [{ mode: 'remember', source: newId, quote: other }] }));
  try {
    await seed(w); w.intake(715675724, `Please remember that ${other}.`); await w.worker.drain();
    expect(w.journal.view.memory.map(item => item.mode)).toEqual(['remember', 'remember']);
    expect(memoryReport(w.journal.view)).toContain(oldQuote); expect(memoryReport(w.journal.view)).toContain(other);
  } finally { w.journal.close(); }
});

it('replays the original save then recall attempts without treating recall as authority to save or replace a fact', async () => {
  const w = world((_packet, ordinal) => ordinal === 1 ? capture.savedAnswer : capture.updateAnswer);
  try {
    await seed(w); w.worker.intake([capture.intake]); await w.worker.drain();
    w.worker.intake([capture.recallIntake]); await w.worker.drain();
    const repair = w.packets.find(packet => packet.formatReminder);
    expect(repair).toBeDefined(); checkGuidance(repair!.formatReminder!, 'repair');
    // The recorded update's new clause is absent from the recall request. Keep that exact admission boundary.
    expect(w.journal.view.memory).toHaveLength(2);
    expect(w.journal.view.memory.every(item => item.mode === 'remember')).toBe(true);
    expect(w.journal.view.turns.get('telegram:8994258214:update:715675726')?.memoryPending).toBe(true);
  } finally { w.journal.close(); }
});
