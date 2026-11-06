// Row 89 (Instar 1.x carryover: mobile dashboard, approvals, session listing, Process Health; Rules 79, 80, 81, 87). The
// 1.x source compared is JKHeadley/instar f3f94826a: `GET /sessions` (src/server/routes.ts 10875-10927, active-only
// hygiene CMT-1936 with tests/integration/sessions-listing-hygiene.test.ts), `POST /dashboard/unlock` (src/server/
// AgentServer.ts 1256-1300) and the Process Health tab (dashboard/process-health.js, tests/unit/process-health-render.test.ts).
// Each test here can fail on both sides: the running work is shown AND the finished work leaves; the scoped yes is
// accepted AND the same act, a stranger's key and the PIN page approve nothing; the PIN file opens AND every unusable file
// stays closed.
import { afterEach, expect, it } from 'vitest';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { REPLY_RULES } from './reply-check.js';
import { dashboardSnapshot, healthNow, sessionsNow } from './operator-dashboard.js';
// @ts-expect-error The operator-run page is JavaScript.
import { checkSnapshot, renderDashboard, sanitizeForDisplay, snapshotState } from '../../scripts/operator-dashboard.mjs';
// @ts-expect-error The runner's read-only page is JavaScript.
import { createReadOnlyDashboard, handleReadOnly, pinCheckAt, pinCheckFile, serveReadOnly } from '../../scripts/operator-dashboard-readonly.mjs';
// @ts-expect-error The operator-run approval page is JavaScript.
import { createApprovalSurface, handle } from '../../scripts/approval-surface.mjs';
// @ts-expect-error The runner client is JavaScript.
import { createApprovalSurfaceClient } from './approval-surface-client.mjs';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const key = new Uint8Array(32).fill(23);
const at = Date.UTC(2026, 9, 3, 21), zone = 'America/Los_Angeles';
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: at + 86_400_000, maxCalls: 8, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: at / 1000, text } });
const temp = (prefix: string) => { const root = realpathSync(mkdtempSync(join(tmpdir(), prefix))); cleanup.push(() => rmSync(root, { recursive: true, force: true })); return root; };
/** The floors checker's reading of a page (scripts/check-dashboard-floors.mjs): visible text, and the raw error shapes floor F6 forbids. */
const visible = (html: string) => html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>|<title>[\s\S]*?<\/title>/gu, ' ')
  .replace(/<[^>]+>/gu, ' ').replace(/&#39;/gu, "'").replace(/&quot;/gu, '"').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>')
  .replace(/&amp;/gu, '&').replace(/\s+/gu, ' ').trim();
const RAW_ERROR = /\bundefined\b|\bNaN\b|\[object |Error:|\bnull\b|SyntaxError|ENOENT/u;
const form = (pin: string) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `pin=${pin}` });
const listen = async (dash: unknown) => {
  const server = serveReadOnly(dash, '127.0.0.1:0') as import('node:http').Server;
  cleanup.push(() => server.close());
  await new Promise(done => server.once('listening', done));
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
};

