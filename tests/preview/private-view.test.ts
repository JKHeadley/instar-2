import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { createPrivateView, getPrivateView, privateViewDelivery, PRIVATE_VIEW_MS } from './private-view.js';
// @ts-expect-error Existing executable dashboard transport.
import { createReadOnlyDashboard, serveReadOnly, readOnlyView, handleReadOnly, READ_ONLY_COOKIE } from '../../scripts/operator-dashboard-readonly.mjs';
// @ts-expect-error Shared executable renderer.
import { renderPrivateView, PRIVATE_VIEW_CSP } from '../../scripts/private-view.mjs';
import shapes from './fixtures/retrospective-duty-followup-train-1-2026-10-08.json' with { type: 'json' };

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const key = new Uint8Array(32).fill(19), start = 1794490000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:private-report',
  configurationDigest: 'sha256:private-report', expires: start + PRIVATE_VIEW_MS * 2,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 9000, cursor: 0 };
const body = '# Findings\n\n**Done.**\n\n| A | B |\n|---|---|\n| one | two |\n\n<script>alert(1)</script>\n\n![remote](https://example.org/track)\n\n[bad](javascript:alert(1))';
const answer = JSON.stringify({ reply: body, privateViewTitle: 'My report' });
async function world(output = answer, address: string | null = '100.90.80.70:1234', group = false,
  checkOutbound: (text: string) => void = () => {}, sendResult: number | null = 1) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'private-report-'))); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis), sends: string[] = [];
  const ports = { now: () => start, stopped: () => false, prepareModel: (input: { context: string }) => input.context,
    model: async () => output, privateDashboardAddress: () => address,
    send: async ({ expectedText }: { expectedText: string }) => { sends.push(expectedText); return sendResult; }, checkOutbound };
  const worker = createJournalWorker(journal, ports);
  worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: group ? 'supergroup' : 'private' },
    ...(group ? { message_thread_id: 7 } : {}), from: { id: 7654321 }, date: start / 1000, text: 'Make a private report of your findings.' } }]);
  await worker.drain();
  return { journal, ports, sends, path, turn: journal.view.order[0]! };
}

