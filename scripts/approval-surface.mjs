// The preview's independent approval surface (Eleven §§2, 4, 5; P-02 approval gesture). It runs as a
// separate process under the OPERATOR's OS identity, never the agent's: its own storage (an
// operator-owned directory the agent can read but not write), its own transport (a loopback HTTP
// listener the operator's recorded ingress publishes over HTTPS), and its own verifier (a passkey on
// the operator's phone signs the exact request shown). It holds no signing key.
//
// The agent only asks: its runner writes a request into its own outbox. This process renders the
// request from a fixed template, and records the operator's signed act write-once. The runner applies
// an act only after re-verifying the signature against the operator-owned enrolled passkeys.
//
//   node scripts/approval-surface.mjs serve  /ABS/surface-config.json
//   node scripts/approval-surface.mjs enroll /ABS/surface-config.json   (prints a one-use enrolment link)
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync,
  renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ACT_RECORD, actChallenge, b64u, canonical, check, checkChallenge, hex, nameFor, renderChallenge, SURFACE_LIMITS, verifyAssertion,
  verifyRegistration, writeOnce } from './approval-surface-core.mjs';
export { SURFACE_LIMITS };

const privateDir = directory => { const stat = lstatSync(directory);
  check(realpathSync(directory) === directory && stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid()
    && (stat.mode & 0o077) === 0, 'surface private storage must be operator-owned mode 0700'); };
