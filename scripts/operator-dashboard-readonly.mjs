const escape = value => String(value).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { attentionPage, attentionCsrf, attentionReceipt } from './operator-attention.mjs';
// The authority dashboard, READ-ONLY for approval, served by the agent's own runner (Rules 79, 81; plan #502; tests/preview/README.md
// "The operator dashboard"). It renders the same views from the same module and the same snapshot as the approval page
// (scripts/operator-dashboard.mjs), but it has no approval port behind it: it lists open requests with their existing
// links (the GitHub review, or the chat) and says how to stop, and it approves, declines and stops nothing. So it changes
// no safeguard, and the agent serving it administers none (Purpose: the agent never administers its own safeguards).
//
// Its sign-in is the operator's EXISTING dashboard PIN: checked by the server that already holds it (an injected loopback
// endpoint; for an Instar 1.x host, `POST /dashboard/unlock`), or, on an installation with no such host (row 89: the real
// installed mobile path), against the operator's own PIN file with the 1.x unlock's exact comparison, so there is no new
// credential either way. Nothing from the agent shows
// before that sign-in (Purpose: least revelation; the audience is the verified operator). It listens on loopback or on
// this machine's private Tailscale address only, so there is no new public ingress (Purpose: nothing outward by default).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { isIPv4 } from 'node:net';
import { check } from './approval-surface-core.mjs';
import { DASHBOARD_BOUNDS, DASHBOARD_VIEWS, DETAIL_PATH, dashboardPath, renderDashboard, renderPinSignIn } from './operator-dashboard.mjs';

export const READ_ONLY_COOKIE = 'instar_dashboard_ro';
/** Finite bounds (Rule 60): sessions held, failed sign-ins per window, request body, PIN length, the PIN check's wait. */
export const READ_ONLY_LIMITS = Object.freeze({ sessions: 64, failures: 5, failureWindowMs: 300_000, bodyBytes: 1024, pinChars: 64,
  pinCheckMs: 5000, connections: 32 });
const HEADERS = Object.freeze({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
const NOTICE = Object.freeze({ refused: 'That PIN was not accepted. Try again.',
  locked: 'Too many tries. Wait five minutes, then try again.',
  unavailable: 'Your PIN could not be checked just now. Try again in a minute.' });

/** Nothing outward by default: loopback, or this machine's address on the operator's private Tailscale network
 * (100.64.0.0/10). A wildcard or public address would be an inbound public endpoint, which needs a recorded ingress grant. */
export function checkListen(value) {
  const match = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/u.exec(String(value));
  check(match !== null, 'dashboard listen address must be IPv4-HOST:PORT');
  const host = match[1], port = Number(match[2]), [a, b] = host.split('.').map(Number);
  check(isIPv4(host) && port < 65536, 'dashboard listen address invalid');
  check(host === '127.0.0.1' || a === 100 && b >= 64 && b <= 127,
    'the read-only dashboard listens on loopback or a Tailscale address only (nothing outward by default)');
  return { host, port };
}

/** The operator's existing sign-in. Given an absolute path, it is the operator's PIN file on this machine (`pinCheckFile`);
 * given a URL, a loopback endpoint that answers 200 for the operator's PIN and refuses anything else. Either way the PIN
 * never leaves this machine, and an endpoint's answer body is never read (an Instar 1.x unlock answer carries a token). */
export function pinCheckAt(url, fetchImpl = fetch) {
  if (typeof url === 'string' && url.startsWith('/')) return pinCheckFile(url);
  const target = new URL(url);
  check(target.protocol === 'http:' && target.hostname === '127.0.0.1' && !target.username && !target.password && !target.search && !target.hash,
    'the dashboard PIN check must be a loopback http address');
  return async pin => {
    const response = await fetchImpl(target, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }),
      redirect: 'error', signal: AbortSignal.timeout(READ_ONLY_LIMITS.pinCheckMs) });
    await response.body?.cancel();
    return response.status === 200;
  };
}

/** Carried from Instar 1.x `POST /dashboard/unlock` (src/server/AgentServer.ts 1256-1300 at f3f94826a): the PIN is compared
 * as the SHA-256 of each side under `timingSafeEqual`, and a host with no PIN configured answers "not yet available" (503),
 * never a refusal. The file takes the place of 1.x's `dashboardPin` configuration value and is read on every check, as 1.x
 * read its configuration at request time, so a changed PIN applies without a restart. It must be a regular file, not a link,
 * closed to other local accounts, holding the PIN on one line. A missing, empty, open or oversized file makes sign-in
 * unavailable, not open: nothing from the agent shows. The five-tries-in-five-minutes pause is the caller's (createReadOnlyDashboard). */