it('row 89: a running conversation and an open delegated session are visible on the phone page with where they run; answered, held and closed work leaves the list (1.x active-only hygiene)', async () => {
  const root = temp('dashboard-mobile-');
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  cleanup.push(() => journal.close());
  // An answered message never reads as running work.
  const worker = createJournalWorker(journal, { now: () => at, timeZone: zone, stopped: () => false, model: async () => 'an answer', checkOutbound: () => {}, send: async () => 7 });
  worker.intake([update(1, 'please remember the garden notes')]); await worker.drain();
  // A message whose answer is in progress, recorded as the runner records it: intake, then the model-call reserve. Its text
  // carries the glyphs and bidi control the 1.x display contract strips (a record field can never impersonate page chrome).
  const text = 'what did I say about the garden? ● → ‮evil‬';
  journal.append({ kind: 'intake', id: 'work', update: 2, text, raw: JSON.stringify(update(2, text)), accepted: true, cursor: 3, at });
  let activity: { text: string; running: boolean } | null = null;
  const input = { now: at, zone, statusText: 'Status', bot: null, stopped: false, machine: 'studio', activity: (id: string) => id === 'work' ? activity : null };
  let snapshot = dashboardSnapshot(journal.view, input);
  expect(checkSnapshot(JSON.parse(JSON.stringify(snapshot)))).toBeTruthy();
  expect(snapshot.sessions).toEqual([{ id: 'work', kind: 'conversation', label: text, state: 'starting', since: '2026-10-03 14:00', machine: 'studio', activity: null, update: 2 }]);
  expect(sessionsNow(journal.view, { now: at, zone })).toEqual([{ ...snapshot.sessions[0], machine: null }]);
  journal.append({ kind: 'reserve', id: 'work', at });
  activity = { text: 'Status: reading garden-notes.md', running: true };
  expect(dashboardSnapshot(journal.view, input).sessions[0]).toMatchObject({ state: 'running', activity: 'Status: reading garden-notes.md' });
  // A delegated child the runner registered (an open session-work edge) is a running session too, with its placement.
  const edge = { type: 'SessionWorkEdge', schemaVersion: 1, id: 'helper-1', parent: 'launch', child: 'helper-1', scope: 'check the saved notes', owner: 'studio',
    authority: 'grant:preview', budget: { steps: 1, calls: 1, tokens: null, maxResultBytes: 1024, deadline: at + 600_000 }, exitTest: 'one result',
    placement: 'studio', transport: 'existing session', resultDestination: '/work/result', openedAt: at + 60_000 };
  journal.append({ kind: 'session-work', record: edge, at: at + 60_000 } as never);
  snapshot = dashboardSnapshot(journal.view, { ...input, now: at + 120_000 });
  expect(checkSnapshot(JSON.parse(JSON.stringify(snapshot)))).toBeTruthy();
  expect(snapshot.sessions.map(item => [item.id, item.kind, item.state, item.machine])).toEqual([['helper-1', 'delegated', 'running', 'studio'], ['work', 'conversation', 'running', 'studio']]);

  // The installed phone path: the runner's own read-only page, over real HTTP, behind the operator's PIN file.
  const pinFile = join(root, 'dashboard-pin');
  writeFileSync(pinFile, '246810\n', { mode: 0o600 }); chmodSync(pinFile, 0o600);
  let published = JSON.stringify(snapshot), clock = at + 120_000;
  const dash = createReadOnlyDashboard({ state: () => snapshotState(published, clock), now: () => clock, checkPin: pinCheckAt(pinFile) });
  const base = await listen(dash);
  expect((await fetch(`${base}/dashboard/sessions`)).status).toBe(401); // nothing before the PIN
  const signedIn = await fetch(`${base}/dashboard/sign-in`, form('246810'));
  expect(signedIn.status).toBe(303);
  const cookie = signedIn.headers.get('set-cookie')!.split(';')[0]!;
  const get = async (path: string) => { const out = await fetch(`${base}${path}`, { headers: { cookie } }); return { status: out.status, html: await out.text() }; };
  const front = await get('/dashboard');
  expect(front.status).toBe(200);
  expect(visible(front.html)).toContain('Your agent is running, working on 2 things right now.');
  expect(front.html).toContain('href="/dashboard/sessions"><span class="label">Working now</span><span class="value">2 things</span>');
  const page = await get('/dashboard/sessions');
  const shown = visible(page.html);
  expect(shown).toContain('what did I say about the garden?');
  expect(shown).toContain('Working on it · since 2026-10-03 14:00 · on studio · Status: reading garden-notes.md');
  expect(shown).toContain('Delegated work');
  expect(shown).toContain('check the saved notes · Working on it · since 2026-10-03 14:01 · on studio');
  expect(page.html).toContain('href="/dashboard/messages/2"'); // the row opens the message it answers (floor F11)
  expect(page.html).not.toMatch(/[●→‮‬]/u); // the 1.x §4.6 strip: chrome glyphs and bidi controls never reach the page from data
  expect(shown).not.toMatch(RAW_ERROR);
  expect(sanitizeForDisplay('ＡＢＣ ● ✓ ‮x‬', 240)).toBe('ABC   x');

  // Both sides: the child closes and the answer is held; neither reads as running any more.
  journal.append({ kind: 'session-work', at: at + 180_000, record: { type: 'SessionWorkEdgeClose', schemaVersion: 1, id: 'close-1', edge: 'helper-1',
    child: 'helper-1', state: 'complete', detail: 'done', evidence: 'result read', resultBytes: 12, closedAt: at + 180_000 } } as never);
  journal.append({ kind: 'answer', id: 'work', text: 'You said to water them on Fridays.', state: 'complete', at: at + 180_000 });
  journal.append({ kind: 'hold', id: 'work', reason: 'reply check unavailable', at: at + 180_000 });
  snapshot = dashboardSnapshot(journal.view, { ...input, now: at + 200_000 });
  expect(snapshot.sessions).toEqual([]);
  expect(snapshot.health.noticed).toEqual([{ category: 'A reply held for review', summary: '1 reply is held: reply check unavailable.', status: 'open', when: '', count: 1 }]);
  published = JSON.stringify(snapshot); clock = at + 200_000;
  expect(visible((await get('/dashboard/sessions')).html)).toContain('Nothing is running right now.');
  expect(visible((await get('/dashboard')).html)).toContain('Your agent is running. Nothing is waiting for you.');
  expect((await get('/dashboard')).html).toContain('<span class="value">Nothing right now</span>');
});

