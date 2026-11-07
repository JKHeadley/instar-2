import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const preload = fileURLToPath(new URL('../setup/test-clock.mjs', import.meta.url));
const script = `
  const real = performance.timeOrigin + performance.now();
  const constructed = new Date().getTime();
  const callable = Date();
  const explicit = new Date('2026-12-12T21:40:00Z');
  const before = Date.now();
  setTimeout(() => console.log(JSON.stringify({ delta: before - real, constructed: constructed - before,
    callable: Math.abs(Date.parse(callable) - before), explicit: explicit.getTime(),
    instance: explicit instanceof Date, elapsed: Date.now() - before })), 25);
`;
for (const shift of ['-86400000', '0', 'bad']) it(`child clock ${shift}: native constructors and advancing timers`, () => {
  const child = spawnSync(process.execPath, ['--import', preload, '--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 10000, env: { ...process.env, NODE_OPTIONS: '', INSTAR_TEST_CLOCK_SHIFT_MS: shift },
  });
  expect(child.status, child.stderr).toBe(0);
  const result = JSON.parse(child.stdout);
  expect(Math.abs(result.delta - (shift === '-86400000' ? -86400000 : 0))).toBeLessThan(1000);
  expect(Math.abs(result.constructed)).toBeLessThan(1000);
  expect(result.callable).toBeLessThan(2000);
  expect(result.explicit).toBe(1797111600000);
  expect(result.instance).toBe(true);
  expect(result.elapsed).toBeGreaterThanOrEqual(15);
});
it('a child explicitly injecting a boundary clock overrides the inherited shift', () => {
  const child = spawnSync(process.execPath, ['--import', 'data:text/javascript,Date.now=()=>1797111600000', '-e', 'console.log(Date.now())'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, NODE_OPTIONS: `--import=${preload}`, INSTAR_TEST_CLOCK_SHIFT_MS: '-86400000' },
  });
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout.trim()).toBe('1797111600000');
});
