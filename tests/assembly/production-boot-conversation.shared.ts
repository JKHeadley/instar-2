// @ts-nocheck -- U4-G permits exactly the named fixture-admitted bindings.
// Importing this module registers nothing; each wrapper explicitly registers one shard.
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync, readdirSync, cpSync,
  mkdirSync, lstatSync, openSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { expect, it, onTestFinished } from 'vitest';
import { installedFixtureHost, fixtureAdmissionNames } from './production-boot-installed-fixture.js';
import { productionGroundingSourceDigest } from '../../scripts/check-assembly-contracts.mjs';
import { validateBootRecoveryManifest } from '../../scripts/check-boot-conversation-evidence.mjs';

const checkout = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync(join(checkout, 'tests/assembly/production-boot-conversation-shards.json'), 'utf8'));
const adjacent = ['provider-before-response', 'provider-after-response', 'reply-before-response', 'reply-after-response'];
function artifact(path) {
  const bytes = readFileSync(path);
  return { path, hash: hash(bytes), data: JSON.parse(bytes.toString()) };
}
function durableReceipt(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(data));
    const fd = openSync(temporary, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, path);
    const directory = openSync(dirname(path), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally { rmSync(temporary, { force: true }); }
}
function child(root, action, bin, snapshots) {
  const processChild = spawn(process.execPath, ['--experimental-transform-types', '--import=./tests/assembly/production-boot-source-loader.mjs',
    bin.path, join(root, 'installation.json'), 'tests/assembly/production-boot-bin-host.ts'],
    { cwd: checkout, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, INSTAR_U4_RECORDED_ACTION: action,
      ...(snapshots ? { INSTAR_U4_RECORDED_SNAPSHOTS: snapshots } : {}) } });
  // All listeners are attached in the spawn turn, including readiness and errors.
  let errors = '', failure;
  processChild.stderr.on('data', bytes => { errors += bytes; });
  processChild.stdout.resume();
  let resolveFailure;
  const failed = new Promise(resolveError => { resolveFailure = resolveError; });
  const exited = new Promise(resolveExit => {
    processChild.once('error', error => {
      failure = error; resolveFailure(error);
      // A spawn failure has no process to reap. Errors on a running child must
      // not resolve its exit promise before the actual exit is observed.
      if (!processChild.pid) resolveExit({ error: error.message });
    });
    processChild.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
  const result = Promise.race([exited, failed.then(error => { throw error; })]);
  const ready = new Promise(resolveReady => processChild.once('message', resolveReady));
  return { process: processChild, exited, result, ready, errors: () => failure ? `${failure}\n${errors}` : errors };
}
export function registerBootConversationShard(shardId) {
  validateBootRecoveryManifest(manifest);
  const shard = manifest.shards[shardId];
  if (!shard || shard.id !== shardId) throw Error('unknown boot recovery shard');
  const fullName = shard.titleTemplate.replace('${fixtureAdmissionNames}', fixtureAdmissionNames);
  // Rule 37 quarantine: see docs/defects/production-boot-conversation-shard-hang.md
  it.skip(fullName, async ({ signal }) => {
    const start = Date.now();
    const work = realpathSync(mkdtempSync(join(tmpdir(), `production-public-trace-${shardId}-`)));
    const root = join(work, 'installation'), snapshots = join(work, 'snapshots');
    let active, complete = false;
    const stop = () => {
      if (active?.process.exitCode === null && active.process.signalCode === null) active.process.kill('SIGKILL');
    };
    const reap = async () => { stop(); if (active) await active.exited; };
    signal.addEventListener('abort', stop);
    onTestFinished(reap);
    const assertRunning = () => signal.throwIfAborted();
    try {
      mkdirSync(root);
      const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route' });
      writeFileSync(join(root, 'installation.json'), JSON.stringify(fixture.record));
      const installation = artifact(join(root, 'installation.json'));
      const sourceDigest = productionGroundingSourceDigest(checkout);
      const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
      const bin = { path: realpathSync(join(checkout, 'bin/instar-production.mjs')),
        hash: hash(readFileSync(join(checkout, 'bin/instar-production.mjs'))) };
      const traceId = randomUUID();
      const invoke = (action, directory) => {
        assertRunning();
        expect(realpathSync(root)).toBe(root);
        expect(hash(readFileSync(installation.path))).toBe(installation.hash);
        expect(realpathSync(join(checkout, 'bin/instar-production.mjs'))).toBe(bin.path);
        expect(hash(readFileSync(bin.path))).toBe(bin.hash);
        active = child(root, action, bin, directory);
        return { action, installationRoot: root, installationHash: installation.hash, bin };
      };
      const traceStart = Date.now(), traceInvocation = invoke('trace', snapshots);
      const traceExit = await active.result;
      assertRunning();
      expect(traceExit, active.errors()).toEqual({ code: 0, signal: null });
      const traceProof = artifact(join(root, 'trace-proof.json')), proof = traceProof.data;
      console.error(`RECORDED-ONLY trace identifiers: ${JSON.stringify(proof)}`);
      expect(proof.update).toBeGreaterThan(0); expect(proof.replyMessage).toBeGreaterThan(0); expect(proof.assessment).toBeTruthy();
      const traceEnd = Date.now();
      const prefixes = readdirSync(snapshots).sort();
      expect(prefixes.length).toBe(29);
      expect(prefixes).toEqual(manifest.prefixes.map(row => row.prefix));
      const roster = prefixes.map((prefix, ordinal) => {
        const directory = join(snapshots, prefix), expected = manifest.prefixes[ordinal];
        expect(lstatSync(directory).isDirectory()).toBe(true);
        const checkpointPath = join(directory, 'recorded-checkpoint.json');
        expect(lstatSync(checkpointPath).isFile()).toBe(true);
        const checkpoint = artifact(checkpointPath);
        expect(checkpoint.data.stage).toBe(expected.stage);
        expect(checkpoint.data.run).toBe(proof.run);
        expect(hash(readFileSync(join(directory, 'installation.json')))).toBe(installation.hash);
        return { ...expected, traceId, checkpoint };
      });
      expect(new Set(roster.map(row => row.checkpoint.data.stage)).size).toBe(29);
      const completed = [];
      // Each shard restores only its own independently generated complete trace.
      // Cycles are sequential at the original immutable installation path.
      for (const observed of roster.filter(row => row.shard === shardId)) {
        assertRunning();
        const { prefix } = observed, cycleStart = Date.now();
        rmSync(root, { recursive: true, force: true }); cpSync(join(snapshots, prefix), root, { recursive: true });
        const restored = artifact(join(root, 'recorded-checkpoint.json')), checkpoint = restored.data;
        expect(restored.hash).toBe(observed.checkpoint.hash);
        const pause = invoke('pause');
        const paused = active;
        const ready = await Promise.race([
          paused.ready,
          paused.result.then(exit => { throw Error(`prefix ${prefix}: ${JSON.stringify(exit)} ${paused.errors()}`); }),
        ]);
        assertRunning();
        expect(ready.stage).toBe(checkpoint.stage); expect(ready.head).toBe(checkpoint.facts.at(-1).hash);
        paused.process.kill('SIGKILL');
        const killed = await paused.result;
        expect(killed).toEqual({ code: null, signal: 'SIGKILL' });
        const inspect = invoke('inspect');
        const inspected = await active.result;
        assertRunning();
        expect(inspected, `${prefix}: ${active.errors()}`).toEqual({ code: 0, signal: null });
        const recoveryProof = artifact(join(root, 'recovery-proof.json')), recovered = recoveryProof.data;
        expect(recovered.head).toBe(checkpoint.facts.at(-1).hash); expect(recovered.count).toBe(checkpoint.facts.length);
        expect(recovered.calls).toEqual(['getMe']); expect(recovered.providerCalls).toBe(0);
        const verificationIds = checkpoint.facts.filter(row => row.kind.startsWith('verification-')).map(row => row.id);
        const providerIds = checkpoint.facts.filter(row => row.kind.startsWith('effect-provider-')).map(row => row.id);
        for (const id of verificationIds) expect(recovered.assessments).toContain(id);
        for (const id of providerIds) expect(recovered.provider).toContain(id);
        let responseAdjacent = null;
        if (adjacent.includes(checkpoint.stage)) {
          expect(recovered.run.pending).toHaveLength(1);
          const unaccounted = recovered.accounting.filter(row => row.record.type === 'AdmissionReservation' && row.record.state === 'consumed'
            && !recovered.accounting.some(other => other.record.type === 'SettlementApplication' && other.record.operation === row.record.operation));
          expect(unaccounted.length).toBeGreaterThan(0);
          responseAdjacent = { pending: recovered.run.pending, unaccounted: unaccounted.map(row => row.id) };
        }
        expect(recovered.stage).toBe(checkpoint.stage);
        expect(recovered.providerAttempts).toBe(0);
        // The unchanged bin host also asserts full fact-history equality.
        let replyAccounted = null;
        if (checkpoint.stage === 'reply-accounted') {
          const final = recovered.accounting.filter(row => row.record.type === 'SettlementApplication').at(-1).record;
          expect(final.actualCharge).toBe(-1); expect(final.unresolved).toBe(1); expect(final.retryEligible).toBe(0);
          expect(recovered.run.pending).toHaveLength(1);
          replyAccounted = { actualCharge: final.actualCharge, unresolved: final.unresolved,
            retryEligible: final.retryEligible, pending: recovered.run.pending };
        }
        // A row exists only after the real kill, successful inspect and all assertions.
        completed.push({ ordinal: observed.ordinal, prefix, shard: shardId, traceId,
          expectedStage: observed.stage, actualStage: recovered.stage, start: cycleStart, end: Date.now(),
          checkpointPath: observed.checkpoint.path, checkpointHash: restored.hash, restoredPath: restored.path,
          expectedHead: checkpoint.facts.at(-1).hash, actualHead: recovered.head,
          expectedCount: checkpoint.facts.length, actualCount: recovered.count,
          pause, ready, killed, inspect, inspected, recoveryProof, calls: recovered.calls,
          providerCalls: recovered.providerCalls, providerAttempts: recovered.providerAttempts,
          verificationIds, providerIds, responseAdjacent, replyAccounted });
        console.error(`SIGKILL public restart passed: ${prefix}`);
      }
      expect(completed.map(row => row.prefix)).toEqual(manifest.prefixes.filter(row => row.shard === shardId).map(row => row.prefix));
      assertRunning();
      expect(productionGroundingSourceDigest(checkout)).toBe(sourceDigest);
      expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim()).toBe(revision);
      expect(hash(readFileSync(bin.path))).toBe(bin.hash);
      durableReceipt(resolve(checkout, `.instar/lanes/boot-conversation-artifacts/shard-${shardId}.json`), {
        version: 1, root: checkout, revision, sourceDigest, file: realpathSync(join(checkout, shard.file)), fullName,
        shard: shardId, start, end: Date.now(), workRoot: work, installationRoot: root, installation, bin,
        trace: { id: traceId, start: traceStart, end: traceEnd, invocation: traceInvocation, exit: traceExit, proof: traceProof },
        roster, completed,
      });
      complete = true;
    } finally {
      await reap();
      signal.removeEventListener('abort', stop);
      if (complete) rmSync(work, { recursive: true, force: true });
      else console.error(`Recorded fixture evidence retained: ${work}; snapshots: ${snapshots}; proofs: ${root}`);
    }
  }, 7_200_000);
}
