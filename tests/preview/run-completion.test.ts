import { expect, it } from 'vitest';
import { obligationDecision } from './journal.js';
import { reconcileRunCompletion, type RunCompletionItem } from '../../src/rungraph/index.js';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal.js';
import { loopStatusLines } from './obligations.js';
import { readAnswer } from './answer-reading.js';

const open = [{ id: 'script', work: 'Finish the validation script created for this job', state: 'open' }];
it('keeps created work inside the completion bar instead of publishing a partial report', () => {
  const result = obligationDecision(JSON.stringify({ outcome: 'report', report: 'The spec is done.', completion: open }), 'commitment', 1000, 'UTC');
  expect(result.outcome).toBe('continue');
  expect(result).not.toHaveProperty('report');
  expect(result).toHaveProperty('completion', open);
});

const prior = open as RunCompletionItem[];
const done = [{ ...prior[0]!, state: 'complete' as const, evidence: 'Validation command exited zero; its output is retained in the task journal.' }];
it('accretes tasks, retains omitted items, and requires evidence before closing them', () => {
  const extra = { id: 'test', work: 'Test the script', state: 'open' };
  expect(reconcileRunCompletion(prior, [extra])).toEqual([...prior, extra]);
  expect(reconcileRunCompletion(prior, [])).toEqual(prior);
  expect(reconcileRunCompletion(prior, undefined)).toEqual(prior);
  expect(reconcileRunCompletion(prior, done)).toEqual(done);
  for (const updates of [null, [{ ...done[0], evidence: '' }], [{ ...done[0], work: 'An easier task' }],
    [done[0], done[0]], [{ ...prior[0], state: 'cancelled' }], [{ ...prior[0], state: ['open'] }], [{ ...prior[0], authority: 'send' }],
    Array.from({ length: 33 }, (_, id) => ({ ...prior[0], id: String(id) }))])
    expect(reconcileRunCompletion(prior, updates)).toBeNull();
  expect(prior).toEqual(open);
});
it('does not invent unfinished work for legacy results or reject a fully accounted result', () => {
  const report = { outcome: 'report', report: 'The requested work is complete.' };
  expect(obligationDecision(JSON.stringify(report), 'commitment', 1000, 'UTC')).toEqual(report);
  expect(obligationDecision(JSON.stringify({ ...report, completion: done }), 'commitment', 1000, 'UTC', prior))
    .toEqual({ ...report, completion: done });
  expect(obligationDecision(JSON.stringify(report), 'commitment', 1000, 'UTC', prior).outcome).toBe('continue');
  expect(obligationDecision(JSON.stringify({ outcome: 'waiting', waitsOn: 'external', note: 'Waiting for the test fixture.', completion: prior }),
    'commitment', 1000, 'UTC', prior)).toMatchObject({ outcome: 'waiting', completion: prior });
  expect(obligationDecision('{"outcome":"uncertain"}', 'commitment', 1000, 'UTC', prior).outcome).toBe('failed');
});

it('replays real worker reports through completion accounting without claiming that the recordings contain checklists', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/obligation-step-outputs-live-2026-10-04.json', import.meta.url), 'utf8')) as {
    calls: { call: string; output: string }[] };
  let reports = 0;
  for (const call of fixture.calls.filter(call => call.call.startsWith('obligation:commitment:'))) {
    const read = readAnswer(call.output, { wrapped: 'accept', evidence: [call.call] });
    if (!read.ok) continue;
    const legacy = obligationDecision(read.value, 'commitment', 1791107040442, 'UTC');
    const result = obligationDecision(read.value, 'commitment', 1791107040442, 'UTC', prior);
    if (legacy.outcome === 'report') {
      reports++;
      expect(result).toMatchObject({ outcome: 'continue', completion: prior });
      expect(result).not.toHaveProperty('report');
    } else expect(result.outcome).toBe(legacy.outcome);
  }
  expect(reports).toBeGreaterThan(0);
});

const key = new Uint8Array(32).fill(117), T0 = 1791106122000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: T0 + 99 * LOOP_REVISIT_MS,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 };
const promise = 'I will finish the requested spec and its validation script.';
const update = { update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Finish the spec and validate it.' } };
it.each([true, false])('retains created work across snapshot restart and accounts for it (safety halt: %s)', async halt => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'run-completion-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), now = T0;
  const packets: Record<string, unknown>[] = [], sends: string[] = [];
  let output = { outcome: 'report', report: 'The spec is done.', completion: prior };
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => {
      if (input.id.startsWith('obligation:')) { packets.push(JSON.parse(input.context)); return JSON.stringify(output); }
      return JSON.stringify({ reply: promise, openLoops: [{ kind: 'deferral', quote: promise, waitsOn: 'nothing' }] });
    }, send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
  try {
    let w = worker(); w.intake([update]); await w.drain();
    expect(journal.view.commitments).toHaveLength(1);
    now += LOOP_REVISIT_MS;
    expect(await w.workObligations()).toBe(true);
    expect(journal.view.obligationWork['commitment:0']).toMatchObject({ outcome: 'continue', completion: prior });
    expect(journal.view.obligationWork['commitment:0']).not.toHaveProperty('report');
    if (halt) {
      now = genesis.expires;
      await expect(w.workObligations()).rejects.toThrow('preview stopped');
      expect(packets).toHaveLength(1);
      expect(journal.view.stop).toBe('trial expired');
    } else now += LOOP_REVISIT_MS;
    expect(loopStatusLines(journal.view, now).join('\n')).toContain(prior[0]!.work);
    journal.compact(); journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.obligationWork['commitment:0']?.completion).toEqual(prior);
    if (halt) {
      expect(loopStatusLines(journal.view, now).join('\n')).toContain('trial expired');
      await expect(worker().workObligations()).rejects.toThrow('preview stopped');
      expect(packets).toHaveLength(1);
      return;
    }
    w = worker(); output = { outcome: 'report', report: 'The spec and script are complete.', completion: done };
    expect(await w.workObligations()).toBe(true);
    expect(packets.at(-1)?.completion).toEqual(prior);
    expect(journal.view.obligationWork['commitment:0']).toMatchObject({ outcome: 'report', completion: done });
    expect(sends).toHaveLength(1); // No unsolicited send was introduced.
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});


it('never promotes recorded summaries, uncertain/undecided judgments, reply reviews or empty bubbles into completed work', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string }[] };
  expect(fixture.otherShapes.some(shape => shape.raw === '')).toBe(true);
  for (const shape of fixture.otherShapes) {
    const result = obligationDecision(shape.raw, 'commitment', T0, 'UTC', prior);
    expect(result.outcome, `${shape.kind}:${shape.id}`).not.toBe('report');
    expect(result).not.toHaveProperty('report');
    expect(prior).toEqual(open);
  }
});
