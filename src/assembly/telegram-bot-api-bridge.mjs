import { readFileSync } from 'node:fs';

const encoded = process.argv[2];
if (!encoded) process.exit(2);
let request;
try { request = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
catch { process.exit(2); }
const token = readFileSync(0, 'utf8');
if (!token || !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0) process.exit(2);
try {
  const response = await fetch(`https://api.telegram.org/bot${token}/${request.method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(request.timeoutMs),
  });
  process.stdout.write(JSON.stringify({ kind: 'response', status: response.status, bytes: await response.text() }));
} catch (error) {
  const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
  process.stdout.write(JSON.stringify({ kind: 'uncertain', limitation: timeout ? 'timeout' : 'transport' }));
}
