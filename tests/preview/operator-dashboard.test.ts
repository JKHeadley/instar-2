// The operator dashboard (Rules 79, 80, 81, 87; README "The operator dashboard"). The agent's runner projects one snapshot
// from the journal with the chat status answer's own functions; the operator's approval page renders it only behind the
// operator's passkey. Inputs are recorded live shapes (tests/fixtures/dashboard-recorded-shapes.json, observer #106).
import { afterEach, expect, it } from 'vitest';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, limitedAnswerText, openPreviewJournal } from './journal-test-worker.js';
import { operatorRequestsReport, type JournalView, type OperatorRequestState } from './journal.js';
import { dashboardSnapshot } from './operator-dashboard.js';
import { SHARED_ACCESS_NOTE } from '../../src/operator/explicit-yes.js';
import { statusAnswer, turnsToday } from './status-command.js';
// @ts-expect-error The operator-run page is JavaScript.
import { checkSnapshot, DASHBOARD_BOUNDS, DASHBOARD_FILE, DASHBOARD_VIEWS, DETAIL_PATH, readSnapshot, renderDashboard } from '../../scripts/operator-dashboard.mjs';
// @ts-expect-error The Q81 floor check is JavaScript.
import { FLOORS, runDashboardChecks } from '../../scripts/check-dashboard-floors.mjs';
// @ts-expect-error The runner client is JavaScript.
import { createApprovalSurfaceClient } from './approval-surface-client.mjs';

const recorded = JSON.parse(readFileSync('tests/fixtures/dashboard-recorded-shapes.json', 'utf8')) as {
  statusLong: { text: string; update: number }; statusNormal: { text: string };
  turns: { update: number; message: string; reply: string }[]; operatorRequests: { rows: Record<string, unknown>[] } };
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const key = new Uint8Array(32).fill(23);
const at = Date.UTC(2026, 9, 3, 21), zone = 'America/Los_Angeles';
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: at + 86_400_000, maxCalls: 4, maxReplies: 6, maxTurns: 8, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: at / 1000, text } });
const temp = (prefix: string) => { const root = realpathSync(mkdtempSync(join(tmpdir(), prefix))); cleanup.push(() => rmSync(root, { recursive: true, force: true })); return root; };

function recordedJournal() {
  const journal = openPreviewJournal(join(temp('dashboard-journal-'), 'journal.encrypted'), key, genesis);
  cleanup.push(() => journal.close());
  let reply = 0;
  const worker = createJournalWorker(journal, { now: () => at, timeZone: zone, stopped: () => false,
    model: async () => recorded.turns[reply++]!.reply, send: async () => 100 + reply, checkOutbound: () => {} });
  return { journal, worker };
}

it('publishes the exact chat status answer and each recorded message with the journal\'s own outcome', async () => {
  const { journal, worker } = recordedJournal();
  worker.intake([update(1, recorded.turns[0]!.message)]); await worker.drain();
  worker.intake([update(2, 'status')]); await worker.drain();
  journal.append({ kind: 'intake', id: 'held', update: 3, text: recorded.turns[1]!.message, raw: JSON.stringify(update(3, recorded.turns[1]!.message)),
    accepted: true, cursor: 4, at });
  journal.append({ kind: 'reserve', id: 'held', at });
  journal.append({ kind: 'answer', id: 'held', text: 'uncertain', state: 'complete', at });
  journal.append({ kind: 'hold', id: 'held', reason: 'reply check unavailable', at });
  const view = journal.view, statusText = statusAnswer(view, at, zone, ['Serving: test line.'], ['Build: test line.']);
  const snapshot = dashboardSnapshot(view, { now: at, zone, statusText, bot: '@example_agent_bot', stopped: false });
  expect(checkSnapshot(JSON.parse(JSON.stringify(snapshot)))).toBeTruthy();
  // One source: the dashboard's status is the chat status answer, line for line, and the reply the operator got starts the same way.
  expect(snapshot.status.join('\n')).toBe(statusText);
  expect(view.order[1]!.intent).toContain(snapshot.status[0]!);
  expect(snapshot.counts).toEqual({ turnsToday: turnsToday(view, at, zone), held: 1, waiting: 0 });
  expect(snapshot.turns.map(turn => [turn.update, turn.state])).toEqual([[3, 'Held: reply check unavailable'], [2, 'Answered'], [1, 'Answered']]);
  expect(snapshot.turns[2]).toMatchObject({ from: 'you', message: recorded.turns[0]!.message, reply: expect.stringContaining('garden-notes') });
  expect(snapshot.allowance[0]).toEqual({ label: 'Model calls', used: view.calls, max: 4 });
  expect(snapshot).toMatchObject({ state: 'running', chat: 'example_agent_bot' });
  // Both sides of the state decision.
  expect(dashboardSnapshot(view, { now: at, zone, statusText, bot: null, stopped: true }).state).toBe('stopped');
  expect(dashboardSnapshot(view, { now: view.expires, zone, statusText, bot: null, stopped: false }).state).toBe('ended');
  expect(dashboardSnapshot(view, { now: at, zone, statusText, bot: 'not a username!', stopped: false }).chat).toBeNull();
  // The recorded 3.6 KB status (a 1,900-character line of update ids) passes whole, never clipped.
  const long = dashboardSnapshot(view, { now: at, zone, statusText: recorded.statusLong.text, bot: null, stopped: false });
  expect(long.status.join('\n')).toBe(recorded.statusLong.text);
  expect(checkSnapshot(JSON.parse(JSON.stringify(long)))).toBeTruthy();
});

