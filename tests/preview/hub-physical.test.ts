import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { openPreviewJournal } from './journal.js';
import { localAuthorityClient, openConversationAuthority, type AuthorityClient } from './conversation-authority.js';
import { createReplicatedDispatch } from './journal-replication.js';
import { createLeaseHolder } from './two-machine-serving.js';
import { createCollaborationSurface, type HubEffect } from './collaboration-hub.js';
// @ts-expect-error Installed physical consumer is JavaScript.
import { createCollaborationDispatch } from './collaboration-dispatch.mjs';
// @ts-expect-error Actual physical bridge, pointed only at the isolated loopback endpoint with its fixed test token.
import { createProductionTelegramIO } from '../../scripts/production-boot-io.mjs';
// @ts-expect-error Installed operator HTTP boundary.
import { createReadOnlyDashboard, serveReadOnly } from '../../scripts/operator-dashboard-readonly.mjs';
// @ts-expect-error Shared transport outcome parser.
import { classifyTelegramTopic, classifyTelegramSend } from './telegram-send-outcome.mjs';
const token = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const tokenReference = { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'telegram-bot-token' };
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-1007654321', forum: true as const, operator: '7654321',
  grant: 'isolated-topic-contract', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: 16, maxReplies: 5, maxTurns: 20, maxBytes: 32768, cursor: 0 };

