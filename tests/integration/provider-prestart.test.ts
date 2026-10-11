import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createHostResourceAllocation } from '../preview/six-host-resources.js';
// @ts-expect-error Physical host JavaScript.
import { createResourceOwner, hostQuery, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Physical host JavaScript.
import { prestartProvider } from '../../scripts/provider-prestart.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
async function fixture(fault: { refuseTransfer?: number; refuseAnswer?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'prestart-')); roots.push(root);
  const file = join(root, 'worker.mjs'), ready = join(root, 'ready');
  writeFileSync(file, `import {writeFileSync} from 'node:fs';
writeFileSync(${JSON.stringify(ready)},String(process.pid));
let text=''; for await(const chunk of process.stdin) text+=chunk;
process.stdout.write(JSON.stringify({pid:process.pid,text}));`);
  const ceilings = { ...RESOURCE_CEILINGS, launch: { ...RESOURCE_CEILINGS.launch, processCount: 256 } };
  const owner = createResourceOwner(ceilings);
  const allocation = createHostResourceAllocation({ root, machine: 'machine:test', ceilings,
    incarnation: `prestart:${root}`, now: () => Date.now(), monotonic: () => performance.now() });
  await owner.attach({ statePath: join(root, 'resources.json'), ledgerPath: join(root, 'launches.json'), allocation: { ...allocation,
    reserve: (input: Parameters<typeof allocation.reserve>[0]) => fault.refuseAnswer && input.work === 'answer'
      ? { ok: false, reason: 'injected Six capacity refusal' } : allocation.reserve(input),
    close: (set: string, settlement: string) => {
      if (settlement.startsWith('transferred-to:') && (fault.refuseTransfer ?? 0) > 0) {
        fault.refuseTransfer!--; return { ok: false };
      }
      return allocation.close(set, settlement);
    } } });
  const input = { executable: process.execPath, args: [file], cwd: root, env: { PATH: '/usr/bin:/bin' },
    stdin: '', timeout: 10000, maxBytes: 4096 };
  const waitReady = async () => {
    for (let i = 0; i < 200 && !existsSync(ready); i++) await new Promise(resolve => setTimeout(resolve, 25));
    expect(existsSync(ready)).toBe(true);
    return Number(readFileSync(ready, 'utf8'));
  };
  return { root, owner, input, waitReady, allocation };
}

it('starts a real bounded process without a prompt, delivers once to the same PID, and verifies cleanup', async () => {
  const f = await fixture(), worker = prestartProvider(f.input, { owner: f.owner });
  try {
    const pid = await f.waitReady();
    expect(f.owner.snapshot().counters.completed).toBe(0);
    expect(Object.values(JSON.parse(readFileSync(join(f.root, 'launches.json'), 'utf8')).launches)).not.toHaveLength(0);
    const result = await worker.consume({ ...f.input, stdin: 'current grounded packet' });
    expect(result).toMatchObject({ code: 0, limited: false, resources: { cleanup: 'verified', admission: { work: 'answer' } } });
    expect(JSON.parse(result.stdout)).toEqual({ pid, text: 'current grounded packet' });
    expect(worker.consume({ ...f.input, stdin: 'second turn' })).toBeNull();
    expect(f.owner.snapshot().counters.admitted).toBe(2);
    expect(f.allocation.open()).toEqual([]);
  } finally { await worker.close(); }
});

it('refuses changed confinement, retains the idle worker for disposal, and never writes the rejected packet', async () => {
  const f = await fixture(), worker = prestartProvider(f.input, { owner: f.owner });
  try {
    await f.waitReady();
    for (const patch of [{ args: [...f.input.args, '--other'] }, { cwd: tmpdir() }, { env: { PATH: '/bin' } }, { maxBytes: 8192 }])
      expect(worker.consume({ ...f.input, ...patch, stdin: 'must not be sent' })).toBeNull();
    const result = await worker.close();
    expect(result.limited).toBe(true);
    expect(result.stdout).toBe('');
  } finally { await worker.close(); }
});

