import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
// @ts-expect-error owner physical adapter
import { createOwnerBrowser, runOwnerBrowserHelper, chromePid, readOwnerBrowserBinding, ownerBrowserObservation, ownerBrowserDom, OWNER_BROWSER_DOM } from './owner-browser.mjs';
// @ts-expect-error hook contract stays plain JavaScript
import { OWNER_BROWSER_TOOL, ownerBrowserRequest } from './owner-browser-contract.mjs';
// @ts-expect-error hook stays plain JavaScript
import { admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error held-secret physical adapter
import { createHeldSecrets, heldVerdict } from './tool-turn.mjs';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const binding = { profileId: 'echoofdawn-github', service: 'github', account: 'EchoOfDawn', ownership: 'agent', userDataDir: '/owned/chrome' };
const table = '81453 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/owned/chrome\n'
  + '81454 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/operator/chrome\n'
  + '81455 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/owned/chrome --type=renderer';
const good = JSON.stringify({ status: 'observed', origin: 'https://github.com', path: '/settings/profile', account: 'EchoOfDawn', title: 'Your profile' });
const policy = () => ({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
  registered: [{ effect: 'tool:mcp', target: OWNER_BROWSER_TOOL, consequence: 'data', reversibility: 'reversible', reach: 'agent', costUsd: 0, source: 'operator:read' }],
  grants: [{ id: 'read-echo-profile', effect: 'tool:mcp', target: OWNER_BROWSER_TOOL, approves: ['scope'], source: 'operator:read', custodian: 'owner', recovery: 'withdraw grant', expiresAt: 100 }] });
it('requires the exact page request and exact current registration/grant even when generic MCP reads list it', () => {
  const check = (input: unknown, p: unknown = policy(), now = 5) => admitToolCallEffect(OWNER_BROWSER_TOOL, input, {
    effectPolicy: p, operations: [], mcpReads: [OWNER_BROWSER_TOOL] }, now).admitted;
  expect(check({ page: 'account-profile' })).toBe(true);
  for (const input of [null, [], {}, { page: 'elsewhere' }, ...['url', 'script', 'selector', 'command', 'profile', 'pid', 'account', 'grant', 'digest'].map(key => ({ page: 'account-profile', [key]: 'x' }))]) {
    expect(ownerBrowserRequest(input)).toBe(false); expect(check(input)).toBe(false);
  }
  expect(check({ page: 'account-profile' }, undefined, 100)).toBe(false);
  for (const field of ['grants', 'registered']) { const p = policy(); p[field as 'grants'] = []; expect(check({ page: 'account-profile' }, p)).toBe(false); }
  for (const target of ['mcp__owner_github__other', 'mcp__operator_github__observe', undefined]) {
    const p = policy(); Object.assign(p.grants[0]!, { target }); expect(check({ page: 'account-profile' }, p)).toBe(false);
  }
  expect(check({ page: 'account-profile' }, { type: 'PreviewEffectPolicyUnavailable' })).toBe(false);
  const shadowed = policy(); shadowed.registered.unshift({ ...shadowed.registered[0]!, target: undefined } as unknown as typeof shadowed.registered[0]);
  expect(check({ page: 'account-profile' }, shadowed)).toBe(false);
});
it('validates owner-controlled binding and selects exactly one main process with the matching uid and exact profile', () => {
  expect(chromePid(table, binding, 501)).toBe(81453);
  expect(chromePid(table, binding, 502)).toBeNull();
  expect(chromePid(table.replaceAll('/owned/chrome', '/owned/chrome-other'), binding, 501)).toBeNull();
  expect(chromePid(`${table}\n81456 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/owned/chrome`, binding, 501)).toBeNull();
  const root = mkdtempSync(join(tmpdir(), 'owner-binding-')); roots.push(root);
  const row = { ...binding, userDataDir: root };
  const put = (value: unknown) => writeFileSync(join(root, 'owner-browser.json'), JSON.stringify(value));
  put(row); expect(readOwnerBrowserBinding(root)).toEqual(row);
  for (const patch of [{ ownership: 'operator' }, { profileId: 'default' }, { account: 'Justin' }, { service: 'other' }, { userDataDir: '/missing' }, { extra: true }]) {
    put({ ...row, ...patch }); expect(() => readOwnerBrowserBinding(root)).toThrow();
  }
});
it('projects only bounded verified metadata and never returns secret values, hidden fields or raw errors', () => {
  const secret = 'synthetic-owner-browser-secret';
  const held = heldVerdict(createHeldSecrets({ login: () => [secret] }));
  const parse = (raw: string, scrub = (s: string) => s) => ownerBrowserObservation(raw, 20, scrub, held);
  expect(parse(good)).toEqual({ status: 'observed', page: 'account-profile', account: 'EchoOfDawn', observedAt: 20, title: 'Your profile', truncated: false });
  expect(parse(JSON.stringify({ ...JSON.parse(good), cookies: secret, html: '<input hidden>', pathOnHost: '/private/chrome' }))).toEqual(parse(good));
  expect(parse(good.replace('Your profile', secret))).toEqual({ status: 'refused', reason: 'output-secret-check' });
  expect(parse(good.replace('Your profile', secret), text => text.replace(secret, '[redacted]'))).toMatchObject({ status: 'observed', title: '[redacted]' });
  expect(ownerBrowserObservation(good, 20, (s: string) => s, () => 'unavailable')).toMatchObject({ status: 'refused' });
  for (const raw of ['', 'not JSON', 'x'.repeat(4097), good.replace('EchoOfDawn', 'Justin'), good.replace('/settings/profile', '/settings/tokens'), good.replace('https://github.com', 'https://evil.test')])
    expect(parse(raw)).toEqual({ status: 'unavailable' });
  expect(parse('{"status":"login-required","secret":"ignore"}')).toEqual({ status: 'login-required' });
  expect(parse('{"status":"refused","reason":"raw secret error"}')).toEqual({ status: 'refused', reason: 'account-mismatch' });
  expect(OWNER_BROWSER_DOM).toContain('meta[name="user-login"]');
  expect(OWNER_BROWSER_DOM).not.toContain('body.innerText');
});
it('replays the supplied native result and real journal shapes without mistaking page mention/model text for authenticated account proof', () => {
  const native = readFileSync(new URL('./fixtures/owner-browser-native-1103.json', import.meta.url), 'utf8');
  expect(JSON.parse(native).echoofdawn).toBe(true);
  expect(ownerBrowserObservation(native, 1, (s: string) => s, () => 'clear')).toEqual({ status: 'unavailable' });
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  expect(shapes.map((row: { id: string }) => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570', '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of shapes) {
    expect(ownerBrowserObservation(row.raw, 1, (s: string) => s, () => 'clear'), row.id).toEqual({ status: 'unavailable' });
    expect(admitToolCallEffect(OWNER_BROWSER_TOOL, { page: 'account-profile', text: row.raw }, { effectPolicy: policy() }, 5).admitted, row.id).toBe(false);
  }
});
it('reserves host capacity, uses only PID-addressed fixed code and settles within bounds', async () => {
  const calls: [string, string[]][] = []; let released = 0;
  const adapter = createOwnerBrowser({ binding: () => binding, platform: 'darwin', uid: 501, now: () => 10,
    hold: async () => ({ release: async () => { released++; } }), scrub: (s: string) => s, held: () => 'clear',
    execute: async (command: string, args: string[]) => { calls.push([command, args]); return command === '/bin/ps' ? table : good; } });
  expect(await adapter({ input: { page: 'account-profile' }, stopped: () => false, deadline: 100 })).toMatchObject({ status: 'observed' });
  expect(calls.map(row => row[0])).toEqual(['/bin/ps', '/usr/bin/osascript']);
  expect(calls[1]![1].at(-2)).toBe('81453'); expect(released).toBe(1);
  calls.length = 0;
  expect(await adapter({ input: { page: 'account-profile' }, stopped: () => true, deadline: 100 })).toMatchObject({ status: 'refused' });
  expect(calls).toHaveLength(0);
});
it('refuses concurrent reads, deadline/stop/profile withdrawal, wrong account and signed-out without content', async () => {
  let clock = 10, stopped = false, blocked = false, release = () => {}, account = binding, raw = good, hold = true;
  const adapter = createOwnerBrowser({ binding: () => account, platform: 'darwin', uid: 501, now: () => clock,
    hold: async () => hold ? { release: async () => {} } : null, scrub: (s: string) => s, held: () => 'clear', wait: async () => { clock += 10; },
    execute: async (command: string) => {
      if (command === '/bin/ps') return table;
      if (blocked) await new Promise<void>(resolve => { release = resolve; });
      return raw;
    } });
  const run = () => adapter({ input: { page: 'account-profile' }, stopped: () => stopped, deadline: 50 });
  for (const status of ['login-required', 'refused']) { raw = JSON.stringify({ status }); expect(await run()).toMatchObject({ status }); }
  raw = good; blocked = true;
  const first = run(); await new Promise(resolve => setTimeout(resolve, 5));
  expect(await run()).toEqual({ status: 'unavailable' }); stopped = true; release();
  expect(await first).toMatchObject({ status: 'refused' });
  stopped = false; blocked = false; raw = '{"status":"loading"}';
  expect(await run()).toEqual({ status: 'unavailable' });
  clock = 10; hold = false; expect(await run()).toEqual({ status: 'unavailable' });
  hold = true; account = { ...binding, userDataDir: '/other' }; expect(await run()).toEqual({ status: 'unavailable' });
});

it('executes the actual fixed DOM read: exact authenticated account, signed out, wrong account and fixed navigation', () => {
  const read = (account: string | null, path = '/settings/profile', loginPage = false) => {
    const navigated: string[] = [];
    const result = JSON.parse(runInNewContext(OWNER_BROWSER_DOM, {
      location: { href: `https://github.com${path}`, origin: 'https://github.com', pathname: path, search: '', assign: (url: string) => navigated.push(url) },
      document: { readyState: 'complete', title: 'Your profile', querySelector: (selector: string) => selector.startsWith('form')
        ? (loginPage ? {} : null) : (account === null ? null : { content: account }) },
    }, { timeout: 100 }));
    return { result, navigated };
  };
  expect(read('EchoOfDawn').result).toMatchObject({ status: 'observed', account: 'EchoOfDawn' });
  expect(read('Justin').result).toEqual({ status: 'refused', reason: 'account-mismatch' });
  expect(read('EchoOfDawn-other').result.status).toBe('refused');
  expect(read(null).result.status).toBe('unavailable');
  expect(read(null, '/login', true).result.status).toBe('login-required');
  expect(read('EchoOfDawn', '/elsewhere')).toEqual({ result: { status: 'loading' }, navigated: ['https://github.com/settings/profile'] });
});

it('helper abort and timeout wait for the exact spawned PID to exit; output is bounded', async () => {
  const root = mkdtempSync(join(tmpdir(), 'owner-helper-')); roots.push(root);
  for (const abort of [true, false]) {
    const pidFile = join(root, `pid-${abort}`), controller = new AbortController();
    const promise = runOwnerBrowserHelper(process.execPath, ['-e',
      'require("node:fs").writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)', pidFile], controller.signal);
    const settled = expect(promise).rejects.toThrow('browser-helper-unavailable');
    for (let i = 0; i < 200 && !existsSync(pidFile); i++) await new Promise(resolve => setTimeout(resolve, 5));
    expect(existsSync(pidFile)).toBe(true);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    if (abort) controller.abort();
    await settled;
    expect(() => process.kill(pid, 0)).toThrow();
  }
  await expect(runOwnerBrowserHelper(process.execPath, ['-e', 'process.stdout.write("x".repeat(4097))'], new AbortController().signal))
    .rejects.toThrow('browser-helper-unavailable');
}, 10000);
it('a binding changed during the Apple Event cannot release content', async () => {
  let current = binding;
  const adapter = createOwnerBrowser({ binding: () => current, platform: 'darwin', uid: 501, now: () => 10,
    hold: async () => ({ release: async () => {} }), scrub: (s: string) => s, held: () => 'clear',
    execute: async (command: string) => { if (command === '/bin/ps') return table; current = { ...binding, userDataDir: '/other' }; return good; } });
  expect(await adapter({ input: { page: 'account-profile' }, stopped: () => false, deadline: 100, bindingSnapshot: binding }))
    .toEqual({ status: 'refused', reason: 'profile-withdrawn' });
});

it('withdrawal during process lookup prevents the next Apple Event, including stop, deadline and binding changes', async () => {
  for (const reason of ['stop', 'deadline', 'binding']) {
    let stop = false, clock = 10, current = binding;
    const calls: string[] = [];
    const adapter = createOwnerBrowser({ binding: () => current, platform: 'darwin', uid: 501, now: () => clock,
      hold: async () => ({ release: async () => {} }), scrub: (s: string) => s, held: () => 'clear',
      execute: async (command: string) => { calls.push(command); if (reason === 'stop') stop = true;
        if (reason === 'deadline') clock = 100; if (reason === 'binding') current = { ...binding, userDataDir: '/other' }; return table; } });
    expect((await adapter({ input: { page: 'account-profile' }, stopped: () => stop, deadline: 100, bindingSnapshot: binding })).status).toBe(reason === 'deadline' ? 'unavailable' : 'refused');
    expect(calls).toEqual(['/bin/ps']);
  }
});

it('admits a bounded sequence only with every page in one explicit grant, never a union or malformed scope', () => {
  const input = { pages: ['account-profile', 'account-repositories'] };
  const check = (value: unknown, p: unknown) => admitToolCallEffect(OWNER_BROWSER_TOOL, value, { effectPolicy: p }, 5).admitted;
  const p = policy();
  expect(check(input, p)).toBe(false);
  Object.assign(p.grants[0]!, { ownerBrowserPages: input.pages });
  expect(check(input, p)).toBe(true);
  for (const pages of [[], ['account-profile'], Array(5).fill('account-profile'), ['account-profile', 'https://evil.test'], ['account-profile', 'settings-tokens']])
    expect(check({ pages }, p)).toBe(false);
  for (const action of ['click', 'submit', 'evaluate', 'navigate']) expect(check({ ...input, action }, p)).toBe(false);
  for (const scope of ['account-profile,account-repositories', {}, [null], ['account-profile', 'unknown']]) {
    Object.assign(p.grants[0]!, { ownerBrowserPages: scope }); expect(check(input, p)).toBe(false);
  }
  Object.assign(p.grants[0]!, { ownerBrowserPages: ['account-profile'] });
  p.grants.push({ ...p.grants[0]!, id: 'other', ownerBrowserPages: ['account-repositories'] } as typeof p.grants[number]);
  expect(check(input, p)).toBe(false);
});

it('runs two verified DOM steps under one bound and withholds both on stop, expiry, redirect, wrong account or profile', async () => {
  for (const failure of ['none', 'stop', 'deadline', 'origin', 'account', 'profile', 'secret', 'loading']) {
    let url = new URL('https://github.com/settings/profile'), clock = 10, stop = false, current = binding, observed = 0, evaluations = 0;
    const visited: string[] = [];
    const adapter = createOwnerBrowser({ binding: () => current, platform: 'darwin', uid: 501, now: () => clock,
      hold: async () => ({ release: async () => {} }), scrub: (s: string) => s, held: (s: string) => s.includes('synthetic-secret') ? 'held' : 'clear',
      wait: async () => { clock++; }, execute: async (command: string, args: string[]) => {
        if (command === '/bin/ps') return table;
        evaluations++;
        if (observed && failure === 'loading') return '{"status":"loading"}';
        const raw = runInNewContext(args.at(-1)!, {
          location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search,
            assign: (target: string) => { url = new URL(failure === 'origin' ? 'https://evil.test/' : target); } },
          document: { readyState: 'complete', title: failure === 'secret' && observed ? 'synthetic-secret' : `Page ${url.pathname}`,
            querySelector: (selector: string) => selector.startsWith('form') ? null : { content: failure === 'account' && observed ? 'Justin' : 'EchoOfDawn' } },
        }, { timeout: 100 });
        if (JSON.parse(raw).status === 'observed') {
          observed++; visited.push(url.href);
          if (failure === 'stop') stop = true;
          if (failure === 'deadline') clock = 100;
          if (failure === 'profile') current = { ...binding, userDataDir: '/operator/chrome' };
        }
        return raw;
      } });
    const result = await adapter({ input: { pages: ['account-profile', 'account-repositories'] }, stopped: () => stop, deadline: 100, bindingSnapshot: binding });
    if (failure === 'none') {
      expect(result.status).toBe('observed'); expect(result.observations.map((row: { url: string }) => row.url)).toEqual(visited);
      expect(visited).toEqual(['https://github.com/settings/profile', 'https://github.com/EchoOfDawn?tab=repositories']);
      expect(evaluations).toBe(3);
    } else {
      expect(result.status, failure).not.toBe('observed'); expect(result.observations).toBeUndefined();
      expect(JSON.stringify(result)).not.toMatch(/synthetic-secret|Page |operator\/chrome/u);
    }
    expect(evaluations).toBeLessThanOrEqual(40);
  }
});

it('rejects an off-origin starting page before navigation and verifies account before any navigation', () => {
  for (const origin of ['https://evil.test', 'https://github.com.evil.test', 'https://github.com']) {
    const navigations: string[] = [];
    const result = JSON.parse(runInNewContext(ownerBrowserDom('account-repositories'), {
      location: { origin, href: `${origin}/settings/profile`, pathname: '/settings/profile', search: '', assign: (url: string) => navigations.push(url) },
      document: { readyState: 'complete', querySelector: (selector: string) => selector.startsWith('form') ? null : ({ content: 'Justin' }) },
    }));
    expect(result.status).toBe('refused'); expect(navigations).toEqual([]);
  }
});

it('replays the real summary, Jev, reply-review and delivered shapes on the new sequence path', () => {
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  const p = policy(); Object.assign(p.grants[0]!, { ownerBrowserPages: ['account-profile', 'account-repositories'] });
  for (const row of shapes) {
    expect(ownerBrowserObservation(row.raw, 1, (s: string) => s, () => 'clear', 'account-repositories'), row.id).toEqual({ status: 'unavailable' });
    expect(admitToolCallEffect(OWNER_BROWSER_TOOL, { pages: ['account-profile', row.raw] }, { effectPolicy: p }, 5).admitted, row.id).toBe(false);
  }
});
