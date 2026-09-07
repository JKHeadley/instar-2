import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

it('P5-NF-03 P5-NF-04 actual pinned P4 output resolves accountable ownership and opens exactly one P5 root without changing its cause', () => {
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-intake-joint.mjs'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  // Hide data-URL source text in a failing stack, while retaining actual errors.
  expect(child.stderr.split('\n').filter(line => !line.includes('data:text/javascript')).join('\n')).toBe('');
  expect(child.status).toBe(0);
  expect(JSON.parse(child.stdout)).toMatchObject({ intakeCommit: '28c84e0cf041b442436c3047fe50b25b74c6337a', owner: 'bob', state: 'ready',
    grounded: true, started: 'running', pendingSteps: 1, reservationConsumed: true, roots: 1, negativeControls: 6 });
  // Compiles pinned owner fixtures and executes signed P4/P5 admission, not a
  // runtime-latency assertion. No process boot receives a fabricated intake body.
}, 15000);
