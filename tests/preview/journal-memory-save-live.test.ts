import { afterEach, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { appendGroupCarry } from './group-carry.js';
import { permissionFor } from './group-carry-fixture.js';
import { memoryReport } from './memory-export.js';
import { parseReplyReviewVerdict } from './reply-check.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/memory-save-live-2026-10-11.json', import.meta.url), 'utf8'));
const { reasoning: _reasoning, ...verdicts } = JSON.parse(capture.review);
const recordedReview = { ...parseReplyReviewVerdict(JSON.stringify(verdicts)), confidence: null, latencyMs: 16591 };
const key = new Uint8Array(32).fill(47), now = capture.at;
const genesis = { kind: 'genesis' as const, bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true as const,
  grant: 'grant:fixture', configurationDigest: 'sha256:fixture', expires: now + 86400000,
  maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const id = `telegram:${genesis.bot}:update:969390379`;
function world() {
  const root = mkdtempSync(join(tmpdir(), 'memory-save-live-')); dirs.push(root);
  const { forum: _forum, ...privateGenesis } = genesis;
  const source = openPreviewJournal(join(root, 'source.encrypted'), key, { ...privateGenesis, chat: genesis.operator });
  const baseline = openPreviewJournal(join(root, 'baseline.encrypted'), key, genesis);
  const scope = { bot: genesis.bot, operator: genesis.operator, chat: genesis.chat, sourceRoot: join(root, 'private'), destinationRoot: join(root, 'group') };
  appendGroupCarry(baseline, source, scope, permissionFor(scope), true, now - 1000, () => false);
  source.close(); baseline.close();
  const path = join(root, 'copy.encrypted'); copyFileSync(join(root, 'baseline.encrypted'), path);
  const journal = openPreviewJournal(path, key), sends: string[] = [], packets: string[] = [];
  const ports = { now: () => now, stopped: () => false, groupDisclosure: async () => true,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) => prepareJournalEnvelope(input, 'fixture', genesis.grant, now),
    model: async (input: { id: string; context: string }) => { packets.push(input.context); return packets.length === 1 ? capture.answer : capture.revision; },
    checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  return { journal, path, ports, sends, packets };
}

it('replays update 969390379 on a carried forum copy, repairs its exact invalid decision and stores a fact across restart', async () => {
  const w = world();
  try {
    const proposed = JSON.parse(capture.answer).memory[0];
    expect(capture.offeredSources).not.toContain(proposed.source);
    const worker = createJournalWorker(w.journal, w.ports);
    worker.intake([capture.raw]); await worker.drain();
    expect(w.packets).toHaveLength(2);
    expect(JSON.parse(w.packets[1]!).formatReminder).toContain('memory');
    expect(w.journal.view.turns.get(id)?.answerRetried).toBe(true);
    expect(w.journal.view.memory).toEqual([{ mode: 'remember', source: id, trigger: id,
      quote: 'please remember that the desk test word is copper-7203' }]);
    expect(w.sends).toEqual([JSON.parse(capture.revision).reply]);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    try {
      await createJournalWorker(reopened, w.ports).drain();
      expect(w.sends).toHaveLength(1); expect(memoryReport(reopened.view)).toContain('copper-7203');
    } finally { reopened.close(); }
  } finally { w.journal.close(); }
});

it.each(['valid', 'wrong-quote', 'wrong-source', 'cap', 'stop', 'audience'] as const)('keeps the single repair within exact validation and %s boundary', async mode => {
  const w = world(); let calls = 0, stopped = false;
  try {
    if (mode === 'cap') w.journal.view.limits.maxCalls = 1;
    const worker = createJournalWorker(w.journal, { ...w.ports, stopped: () => stopped,
      groupDisclosure: async () => mode !== 'audience',
      model: async () => {
        calls++;
        if (mode === 'stop') stopped = true;
        if (mode === 'valid') return capture.revision;
        if (calls === 1) return capture.answer;
        const repaired = JSON.parse(capture.revision);
        if (mode === 'wrong-quote') repaired.memory[0].quote = 'a fact the operator never stated';
        if (mode === 'wrong-source') repaired.memory[0].source = 'unoffered';
        return JSON.stringify(repaired);
      } });
    worker.intake([capture.raw]); await worker.drain();
    expect(calls).toBe(mode === 'audience' ? 0 : ['valid', 'cap', 'stop'].includes(mode) ? 1 : 2);
    expect(w.journal.view.memory).toHaveLength(mode === 'valid' ? 1 : 0);
    expect(w.journal.view.turns.get(id)?.accepted).toBe(true);
  } finally { w.journal.close(); }
});

it('reports a durably undecided save honestly even with the recorded reviewers that rejected the old resend notice', async () => {
  const w = world(); let reviews = 0;
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => capture.answer,
      replyCheck: { elapsedMs: () => 0, jev: async () => { reviews++; return { value: JSON.parse(capture.jev), latencyMs: 137 }; },
        escalate: async () => { reviews++; throw Error(capture.review); } } });
    worker.intake([capture.raw]); await worker.drain();
    expect(w.journal.view.turns.get(id)?.memoryPending).toBe(true);
    // Reproduce the actual durable summary-uncertain settlement, without a paid summary.
    w.journal.append({ kind: 'memory-undecided', id, reason: 'summary-uncertain', at: now });
    await worker.drain();
    expect(w.sends).toEqual([MEMORY_UNDECIDED_REPLY]); expect(reviews).toBe(0);
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.turns.get(id)?.replyChecks?.at(-1)).toMatchObject({ path: 'holding', verdict: 'pass' });
  } finally { w.journal.close(); }
});

