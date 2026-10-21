// Machine-local installer boundary. No model calls, restarts, sends or policy edits.
import { closeSync, cpSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, readlinkSync, renameSync, rmdirSync, unlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { schemaVersion } from './update-release.mjs';
import { assertAgentPaths } from './agent-paths.mjs';

const packageInfo = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const load = path => JSON.parse(readFileSync(path, 'utf8'));
const sync = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function save(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  sync(temporary); renameSync(temporary, path); sync(dirname(path));
}
function flushTree(path) {
  if (lstatSync(path).isSymbolicLink()) return;
  if (lstatSync(path).isDirectory()) for (const entry of readdirSync(path)) flushTree(join(path, entry));
  sync(path);
}
export function releaseTag(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw Error('Invalid release tag');
  return value;
}
function stampValid(stamp) {
  if (!stamp || typeof stamp.version !== 'string' || !Number.isSafeInteger(stamp.schema) || stamp.schema < 1
    || !Array.isArray(stamp.migrations) || !stamp.migrations.every(id => typeof id === 'string')) throw Error('Invalid version stamp; preserved for repair');
}
function install(root, release, source) {
  const destination = join(root, 'releases', release);
  if (!existsSync(destination)) {
    const stage = join(root, 'releases', `.install-${randomUUID()}`);
    mkdirSync(stage, { recursive: true, mode: 0o700 });
    // npm's own git installer; ignore lifecycle scripts so staging cannot mutate the root.
    // Output is intentionally not forwarded: git/npm diagnostics may contain credentials.
    const result = spawnSync('npm', ['install', '--prefix', stage, '--ignore-scripts', '--no-audit', '--no-fund', '--install-links', '--', source],
      { encoding: 'utf8', timeout: 300000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status !== 0) throw Error('Release installation failed; current release retained');
    save(join(stage, 'release-source.json'), { release, source });
    flushTree(stage); renameSync(stage, destination); sync(dirname(destination));
  }
  return join(destination, 'node_modules', packageInfo.name);
}
function backupRoot(root, id) {
  const parent = join(root, 'backups'); mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temporary = join(parent, `.pending-${id}`), destination = join(parent, id);
  mkdirSync(temporary, { mode: 0o700 });
  for (const name of readdirSync(root)) {
    if (['releases', 'backups', 'current', '.update-lock', 'update-state.json'].includes(name)) continue;
    cpSync(join(root, name), join(temporary, name), { recursive: true, dereference: false, verbatimSymlinks: true, preserveTimestamps: true });
  }
  flushTree(temporary); renameSync(temporary, destination); sync(parent);
  return destination;
}

export async function updateRoot(directory, options = {}) {
  const release = releaseTag(options.release ?? `v${packageInfo.version}`);
  // source is a programmatic test seam; the public CLI only installs the named GitHub tag.
  const source = options.source ?? `github:JKHeadley/instar-2#${release}`;
  const root = resolve(directory);
  assertAgentPaths({ root });
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const lock = join(root, '.update-lock');
  // Same unique-owner reclamation as judgment-captures: only a proven dead local
  // PID's unique marker can be removed; an ambiguous owner fails closed.
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const names = readdirSync(lock);
    if (names.length !== 1 || !/^owner-[a-f0-9-]{36}\.json$/.test(names[0])) throw Error('Update lock owner unknown');
    const marker = join(lock, names[0]), owner = load(marker);
    if (owner.host !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || names[0] !== `owner-${owner.id}.json`)
      throw Error('Update lock owner unknown');
    try { process.kill(owner.pid, 0); throw Error('Another update is running'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    unlinkSync(marker); rmdirSync(lock); mkdirSync(lock, { mode: 0o700 });
  }
  const owner = { id: randomUUID(), pid: process.pid, host: hostname() };
  const marker = join(lock, `owner-${owner.id}.json`);
  try { save(marker, owner); return await apply(root, release, source); }
  finally { if (existsSync(marker)) unlinkSync(marker); rmdirSync(lock); sync(root); }
}
async function apply(root, release, source) {
  const versionPath = join(root, 'version.json'), statePath = join(root, 'update-state.json');
  if (!existsSync(versionPath)) save(versionPath, { version: packageInfo.version, schema: schemaVersion, status: 'adopted', migrations: [] });
  const previous = load(versionPath); stampValid(previous);
  const target = `releases/${release}/node_modules/${packageInfo.name}`;
  const current = join(root, 'current');
  const pointer = existsSync(current) ? readlinkSync(current) : null;
  let state = existsSync(statePath) ? load(statePath) : null;
  if (previous.release === release && pointer === target && state?.phase === 'complete') return { status: 'unchanged', release };
  if (state && state.phase !== 'complete' && state.release !== release) throw Error('Resume the interrupted release before selecting another');
  const installed = install(root, release, source);
  const pkg = load(join(installed, 'package.json'));
  if (pkg.name !== packageInfo.name || typeof pkg.version !== 'string' || !existsSync(join(installed, 'bin/instar2.mjs'))) throw Error('Invalid installed release');
  const manifest = await import(pathToFileURL(join(installed, 'scripts/update-release.mjs')).href);
  if (!Number.isSafeInteger(manifest.schemaVersion) || manifest.schemaVersion < 1 || !Array.isArray(manifest.readableSchemas)
    || !manifest.readableSchemas.includes(previous.schema)) throw Error('Release cannot read the existing state schema; downgrade refused');
  if (!Array.isArray(manifest.migrations) || manifest.migrations.some((m, i, all) => !m || typeof m.id !== 'string' || !m.id
    || typeof m.run !== 'function' || (i > 0 && all[i - 1].id >= m.id))) throw Error('Migrations must have unique ordered ids');
  if (!state || state.phase === 'complete') {
    if (state) {
      const history = join(root, 'update-history'); mkdirSync(history, { recursive: true, mode: 0o700 });
      save(join(history, `${state.id}.json`), state);
    }
    const id = randomUUID(), backup = backupRoot(root, id);
    state = { id, release, backup, previous, priorCurrent: pointer, phase: 'migrating', steps: [], next: null };
    save(statePath, state);
  }
  const ids = new Set(state.previous.migrations);
  for (const migration of manifest.migrations) {
    if (ids.has(migration.id)) continue;
    let step = state.steps.find(s => s.id === migration.id);
    if (!step) { step = { id: migration.id, status: 'started' }; state.steps.push(step); save(statePath, state); }
    if (step.status !== 'done') {
      await migration.run(root);
      step.status = 'done'; save(statePath, state);
    }
    ids.add(migration.id);
  }
  state.next = { version: pkg.version, release, schema: Math.max(state.previous.schema, manifest.schemaVersion), status: 'installed', migrations: [...ids] };
  state.phase = 'activating'; save(statePath, state);
  const temporary = join(root, `.current-${randomUUID()}`);
  symlinkSync(target, temporary); renameSync(temporary, current); sync(root);
  save(versionPath, state.next);
  state.phase = 'complete'; save(statePath, state);
  return { status: 'updated', release, backup: state.backup };
}
