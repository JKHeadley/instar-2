import { expect, it, vi } from 'vitest';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn, spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, MODEL_FAILURE_REPLY, UNKNOWN_ANSWER_NOTICE,
  SUMMARY_UNKNOWN_RECOVERY_MS, SUMMARY_MAX_PROMPT_BYTES, SUMMARY_MAX_TURNS, SUMMARY_TARGET_OUTPUT_TOKENS, summaryPromptBytes } from './journal-test-worker.js';
import { INDEX_ATTEMPT_LIMIT, INDEX_BACKLOG_LIMIT, OBLIGATION_FLOOR_PACKET_BYTES as FLOOR_GUIDE, TOO_LONG_INPUT_NOTICE } from './journal.js';
// w3-floorduty (Rules 3, 93): under pressure the obligation guide now yields to its floor form instead of vanishing, so a
// small synthetic limit carries those bytes too; every outcome below is otherwise unchanged.

import { prepareJournalEnvelope } from './journal-envelope.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
// The physical host is an ESM script; this test checks its runtime contract.
// @ts-ignore no declaration for the host script
import { createProductionTelegramIO, productionProviderIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';

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

it('keeps a foreign sender in encrypted intake without revealing their text to the model', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    const contexts: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => { contexts.push(input.context); return 'ok'; },
      send: async () => 1, checkOutbound: () => {} });
    const foreign = update(1, 'private foreign words'); foreign.message.from.id = 99;
    worker.intake([foreign, update(2)]); await worker.drain();
    expect(journal.view.order).toHaveLength(2);
    expect(journal.view.order[0]?.accepted).toBe(false);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).not.toContain('private foreign words');
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('retains an interrupted final frame separately and never accepts it as work', () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const first = world(root); first.worker.intake([update(1)]); first.journal.close();
    appendFileSync(path, Buffer.from([0, 0]));
    const recovered = openPreviewJournal(path, key);
    expect(recovered.view.order).toHaveLength(1);
    expect(existsSync(`${path}.torn-${readFileSync(path).length + 2}`)).toBe(true);
    recovered.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('fsyncs the exact HTML body and expected visible text before dispatch', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let sent: {text:string;expectedText:string} | undefined;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => '<&>', checkOutbound: () => {},
      send: async input => { sent = input; return 5; } });
    worker.intake([update(1)]); await worker.drain();
    expect(sent?.text).toBe('PREVIEW — &lt;&amp;&gt;');
    expect(sent?.expectedText).toBe('PREVIEW — <&>');
    expect(journal.view.order[0]?.intentBody).toBe(sent?.text);
    expect(journal.view.order[0]?.sent).toBe(5);
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it.each([
  ['PREVIEW: answer', 'PREVIEW — answer'],
  ['PREVIEW — answer', 'PREVIEW — answer'],
  ['answer', 'PREVIEW — answer'],
  ['PREVIEW: PREVIEW: answer', 'PREVIEW — PREVIEW: answer'],
  ['PREVIEWING answer', 'PREVIEW — PREVIEWING answer'],
])('adds one runner marker to model answer %s', async (answer, expected) => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let checked = '', sent = '';
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => answer, checkOutbound: text => { checked = text; },
      send: async input => { sent = input.expectedText; return 5; } });
    worker.intake([update(1)]); await worker.drain();
    expect(journal.view.order[0]?.answer).toBe(answer);
    expect(journal.view.order[0]?.intent).toBe(expected);
    expect(checked).toBe(expected);
    expect(sent).toBe(expected);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('persists the exact prepared model input before invoking its route', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: () => 'exact model envelope',
      model: async input => { expect(journal.view.order[0]?.prompt).toBe(input.prepared); return 'answer'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1)]); await worker.drain(); journal.close();
    const recovered = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(recovered.view.order[0]?.prompt).toBe('exact model envelope');
    recovered.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('refuses an oversized prepared prompt before spending a call reservation', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: () => { throw Error('prompt too large'); },
      model: async () => { throw Error('must not invoke'); }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1)]); await worker.drain();
    expect(journal.view.calls).toBe(0);
    expect(journal.view.order[0]?.held).toBe('prompt overflow');
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('falls back to killing the child when process-group kill gets EPERM on timeout', async () => {
  const original = process.kill.bind(process);
  const group = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
    if (pid < 0) throw Object.assign(Error('group refused'), { code: 'EPERM' });
    return original(pid, signal);
  });
  try {
    const result = await productionProviderIO.execute({ executable: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'], cwd: process.cwd(), env: process.env,
      stdin: '', timeout: 20, maxBytes: 1024 });
    expect(result.limited).toBe(true);
    expect(result.localLimit).toBe('timeout');
    expect(group.mock.calls.some(([pid]) => pid < 0)).toBe(true);
  } finally { group.mockRestore(); }
});

