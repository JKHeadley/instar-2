// One Vitest lifetime per test file preserves the complete suite while preventing
// cross-file worker accumulation. The suite contains long compiled-process lifecycle
// files; one 16+ minute worker can otherwise hit Vitest 3's fixed 60s onTaskUpdate RPC
// timeout under machine contention after every assertion has passed. Blob merge is
// Vitest's native sharding path, so unhandled errors, failures, skips, and test identities
// remain part of one canonical JSON report consumed by the contract-map gates.
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

async function testFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? testFiles(path) : [path];
  }));
  return nested.flat();
}

const shardCount = (await testFiles('tests')).filter(path => path.endsWith('.test.ts')).length;
if (shardCount === 0) throw new Error('no Vitest files found');
const reports = await mkdtemp(join(tmpdir(), 'instar-vitest-reports-'));
const vitest = 'node_modules/vitest/vitest.mjs';

const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [vitest, ...args], { stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`vitest ${args.join(' ')} ${signal ? `received ${signal}` : `exited ${code}`}`));
  });
});

try {
  for (let shard = 1; shard <= shardCount; shard += 1) {
    await run(['run', `--shard=${shard}/${shardCount}`, '--reporter=blob',
      `--outputFile=${join(reports, `blob-${shard}.json`)}`]);
  }
  await run([`--merge-reports=${reports}`, '--reporter=json', '--outputFile=.test-results.json']);
} finally {
  await rm(reports, { recursive: true, force: true });
}
