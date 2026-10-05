// Rule 81 (live-proof group Q, check Q81): the operator dashboard's eleven floors, checked on THIS tree's own code. Run
// from a tree's root:   node scripts/check-dashboard-floors.mjs   (prints one JSON object; exit 0 only when all hold)
// It builds a throwaway approval page in a temporary directory, enrols a fixture passkey (the real WebAuthn wire shape),
// signs in through the page's real routes, and renders every view in six states from recorded live shapes
// (tests/fixtures/dashboard-recorded-shapes.json): full, empty, missing, unreadable, stale and stopped. Each floor is a
// pure check over the rendered pages, and each has a negative control that must turn it red (the 1.x #1403 pattern),
// plus population counts so a matcher that silently matches nothing fails loudly. It also checks that nothing is
// exposed without the operator's passkey. The runner's READ-ONLY page (scripts/operator-dashboard-readonly.mjs, plan #502)
// is crawled the same way behind its PIN sign-in: the same floors must hold on it, nothing shows without its session, and
// it has no approval route. It reads nothing from any live root and sends nothing.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { actChallenge, canonical } from './approval-surface-core.mjs';
import { createApprovalSurface, DASHBOARD_APP, handle, serve } from './approval-surface.mjs';
import { DASHBOARD_BOUNDS, DASHBOARD_FILE, DASHBOARD_STYLE, DASHBOARD_VIEWS, snapshotState } from './operator-dashboard.mjs';
import { checkListen, createReadOnlyDashboard, handleReadOnly, pinCheckAt, READ_ONLY_LIMITS, readOnlyView, serveReadOnly } from './operator-dashboard-readonly.mjs';
import { createApprovalSurfaceClient } from '../tests/preview/approval-surface-client.mjs';

export const FLOORS = Object.freeze({
  F1: 'every page has one content panel spanning the column, no sidebar, and nothing collapsed',
  F2: 'every registered view is reachable from every page at every width (a wrapping menu, never a clipped bar)',
  F3: 'every page carries a plain-language purpose line',
  F4: 'the page never scrolls sideways on a phone (device-width viewport, wrapping text, nothing fixed wider than a phone)',
  F5: 'every control is labeled',
  F6: 'empty, missing, unreadable and stale states each say plainly what is going on, with no raw error text',
  F7: 'one shared stylesheet and class vocabulary; no per-page inline styles',
  F8: 'every page link and asset resolves',
  F9: 'nothing refreshes in the background, so an open interaction is never clobbered',
  F10: 'the front page is one plain headline and at most five tiles, within 150 words, with no insider vocabulary',
  F11: 'every tile and row is a link that opens the next layer; no dead-end summaries',
});