it('reports a raw stdout size limit separately from timeout', async () => {
  const result = await productionProviderIO.execute({ executable: process.execPath,
    args: ['-e', "process.stdout.write('x'.repeat(2048))"], cwd: process.cwd(), env: process.env,
    stdin: '', timeout: 5000, maxBytes: 32 });
  expect(result.limited).toBe(true);
  expect(result.localLimit).toBe('size');
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
    expect(physicalCalls).toBe(stage === 'after:reserve' ? 0 : 1);
    expect(physicalSends).toBe(['after:reserve', 'before:answer', 'after:intent'].includes(stage) ? 0 : 1);
    const turn = next.journal.view.order[0]!;
    if (['after:reserve','before:answer'].includes(stage)) {
      expect(turn.reserved).toBe(true);
      expect(turn.answer).toBeUndefined();
      expect(turn.intent).toBeUndefined();
    } else if (['after:intent','before:sent'].includes(stage)) {
      expect(turn.intent).toBe('PREVIEW — first answer');
      expect(turn.sent).toBeUndefined();
    } else expect(turn.sent).toBe(stage === 'after:sent' ? 42 : 43);
    next.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('survives actual SIGKILL before and after every turn-path durable boundary', async () => {
    const stages = ['before:genesis', 'after:genesis', 'before:intake', 'after:intake', 'before:reserve', 'after:reserve', 'during:model',
    'before:answer', 'after:answer', 'before:intent', 'after:intent', 'before:sent', 'after:sent'];
  for (const stage of stages) {
    const root = origin();
    try {
      const child = spawnSync(process.execPath,
        ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-crash-child.mjs', root, stage],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      expect(child.signal, stage).toBe('SIGKILL');
      const modelLog = join(root, 'models.log'), sendLog = join(root, 'sends.log');
      const resumed = world(root, { model: () => { appendFileSync(modelLog, '1\n'); return 'answer'; },
        send: () => { appendFileSync(sendLog, '1\n'); return 2; } });
      resumed.worker.intake([update(1, 'question')]); await resumed.worker.drain();
      expect(resumed.journal.view.order, stage).toHaveLength(1);
      const count = (path: string) => existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').length : 0;
      expect(count(modelLog), stage).toBe(stage === 'after:reserve' ? 0 : 1);
      expect(count(sendLog), stage).toBe(['after:reserve', 'during:model', 'before:answer', 'after:intent'].includes(stage) ? 0 : 1);
      const turn = resumed.journal.view.order[0]!;
      if (['after:reserve', 'during:model', 'before:answer'].includes(stage)) {
        expect(turn.reserved, stage).toBe(true);
        expect(turn.answer, stage).toBeUndefined();
        expect(turn.intent, stage).toBeUndefined();
      } else if (stage === 'after:intent' || stage === 'before:sent') {
        expect(turn.intent, stage).toBe('PREVIEW — answer');
        expect(turn.sent, stage).toBeUndefined();
      } else expect(turn.sent, stage).toBeGreaterThan(0);
      resumed.journal.close();
    } finally { rmSync(root, {recursive:true,force:true}); }
  }
}, 120000);

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

it('sends one fixed checked reply for a definite failure and counts the spent call', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let checks = 0, sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => ({ state: 'rejected', failureClass: 'rejected' }),
      checkOutbound: text => { checks++; expect(text).toBe(`PREVIEW — ${MODEL_FAILURE_REPLY}`); },
      send: async input => { sends++; expect(input.expectedText).toBe(`PREVIEW — ${MODEL_FAILURE_REPLY}`); return 7; } });
    worker.intake([update(1, 'Reply with an exact path')]); await worker.drain(); await worker.drain();
    expect({ checks, sends, calls: journal.view.calls, replies: journal.view.replies }).toEqual({ checks: 1, sends: 1, calls: 1, replies: 1 });
    expect(Object.fromEntries(journal.view.failureClasses)).toEqual({ rejected: 1 });
    expect(Object.fromEntries(journal.view.providerStates)).toEqual({ rejected: 1 });
    expect(journal.view.order[0]?.sent).toBe(7);
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8', timeout: 10000 });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ calls: 1, replies: 1, unknownCalls: 0,
      modelFailureClasses: { rejected: 1 }, modelResultStates: { rejected: 1 } });
    expect(JSON.parse(status.stdout).self).toContain('"rejected":1');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps an uncertain summary reservation across restart without another model call or reply', async () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted'), first = openPreviewJournal(path, key, genesis());
    const id = 'telegram:12345678:update:1';
    first.append({ kind: 'intake', id, update: 1, text: 'question', raw: JSON.stringify(update(1)),
      accepted: true, cursor: 2, at: 1000 });
    first.append({ kind: 'reserve', id, at: 1000 });
    first.append({ kind: 'answer', id, text: 'answer', at: 1000 });
    first.append({ kind: 'intent', id, text: 'PREVIEW — answer', chat: first.view.genesis.chat,
      update: 1, grant: first.view.genesis.grant, at: 1000 });
    first.append({ kind: 'sent', id, message: 1, at: 1000 });
    let calls = 0, sends = 0;
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return { state: 'uncertain' }; }, checkOutbound: () => {},
      send: async () => { sends++; return 2; } });
    await worker.summarizeIfNeeded(true);
    expect({ calls, sends, spent: first.view.calls, pending: first.view.summaryReservations.has(1) })
      .toEqual({ calls: 1, sends: 0, spent: 2, pending: true });
    first.close();
    const second = openPreviewJournal(path, key);
    const resumed = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async () => { calls++; return 'wrong'; }, checkOutbound: () => {},
      send: async () => { sends++; return 3; } });
    await resumed.summarizeIfNeeded(true); await resumed.drain();
    expect({ calls, sends, spent: second.view.calls, pending: second.view.summaryReservations.has(1),
      failures: second.view.summaryFailures.size }).toEqual({ calls: 1, sends: 0, spent: 2, pending: true, failures: 0 });
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never repeats an UNKNOWN call or sends a reply after restart', async () => {
  const root = origin();
  try {
    const first = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('connection lost during call'); },
      checkOutbound: () => {}, send: async () => { throw Error('must not send'); } });
    worker.intake([update(1)]); await worker.drain(); first.close();
    const second = openPreviewJournal(join(root, 'journal.encrypted'), key);
    let calls = 0, sends = 0;
    const resumed = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async () => { calls++; return 'wrong'; }, checkOutbound: () => {},
      send: async () => { sends++; return 1; } });
    await resumed.drain();
    expect({ calls, sends, spent: second.view.calls, answer: second.view.order[0]?.answer }).toEqual({ calls: 0, sends: 0, spent: 1, answer: undefined });
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('records an ended UNKNOWN answer, sends one checked notice, and preserves UNKNOWN accounting', async () => {
  const root = origin();
  try {
    const first = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let calls = 0, sends = 0, checks = 0;
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return { state: 'uncertain' }; },
      checkOutbound: text => { checks++; expect(text).toBe(`PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`); },
      send: async input => { sends++; expect(input.expectedText).toBe(`PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`); return 7; } });
    worker.intake([update(1)]); await worker.drain(); await worker.drain(); first.close();
    const second = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const resumed = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async () => { calls++; return 'wrong'; }, checkOutbound: () => { checks++; },
      send: async () => { sends++; return 8; } });
    await resumed.drain();
    expect({ calls, sends, checks, spent: second.view.calls, replies: second.view.replies })
      .toEqual({ calls: 1, sends: 1, checks: 1, spent: 1, replies: 1 });
    expect(Object.fromEntries(second.view.providerStates)).toEqual({ uncertain: 1 });
    expect(Object.fromEntries(second.view.failureClasses)).toEqual({});
    expect(second.view.order[0]?.answer).toBeUndefined();
    expect(second.view.order[0]).toMatchObject({ modelState: 'uncertain', noticeDueAt: 1000,
      noticeClass: 'unknown-answer', intent: `PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`, sent: 7 });
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8', timeout: 10000 });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ unknownCalls: 1, modelResultStates: { uncertain: 1 },
      modelFailureClasses: {}, replies: 1 });
    expect(JSON.parse(status.stdout).self).toContain('1 turn-model calls and 0 summary-model calls without a durable result (in flight or UNKNOWN)');
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('resumes after durable ended UNKNOWN before notice and never repeats the model call', async () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted');
    let crashed = false, calls = 0, sends = 0;
    const first = openPreviewJournal(path, key, genesis(), stage => {
      if (stage === 'after:model-uncertain' && !crashed) { crashed = true; throw Error('crash after ended call'); }
    });
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return { state: 'uncertain' }; }, checkOutbound: () => {},
      send: async () => { sends++; return 1; } });
    worker.intake([update(1)]); await expect(worker.drain()).rejects.toThrow('crash after ended call'); first.close();
    const second = openPreviewJournal(path, key);
    const resumed = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async () => { calls++; return 'wrong'; }, checkOutbound: () => {},
      send: async () => { sends++; return 9; } });
    await resumed.drain(); await resumed.drain();
    expect({ calls, sends, due: second.view.order[0]?.noticeDueAt, sent: second.view.order[0]?.sent })
      .toEqual({ calls: 1, sends: 1, due: 1000, sent: 9 });
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never redispatches an UNKNOWN notice send after restart', async () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted'), first = openPreviewJournal(path, key, genesis());
    let sends = 0;
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => ({ state: 'uncertain' }), checkOutbound: () => {},
      send: async () => { sends++; return null; } });
    worker.intake([update(1)]); await worker.drain(); first.close();
    const second = openPreviewJournal(path, key);
    const resumed = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('must not call'); }, checkOutbound: () => {},
      send: async () => { sends++; return 8; } });
    await resumed.drain();
    expect({ sends, replies: second.view.replies, sent: second.view.order[0]?.sent,
      intent: second.view.order[0]?.intent }).toEqual({ sends: 1, replies: 1, sent: undefined,
        intent: `PREVIEW — ${UNKNOWN_ANSWER_NOTICE}` });
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds an ended UNKNOWN notice while stop is active', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let stopped = false, sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
      model: async () => { stopped = true; return { state: 'uncertain' }; }, checkOutbound: () => {},
      send: async () => { sends++; return 1; } });
    worker.intake([update(1)]); await expect(worker.drain()).rejects.toThrow('stopped');
    expect({ sends, notice: journal.view.order[0]?.noticeClass, state: journal.view.order[0]?.modelState })
      .toEqual({ sends: 0, notice: undefined, state: 'uncertain' });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not notify while the model invocation is still in flight', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let finish!: (value: { state: 'uncertain' }) => void, sends = 0;
    let started!: () => void;
    const invoking = new Promise<void>(resolve => { started = resolve; });
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: () => new Promise(resolve => { finish = resolve; started(); }), checkOutbound: () => {},
      send: async () => { sends++; return 1; } });
    worker.intake([update(1)]);
    const draining = worker.drain();
    await invoking;
    expect(journal.view.order[0]?.reserved).toBe(true);
    expect(journal.view.order[0]?.answer).toBeUndefined();
    expect(journal.view.order[0]?.noticeClass).toBeUndefined();
    expect(sends).toBe(0);
    finish({ state: 'uncertain' }); await draining;
    expect({ sends, notice: journal.view.order[0]?.noticeClass }).toEqual({ sends: 1, notice: 'unknown-answer' });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('reviews the UNKNOWN notice and distinguishes it from an answer in later history', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let context = '', reviews = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => {
        if (input.id.endsWith(':1')) return { state: 'uncertain' };
        context = input.context; return 'second answer';
      },
      replyCheck: { jev: async () => { throw Error('Jev unavailable'); },
        escalate: async () => { reviews++; return { verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 0 }; },
        elapsedMs: () => 0 },
      checkOutbound: () => {}, send: async () => 1 });
    worker.intake([update(1)]); await worker.drain();
    worker.intake([update(2)]); await worker.drain();
    const history = JSON.parse(context).history;
    expect(history[0]).toMatchObject({ user: 'question 1', answer: null,
      notice: UNKNOWN_ANSWER_NOTICE, outcome: 'loss notice delivered; model UNKNOWN' });
    expect(reviews).toBe(2);
    expect(journal.view.calls).toBe(4); // two answers, two separately reserved reply reviews
    expect(Object.fromEntries(journal.view.providerStates)).toEqual({ uncertain: 1, complete: 1 });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('sends the loss notice despite a review objection and labels it truthfully in later history', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let context = '';
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => {
        if (input.id.endsWith(':1')) return { state: 'uncertain' };
        context = input.context; return 'second answer';
      },
      replyCheck: { jev: async () => { throw Error('Jev unavailable'); },
        escalate: async input => input.endsWith('Please send it again.')
          ? { verdict: 'violation', ruleIds: ['parks_on_user'], confidence: 1, latencyMs: 0 }
          : { verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 0 },
        elapsedMs: () => 0 },
      checkOutbound: () => {}, send: async () => 1 });
    worker.intake([update(1)]); await worker.drain();
    worker.intake([update(2)]); await worker.drain();
    const history = JSON.parse(context).history;
    expect(history[0]).toMatchObject({ user: 'question 1', answer: null,
      notice: 'I lost my answer to that message. Please send it again.',
      outcome: 'loss notice delivered; model UNKNOWN' });
    expect(journal.view.order[0]?.release).toMatchObject({ review: 'violation', objections: ['parks_on_user'] });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('replays a content-free subscription review state after its reservation', () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted');
    const first = openPreviewJournal(path, key, genesis());
    const id = 'telegram:12345678:update:1';
    first.append({ kind: 'intake', id, update: 1, text: 'question', raw: JSON.stringify(update(1)),
      accepted: true, cursor: 2, at: 1000 });
    first.append({ kind: 'reserve', id, at: 1000 });
    first.append({ kind: 'answer', id, text: MODEL_FAILURE_REPLY, state: 'rejected', failureClass: 'rejected', at: 1000 });
    first.append({ kind: 'reply-review-reserve', id, candidate: `PREVIEW — ${MODEL_FAILURE_REPLY}`, at: 1000 });
    first.append({ kind: 'reply-review-state', id, state: 'complete', at: 1000 });
    first.close();
    const second = openPreviewJournal(path, key);
    expect(Object.fromEntries(second.view.providerStates)).toEqual({ rejected: 1, complete: 1 });
    expect(second.view.calls).toBe(2);
    expect(second.view.order[0]?.reviewState).toBe('complete');
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('resumes a durable definite failure after restart and sends exactly once', async () => {
  const root = origin();
  try {
    let tripped = false, sends = 0, calls = 0;
    const first = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(), stage => {
      if (stage === 'after:answer' && !tripped) { tripped = true; throw Error('crash after durable failure'); }
    });
    const worker = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return { state: 'complete', failureClass: 'malformed' }; },
      checkOutbound: () => {}, send: async () => { sends++; return 1; } });
    worker.intake([update(1)]); await expect(worker.drain()).rejects.toThrow('crash after durable failure'); first.close();
    const second = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const resumed = createJournalWorker(second, { now: () => 2000, stopped: () => false,
      model: async () => { calls++; return 'wrong'; }, checkOutbound: () => {},
      send: async () => { sends++; return 9; } });
    await resumed.drain(); await resumed.drain();
    expect({ calls, sends, spent: second.view.calls, failures: Object.fromEntries(second.view.failureClasses) })
      .toEqual({ calls: 2, sends: 1, spent: 2, failures: { malformed: 2 } }); // the miss, then its one format re-ask, both refused
    expect(second.view.order[0]?.answerRetried).toBe(true);
    expect(second.view.order[0]?.intent).toBe(`PREVIEW — ${MODEL_FAILURE_REPLY}`);
    expect(second.view.order[0]?.sent).toBe(9);
    second.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds ordinary work at the attempt cap while bounded intake stays open for status', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(1), maxReplies: 2, maxTurns: 5 });
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return 'ok'; }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1), update(2)]); await worker.drain();
    expect(calls).toBe(1);
    expect(journal.view.order[1]?.held).toBe('call cap');
    expect(() => worker.pollGate()).not.toThrow();
    expect(journal.view.stop).toBeNull();
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('raises finite caps with recorded authority, preserves counters, and resumes a cap-held turn', async () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { ...genesis(1), maxReplies: 1, maxTurns: 2 });
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1), update(2)]); await worker.drain();
    expect(journal.view.calls).toBe(1);
    expect(journal.view.order[1]?.held).toBe('call cap');
    // Rule 15: a reached turn allowance no longer stops reading; the minimal reserve continues.
    expect(() => worker.pollGate()).not.toThrow();
    expect(journal.view.order[1]?.limited?.reason).toBe('calls');
    expect(() => journal.append({ kind:'caps', genesisHash:'wrong', maxCalls:3, maxReplies:3,
      maxTurns:4, authority:'Justin topic 52075', at:1001 })).toThrow('authority');
    expect(journal.view.limits.maxCalls).toBe(1);
    raiseJournalCaps(journal, { maxCalls: 3, maxReplies: 3, maxTurns: 4,
      authority: 'Justin topic 52075 2026-09-25 16:25 PDT', at: 1001 });
    expect(journal.view.calls).toBe(1);
    await worker.drain();
    expect(journal.view.calls).toBe(2);
    expect(journal.view.replies).toBe(2);
    expect(journal.view.order[1]?.sent).toBe(1);
    expect(() => raiseJournalCaps(journal, { maxCalls: 2, maxReplies: 4, maxTurns: 4,
      authority: 'same', at: 1002 })).toThrow();
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.limits).toEqual({ maxCalls: 3, maxReplies: 3, maxTurns: 4, maxBytes: genesis().maxBytes });
    expect(reopened.view.calls).toBe(2);
    expect(reopened.view.replies).toBe(2);
    reopened.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('refuses a cap raise while a model call is UNKNOWN', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(1));
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('lost'); }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1)]); await worker.drain();
    expect(() => raiseJournalCaps(journal, { maxCalls: 2, maxReplies: 101, maxTurns: 101,
      authority: 'Justin topic 52075', at: 1001 })).toThrow('UNKNOWN');
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('durably latches observed expiry while refusing non-operator stop requests', () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis(), expires: 999 });
    let now = 998;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    expect(() => worker.gate()).not.toThrow();
    expect(() => worker.pollGate()).not.toThrow();
    now = 999; // Equality is already expired, not one tick later.
    expect(() => worker.gate()).toThrow('stopped');
    expect(() => worker.pollGate()).toThrow('stopped');
    expect(journal.view.stop).toBe('trial expired');
    now = 998; // The durable latch survives a clock moving back.
    expect(() => worker.gate()).toThrow('stopped');
    expect(() => worker.pollGate()).toThrow('stopped');
    expect(() => worker.stop('transport-breaker')).toThrow('only operator stop');
    expect(journal.view.stop).toBe('trial expired');
    journal.close();
    const replay = openPreviewJournal(join(root, 'journal.encrypted'), key);
    try { expect(replay.view.stop).toBe('trial expired'); } finally { replay.close(); }
  } finally { rmSync(root, {recursive:true,force:true}); }
});

