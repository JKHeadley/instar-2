import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import capture from './fixtures/rejected-answer-2026-10-10.json' with { type: 'json' };
import reviewCapture from './fixtures/forum-review-budget-2026-10-10.json' with { type: 'json' };
import { parseReplyReviewVerdict } from './reply-check.js';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { pendingUnknownCalls, type CallOutcome, type JournalRecord, type PreviewPorts } from './journal.js';

const rows = capture.rows as unknown as JournalRecord[];
const intake = rows.find(r => r.kind === 'intake')! as Extract<JournalRecord, { kind: 'intake' }>;
const failed = rows.find(r => r.kind === 'call-outcome' && r.role === 'model')! as Extract<JournalRecord, { kind: 'call-outcome' }>;
const physical = rows.filter(r => r.kind === 'tool-turn' || r.kind === 'call-outcome' && r.role === 'model');
const reading = readAnswer(capture.replacement.result);
if (!reading.ok) throw Error(reading.defect);
const recovered = reading.value;
const rejectedUsage = (rows.find(r => r.kind === 'answer') as Extract<JournalRecord, { kind: 'answer' }>).usage!;
const measured = capture.replacement.usage;
const recoveredUsage = { inputTokens: measured.input_tokens + measured.cache_creation_input_tokens + measured.cache_read_input_tokens,
  outputTokens: measured.output_tokens, inputComplete: true as const, charge: null };
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

async function run(options: { outcome?: Partial<CallOutcome>; mode?: 'reject' | 'throw' | 'stop' | 'tools' | 'unrecorded-tools' | 'inconsistent' | 'empty-canary'; cap?: number; review?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'preview-rejected-answer-')); roots.push(root);
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(42);
  const message = JSON.parse(intake.raw).message;
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8994258214', chat: String(message.chat.id),
    operator: String(message.from.id), forum: true, grant: 'grant:offline', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: options.cap ?? 100, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  let calls = 0, stopped = false;
  const sent: string[] = [], packets: string[] = [];
  const ports: PreviewPorts = { now: () => intake.at, stopped: () => stopped, checkOutbound: () => {},
    prepareModel: input => JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
    ...(options.review ? { replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: JSON.parse(reviewCapture.jev.output), latencyMs: 1 }),
      escalate: async () => {
        const read = readAnswer(reviewCapture.replay.output); if (!read.ok) throw Error(read.defect);
        return { ...parseReplyReviewVerdict(read.value, ['parks_on_user', 'defers_work', 'self_state_claim', 'breaks_preference', 'sensitive_disclosure']),
          confidence: null, latencyMs: 1 };
      } } } : {}),
    model: async input => {
      calls++; packets.push(input.prepared!);
      if (calls === 1) {
        for (const row of physical) {
          if (options.mode === 'unrecorded-tools' && row.kind === 'tool-turn' && row.phase === 'trace') continue;
          if (row.kind === 'tool-turn' && row.phase === 'trace') journal.append({ ...row,
            ...(options.mode === 'inconsistent' ? { consistent: false } : {}),
            ...(options.mode === 'tools' ? { calls: [{ n: 1, tool: 'Bash', decision: 'allow', reason: 'test', input: 'work', result: 'done' }] } : {}) });
          else if (row.kind === 'call-outcome') journal.append({ ...row, outcome: { ...row.outcome, ...options.outcome } });
          else journal.append(row);
        }
        stopped = options.mode === 'stop';
        if (options.mode === 'empty-canary') return { state: capture.emptyCanary.state as 'complete',
          failureClass: capture.emptyCanary.failureClass as 'malformed' };
        return { state: 'rejected', failureClass: 'rejected', usage: rejectedUsage };
      }
      // Every call still enters the same model/tool port; recovery does not choose a reduced route.
      if (options.mode === 'throw') throw Error('replacement outcome unknown');
      if (options.mode === 'reject') {
        journal.append(failed);
        return { state: 'rejected', failureClass: 'rejected', usage: rejectedUsage };
      }
      return { state: 'complete', text: recovered, usage: recoveredUsage };
    }, send: async input => { sent.push(input.expectedText); return 30; } };
  const worker = createJournalWorker(journal, ports);
  worker.intake([JSON.parse(intake.raw)]);
  if (options.mode === 'stop') await expect(worker.drain()).rejects.toThrow('preview stopped');
  else await worker.drain();
  return { journal, worker, ports, sent, packets, calls: () => calls, path, key };
}