const visible = html => html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>|<title>[\s\S]*?<\/title>/gu, ' ')
  .replace(/<[^>]+>/gu, ' ').replace(/&#39;/gu, "'").replace(/&quot;/gu, '"').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>')
  .replace(/&amp;/gu, '&').replace(/\s+/gu, ' ').trim();
const words = text => text ? text.split(' ').length : 0;
const hrefs = html => [...html.matchAll(/\b(?:href|src)="([^"]*)"/gu)].map(match => match[1].replace(/&amp;/gu, '&'));
const cssRule = (css, selector) => css.match(new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')}\\{([^}]*)\\}`, 'u'))?.[1] ?? '';
const EXTERNAL = [/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*\/files$/u, /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/u];
const JARGON = /sha256|\bjournal\b|\bcursor\b|snapshot|\bjson\b|\btoken\b|challenge|\bconfig|\bupdates? \d|\b[0-9a-f]{12,}\b|\b\w+_\w+\b|\b[a-z]+[A-Z]\w*\b|\b\d+\s?ms\b|\bnull\b|\bundefined\b/u;
/** What every view of each lost state must say (scripts/operator-dashboard.mjs). */
const NOTICE = { stale: 'Last updated by your agent', missing: 'has not shared its status here yet', invalid: 'latest status could not be read' };
const RAW_ERROR = /\bundefined\b|\bNaN\b|\[object |Error:|\bnull\b|SyntaxError|ENOENT/u;
/** A sign-in page's one allowed field: the operator's existing PIN, a password field a <label for> names. */
const PIN_FIELD = /<input\b[^>]*\btype="password"[^>]*>/u, PIN_FIELDS = new RegExp(PIN_FIELD.source, 'gu');
const labeled = (html, field) => { const id = field.match(/\bid="([\w-]+)"/u)?.[1];
  return id !== undefined && new RegExp(`<label\\b[^>]*\\bfor="${id}"[^>]*>[^<]*\\S[^<]*</label>`, 'u').test(html); };

/** The eleven floors over a set of rendered pages. `pages`: { state, path, status, html, front, signIn }; `fetch(path)`
 * renders a same-origin path with the session; `states` maps each special state to its overview page. */
export function floorVerdicts({ pages, fetch, states, script = DASHBOARD_APP, style = DASHBOARD_STYLE }) {
  const inside = pages.filter(item => !item.signIn), fail = [];
  const verdict = (id, problems, detail) => ({ pass: problems.length === 0, detail: problems.length ? problems.slice(0, 5).join('; ') : detail });
  const each = (id, test) => inside.flatMap(item => { const problem = test(item); return problem ? [`${item.state} ${item.path}: ${problem}`] : []; });
  const out = {};
  const panel = cssRule(style, '.panel');
  out.F1 = verdict('F1', [...each('F1', ({ html }) => (html.match(/<main class="panel">/gu) ?? []).length !== 1 ? 'not exactly one content panel'
    : /<aside|<details|<summary|\shidden[\s>=]|display:\s*none|visibility:\s*hidden/iu.test(html) ? 'something is collapsed or placed aside' : null),
  ...(/float|grid-column|position:\s*(?:absolute|fixed)|width:\s*\d+px/u.test(panel) ? ['the panel is placed or sized outside the column'] : [])],
  `${inside.length} pages: one full-width panel each, nothing collapsed`);
  const views = DASHBOARD_VIEWS.map(view => view.path);
  out.F2 = verdict('F2', [...each('F2', ({ html }) => {
    const nav = html.match(/<nav class="views"[^>]*>([\s\S]*?)<\/nav>/u)?.[1];
    if (!nav) return 'no navigation';
    const targets = hrefs(nav).map(href => href.replace(/^(?:\/[a-f0-9]{32})?\/dashboard\/?/u, ''));
    return views.every(path => targets.includes(path)) && targets.length === views.length ? null : 'a registered view is missing from the navigation';
  }), ...(/flex-wrap:\s*wrap/u.test(cssRule(style, '.views')) ? [] : ['the navigation does not wrap']),
  ...(/nowrap|overflow(?:-x)?:\s*(?:hidden|scroll|auto)/u.test(cssRule(style, '.views')) ? ['the navigation clips'] : [])],
  `${views.length} views linked from every page in a wrapping menu`);
  out.F3 = verdict('F3', each('F3', ({ html }) => { const line = html.match(/<p class="purpose">([^<]*)<\/p>/u)?.[1];
    return !line ? 'no purpose line' : words(visible(line)) < 4 || words(visible(line)) > 40 ? 'purpose line is not one plain sentence' : null; }),
  'every page states its purpose in one plain sentence');
  const wide = [...style.matchAll(/(?:^|[;{\n])\s*(?:min-)?width:\s*(\d+)px/gu)].filter(match => Number(match[1]) > 360);
  out.F4 = verdict('F4', [...pages.flatMap(({ state, path, html }) => !/<meta name="viewport" content="width=device-width/u.test(html)
    ? [`${state} ${path}: no device-width viewport`] : /<table|<pre[\s>]/u.test(html) ? [`${state} ${path}: a table or preformatted block`] : []),
  ...(/overflow-wrap:\s*anywhere/u.test(cssRule(style, 'body')) ? [] : ['long words do not wrap']),
  ...(/nowrap/u.test(style) ? ['text is told not to wrap'] : []), ...wide.map(match => `fixed width ${match[1]}px`)],
  'device-width viewport, wrapping text, nothing fixed wider than a phone');
  out.F5 = verdict('F5', pages.flatMap(({ state, path, html, signIn }) => [
    ...[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gu)].filter(([, attrs, body]) => !/href="[^"]+"/u.test(attrs)
      || !visible(body) && !/aria-label="[^"]+"/u.test(attrs)).map(() => `${state} ${path}: an unlabeled link`),
    ...[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)].filter(([, attrs, body]) => !visible(body) && !/aria-label="[^"]+"/u.test(attrs))
      .map(() => `${state} ${path}: an unlabeled button`),
    ...[...html.matchAll(/<meter\b([^>]*)>/gu)].filter(([, attrs]) => !/aria-label="[^"]+"/u.test(attrs)).map(() => `${state} ${path}: an unlabeled meter`),
    ...(/<input|<select|<textarea|contenteditable/iu.test(signIn ? html.replace(PIN_FIELDS, '') : html) ? [`${state} ${path}: a field the operator would have to author`] : []),
    ...(signIn ? [...html.matchAll(/<input\b[^>]*>/gu)].filter(([field]) => !PIN_FIELD.test(field) || !labeled(html, field))
      .map(() => `${state} ${path}: an unlabeled sign-in field`) : [])]),
  'every link, button, meter and sign-in field is labeled; no field to author');
  const expected = { missing: 'has not shared its status', invalid: 'could not be read', stale: 'has not updated this page for' };
  out.F6 = verdict('F6', [...Object.entries(expected).flatMap(([state, phrase]) => !states[state] ? [`${state}: not rendered`]
    : visible(states[state]).includes(phrase) ? [] : [`${state}: the page does not say plainly what is going on`]),
  // The loss detector is on every view, detail pages included: each page of a stale, missing or unreadable state says so.
  ...inside.filter(item => NOTICE[item.state]).flatMap(({ state, path, html }) => visible(html).includes(NOTICE[state]) ? []
    : [`${state} ${path}: this view does not say the status is ${state}`]),
  ...(visible(states.emptyWaiting ?? '').includes('Nothing is waiting for you.') ? [] : ['empty: the waiting list does not say it is empty']),
  ...(visible(states.emptyMessages ?? '').includes('No messages yet') ? [] : ['empty: the message list does not say it is empty']),
  ...pages.flatMap(({ state, path, html }) => RAW_ERROR.test(visible(html)) ? [`${state} ${path}: raw error text`] : [])],
  'missing, unreadable, stale and empty states each say plainly what is going on');
  const defined = new Set([...style.matchAll(/\.([a-z][\w-]*)/gu)].map(match => match[1]));
  out.F7 = verdict('F7', pages.flatMap(({ state, path, html }) => {
    const sheets = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gu)].map(match => match[1]);
    const used = [...html.matchAll(/class="([^"]*)"/gu)].flatMap(match => match[1].split(/\s+/u)).filter(Boolean);
    return [...(/\sstyle="/u.test(html) ? [`${state} ${path}: an inline style`] : []),
      ...(sheets.length !== 1 || sheets[0] !== style ? [`${state} ${path}: not the one shared stylesheet`] : []),
      ...used.filter(name => !defined.has(name)).map(name => `${state} ${path}: class ${name} is not in the shared vocabulary`)];
  }), `one shared stylesheet of ${defined.size} classes; no inline styles`);
  const local = inside.flatMap(item => hrefs(item.html).filter(href => href.startsWith('/')).map(href => [item, href]));
  out.F8 = verdict('F8', local.flatMap(([item, href]) => { const status = fetch(href, true);
    return status === 200 ? [] : [`${item.state} ${item.path}: ${href} answers ${status}`]; }), `${local.length} page links and assets resolve`);
  out.F9 = verdict('F9', [...pages.flatMap(({ state, path, html, signIn }) => [
    ...(/http-equiv="refresh"/iu.test(html) ? [`${state} ${path}: refreshes itself`] : []),
    ...(/<script(?![^>]*\ssrc=)[^>]*>/u.test(html) ? [`${state} ${path}: inline script`] : []),
    ...(!signIn && /<script/u.test(html) ? [`${state} ${path}: a signed-in page runs a script`] : [])]),
  ...(/setInterval|setTimeout|requestAnimationFrame|EventSource|WebSocket/u.test(script) ? ['the page script polls'] : [])],
  'no page refreshes or polls; a signed-in page runs no script at all');
  const fronts = inside.filter(item => item.front);
  out.F10 = verdict('F10', [...fronts.flatMap(({ state, html }) => { const text = visible(html), tiles = (html.match(/class="tile[" ]/gu) ?? []).length;
    return [...(words(text) > 150 ? [`${state}: ${words(text)} words`] : []), ...(tiles > 5 || tiles === 0 ? [`${state}: ${tiles} tiles`] : []),
      ...((html.match(/class="headline"/gu) ?? []).length !== 1 ? [`${state}: not one headline`] : []),
      ...(JARGON.test(text) ? [`${state}: insider vocabulary "${text.match(JARGON)[0]}"`] : [])]; }),
  ...(fronts.length === 0 ? ['no front page rendered'] : [])], `${fronts.length} front pages within 150 words and five tiles`);
  const drills = inside.flatMap(item => [...item.html.matchAll(/<(\w+)\b[^>]*class="(?:tile|row)[" ][^>]*>/gu)].map(match => [item, match[0], match[1]]));
  out.F11 = verdict('F11', [...drills.flatMap(([item, tag, name]) => {
    const href = tag.match(/href="([^"]*)"/u)?.[1]?.replace(/&amp;/gu, '&');
    if (name !== 'a' || !href) return [`${item.state} ${item.path}: a tile or row that is not a link`];
    if (!href.startsWith('/')) return EXTERNAL.some(shape => shape.test(href)) ? [] : [`${item.state} ${item.path}: ${href} is not an allowed destination`];
    // The next layer is a dashboard page with content, or the request's own approval page (which renders its own wording).
    const target = fetch(href), approvalPage = /^\/[a-f0-9]{32}\/c\/[a-f0-9]{64}$/u.test(href);
    return fetch(href, true) === 200 && (approvalPage ? /<h1>/u.test(target) && /<button/u.test(target) : /<main class="panel">/u.test(target))
      && !/id="signin"/u.test(target) && !/That page does not exist/u.test(target) ? [] : [`${item.state} ${item.path}: ${href} opens no next layer`];
  }), ...(drills.length === 0 ? ['no tiles or rows rendered'] : [])], `${drills.length} tiles and rows each open their next layer`);
  return { verdicts: out, fail };
}