// Six sequential loader processes need a wider total deadline than one child process.
it('the cap command requires the exclusive writer lease and reports the recorded limits', () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(1));
  const context = { site: 'preview.journal', preserved: 'preview:test', register: {
    generation: { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'preview:register' },
    entries: ['preview.journal'], sites: { 'preview.journal': 'closed' as const } } };
  const lease = openProductionStorage({ root: join(root, '.writer'), machine: 'preview-local-machine', key,
    policy: 'preview-journal', store: 'preview-journal', context, io: productionStorageIO });
  let leaseClosed = false;
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') };
  const command = (name: string, extra: string[] = []) => spawnSync(process.execPath,
    ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs',name,
      '--root',root,...extra], {cwd:process.cwd(),env,encoding:'utf8',timeout:10000});
  const caps = ['--max-calls','3','--max-replies','101','--max-turns','101','--max-context-bytes','524288',
    '--authority','Justin verified operator, topic 52075, 2026-09-25 16:25 PDT'];
  try {
    expect(lease.kind).toBe('Success');
    expect(command('raise-caps',caps).status).not.toBe(0);
    expect(journal.view.limits.maxCalls).toBe(1);
    if (lease.kind === 'Success') { lease.value.close(); leaseClosed = true; }
    expect(command('raise-caps',caps).status).toBe(0);
    const report = command('status');
    expect(report.status).toBe(0);
    expect(JSON.parse(report.stdout)).toMatchObject({calls:0, replies:0,
      limits:{maxCalls:3,maxReplies:101,maxTurns:101,maxBytes:524288},capAuthority:caps.at(-1)});
    expect(command('raise-caps',caps).status).not.toBe(0);
    expect(command('raise-caps',['--max-context-bytes','1048576','--authority','Justin second recorded raise']).status).toBe(0);
    expect(JSON.parse(command('status').stdout).limits.maxBytes).toBe(1048576);
  } finally { journal.close(); if (lease.kind === 'Success' && !leaseClosed) lease.value.close();
    rmSync(root,{recursive:true,force:true}); }
}, 70_000);

