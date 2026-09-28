// Rules 2, 5, 55, 63, 115 (D14 §§3–4, 9; D17 §2): the self-hosting harness composition. The
// public native adapter (`createNativeHarnessAdapter`) admits every launch and records every
// observation; its Eight-owned driver runs model-generated code only inside Eight's shipped
// confinement profile (deploy/macos/fixed-worker/worker.sb: deny by default, no writes, no
// network, no children, exec of the pinned runtime only) with an empty environment and a hard
// wall/memory bound, so generated code never runs in, or reads from, the credential-bearing
// launcher. Fixed-argv repository tools run on the host with a scrubbed environment plus only the
// credentials the owner resolves for them. This file owns process, clock and filesystem.
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, constants, copyFileSync, existsSync, linkSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync,
  renameSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { hashBytes } from '../../src/facts/index.js';
import { admitToolProposal, createNativeHarnessAdapter, decodeAssemblyRecord } from '../../src/assembly/index.js';
import { redact } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './durable-write.js';
import { SELF_HOST_HARNESS, SELF_HOST_STALL_COVERAGE } from './stall-coverage.js';

export const CONFINEMENT_LIMITS = Object.freeze({ wallMs: 20000, memoryMb: 256, outputBytes: 4096, hostToolMs: 600000 });
const WORKER_PROFILE = new URL('../../deploy/macos/fixed-worker/worker.sb', import.meta.url);
const take = result => { if (result.kind !== 'Success') throw Error(`self-host: refused ${result.detail ?? ''}`); return result.value; };
const tail = text => redact(String(text ?? '')).text.slice(-CONFINEMENT_LIMITS.outputBytes);
const fsyncDirectory = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };

/** One fsynced JSONL append; a leading newline isolates a torn earlier line. */
export function appendDurable(path, row) {
  const fresh = !existsSync(path);
  const fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try { const line = Buffer.from(`\n${JSON.stringify(row)}\n`); let written = 0; while (written < line.length) written += writeSync(fd, line, written); fsyncSync(fd); }
  finally { closeSync(fd); }
  if (fresh) fsyncDirectory(dirname(path));
}
/** Complete rows only; a torn final line is ignored, never guessed at. */
export function readDurable(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').flatMap(line => { if (!line) return []; try { return [JSON.parse(line)]; } catch { return []; } });
}

/** The operator's stop latch, in the preview's format; read at every gate. */
export const stopLatchPath = root => join(root, 'preview-stop.json');
export const stoppedAt = root => () => existsSync(stopLatchPath(root));
export function latchStop(root, at, reason = 'operator') { if (!existsSync(stopLatchPath(root))) durablePreviewWrite(stopLatchPath(root), { latchedAt: at, reason }); }

/**
 * The assembly record log: owner-decoded LocalCapabilityPackage, PackageTransition and
 * HarnessObservation records, appended durably and re-decoded on every read. Rows are shaped for
 * the owner's `resolveActivePackage`; two records with one id and different bytes are a conflict.
 */
export function openRecordLog(root, context) {
  const path = join(root, 'assembly.jsonl');
  const records = () => readDurable(path).map(row => take(decodeAssemblyRecord(row?.record?.type, row.record, context)));
  return Object.freeze({
    append(record) { const decoded = take(decodeAssemblyRecord(record.type, record, context)); appendDurable(path, { record: decoded }); return decoded; },
    records,
    rows() {
      const all = records(), bytes = new Map();
      for (const record of all) { const text = JSON.stringify(record); const seen = bytes.get(record.id); bytes.set(record.id, seen && seen !== text ? null : text); }
      return all.map(record => ({ fact: { id: record.id, kind: `assembly-${record.type}` }, record, taint: [],
        conflicts: bytes.get(record.id) === null ? [{ key: record.id, kind: 'immutable-disagreement', facts: [record.id], detail: 'one id, different bytes' }] : [] }));
    },
  });
}

/**
 * Eight's confinement for generated code: the shipped worker profile, materialized for this root
 * (the only substitutions are its two path tokens and the ancestor metadata of this release path),
 * and the pinned runtime inside the release. Everything the child may read lives in the release.
 */
