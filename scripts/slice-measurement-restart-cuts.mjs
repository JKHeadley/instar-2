import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const worker = new URL('./slice-measurement-restart-worker.mjs', import.meta.url);
const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
const cuts = ['before-write', 'after-write', 'before-file-sync', 'after-file-sync', 'before-rename', 'after-rename',
  'before-directory-sync', 'after-directory-sync', 'after-ack'];
const results = [];
for (const cut of [...cuts, 'control']) {
  const directory = mkdtempSync(join(tmpdir(), 'p16-restart-cut-'));
  const run = (mode, selected) => spawnSync(viteNode, ['--script', worker.pathname, directory, mode, selected], { encoding: 'utf8', detached: true });
  const killed = run('write', cut); const recovered = run('read', 'none'); const repeated = run('read', 'none');
  let value = null; try { value = JSON.parse(recovered.stdout); } catch {}
  results.push({ cut, signal: killed.signal, writeExit: killed.status, readExit: recovered.status,
    writeError: killed.stderr, readError: recovered.stderr, recovered: value, equalRepeatedRead: recovered.stdout === repeated.stdout });
}
if (results.some(row => row.readExit !== 0 || !row.equalRepeatedRead
  || row.cut !== 'control' && row.signal !== 'SIGKILL' || row.cut === 'control' && row.writeExit !== 0)) process.exitCode = 1;
console.log(JSON.stringify(results));