it('holds a prepared answer when the reply cap is exhausted and gives it one limited answer from the reserve', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(2), maxReplies: 1, maxTurns: 5 });
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'ok', send: async () => { sends++; return 1; }, checkOutbound: () => {} });
    worker.intake([update(1), update(2)]); await worker.drain();
    expect(journal.view.calls).toBe(2);
    expect(sends).toBe(2);
    expect(journal.view.replies).toBe(1);
    expect(journal.view.order[1]?.answer).toBe('ok');
    expect(journal.view.order[1]?.held).toBe('reply cap');
    expect(journal.view.order[1]?.limited?.reason).toBe('replies');
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('notifies about context overflow with originals intact when no current summary can cover it', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis(), maxBytes: 128 });
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return 'ok'; }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'never drop this original')]); await worker.drain();
    expect(calls).toBe(0);
    expect(journal.view.order[0]?.text).toBe('never drop this original');
    expect(journal.view.order[0]?.intent).toBe(TOO_LONG_INPUT_NOTICE);
    expect(journal.view.order[0]?.sent).toBe(1);
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('falls back to a current summary when the complete prepared prompt overflows, and reports holds', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(), maxBytes: 34000 });
    journal.append({kind:'intake',id:'telegram:12345678:update:1',update:1,text:'a'.repeat(23500),
      raw:JSON.stringify(update(1)),accepted:true,cursor:2,at:1000});
    journal.append({kind:'reserve',id:'telegram:12345678:update:1',at:1000});
    journal.append({kind:'answer',id:'telegram:12345678:update:1',text:'old answer',at:1000});
    journal.append({kind:'summary-reserve',through:1,at:1000});
    journal.append({kind:'summary',through:1,text:'Earlier long turn: ORCHID.',at:1000});
    journal.append({kind:'intake',id:'telegram:12345678:update:2',update:2,text:'b'.repeat(5000),
      raw:JSON.stringify(update(2)),accepted:true,cursor:3,at:1000});
    journal.append({kind:'reserve',id:'telegram:12345678:update:2',at:1000});
    journal.append({kind:'answer',id:'telegram:12345678:update:2',text:'recent answer',at:1000});
    let full = 0, compact = 0, invoked = 0;
    const worker = createJournalWorker(journal, {now:()=>1000,stopped:()=>false,
      prepareModel: input => { const size = Buffer.byteLength(input.context);
        if (input.context.includes('"historyMode":"complete"')) full = size; else compact = size;
        if (size + 2870 > 34000) throw Error('complete prompt overflow'); return input.context; },
      model: async input => { invoked++; expect(input.context).toContain('ORCHID'); return 'yes'; },
      send: async()=>1,checkOutbound:()=>{} });
    worker.intake([update(3,'what was first?')]); await worker.drain();
    expect(full).toBeGreaterThan(0);
    // cint-2: cbuild-4's obligation guide and cbuild-2's summary decision and search ride this compact packet together (measured 10514).
    // cint-L2 with the live repair's capabilities key merged: measured 10491 (occam's removals offset the addition).
    // w3-recallrank: the lookup marker (`memoryLookup:"offered"`, 25 bytes) rides this compact operator packet: measured 10774.
    // w4-memlearn-s (repair round 1, cint-L44): the memory-failure offer (`memoryFailureDecision` + `searchedTurn`, 439 bytes)
    // rides every operator turn whose previous answered turn here was the operator's, so it rides this one: measured 11213.
    // It is the lowest-priority guidance and yields first under byte pressure, so it never displaces what this packet carried.
    expect(compact).toBeLessThan(11240);
    expect(invoked).toBe(1);
    expect(journal.view.order[2]?.sent).toBe(1);
    journal.append({kind:'hold',id:'telegram:12345678:update:2',reason:'review needed',at:1000});
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env:{...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(key).toString('hex')},encoding:'utf8',timeout:10000});
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout).holds).toEqual([]); // update 2 already has send custody
  } finally { rmSync(root,{recursive:true,force:true}); }
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
}, 30_000); // 60 real turns with two restarts measured 9.0 s of the 10 s default in the full affected run
// on a loaded host; the per-turn p95 and flat-cost assertions above are the real bounds and are unchanged.

