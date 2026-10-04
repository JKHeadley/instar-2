// The operator dashboard (Rules 79, 80, 81, 87; README "The operator dashboard"). The agent's runner projects one snapshot
// from the journal with the chat status answer's own functions; the operator's approval page renders it only behind the
// operator's passkey. Inputs are recorded live shapes (tests/fixtures/dashboard-recorded-shapes.json, observer #106).
import { afterEach, expect, it } from 'vitest';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { operatorRequestsReport, type JournalView, type OperatorRequestState } from './journal.js';
import { dashboardSnapshot, turnState } from './operator-dashboard.js';
import { statusAnswer, turnsToday } from './status-command.js';
// @ts-expect-error The operator-run page is JavaScript.
import { checkSnapshot, DASHBOARD_BOUNDS, DASHBOARD_FILE, readSnapshot, renderDashboard } from '../../scripts/operator-dashboard.mjs';
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

it('a turn says what happened to it, from its own durable record', () => {
  const base = { id: 'x', update: 1, text: 't', raw: '{}', accepted: true, at, reserved: false };
  expect(turnState({ ...base, sent: 5 })).toBe('Answered');
  expect(turnState({ ...base, limited: { text: 'x', at, lead: 'x', reason: 'calls' }, limitedSent: 6 })).toMatch(/^Answered briefly/u);
  expect(turnState({ ...base, held: 'memory correction pending' })).toBe('Held: memory correction pending');
  expect(turnState({ ...base, intent: 'a reply' })).toBe('Sending');
  expect(turnState(base)).toBe('Waiting for my answer');
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
    route: 'github-review', link: 'https://github.com/JKHeadley/instar-2/pull/145/files' }]);
  expect(open.counts.waiting).toBe(1);
  const lapsed = dashboardSnapshot(view, { now: at + 3_600_001, zone, statusText: 'Status', bot: null, stopped: false });
  expect(lapsed.requests[0]).toMatchObject({ open: false, state: 'Expired unanswered' });
  expect(lapsed.counts.waiting).toBe(0);
});

it('the page treats the snapshot as untrusted: closed shape, bounded, links only to a GitHub review, everything escaped', () => {
  const outbox = temp('dashboard-outbox-'), now = 1_790_900_000_000;
  const good = { type: 'PreviewOperatorDashboard', schemaVersion: 1, asOf: now, zone, state: 'running', until: '2026-10-12 13:40',
    status: recorded.statusNormal.text.split('\n'), counts: { turnsToday: 1, held: 0, waiting: 1 },
    allowance: [{ label: 'Model calls', used: 1, max: 4 }], tokens: { input: 1, output: 1, unknownCalls: 0 },
    requests: [{ title: 'Extend this trial', state: 'Waiting for your answer', open: true, route: 'github-review', link: 'https://github.com/a/b/pull/1/files' }],
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
  client.publish(snapshot);
  const file = join(outbox, DASHBOARD_FILE);
  expect(lstatSync(file).mode & 0o777).toBe(0o644);
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
