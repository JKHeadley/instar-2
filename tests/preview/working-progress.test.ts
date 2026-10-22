import { afterEach, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, type PreviewPorts } from './journal-test-worker.js';
// @ts-expect-error Host-only JavaScript reader.
import { admissionActivity, createWorkingActivities } from './working-activity.mjs';
import { WORKING_CONNECTION, WORKING_RATE_LIMIT, WORKING_LIVENESS, currentWorkingActivity, workingProgressDue, type WorkingActivity } from './working-progress.js';

const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const update = { update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Check the build and tests.' } };
function fixture(options: { activityPort?: () => WorkingActivity | null; receipt?: number | null; cap?: number; batch?: boolean; recorded?: { kind: string; id: string; raw: string; source: unknown }; realActivity?: { step: string; text: string } } = {}) {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const root = mkdtempSync(join(tmpdir(), 'working-progress-')); roots.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(71);
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 30, maxReplies: options.cap ?? 30, maxTurns: 20, maxBytes: 262144, cursor: 0 });
  let release!: (answer: string | { state: 'uncertain' }) => void, entered!: () => void;
  const enteredPromise = new Promise<void>(done => { entered = done; });
  const busy = new Promise<string | { state: 'uncertain' }>(done => { release = done; });
  let activity: WorkingActivity | null = { step: 'build', text: 'Status: running the build', observedAt: Date.now() };
  const sent: { text: string; body: string; at: number; target: string | undefined }[] = [];
  let sendHold: Promise<void> | null = null, sendEntered = false;
  let context = '';
  const batches: (readonly { id: string }[])[] = [];
  const collected = new Map<string, NonNullable<Awaited<ReturnType<NonNullable<PreviewPorts['collectModel']>>>>>();
  const ports: PreviewPorts = { ...(options.batch ? { prepareModel: input => JSON.stringify(input), topicConcurrency: 1, collectModel: async id => collected.get(id) ?? null, modelBatch: async inputs => {
    batches.push(inputs); entered(); const answer = await busy;
    for (const input of inputs) collected.set(input.id, { context: input.context, prepared: input.prepared!, answer });
    return inputs.map(() => answer); } } : {}), ...(options.recorded ? { sources: [{ recordedShape: options.recorded }] } : {}), now: () => Date.now(), stopped: () => false,
    model: async input => { context = input.context; entered(); return busy; }, workingActivity: options.activityPort ?? (() => activity && ({ ...activity, ...options.realActivity, observedAt: Date.now() })),
    checkOutbound: () => {}, send: async input => { if (input.target?.startsWith('working-progress:')) { expect(input.provenance?.speaker).toBe('infrastructure'); sendEntered = true; await sendHold; } expect(journal.verifyOutbound(input.provenance, { target: input.target!, chat: input.chat, body: input.text })).toBe(true); sent.push({ text: input.expectedText, body: input.text, at: Date.now(), target: input.target });
      return input.target?.startsWith('working-progress:') ? options.receipt === undefined ? sent.length : options.receipt : sent.length; } };
  const worker = createJournalWorker(journal, ports);
  worker.intake(options.batch ? [update, { ...update, update_id: 2, message: { ...update.message, message_id: 2 } }] : [update]); const drain = worker.drain();
  const progress = () => sent.filter(row => row.target?.startsWith('working-progress:'));
  return { journal, worker, ports, path, key, sent, progress, batches, release, drain, enteredPromise, context: () => context, sendEntered: () => sendEntered,
    holdProgress: () => { let done!: () => void; sendHold = new Promise<void>(resolve => { done = resolve; }); return done; },
    activity: (step: string | null) => { activity = step === null ? null : { step, text: `Status: ${step}`, observedAt: Date.now() }; } };
}

it('cadence is relative to intake at 2, 5, 10 minutes, then every 10; activity must be fresh and concrete', () => {
  expect([0, 1, 2, 3, 4].map(n => workingProgressDue(1000, n))).toEqual([121000, 301000, 601000, 1201000, 1801000]);
  expect(currentWorkingActivity({ step: 'one', text: 'Status: checking tests', observedAt: 1 }, 10001)).toBe(true);
  expect(currentWorkingActivity({ step: 'one', text: 'Status: checking tests', observedAt: 1 }, 10002)).toBe(false);
  expect(currentWorkingActivity({ step: 'one', text: '', observedAt: 1 }, 2)).toBe(false);
  expect(currentWorkingActivity({ step: 'one', text: 'a\nb', observedAt: 1 }, 2)).toBe(false);
});