it('row 89: the PIN file signs the operator in with the 1.x unlock comparison; a wrong PIN, and a missing, empty, open, linked or oversized file, open nothing', async () => {
  const root = temp('dashboard-pin-'), file = join(root, 'pin');
  const write = (text: string, mode = 0o600) => { writeFileSync(file, text, { mode }); chmodSync(file, mode); };
  const dash = createReadOnlyDashboard({ state: () => ({ kind: 'missing' }), now: () => at, checkPin: pinCheckAt(file) });
  const attempt = async (pin: string) => (await handleReadOnly(dash, { method: 'POST', path: '/dashboard/sign-in', body: `pin=${pin}` })).status as number;
  expect(await attempt('246810')).toBe(503); // no PIN file yet: "not yet available", never open (the 1.x 503)
  write('246810\n');
  expect(await attempt('135791')).toBe(401);
  expect(await attempt('246810')).toBe(303);
  write('246810', 0o640); // shared with the operator's group: still closed to others
  expect(await attempt('246810')).toBe(303);
  write(''); expect(await attempt('246810')).toBe(503);
  write('246810', 0o644); expect(await attempt('246810')).toBe(503); // readable by other local accounts
  write(`${'2'.repeat(200)}\n`); expect(await attempt('246810')).toBe(503); // oversized file (a PIN over the bound is refused at the body, before any file is read)
  expect(await attempt('2'.repeat(200))).toBe(401);
  write('2468\n10\n'); expect(await attempt('2468')).toBe(503); // more than one line
  rmSync(file); writeFileSync(join(root, 'elsewhere'), '246810', { mode: 0o600 }); symlinkSync(join(root, 'elsewhere'), file);
  expect(await attempt('246810')).toBe(503);
  // The launch refuses a PIN check that is neither a loopback URL nor an absolute path.
  expect(() => pinCheckAt('relative/pin')).toThrow();
  expect(() => pinCheckFile('./pin')).toThrow('absolute path');
  expect(() => pinCheckAt('http://192.168.1.20:4042/dashboard/unlock')).toThrow('loopback');
});

const b64u = (bytes: Buffer | Uint8Array) => Buffer.from(bytes).toString('base64url');
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest();
const ORIGIN = 'https://approve.example.org', RP = 'approve.example.org';
/** A phone passkey stand-in (tests/preview/approval-surface.test.ts): the private key never reaches the page or the runner. */
function authenticator() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }), id = randomBytes(16);
  const client = (type: string, challenge: string) => Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }));
  return {
    create(challenge: string) {
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const auth = Buffer.concat([sha(RP), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, Buffer.from([0xa0])]);
      return { id: b64u(id), alg: -7, publicKey: b64u(publicKey.export({ format: 'der', type: 'spki' })), clientDataJSON: b64u(client('webauthn.create', challenge)), authenticatorData: b64u(auth) };
    },
    get(challenge: string) {
      const data = client('webauthn.get', challenge), auth = Buffer.concat([sha(RP), Buffer.from([0x05]), Buffer.alloc(4)]);
      return { credentialId: b64u(id), clientDataJSON: b64u(data), authenticatorData: b64u(auth), signature: b64u(sign('sha256', Buffer.concat([auth, sha(data)]), privateKey)) };
    } };
}
const RAISE_TEXT = 'Approve raising the model call allowance from 8 to 16? That adds 8 model calls I may spend in this trial.';