const snapshotOf = (view: JournalView, now = at) => {
  const snapshot = dashboardSnapshot(view, { now, zone, statusText: 'Status', bot: null, stopped: false });
  expect(checkSnapshot(JSON.parse(JSON.stringify(snapshot)))).toBeTruthy();
  return snapshot;
};
const render = (snapshot: unknown, view: string, now = at, pending: unknown[] = []) => {
  const outbox = temp('dashboard-render-');
  writeFileSync(join(outbox, DASHBOARD_FILE), JSON.stringify(snapshot), { mode: 0o640 }); chmodSync(join(outbox, DASHBOARD_FILE), 0o640);
  return renderDashboard({ token: 'a'.repeat(32), view, state: readSnapshot(outbox, now), pending }) as string;
};

it('each message shows its durable send outcome: accepted, refused and UNKNOWN are settled, never "Sending" (Rules 26, 42)', async () => {
  const journal = openPreviewJournal(join(temp('dashboard-outcomes-'), 'journal.encrypted'), key, { ...genesis, maxCalls: 10, maxReplies: 10 });
  cleanup.push(() => journal.close());
  const outcomes = [{ kind: 'refused', reason: 'telegram 403: Forbidden: bot was blocked by the user' }, { kind: 'unknown', reason: 'transport timeout' }, 7];
  let next = 0;
  const worker = createJournalWorker(journal, { now: () => at, timeZone: zone, stopped: () => false, model: async () => 'an answer',
    checkOutbound: () => {}, send: async () => outcomes[next++] as never });
  worker.intake([update(1, 'first')]); await worker.drain();
  worker.intake([update(2, 'second')]); await worker.drain();
  worker.intake([update(3, 'third')]); await worker.drain();
  const turns = snapshotOf(journal.view).turns;
  expect(turns.map(turn => turn.update)).toEqual([3, 2, 1]);
  expect(turns[0]).toMatchObject({ state: 'Answered', reply: expect.stringContaining('an answer') });
  expect(turns[1]!.state).toBe('My reply may or may not have arrived: delivery is UNKNOWN (transport timeout); it is not sent again');
  expect(turns[2]!.state).toBe('My reply was refused and not delivered (telegram 403: Forbidden: bot was blocked by the user); it is not sent again');
  for (const turn of turns) expect(turn.state).not.toMatch(/^Sending/u);
  // The neighbour: an intent whose outcome is not recorded yet (in flight, or the crash gap) says so, never delivery.
  const inFlight = { ...journal.view, sendOutcomes: journal.view.sendOutcomes.filter(item => item.outcome !== 'unknown') } as JournalView;
  expect(snapshotOf(inFlight).turns[1]).toMatchObject({ update: 2, state: 'Sending my reply: not confirmed delivered yet' });
}, 60000);

