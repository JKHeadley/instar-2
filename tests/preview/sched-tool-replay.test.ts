import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { subscriptionDoorway } from '../../src/assembly/production-provider.js';
import { installDoorways, observeExchange, subscriptionExchange } from './doorway-map.js';
// @ts-expect-error The effect doorway is shared executable JavaScript.
import { refusedEffectNotices } from './effect-doorway.mjs';
// @ts-expect-error The executable hook's shared decision is JavaScript.
import { admitToolCall, hookOutput } from './tool-admission.mjs';
import captured from './fixtures/sched-tool-train-133-2026-10-22.json' with { type: 'json' };
import shapes from './fixtures/retrospective-duty-followup-train-1-2026-10-08.json' with { type: 'json' };

const config = { workspace: '/tmp/work', tmp: '/tmp/work/tmp', maxCalls: 50, maxWriteBytes: 1000, operations: [] };
const fs = { exists: () => true, realpath: (path: string) => path, addresses: () => ['93.184.215.14'] };
const decide = (input: object, n = 1) => admitToolCall({ tool_name: 'ScheduleWakeup', tool_input: input }, config, n, fs);

it('admits the recorded stop-only wake call as bookkeeping, not a new scheduled effect', () => {
  const call = captured.calls.find(row => row.tool === 'ScheduleWakeup')!;
  expect(JSON.parse(call.input)).toEqual({ stop: true });
  expect(call.decision).toBe('deny');
  const decision = decide(JSON.parse(call.input));
  expect(decision).toMatchObject({ decision: 'allow', updatedInput: { stop: true } });
  expect(decision.doorway).toBeUndefined();
  expect(hookOutput(decision).hookSpecificOutput.permissionDecision).toBe('allow');
  expect(decide({ stop: true, delaySeconds: 60, prompt: 'ignored' }).updatedInput).toEqual({ stop: true });
  expect(decide({ stop: true }, 51).decision).toBe('deny');
});

it('refuses new harness wakes at the durable-work and spend floors, with the existing host path', () => {
  for (const input of [{}, { stop: false }, { stop: 'true' }, { delaySeconds: 60, prompt: 'later', reason: 'wait', noop: true }]) {
    const decision = decide(input);
    expect(decision).toMatchObject({ decision: 'deny', kind: 'budget' });
    expect(decision.reason).toContain('durable');
    expect(decision.reason).toContain('promises');
    expect(decision.reason).toContain('unrelated');
    expect(decision.doorway).toBeUndefined();
  }
});

it('does not overwrite successful Claude evidence with the recorded local revision timeout', () => {
  const doorway = subscriptionDoorway('claude-code-subscription');
  const frame = captured.frames.find(row => row.id.endsWith(':367053123'))!;
  const observed = subscriptionExchange(frame, frame.id, doorway)!;
  expect(observed).toMatchObject({ ok: true, reportedModels: expect.arrayContaining(['claude-opus-4-8']) });
  let map = observeExchange(installDoorways(null, [{ id: doorway.id, model: 'claude-opus-5-5', billing: 'subscription', priceReason: 'unknown' }]),
    doorway.id, 'claude-opus-5-5', observed, frame.at);
  const timeout = subscriptionExchange({ code: captured.timeout.exitCode, limited: captured.timeout.diagnostic.limited,
    localLimit: captured.timeout.localLimit, stdout: captured.timeout.diagnostic.rawOutputExcerpt }, 'revision', doorway);
  expect(timeout).toBeNull();
  if (timeout) map = observeExchange(map, doorway.id, 'claude-opus-5-5', timeout, frame.at + 1);
  // Reachable with a different reported id is honest evidence, never proof of the configured identity.
  expect(map.doorways[0]!.models[0]).toMatchObject({ state: 'changed', observedId: expect.stringContaining('claude-opus-4-8') });
  expect(subscriptionExchange({ code: 1, limited: false, stdout: '' }, 'failed', doorway)).toMatchObject({ ok: false });
});

it('replays recorded writer, uncertain/undecided judgments, reviews and empty reply bodies as transport evidence only', () => {
  const parse = subscriptionDoorway('claude-code-subscription').exchangeModels;
  for (const frame of captured.frames) expect(subscriptionExchange(frame, frame.id, { exchangeModels: parse })?.ok, frame.id).toBe(true);
  const transport = JSON.parse(captured.frames[0]!.stdout);
  for (const shape of shapes.otherShapes) {
    // Historical bodies in an actual captured envelope; not claimed as fresh outputs.
    const stdout = JSON.stringify({ ...transport, result: shape.raw });
    expect(subscriptionExchange({ code: 0, limited: false, stdout }, shape.id, { exchangeModels: parse })?.ok, shape.kind).toBe(true);
    expect(subscriptionExchange({ code: null, limited: true, localLimit: 'timeout', stdout }, shape.id, { exchangeModels: parse })).toBeNull();
    expect(parse(shape.raw)).toBeNull();
  }
  expect(captured.replyReview).toContain('VIOLATION');
  expect(captured.delivered).toBe('I need to check that answer before I can send it.');
});

it('delivers the recorded weather body without manufacturing an effect refusal, and does not resend after restart', async () => {
  const { createJournalWorker, openPreviewJournal } = await import('./journal-test-worker.js');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sched-replay-'))), key = new Uint8Array(32).fill(63);
  const path = join(root, 'journal.encrypted'), sent: string[] = [];
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:replay', configurationDigest: 'sha256:offline', expires: captured.at + 100000,
    maxCalls: 20, maxReplies: 5, maxTurns: 5, maxBytes: 32768, cursor: 0 });
  const answer = JSON.parse(captured.writer).reply;
  const body = typeof answer === 'string' ? answer : answer.answer;
  const deliveredBody = body.replace(/^- /gmu, '• '); // Telegram's existing list rendering.
  const ports = { now: () => captured.at, stopped: () => false, prepareModel: (input: { context: string }) => input.context,
    replyNotices: (turn?: string) => refusedEffectNotices(journal.view.effectDoorway?.recent ?? [], turn),
    model: async (input: { id: string }) => {
      journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 1, at: captured.at });
      const calls = captured.calls.map(call => {
        const decision = admitToolCall({ tool_name: call.tool, tool_input: JSON.parse(call.input) }, config, call.n, fs);
        return { ...call, ...decision, doorway: decision.doorway, result: call.tool === 'ScheduleWakeup' ? '{"stopped":true,"cancelledWakeups":0}' : call.result };
      });
      journal.append({ kind: 'tool-turn', phase: 'trace', id: input.id, attempt: 0, consistent: true, calls,
        workspaceBytes: 0, at: captured.at });
      return JSON.stringify({ reply: body, memory: [] });
    }, checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: captured.update, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Starting a fresh conversation segment: please look up today\'s weather in Portland, Oregon using your tools, and name where you found it.' } }]);
    await worker.drain();
    expect(sent).toEqual([deliveredBody]);
    expect(journal.view.toolTurns).toMatchObject({ toolCalls: 3, toolRefusals: 0 });
    expect(journal.view.effectDoorway?.refused ?? 0).toBe(0);
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(sent).toEqual([deliveredBody]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
