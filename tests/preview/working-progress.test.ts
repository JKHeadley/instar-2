import { afterEach, expect, it, vi } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, type PreviewPorts } from './journal-test-worker.js';
// @ts-expect-error Host-only JavaScript reader.
import { admissionActivity } from './working-activity.mjs';
import { currentWorkingActivity, workingProgressDue, type WorkingActivity } from './working-progress.js';

const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const update = { update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Check the build and tests.' } };
function fixture(options: { receipt?: number | null; cap?: number; batch?: boolean; recorded?: { kind: string; id: string; raw: string; source: unknown }; realActivity?: { step: string; text: string } } = {}) {
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
    model: async input => { context = input.context; entered(); return busy; }, workingActivity: () => activity && ({ ...activity, ...options.realActivity, observedAt: Date.now() }),
    checkOutbound: () => {}, send: async input => { if (input.target?.startsWith('working-progress:')) { sendEntered = true; await sendHold; } expect(journal.verifyOutbound(input.provenance, { target: input.target!, chat: input.chat, body: input.text })).toBe(true); sent.push({ text: input.expectedText, body: input.text, at: Date.now(), target: input.target });
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
    await vi.advanceTimersByTimeAsync(119999); expect(f.progress()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.text)).toEqual(['Status: running the build']);
    f.activity('checking test results'); await vi.advanceTimersByTimeAsync(180000);
    f.activity('checking integration results'); await vi.advanceTimersByTimeAsync(300000);
    f.activity('reviewing final diff'); await vi.advanceTimersByTimeAsync(600000);
    expect(f.progress().map(row => row.at)).toEqual([121000, 301000, 601000, 1201000]);
    expect(f.journal.view.speakers.agent).toBe(4);
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
it.each(shapes)('recorded $kind ($id): real activity fires through the new path, then stops with its answer outcome', async shape => {
  const f = fixture({ recorded: shape, realActivity: admissionActivity(recordedTool, 0, 'recorded-native-task') });
  try {
    await f.enteredPromise;
    expect(f.context()).toContain(JSON.stringify(shape.raw));
    expect(JSON.parse(f.context()).progressReplies.cadenceMinutes).toEqual([2, 5, 10]);
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.progress().map(row => row.text)).toEqual(['Status: Write: note.txt']);
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
  try { await f.enteredPromise; await vi.advanceTimersByTimeAsync(120000);
    expect(f.progress()).toHaveLength(1); // the other consumed slot was the acknowledgement
    f.activity('second step'); await vi.advanceTimersByTimeAsync(300000); expect(f.progress()).toHaveLength(1);
    f.release('Done.'); await f.drain; expect(f.sent.at(-1)?.text).toBe('Done.');
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it('final answer waits for an already dispatched progress line, so transport delay cannot invert their order', async () => {
  const f = fixture(), finishSend = f.holdProgress();
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(120000);
    expect(f.sendEntered()).toBe(true); expect(f.progress()).toHaveLength(0);
    f.release('Done.'); await vi.advanceTimersByTimeAsync(1);
    expect(f.sent.some(row => row.text === 'Done.')).toBe(false);
    finishSend(); await f.drain;
    expect(f.sent.slice(-2).map(row => row.text)).toEqual(['Status: running the build', 'Done.']);
    await vi.advanceTimersByTimeAsync(1200000); expect(f.progress()).toHaveLength(1);
  } finally { finishSend(); f.release('Done.'); await f.drain; f.journal.close(); }
});


it('signs and sends the normal HTML-encoded body while retaining the exact plain status', async () => {
  const f = fixture();
  try { await f.enteredPromise; f.activity('checking <files> & results'); await vi.advanceTimersByTimeAsync(120000);
    expect(f.progress()[0]).toMatchObject({ text: 'Status: checking <files> & results', body: 'Status: checking &lt;files&gt; &amp; results' });
    f.release('Done.'); await f.drain;
    f.journal.compact(); f.journal.close(); const reopened = openPreviewJournal(f.path, f.key); reopened.close();
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it('batched messages sharing one working session announce each step only once in the topic', async () => {
  const f = fixture({ batch: true });
  try { await f.enteredPromise; expect(f.batches.map(inputs => inputs.length)).toEqual([2]);
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.progress()).toHaveLength(1);
    f.release('Done.'); await f.drain; await vi.advanceTimersByTimeAsync(600000);
    expect(f.progress()).toHaveLength(1); expect(f.journal.view.order.every(turn => turn.sent !== undefined)).toBe(true);
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it.each(['sibling', 'later intake'])('a real batch shares the slow cadence across changed steps and preserves it through replay: %s', async target => {
  const f = fixture({ batch: true });
  try {
    await f.enteredPromise; expect(f.batches.map(inputs => inputs.length)).toEqual([2]);
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.progress().map(row => row.at)).toEqual([121000]);
    f.activity('next admitted tool'); await vi.advanceTimersByTimeAsync(1000);
    expect(f.progress()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(178999); expect(f.progress()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.at)).toEqual([121000, 301000]);
    f.activity('third admitted tool'); await vi.advanceTimersByTimeAsync(299999); expect(f.progress()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.at)).toEqual([121000, 301000, 601000]);

    // Replay the pending batch, including its progress intents, without granting a new allowance.
    f.journal.compact();
    const replayPath = `${f.path}.replay`;
    copyFileSync(f.path, replayPath);
    const reopened = openPreviewJournal(replayPath, f.key);
    try {
      let turn = reopened.view.order[1]!;
      const sibling = reopened.view.order[0]!;
      // Completing the sibling after this intake must not free a fresh progress slot.
      reopened.append({ kind: 'answer', id: sibling.id, text: 'Done.', at: 601000 });
      reopened.append({ kind: 'intent', id: sibling.id, text: 'Done.', chat: reopened.view.genesis.chat,
        update: sibling.update, grant: reopened.view.genesis.grant,
        provenance: reopened.signOutbound('agent', { target: `reply:${sibling.id}`, chat: reopened.view.genesis.chat, body: 'Done.' }), at: 601000 });
      if (target === 'later intake') {
        createJournalWorker(reopened, { ...f.ports, now: () => 601001 }).intake([
          { ...update, update_id: 3, message: { ...update.message, message_id: 3 } }]);
        const next = reopened.view.order[2]!;
        reopened.append({ kind: 'reserve', id: next.id, at: 601001 });
        reopened.append({ kind: 'answer', id: turn.id, text: 'Done.', at: 601002 });
        reopened.append({ kind: 'intent', id: turn.id, text: 'Done.', chat: reopened.view.genesis.chat,
          update: turn.update, grant: reopened.view.genesis.grant,
          provenance: reopened.signOutbound('agent', { target: `reply:${turn.id}`, chat: reopened.view.genesis.chat, body: 'Done.' }), at: 601002 });
        turn = next;
      }
      const append = (at: number, step: string) => {
        const text = `Status: ${step}`, ordinal = turn.workingProgress?.length ?? 0;
        const provenance = reopened.signOutbound('agent', {
          target: `working-progress:${ordinal}:${turn.id}`, chat: reopened.view.genesis.chat, body: text });
        reopened.append({ kind: 'held-notice-intent', id: turn.id, text, chat: reopened.view.genesis.chat,
          update: turn.update, grant: reopened.view.genesis.grant, provenance,
          workingProgress: { ordinal, step, text, observedAt: at, at }, at });
      };
      expect(() => append(601003, 'too soon after replay')).toThrow('working progress refused');
      expect(() => append(1200999, 'before shared deadline')).toThrow('working progress refused');
      expect(() => append(1201000, 'third admitted tool')).toThrow('working progress refused');
      expect(() => append(1201000, 'eligible after replay')).not.toThrow();
      expect(turn.workingProgress?.at(-1)?.at).toBe(1201000);
    } finally { reopened.close(); }
  } finally { f.release('Done.'); await f.drain; f.journal.close(); }
});


it('a new answer after the previous answer completed starts its own two-minute cadence', async () => {
  const f = fixture();
  let release!: (answer: string) => void;
  let drain: Promise<void> | undefined;
  try {
    await f.enteredPromise; await vi.advanceTimersByTimeAsync(120000);
    f.release('Done.'); await f.drain;
    await vi.advanceTimersByTimeAsync(1); f.activity('new answer step');
    const busy = new Promise<string>(done => { release = done; });
    let entered!: () => void;
    const ready = new Promise<void>(done => { entered = done; });
    const worker = createJournalWorker(f.journal, { ...f.ports, model: async () => { entered(); return busy; } });
    worker.intake([{ ...update, update_id: 3, message: { ...update.message, message_id: 3 } }]);
    drain = worker.drain(); await ready;
    await vi.advanceTimersByTimeAsync(119999); expect(f.progress()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); expect(f.progress().map(row => row.at)).toEqual([121000, 241001]);
    release('Done again.'); await drain;
  } finally { release?.('Done.'); await drain; f.release('Done.'); await f.drain; f.journal.close(); }
});
