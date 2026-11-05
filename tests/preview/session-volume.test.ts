// Rule 60 and Part fifteen §5 (docs/19-scheduled-work): the delegated session's working scope is a fixed-size volume, so
// the sum of everything a step writes, however many files, is bounded together (a per-file limit bounds none of that).
// The real mechanism runs here: a small sparse disk image mounted at the scope, filled past its size by many files.
import { expect, it } from 'vitest';
import { runChild } from '../e2e/async-child.js';

const darwin = process.platform === 'darwin';
it.runIf(darwin)('bounds the sum of a session\'s writes at its volume, keeps ordinary multi-file work, and persists across a remount', async () => {
  // hdiutil may take up to 60s per call. Await the whole lifecycle, including
  // cleanup, without blocking task-update IPC or the default 10s hook timer.
  const child = await runChild(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/session-volume-worker.mjs'], { timeout: 110_000 });
  expect(child.status, child.stderr).toBe(0);
  expect(child.signal).toBeNull();
  expect(child.stdout).toContain('session volume: bounded writes, retained files, remount and cleanup passed');
}, 120_000);
