// Qualification-only Linux physical adapter. Rules 26/55/60/95.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function boundedLinuxRun(input) {
  const start = performance.now();
  const stopped = () => { try { return JSON.parse(readFileSync(input.stopFile)).stopped !== false; } catch { return true; } };
  const hold = (reason, attempts, diagnostics = '') => ({ disposition: 'hold', attempts, elapsedMs: performance.now() - start,
    raw: { stdout: '', rawError: diagnostics, limited: true, cancellationReason: reason, resources: { cleanup: 'unknown' } } });
  if (stopped()) return hold('stopped', 0);
  if (!Number.isFinite(input.profile?.deadlineMs) || input.profile.deadlineMs <= 0 || input.profile.deadlineMs > 120000
    || !Number.isSafeInteger(input.profile.memoryBytes) || input.profile.memoryBytes <= 0 || input.profile.memoryBytes > 3 * 1024 ** 3
    || !Number.isSafeInteger(input.profile.processCount) || input.profile.processCount < 1 || input.profile.processCount > 16) return hold('invalid bounds', 0);
  const p = input.profile;
  const args = ['--user', '--wait', '--pipe', '--quiet', '--collect',
    '-p', `MemoryMax=${p.memoryBytes}`, '-p', 'MemorySwapMax=0', '-p', 'CPUQuota=200%',
    '-p', `TasksMax=${p.processCount}`, '-p', `RuntimeMaxSec=${p.deadlineMs / 1000}s`,
    '-p', 'TimeoutStopSec=1s', '-p', 'ProtectSystem=strict', '-p', `ReadWritePaths=${input.root}`,
    '-p', 'NoNewPrivileges=yes', '-p', 'PrivateNetwork=yes', '-p', 'LimitFSIZE=1048576', '--working-directory', input.root,
    '/usr/bin/python3', fileURLToPath(new URL('./setup-qualification-linux.py', import.meta.url))];
  // The service independently enforces the deadline even if this caller disappears.
  return await new Promise(resolve => {
    let stdout = '', stderr = '', exceeded = false;
    const child = spawn('/usr/bin/systemd-run', args, { stdio: ['pipe', 'pipe', 'pipe'], timeout: Math.ceil(p.deadlineMs) + 2000, killSignal: 'SIGTERM' });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(input));
    child.stdout.on('data', bytes => { if (stdout.length + bytes.length <= 262144) stdout += bytes; else exceeded = true; });
    child.stderr.on('data', bytes => { if (stderr.length + bytes.length <= 65536) stderr += bytes; });
    child.on('error', error => resolve(hold('systemd unavailable', 1, error.message)));
    child.on('close', code => {
      if (exceeded) return resolve(hold('output limit', 1, stderr));
      try {
        const raw = JSON.parse(stdout);
        resolve({ disposition: code === 0 && raw.code === 0 && !raw.limited && raw.resources.cleanup === 'verified' ? 'observed' : 'hold',
          attempts: 1, elapsedMs: performance.now() - start, raw: { ...raw, serviceDiagnostics: stderr } });
      } catch { resolve(hold('service failed or reached resource/deadline ceiling', 1, JSON.stringify({code, stdout, stderr}))); }
    });
  });
}