it.each([1, 2, 3, 4, 5])('1.x inconsistent-firing regression: repeated run %i always reports real activity and never after answer', async () => {
  const f = fixture();
  try {
    await f.enteredPromise;
    await vi.advanceTimersByTimeAsync(126999); expect(f.progress()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.text)).toEqual([WORKING_LIVENESS]);
    f.activity('checking test results'); await vi.advanceTimersByTimeAsync(180000);
    f.activity('checking integration results'); await vi.advanceTimersByTimeAsync(300000);
    f.activity('reviewing final diff'); await vi.advanceTimersByTimeAsync(600000);
    expect(f.progress().map(row => row.at)).toEqual([128000, 308000, 608000, 1208000]);
    expect(f.journal.view.speakers.agent).toBe(0);
    expect(f.journal.view.speakers.infrastructure).toBe(5);
    expect(retrospectiveCases(f.journal.view).filter(row => row.id.startsWith('working-progress:')).every(row => row.meta?.speaker === 'infrastructure')).toBe(true);
    expect(retrospectiveCases(f.journal.view).filter(row => row.id.startsWith('working-progress:'))).toHaveLength(4);
    f.release('Build and tests passed.'); await f.drain; await vi.advanceTimersByTimeAsync(1200000);
    expect(f.progress()).toHaveLength(4); expect(f.sent.at(-1)?.text).toBe('Build and tests passed.');
    f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, f.key);
    try { await createJournalWorker(reopened, f.ports).drain(); expect(f.progress()).toHaveLength(4); }
    finally { reopened.close(); }
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('a fast answer gets no progress line', async () => {
  const f = fixture();
  try { await f.enteredPromise; await vi.advanceTimersByTimeAsync(60000); f.release('Done.'); await f.drain;
    await vi.advanceTimersByTimeAsync(600000); expect(f.progress()).toHaveLength(0);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('a dead session gets the existing failure notice, never invented activity', async () => {
  const f = fixture();
  try { await f.enteredPromise; f.activity(null); await vi.advanceTimersByTimeAsync(300000);
    expect(f.progress()).toHaveLength(0); f.release({ state: 'uncertain' }); await f.drain;
    await vi.advanceTimersByTimeAsync(600000); await f.worker.drain();
    expect(f.progress()).toHaveLength(0); expect(f.journal.view.order[0]?.noticeClass).toBe('unknown-answer');
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('one tool step is announced once; stop cancels later lines', async () => {
  const f = fixture();
  try { await f.enteredPromise; await vi.advanceTimersByTimeAsync(600000); expect(f.progress()).toHaveLength(1);
    f.worker.stop('operator'); f.activity('must not send'); await vi.advanceTimersByTimeAsync(600000);
    expect(f.progress()).toHaveLength(1); f.release('Done.'); await f.drain.catch(() => {});
  } finally { f.release('Done.'); await f.drain.catch(() => {}); f.journal.close(); }
});

it('UNKNOWN progress is never retried and still consumes its step', async () => {
  const f = fixture({ receipt: null });
  try { await f.enteredPromise; await vi.advanceTimersByTimeAsync(600000); expect(f.progress()).toHaveLength(1);
    expect(f.journal.view.order[0]?.workingProgress?.[0]?.sent).toBeUndefined();
    f.release('Done.'); await f.drain;
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes as { kind: string; id: string; raw: string; source: unknown }[];
const recordedTool = JSON.parse(readFileSync(new URL('./fixtures/native-loop/live-2026-10-03/task.json', import.meta.url), 'utf8')).admission.split('\n')[0] + '\n';
it('recorded 715676627 failed completion supports a bounded liveness send, with no progress after the final answer', async () => {
  const source = new URL('./fixtures/progress-stale-2026-10-16/', import.meta.url);
  const prefix = readFileSync(new URL('first-progress-admission-prefix.jsonl', source), 'utf8');
  const { use, completion } = JSON.parse(readFileSync(new URL('failed-completions.json', source), 'utf8')).failures[0];
  const state = mkdtempSync(join(tmpdir(), 'progress-completion-')); roots.push(state);
  writeFileSync(join(state, 'config.json'), '{}');
  const result = spawnSync(process.execPath, [join(__dirname, 'tool-admission-hook.mjs'), 'post', state], {
    input: JSON.stringify({ hook_event_name: 'PostToolUseFailure', tool_use_id: use.id,
      tool_name: use.name, tool_input: use.input, error: completion.result }), encoding: 'utf8', timeout: 3000,
  });
  expect(result.status).toBe(0);
  const activity = admissionActivity(prefix + readFileSync(join(state, 'admission.jsonl'), 'utf8'), 0, 'recorded-715676627');
  expect(activity?.text).toBe('Status: latest main-session tool call ended');
  const f = fixture({ realActivity: activity });
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(127000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_LIVENESS]);
    f.release(shapes.find(shape => shape.kind === 'delivered-reply')!.raw); await f.drain;
    await vi.advanceTimersByTimeAsync(1200000); expect(f.progress()).toHaveLength(1);
    expect(f.sent.at(-1)?.target?.startsWith('working-progress:')).toBe(false);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it.each(shapes)('recorded $kind ($id): real activity fires through the new path, then stops with its answer outcome', async shape => {
  const f = fixture({ recorded: shape, realActivity: admissionActivity(recordedTool, 0, 'recorded-native-task') });
  try {
    await f.enteredPromise;
    expect(f.context()).toContain(JSON.stringify(shape.raw));
    expect(JSON.parse(f.context()).progressReplies.cadenceMinutes).toEqual([2, 5, 10]);
    await vi.advanceTimersByTimeAsync(127000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_LIVENESS]);
    f.activity(null);
    // Captured empty context is an empty-output control, not evidence of a delivered empty Telegram bubble.
    f.release(shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw)
      : shape.kind === 'delivered-reply' || shape.kind === 'empty-reply-in-recorded-context' ? shape.raw : 'Recorded evidence reviewed.');
    await f.drain; await vi.advanceTimersByTimeAsync(600000); await f.worker.drain();
    expect(f.progress()).toHaveLength(1);
    expect(f.sent.every(row => row.text.trim().length > 0)).toBe(true);
    if (shape.kind === 'summary-uncertain') expect(f.journal.view.order[0]?.noticeClass).toBe('unknown-answer');
    if (shape.kind === 'empty-reply-in-recorded-context') expect(f.journal.view.order[0]?.failureClass).toBe('empty');
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('reserves the last reply slot for the answer', async () => {
  const f = fixture({ cap: 3 });
  try { await f.enteredPromise; await vi.advanceTimersByTimeAsync(127000);
    expect(f.progress()).toHaveLength(1); // the other consumed slot was the acknowledgement
    f.activity('second step'); await vi.advanceTimersByTimeAsync(300000); expect(f.progress()).toHaveLength(1);
    f.release('Done.'); await f.drain; expect(f.sent.at(-1)?.text).toBe('Done.');
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it.each([
  { kind: 'long answer', receipt: 10 }, { kind: 'tool count', receipt: 10 },
  { kind: 'long answer', receipt: null }, { kind: 'tool count', receipt: null },
])('final $kind never waits for a slow progress transport (receipt=$receipt)', async ({ kind, receipt }) => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/gap-progress-final-2026-10-18.json', import.meta.url), 'utf8'));
  const answer = capture.turns[kind === 'long answer' ? 1 : 2].answer.split('\n\nFollow-up on "')[0];
  const f = fixture({ receipt }), finishSend = f.holdProgress();
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(127000);
    expect(f.sendEntered()).toBe(true); expect(f.progress()).toHaveLength(0);
    f.release(answer); await vi.advanceTimersByTimeAsync(1);
    const replies = f.sent.filter(row => row.target?.startsWith('reply:') || row.target?.startsWith('reply-part:'));
    expect(replies.length).toBeGreaterThan(0);
    expect(replies.map(row => row.text).join('\n')).toContain(kind === 'long answer' ? 'December — Sow:' : 'Byte count: 25 bytes');
    // Drain itself must finish while the already admitted progress transport is unresolved.
    let drained = false; void f.drain.then(() => { drained = true; });
    await vi.advanceTimersByTimeAsync(1); expect(drained).toBe(true);
    finishSend(); await vi.advanceTimersByTimeAsync(1); await f.drain;
    await vi.advanceTimersByTimeAsync(1200000); expect(f.progress()).toHaveLength(1);
    expect(f.journal.view.order[0]?.workingProgress?.[0]?.sent).toBe(receipt ?? undefined);
    // Both accepted and UNKNOWN late progress retain their consumed identity after restart.
    f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, f.key);
    try { await createJournalWorker(reopened, f.ports).drain(); expect(f.progress()).toHaveLength(1); }
    finally { reopened.close(); }
  } finally { finishSend(); f.release('Done.'); await f.drain; f.journal.close(); }
});


it('signs liveness only without revealing tool descriptions or targets', async () => {
  const f = fixture();
  try { await f.enteredPromise; f.activity('checking <files> & results'); await vi.advanceTimersByTimeAsync(127000);
    expect(f.progress()[0]).toMatchObject({ text: WORKING_LIVENESS, body: WORKING_LIVENESS });
    f.release('Done.'); await f.drain;
    f.journal.compact(); f.journal.close(); const reopened = openPreviewJournal(f.path, f.key); reopened.close();
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it('batched messages sharing one working session announce each step only once in the topic', async () => {
  const f = fixture({ batch: true });
  try { await f.enteredPromise; expect(f.batches.map(inputs => inputs.length)).toEqual([2]);
    await vi.advanceTimersByTimeAsync(127000);
    expect(f.progress()).toHaveLength(1);
    f.release('Done.'); await f.drain; await vi.advanceTimersByTimeAsync(600000);
    expect(f.progress()).toHaveLength(1); expect(f.journal.view.order.every(turn => turn.sent !== undefined)).toBe(true);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it.each(['sibling', 'later intake'])('a real batch shares the slow cadence across changed steps and preserves it through replay: %s', async target => {
  const f = fixture({ batch: true });
  try {
    await f.enteredPromise; expect(f.batches.map(inputs => inputs.length)).toEqual([2]);
    await vi.advanceTimersByTimeAsync(127000);
    expect(f.progress().map(row => row.at)).toEqual([128000]);
    f.activity('next admitted tool'); await vi.advanceTimersByTimeAsync(1000);
    expect(f.progress()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(178999); expect(f.progress()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.at)).toEqual([128000, 308000]);
    f.activity('third admitted tool'); await vi.advanceTimersByTimeAsync(299999); expect(f.progress()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.at)).toEqual([128000, 308000, 608000]);

    // Replay the pending batch, including its progress intents, without granting a new allowance.
    f.journal.compact();
    const replayPath = `${f.path}.replay`;
    copyFileSync(f.path, replayPath);
    const reopened = openPreviewJournal(replayPath, f.key);
    try {
      let turn = reopened.view.order[1]!;
      const sibling = reopened.view.order[0]!;
      // Completing the sibling after this intake must not free a fresh progress slot.
      reopened.append({ kind: 'answer', id: sibling.id, text: 'Done.', at: 608000 });
      reopened.append({ kind: 'intent', id: sibling.id, text: 'Done.', chat: reopened.view.genesis.chat,
        update: sibling.update, grant: reopened.view.genesis.grant,
        provenance: reopened.signOutbound('agent', { target: `reply:${sibling.id}`, chat: reopened.view.genesis.chat, body: 'Done.' }), at: 608000 });
      if (target === 'later intake') {
        createJournalWorker(reopened, { ...f.ports, now: () => 608001 }).intake([
          { ...update, update_id: 3, message: { ...update.message, message_id: 3 } }]);
        const next = reopened.view.order[2]!;
        reopened.append({ kind: 'reserve', id: next.id, at: 608001 });
        reopened.append({ kind: 'answer', id: turn.id, text: 'Done.', at: 608002 });
        reopened.append({ kind: 'intent', id: turn.id, text: 'Done.', chat: reopened.view.genesis.chat,
          update: turn.update, grant: reopened.view.genesis.grant,
          provenance: reopened.signOutbound('agent', { target: `reply:${turn.id}`, chat: reopened.view.genesis.chat, body: 'Done.' }), at: 608002 });
        turn = next;
      }
      const append = (at: number, step: string, speaker: 'agent' | 'infrastructure' = 'infrastructure') => {
        const text = WORKING_LIVENESS, ordinal = turn.workingProgress?.length ?? 0;
        const provenance = reopened.signOutbound(speaker, {
          target: `working-progress:${ordinal}:${turn.id}`, chat: reopened.view.genesis.chat, body: text });
        reopened.append({ kind: 'held-notice-intent', id: turn.id, text, chat: reopened.view.genesis.chat,
          update: turn.update, grant: reopened.view.genesis.grant, provenance,
          workingProgress: { ordinal, step, text, observedAt: at, at }, at });
      };
      expect(() => append(608003, 'too soon after replay')).toThrow('working progress refused');
      expect(() => append(1207999, 'before shared deadline')).toThrow('working progress refused');
      expect(() => append(1208000, 'third admitted tool')).toThrow('working progress refused');
      expect(() => append(1208000, 'wrong speaker', 'agent')).toThrow('working progress refused');
      expect(() => append(1208000, 'eligible after replay')).not.toThrow();
      expect(turn.workingProgress?.at(-1)?.at).toBe(1208000);
    } finally { reopened.close(); }
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it('a new answer after the previous answer completed starts its own two-minute cadence', async () => {
  const f = fixture();
  let release!: (answer: string) => void;
  let drain: Promise<void> | undefined;
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(127000);
    f.release('Done.'); await f.drain;
    await vi.advanceTimersByTimeAsync(1); f.activity('new answer step');
    const busy = new Promise<string>(done => { release = done; });
    let entered!: () => void;
    const ready = new Promise<void>(done => { entered = done; });
    const worker = createJournalWorker(f.journal, { ...f.ports, model: async () => { entered(); return busy; } });
    worker.intake([{ ...update, update_id: 3, message: { ...update.message, message_id: 3 } }]);
    drain = worker.drain(); await ready;
    await vi.advanceTimersByTimeAsync(126999); expect(f.progress()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.at)).toEqual([128000, 255001]);
    release('Done again.'); await drain;
  } finally { release?.('Done.'); await drain; f.release('Done.'); await f.drain; f.journal.close(); }
});

it('caps a continuously advancing answer at four liveness lines, including uncertain sends', async () => {
  const f = fixture({ receipt: null });
  try {
    await f.enteredPromise;
    await vi.advanceTimersByTimeAsync(127000);
    for (let i = 1; i <= 8; i++) { f.activity(`step-${i}`); await vi.advanceTimersByTimeAsync(600000); }
    expect(f.progress()).toHaveLength(4);
    expect(f.progress().every(row => row.text === WORKING_LIVENESS)).toBe(true);
    f.release('Done.'); await f.drain;
    f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, f.key);
    try { expect(reopened.view.order[0]?.workingProgress).toHaveLength(4); }
    finally { reopened.close(); }
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('another outbound resets silence durably without resetting the episode budget', async () => {
  const f = fixture({ batch: true });
  try {
    await f.enteredPromise;
    await vi.advanceTimersByTimeAsync(127000); expect(f.progress()).toHaveLength(1);
    f.activity('next step'); await vi.advanceTimersByTimeAsync(170000);
    const turn = f.journal.view.order[1]!, at = Date.now(), text = 'One result is ready.';
    f.journal.append({ kind: 'answer', id: turn.id, text, at });
    f.journal.append({ kind: 'intent', id: turn.id, text, chat: f.journal.view.genesis.chat,
      update: turn.update, grant: f.journal.view.genesis.grant,
      provenance: f.journal.signOutbound('agent', { target: `reply:${turn.id}`, chat: f.journal.view.genesis.chat, body: text }), at });
    f.journal.append({ kind: 'sent', id: turn.id, message: 99, at });
    f.journal.compact();
    const replay = `${f.path}.silence`; copyFileSync(f.path, replay);
    const reopened = openPreviewJournal(replay, f.key);
    try { expect(reopened.view.lastOutboundAt?.main).toBe(at); } finally { reopened.close(); }
    await vi.advanceTimersByTimeAsync(119999); expect(f.progress()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress()).toHaveLength(2);
    expect(f.progress()[1]?.at).toBe(at + 120000);
    f.release('Done.'); await f.drain;
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('replays advancing recorded worker evidence through the actual reader and signed send path', async () => {
  let bytes = '';
  const reader = createWorkingActivities({ read: () => bytes, now: () => Date.now() });
  const f = fixture({ activityPort: () => reader.current('answer') });
  try {
    await f.enteredPromise; reader.observe('answer', 'recorded-native-task', 'start');
    await vi.advanceTimersByTimeAsync(120000);
    bytes = recordedTool; reader.observe('answer', 'recorded-native-task', 'working');
    await vi.advanceTimersByTimeAsync(7000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_LIVENESS]);
    await vi.advanceTimersByTimeAsync(180000);
    reader.observe('answer', 'recorded-native-task', 'working');
    expect(reader.current('answer')).toMatchObject({ running: true });
    expect(f.progress()).toHaveLength(1); // same occurrence cannot send twice
    reader.observe('answer', null, 'end'); f.release('12 bytes.'); await f.drain;
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('6234450: the recorded 572-second foreground tool gets liveness during work, never renewed after completion or final', async () => {
  const record = JSON.parse(readFileSync(new URL('./fixtures/gap-progress-6234450.json', import.meta.url), 'utf8'));
  const invocation = record.records.find((row: { at: string }) => row.at === '2026-10-17T22:49:43.437Z');
  const completion = record.records.find((row: { at: string }) => row.at === '2026-10-17T22:59:15.059Z');
  const use = invocation.content[0];
  const final = record.records.find((row: { at: string }) => row.at === '2026-10-17T22:59:22.690Z').content[0];
  // Real model tool/input/result bytes, projected to the existing hook record shape.
  // No sampling command executes: only the captured timeline advances on a fake clock.
  const admitted = JSON.stringify({ phase: 'pre', decision: 'allow', id: use.id, tool: use.name, input: JSON.stringify(use.input) }) + '\n';
  const ended = JSON.stringify({ phase: 'post', id: use.id, tool: use.name, result: completion.content[0].content }) + '\n';
  let bytes = '';
  const reader = createWorkingActivities({ read: () => bytes, now: () => Date.now() });
  const f = fixture({ activityPort: () => reader.current('answer') });
  try {
    await f.enteredPromise; reader.observe('answer', 'recorded-6234450', 'start');
    const started = Date.parse(invocation.at) - Date.parse(record.intakeAt);
    const finished = Date.parse(completion.at) - Date.parse(record.intakeAt);
    await vi.advanceTimersByTimeAsync(started);
    bytes = admitted;
    while (Date.now() < 1000 + finished) {
      reader.observe('answer', 'recorded-6234450', 'working');
      await vi.advanceTimersByTimeAsync(Math.min(2000, 1000 + finished - Date.now()));
    }
    expect(f.progress().map(row => row.text)).toEqual([WORKING_LIVENESS]);
    expect(f.progress()[0]!.at).toBeLessThan(1000 + finished);
    expect(f.progress()[0]!.at).toBeLessThan(131000);
    bytes += ended; reader.observe('answer', 'recorded-6234450', 'working');
    expect(reader.current('answer')).toBeNull();
    await vi.advanceTimersByTimeAsync(300000);
    reader.observe('answer', 'recorded-6234450', 'working');
    expect(reader.current('answer')).toBeNull();
    expect(f.progress()).toHaveLength(1);
    reader.observe('answer', null, 'end');
    f.release(JSON.parse(final.input.content).reply.answer); await f.drain;
    await vi.advanceTimersByTimeAsync(1200000);
    expect(f.progress()).toHaveLength(1);
    expect(f.sent.at(-1)?.text).toContain('572 seconds');
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('tells a waiting user plainly before the bounded retry, once even across unknown delivery and restart', async () => {
  const f = fixture({ receipt: null, activityPort: () => ({ step: 'rate:captured-episode', text: 'bounded recovery', wait: 'rate-limit', observedAt: Date.now() }) });
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(25_000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_RATE_LIMIT]);
    await vi.advanceTimersByTimeAsync(300_000); expect(f.progress()).toHaveLength(1);
    f.release('Done.'); await f.drain;
    f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, f.key);
    try { await createJournalWorker(reopened, f.ports).drain(); expect(f.progress()).toHaveLength(1); }
    finally { reopened.close(); }
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('projects a fresh durable recovery wait without pretending a tool is running', () => {
  let now = 1000;
  const activity = createWorkingActivities({ now: () => now, read: () => '' });
  activity.observe('input', 'claim', 'start');
  const session = { claim: 'claim', identity: 'exact-worker', rateRecovery: { state: 'waiting', dueAt: 31000 } };
  const waiting = { kind: 'Success', value: { phase: 'launched', detail: 'rate-limit recovery waiting' } };
  activity.observeSession(session, waiting);
  expect(activity.current('input')).toMatchObject({ wait: 'rate-limit', running: false, observedAt: 1000 });
  now = 11001; expect(activity.current('input')).toBeNull();
  activity.observeSession(session, waiting);
  expect(activity.current('input')?.wait).toBe('rate-limit');
  activity.observeSession(session, { kind: 'Success', value: { phase: 'output-observed', detail: 'done' } }); expect(activity.current('input')).toBeNull();
  activity.observeSession(session, waiting); activity.observe('input', null, 'end');
  expect(activity.current('input')).toBeNull();
});

it.each(shapes)('recorded $kind ($id) traverses the throttle wait notice and terminates without empty sends', async shape => {
  const activities = createWorkingActivities({ now: () => Date.now(), read: () => '' });
  const session = { claim: 'claim', identity: 'captured-worker', rateRecovery: { state: 'waiting', dueAt: 31000 } };
  const f = fixture({ recorded: shape, activityPort: () => {
    activities.observeSession(session, { kind: 'Success', value: { phase: 'launched', detail: 'rate-limit recovery waiting' } });
    return activities.current('input');
  } });
  activities.observe('input', 'claim', 'start');
  try {
    await f.enteredPromise; expect(f.context()).toContain(JSON.stringify(shape.raw));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_RATE_LIMIT]);
    activities.observe('input', null, 'end');
    f.release(shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw)
      : shape.kind === 'delivered-reply' || shape.kind === 'empty-reply-in-recorded-context' ? shape.raw : 'Recorded evidence reviewed.');
    await f.drain; await vi.advanceTimersByTimeAsync(300_000);
    expect(f.progress()).toHaveLength(1); expect(f.sent.every(row => row.text.trim())).toBe(true);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it.each(['stale', 'completed', 'refused', 'stopped'])('does not announce a %s recovery observation', async mode => {
  const activities = createWorkingActivities({ now: () => Date.now(), read: () => '' });
  const f = fixture({ activityPort: () => activities.current('input') });
  activities.observe('input', 'claim', 'start');
  activities.observeSession({ claim: 'claim', identity: 'worker', rateRecovery: { state: 'waiting', dueAt: 31000 } },
    mode === 'refused' ? { kind: 'Refused' } : { kind: 'Success', value: { phase: mode === 'completed' ? 'output-observed' : 'launched', detail: 'rate-limit recovery waiting' } });
  try {
    await f.enteredPromise;
    if (mode === 'stopped') f.worker.stop('operator');
    await vi.advanceTimersByTimeAsync(25_000); expect(f.progress()).toHaveLength(0);
  } finally {
    f.release('Done.');
    if (mode === 'stopped') await expect(f.drain).rejects.toThrow('preview stopped');
    else await f.drain;
    f.journal.close();
  }
});

it.each([false, true])('rate-limit wait preserves the final reply slot (batched=%s)', async batch => {
  const f = fixture({ batch, cap: 2, activityPort: () => ({ step: 'rate:episode', text: 'recovery', wait: 'rate-limit', observedAt: Date.now() }) });
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(25_000);
    expect(f.progress()).toHaveLength(0);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('batched inputs sharing one recovery get one early wait explanation', async () => {
  const f = fixture({ batch: true, activityPort: () => ({ step: 'rate:episode', text: 'recovery', wait: 'rate-limit', observedAt: Date.now() }) });
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(25_000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_RATE_LIMIT]);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it('projects one stable connection episode from fresh native retry observations only', () => {
  let now = 1000;
  const activities = createWorkingActivities({ now: () => now, read: () => '' });
  activities.observe('input', 'claim', 'start');
  const session = { claim: 'claim', identity: 'worker', turnStartedAt: 900,
    connectionRetry: { turnStartedAt: 900, attempt: 1 } };
  const observation = { kind: 'Success', value: { phase: 'launched', detail: 'connection recovery waiting' } };
  activities.observeSession(session, observation);
  expect(activities.current('input')).toMatchObject({ wait: 'connection', running: false });
  const step = activities.current('input').step;
  activities.observeSession({ ...session, connectionRetry: { ...session.connectionRetry, attempt: 10 } }, observation);
  expect(activities.current('input').step).toBe(step);
  now += 10001; expect(activities.current('input')).toBeNull();
  activities.observeSession({ ...session, turnStartedAt: 901 }, observation);
  expect(activities.current('input')).toBeNull();
  activities.observeSession(session, observation);
  activities.observeSession(session, { kind: 'Success', value: { phase: 'pause-observed', detail: 'connection-exhausted' } });
  expect(activities.current('input')).toBeNull();
});


const connectionCapture = JSON.parse(readFileSync(new URL('./fixtures/socket-drop-worker-1016101-2026-10-16.json', import.meta.url), 'utf8'));
const connectionSession = connectionCapture.proofs.find((proof: { name: string }) => proof.name === 'persistent').sessionJournal.sessions[0];

it.each(shapes)('recorded $kind ($id) survives a connection wait with one honest line and no empty send', async shape => {
  const activities = createWorkingActivities({ now: () => Date.now(), read: () => '' });
  const f = fixture({ recorded: shape, activityPort: () => {
    activities.observeSession(connectionSession, { kind: 'Success', value: { phase: 'launched', detail: 'connection recovery waiting' } });
    return activities.current('input');
  } });
  activities.observe('input', connectionSession.claim, 'start');
  try {
    await f.enteredPromise; expect(f.context()).toContain(JSON.stringify(shape.raw));
    await vi.advanceTimersByTimeAsync(25_000); expect(f.progress()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(105_000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_CONNECTION]);
    await vi.advanceTimersByTimeAsync(600_000); expect(f.progress()).toHaveLength(1);
    activities.observe('input', null, 'end');
    f.release(shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw)
      : shape.kind === 'delivered-reply' || shape.kind === 'empty-reply-in-recorded-context' ? shape.raw : 'Recorded evidence reviewed.');
    await f.drain;
    expect(f.sent.every(row => row.text.trim())).toBe(true);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('does not repeat an unknown connection notice after journal compaction and restart', async () => {
  const f = fixture({ receipt: null, activityPort: () => ({ step: 'connection:captured-turn', text: 'bounded connection recovery', wait: 'connection', observedAt: Date.now() }) });
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(130_000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_CONNECTION]);
    await vi.advanceTimersByTimeAsync(600_000); expect(f.progress()).toHaveLength(1);
    f.release('Done.'); await f.drain; f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, f.key);
    try { await createJournalWorker(reopened, f.ports).drain(); expect(f.progress()).toHaveLength(1); }
    finally { reopened.close(); }
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it.each(['stale', 'completed', 'refused', 'stopped', 'exhausted', 'other-turn'])('does not announce a %s connection recovery', async mode => {
  const activities = createWorkingActivities({ now: () => Date.now(), read: () => '' });
  const f = fixture({ activityPort: () => {
    if (mode !== 'stale') activities.observeSession({ ...connectionSession,
      ...(mode === 'other-turn' ? { turnStartedAt: connectionSession.turnStartedAt + 1 } : {}) },
      mode === 'refused' ? { kind: 'Refused' } : { kind: 'Success', value: {
        phase: mode === 'completed' ? 'output-observed' : mode === 'exhausted' ? 'pause-observed' : 'launched', detail: 'connection recovery waiting' } });
    return activities.current('input');
  } });
  activities.observe('input', connectionSession.claim, 'start');
  try {
    await f.enteredPromise;
    if (mode === 'stopped') f.worker.stop('operator');
    await vi.advanceTimersByTimeAsync(130_000); expect(f.progress()).toHaveLength(0);
  } finally {
    f.release('Done.');
    if (mode === 'stopped') await expect(f.drain).rejects.toThrow('preview stopped');
    else await f.drain;
    f.journal.close();
  }
});

it.each([false, true])('connection wait preserves the final reply slot (batched=%s)', async batch => {
  const f = fixture({ batch, cap: 2, activityPort: () => ({ step: 'connection:episode', text: 'recovery', wait: 'connection', observedAt: Date.now() }) });
  try { await f.enteredPromise; await vi.advanceTimersByTimeAsync(130_000); expect(f.progress()).toHaveLength(0); }
  finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it('batched inputs sharing a native reconnect episode receive one explanation', async () => {
  const f = fixture({ batch: true, activityPort: () => ({ step: 'connection:episode', text: 'recovery', wait: 'connection', observedAt: Date.now() }) });
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(130_000);
    expect(f.progress().map(row => row.text)).toEqual([WORKING_CONNECTION]);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});

it.each([0, 11, 1.5, NaN])('keeps invalid native retry count %s out of the notice projection', attempt => {
  const activities = createWorkingActivities({ now: () => 1000, read: () => '' });
  activities.observe('input', 'claim', 'start');
  activities.observeSession({ claim: 'claim', identity: 'worker', turnStartedAt: 900,
    connectionRetry: { turnStartedAt: 900, attempt } },
  { kind: 'Success', value: { phase: 'launched', detail: 'connection recovery waiting' } });
  expect(activities.current('input')).toBeNull();
});