const replace = (directory, name, bytes, mode) => {
  const temporary = `.${name}.${randomBytes(8).toString('hex')}`;
  writeOnce(directory, temporary, bytes, mode);
  renameSync(join(directory, temporary), join(directory, name));
  const fd = openSync(directory, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
};

/** Validates the operator's configuration and prepares storage. `now` is the surface's own clock. */
export function createApprovalSurface(configuration, now = () => Date.now()) {
  const config = Object.freeze(structuredClone(configuration));
  check(typeof config.operator === 'string' && /^telegram:\d{1,20}$/u.test(config.operator), 'operator identity required');
  check(Number.isSafeInteger(config.operatorUid) && config.operatorUid === process.getuid()
    && Number.isSafeInteger(config.agentUid) && config.agentUid !== config.operatorUid,
  'the approval surface must run as the operator, outside the agent OS identity');
  // Nothing outward by default: the public page exists only under the operator's recorded ingress grant.
  check(typeof config.ingressGrant === 'string' && config.ingressGrant.trim().length > 0, 'recorded ingress grant required');
  const base = new URL(config.publicBase);
  check(base.protocol === 'https:' && base.pathname === '/' && !base.search && !base.hash && !base.username && !base.password
    && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'public https origin required (no path)');
  const origin = base.origin, rpId = base.hostname, publicBase = origin;
  const store = resolve(config.store), outbox = resolve(config.outbox), secret = join(store, 'private'), actsDir = join(store, 'acts');
  const storeStat = lstatSync(store);
  check(realpathSync(store) === store && storeStat.isDirectory() && storeStat.uid === config.operatorUid
    && (storeStat.mode & 0o022) === 0, 'surface store must be operator-owned and not writable by others');
  for (const directory of [secret, actsDir]) if (!existsSync(directory)) mkdirSync(directory, { mode: directory === secret ? 0o700 : 0o755 });
  chmodSync(actsDir, 0o755); privateDir(secret);
  const outboxStat = lstatSync(outbox);
  check(realpathSync(outbox) === outbox && outboxStat.isDirectory() && (outboxStat.mode & 0o022) === 0,
    'agent request outbox must be a directory only its owner can write');
  // The published description the runner reads: where the page is, whose it is. Never a secret the
  // agent lacks: the path token only keeps the page out of reach of people without the link.
  const described = existsSync(join(store, 'surface.json')) ? JSON.parse(readFileSync(join(store, 'surface.json'), 'utf8')) : null;
  const token = typeof described?.token === 'string' && /^[a-f0-9]{32}$/u.test(described.token) ? described.token : randomBytes(16).toString('hex');
  const surface = { type: 'PreviewApprovalSurface', schemaVersion: 1, publicBase, origin, rpId, operator: config.operator,
    token, ingressGrant: config.ingressGrant };
  if (canonical(described) !== canonical(surface)) replace(store, 'surface.json', canonical(surface), 0o644);
  if (!existsSync(join(store, 'keys.json'))) replace(store, 'keys.json', canonical([]), 0o644);
  const keys = () => JSON.parse(readFileSync(join(store, 'keys.json'), 'utf8'));
  const nonces = new Map(), enrolments = new Map();
  const remember = (map, key, value) => {
    for (const [k, item] of map) if (item.expiresAt <= now()) map.delete(k);
    check(map.size < SURFACE_LIMITS.maxNonces, 'too many approvals in progress; try again shortly');
    map.set(key, value);
  };
  const request = name => {
    check(/^[a-f0-9]{64}$/u.test(name), 'unknown request');
    const path = join(outbox, `${name}.request.json`), stat = lstatSync(path);
    check(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o022) === 0 && stat.size <= SURFACE_LIMITS.maxBody, 'unknown request');
    const record = JSON.parse(readFileSync(path, 'utf8'));
    const challenge = checkChallenge(record?.challenge, { operator: config.operator, maxLifetime: SURFACE_LIMITS.maxLifetime, now: now() });
    check(nameFor(challenge.id) === name, 'unknown request');
    return { name, challenge, view: renderChallenge(challenge, record.text),
      decided: existsSync(join(secret, `${name}.used`)) };
  };
  /** Pending requests, pull-first and bounded: the stop first, then the newest raises. */
  const pending = () => readdirSync(outbox).filter(file => /^[a-f0-9]{64}\.request\.json$/u.test(file)).slice(0, 4 * SURFACE_LIMITS.maxRequests)
    .flatMap(file => { try { return [request(file.slice(0, 64))]; } catch { return []; } })
    .filter(item => !item.decided).sort((a, b) => (a.view.kind === 'stop' ? 0 : 1) - (b.view.kind === 'stop' ? 0 : 1)
      || b.challenge.issuedAt - a.challenge.issuedAt).slice(0, SURFACE_LIMITS.maxRequests);
  const begin = ({ name, decision }) => {
    const item = request(name);
    check(!item.decided, 'already decided');
    check(decision === 'approve' || decision === 'decline' && item.view.decline !== null, 'decision invalid');
    const enrolled = keys();
    check(enrolled.length > 0, 'no passkey is enrolled for this page');
    const nonce = randomBytes(32).toString('hex');
    remember(nonces, nonce, { name, decision, expiresAt: now() + SURFACE_LIMITS.nonceMs });
    return { challenge: b64u(actChallenge(item.challenge, decision, nonce)), nonce, rpId, allow: enrolled.map(key => key.id) };
  };
  const act = ({ name, decision, nonce, assertion }) => {
    const started = nonces.get(nonce);
    check(typeof nonce === 'string' && started !== undefined && started.name === name && started.decision === decision
      && started.expiresAt > now(), 'this approval step expired; open the request again');
    nonces.delete(nonce);
    const item = request(name);
    verifyAssertion({ keys: keys(), origin, rpId, expected: actChallenge(item.challenge, decision, nonce), assertion });
    check(readdirSync(actsDir).length < SURFACE_LIMITS.maxActs, 'approval record capacity exhausted');
    // One use: the claim is durable before anything is published. A replay finds it and stops.
    try { writeOnce(secret, `${name}.used`, canonical({ challenge: item.challenge.id, decision })); }
    catch { throw Error('already decided'); }
    const record = { type: ACT_RECORD, schemaVersion: 1, challenge: item.challenge, decision, nonce, assertion, at: now() };
    writeOnce(actsDir, `${name}.json`, canonical(record), 0o644);
    return { recorded: true, message: item.view.kind === 'stop'
      ? 'Recorded: stop. The agent stops at its next check, normally within seconds.'
      : decision === 'approve' ? 'Recorded: approved. The agent applies it at its next check, normally within seconds, if nothing changed meanwhile.'
        : 'Recorded: declined. Nothing changes.' };
  };
  /** The operator's own host prints a one-use enrolment link; only its holder can add a passkey. */
  const enrol = () => {
    const code = randomBytes(24).toString('hex');
    writeOnce(secret, `enrol-${hex(code)}.json`, canonical({ expiresAt: now() + SURFACE_LIMITS.enrolmentMs }));
    return `${publicBase}/${token}/enrol#${code}`;
  };
  const enrolment = code => {
    check(typeof code === 'string' && /^[a-f0-9]{48}$/u.test(code), 'enrolment link invalid');
    const path = join(secret, `enrol-${hex(code)}.json`);
    check(existsSync(path) && !existsSync(join(secret, `enrol-${hex(code)}.used`))
      && JSON.parse(readFileSync(path, 'utf8')).expiresAt > now(), 'enrolment link expired or used');
    return code;
  };
  const enrolBegin = ({ code }) => {
    enrolment(code);
    const nonce = randomBytes(32);
    remember(enrolments, hex(code), { nonce, expiresAt: now() + SURFACE_LIMITS.nonceMs });
    return { challenge: b64u(nonce), rpId, user: { id: b64u(Buffer.from(config.operator)), name: config.operator } };
  };
  const enrolFinish = ({ code, registration }) => {
    enrolment(code);
    const started = enrolments.get(hex(code));
    check(started !== undefined && started.expiresAt > now(), 'enrolment step expired; open the link again');
    enrolments.delete(hex(code));
    const key = verifyRegistration({ origin, rpId, expected: started.nonce, registration });
    const enrolled = keys();
    check(enrolled.length < SURFACE_LIMITS.maxKeys && !enrolled.some(item => item.id === key.id), 'passkey capacity reached or already enrolled');
    writeOnce(secret, `enrol-${hex(code)}.used`, canonical({ key: key.id }));
    replace(store, 'keys.json', canonical([...enrolled, { ...key, enrolledAt: now() }]), 0o644);
    return { enrolled: true, message: 'This passkey can now approve requests on this page.' };
  };
  return Object.freeze({ surface, pending, request, begin, act, enrol, enrolBegin, enrolFinish, keys });
}

