// Row 87: the standalone update command launches npm and the syntax check through the
// real resource owner. These run the shipped CLI with real processes; only npm's source
// is redirected to a local fixture, so no network or release is needed.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
// @ts-expect-error Shipped installer JavaScript.
import { ownedUpdateExecutor, standaloneExecutor, updateRoot } from '../../scripts/update.mjs';
// @ts-expect-error Shipped host adapter JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';

const roots: string[] = [], started: number[] = [];
const scratch = () => { const p = mkdtempSync(join(tmpdir(), 'instar-update-')); roots.push(p); return p; };
const originalCache = process.env.npm_config_cache;
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const pause = (ms: number) => new Promise(done => setTimeout(done, ms));
async function until(check: () => boolean, ms = 20000) {
  const deadline = performance.now() + ms;
  while (!check()) { if (performance.now() > deadline) throw Error('condition not reached'); await pause(25); }
}
const gone = async (pid: number) => { started.push(pid); await until(() => !alive(pid), 3000).catch(() => undefined); return !alive(pid); };
beforeEach(() => { process.env.npm_config_cache = scratch(); });
afterEach(() => {
  if (originalCache === undefined) delete process.env.npm_config_cache; else process.env.npm_config_cache = originalCache;
  // Exact PIDs this test started; a surviving process is what a failing run leaves.
  for (const pid of started.splice(0)) try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true }));
});
function fixture() {
  const p = scratch(); mkdirSync(join(p, 'scripts')); mkdirSync(join(p, 'bin'));
  writeFileSync(join(p, 'package.json'), JSON.stringify({ name: '@instar/constitutional-types', version: '0.2.0', type: 'module' }));
  cpSync('bin/instar2.mjs', join(p, 'bin/instar2.mjs'));
  writeFileSync(join(p, 'scripts/update-release.mjs'), 'export const schemaVersion = 1;\nexport const readableSchemas = [1];\nexport const migrations = [];\n');
  return `file:${p}`;
}
/** An `npm` that runs `body`, then the real install of the local fixture. */
function shim(body: string) {
  const directory = scratch(), npm = execFileSync('which', ['npm'], { encoding: 'utf8' }).trim();
  writeFileSync(join(directory, 'npm'), `#!${process.execPath}
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2), mark = process.env.UPDATE_MARK;
${body}
args[args.length - 1] = process.env.UPDATE_FIXTURE;
process.exit(spawnSync(${JSON.stringify(npm)}, args, { stdio: 'ignore' }).status ?? 1);
`);
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}'); chmodSync(join(directory, 'npm'), 0o700);
  return directory;
}
const environment = (directory: string, mark: string, source: string) => ({ ...process.env,
  PATH: `${directory}:${process.env.PATH}`, UPDATE_MARK: mark, UPDATE_FIXTURE: source });
const command = (root: string) => ['bin/instar2.mjs', 'update', root, '--release', 'v0.2.0'];

it('the update command ends a helper that npm leaves behind, in its own session', async () => {
  const root = scratch(), mark = join(scratch(), 'helper'), source = fixture();
  const npm = shim(`const helper = spawn('/bin/sleep', ['120'], { detached: true, stdio: 'ignore' });
helper.unref(); writeFileSync(mark, String(helper.pid));`);
  const run = spawnSync(process.execPath, command(root), { encoding: 'utf8', timeout: 60000, env: environment(npm, mark, source) });
  expect(run.status, run.stderr).toBe(0);
  expect(run.stdout).toContain('Update installed');
  expect(run.stderr).not.toContain('confirmed gone');
  expect(JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version).toBe('0.2.0');
  expect(await gone(Number(readFileSync(mark, 'utf8')))).toBe(true);
}, 90000);

