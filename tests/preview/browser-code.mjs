import { projectProtocol, projectHeaders, guardProfileRequest } from './browser-sources.mjs';
// Rules 1/4/57/100: arbitrary server code never runs in the profile custodian.
// The fixed-worker kernel profile protects the host; Playwright's pinned protocol retains its client API.
import { constants, copyFileSync, cpSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { createInterface } from 'node:readline';
import { inprocess, server } from 'playwright-core/lib/coreBundle';

// Decode only for the existing custody check; inspection bytes never enter the result or journal.
export function inspectProfileOutput(value, clear) {
  let safe = clear(JSON.stringify(value)), opaque = false;
  const bytes = buffer => {
    // Still check readable spans when the surrounding binary is not valid text.
    safe = clear(buffer.toString('utf8')) && clear(buffer.toString('utf16le')) && safe;
    try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { opaque = true; }
    if (buffer.some(byte => byte < 9 || (byte > 13 && byte < 32))) opaque = true;
  };
  const visit = (item, binary = false, depth = 0) => {
    if (depth > 16) { opaque = true; return; }
    if (Buffer.isBuffer(item) || ArrayBuffer.isView(item)) return bytes(Buffer.from(item.buffer, item.byteOffset, item.byteLength));
    if (item instanceof ArrayBuffer) return bytes(Buffer.from(item));
    if (typeof item === 'string') {
      safe = clear(item) && safe;
      if (!item) return;
      if (/^[A-Za-z0-9+/_-]+={0,2}$/u.test(item) && Buffer.from(item, 'base64url').toString('base64url') === item.replace(/=+$/u, '').replaceAll('+', '-').replaceAll('/', '_')) {
        const buffer = Buffer.from(item, 'base64url');
        if (binary) bytes(buffer);
        else safe = clear(buffer.toString('utf8')) && clear(buffer.toString('utf16le')) && safe;
        visit(buffer.toString('utf8'), false, depth + 1);
      } else if (binary) opaque = true;
      if (/^\s*[\[{"]/u.test(item)) { try { visit(JSON.parse(item), false, depth + 1); } catch { /* Ordinary text, checked above. */ } }
      for (const token of item.match(/[A-Za-z0-9+/_-]{16,}={0,2}/gu) ?? []) if (token !== item) visit(token, false, depth + 1);
      const result = item.match(/^### Result\n([\s\S]*?)(?:\n### |$)/u)?.[1];
      if (result !== undefined) visit(result, false, depth + 1);
    } else if (item && typeof item === 'object') {
      if (item.type === 'Buffer' && Array.isArray(item.data)) return bytes(Buffer.from(item.data));
      for (const [key, child] of Object.entries(item)) visit(child,
        ['binary', 'base64'].includes(key) || (key === 'b' && typeof item.k === 'string')
        || (key === 'data' && ['image', 'audio'].includes(item.type)) || (key === 'body' && item.base64Encoded === true), depth + 1);
    }
  };
  visit(value);
  return { safe, opaque };
}

export async function runProfileCode({ context, page, code, clear, allowed, protect, capture, refused, network = async () => { throw Error('network-effect-or-scope'); } }) {
  if (typeof code !== 'string' || !clear(code)) { refused('output-secret-check'); return { isError: true, content: [] }; }
  const root = mkdtempSync(join(tmpdir(), 'instar-browser-code-'));
  let child, timeout, scope, closed = false, total = 0, sent = 0, requests = 0, active = 0, outgoing = Promise.resolve(), complete = () => {};
  const controller = new AbortController(), transports = new Map();
  try {
    // Reuse confinedRelease's runtime pin and the shipped fixed-worker profile without importing unrelated self-host owners.
    const directory = realpathSync(root), location = join(directory, 'release');
    const release = { release: location, slot: join(directory, 'slot'), runtime: join(location, 'runtime', 'node'), profile: join(directory, 'worker.sb') };
    mkdirSync(join(location, 'runtime'), { recursive: true, mode: 0o700 });
    mkdirSync(join(location, 'bin'), { mode: 0o700 }); mkdirSync(release.slot, { mode: 0o700 });
    try { linkSync(process.execPath, release.runtime); } catch { copyFileSync(process.execPath, release.runtime, constants.COPYFILE_FICLONE); }
    const ancestors = [];
    for (let path = location; path !== '/';) { path = dirname(path); ancestors.push(`(literal "${path}")`); }
    const profile = readFileSync(new URL('../../deploy/macos/fixed-worker/worker.sb', import.meta.url), 'utf8')
      .replaceAll('@RELEASE_DIR@', location).replaceAll('@SLOT_DIR@', release.slot);
    writeFileSync(release.profile, profile + `\n(allow file-read-metadata ${ancestors.join(' ')})\n`);
    // Node's DNS module reads resolver configuration at import. DNS transport, sockets and libinfo stay denied.
    writeFileSync(release.profile, readFileSync(release.profile, 'utf8') + '\n(allow mach-lookup (global-name "com.apple.SystemConfiguration.DNSConfiguration"))\n');
    // Only the pinned runtime/library and fixed worker are readable, never browser files or the host source tree.
    cpSync(dirname(createRequire(import.meta.url).resolve('playwright-core/package.json')), join(release.release, 'node_modules', 'playwright-core'), { recursive: true });
    const worker = join(release.release, 'bin', 'browser-code-worker.mjs');
    writeFileSync(worker, readFileSync(new URL('./browser-code-worker.mjs', import.meta.url)));
    const dispatch = new server.DispatcherConnection(), projection = projectProtocol(dispatch);
    const implementation = inprocess.playwright._connection.toImpl(context.browser());
    scope = new server.RootDispatcher(dispatch, async parent => new server.PlaywrightDispatcher(parent, implementation.attribution.playwright,
      { preLaunchedBrowser: implementation, sharedBrowser: true, denyLaunch: true }));
    const finishError = () => ({ isError: true, content: [{ type: 'text', text: 'Confined browser code unavailable' }] });
    const fail = reason => { refused(reason); controller.abort(); complete(finishError()); };
    const write = value => {
      if (closed || !child?.stdin.writable) return;
      const bytes = JSON.stringify(value); sent += Buffer.byteLength(bytes);
      if (sent > 1024 * 1024) { fail('browser-code-byte-bound'); return; }
      child.stdin.write(`${bytes}\n`);
    };
    dispatch.onmessage = message => {
      outgoing = outgoing.then(async () => {
        if (closed || controller.signal.aborted) return;
        await protect(); if (message.id) await capture();
        // Before a cookie/storage/header crosses into code, outside its process and after refreshing custody.
        // Opaque protocol bytes remain covered by this call's existing whole-operation grant.
        message = projection.response(message);
        if (!inspectProfileOutput(message, clear).safe) { fail('output-secret-check'); return; }
        write({ protocol: message });
      }).catch(() => fail('browser-code-unavailable'));
    };
    const result = await new Promise(resolve => {
      complete = resolve;
      child = spawn('/usr/bin/sandbox-exec', ['-f', release.profile, release.runtime, '--max-old-space-size=256', worker],
        { cwd: release.slot, env: { HOME: release.slot }, stdio: ['pipe', 'pipe', 'ignore'] });
      timeout = setTimeout(() => fail('browser-code-deadline'), 10000);
      child.stdin.on('error', () => {});
      child.once('error', () => resolve(finishError()));
      child.once('close', () => resolve(finishError()));
      child.stdout.on('data', bytes => { total += bytes.length; if (total > 1024 * 1024) fail('browser-code-byte-bound'); });
      createInterface({ input: child.stdout }).on('line', async line => {
        if (closed || controller.signal.aborted) return;
        if (++requests > 256 || ++active > 32) { fail('browser-code-request-bound'); return; }
        try {
          const message = JSON.parse(line);
          if (!inspectProfileOutput(message, clear).safe) { fail('output-secret-check'); return; }
          if (message.result) { resolve(message.result); return; }
          if (message.fetch) {
            const request = message.request;
            const body = Buffer.from(request.body, 'base64');
            if (!clear(body.toString('utf8'))) { fail('output-secret-check'); return; }
            // Whole-operation grant already admitted this code. Network transport remains in host custody.
            await capture();
            if (!clear(line) || !clear(body.toString('utf8'))) { fail('output-secret-check'); return; }
            let response;
            try { response = await requestNetwork(request, body, controller.signal, clear, network); }
            catch (error) {
              if (error.message === 'credential egress') fail('output-secret-check');
              else write({ fetch: message.fetch, error: 'Network request failed' });
              return;
            }
            if (!inspectProfileOutput({ ...response, base64Encoded: true }, clear).safe) {
              fail('output-secret-check'); return;
            }
            write({ fetch: message.fetch, response });
          } else if (message.protocol) {
            const p = message.protocol, target = dispatch._dispatcherByGuid.get(p.guid);
            // Host processes, files, listeners and login-bearing API transport are custody, not client authority.
            // Ordinary page/context APIs and renderer evaluation still use the original pinned dispatchers.
            const type = target?._type;
            if ((type === 'LocalUtils' && !['globToRegex', 'asLocatorDescription'].includes(p.method)) || type === 'Electron' || type === 'Android' || type === 'BrowserType'
              || ['startServer', 'stopServer', 'newContextForReuse', 'disconnectFromReusedContext', 'setNetworkInterceptionPatterns', 'setWebSocketInterceptionPatterns'].includes(p.method)
              || (type === 'CDPSession' && p.method === 'send' && /^(Fetch\.|Target\.|Network\.setRequestInterception$)/u.test(p.params.method))
              ) {
              refused('browser-code-host-custody');
              write({ protocol: { id: p.id, error: { error: { name: 'Error', message: 'Host custody checkpoint refused' } } } }); return;
            }
            // Browser protocol cannot read or write host paths supplied by arbitrary code.
            const hasPath = value => value && typeof value === 'object' && Object.entries(value).some(([key, item]) =>
              /(?:[Pp]aths?|[Dd]ir(?:ectory)?|[Ff]iles?)$/u.test(key) || key === 'proxy' || hasPath(item));
            if (hasPath(p.params)) { fail('browser-code-host-path'); return; }
            if (type === 'Browser' && p.method === 'newContext') p.params.serviceWorkers = 'block';
            if (!projection.request(p, target)) { fail('browser-code-protocol-id'); return; }
            if (type === 'APIRequestContext' && !transports.has(target._object)) {
              transports.set(target._object, guardProfileRequest(target._object, network));
            }
            if (type === 'CDPSession' && p.method === 'send' && p.params.method === 'Network.loadNetworkResource') {
              await network({ method: 'GET', url: p.params.params.url, headers: {}, postData: '' }, () => dispatch.dispatch(p));
            } else await dispatch.dispatch(p);
            await protect();
          }
        } catch { fail('browser-code-unavailable'); } finally { active--; }
      });
      write({ start: true, code, page: context.browser().contexts().flatMap(scope => scope.pages()).indexOf(page) });
    });
    return result;
  } finally {
    closed = true; clearTimeout(timeout); controller.abort();
    if (child?.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('close', resolve));
      child.kill('SIGTERM'); const force = setTimeout(() => child.kill('SIGKILL'), 1000);
      await exited; clearTimeout(force);
    }
    if (scope) { await scope.stopPendingOperations(Error('Code operation ended')).catch(() => {}); scope._dispose(); }
    for (const restore of transports.values()) restore();
    rmSync(root, { recursive: true, force: true });
  }
}

// Same bounded Node HTTP transport as the existing egress proxy, without credentials or ambient proxy configuration.
export async function requestNetwork(request, body, signal, clear, network, redirects = 0) {
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('network scope');
  if (!clear(request.url) || !clear(JSON.stringify(request.headers))) throw Error('credential egress');
  const response = await network({ method: request.method, url: url.href, headers: Object.fromEntries(request.headers), postData: body.toString('base64') }, () => new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const out = transport.request(url, { method: request.method, headers: Object.fromEntries(request.headers), signal, agent: false }, answer => {
      const parts = []; let bytes = 0;
      answer.on('data', part => { bytes += part.length; if (bytes > 1024 * 1024) out.destroy(Error('response bound')); else parts.push(part); });
      answer.on('error', reject);
      answer.on('end', () => resolve({ status: answer.statusCode, statusText: answer.statusMessage, headers: Object.entries(answer.headers).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(item => [key, item])), body: Buffer.concat(parts).toString('base64') }));
    });
    out.on('error', reject); out.end(body);
  }));
  const location = response.headers.find(([name]) => name === 'location')?.[1];
  if ([301, 302, 303, 307, 308].includes(response.status) && location && request.redirect !== 'manual') {
    if (request.redirect === 'error' || redirects >= 10) throw Error('redirect refused');
    const destination = new URL(location, url), get = response.status === 303 || ([301, 302].includes(response.status) && request.method === 'POST');
    const headers = request.headers.filter(([name]) => !(get && ['content-type', 'content-length'].includes(name))
      && !(destination.origin !== url.origin && ['authorization', 'cookie', 'proxy-authorization', 'host'].includes(name)));
    return requestNetwork({ ...request, url: destination.href, headers, method: get ? 'GET' : request.method }, get ? Buffer.alloc(0) : body, signal, clear, network, redirects + 1);
  }
  return { ...response, headers: response.headers.map(([name, value]) => [name, projectHeaders({ [name]: value })[name]]), url: url.href, redirected: redirects > 0 };
}
