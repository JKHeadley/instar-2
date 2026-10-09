import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync, constants, existsSync, fsyncSync, linkSync, lstatSync, openSync,
  readFileSync, unlinkSync, writeSync,
} from 'node:fs';
import { join } from 'node:path';

const REPRESENTATION_POLICY = Object.freeze({
  maximumBytes: 2 * 1024 * 1024,
  maximumJsonValues: 4096,
  maximumCandidates: 512,
  maximumDecodeRounds: 4,
});

const namedHtml = Object.freeze(JSON.parse(readFileSync(
  new URL('./telegram-html-named.json', import.meta.url), 'utf8')));
const usernameIsValid = value => typeof value === 'string' && value.length >= 5 && value.length <= 32
  && !/[^A-Za-z0-9_]/u.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digestHex = value => createHash('sha256').update(value, 'utf8').digest('hex');
const digest = value => `sha256:${digestHex(value)}`;

const encoded = process.argv[2];
if (!encoded) process.exit(2);
let request;
try { request = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
catch { process.exit(2); }
const token = readFileSync(0, 'utf8');
// Offline transport contract only. A real credential can never be redirected.
const TEST_TOKEN = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const testEndpoint = request?.testEndpoint;
const testMatch = typeof testEndpoint === 'string' ? /^http:\/\/127\.0\.0\.1:(\d{1,5})$/.exec(testEndpoint) : null;
if (testEndpoint !== undefined && (token !== TEST_TOKEN || !testMatch
  || Number(testMatch[1]) < 1 || Number(testMatch[1]) > 65535)) process.exit(2);
// answerCallbackQuery only clears a pressed button with a short toast; it carries no message.
const validMethod = request?.method === 'getMe' || request?.method === 'getUpdates' || request?.method === 'sendMessage'
  || request?.method === 'answerCallbackQuery';
const identityRequestPresent = request?.method !== 'getMe' || (
  typeof request.captureDirectory === 'string' && request.captureDirectory.length > 0
  && record(request.identityBinding));
if (!/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(token) || !validMethod
  || !record(request.body)
  || !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0
  || !identityRequestPresent) process.exit(2);

function uncertain(stage, limitation = 'transport') {
  process.stdout.write(JSON.stringify({ kind: 'uncertain', limitation, stage }));
}

if (request.method === 'getMe' && (!Number.isSafeInteger(request.identityBinding.id)
  || request.identityBinding.id <= 0 || !usernameIsValid(request.identityBinding.username))) {
  uncertain('invalid-response'); process.exit(0);
}

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
    .replace(/&([A-Za-z][A-Za-z0-9]+);/g,
      (original, name) => Object.hasOwn(namedHtml, name) ? namedHtml[name] : original);
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const unpadded = value.toUpperCase().replace(/=+$/u, '');
  if (!/^[A-Z2-7]+$/u.test(unpadded)) return null;
  let accumulator = 0; let bits = 0; const output = [];
  for (const character of unpadded) {
    accumulator = ((accumulator << 5) | alphabet.indexOf(character)) & 0xffff;
    bits += 5;
    if (bits >= 8) { bits -= 8; output.push((accumulator >>> bits) & 0xff); }
  }
  return Buffer.from(output);
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

// Bounded egress policy: scan literal UTF-8; JSON Unicode escapes; percent
// escapes with total malformed-input handling; numeric HTML entities; the
// complete finite HTML named-reference table (including multi-codepoint entries,
// with unknown names left literal); radix-16 and radix-32 with case folding;
// standard/url-safe radix-64 with legal padding and ASCII whitespace folding;
// UTF-8 and UTF-16LE/BE byte forms with and without BOM; ROT13; and ordered
// consecutive JSON sibling-string concatenations. Decode bounded whole radix
// runs and compare decoded bytes. Match every visited node. Refuse unfinished
// in-policy work at the four-edge frontier and any overflow beyond 2,097,152
// UTF-8 bytes, 4,096 visited JSON values, or 512 distinct candidates. Accepted
// bytes remain exact. This is a finite policy, not a claim to detect arbitrary
// encryption, nonconsecutive reconstruction, or provider covert channels.

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
  return { exact, caseInsensitive, byteRepresentations };
}

function containsBytes(haystack, needles) {
  return needles.some(needle => haystack.includes(needle));
}