it('every message a delivered limited answer covers shows that answer, and a refused one says so', async () => {
  for (const refuse of [false, true]) {
    const journal = openPreviewJournal(join(temp('dashboard-limited-'), 'journal.encrypted'), key, { ...genesis, maxCalls: 8, maxReplies: 8, maxTurns: 2 });
    cleanup.push(() => journal.close());
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => at, timeZone: zone, stopped: () => false, model: async () => 'ordinary answer',
      checkOutbound: () => {}, send: async () => (++sends === 3 && refuse ? { kind: 'refused', reason: 'telegram 400: chat not found' } : sends) as never });
    worker.intake([update(1, 'one'), update(2, 'two')]); await worker.drain();
    worker.intake([update(3, 'three'), update(4, 'four')]); await worker.drain();
    const [four, three] = snapshotOf(journal.view).turns;
    const text = limitedAnswerText(journal.view, 'turns', 2);
    for (const turn of [three!, four!]) {
      expect(turn.reply).toContain(text.slice(0, 60));
      expect(turn.state).toBe(refuse ? 'My brief answer (the allowance was reached) was refused and not delivered (telegram 400: chat not found); it is not sent again'
        : 'Answered briefly: the allowance was reached');
    }
    expect(render(snapshotOf(journal.view), 'messages/4')).not.toContain('No reply yet');
  }
}, 60000);

it('a scheduled reminder\'s fractional update publishes and opens its own page; an off-grid update is refused', async () => {
  const start = Date.UTC(2026, 8, 26, 17), due = Date.UTC(2026, 9, 2, 16), priya = 'remind me Friday at 9 am to call Priya';
  const clock = { now: start };
  const journal = openPreviewJournal(join(temp('dashboard-scheduled-'), 'journal.encrypted'), key,
    { ...genesis, maxCalls: 40, maxReplies: 12, maxTurns: 12, maxBytes: 12000, expires: Date.UTC(2026, 9, 10) });
  cleanup.push(() => journal.close());
  const worker = createJournalWorker(journal, { now: () => clock.now, timeZone: zone, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string; question: string }) => input.id.startsWith('requested-action:') ? `Doing what you asked: ${priya}.`
      : JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: priya, when: 'Friday at 9 am', remind: true }] }),
    send: async () => 50 });
  worker.intake([{ ...update(3, priya), message: { ...update(3, priya).message, date: Math.floor(start / 1000) } }]); await worker.drain();
  clock.now = due; await worker.sendRequested();
  const snapshot = snapshotOf(journal.view, due);
  expect(snapshot.turns.map(turn => [turn.update, turn.from])).toEqual([[3 + 1 / 1024, 'scheduled'], [3, 'you']]);
  const path = `messages/${String(3 + 1 / 1024)}`;
  expect(DETAIL_PATH.test(path)).toBe(true);
  const html = render(snapshot, path, due);
  expect(html).toContain('Doing what you asked');
  expect(html).not.toContain('That page does not exist');
  for (const bad of [1 / 3, -1, Number.NaN, 3 + 1 / 2048])
    expect(() => checkSnapshot({ ...snapshot, turns: [{ ...snapshot.turns[0], update: bad }] })).toThrow('dashboard update invalid');
  expect(DETAIL_PATH.test('messages/3.0009765625x')).toBe(false);
  // The live proof room 2 shape (2026-10-02, journal-synthetic-frontier.test.ts): due turn 6230515.0009765625 beside 6230515.
  const live = { ...snapshot, turns: [{ ...snapshot.turns[0]!, update: 6230515.0009765625 }, { ...snapshot.turns[1]!, update: 6230515 }] };
  expect(checkSnapshot(live)).toBeTruthy();
  expect(render(live, 'messages/6230515.0009765625', due)).toContain('Doing what you asked');
}, 60000);

it('every view, detail pages included, states a stale or unreadable snapshot (the loss detector, purpose Rule 2)', () => {
  const { journal } = recordedJournal();
  const stale = { ...snapshotOf(journal.view), turns: [{ update: 7, time: '2026-10-03 14:00', from: 'you', message: 'hi', reply: null, state: 'Waiting for my answer' }],
    requests: [{ title: 'Extend this trial', state: 'Approved and done', open: false, route: 'chat', link: null, sharedAccess: null }] };
  const later = at + 7 * 60_000;
  for (const view of [...DASHBOARD_VIEWS.map((item: { id: string }) => item.id), 'messages/7', 'requests/0', 'nowhere']) {
    expect(render(stale, view, later), view).toContain('Last updated by your agent 7 minutes ago');
    expect(render(stale, view, at), view).not.toContain('Last updated by your agent');
  }
  expect(render({ ...stale, state: 'stopped' }, 'stop', later)).toContain('Your agent was stopped when it last reported.');
  // An unreadable snapshot is said even when the page's own pending approvals fill the waiting list.
  const pending = [{ name: 'b'.repeat(64), view: { kind: 'raise', title: 'Raise the allowance' } }];
  const waiting = render({ ...stale, chat: 'x' }, 'waiting', at, pending);
  expect(waiting).toContain('Raise the allowance');
  expect(waiting).toContain("latest status could not be read");
});

