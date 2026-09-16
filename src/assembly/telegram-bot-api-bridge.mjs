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

function decodeJsonEscapes(value) {
  return value.replace(/\\u([0-9a-f]{4})/gi,
    (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodePercent(value) {
  try { return decodeURIComponent(value); }
  catch {
    return value.replace(/%([0-9a-f]{2})/gi,
      (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  }
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&colon;/gi, ':');
}

function reflectsCredential(bytes) {
  const encodedTokenForms = [
    Buffer.from(token, 'utf8').toString('base64'),
    Buffer.from(token, 'utf8').toString('base64url'),
    Buffer.from(token, 'utf8').toString('hex'),
  ];
  const candidates = [bytes];
  try {
    const visit = value => {
      if (typeof value === 'string') candidates.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value !== null && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(JSON.parse(bytes));
  } catch { /* Non-JSON responses are still scanned through the raw transformations below. */ }
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate.includes(token) || encodedTokenForms.some(encoded => candidate.includes(encoded))) return true;
    for (const decoded of [decodeJsonEscapes(candidate), decodePercent(candidate), decodeHtml(candidate)]) {
      if (decoded.includes(token)) return true;
      if (decoded !== candidate && !candidates.includes(decoded)) candidates.push(decoded);
    }
  }
  return false;
}

try {
  const provider = await fetch(`https://api.telegram.org/bot${token}/${request.method}`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request.body), signal: AbortSignal.timeout(request.timeoutMs),
  });
  const bytes = await provider.text();
  process.stdout.write(reflectsCredential(bytes)
    ? JSON.stringify({ kind: 'uncertain', limitation: 'transport' })
    : JSON.stringify({ kind: 'response', status: provider.status, bytes }));
} catch (error) {
  const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
  process.stdout.write(JSON.stringify({ kind: 'uncertain', limitation: timeout ? 'timeout' : 'transport' }));
}