it('row 89: a scoped approval binds exactly the request and scope the operator saw; the same act approves no other request, an unenrolled passkey approves nothing, and the PIN page has no approval route', async () => {
  const root = temp('dashboard-approval-'), store = join(root, 'store'), outbox = join(root, 'outbox');
  for (const directory of [store, outbox]) { mkdirSync(directory, { mode: 0o755 }); chmodSync(directory, 0o755); }
  let clock = at;
  const uid = process.getuid!();
  const config = { operator: 'telegram:7654321', operatorUid: uid, agentUid: uid + 1, ingressGrant: 'desk:row-89-test', publicBase: ORIGIN, store, outbox };
  const surface = createApprovalSurface(config, () => clock), token = surface.surface.token as string;
  const call = (method: string, path: string, body?: unknown) => handle(surface, { method, path: `/${token}${path}`, body: body === undefined ? undefined : JSON.stringify(body) }) as { status: number; body: string };
  const phone = authenticator(), code = (surface.enrol() as string).split('#')[1]!;
  call('POST', '/enrol/finish', { code, registration: phone.create(JSON.parse(call('POST', '/enrol/begin', { code }).body).challenge) });
  const client = createApprovalSurfaceClient({ store, outbox, operatorUid: uid, agentUid: uid + 1, now: () => clock });
  const digest = (text: string) => `sha256:${sha(text).toString('hex')}`;
  const subject = (request: string, members: string[]) => ({ request, requestDigest: digest(request), artifact: digest(request), base: 'base:fixture', issuedAt: clock,
    expiresAt: clock + 3_600_000, singleUse: true, surface: 'preview-approval-surface', generation: 'generation:fixture', operator: config.operator, action: 'raise-caps',
    audience: 'operator-private-chat', requestedBy: 'preview-agent', renderingDigest: digest(RAISE_TEXT), scope: { type: 'Scope', schemaVersion: 1, kind: 'conversation', members } });
  const issue = (request: string, members: string[]) => { client.wording(digest(RAISE_TEXT), RAISE_TEXT);
    const out = client.verifier.issue(subject(request, members)) as { kind: string; value: { id: string; scope: { members: string[] } } };
    expect(out).toMatchObject({ kind: 'Success' }); return out.value; };
  const narrow = issue('req-a', ['7654321']), wide = issue('req-b', ['7654321', '999999']);
  const name = (id: string) => sha(id).toString('hex');
  // The operator approves the narrow request with the enrolled passkey: the page records the act once.
  const begin = JSON.parse(call('POST', '/begin', { name: name(narrow.id), decision: 'approve' }).body);
  const act = call('POST', '/act', { name: name(narrow.id), decision: 'approve', nonce: begin.nonce, assertion: phone.get(begin.challenge) });
  expect(act.status, act.body).toBe(200);
  const proof = readFileSync(join(store, 'acts', `${name(narrow.id)}.json`), 'utf8');
  // The runner re-verifies it and gets an authorization bound to exactly that request, its digest and its scope.
  expect(client.verifier.verify(narrow, proof, 'approve')).toMatchObject({ kind: 'Success', value: { challenge: narrow.id, principal: { id: 'telegram:7654321', kind: 'person' },
    provenance: { class: 'verified' }, act: { type: 'Authorization', request: 'req-a', requestDigest: digest('req-a') } } });
  expect(narrow.scope.members).toEqual(['7654321']);
  // Unauthorized: the same act cannot stand for the wider request, nor for a decline of the one it answered.
  expect(client.verifier.verify(wide, proof, 'approve')).toMatchObject({ kind: 'Refused', detail: expect.stringContaining('act differs from the exact challenge') });
  expect(client.verifier.verify(narrow, proof, 'decline')).toMatchObject({ kind: 'Refused' });
  // Unauthorized: a passkey that is not enrolled records nothing for the wider request.
  const stranger = authenticator(), beginWide = JSON.parse(call('POST', '/begin', { name: name(wide.id), decision: 'approve' }).body);
  const forged = call('POST', '/act', { name: name(wide.id), decision: 'approve', nonce: beginWide.nonce, assertion: stranger.get(beginWide.challenge) });
  expect(forged.status).toBe(400);
  expect(existsSync(join(store, 'acts', `${name(wide.id)}.json`))).toBe(false);
  expect(client.acts().map((item: { challenge: string }) => item.challenge)).toEqual([]); // the narrow act is consumed; nothing else is recorded
  // Unauthorized: the PIN-signed read-only page has no route that could approve, so a genuine assertion sent there records nothing.
  const dash = createReadOnlyDashboard({ state: () => ({ kind: 'missing' }), now: () => clock, checkPin: async () => true });
  const signedIn = await handleReadOnly(dash, { method: 'POST', path: '/dashboard/sign-in', body: 'pin=246810' });
  const cookie = (signedIn.headers['set-cookie'] as string).split(';')[0]!;
  const fresh = JSON.parse(call('POST', '/begin', { name: name(wide.id), decision: 'approve' }).body);
  const body = JSON.stringify({ name: name(wide.id), decision: 'approve', nonce: fresh.nonce, assertion: phone.get(fresh.challenge) });
  for (const path of ['/dashboard/act', '/dashboard/begin', `/${token}/act`, '/act', '/dashboard/requests/0'])
    expect([path, (await handleReadOnly(dash, { method: 'POST', path, body, cookie })).status]).toEqual([path, 404]);
  expect(existsSync(join(store, 'acts', `${name(wide.id)}.json`))).toBe(false);
  clock += 1; // the wider request stays open and unanswered on the surface
  expect((surface.pending() as { name: string; decided: boolean }[]).map(item => [item.name, item.decided])).toEqual([[name(wide.id), false]]);
});

