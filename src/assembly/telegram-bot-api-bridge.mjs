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

function htmlCodePoint(original, digits, radix) {
  const point = Number.parseInt(digits, radix);
  return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
    ? String.fromCodePoint(point) : original;
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (original, hex) => htmlCodePoint(original, hex, 16))
    .replace(/&#([0-9]+);?/g, (original, digits) => htmlCodePoint(original, digits, 10))
    .replace(/&(amp|lt|gt|quot|apos|colon);/gi, (_, name) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':',
    })[name.toLowerCase()]);
}

const decodedNamedHtml = new Set(['amp', 'lt', 'gt', 'quot', 'apos', 'colon']);
function hasUnknownNamedHtml(value) {
  return [...value.matchAll(/&([A-Za-z][A-Za-z0-9]+);/g)]
    .some(([, name]) => !decodedNamedHtml.has(name.toLowerCase()));
}

function base32(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let accumulator = 0; let bits = 0; let output = '';
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; output += alphabet[(accumulator >>> bits) & 31]; }
  }
  if (bits > 0) output += alphabet[(accumulator << (5 - bits)) & 31];
  return output;
}

function rot13(value) {
  return value.replace(/[A-Za-z]/g, character => String.fromCharCode(
    character.charCodeAt(0) + (character.toLowerCase() <= 'm' ? 13 : -13)));
}

// Bounded egress policy: scan literal UTF-8 text and reversible representations in
// four named families (radix-16, radix-32, radix-64 and ROT13), over UTF-8 and
// UTF-16LE/BE bytes, with and without a byte-order mark, where those encodings
// apply. Before matching, close compositions
// of JSON-unicode, percent and numeric/named-HTML text transforms for at most four
// rounds and 512 candidates. Radix-16/32 matching is case-insensitive; radix-64
// folding is normalized as ASCII whitespace. Six named HTML references are decoded
// and every other semicolon-terminated named reference fails closed. Consecutive
// sibling string runs in JSON property/array order are checked as one candidate.
// Inputs outside the 2 MiB / 4,096 JSON-value bounds fail closed. This is a finite
// representation policy, not a claim to detect arbitrary encryption/covert channels.
const REPRESENTATION_POLICY = Object.freeze({
  maximumBytes: 2 * 1024 * 1024,
  maximumJsonValues: 4096,
  maximumCandidates: 512,
  maximumDecodeRounds: 4,
});

function tokenRepresentations(value) {
  const utf8 = Buffer.from(value, 'utf8');
  const utf16le = Buffer.from(value, 'utf16le');
  const utf16be = Buffer.from(utf16le).swap16();
  const byteRepresentations = [
    utf8,
    utf16le,
    Buffer.concat([Buffer.from([0xff, 0xfe]), utf16le]),
    utf16be,
    Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be]),
  ];
  const exact = new Set([value, rot13(value)]);
  const caseInsensitive = new Set();
  for (const bytes of byteRepresentations) {
    const hexadecimal = bytes.toString('hex');
    const base64 = bytes.toString('base64');
    const radix32 = base32(bytes);
    const paddedRadix32 = radix32.padEnd(Math.ceil(radix32.length / 8) * 8, '=');
    caseInsensitive.add(hexadecimal);
    caseInsensitive.add(radix32.toLowerCase());
    exact.add(base64);
    exact.add(base64.replace(/=+$/u, ''));
    exact.add(bytes.toString('base64url'));
    exact.add(paddedRadix32);
  }
  return { exact, caseInsensitive };
}

function reflectsCredential(bytes) {
  if (Buffer.byteLength(bytes, 'utf8') > REPRESENTATION_POLICY.maximumBytes) return true;
  const encodedTokenForms = tokenRepresentations(token);
  const candidates = [{ value: bytes, depth: 0 }]; const seen = new Set([bytes]);
  const addCandidate = (value, depth = 0) => {
    if (seen.has(value)) return true;
    if (Buffer.byteLength(value, 'utf8') > REPRESENTATION_POLICY.maximumBytes
      || candidates.length >= REPRESENTATION_POLICY.maximumCandidates) return false;
    seen.add(value); candidates.push({ value, depth }); return true;
  };
  const addJoinedSiblingRun = values => {
    let run = [];
    for (const value of [...values, null]) {
      if (typeof value === 'string') run.push(value);
      else {
        if (run.length > 1 && !addCandidate(run.join(''))) return false;
        run = [];
      }
    }
    return true;
  };
  try {
    const pending = [JSON.parse(bytes)]; let visited = 0;
    while (pending.length > 0) {
      if (++visited > REPRESENTATION_POLICY.maximumJsonValues) return true;
      const value = pending.pop();
      if (typeof value === 'string') {
        if (!addCandidate(value)) return true;
      } else if (Array.isArray(value)) {
        if (!addJoinedSiblingRun(value)) return true;
        for (const item of value) pending.push(item);
      } else if (value !== null && typeof value === 'object') {
        const values = Object.values(value);
        if (!addJoinedSiblingRun(values)) return true;
        for (const item of values) pending.push(item);
      }
    }
  } catch { /* Non-JSON responses are still scanned through the raw transformations below. */ }
  for (let index = 0; index < candidates.length && index < REPRESENTATION_POLICY.maximumCandidates; index += 1) {
    const { value: candidate, depth } = candidates[index];
    const unfolded = candidate.replace(/[\t\r\n ]/gu, '');
    if (hasUnknownNamedHtml(candidate)) return true;
    if ([candidate, unfolded].some(surface => {
      if ([...encodedTokenForms.exact].some(encoded => surface.includes(encoded))) return true;
      const folded = surface.toLowerCase();
      return [...encodedTokenForms.caseInsensitive].some(encoded => folded.includes(encoded));
    })) return true;
    if (depth >= REPRESENTATION_POLICY.maximumDecodeRounds) continue;
    for (const decoded of [decodeJsonEscapes(candidate), decodePercent(candidate), decodeHtml(candidate)]) {
      if (decoded.includes(token)) return true;
      if (decoded !== candidate && !addCandidate(decoded, depth + 1)) return true;
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
