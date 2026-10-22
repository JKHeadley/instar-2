// @ts-nocheck -- execute the shipped page expression in distinct isolated/main worlds.
import { expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { hostname, tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runInNewContext } from 'node:vm';
import { authorizeSigninPage, waitForSigninAuthorization } from '../../scripts/claude-signin-authorize.mjs';
import { runClaudeSignin, signinDigest } from '../../scripts/claude-signin-io.mjs';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/signin/claude-authorize-studio.json', import.meta.url), 'utf8')).page;
function page() {
  let elapsed = 0, armedAt = Infinity;
  const events = [], clicks = [];
  const buttons = recorded.buttons.map(b => ({ ...b, innerText: b.text,
    getBoundingClientRect: () => ({ width: 100, height: 40 }),
    getAttribute: () => null,
    click() { if (!this.disabled) clicks.push(this.text); } }));
  const location = new URL(`${recorded.origin}${recorded.path}?state=fixture-state`);
  const document = { body: { innerText: recorded.text }, querySelectorAll: () => buttons,
    createElement: () => ({ dataset: {}, remove() {} }), currentScript: null,
    head: { appendChild(script) {
      document.currentScript = script;
      runInNewContext(script.textContent, main); document.currentScript = null;
    } } };
  const main = { document, location, URL, FocusEvent: class { constructor(type) { this.type = type; } },
    window: { dispatchEvent(event) { events.push(event.type); armedAt = elapsed + 700; } } };
  const isolated = { ...main, window: { dispatchEvent() { throw Error('wrong world'); } } };
  const evaluate = vi.fn(async script => runInNewContext(script, isolated));
  const pause = vi.fn(async ms => { elapsed += ms; if (elapsed >= armedAt) buttons[0].disabled = false; });
  const controller = new AbortController();
  return { document, location, buttons, events, clicks, evaluate, pause, controller,
    run: () => authorizeSigninPage({ evaluate, pause, signal: controller.signal,
      expectedAccount: 'justin@sagemindai.io', state: 'fixture-state' }) };
}
it('replays the recorded disabled Claude page: main-world focus, 2 seconds, then Authorize once', async () => {
  const p = page();
  expect(p.buttons[0].disabled).toBe(true);
  expect(await p.run()).toBe('clicked');
  expect(p.events).toEqual(['focus']); expect(p.pause).toHaveBeenCalledWith(2000);
  expect(p.clicks).toEqual(['Authorize']);
});
it.each(['origin', 'path', 'state', 'account', 'missing-identity', 'ambiguous-identity', 'missing-button', 'ambiguous-button', 'hidden-button'])('does not authorize a changed %s', async change => {
  const p = page();
  if (change === 'origin') p.location.hostname = 'claude.ai.attacker.invalid';
  if (change === 'path') p.location.pathname = '/settings';
  if (change === 'state') p.location.search = '?state=other';
  if (change === 'account') p.document.body.innerText = recorded.text.replace('justin@sagemindai.io', 'someone@example.invalid');
  if (change === 'missing-identity') p.document.body.innerText = 'Authorize';
  if (change === 'ambiguous-identity') p.document.body.innerText += '\nLogged in as someone@example.invalid';
  if (change === 'missing-button') p.buttons.splice(0, 1);
  if (change === 'ambiguous-button') p.buttons.push(p.buttons[0]);
  if (change === 'hidden-button') p.buttons[0].getBoundingClientRect = () => ({ width: 0, height: 0 });
  expect(await p.run()).not.toBe('clicked');
  expect(p.events).toEqual([]); expect(p.clicks).toEqual([]);
});
it.each(['account', 'state', 'disabled', 'stop'])('rechecks %s after waiting, without forcing the control', async change => {
  const p = page();
  p.pause.mockImplementation(async () => {
    if (change !== 'disabled') p.buttons[0].disabled = false;
    if (change === 'account') p.document.body.innerText = recorded.text.replace('justin@sagemindai.io', 'someone@example.invalid');
    if (change === 'state') p.location.search = '?state=changed';
    if (change === 'stop') p.controller.abort();
  });
  expect(await p.run()).not.toBe('clicked'); expect(p.clicks).toEqual([]);
  expect(p.buttons[0].disabled).toBe(change === 'disabled');
});
it('stops before page evaluation when aborted', async () => {
  const p = page(); p.controller.abort();
  expect(await p.run()).toBe('stopped'); expect(p.evaluate).not.toHaveBeenCalled();
});
it('reports unavailable when the page blocks main-world injection', async () => {
  const p = page(); p.document.head.appendChild = () => {};
  expect(await p.run()).toBe('unavailable'); expect(p.clicks).toEqual([]);
});
it('keeps enabled Authorize working through the same bounded step', async () => {
  const p = page(); p.buttons[0].disabled = false;
  expect(await p.run()).toBe('clicked'); expect(p.clicks).toEqual(['Authorize']);
});
it('respects aria-disabled even when the native disabled flag clears', async () => {
  const p = page(); p.buttons[0].getAttribute = name => name === 'aria-disabled' ? 'true' : null;
  expect(await p.run()).toBe('disabled'); expect(p.clicks).toEqual([]);
});
it('bounds waiting for a page that never arrives, using a fake clock rather than Studio load', async () => {
  const p = page(); p.location.pathname = '/login';
  expect(await waitForSigninAuthorization({ evaluate: p.evaluate, pause: p.pause,
    signal: p.controller.signal, expectedAccount: 'justin@sagemindai.io', state: 'fixture-state' })).toBe('unavailable');
  expect(p.pause).toHaveBeenCalledTimes(300); expect(p.events).toEqual([]); expect(p.clicks).toEqual([]);
});
it('reobserves a failed read during navigation, but never retries an uncertain click', async () => {
  const p = page(), evaluate = p.evaluate;
  evaluate.mockRejectedValueOnce(Error('navigation'));
  expect(await p.run()).toBe('waiting'); expect(p.events).toEqual([]);
  expect(await p.run()).toBe('clicked'); expect(p.clicks).toEqual(['Authorize']);
  const q = page();
  q.buttons[0].click = () => { q.clicks.push('Authorize'); throw Error('navigation after click'); };
  await expect(waitForSigninAuthorization({ evaluate: q.evaluate, pause: q.pause,
    signal: q.controller.signal, expectedAccount: 'justin@sagemindai.io', state: 'fixture-state' })).rejects.toThrow();
  expect(q.clicks).toEqual(['Authorize']);
});
it.each(['continue', 'stop', 'native-exit', 'browser-error'])('the shipped native flow drives the recorded consent page; focus wait=%s', async outcome => {
  const p = page(), root = realpathSync(mkdtempSync(join(tmpdir(), 'signin-authorize-')));
  const child = Object.assign(new EventEmitter(), { pid: 1234, stdin: new PassThrough(),
    stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => { queueMicrotask(() => child.emit('close', 1)); }) });
  const terminal = JSON.parse(readFileSync(new URL('./fixtures/signin/claude-login-studio.json', import.meta.url), 'utf8')).terminal;
  p.location.search = '?state=REDACTED';
  try {
    symlinkSync(`${hostname()}-${process.pid}`, join(root, 'SingletonLock'));
    const executable = realpathSync('/bin/echo');
    // runClaudeSignin must observe an absent lock before launch. The fake normal
    // launcher publishes the owned process lock only after the CLI is started.
    rmSync(join(root, 'SingletonLock'));
    const runBrowser = vi.fn(async (file, args, options) => {
      if (file === '/usr/bin/open') { symlinkSync(`${hostname()}-${process.pid}`, join(root, 'SingletonLock')); return ''; }
      if (file === '/bin/ps') return `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=${root} about:blank`;
      if (options.input.includes("location.href !== 'about:blank'")) return 'opened';
      const result = await p.evaluate(options.input);
      if (result === 'clicked') queueMicrotask(() => child.emit('close', 0));
      return result;
    });
    const result = await runClaudeSignin({ profile: { executable, artifact: `sha256:${signinDigest(readFileSync(executable))}`,
      expectedAccount: 'justin@sagemindai.io' }, directory: join(root, 'scratch'), browser: root,
      signal: p.controller.signal, runBrowser,
      pause: async ms => {
        if (outcome === 'stop') p.controller.abort();
        else if (outcome === 'native-exit') { child.emit('close', 0); throw Error('aborted'); }
        else if (outcome === 'browser-error') throw Error('synthetic-private-error');
        else await p.pause(ms);
      },
      spawnCli: () => { queueMicrotask(() => child.stdout.write(terminal)); return child; } });
    expect(result.kind).toBe(['continue', 'native-exit'].includes(outcome) ? 'complete' : 'unfinished');
    expect(p.events).toEqual(['focus']); expect(p.clicks).toEqual(outcome === 'continue' ? ['Authorize'] : []);
    expect(JSON.stringify(runBrowser.mock.calls.map(c => c.slice(0, 2)))).not.toContain('REDACTED');
    expect(child.stdin.destroyed).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
