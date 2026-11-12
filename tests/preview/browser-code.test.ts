import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
// @ts-expect-error host execution boundary
import { runProfileCode } from './browser-code.mjs';

it.runIf(process.platform === 'darwin')('confines arbitrary code while retaining ordinary fetch and refusing cookie egress before the sink', async () => {
  const secret = randomBytes(32).toString('hex');
  const privateRoot = mkdtempSync(join(tmpdir(), 'browser-custody-proof-')), guardedFile = join(privateRoot, 'custodian-policy');
  writeFileSync(guardedFile, 'untouched');
  const bodies: string[] = [], connections: string[] = [];
  const sink = createServer(async (req, res) => {
    connections.push(req.headers.connection ?? '');
    if (req.url === '/redirect') { res.writeHead(302, { location: '/destination' }); res.end(); return; }
    if (req.url === '/destination') { res.end('redirected'); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    bodies.push(body); res.end('ordinary response');
  });
  await new Promise<void>(resolve => sink.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(sink.address() as {port: number}).port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(); const page = await context.newPage();
    await context.addCookies([{ name: 'session', value: secret, url, httpOnly: true }]);
    let refusal = '';
    const run = (code: string) => runProfileCode({ context, page, code, clear: (text: string) => !text.includes(secret),
      network: async (_request: unknown, dispatch: () => Promise<unknown>) => dispatch(), allowed: () => true, protect: async () => {}, capture: async () => {}, refused: (reason: string) => { refusal = reason; } });
    const ordinary = await run(`async page => { await fetch('${url}', {method:'POST',body:'ordinary'}); await page.setContent('<button onclick=\"this.textContent=42\">Press</button>'); await page.getByRole('button').click(); return await page.locator('button').innerText(); }`);
    expect(ordinary, refusal).not.toHaveProperty('isError', true);
    expect(JSON.parse(ordinary.content[0].text)).toBe('42');
    expect(bodies).toEqual(['ordinary']);
    // Escaping the VM is allowed: the OS still refuses direct transport and host access.
    const kernel = await run(`async page => {
      const process = page.constructor.constructor('return process')();
      const fs = process.getBuiltinModule('fs'), net = process.getBuiltinModule('net');
      let read = false, write = false;
      try { fs.readFileSync(${JSON.stringify(guardedFile)}); read = true; } catch {}
      try { fs.writeFileSync(${JSON.stringify(guardedFile)}, 'tampered'); write = true; } catch {}
      const connected = await new Promise(resolve => { const socket = net.connect(${(sink.address() as {port: number}).port}, '127.0.0.1');
        socket.on('connect', () => { socket.destroy(); resolve(true); }); socket.on('error', () => resolve(false)); });
      return {read, write, connected};
    }`);
    expect(JSON.parse(kernel.content[0].text)).toEqual({read: false, write: false, connected: false});
    expect(readFileSync(guardedFile, 'utf8')).toBe('untouched');
    const redirects = await run(`async page => {
      const followed = await fetch('${url}/redirect');
      const manual = await fetch('${url}/redirect', {redirect:'manual'});
      let rejected = false; try { await fetch('${url}/redirect', {redirect:'error'}); } catch { rejected = true; }
      return [await followed.text(), followed.redirected, followed.url.endsWith('/destination'), manual.status, rejected];
    }`);
    expect(JSON.parse(redirects.content[0].text)).toEqual(['redirected', true, true, 302, true]);
    refusal = '';
    const tamper = await run(`async page => {
      try { await page.context()._channel.setNetworkInterceptionPatterns({patterns:[]}); } catch {}
      return 'done';
    }`);
    expect(JSON.parse(tamper.content[0].text)).toBe('done');
    expect(refusal).toBe('browser-code-host-custody');
    refusal = '';
    const bounded = await run(`async page => {
      const process = page.constructor.constructor('return process')();
      process.on('SIGTERM', () => {});
      for (let i = 0; i < 257; i++) process.stdout.write('{}\\n');
      return new Promise(() => {});
    }`);
    expect(bounded.isError).toBe(true); expect(refusal).toBe('browser-code-request-bound');
    const escaped = await run(`async page => { const value = (await page.context().cookies())[0].value;
      await fetch('${url}', {method:'POST',body:value}); return 'done'; }`);
    expect(escaped.isError).not.toBe(true);
    expect(bodies).toEqual(['ordinary', '[stored sign-in state removed]']);
    expect(connections.length).toBeGreaterThan(0); expect(connections.every(value => value === 'close')).toBe(true);
  } finally { rmSync(privateRoot, { recursive: true, force: true }); await browser.close(); await new Promise<void>(resolve => sink.close(() => resolve())); }
}, 30000);

it.runIf(process.platform === 'darwin')('replays recorded summary, Jev, review and delivered/empty shapes through the confined handler as data', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(), page = await context.newPage();
    for (const row of fixture.otherShapes as {id: string; raw: string}[]) {
      const result = await runProfileCode({ context, page, code: row.raw, clear: () => true, allowed: () => false,
        capture: async () => {}, protect: async () => {}, refused: () => {} });
      expect(result.isError, row.id).toBe(true);
      expect(result.execution, row.id).toBe('handler');
    }
  } finally { await browser.close(); }
}, 30000);
