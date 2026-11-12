import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { chromium } from 'playwright';
// @ts-expect-error pinned host protocol implementation has no public declarations
import { inprocess, server } from 'playwright-core/lib/coreBundle';
// @ts-expect-error host source projection
import { projectProtocol, PROFILE_MARKER } from './browser-sources.mjs';

// Actual pinned client/server protocol, with the production JSON boundary and source projector.
// No arbitrary worker code is executed and no production confinement fallback is installed.
async function bridge(context: import('playwright').BrowserContext) {
  const dispatch = new server.DispatcherConnection(), projection = projectProtocol(dispatch);
  const client = new inprocess.playwright._connection.constructor(); client.markAsRemote();
  const implementation = inprocess.playwright._connection.toImpl(context.browser());
  const scope = new server.RootDispatcher(dispatch, async (parent: unknown) => new server.PlaywrightDispatcher(parent,
    implementation.attribution.playwright, { preLaunchedBrowser: implementation, sharedBrowser: true, denyLaunch: true }));
  const artifacts: string[] = [];
  dispatch.onmessage = (message: { params?: { type?: string; initializer?: { absolutePath?: string } } }) => {
    if (message.params?.type === 'Artifact' && message.params.initializer?.absolutePath) artifacts.push(message.params.initializer.absolutePath);
    const projected = JSON.parse(JSON.stringify(projection.response(message)));
    setImmediate(() => client.dispatch(projected));
  };
  client.onmessage = (message: { guid: string }) => {
    if (!projection.request(message, dispatch._dispatcherByGuid.get(message.guid))) throw Error('duplicate protocol id');
    const encoded = JSON.parse(JSON.stringify(message));
    setImmediate(() => { void dispatch.dispatch(encoded); });
  };
  const api = await client.initializePlaywright();
  return { context: api._preLaunchedBrowser().contexts()[0], artifacts,
    close: async () => { await scope.stopPendingOperations(Error('test complete')); scope._dispose(); } };
}

function archiveText(zip: Buffer) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = zip.readUInt32LE(end + 16), text = '';
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const method = zip.readUInt16LE(at + 10), size = zip.readUInt32LE(at + 20), local = zip.readUInt32LE(at + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28), bytes = zip.subarray(start, start + size);
    text += (method === 8 ? inflateRawSync(bytes) : bytes).toString('utf8');
    at += 46 + zip.readUInt16LE(at + 28) + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return text;
}

it('projects real cookie/storage/CDP sources and HAR archive streams while ordinary page JSON stays readable', async () => {
  const root = mkdtempSync(join(tmpdir(), 'browser-source-proof-')), secret = randomBytes(32).toString('hex');
  const site = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.setHeader('Set-Cookie', `session=${secret}; HttpOnly`); res.end('<h1>ordinary page</h1>'); });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
  const context = await chromium.launchPersistentContext(root, { headless: true });
  let wire: Awaited<ReturnType<typeof bridge>> | undefined;
  try {
    await context.addCookies([{ name: 'session', value: secret, url: origin, httpOnly: true }, { name: 'consent', value: '1', url: origin }]);
    await context.pages()[0]!.goto(origin);
    await context.pages()[0]!.evaluate(() => localStorage.setItem('theme', 'dark'));
    wire = await bridge(context); const remote = wire.context, page = remote.pages()[0];
    const cookies = await remote.cookies();
    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie: { value: string }) => cookie.value === PROFILE_MARKER)).toBe(true);
    expect((await context.cookies()).some(cookie => cookie.value === secret)).toBe(true);
    const state = await remote.storageState();
    expect(state.origins).toEqual([]); expect(JSON.stringify(state).includes(secret)).toBe(false);
    expect((await remote.request.storageState()).cookies.every((cookie: { value: string }) => cookie.value === PROFILE_MARKER)).toBe(true);
    const apiResponse = await remote.request.get(origin);
    expect(apiResponse.headers()['set-cookie']).toBe(PROFILE_MARKER);
    const log = await remote.request._channel.fetchLog({ fetchUid: apiResponse._initializer.fetchUid });
    expect(log.log).toEqual([PROFILE_MARKER]);
    expect(await page.evaluate(() => ({ cookie: 'ordinary', authorization: 'ordinary', theme: localStorage.getItem('theme') })))
      .toEqual({ cookie: 'ordinary', authorization: 'ordinary', theme: 'dark' });
    const cdp = await remote.newCDPSession(page);
    expect(await cdp.send('Network.getAllCookies')).toEqual({ cookies: [] });
    const events: unknown[] = [];
    cdp.on('Network.requestWillBeSentExtraInfo', (event: unknown) => events.push(event));
    await cdp.send('Network.enable');
    const tracing = remote.tracing;
    const { harId } = await tracing._channel.harStart({ options: { content: 'embed', mode: 'full' } });
    const response = await page.goto(origin);
    expect((await response.allHeaders())['set-cookie']).toBe(PROFILE_MARKER);
    expect((await response.request().allHeaders()).cookie).toBe(PROFILE_MARKER);
    const { artifact } = await tracing._channel.harExport({ harId, mode: 'archive' });
    expect(wire.artifacts.length).toBeGreaterThan(0);
    // Positive control: this is the real credential-bearing compressed archive from the fourth review.
    expect(archiveText(readFileSync(wire.artifacts.at(-1)!)).includes(secret)).toBe(true);
    const { stream } = await artifact.saveAsStream({});
    const { binary } = await stream.read({ size: 4096 });
    expect(binary.length).toBe(0);
    await stream.close({});
    const browser = remote.browser();
    await browser.startTracing(page);
    await page.evaluate(() => 1 + 1);
    const trace = await browser._channel.stopTracing({});
    const traceStream = await trace.artifact.saveAsStream({});
    expect((await traceStream.stream.read({ size: 4096 })).binary.length).toBe(0);
    await traceStream.stream.close({});
    const traceEvents: { value: unknown[] }[] = [];
    cdp.on('Tracing.dataCollected', (event: { value: unknown[] }) => traceEvents.push(event));
    const traceDone = new Promise<void>(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents' });
    await page.evaluate(() => 2 + 2);
    await cdp.send('Tracing.end'); await traceDone;
    expect(traceEvents.length).toBeGreaterThan(0);
    expect(traceEvents.every(event => event.value.length === 0)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(event => JSON.stringify(event) === '{}')).toBe(true);
  } finally {
    await wire?.close(); await context.close();
    await new Promise<void>(resolve => site.close(() => resolve())); rmSync(root, { recursive: true, force: true });
  }
}, 30000);

it('rejects reused protocol IDs without replacing the original source attribution', () => {
  const dispatch = { _dispatcherByGuid: new Map() }, projection = projectProtocol(dispatch);
  expect(projection.request({ id: 1, guid: 'context', method: 'cookies' }, { _type: 'BrowserContext' })).toBe(true);
  expect(projection.request({ id: 1, guid: 'page', method: 'title' }, { _type: 'Page' })).toBe(false);
  expect(projection.response({ id: 1, result: { cookies: [{ name: 'session', value: 'planted' }] } }))
    .toEqual({ id: 1, result: { cookies: [{ name: 'session', value: PROFILE_MARKER }] } });
  expect(projection.request({ id: 1, guid: 'page', method: 'title' }, { _type: 'Page' })).toBe(false);
});
