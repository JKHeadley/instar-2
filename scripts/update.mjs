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
let candidateBinding;
let runtimeBound = false;
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
// Adapted from 1.x UpdateChecker.validateCandidate: inspect the installed bytes,
// never npm's exit code or a prior success stamp alone (Rules 26/42/95).
function candidateIdentity(installed, release) {
  const pkg = load(join(installed, 'package.json'));
  const cli = join(installed, 'bin/instar2.mjs');
  if (pkg.name !== packageInfo.name || typeof pkg.version !== 'string' || !existsSync(cli))
    throw Error('Invalid installed release');
  if (/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release) && pkg.version !== release.slice(1))
    throw Error('Installed version does not match the requested release; current release retained');
  return pkg;
}
// The admitted runner supplies its existing resource owner. The standalone
// installer retains its host invocation until that command has a durable owner.
async function executeCommand(input, execute) {
  if (execute) return execute(input);
  const result = spawnSync(input.executable, input.args, { cwd: input.cwd, timeout: input.timeout,
    maxBuffer: input.maxBytes, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { code: result.status, signal: result.signal, limited: Boolean(result.error), stdout: result.stdout };
}
async function validateCandidate(installed, release, execute) {
  const pkg = candidateIdentity(installed, release);
  const probe = await executeCommand({ executable: process.execPath, args: ['--check', join(installed, 'bin/instar2.mjs')],
    cwd: installed, timeout: 10000, maxBytes: 1024 * 1024 }, execute);
  if (probe.code !== 0 || probe.limited || probe.cancellationReason) throw Error('Installed CLI syntax check failed; current release retained');
  return pkg;
}
async function verified(migration, root) {
  const result = await migration.verify(root);
  if (typeof result !== 'boolean') throw Error('Migration verification must return a boolean');
  return result;
}
async function install(root, release, source, execute) {
  const destination = join(root, 'releases', release);
  if (!existsSync(destination)) {
    const stage = join(root, 'releases', `.install-${randomUUID()}`);
    mkdirSync(stage, { recursive: true, mode: 0o700 });
    // npm's own git installer; ignore lifecycle scripts so staging cannot mutate the root.
    // Output is intentionally not forwarded: git/npm diagnostics may contain credentials.
    const result = await executeCommand({ executable: 'npm', args: ['install', '--prefix', stage, '--ignore-scripts', '--no-audit', '--no-fund', '--install-links', '--', source],
      cwd: stage, timeout: 300000, maxBytes: 1024 * 1024 }, execute);
    if (result.code !== 0 || result.limited || result.cancellationReason) throw Error('Release installation failed; current release retained');
    // 1.x validates in shadow-install.pending before promotion. Keep this same
    // ordering: a bad candidate must not poison the reusable release directory.
    await validateCandidate(join(stage, 'node_modules', packageInfo.name), release, execute);
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
  await initializeUpdateRuntime();
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const releaseLock = acquireUpdateLock(root);
  try { return await apply(root, release, source, options.execute, options.fallbackSchemas); }
  finally { releaseLock(); }
}
export async function initializeUpdateRuntime() {
  if (!candidateBinding) candidateBinding = (async () => {
    const { register } = await import('node:module');
    register('./slice-ts-loader.mjs', import.meta.url);
    return import('./update-governance.mjs');
  })();
  const { bindUpdateCheckpoints } = await candidateBinding;
  bindUpdateCheckpoints(load(new URL('./update.declarations.json', import.meta.url)));
  runtimeBound = true;
}
function acquireUpdateLock(root) {
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
  save(marker, owner);
  return () => { if (existsSync(marker)) unlinkSync(marker); rmdirSync(lock); sync(root); };
}

async function apply(root, release, source, execute, fallbackSchemas) {
  const versionPath = join(root, 'version.json'), statePath = join(root, 'update-state.json');
  if (!existsSync(versionPath)) save(versionPath, { version: packageInfo.version, schema: schemaVersion, status: 'adopted', migrations: [] });
  const previous = load(versionPath); stampValid(previous);
  const target = `releases/${release}/node_modules/${packageInfo.name}`;
  const current = join(root, 'current');
  const pointer = existsSync(current) ? readlinkSync(current) : null;
  let state = existsSync(statePath) ? load(statePath) : null;
  if (state && !['complete', 'observing'].includes(state.phase) && state.release !== release) throw Error('Resume the interrupted release before selecting another');
  const installed = await install(root, release, source, execute);
  const pkg = await validateCandidate(installed, release, execute);
  const manifest = await releaseManifest(installed);
  if (!Number.isSafeInteger(manifest.schemaVersion) || manifest.schemaVersion < 1 || !Array.isArray(manifest.readableSchemas)
    || !manifest.readableSchemas.includes(previous.schema)) throw Error('Release cannot read the existing state schema; downgrade refused');
  if (fallbackSchemas !== undefined && (!Array.isArray(fallbackSchemas)
    || !fallbackSchemas.includes(Math.max(previous.schema, manifest.schemaVersion))))
    throw Error('Automatic update would make the prior runner unable to read state; current release retained');
  // Adapt MigratorStepEngine.registerStep (Instar 1.x): unique names, registration
  // order, idempotent workers. An id identifies a step; it does not sort the list.
  if (!Array.isArray(manifest.migrations) || manifest.migrations.some(m => !m || typeof m.id !== 'string' || !m.id
    || typeof m.run !== 'function' || (m.verify !== undefined && typeof m.verify !== 'function'))
    || new Set(manifest.migrations.map(m => m.id)).size !== manifest.migrations.length)
    throw Error('Migrations must have unique ids and callable workers');
  // The 1.x migrator checks deployed content on every refresh. A completed id
  // cannot stand for still-current bytes: verify repeatable migrations again.
  const drifted = new Set();
  for (const migration of manifest.migrations) {
    if (migration.verify && !await verified(migration, root)) drifted.add(migration.id);
  }
  if (previous.release === release && pointer === target && state?.phase === 'complete' && drifted.size === 0)
    return { status: 'unchanged', release };
  if (!state || ['complete', 'observing'].includes(state.phase)) {
    if (state?.id) {
      const history = join(root, 'update-history'); mkdirSync(history, { recursive: true, mode: 0o700 });
      save(join(history, `${state.id}.json`), state);
    }
    const id = randomUUID(), backup = backupRoot(root, id);
    state = { id, release, backup, previous, priorCurrent: pointer, phase: 'migrating', steps: [], next: null, ...(state?.runtime ? { runtime: state.runtime } : {}) };
    save(statePath, state);
  }
  const ids = new Set(state.previous.migrations);
  // Same pending-step shape as 1.x runPendingSteps: traverse registration order
  // and skip persisted completions. Here intent must precede effects, interrupted
  // steps retry, and errors stop activation; never record a failure as completed.
  for (const migration of manifest.migrations) {
    if (ids.has(migration.id) && !drifted.has(migration.id)) continue;
    let step = state.steps.find(s => s.id === migration.id);
    if (!step) { step = { id: migration.id, status: 'started' }; state.steps.push(step); save(statePath, state); }
    if (step.status === 'done' && drifted.has(migration.id)) {
      step.status = 'started'; save(statePath, state);
    }
    if (step.status !== 'done') {
      await migration.run(root);
      if (migration.verify && !await verified(migration, root))
        throw Error('Migration postcondition failed; update remains incomplete');
      step.status = 'done'; save(statePath, state);
    }
    ids.add(migration.id);
  }
  // A later step may invalidate an earlier template. Inspect the final consumer
  // state too, before publishing either the pointer or the installed stamp.
  for (const migration of manifest.migrations) {
    if (migration.verify && !await verified(migration, root))
      throw Error('Migration postcondition failed; update remains incomplete');
  }
  state.next = { version: pkg.version, release, schema: Math.max(state.previous.schema, manifest.schemaVersion), status: 'installed', migrations: [...ids] };
  state.phase = 'activating'; save(statePath, state);
  const temporary = join(root, `.current-${randomUUID()}`);
  symlinkSync(target, temporary); renameSync(temporary, current); sync(root);
  save(versionPath, state.next);
  state.phase = 'complete'; save(statePath, state);
  return { status: 'updated', release, backup: state.backup };
}
async function releaseManifest(installed) {
  return import(pathToFileURL(join(installed, 'scripts/update-release.mjs')).href);
}
/** Reopen a previously healthy release after supervisor recreation. Compatibility
 * is checked against today's state; a prior health record cannot lower its schema. */
export async function readableUpdateRelease(root, release) {
  const directory = join(root, 'releases', releaseTag(release), 'node_modules', packageInfo.name);
  const pkg = candidateIdentity(directory, release), stamp = load(join(root, 'version.json'));
  stampValid(stamp);
  const manifest = await releaseManifest(directory);
  if (!Array.isArray(manifest.readableSchemas) || !manifest.readableSchemas.length
    || manifest.readableSchemas.some(schema => !Number.isSafeInteger(schema) || schema < 1))
    throw Error('Malformed prior release compatibility; preserved for repair');
  if (!manifest.readableSchemas.includes(stamp.schema))
    throw new UpdateSchemaRefused('Prior runner cannot read the current state schema');
  return { directory, version: pkg.version, release };
}
export class UpdateSchemaRefused extends Error {}

// One transaction holder and one writer lock for installation, restart and findings.
// Runtime data is observation/request state, never authority or installation facts.
export function readUpdateRuntime(root) {
  const file = join(root, 'update-state.json');
  if (!existsSync(file)) return {};
  const state = load(file);
  if (!state || typeof state !== 'object' || Array.isArray(state) || !['complete', 'migrating', 'activating', 'observing'].includes(state.phase))
    throw Error('Invalid update transaction; preserved for repair');
  if (state.runtime !== undefined && (!state.runtime || typeof state.runtime !== 'object' || Array.isArray(state.runtime)))
    throw Error('Invalid update runtime record; preserved for repair');
  return state.runtime ?? {};
}
function mutateUpdateRuntime(root, change) {
  if (!runtimeBound) throw Error('Update checkpoint must be bound before runtime writes');
  assertAgentPaths({ root });
  const releaseLock = acquireUpdateLock(root);
  try {
    const file = join(root, 'update-state.json');
    const runtime = readUpdateRuntime(root);
    const state = existsSync(file) ? load(file) : { phase: 'observing' };
    const next = change(runtime);
    if (next === null) return false;
    save(file, { ...state, runtime: next });
    return true;
  } finally { releaseLock(); }
}
export function writeUpdateRuntime(root, key, value) {
  return mutateUpdateRuntime(root, runtime => ({ ...runtime, [key]: value }));
}
// Explicit local maintenance, like resumeJournal: compare the observed pause while
// holding the same writer lock. A stale request, stop latch or non-paused state refuses.
export function resumeAutomaticUpdate(root, expectedPausedAt) {
  if (!Number.isSafeInteger(expectedPausedAt) || existsSync(join(root, 'preview-stop.json'))) return false;
  return mutateUpdateRuntime(root, runtime => {
    const updater = runtime.updater;
    if (!updater || updater.failureState?.pausedAt !== expectedPausedAt) return null;
    return { ...runtime, updater: { ...updater, failureState: null, nextAttemptAt: 0,
      resumed: { at: Date.now(), previous: updater.failureState } } };
  });
}
export function installedUpdate(root) {
  const statePath = join(root, 'update-state.json');
  if (!existsSync(statePath)) return null;
  const state = load(statePath);
  if (state.phase !== 'complete') return null;
  const version = load(join(root, 'version.json'));
  stampValid(version);
  const expected = `releases/${releaseTag(state.release)}/node_modules/${packageInfo.name}`;
  if (readlinkSync(join(root, 'current')) !== expected || version.release !== state.release
    || version.version !== state.next?.version) throw Error('Installed update transaction disagrees with current release');
  const directory = join(root, expected);
  // No process is launched by a status/idle-boundary read. Installation checks
  // syntax through its resource owner; only a new admitted poll proves health.
  const pkg = candidateIdentity(directory, state.release);
  if (pkg.version !== version.version) throw Error('Installed bytes disagree with version stamp');
  return { directory, version: pkg.version, release: state.release, transaction: state.id };
}