/** A phone passkey stand-in that emits the WebAuthn wire shape; the page and runner never hold its private key. */
function authenticator(origin, rpId) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }), id = randomBytes(16);
  const b64u = bytes => Buffer.from(bytes).toString('base64url'), sha = bytes => createHash('sha256').update(bytes).digest();
  return {
    create(challenge) {
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const auth = Buffer.concat([sha(rpId), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, Buffer.from([0xa0])]);
      return { id: b64u(id), alg: -7, publicKey: b64u(publicKey.export({ format: 'der', type: 'spki' })),
        clientDataJSON: b64u(Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin, crossOrigin: false }))), authenticatorData: b64u(auth) };
    },
    get(challenge, override = {}) {
      const data = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: override.origin ?? origin, crossOrigin: false }));
      const auth = Buffer.concat([sha(rpId), Buffer.from([0x05]), Buffer.alloc(4)]);
      return { credentialId: b64u(id), clientDataJSON: b64u(data), authenticatorData: b64u(auth),
        signature: b64u(sign('sha256', Buffer.concat([auth, sha(data)]), override.key ?? privateKey)) };
    } };
}

const ORIGIN = 'https://approvals.example.org', RP = 'approvals.example.org';
/** The recorded shared-access disclosure (src/decode/explicit-yes.ts SHARED_ACCESS_NOTE), as a fixture. */
const SHARED_ACCESS_FIXTURE = 'I can also use that account, so the account alone does not show who approved';
const RAISE_TEXT = 'Approve raising the model call allowance from 16 to 32? That adds 16 model calls I may spend in this trial.';
/** The snapshot shapes the six states render, built from recorded live shapes. */
export function fixtureSnapshots(recorded, now) {
  const status = recorded.statusLong.text.split('\n').slice(0, DASHBOARD_BOUNDS.statusLines);
  const row = recorded.operatorRequests.rows[0];
  const full = { type: 'PreviewOperatorDashboard', schemaVersion: 1, asOf: now - 20_000, zone: 'America/Los_Angeles', state: 'running',
    until: '2026-10-12 13:40', status, counts: { turnsToday: 196, held: 1, waiting: 1 },
    allowance: [{ label: 'Model calls', used: 19, max: 1000 }, { label: 'Replies', used: 13, max: 1000 },
      { label: 'Messages taken', used: 14, max: 1000 }, { label: 'Reply checks', used: 13, max: 1000 }],
    tokens: { input: 1834012, output: 20412, unknownCalls: 0 },
    requests: [{ title: "Let me continue past this trial's allowance", state: 'Waiting for your answer', open: row.state === 'open',
      route: row.route, link: row.link, sharedAccess: null }, { title: 'Extend this trial', state: 'Approved and done', open: false, route: 'chat', link: null,
      sharedAccess: { account: 'github:operator', disclosure: SHARED_ACCESS_FIXTURE } }],
    turns: recorded.turns.map((turn, index) => ({ update: turn.update, time: `2026-10-0${index + 1} 14:0${index}`, from: 'you',
      message: turn.message.slice(0, DASHBOARD_BOUNDS.textChars), reply: turn.reply.slice(0, DASHBOARD_BOUNDS.textChars),
      state: index === 1 ? 'Held: summary faithfulness: full-context review found loss' : 'Answered' })),
    chat: 'example_agent_bot' };
  return { full, empty: { ...full, status: recorded.statusNormal.text.split('\n'), counts: { turnsToday: 0, held: 0, waiting: 0 }, requests: [], turns: [] },
    stale: { ...full, asOf: now - 7 * 60_000 }, stopped: { ...full, state: 'stopped' },
    invalid: { ...full, requests: [{ ...full.requests[0], link: 'https://approvals.example.org.evil.test/pull/1/files' }] } };
}

