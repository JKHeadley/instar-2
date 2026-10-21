import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readlinkSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
// @ts-expect-error Shipped installer JavaScript.
import { updateRoot } from '../../scripts/update.mjs';
const roots: string[] = [];
const scratch = () => { const p = mkdtempSync(join(tmpdir(), 'instar-update-')); roots.push(p); return p; };
const originalCache = process.env.npm_config_cache;
beforeEach(() => { process.env.npm_config_cache = scratch(); });
afterEach(() => {
  if (originalCache === undefined) delete process.env.npm_config_cache; else process.env.npm_config_cache = originalCache;
  roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true }));
});
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
function fixture(version = '0.2.0', body = 'export const migrations = [];', schema = 1) {
  const p = scratch(); mkdirSync(join(p, 'scripts')); mkdirSync(join(p, 'bin'));
  writeFileSync(join(p, 'package.json'), JSON.stringify({ name: '@instar/constitutional-types', version, type: 'module' }));
  writeFileSync(join(p, 'bin/instar2.mjs'), '// fixture launcher\n');
  writeFileSync(join(p, 'scripts/update-release.mjs'), `export const schemaVersion = ${schema};\nexport const readableSchemas = [1, ${schema}];\n${body}\n`);
  return `file:${p}`;
}
it('adopts an unstamped root, backs up settings, installs with npm and repeats without writes', async () => {
  const root = scratch(), source = fixture();
  writeFileSync(join(root, 'model-setting.json'), '{"model":"operator-choice"}');
  const result = await updateRoot(root, { release: 'v0.2.0', source });
  expect(result.status).toBe('updated');
  expect(json(join(result.backup, 'version.json'))).toMatchObject({ version: '0.1.0', status: 'adopted' });
  expect(readlinkSync(join(root, 'current'))).toBe('releases/v0.2.0/node_modules/@instar/constitutional-types');
  expect(json(join(root, 'version.json'))).toMatchObject({ version: '0.2.0', release: 'v0.2.0', status: 'installed' });
  expect(readFileSync(join(root, 'model-setting.json'), 'utf8')).toBe('{"model":"operator-choice"}');
  const before = readFileSync(join(root, 'update-state.json'), 'utf8');
  expect((await updateRoot(root, { release: 'v0.2.0', source: 'file:/does-not-exist' })).status).toBe('unchanged');
  expect(readFileSync(join(root, 'update-state.json'), 'utf8')).toBe(before);
});
it('records migration intent before effect; a failed migration resumes without flipping or changing the stamp', async () => {
  const root = scratch();
  await updateRoot(root, { release: 'v0.2.0', source: fixture() });
  const before = readFileSync(join(root, 'version.json'), 'utf8'), pointer = readlinkSync(join(root, 'current'));
  const source = fixture('0.3.0', `import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
export const migrations = [{ id: '001-example', async run(root) {
  const state = JSON.parse(readFileSync(join(root, 'update-state.json'), 'utf8'));
  if (state.steps[0].status !== 'started') throw Error('intent missing');
  writeFileSync(join(root, 'effect.json'), 'one idempotent effect');
  if (!existsSync(join(root, 'allow-completion'))) throw Error('injected crash');
} }];`);
  await expect(updateRoot(root, { release: 'v0.3.0', source })).rejects.toThrow('injected crash');
  expect(readFileSync(join(root, 'version.json'), 'utf8')).toBe(before);
  expect(readlinkSync(join(root, 'current'))).toBe(pointer);
  expect(json(join(root, 'update-state.json')).steps).toEqual([{ id: '001-example', status: 'started' }]);
  writeFileSync(join(root, 'allow-completion'), 'yes');
  await updateRoot(root, { release: 'v0.3.0', source });
  expect(json(join(root, 'update-state.json')).steps[0].status).toBe('done');
  expect(json(join(root, 'version.json')).version).toBe('0.3.0');
});
it('refuses an incompatible downgrade and permits a readable older release', async () => {
  const root = scratch(); await updateRoot(root, { release: 'v0.3.0', source: fixture('0.3.0', undefined, 2) });
  const before = readFileSync(join(root, 'version.json'), 'utf8');
  await expect(updateRoot(root, { release: 'v0.1.0', source: fixture('0.1.0') })).rejects.toThrow('cannot read');
  expect(readFileSync(join(root, 'version.json'), 'utf8')).toBe(before);
  await updateRoot(root, { release: 'v0.2.0', source: fixture('0.2.0', undefined, 2) });
  expect(json(join(root, 'version.json')).version).toBe('0.2.0');
});
it('the shipped CLI accepts update and rejects malformed options without touching a root', () => {
  const root = join(scratch(), 'absent');
  const r = spawnSync(process.execPath, ['bin/instar2.mjs', 'update', root, '--release', '../escape'], { encoding: 'utf8' });
  expect(r.status).toBe(1); expect(r.stderr).toContain('release'); expect(existsSync(root)).toBe(false);
});