it.each(['accepted', 'withdrawn', 'stopped', 'outcome-unreachable'])('settles the shared topic claim after %s, including across authority reopen', async mode => {
  const root = mkdtempSync(join(tmpdir(), 'hub-shared-'));
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(41), genesis);
  const authorityPath = join(root, 'authority.jsonl');
  let log = openConversationAuthority({ path: authorityPath, conversation: 'hub-test', termMs: 30000, monotonic: () => 1000 });
  let granted = true, calls = 0, loseOutcome = mode === 'outcome-unreachable';
  const direct = localAuthorityClient(log);
  const authority: AuthorityClient = { request: async request => {
    if (request.op === 'outcome' && loseOutcome) return { ok: false, reason: 'unreachable' };
    const result = await direct.request(request);
    if (request.op === 'claim' && result.ok) {
      if (mode === 'withdrawn' || mode === 'outcome-unreachable') granted = false;
      if (mode === 'stopped') journal.append({ kind: 'stop', reason: 'operator', at: 1000 });
    }
    return result;
  } };
  const lease = createLeaseHolder({ authority, machine: 'test', incarnation: 'test:1', monotonic: () => 1000 });
  try {
    expect((await lease.hold()).role).toBe('owner');
    const shared = createReplicatedDispatch({ authority, lease, cursor: 0, elapsed: () => 1000,
      sleep: async () => { throw Error('unexpected retry'); },
      shipper: { token: () => ({ generation: 1, size: journal.size }), pump: async () => {}, covers: () => true } });
    const effect = { kind: 'topic' as const, name: 'Threadline' };
    journal.append({ kind: 'collaboration', action: 'intent', at: 1000,
      attempt: { id: 'hub:create', effect, authorization: 'grant' } });
    journal.append({ kind: 'collaboration', action: 'dispatch', at: 1000, id: 'hub:create' });
    const dispatch = createCollaborationDispatch({ journal,
      authorization: () => granted && journal.view.stop === null ? 'grant' : null,
      held: () => 'clear', disclosure: async () => {}, shared, tokenReference, credential: () => token,
      sendTelegram: async () => { throw Error('topic must not send'); },
      physical: { invoke: () => { calls++; return { kind: 'response', status: 200,
        bytes: JSON.stringify({ ok: true, result: { message_thread_id: 77, name: 'Threadline' } }) }; } } });
    expect(await dispatch('hub:create', effect)).toMatchObject({ kind: mode === 'accepted' ? 'accepted' : 'refused' });
    expect(calls).toBe(mode === 'accepted' ? 1 : 0);
    if (loseOutcome) expect(log.handle({ op: 'read' })).toMatchObject({ view: { unresolved: ['collaboration:hub:create'] } });
    loseOutcome = false;
    await shared.flush();
    expect(log.handle({ op: 'read' })).toMatchObject({ view: { unresolved: [], claims: 1 } });
    const fence = lease.fence()!;
    log.close();
    log = openConversationAuthority({ path: authorityPath, conversation: 'hub-test', termMs: 30000, monotonic: () => 1000 });
    expect(log.handle({ op: 'read' })).toMatchObject({ view: { unresolved: [], claims: 1 } });
    expect(log.handle({ op: 'claim', fence, key: 'collaboration:hub:create' })).toMatchObject({
      ok: false, reason: 'already-claimed', state: mode === 'accepted' ? 'sent' : 'refused' });
  } finally { log.close(); journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['accepted', 'lost'])('physical topic %s uses the launcher dispatcher and retains its identity through restart', async mode => {
  const root = mkdtempSync(join(tmpdir(), 'hub-physical-')), log = join(root, 'requests.jsonl');
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createServer } from 'node:http'; import { appendFileSync } from 'node:fs';
    const server = createServer((req,res) => { let text=''; req.on('data', b => text+=b); req.on('end', () => {
      const body=JSON.parse(text); appendFileSync(process.argv[1], JSON.stringify({path:req.url,body})+'\\n');
      if (process.argv[2]==='lost') { res.socket.destroy(); return; }
      const result=req.url.endsWith('/createForumTopic') ? {message_thread_id:77,name:body.name,icon_color:7322096}
        : {message_id:8,chat:{id:Number(body.chat_id)},message_thread_id:body.message_thread_id,text:body.text};
      res.end(JSON.stringify({ok:true,result})); }); }); server.listen(0,'127.0.0.1',()=>console.log(server.address().port));
  `, log, mode], { stdio: ['ignore', 'pipe', 'pipe'] });
  const pid = child.pid; expect(pid).toBeGreaterThan(0);
  const port = await new Promise<number>((resolve, reject) => { child.stdout!.once('data', b => resolve(Number(String(b).trim()))); child.once('error', reject); });
  const key = new Uint8Array(32).fill(38), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), allowed = false;
  const installed = createProductionTelegramIO(root, { preserve: () => true, read: () => null }, `http://127.0.0.1:${port}`);
  // Linux /bin/sh lacks the production macOS limit shim's ulimit -u. Exercise
  // the SAME physical bridge directly here; the installed shim proof is Studio-only.
  // This is a real HTTP call with the bridge's fixed fake-token restriction.
  const physical = process.platform === 'darwin' ? installed : { invoke(input: { method: string; body: unknown; timeoutMs: number }, credential: string) {
    const request = Buffer.from(JSON.stringify({ ...input, testEndpoint: `http://127.0.0.1:${port}` })).toString('base64url');
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('../../src/assembly/telegram-bot-api-bridge.mjs', import.meta.url)), request],
      { input: credential, encoding: 'utf8', timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
    return child.status === 0 ? JSON.parse(child.stdout) : { kind: 'uncertain', limitation: 'transport', stage: 'child-exit' };
  } };
  const authorization = () => allowed && journal.view.stop === null ? 'isolated-role-and-chat-binding' : null;
  const make = () => {
    const dispatch = createCollaborationDispatch({ journal, authorization, held: () => 'clear', disclosure: async () => {}, shared: null,
      tokenReference, credential: () => token, physical,
      // Physical send through the existing bridge; this test does not claim a deployed role grant.
      sendTelegram: async (input: { text: string; expectedText: string; chat: string; thread: number; silent: boolean; provenance: unknown; target: string }) => {
        expect(journal.verifyOutbound(input.provenance as never, { target: input.target, chat: input.chat, thread: input.thread, body: input.text })).toBe(true);
        return classifyTelegramSend(physical.invoke({ token: tokenReference, method: 'sendMessage',
          body: { chat_id: input.chat, message_thread_id: input.thread, text: input.text, disable_notification: input.silent }, timeoutMs: 1000 }, token),
        { chat: input.chat, thread: input.thread, expectedText: input.expectedText });
      } });
    return createCollaborationSurface({ state: () => journal.view.collaboration, append: r => journal.append(r), now: () => 1000,
      admitted: () => journal.view.stop === null, authorization, replicated: async () => true,
      topics: () => [{ topicId: 42, topicName: 'Build' }], effect: dispatch });
  };
  let surface = make();
  try {
    expect(await surface.hub.surface({ threadId: 'one', senderName: 'peer', text: 'Verify build', warrants: true, hasParentTopic: false }))
      .toMatchObject({ reason: 'hub-unconfirmed' });
    expect(journal.view.collaboration!.attempts).toHaveLength(0); // no grant never reaches the bridge
    allowed = true;
    const out = await surface.hub.surface({ threadId: 'one', senderName: 'peer', text: 'Verify build', warrants: true, hasParentTopic: false });
    expect(out.reason).toBe(mode === 'accepted' ? 'accepted' : 'hub-unconfirmed');
    const before = readFileSync(log, 'utf8').trim().split('\n');
    expect(before.filter(line => line.includes('/createForumTopic'))).toHaveLength(1);
    expect(journal.view.collaboration!.attempts[0]!.outcome?.kind).toBe(mode === 'accepted' ? 'accepted' : 'unknown');
    if (mode === 'accepted') {
      expect(journal.view.collaboration!.attempts[0]!.outcome).toMatchObject({ id: 77, receipt: expect.stringContaining('message_thread_id') });
      expect(journal.view.replies).toBe(1);
      expect(JSON.parse(before[1]!).body.disable_notification).toBe(true);
    }
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key); surface = make();
    await surface.hub.surface({ threadId: 'one', senderName: 'peer', text: 'Verify build', warrants: true, hasParentTopic: false });
    expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(before.length);
  } finally {
    journal.close(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once('exit', () => resolve()); });
    rmSync(root, { recursive: true, force: true });
  }
}, 15000);

