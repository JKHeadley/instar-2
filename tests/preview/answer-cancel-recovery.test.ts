// @ts-nocheck -- captured wire outcomes replayed through the real journal worker.
import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, UNKNOWN_ANSWER_NOTICE, obligationSchedule, LOOP_REVISIT_MS, pendingUnknownCalls } from './journal-test-worker.js';
import { reconcileToolTurns, toolTurnSlug } from './tool-turn.mjs';
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
const captured = JSON.parse(readFileSync(new URL('./fixtures/answer-cancel-715676215.json', import.meta.url), 'utf8'));
const key = new Uint8Array(32).fill(42);
const update = { update_id: 715675816, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: request } };
async function run({ reason = 'stopped', cleanup = 'verified', stop = false, second = 'The recorded lookup can now be answered.', cap = 20, output = '', tool = null, consistent = true, evidence = null, secondOutcome = false, throws = false, drainOnce = false, legacyReplacement = false, capture = null } = {}) {
  const path = join(mkdtempSync(join(tmpdir(), 'cancel-recovery-')), 'journal');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls: cap }), now = 1000, stopped = false, calls = 0;
  const sent = [], contexts = [];
  const ports = { now: () => now, stopped: () => stopped, checkOutbound: () => {},
    model: async input => {
      calls++; contexts.push(input.context);
      if (calls > 1) {
        // Read the durable prefix while the replacement has not yet returned.
        const during = openPreviewJournal(path, key);
        expect(obligationSchedule(during.view)).toHaveLength(1); during.close();
        if (secondOutcome) journal.append({ kind: 'call-outcome', id: input.id, role: 'model', at: now,
          outcome: subscriptionCallOutcome({ code: null, limited: false, stdout: '', stderr: 'transport disconnected' }, 1, 1, 8192, 1048576) });
        if (throws) throw Error('unknown transport failure');
        return second;
      }
      journal.append({ kind: 'call-outcome', id: input.id, role: 'model', at: now,
        outcome: capture?.outcome ?? { exitCode: null, localLimit: null, elapsedMs: 12727, type: null, subtype: null, isError: null,
          outputTokens: null, promptBytes: 1, resources: { ...resources, cleanup },
          diagnostic: { ...diagnostic, cancellationReason: reason, rawOutputExcerpt: output } } });
      if (capture && !evidence) {
        // The old journal has an empty trace but no completeness fact. Preserve that uncertainty.
        journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 0, at: now });
        journal.append({ kind: 'tool-turn', phase: 'trace', id: input.id, attempt: 0, consistent: true,
          workspaceBytes: 0, calls: capture.turn.toolAttempts, at: now });
      }
      if (tool) {
        journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 0, at: now });
        journal.append({ kind: 'tool-turn', phase: 'trace', id: input.id, attempt: 0, consistent, ...(legacyReplacement ? {} : { evidenceComplete: true }), workspaceBytes: 0, at: now,
          calls: [{ n: 1, tool, input: request, decision: 'allow', reason: 'web search', kind: tool === 'WebSearch' ? 'network-read' : 'shell', result: null }] });
      }
      if (evidence) {
        const root = mkdtempSync(join(tmpdir(), 'cancel-trace-'));
        const state = join(root, 'tool-turns', toolTurnSlug(input.id, 0), 'state');
        mkdirSync(state, { recursive: true });
        writeFileSync(join(state, 'config.json'), JSON.stringify({ authority: 'test' }));
        for (const [name, mode] of [['admission.jsonl', evidence.tool], ['egress.jsonl', evidence.egress]]) {
          if (mode === 'directory') mkdirSync(join(state, name));
          else if (mode !== 'missing') {
            const rows = Array.from({ length: 65 }, (_, n) => name === 'admission.jsonl'
              ? { phase: 'pre', n, tool: 'WebSearch', input: request, decision: 'allow', reason: 'read', kind: 'network-read' }
              : { phase: 'request', n, method: 'GET', path: '/', decision: 'allow', reason: 'read', kind: 'network-read' });
            writeFileSync(join(state, name), mode === 'malformed' ? '{broken\n'
              : mode === 'truncated' ? rows.map(row => JSON.stringify(row)).join('\n') + '\n' : '');
          }
        }
        journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 0, at: now });
        reconcileToolTurns({ journal, root, redactText: text => text, now: () => now });
      }
      if (legacyReplacement) {
        // Reproduce the pre-repair durable row, not a newly authorized dispatch.
        journal.append({ kind: 'answer-replace', id: input.id, state: 'uncertain', at: now });
        return second;
      }
      stopped = stop;
      return { state: 'uncertain' };
    }, send: async input => { sent.push(input.expectedText ?? input.text); return sent.length; } };
  const worker = createJournalWorker(journal, ports);
  worker.intake([capture ? { ...update, update_id: capture.provenance.update, message: { ...update.message, text: capture.request } } : update]);
  if (stop) await expect(worker.drain()).rejects.toThrow('preview stopped');
  else { await worker.drain(); if (!drainOnce) await worker.drain(); }
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
    expect(obligationSchedule(w.journal.view)).toHaveLength(0);
    expect(w.journal.view.closed.has(0)).toBe(true);
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
    expect(obligationSchedule(w.journal.view).length).toBe(expected === 1 ? 1 : 0);
    w.journal.close();
  }
});