/** Population: enough pages, front pages, tiles and rows that a matcher matching nothing fails loudly. */
const counted = list => ({ pages: list.length, fronts: list.filter(item => item.front).length,
  tiles: list.reduce((n, item) => n + (item.html.match(/class="tile[" ]/gu) ?? []).length, 0),
  rows: list.reduce((n, item) => n + (item.html.match(/class="row"/gu) ?? []).length, 0) });
const enough = count => count.pages >= 40 && count.fronts === 6 && count.tiles >= 20 && count.rows >= 8;
const FIXTURE_PIN = '246810';
/** The read-only page over the same six states: its floors, its population, and its exposure checks (nothing without the
 * PIN session; a wrong PIN, a forged or expired session, a paused or failed PIN check open nothing; no approval route;
 * loopback or Tailscale only; the PIN check stays on loopback). */
async function readOnlyChecks({ fixtures, recorded, secret, statusLine, shown }) {
  let clock = 1_790_900_000_000, text = null;
  const make = checkPin => createReadOnlyDashboard({ checkPin, now: () => clock,
    state: () => text === null ? { kind: 'missing' } : snapshotState(text, clock) });
  const dash = make(async pin => pin === FIXTURE_PIN);
  const post = (target, body) => handleReadOnly(target, { method: 'POST', path: '/dashboard/sign-in', body });
  const signIn = async (pin, target = dash) => { const out = await post(target, new URLSearchParams({ pin }).toString());
    return { out, cookie: out.headers['set-cookie']?.split(';')[0] }; };
  const first = await signIn(FIXTURE_PIN), session = first.cookie;
  const get = (path, cookie = session) => readOnlyView(dash, { path, cookie });
  const pages = [], states = {}, seen = new Set();
  const crawl = (state, path, front = false) => {
    const key = `${state} ${path}`;
    if (seen.has(key) || pages.length > 400) return;
    seen.add(key);
    const out = get(path);
    pages.push({ state, path, status: out.status, html: out.body, front });
    for (const href of hrefs(out.body)) if (href.startsWith('/dashboard/') && out.status === 200) crawl(state, href);
  };
  for (const [state, snapshot] of [['empty', fixtures.empty], ['full', fixtures.full], ['missing', null], ['invalid', fixtures.invalid],
    ['stale', fixtures.stale], ['stopped', fixtures.stopped]]) {
    text = snapshot === null ? null : canonical(snapshot);
    crawl(state, '/dashboard', true);
    for (const view of DASHBOARD_VIEWS) crawl(state, `/dashboard${view.path ? `/${view.path}` : ''}`);
    states[state] = pages.find(item => item.state === state && item.front).html;
  }
  const pageOf = (state, view) => pages.find(item => item.state === state && item.path === `/dashboard/${view}`)?.html;
  states.emptyWaiting = pageOf('empty', 'waiting'); states.emptyMessages = pageOf('empty', 'messages');
  const signInPage = get('/dashboard', null);
  pages.push({ state: 'signed-out', path: '/dashboard', status: signInPage.status, html: signInPage.body, signIn: true });
  text = canonical(fixtures.full);
  const { verdicts } = floorVerdicts({ pages, fetch: (path, statusOnly) => { const out = get(path); return statusOnly ? out.status : out.body; },
    states, script: '' });
  const population = counted(pages);
  population.ok = enough(population);

  const signedOut = DASHBOARD_VIEWS.map(view => get(`/dashboard${view.path ? `/${view.path}` : ''}`, null));
  const forged = get('/dashboard', `instar_dashboard_ro=${randomBytes(32).toString('hex')}`);
  const wrong = await signIn('135791');
  // A separate page for the pause, so the main session is untouched: five wrong PINs pause even the right one, until the window passes.
  const paused = make(async pin => pin === FIXTURE_PIN);
  for (let attempt = 0; attempt < READ_ONLY_LIMITS.failures; attempt++) await signIn('000000', paused);
  const whilePaused = await signIn(FIXTURE_PIN, paused);
  clock += READ_ONLY_LIMITS.failureWindowMs + 1;
  const afterPause = await signIn(FIXTURE_PIN, paused);
  clock -= READ_ONLY_LIMITS.failureWindowMs + 1;
  const checkDown = await signIn(FIXTURE_PIN, make(async () => { throw Error('connection refused'); }));
  clock += DASHBOARD_BOUNDS.sessionMs + 1;
  const expired = get('/dashboard');
  clock -= DASHBOARD_BOUNDS.sessionMs + 1;
  const approvalRoutes = await Promise.all([['POST', '/dashboard/begin'], ['POST', '/dashboard/act'], ['POST', '/begin'], ['POST', '/act'],
    ['GET', '/c/x'], ['POST', '/dashboard/stop'], ['GET', '/dashboard.js'], ['GET', '/dashboard/sign-in/begin']]
    .map(([method, path]) => handleReadOnly(dash, { method, path, body: '{}', cookie: session })));
  const refusesListen = value => { try { checkListen(value); return false; } catch { return true; } };
  const refusesCheck = value => { try { pinCheckAt(value); return false; } catch { return true; } };
  const server = serveReadOnly(dash, '127.0.0.1:0');
  const address = await new Promise(done => server.once('listening', () => done(server.address())));
  await new Promise(done => server.close(done));
  const page = out => out.body, signInOnly = out => out.status === 401 && /id="signin-pin"/u.test(out.body) && !shown(out.body);
  const refused = attempt => attempt.cookie === undefined && attempt.out.status >= 400 && !shown(attempt.out.body);
  const stop = get('/dashboard/stop'), stopText = visible(stop.body);
  const exposure = {
    readOnlySignedOutShowsSignInOnly: { pass: signedOut.every(signInOnly), detail: 'read-only page: every view without a session shows only the PIN sign-in (401)' },
    readOnlyForgedSessionRefused: { pass: signInOnly(forged), detail: 'read-only page: a made-up session value opens nothing' },
    readOnlyWrongPinRefused: { pass: refused(wrong) && wrong.out.status === 401, detail: 'read-only page: a wrong PIN opens nothing' },
    readOnlySignInPauses: { pass: refused(whilePaused) && whilePaused.out.status === 429 && afterPause.cookie !== undefined,
      detail: `read-only page: ${READ_ONLY_LIMITS.failures} wrong PINs pause sign-in for ${READ_ONLY_LIMITS.failureWindowMs / 60000} minutes` },
    readOnlyPinCheckDownRefused: { pass: refused(checkDown) && checkDown.out.status === 503, detail: 'read-only page: when the PIN cannot be checked, nothing opens' },
    readOnlySessionExpires: { pass: signInOnly(expired), detail: `read-only page: a session ends after ${DASHBOARD_BOUNDS.sessionMs / 60000} minutes` },
    readOnlyNoApprovalRoute: { pass: approvalRoutes.every(out => out.status === 404) && pages.every(item => !/\/c\/|data-decision|<button(?![^>]*id="signin-pin")/u.test(item.html)),
      detail: 'read-only page: no approve, decline, stop or passkey route exists, and no page carries an approval control' },
    readOnlyStopSaysHow: { pass: stop.status === 200 && stopText.includes('send /stop in your chat') && stopText.includes('cannot stop it or approve anything'),
      detail: 'read-only page: the stop view says how to stop (send /stop in the chat) and that this page cannot' },
    readOnlyListensPrivately: { pass: address.address === '127.0.0.1' && ['0.0.0.0:4071', '203.0.113.5:4071', '192.168.1.20:4071', 'localhost:4071']
      .every(refusesListen) && !refusesListen('100.124.55.70:4071') && !refusesListen('127.0.0.1:4071'),
    detail: 'read-only page: listens on loopback or a Tailscale address only, never a public or wildcard address' },
    readOnlyPinCheckStaysLocal: { pass: ['https://example.org/dashboard/unlock', 'http://192.168.1.20:4042/dashboard/unlock', 'http://localhost:4042/dashboard/unlock']
      .every(refusesCheck) && !refusesCheck('http://127.0.0.1:4042/dashboard/unlock'), detail: 'read-only page: the PIN is only ever checked on this machine' },
    readOnlySignedInShowsContent: { pass: first.out.status === 303 && session !== undefined
      && shown(page(get(`/dashboard/messages/${recorded.turns[0].update}`))) && shown(page(get('/dashboard/status'))),
    detail: 'read-only page: with the PIN session the same views show the content (the positive neighbor)' },
  };
  const pass = Object.values(verdicts).every(item => item.pass) && population.ok;
  return { floors: Object.fromEntries(Object.entries(verdicts).map(([id, item]) => [id, { ...item, floor: FLOORS[id] }])), population, exposure, pass };
}