it('an open recorded GitHub-review request links straight to its review; a lapsed one is shown closed', () => {
  const { journal } = recordedJournal();
  const row = recorded.operatorRequests.rows[0]!;
  const state = { request: { id: row.id, action: row.action, expiresAt: at + 3_600_000 }, carrier: 'c', via: row.via, thread: null, message: 9,
    review: { repository: 'JKHeadley/instar-2', pullRequest: 145, head: '0'.repeat(40) }, refusals: (row.refusals as string[]).map(detail => ({ turn: 't', detail })) };
  const view = { ...journal.view, operatorRequests: [state as unknown as OperatorRequestState] } as JournalView;
  // The stub reproduces the recorded status row exactly, so the mapping below runs on the live shape.
  expect(operatorRequestsReport(view, at)).toEqual([row]);
  const open = dashboardSnapshot(view, { now: at, zone, statusText: 'Status', bot: null, stopped: false });
  expect(open.requests).toEqual([{ title: "Let me continue past this trial's allowance", state: 'Waiting for your answer', open: true,
    route: 'github-review', link: 'https://github.com/JKHeadley/instar-2/pull/145/files', sharedAccess: null }]);
  expect(open.counts.waiting).toBe(1);
  const lapsed = dashboardSnapshot(view, { now: at + 3_600_001, zone, statusText: 'Status', bot: null, stopped: false });
  expect(lapsed.requests[0]).toMatchObject({ open: false, state: 'Expired unanswered', sharedAccess: null });
  expect(lapsed.counts.waiting).toBe(0);
  expect(render(lapsed, 'requests/0')).not.toContain(SHARED_ACCESS_NOTE);
  // Purpose (the approval-account exception): an approval admitted under shared account access carries its disclosure
  // wherever the dashboard displays it; the independent approval above never acquires one.
  const shared = { ...state, applied: true, approved: { turn: 't', reference: 'github-review:JKHeadley/instar-2#145', hash: 'h', at,
    sharedAccess: { account: 'github:JKHeadley', installation: 'i', acceptedAt: at, note: SHARED_ACCESS_NOTE } } };
  const approved = dashboardSnapshot({ ...view, operatorRequests: [shared as unknown as OperatorRequestState] } as JournalView,
    { now: at, zone, statusText: 'Status', bot: null, stopped: false });
  expect(approved.requests[0]).toMatchObject({ state: 'Approved and done', sharedAccess: { account: 'github:JKHeadley', disclosure: SHARED_ACCESS_NOTE } });
  for (const page of ['requests/0', 'waiting']) expect(render(approved, page)).toContain(SHARED_ACCESS_NOTE);
});