it('observes a stop before supplying input and expires an unused worker without a retry', async () => {
  const f = await fixture(); let stopped = false;
  const worker = prestartProvider({ ...f.input, stopped: () => stopped }, { owner: f.owner });
  try {
    await f.waitReady(); stopped = true;
    expect(worker.consume({ ...f.input, stdin: 'not admitted' })).toBeNull();
    expect((await worker.close()).limited).toBe(true);
    const expired = prestartProvider(f.input, { owner: f.owner, idleMs: 1 });
    try {
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(expired.consume({ ...f.input, stdin: 'late' })).toBeNull();
    } finally { await expired.close(); }
    expect(f.owner.snapshot().counters.admitted).toBeLessThanOrEqual(2);
  } finally { await worker.close(); }
});

it('keeps a launcher header separate from the one delivered task', async () => {
  const f = await fixture(), worker = prestartProvider(f.input, { owner: f.owner, initialInput: '{"login":"fixture"}\n' });
  try {
    const pid = await f.waitReady();
    const result = await worker.consume({ ...f.input, stdin: 'only task' });
    expect(JSON.parse(result.stdout)).toEqual({ pid, text: '{"login":"fixture"}\nonly task' });
  } finally { await worker.close(); }
});

it('preserves unresolved cleanup as uncertainty and refuses disposal success', async () => {
  const input = { executable: '/fixture', args: [], cwd: '/fixture-root', env: {}, stdin: '', timeout: 1000, maxBytes: 100 };
  const owner = { execute: async (command: { deferredInput: Promise<string>; onAdoption: (adopt: () => boolean) => void }) => {
    command.onAdoption(() => true);
    await command.deferredInput;
    return { code: 0, limited: false, stdout: 'frame', resources: { cleanup: 'unresolved' } };
  } };
  const worker = prestartProvider(input, { owner });
  expect(await worker.consume({ ...input, stdin: 'one admitted turn' })).toMatchObject({ limited: true });
  await expect(worker.close()).rejects.toThrow('cleanup is unresolved');
  expect(worker.consume({ ...input, stdin: 'replacement' })).toBeNull();
});

it('joins a queued maintenance candidate without task bytes and uses the reserved answer slot', async () => {
  const f = await fixture();
  const holds = [await f.owner.hold('maintenance', { timeout: 1000 }), await f.owner.hold('maintenance', { timeout: 1000 })];
  const worker = prestartProvider(f.input, { owner: f.owner });
  try {
    expect(f.owner.snapshot().waiting).toEqual(['maintenance']);
    expect(worker.consume({ ...f.input, stdin: 'must not enter the queued candidate' })).toBeNull();
    const unused = await worker.close();
    expect(unused).toMatchObject({ limited: true, stdout: '' });
    expect(f.owner.snapshot().waiting).toEqual([]);
    expect(existsSync(join(f.root, 'ready'))).toBe(false);
    const waited = f.owner.snapshot().counters.waited;
    const answer = await f.owner.execute({ ...f.input, stdin: 'reserved answer' }, 'answer');
    expect(f.owner.snapshot().counters.waited).toBe(waited);
    expect(answer).toMatchObject({ code: 0, limited: false, resources: { admission: { work: 'answer' } } });
    expect(JSON.parse(answer.stdout).text).toBe('reserved answer');
  } finally { await worker.close(); for (const hold of holds) await hold.release(); }
  expect(f.allocation.open()).toEqual([]);
});

it('adopts a ready candidate through Six answer allocation while another maintenance slot is held', async () => {
  const f = await fixture(), hold = await f.owner.hold('maintenance', { timeout: 1000 });
  const worker = prestartProvider(f.input, { owner: f.owner });
  try {
    const pid = await f.waitReady();
    const pending = worker.consume({ ...f.input, stdin: 'adopted answer' });
    expect(pending).not.toBeNull();
    expect(f.owner.snapshot().active.find((row: { pid: number }) => row.pid === pid)?.work).toBe('answer');
    const active = f.allocation.open();
    expect(active).toHaveLength(2); // held maintenance plus the replacement answer allocation
    const result = await pending;
    expect(result).toMatchObject({ code: 0, limited: false, resources: { admission: { work: 'answer' }, allocation: { state: 'returned' } } });
    expect(JSON.parse(result.stdout)).toEqual({ pid, text: 'adopted answer' });
    // The old maintenance family debit is returned: another maintenance hold is admissible.
    const next = await f.owner.hold('maintenance', { timeout: 1000 });
    expect(next).not.toBeNull(); await next.release();
  } finally { await worker.close(); await hold.release(); }
  expect(f.allocation.open()).toEqual([]);
});

