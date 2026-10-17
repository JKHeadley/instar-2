import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';
import { parseReplyReviewVerdict } from './reply-check.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/memory-prefer-1016.json', import.meta.url), 'utf8'));
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
const shape = (kind: string) => shapes.otherShapes.find(row => row.kind === kind)!;
const key = new Uint8Array(32).fill(61), dirs: string[] = [];
const id = 'telegram:12345678:update:1016801', now = 1792167573990;
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function world(mode = 'recorded') {
  const dir = mkdtempSync(join(tmpdir(), 'memory-prefer-')); dirs.push(dir);
  const path = join(dir, 'journal.encrypted'), sends: string[] = [], calls: string[] = [], records: JournalRecord[] = [];
  let summaryCalls = 0, answerCalls = 0, reviewed = 0, stopped = false, crash = mode === 'restart';
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7812716706', operator: '7812716706',
    grant: 'grant:prefer', configurationDigest: 'sha256:prefer', expires: now + 86400000,
    maxCalls: 60, maxReplies: 30, maxTurns: 30, maxBytes: 32768, cursor: 0 }, stage => {
    if (stage === 'after:answer' && crash) { crash = false; throw Error('crash after admitted answer'); }
  });
  const observe = () => { const append = journal.append; journal.append = row => { append(row); records.push(row); }; };
  observe();
  const ports = { now: () => now, stopped: () => stopped, checkOutbound: () => {},
    ...(mode === 'notice' ? { replyNotices: () => [{ key: 'effect:1016801', line: 'The requested action was refused: no matching standing grant.' }] } : {}),
    ...(mode.startsWith('jev-') ? { replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: JSON.parse(shape(mode).raw), latencyMs: 1 }),
      escalate: async () => { reviewed++; return { ...parseReplyReviewVerdict(JSON.parse(shape('reply-review').raw).conclusion.value), confidence: null, latencyMs: 1 }; }
    } } : {}),
    model: async (input: { id: string; context: string }) => {
      calls.push(input.context);
      if (input.id.startsWith('summary:')) {
        if (mode === 'summary-uncertain') return JSON.parse(shape(mode).raw);
        if (mode === 'summary-writer') return shape(mode).raw;
        return capture.summaryOutputs[Math.min(summaryCalls++, capture.summaryOutputs.length - 1)];
      }
      answerCalls++;
      const answer = JSON.parse(capture.answer);
      if (mode === 'repair' && answerCalls === 1 || mode === 'invalid') answer.memory[0].quote = 'I prefer coffee to tea.';
      if (mode === 'empty-memory') answer.memory = [];
      if (mode === 'delivered-reply' || mode === 'empty-reply-in-recorded-context') answer.reply.answer = shape(mode).raw;
      if (mode.startsWith('jev-')) answer.reply.answer = shape('delivered-reply').raw;
      return JSON.stringify(answer);
    }, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  let worker = createJournalWorker(journal, ports);
  worker.intake([capture.raw]);
  if (!mode.startsWith('summary-') && mode !== 'full-path')
    for (const row of capture.beforeAnswer as JournalRecord[]) journal.append(row);
  return { get journal() { return journal; }, get worker() { return worker; }, sends, calls, records,
    get reviewed() { return reviewed; }, stop() { stopped = true; },
    restart() { journal.close(); journal = openPreviewJournal(path, key); observe(); worker = createJournalWorker(journal, ports); } };
}