it('the page treats the snapshot as untrusted: closed shape, bounded, links only to a GitHub review, everything escaped', () => {
  const outbox = temp('dashboard-outbox-'), now = 1_790_900_000_000;
  const good = { type: 'PreviewOperatorDashboard', schemaVersion: 1, asOf: now, zone, state: 'running', until: '2026-10-12 13:40',
    status: recorded.statusNormal.text.split('\n'), counts: { turnsToday: 1, held: 0, waiting: 1 },
    allowance: [{ label: 'Model calls', used: 1, max: 4 }], tokens: { input: 1, output: 1, unknownCalls: 0 },
    requests: [{ title: 'Extend this trial', state: 'Waiting for your answer', open: true, route: 'github-review', link: 'https://github.com/a/b/pull/1/files', sharedAccess: null }],
    turns: [{ update: 1, time: '2026-10-03 14:00', from: 'you', message: '<script>alert(1)</script>', reply: null, state: 'Waiting for my answer' }], chat: null };
  const write = (value: unknown, mode = 0o644) => { writeFileSync(join(outbox, DASHBOARD_FILE), JSON.stringify(value), { mode }); chmodSync(join(outbox, DASHBOARD_FILE), mode); };
  expect(readSnapshot(outbox, now)).toEqual({ kind: 'missing' });
  write(good);
  expect(readSnapshot(outbox, now + DASHBOARD_BOUNDS.staleMs).kind).toBe('ok');
  expect(readSnapshot(outbox, now + DASHBOARD_BOUNDS.staleMs + 1).kind).toBe('stale');
  const html = renderDashboard({ token: 'a'.repeat(32), view: 'messages/1', state: readSnapshot(outbox, now), pending: [] }) as string;
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).not.toContain('<script>alert');
  for (const bad of [{ ...good, extra: 1 }, { ...good, requests: [{ ...good.requests[0], link: 'javascript:alert(1)' }] },
    { ...good, requests: [{ ...good.requests[0], link: 'https://github.com.evil.test/a/b/pull/1/files' }] },
    { ...good, requests: [{ ...good.requests[0], route: 'chat' }] }, { ...good, chat: 'x' },
    { ...good, status: Array(DASHBOARD_BOUNDS.statusLines + 1).fill('line') }, { ...good, turns: [{ ...good.turns[0], from: 'operator' }] }]) {
    write(bad);
    expect(readSnapshot(outbox, now)).toEqual({ kind: 'invalid' });
  }
  write(good, 0o664);
  expect(readSnapshot(outbox, now)).toEqual({ kind: 'invalid' }); // writable by others
  rmSync(join(outbox, DASHBOARD_FILE));
  writeFileSync(join(outbox, 'elsewhere.json'), JSON.stringify(good), { mode: 0o644 });
  symlinkSync(join(outbox, 'elsewhere.json'), join(outbox, DASHBOARD_FILE));
  expect(readSnapshot(outbox, now)).toEqual({ kind: 'invalid' });
});

it('the runner publishes only a snapshot the page accepts, replaced whole in its own outbox', () => {
  const root = temp('dashboard-client-'), store = join(root, 'store'), outbox = join(root, 'outbox');
  for (const directory of [store, outbox]) { mkdirSync(directory, { mode: 0o755 }); chmodSync(directory, 0o755); }
  const uid = process.getuid!();
  const client = createApprovalSurfaceClient({ store, outbox, operatorUid: uid + 1, agentUid: uid, now: () => at });
  const { journal } = recordedJournal();
  const snapshot = dashboardSnapshot(journal.view, { now: at, zone, statusText: recorded.statusNormal.text, bot: null, stopped: false });
  const file = join(outbox, DASHBOARD_FILE);
  // Message excerpts never go into an outbox other local accounts can enter (least revelation) ...
  expect(() => client.publish(snapshot)).toThrow('dashboard outbox must not be open to other local accounts');
  expect(() => lstatSync(file)).toThrow();
  // ... and in the outbox closed to them (its group shared with the page) the file is owner and group only.
  chmodSync(outbox, 0o750);
  client.publish(snapshot);
  expect(lstatSync(file).mode & 0o777).toBe(0o640);
  expect(readSnapshot(outbox, at)).toMatchObject({ kind: 'ok', snapshot: { status: recorded.statusNormal.text.split('\n') } });
  client.publish({ ...snapshot, counts: { ...snapshot.counts, turnsToday: 7 } });
  expect(readSnapshot(outbox, at).snapshot.counts.turnsToday).toBe(7);
  expect(() => client.publish({ ...snapshot, chat: 'x' })).toThrow('dashboard chat invalid');
  expect(readSnapshot(outbox, at).snapshot.counts.turnsToday).toBe(7); // a refused snapshot never replaces the last good one
});

it('P11-NF-52 Q81: all eleven floors hold on this tree, each floor\'s negative control turns it red, and nothing shows without the passkey', async () => {
  const report = await runDashboardChecks();
  expect(Object.keys(report.floors)).toEqual(Object.keys(FLOORS));
  for (const [id, floor] of Object.entries(report.floors as Record<string, { pass: boolean; detail: string }>)) expect(floor.pass, `${id}: ${floor.detail}`).toBe(true);
  expect(Object.values(report.controls)).toEqual(Array(11).fill('detected'));
  for (const [id, item] of Object.entries(report.exposure as Record<string, { pass: boolean }>)) expect(item.pass, id).toBe(true);
  expect(report.population.ok).toBe(true);
  expect(report.pass).toBe(true);
}, 60000);
