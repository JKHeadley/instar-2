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

it('uses a current summary when the full packet fits but the complete prompt does not, and reports holds', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(), maxBytes: 32768 });
    journal.append({kind:'intake',id:'telegram:12345678:update:1',update:1,text:'a'.repeat(25800),
      raw:JSON.stringify(update(1)),accepted:true,cursor:2,at:1000});
    journal.append({kind:'reserve',id:'telegram:12345678:update:1',at:1000});
    journal.append({kind:'answer',id:'telegram:12345678:update:1',text:'old answer',at:1000});
    journal.append({kind:'summary-reserve',through:1,at:1000});
    journal.append({kind:'summary',through:1,text:'Earlier long turn: ORCHID.',at:1000});
    journal.append({kind:'intake',id:'telegram:12345678:update:2',update:2,text:'b'.repeat(6000),
      raw:JSON.stringify(update(2)),accepted:true,cursor:3,at:1000});
    journal.append({kind:'reserve',id:'telegram:12345678:update:2',at:1000});
    journal.append({kind:'answer',id:'telegram:12345678:update:2',text:'recent answer',at:1000});
    let full = 0, compact = 0, invoked = 0;
    const worker = createJournalWorker(journal, {now:()=>1000,stopped:()=>false,
      prepareModel: input => { const size = Buffer.byteLength(input.context);
        if (input.context.includes('"historyMode":"complete"')) full = size; else compact = size;
        if (size + 2870 > 32768) throw Error('complete prompt overflow'); return input.context; },
      model: async input => { invoked++; expect(input.context).toContain('ORCHID'); return 'yes'; },
      send: async()=>1,checkOutbound:()=>{} });
    worker.intake([update(3,'what was first?')]); await worker.drain();
    expect(full).toBeGreaterThan(32000);
    expect(full).toBeLessThanOrEqual(32768);
    expect(compact).toBeLessThan(8000);
    expect(invoked).toBe(1);
    expect(journal.view.order[2]?.sent).toBe(1);
    journal.append({kind:'hold',id:'telegram:12345678:update:2',reason:'review needed',at:1000});
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env:{...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(key).toString('hex')},encoding:'utf8',timeout:10000});
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout).holds).toContainEqual({update:2,reason:'review needed'});
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

it('recalls an original turn far beyond the envelope across a restart in a 200-turn run with flat overhead', async () => {
  const root = origin(), samples: number[] = [];
  const fact = 'The locker combination is QUASAR-7731.';
  const initial = { ...genesis(), maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 8192 };
  let asked: string | undefined, early: string | undefined;
  const open = () => {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
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
    expect(view.calls).toBe(200 + view.summaries.length);
    expect(JSON.parse(early!)).toMatchObject({ historyMode: 'complete' });
    expect(JSON.parse(early!).recalled).toBeUndefined();
    expect(early).toContain('QUASAR-7731');
    const packet = JSON.parse(asked!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.summary.through).toBeGreaterThan(5);
    expect(packet.history.some((turn: { user: string }) => turn.user.includes('QUASAR'))).toBe(false);
    expect(packet.recalled).toContainEqual({ date: '2026-09-21T14:18Z', user: fact, answer: 'noted',
      outcome: 'Telegram API accepted' });
    expect(Buffer.byteLength(asked!)).toBeLessThanOrEqual(8192);
    const p95 = (values: number[]) => values.slice().sort((a,b) => a-b)[Math.ceil(values.length * .95)-1]!;
    const first = p95(samples.slice(0, 10)), last = p95(samples.slice(190));
    process.stdout.write(`journal recall 200 turns: non-model p95=${p95(samples).toFixed(1)} ms, first-ten=${first.toFixed(1)} ms, final-ten=${last.toFixed(1)} ms\n`);
    expect(p95(samples)).toBeLessThanOrEqual(5000);
    expect(last - first).toBeLessThanOrEqual(1000);
    current.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('recalls imported old-root turns with their original Telegram dates and drops recall before overflowing', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis(), maxBytes: 4096, importSource: 'old-root', importCursor: 10 });
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
    expect(packet.recalled).toEqual([{ date: '2026-09-10T00:26Z', user: 'The ferry leaves from pier NINETEEN.',
      answer: 'old answer 1', outcome: 'Telegram API accepted' }]);
    limit = Buffer.byteLength(contexts[0]!) - 1;
    worker.intake([update(11, 'Which pier does the ferry leave from, again?')]); await worker.drain();
    expect(journal.view.order.at(-1)?.sent).toBe(1);
    expect(JSON.parse(contexts[1]!).recalled).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
