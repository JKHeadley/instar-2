// The operator dashboard (Rules 79, 80, 81, 87; tests/preview/README.md "The operator dashboard"). It is rendered in two
// places from this one module: by the operator's own approval page process (scripts/approval-surface.mjs) after the
// operator's enrolled passkey signs in, and READ-ONLY by the runner itself (scripts/operator-dashboard-readonly.mjs) after
// the operator's existing dashboard PIN signs in. The snapshot (tests/preview/operator-dashboard.ts) is untrusted agent
// data here: it is checked against a closed, bounded shape, escaped, and its only links are a GitHub review page or the
// operator's own chat. Approve, decline and stop are never performed here: each links to where it is answered (the
// request's own approval page, the GitHub review, or the chat), which renders its own fixed wording.
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from './approval-surface-core.mjs';

export const DASHBOARD_FILE = 'dashboard.json';
export const DASHBOARD_TYPE = 'PreviewOperatorDashboard';
/** Bounds the page holds independently of the runner (Rule 60), the session lifetime, and when a snapshot reads as stale. */
export const DASHBOARD_BOUNDS = Object.freeze({ maxBytes: 262144, statusLines: 40, lineChars: 4000, turns: 10, textChars: 500, stateChars: 200,
  requests: 10, staleMs: 120_000, sessionMs: 1_800_000,
  // Row 89: work in progress and process health (tests/preview/operator-dashboard.ts DASHBOARD_LIMITS, the 1.x bounds).
  sessions: 16, labelChars: 120, activityChars: 280, noticed: 10, patterns: 10, summaryChars: 240 });
/** Every registered view: the navigation lists all of them on every page (floor F2). */
export const DASHBOARD_VIEWS = Object.freeze([
  { id: 'overview', path: '', title: 'Your agent', purpose: 'What your agent is doing, and anything that needs you, at a glance.' },
  { id: 'waiting', path: 'waiting', title: 'Waiting for you', purpose: 'Requests that need your yes or no, each with a direct link to answer it.' },
  { id: 'sessions', path: 'sessions', title: 'Working now', purpose: 'What your agent is working on right now, and where each piece of work runs.' },
  { id: 'messages', path: 'messages', title: 'Recent messages', purpose: 'Your latest messages to your agent and what it did with each one.' },
  { id: 'status', path: 'status', title: 'Status', purpose: 'The same report your agent sends when you write "status" in your chat.' },
  { id: 'allowance', path: 'allowance', title: 'Allowance and spend', purpose: "How much of this installation's allowance your agent has used so far." },
  { id: 'health', path: 'health', title: 'Process health', purpose: 'What your agent has noticed going wrong in its own work, and what it keeps an eye on.' },
  { id: 'stop', path: 'stop', title: 'Stop', purpose: 'Stop your agent at once. After you confirm, nothing more is sent or spent.' },
]);
const DETAIL = Object.freeze({
  message: { title: 'One message', purpose: 'One of your messages in full, with your agent\'s reply and what happened to it.' },
  request: { title: 'One request', purpose: 'One request your agent made, what it would change, and where to answer it.' },
  missing: { title: 'Page not found', purpose: 'This address is not one of your dashboard pages.' },
});
const GITHUB_REVIEW = /^https:\/\/github\.com\/[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}\/pull\/[1-9]\d{0,9}\/files$/u;
const CHAT = /^[A-Za-z0-9_]{5,32}$/u;
const FIELDS = 'allowance,asOf,chat,counts,health,requests,schemaVersion,sessionTurns,sessions,state,status,tokens,turns,type,until,zone';
const HEALTH_STATUS = ['open', 'attributed', 'resolved'];

const text = (value, limit) => { check(typeof value === 'string' && value.length <= limit, 'dashboard text field invalid'); return value; };
const count = value => { check(Number.isSafeInteger(value) && value >= 0, 'dashboard count invalid'); return value; };
/** The journal's update domain (tests/preview/journal.ts `isJournalUpdate`): a Telegram update id, or a scheduled turn's
 * synthetic update on the 1/1024 grid. Its decimal form names a message's detail page. */