it('stopping the update command ends the install, keeps the current release, and the next run succeeds', async () => {
  const root = scratch(), mark = join(scratch(), 'npm'), source = fixture();
  const hung = shim(`writeFileSync(mark, String(process.pid)); await new Promise(done => setTimeout(done, 120000));`);
  const child = spawn(process.execPath, command(root), { env: environment(hung, mark, source), stdio: ['ignore', 'pipe', 'pipe'] });
  started.push(child.pid!);
  let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; });
  const closed = new Promise<number | null>(done => child.once('close', code => done(code)));
  await until(() => existsSync(mark));
  const npmPid = Number(readFileSync(mark, 'utf8'));
  child.kill('SIGTERM');
  const code = await Promise.race([closed, pause(15000).then(() => 'still running')]);
  expect(await gone(npmPid)).toBe(true);
  expect(code).toBe(1);
  expect(stderr).toContain('Update stopped');
  expect(existsSync(join(root, 'current'))).toBe(false);
  expect(existsSync(join(root, '.update-lock'))).toBe(false);
  const next = spawnSync(process.execPath, command(root), { encoding: 'utf8', timeout: 60000, env: environment(shim(''), mark, source) });
  expect(next.status, next.stderr).toBe(0);
  expect(JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version).toBe('0.2.0');
}, 90000);

it('a launch the resource owner refuses never runs npm and keeps the current release', async () => {
  const root = scratch(), mark = join(scratch(), 'ran');
  let offset = 0;
  const owner = createResourceOwner({ ...RESOURCE_CEILINGS, aggregate: { ...RESOURCE_CEILINGS.aggregate, launches: 1 } });
  await owner.attach({ now: () => Date.now() + offset });
  const previous = process.env.PATH;
  process.env.PATH = `${shim('writeFileSync(mark, "ran");')}:${previous}`; process.env.UPDATE_MARK = mark;
  const attempt = updateRoot(root, { release: 'v0.2.0', source: fixture(), execute: ownedUpdateExecutor(owner, () => false) });
  try {
    await until(() => owner.snapshot().waiting.length === 1);
    offset = 3600000;
    await expect(attempt).rejects.toThrow('Release installation failed');
  } finally { process.env.PATH = previous; delete process.env.UPDATE_MARK; }
  expect(owner.snapshot().counters.refusedCapacity).toBe(1);
  expect(existsSync(mark)).toBe(false);
  expect(existsSync(join(root, 'current'))).toBe(false);
  expect(existsSync(join(root, '.update-lock'))).toBe(false);
}, 30000);

it('the same owner composition admits the launch when it has room', async () => {
  const root = scratch(), mark = join(scratch(), 'ran'), owner = createResourceOwner();
  await owner.attach();
  const previous = process.env.PATH;
  process.env.PATH = `${shim('writeFileSync(mark, "ran");')}:${previous}`;
  Object.assign(process.env, { UPDATE_MARK: mark, UPDATE_FIXTURE: fixture() });
  try {
    const result = await updateRoot(root, { release: 'v0.2.0', source: resolve('unused'), execute: ownedUpdateExecutor(owner, () => false) });
    expect(result.status).toBe('updated');
  } finally { process.env.PATH = previous; delete process.env.UPDATE_MARK; delete process.env.UPDATE_FIXTURE; }
  expect(readFileSync(mark, 'utf8')).toBe('ran');
  expect(owner.snapshot().counters).toMatchObject({ admitted: 3, completed: 3, refusedCapacity: 0 });
  expect(owner.snapshot().lastLaunch.work).toBe('maintenance');
}, 60000);

it('says so when a launch cannot be confirmed cleaned up, and still returns the launch result', async () => {
  const owner = createResourceOwner();
  await owner.attach({ query: async () => null });
  const written: string[] = [], write = process.stderr.write;
  process.stderr.write = ((text: string) => { written.push(text); return true; }) as typeof process.stderr.write;
  try {
    const result = await standaloneExecutor(owner)({ executable: '/usr/bin/true', args: [], cwd: scratch(), timeout: 10000, maxBytes: 1024 });
    expect(result.code).toBe(0);
    expect(result.resources.cleanup).toBe('unresolved');
  } finally { process.stderr.write = write; }
  expect(written.join('')).toContain('could not be confirmed gone');
}, 30000);