it('creates through the worker, delivers the link, renders under the real HTTP PIN session and survives restart without another send', async () => {
  const w = await world();
  const report = w.turn.privateView!;
  expect(report).toMatchObject({ title: 'My report', markdown: body, owner: genesis.operator, source: w.turn.id,
    update: 1, conversation: genesis.chat, createdAt: start, expiresAt: start + PRIVATE_VIEW_MS });
  expect(w.sends.join('\n')).toContain(`http://100.90.80.70:1234/dashboard/reports/${report.id}`);
  const dash = createReadOnlyDashboard({ state: () => ({ kind: 'missing' }), checkPin: async (pin: string) => pin === '2468',
    privateView: (id: string) => getPrivateView(w.journal.view, id, genesis.operator, start), now: () => start });
  const server = serveReadOnly(dash, '127.0.0.1:0');
  try {
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`, path = `/dashboard/reports/${report.id}`;
    const noSession = await fetch(base + path); expect(noSession.status).toBe(401);
    const signInPage = await noSession.text();
    expect(signInPage).not.toContain('Findings'); expect(signInPage).toContain(`name="next" value="${path}"`);
    const wrong = await fetch(base + '/dashboard/sign-in', { method: 'POST', body: 'pin=0000', redirect: 'manual' });
    expect(wrong.status).toBe(401);
    const login = await fetch(base + '/dashboard/sign-in', { method: 'POST', body: new URLSearchParams({ pin: '2468', next: path }), redirect: 'manual' });
    expect(login.status).toBe(303); expect(login.headers.get('location')).toBe(path);
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const response = await fetch(base + path, { headers: { cookie } });
    expect(response.status).toBe(200); expect(response.headers.get('content-security-policy')).toBe(PRIVATE_VIEW_CSP);
    const page = await response.text();
    expect(page).toContain('<h1>Findings</h1>'); expect(page).toContain('<table>'); expect(page).toContain('<strong>Done.</strong>');
    expect(page).toContain('&lt;script&gt;'); expect(page).not.toMatch(/<script|<img|javascript:|src=/u);
    expect(page).toContain('name="viewport"'); expect(page).toContain('max-width:44rem');
    const missing = await fetch(base + '/dashboard/reports/' + 'f'.repeat(64), { headers: { cookie } });
    expect(missing.status).toBe(404); expect(await missing.text()).toContain('missing, expired, or unavailable');
    expect(readOnlyView(dash, { path, cookie: `${READ_ONLY_COOKIE}=other` }).status).toBe(401);
  } finally { await new Promise<void>((resolve, reject) => server.close((error: Error | undefined) => error ? reject(error) : resolve())); }
  expect(getPrivateView(w.journal.view, report.id, 'other-person', start)).toBeNull();
  expect(getPrivateView(w.journal.view, report.id, genesis.operator, report.expiresAt)).toBeNull();
  expect(getPrivateView(w.journal.view, report.id, genesis.operator, start - 1)).toBeNull();
  w.journal.close();
  const restarted = openPreviewJournal(w.path, key, genesis);
  expect(getPrivateView(restarted.view, report.id, genesis.operator, start)).toEqual(report);
  const before = w.sends.length;
  await createJournalWorker(restarted, w.ports).drain();
  expect(w.sends).toHaveLength(before); restarted.close();
});

it('loopback-only delivery states phone unavailability and emits no link', async () => {
  const w = await world(answer, '127.0.0.1:1234');
  expect(w.turn.privateView).toBeDefined();
  expect(w.sends.join('\n')).toContain('cannot be opened from your phone yet');
  expect(w.sends.join('\n')).not.toContain('localhost'); expect(w.sends.join('\n')).not.toContain('127.0.0.1');
  for (const address of [null, '0.0.0.0:1234', '100.63.1.1:2', '100.128.1.1:2', '100.90.256.1:2', '100.90.1.1:0', '100.90.1.1:65536', 'example.org:443'])
    expect(privateViewDelivery(w.turn.privateView!, address)).not.toContain('http');
  w.journal.close();
});

it('refuses another audience, malformed titles, oversized bodies and secret-bearing report titles', async () => {
  const group = await world(answer, null, true);
  expect(group.turn.privateView).toBeUndefined(); group.journal.close();
  for (const title of ['', 'x'.repeat(257), 'bad\nline', 5]) {
    const w = await world(JSON.stringify({ reply: 'Finished.', privateViewTitle: title }));
    expect(w.turn.privateView).toBeUndefined(); expect(w.sends.join('\n')).toContain('could not create'); w.journal.close();
  }
  const w = await world();
  expect(createPrivateView(w.journal.view, w.turn, 'Title', 'x'.repeat(20481), start)).toBeNull();
  expect(createPrivateView(w.journal.view, { ...w.turn, writer: { ...w.turn.writer!, id: 'other' } }, 'Title', body, start)).toBeNull();
  w.journal.close();
  const secret = await world(answer, null, false, text => { if (text.includes('My report')) throw Error('secret'); });
  expect(secret.turn.privateView).toBeUndefined(); expect(secret.sends).toEqual([]); secret.journal.close();
});

it.each(shapes.otherShapes)('replays captured $kind $id through the output path without creating an unsolicited report', async row => {
  const w = await world(row.raw);
  expect(w.turn.privateView).toBeUndefined(); expect(w.sends.join('\n')).not.toContain('/dashboard/reports/');
  w.journal.close();
});

it('uses a genuine delivered reply through existing PREVIEW-prefix normalization under the explicit new creation contract', async () => {
  const row = shapes.otherShapes.find(item => item.kind === 'delivered-reply' && item.raw.trim())!;
  expect(row).toBeDefined();
  const w = await world(JSON.stringify({ reply: row.raw, privateViewTitle: 'Recorded reply' }));
  expect(w.turn.privateView?.markdown).toBe(row.raw.replace(/^PREVIEW — /u, ''));
  expect(w.turn.answer).toBe(row.raw);
  expect(renderPrivateView(w.turn.privateView)).toContain('Recorded reply');
  expect(w.sends.join('\n')).toContain('/dashboard/reports/'); w.journal.close();
});


it('unknown dispatch is never repeated after restart and retains the view', async () => {
  const w = await world(answer, '100.90.80.70:1234', false, () => {}, null);
  expect(w.sends).toHaveLength(1); const report = w.turn.privateView!;
  w.journal.close();
  const restarted = openPreviewJournal(w.path, key, genesis);
  await createJournalWorker(restarted, w.ports).drain();
  expect(w.sends).toHaveLength(1);
  expect(getPrivateView(restarted.view, report.id, genesis.operator, start)).toEqual(report);
  restarted.close();
});

it('PIN return paths cannot redirect outside the private report route; report markup stays inert', async () => {
  const dash = createReadOnlyDashboard({ state: () => ({ kind: 'missing' }), checkPin: async () => true, now: () => start });
  for (const next of ['https://example.org', '//example.org', '/dashboard/reports/not-an-id']) {
    const result = await handleReadOnly(dash, { method: 'POST', path: '/dashboard/sign-in',
      body: new URLSearchParams({ pin: '2468', next }).toString() });
    expect(result.headers.location).toBe('/dashboard');
  }
  const page = renderPrivateView({ title: '<script>bad</script>', markdown: '<iframe src="https://example.org"></iframe>\n\n<form><input></form>' });
  expect(page).not.toMatch(/<script|<iframe|<form|<input/u);
  expect(page).toContain('&lt;script&gt;bad&lt;/script&gt;');
});