const SYNTHETIC_STEPS = 1024;
export const isDashboardUpdate = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
  && Number.isSafeInteger(value * SYNTHETIC_STEPS);
/** Every dashboard detail path: `messages/<update>` (an update's decimal form) or `requests/<index>`. */
export const DETAIL_PATH = /^(?:messages\/\d{1,16}(?:\.\d{1,12})?|requests\/\d{1,2})$/u;
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
    closed(item, 'link,open,route,sharedAccess,state,title'); text(item.title, 120); text(item.state, 120);
    if (item.sharedAccess !== null) { closed(item.sharedAccess, 'account,disclosure'); text(item.sharedAccess.account, 200); text(item.sharedAccess.disclosure, 300); }
    check(typeof item.open === 'boolean' && ['chat', 'github-review'].includes(item.route), 'dashboard request invalid');
    check(item.route === 'github-review' ? typeof item.link === 'string' && GITHUB_REVIEW.test(item.link) : item.link === null,
      'dashboard request link is not a GitHub review page');
  }
  for (const item of [...list(s.turns, B.turns), ...list(s.sessionTurns, B.sessions)]) {
    closed(item, 'from,message,reply,state,time,update'); check(isDashboardUpdate(item.update), 'dashboard update invalid'); text(item.time, 32); text(item.message, B.textChars);
    check(item.reply === null || typeof item.reply === 'string' && item.reply.length <= B.textChars, 'dashboard reply invalid');
    check(['you', 'scheduled'].includes(item.from), 'dashboard sender invalid'); text(item.state, B.stateChars);
  }
  check(s.chat === null || typeof s.chat === 'string' && CHAT.test(s.chat), 'dashboard chat invalid');
  // Row 89: work in progress (starting or running only) and process health, both closed and bounded like the rest.
  for (const item of list(s.sessions, B.sessions)) {
    closed(item, 'activity,id,kind,label,machine,since,state,update'); text(item.id, 1024); text(item.label, B.labelChars); text(item.since, 32);
    check(['conversation', 'delegated'].includes(item.kind) && ['starting', 'running'].includes(item.state), 'dashboard session invalid');
    check(item.machine === null || typeof item.machine === 'string' && item.machine.length <= 64, 'dashboard session machine invalid');
    check(item.activity === null || typeof item.activity === 'string' && item.activity.length <= B.activityChars, 'dashboard session activity invalid');
    check(item.update === null ? item.kind === 'delegated' : item.kind === 'conversation' && isDashboardUpdate(item.update), 'dashboard session update invalid');
    check(item.kind === 'delegated' || [...s.turns, ...s.sessionTurns].some(turn => turn.update === item.update), 'dashboard session detail missing');
  }
  closed(s.health, 'noticed,patterns,totals,watch');
  for (const item of list(s.health.noticed, B.noticed)) { closed(item, 'category,count,status,summary,when'); text(item.category, B.labelChars);
    text(item.summary, B.summaryChars); text(item.when, 32); count(item.count); check(HEALTH_STATUS.includes(item.status), 'dashboard health status invalid'); }
  for (const item of list(s.health.patterns, B.patterns)) { closed(item, 'status,summary,timesSeen'); text(item.summary, B.summaryChars);
    count(item.timesSeen); check(HEALTH_STATUS.includes(item.status), 'dashboard health status invalid'); }
  closed(s.health.watch, 'checking,recording,reviewing'); for (const flag of Object.values(s.health.watch)) check(typeof flag === 'boolean', 'dashboard health watch invalid');
  closed(s.health.totals, 'known,noticed'); Object.values(s.health.totals).forEach(count);
  return s;
}