const escape = text => String(text).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const page = (title, body, token) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<style>body{font:18px/1.45 -apple-system,system-ui,sans-serif;margin:0 auto;max-width:36rem;padding:1.25rem}
h1{font-size:1.35rem}button{display:block;width:100%;font-size:1.15rem;padding:1rem;margin:.6rem 0;border-radius:.6rem;border:0}
.primary{background:#0b57d0;color:#fff}.secondary{background:#e8eaed;color:#111}p.note{color:#444}
a.row{display:block;padding:.9rem 0;border-bottom:1px solid #ddd;color:#0b57d0;text-decoration:none}#result{font-weight:600}</style>
</head><body>${body}<script src="/${token}/app.js"></script></body></html>`;
/** One request: its effect in plain words, the primary action first, no field the operator authors. */
export function renderRequestPage(item, token) {
  const actions = item.decided ? '<p id="result">Already decided.</p>' : `<button class="primary" data-name="${item.name}" data-decision="approve">${escape(item.view.approve)}</button>${
    item.view.decline === null ? '' : `<button class="secondary" data-name="${item.name}" data-decision="decline">${escape(item.view.decline)}</button>`}<p id="result" role="status"></p>`;
  return page(item.view.title, `<h1>${escape(item.view.title)}</h1><p>${escape(item.view.effect)}</p>${actions}
<p class="note">Your phone's passkey confirms it is you. Valid until ${escape(new Date(item.challenge.expiresAt).toUTCString())}.</p>
<p class="note"><a href="/${token}/">All requests</a></p>`, token);
}
export function renderIndexPage(items, token) {
  const rows = items.map(item => `<a class="row" href="/${token}/c/${item.name}">${escape(item.view.title)}</a>`).join('');
  return page('Approvals', `<h1>Approvals</h1>${rows || '<p>Nothing is waiting for you.</p>'}`, token);
}
const enrolPage = token => page('Add your passkey', '<h1>Add your passkey</h1><p>This lets your phone approve requests on this page. Your phone keeps the key; this page never sees it.</p><button class="primary" id="enrol">Add passkey</button><p id="result" role="status"></p>', token);
const APP = `(() => {
const b = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
const u = a => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
const base = location.pathname.split('/').slice(0, 2).join('/');
const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw Error(j.error || 'refused'); return j; };
const out = t => { document.getElementById('result').textContent = t; };
for (const button of document.querySelectorAll('button[data-name]')) button.addEventListener('click', async () => {
  try { const { name, decision } = button.dataset, start = await post('/begin', { name, decision });
    const c = await navigator.credentials.get({ publicKey: { challenge: b(start.challenge), rpId: start.rpId, userVerification: 'required',
      timeout: 120000, allowCredentials: start.allow.map(id => ({ type: 'public-key', id: b(id) })) } });
    const done = await post('/act', { name, decision, nonce: start.nonce, assertion: { credentialId: c.id,
      clientDataJSON: u(c.response.clientDataJSON), authenticatorData: u(c.response.authenticatorData), signature: u(c.response.signature) } });
    for (const other of document.querySelectorAll('button[data-name]')) other.disabled = true; out(done.message);
  } catch (e) { out('Not recorded: ' + e.message); } });
const enrol = document.getElementById('enrol');
if (enrol) enrol.addEventListener('click', async () => {
  try { const code = location.hash.slice(1), start = await post('/enrol/begin', { code });
    const c = await navigator.credentials.create({ publicKey: { challenge: b(start.challenge), rp: { id: start.rpId, name: 'Agent approvals' },
      user: { id: b(start.user.id), name: start.user.name, displayName: 'Operator' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' }, attestation: 'none', timeout: 120000 } });
    const done = await post('/enrol/finish', { code, registration: { id: c.id, alg: c.response.getPublicKeyAlgorithm(),
      publicKey: u(c.response.getPublicKey()), clientDataJSON: u(c.response.clientDataJSON), authenticatorData: u(c.response.getAuthenticatorData()) } });
    enrol.disabled = true; out(done.message);
  } catch (e) { out('Not added: ' + e.message); } });
})();`;
const HEADERS = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };

/** The surface's HTTP handling, transport-free so it is testable: every route lives under the path token. */
export function handle(surface, { method, path, body }) {
  const token = surface.surface.token, json = (status, value) => ({ status, headers: { ...HEADERS, 'content-type': 'application/json' }, body: JSON.stringify(value) });
  const html = text => ({ status: 200, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }, body: text });
  const parts = String(path).split('?')[0].split('/').filter(Boolean);
  if (parts[0] !== token) return json(404, { error: 'not found' });
  const route = `${method} /${parts.slice(1).join('/')}`;
  try {
    if (route === 'GET /') return html(renderIndexPage(surface.pending(), token));
    if (route === 'GET /app.js') return { status: 200, headers: { ...HEADERS, 'content-type': 'text/javascript' }, body: APP };
    if (method === 'GET' && parts[1] === 'c' && parts.length === 3) return html(renderRequestPage(surface.request(parts[2]), token));
    if (route === 'GET /enrol') return html(enrolPage(token));
    const input = JSON.parse(typeof body === 'string' && body.length <= SURFACE_LIMITS.maxBody ? body : 'null');
    check(input !== null && typeof input === 'object', 'request body required');
    if (route === 'POST /begin') return json(200, surface.begin(input));
    if (route === 'POST /act') return json(200, surface.act(input));
    if (route === 'POST /enrol/begin') return json(200, surface.enrolBegin(input));
    if (route === 'POST /enrol/finish') return json(200, surface.enrolFinish(input));
    return json(404, { error: 'not found' });
  } catch (error) { return json(400, { error: error instanceof Error ? error.message.slice(0, 200) : 'refused' }); }
}

export function serve(surface, port) {
  const server = createServer((req, res) => {
    let body = '', size = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => { size += chunk.length; if (size > SURFACE_LIMITS.maxBody) req.destroy(); else body += chunk; });
    req.on('end', () => { const out = handle(surface, { method: req.method, path: req.url, body });
      res.writeHead(out.status, out.headers); res.end(out.body); });
  });
  // Loopback only: the operator's recorded ingress (for example a named HTTPS tunnel) publishes it.
  server.listen(port, '127.0.0.1');
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, file] = process.argv.slice(2);
  check(['serve', 'enroll'].includes(command) && file, 'usage: approval-surface.mjs serve|enroll /ABS/config.json');
  const path = realpathSync(file), stat = lstatSync(path);
  check(stat.uid === process.getuid() && (stat.mode & 0o022) === 0, 'operator configuration ownership invalid');
  const config = JSON.parse(readFileSync(path, 'utf8')), surface = createApprovalSurface(config);
  if (command === 'enroll') process.stdout.write(`${surface.enrol()}\n`);
  else { check(Number.isSafeInteger(config.port) && config.port > 0 && config.port < 65536, 'port required'); serve(surface, config.port);
    process.stdout.write(`approval surface for ${config.operator} at ${surface.surface.publicBase}/${surface.surface.token}/\n`); }
}