export function confinedRelease(root) {
  const release = join(root, 'release'), slot = join(root, 'release-slot'), runtime = join(release, 'runtime', 'node');
  mkdirSync(join(release, 'runtime'), { recursive: true, mode: 0o700 }); mkdirSync(slot, { recursive: true, mode: 0o700 });
  const pinned = join(release, 'runtime.json');
  const source = statSync(process.execPath), recorded = existsSync(pinned) ? JSON.parse(readFileSync(pinned, 'utf8')) : null;
  if (!existsSync(runtime) || recorded?.size !== source.size || recorded?.mtimeMs !== source.mtimeMs || statSync(runtime).size !== source.size) {
    const pending = join(release, 'runtime', `.node-${randomUUID()}`);
    // A hard link pins the exact runtime bytes at the release path without copying them; another volume copies.
    try { linkSync(process.execPath, pending); } catch { copyFileSync(process.execPath, pending, constants.COPYFILE_FICLONE); }
    renameSync(pending, runtime);
    durablePreviewWrite(pinned, { size: source.size, mtimeMs: source.mtimeMs, from: process.execPath });
  }
  const real = realpathSync(release), ancestors = [];
  for (let p = real; p !== '/';) { p = dirname(p); ancestors.push(`(literal "${p}")`); }
  const profile = readFileSync(WORKER_PROFILE, 'utf8').replaceAll('@RELEASE_DIR@', real).replaceAll('@SLOT_DIR@', realpathSync(slot))
    + `\n; materialized for this release path: ancestor metadata only\n(allow file-read-metadata ${ancestors.join(' ')})\n`;
  if (/@[A-Z_]+@/u.test(profile)) throw Error('self-host: confinement profile not fully materialized');
  const profilePath = join(release, 'worker.sb');
  if (!existsSync(profilePath) || readFileSync(profilePath, 'utf8') !== profile) writeFileSync(profilePath, profile, { mode: 0o600 });
  return Object.freeze({ release: real, slot: realpathSync(slot), runtime: join(real, 'runtime', 'node'), profile: profilePath,
    artifact: hashBytes(`${readFileSync(WORKER_PROFILE, 'utf8')}\0${readFileSync(new URL(import.meta.url), 'utf8')}`) });
}

/** Copies files into a fresh read-only (to the child) work directory inside the release. */
export function stageWork(release, files) {
  const directory = join(release.release, 'work', randomUUID());
  for (const file of files) { const path = join(directory, file.path); mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); writeFileSync(path, file.bytes, { mode: 0o600 }); }
  return directory;
}

const PROBE_SOURCE = `const [entry, name, input] = process.argv.slice(1);
const module = await import(new URL('file://' + entry).href);
const value = await module[name](JSON.parse(input));
process.stdout.write('\\n@probe ' + JSON.stringify({ value }) + '\\n');`;

/**
 * The self-hosting native harness: one adapter over one Eight-owned driver. `run(plan)` admits a
 * launch spec, launches, delivers the plan's input and observes the exit, appending every
 * observation to the record log; it returns the observation ids and the bounded output.
 */
