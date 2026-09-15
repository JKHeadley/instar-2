import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { ProviderObservation } from '../../src/judgment/index.js';
export async function localProvider() {
  const credential = randomBytes(24).toString('hex');
  const requests: { bytes: string; operation: string }[] = [];
  let response: ProviderObservation = { state: 'complete', bytes: '{}', providerOperation: 'http-operation', usage: { inputTokens: 1, outputTokens: 1, charge: 3, source: 'local-http' }, retryBlocked: false }, delay = 0;
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${credential}`) { res.writeHead(401); res.end(); return; }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push({ bytes: Buffer.concat(chunks).toString('utf8'), operation: String(req.headers['x-operation']) });
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(response));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('HTTP address absent');
  return { credential, endpoint: `http://127.0.0.1:${address.port}/model`, requests,
    respond: (value: ProviderObservation) => { response = value; }, delay: (ms: number) => { delay = ms; },
    close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}
