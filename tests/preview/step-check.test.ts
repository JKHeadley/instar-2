import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { interpretStepJev } from './step-check.js';
import { redact } from '../../src/recall/redact.js';

const key = new Uint8Array(32).fill(13);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 8, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const jev = (score: number) => ({ model: 'jev-1.13.0', answers: { unsupported_effect: { type: 'noul', noul: score } },
  usage: { input_tokens: 11, output_tokens: 2 } });

it('keeps the off path byte-identical at model, send, and plaintext journal boundaries', async () => {
  const run = async (newHooks: boolean) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-off-')));
    try {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
      const frames: string[] = [], packets: string[] = [], sends: string[] = [];
      const append = journal.append;
      journal.append = row => { frames.push(JSON.stringify(row)); append(row); };
      const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
        model: async input => { packets.push(JSON.stringify(input)); return 'The answer is seven.'; },
        send: async input => { sends.push(JSON.stringify(input)); return 5; }, checkOutbound: () => {} });
      if (newHooks) worker.startStepChecks();
      worker.intake([update(1, 'What is the answer?')]); await worker.drain();
      if (newHooks) await worker.checkSteps();
      const projection = { calls: journal.view.calls, replies: journal.view.replies, turn: journal.view.order[0],
        steps: journal.view.stepChecks.size };
      journal.close();
      return { frames, packets, sends, projection };
    } finally { rmSync(root, { recursive: true, force: true }); }
  };
  expect(await run(true)).toEqual(await run(false));
});

