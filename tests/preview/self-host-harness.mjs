// Rules 2, 5, 26, 55, 63, 68, 115 (D14 §§3–4, 9; D17 §2): the self-hosting harness composition. The
// public native adapter (`createNativeHarnessAdapter`) records every observation; its driver owns no
// authority of its own: launch and observation go through the existing S8 production launch boundary
// over one signed store per operation (self-host-owners.ts), so a process starts only after Five's
// Run, Six's prepared/claimed/consumed reservation, Ten's HarnessLaunchSpec and the recorded plan
// exist, and after the M1 monitor service has durably decided. The physical release leaf below is
// the only code that starts a process. Generated code runs inside Eight's shipped confinement
// profile (deploy/macos/fixed-worker/worker.sb) with an empty environment, under a fixed runner whose
// main thread enforces the wall bound itself: the child ends at its deadline even if this launcher
// dies. The runner reports on its own channel the moment that bound is armed; the launcher's
// backstop is measured from that readiness, not from the spawn, so the operating system's
// admission of a freshly pinned runtime (unbounded under host load) is never charged to the work. Fixed-argv repository tools run on the host with a scrubbed environment plus only the
// credentials the owner resolves, after their paths are resolved physically inside the granted
// roots. This file owns process, clock and filesystem.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, constants, copyFileSync, existsSync, linkSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync,
  renameSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { uptime } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { hashBytes } from '../../src/facts/index.js';
import { admitToolProposal, createNativeHarnessAdapter, decodeAssemblyRecord } from '../../src/assembly/index.js';
import { redact } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './durable-write.js';
import { SELF_HOST_HARNESS, SELF_HOST_STALL_COVERAGE } from './stall-coverage.js';
import { createSelfHostOwners } from './self-host-owners.ts';
import { compositionClosure, compositionDigest, currentRuntime, fileDigest } from '../../scripts/composition-digest.mjs';

// startMs bounds spawn-to-readiness only (a runtime that never starts); wallMs bounds the work from readiness.
export const CONFINEMENT_LIMITS = Object.freeze({ wallMs: 20000, memoryMb: 256, outputBytes: 4096, hostToolMs: 600000, graceMs: 5000, startMs: 120000 });
const WORKER_PROFILE = new URL('../../deploy/macos/fixed-worker/worker.sb', import.meta.url);
const DECLARATIONS = new URL('../../src/assembly/harness.declarations.json', import.meta.url);
const REPOSITORY = new URL('../../', import.meta.url);
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
 * Rules 26, 49, 69, 115 (D17 §2): the exact composition the supported self-hosting tuple was certified
 * on. The declaration names the composition's entry points and the resolved runtime; the files are the
 * entries' static import closure, and the digest is recomputed from those files as they are now, on the
 * runtime actually running. `supported` is true only when the declared conformance and runtime match
 * this running composition exactly.
 */
export function selfHostCompositionEvidence(declarations = JSON.parse(readFileSync(DECLARATIONS, 'utf8')),
  read = path => { try { return readFileSync(new URL(path, REPOSITORY), 'utf8'); } catch { return null; } }) {
  const metrics = declarations.flatMap(entry => entry.requiredFacts?.metrics ?? []);
  const prefix = `harness.${SELF_HOST_HARNESS}.`;
  const fact = name => metrics.filter(metric => metric.startsWith(prefix) && metric.includes(`.self-hosting.${name}=`)).map(metric => metric.slice(metric.indexOf('=') + 1));
  const [entries] = fact('entries'), [declared] = fact('conformance'), [runtime] = fact('runtime');
  const closure = compositionClosure((entries ?? '').split(',').filter(Boolean), read, 'src/assembly/harness.declarations.json');
  const running = currentRuntime();
  const digest = closure.complete && closure.files.length ? compositionDigest(running, closure.files, read) : null;
  return { entries: (entries ?? '').split(',').filter(Boolean), files: closure.files, runtime: running, declaredRuntime: runtime ?? null,
    declared: declared ?? null, digest: digest ?? hashBytes('incomplete composition'),
    supported: digest !== null && declared === digest && runtime === running };
}

