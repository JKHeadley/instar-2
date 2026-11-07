// A shifted run starts every worker at one fixed test time, so run evidence must stay on the host
// clock: the gate compares it with Vitest's unshifted report start (train-198 gate, 2026-11-07).
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error gate scripts ship no declarations
import { hostFileWindow } from '../../scripts/check-boot-conversation-evidence.mjs';
// @ts-expect-error gate scripts ship no declarations
import { proofIsCurrent } from '../../scripts/model-provider-contracts.mjs';
import { hostNow } from '../setup/host-clock.mjs';
import { realNow } from '../setup/test-clock-env.js';

const checkout = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const preload = join(checkout, 'tests/setup/test-clock.mjs');
const assertions = join(checkout, 'tests/model-provider/review/assertions.mjs');
const SHIFT = -15 * 86_400_000;

/** Run one real reviewer case in a child under the test clock; the child's own Date is returned beside the proof. */
function caseUnderTestClock(shift: number) {
  const directory = mkdtempSync(join(tmpdir(), 'test-clock-evidence-'));
  try {
    for (const name of ['tests', 'src', 'scripts']) symlinkSync(join(checkout, name), join(directory, name));
    const script = `const m = await import(${JSON.stringify(assertions)});
      await m.runAssertions('clock', async () => m.default.ok(true));
      console.log(Date.now());`;
    const child = spawnSync(process.execPath, ['--import', preload, '--input-type=module', '-e', script], {
      cwd: directory, encoding: 'utf8', timeout: 20000, env: { ...process.env, NODE_OPTIONS: '', INSTAR_TEST_CLOCK_SHIFT_MS: String(shift) },
    });
    expect(child.status, child.stderr).toBe(0);
    return { childDate: Number(child.stdout.trim()),
      proof: JSON.parse(readFileSync(join(directory, '.model-provider-review-proofs/clock.json'), 'utf8')) };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

it('a proof written under the test clock is current for the run that wrote it', () => {
  const report = { startTime: realNow() - 1000 };
  const { proof, childDate } = caseUnderTestClock(SHIFT);
  expect(Math.abs(childDate - realNow() - SHIFT)).toBeLessThan(5000);
  expect(proof.passed).toBe(true);
  expect(proofIsCurrent(proof, report)).toBe(true);
});

it('a proof from a previous run stays stale under the test clock', () => {
  const { proof } = caseUnderTestClock(SHIFT);
  expect(proofIsCurrent(proof, { startTime: realNow() + 1 })).toBe(false);
});

it('a proof stamped on the shifted clock is refused, and an unfinished one stays refused', () => {
  const { proof } = caseUnderTestClock(SHIFT);
  const report = { startTime: proof.startedAt - 1000 };
  expect(proofIsCurrent({ ...proof, startedAt: proof.startedAt + SHIFT, finishedAt: proof.finishedAt + SHIFT }, report)).toBe(false);
  expect(proofIsCurrent({ ...proof, finishedAt: undefined }, report)).toBe(false);
  expect(proofIsCurrent({ ...proof, finishedAt: proof.startedAt - 1 }, report)).toBe(false);
});

it('without a shift the same stamps and checks hold on the ordinary clock', () => {
  const report = { startTime: realNow() - 1000 };
  const { proof } = caseUnderTestClock(0);
  expect(proofIsCurrent(proof, report)).toBe(true);
  expect(proofIsCurrent(proof, { startTime: realNow() + 1 })).toBe(false);
});

it('hostNow reads the host clock in this worker, whatever the inherited shift', () => {
  expect(Math.abs(hostNow() - realNow())).toBeLessThan(1000);
});

it('a file window moves to the host clock by exactly the recorded shift', () => {
  const file = { startTime: 1000 + SHIFT, endTime: 2000 + SHIFT };
  expect(hostFileWindow(file, { clockShift: SHIFT })).toEqual({ start: 1000, end: 2000 });
  expect(hostFileWindow({ startTime: 1000, endTime: 2000 }, { clockShift: 0 })).toEqual({ start: 1000, end: 2000 });
  expect(hostFileWindow({ startTime: 1000, endTime: 2000 }, {})).toEqual({ start: 1000, end: 2000 });
});