it('joins a ready candidate when answer adoption cannot reserve capacity, then dispatches cold once', async () => {
  const f = await fixture(), worker = prestartProvider(f.input, { owner: f.owner });
  const holds = [];
  try {
    await f.waitReady();
    holds.push(await f.owner.hold('maintenance', { timeout: 1000 }), await f.owner.hold('answer', { timeout: 1000 }));
    expect(worker.consume({ ...f.input, stdin: 'must not be delivered' })).toBeNull();
    expect(await worker.close()).toMatchObject({ limited: true, stdout: '', resources: { cleanup: 'verified' } });
    const waited = f.owner.snapshot().counters.waited;
    const answer = await f.owner.execute({ ...f.input, stdin: 'cold answer' }, 'answer');
    expect(f.owner.snapshot().counters.waited).toBe(waited);
    expect(answer).toMatchObject({ code: 0, limited: false, resources: { admission: { work: 'answer' } } });
    expect(JSON.parse(answer.stdout).text).toBe('cold answer');
  } finally { await worker.close(); for (const hold of holds) await hold.release(); }
  expect(f.allocation.open()).toEqual([]);
});

for (const failures of [1, 100]) it(`keeps a failed maintenance debit return visible (${failures} refused returns)`, async () => {
  const fault = { refuseTransfer: failures }, f = await fixture(fault);
  const worker = prestartProvider(f.input, { owner: f.owner });
  await f.waitReady();
  expect(worker.consume({ ...f.input, stdin: 'not delivered before allocation transfer' })).toBeNull();
  if (failures === 1) {
    expect(await worker.close()).toMatchObject({ limited: true, stdout: '', resources: { retiredAllocation: { state: 'returned' } } });
    expect(f.allocation.open()).toEqual([]);
  } else {
    await expect(worker.close()).rejects.toThrow('previous allocation return is unresolved');
    expect(f.allocation.open()).toHaveLength(1);
    // The physical process is gone; its retained row and Six debit remain observable until recovery.
    const ledger = JSON.parse(readFileSync(join(f.root, 'launches.json'), 'utf8'));
    expect(Object.values(ledger.launches)).toHaveLength(1);
    expect(f.owner.snapshot().active).toEqual([]);
    fault.refuseTransfer = 0;
    const recovery = createResourceOwner(RESOURCE_CEILINGS);
    await recovery.attach({ ledgerPath: join(f.root, 'launches.json'), allocation: f.allocation,
      // Inject only the departed owner's identity; the real launch must still be observed gone.
      query: (file: string, args: string[]) => args.join(' ') === `-o lstart= -p ${process.pid}`
        ? Promise.resolve('') : hostQuery(file, args) });
    expect(f.allocation.open()).toEqual([]);
  }
});

it('falls back when Six refuses answer allocation despite an available local slot', async () => {
  const fault = { refuseAnswer: true }, f = await fixture(fault);
  const worker = prestartProvider(f.input, { owner: f.owner });
  try {
    await f.waitReady();
    expect(worker.consume({ ...f.input, stdin: 'not sent' })).toBeNull();
    expect(await worker.close()).toMatchObject({ limited: true, stdout: '' });
    expect(f.allocation.open()).toEqual([]);
    fault.refuseAnswer = false;
    const result = await f.owner.execute({ ...f.input, stdin: 'answer after capacity returns' }, 'answer');
    expect(result).toMatchObject({ code: 0, limited: false });
    expect(JSON.parse(result.stdout).text).toBe('answer after capacity returns');
  } finally { await worker.close(); }
});

it('does not supply a task when the durable process handoff cannot be recorded', async () => {
  const f = await fixture(), worker = prestartProvider(f.input, { owner: f.owner });
  try {
    await f.waitReady();
    // Inject missing source evidence at adoption, not host load or a timing race.
    writeFileSync(join(f.root, 'launches.json'), JSON.stringify({ version: 1, launches: {} }));
    expect(worker.consume({ ...f.input, stdin: 'not sent without durable handoff' })).toBeNull();
    expect(await worker.close()).toMatchObject({ limited: true, stdout: '' });
    expect(f.allocation.open()).toEqual([]);
  } finally { await worker.close(); }
});