it("row 89: process health speaks in the 1.x tab's calm wording from the journal's own records, says all quiet when nothing came up, and lets no raw error text through", async () => {
  const root = temp('dashboard-health-');
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  cleanup.push(() => journal.close());
  const outcomes = [{ kind: 'refused', reason: 'Error: ENOENT boom' }, { kind: 'refused', reason: 'telegram 403: Forbidden' }, { kind: 'unknown', reason: 'transport timeout' }];
  let next = 0;
  const worker = createJournalWorker(journal, { now: () => at + next * 60_000, timeZone: zone, stopped: () => false, model: async () => 'an answer', checkOutbound: () => {},
    send: async input => (input.target?.startsWith('delivery-notice:') ? 99 : outcomes[next++]) as never });
  for (const id of [1, 2, 3]) { worker.intake([update(id, `message ${String(id)}`)]); await worker.drain(); }
  const health = healthNow(journal.view, zone);
  expect(health.noticed.map(item => [item.category, item.count, item.status])).toEqual([['A message whose delivery is unknown', 1, 'open'], ['A message that could not be delivered', 2, 'attributed']]);
  expect(health.noticed[1]).toMatchObject({ summary: '2 messages were refused by the chat service; none is sent again, and each is marked in Recent messages.', when: expect.stringMatching(/^2026-10-03 14:0\d$/u) });
  expect(health.patterns).toEqual([{ summary: 'A message that could not be delivered keeps coming up: the same kind of problem 2 times.', timesSeen: 2, status: 'attributed' }]);
  expect(health.totals).toEqual({ noticed: 3, known: 2 });
  expect(health.watch).toMatchObject({ recording: true, reviewing: false });
  const snapshot = dashboardSnapshot(journal.view, { now: at, zone, statusText: 'Status', bot: null, stopped: false });
  expect(checkSnapshot(JSON.parse(JSON.stringify(snapshot)))).toBeTruthy();
  const text = visible(renderDashboard({ token: 'a'.repeat(32), view: 'health', state: { kind: 'ok', snapshot, age: 0 }, pending: [] }) as string);
  expect(text).toContain('Keeping an eye out — 3 things noticed so far');
  expect(text).toContain('Still looking into 1 of them. Just quietly watching — no alerts yet.');
  expect(text).toContain('keeps coming up: the same kind of problem 2 times. · Status: We know what caused it · Times seen: 2 times so far');
  expect(text).toContain('A message whose delivery is unknown: 1 message may or may not have arrived; none is sent again, so nothing is doubled. · Status: Still looking into this · Times seen: Just once · First noticed: 2026-10-03');
  expect(text).toContain('● Quietly recording what comes up · on');
  expect(text).toContain('○ Reviewing patterns in retrospect · not seen yet');
  expect(text).toContain('Total noticed: 3 · Ones we know the cause of: 2'.replace(' · ', ' '));
  expect(text).not.toMatch(RAW_ERROR); // the provider's "Error: ENOENT boom" stays in the journal; the health page never shows raw error text
  // The quiet neighbor: a journal where nothing came up.
  const quiet = openPreviewJournal(join(root, 'quiet.encrypted'), key, genesis);
  cleanup.push(() => quiet.close());
  expect(healthNow(quiet.view, zone)).toEqual({ noticed: [], patterns: [], watch: { recording: true, checking: false, reviewing: false }, totals: { noticed: 0, known: 0 } });
  const calm = visible(renderDashboard({ token: 'a'.repeat(32), view: 'health', state: { kind: 'ok', snapshot: dashboardSnapshot(quiet.view, { now: at, zone, statusText: 'Status', bot: null, stopped: false }), age: 0 }, pending: [] }) as string);
  expect(calm).toContain('Keeping an eye out — all quiet so far');
  expect(calm).toContain("Nothing has come up yet. We're just quietly watching — no alerts.");
  expect(calm).toContain('Nothing to flag yet. We need to see a few more different problems before a real pattern shows up — totally normal this early.');
  expect(calm).toContain('Nothing yet — that just means nothing has come up since your agent started.');
});