/**
 * The confined runner: the fixed program the profile lets run. Its main thread holds the wall bound,
 * and reports readiness on descriptor 3 (the launcher's readiness pipe) once that bound is armed.
 */
const RUNNER_SOURCE = `import { Worker } from 'node:worker_threads';
import { closeSync, writeSync } from 'node:fs';
const wallMs = Number(process.argv[2]);
setTimeout(() => { process.stdout.write('\\n@expired\\n'); process.exit(124); }, wallMs);
writeSync(3, '@ready\\n'); closeSync(3);
let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;
const plan = JSON.parse(input);
const source = \`import { workerData } from 'node:worker_threads';
const plan = workerData;
if (plan.kind === 'probe') {
  const loaded = await import(new URL('file://' + plan.entry).href);
  const value = await loaded[plan.export](plan.input);
  process.stdout.write('\\\\n@probe ' + JSON.stringify({ value }) + '\\\\n');
} else {
  const { run } = await import('node:test');
  const { tap } = await import('node:test/reporters');
  let failed = false;
  const stream = run({ files: plan.files.map(file => plan.directory + '/' + file), isolation: 'none' });
  stream.on('test:fail', () => { failed = true; });
  for await (const line of stream.compose(tap)) process.stdout.write(line);
  process.exitCode = failed ? 1 : 0;
}\`;
const worker = new Worker(source, { eval: true, workerData: plan, resourceLimits: { maxOldGenerationSizeMb: Number(process.argv[3]) } });
worker.on('error', error => { process.stderr.write(String(error?.stack ?? error)); process.exit(1); });
worker.on('exit', code => process.exit(code));
`;

/**
 * Eight's confinement for generated code: the shipped worker profile, materialized for this root
 * (the only substitutions are its two path tokens and the ancestor metadata of this release path),
 * the pinned runtime and the fixed runner inside the release. Everything the child may read lives
 * in the release.
 */
export function confinedRelease(root) {
  const release = join(root, 'release'), slot = join(root, 'release-slot'), runtime = join(release, 'runtime', 'node');
  mkdirSync(join(release, 'runtime'), { recursive: true, mode: 0o700 }); mkdirSync(join(release, 'bin'), { recursive: true, mode: 0o700 });
  mkdirSync(slot, { recursive: true, mode: 0o700 });
  const pinned = join(release, 'runtime.json');
  const source = statSync(process.execPath), recorded = existsSync(pinned) ? JSON.parse(readFileSync(pinned, 'utf8')) : null;
  if (!existsSync(runtime) || recorded?.size !== source.size || recorded?.mtimeMs !== source.mtimeMs || statSync(runtime).size !== source.size) {
    const pending = join(release, 'runtime', `.node-${randomUUID()}`);
    // A hard link pins the exact runtime bytes at the release path without copying them; another volume copies.
    try { linkSync(process.execPath, pending); } catch { copyFileSync(process.execPath, pending, constants.COPYFILE_FICLONE); }
    renameSync(pending, runtime);
    durablePreviewWrite(pinned, { size: source.size, mtimeMs: source.mtimeMs, from: process.execPath });
  }
  const runner = join(release, 'bin', 'confined-runner.mjs');
  if (!existsSync(runner) || readFileSync(runner, 'utf8') !== RUNNER_SOURCE) writeFileSync(runner, RUNNER_SOURCE, { mode: 0o400 });
  const real = realpathSync(release), ancestors = [];
  for (let p = real; p !== '/';) { p = dirname(p); ancestors.push(`(literal "${p}")`); }
  const profile = readFileSync(WORKER_PROFILE, 'utf8').replaceAll('@RELEASE_DIR@', real).replaceAll('@SLOT_DIR@', realpathSync(slot))
    + `\n; materialized for this release path: ancestor metadata only\n(allow file-read-metadata ${ancestors.join(' ')})\n`;
  if (/@[A-Z_]+@/u.test(profile)) throw Error('self-host: confinement profile not fully materialized');
  const profilePath = join(release, 'worker.sb');
  if (!existsSync(profilePath) || readFileSync(profilePath, 'utf8') !== profile) writeFileSync(profilePath, profile, { mode: 0o600 });
  return Object.freeze({ release: real, slot: realpathSync(slot), runtime: join(real, 'runtime', 'node'), runner: join(real, 'bin', 'confined-runner.mjs'),
    profile: profilePath, profileDigest: hashBytes(profile), runnerDigest: hashBytes(RUNNER_SOURCE) });
}

