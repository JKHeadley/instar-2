// @ts-nocheck -- isolated JSON evidence controls; never launches the production bin.
import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync, cpSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { productionBindingHolds } from '../../src/assembly/production-holds.js';

const checkout = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const manifest = JSON.parse(readFileSync(join(checkout, 'tests/assembly/production-boot-conversation-shards.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifact = (path, data) => ({ path, data, hash: sha(JSON.stringify(data)) });
const write = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };
const reportHash = report => sha(JSON.stringify(report));
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-evidence-control-')));
  const sourceDigest = sha('explicit synthetic current source authority for checker controls');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
  // Read-only revision lookup uses the real metadata; no Git mutation is performed.
  const gitdir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: checkout, encoding: 'utf8' }).trim();
  write(join(root, '.git'), `gitdir: ${gitdir}\n`);
  for (const file of ['scripts/check-boot-conversation-evidence.mjs', 'dist/assembly/production-holds.js',
    'tests/assembly/production-boot-conversation-shards.json']) write(join(root, file), readFileSync(join(checkout, file)));
  write(join(root, 'bin/instar-production.mjs'), '// Synthetic bin bytes for hashing only. NEVER EXECUTED.\n');
  const bin = { path: join(root, 'bin/instar-production.mjs'), hash: sha(readFileSync(join(root, 'bin/instar-production.mjs'))) };
  const start = Date.now() - 10000;
  const files = manifest.shards.map(shard => {
    write(join(root, shard.file), readFileSync(join(checkout, shard.file)));
    return { name: join(root, shard.file), status: 'passed', message: '', startTime: start + 10, endTime: start + 1000,
      assertionResults: [{ fullName: shard.titleTemplate.replace('${fixtureAdmissionNames}', productionBindingHolds.join(', ')),
        status: 'passed', duration: 990, failureMessages: [] }] };
  });
  const otherFile = join(root, 'tests/other.test.ts');
  write(otherFile, '// Synthetic non-boot file identity; focused four-shard report must omit it.\n');
  files.push({ name: otherFile, status: 'passed', message: '', startTime: start + 10, endTime: start + 1000,
    assertionResults: [{ fullName: 'other suite case', status: 'passed', failureMessages: [] }] });
  const report = { success: true, startTime: start, numFailedTests: 0, numFailedTestSuites: 0,
    numTotalTests: 5, numPassedTests: 5, testResults: files };
  const exit = { root, revision, sourceDigest, reportDigest: reportHash(report), reportStart: start,
    started: start - 10, ended: start + 1010, code: 0 };
  const receipts = manifest.shards.map(shard => {
    const workRoot = join(root, `removed-successful-work-${shard.id}`), installationRoot = join(workRoot, 'installation');
    const installation = artifact(join(installationRoot, 'installation.json'), { type: 'ProductionInstallation', storageRoot: installationRoot });
    const traceId = `independent-trace-${shard.id}`;
    const invocation = action => ({ action, installationRoot, installationHash: installation.hash, bin: { ...bin } });
    const roster = manifest.prefixes.map(expected => {
      const facts = [
        { id: `${traceId}-${expected.ordinal}-v`, kind: 'verification-assessment', hash: sha(`v-${traceId}-${expected.ordinal}`) },
        { id: `${traceId}-${expected.ordinal}-p`, kind: 'effect-provider-observation', hash: sha(`p-${traceId}-${expected.ordinal}`) },
      ];
      return { ...expected, traceId, checkpoint: artifact(join(workRoot, 'snapshots', expected.prefix, 'recorded-checkpoint.json'),
        { stage: expected.stage, facts, run: `run-${traceId}` }) };
    });
    const completed = roster.filter(row => row.shard === shard.id).map((observed, index) => {
      const checkpoint = observed.checkpoint.data, pending = [`pending-${traceId}`];
      const accounting = [{ id: 'reservation', record: { type: 'AdmissionReservation', state: 'consumed', operation: 'op-pending' } }];
      if (observed.ordinal === 28) accounting.push({ id: 'settlement', record: {
        type: 'SettlementApplication', operation: 'op-settled', actualCharge: -1, unresolved: 1, retryEligible: 0 } });
      const recovered = { stage: observed.stage, head: checkpoint.facts.at(-1).hash, count: checkpoint.facts.length,
        calls: ['getMe'], providerCalls: 0, providerAttempts: 0, assessments: [checkpoint.facts[0].id],
        provider: [checkpoint.facts[1].id], run: { pending }, accounting };
      return { ordinal: observed.ordinal, prefix: observed.prefix, shard: shard.id, traceId,
        expectedStage: observed.stage, actualStage: observed.stage, start: start + 100 + index * 10, end: start + 105 + index * 10,
        checkpointPath: observed.checkpoint.path, checkpointHash: observed.checkpoint.hash,
        restoredPath: join(installationRoot, 'recorded-checkpoint.json'), expectedHead: recovered.head, actualHead: recovered.head,
        expectedCount: recovered.count, actualCount: recovered.count, pause: invocation('pause'),
        ready: { ready: true, stage: observed.stage, head: recovered.head }, killed: { code: null, signal: 'SIGKILL' },
        inspect: invocation('inspect'), inspected: { code: 0, signal: null },
        recoveryProof: artifact(join(installationRoot, 'recovery-proof.json'), recovered), calls: recovered.calls,
        providerCalls: 0, providerAttempts: 0, verificationIds: recovered.assessments, providerIds: recovered.provider,
        responseAdjacent: [9, 10, 23, 24].includes(observed.ordinal) ? { pending, unaccounted: ['reservation'] } : null,
        replyAccounted: observed.ordinal === 28 ? { actualCharge: -1, unresolved: 1, retryEligible: 0, pending } : null };
    });
    return { version: 1, root, revision, sourceDigest, file: files[shard.id].name,
      fullName: files[shard.id].assertionResults[0].fullName, shard: shard.id, start: start + 11, end: start + 999,
      workRoot, installationRoot, installation, bin: { ...bin }, trace: { id: traceId, start: start + 12, end: start + 90,
        invocation: invocation('trace'), exit: { code: 0, signal: null },
        proof: artifact(join(installationRoot, 'trace-proof.json'), { run: `run-${traceId}`, update: 1, replyMessage: 2, assessment: `assessment-${traceId}` }) },
      roster, completed };
  });
  const f = { root, report, exit, receipts, sourceDigest, missing: [], extraExits: [], preserveReportDigest: false,
    manifest: structuredClone(manifest), afterWrite: () => {} };
  return f;
}
function run(f) {
  write(join(f.root, 'report.json'), JSON.stringify(f.report));
  if (!f.preserveReportDigest) f.exit.reportDigest = reportHash(f.report);
  write(join(f.root, '.instar/lanes/round4c-artifacts/process-exits.jsonl'),
    [f.exit, ...f.extraExits].filter(Boolean).map(row => JSON.stringify(row)).join('\n') + '\n');
  write(join(f.root, 'tests/assembly/production-boot-conversation-shards.json'), JSON.stringify(f.manifest));
  for (const receipt of f.receipts) if (!f.missing.includes(receipt.shard))
    write(join(f.root, `.instar/lanes/boot-conversation-artifacts/shard-${receipt.shard}.json`), JSON.stringify(receipt));
  f.afterWrite();
  // Only the evidence checker CLI runs. The synthetic bin is never imported.
  return spawnSync(process.execPath, [join(f.root, 'scripts/check-boot-conversation-evidence.mjs'),
    join(f.root, 'report.json'), f.sourceDigest], { cwd: f.root, encoding: 'utf8', timeout: 5000 });
}
function cycle(f, ordinal = 0) { return f.receipts[ordinal % 4].completed.find(row => row.ordinal === ordinal); }
function changeProof(f, ordinal, mutate) {
  const row = cycle(f, ordinal); mutate(row.recoveryProof.data);
  row.recoveryProof.hash = sha(JSON.stringify(row.recoveryProof.data));
}
function control(name, mutate, error) {
  it(`BOOT-SPLIT evidence refuses ${name}`, () => {
    const f = fixture();
    try {
      mutate(f);
      const result = run(f);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(result.stderr).toMatch(error);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
}
it('BOOT-SPLIT evidence accepts four independent complete fixture receipts and is read-only/idempotent', () => {
  const f = fixture();
  try {
    for (let repeat = 0; repeat < 2; repeat++) {
      const result = run(f);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ files: manifest.shards.map(row => row.file), prefixes: 29, shards: 4 });
    }
    for (const receipt of f.receipts) expect(JSON.parse(readFileSync(join(f.root,
      `.instar/lanes/boot-conversation-artifacts/shard-${receipt.shard}.json`), 'utf8'))).toEqual(receipt);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
control('missing shard', f => { f.report.testResults.splice(0, 1); }, /full checkout test file multiset/);
control('skipped shard', f => { f.report.testResults[0].assertionResults[0].status = 'skipped'; f.report.numPassedTests--; }, /unique passing exact shard identity/);
control('duplicate test identity', f => { f.report.testResults[0].assertionResults.push(structuredClone(f.report.testResults[0].assertionResults[0])); f.report.numTotalTests++; f.report.numPassedTests++; }, /exactly one test/);
control('duplicate prefix', f => { f.receipts[0].completed.push(structuredClone(cycle(f))); }, /completion multiset/);
control('omitted prefix', f => { f.receipts[1].completed.pop(); }, /completion multiset/);
control('substituted prefix', f => { cycle(f).prefix = '00-counterfeit'; }, /completion multiset/);
control('misassigned prefix', f => { cycle(f).shard = 1; }, /completion ownership/);
control('wrong stage', f => { cycle(f).actualStage = 'reply-accounted'; }, /actual stage/);
control('stale receipt', f => { f.receipts[0].start = f.report.startTime - 100; }, /execution window/);
control('wrong-root receipt', f => { f.receipts[0].root = dirname(f.root); }, /receipt checkout/);
for (const ordinal of [9, 10, 23, 24]) control(`missing response-adjacent proof ${ordinal}`, f => { cycle(f, ordinal).responseAdjacent = null; }, /response-adjacent proof/);
control('failed inspect', f => { cycle(f).inspected.code = 1; }, /inspect exit/);
control('wrong kill signal', f => { cycle(f).killed.signal = 'SIGTERM'; }, /observed real SIGKILL/);
control('JSON success with nonzero main-process exit', f => { f.exit.code = 1; }, /actual successful Vitest main-process exit/);
control('early-return shard with empty completion list', f => { f.receipts[2].completed = []; }, /completion multiset/);
control('missing receipt', f => { f.missing.push(3); }, /ENOENT/);
control('prior-revision receipt', f => { f.receipts[0].revision = 'old-revision'; }, /receipt revision/);
control('self-reported obsolete source digest', f => { f.receipts[0].sourceDigest = sha('obsolete'); }, /receipt source digest/);
control('changed current bin bytes', f => { write(join(f.root, 'bin/instar-production.mjs'), '// changed\n'); }, /current invoked bin/);
control('wrong bin realpath', f => { f.receipts[0].bin.path = join(f.root, 'different-bin.mjs'); }, /current invoked bin/);
control('changed installation hash', f => { f.receipts[0].installation.hash = sha('different'); }, /artifact bytes/);
control('rebound installation record', f => { const a = f.receipts[0].installation; a.data.storageRoot = '/different'; a.hash = sha(JSON.stringify(a.data)); }, /installation record storage root/);
control('cross-shard restart root', f => { cycle(f).inspect.installationRoot = f.receipts[1].installationRoot; }, /inspect immutable installation/);
control('wrong originating trace', f => { cycle(f).traceId = f.receipts[1].trace.id; }, /recovery originating trace/);
control('wrong originating checkpoint', f => { cycle(f).checkpointHash = sha('different'); }, /restored checkpoint bytes/);
control('incomplete observed roster', f => { f.receipts[0].roster.pop(); }, /complete snapshot roster/);
control('duplicate logical stage', f => { f.receipts[0].roster[1].stage = 'intake'; }, /roster stage/);
control('unexpected snapshot ordering', f => { f.receipts[0].roster.reverse(); }, /snapshot exact ordering/);
control('manifest cardinality change', f => { f.manifest.prefixes.pop(); }, /manifest needs 29/);
control('manifest duplicate assignment', f => { f.manifest.prefixes[1].shard = 0; }, /manifest reviewed ordinal/);
control('manifest substituted boundary', f => { f.manifest.prefixes[0].stage = 'other'; }, /manifest reviewed ordinal/);
control('manifest renamed shard', f => { f.manifest.shards[0].file = 'tests/other.test.ts'; }, /manifest shard identity/);
control('focused four-shard report', f => { f.report.testResults.pop(); f.report.numTotalTests--; f.report.numPassedTests--; }, /full checkout test file multiset/);
control('other rooted file substituted for a shard', f => { const file = f.report.testResults[0]; file.name = join(f.root, 'tests/counterfeit.test.ts'); write(file.name, '// substitute'); }, /full checkout test file multiset/);
control('basename-only shard identity', f => { f.report.testResults[0].name = manifest.shards[0].file; }, /wrong rooted regular file/);
control('retired monolith substitute', f => { write(join(f.root, 'tests/assembly/production-boot-conversation.test.ts'), '// retired'); }, /full checkout test file multiset/);
control('unrecognized extra boot shard', f => {
  const file = structuredClone(f.report.testResults[0]); file.name = join(f.root, 'tests/assembly/production-boot-conversation-shard-4.test.ts');
  write(file.name, '// unknown shard'); f.report.testResults.push(file); f.report.numTotalTests++; f.report.numPassedTests++;
}, /unrecognized boot shard/);
control('exact boot title duplicated in another file', f => { f.report.testResults[4].assertionResults[0].fullName = f.report.testResults[0].assertionResults[0].fullName; }, /duplicate\/substitute boot identity/);
control('wrong shard title', f => { f.report.testResults[0].assertionResults[0].fullName = 'green substitute'; }, /unique passing exact shard identity/);
control('missing process exit', f => { f.exit.root = '/other'; }, /actual successful Vitest main-process exit/);
control('duplicate process exits', f => { f.extraExits.push(structuredClone(f.exit)); }, /actual successful Vitest main-process exit/);
control('exit bound to another report', f => { f.preserveReportDigest = true; f.exit.reportDigest = sha('another report'); }, /actual successful Vitest main-process exit/);
control('exit bound to another report start', f => { f.exit.reportStart--; }, /actual successful Vitest main-process exit/);
control('unhandled report error', f => { f.report.unhandledErrors = ['worker failure']; }, /successful full actual Vitest report/);
control('failed file under success JSON', f => { f.report.testResults[4].status = 'failed'; }, /failed\/unfinished evidence/);
control('wrong recovered head', f => { cycle(f).actualHead = 'other-head'; }, /checkpoint\/recovery head/);
control('wrong recovered count', f => { cycle(f).actualCount++; }, /recovered fact count/);
control('second Telegram call', f => { cycle(f).calls = ['getMe', 'sendMessage']; }, /only getMe/);
control('provider attempt', f => { cycle(f).providerAttempts = 1; }, /zero recovery provider/);
control('omitted verification fact ID', f => { changeProof(f, 0, proof => { proof.assessments = []; }); }, /recovered required fact IDs/);
control('omitted provider fact ID', f => { changeProof(f, 0, proof => { proof.provider = []; }); }, /recovered required fact IDs/);
control('missing pending run at response boundary', f => { changeProof(f, 9, proof => { proof.run.pending = []; }); }, /response-adjacent pending run/);
control('accounted reservation at response boundary', f => { changeProof(f, 10, proof => { proof.accounting = []; }); }, /response-adjacent unaccounted reservation/);
control('missing final reply-accounted recovery', f => { f.receipts[0].completed.pop(); }, /completion multiset/);
control('wrong reply-accounted settlement', f => { changeProof(f, 28, proof => { proof.accounting.at(-1).record.retryEligible = 1; }); }, /reply-accounted settlement/);
control('overlapping recovery cycles', f => { f.receipts[0].completed[1].start = f.receipts[0].completed[0].start; }, /sequential recovery window/);
control('symlink shard alias', f => {
  const path = join(f.root, manifest.shards[0].file), copy = join(f.root, 'alias.ts'); cpSync(path, copy); rmSync(path); symlinkSync(copy, path);
}, /wrong rooted regular file/);
control('symlink receipt alias', f => { f.afterWrite = () => {
  const path = join(f.root, '.instar/lanes/boot-conversation-artifacts/shard-0.json'), copy = join(f.root, 'receipt-alias.json');
  cpSync(path, copy); rmSync(path); symlinkSync(copy, path);
}; }, /wrong rooted regular file/);

control('shared work root across otherwise complete shards', f => {
  const oldRoot = f.receipts[1].workRoot, newRoot = f.receipts[0].workRoot;
  f.receipts[1] = JSON.parse(JSON.stringify(f.receipts[1]).replaceAll(oldRoot, newRoot));
  const receipt = f.receipts[1]; receipt.installation.hash = sha(JSON.stringify(receipt.installation.data));
  receipt.trace.invocation.installationHash = receipt.installation.hash;
  for (const row of receipt.completed) {
    row.pause.installationHash = receipt.installation.hash; row.inspect.installationHash = receipt.installation.hash;
  }
}, /four distinct work roots/);
control('reused originating trace ID', f => {
  const receipt = f.receipts[1]; receipt.trace.id = f.receipts[0].trace.id;
  for (const row of [...receipt.roster, ...receipt.completed]) row.traceId = receipt.trace.id;
}, /four independent traces/);
control('checkpoint from another trace run', f => {
  const checkpoint = f.receipts[0].roster[0].checkpoint;
  checkpoint.data.run = 'another-run'; checkpoint.hash = sha(JSON.stringify(checkpoint.data));
}, /checkpoint originating trace run/);