it.each(['advisory', 'outage', 'held'] as const)('row 89 repair: check events do not invent reply outcomes (%s)', async mode => {
  const root = temp('dashboard-check-outcome-');
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  cleanup.push(() => journal.close());
  const rule = mode === 'held' ? 'credential' : 'config_key';
  const draft = 'The setting is notifications.email.enabled.';
  const sends: string[] = [];
  const worker = createJournalWorker(journal, { now: () => at, timeZone: zone, stopped: () => false,
    model: async () => draft, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES)
        .filter(id => id !== 'incoherent_remainder').map(id => [id, { type: 'noul', noul: id === rule ? 0.91 : 0.01 }])) }, latencyMs: 0 }),
      escalate: async () => {
        if (mode === 'outage') throw Error('reviewer unavailable');
        return { verdict: 'violation' as const, ruleIds: [rule], confidence: null, latencyMs: 0, reason: 'Review found a problem.' };
      } },
    send: async input => { sends.push(input.expectedText); return sends.length; } });
  worker.intake([update(1, 'What is the notification setting?')]);
  await worker.drain();
  const turn = journal.view.order[0]!;
  const held = mode === 'held';
  expect(sends.some(text => text.includes(draft))).toBe(!held);
  if (held) expect(turn.heldReview).toBeTruthy();
  else expect(turn.release).toMatchObject({ review: mode === 'outage' ? 'unavailable' : 'violation' });
  const snapshot = dashboardSnapshot(journal.view, { now: at, zone, statusText: 'Status', bot: null, stopped: false });
  expect(checkSnapshot(snapshot)).toBeTruthy();
  expect(snapshot.counts.held).toBe(0); // No pending turn hold: a reviewed hold sends a content-free notice.
  expect(snapshot.turns[0]!.state).toMatch(held ? /^Reply held for review; holding notice delivered$/u : /^Answered$/u);
  const checks = snapshot.health.noticed.filter(item => item.category.startsWith('A reply check'));
  expect(checks.length).toBeGreaterThan(0);
  for (const check of checks) {
    expect(check.status).toBe('open');
    expect(check.summary).not.toMatch(/held|revised|resolved/u);
  }
  expect(snapshot.health.noticed.some(item => item.category === 'A draft held by its reply check')).toBe(held);
  const health = visible(renderDashboard({ token: null, view: 'health', state: { kind: 'ok', snapshot, age: 0 }, pending: [], readOnly: true }) as string);
  expect(health).not.toContain('Worked out');
  expect(health).not.toContain('held rather than sent');
  expect(health).toContain(mode === 'outage' ? 'could not run' : 'reported a problem');
  const detail = visible(renderDashboard({ token: null, view: 'messages/1', state: { kind: 'ok', snapshot, age: 0 }, pending: [], readOnly: true }) as string);
  expect(detail).toContain(held ? 'Reply held for review; holding notice delivered' : 'Answered');
});