function reflectsWholeRadixRun(value, byteForms) {
  const minimumBytes = Math.min(...byteForms.map(bytes => bytes.length));
  const minimumHex = minimumBytes * 2;
  for (const match of value.matchAll(/[0-9A-Fa-f]+/g)) {
    const run = match[0];
    if (run.length >= minimumHex && run.length % 2 === 0
      && containsBytes(Buffer.from(run, 'hex'), byteForms)) return true;
  }
  const minimum32 = Math.floor(minimumBytes * 8 / 5);
  for (const match of value.matchAll(/[A-Z2-7]+={0,6}/gi)) {
    const run = match[0];
    if (run.length < minimum32) continue;
    const decoded = decodeBase32(run);
    if (decoded !== null && containsBytes(decoded, byteForms)) return true;
  }
  const minimum64 = Math.floor(minimumBytes * 4 / 3);
  for (const match of value.matchAll(/[A-Za-z0-9+/_-]+={0,2}/g)) {
    const run = match[0];
    if (run.length < minimum64 || run.replace(/=+$/u, '').length % 4 === 1) continue;
    const decoded = Buffer.from(run.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (containsBytes(decoded, byteForms)) return true;
  }
  return false;
}

function scanCredential(bytes) {
  if (Buffer.byteLength(bytes, 'utf8') > REPRESENTATION_POLICY.maximumBytes) return 'scan-budget';
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
      if (++visited > REPRESENTATION_POLICY.maximumJsonValues) return 'scan-budget';
      const value = pending.pop();
      if (typeof value === 'string') {
        if (!addCandidate(value)) return 'scan-budget';
      } else if (Array.isArray(value)) {
        if (!addJoinedSiblingRun(value)) return 'scan-budget';
        for (const item of value) pending.push(item);
      } else if (record(value)) {
        const values = Object.values(value);
        if (!addJoinedSiblingRun(values)) return 'scan-budget';
        for (const item of values) pending.push(item);
      }
    }
  } catch { /* Raw non-JSON error responses are scanned too. */ }
  for (let index = 0; index < candidates.length; index += 1) {
    const { value: candidate, depth } = candidates[index];
    const unfolded = candidate.replace(/[\t\r\n ]/gu, '');
    if ([candidate, unfolded].some(surface => {
      if (surface.includes(token) || reflectsWholeRadixRun(surface, encodedTokenForms.byteRepresentations)) return true;
      if ([...encodedTokenForms.exact].some(form => surface.includes(form))) return true;
      const folded = surface.toLowerCase();
      return [...encodedTokenForms.caseInsensitive].some(form => folded.includes(form));
    })) return 'scan-policy';
    const transformed = [decodeJsonEscapes(candidate), decodePercent(candidate), decodeHtml(candidate)];
    if (depth >= REPRESENTATION_POLICY.maximumDecodeRounds) {
      if (transformed.some(successor => successor !== candidate && !seen.has(successor))) return 'scan-policy';
      continue;
    }
    for (const successor of transformed) {
      if (successor.includes(token)) return 'scan-policy';
      if (successor !== candidate && !addCandidate(successor, depth + 1)) return 'scan-budget';
    }
  }
  return null;
}

// The confined child owns the actual bot token. Check that credential in the
// complete outbound body before the irreversible network call, including the
// bounded representations above. Other credentials need exact evidence from
// protected custody; a credential-shaped string alone cannot block a send.
if (request.method === 'sendMessage') {
  const outgoing = JSON.stringify(request.body);
  if (scanCredential(outgoing) !== null) {
    uncertain('scan-policy'); process.exit(0);
  }
}

function countJsonValues(root) {
  const pending = [root]; let visited = 0;
  while (pending.length > 0) {
    if (++visited > REPRESENTATION_POLICY.maximumJsonValues) return false;
    const value = pending.pop();
    if (Array.isArray(value)) for (const item of value) pending.push(item);
    else if (record(value)) for (const item of Object.values(value)) pending.push(item);
  }
  return true;
}

function readExactNoFollow(path) {
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try { return readFileSync(descriptor, 'utf8'); }
  finally { closeSync(descriptor); }
}