it('uses rolling summaries only after replies, shares the attempt cap, and retains original text', async () => {
  const root = origin();
  try {
    const initial = { ...genesis(), maxBytes: 4000 + FLOOR_GUIDE };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, initial);
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:') ? 'The first unique memory was ORCHID.'
        : JSON.stringify({ reply: 'ok', memory: [], dated: [] }),
      send: async () => 1, checkOutbound: () => {} });
    for (let i = 0; i < 12; i++) {
      worker.intake([update(i + 1, i === 0 ? 'ORCHID is the first unique memory.' : `turn ${i} ${'a'.repeat(450)}`)]);
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

it('bounds each rolling chunk by measured prepared prompt bytes and reported output tokens', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(64), maxBytes: 131072, maxTurns: 30 });
    for (let n = 1; n <= 20; n++) {
      const id = `telegram:12345678:update:${n}`, message = `turn ${n}: ${'a'.repeat(1600)}`;
      journal.append({ kind: 'intake', id, update: n, text: message, raw: JSON.stringify(update(n, message)),
        accepted: true, cursor: n + 1, at: 1000 });
      journal.append({ kind: 'reserve', id, at: 1000 });
      journal.append({ kind: 'answer', id, text: `answer ${n}`, at: 1000 });
      journal.append({ kind: 'intent', id, text: `PREVIEW — answer ${n}`, chat: journal.view.genesis.chat,
        update: n, grant: journal.view.genesis.grant, at: 1000 });
      journal.append({ kind: 'sent', id, message: n, at: 1000 });
    }
    const measurements: { promptBytes: number; historyTurns: number; outputTokens: number }[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', journal.view.genesis.grant,
        1000, journal.view.limits.maxBytes),
      model: async input => {
        expect(input.question).toContain(`${SUMMARY_TARGET_OUTPUT_TOKENS} output tokens`);
        const promptBytes = Buffer.byteLength(input.prepared!) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
        const historyTurns = (JSON.parse(input.context) as { history: unknown[] }).history.length;
        const outputTokens = 800; // the offline provider's reported usage
        measurements.push({ promptBytes, historyTurns, outputTokens });
        return { state: 'complete' as const, text: JSON.stringify({ summary: 'Earlier turns remain in the journal.', people: [] }),
          usage: { inputTokens: 4000, outputTokens, charge: null } };
      }, send: async () => 1, checkOutbound: () => {} });
    await worker.summarizeIfNeeded();
    expect(journal.view.summaries.length).toBeGreaterThan(0); // raised reply cap must not defer all summaries
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries.at(-1)?.through).toBe(20);
    expect(measurements.length).toBeGreaterThan(1);
    expect(measurements.every(item => item.historyTurns <= SUMMARY_MAX_TURNS
      && item.promptBytes <= SUMMARY_MAX_PROMPT_BYTES && item.outputTokens <= SUMMARY_TARGET_OUTPUT_TOKENS)).toBe(true);
    // A raised root raises the provider's prompt bound to its own limit (the launcher's raisedPromptBytes); the summary
    // ceiling is three quarters of it.
    expect(Math.max(...measurements.map(item => item.promptBytes))).toBeLessThanOrEqual(summaryPromptBytes(journal.view.limits.maxBytes));
    expect(summaryPromptBytes(journal.view.limits.maxBytes)).toBeLessThan(journal.view.limits.maxBytes);
    expect(journal.view.summaries.map(item => item.usage?.outputTokens)).toEqual(measurements.map(item => item.outputTokens));
    expect(journal.view.order[0]?.text).toContain('turn 1:');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds a single turn beyond the summary budget before reserving a provider call', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(4), maxBytes: 131072 });
    const id = 'telegram:12345678:update:1', message = `ORCHID ${'x'.repeat(SUMMARY_MAX_PROMPT_BYTES)}`;
    journal.append({ kind: 'intake', id, update: 1, text: message, raw: JSON.stringify(update(1, message)),
      accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1000 });
    journal.append({ kind: 'answer', id, text: 'old answer', at: 1000 });
    journal.append({ kind: 'intent', id, text: 'PREVIEW — old answer', chat: journal.view.genesis.chat,
      update: 1, grant: journal.view.genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id, message: 1, at: 1000 });
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return 'summary'; }, send: async () => 2, checkOutbound: () => {} });
    await worker.summarizeIfNeeded(true);
    expect(calls).toBe(0);
    expect(journal.view.order[0]?.held).toBe('summary oversized turn');
    expect(journal.view.order[0]?.text).toBe(message);
    expect(journal.view.summaryReservations.size).toBe(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('uses a smaller prefix when prepared framing exceeds the summary budget', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(6), maxBytes: 131072 });
    for (let n = 1; n <= 2; n++) {
      const id = `telegram:12345678:update:${n}`;
      journal.append({ kind: 'intake', id, update: n, text: `turn ${n}`, raw: JSON.stringify(update(n)),
        accepted: true, cursor: n + 1, at: 1000 });
      journal.append({ kind: 'reserve', id, at: 1000 });
      journal.append({ kind: 'answer', id, text: 'answer', at: 1000 });
      journal.append({ kind: 'intent', id, text: 'PREVIEW — answer', chat: journal.view.genesis.chat,
        update: n, grant: journal.view.genesis.grant, at: 1000 });
      journal.append({ kind: 'sent', id, message: n, at: 1000 });
    }
    const called: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => input.id === 'summary:2' ? 'x'.repeat(SUMMARY_MAX_PROMPT_BYTES) : input.context,
      model: async input => { called.push(input.id); return 'Earlier turns retained.'; },
      send: async () => 3, checkOutbound: () => {} });
    await worker.summarizeIfNeeded(true);
    expect(called).toEqual(['summary:1']);
    expect(journal.view.summaries.map(item => item.through)).toEqual([1]);
    expect(journal.view.summaryReservations.size).toBe(0);
    expect(journal.view.order[1]?.text).toBe('turn 2');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('rolls an unsummarized live-shaped history forward and drains older overflow holds in order', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(64), maxBytes: 32768, maxTurns: 30, maxReplies: 30 });
    for (let n = 1; n <= 20; n++) {
      const id = `telegram:12345678:update:${n}`;
      const text = n === 1 ? `ORCHID ${'a'.repeat(4000)}` : n <= 10 ? `turn ${n} ${'b'.repeat(4000)}` : `turn ${n}`;
      journal.append({ kind: 'intake', id, update: n, text, raw: JSON.stringify(update(n, text)),
        accepted: true, cursor: n + 1, at: 1000 });
      journal.append({ kind: 'reserve', id, at: 1000 });
      journal.append({ kind: 'answer', id, text: `answer ${n}`, at: 1000 });
      journal.append({ kind: 'intent', id, text: `PREVIEW — answer ${n}`, chat: journal.view.genesis.chat,
        update: n, grant: journal.view.genesis.grant, at: 1000 });
      journal.append({ kind: 'sent', id, message: n, at: 1000 });
    }
    for (let n = 21; n <= 22; n++) {
      const id = `telegram:12345678:update:${n}`, text = `held question ${n}`;
      journal.append({ kind: 'intake', id, update: n, text, raw: JSON.stringify(update(n, text)),
        accepted: true, cursor: n + 1, at: 1000 });
      journal.append({ kind: 'hold', id, reason: n === 21 ? 'prompt overflow' : 'summary unavailable: context overflow', at: 1000 });
    }
    const seen: string[] = [], frontiers: number[] = [], sends: number[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => {
        if (Buffer.byteLength(input.context) + 1800 > journal.view.limits.maxBytes) throw Error('prompt overflow');
        return input.context;
      },
      model: async input => {
        seen.push(input.id);
        if (input.id.startsWith('summary:')) {
          frontiers.push(Number(input.id.slice(8)));
          return 'ORCHID was named at the start; later turns continued the conversation.';
        }
        expect(input.context).toContain('ORCHID');
        return `reply ${input.question}`;
      },
      send: async input => { sends.push(input.update); return input.update; }, checkOutbound: () => {} });
    await worker.drain();
    expect(frontiers.length).toBeGreaterThan(1);
    expect(frontiers).toContain(20);
    expect(frontiers).toEqual(frontiers.slice().sort((a, b) => a - b));
    expect(seen.filter(id => !id.startsWith('summary:'))).toEqual([
      'telegram:12345678:update:21', 'telegram:12345678:update:22']);
    expect(sends).toEqual([21, 22]);
    expect(journal.view.order.slice(20).map(turn => turn.held)).toEqual([undefined, undefined]);
    expect(journal.view.order[0]?.text).toContain('ORCHID');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('raises context bytes through the cap frame and uses the replayed limit for a held turn', async () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, { ...genesis(3), maxBytes: 1100 });
    first.append({ kind: 'intake', id: 'telegram:12345678:update:1', update: 1,
      text: `ORCHID ${'x'.repeat(1200)}`, raw: JSON.stringify(update(1)), accepted: true, cursor: 2, at: 1000 });
    first.append({ kind: 'hold', id: 'telegram:12345678:update:1', reason: 'prompt overflow', at: 1000 });
    expect(() => raiseJournalCaps(first, { maxCalls: 3, maxReplies: 100, maxTurns: 100,
      maxBytes: 1099, authority: 'Justin recorded raise', at: 1001 })).toThrow('monotonic');
    raiseJournalCaps(first, { maxCalls: 3, maxReplies: 100, maxTurns: 100,
      maxBytes: 8192, authority: 'Justin recorded raise', at: 1001 });
    first.close();
    const journal = openPreviewJournal(path, key);
    expect(journal.view.limits.maxBytes).toBe(8192);
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => 1002, stopped: () => false,
      model: async () => { calls++; return 'ok'; }, send: async () => 1, checkOutbound: () => {} });
    await worker.drain();
    expect(calls).toBe(1);
    expect(journal.view.order[0]?.sent).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('prepares a raised subscription envelope above the former 32 KB ceiling', () => {
  const input = { id: 'telegram:12345678:update:1', question: 'remember this?',
    context: JSON.stringify({ history: [{ user: 'x'.repeat(40000) }] }) };
  expect(() => prepareJournalEnvelope(input, 'claude-opus-5-5', 'grant:preview', 1000)).toThrow('overflow');
  const prepared = prepareJournalEnvelope(input, 'claude-opus-5-5', 'grant:preview', 1000, 131072);
  expect(Buffer.byteLength(prepared)).toBeGreaterThan(32768);
  expect(Buffer.byteLength(prepared)).toBeLessThan(131072);
});

