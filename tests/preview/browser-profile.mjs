// Named 1.x profile resolution, adapted to 2.0 host custody (Rules 18/32/57/100/113).
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { tools as playwrightTools } from 'playwright-core/lib/coreBundle';
import { program } from 'playwright-core/lib/utilsBundle';
import { runProfileCode } from './browser-code.mjs';
export function readBrowserProfile(root, name) {
  if (name === undefined) return null;
  const refuse = () => { throw Error('browser profile refused: record an existing agent-owned profile for this installation (Rules 18/100)'); };
  if (typeof name !== 'string' || !/^[a-z0-9-]{1,64}$/u.test(name)) return refuse();
  try {
    const installation = realpathSync(root), text = readFileSync(join(root, 'browser-profiles.json'), 'utf8');
    const registry = JSON.parse(text), matches = registry.profiles?.filter(row => row.id === name);
    if (registry.installation !== installation || matches?.length !== 1) return refuse();
    const row = matches[0], directory = join(installation, 'browser-profiles', name), stat = statSync(directory);
    if (Object.keys(row).sort().join(',') !== 'id,identity,origins,ownership,purpose,service,userDataDir' || row.ownership !== 'agent' || row.purpose !== 'browsing' || !row.service || !row.identity
      || row.userDataDir !== directory || realpathSync(directory) !== directory || !stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0
      || !Array.isArray(row.origins) || !row.origins.length || row.origins.length > 16
      || !row.origins.every(origin => { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && url.origin === origin; })) return refuse();
    return { ...row, installation, digest: createHash('sha256').update(text).digest('hex') };
  } catch { return refuse(); }
}
const definitions = playwrightTools.filteredTools({ capabilities: playwrightTools.browserTools.map(tool => tool.capability) });
export async function profileCatalog(root) {
  const args = JSON.parse(readFileSync(join(root, 'mcp.json'), 'utf8')).mcpServers.playwright.args ?? [];
  const command = program.createCommand(); playwrightTools.decorateMCPCommand(command, 'profile');
  command.exitOverride().configureOutput({ writeOut() {}, writeErr() {} }).action(() => {});
  command.parse(args.slice(args.findIndex(arg => arg.startsWith('--')) >>> 0), { from: 'user' });
  const options = command.opts();
  if (options.config && !options.config.startsWith('/')) options.config = join(root, options.config);
  const config = await playwrightTools.resolveCLIConfigForMCP(options, {});
  return { config, tools: playwrightTools.filteredTools(config) };
}
// RCE and channels outside browser interception retain their tool, with consequential admission.
export const profileRead = name => ['browser_navigate', 'browser_tabs'].includes(name) || definitions.some(tool => tool.schema.name === name && ['readOnly', 'assertion'].includes(tool.schema.type));
export const profileConsequential = (name, input) => ['browser_run_code_unsafe', 'browser_take_screenshot', 'browser_pdf_save', 'browser_file_upload', 'browser_drop'].includes(name)
  || Boolean(input?.filename || input?.isolatedContext) || !definitions.some(tool => tool.schema.name === name);
