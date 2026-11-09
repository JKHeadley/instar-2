import { it, expect } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { retryOnceAfterChildStall, isChildStall } from '../e2e/child-stall-retry.js';

const hang = ['-e', 'setTimeout(() => {}, 60000)'];
const bound = { timeout: 300, killSignal: 'SIGKILL' } as const;

it('recognises a real bounded child kill as a stall, from both spawnSync and execFileSync', () => {
  expect(isChildStall(spawnSync(process.execPath, hang, bound).error)).toBe(true);
  let thrown: unknown;
  try { execFileSync(process.execPath, hang, bound); } catch (error) { thrown = error; }
  expect(isChildStall(thrown)).toBe(true);
  expect(isChildStall(new Error('expected 86 to be 0'))).toBe(false);
  expect(isChildStall(null)).toBe(false);
});

it('reruns the whole scenario once after a stall and returns the fresh result', () => {
  const notes: string[] = []; let calls = 0;
  const value = retryOnceAfterChildStall('cut', () => {
    calls += 1;
    if (calls === 1) execFileSync(process.execPath, hang, bound);
    return `attempt ${calls}`;
  }, line => notes.push(line));
  expect(value).toBe('attempt 2'); expect(calls).toBe(2);
  expect(notes).toHaveLength(1); expect(notes[0]).toContain('child-stall-retry: cut');
});

it('raises a second stall, so a deterministic hang still fails', () => {
  const notes: string[] = []; let calls = 0;
  expect(() => retryOnceAfterChildStall('cut', () => { calls += 1; execFileSync(process.execPath, hang, bound); }, line => notes.push(line)))
    .toThrow(expect.objectContaining({ code: 'ETIMEDOUT' }));
  expect(calls).toBe(2); expect(notes).toHaveLength(1);
});

it('never retries any other failure, assertions included, and runs a passing scenario once', () => {
  const notes: string[] = []; let calls = 0;
  expect(() => retryOnceAfterChildStall('cut', () => { calls += 1; expect(1).toBe(2); }, line => notes.push(line))).toThrow();
  expect(calls).toBe(1);
  expect(() => retryOnceAfterChildStall('cut', () => { calls += 1; throw Object.assign(new Error('exit 1'), { code: 'ENOENT' }); }, line => notes.push(line))).toThrow('exit 1');
  expect(calls).toBe(2);
  expect(retryOnceAfterChildStall('cut', () => { calls += 1; return 'ok'; }, line => notes.push(line))).toBe('ok');
  expect(calls).toBe(3); expect(notes).toHaveLength(0);
});
