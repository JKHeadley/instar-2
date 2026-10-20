// Recorded shape: startup-slow-1019-PROGRESS.md, host-111: committed dead-launch
// sets prevent rotation past 128 facts. Recreate through Six, never edit fact bytes.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical host adapter is JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';
import { createHostResourceAllocation } from './six-host-resources.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const start = 'Sat Oct 17 14:00:00 2026';
const reserve = (allocation: ReturnType<typeof createHostResourceAllocation>, launch: string) => {
  const result = allocation.reserve({ launch, work: 'maintenance', memoryBytes: 1024, processCount: 1 });
  if (!result.ok) throw Error(result.reason);
  return result.handle;
};
let seed: ReturnType<typeof seedFixture> | undefined;
afterAll(() => { if (seed) rmSync(seed.root, { recursive: true, force: true }); });
function seedFixture() {
  const root = mkdtempSync(join(tmpdir(), 'deadset-seed-'));
  let incarnation = 0;
  const open = () => createHostResourceAllocation({ root, machine: 'machine:test', ceilings: RESOURCE_CEILINGS,
    incarnation: `launcher:${++incarnation}`, now: () => 1000, monotonic: () => 1000 });
  const allocation = open(), dead = reserve(allocation, 'dead');
  // 19 ordinary launches add 133 set facts alongside the held launch: beyond 128.
  for (let n = 0; n < 19; n++) {
    const handle = reserve(allocation, `done-${n}`);
    expect(allocation.close(handle.set, `cleanup-verified:${handle.launch}`).ok).toBe(true);
  }
  expect(allocation.generation()).toBe(0);
  expect(allocation.open()).toEqual([{ set: dead.set, launch: 'dead' }]);
  const ledgerPath = join(root, 'launches.json');
  writeFileSync(ledgerPath, JSON.stringify({ version: 1, launches: { dead: {
    pid: 41001, start, owner: { pid: 41000, start }, members: { 41001: start }, allocation: dead.set,
  } } }));
  return { root, dead };
}
function fixture() {
  seed ??= seedFixture();
  const root = mkdtempSync(join(tmpdir(), 'deadset-recovery-')); roots.push(root);
  cpSync(seed.root, root, { recursive: true });
  let incarnation = 1;
  const open = () => createHostResourceAllocation({ root, machine: 'machine:test', ceilings: RESOURCE_CEILINGS,
    incarnation: `launcher:${++incarnation}`, now: () => 1000, monotonic: () => 1000 });
  return { root, open, ledgerPath: join(root, 'launches.json'), dead: seed.dead };
}
function query(state: 'gone' | 'member' | 'owner' | 'unknown-member' | 'unknown-owner' | 'failed-census') {
  return async (file: string, args: string[]) => {
    if (file === '/bin/sh') return '256\n1024\nunlimited\nunlimited\n1024\n2048\n';
    if (file === '/bin/ps' && args[0] === '-U') return state === 'failed-census' ? null : '';
    if (file === '/bin/ps' && args[0] === '-o') {
      const pid = args.at(-1);
      if (pid === '41000') return state === 'owner' ? start : state === 'unknown-owner' ? null : '';
      if (pid === '41001') return state === 'member' ? start : state === 'unknown-member' ? null : '';
      return '';
    }
    throw Error(`unexpected query ${file} ${args.join(' ')}`);
  };
}
it('returns a dead launch committed set, rotates the full generation, and restarts cleanly', { timeout: 30000 }, async () => {
  const f = fixture(), allocation = f.open();
  await createResourceOwner().attach({ ledgerPath: f.ledgerPath, allocation, query: query('gone') });
  expect(allocation.open()).toEqual([]);
  expect(JSON.parse(readFileSync(f.ledgerPath, 'utf8')).launches).toEqual({});
  const next = reserve(allocation, 'after-recovery');
  expect(allocation.generation()).toBe(1);
  expect(allocation.close(next.set, 'cleanup-verified:after-recovery').ok).toBe(true);
  const restarted = f.open();
  await createResourceOwner().attach({ ledgerPath: f.ledgerPath, allocation: restarted, query: query('gone') });
  expect(restarted.generation()).toBe(1);
  expect(restarted.open()).toEqual([]);
  expect(reserve(restarted, 'after-restart').launch).toBe('after-restart');
});
it.each(['member', 'owner', 'unknown-member', 'unknown-owner', 'failed-census'] as const)(
  '%s keeps the debit and prevents rotation', { timeout: 30000 }, async state => {
    const f = fixture(), allocation = f.open();
    await createResourceOwner().attach({ ledgerPath: f.ledgerPath, allocation, query: query(state) });
    expect(allocation.open()).toEqual([{ set: f.dead.set, launch: 'dead' }]);
    expect(JSON.parse(readFileSync(f.ledgerPath, 'utf8')).launches.dead.allocation).toBe(f.dead.set);
    reserve(allocation, 'neighbour');
    expect(allocation.generation()).toBe(0);
  });

it.each([null, { pid: 41000 }, { pid: 41000, start: '' }, { pid: 0, start }])(
  'keeps a launch with unavailable owner identity %j', { timeout: 30000 }, async owner => {
    const f = fixture(), allocation = f.open();
    const ledger = JSON.parse(readFileSync(f.ledgerPath, 'utf8'));
    ledger.launches.dead.owner = owner;
    writeFileSync(f.ledgerPath, JSON.stringify(ledger));
    const observer = createResourceOwner();
    await observer.attach({ ledgerPath: f.ledgerPath, allocation, query: query('gone') });
    expect(observer.snapshot().orphans).toMatchObject([{ launch: 'dead', state: 'unknown', reason: 'owner identity unavailable' }]);
    expect(allocation.open()).toEqual([{ set: f.dead.set, launch: 'dead' }]);
    expect(JSON.parse(readFileSync(f.ledgerPath, 'utf8')).launches.dead).toBeDefined();
  });
