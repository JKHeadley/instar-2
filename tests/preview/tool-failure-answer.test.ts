import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal, UNKNOWN_ANSWER_NOTICE } from './journal-test-worker.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
// @ts-expect-error Shipped physical runner is JavaScript.
import { runToolTurn } from './tool-turn.mjs';

// Verbatim desk capture: build 9e04f28e, proof room 4 update 46040734.
// Results are the capture's truncated strings; no missing installation facts are reconstructed.
const capture = JSON.parse(readFileSync(new URL('./fixtures/t4-tool-failure-answer-2026-10-27.json', import.meta.url), 'utf8'));
const key = new Uint8Array(32).fill(42);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 200, maxReplies: 20, maxTurns: 20, maxBytes: 131072, cursor: 0 };
type Mode = 'exit-1' | 'rejected' | 'uncertain' | 'success' | 'missing-result' | 'stop' | 'no-checks';
async function replay(mode: Mode, returned?: unknown, unknownSend = false) {
  const root = mkdtempSync(join(tmpdir(), 'tool-failure-answer-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), launches = 0, stopped = false;
  const sent: string[] = [];
  const update = { update_id: capture.sourceUpdate, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: capture.prompt } };
  const ports = { now: () => 1000, stopped: () => stopped,
    model: async (input: { id: string }) => {
      const outcome = await runToolTurn({ journal, root, id: input.id, prepared: '{}', promptLimit: 131072,
        deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations, now: () => 1000, redactText: (text: string) => text,
        stopped: () => stopped, fallback: async () => { throw Error('unexpected fallback'); },
        scratch: (directory: string) => { const path = join(directory, 'vol'); mkdirSync(path, { recursive: true }); return path; },
        detach: () => true, unmount: () => true,
        invoke: async (turn: { stateDirectory: string }) => {
          launches++;
          const rows = mode === 'no-checks' ? [] : capture.toolAttempts.flatMap((call: { n: number; tool: string; input: string; result: string }) => [
            { phase: 'pre', id: `call-${call.n}`, n: call.n, tool: call.tool, input: call.input, decision: 'allow', reason: 'recorded admission' },
            ...(mode === 'missing-result' && call.n === 6 ? [] : [{ phase: 'post', id: `call-${call.n}`, tool: call.tool, result: call.result }])]);
          writeFileSync(join(turn.stateDirectory, 'admission.jsonl'), rows.map((row: object) => JSON.stringify(row)).join('\n'));
          if (mode === 'success') return returned ?? { state: 'complete', text: 'An actual completed answer.' };
          if (mode === 'rejected' || mode === 'uncertain') return returned ?? { state: mode };
          if (mode === 'stop') stopped = true;
          // The capture gives the exit code, not native stdout. This exception is an injected
          // local return, not a claimed replay of an absent provider terminal frame.
          throw Error(`model turn exited ${capture.modelExit}`);
        } });
      if (returned !== undefined && mode === 'success') expect(outcome.result).toEqual(returned);
      return outcome.result;
    }, checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return unknownSend ? null : 1; } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([update]); await worker.drain();
    if (stopped) await expect(worker.drain()).rejects.toThrow('preview stopped');
    else await worker.drain();
    const before = structuredClone(journal.view.order[0]);
    journal.close(); journal = openPreviewJournal(path, key);
    if (stopped) await expect(createJournalWorker(journal, ports).drain()).rejects.toThrow('preview stopped');
    else await createJournalWorker(journal, ports).drain();
    return { sent, launches, before, after: structuredClone(journal.view.order[0]) };
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

for (const mode of ['exit-1', 'rejected', 'uncertain'] as const) it(`T4 ${mode}: checked tool results reach one honest notice, never a replay or a completed handoff`, async () => {
  const result = await replay(mode);
  expect(capture).toMatchObject({ sourceUpdate: 46040734, modelExit: 1, answer: null, telegramMessageId: null });
  expect(result.launches).toBe(1);
  expect(result.sent).toHaveLength(1);
  expect(result.sent[0]).toContain(UNKNOWN_ANSWER_NOTICE);
  expect(result.sent[0]).toContain('6 tool checks returned results');
  expect(result.sent[0]).toContain('requested result remains unverified');
  expect(result.sent[0]).not.toContain('curl');
  expect(result.before).toMatchObject({ modelState: 'uncertain', toolChecks: 6, noticeClass: 'unknown-answer', sent: 1 });
  expect(result.after).toMatchObject({ modelState: 'uncertain', toolChecks: 6, sent: 1 });
  expect(result.after?.answer).toBeUndefined();
});

for (const mode of ['missing-result', 'stop', 'no-checks'] as const) it(`${mode}: incomplete evidence or stop never authorizes replay or the checked-results notice`, async () => {
  const result = await replay(mode);
  expect(result.launches).toBe(1); expect(result.sent).toEqual([]);
  expect(result.after?.toolChecks).toBeUndefined();
});

it('an individual shell failure does not replace a later successful model answer', async () => {
  expect(capture.toolAttempts[0].result).toContain('command not found');
  const result = await replay('success');
  expect(result.launches).toBe(1); expect(result.sent).toEqual(['An actual completed answer.']);
  expect(result.after?.toolChecks).toBeUndefined();
});

it('an ambiguous failure-notice send is retained and never sent again after restart', async () => {
  const result = await replay('exit-1', undefined, true);
  expect(result.launches).toBe(1); expect(result.sent).toHaveLength(1);
  expect(result.after?.intent).toBeDefined(); expect(result.after?.sent).toBeUndefined();
});

const shapes: { kind: string; id: string; raw: string }[] = JSON.parse(readFileSync(
  new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
for (const shape of shapes) it(`recorded ${shape.kind} ${shape.id} retains its outcome through the tool runner`, async () => {
  // These are unrelated recorded shapes, not an invented T4 answer. Completed bytes
  // pass through unchanged; the actual uncertain shape takes the failure-notice path.
  const result = shape.kind === 'summary-uncertain'
    ? await replay('uncertain', JSON.parse(shape.raw)) : await replay('success', { state: 'complete', text: shape.raw });
  expect(result.launches).toBe(1);
  if (shape.kind === 'summary-uncertain') {
    expect(JSON.parse(shape.raw)).toMatchObject({ state: 'uncertain' });
    expect(result.after?.toolChecks).toBe(6);
  } else expect(result.after?.toolChecks).toBeUndefined();
});
