import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createHostResourceAllocation } from '../preview/six-host-resources.js';
// @ts-expect-error Physical host JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Physical host JavaScript.
import { prestartProvider } from '../../scripts/provider-prestart.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
async function fixture() {
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
  await owner.attach({ statePath: join(root, 'resources.json'), ledgerPath: join(root, 'launches.json'), allocation });
  const input = { executable: process.execPath, args: [file], cwd: root, env: { PATH: '/usr/bin:/bin' },
    stdin: '', timeout: 10000, maxBytes: 4096 };
  const waitReady = async () => {
    for (let i = 0; i < 200 && !existsSync(ready); i++) await new Promise(resolve => setTimeout(resolve, 25));
    expect(existsSync(ready)).toBe(true);
    return Number(readFileSync(ready, 'utf8'));
  };
  return { root, owner, input, waitReady };
}

it('starts a real bounded process without a prompt, delivers once to the same PID, and verifies cleanup', async () => {
  const f = await fixture(), worker = prestartProvider(f.input, { owner: f.owner });
  try {
    const pid = await f.waitReady();
    expect(f.owner.snapshot().counters.completed).toBe(0);
    expect(Object.values(JSON.parse(readFileSync(join(f.root, 'launches.json'), 'utf8')).launches)).not.toHaveLength(0);
    const result = await worker.consume({ ...f.input, stdin: 'current grounded packet' });
    expect(result).toMatchObject({ code: 0, limited: false, resources: { cleanup: 'verified' } });
    expect(JSON.parse(result.stdout)).toEqual({ pid, text: 'current grounded packet' });
    expect(worker.consume({ ...f.input, stdin: 'second turn' })).toBeNull();
    expect(f.owner.snapshot().counters.admitted).toBe(1);
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
  const owner = { execute: async (command: { deferredInput: Promise<string> }) => {
    await command.deferredInput;
    return { code: 0, limited: false, stdout: 'frame', resources: { cleanup: 'unresolved' } };
  } };
  const worker = prestartProvider(input, { owner });
  expect(await worker.consume({ ...input, stdin: 'one admitted turn' })).toMatchObject({ limited: true });
  await expect(worker.close()).rejects.toThrow('cleanup is unresolved');
  expect(worker.consume({ ...input, stdin: 'replacement' })).toBeNull();
});
