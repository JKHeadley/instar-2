import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { memoryReport } from './memory-export.js';
import { readAnswer } from './answer-reading.js';
import { MEMORY_DISAMBIGUATION, MEMORY_UPDATE_DECISION } from '../../src/assembly/memory-answer-guidance.js';
import { CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-codex-provider.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/codex-recall-2026-10-21.json', import.meta.url), 'utf8'));
const fixed = JSON.parse(readFileSync(new URL('./fixtures/codex-recall-fixed-2026-10-21.json', import.meta.url), 'utf8')) as {
  cases: { name: string; second: string; calls: { id: string; output: string }[]; delivered: string[] }[] };
const roots: string[] = [], key = new Uint8Array(32).fill(82);
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function world(answer?: (id: string) => string) {
  const root = mkdtempSync(join(tmpdir(), 'codex-recall-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis',
    bot: '8813073094', chat: '7812716706', operator: '7812716706', grant: 'grant:fixture',
    configurationDigest: 'sha256:fixture', expires: capture.turns[0].at + 86400000,
    maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const packets: Record<string, unknown>[] = [], sends: string[] = [];
  const ports = { now: () => capture.turns[0].at, stopped: () => false,
    checkOutbound: () => {}, model: async (input: { id: string; context: string }) => {
      packets.push(JSON.parse(input.context));
      return answer ? answer(input.id) : capture.turns.find((turn: { id: string }) => turn.id === input.id)!.output;
    }, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  const worker = createJournalWorker(journal, ports);
  return { journal, worker, packets, sends, ports, path };
}

it('replays the recorded Codex conflict and gives supersession precedence at the second save', async () => {
  const w = world();
  try {
    for (const turn of capture.turns) { w.worker.intake([JSON.parse(turn.raw)]); await w.worker.drain(); }
    // Exact historical outputs demonstrate the bad decision, not changed model behavior.
    expect(w.journal.view.memory.filter(item => item.mode === 'remember')).toHaveLength(1);
    expect(w.journal.view.conflicts).toHaveLength(1);
    expect(capture.turns[1].output).toContain('without explicitly identifying a correction');
    expect(capture.turns[2].answerReason).toContain('both desk test words current');
    const packet = w.packets[1]!;
    expect(packet.memoryCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: capture.turns[0].id, message: JSON.parse(capture.turns[0].raw).message.text })
    ]));
    expect(packet.memoryDecision).toContain('A later direct statement by the same operator about the same fact supersedes the earlier value');
    expect(packet.conflictDecision).toContain('Only genuinely unresolved alternatives');
    expect(packet.conflictDecision).not.toContain('or two active clauses about one subject that disagree');
  } finally { w.journal.close(); }
});

it('delivers the same precedence rule in both providers and their tool framings', () => {
  for (const prompt of [CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT,
    SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT]) {
    expect(prompt).toContain(MEMORY_DISAMBIGUATION);
    expect(prompt).not.toContain('When two active memory items both fit the question but conflict');
    expect(prompt).not.toContain('If two active memory items match the question but disagree');
  }
});

it.each(fixed.cases)('replays fresh Codex decisions through durable memory: $name', async scenario => {
  let call = 0;
  const w = world(id => {
    if (id === capture.turns[0].id) return capture.turns[0].output;
    const recorded = scenario.calls[call++]!;
    expect(recorded.id).toBe(id);
    const parsed = readAnswer(recorded.output, { wrapped: 'accept', evidence: [id] });
    if (!parsed.ok) throw Error('captured answer unreadable');
    return parsed.value;
  });
  const old = JSON.parse(capture.turns[0].raw).message.text as string;
  const updated = scenario.name === 'recorded-update' || scenario.name === 'explicit-now';
  try {
    w.worker.intake([JSON.parse(capture.turns[0].raw)]); await w.worker.drain();
    const second = JSON.parse(capture.turns[1].raw); second.message.text = scenario.second;
    w.worker.intake([second]); await w.worker.drain();
    expect(w.packets.find((packet, index) => index > 0 && packet.memoryDecision)?.memoryDecision).toContain(MEMORY_UPDATE_DECISION);
    expect(w.journal.view.conflicts).toEqual([]);
    if (updated) expect(w.journal.view.memory.at(-1)).toMatchObject({
      mode: 'correct', source: capture.turns[0].id, quote: old,
      trigger: capture.turns[1].id, replacement: scenario.second, historical: true });
    else expect(w.journal.view.memory.map(item => item.mode)).toEqual(
      scenario.name === 'unrelated' ? ['remember', 'remember'] : ['remember']);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    try {
      // The raw earlier claim remains auditable, while active recall contains only its successor.
      expect(reopened.view.turns.get(capture.turns[0].id)?.text).toBe(old);
      const report = memoryReport(reopened.view);
      const worker = createJournalWorker(reopened, w.ports);
      if (updated) {
        expect(report).toContain(scenario.second); expect(report).not.toContain(old);
        worker.intake([JSON.parse(capture.turns[2].raw)]); await worker.drain();
        expect(w.sends.at(-1)).toContain('orchid-cdb0bc5a47dc');
        expect(w.sends.at(-1)).not.toContain('orchid-f8bcd3d9bd5a');
        const packet = w.packets.at(-1)!;
        expect(packet.openConflicts).toBeUndefined();
        expect(packet.memorySearch).toMatchObject({ items: expect.arrayContaining([
          expect.objectContaining({ status: 'superseded', quote: old }),
          expect.objectContaining({ status: 'current', quote: scenario.second })
        ]) });
      } else expect(report).toContain(old);
      expect(w.sends).toEqual(scenario.delivered);
      expect(call).toBe(scenario.calls.length);
      await worker.drain(); expect(w.sends).toEqual(scenario.delivered);
    } finally { reopened.close(); }
  } finally { w.journal.close(); }
});