/** One snapshot as a page treats it: unreadable (invalid), fresh (ok) or stale. Both pages read through this. */
export function snapshotState(text, now) {
  try {
    check(typeof text === 'string' && Buffer.byteLength(text) <= DASHBOARD_BOUNDS.maxBytes, 'dashboard record invalid');
    const snapshot = checkSnapshot(JSON.parse(text)), age = Math.max(0, now - snapshot.asOf);
    return { kind: age > DASHBOARD_BOUNDS.staleMs ? 'stale' : 'ok', snapshot, age };
  } catch { return { kind: 'invalid' }; }
}
/** The runner's snapshot as the page will treat it: missing, unreadable (invalid), fresh (ok) or stale. */
export function readSnapshot(outbox, now) {
  const path = join(outbox, DASHBOARD_FILE);
  let stat;
  try { stat = lstatSync(path); } catch { return { kind: 'missing' }; }
  try {
    check(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o022) === 0 && stat.size <= DASHBOARD_BOUNDS.maxBytes, 'dashboard record invalid');
    return snapshotState(readFileSync(path, 'utf8'), now);
  } catch { return { kind: 'invalid' }; }
}

const escape = value => String(value).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ── Carried from Instar 1.x dashboard/process-health.js (f3f94826a): the Process Health tab's load-bearing display contract
// (tab spec §4.6). The presentation glyphs below are the renderer's own static literals and are stripped from every
// dynamic value, so a record field can never impersonate a marker; every dynamic value is NFKC-folded, stripped of
// control and bidi characters, and capped grapheme-safely before it is escaped into the page.
export const CHROME = Object.freeze({ sep: ' · ', stageDone: '●', stageFuture: '○' });
// \p{So} (other-symbol) + arrows U+2190–21FF + geometric U+25A0–25FF + box-drawing U+2500–257F + dingbats U+2700–27BF
// + variation selectors U+FE00–FE0F + the bullet/middot set, by explicit code points (no invisible source characters).
const CHROME_GLYPH_RE = new RegExp('[\\p{So}\\u2190-\\u21FF\\u25A0-\\u25FF\\u2500-\\u257F\\u2700-\\u27BF\\uFE00-\\uFE0F\\u2022\\u00B7\\u2027\\u2043]', 'gu');
const CONTROL_RE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]', 'g');
const BIDI_RE = new RegExp('[\\u202A-\\u202E\\u2066-\\u2069]', 'g');
/** 1.x sanitizeForDisplay: 1 null-coerce; 2 NFKC-fold; 3 strip C0/C1 controls (keep newline and tab); 4 strip bidi
 * controls; 5 collapse newlines and cap whitespace runs; 8 strip the chrome-glyph class; 6 grapheme-safe cap. */
