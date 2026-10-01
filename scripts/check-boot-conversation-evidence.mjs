// BOOT-SPLIT: reviewed execution evidence, not independent runtime attestation.
// Current source authority is supplied by the caller, never taken from a receipt.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, realpathSync, lstatSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionBindingHolds } from '../dist/assembly/production-holds.js';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const stages = ['intake', 'run-opened', 'native-before-consume-1', 'native-after-consume-1',
  'provider-grounded', 'provider-pending', 'provider-prepared', 'context-settled', 'provider-requested',
  'provider-before-response', 'provider-after-response', 'provider-observed', 'provider-assessed',
  'provider-settled', 'provider-accounted', 'answer-recorded', 'answer-accepted', 'native-before-consume-2',
  'native-after-consume-2', 'reply-grounded', 'reply-pending', 'reply-context-settled', 'reply-requested',
  'reply-before-response', 'reply-after-response', 'reply-observed', 'reply-assessed', 'reply-settled', 'reply-accounted'];
const title = id => 'bin + public boot: Telegram → Four → Five → Seven/Eight/Six → Nine → Five → reply; '
  + `restored adjacent durable prefixes SIGKILL/recovery; shard ${id}/4; fixture-admitted: \${fixtureAdmissionNames}`;
const fail = (condition, message) => assert.ok(condition, `boot recovery: ${message}`);
const equal = (actual, expected, message) => assert.deepEqual(actual, expected, `boot recovery: ${message}`);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const finite = value => Number.isFinite(value) && value > 0;
const multiset = values => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
};
export function validateBootRecoveryManifest(manifest) {
  equal(manifest.version, 1, 'manifest version');
  equal(manifest.shards?.length, 4, 'manifest needs four shards');
  equal(manifest.prefixes?.length, 29, 'manifest needs 29 prefixes');
  manifest.shards.forEach((shard, id) => equal(shard, {
    id, file: `tests/assembly/production-boot-conversation-shard-${id}.test.ts`, titleTemplate: title(id),
  }, 'manifest shard identity/title'));
  manifest.prefixes.forEach((prefix, ordinal) => equal(prefix, {
    ordinal, prefix: `${String(ordinal).padStart(2, '0')}-${stages[ordinal]}`, stage: stages[ordinal], shard: ordinal % 4,
  }, 'manifest reviewed ordinal/stage/assignment'));
  equal(new Set(manifest.prefixes.map(row => row.prefix)).size, 29, 'manifest unique prefixes');
  equal(new Set(manifest.prefixes.map(row => row.stage)).size, 29, 'manifest unique stages');
  equal(manifest.shards.map(row => manifest.prefixes.filter(prefix => prefix.shard === row.id).length), [8, 7, 7, 7], 'manifest shard sizes');
  return manifest;
}
const manifest = validateBootRecoveryManifest(json(join(root, 'tests/assembly/production-boot-conversation-shards.json')));
export const bootRecoveryEvidenceFiles = Object.freeze(manifest.shards.map(row => row.file));
const fullName = shard => shard.titleTemplate.replace('${fixtureAdmissionNames}', productionBindingHolds.join(', '));
function rootedFile(path) {
  fail(isAbsolute(path) && path.startsWith(root + '/') && lstatSync(path).isFile()
    && realpathSync(path) === path, `wrong rooted regular file: ${path}`);
  return path;
}
function allTestFiles(directory = join(root, 'tests')) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return allTestFiles(path);
    return entry.name.endsWith('.test.ts') ? [rootedFile(path)] : [];
  });
}
function timeWindow(start, end, lower, upper, message) {
  fail(finite(start) && finite(end) && start <= end && start >= lower && end <= upper, message);
}
function artifact(value, path) {
  fail(value && value.path === path && digest(value.hash), `artifact identity: ${path}`);
  equal(sha(JSON.stringify(value.data)), value.hash, `artifact bytes: ${path}`);
  return value.data;
}
function invocation(value, action, receipt) {
  equal(value, { action, installationRoot: receipt.installationRoot,
    installationHash: receipt.installation.hash, bin: receipt.bin }, `${action} immutable installation/bin`);
}
function checkReceipt(receipt, shard, file, sourceDigest, revision, bin, report, exit) {
  equal(receipt.version, 1, 'receipt version');
  equal(receipt.root, root, 'receipt checkout');
  equal(receipt.revision, revision, 'receipt revision');
  equal(receipt.sourceDigest, sourceDigest, 'receipt source digest');
  equal(receipt.file, file.name, 'receipt rooted file');
  equal(receipt.fullName, fullName(shard), 'receipt full name');
  equal(receipt.shard, shard.id, 'receipt shard');
  equal(receipt.bin, bin, 'current invoked bin bytes/path');
  timeWindow(receipt.start, receipt.end, Math.max(report.startTime, file.startTime),
    Math.min(file.endTime + 100, exit.ended), 'receipt outside current report/test execution window');
  // Successful roots are removed after fsync; their canonical paths were asserted
  // by the runner before each invocation, and are retained as evidence identities.
  fail(typeof receipt.workRoot === 'string' && isAbsolute(receipt.workRoot)
    && resolve(receipt.workRoot) === receipt.workRoot, 'canonical work root');
  equal(receipt.installationRoot, join(receipt.workRoot, 'installation'), 'installation within work root');
  const installation = artifact(receipt.installation, join(receipt.installationRoot, 'installation.json'));
  equal(installation.storageRoot, receipt.installationRoot, 'installation record storage root');
  const trace = receipt.trace;
  fail(typeof trace?.id === 'string' && trace.id.length > 0, 'originating trace identity');
  timeWindow(trace.start, trace.end, receipt.start, receipt.end, 'trace window');
  invocation(trace.invocation, 'trace', receipt);
  equal(trace.exit, { code: 0, signal: null }, 'trace process exit');
  const proof = artifact(trace.proof, join(receipt.installationRoot, 'trace-proof.json'));
  fail(proof.update > 0 && proof.replyMessage > 0 && !!proof.assessment
    && typeof proof.run === 'string' && proof.run.length > 0, 'complete trace assertions');
  equal(receipt.roster?.length, 29, 'complete snapshot roster');
  equal(receipt.roster.map(row => row.prefix), manifest.prefixes.map(row => row.prefix), 'snapshot exact ordering');
  const checkpoints = new Map();
  receipt.roster.forEach((row, ordinal) => {
    const expected = manifest.prefixes[ordinal];
    for (const key of ['ordinal', 'prefix', 'stage', 'shard']) equal(row[key], expected[key], `roster ${key}`);
    equal(row.traceId, trace.id, 'snapshot originating trace');
    const checkpoint = artifact(row.checkpoint, join(receipt.workRoot, 'snapshots', row.prefix, 'recorded-checkpoint.json'));
    equal(checkpoint.stage, expected.stage, 'snapshot stage');
    equal(checkpoint.run, proof.run, 'checkpoint originating trace run');
    fail(Array.isArray(checkpoint.facts) && checkpoint.facts.length > 0, 'checkpoint fact history');
    fail(checkpoint.facts.every(fact => typeof fact.id === 'string' && fact.id.length > 0
      && typeof fact.kind === 'string' && typeof fact.hash === 'string' && fact.hash.length > 0), 'checkpoint fact identities');
    equal(new Set(checkpoint.facts.map(fact => fact.id)).size, checkpoint.facts.length, 'checkpoint unique fact IDs');
    checkpoints.set(row.prefix, row);
  });
  const assigned = manifest.prefixes.filter(row => row.shard === shard.id);
  fail(Array.isArray(receipt.completed), 'completed cycles');
  equal(multiset(receipt.completed.map(row => row.prefix)), multiset(assigned.map(row => row.prefix)), 'exact local completion multiset');
  equal(receipt.completed.map(row => row.prefix), assigned.map(row => row.prefix), 'sequential assignment order');
  let previousEnd = trace.end;
  for (const row of receipt.completed) {
    const observed = checkpoints.get(row.prefix), checkpoint = observed.checkpoint.data;
    equal(row.ordinal, observed.ordinal, 'completion ordinal');
    equal(row.shard, shard.id, 'completion ownership');
    equal(row.traceId, trace.id, 'recovery originating trace');
    equal(row.checkpointPath, observed.checkpoint.path, 'recovery originating checkpoint');
    equal(row.checkpointHash, observed.checkpoint.hash, 'restored checkpoint bytes');
    equal(row.restoredPath, join(receipt.installationRoot, 'recorded-checkpoint.json'), 'restored same root');
    equal(row.expectedStage, observed.stage, 'expected stage');
    equal(row.actualStage, observed.stage, 'actual stage');
    timeWindow(row.start, row.end, previousEnd, receipt.end, 'sequential recovery window');
    previousEnd = row.end;
    invocation(row.pause, 'pause', receipt); invocation(row.inspect, 'inspect', receipt);
    equal(row.killed, { code: null, signal: 'SIGKILL' }, 'observed real SIGKILL');
    equal(row.inspected, { code: 0, signal: null }, 'inspect exit');
    const recovered = artifact(row.recoveryProof, join(receipt.installationRoot, 'recovery-proof.json'));
    equal(recovered.stage, observed.stage, 'recovery proof stage');
    for (const head of [row.expectedHead, row.actualHead, row.ready?.head, recovered.head])
      equal(head, checkpoint.facts.at(-1).hash, 'checkpoint/recovery head');
    equal(row.ready?.stage, checkpoint.stage, 'pause ready stage');
    equal(row.ready?.ready, true, 'pause ready');
    for (const count of [row.expectedCount, row.actualCount, recovered.count]) equal(count, checkpoint.facts.length, 'recovered fact count');
    for (const calls of [row.calls, recovered.calls]) equal(calls, ['getMe'], 'only getMe on recovery');
    for (const count of [row.providerCalls, recovered.providerCalls, row.providerAttempts, recovered.providerAttempts])
      equal(count, 0, 'zero recovery provider calls/attempts');
    for (const [kind, field, actual] of [['verification-', 'verificationIds', 'assessments'], ['effect-provider-', 'providerIds', 'provider']]) {
      const required = checkpoint.facts.filter(fact => fact.kind.startsWith(kind)).map(fact => fact.id);
      equal(row[field], required, 'required fact ID coverage');
      fail(Array.isArray(recovered[actual]) && required.every(id => recovered[actual].includes(id)), 'recovered required fact IDs');
    }
    if ([9, 10, 23, 24].includes(row.ordinal)) {
      fail(Array.isArray(recovered.run?.pending) && recovered.run.pending.length === 1, 'response-adjacent pending run');
      const unaccounted = recovered.accounting.filter(entry => entry.record.type === 'AdmissionReservation' && entry.record.state === 'consumed'
        && !recovered.accounting.some(other => other.record.type === 'SettlementApplication' && other.record.operation === entry.record.operation));
      fail(unaccounted.length > 0, 'response-adjacent unaccounted reservation');
      equal(row.responseAdjacent, { pending: recovered.run.pending, unaccounted: unaccounted.map(entry => entry.id) }, 'response-adjacent proof');
    } else equal(row.responseAdjacent, null, 'no substituted response-adjacent proof');
    if (row.ordinal === 28) {
      const final = recovered.accounting.filter(entry => entry.record.type === 'SettlementApplication').at(-1)?.record;
      fail(final?.actualCharge === -1 && final.unresolved === 1 && final.retryEligible === 0
        && recovered.run?.pending?.length === 1, 'reply-accounted settlement/pending');
      equal(row.replyAccounted, { actualCharge: -1, unresolved: 1, retryEligible: 0, pending: recovered.run.pending }, 'reply-accounted proof');
    } else equal(row.replyAccounted, null, 'no substituted reply-accounted proof');
  }
}
// `report` is one real Vitest main process's report: every arm below binds to that process's exit
// and to receipts only its own host wrote. Under INSTAR_TEST_PLATFORM_SPLIT that process ran half
// the checkout, so the other half's test files are supplied separately (scripts/split-report.mjs)
// and count only toward the whole-checkout file set. Unsplit callers pass none and nothing changes.
export function checkBootRecoveryCoverage(report, sourceDigest, otherHalfFiles = []) {
  fail(digest(sourceDigest), 'caller must supply current source digest');
  fail(report.success === true && report.numFailedTests === 0 && report.numFailedTestSuites === 0
    && !report.numRuntimeErrorTestSuites && !report.unhandledErrors?.length && !report.errors?.length
    && finite(report.startTime) && Array.isArray(report.testResults), 'successful full actual Vitest report required');
  const expectedFiles = allTestFiles().sort();
  const ranFiles = [...report.testResults.map(file => file.name), ...otherHalfFiles].map(rootedFile);
  equal(multiset(ranFiles), multiset(expectedFiles), 'full checkout test file multiset (focused reports cannot qualify)');
  const tests = report.testResults.flatMap(file => file.assertionResults ?? []);
  fail(report.testResults.every(file => file.status === 'passed' && !file.message)
    && tests.every(test => ['passed', 'skipped', 'pending', 'todo'].includes(test.status) && !test.failureMessages?.length), 'report contains failed/unfinished evidence');
  equal(report.numTotalTests, tests.length, 'report test count');
  equal(report.numPassedTests, tests.filter(test => test.status === 'passed').length, 'report passed count');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const reportDigest = sha(JSON.stringify(report));
  const processPath = join(root, '.instar/lanes/round4c-artifacts/process-exits.jsonl');
  const exits = (existsSync(processPath) ? readFileSync(processPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [])
    .filter(row => row.root === root && row.revision === revision && row.sourceDigest === sourceDigest
      && row.reportDigest === reportDigest && row.reportStart === report.startTime);
  fail(exits.length === 1 && exits[0].code === 0, 'one actual successful Vitest main-process exit required');
  const exit = exits[0];
  timeWindow(report.startTime, Math.max(...report.testResults.map(file => file.endTime)), exit.started - 1000, exit.ended + 100, 'report/process execution window');
  const binPath = rootedFile(join(root, 'bin/instar-production.mjs'));
  const bin = { path: realpathSync(binPath), hash: sha(readFileSync(binPath)) };
  const retired = join(root, 'tests/assembly/production-boot-conversation.test.ts');
  fail(!lstatSync(retired, { throwIfNoEntry: false }), 'retired monolith must be absent');
  const paths = bootRecoveryEvidenceFiles.map(file => rootedFile(join(root, file)));
  const names = manifest.shards.map(fullName);
  for (const file of report.testResults) {
    if (basename(file.name).startsWith('production-boot-conversation-shard-')) fail(paths.includes(file.name), 'unrecognized boot shard');
    for (const test of file.assertionResults ?? []) {
      if (names.includes(test.fullName) || test.fullName?.startsWith('bin + public boot: Telegram → Four → Five → Seven/Eight/Six → Nine → Five → reply;'))
        fail(paths.includes(file.name) && test.fullName === names[paths.indexOf(file.name)], 'duplicate/substitute boot identity');
    }
  }
  const receipts = manifest.shards.map(shard => {
    const file = report.testResults.find(row => row.name === paths[shard.id]);
    equal(file.assertionResults?.length, 1, 'exactly one test in shard file');
    const test = file.assertionResults[0];
    fail(test.fullName === names[shard.id] && test.status === 'passed', 'unique passing exact shard identity');
    const path = rootedFile(join(root, `.instar/lanes/boot-conversation-artifacts/shard-${shard.id}.json`));
    const receipt = json(path);
    checkReceipt(receipt, shard, file, sourceDigest, revision, bin, report, exit);
    return receipt;
  });
  equal(new Set(receipts.map(row => row.workRoot)).size, 4, 'four distinct work roots');
  equal(new Set(receipts.map(row => row.trace.id)).size, 4, 'four independent traces');
  const completed = receipts.flatMap(row => row.completed);
  equal(completed.length, 29, '29 completed cycles');
  equal(multiset(completed.map(row => row.prefix)), multiset(manifest.prefixes.map(row => row.prefix)), 'combined completed-prefix multiset');
  return { files: bootRecoveryEvidenceFiles, prefixes: completed.length, shards: receipts.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // CLI is also useful against isolated fixture roots. The caller computes the
  // current digest; keeping this module independent avoids an assembly cycle.
  const [reportPath, sourceDigest] = process.argv.slice(2);
  fail(reportPath && sourceDigest, 'usage: node scripts/check-boot-conversation-evidence.mjs REPORT CURRENT_SOURCE_DIGEST');
  console.log(JSON.stringify(checkBootRecoveryCoverage(json(resolve(reportPath)), sourceDigest)));
}