it('records pass and violation verdicts without changing sends, then replays them', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-verdict-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    const states: string[] = [], sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'I recorded a memory change.',
      send: async input => { sends.push(input.expectedText); return sends.length; }, checkOutbound: () => {},
      stepCheck: { jev: async state => { states.push(state); return { value: jev(states.length === 1 ? 0.94 : 0.02), latencyMs: 13 }; } } });
    worker.startStepChecks();
    worker.intake([update(1, 'Remember a detail.')]); await worker.drain(); await worker.checkSteps();
    worker.intake([update(2, 'What happened?')]); await worker.drain(); await worker.checkSteps();
    expect(states).toHaveLength(2);
    expect(states[0]).toContain('"memoryChanges":[]');
    expect(journal.view.stepChecks.get('answer:telegram:12345678:update:1')?.result?.verdict).toBe('violation');
    expect(journal.view.stepChecks.get('answer:telegram:12345678:update:2')?.result?.verdict).toBe('pass');
    expect(sends).toEqual(['PREVIEW — I recorded a memory change.', 'PREVIEW — I recorded a memory change.']);
    journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true);
    expect([...replay.view.stepChecks.values()].map(item => item.result?.verdict)).toEqual(['violation', 'pass']);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('shows Jev the memory change actually recorded by an answer frame', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-memory-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let state = '';
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('fixture appends the model result directly'); },
      send: async () => { throw Error('fixture does not send'); }, checkOutbound: () => {},
      stepCheck: { jev: async text => { state = text; return { value: jev(0.01), latencyMs: 9 }; } } });
    worker.startStepChecks();
    worker.intake([update(1, 'My bird is Wren.'), update(2, 'Actually my bird is Dove.')]);
    const id = 'telegram:12345678:update:2';
    journal.append({ kind: 'reserve', id, at: 1000 });
    journal.append({ kind: 'answer', id, text: 'I updated your bird memory.', state: 'complete',
      memory: [{ mode: 'correct', source: 'telegram:12345678:update:1', quote: 'My bird is Wren.',
        trigger: id, replacement: 'my bird is Dove' }], at: 1000 });
    await worker.checkSteps();
    expect(state).toContain('"replacement":"my bird is Dove"');
    expect(journal.view.stepChecks.get(`answer:${id}`)?.result?.verdict).toBe('pass');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('checks a committed summary and records an unsure Jev score without gating the reply', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-summary-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const seen: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:') ? JSON.stringify({ summary: 'One question was answered.', people: [] }) : 'Seven.',
      send: async () => 5, checkOutbound: () => {},
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0 } } }),
      stepCheck: { jev: async state => { seen.push(state); return { value: jev(0.5), latencyMs: 10 }; } } });
    worker.startStepChecks(); worker.intake([update(1, 'What is seven?')]); await worker.drain();
    await worker.summarizeIfNeeded(true); await worker.checkSteps();
    expect(seen.some(state => state.includes('"summaryRecorded":true'))).toBe(true);
    expect([...journal.view.stepChecks.values()].map(item => item.result?.verdict)).toEqual(['unsure', 'unsure']);
    expect(journal.view.order[0]?.sent).toBe(5);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('checks a completed but rejected summary answer against the retained journal state', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-summary-failed-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const seen: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'I changed memory.', people: [], memory: [{ invalid: true }] }) : 'Seven.',
      send: async () => 5, checkOutbound: () => {},
      stepCheck: { jev: async state => { seen.push(state); return { value: jev(0.96), latencyMs: 10 }; } } });
    worker.startStepChecks(); worker.intake([update(1, 'What is seven?')]); await worker.drain();
    await worker.summarizeIfNeeded(true); await worker.checkSteps();
    expect(journal.view.summaries).toHaveLength(0);
    expect(seen.some(state => state.includes('"summaryRecorded":false'))).toBe(true);
    expect([...journal.view.stepChecks].find(([id]) => id.startsWith('summary-failed:'))?.[1].result?.verdict).toBe('violation');
    expect(journal.view.order[0]?.sent).toBe(5);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('redacts a credential from Jev evidence and preserves the existing outbound secret hold', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-secret-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let jevCalls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'The token is sk-AAAAAAAAAAAAAAAAAAAAAAAA.',
      send: async () => { throw Error('secret sent'); },
      checkOutbound: text => { if (text.includes('sk-AAAAAAAAAAAAAAAAAAAAAAAA')) throw Error('secret'); },
      stepCheck: { jev: async () => { jevCalls++; throw Error('Jev outage'); } } });
    worker.startStepChecks(); worker.intake([update(1, 'What happened?')]); await worker.drain(); await worker.checkSteps();
    expect(jevCalls).toBe(0);
    expect(journal.view.stepChecks.get('answer:telegram:12345678:update:1')?.result?.verdict).toBe('unavailable');
    expect(journal.view.order[0]?.held).toBe('outbound secret refused');
    expect(journal.view.order[0]?.sent).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([
  'Here it is:\n' + 'sk-' + 'A'.repeat(24),
  'password = "CorrectHorseBattery"',
  'Bearer\n' + 'B'.repeat(24),
])('refuses raw secret evidence before JSON escaping: %s', async answer => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-escaped-secret-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let jevCalls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => answer,
      send: async () => { throw Error('secret sent'); },
      checkOutbound: text => { if (redact(text).count) throw Error('secret'); },
      stepCheck: { jev: async () => { jevCalls++; return { value: jev(0.01), latencyMs: 1 }; } } });
    worker.startStepChecks(); worker.intake([update(1, 'What happened?')]); await worker.drain(); await worker.checkSteps();
    expect(jevCalls).toBe(0);
    expect(journal.view.order[0]?.held).toBe('outbound secret refused');
    expect(journal.view.stepChecks.get('answer:telegram:12345678:update:1')?.result).toMatchObject({
      verdict: 'unavailable', reason: 'secret detected in step evidence' });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('dispatches clean raw evidence to Jev after the secret check', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-clean-evidence-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const states: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'Here is the answer:\nSeven.',
      send: async () => 5, checkOutbound: () => {},
      stepCheck: { jev: async state => { states.push(state); return { value: jev(0.01), latencyMs: 1 }; } } });
    worker.startStepChecks(); worker.intake([update(1, 'What is seven?')]); await worker.drain(); await worker.checkSteps();
    expect(states).toHaveLength(1);
    expect(JSON.parse(states[0]!).modelOutput).toBe('Here is the answer:\nSeven.');
    expect(journal.view.stepChecks.get('answer:telegram:12345678:update:1')?.result?.verdict).toBe('pass');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps failed-summary frames in the original shape after disabling a previously enabled observer', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-off-restart-')));
  const path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, genesis);
    createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => 'unused', send: async () => 5, checkOutbound: () => {},
      stepCheck: { jev: async () => ({ value: jev(0.01), latencyMs: 1 }) } }).startStepChecks();
    first.close();

    const second = openPreviewJournal(path, key);
    const frames: string[] = [];
    const append = second.append;
    second.append = row => { frames.push(JSON.stringify(row)); append(row); };
    const worker = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'I changed memory.', people: [], memory: [{ invalid: true }] }) : 'Seven.',
      send: async () => 5, checkOutbound: () => {} });
    worker.intake([update(1, 'What is seven?')]); await worker.drain(); await worker.summarizeIfNeeded(true);
    expect(frames.filter(frame => JSON.parse(frame).kind === 'summary-failed')).toEqual([
      JSON.stringify({ kind: 'summary-failed', through: 1, state: 'complete', failureClass: 'malformed', at: 2000 })]);
    expect(frames.some(frame => JSON.parse(frame).kind === 'step-check-reserve')).toBe(false);
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not check a fixed failure reply when the model produced no answer', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-no-answer-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let jevCalls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => ({ state: 'rejected', failureClass: 'rejected' }),
      send: async () => 5, checkOutbound: () => {},
      stepCheck: { jev: async () => { jevCalls++; return { value: jev(0.01), latencyMs: 1 }; } } });
    worker.startStepChecks(); worker.intake([update(1, 'What happened?')]); await worker.drain(); await worker.checkSteps();
    expect(jevCalls).toBe(0);
    expect(journal.view.stepChecks.size).toBe(0);
    expect(journal.view.order[0]?.sent).toBe(5);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('marks an interrupted reservation unavailable on restart without another Jev request', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-restart-')));
  const path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => 'Done.', send: async () => 5, checkOutbound: () => {},
      stepCheck: { jev: async () => { throw Error('should not reach'); } } });
    worker.startStepChecks(); worker.intake([update(1, 'Please answer.')]); await worker.drain();
    first.append({ kind: 'step-check-reserve', step: 'answer:telegram:12345678:update:1', evidence: '{}', at: 1000 });
    first.close();
    const second = openPreviewJournal(path, key);
    let jevCalls = 0;
    const resumed = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, send: async () => { throw Error('send repeated'); }, checkOutbound: () => {},
      stepCheck: { jev: async () => { jevCalls++; return { value: jev(0.01), latencyMs: 1 }; } } });
    await resumed.checkSteps();
    expect(jevCalls).toBe(0);
    expect(second.view.stepChecks.get('answer:telegram:12345678:update:1')?.result?.verdict).toBe('unavailable');
    expect(second.view.order[0]?.sent).toBe(5);
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not dispatch Jev when stop arrives after the evidence reservation', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'step-stop-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let stopped = false, jevCalls = 0;
    const append = journal.append;
    journal.append = row => { append(row); if (row.kind === 'step-check-reserve') stopped = true; };
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
      model: async () => 'Seven.', send: async () => 5, checkOutbound: () => {},
      stepCheck: { jev: async () => { jevCalls++; return { value: jev(0.01), latencyMs: 1 }; } } });
    worker.startStepChecks(); worker.intake([update(1, 'What is seven?')]); await worker.drain(); await worker.checkSteps();
    expect(jevCalls).toBe(0);
    expect(journal.view.stepChecks.get('answer:telegram:12345678:update:1')?.result?.verdict).toBe('unavailable');
    expect(journal.view.order[0]?.sent).toBe(5);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a malformed score rather than treating it as a pass', () => {
  expect(() => interpretStepJev(jev(Number.NaN), 1)).toThrow('malformed');
});