function sealIdentity(bytes, directory) {
  const directoryState = lstatSync(directory);
  if (!directoryState.isDirectory() || directoryState.isSymbolicLink()) throw new Error('sealed-capture');
  const hex = digestHex(bytes); const destination = join(directory, `${hex}.capture`);
  if (!existsSync(destination)) {
    const temporary = join(directory, `.${hex}.${process.pid}.${randomBytes(8).toString('hex')}.pending`);
    let descriptor;
    try {
      descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY
        | (constants.O_NOFOLLOW ?? 0), 0o600);
      const buffer = Buffer.from(bytes, 'utf8'); let offset = 0;
      while (offset < buffer.length) offset += writeSync(descriptor, buffer, offset);
      fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined;
      try { linkSync(temporary, destination); }
      catch (error) { if (!existsSync(destination)) throw error; }
      const directoryDescriptor = openSync(directory, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      try { unlinkSync(temporary); } catch { /* The final link is durable or the operation failed. */ }
    }
  }
  if (readExactNoFollow(destination) !== bytes) throw new Error('sealed-capture');
  return { reference: `capture:telegram:sealed-getMe:${hex}`, hash: `sha256:${hex}`,
    byteLength: Buffer.byteLength(bytes, 'utf8') };
}

// Only connection setup failures prove that no HTTP request reached Telegram. A reset,
// response timeout or missing cause can follow a delivered send and must never be repeated.
// Node can aggregate failed IPv4/IPv6 connects: every member must prove the same thing.
function connectionNeverOpened(cause, depth = 0) {
  if (!cause || depth > 2) return false;
  if (cause instanceof AggregateError)
    return cause.errors.length > 0 && cause.errors.length <= 8
      && cause.errors.every(error => connectionNeverOpened(error, depth + 1));
  return cause.code === 'UND_ERR_CONNECT_TIMEOUT'
    || cause.code === 'ECONNREFUSED' && cause.syscall === 'connect'
    || (cause.code === 'ENOTFOUND' || cause.code === 'EAI_AGAIN') && cause.syscall === 'getaddrinfo';
}

let provider;
const signal = AbortSignal.timeout(request.timeoutMs);
for (let attempt = 0; attempt < 2; attempt++) {
  try {
    provider = await fetch(`${testEndpoint ?? 'https://api.telegram.org'}/bot${token}/${request.method}`, {
      method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request.body), signal,
    });
    break;
  } catch (error) {
    // Stay inside the original physical admission and elapsed bound, including on replicated
    // installations. No second dispatch claim, renewed timeout, or ambiguous-send retry.
    if (attempt === 0 && !signal.aborted && connectionNeverOpened(error?.cause)) continue;
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    uncertain(timeout ? 'fetch-timeout' : 'fetch-failure', timeout ? 'timeout' : 'transport');
    process.exit(0);
  }
}

let bytes;
try { bytes = await provider.text(); }
catch { uncertain('body-read'); process.exit(0); }

if (typeof bytes !== 'string' || Buffer.byteLength(bytes, 'utf8') > REPRESENTATION_POLICY.maximumBytes) {
  uncertain('scan-budget'); process.exit(0);
}

if (request.method === 'getMe') {
  let capture;
  try { capture = sealIdentity(bytes, request.captureDirectory); }
  catch { uncertain('sealed-capture'); process.exit(0); }
  try {
    const parsed = JSON.parse(bytes);
    if (!countJsonValues(parsed) || !record(parsed) || parsed.ok !== true || provider.status !== 200
      || !record(parsed.result)) throw new Error('invalid');
    const bot = parsed.result;
    if (!Number.isSafeInteger(bot.id) || bot.id <= 0 || bot.is_bot !== true || !usernameIsValid(bot.username)
      || bot.id !== request.identityBinding.id || bot.username !== request.identityBinding.username
      || bot.first_name !== undefined && typeof bot.first_name !== 'string') throw new Error('invalid');
    const firstName = typeof bot.first_name === 'string'
      ? { byteLength: Buffer.byteLength(bot.first_name, 'utf8'), hash: digest(bot.first_name) } : null;
    process.stdout.write(JSON.stringify({ kind: 'identity', status: 200,
      identity: { id: bot.id, is_bot: true, username: bot.username, first_name: firstName }, capture }));
  } catch { uncertain('invalid-response'); }
  process.exit(0);
}

const scanFailure = scanCredential(bytes);
if (scanFailure !== null) uncertain(scanFailure);
else process.stdout.write(JSON.stringify({ kind: 'response', status: provider.status, bytes }));
