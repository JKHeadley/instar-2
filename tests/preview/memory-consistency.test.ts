import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, PREFERENCE_DECISION, MEMORY_UNDECIDED_REPLY, retrospectiveCases } from './journal-test-worker.js';
import { disciplineSource, RETROSPECTIVE_QUESTION } from './retrospective.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/memory-consistency-1025.json', import.meta.url), 'utf8'));
const dirs: string[] = [], key = new Uint8Array(32).fill(53);
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function world() {
  const root = mkdtempSync(join(tmpdir(), 'memory-consistency-')); dirs.push(root);
  const path = join(root, 'journal');
  const journal = openPreviewJournal(path, key, { ...capture.genesis, expires: 9999999999999,
    maxCalls: 120, maxReplies: 60, maxTurns: 60, maxBytes: 32768 });
  const sends: string[] = [], packets: Record<string, unknown>[] = [];
  const ports = { now: () => capture.turns[0].at, stopped: () => false, groupDisclosure: async () => true,
    checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  return { journal, path, sends, packets, ports };
}

it('keeps the agent voice on the recorded successful save, including after restart', async () => {
  const row = capture.turns.find((r: { update: number }) => r.update === 6236457);
  const w = world();
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => row.output.at(-1) });
    worker.intake([row.raw]); await worker.drain();
    expect(w.journal.view.memory).toEqual(row.memory);
    expect(w.sends).toEqual([JSON.parse(row.output.at(-1)).reply.answer]);
    const cases = retrospectiveCases(w.journal.view);
    expect(cases.find(c => c.id === `turn:${row.id}`)?.meta).toMatchObject({ remembered: 1 });
    expect(cases.find(c => c.id === `answer:${row.id}`)?.meta).toMatchObject({ remembered: 1 });
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    try { await createJournalWorker(reopened, { ...w.ports, model: async () => { throw Error('must not repeat'); } }).drain();
      expect(w.sends).toHaveLength(1); expect(reopened.view.memory).toEqual(row.memory);
    } finally { reopened.close(); }
  } finally { w.journal.close(); }
});

it.each([6236466, 6236477])('repairs recorded paraphrased person attribute %s with the existing one re-ask', async update => {
  const row = capture.turns.find((r: { update: number }) => r.update === update), w = world();
  let calls = 0;
  const repaired = JSON.parse(row.output[0]);
  repaired.personAttributes[0].value = update === 6236466 ? 'pottery class' : 'treasurer';
  repaired.memory = [{ mode: 'remember', source: row.id, quote: row.text }];
  repaired.reply.answer = update === 6236466 ? 'I’ll remember that Ines teaches your pottery class.' : 'I’ll remember that Mr. Albescu is the chess club’s treasurer.';
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async input => {
      w.packets.push(JSON.parse(input.context)); return calls++ === 0 ? row.output[0] : JSON.stringify(repaired);
    } });
    worker.intake([row.raw]); await worker.drain();
    expect(calls).toBe(2); expect(w.packets[1]?.formatReminder).toContain('personAttributes');
    expect(w.journal.view.personAttributes).toHaveLength(1);
    expect(w.journal.view.memory).toHaveLength(1); expect(w.sends).toEqual([repaired.reply.answer]);
  } finally { w.journal.close(); }
});

it('keeps exact rejection and reports exhausted validation plainly, retaining the message', async () => {
  const row = capture.turns.find((r: { update: number }) => r.update === 6236466), w = world(); let calls = 0;
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => { calls++; return row.output[0]; } });
    worker.intake([row.raw]); await worker.drain();
    expect(calls).toBe(2); expect(w.journal.view.memory).toEqual([]); expect(w.journal.view.personAttributes).toEqual([]);
    w.journal.append({ kind: 'memory-undecided', id: row.id, reason: 'summary-uncertain', at: w.ports.now() });
    await worker.drain();
    expect(w.sends).toEqual([MEMORY_UNDECIDED_REPLY]);
    expect(w.sends[0]).not.toMatch(/validate|requested memory change/);
    expect(w.sends[0]).toContain('message'); expect(w.journal.view.turns.get(row.id)?.text).toBe(row.text);
  } finally { w.journal.close(); }
});

