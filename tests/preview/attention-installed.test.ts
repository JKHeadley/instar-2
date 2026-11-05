import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { openPreviewJournal, projectionDigest } from './journal.js';
import { createAttentionSurface } from './attention-surface.js';
// @ts-expect-error The installed HTTP host is JavaScript, exercised through its real server below.
import { createReadOnlyDashboard, serveReadOnly } from '../../scripts/operator-dashboard-readonly.mjs';
import { openReplicaStore, createJournalShipper, localReplicaClient, adoptReceivedCopy } from './journal-replication.js';
const key = new Uint8Array(32).fill(47), secret = 'attention-replication-test-secret';
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'attention-test', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };

it('installed HTTP consumer refuses unsigned writes, persists acknowledgements, and hands them to the successor', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'attention-installed-'))), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis);
  let up = false, admitted = true, now = 1000;
  const peerRoot = join(root, 'peer'), store = openReplicaStore({ directory: join(peerRoot, 'replica'), conversation: 'attention', machine: 'peer', secret });
  const shipper = createJournalShipper({ path, size: () => journal.size, peer: localReplicaClient(store), conversation: 'attention', machine: 'owner', secret,
    epoch: () => 1, monotonic: () => now });
  const surface = createAttentionSurface(journal, { now: () => now, machine: 'owner', admitted: () => admitted,
    replicated: async () => { if (!up) return false; await shipper.pump(); return shipper.covers(shipper.token()); } });
  const server = serveReadOnly(createReadOnlyDashboard({ state: () => ({ kind: 'missing' }), checkPin: async (pin: string) => pin === '246810', attention: surface }), '127.0.0.1:0');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = (path: string, body: Record<string, string>, cookie = '') => fetch(`${url}${path}`, {
    method: 'POST', redirect: 'manual', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  try {
    const size = journal.size;
    expect((await fetch(`${url}/dashboard/attention`)).status).toBe(401);
    expect((await request('/dashboard/attention', { title: 'intruder' })).status).toBe(401);
    expect((await request('/dashboard/sign-in', { pin: 'wrong' })).status).toBe(401);
    expect(journal.size).toBe(size);
    const signed = await request('/dashboard/sign-in', { pin: '246810' });
    const cookie = signed.headers.get('set-cookie')!.split(';')[0]!;
    const page = await (await fetch(`${url}/dashboard/attention`, { headers: { cookie } })).text();
    const csrf = /name="csrf" value="([a-f0-9]+)"/u.exec(page)![1]!;
    const requestId = /name="requestId" value="([a-f0-9]+)"/u.exec(page)![1]!;
    expect((await request('/dashboard/attention', { title: 'bad csrf' }, cookie)).status).toBe(403);
    expect((await request('/dashboard/attention', { title: 'missing receipt', csrf }, cookie)).status).toBe(409);
    expect(journal.view.attention).toBeUndefined();
    const created = await request('/dashboard/attention', { title: 'Review <result>', csrf, requestId }, cookie);
    expect(created.status).toBe(200); const createdPage = await created.text(); expect(createdPage).toContain('Review &lt;result&gt;');
    expect((await request('/dashboard/attention', { title: 'Review <result>', csrf, requestId }, cookie)).status).toBe(200);
    expect(journal.view.attention!.items).toHaveLength(1);
    const freshId = /name="requestId" value="([a-f0-9]+)"/u.exec(createdPage)![1]!;
    expect(freshId).not.toBe(requestId);
    expect((await request('/dashboard/attention', { title: 'Review <result>', csrf, requestId: freshId }, cookie)).status).toBe(200);
    expect(journal.view.attention!.items).toHaveLength(2);
    const item = journal.view.attention!.items[0]!;
    const ack = await request('/dashboard/attention', { id: item.id, revision: '1', status: 'done', csrf }, cookie);
    expect(ack.status).toBe(200); expect(await ack.text()).toContain('confirmation is pending');
    expect(journal.view.attention!.items[0]!.status).toBe('OPEN');
    expect(journal.view.attention!.acknowledgements[0]!.lastOutcome).toBe('pending');
    // Lost owner cannot admit another operator mutation, and its old cookie conveys no new grant.
    admitted = false;
    expect((await request('/dashboard/attention', { title: 'lost owner', csrf, requestId: 'f'.repeat(32) }, cookie)).status).toBe(409);
    // Real sealed bytes, real receipt, actual takeover routine. No hand-built state copy.
    up = true; now += 10000; await shipper.pump();
    const before = projectionDigest(journal.view); journal.close();
    const successorPath = join(peerRoot, 'journal.encrypted');
    const verify = (file: string) => { const read = openPreviewJournal(file, key, undefined, undefined, true); read.close(); };
    expect(adoptReceivedCopy({ root: peerRoot, journalPath: successorPath, store, epoch: 2, seed: false, verify })).toMatchObject({ ok: true, how: 'adopted' });
    journal = openPreviewJournal(successorPath, key);
    expect(projectionDigest(journal.view)).toBe(before);
    const successor = createAttentionSurface(journal, { now: () => now, machine: 'peer', admitted: () => true, replicated: async () => true });
    await successor.drain(); expect(journal.view.attention!.items[0]!.status).toBe('DONE');
    const settled = journal.size; await successor.drain(); expect(journal.size).toBe(settled);
    journal.compact(); journal.close(); journal = openPreviewJournal(successorPath, key);
    expect(journal.view.attention!.items[0]!.status).toBe('DONE');
    expect(journal.view.attention!.acknowledgements[0]!.lastOutcome).toBe('delivered');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); journal.close(); store.close(); rmSync(root, { recursive: true, force: true }); }
});