export function pinCheckFile(path) {
  check(typeof path === 'string' && path.startsWith('/') && !path.includes('\0'), 'the dashboard PIN file must be an absolute path');
  return async pin => {
    const stat = lstatSync(path);
    check(realpathSync(path) === path && stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o007) === 0
      && stat.size > 0 && stat.size <= READ_ONLY_LIMITS.pinChars + 2, 'dashboard PIN file unusable');
    const expected = readFileSync(path, 'utf8').replace(/\r?\n$/u, '');
    check(expected.length > 0 && expected.length <= READ_ONLY_LIMITS.pinChars && !/[\r\n]/u.test(expected), 'dashboard PIN file unusable');
    const ha = createHash('sha256').update(pin).digest(), hb = createHash('sha256').update(expected).digest();
    return timingSafeEqual(ha, hb);
  };
}

const sessionOf = cookie => String(cookie ?? '').split(';').map(part => part.trim().split('='))
  .find(([name]) => name === READ_ONLY_COOKIE)?.[1];
const digest = value => createHash('sha256').update(value).digest('hex');

/** `state()` returns the page state of the runner's latest snapshot (`snapshotState`, or `{ kind: 'missing' }`);
 * `checkPin(pin)` resolves true only for the operator's PIN. A session is a random value held hashed in memory for 30
 * minutes (at most 64); a runner restart signs everyone out. Five failed sign-ins in five minutes pause sign-in, and PIN
 * checks still in flight count against the same five, so overlapping requests never reach the verifier more than five at once. */
export function createReadOnlyDashboard({ state, checkPin, attention, collaboration, now = () => Date.now() }) {
  check(typeof state === 'function' && typeof checkPin === 'function', 'read-only dashboard needs a state and a PIN check');
  const sessions = new Map(), failures = [];
  let pending = 0; // PIN checks in flight: each holds an admission slot until it settles (Rule 60: bounded concurrent work)
  const prune = () => {
    for (const [key, expiresAt] of sessions) if (expiresAt <= now()) sessions.delete(key);
    while (failures.length && failures[0] <= now() - READ_ONLY_LIMITS.failureWindowMs) failures.shift();
  };
  const signedIn = cookie => { const value = sessionOf(cookie);
    return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) && (sessions.get(digest(value)) ?? 0) > now(); };
  const signIn = async pin => {
    prune();
    if (failures.length + pending >= READ_ONLY_LIMITS.failures) return { kind: 'locked' };
    if (typeof pin !== 'string' || pin.length === 0 || pin.length > READ_ONLY_LIMITS.pinChars) { failures.push(now()); return { kind: 'refused' }; }
    let accepted;
    pending += 1; // reserved synchronously, before the await, so overlapping requests cannot all reach the verifier
    try { accepted = await checkPin(pin) === true; } catch { return { kind: 'unavailable' }; } finally { pending -= 1; }
    if (!accepted) { failures.push(now()); return { kind: 'refused' }; }
    while (sessions.size >= READ_ONLY_LIMITS.sessions) sessions.delete(sessions.keys().next().value);
    const session = randomBytes(32).toString('hex');
    sessions.set(digest(session), now() + DASHBOARD_BOUNDS.sessionMs);
    return { kind: 'ok', session };
  };
  return Object.freeze({ state, signedIn, signIn, attention, collaboration });
}

const html = (status, body) => ({ status, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }, body });
const notFound = () => ({ status: 404, headers: { ...HEADERS, 'content-type': 'application/json' }, body: JSON.stringify({ error: 'not found' }) });

/** The page's views, transport-free so they are testable: synchronous, for every GET. Without the session every view is
 * the sign-in page (401) and nothing from the agent. There is no approval, decision or stop route at all. */
export function readOnlyView(dash, { path, cookie }) {
  const parts = String(path).split('?')[0].split('/').filter(Boolean);
  if (parts[0] !== 'dashboard' || parts.length > 3) return notFound();
  if (!dash.signedIn(cookie)) return html(401, renderPinSignIn(null));
  if (parts.length === 2 && parts[1] === 'collaboration' && dash.collaboration)
    return html(200, collaborationPage(dash.collaboration.list(), attentionCsrf(sessionOf(cookie))));
  if (parts.length === 2 && parts[1] === 'attention' && dash.attention)
    return html(200, attentionPage(dash.attention.list(), attentionCsrf(sessionOf(cookie)), '', Number(new URL(String(path), 'http://dashboard.invalid').searchParams.get('offset') ?? 0)));
  const view = parts.length === 1 ? 'overview' : parts.slice(1).join('/');
  const known = view === 'overview' || DASHBOARD_VIEWS.some(item => item.path === view) || DETAIL_PATH.test(view);
  const rendered = renderDashboard({ token: null, view, state: dash.state(), pending: [], readOnly: true });
  const navigation = `${dash.attention ? '<a href="/dashboard/attention">Attention</a> ' : ''}${dash.collaboration ? '<a href="/dashboard/collaboration">Collaborations</a>' : ''}`;
  return html(known ? 200 : 404, rendered.replace('<main', `${navigation}<main`));
}

/** GET views, PIN sign-in, and authenticated Attention tracking forms. Sign-in
 * answers with a session cookie scoped to the dashboard and a front-page redirect. */
