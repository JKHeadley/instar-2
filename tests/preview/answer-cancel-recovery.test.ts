// @ts-nocheck -- captured wire outcomes replayed through the real journal worker.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, UNKNOWN_ANSWER_NOTICE, obligationSchedule, LOOP_REVISIT_MS, pendingUnknownCalls } from './journal-test-worker.js';
import { subscriptionCallOutcome } from './call-diagnostics.mjs';

// Exact diagnostic/request transcribed from the read-only desk investigation, frame 114,
// update 715675816, proofroom1-ps-20261013-072522. Other resource fields use the existing
// recorded timeout envelope; they are test scaffolding, NOT claimed as this call's full frame.
const provenance = '.instar/lanes/lookup-incomplete-1013-PROGRESS.md, frame 114, update 715675816';
const diagnostic = { signal: 'SIGKILL', cancellationReason: 'stopped', limited: true, rawOutputExcerpt: '' };
const request = "Starting a fresh conversation segment: please look up today's weather in Portland, Oregon using your tools, and name where you found it.";
const older = JSON.parse(readFileSync(new URL('./fixtures/lostanswer-live-2026-10-02.json', import.meta.url), 'utf8'));
const resources = older.lostFirstCall.callOutcomes[0].resources;
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
const genesis = { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:recovery',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 131072, cursor: 0 };
const key = new Uint8Array(32).fill(42);
const update = { update_id: 715675816, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: request } };
async function run({ reason = 'stopped', cleanup = 'verified', stop = false, second = 'The recorded lookup can now be answered.', cap = 20, output = '', tool = null, consistent = true } = {}) {
  const path = join(mkdtempSync(join(tmpdir(), 'cancel-recovery-')), 'journal');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls: cap }), now = 1000, stopped = false, calls = 0;
  const sent = [], contexts = [];
  const ports = { now: () => now, stopped: () => stopped, checkOutbound: () => {},
    model: async input => {
      calls++; contexts.push(input.context);
      if (calls > 1) return second;
      journal.append({ kind: 'call-outcome', id: input.id, role: 'model', at: now,
        outcome: { exitCode: null, localLimit: null, elapsedMs: 12727, type: null, subtype: null, isError: null,
          outputTokens: null, promptBytes: 1, resources: { ...resources, cleanup },
          diagnostic: { ...diagnostic, cancellationReason: reason, rawOutputExcerpt: output } } });
      if (tool) {
        journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 0, at: now });
        journal.append({ kind: 'tool-turn', phase: 'trace', id: input.id, attempt: 0, consistent, workspaceBytes: 0, at: now,
          calls: [{ n: 1, tool, input: request, decision: 'allow', reason: 'web search', kind: tool === 'WebSearch' ? 'network-read' : 'shell', result: null }] });
      }
      stopped = stop;
      return { state: 'uncertain' };
    }, send: async input => { sent.push(input.expectedText ?? input.text); return sent.length; } };
  const worker = createJournalWorker(journal, ports);
  worker.intake([update]);
  if (stop) await expect(worker.drain()).rejects.toThrow('preview stopped');
  else { await worker.drain(); await worker.drain(); }
  return { path, journal, worker, sent, contexts, ports, count: () => calls,
    later: () => { now += LOOP_REVISIT_MS + 1; }, reopen: () => { journal.close(); journal = openPreviewJournal(path, key); return { journal, worker: createJournalWorker(journal, ports) }; } };
}
it('replays the actual empty cancelled shape: one charged replacement, one answer, no duplicate after reopen', async () => {
  expect(provenance).toContain('715675816');
  const w = await run();
  try {
    expect(w.count()).toBe(2); expect(w.sent).toEqual(['The recorded lookup can now be answered.']);
    expect(w.journal.view.calls).toBe(2); expect(w.journal.view.order[0].answerReplaced).toBe(true);
    expect(pendingUnknownCalls(w.journal.view).length).toBeGreaterThan(0);
    const reopened = w.reopen(); await reopened.worker.drain(); expect(w.count()).toBe(2); expect(w.sent).toHaveLength(1); reopened.journal.close();
  } finally { w.journal.close(); }
});
it.each(['worker-stop', 'stop-file', 'journal-stop'])('does not replace a real %s', async reason => {
  const w = await run({ reason, stop: true });
  expect(w.count()).toBe(1); expect(w.sent).toHaveLength(0); expect(w.journal.view.commitments).toHaveLength(0); w.journal.close();
});
it.each([{ cleanup: 'unresolved' }, { cap: 1 }, { second: { state: 'uncertain' } }])('keeps owned scheduled recovery when replacement cannot finish: %j', async options => {
  const w = await run(options);
  expect(w.sent).toEqual([UNKNOWN_ANSWER_NOTICE]);
  expect(w.journal.view.commitments).toMatchObject([{ source: w.journal.view.order[0].id, owner: 'agent', waitsOn: 'nothing', interruptedAnswer: true }]);
  expect(obligationSchedule(w.journal.view)).toHaveLength(1);
  const reopened = w.reopen(); expect(obligationSchedule(reopened.journal.view)).toHaveLength(1);
  await reopened.worker.drain(); expect(w.sent).toHaveLength(1); reopened.journal.close();
});
it('nonempty or absent physical evidence never earns a cancellation replacement', async () => {
  const w = await run({ output: 'partial tool output' });
  expect(w.count()).toBe(1); expect(w.journal.view.commitments).toHaveLength(0); w.journal.close();
});
it('the due obligation receives uncertainty context and reserves separately under the cap', async () => {
  const w = await run({ cleanup: 'unresolved', second: JSON.stringify({ outcome: 'report', report: 'The lookup remains unresolved; its earlier tool result was not recorded.' }) });
  w.later(); expect(await w.worker.workObligations()).toBe(true);
  expect(JSON.parse(w.contexts.at(-1)).obligation.interruptedAnswer).toContain('Do not repeat uncertain effects');
  expect(w.journal.view.obligationWork['commitment:0'].outcome).toBe('report');
  expect(w.journal.view.calls).toBe(2); expect(w.sent).toHaveLength(1); w.journal.close();
});
it('real recorded summary, Jev, review and delivered/empty shapes are not local-cancellation evidence', () => {
  expect(shapes.length).toBeGreaterThan(5);
  for (const shape of shapes) {
    const raw = typeof shape.raw === 'string' ? shape.raw : JSON.stringify(shape);
    const outcome = subscriptionCallOutcome({ code: 0, limited: false, stdout: raw }, 1, 1, 8192, 1048576);
    expect(outcome.diagnostic.cancellationReason, JSON.stringify(shape)).toBeNull();
  }
});

it('the recorded pending WebSearch is a read; uncertain writes and inconsistent traces are not replayed', async () => {
  for (const [tool, consistent, expected] of [['WebSearch', true, 2], ['Bash', true, 1], ['WebSearch', false, 1]]) {
    const w = await run({ tool, consistent });
    expect(w.count()).toBe(expected);
    expect(w.sent).toHaveLength(1);
    expect(w.journal.view.commitments.length).toBe(expected === 1 ? 1 : 0);
    w.journal.close();
  }
});
