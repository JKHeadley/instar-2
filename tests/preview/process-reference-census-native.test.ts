import { spawn } from 'node:child_process';
import { linkSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { expect, it } from 'vitest';
import type { ProcessInventorySnapshot } from '../../src/assembly/process-inventory.js';
// @ts-expect-error Trusted physical adapter is JavaScript.
import { createProcessInventory, PROCESS_INCARNATION_READER } from '../../scripts/process-inventory.mjs';
// @ts-expect-error Existing read-only host authority is JavaScript.
import { queryWorktreeHost } from '../../scripts/host-worktree-recovery.mjs';

const native = it.runIf(process.platform === 'darwin');
type Query = (file: string, args: string[]) => Promise<string | null>;
const workerPath = fileURLToPath(new URL('./fixtures/worktree-reference-worker.py', import.meta.url));
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reference-census-')));
  const checkout = join(root, 'checkout'); mkdirSync(checkout);
  const file = join(checkout, 'retained'); writeFileSync(file, 'synthetic retained checkout\n');
  return { root, checkout, file, close: () => rmSync(root, { recursive: true, force: true }) };
}
async function worker(mode: 'mapping' | 'pair', file: string, cwd: string) {
  const child = spawn('/usr/bin/python3', [workerPath, mode, file], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  const exit = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  let errors = ''; child.stderr.on('data', data => { errors += String(data); });
  const next = async () => { const line = await lines.next(); if (line.done) throw Error(`fixture exited: ${errors}`); return line.value; };
  const initial = JSON.parse(await next()) as [number, number];
  console.info('reference fixture', { mode, supervisorPid: child.pid, pids: mode === 'pair' ? initial : [initial[0]] });
  return { initial,
    command: async (text: string) => { child.stdin.write(`${text}\n`); return Number(await next()); },
    close: async () => { child.stdin.end(); expect(await exit).toEqual({ code: 0, signal: null }); } };
}
function inventory(pids: number[], wrap: (query: Query) => Query = query => query) {
  const selected: Query = (file, args) => file === '/bin/ps'
    ? queryWorktreeHost(file, ['-p', pids.join(','), '-ww', '-o', args.at(-1)!]) : queryWorktreeHost(file, args);
  return createProcessInventory({ query: wrap(selected), now: () => 1000, monotonic: () => performance.now(),
    identity: { machine: 'fixture', hardwareProfile: 'darwin' }, uid: process.getuid!(), limit: 4096, freshForMs: 30000 });
}

native('matches a file mapping after every file descriptor has closed; exposes only redacted match facts', async () => {
  const f = fixture(); const child = await worker('mapping', f.file, f.root);
  try {
    const [pid, bytes] = child.initial; expect(bytes).toBe(28);
    const inv = inventory([pid], query => async (file, args) => {
      if (file === '/usr/sbin/lsof') {
        expect(args).toContain('-FpfDti'); expect(args).not.toContain('-X'); expect(args).not.toContain('-w');
      }
      return query(file, args);
    });
    const result = await inv.checkoutReferences(await inv.census(), f.checkout);
    expect(result.processes.get(pid)).toMatchObject({ state: 'reference', kinds: ['mapping'] });
    expect(result.processes.get(pid).incarnation).toMatch(/^\d+:\d+$/u);
    expect(JSON.stringify([...result.processes])).not.toContain(f.file);
    expect(await child.command('read')).toBe(bytes);
  } finally { await child.close(); f.close(); }
});

native('matches passed descriptors and a renamed outside-checkout hardlink by device/inode, without ancestry', async () => {
  const f = fixture(), alias = join(f.root, 'alias'); linkSync(f.file, alias);
  const pair = await worker('pair', alias, f.root);
  try {
    renameSync(alias, join(f.root, 'renamed-alias'));
    const [left, right] = pair.initial, inv = inventory([left, right]);
    const before = await inv.checkoutReferences(await inv.census(), f.checkout);
    expect(before.processes.get(right)).toMatchObject({ state: 'reference', kinds: ['fd'] });
    expect(before.processes.get(left).state).toBe('no-match');
    expect(await pair.command('to-left')).toBe(28);
    const after = await inv.checkoutReferences(await inv.census(), f.checkout);
    expect(after.processes.get(left)).toMatchObject({ state: 'reference', kinds: ['fd'] });
    expect(after.processes.get(right).state).toBe('no-match');
    console.info('reference transfer', JSON.stringify({ left, right, before: [...before.processes], after: [...after.processes] }));
  } finally { await pair.close(); f.close(); }
});

native('a real SCM_RIGHTS scan race hides continuous possession despite equal incarnation populations and repeated scans', async () => {
  const f = fixture(); const pair = await worker('pair', f.file, f.root);
  try {
    const [left, right] = pair.initial;
    let holder = right;
    const inv = inventory([left, right], query => async (file, args) => {
      if (file !== '/usr/sbin/lsof') return query(file, args);
      const pid = Number(args[args.indexOf('-p') + 1]);
      // The inventory's ps order is PID order. Move the only FD to the
      // already-scanned process; SCM_RIGHTS keeps it alive in transit as well.
      if (pid === left && holder === left) { expect(await pair.command('to-right')).toBe(28); holder = right; }
      const bytes = await query(file, args);
      if (pid === left) { expect(await pair.command('to-left')).toBe(28); holder = left; }
      return bytes;
    });
    const snapshot = await inv.census();
    expect(snapshot.processes.map((p: { pid: number }) => p.pid)).toEqual([left, right]);
    for (let pass = 0; pass < 2; pass++) {
      const result = await inv.checkoutReferences(snapshot, f.checkout);
      expect(result.reason).toBe('sequential-reference-observations');
      expect([...result.processes.values()].map((row: { state: string }) => row.state)).toEqual(['no-match', 'no-match']);
      expect(result.coverage).toBe('non-atomic'); // never a certificate of non-ownership
      console.info('reference scan race', JSON.stringify({ pass, left, right, holder, observations: [...result.processes] }));
    }
    const ordinary = inventory([left, right]);
    expect((await ordinary.checkoutReferences(await ordinary.census(), f.checkout)).processes.get(left).state).toBe('reference');
  } finally { await pair.close(); f.close(); }
});

native.each(['denied', 'truncated', 'pid-reused', 'population-changed', 'stale', 'partial', 'objects-changed'])(
  'refuses %s observations instead of minting non-ownership', async fault => {
  const f = fixture(); const child = await worker('mapping', f.file, f.root);
  try {
    const [pid] = child.initial;
    let identities = 0, censuses = 0;
    const inv = inventory([pid], query => async (file, args) => {
      if (file === '/bin/ps' && ++censuses > 1 && fault === 'population-changed') return '';
      if (args[1] === PROCESS_INCARNATION_READER) {
        identities++;
        if (fault === 'denied') return null;
        const text = await query(file, args);
        if (fault === 'pid-reused' && identities === 2) {
          const row = JSON.parse(text!.trim()) as [number, number, string]; row[2] = '1:1'; return `${JSON.stringify(row)}\n`;
        }
        return text;
      }
      const text = await query(file, args);
      if (file === '/usr/sbin/lsof') {
        if (fault === 'truncated') return text!.slice(0, -1);
        if (fault === 'objects-changed') renameSync(f.file, join(f.root, 'moved-out'));
      }
      return text;
    });
    const snapshot: ProcessInventorySnapshot = await inv.census();
    const altered = fault === 'partial' ? { ...snapshot, status: 'partial', omitted: 1 }
      : fault === 'stale' ? { ...snapshot, sourceTime: 0, freshForMs: 1 } : snapshot;
    const result = await inv.checkoutReferences(altered, f.checkout);
    expect(result.processes.get(pid).state).toBe('unknown');
    expect(result.coverage).toBe('non-atomic');
  } finally { await child.close(); f.close(); }
});

native('the existing stop guard interrupts reference observation before another host read', async () => {
  const f = fixture(); const child = await worker('mapping', f.file, f.root);
  try {
    const [pid] = child.initial;
    let stopped = false, readsAfterStop = 0;
    const inv = inventory([pid], query => async (file, args) => {
      if (stopped) readsAfterStop++;
      const result = await query(file, args);
      if (args[1] === PROCESS_INCARNATION_READER) stopped = true;
      return result;
    });
    const snapshot = await inv.census();
    await expect(inv.checkoutReferences(snapshot, f.checkout, () => { if (stopped) throw Error('stopped'); }))
      .rejects.toThrow('stopped');
    expect(readsAfterStop).toBe(0);
  } finally { await child.close(); f.close(); }
});