export async function handleReadOnly(dash, { method, path, body, cookie }) {
  if (method === 'GET') return readOnlyView(dash, { path, cookie });
  if (method === 'POST' && path === '/dashboard/collaboration' && dash.collaboration) {
    if (!dash.signedIn(cookie)) return html(401, renderPinSignIn(null));
    const form = new URLSearchParams(typeof body === 'string' && body.length <= READ_ONLY_LIMITS.bodyBytes ? body : '');
    if (form.get('csrf') !== attentionCsrf(sessionOf(cookie))) return html(403, 'The form expired. Reload.');
    const threadId = form.get('threadId') || undefined, targetTopicId = Number(form.get('targetTopicId'));
    try {
      const result = await dash.collaboration.bind({ threadId, targetTopicId }, attentionReceipt(sessionOf(cookie), [threadId, targetTopicId]));
      return html(result.ok ? 200 : result.status, collaborationPage(dash.collaboration.list(), attentionCsrf(sessionOf(cookie)),
        result.ok ? result.outcome === 'bound' ? 'Conversation bound.' : 'Binding saved; confirmation pending.' : result.error));
    } catch { return html(409, 'Binding refused. Reload the conversation and try again.'); }
  }
  if (method === 'POST' && path === '/dashboard/attention' && dash.attention) {
    if (!dash.signedIn(cookie)) return html(401, renderPinSignIn(null));
    const form = new URLSearchParams(typeof body === 'string' && body.length <= READ_ONLY_LIMITS.bodyBytes ? body : '');
    const csrf = attentionCsrf(sessionOf(cookie));
    if (form.get('csrf') !== csrf) return html(403, 'The form expired. Reload Attention.');
    const id = form.get('id'), title = form.get('title'), status = form.get('status'), revision = Number(form.get('revision'));
    try {
      const requestId = form.get('requestId');
      if (!id && !/^[a-f0-9]{32}$/u.test(requestId ?? '')) throw Error('attention creation receipt required');
      const receipt = attentionReceipt(sessionOf(cookie), [id, title, status, revision, requestId]);
      const result = id ? await dash.attention.acknowledge(id, status, revision, receipt) : await dash.attention.create(title, receipt);
      if (result.outcome === 'confirmation-required') {
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || url.username || url.password) throw Error('invalid operator surface link');
        return html(200, `<p>Confirm the tracking status on your independent operator page.</p><a href="${escape(result.url)}">Record tracking status</a>`);
      }
      return html(200, attentionPage(dash.attention.list(), csrf, result.outcome === 'pending'
        ? 'Saved locally; confirmation is pending.' : result.outcome === 'saved' || result.outcome === 'delivered'
          ? 'Saved.' : `Acknowledgement ${result.outcome}. Reload to check the item.`));
    } catch { return html(409, attentionPage(dash.attention.list(), csrf, 'Could not save. The item, ownership or allowance may have changed. Reload and try again.')); }
  }
  if (method !== 'POST' || String(path).split('?')[0] !== dashboardPath(null, 'sign-in')) return notFound();
  const form = new URLSearchParams(typeof body === 'string' && body.length <= READ_ONLY_LIMITS.bodyBytes ? body : '');
  const result = await dash.signIn(form.get('pin') ?? undefined);
  if (result.kind !== 'ok') return html(result.kind === 'locked' ? 429 : result.kind === 'unavailable' ? 503 : 401,
    renderPinSignIn(null, NOTICE[result.kind]));
  return { status: 303, body: '', headers: { ...HEADERS, location: dashboardPath(null),
    'set-cookie': `${READ_ONLY_COOKIE}=${result.session}; Path=${dashboardPath(null)}; HttpOnly; SameSite=Strict; Max-Age=${DASHBOARD_BOUNDS.sessionMs / 1000}` } };
}

/** Listens on the checked address. The caller owns the returned server (its `error` event and its close). */
export function serveReadOnly(dash, listen) {
  const { host, port } = checkListen(listen);
  const server = createServer((req, res) => {
    let body = '', size = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => { size += chunk.length; if (size > READ_ONLY_LIMITS.bodyBytes) req.destroy(); else body += chunk; });
    req.on('end', () => {
      handleReadOnly(dash, { method: req.method, path: req.url, body, cookie: req.headers.cookie })
        .catch(() => notFound())
        .then(out => { res.writeHead(out.status, out.headers); res.end(out.body); });
    });
  });
  server.maxConnections = READ_ONLY_LIMITS.connections;
  server.listen(port, host);
  return server;
}

function collaborationPage(snapshot, csrf, message = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collaborations</title></head><body><main>
<h1>Collaborations</h1><p>Bind a retained conversation to an existing topic.</p><p>${escape(message)}</p>
${snapshot.threads.slice(-100).map(thread => `<article><h2>${escape(thread.peerName)}</h2><p>${escape(thread.subject)}</p>
<form method="post" action="/dashboard/collaboration"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="threadId" value="${escape(thread.threadId)}">
<label>Topic<select name="targetTopicId">${snapshot.topics.map(topic => `<option value="${topic.topicId}">${escape(topic.topicName)}</option>`).join('')}</select></label><button>Bind conversation</button></form></article>`).join('')}
<a href="/dashboard">Your agent</a></main></body></html>`;
}