it('gives equivalent recorded statements one save policy despite old retrospective advice and candidate/history changes', async () => {
  const w = world();
  // The actual contradictory finding remains quoted evidence, not policy authority.
  w.journal.view.retroPasses.push({ pass: 0, state: 'complete', at: w.ports.now(), result: {
    findings: [capture.finding], feedback: [], closures: [], authorizations: [] } } as never);
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async input => {
      w.packets.push(JSON.parse(input.context));
      const row = capture.turns.find((r: { id: string }) => r.id === input.id);
      return row.output.at(-1);
    } });
    for (const row of capture.turns) {
      worker.intake([row.raw]); await worker.drain();
      const pending = w.journal.view.turns.get(row.id)!;
      if (pending.memoryPending && !pending.memoryUndecided) {
        w.journal.append({ kind: 'memory-undecided', id: row.id, reason: 'summary-uncertain', at: w.ports.now() }); await worker.drain();
      }
    }
    expect(w.journal.view.order.filter(t => t.accepted)).toHaveLength(25);
    expect(w.packets.length).toBeGreaterThanOrEqual(25);
    expect(PREFERENCE_DECISION).toContain('without asking');
    for (const packet of w.packets) {
      expect(packet.memoryDecision).toContain(PREFERENCE_DECISION);
      expect(JSON.stringify(packet.preferenceDecision ?? '')).not.toContain('explicit fact-save request');
      expect(packet.datedDecision).not.toContain('No save claims');
    }
    expect(disciplineSource(w.journal.view).text).toContain('do not override');
    expect(RETROSPECTIVE_QUESTION).toContain('without asking');
  } finally { w.journal.close(); }
});

it.each(['stop', 'cap'])('keeps the attribute repair inside the %s floor', async boundary => {
  const row = capture.turns.find((r: { update: number }) => r.update === 6236466), w = world();
  let stopped = false, calls = 0;
  if (boundary === 'cap') w.journal.view.limits.maxCalls = 1;
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, stopped: () => stopped,
      model: async () => { calls++; stopped = boundary === 'stop'; return row.output[0]; } });
    worker.intake([row.raw]); await worker.drain();
    expect(calls).toBe(1); expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.personAttributes).toEqual([]); expect(w.sends).toEqual([]);
    expect(w.journal.view.turns.get(row.id)?.accepted).toBe(true);
  } finally { w.journal.close(); }
});

it('keeps repeated excluded statements out of ordinary memory without a permission offer', async () => {
  const w = world();
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async input => {
      w.packets.push(JSON.parse(input.context));
      return JSON.stringify({ reply: 'I won’t put access secrets in ordinary memory.', memory: [] });
    } });
    for (const update of [6236481, 6236482]) {
      const raw = structuredClone(capture.turns[0].raw);
      raw.update_id = update; raw.message.message_id = update;
      raw.message.text = 'Do not keep my temporary access code as a fact.';
      worker.intake([raw]); await worker.drain();
    }
    expect(w.sends).toEqual(['I won’t put access secrets in ordinary memory.', 'I won’t put access secrets in ordinary memory.']);
    expect(w.journal.view.memory).toEqual([]);
    for (const p of w.packets) expect(p.memoryDecision).toContain('Exclude credentials/access secrets');
  } finally { w.journal.close(); }
});

const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(shapes.otherShapes)('attribute repair consumes recorded $kind ($id) without inventing a fact', async shape => {
  const row = capture.turns.find((r: { update: number }) => r.update === 6236466), w = world(); let calls = 0;
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => {
      calls++; return calls === 1 ? row.output[0] : shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) : shape.raw;
    } });
    worker.intake([row.raw]); await worker.drain();
    expect(calls).toBe(2); expect(w.journal.view.turns.get(row.id)?.answerRetried).toBe(true);
    expect(w.journal.view.memory).toEqual([]); expect(w.journal.view.personAttributes).toEqual([]);
    expect(w.sends.every(text => text.trim().length > 0)).toBe(true);
  } finally { w.journal.close(); }
});

it.each([true, false])('an empty reply reports the durable fact outcome accurately (saved=%s)', async saved => {
  const row = capture.turns.find((r: { update: number }) => r.update === 6236457), w = world();
  try {
    const decision = JSON.parse(row.output[0]); decision.reply.answer = '';
    if (!saved) decision.memory = [];
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => JSON.stringify(decision) });
    worker.intake([row.raw]); await worker.drain();
    expect(w.sends).toHaveLength(1); expect(w.sends[0]?.trim()).not.toBe('');
    expect(w.journal.view.memory.length).toBe(saved ? 1 : 0);
    if (saved) expect(w.sends[0]).toContain('saved that in memory');
    else expect(w.sends[0]).not.toContain('saved that in memory');
  } finally { w.journal.close(); }
});
