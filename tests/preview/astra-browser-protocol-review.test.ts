import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
// @ts-expect-error host execution boundary
import { runProfileCode } from './browser-code.mjs';

// Equivalent to the desk's inaccessible review evidence: real protocol, local site, disposable profile.
it.runIf(process.platform === 'darwin')('withholds credential-bearing binary protocol responses before they reach arbitrary code', async () => {
  const secret = randomBytes(32).toString('hex');
  const root = mkdtempSync(join(tmpdir(), 'binary-profile-proof-'));
  const site = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    // Prefix changes base64 alignment: checking only encoded secret forms misses it.
    res.end(Buffer.from(`prefix:${secret}:suffix`));
  });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(site.address() as {port: number}).port}`;
  const context = await chromium.launchPersistentContext(root, { headless: true });
  try {
    await context.addCookies([{ name: 'session', value: secret, url, httpOnly: true }]);
    const page = context.pages()[0]!;
    let refusal = '';
    const result = await runProfileCode({ context, page,
      code: `async page => { const response = await page.request.get('${url}'); const bytes = await response.body(); return {received: bytes.length > 0}; }`,
      clear: (text: string) => !text.includes(secret), network: async (_request: unknown, dispatch: () => Promise<unknown>) => dispatch(), allowed: () => true,
      protect: async () => {}, capture: async () => {}, refused: (reason: string) => { refusal = reason; } });
    const reachedCode = !result.isError && JSON.parse(result.content[0].text).received === true;
    expect(reachedCode, 'raw profile credential must not cross into arbitrary code').toBe(false);
    expect(refusal).toBe('output-secret-check');
    expect(JSON.stringify(result).includes(secret)).toBe(false);
  } finally {
    await context.close();
    await new Promise<void>(resolve => site.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);

// @ts-expect-error host output decoder
import { inspectProfileOutput } from './browser-code.mjs';

it('routes text, nested base64, buffers, typed arrays and protocol frames through the same held-value check', () => {
  const secret = randomBytes(32).toString('hex'), bytes = Buffer.from(`prefix:${secret}:suffix`);
  const clear = (text: string) => !text.includes(secret);
  const cases = [
    { content: [{ type: 'text', text: bytes.toString('utf8') }] },
    { result: { binary: bytes.toString('base64') } },
    { body: bytes.toString('base64url'), base64Encoded: true },
    { payload: Buffer.from(bytes.toString('base64')).toString('base64') },
    { content: [{ type: 'text', text: `### Result\n${JSON.stringify(bytes.toString('base64'))}\n### Ran code\nordinary` }] },
    { text: `Observed payload: ${bytes.toString('base64')}` },
    { result: bytes }, { result: new Uint8Array(bytes) },
    { result: JSON.parse(JSON.stringify(bytes)) },
    { content: [{ type: 'text', text: `### Result\n${JSON.stringify(bytes)}\n### Ran code\nordinary` }] },
    { guid: 'socket', method: 'frameReceived', params: { data: bytes.toString('base64') } },
    { result: { binary: Buffer.from(`prefix:${secret}:suffix`, 'utf16le').toString('base64') } },
    { result: { binary: Buffer.concat([Buffer.from([255]), bytes]).toString('base64') } },
  ];
  for (const [index, value] of cases.entries()) expect(inspectProfileOutput(value, clear).safe, `encoding ${index}`).toBe(false);
  expect(inspectProfileOutput({ result: { binary: Buffer.from('ordinary response').toString('base64') } }, clear)).toEqual({safe: true, opaque: false});
  for (const value of [{ binary: 'AP8B' }, { binary: '**invalid**' }, { result: Buffer.from([0, 255, 1]) }])
    expect(inspectProfileOutput(value, clear)).toEqual({safe: true, opaque: true});
  expect(inspectProfileOutput({ status: 'observed', text: 'ordinary input' }, clear)).toEqual({safe: true, opaque: false});
});

it.runIf(process.platform === 'darwin')('retains granted code access to non-secret opaque binary responses', async () => {
  const root = mkdtempSync(join(tmpdir(), 'opaque-profile-proof-'));
  const site = createServer((_req, res) => res.end(Buffer.from([0, 255, 1])));
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(site.address() as {port: number}).port}`;
  const context = await chromium.launchPersistentContext(root, { headless: true });
  try {
    let refusal = '';
    const result = await runProfileCode({ context, page: context.pages()[0],
      code: `async page => Array.from(await (await page.request.get('${url}')).body())`,
      clear: () => true, network: async (_request: unknown, dispatch: () => Promise<unknown>) => dispatch(), allowed: () => true, protect: async () => {}, capture: async () => {},
      refused: (reason: string) => { refusal = reason; } });
    expect(result.isError).not.toBe(true); expect(refusal).toBe('');
    expect(JSON.parse(result.content[0].text)).toEqual([0, 255, 1]);
  } finally {
    await context.close(); await new Promise<void>(resolve => site.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
