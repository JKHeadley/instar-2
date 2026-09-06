import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P6-NF-11 P6-NF-14 P6-NF-19 P6-NF-34 P6-NF-36 P6-NF-39 SIGKILL after settlement commit before ACK rebuilds one application and exact spend bound', async () => {
  for (const cut of ['held', 'released', 'local-only']) {
    const seed = join(mkdtempSync(join(tmpdir(), 'p6-settlement-kill-')), 'seed.json');
    const child = spawn(process.execPath, ['tests/transport/settlement-worker.mjs', 'start', seed, cut], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', data => { stderr += String(data); });
    try {
      const ready = await new Promise<{ ready: boolean }>((resolve, reject) => {
        let stdout = '';
        child.stdout.on('data', data => { stdout += String(data); if (stdout.includes('\n')) resolve(JSON.parse(stdout.trim())); });
        child.once('exit', code => reject(Error(`settlement worker exited ${code}: ${stderr}`)));
        child.once('error', reject);
      });
      expect(ready.ready).toBe(true);
      const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGKILL'); await exited;
      // Leave Vitest's reporting RPC responsive while the real restart runs.
      const restored = await promisify(execFile)(process.execPath, ['tests/transport/settlement-worker.mjs', 'restore', seed], { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
      expect(JSON.parse(restored.stdout)).toEqual({ applications: 1, exposure: cut === 'held' ? 20 : 7, released: cut === 'held' ? 0 : 13, calls: 0 });
      if (cut !== 'held') {
        const inspected = await promisify(execFile)(process.execPath, ['tests/transport/settlement-worker.mjs', 'inspect-next', seed],
          { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
        expect(JSON.parse(inspected.stdout)).toEqual({ inspected: true, state: 'consumed', custodyReads: 0, calls: 0 });
      }
    } finally { child.kill('SIGKILL'); }
  }
  // Three real compiled-owner SIGKILL/restart cycles, including missing accounting replica;
  // not a claim about production recovery latency.
}, 150000);
