// The operator dashboard (Rules 79, 80, 81, 87; tests/preview/README.md "The operator dashboard"). It is rendered by the
// operator's own approval page process (scripts/approval-surface.mjs), never by the agent, and only after the operator's
// enrolled passkey signs in. The agent's runner publishes one disposable snapshot into its own outbox
// (tests/preview/operator-dashboard.ts); everything in it is untrusted agent data here: it is checked against a closed,
// bounded shape, escaped, and its only links are a GitHub review page or the operator's own chat. Approve, decline and stop
// are never performed here: each links to the request's own approval page, which renders its own fixed wording.
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from './approval-surface-core.mjs';

export const DASHBOARD_FILE = 'dashboard.json';
export const DASHBOARD_TYPE = 'PreviewOperatorDashboard';
/** Bounds the page holds independently of the runner (Rule 60), the session lifetime, and when a snapshot reads as stale. */
export const DASHBOARD_BOUNDS = Object.freeze({ maxBytes: 262144, statusLines: 40, lineChars: 4000, turns: 10, textChars: 500,
  requests: 10, staleMs: 120_000, sessionMs: 1_800_000 });
/** Every registered view: the navigation lists all of them on every page (floor F2). */
export const DASHBOARD_VIEWS = Object.freeze([
  { id: 'overview', path: '', title: 'Your agent', purpose: 'What your agent is doing, and anything that needs you, at a glance.' },
  { id: 'waiting', path: 'waiting', title: 'Waiting for you', purpose: 'Requests that need your yes or no, each with a direct link to answer it.' },
  { id: 'messages', path: 'messages', title: 'Recent messages', purpose: 'Your latest messages to your agent and what it did with each one.' },
  { id: 'status', path: 'status', title: 'Status', purpose: 'The same report your agent sends when you write "status" in your chat.' },
  { id: 'allowance', path: 'allowance', title: 'Allowance and spend', purpose: "How much of this trial's allowance your agent has used so far." },
  { id: 'stop', path: 'stop', title: 'Stop', purpose: 'Stop your agent at once. After you confirm, nothing more is sent or spent.' },
]);
const DETAIL = Object.freeze({
  message: { title: 'One message', purpose: 'One of your messages in full, with your agent\'s reply and what happened to it.' },
  request: { title: 'One request', purpose: 'One request your agent made, what it would change, and where to answer it.' },
  missing: { title: 'Page not found', purpose: 'This address is not one of your dashboard pages.' },
});
const GITHUB_REVIEW = /^https:\/\/github\.com\/[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}\/pull\/[1-9]\d{0,9}\/files$/u;
const CHAT = /^[A-Za-z0-9_]{5,32}$/u;
const FIELDS = 'allowance,asOf,chat,counts,requests,schemaVersion,state,status,tokens,turns,type,until,zone';

const text = (value, limit) => { check(typeof value === 'string' && value.length <= limit, 'dashboard text field invalid'); return value; };
const count = value => { check(Number.isSafeInteger(value) && value >= 0, 'dashboard count invalid'); return value; };
const closed = (value, fields) => { check(value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === fields, 'dashboard record shape invalid'); return value; };
const list = (value, limit) => { check(Array.isArray(value) && value.length <= limit, 'dashboard list invalid'); return value; };
/** The closed snapshot shape. Anything else refuses the whole snapshot, and the page says it could not be read. */
export function checkSnapshot(value) {
  const B = DASHBOARD_BOUNDS, s = closed(value, FIELDS);
  check(s.type === DASHBOARD_TYPE && s.schemaVersion === 1 && ['running', 'stopped', 'ended'].includes(s.state), 'dashboard header invalid');
  count(s.asOf); text(s.zone, 64); text(s.until, 32);
  for (const line of list(s.status, B.statusLines)) text(line, B.lineChars);
  closed(s.counts, 'held,turnsToday,waiting'); Object.values(s.counts).forEach(count);
  for (const item of list(s.allowance, 8)) { closed(item, 'label,max,used'); text(item.label, 40); count(item.used); count(item.max); }
  closed(s.tokens, 'input,output,unknownCalls'); Object.values(s.tokens).forEach(count);
  for (const item of list(s.requests, B.requests)) {
    closed(item, 'link,open,route,state,title'); text(item.title, 120); text(item.state, 120);
    check(typeof item.open === 'boolean' && ['chat', 'github-review'].includes(item.route), 'dashboard request invalid');
    check(item.route === 'github-review' ? typeof item.link === 'string' && GITHUB_REVIEW.test(item.link) : item.link === null,
      'dashboard request link is not a GitHub review page');
  }
  for (const item of list(s.turns, B.turns)) {
    closed(item, 'from,message,reply,state,time,update'); count(item.update); text(item.time, 32); text(item.message, B.textChars);
    check(item.reply === null || typeof item.reply === 'string' && item.reply.length <= B.textChars, 'dashboard reply invalid');
    check(['you', 'scheduled'].includes(item.from), 'dashboard sender invalid'); text(item.state, 200);
  }
  check(s.chat === null || typeof s.chat === 'string' && CHAT.test(s.chat), 'dashboard chat invalid');
  return s;
}

