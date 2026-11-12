// Untrusted code runs only under the fixed-worker OS profile. This process owns no profile or transport.
import { createInterface } from 'node:readline';
import { inprocess, tools } from 'playwright-core/lib/coreBundle';
const connection = new inprocess.playwright._connection.constructor();
connection.markAsRemote();
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
connection.onmessage = message => send({ protocol: message });
const pending = new Map(); let sequence = 0;
globalThis.fetch = async (url, options) => {
  const request = new Request(url, options), id = ++sequence;
  const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  send({ fetch: id, request: { url: request.url, method: request.method, redirect: request.redirect, headers: [...request.headers], body: Buffer.from(await request.arrayBuffer()).toString('base64') } });
  const response = await result;
  const resultResponse = new Response(response.body ? Buffer.from(response.body, 'base64') : null, response);
  for (const name of ['url', 'redirected']) Object.defineProperty(resultResponse, name, { value: response[name] });
  return resultResponse;
};
const lines = createInterface({ input: process.stdin });
lines.on('line', async line => {
  const message = JSON.parse(line);
  if (message.protocol) { connection.dispatch(message.protocol); return; }
  if (message.fetch) {
    const p = pending.get(message.fetch); pending.delete(message.fetch);
    if (message.error) p.reject(Error(message.error)); else p.resolve(message.response);
    return;
  }
  if (!message.start) return;
  let invoked = false;
  try {
    const api = await connection.initializePlaywright();
    const pages = api._preLaunchedBrowser().contexts().flatMap(context => context.pages());
    const page = pages[message.page];
    const tool = tools.browserTools.find(tool => tool.schema.name === 'browser_run_code_unsafe');
    const content = [];
    invoked = true;
    await tool.handle({ ensureTab: async () => ({ page, modalStates: () => [], context: { onUnhandledRejection: fn => { process.on('unhandledRejection', fn); return () => process.off('unhandledRejection', fn); } }, waitForCompletion: fn => fn() }) },
      { code: message.code }, { addCode() {}, addTextResult: text => content.push({ type: 'text', text }) });
    send({ result: { content } });
  } catch (error) { send({ result: { isError: true, execution: invoked ? 'handler' : 'setup', content: [{ type: 'text', text: String(error?.message ?? error) }] } }); }
});