export function sanitizeForDisplay(value, max = DASHBOARD_BOUNDS.summaryChars) {
  let s = value == null ? '' : String(value);
  s = s.normalize('NFKC');
  s = s.replace(CONTROL_RE, '');
  s = s.replace(BIDI_RE, '');
  s = s.replace(/\n{2,}/g, '\n').replace(/[ \t]{5,}/g, '    ');
  s = s.replace(CHROME_GLYPH_RE, '');
  return capGraphemes(s, max);
}
function capGraphemes(s, max) {
  if (s.length <= max) return s; // UTF-16 length ≥ grapheme count → safe fast path
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const arr = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), x => x.segment);
    if (arr.length <= max) return s;
    return arr.slice(0, max - 1).join('') + '…';
  }
  let cut = max - 1; // Fallback: never cut between surrogate halves.
  const c = s.charCodeAt(cut - 1);
  if (c >= 0xd800 && c <= 0xdbff) cut -= 1;
  return s.slice(0, cut) + '…';
}
/** 1.x STATUS_WORDS: the value carries the state, the "Status" label carries the noun (tab spec §4.2c). */
const HEALTH_STATUS_WORDS = { open: 'Still looking into this', attributed: 'We know what caused it', resolved: 'Worked out' };
const healthStatus = status => HEALTH_STATUS_WORDS[status] ?? 'Not set';
/** 1.x STAGES, re-keyed to the three self-checks this journal records (each a recorded fact, never a rollout flag). */
const WATCH_ROWS = [
  ['recording', 'Quietly recording what comes up', 'Every message, answer, delivery and hold is recorded as it happens, so nothing noticed is lost.'],
  ['checking', 'Checking each reply before it goes out', 'Each reply is checked against the rules and against what was said earlier before it is sent.'],
  ['reviewing', 'Reviewing patterns in retrospect', 'Earlier conversations are reviewed later as a whole, so a pattern is judged with its history, not one message at a time.'],
];
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
.field{display:block;width:100%;font-size:1.15rem;padding:.8rem;margin:.4rem 0;border:1px solid #888;border-radius:.6rem}
meter{width:100%}`;
const document = (title, body, script) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${DASHBOARD_STYLE}</style>
</head><body>${body}${script ? `<script src="${script}"></script>` : ''}</body></html>`;
/** Every dashboard address lives under the page's path token; the read-only page has none (`token` null). */
export const dashboardPath = (token, path = '') => `${token === null ? '' : `/${token}`}/dashboard${path ? `/${path}` : ''}`;
/** Every page, with the snapshot's age or unavailability on it (the loss detector, purpose Rule 2), whatever the view. */
const page = (token, here, { title, purpose }, state, body) => document(title, `<nav class="views" aria-label="Dashboard pages">${
  DASHBOARD_VIEWS.map(view => `<a${view.id === here ? ' class="here" aria-current="page"' : ''} href="${dashboardPath(token, view.path)}">${escape(view.title)}</a>`).join('')
}</nav><main class="panel"><h1>${escape(title)}</h1><p class="purpose">${escape(purpose)}</p>${body}${state.snapshot ? freshness(state) : unavailable(state)}</main>`);
const VIEW = Object.fromEntries(DASHBOARD_VIEWS.map(view => [view.id, view]));

/** Plain sentences for a page that has no current snapshot to show (floor F6). */
const UNAVAILABLE = {
  missing: 'Your agent has not shared its status here yet. If it is running, this appears within a minute of it starting.',
  invalid: "Your agent's latest status could not be read, so nothing from it is shown. Reload in a minute; if this stays, your agent may need a restart.",
};
const freshness = state => state.kind === 'stale'
  ? `<p class="note">Last updated by your agent ${escape(ago(state.age))}. It may be stopped or busy, so this shows things as they were then.</p>`
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
/** Purpose (the approval-account exception): an approval admitted under shared account access carries its disclosure. */
const sharedAccessLine = shared => `Approved through the account ${shared.account}. ${shared.disclosure}.`;
const requestMeta = item => item.sharedAccess ? `${item.state}. ${sharedAccessLine(item.sharedAccess)}` : item.state;
const row = item => `<a class="row" href="${escape(item.href)}">${escape(item.title)}<span class="meta">${escape(item.meta)}</span></a>`;
const tile = (token, view, label, value, stop = false) =>
  `<a class="tile${stop ? ' stop' : ''}" href="${dashboardPath(token, VIEW[view].path)}"><span class="label">${escape(label)}</span><span class="value">${escape(value)}</span></a>`;

/** Work in progress (1.x Sessions tab: each row names its state, how long it has run and the machine it runs on). A
 * conversation session opens the message it answers; delegated work has no next layer, so it is a plain fact line. */
function sessionsBody(token, s) {
  const conversations = s.sessions.filter(item => item.kind === 'conversation'), delegated = s.sessions.filter(item => item.kind === 'delegated');
  const meta = item => [item.state === 'running' ? 'Working on it' : 'Starting', `since ${item.since}`, ...(item.machine ? [`on ${sanitizeForDisplay(item.machine, 64)}`] : []),
    ...(item.activity ? [sanitizeForDisplay(item.activity, DASHBOARD_BOUNDS.activityChars)] : [])].join(CHROME.sep);
  if (!s.sessions.length) return '<p class="note">Nothing is running right now. A new message starts work within seconds of arriving.</p>';
  return conversations.map(item => row({ href: dashboardPath(token, `messages/${String(item.update)}`), title: sanitizeForDisplay(item.label, DASHBOARD_BOUNDS.labelChars), meta: meta(item) })).join('')
    + (delegated.length ? `<h2>Delegated work</h2><ul class="facts">${delegated.map(item => `<li>${escape(`${sanitizeForDisplay(item.label, DASHBOARD_BOUNDS.labelChars)}${CHROME.sep}${meta(item)}`)}</li>`).join('')}</ul>` : '');
}
/** Process health (the 1.x tab's four sections, flattened: floor F1 keeps nothing collapsed). The headline is
 * informational, never a verdict (§4.2a); a pattern card and a noticed item share one fixed label vocabulary in one
 * order (§4.2b/c): Status · Times seen · First noticed. */
function healthBody(health) {
  const n = health.totals.noticed, open = health.totals.noticed - health.totals.known;
  const headline = n === 0 ? 'Keeping an eye out — all quiet so far' : `Keeping an eye out — ${plural(n, 'thing', 'things')} noticed so far`;
  const subline = n === 0 ? "Nothing has come up yet. We're just quietly watching — no alerts."
    : open === 0 ? 'We know what caused each one. Just quietly watching — no alerts yet.' : `Still looking into ${String(open)} of them. Just quietly watching — no alerts yet.`;
  const fact = (label, value) => `${label}: ${value}`;
  const patterns = health.patterns.length ? `<ul class="facts">${health.patterns.map(item => `<li>${escape([sanitizeForDisplay(item.summary),
    fact('Status', healthStatus(item.status)), fact('Times seen', `${String(item.timesSeen)} times so far`)].join(CHROME.sep))}</li>`).join('')}</ul>`
    : '<p class="note">Nothing to flag yet. We need to see a few more different problems before a real pattern shows up — totally normal this early.</p>';
  const noticed = health.noticed.length ? `<ul class="facts">${health.noticed.map(item => `<li>${escape([`${sanitizeForDisplay(item.category, DASHBOARD_BOUNDS.labelChars)}: ${sanitizeForDisplay(item.summary)}`,
    fact('Status', healthStatus(item.status)), fact('Times seen', item.count > 1 ? `${String(item.count)} times so far` : 'Just once'),
    fact('First noticed', item.when || 'time not recorded')].join(CHROME.sep))}</li>`).join('')}</ul>`
    : '<p class="note">Nothing yet — that just means nothing has come up since your agent started.</p>';
  const watch = `<ul class="facts">${WATCH_ROWS.map(([key, label, description]) => `<li>${escape(`${health.watch[key] ? CHROME.stageDone : CHROME.stageFuture} ${label}${CHROME.sep}${
    health.watch[key] ? 'on' : 'not seen yet'}${CHROME.sep}${description}`)}</li>`).join('')}</ul>`;
  const totals = `<ul class="facts"><li>${escape(fact('Total noticed', String(health.totals.noticed)))}</li><li>${escape(fact('Ones we know the cause of', String(health.totals.known)))}</li></ul>`;
  return `<p class="headline">${escape(headline)}</p><p class="note">${escape(subline)}</p><h2>Patterns</h2>${patterns}<h2>What has come up</h2>${noticed}<h2>What is watched</h2>${watch}<h2>In numbers</h2>${totals}`;
}

/** The read-only page's stop view: it never stops anything itself; it says how, and opens the chat where /stop is confirmed. */
const readOnlyStop = (s, state) => s?.state === 'stopped'
  ? `<p class="headline">${state.kind === 'stale' ? 'Your agent was stopped when it last reported.' : 'Your agent is already stopped.'}</p>`
  : `<p class="headline">To stop your agent, send /stop in your chat with it, then tap Approve.</p><p class="note">It stops at once: nothing more is sent or spent, and your saved messages stay saved. This page only shows your agent; it cannot stop it or approve anything.</p>${
    s?.chat ? `<a class="button danger" href="${chatLink(s.chat)}">Open your chat to send /stop</a>` : ''}`;

/** One dashboard page. `view` is a registered view id or a detail path (`messages/<update>`, `requests/<index>`).
 * `readOnly`: the runner's own page, which has no approval page behind it (`pending` is empty and `token` null). */
export function renderDashboard({ token, view, state, pending, readOnly = false }) {
  const s = state.snapshot, waiting = waitingRows(token, state, pending), stopItem = pending.find(item => item.view.kind === 'stop');
  if (view === 'overview') {
    const headline = !s ? (state.kind === 'missing' ? 'Your agent has not shared its status yet.' : "Your agent's status could not be read.")
      : state.kind === 'stale' ? `Your agent has not updated this page for ${ago(state.age).replace(' ago', '')}.`
        : `${s.state === 'running' ? `Your agent is running${s.sessions.length ? `, working on ${plural(s.sessions.length, 'thing', 'things')} right now` : ''}.`
          : s.state === 'stopped' ? 'Your agent is stopped.' : 'This trial has ended.'} ${
          waiting.length ? `${plural(waiting.length, 'request is', 'requests are')} waiting for you.` : 'Nothing is waiting for you.'}`;
    const calls = s?.allowance[0];
    const tiles = [tile(token, 'waiting', 'Waiting for you', String(waiting.length)),
      // Five tiles at most (floor F10): what is being worked on now takes the place a message count held, since from a phone
      // the first question is what the agent is doing; the messages view stays one tap away in the menu.
      ...(s ? [tile(token, 'sessions', 'Working now', s.sessions.length ? plural(s.sessions.length, 'thing', 'things') : 'Nothing right now'),
        tile(token, 'status', 'Status', s.state === 'running' ? `Running until ${s.until}` : s.state === 'stopped' ? 'Stopped' : 'Ended'),
        tile(token, 'allowance', 'Allowance used', calls ? `${calls.used} of ${calls.max} model calls` : 'Not recorded')]
        : [tile(token, 'status', 'Status', 'Not available')]),
      tile(token, 'stop', 'Stop', s?.state === 'stopped' ? 'Already stopped' : 'Stop your agent', true)];
    return page(token, 'overview', VIEW.overview, state, `<p class="headline">${escape(headline)}</p><div class="tiles">${tiles.join('')}</div>`);
  }
  if (view === 'waiting') return page(token, 'waiting', VIEW.waiting, state, (waiting.length ? waiting.map(row).join('')
    : '<p class="note">Nothing is waiting for you.</p>')
    + (s && s.requests.some(item => !item.open) ? `<h2>Earlier requests</h2>${s.requests.map((item, index) => item.open ? ''
      : row({ href: dashboardPath(token, `requests/${index}`), title: item.title, meta: requestMeta(item) })).join('')}` : ''));
  if (view === 'sessions') return page(token, 'sessions', VIEW.sessions, state, !s ? '' : sessionsBody(token, s));
  if (view === 'health') return page(token, 'health', VIEW.health, state, !s ? '' : healthBody(s.health));
  if (view === 'messages') return page(token, 'messages', VIEW.messages, state, !s ? '' : (s.turns.length
    ? s.turns.map(turn => row({ href: dashboardPath(token, `messages/${turn.update}`),
      title: turn.message.length > 90 ? `${turn.message.slice(0, 89)}…` : turn.message || '(no text)',
      meta: `${turn.time} · ${turn.from === 'you' ? 'From you' : 'Scheduled'} · ${turn.state}` })).join('')
    : '<p class="note">No messages yet in this installation.</p>'));
  if (view === 'status') return page(token, 'status', VIEW.status, state, !s ? ''
    : `<ul class="lines">${s.status.map(line => `<li>${escape(line)}</li>`).join('')}</ul>`);
  if (view === 'allowance') return page(token, 'allowance', VIEW.allowance, state, !s ? ''
    : `<ul class="facts">${s.allowance.map(item => `<li>${escape(`${item.label}: ${item.used} of ${item.max} used.`)}<meter aria-label="${escape(item.label)} used" min="0" max="${item.max}" value="${Math.min(item.used, item.max)}"></meter></li>`).join('')}
<li>${escape(`Model tokens so far: ${s.tokens.input.toLocaleString('en-US')} in, ${s.tokens.output.toLocaleString('en-US')} out.`)}</li>
<li>${escape(`Model calls whose size was not reported: ${s.tokens.unknownCalls}.`)}</li>
<li>Dollar spend is not recorded for this installation.</li></ul>`);
  if (view === 'stop' && readOnly) return page(token, 'stop', VIEW.stop, state, readOnlyStop(s, state));
  if (view === 'stop') return page(token, 'stop', VIEW.stop, state, s?.state === 'stopped'
    ? `<p class="headline">${state.kind === 'stale' ? 'Your agent was stopped when it last reported.' : 'Your agent is already stopped.'}</p>`
    : stopItem ? `<a class="button danger" href="/${token}/c/${stopItem.name}">Stop your agent now</a><p class="note">Your phone's passkey confirms it. Your agent stops at once, and your saved messages stay saved.</p>`
      : `<p class="note">The one-tap stop is not ready on this page right now.${s?.chat ? '' : ' Send /stop in your chat with your agent to stop it.'}</p>${
        s?.chat ? `<a class="button danger" href="${chatLink(s.chat)}">Open your chat and send /stop</a>` : ''}`);
  const [kind, key] = view.split('/');
  if (kind === 'messages' && DETAIL_PATH.test(view)) {
    const turn = s?.turns.find(item => String(item.update) === key) ?? s?.sessionTurns.find(item => String(item.update) === key);
    return page(token, 'messages', DETAIL.message, state, !turn ? (s ? '<p class="note">That message is not in the recent list any more.</p>' : '')
      : `<p class="meta">${escape(`${turn.time} · ${turn.from === 'you' ? 'From you' : 'Scheduled'}`)}</p><p class="quote">${escape(turn.message || '(no text)')}</p>
<h2>Reply</h2>${turn.reply === null ? '<p class="note">No reply yet.</p>' : `<p class="quote">${escape(turn.reply)}</p>`}<p class="note">${escape(turn.state)}</p>`);
  }
  if (kind === 'requests' && DETAIL_PATH.test(view)) {
    const item = s?.requests[Number(key)];
    return page(token, 'waiting', DETAIL.request, state, !item ? (s ? '<p class="note">That request is not in the recent list any more.</p>' : '')
      : `<p class="headline">${escape(item.title)}</p><p class="note">${escape(item.state)}.</p>${item.sharedAccess
        ? `<p class="note">${escape(sharedAccessLine(item.sharedAccess))}</p>` : ''}${!item.open ? ''
        : item.route === 'github-review' ? `<a class="button primary" href="${escape(item.link)}">Answer it on GitHub</a>`
          : s.chat ? `<a class="button primary" href="${chatLink(s.chat)}">Answer it in your chat</a>` : '<p class="note">Answer it in your chat with your agent.</p>'}`);
  }
  return page(token, '', DETAIL.missing, state, '<p class="note">That page does not exist. Choose one of the pages above.</p>');
}

/** The only page shown before sign-in: it reveals nothing from the agent. */
export const renderSignIn = (token, enrolled) => document('Sign in', `<main class="panel"><h1>Sign in</h1><p class="purpose">Your dashboard shows your agent's messages, so your phone's passkey confirms it is you first.</p>${
  enrolled ? '<button class="button primary" id="signin">Sign in with your passkey</button><p class="note" id="result" role="status"></p>'
    : '<p class="note">No passkey is set up for this page yet, so the dashboard cannot open. The one-use set-up link comes from the computer that runs this page.</p>'}</main>`,
  enrolled ? `/${token}/dashboard.js` : null);

/** The read-only page's sign-in: the operator's existing dashboard PIN, checked by the server that already holds it. It
 * reveals nothing from the agent, runs no script, and its one field is the labeled PIN (the sign-in, never a request). */
export const renderPinSignIn = (token, notice = null, next = '') => document('Sign in', `<main class="panel"><h1>Sign in</h1><p class="purpose">Your dashboard shows your agent's messages, so your dashboard PIN confirms it is you first.</p>
<form method="post" action="${dashboardPath(token, 'sign-in')}">${next ? `<input type="hidden" name="next" value="${escape(next)}">` : ''}<label class="label" for="pin">Your dashboard PIN</label>
<input class="field" id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="64" required>
<button class="button primary" id="signin-pin" type="submit">Sign in</button></form>${notice ? `<p class="note" role="status">${escape(notice)}</p>` : ''}
<p class="note">This page only shows your agent. Approvals stay where they are answered today.</p></main>`, null);
