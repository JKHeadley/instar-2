import { expect, it } from 'vitest';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn, spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
// The physical host is an ESM script; this test checks its runtime contract.
// @ts-ignore no declaration for the host script
import { createProductionTelegramIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';

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
    expect(physicalCalls).toBeLessThanOrEqual(1);
    expect(physicalSends).toBeLessThanOrEqual(1);
    const turn = next.journal.view.order[0]!;
    if (stage === 'before:intake') expect(turn.sent).toBe(43);
    else expect(turn.reserved || turn.sent).toBeTruthy();
    next.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('survives actual SIGKILL before and after every turn-path durable boundary', async () => {
  const stages = ['before:genesis', 'after:genesis', 'before:intake', 'after:intake', 'before:reserve', 'after:reserve',
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
      expect(count(modelLog), stage).toBeLessThanOrEqual(1);
      expect(count(sendLog), stage).toBeLessThanOrEqual(1);
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

it('holds admitted work at the exact attempt cap and refuses another poll', async () => {
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
    expect(() => worker.pollGate()).toThrow('capacity');
    expect(journal.view.stop).toBe('capacity');
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('holds a prepared answer when the reply cap is exhausted', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(2), maxReplies: 1, maxTurns: 5 });
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'ok', send: async () => { sends++; return 1; }, checkOutbound: () => {} });
    worker.intake([update(1), update(2)]); await worker.drain();
    expect(journal.view.calls).toBe(2);
    expect(sends).toBe(1);
    expect(journal.view.order[1]?.answer).toBe('ok');
    expect(journal.view.order[1]?.held).toBe('reply cap');
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('holds context overflow with originals intact when no current summary can cover it', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis(), maxBytes: 128 });
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { calls++; return 'ok'; }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'never drop this original')]); await worker.drain();
    expect(calls).toBe(0);
    expect(journal.view.order[0]?.text).toBe('never drop this original');
    expect(journal.view.order[0]?.held).toBe('context overflow');
    journal.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
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
});

it('uses rolling summaries only after replies, shares the attempt cap, and retains original text', async () => {
  const root = origin();
  try {
    const initial = { ...genesis(), maxBytes: 1100 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, initial);
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:') ? 'The first unique memory was ORCHID.' : 'ok',
      send: async () => 1, checkOutbound: () => {} });
    for (let i = 0; i < 12; i++) {
      worker.intake([update(i + 1, i === 0 ? 'ORCHID is the first unique memory.' : `turn ${i} ${'a'.repeat(45)}`)]);
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