const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(shapes.otherShapes)('the repair actually consumes recorded $kind from $id without inventing a save', async row => {
  const w = world(); let calls = 0;
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => {
      calls++;
      return calls === 1 ? capture.answer : row.kind === 'summary-uncertain' ? JSON.parse(row.raw) : row.raw;
    } });
    worker.intake([capture.raw]); await worker.drain();
    expect(calls).toBe(2); expect(w.journal.view.turns.get(id)?.answerRetried).toBe(true);
    expect(w.journal.view.memory).toEqual([]);
    expect(w.sends.every(text => text.trim().length > 0 && !text.includes('Saved the requested fact.'))).toBe(true);
  } finally { w.journal.close(); }
});

it('does not exempt model-authored failure claims just because their text matches the infrastructure notice', async () => {
  const w = world(); let reviews = 0;
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports,
      model: async () => JSON.stringify({ reply: MEMORY_UNDECIDED_REPLY, memory: [] }),
      replyCheck: { elapsedMs: () => 0,
        jev: async () => { reviews++; return { value: JSON.parse(capture.jev), latencyMs: 137 }; },
        escalate: async () => { reviews++; return recordedReview; } } });
    worker.intake([capture.raw]); await worker.drain();
    expect(reviews).toBeGreaterThan(0);
    expect(w.journal.view.turns.get(id)?.memoryPending).toBeUndefined();
    expect(w.journal.view.turns.get(id)?.replyChecks?.some(check => check.path === 'subscription')).toBe(true);
    expect(w.journal.view.turns.get(id)?.replyChecks?.at(-1)?.ruleIds).toContain('unrecorded_blocker');
  } finally { w.journal.close(); }
});

it('checks held secret material before releasing an exact infrastructure failure notice', async () => {
  const w = world();
  try {
    const worker = createJournalWorker(w.journal, { ...w.ports, model: async () => capture.answer,
      heldSecrets: () => [MEMORY_UNDECIDED_REPLY],
      replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('credential must be held locally'); },
        escalate: async () => { throw Error('credential must be held locally'); } } });
    worker.intake([capture.raw]); await worker.drain();
    w.journal.append({ kind: 'memory-undecided', id, reason: 'summary-uncertain', at: now });
    await worker.drain();
    expect(w.sends).not.toContain(MEMORY_UNDECIDED_REPLY);
    expect(w.journal.view.turns.get(id)?.replyChecks?.at(-1)).toMatchObject({ verdict: 'violation', ruleIds: ['credential'] });
  } finally { w.journal.close(); }
});