export function profileRequest(name, input) {
  if (input?.browserEffect) {
    const { browserEffect, ...operation } = input;
    return profileRequest(name, operation) && Object.keys(browserEffect).sort().join(',') === 'bodyDigest,method,url'
      && /^[A-Z]{1,16}$/u.test(browserEffect.method) && !['GET', 'HEAD'].includes(browserEffect.method)
      && typeof browserEffect.url === 'string' && browserEffect.url.length <= 2048
      && /^sha256:[a-f0-9]{64}$/u.test(browserEffect.bodyDigest);
  }
  return Boolean(input && JSON.stringify(input).length <= 8192
    && definitions.find(tool => tool.schema.name === name)?.schema.inputSchema.strict().safeParse(input).success);
}
export const profileRefused = reason => ({ status: 'refused', reason });
/** One exact child per claim. The existing resource owner holds and reaps its whole process tree. */
export function createProfileBrowser({ binding, hold, check, call, deadline, stopped, now = Date.now }) {
  let operationStopped = () => false, operationDeadline = Infinity;
  let child, slot, closing, exited, busy = false, closed = false, sequence = 0, timer;
  const pending = new Map(), heldProfile = new Set();
  let heldBytes = 0;
  const close = () => closing ??= (async () => {
    closed = true; clearInterval(timer);
    for (const resolve of pending.values()) resolve(profileRefused('browser-closed'));
    pending.clear();
    if (child?.pid) child.kill('SIGTERM');
    if (slot) await slot.release();
    if (exited) { const force = setTimeout(() => child.kill('SIGKILL'), 5000); await exited; clearTimeout(force); }
  })();
  const rpc = async (name, input) => {
    if (!child) {
      slot = await hold({ timeout: Math.max(1, Math.min(deadline, operationDeadline) - now()), stopped: () => closed || stopped() || operationStopped() || now() >= operationDeadline });
      if (!slot || closed || stopped() || operationStopped() || now() >= operationDeadline) { await slot?.release(); return profileRefused('browser-capacity-or-stop'); }
      const row = binding();
      child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--host', row.installation, row.id],
        { cwd: row.userDataDir, stdio: ['pipe', 'pipe', 'ignore'], env: { PATH: process.env.PATH, HOME: process.env.HOME } });
      exited = new Promise(resolve => child.once('close', resolve));
      child.stdin.on('error', () => { void close(); });
      child.once('error', () => { void close(); }); child.once('exit', () => { void close(); });
      timer = setInterval(() => { if (closed || stopped() || operationStopped() || now() >= Math.min(deadline, operationDeadline)) void close(); }, 50);
      await slot.attach({ pid: child.pid, cwd: row.userDataDir });
      createInterface({ input: child.stdout }).on('line', line => {
        if (Buffer.byteLength(line) > 65536) { void close(); return; }
        try {
          const row = JSON.parse(line);
          if (Array.isArray(row.held)) { for (const value of row.held) if (typeof value === 'string' && !heldProfile.has(value)) {
            heldBytes += Buffer.byteLength(value);
            if (heldBytes > 65536) { void close(); return; }
            heldProfile.add(value);
          } }
          else if (row.effect) {
            let admitted = false;
            const adapter = Object.assign(() => new Promise((resolve, reject) => {
              admitted = true; pending.set(`effect:${row.effect}`, result => result.status === 'observed'
                ? resolve(result) : reject(Error('browser request completion unavailable')));
              child.stdin.write(`${JSON.stringify({ effect: row.effect, admitted: true })}\n`);
            }), { binding });
            void call(`browser-effect:${row.effect}`, `mcp__playwright__${row.tool}`, row.input, adapter)
              .then(() => { if (!admitted) child.stdin.write(`${JSON.stringify({ effect: row.effect, admitted: false })}\n`); })
              .catch(() => { void close(); });
          } else if (row.effectDone) {
            pending.get(`effect:${row.effectDone}`)?.({ status: row.status }); pending.delete(`effect:${row.effectDone}`);
          } else { pending.get(row.id)?.(row.result); pending.delete(row.id); }
        } catch { void close(); }
      });
    }
    if (closed || stopped() || operationStopped()) return profileRefused('browser-stopped');
    return new Promise(resolve => { const id = ++sequence; pending.set(id, resolve); child.stdin.write(`${JSON.stringify({ id, name, input })}\n`); });
  };
  const browser = Object.assign(async ({ input, stopped: withdrawn, bindingSnapshot }) => {
    if (withdrawn() || JSON.stringify(binding()) !== JSON.stringify(bindingSnapshot)) return profileRefused('profile-withdrawn');
    operationStopped = () => { try { return withdrawn() || JSON.stringify(binding()) !== JSON.stringify(bindingSnapshot); } catch { return true; } }; operationDeadline = now() + 15000;
    let result;
    try { result = await rpc(input.name, input.arguments); } catch { await close(); return profileRefused('browser-unavailable'); }
    finally { operationStopped = () => false; operationDeadline = Infinity; }
    if (withdrawn() || JSON.stringify(binding()) !== JSON.stringify(bindingSnapshot)) return profileRefused('profile-withdrawn');
    const { secretMaterialIn } = await import('./reply-check.js');
    const { redact } = await import('../../src/recall/redact.js');
    return check(JSON.stringify(result)) === 'clear' && !redact(JSON.stringify(result)).count
      && !secretMaterialIn(JSON.stringify(result), [...heldProfile]) ? result : profileRefused('output-secret-check');
  }, { binding });
  return { close, async request(id, input) {
    if (closed || busy || stopped() || now() >= deadline) return profileRefused('closed-stopped-or-busy');
    if (input?.method === 'tools/list') {
      const { tools } = await profileCatalog(binding().installation);
      return { status: 'observed', tools: tools.map(({ schema }) => ({ ...schema, inputSchema: schema.inputSchema.toJSONSchema() })) };
    }
    // Network effect envelopes are host-owned; the worker may only request UI tools.
    if (input?.arguments?.browserEffect !== undefined || !profileRequest(input?.name, input?.arguments)) return profileRefused('profile-tool-scope');
    busy = true;
    try {
      // The effect owner sees the actual tool arguments, never a worker-supplied grant.
      const adapter = Object.assign(options => browser({ ...options, input }), { binding });
      return await call(id, `mcp__playwright__${input.name}`, input.arguments, adapter);
    } finally { busy = false; }
  } };
}
if (process.argv[2] === '--host' && process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = await import('playwright');
  const { register } = await import('node:module');
  register('../../scripts/slice-ts-loader.mjs', import.meta.url);
  const { secretMaterialIn } = await import('./reply-check.js');
  const { redact } = await import('../../src/recall/redact.js');
  const { METHOD_OVERRIDES } = await import('./tool-admission.mjs');
  const root = process.argv[3], name = process.argv[4], initial = readBrowserProfile(root, name);
  let context, backend, action, refusal, outputHeld, protectCode, active = false, effectSequence = 0;
  const effects = new Map(), networkEffects = new Map(), completions = new Map();
  const finished = (requestId, status) => {
    for (const effect of networkEffects.get(requestId) ?? []) {
      if (status !== 'observed') refusal = 'network-result-unavailable';
      completions.get(effect)?.(); completions.delete(effect);
      process.stdout.write(`${JSON.stringify({ effectDone: effect, status })}\n`);
    }
    networkEffects.delete(requestId);
  };
  const prepareRequest = (request, networkId) => {
    const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]));
    const methods = [request.method, ...METHOD_OVERRIDES.flatMap(key => String(headers[key] ?? '').split(',').map(value => value.trim().toUpperCase()).filter(Boolean))];
    if (secretMaterialIn(JSON.stringify({ url: request.url, body: request.postData ?? request.postDataEntries,
      headers: Object.fromEntries(Object.entries(headers).filter(([name]) => !['cookie', 'authorization'].includes(name))) }), [...held])) {
      refusal = 'output-secret-check'; return Promise.resolve(false);
    }
    const method = methods.find(value => !['GET', 'HEAD'].includes(value));
    if (!method) return Promise.resolve(true);
    if (!action) return Promise.resolve(false);
    const body = request.postData ?? (request.postDataEntries ? JSON.stringify(request.postDataEntries) : request.hasPostData ? null : '');
    if (body === null || !networkId) return Promise.resolve(false);
    const effect = ++effectSequence, input = { ...action.input, browserEffect: { method, url: request.url,
      bodyDigest: `sha256:${createHash('sha256').update(body).digest('hex')}` } };
    action.completions.push(new Promise(resolve => completions.set(effect, resolve)));
    return new Promise(resolve => {
      effects.set(effect, admitted => { if (!admitted) finished(networkId, 'unavailable'); resolve(admitted); });
      networkEffects.set(networkId, [...networkEffects.get(networkId) ?? [], effect]);
      process.stdout.write(`${JSON.stringify({ effect, tool: action.tool, input })}\n`);
    });
  };
  const held = new Set();
  const capture = async () => {
    for (const scope of context.browser().contexts()) {
      const state = await scope.storageState({ indexedDB: true });
      const strings = value => { if (typeof value === 'string') held.add(value); else if (value && typeof value === 'object') Object.values(value).forEach(strings); };
      for (const cookie of state.cookies) held.add(cookie.value);
      for (const origin of state.origins) { for (const item of origin.localStorage) held.add(item.value); for (const db of origin.indexedDB ?? []) for (const store of db.stores) for (const record of store.records) strings(record.value); }
      for (const page of scope.pages()) for (const frame of page.frames())
        if (allowed(frame.url())) strings(await frame.evaluate(() => Object.values(sessionStorage)).catch(() => []));
    }
    // Host-private IPC inventory: additive custody in the parent, never a journal or model result.
    process.stdout.write(`${JSON.stringify({ held: [...held] })}\n`);
  };
  const allowed = value => { try { if (JSON.stringify(readBrowserProfile(root, name)) !== JSON.stringify(initial)) return false; const url = new URL(value); return !url.username && !url.password && initial.origins.includes(url.origin.replace(/^ws/u, 'http')); } catch { return false; } };
  const execute = async (tool, input) => {
    if (!profileRequest(tool, input) || JSON.stringify(readBrowserProfile(root, name)) !== JSON.stringify(initial)) return profileRefused('profile-or-tool-scope');
    if (tool === 'browser_navigate' && !allowed(input.url)) return profileRefused('site-scope');
    if (!context) {
      const catalog = await profileCatalog(root);
      context = await chromium.launchPersistentContext(initial.userDataDir, { ...catalog.config.browser.contextOptions, headless: true, serviceWorkers: 'block' });
      context.setDefaultTimeout(5000); context.setDefaultNavigationTimeout(10000);
      const protectors = new WeakMap();
      const install = async scope => {
        const attached = new WeakMap();
        const protect = page => {
          if (!attached.has(page)) attached.set(page, (async () => {
            const network = await scope.newCDPSession(page).catch(error => { if (!page.parentFrame) throw error; return null; });
            if (!network) return; // Same-process frames are covered by their page session.
            network.on('Network.loadingFinished', event => finished(event.requestId, 'observed'));
            network.on('Network.loadingFailed', event => finished(event.requestId, 'unavailable'));
            await network.send('Network.enable');
            network.on('Fetch.requestPaused', async event => {
              const admit = allowed(event.request.url) && await prepareRequest(event.request, event.networkId);
              if (!admit) refusal = 'network-effect-or-scope';
              await network.send(admit ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: event.requestId, ...(admit ? {} : { errorReason: 'BlockedByClient' }) }).catch(() => {});
            });
            await network.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
          })());
          return attached.get(page);
        };
        protectors.set(scope, protect);
        scope.on('page', page => { void protect(page); });
        await Promise.all(scope.pages().map(protect));
        scope.on('requestfinished', request => finished(request._guid, 'observed'));
        scope.on('requestfailed', request => finished(request._guid, 'unavailable'));
        await scope.route('**/*', async route => {
          const request = route.request(); let frame;
          try { frame = request.frame(); } catch { /* First popup request precedes its CDP target. */ }
          let admit = allowed(request.url());
          if (frame) { await protect(frame.page()); if (frame.parentFrame()) await protect(frame); }
          else if (admit) admit = await prepareRequest({ method: 'UNINTERCEPTED', url: request.url(),
            headers: await request.allHeaders(), postData: request.postData() ?? '' }, request._guid);
          if (!admit) refusal = 'network-effect-or-scope';
          return admit ? route.continue() : route.abort();
        });
        await scope.routeWebSocket('**/*', socket => {
          if (!allowed(socket.url())) { refusal = 'site-scope'; return socket.close(); }
          const originAction = action, server = socket.connectToServer();
          socket.onMessage(async message => {
            const previous = action; action = originAction;
            const id = `ws:${++effectSequence}`, admitted = prepareRequest({ method: 'WS', url: socket.url(), headers: {}, postData: String(message) }, id);
            action = previous;
            if (await admitted) { server.send(message); finished(id, 'observed'); }
            else { refusal = 'network-effect-or-scope'; socket.close(); }
          });
        });
      };
      await install(context);
      protectCode = async () => {
        for (const scope of context.browser().contexts()) {
          if (!protectors.has(scope)) await install(scope);
          await Promise.all(scope.pages().map(protectors.get(scope)));
        }
      };
      backend = new playwrightTools.BrowserBackend({ ...catalog.config, saveSession: false, snapshot: { mode: 'none' } }, context, catalog.tools);
      await backend.initialize({ cwd: initial.userDataDir });
      const newTab = backend._context.newTab.bind(backend._context);
      backend._context.newTab = async name => {
        const tab = await newTab(name); await protectors.get(tab.page.context())(tab.page); return tab;
      };
      const isolated = backend._context._createIsolatedContext.bind(backend._context);
      backend._context._createIsolatedContext = async name => { const scope = await isolated(name); await install(scope); return scope; };
      backend._context.redactSecrets = text => {
        if (!redact(text).count && !secretMaterialIn(text, [...held])) return text;
        outputHeld = true; return '[withheld by credential checkpoint]';
      };
      // Console tools retain in-memory messages; automatic raw diagnostic logs never cross custody.
      const onPage = backend._context._onPageCreated.bind(backend._context);
      backend._context._onPageCreated = (...args) => {
        onPage(...args); const tab = playwrightTools.Tab.forPage(args[0]); let log = tab._consoleLog; log.stop();
        Object.defineProperty(tab, '_consoleLog', { get: () => log, set: value => { log = value; log.stop(); } });
      };
    }
    await capture();
    action = { tool, input, completions: [] }; refusal = null; outputHeld = false;
    try {
      let output;
      if (tool === 'browser_run_code_unsafe') {
        const tab = await backend._context.ensureTab();
        await tab.waitForCompletion(async () => {
          output = await runProfileCode({ context, page: tab.page,
            code: input.filename ? readFileSync(input.filename, 'utf8') : input.code,
            clear: text => !redact(text).count && !secretMaterialIn(text, [...held]), allowed, protect: protectCode, capture,
            refused: reason => { refusal = reason; } });
        });
      } else output = await backend.callTool(tool, input);
      await Promise.all(action.completions);
      if (refusal) return profileRefused(refusal);
      const page = backend._context.currentTab()?.page;
      const result = { status: output.isError ? 'refused' : 'observed', content: output.content,
        text: page && allowed(page.url()) ? await page.locator('body').ariaSnapshot() : '' };
      await capture();
      return outputHeld || redact(JSON.stringify(result)).count || secretMaterialIn(JSON.stringify(result), [...held]) ? profileRefused('output-secret-check') : result;
    } finally { action = null; }
  };
  const lines = createInterface({ input: process.stdin });
  lines.on('line', async line => {
    if (Buffer.byteLength(line) > 8192) return;
    let message; try { message = JSON.parse(line); } catch { return; }
    if (message.effect) { effects.get(message.effect)?.(message.admitted === true); effects.delete(message.effect); return; }
    if (active) return;
    active = true;
    let row, result;
    try { row = JSON.parse(line); result = await execute(row.name, row.input); } catch { result = profileRefused('browser-unavailable'); }
    process.stdout.write(`${JSON.stringify({ id: row?.id, result })}\n`); active = false;
  });
  const close = async () => { await context?.close().catch(() => {}); process.exit(0); };
  lines.on('close', close); process.on('SIGTERM', close);
}