it('shows an oversized historical turn and clears that marker after an authorized envelope raise', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(8), maxBytes: 1100 });
    const id = 'telegram:12345678:update:1';
    journal.append({ kind: 'intake', id, update: 1, text: `ORCHID ${'x'.repeat(1600)}`,
      raw: JSON.stringify(update(1)), accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1000 });
    journal.append({ kind: 'answer', id, text: 'old answer', at: 1000 });
    journal.append({ kind: 'intent', id, text: 'PREVIEW — old answer', chat: journal.view.genesis.chat,
      update: 1, grant: journal.view.genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id, message: 1, at: 1000 });
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:') ? 'The operator named ORCHID.' : 'ok',
      send: async () => 2, checkOutbound: () => {} });
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries).toHaveLength(0);
    expect(journal.view.order[0]?.held).toBe('summary oversized turn');
    expect(journal.view.order[0]?.text).toContain('ORCHID');
    raiseJournalCaps(journal, { maxCalls: 8, maxReplies: 100, maxTurns: 100,
      maxBytes: 8192, authority: 'Justin recorded raise', at: 1001 });
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries.at(-1)?.through).toBe(1);
    expect(journal.view.order[0]?.held).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a lost summary UNKNOWN after restart and never repeats it', async () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, { ...genesis(4), maxBytes: 32768 });
    const w = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    w.intake([update(1, 'remember the ORCHID')]); await w.drain();
    first.append({ kind: 'summary-reserve', through: 1, at: 1000 }); first.close();
    const journal = openPreviewJournal(path, key);
    let summaries = 0;
    const worker = createJournalWorker(journal, { now: () => 1001, stopped: () => false,
      model: async input => { if (input.id.startsWith('summary:')) { summaries++; throw Error('timeout'); } return 'ok'; },
      send: async () => 2, checkOutbound: () => {} });
    expect(journal.view.summaryReservations.size).toBe(1);
    expect(journal.view.summaryFailures.get(1)).toBeUndefined();
    await worker.summarizeIfNeeded(); // under the background threshold
    await worker.summarizeIfNeeded(true);
    await worker.summarizeIfNeeded(true);
    expect(summaries).toBe(0);
    expect(journal.view.calls).toBe(2);
    expect(journal.view.summaryReservations.size).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('starts a later summary only after the UNKNOWN pause, without releasing its charge or cap-raise refusal', async () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, { ...genesis(5), maxBytes: 32768 });
    const initial = createJournalWorker(first, { now: () => 1000, stopped: () => false,
      model: async () => 'answer', send: async () => 1, checkOutbound: () => {} });
    initial.intake([update(1, 'remember ORCHID')]); await initial.drain();
    first.append({ kind: 'summary-reserve', through: 1, at: 1000 }); first.close();

    const journal = openPreviewJournal(path, key);
    let now = 1000, summaryCalls: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { if (input.id.startsWith('summary:')) summaryCalls.push(input.id); return 'answer'; },
      send: async () => 2, checkOutbound: () => {} });
    now += SUMMARY_UNKNOWN_RECOVERY_MS;
    await worker.summarizeIfNeeded(true); // Time alone cannot retry the same frontier.
    expect(summaryCalls).toEqual([]);
    worker.intake([update(2, 'What did I ask you to remember?')]); await worker.drain();
    now--;
    await worker.summarizeIfNeeded(true);
    expect(summaryCalls).toEqual([]);
    now++;
    await worker.summarizeIfNeeded(true);
    expect(summaryCalls).toEqual(['summary:2']);
    expect(journal.view.summaries.map(item => item.through)).toEqual([2]);
    expect(journal.view.summaryReservations.has(1)).toBe(true);
    expect(journal.view.summaryReservations.has(2)).toBe(false);
    expect(journal.view.calls).toBe(4); // two answers, charged UNKNOWN, later summary
    expect(() => raiseJournalCaps(journal, { maxCalls: 6, maxReplies: 101, maxTurns: 101,
      authority: 'Justin topic 52075', at: now + 1 })).toThrow('UNKNOWN');
    journal.close();
    const replayed = openPreviewJournal(path, key);
    expect(replayed.view.calls).toBe(4);
    expect(replayed.view.summaryReservations.has(1)).toBe(true);
    expect(replayed.view.summaries.map(item => item.through)).toEqual([2]);
    replayed.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('waits again after a second UNKNOWN summary and never spends beyond the call cap', async () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { ...genesis(7), maxBytes: 32768 });
    let now = 1000;
    const seen: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { if (input.id.startsWith('summary:')) { seen.push(input.id); throw Error('lost'); }
        return 'answer'; }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1)]); await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 1, at: now });
    now += SUMMARY_UNKNOWN_RECOVERY_MS;
    worker.intake([update(2)]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(seen).toEqual(['summary:2']);
    expect(journal.view.summaryReservations.size).toBe(2);
    worker.intake([update(3)]); await worker.drain();
    now += SUMMARY_UNKNOWN_RECOVERY_MS - 1;
    await worker.summarizeIfNeeded(true);
    expect(seen).toEqual(['summary:2']);
    now++;
    await worker.summarizeIfNeeded(true);
    expect(seen).toEqual(['summary:2', 'summary:3']);
    worker.intake([update(4)]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(seen).toEqual(['summary:2', 'summary:3']); // finite cap, no fourth summary
    expect(journal.view.calls).toBe(7);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never re-dispatches an UNKNOWN frontier, and past its recovery pause it no longer floors other spans', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(8), maxBytes: 32768 });
    let now = 1000;
    const summaries: string[] = [];
    const prepared: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      prepareModel: input => { if (input.id.startsWith('summary:')) prepared.push(input.id);
        if (input.id === 'summary:3') throw Error('prompt overflow');
        return input.context; },
      model: async input => { if (input.id.startsWith('summary:')) summaries.push(input.id); return 'answer'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1), update(2)]); await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 2, at: now });
    worker.intake([update(3)]); await worker.drain();
    now += SUMMARY_UNKNOWN_RECOVERY_MS;
    const calls = journal.view.calls;
    await worker.summarizeIfNeeded(true);
    // The later prompt overflows; the span before the UNKNOWN is summarized instead of waiting for a later frontier,
    // which a prompt that only grows with its span could never offer (w3-summaryfit). The UNKNOWN keeps its charge.
    expect(prepared).toContain('summary:3');
    expect(prepared).not.toContain('summary:2');
    expect(summaries).toEqual(['summary:1']);
    expect(journal.view.calls).toBe(calls + 1);
    expect(journal.view.summaryReservations.has(2)).toBe(true);
    worker.intake([update(4)]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(summaries).toEqual(['summary:1', 'summary:4']);
    expect(journal.view.summaries.map(item => item.through)).toEqual([1, 4]);
    expect(journal.view.summaryReservations.has(2)).toBe(true);
    expect(prepared).not.toContain('summary:2');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('retries a definitely failed summary and an overflow-held turn automatically', async () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, { ...genesis(4), maxBytes: 32768 });
    const id = 'telegram:12345678:update:1';
    first.append({kind:'intake',id,update:1,text:'ORCHID '+ 'a'.repeat(19000),
      raw:JSON.stringify(update(1)),accepted:true,cursor:2,at:1000});
    first.append({kind:'reserve',id,at:1000}); first.append({kind:'answer',id,text:'old answer',at:1000});
    first.append({kind:'intent',id,text:'PREVIEW — old answer',chat:first.view.genesis.chat,
      update:1,grant:first.view.genesis.grant,at:1000});
    first.append({kind:'sent',id,message:1,at:1000});
    first.append({kind:'summary-reserve',through:1,at:1000});
    first.append({kind:'summary-failed',through:1,state:'rejected',failureClass:'rejected',at:1000});
    first.append({kind:'intake',id:'telegram:12345678:update:2',update:2,text:'What was the name?',
      raw:JSON.stringify(update(2)),accepted:true,cursor:3,at:1000});
    first.append({kind:'hold',id:'telegram:12345678:update:2',reason:'summary unavailable: prompt overflow',at:1000});
    first.close();
    const journal = openPreviewJournal(path, key);
    const seen: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1001, stopped: () => false,
      prepareModel: input => { if (Buffer.byteLength(input.context) + (input.id.startsWith('summary:') ? 500 : 16000) > 32768)
        throw Error('prompt overflow'); return input.context; },
      model: async input => { seen.push(input.id); return input.id.startsWith('summary:') ? 'Earlier the operator named ORCHID.' : 'answer'; },
      send: async () => 2, checkOutbound: () => {} });
    expect(journal.view.order[1]?.held).toBe('summary unavailable: prompt overflow');
    await worker.summarizeIfNeeded(true);
    await worker.drain();
    expect(journal.view.summaries).toHaveLength(1);
    expect(journal.view.summaryReservations.size).toBe(0);
    expect(journal.view.order[1]?.sent).toBe(2);
    expect(seen).toEqual(['summary:1','telegram:12345678:update:2']);
    journal.close();
    // Replayed from disk, the released hold is no longer reported: status lists only turns held now.
    const replayed = openPreviewJournal(path, key);
    expect(replayed.view.order[1]?.held).toBeUndefined(); replayed.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env:{...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(key).toString('hex')},encoding:'utf8',timeout:10000});
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).holds).toEqual([]);
    expect(JSON.parse(status.stdout).self).toContain('Held messages: none.');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['summary', 'failed', 'preflight', 'last-call'] as const)('answers over-budget history: with a summary when one can be made, with the oldest set aside when not; route=%s', async route => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(route === 'last-call' ? 2 : 4), maxBytes: 32768 });
    const id = 'telegram:12345678:update:1';
    journal.append({kind:'intake',id,update:1,text:'ORCHID '+ 'a'.repeat(19000),
      raw:JSON.stringify(update(1)),accepted:true,cursor:2,at:1000});
    journal.append({kind:'reserve',id,at:1000});
    journal.append({kind:'answer',id,text:'old answer',at:1000});
    journal.append({kind:'intent',id,text:'PREVIEW — old answer',chat:journal.view.genesis.chat,
      update:1,grant:journal.view.genesis.grant,at:1000});
    journal.append({kind:'sent',id,message:1,at:1000});
    const seen: { id: string; context: string }[] = [];
    let summaryAttempts = 0;
    let summaryPrepares = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => { if (input.id.startsWith('summary:')) {
          summaryPrepares++;
          if (route === 'preflight') throw Error('summary prompt unavailable');
        }
        const extra = input.id.startsWith('summary:') ? 500 : 16000;
        if (Buffer.byteLength(input.context) + extra > 32768) throw Error('prompt overflow');
        return input.context; },
      model: async input => { seen.push(input);
        if (input.id.startsWith('summary:')) {
          summaryAttempts++;
          if (route === 'failed' && summaryAttempts === 1) return { state: 'rejected', failureClass: 'rejected' } as const;
          return 'Earlier the operator named ORCHID.';
        }
        return 'answer'; },
      send: async () => 2, checkOutbound: () => {} });
    worker.intake([update(2, 'What was the name?')]); await worker.drain();
    const turn = journal.view.order[1]!;
    // Every route answers now. A summary is still preferred and still asked for first; where one cannot be made,
    // the reachability floor sets the over-budget history aside rather than holding the reply (Rules 15, 95).
    expect(turn.sent).toBe(2);
    expect(turn.held).toBeUndefined();
    expect(journal.view.summaryReservations.size).toBe(0);
    const packet = JSON.parse(seen.find(item => item.id === turn.id)!.context) as { historyMode: string;
      summary?: { text: string }; historySetAside?: { count: number; through: number } };
    if (route === 'summary') {
      // The summary carries the over-budget message, so no history has to be set aside at all.
      expect(packet.historyMode).toBe('summary-plus-recent');
      expect(packet.summary!.text).toContain('ORCHID');
      expect(packet.historySetAside).toBeUndefined();
      expect(journal.view.calls).toBe(3);
    } else {
      // No summary could be made on this pass: the writer refused it (failed), its prompt could not be prepared
      // (preflight), or the call allowance left no room to ask (last-call). The answer goes out either way, with
      // the gap stated in the packet and the message itself untouched in the journal.
      expect(packet.historyMode).toBe('recent-only');
      expect(packet.historySetAside).toEqual({ count: 1, through: 1, note: expect.stringContaining('kept and still searchable') });
      // Rule 110: the sent reply accounts for the set-aside truthfully (kept, unsummarized) and the last inbound's outcome.
      expect(turn.continuity).toMatchObject({ summarizedThrough: 1, basis: 'set-aside', disposition: 'addressed' });
      expect(turn.intent).toMatch(/^PREVIEW — Earlier conversation up to #1 no longer fits in my view; it is kept and I can search it, but it is not summarized; /u);
      // The spend floor is unchanged: no extra call is spent to answer with less, and a refused span keeps its
      // second attempt for a later pass rather than being burned here.
      expect(journal.view.calls).toBe(route === 'failed' ? 3 : 2);
      expect(summaryAttempts).toBe(route === 'failed' ? 1 : 0);
      expect(summaryPrepares).toBe(route === 'last-call' ? 0 : 1);
      if (route === 'failed') expect(journal.view.summaryFailures.get(1)).toBe(1);
      // The plain-English held notice is not owed: nothing is held.
      const status = spawnSync(process.execPath,
        ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
        {cwd:process.cwd(),env:{...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(key).toString('hex')},encoding:'utf8',timeout:10000});
      expect(status.status).toBe(0);
      expect((JSON.parse(status.stdout) as { holds: unknown[] }).holds).toEqual([]);
    }
    expect(journal.view.order[0]?.text).toContain('ORCHID');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('the documented inspect view states a floor set-aside, never complete history (Rule 26)', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-floor-inspect-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis(), maxBytes: 32768 });
    const id = 'telegram:12345678:update:1', text = `ORCHID ${'a'.repeat(30000)}`;
    journal.append({ kind: 'intake', id, update: 1, text, accepted: true, cursor: 2, at: 1000,
      raw: JSON.stringify({ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 } }) });
    journal.append({ kind: 'reserve', id, at: 1000 });
    journal.append({ kind: 'answer', id, text: 'Noted.', state: 'complete', memory: [], at: 1000 });
    journal.close();
    const child = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'inspect', '--root', root, '--text', 'What was the name?', '--model', 'claude-opus-5-5'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(child.status, child.stderr).toBe(0);
    expect((JSON.parse(child.stdout) as { next: unknown }).next).toMatchObject({ historyMode: 'recent-only', summaryThrough: null,
      historySetAside: { count: 1, through: 1 } });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 25000);