/** Copies files into a fresh read-only (to the child) work directory inside the release. */
export function stageWork(release, files) {
  const directory = join(release.release, 'work', randomUUID());
  for (const file of files) { const path = join(directory, file.path); mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); writeFileSync(path, file.bytes, { mode: 0o600 }); }
  return directory;
}

/**
 * Rules 2, 115 (D14 §9): filesystem scope resolved physically. Each path must lie inside a granted
 * root once every EXISTING component is resolved on disk (a symlinked parent that leaves the root is
 * refused); components that do not exist yet cannot be links. Returns the refusal, or null.
 */
export function physicalScopeRefusal(path, roots) {
  const inside = (candidate, root) => candidate === root || candidate.startsWith(`${root}${sep}`);
  const granted = roots.filter(root => existsSync(root)).map(root => ({ lexical: resolve(root), real: realpathSync(root) }));
  const target = resolve(path), root = granted.find(item => inside(target, item.lexical));
  if (!root) return `${path} is outside every granted root`;
  let existing = target;
  while (!existsSync(existing) && existing !== root.lexical) existing = dirname(existing);
  if (existsSync(existing) && lstatSync(existing).isSymbolicLink() && existing === target) return `${path} is a link`;
  const real = realpathSync(existing), expected = join(root.real, relative(root.lexical, existing));
  if (real !== expected || !inside(real, root.real)) return `${path} leaves its granted root through a link`;
  return null;
}