it.each(['recorded', 'full-path', 'restart', 'jev-unsure', 'jev-undecided', 'summary-writer', 'summary-uncertain'])(
  'keeps recorded 1016801 preference and sends its plain answer after failed summary (%s)', async mode => {
    const w = world(mode);
    try {
      if (mode === 'restart') {
        await expect(w.worker.drain()).rejects.toThrow('crash after admitted answer');
        expect(w.sends).toEqual([]); w.restart();
      }
      for (let pass = 0; pass < 3 && !w.sends.length; pass++) await w.worker.drain();
      expect(w.journal.view.memory).toEqual([{ ...JSON.parse(capture.answer).memory[0], trigger: id }]);
      expect(w.sends).toEqual([mode.startsWith('jev-') ? shape('delivered-reply').raw.replace(/^PREVIEW — /u, '') : 'You prefer tea to coffee.']);
      expect(w.journal.view.turns.get(id)?.memoryPending).toBeUndefined();
      expect(w.records.filter(row => row.kind === 'format-retry')).toEqual([]);
      if (mode.startsWith('jev-')) expect(w.reviewed).toBeGreaterThan(0);
      w.restart(); await w.worker.drain();
      expect(w.sends).toHaveLength(1); expect(w.journal.view.memory).toHaveLength(1);
      const packet = w.worker.probe('Which drink do I prefer?');
      if ('reason' in packet) throw Error(packet.reason);
      expect(JSON.parse(packet.context).preferences).toEqual([{ text: 'I prefer tea to coffee.', source: id }]);
    } finally { w.journal.close(); }
  });

it('repairs a genuinely malformed preference once, without sending the repair notice', async () => {
  const w = world('repair');
  try {
    await w.worker.drain();
    expect(w.calls).toHaveLength(2);
    expect(JSON.parse(w.calls[1]!).formatReminder).toContain('memory must use exact quoted clauses');
    expect(w.journal.view.memory).toHaveLength(1);
    expect(w.sends).toEqual(['You prefer tea to coffee.']);
  } finally { w.journal.close(); }
});

it('preserves the truthful failed-save notice when the repair is still invalid', async () => {
  const mode = 'invalid';
  const w = world(mode);
  try {
    await w.worker.drain();
    expect(w.journal.view.memory).toEqual([]);
    expect(w.sends).toEqual([capture.delivered]); expect(capture.delivered).toBe(MEMORY_UNDECIDED_REPLY);
    expect(w.journal.view.turns.get(id)?.memoryPending).toBe(true);
    expect(w.records.filter(row => row.kind === 'format-retry')).toHaveLength(1);
  } finally { w.journal.close(); }
});

it('keeps a rule-required effect refusal beside the successful preference reply', async () => {
  const w = world('notice');
  try {
    await w.worker.drain();
    expect(w.sends).toEqual(['You prefer tea to coffee.\n\nThe requested action was refused: no matching standing grant.']);
    expect(w.journal.view.memory).toHaveLength(1);
  } finally { w.journal.close(); }
});

it.each(['delivered-reply', 'empty-reply-in-recorded-context'])('replays recorded delivery bytes without inventing a memory failure (%s)', async mode => {
  const w = world(mode);
  try {
    await w.worker.drain();
    expect(w.journal.view.memory).toHaveLength(1);
    expect(w.journal.view.turns.get(id)?.memoryPending).toBeUndefined();
    expect(w.sends.join('\n')).not.toContain(MEMORY_UNDECIDED_REPLY);
    if (mode === 'delivered-reply') expect(w.sends.join('\n')).toContain(shape(mode).raw.replace(/^PREVIEW — /u, ''));
  } finally { w.journal.close(); }
});

it.each(['stop', 'cap'])('does not bypass the %s floor to settle a preference', async mode => {
  const w = world();
  try {
    if (mode === 'stop') w.stop(); else w.journal.view.limits.maxCalls = w.journal.view.calls;
    if (mode === 'stop') await expect(w.worker.drain()).rejects.toThrow('preview stopped');
    else await w.worker.drain();
    expect(w.calls).toEqual([]); expect(w.journal.view.memory).toEqual([]);
    if (mode === 'stop') expect(w.sends).toEqual([]);
    else expect(w.sends[0]).toContain('my allowance of 2 model calls is used up');
  } finally { w.journal.close(); }
});

it('keeps an empty memory decision unresolved without inventing a saved preference', async () => {
  const w = world('empty-memory');
  try {
    await w.worker.drain();
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.turns.get(id)).toMatchObject({ memoryPending: true, memoryUnresolved: true });
    expect(w.sends).toEqual(['You prefer tea to coffee.']);
  } finally { w.journal.close(); }
});