export function createSelfHostHarness({ root, context, stopped, now, log, resolveCredential = () => null, wallMs = CONFINEMENT_LIMITS.wallMs }) {
  const release = confinedRelease(root), plans = new Map(), results = new Map();
  const execute = plan => {
    if (plan.mode === 'confined') {
      const args = plan.kind === 'probe' ? ['--input-type=module', '-e', PROBE_SOURCE, plan.entry, plan.export, JSON.stringify(plan.input ?? null)]
        : ['--test', '--test-isolation=none', ...plan.files.map(file => join(plan.directory, file))];
      return spawnSync('/usr/bin/sandbox-exec', ['-f', release.profile, release.runtime, `--max-old-space-size=${CONFINEMENT_LIMITS.memoryMb}`, ...args],
        { cwd: release.slot, env: {}, shell: false, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: wallMs,
          killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
    }
    const env = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', LANG: 'C.UTF-8', NO_COLOR: '1' };
    for (const reference of plan.credentials) {
      const resolved = resolveCredential(reference);
      if (!resolved) throw Error(`self-host: credential ${reference} is not resolvable by its owner`);
      env[resolved.env] = resolved.value;
    }
    const [command, ...rest] = plan.argv;
    return spawnSync(command, rest, { cwd: plan.cwd, env, shell: false, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: CONFINEMENT_LIMITS.hostToolMs, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 });
  };
  const driver = Object.freeze({ owner: 'part-eight',
    launch: input => { if (stopped()) return { kind: 'Refused', detail: 'stop latched' }; return plans.has(input.incarnation)
      ? { kind: 'Success', value: `confined:${input.incarnation}` } : { kind: 'Refused', detail: 'no admitted plan for this incarnation' }; },
    deliver: input => {
      if (stopped()) return { kind: 'Refused', detail: 'stop latched' };
      const plan = plans.get(input.incarnation); if (!plan || plan.digest !== input.digest) return { kind: 'Refused', detail: 'input differs from the admitted plan' };
      const started = now(), result = execute(plan);
      results.set(input.incarnation, { code: result.status, signal: result.signal ?? null, timedOut: result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGKILL',
        stdout: String(result.stdout ?? ''), output: tail(`${result.stdout ?? ''}${result.stderr ?? ''}`), ms: now() - started });
      return { kind: 'Success', value: `pid:${result.pid ?? 0}:${input.incarnation}` };
    },
    observe: input => { const incarnation = input.processIdentity.split(':').slice(1).join(':'); const result = results.get(incarnation);
      return result ? { kind: 'Success', value: { phase: 'exit-observed', evidence: `exit:${result.code}:${incarnation}`,
        detail: result.timedOut ? `killed at the ${wallMs} ms bound` : `exit ${result.code}` } }
        : { kind: 'Success', value: { phase: 'uncertain', evidence: `none:${incarnation}`, detail: 'no exit observed' } }; },
  });
  const adapter = createNativeHarnessAdapter({ id: SELF_HOST_HARNESS, artifact: release.artifact, platform: `${process.platform}-${process.arch}`,
    conformance: 'self-host:confined-worker-profile', driver, stallCoverage: SELF_HOST_STALL_COVERAGE, context, clock: now,
    generation: () => 'self-host:generation:1' });
  let ordinal = 0;
  const run = plan => {
    const id = `${randomUUID()}`, incarnation = `incarnation:${id}`, digest = hashBytes(JSON.stringify(plan));
    plans.set(incarnation, { ...plan, digest });
    const spec = take(decodeAssemblyRecord('HarnessLaunchSpec', { type: 'HarnessLaunchSpec', schemaVersion: 1, id: `launch:${id}`,
      predecessors: [], dependencyFacts: [], run: `self-host:${plan.work}`, step: `${plan.kind}:${++ordinal}`, principal: 'agent', incarnation,
      harness: SELF_HOST_HARNESS, artifactDigest: release.artifact, machine: 'local', workingScope: plan.mode === 'confined' ? release.release : plan.cwd,
      processOperation: `${plan.kind}:${plan.tool}`, resourceReferences: [`wall-ms:${plan.mode === 'confined' ? wallMs : CONFINEMENT_LIMITS.hostToolMs}`],
      portHandles: plan.mode === 'confined' ? ['confined-worker-profile'] : ['host-tool', ...plan.credentials.map(name => `credential:${name}`)],
      environment: [], contextManifest: [{ class: 'plan', reference: `plan:${id}`, digest }], input: `plan:${id}`, inputDigest: digest,
      consumptionMode: 'advisory' }, context));
    const launched = adapter.launch(spec, `operation:launch:${id}`, `claim:${id}`);
    if (launched.kind !== 'Success') return { tool: plan.tool, refused: launched.detail, observations: [] };
    const observations = [log.append(launched.value)];
    const accepted = adapter.deliver({ launch: spec.id, intake: spec.input, digest, incarnation, operation: `operation:deliver:${id}` });
    if (accepted.kind !== 'Success') return { tool: plan.tool, refused: accepted.detail, observations: observations.map(item => item.id) };
    observations.push(log.append(accepted.value));
    const exit = log.append(take(adapter.observe({ launch: spec.id, delivery: accepted.value.id, operation: `operation:observe:${id}` })));
    observations.push(exit);
    const result = results.get(incarnation);
    return { tool: plan.tool, code: result.code, timedOut: result.timedOut, output: result.output, stdout: result.stdout,
      observation: exit.id, observations: observations.map(item => item.id) };
  };
  return Object.freeze({ adapter, release, run, stageWork: files => stageWork(release, files) });
}

/**
 * The one tool interface: every advertised tool is admitted by the inventory, then dispatched to
 * its actual handler — process tools through the harness (package tests confined, repository tools
 * on the host with only owner-resolved credentials), port tools to their public handlers.
 */
export function dispatchTool({ proposal, grants, context, scopes, harness, repo, scope, ports, work }) {
  const admitted = admitToolProposal(proposal, grants, context, scopes);
  if (admitted.kind !== 'Success') return { tool: proposal?.operation ?? null, refused: admitted.detail };
  const tool = admitted.value;
  if (tool.run.kind === 'port') {
    const handler = ports[tool.tool];
    if (!handler) return { tool: tool.tool, refused: `port ${tool.run.port} is not bound in this harness` };
    try { return { tool: tool.tool, code: 0, ...handler(tool.run.options) }; }
    catch (error) { if (error?.cut) throw error; return { tool: tool.tool, code: 1, output: tail(error?.message ?? error) }; }
  }
  if (tool.tool === 'package-test') {
    const files = scopeFiles(scope);
    return harness.run({ mode: 'confined', kind: 'test', tool: tool.tool, work, directory: harness.stageWork(files),
      files: tool.run.argv.slice(2) });
  }
  return harness.run({ mode: 'host', kind: 'tool', tool: tool.tool, work, argv: tool.run.argv, cwd: repo, credentials: tool.run.credentials });
}

/** Every regular file under the authoring scope (bounded by the loop's own file limits). */
export function scopeFiles(scope) {
  const out = [], walk = directory => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), info = statSync(path);
      if (info.isDirectory()) walk(path); else if (info.isFile()) out.push({ path: relative(scope, path), bytes: readFileSync(path, 'utf8') });
    }
  };
  if (existsSync(scope)) walk(resolve(scope));
  return out;
}