/** An absolute executable, or the first match on PATH; null when there is none. */
const resolveExecutable = name => {
  if (typeof name !== 'string' || !name) return null;
  if (name.startsWith('/')) return name; // an absent absolute path is declared as is; its start fails at the release leaf
  for (const directory of (process.env.PATH ?? '').split(':').filter(Boolean)) {
    const candidate = join(directory, name);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

const bootIdentity = () => `boot:${Math.round(Date.now() / 1000 - uptime())}`;

/**
 * The physical release leaf the M1 service calls after its durable decision: it starts exactly the
 * plan recorded for the admitted operation, and reports what actually happened to that process.
 */
export function createReleaseLeaf({ release, resolvePlan, resolveCredential, bootId, wallMs, limits = CONFINEMENT_LIMITS }) {
  const processes = new Map(), byOperation = new Map();
  const limit = text => text.length > 1024 * 1024 ? text.slice(-1024 * 1024) : text;
  const start = (closure, identity) => {
    const { plan } = resolvePlan(closure.operation);
    let child, bound;
    if (plan.mode === 'confined') {
      bound = plan.wallMs;
      child = spawn('/usr/bin/sandbox-exec', ['-f', release.profile, release.runtime, `--max-old-space-size=${limits.memoryMb}`,
        release.runner, String(plan.wallMs), String(limits.memoryMb)],
      { cwd: release.slot, env: {}, shell: false, detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
    } else {
      for (const path of plan.paths) { const refusal = physicalScopeRefusal(path, plan.roots); if (refusal) throw Error(`self-host: ${refusal}`); }
      const env = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', LANG: 'C.UTF-8', NO_COLOR: '1' };
      for (const reference of plan.credentials) {
        const resolved = resolveCredential(reference);
        if (!resolved) throw Error(`self-host: credential ${reference} is not resolvable by its owner`);
        env[resolved.env] = resolved.value;
      }
      bound = limits.hostToolMs;
      const [command, ...rest] = plan.argv;
      child = spawn(command, rest, { cwd: plan.cwd, env, shell: false, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    }
    child.on('error', () => {}); // a start failure is reported below as no process, never as a crash of the launcher
    if (!child.pid) throw Error('self-host: the process did not start');
    const startTicks = process.hrtime.bigint(), state = { child, stdout: '', stderr: '', exit: null, bound, launchedAt: Date.now() };
    child.stdin.on('error', () => {});
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { state.stdout = limit(state.stdout + chunk); });
    child.stderr.on('data', chunk => { state.stderr = limit(state.stderr + chunk); });
    state.settled = new Promise(done => child.on('close', (code, signal) => {
      clearTimeout(state.backstop);
      state.exit = { code, signal, expired: code === 124 && /(^|\n)@expired\n/u.test(state.stdout) || state.killedAtBound === true };
      done();
    }));
    // The launcher's own backstop only; the confined child enforces its deadline itself. A confined child
    // gets startMs to report readiness, then its bound plus grace from that readiness; a host tool's bound runs from spawn.
    const kill = () => { state.killedAtBound = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } };
    const startup = plan.mode === 'confined' ? limits.startMs : 0;
    if (startup) {
      state.backstop = setTimeout(kill, startup);
      child.stdio[3].on('error', () => {});
      child.stdio[3].once('data', () => {
        if (state.exit) return;
        clearTimeout(state.backstop); state.backstop = setTimeout(kill, bound + limits.graceMs);
      });
    } else state.backstop = setTimeout(kill, bound + limits.graceMs);
    processes.set(identity, state); byOperation.set(closure.operation, state);
    return { uid: process.getuid(), pid: child.pid, processStartIdentity: { bootId, uniqueId: String(child.pid), startTicks: String(startTicks) },
      originalDeadline: { ownerClockReference: 'clock:self-host-wall', ownerValidUntil: state.launchedAt + startup + bound, bootId,
        continuousTicks: String(startTicks + BigInt(startup + bound) * 1_000_000n), timebaseNumer: '1', timebaseDenom: '1' },
      evidenceReferences: [`spawned:${child.pid}`, `plan:${closure.digest}`] };
  };
  const observe = identity => {
    const state = processes.get(identity);
    if (!state) return null;
    if (!state.exit) return { state: 'running', reason: 'ok' };
    const references = [`exit-code:${state.exit.code ?? 'none'}`, `signal:${state.exit.signal ?? 'none'}`, `output:${hashBytes(state.stdout + state.stderr)}`];
    return state.exit.expired ? { state: 'expired', reason: 'deadline', evidenceReferences: references }
      : { state: 'exited', reason: 'worker-exit', evidenceReferences: references };
  };
  return Object.freeze({ start, observe, byOperation, wallMs });
}

/**
 * The self-hosting native harness: one adapter whose launches are admitted by the owners. `run(plan)`
 * records the plan, admits it, launches through S8, delivers the recorded plan to the process,
 * waits for the process and observes its exit through S8; every observation goes to the record log.
 */
export function createSelfHostHarness({ root, context, stopped, now, log, resolveCredential = () => null, wallMs = CONFINEMENT_LIMITS.wallMs }) {
  const release = confinedRelease(root), composition = selfHostCompositionEvidence(), bootId = bootIdentity();
  const artifact = composition.digest, handles = new Map();
  const digests = { releaseDigest: hashBytes(`${release.runnerDigest}\0${release.profileDigest}\0${artifact}`), artifactDigest: artifact,
    profileDigest: release.profileDigest, handlePolicyDigest: hashBytes(JSON.stringify(['confined-worker-profile', 'host-tool'])),
    limitsDigest: hashBytes(JSON.stringify({ ...CONFINEMENT_LIMITS, wallMs })) };
  const leaf = createReleaseLeaf({ release, resolveCredential, bootId, wallMs,
    resolvePlan: operation => { const handle = handles.get(operation); if (!handle) throw Error('self-host: no admitted operation'); return handle.owners.planOf(operation); } });
  const handleOf = processIdentity => [...handles.values()].find(handle => handle.processIdentity === processIdentity);
  // The adapter's driver: launch and observation are the S8 boundary's; delivery writes the
  // recorded plan (digest-checked against the admitted specification) to the launched process.
  const driver = Object.freeze({ owner: 'part-eight',
    launch: input => {
      if (stopped()) return { kind: 'Refused', detail: 'stop latched' };
      const handle = handles.get(input.operation);
      if (!handle || handle.claim !== input.claim) return { kind: 'Refused', detail: 'no admitted operation for this launch' };
      const observed = handle.owners.launch(handle.spec, input.operation, input.claim);
      handle.monitor.push(log.append(observed));
      if (observed.phase !== 'launched') return { kind: 'Refused', detail: `monitor ${observed.detail}` };
      handle.processIdentity = `process:${observed.boundaryEvidence}`;
      return { kind: 'Success', value: handle.processIdentity };
    },
    deliver: input => {
      if (stopped()) return { kind: 'Refused', detail: 'stop latched' };
      const handle = handleOf(input.processIdentity), state = handle && leaf.byOperation.get(handle.operation);
      if (!handle || !state || input.digest !== handle.spec.inputDigest) return { kind: 'Refused', detail: 'input differs from the admitted plan' };
      const { bytes } = handle.owners.planOf(handle.operation);
      if (hashBytes(bytes) !== input.digest) return { kind: 'Refused', detail: 'recorded plan changed' };
      state.child.stdin.end(handle.plan.mode === 'confined' ? bytes : '');
      return { kind: 'Success', value: `stdin:${state.child.pid}:${input.digest}` };
    },
    observe: input => {
      const handle = handleOf(input.processIdentity);
      if (!handle) return { kind: 'Success', value: { phase: 'uncertain', evidence: `none:${input.processIdentity}`, detail: 'no admitted process' } };
      const observed = handle.owners.observe(handle.operation);
      handle.monitor.push(log.append(observed));
      return { kind: 'Success', value: { phase: observed.phase, evidence: observed.boundaryEvidence, detail: observed.detail } };
    },
  });
  const adapter = createNativeHarnessAdapter({ id: SELF_HOST_HARNESS, artifact, platform: `${process.platform}-${process.arch}`,
    // The declared conformance is admitted only for the exact running closure and runtime; otherwise unproven.
    conformance: composition.supported ? `self-host:${composition.declared}` : `self-host:unproven:${composition.digest}`, driver, stallCoverage: SELF_HOST_STALL_COVERAGE, context, clock: now,
    generation: () => 'self-host:generation:1' });
  const run = async plan => {
    // The executable each launch declares to Eight is the resolved file, and its digest is that file's bytes.
    const executable = plan.mode === 'confined' ? release.runtime : resolveExecutable(plan.argv[0]);
    const recorded = plan.mode === 'confined'
      ? { mode: 'confined', kind: plan.kind, tool: plan.tool, work: plan.work, wallMs, ...(plan.kind === 'probe'
        ? { entry: plan.entry, export: plan.export, input: plan.input ?? null } : { directory: plan.directory, files: plan.files }) }
      : { mode: 'host', kind: 'tool', tool: plan.tool, work: plan.work, argv: executable ? [executable, ...plan.argv.slice(1)] : plan.argv, cwd: plan.cwd,
        credentials: plan.credentials, paths: plan.paths ?? [], roots: plan.roots ?? [] };
    if (stopped()) return { tool: plan.tool, refused: 'stop latched', observations: [] };
    for (const reference of recorded.credentials ?? [])
      if (!resolveCredential(reference)) return { tool: plan.tool, refused: `credential ${reference} is not resolvable by its owner`, observations: [] };
    let owners;
    try {
      owners = createSelfHostOwners({ root, invocation: randomUUID(), harness: SELF_HOST_HARNESS, digests, bootId, stopped, leaf, now });
      if (!executable) throw Error(`self-host: ${plan.argv[0]} is not an executable on this host`);
      const digestOf = path => existsSync(path) ? fileDigest(path) : hashBytes(`absent:${path}`);
      const target = plan.mode === 'confined'
        ? { executable, executableDigest: digestOf(executable), boundaryDigest: hashBytes(`${release.profileDigest}\0${release.runnerDigest}`),
          restrictedIdentity: 'sandbox:worker.sb:empty-environment', profile: 'deploy/macos/fixed-worker/worker.sb' }
        : { executable, executableDigest: digestOf(executable), boundaryDigest: hashBytes(JSON.stringify({ environment: 'scrubbed', roots: recorded.roots })),
          restrictedIdentity: 'host-tool:scrubbed-environment', profile: 'host-tool' };
      const admitted = owners.admitLaunch({ plan: recorded, target, workingScope: plan.mode === 'confined' ? release.release : plan.cwd,
        portHandles: plan.mode === 'confined' ? ['confined-worker-profile'] : ['host-tool', ...plan.credentials.map(name => `credential:${name}`)],
        wallMs, artifact });
      const handle = { ...admitted, owners, plan: recorded, monitor: [], processIdentity: null };
      handles.set(admitted.operation, handle);
      const spec = admitted.spec;
      const launched = adapter.launch(spec, admitted.operation, admitted.claim);
      if (launched.kind !== 'Success') return { tool: plan.tool, refused: launched.detail, observations: handle.monitor.map(item => item.id) };
      const observations = [...handle.monitor, log.append(launched.value)];
      const accepted = adapter.deliver({ launch: spec.id, intake: spec.input, digest: spec.inputDigest, incarnation: spec.incarnation, operation: admitted.operation });
      if (accepted.kind !== 'Success') return { tool: plan.tool, refused: accepted.detail, observations: observations.map(item => item.id) };
      observations.push(log.append(accepted.value));
      const state = leaf.byOperation.get(admitted.operation);
      await state.settled;
      const exit = log.append(take(adapter.observe({ launch: spec.id, delivery: accepted.value.id, operation: admitted.operation })));
      observations.push(...handle.monitor.slice(1), exit);
      return { tool: plan.tool, code: state.exit.code, timedOut: state.exit.expired, output: tail(`${state.stdout}${state.stderr}`), stdout: state.stdout,
        operation: admitted.operation, claim: admitted.claim, launch: spec.id, observation: exit.id, observations: observations.map(item => item.id) };
    } catch (error) {
      if (error?.cut) throw error;
      return { tool: plan.tool, refused: tail(error?.message ?? error), observations: [] };
    } finally { owners?.close(); }
  };
  return Object.freeze({ adapter, release, artifact, composition, run, stageWork: files => stageWork(release, files) });
}

/**
 * The one tool interface: every advertised tool is admitted by the inventory, then dispatched to
 * its actual handler — process tools through the harness (package tests confined, repository tools
 * on the host with only owner-resolved credentials and physically resolved paths), port tools to
 * their public handlers.
 */
export async function dispatchTool({ proposal, grants, context, scopes, harness, repo, scope, ports, work }) {
  const admitted = admitToolProposal(proposal, grants, context, scopes);
  if (admitted.kind !== 'Success') return { tool: proposal?.operation ?? null, refused: admitted.detail };
  const tool = admitted.value;
  if (tool.run.kind === 'port') {
    const handler = ports[tool.tool];
    if (!handler) return { tool: tool.tool, refused: `port ${tool.run.port} is not bound in this harness` };
    try { return { tool: tool.tool, code: 0, ...await handler(tool.run.options) }; }
    catch (error) { if (error?.cut) throw error; return { tool: tool.tool, code: 1, output: tail(error?.message ?? error) }; }
  }
  if (tool.tool === 'package-test') {
    const files = scopeFiles(scope);
    return harness.run({ mode: 'confined', kind: 'test', tool: tool.tool, work, directory: harness.stageWork(files),
      files: tool.run.argv.slice(2) });
  }
  // Refuse escaping links before anything is admitted; the release leaf checks again at start.
  for (const path of tool.run.paths) {
    const refusal = physicalScopeRefusal(path, scopes.roots);
    if (refusal) return { tool: tool.tool, refused: `option path outside its scope: ${refusal}` };
  }
  return harness.run({ mode: 'host', kind: 'tool', tool: tool.tool, work, argv: tool.run.argv, cwd: repo, credentials: tool.run.credentials,
    paths: tool.run.paths, roots: scopes.roots });
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