it.each([
  { tool: 'directory', egress: 'empty' }, { tool: 'missing', egress: 'empty' },
  { tool: 'malformed', egress: 'empty' }, { tool: 'empty', egress: 'directory' },
  { tool: 'empty', egress: 'missing' }, { tool: 'empty', egress: 'malformed' },
  { tool: 'truncated', egress: 'empty' }, { tool: 'empty', egress: 'truncated' },
  { tool: 'empty', egress: 'empty' },
])('uses production readers and reconciliation: only observed complete evidence permits replacement %j', async evidence => {
  const complete = evidence.tool === 'empty' && evidence.egress === 'empty';
  const w = await run({ evidence });
  expect(w.count()).toBe(complete ? 2 : 1);
  expect(w.journal.view.order[0].toolRecoveryEvidenceComplete).toBe(complete);
  expect(obligationSchedule(w.journal.view)).toHaveLength(complete ? 0 : 1);
  const reopened = w.reopen();
  expect(obligationSchedule(reopened.journal.view)).toHaveLength(complete ? 0 : 1);
  await reopened.worker.drain(); expect(w.count()).toBe(complete ? 2 : 1); reopened.journal.close();
});
it.each([false, true])('retains recovery across a different physical outcome and exception/reopen (throws=%s)', async throws => {
  const w = await run({ second: { state: 'uncertain' }, secondOutcome: true, throws, drainOnce: true });
  expect(w.count()).toBe(2);
  expect(w.journal.view.callOutcomes).toHaveLength(2);
  expect(w.journal.view.callOutcomes[1].outcome.diagnostic.cancellationReason).toBeNull();
  expect(obligationSchedule(w.journal.view)).toHaveLength(1);
  expect(pendingUnknownCalls(w.journal.view)).toHaveLength(2);
  const reopened = w.reopen();
  expect(obligationSchedule(reopened.journal.view)).toHaveLength(1);
  await reopened.worker.drain(); await reopened.worker.drain();
  expect(w.sent).toEqual([UNKNOWN_ANSWER_NOTICE]); expect(w.count()).toBe(2);
  expect(reopened.journal.view.commitments).toHaveLength(1);
  expect(pendingUnknownCalls(reopened.journal.view)).toHaveLength(2); reopened.journal.close();
});

it('a recorded rejected replacement does not close the recovery obligation', async () => {
  const w = await run({ second: { state: 'rejected', failureClass: 'rejected' } });
  expect(w.count()).toBe(2); expect(w.sent).toHaveLength(1);
  expect(obligationSchedule(w.journal.view)).toHaveLength(1);
  const reopened = w.reopen(); expect(obligationSchedule(reopened.journal.view)).toHaveLength(1); reopened.journal.close();
});

it('reopens a pre-repair tool replacement without inventing a commitment or changing its recorded indices', async () => {
  const w = await run({ tool: 'WebSearch', legacyReplacement: true });
  expect(w.journal.view.order[0].toolRecoveryEvidenceComplete).toBe(false);
  expect(w.journal.view.commitments).toHaveLength(0);
  const reopened = w.reopen(); await reopened.worker.drain();
  expect(w.count()).toBe(1); expect(w.sent).toHaveLength(1);
  expect(reopened.journal.view.commitments).toHaveLength(0); reopened.journal.close();
});

// Replay the train-38 failure through the actual worker. Provider completions below are doubles;
// the cancellation, request and historical notice are captured bytes, not a fresh live result.
it.each([false, true])('replays train-38 update 715676215 with complete evidence=%s', async complete => {
  expect(captured.stop).toBeNull();
  expect(captured.outcome.elapsedMs).toBe(2499);
  expect(captured.turn.intent).toBe(UNKNOWN_ANSWER_NOTICE);
  const w = await run({ capture: captured, ...(complete ? { evidence: { tool: 'empty', egress: 'empty' } } : {}) });
  try {
    expect(w.journal.view.callOutcomes[0].outcome).toEqual(captured.outcome);
    expect(w.count()).toBe(complete ? 2 : 1);
    expect(w.sent).toEqual([complete ? 'The recorded lookup can now be answered.' : UNKNOWN_ANSWER_NOTICE]);
    expect(pendingUnknownCalls(w.journal.view)).toHaveLength(1);
    expect(obligationSchedule(w.journal.view)).toHaveLength(complete ? 0 : 1);
    const reopened = w.reopen();
    await reopened.worker.drain();
    expect(w.sent).toHaveLength(1);
    expect(w.count()).toBe(complete ? 2 : 1);
    expect(obligationSchedule(reopened.journal.view)).toHaveLength(complete ? 0 : 1);
    reopened.journal.close();
  } finally { w.journal.close(); }
});