it('summarizes and answers with pending corrections and a commitment before any summary exists', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis(), maxBytes: 32768 });
    const request = 'Please remember that my dentist appointment is Friday.';
    const prior = [
      { update: 1, text: request, answer: 'Noted.' },
      { update: 2, text: `A longer conversation about my plans: ${'a'.repeat(19000)}`,
        answer: "I've scheduled a reminder for Friday." },
    ];
    for (const turn of prior) {
      const id = `telegram:12345678:update:${turn.update}`;
      journal.append({ kind: 'intake', id, update: turn.update, text: turn.text,
        raw: JSON.stringify(update(turn.update, turn.text)), accepted: true, cursor: turn.update + 1, at: 1000 });
      journal.append({ kind: 'reserve', id, at: 1000 });
      journal.append({ kind: 'answer', id, text: turn.answer, at: 1000 });
      journal.append({ kind: 'intent', id, text: `PREVIEW — ${turn.answer}`,
        chat: journal.view.genesis.chat, update: turn.update, grant: journal.view.genesis.grant, at: 1000 });
      journal.append({ kind: 'sent', id, message: turn.update, at: 1000 });
    }
    const seen: { id: string; context: string }[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => {
        if (Buffer.byteLength(input.context) + (input.id.startsWith('summary:') ? 500 : 16000) > 32768)
          throw Error('prompt overflow');
        return input.context;
      },
      model: async input => { seen.push(input);
        return input.id.startsWith('summary:')
          ? JSON.stringify({ summary: 'The operator asked me to remember a Friday dentist appointment.', people: [],
            commitments: [{ in: 'message', quote: request, waitsOn: 'nothing' }], closed: [] })
          : 'I can remember that, but I cannot schedule a reminder.';
      },
      send: async () => 3, checkOutbound: () => {} });
    worker.checkCoherence();
    expect(journal.view.corrections).toEqual(['telegram:12345678:update:2']);
    expect(journal.view.summaries).toHaveLength(0);
    worker.intake([update(3, 'What did I ask you to remember?')]);
    await worker.drain();
    expect(seen.map(item => item.id)).toEqual(['summary:2', 'telegram:12345678:update:3']);
    expect(journal.view.order[2]?.sent).toBe(3);
    expect(journal.view.order[2]?.held).toBeUndefined();
    expect(journal.view.commitments.map(item => item.quote)).toEqual([request]);
    const packet = JSON.parse(seen[1]!.context);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.summary.text).toContain('Friday dentist');
    expect(packet.commitments[0].items[0].quote).toBe(request);
    expect(packet.corrections?.map((item: { update: number }) => item.update)).toEqual([2]);
    expect(journal.view.corrections).toEqual([]);
    journal.close();
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

it('latches operator stop while the exclusive writer is held', () => {
  const root = origin();
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const context = { site: 'preview.journal', preserved: 'preview:test', register: {
    generation: { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'preview:register' },
    entries: ['preview.journal'], sites: { 'preview.journal': 'closed' as const } } };
  const lease = openProductionStorage({ root: join(root, '.writer'), machine: 'preview-local-machine', key,
    policy: 'preview-journal', store: 'preview-journal', context, io: productionStorageIO });
  try {
    expect(lease.kind).toBe('Success');
    const stop = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'stop', '--root', root],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    expect(stop.status).toBe(0);
    expect(JSON.parse(readFileSync(join(root, 'preview-stop.json'), 'utf8')).reason).toBe('operator');
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout).stop.reason).toBe('operator');
  } finally {
    journal.close(); if (lease.kind === 'Success') lease.value.close();
    rmSync(root, { recursive: true, force: true });
  }
});