/** Builds the throwaway page, renders every state and returns { floors, controls, exposure, population, readOnly, pass }. */
export async function runDashboardChecks({ fixture = resolve('tests/fixtures/dashboard-recorded-shapes.json') } = {}) {
  const recorded = JSON.parse(readFileSync(fixture, 'utf8'));
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dashboard-floors-')));
  try {
    const store = join(root, 'store'), outbox = join(root, 'outbox');
    for (const directory of [store, outbox]) { mkdirSync(directory, { mode: 0o755 }); chmodSync(directory, 0o755); }
    let clock = 1_790_900_000_000;
    const uid = process.getuid(), config = { operator: 'telegram:7654321', operatorUid: uid, agentUid: uid + 1,
      ingressGrant: 'desk:dashboard-floors', publicBase: ORIGIN, store, outbox };
    const surface = createApprovalSurface(config, () => clock), token = surface.surface.token;
    const call = (method, path, body, cookie) => handle(surface, { method, path, body: body === undefined ? undefined : JSON.stringify(body), cookie });
    const signInPage = call('GET', `/${token}/dashboard`).body;
    const phone = authenticator(ORIGIN, RP);
    const code = surface.enrol().split('#')[1], enrolStart = JSON.parse(call('POST', `/${token}/enrol/begin`, { code }).body);
    call('POST', `/${token}/enrol/finish`, { code, registration: phone.create(enrolStart.challenge) });
    const signIn = (device = phone, override = {}, nonceOverride) => {
      const start = JSON.parse(call('POST', `/${token}/dashboard/sign-in/begin`, {}).body);
      const out = call('POST', `/${token}/dashboard/sign-in/finish`, { nonce: nonceOverride ?? start.nonce,
        assertion: device.get(override.challenge ?? start.challenge, override) });
      return { out, start, cookie: out.headers['set-cookie']?.split(';')[0] };
    };
    const session = signIn().cookie;
    // The runner's side issues the requests the page lists: one raise and the standing stop.
    const client = createApprovalSurfaceClient({ store, outbox, operatorUid: uid, agentUid: uid + 1, now: () => clock });
    const issue = (subject, text) => { if (text) client.wording(subject.renderingDigest, text); return client.verifier.issue(subject); };
    const digest = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;
    const subject = { requestDigest: digest('raise'), artifact: digest('raise'), base: 'base:fixture', issuedAt: clock, expiresAt: clock + 3_600_000,
      singleUse: true, surface: 'preview-approval-surface', generation: 'generation:fixture', operator: config.operator,
      scope: { type: 'Scope', schemaVersion: 1, kind: 'conversation', members: ['7654321'] } };
    const fixtures = fixtureSnapshots(recorded, clock);
    const publish = snapshot => snapshot === null ? rmSync(join(outbox, DASHBOARD_FILE), { force: true })
      : writeFileSync(join(outbox, DASHBOARD_FILE), canonical(snapshot), { mode: 0o644 });
    const fetch = (path, statusOnly = false) => { const out = call('GET', path, undefined, session); return statusOnly ? out.status : out.body; };
    const pages = [], states = {}, seen = new Set();
    const crawl = (state, path, front = false) => {
      const key = `${state} ${path}`;
      if (seen.has(key) || pages.length > 400) return;
      seen.add(key);
      const out = call('GET', path, undefined, session);
      pages.push({ state, path, status: out.status, html: out.body, front });
      for (const href of hrefs(out.body)) if (href.startsWith(`/${token}/dashboard/`) && out.status === 200) crawl(state, href);
    };
    // The empty state renders before the runner has issued anything; every later state has one raise and the standing stop.
    const issueRequests = () => {
      issue({ ...subject, request: 'req-raise', action: 'raise-caps', audience: 'operator-private-chat', requestedBy: 'preview-agent', renderingDigest: digest(RAISE_TEXT) }, RAISE_TEXT);
      issue({ ...subject, request: 'req-stop', action: 'emergency-stop', audience: 'independent-emergency-stop', requestedBy: config.operator, renderingDigest: digest('stop') });
    };
    for (const [state, snapshot] of [['empty', fixtures.empty], ['full', fixtures.full], ['missing', null], ['invalid', fixtures.invalid],
      ['stale', fixtures.stale], ['stopped', fixtures.stopped]]) {
      if (state === 'full') issueRequests();
      publish(snapshot);
      crawl(state, `/${token}/dashboard`, true);
      for (const view of DASHBOARD_VIEWS) crawl(state, `/${token}/dashboard${view.path ? `/${view.path}` : ''}`);
      states[state] = pages.find(item => item.state === state && item.front).html;
    }
    const pageOf = (state, view) => pages.find(item => item.state === state && item.path === `/${token}/dashboard/${view}`)?.html;
    states.emptyWaiting = pageOf('empty', 'waiting'); states.emptyMessages = pageOf('empty', 'messages');
    pages.push({ state: 'signed-out', path: `/${token}/dashboard`, status: 200, html: signInPage, signIn: true });
    // Links are followed against the full state, the one published from here on.
    publish(fixtures.full);
    const checkFetch = (path, statusOnly) => fetch(path, statusOnly);
    const { verdicts } = floorVerdicts({ pages, fetch: checkFetch, states });

    // Negative controls: each floor must turn red on a page that breaks it.
    const front = pages.find(item => item.state === 'full' && item.front), others = pages.filter(item => item !== front);
    const mutate = (change, extra = {}) => floorVerdicts({ pages: [{ ...front, html: change(front.html) }, ...others], fetch: checkFetch, states, ...extra });
    const insert = html => text => text.replace('</main>', `${html}</main>`);
    const controls = Object.fromEntries(Object.entries({
      F1: mutate(insert('<details><summary>More</summary>x</details>')),
      F2: mutate(text => text.replace(/<a href="[^"]*\/dashboard\/allowance">[^<]*<\/a>/u, '')),
      F3: mutate(text => text.replace(/<p class="purpose">[^<]*<\/p>/u, '')),
      F4: mutate(insert('<table><tr><td>wide</td></tr></table>')),
      F5: mutate(insert(`<a href="/${token}/dashboard/status"></a>`)),
      // Both halves must be caught: a raw error on a lost state's front page, and a stale detail page with no age notice.
      F6: (() => { const raw = floorVerdicts({ pages, fetch: checkFetch, states: { ...states, missing: '<main class="panel"><p>Error: ENOENT</p></main>' } });
        const quiet = floorVerdicts({ pages: pages.map(item => item.state === 'stale' && /\/dashboard\/requests\//u.test(item.path)
          ? { ...item, html: item.html.replace(/<p class="note">Last updated by your agent[^<]*<\/p>/u, '') } : item), fetch: checkFetch, states });
        return { verdicts: { F6: { pass: raw.verdicts.F6.pass || quiet.verdicts.F6.pass } } }; })(),
      F7: mutate(text => text.replace('<p class="headline">', '<p class="headline" style="color:red">')),
      F8: mutate(insert(`<a href="/${token}/dashboard/nowhere/at/all">Elsewhere</a>`)),
      F9: mutate(text => text.replace('<title>', '<meta http-equiv="refresh" content="5"><title>')),
      F10: mutate(insert(`<p class="note">${'more words here '.repeat(60)}</p>`)),
      F11: mutate(insert('<span class="tile">A tile that opens nothing</span>')),
    }).map(([id, result]) => [id, result.verdicts[id].pass ? 'missed' : 'detected']));

    // Exposure: nothing from the agent is shown without the operator's passkey.
    const secret = recorded.turns[0].message.slice(0, 40), statusLine = fixtures.full.status[1];
    const signedOut = DASHBOARD_VIEWS.map(view => call('GET', `/${token}/dashboard${view.path ? `/${view.path}` : ''}`).body);
    const forged = call('GET', `/${token}/dashboard`, undefined, `instar_dashboard=${randomBytes(32).toString('hex')}`).body;
    const stranger = authenticator(ORIGIN, RP), wrongOrigin = signIn(phone, { origin: 'https://approvals.example.org.evil.test' });
    const replayStart = signIn(), replay = signIn(phone, {}, replayStart.start.nonce);
    const actBytes = actChallenge({ id: 'challenge:x' }, 'approve', 'n'.repeat(64)).toString('base64url');
    const actAsSignIn = signIn(phone, { challenge: actBytes });
    const unenrolled = signIn(stranger);
    clock += DASHBOARD_BOUNDS.sessionMs + 1;
    const expired = call('GET', `/${token}/dashboard`, undefined, session).body;
    clock -= DASHBOARD_BOUNDS.sessionMs + 1;
    const server = serve(surface, 0);
    const address = await new Promise(done => server.once('listening', () => done(server.address())));
    await new Promise(done => server.close(done));
    const shown = html => html.includes(secret) || html.includes(statusLine);
    const refused = attempt => attempt.out.status === 400 && attempt.cookie === undefined;
    const exposure = {
      signedOutShowsSignInOnly: { pass: signedOut.every(html => /id="signin"/u.test(html) && !shown(html)), detail: 'every view without a session shows only the sign-in page' },
      forgedSessionRefused: { pass: /id="signin"/u.test(forged) && !shown(forged), detail: 'a made-up session value opens nothing' },
      wrongOriginRefused: { pass: refused(wrongOrigin), detail: 'a passkey assertion for another site is refused' },
      unenrolledKeyRefused: { pass: refused(unenrolled), detail: 'a passkey that is not enrolled is refused' },
      nonceReplayRefused: { pass: replayStart.cookie !== undefined && refused(replay), detail: 'a used sign-in step cannot be used again' },
      approvalCannotSignIn: { pass: refused(actAsSignIn), detail: 'an approval signature can never open a session' },
      sessionExpires: { pass: /id="signin"/u.test(expired) && !shown(expired), detail: `a session ends after ${DASHBOARD_BOUNDS.sessionMs / 60000} minutes` },
      loopbackOnly: { pass: address.address === '127.0.0.1', detail: 'the page listens on loopback only; the recorded ingress grant publishes it' },
      signedInShowsContent: { pass: shown(fetch(`/${token}/dashboard/messages/${recorded.turns[0].update}`)) && shown(fetch(`/${token}/dashboard/status`)),
        detail: 'with the passkey session the same views show the content (the positive neighbor)' },
    };
    const population = { ...counted(pages), states: Object.keys(fixtures).length + 1 };
    const populated = enough(population);

    // The runner's read-only page (plan #502): the same views from the same module, behind the operator's existing PIN.
    const readOnly = await readOnlyChecks({ fixtures, recorded, secret, statusLine, shown });
    Object.assign(exposure, readOnly.exposure);
    const pass = Object.values(verdicts).every(item => item.pass) && Object.values(controls).every(item => item === 'detected')
      && Object.values(exposure).every(item => item.pass) && populated && readOnly.pass;
    return { floors: Object.fromEntries(Object.entries(verdicts).map(([id, item]) => [id, { ...item, floor: FLOORS[id] }])), controls, exposure,
      population: { ...population, ok: populated },
      readOnly: { floors: readOnly.floors, population: readOnly.population, pass: readOnly.pass }, pass };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runDashboardChecks();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = report.pass ? 0 : 1;
}
