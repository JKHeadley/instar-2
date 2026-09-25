import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical launchd watcher is JavaScript.
import { watchOnce, supervise } from '../../scripts/host-watch.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'host-watch-'))); roots.push(root);
  const state = { trial: { expiresAt: 1000000 }, stop: null, cycle: { at: 100, pid: 32111 } };
  writeFileSync(join(root, 'preview-state.json'), JSON.stringify(state));
  return { root, state };
}

it('prepares one outage notice and closes its episode only on a fresh heartbeat', () => {
  const { root, state } = fixture(); let sends = 0;
  const send = () => { sends += 1; };
  expect(watchOnce({ root, now: 40000, alive: () => false, send })).toBe('notified');
  expect(watchOnce({ root, now: 41000, alive: () => false, send })).toBe('already-notified');
  expect(sends).toBe(1);
  writeFileSync(join(root, 'preview-state.json'), JSON.stringify({ ...state, cycle: { at: 42000, pid: 32112 } }));
  expect(watchOnce({ root, now: 42001, alive: () => true, send })).toBe('healthy');
  expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8')).open).toBe(false);
  expect(watchOnce({ root, now: 80000, alive: () => false, send })).toBe('notified');
  expect(sends).toBe(2);
  writeFileSync(join(root, 'preview-stop.json'), JSON.stringify({ reason: 'breaker', latchedAt: 80001 }));
  expect(watchOnce({ root, now: 90000, forceOutage: true, send })).toBe('inactive');
  expect(sends).toBe(2);
  rmSync(join(root, 'preview-stop.json'));
  expect(watchOnce({ root, now: 1000000, forceOutage: true, send })).toBe('inactive');
});

it('does not resend if the watcher fails after preparing the outage', () => {
  const { root } = fixture(); let attempts = 0;
  expect(() => watchOnce({ root, now: 40000, alive: () => false,
    send: () => { attempts += 1; throw Error('interrupted send'); } })).toThrow('interrupted send');
  expect(watchOnce({ root, now: 41000, alive: () => false,
    send: () => { attempts += 1; } })).toBe('already-notified');
  expect(attempts).toBe(1);
});

it('ships a temporary-label launchd job with crash-only KeepAlive and no credential in argv', () => {
  const { root } = fixture();
  const template = readFileSync('scripts/host-watch.launchd.plist.template', 'utf8');
  const label = `test.instar.host-watch.${process.pid}`;
  const rendered = template.replace('__TEMP_OR_DEPLOYMENT_LABEL__', label)
    .replace('__ABSOLUTE_NODE__', process.execPath)
    .replace('__ABSOLUTE_HOST_WATCH_SCRIPT__', join(process.cwd(), 'scripts/host-watch.mjs'))
    .replace('__ABSOLUTE_NON_SECRET_CONFIG__', join(root, 'config.json'))
    .replace('__ABSOLUTE_SAFE_STDOUT_LOG__', join(root, 'out.log'))
    .replace('__ABSOLUTE_SAFE_STDERR_LOG__', join(root, 'err.log'));
  const path = join(root, 'test.plist'); writeFileSync(path, rendered);
  const lint = spawnSync('plutil', ['-lint', path], { encoding: 'utf8' });
  expect(lint.status).toBe(0);
  expect(rendered).toContain('<key>SuccessfulExit</key><false/>');
  expect(rendered).not.toContain('INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN');
  expect(rendered).not.toContain('123456:secret');
  expect(process.argv.join(' ')).not.toContain('123456:secret');
});

it('restarts a crashed child, then respects a durable stop latch', async () => {
  const { root, state } = fixture();
  writeFileSync(join(root, 'preview-state.json'), JSON.stringify({ ...state, trial: { expiresAt: Date.now() + 60000 } }));
  const script = join(root, 'child.mjs');
  writeFileSync(script, `import { existsSync, writeFileSync } from 'node:fs';
const marker = process.argv[2];
if (!existsSync(marker)) { writeFileSync(marker, 'first'); process.exit(23); }
writeFileSync(process.argv[3], JSON.stringify({ reason: 'breaker', latchedAt: Date.now() }));
process.exit(0);
`);
  const marker = join(root, 'launched'), stop = join(root, 'preview-stop.json');
  expect(await supervise({ root, cwd: root, agent: [process.execPath, script, marker, stop] })).toBe(0);
  expect(existsSync(marker)).toBe(true);
  expect(JSON.parse(readFileSync(stop, 'utf8')).reason).toBe('breaker');
  expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8')).open).toBe(true);
});

it('does not restart a successful agent exit', async () => {
  const { root, state } = fixture();
  writeFileSync(join(root, 'preview-state.json'), JSON.stringify({ ...state, trial: { expiresAt: Date.now() + 60000 } }));
  const script = join(root, 'success.mjs'), marker = join(root, 'launches');
  writeFileSync(script, `import { appendFileSync } from 'node:fs'; appendFileSync(process.argv[2], 'one\\n'); process.exit(0);`);
  expect(await supervise({ root, cwd: root, agent: [process.execPath, script, marker] })).toBe(0);
  expect(readFileSync(marker, 'utf8')).toBe('one\n');
  expect(existsSync(join(root, 'host-watch.json'))).toBe(false);
});