/** The runner's snapshot as the page will treat it: missing, unreadable (invalid), fresh (ok) or stale. */
export function readSnapshot(outbox, now) {
  const path = join(outbox, DASHBOARD_FILE);
  let stat;
  try { stat = lstatSync(path); } catch { return { kind: 'missing' }; }
  try {
    check(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o022) === 0 && stat.size <= DASHBOARD_BOUNDS.maxBytes, 'dashboard record invalid');
    const snapshot = checkSnapshot(JSON.parse(readFileSync(path, 'utf8'))), age = Math.max(0, now - snapshot.asOf);
    return { kind: age > DASHBOARD_BOUNDS.staleMs ? 'stale' : 'ok', snapshot, age };
  } catch { return { kind: 'invalid' }; }
}

const escape = value => String(value).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = ms => { const minutes = Math.floor(ms / 60_000);
  return minutes < 1 ? 'less than a minute ago' : minutes < 120 ? `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    : `${Math.floor(minutes / 60)} hours ago`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** The one shared stylesheet: every view uses only these classes (floor F7), nothing is fixed wider than a phone (F4). */
export const DASHBOARD_STYLE = `*{box-sizing:border-box}
body{font:17px/1.45 -apple-system,system-ui,sans-serif;margin:0 auto;max-width:44rem;padding:1rem;color:#111;overflow-wrap:anywhere}
.views{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 1rem}
.views a{padding:.45rem .8rem;border-radius:1rem;background:#e8eaed;color:#111;text-decoration:none}
.views a.here{background:#0b57d0;color:#fff}
.panel{display:block}
h1{font-size:1.35rem;margin:.2rem 0}
.purpose{color:#444;margin:.2rem 0 1rem}
.headline{font-size:1.2rem;font-weight:600}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:.6rem}
.tile{display:block;padding:.9rem;border-radius:.7rem;background:#f1f3f4;color:#111;text-decoration:none}
.tile.stop{background:#fce8e6}
.label{display:block;font-size:.9rem;color:#444}
.value{display:block;font-size:1.15rem;font-weight:600}
.row{display:block;padding:.8rem 0;border-bottom:1px solid #ddd;color:#0b57d0;text-decoration:none}
.meta{display:block;font-size:.85rem;color:#555}
.lines,.facts{list-style:none;padding:0}
.lines li,.facts li{padding:.4rem 0;border-bottom:1px solid #eee}
.quote{background:#f8f9fa;padding:.7rem;border-radius:.5rem;white-space:pre-wrap}
.button{display:block;text-align:center;font-size:1.15rem;padding:1rem;margin:.6rem 0;border-radius:.6rem;border:0;width:100%;text-decoration:none}
.primary{background:#0b57d0;color:#fff}
.danger{background:#b3261e;color:#fff}
.note{color:#444;font-size:.95rem}
meter{width:100%}`;
const document = (title, body, script) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${DASHBOARD_STYLE}</style>
</head><body>${body}${script ? `<script src="${script}"></script>` : ''}</body></html>`;
/** Every dashboard address lives under the page's path token. */
export const dashboardPath = (token, path = '') => `/${token}/dashboard${path ? `/${path}` : ''}`;
const page = (token, here, { title, purpose }, body) => document(title, `<nav class="views" aria-label="Dashboard pages">${
  DASHBOARD_VIEWS.map(view => `<a${view.id === here ? ' class="here" aria-current="page"' : ''} href="${dashboardPath(token, view.path)}">${escape(view.title)}</a>`).join('')
}</nav><main class="panel"><h1>${escape(title)}</h1><p class="purpose">${escape(purpose)}</p>${body}</main>`);
const VIEW = Object.fromEntries(DASHBOARD_VIEWS.map(view => [view.id, view]));

/** Plain sentences for a page that has no current snapshot to show (floor F6). */
const UNAVAILABLE = {
  missing: 'Your agent has not shared its status here yet. If it is running, this appears within a minute of it starting.',
  invalid: "Your agent's latest status could not be read, so nothing from it is shown. Reload in a minute; if this stays, your agent may need a restart.",
};
const freshness = state => state.kind === 'stale'
  ? `<p class="note">It may be stopped or busy. The details shown are from ${escape(ago(state.age))}.</p>`
  : `<p class="note">Updated ${escape(ago(state.age))}. Reload the page to see newer details.</p>`;
const unavailable = state => `<p class="note">${escape(UNAVAILABLE[state.kind])}</p>`;
const chatLink = chat => `https://t.me/${chat}`;
/** Open requests, each a direct link to where it is answered: the approval page itself, the GitHub review, or the chat. */
function waitingRows(token, state, pending) {
  const rows = pending.filter(item => item.view.kind !== 'stop').map(item => ({ href: `/${token}/c/${item.name}`, title: item.view.title,
    meta: 'Answer it on your approval page' }));
  if (state.snapshot) state.snapshot.requests.forEach((item, index) => { if (!item.open) return;
    rows.push(item.route === 'github-review' ? { href: item.link, title: item.title, meta: 'Answer it on GitHub' }
      : state.snapshot.chat ? { href: chatLink(state.snapshot.chat), title: item.title, meta: 'Answer it in your chat' }
        : { href: dashboardPath(token, `requests/${index}`), title: item.title, meta: 'Answer it in your chat' }); });
  return rows;
}
const row = item => `<a class="row" href="${escape(item.href)}">${escape(item.title)}<span class="meta">${escape(item.meta)}</span></a>`;
const tile = (token, view, label, value, stop = false) =>
  `<a class="tile${stop ? ' stop' : ''}" href="${dashboardPath(token, VIEW[view].path)}"><span class="label">${escape(label)}</span><span class="value">${escape(value)}</span></a>`;

/** One dashboard page. `view` is a registered view id or a detail path (`messages/<update>`, `requests/<index>`). */
export function renderDashboard({ token, view, state, pending }) {
  const s = state.snapshot, waiting = waitingRows(token, state, pending), stopItem = pending.find(item => item.view.kind === 'stop');
  if (view === 'overview') {
    const headline = !s ? (state.kind === 'missing' ? 'Your agent has not shared its status yet.' : "Your agent's status could not be read.")
      : state.kind === 'stale' ? `Your agent has not updated this page for ${ago(state.age).replace(' ago', '')}.`
        : `${s.state === 'running' ? 'Your agent is running.' : s.state === 'stopped' ? 'Your agent is stopped.' : 'This trial has ended.'} ${
          waiting.length ? `${plural(waiting.length, 'request is', 'requests are')} waiting for you.` : 'Nothing is waiting for you.'}`;
    const calls = s?.allowance[0];
    const tiles = [tile(token, 'waiting', 'Waiting for you', String(waiting.length)),
      ...(s ? [tile(token, 'messages', 'Messages today', String(s.counts.turnsToday)),
        tile(token, 'status', 'Status', s.state === 'running' ? `Running until ${s.until}` : s.state === 'stopped' ? 'Stopped' : 'Ended'),
        tile(token, 'allowance', 'Allowance used', calls ? `${calls.used} of ${calls.max} model calls` : 'Not recorded')]
        : [tile(token, 'status', 'Status', 'Not available')]),
      tile(token, 'stop', 'Stop', s?.state === 'stopped' ? 'Already stopped' : 'Stop your agent', true)];
    return page(token, 'overview', VIEW.overview, `<p class="headline">${escape(headline)}</p><div class="tiles">${tiles.join('')}</div>${
      s ? freshness(state) : unavailable(state)}`);
  }
  if (view === 'waiting') return page(token, 'waiting', VIEW.waiting, waiting.length ? waiting.map(row).join('')
    : `<p class="note">Nothing is waiting for you.${s ? '' : ` ${UNAVAILABLE[state.kind]}`}</p>`
    + (s && s.requests.some(item => !item.open) ? `<h2>Earlier requests</h2>${s.requests.map((item, index) => item.open ? ''
      : row({ href: dashboardPath(token, `requests/${index}`), title: item.title, meta: item.state })).join('')}` : ''));
  if (view === 'messages') return page(token, 'messages', VIEW.messages, !s ? unavailable(state) : (s.turns.length
    ? s.turns.map(turn => row({ href: dashboardPath(token, `messages/${turn.update}`),
      title: turn.message.length > 90 ? `${turn.message.slice(0, 89)}…` : turn.message || '(no text)',
      meta: `${turn.time} · ${turn.from === 'you' ? 'From you' : 'Scheduled'} · ${turn.state}` })).join('')
    : '<p class="note">No messages yet in this trial.</p>') + freshness(state));
  if (view === 'status') return page(token, 'status', VIEW.status, !s ? unavailable(state)
    : `<ul class="lines">${s.status.map(line => `<li>${escape(line)}</li>`).join('')}</ul>${freshness(state)}`);
  if (view === 'allowance') return page(token, 'allowance', VIEW.allowance, !s ? unavailable(state)
    : `<ul class="facts">${s.allowance.map(item => `<li>${escape(`${item.label}: ${item.used} of ${item.max} used.`)}<meter aria-label="${escape(item.label)} used" min="0" max="${item.max}" value="${Math.min(item.used, item.max)}"></meter></li>`).join('')}
<li>${escape(`Model tokens this trial: ${s.tokens.input.toLocaleString('en-US')} in, ${s.tokens.output.toLocaleString('en-US')} out.`)}</li>
<li>${escape(`Model calls whose size was not reported: ${s.tokens.unknownCalls}.`)}</li>
<li>Dollar spend is not recorded for this trial.</li></ul>${freshness(state)}`);
  if (view === 'stop') return page(token, 'stop', VIEW.stop, s?.state === 'stopped' ? '<p class="headline">Your agent is already stopped.</p>'
    : stopItem ? `<a class="button danger" href="/${token}/c/${stopItem.name}">Stop your agent now</a><p class="note">Your phone's passkey confirms it. Your agent stops at once, and your saved messages stay saved.</p>`
      : `<p class="note">The one-tap stop is not ready on this page right now.${s?.chat ? '' : ' Send /stop in your chat with your agent to stop it.'}</p>${
        s?.chat ? `<a class="button danger" href="${chatLink(s.chat)}">Open your chat and send /stop</a>` : ''}`);
  const [kind, key] = view.split('/');
  if (kind === 'messages' && /^\d{1,20}$/u.test(key ?? '')) {
    const turn = s?.turns.find(item => String(item.update) === key);
    return page(token, 'messages', DETAIL.message, !turn ? `<p class="note">That message is not in the recent list any more.${s ? '' : ` ${UNAVAILABLE[state.kind]}`}</p>`
      : `<p class="meta">${escape(`${turn.time} · ${turn.from === 'you' ? 'From you' : 'Scheduled'}`)}</p><p class="quote">${escape(turn.message || '(no text)')}</p>
<h2>Reply</h2>${turn.reply === null ? '<p class="note">No reply yet.</p>' : `<p class="quote">${escape(turn.reply)}</p>`}<p class="note">${escape(turn.state)}</p>`);
  }
  if (kind === 'requests' && /^\d{1,2}$/u.test(key ?? '')) {
    const item = s?.requests[Number(key)];
    return page(token, 'waiting', DETAIL.request, !item ? '<p class="note">That request is not in the recent list any more.</p>'
      : `<p class="headline">${escape(item.title)}</p><p class="note">${escape(item.state)}.</p>${!item.open ? ''
        : item.route === 'github-review' ? `<a class="button primary" href="${escape(item.link)}">Answer it on GitHub</a>`
          : s.chat ? `<a class="button primary" href="${chatLink(s.chat)}">Answer it in your chat</a>` : '<p class="note">Answer it in your chat with your agent.</p>'}`);
  }
  return page(token, '', DETAIL.missing, '<p class="note">That page does not exist. Choose one of the pages above.</p>');
}

/** The only page shown before sign-in: it reveals nothing from the agent. */
export const renderSignIn = (token, enrolled) => document('Sign in', `<main class="panel"><h1>Sign in</h1><p class="purpose">Your dashboard shows your agent's messages, so your phone's passkey confirms it is you first.</p>${
  enrolled ? '<button class="button primary" id="signin">Sign in with your passkey</button><p class="note" id="result" role="status"></p>'
    : '<p class="note">No passkey is set up for this page yet, so the dashboard cannot open. The one-use set-up link comes from the computer that runs this page.</p>'}</main>`,
  enrolled ? `/${token}/dashboard.js` : null);
