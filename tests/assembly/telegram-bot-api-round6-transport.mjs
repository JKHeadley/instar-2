import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

let fetches = 0; let reads = 0;
let requests = 0;
let redirect = null;
const realFetch = globalThis.fetch;
let endpoint;
let firstSignal;
const count = () => {
  if (process.env.INSTAR_ROUND6_COUNT_FILE)
    writeFileSync(process.env.INSTAR_ROUND6_COUNT_FILE, JSON.stringify({ fetches, reads, redirect,
      ...(process.env.INSTAR_ROUND6_FAILURE?.startsWith('real-') ? { requests } : {}) }));
};

globalThis.fetch = async (url, init) => {
  fetches += 1; count();
  if (fetches === 1) firstSignal = init.signal;
  else if (init.signal !== firstSignal) throw Error('retry renewed the timeout');
  redirect = init?.redirect ?? null; count();
  const token = String(url).split('/bot')[1].split('/')[0];
  const mode = process.env.INSTAR_ROUND6_FAILURE;
  if (mode?.startsWith('real-')) {
    const bytes = Buffer.from(process.env.INSTAR_ROUND6_RESPONSE_BASE64, 'base64').toString('utf8');
    if (fetches === 1) {
      const server = createServer((req, res) => {
        requests++; count(); req.resume();
        req.on('end', () => {
          if (mode === 'real-lost-receipt') req.socket.destroy();
          else res.end(bytes);
          server.close(); server.closeIdleConnections();
        });
      });
      await new Promise(done => server.listen(0, '127.0.0.1', done));
      const port = server.address().port;
      endpoint = `http://127.0.0.1:${port}`;
      if (mode === 'real-connect-recovery') {
        await new Promise(done => server.close(done));
        try { return await realFetch(endpoint, init); }
        catch (error) {
          await new Promise(done => server.listen(port, '127.0.0.1', done));
          server.unref();
          throw error; // the actual native ECONNREFUSED, not a hand-written approximation
        }
      }
      server.unref();
    }
    return realFetch(endpoint, init);
  }
  const refused = { code: 'ECONNREFUSED', syscall: 'connect' };
  const causes = {
    'connect-refused': refused,
    'connect-dns': { code: 'EAI_AGAIN', syscall: 'getaddrinfo' },
    'connect-notfound': { code: 'ENOTFOUND', syscall: 'getaddrinfo' },
    'connect-timeout': { code: 'UND_ERR_CONNECT_TIMEOUT' },
    'connect-aggregate': new AggregateError([refused, { code: 'ENOTFOUND', syscall: 'getaddrinfo' }]),
    'connect-width-limit': new AggregateError(Array(8).fill(refused)),
    'connect-too-wide': new AggregateError(Array(9).fill(refused)),
    'connect-depth-limit': new AggregateError([new AggregateError([refused])]),
    'connect-too-deep': new AggregateError([new AggregateError([new AggregateError([refused])])]),
    'connect-empty': new AggregateError([]),
    'connect-mixed': new AggregateError([refused, { code: 'ECONNRESET', syscall: 'read' }]),
    'connect-wrong-syscall': { code: 'ECONNREFUSED', syscall: 'write' },
    'connect-socket': { code: 'UND_ERR_SOCKET' },
    'connect-aborted': refused,
    'connect-persistent': refused,
  };
  if (causes[mode] && (fetches === 1 || mode === 'connect-persistent')) {
    if (mode === 'connect-aborted') await new Promise(done => setTimeout(done, 1100));
    throw new TypeError(`fetch failed ${token}`, { cause: causes[mode] });
  }
  if (mode === 'fetch-failure') throw new Error(`provider marker ${token} https://untrusted.invalid`);
  if (mode === 'fetch-timeout') { const error = new Error(`timeout marker ${token}`); error.name = 'AbortError'; throw error; }
  let status = 200; let bytes = JSON.stringify({ ok: true, result: { id: 818181, is_bot: true,
    username: 'echo_mmtest_seam_b27x_bot', first_name: 'ordinary' } });
  if (process.env.INSTAR_ROUND6_RESPONSE_BASE64)
    bytes = Buffer.from(process.env.INSTAR_ROUND6_RESPONSE_BASE64, 'base64').toString('utf8');
  if (mode === 'invalid-response') status = 500;
  if (mode === 'redirect-response') status = 307;
  if (mode === 'scan-policy') bytes = JSON.stringify({ ok: true, result: { text: token } });
  if (mode === 'scan-budget') bytes = 'x'.repeat(2 * 1024 * 1024 + 1);
  return { status, text: async () => {
    reads += 1; count();
    if (mode === 'body-read') throw new Error(`body marker ${token} https://untrusted.invalid`);
    return bytes;
  } };
};