it('runs the shipped command through a real npm file install without network access', () => {
  const root = scratch(), source = fixture(), shim = scratch();
  const npm = execFileSync('which', ['npm'], { encoding: 'utf8' }).trim();
  writeFileSync(join(shim, 'npm'), `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
writeFileSync(process.env.UPDATE_ARGS, JSON.stringify(args));
args[args.length - 1] = process.env.UPDATE_FIXTURE;
const child = spawnSync(${JSON.stringify(npm)}, args, { stdio: 'inherit' });
process.exit(child.status ?? 1);
`);
  writeFileSync(join(shim, 'package.json'), '{"type":"module"}'); chmodSync(join(shim, 'npm'), 0o700);
  const args = join(shim, 'arguments.json');
  const run = () => spawnSync(process.execPath, ['bin/instar2.mjs', 'update', root, '--release', 'v0.2.0'], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, PATH: `${shim}:${process.env.PATH}`, UPDATE_ARGS: args, UPDATE_FIXTURE: source },
  });
  const first = run(); expect(first.status, first.stderr).toBe(0); expect(first.stdout).toContain('Update installed');
  expect(json(args).at(-1)).toBe('github:JKHeadley/instar-2#v0.2.0');
  expect(json(join(root, 'version.json')).version).toBe('0.2.0');
  expect(run().stdout).toContain('Already on this release');
});
it('resumes a real process death mid-list and skips the completed migration', async () => {
  const root = scratch();
  const source = fixture('0.2.0', `import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export const migrations = [
 { id: '001-once', run(root) { const p = join(root, 'count'); writeFileSync(p, String(Number(existsSync(p) ? readFileSync(p, 'utf8') : 0) + 1)); } },
 { id: '002-resume', run(root) { const p = join(root, 'crashed'); if (!existsSync(p)) { writeFileSync(p, 'yes'); process.exit(17); } } }
];`);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { updateRoot } from ${JSON.stringify('file:' + resolve('scripts/update.mjs'))}; await updateRoot(process.argv[1], { release: 'v0.2.0', source: process.argv[2] });`, root, source],
    { encoding: 'utf8', timeout: 30000 });
  expect(child.status, child.stderr).toBe(17);
  expect(existsSync(join(root, 'current'))).toBe(false);
  expect(json(join(root, 'version.json')).status).toBe('adopted');
  expect(json(join(root, 'update-state.json')).steps.map((s: {status: string}) => s.status)).toEqual(['done', 'started']);
  await updateRoot(root, { release: 'v0.2.0', source });
  expect(readFileSync(join(root, 'count'), 'utf8')).toBe('1');
  expect(json(join(root, 'version.json')).migrations).toEqual(['001-once', '002-resume']);
});
it('refuses a concurrent updater while preserving the owner and resumes after it completes', async () => {
  const root = scratch(), source = fixture('0.2.0', `export const migrations = [{ id: '001-wait', async run() { await new Promise(resolve => setTimeout(resolve, 100)); } }];`);
  const first = updateRoot(root, { release: 'v0.2.0', source });
  await expect(updateRoot(root, { release: 'v0.2.0', source })).rejects.toThrow('Another update is running');
  await first;
  expect((await updateRoot(root, { release: 'v0.2.0', source })).status).toBe('unchanged');
});
it('refuses unordered migrations before effect and retains the existing release on install failure', async () => {
  const root = scratch(); await updateRoot(root, { release: 'v0.2.0', source: fixture() });
  const before = readFileSync(join(root, 'version.json'), 'utf8'), pointer = readlinkSync(join(root, 'current'));
  await expect(updateRoot(root, { release: 'bad', source: 'file:/nonexistent-update-fixture' })).rejects.toThrow('installation failed');
  const source = fixture('0.3.0', "export const migrations = [{ id: 'b', run() { throw Error('effect ran'); } }, { id: 'a', run() {} }];");
  await expect(updateRoot(root, { release: 'v0.3.0', source })).rejects.toThrow('unique ordered ids');
  expect(readFileSync(join(root, 'version.json'), 'utf8')).toBe(before);
  expect(readlinkSync(join(root, 'current'))).toBe(pointer);
});
it('repairs a crash between pointer and stamp publication without replaying completed effects', async () => {
  const root = scratch(), source = fixture(); await updateRoot(root, { release: 'v0.2.0', source });
  const state = json(join(root, 'update-state.json'));
  writeFileSync(join(root, 'version.json'), JSON.stringify(state.previous));
  state.phase = 'activating'; writeFileSync(join(root, 'update-state.json'), JSON.stringify(state));
  await updateRoot(root, { release: 'v0.2.0', source });
  expect(json(join(root, 'version.json')).version).toBe('0.2.0');
  expect(json(join(root, 'update-state.json')).phase).toBe('complete');
});
it('keeps history and skips applied migration ids across releases; malformed stamps remain untouched', async () => {
  const root = scratch();
  await updateRoot(root, { release: 'v0.2.0', source: fixture('0.2.0', "export const migrations = [{ id: '001', run() {} }];") });
  const prior = json(join(root, 'update-state.json'));
  await updateRoot(root, { release: 'v0.3.0', source: fixture('0.3.0', "export const migrations = [{ id: '001', run() { throw Error('repeated'); } }];") });
  expect(json(join(root, 'update-history', `${prior.id}.json`))).toEqual(prior);
  writeFileSync(join(root, 'version.json'), '{broken');
  await expect(updateRoot(root, { release: 'v0.3.0' })).rejects.toThrow();
  expect(readFileSync(join(root, 'version.json'), 'utf8')).toBe('{broken');
});
