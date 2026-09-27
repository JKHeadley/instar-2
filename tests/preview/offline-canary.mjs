#!/usr/bin/env node
// One foreground offline pre-switch check. Vitest names only this canary file.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
  'tests/preview/offline-canary.test.ts', '--configLoader', 'runner', '--maxWorkers', '1'],
{ cwd: repo, stdio: 'inherit', timeout: 120000 });
if (result.error) process.stderr.write(`${result.error.message}\n`);
const passed = result.status === 0 && !result.error;
process.stdout.write(`OFFLINE PRE-SWITCH CANARY: ${passed ? 'PASS' : 'FAIL'}\n`);
process.exitCode = passed ? 0 : 1;