it('physical Telegram bridge fences a send accepted by a fake endpoint that drops its response', async () => {
  const root = origin(), log = join(root, 'endpoint.jsonl');
  const server = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-fake-endpoint.mjs'), log],
    { stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const port = await new Promise<number>((done, fail) => {
      server.stdout.once('data', data => done(Number(String(data).trim()))); server.once('error', fail);
    });
    const physical = createProductionTelegramIO(root, { preserve: () => true, read: () => null }, `http://127.0.0.1:${port}`);
    const token = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const secretAttempt = physical.invoke({ token: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'telegram-bot-token' },
      method: 'sendMessage', body: { chat_id: '7654321', text: token, parse_mode: 'HTML' }, timeoutMs: 1000 }, token);
    expect(secretAttempt).toMatchObject({kind:'uncertain',stage:'scan-policy'});
    const first = world(root, { send: () => {
      const result = physical.invoke({ token: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'telegram-bot-token' },
        method: 'sendMessage', body: { chat_id: '7654321', text: 'PREVIEW — answer question 1', parse_mode: 'HTML' },
        timeoutMs: 1000 }, token);
      expect(result.kind).toBe('uncertain'); return null;
    } });
    first.worker.intake([update(1)]); await first.worker.drain(); first.journal.close();
    const second = world(root); second.worker.intake([update(1), update(2)]); await second.worker.drain();
    expect(second.sends).toBe(1);
    const accepted = readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(accepted).toHaveLength(1);
    expect(accepted[0].path).toContain('/sendMessage');
    expect(second.journal.view.order[0]?.sent).toBeUndefined();
    expect(second.journal.view.order[1]?.sent).toBe(1);
    second.journal.close();
  } finally { server.kill('SIGTERM'); rmSync(root, { recursive: true, force: true }); }
});

it('recalls an original turn far beyond the envelope across a restart in a 200-turn run with flat overhead', async () => {
  const root = origin(), samples: number[] = [];
  const fact = 'The locker combination is QUASAR-7731.';
  const initial = { ...genesis(), maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 8192 };
  let asked: string | undefined, early: string | undefined, indexCalls = 0;
  const open = () => {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        if (input.id.startsWith('summary:index:')) indexCalls++;
        if (input.id.startsWith('summary:')) return 'An ordinary conversation about weather, errands and plans.';
        if (input.question.includes('locker combination')) asked = input.context;
        if (input.id === 'telegram:12345678:update:6') early = input.context;
        return 'noted';
      },
      send: async () => 1, checkOutbound: () => {} });
    return { journal, worker };
  };
  try {
    openPreviewJournal(join(root, 'journal.encrypted'), key, initial).close();
    let current = open();
    for (let i = 1; i <= 200; i++) {
      if (i === 100) { current.journal.close(); current = open(); }
      const text = i === 5 ? fact : i === 190 ? 'What was the locker combination I gave you?'
        : `ordinary turn ${i}: weather, errands and plans for the week ${'x'.repeat(60)}`;
      const incoming = update(i, text); (incoming.message as { date?: number }).date = 1790000000 + i * 60;
      const start = performance.now();
      current.worker.intake([incoming]); await current.worker.drain(); await current.worker.summarizeIfNeeded();
      samples.push(performance.now() - start);
    }
    const view = current.journal.view;
    expect(view.order).toHaveLength(200);
    expect(view.order.every(turn => turn.sent === 1)).toBe(true);
    expect(view.order[4]?.text).toBe(fact);
    expect(view.summaries.length).toBeGreaterThan(1);
    expect(view.summaries.every(summary => !summary.text.includes('QUASAR'))).toBe(true);
    // Rule 11: this model returns no meaning terms, so summarized messages are offered to the index-only
    // call -- a full batch of eight where one is available, a smaller remainder otherwise, and each source
    // at most INDEX_ATTEMPT_LIMIT times (w3-longchat: a remainder under eight used to be stranded for good).
    expect(view.indexOffered.length).toBeLessThanOrEqual(new Set(view.indexOffered).size * INDEX_ATTEMPT_LIMIT);
    expect(indexCalls).toBeGreaterThan(view.indexOffered.length / INDEX_BACKLOG_LIMIT - 1);
    expect(view.calls).toBe(200 + view.summaries.length + indexCalls);
    expect(JSON.parse(early!)).toMatchObject({ historyMode: 'complete' });
    expect(JSON.parse(early!).recalled).toBeUndefined();
    expect(early).toContain('QUASAR-7731');
    const packet = JSON.parse(asked!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.summary.through).toBeGreaterThan(5);
    expect(packet.summary.sourceLabel).toMatch(/^summary:all conversations\/.+\/through #\d+$/u);
    expect(packet.history.some((turn: { user: string }) => turn.user.includes('QUASAR'))).toBe(false);
    expect(packet.recalled).toContainEqual(expect.objectContaining({ id: 'telegram:12345678:update:5', date: '2026-09-21T14:18Z', user: fact, answer: 'noted',
      outcome: 'Telegram API accepted' }));
    expect(Buffer.byteLength(asked!)).toBeLessThanOrEqual(8192);
    const p95 = (values: number[]) => values.slice().sort((a,b) => a-b)[Math.ceil(values.length * .95)-1]!;
    const first = p95(samples.slice(0, 10)), last = p95(samples.slice(190));
    process.stdout.write(`journal recall 200 turns: non-model p95=${p95(samples).toFixed(1)} ms, first-ten=${first.toFixed(1)} ms, final-ten=${last.toFixed(1)} ms\n`);
    expect(p95(samples)).toBeLessThanOrEqual(5000);
    expect(last - first).toBeLessThanOrEqual(1000);
    current.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
// Harness bound for a heavy 200-turn workload (about 5 s alone, slower under machine load);
// the product guarantee is the flat-overhead assertion above, not this timeout.
}, 60_000);

it('recalls imported old-root turns with their original Telegram dates and drops recall before overflowing', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(), maxBytes: 5120 + FLOOR_GUIDE, importSource: 'old-root', importCursor: 10 });
    const imported = (id: number, text: string) => {
      const raw = update(id, text); (raw.message as { date?: number }).date = 1789000000 + id;
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${id}`, update: id, text, raw: JSON.stringify(raw),
        accepted: true, cursor: 0, at: 0 });
      journal.append({ kind: 'reserve', id: `telegram:12345678:update:${id}`, at: 0 });
      journal.append({ kind: 'answer', id: `telegram:12345678:update:${id}`, text: `old answer ${id}`, at: 0 });
      journal.append({ kind: 'intent', id: `telegram:12345678:update:${id}`, text: `PREVIEW — old answer ${id}`,
        chat: '7654321', update: id, grant: 'grant:preview', at: 0 });
      journal.append({ kind: 'sent', id: `telegram:12345678:update:${id}`, message: id, at: 0 });
    };
    imported(1, 'The ferry leaves from pier NINETEEN.'); imported(2, `Unrelated old errand. ${'z'.repeat(5000)}`);
    journal.append({ kind: 'import', source: 'old-root', remainingCalls: 98, remainingReplies: 98, oldStop: 'operator', at: 0 });
    journal.append({ kind: 'summary-reserve', through: 2, at: 0 });
    journal.append({ kind: 'summary', through: 2, text: 'Old errands were discussed.', at: 0 });
    const contexts: string[] = [];
    let limit = Infinity;
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => { if (Buffer.byteLength(input.context) > limit) throw Error('overflow'); return input.context; },
      model: async input => { contexts.push(input.context); return 'ok'; }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(10, 'Which pier does the ferry leave from?')]); await worker.drain();
    const packet = JSON.parse(contexts[0]!);
    expect(packet.recalled).toMatchObject([{ id: 'telegram:12345678:update:1', date: '2026-09-10T00:26Z', user: 'The ferry leaves from pier NINETEEN.',
      answer: 'old answer 1', outcome: 'Telegram API accepted' }]);
    // A narrower provider envelope still fits recall, after optional candidates yield.
    // int12: bound relative to the full first packet (which carries the old quote), so added
    // reply instructions cannot shift it past the recall-drop window. cint-23-occam re-measured the
    // window in 50-byte steps after the summary decision left the packet: 700-1500 (was 600).
    // w3-memcorr: the memory item shape (Rule 7) adds 580 mandatory bytes; re-measured in 50-byte steps: 150-950.
    limit = Buffer.byteLength(contexts[0]!) - 550;
    worker.intake([update(11, 'Which pier does the ferry leave from, again?')]); await worker.drain();
    expect(journal.view.order.at(-1)?.sent).toBe(1);
    // The new unsummarized turn is mandatory. At this bound even a candidate-free
    // packet cannot also fit the old quote, so the omission is recorded.
    expect(JSON.parse(contexts[1]!).recalled).toBeUndefined();
    expect(JSON.parse(contexts[1]!).memoryCandidates).toBeUndefined();
    expect(journal.view.order.at(-1)?.packetDropped).toContainEqual({ kind: 'recent',
      source: 'telegram:12345678:update:1', reason: 'packet or prepared prompt byte envelope' });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
