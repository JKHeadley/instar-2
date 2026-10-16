import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/guidance-live-2026-10-03.json', import.meta.url), 'utf8'));
const correction = recorded.memory.find((item: { source: string }) => item.source.endsWith(':969389742')).quote as string;
const key = new Uint8Array(32).fill(31);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id } });

it('delivers correction guidance with existing candidates, durably restates the recorded correction on restart, and keeps neighbors ordinary', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'correction-keep-')));
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis);
  interface Packet { memoryCandidates: unknown[]; memoryDecision: string; preferenceSource: string;
    preferences?: { text: string; source: string }[] }
  const packets: Packet[] = [];
  const summaryQuestions: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; context: string; question: string }) => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) {
        summaryQuestions.push(input.question);
        return JSON.stringify({ summary: 'Arithmetic and reply style.', people: [], memory: [] });
      }
      packets.push(packet);
      // Constructed answer port: semantic judgments are explicit; the recorded correction/reply bytes are unchanged.
      if (input.question === correction) return JSON.stringify({ reply: 'Understood.',
        memory: [{ mode: 'prefer', source: packet.preferenceSource, quote: correction }] });
      const kept = packet.preferences?.some((item: { text: string }) => item.text === correction);
      return JSON.stringify({ reply: kept ? '17 × 3 is 51. That is 17 + 17 + 17.' : '17 × 3 is 51.', memory: [] });
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    let worker = createJournalWorker(journal, ports);
    const ask = async (id: number, text: string) => { worker.intake([update(id, text)]); await worker.drain(); };
    await ask(1, 'What is 17 times 3?');
    await ask(2, correction);
    const correctionPacket = packets.at(-1)!;
    expect(correctionPacket.memoryCandidates.length).toBeGreaterThan(0);
    expect(correctionPacket.memoryDecision).toContain('one-off');
    expect(correctionPacket.memoryDecision).toContain('disagreement');
    expect(journal.view.memory.filter(item => item.mode === 'prefer')).toHaveLength(1);
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    await ask(3, 'What is 17 times 3?');
    expect(packets.at(-1)!.preferences).toEqual([{ text: correction, source: journal.view.order[1]!.id }]);
    expect(packets.at(-1)!.memoryDecision).toContain('never override');
    expect(journal.view.order.at(-1)!.answer).toBe('17 × 3 is 51. That is 17 + 17 + 17.');
    // Recorded disagreement and one-off instruction: neither is a lasting correction.
    await ask(4, 'No, it\'s 41.');
    await ask(5, 'Quick check from the desk: are you there? One short line is enough.');
    expect(journal.view.memory.filter(item => item.mode === 'prefer')).toHaveLength(1);
    await ask(6, 'Shorter please.');
    expect(summaryQuestions.some(question => question.includes('one-off instructions') && question.includes('never override'))).toBe(true);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
