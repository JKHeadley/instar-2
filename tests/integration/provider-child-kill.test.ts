import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The physical host remains JavaScript.
import { productionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

it('kills the provider and its own hanging grandchild on timeout', async () => {
  const root = mkdtempSync(join(tmpdir(), 'provider-tree-')); roots.push(root);
  const pidFile = join(root, 'pids.json');
  const childFile = join(root, 'fork.mjs');
  writeFileSync(childFile, `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
writeFileSync(process.argv[2], JSON.stringify([process.pid, grandchild.pid]));
setInterval(() => {}, 1000);
`);
  const result = await productionProviderIO.execute({ executable: process.execPath, args: [childFile, pidFile],
    cwd: root, env: { PATH: process.env.PATH ?? '/usr/bin:/bin' }, stdin: '', timeout: 500, maxBytes: 1024 });
  expect(result.limited).toBe(true);
  expect(existsSync(pidFile)).toBe(true);
  const pids = JSON.parse(readFileSync(pidFile, 'utf8')) as number[];
  await new Promise(resolve => setTimeout(resolve, 100));
  for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
});