it('replays train-5 update 715675390: the zero-output rejection gets one answer, retained through restart and compaction', async () => {
  expect(failed.outcome).toMatchObject({ isError: true, outputTokens: 0, localLimit: null, resources: { cleanup: 'verified' } });
  expect(rows.find(r => r.kind === 'intent')).toMatchObject({ text: 'I need to check that answer before I can send it.' });
  expect(capture.replacement.is_error).toBe(false);
  const r = await run({ review: true });
  expect(r.calls()).toBe(2);
  expect(r.packets[1]).toBe(r.packets[0]);
  expect(r.sent).toEqual(['probe-cb79e572']);
  expect(r.journal.view.order[0]?.replyChecks?.map(r => r.verdict)).toEqual(['unsure', 'pass']);
  expect(r.journal.view.order[0]?.answerReplaced).toBe('rejected');
  expect(r.journal.view.calls).toBe(18); // original + recorded 15 tool slots + replacement + real review shape
  expect(pendingUnknownCalls(r.journal.view)).toEqual([]);
  expect(r.journal.view.tokenCurrent.has(`answer-replaced:${intake.id}`)).toBe(false);
  expect(r.journal.view.callOutcomes).toContainEqual(failed);
  r.journal.compact(); r.journal.close();
  const replay = openPreviewJournal(r.path, r.key);
  expect(replay.view.order[0]?.answerReplaced).toBe('rejected');
  expect(pendingUnknownCalls(replay.view)).toEqual([]);
  await createJournalWorker(replay, r.ports).drain();
  expect(r.sent).toHaveLength(1); expect(r.calls()).toBe(2);
  replay.close();
});

it.each([
  ['nonzero output', { outputTokens: 1 }], ['unknown exit', { exitCode: null }],
  ['unparsed frame', { type: null }], ['no error', { isError: false }], ['local limit', { localLimit: 'capacity' }],
  ['unknown cleanup', { resources: { ...failed.outcome.resources!, cleanup: 'unresolved' } }], ['policy refusal', { failureClass: 'policy' }], ['usage limit', { failureClass: 'limit' }],
] as const)('does not replace %s', async (_name, outcome) => {
  const r = await run({ outcome });
  expect(r.calls()).toBe(1); expect(r.journal.view.order[0]?.answerReplaced).toBeUndefined();
  r.journal.close();
});
it.each(['stop', 'tools', 'unrecorded-tools', 'inconsistent'] as const)('does not replace after %s', async mode => {
  const r = await run({ mode });
  expect(r.calls()).toBe(1); expect(r.journal.view.order[0]?.answerReplaced).toBeUndefined();
  r.journal.close();
});
it('keeps the call cap and never retries a second rejection', async () => {
  const capped = await run({ cap: 16 }); expect(capped.calls()).toBe(1); capped.journal.close();
  const reviewCap = await run({ cap: 17, review: true }); expect(reviewCap.calls()).toBe(1); reviewCap.journal.close();
  const rejected = await run({ mode: 'reject' }); expect(rejected.calls()).toBe(2);
  expect(pendingUnknownCalls(rejected.journal.view)).toEqual([]);
  await rejected.worker.drain(); expect(rejected.calls()).toBe(2); rejected.journal.close();
});
it('a thrown replacement stays UNKNOWN and cannot run again after restart', async () => {
  const r = await run({ mode: 'throw' });
  expect(r.calls()).toBe(2); expect(r.sent).toEqual([]);
  expect(pendingUnknownCalls(r.journal.view)).toEqual([`answer:${intake.id}`]);
  r.journal.close();
  const replay = openPreviewJournal(r.path, r.key);
  await createJournalWorker(replay, r.ports).drain();
  expect(r.calls()).toBe(2); replay.close();
});

it('the real empty canary shape stays a format repair, never a rejected-call replacement', async () => {
  expect(capture.emptyCanary).toMatchObject({ update: 969389586, state: 'complete', failureClass: 'malformed', intent: null, sent: null });
  expect(capture.emptyCanary.checks.map(r => r.verdict)).toEqual(['unsure', 'unavailable']);
  const r = await run({ mode: 'empty-canary' });
  expect(r.calls()).toBe(2);
  expect(r.journal.view.order[0]?.answerRetried).toBe(true);
  expect(r.journal.view.order[0]?.answerReplaced).toBeUndefined();
  expect(r.sent).toEqual(['probe-cb79e572']);
  r.journal.close();
});
