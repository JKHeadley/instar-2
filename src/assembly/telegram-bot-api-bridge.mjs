import { readFileSync } from 'node:fs';

const encoded = process.argv[2];
if (!encoded) process.exit(2);
let request;
try { request = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
catch { process.exit(2); }
const token = readFileSync(0, 'utf8');
const validMethod = request?.method === 'getMe' || request?.method === 'getUpdates' || request?.method === 'sendMessage';
if (!/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(token) || !validMethod
  || request.body === null || typeof request.body !== 'object' || Array.isArray(request.body)
  || !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0) process.exit(2);
try {
  const provider = await fetch(`https://api.telegram.org/bot${token}/${request.method}`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request.body), signal: AbortSignal.timeout(request.timeoutMs),
  });
  const bytes = await provider.text();
  process.stdout.write(bytes.includes(token)
    ? JSON.stringify({ kind: 'uncertain', limitation: 'transport' })
    : JSON.stringify({ kind: 'response', status: provider.status, bytes }));
} catch (error) {
  const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
  process.stdout.write(JSON.stringify({ kind: 'uncertain', limitation: timeout ? 'timeout' : 'transport' }));
}