it('installed HTTP bind requires PIN and CSRF, preserves ambiguous 409, and releases the per-call receipt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hub-http-'));
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(39), genesis);
  const surface = createCollaborationSurface({ state: () => journal.view.collaboration, append: r => journal.append(r), now: () => 1000,
    admitted: () => true, replicated: async () => true, topics: () => [{ topicId: 42, topicName: 'Build' }],
    effect: async (_: string, e: HubEffect) => ({ kind: 'accepted', id: e.kind === 'topic' ? 77 : 8 }) });
  for (const threadId of ['one', 'two']) await surface.hub.surface({ threadId, senderName: 'peer', text: 'Verify', warrants: true, hasParentTopic: false });
  const server = serveReadOnly(createReadOnlyDashboard({ state: () => ({ kind: 'missing' }), checkPin: async (pin: string) => pin === '246810', collaboration: surface }), '127.0.0.1:0');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: object, cookie = '') => fetch(url + path, { method: 'POST', redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body as Record<string, string>) });
  try {
    expect((await post('/dashboard/collaboration', { targetTopicId: '42' })).status).toBe(401);
    const login = await post('/dashboard/sign-in', { pin: '246810' }), cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const html = await (await fetch(url + '/dashboard/collaboration', { headers: { cookie } })).text();
    const csrf = /name="csrf" value="([a-f0-9]+)"/u.exec(html)![1]!;
    expect((await post('/dashboard/collaboration', { targetTopicId: '42' }, cookie)).status).toBe(403);
    expect((await post('/dashboard/collaboration', { targetTopicId: '42', csrf }, cookie)).status).toBe(409);
    expect((await post('/dashboard/collaboration', { threadId: 'one', targetTopicId: '42', csrf }, cookie)).status).toBe(200);
    expect(surface.hub.list().threads.find(t => t.threadId === 'one')!.parent).toBe(42);
    await expect(surface.hub.bind({ threadId: 'two', targetTopicId: 42, operatorReceipt: `dashboard:${'a'.repeat(64)}` })).rejects.toThrow(/verified operator/);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('topic result refuses a definite rejection and preserves all ambiguous responses as UNKNOWN', () => {
  expect(classifyTelegramTopic({ kind: 'response', status: 403, bytes: '{"ok":false}' }, 'Threadline').kind).toBe('refused');
  expect(classifyTelegramTopic({ kind: 'uncertain', sent: false }, 'Threadline').kind).toBe('refused');
  for (const reply of [null, { kind: 'uncertain' }, { kind: 'response', status: 500, bytes: '{}' }, { kind: 'response', status: 200, bytes: '{' },
    { kind: 'response', status: 200, bytes: '{"ok":true,"result":{"message_thread_id":77,"name":"other"}}' }])
    expect(classifyTelegramTopic(reply, 'Threadline').kind).toBe('unknown');
});

it.each(['withdrawn', 'stopped', 'secret', 'reply-cap'])('dispatcher refuses %s without a physical call', async cause => {
  const root = mkdtempSync(join(tmpdir(), 'hub-refused-'));
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(40),
    { ...genesis, maxReplies: cause === 'reply-cap' ? 1 : 5 });
  let granted = true, calls = 0, syncs = 0;
  const authorization = () => granted && journal.view.stop === null ? 'isolated-grant' : null;
  const dispatch = createCollaborationDispatch({ journal, authorization, held: () => cause === 'secret' ? 'held' : 'clear',
    disclosure: async () => {}, shared: null, tokenReference, credential: () => token,
    physical: { invoke: () => { calls++; throw Error('must not reach provider'); } },
    sendTelegram: async () => { calls++; throw Error('must not send'); } });
  const surface = createCollaborationSurface({ state: () => journal.view.collaboration, append: r => journal.append(r),
    now: () => 1000, admitted: () => journal.view.stop === null, authorization,
    topics: () => [], effect: dispatch, replicated: async () => {
      if (++syncs === 1 && cause === 'withdrawn') granted = false;
      if (syncs === 1 && cause === 'stopped') journal.append({ kind: 'stop', reason: 'operator', at: 1000 });
      return true;
    } });
  try {
    if (cause === 'reply-cap') {
      journal.append({ kind: 'collaboration', action: 'intent', at: 1000,
        attempt: { id: 'hub:create', effect: { kind: 'topic', name: 'Threadline' }, authorization: 'isolated-grant' } });
      journal.append({ kind: 'collaboration', action: 'dispatch', at: 1000, id: 'hub:create' });
      journal.append({ kind: 'collaboration', action: 'outcome', at: 1000, id: 'hub:create', outcome: { kind: 'accepted', id: 77 } });
      await expect(surface.hub.surface({ threadId: 'one', senderName: 'peer', text: 'Verify', warrants: true, hasParentTopic: false }))
        .rejects.toThrow(/reply allowance/);
    } else await surface.hub.surface({ threadId: 'one', senderName: 'peer', text: 'Verify', warrants: true, hasParentTopic: false });
    expect(calls).toBe(0);
    expect(journal.view.replies).toBe(0);
    if (cause === 'withdrawn') expect(journal.view.collaboration!.attempts[0]!.dispatched).toBeUndefined();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
