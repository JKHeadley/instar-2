import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

const key = new Uint8Array(32).fill(7);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-journal-')));
const genesis = (maxCalls = 100) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 });
const update = (id: number, text = `question ${id}`) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

function world(root: string, options: { boundary?: (stage: string) => void; send?: () => number | null;
  model?: (input: { question: string; context: string }) => string } = {}) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(), options.boundary);
  let calls = 0, sends = 0, stopped = false;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
    model: async input => { calls++; return options.model?.(input) ?? `answer ${input.question}`; },
    send: async () => { sends++; return options.send ? options.send() : sends; },
    checkOutbound: text => { if (text.includes('SECRET')) throw Error('secret'); } });
  return { journal, worker, get calls() { return calls; }, get sends() { return sends; }, stop: () => { stopped = true; } };
}

it('retains intake before advancing the cursor, deduplicates redelivery, and fences unknown sends without blocking later work', async () => {
  const root = origin();
  try {
    const first = world(root, { send: () => null });
    expect(first.worker.intake([update(10)])).toBe(11);
    await first.worker.drain();
    expect(first.sends).toBe(1);
    first.journal.close();
    const second = world(root);
    second.worker.intake([update(10), update(11)]);
    await second.worker.drain();
    expect(second.calls).toBe(1);
    expect(second.sends).toBe(1);
    expect(second.journal.view.turns.get('telegram:12345678:update:10')?.intent).toContain('answer question 10');
    expect(second.journal.view.turns.get('telegram:12345678:update:10')?.sent).toBeUndefined();
    expect(second.journal.view.turns.get('telegram:12345678:update:11')?.sent).toBe(1);
    expect(readFileSync(join(root, 'journal.encrypted'), 'utf8')).not.toContain('question 10');
    second.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['before:intake', 'after:intake', 'before:reserve', 'after:reserve', 'before:answer', 'after:answer',
  'before:intent', 'after:intent', 'before:sent', 'after:sent'])('restart at %s keeps exact effects and pending state', async stage => {
  const root = origin();
  try {
    let tripped = false, physicalSends = 0, physicalCalls = 0;
    const first = world(root, { boundary: at => { if (at === stage && !tripped) { tripped = true; throw Error('crash'); } },
      model: () => { physicalCalls++; return 'first answer'; }, send: () => { physicalSends++; return 42; } });
    try { first.worker.intake([update(1)]); await first.worker.drain(); } catch { /* simulated death */ }
    first.journal.close();
    const next = world(root, { model: () => { physicalCalls++; return 'second answer'; }, send: () => { physicalSends++; return 43; } });
    next.worker.intake([update(1)]);
    await next.worker.drain();
    expect(next.journal.view.order).toHaveLength(1);
    expect(physicalCalls).toBeLessThanOrEqual(1);
    expect(physicalSends).toBeLessThanOrEqual(1);
    const turn = next.journal.view.order[0]!;
    if (stage === 'before:intake') expect(turn.sent).toBe(43);
    else expect(turn.reserved || turn.sent).toBeTruthy();
    next.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds stop, call allowance and secret egress; unknown model calls are not repeated', async () => {
  const root = origin();
  try {
    const first = world(root, { model: () => { throw Error('transport dropped'); } });
    first.worker.intake([update(1)]); await first.worker.drain(); first.journal.close();
    const next = world(root); next.worker.intake([update(2, 'SECRET')]); await next.worker.drain();
    expect(next.calls).toBe(1);
    expect(next.journal.view.calls).toBe(2);
    expect(next.journal.view.order[0]?.reserved).toBe(true);
    expect(next.journal.view.order[0]?.answer).toBeUndefined();
    expect(next.journal.view.order[1]?.held).toBe('outbound secret refused');
    next.worker.stop('operator');
    expect(() => next.worker.intake([update(3)])).toThrow('stopped');
    next.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps early-turn recall and constant append cost through 60 bounded turns and restarts', async () => {
  const root = origin(), samples: number[] = [];
  try {
    let current = world(root, { model: input => {
      if (input.question === 'what was first?') expect(input.context).toContain('the first unique memory');
      return 'ok';
    } });
    for (let i = 0; i < 60; i++) {
      if (i === 30 || i === 50) { current.journal.close(); current = world(root, { model: input => {
        if (input.question === 'what was first?') expect(input.context).toContain('the first unique memory');
        return 'ok';
      } }); }
      const start = performance.now();
      current.worker.intake([update(i + 1, i === 0 ? 'the first unique memory' : i === 59 ? 'what was first?' : `message ${i}`)]);
      await current.worker.drain();
      samples.push(performance.now() - start);
    }
    const p95 = (values: number[]) => values.slice().sort((a,b) => a-b)[Math.ceil(values.length * .95)-1]!;
    expect(current.journal.view.calls).toBe(60);
    expect(current.journal.view.replies).toBe(60);
    expect(p95(samples)).toBeLessThanOrEqual(5000);
    expect(p95(samples.slice(50)) - p95(samples.slice(0,10))).toBeLessThanOrEqual(1000);
    process.stdout.write(`journal 60 turns: non-model p95=${p95(samples).toFixed(1)} ms, first-ten=${p95(samples.slice(0,10)).toFixed(1)} ms, final-ten=${p95(samples.slice(50)).toFixed(1)} ms\n`);
    current.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('uses rolling summaries only after replies, shares the attempt cap, and retains original text', async () => {
  const root = origin();
  try {
    const initial = { ...genesis(), maxBytes: 1100 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, initial);
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:') ? 'The first unique memory was ORCHID.' : 'ok',
      send: async () => 1, checkOutbound: () => {} });
    for (let i = 0; i < 12; i++) {
      worker.intake([update(i + 1, i === 0 ? 'ORCHID is the first unique memory.' : `turn ${i} ${'a'.repeat(45)}`)]);
      await worker.drain(); await worker.summarizeIfNeeded();
    }
    expect(journal.view.summaries.length).toBeGreaterThan(0);
    expect(journal.view.calls).toBeGreaterThan(12);
    expect(journal.view.order[0]?.text).toContain('ORCHID');
    journal.close();
    const again = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(again.view.summaries.length).toBeGreaterThan(0);
    expect(again.view.order[0]?.text).toContain('ORCHID');
    again.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a second writer through the reused production lease', () => {
  const root = origin();
  const context = { site: 'preview.journal', preserved: 'preview:test', register: {
    generation: { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'preview:register' },
    entries: ['preview.journal'], sites: { 'preview.journal': 'closed' as const } } };
  try {
    const canonical = realpathSync(root);
    const input = { root: join(canonical, '.writer'), machine: 'preview-local-machine', key,
      policy: 'preview-journal', store: 'preview-journal', context, io: productionStorageIO };
    const first = openProductionStorage(input);
    expect(first.kind).toBe('Success');
    expect(openProductionStorage(input)).toMatchObject({kind:'Refused'});
    if (first.kind === 'Success') first.value.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