it('row 89 repair: every active conversation link resolves beyond the recent-ten window, with bounded redacted details', async () => {
  const root = temp('dashboard-active-details-');
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxTurns: 40 });
  cleanup.push(() => journal.close());
  const worker = createJournalWorker(journal, { now: () => at, timeZone: zone, stopped: () => false,
    model: async () => 'an answer', checkOutbound: () => {}, send: async () => 1 });
  const input = { now: at, zone, statusText: 'Status', bot: null, stopped: false };
  const secret = 'sk-' + 'a'.repeat(48);
  // Eleven accepted, pending messages reproduce the first advertised link missing from Recent messages.
  for (let id = 1; id <= 11; id++) worker.intake([update(id, `Active question ${id}: <script>unsafe()</script> ${secret} ${'notes '.repeat(100)}`)]);
  let snapshot = dashboardSnapshot(journal.view, input);
  expect(snapshot.turns).toHaveLength(10);
  expect(snapshot.turns.some(turn => turn.update === 1)).toBe(false);
  expect(snapshot.sessions).toHaveLength(11);
  expect(snapshot.sessionTurns).toHaveLength(11);
  expect(JSON.stringify(snapshot)).not.toContain(secret);
  const dash = createReadOnlyDashboard({ state: () => snapshotState(JSON.stringify(snapshot), at), now: () => at, checkPin: async () => true });
  const signedIn = await handleReadOnly(dash, { method: 'POST', path: '/dashboard/sign-in', body: 'pin=246810' });
  const cookie = (signedIn.headers['set-cookie'] as string).split(';')[0]!;
  const get = (path: string) => handleReadOnly(dash, { method: 'GET', path, cookie });
  const sessions = await get('/dashboard/sessions');
  expect(sessions.status).toBe(200);
  expect(sessions.body).toContain('href="/dashboard/messages/1"');
  for (const session of snapshot.sessions) {
    const detail = await get(`/dashboard/messages/${session.update}`);
    expect(detail.status).toBe(200);
    expect(visible(detail.body)).toContain(`Active question ${session.update}:`);
    expect(visible(detail.body)).toContain('Waiting for my answer');
    expect(detail.body).not.toContain('not in the recent list');
    expect(detail.body).not.toContain('<script>unsafe()');
  }
  // The same renderer serves the passkey page's prefixed routes.
  expect(renderDashboard({ token: 'a'.repeat(32), view: 'sessions', state: { kind: 'ok', snapshot, age: 0 }, pending: [] }))
    .toContain(`href="/${'a'.repeat(32)}/dashboard/messages/1"`);
  expect(visible(renderDashboard({ token: 'a'.repeat(32), view: 'messages/1', state: { kind: 'ok', snapshot, age: 0 }, pending: [] }) as string))
    .toContain('Active question 1:');
  for (let id = 12; id <= 30; id++) worker.intake([update(id, `Active question ${id}`)]);
  snapshot = dashboardSnapshot(journal.view, input);
  expect(checkSnapshot(snapshot)).toBeTruthy();
  expect(snapshot.sessions).toHaveLength(16);
  expect(snapshot.sessionTurns).toHaveLength(16);
  for (const session of snapshot.sessions) expect(snapshot.sessionTurns.some(turn => turn.update === session.update)).toBe(true);
  expect(snapshot.sessionTurns.every(turn => turn.message.length <= 500)).toBe(true);
  for (const turn of journal.view.order) journal.append({ kind: 'hold', id: turn.id, reason: 'stopped', at });
  snapshot = dashboardSnapshot(journal.view, input);
  expect(snapshot.sessions).toEqual([]);
  expect(snapshot.sessionTurns).toEqual([]);
  expect(snapshot.health.noticed).toContainEqual(expect.objectContaining({ category: 'A reply held for review', count: 30, status: 'open' }));
  expect(snapshot.turns.every(turn => turn.state === 'Held: stopped')).toBe(true);
});
