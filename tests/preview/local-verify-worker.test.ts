import { expect, it } from 'vitest';
// @ts-expect-error physical MCP adapter
import { localVerifyTools } from './local-verify-mcp.mjs';

it('discovers request and exact-head status tools without merge or send operations', () => {
  expect(localVerifyTools.map((t: { name: string }) => t.name)).toEqual(['request', 'status']);
});

import { createServer } from 'node:http';
import { readFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error physical MCP adapter
import { localVerifyCall } from './local-verify-mcp.mjs';
// @ts-expect-error physical admission adapter
import { admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error physical launch adapter
import { readRootMcp, prepareMcpLaunch } from './tool-turn.mjs';
// @ts-expect-error physical setup adapter
import { installMcp } from '../../scripts/mcp-setup.mjs';

const head = 'a'.repeat(40), base = 'main', pr = 7;
const cfg = { endpoint: 'http://127.0.0.1:4040', repo: 'owner/repo', token: 'test-only', githubToken: 'test-only' };
it('uses HTTP POST {pr} and preserves capacity/standby refusals', async () => {
  const seen: unknown[] = []; let code = 202, reply: object = { ok: true, status: 'queued' };
  const server = createServer(async (req, res) => { let text = ''; for await (const chunk of req) text += chunk;
    seen.push([req.method, req.url, JSON.parse(text), req.headers.authorization]);
    res.writeHead(code); res.end(JSON.stringify(reply)); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  try {
    const c = { ...cfg, endpoint: `http://127.0.0.1:${address.port}` };
    expect(await localVerifyCall(c, 'request', { pr })).toMatchObject({ state: 'requested', httpStatus: 202, result: reply });
    expect(seen[0]).toEqual(['POST', '/local-verify', { pr }, 'Bearer test-only']);
    for (const status of [409, 429, 503]) { code = status; reply = { ok: false, code: 'queue-full' };
      expect(await localVerifyCall(c, 'request', { pr })).toMatchObject({ state: 'refused', httpStatus: status, result: reply }); }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
it('does not treat a different head or missing record as passing verification', async () => {
  const calls: string[] = [];
  const fetcher = async (url: string) => { calls.push(url);
    if (url.includes('/commits/')) return new Response(JSON.stringify({ statuses: [{ context: 'instar/local-verify', state: 'pending', description: 'awaiting-verify' }] }));
    if (url.includes('/record?')) return new Response(JSON.stringify({ error: 'no record' }), { status: 404 });
    return new Response(JSON.stringify({ queue: [{ pr, headSha: 'b'.repeat(40) }], inFlight: null })); };
  expect(await localVerifyCall(cfg, 'status', { pr, head, base }, fetcher)).toMatchObject({ head, verification: { state: 'unknown' }, github: { state: 'pending' } });
  expect(calls.some(url => url.includes(`head=${head}&base=main`))).toBe(true);
});
it('distinguishes accepted peers, local running, queued, held, recorded and stale results', async () => {
  let snapshot: object = { queue: [{ pr, headSha: head, baseRefName: base, remote: { machineId: 'verifier-b', state: 'accepted' } }], inFlight: null };
  let record: object | null = null;
  const fetcher = async (url: string) => new Response(JSON.stringify(url.includes('/commits/') ? { statuses: [] }
    : url.includes('/record?') ? (record ? { record } : { error: 'no record' }) : snapshot), { status: url.includes('/record?') && !record ? 404 : 200 });
  const check = () => localVerifyCall(cfg, 'status', { pr, head, base }, fetcher);
  expect(await check()).toMatchObject({ verification: { state: 'peer-accepted', machine: 'verifier-b' }, github: { state: 'unknown' } });
  snapshot = { queue: [], inFlight: { pr, headSha: head } };
  expect(await check()).toMatchObject({ verification: { state: 'running' } });
  snapshot = { queue: [{ pr, headSha: head, baseRefName: base, held: { reason: 'main-red' } }], inFlight: null };
  expect(await check()).toMatchObject({ verification: { state: 'queued', held: { reason: 'main-red' } } });
  snapshot = { queue: [], inFlight: null };
  for (const outcome of ['success','failure','error']) {
    record = { repo: cfg.repo, pr, headSha: head, baseRefName: base, outcome, machineId: 'verifier-b' };
    expect(await check()).toMatchObject({ verification: { state: 'recorded', outcome, machine: 'verifier-b' } });
  }
  for (const wrong of [{ headSha: 'b'.repeat(40) }, { repo: 'other/repo' }, { baseRefName: 'other' }, { pr: 8 }, { kind: 'main' }]) {
    record = { repo: cfg.repo, pr, headSha: head, baseRefName: base, outcome: 'success', ...wrong };
    expect(await check()).toMatchObject({ verification: { state: 'unknown' } });
  }
});
it('rejects expanded input and replays recorded summary/Jev/reply shapes without effect authority', async () => {
  const rows = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  let calls = 0; const fetcher = async () => { calls++; return new Response('{}'); };
  for (const input of [{ pr: 0 }, { pr, url: cfg.endpoint }, ...rows.map((row: { raw: string }) => ({ pr, text: row.raw }))])
    expect(await localVerifyCall(cfg, 'request', input, fetcher)).toMatchObject({ state: 'refused' });
  expect(calls).toBe(0);
  expect(admitToolCallEffect('mcp__local_verify__request', { pr }, { operations: [], mcpReads: ['mcp__local_verify__status'] }, 1).admitted).toBe(false);
});
it('unknown transport and malformed or oversized replies never manufacture success', async () => {
  for (const fetcher of [async () => { throw Error('lost'); }, async () => new Response('broken'), async () => new Response('x'.repeat(1048577))]) {
    expect(await localVerifyCall(cfg, 'request', { pr }, fetcher)).toMatchObject({ state: 'unknown' });
    expect(await localVerifyCall(cfg, 'status', { pr, head, base }, fetcher)).toMatchObject({ verification: { state: 'unknown' }, github: { state: 'unknown' } });
  }
});
it('the installed MCP launch exposes both tools through the real stdio consumer', () => {
  const root = mkdtempSync(join(tmpdir(), 'lv-worker-')), priv = join(root, 'private'); mkdirSync(priv);
  const script = new URL('./local-verify-mcp.mjs', import.meta.url).pathname;
  installMcp(root, { mcpServers: { local_verify: { command: process.execPath, args: [script] } }, reads: ['mcp__local_verify__status'] });
  const mcp = readRootMcp(root), launch = prepareMcpLaunch({ mcp, privateDirectory: priv, socket: join(root,'socket'), workspace: root });
  const server = launch.launch.local_verify;
  const result = spawnSync(server.command, server.args, { input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n', encoding: 'utf8', timeout: 5000 });
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).result.tools).toEqual(localVerifyTools);
  const refusal = spawnSync(server.command, server.args, { input: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'request', arguments: { pr: 0 } } }) + '\n', encoding: 'utf8', timeout: 5000 });
  expect(JSON.parse(JSON.parse(refusal.stdout).result.content[0].text)).toMatchObject({ state: 'refused' });
  expect(mcp.reads).toEqual(['mcp__local_verify__status']);
});
it('replays the actual Mama PC HTTP refusal captured 2026-11-06 without inventing a run', async () => {
  const body = readFileSync(new URL('./fixtures/local-verify-unconfigured-1106.json', import.meta.url), 'utf8');
  const fetcher = async () => new Response(body, { status: 503 });
  expect(await localVerifyCall(cfg, 'request', { pr }, fetcher)).toMatchObject({ state: 'refused', httpStatus: 503, result: JSON.parse(body) });
  expect(await localVerifyCall(cfg, 'status', { pr, head, base }, fetcher)).toMatchObject({ verification: { state: 'unknown' }, github: { state: 'unknown' } });
});
it('keeps request authority distinct from read authority and refuses a revoked grant', () => {
  const tool = 'mcp__local_verify__request';
  const policy = { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
    registered: [{ effect: 'tool:mcp', target: tool, consequence: 'data', reversibility: 'reversible', reach: 'world', costUsd: 0, source: 'test:role' }],
    grants: [{ id: 'verify', effect: 'tool:mcp', target: tool, approves: ['scope'], source: 'test:role', custodian: 'owner', recovery: 'withdraw grant', expiresAt: 100 }] };
  const config = { operations: ['tool:mcp'], mcpReads: ['mcp__local_verify__status'], effectPolicy: policy };
  expect(admitToolCallEffect(tool, { pr }, config, 1).admitted).toBe(true);
  expect(admitToolCallEffect(tool, { pr }, { ...config, effectPolicy: { ...policy, grants: [] } }, 1).admitted).toBe(false);
  expect(admitToolCallEffect(tool, { pr }, config, 100).admitted).toBe(false);
  expect(admitToolCallEffect('mcp__local_verify__status', { pr, head, base }, { operations: [], mcpReads: config.mcpReads }, 1).admitted).toBe(true);
});
it('the separate worker uses its immutable installed copy, while custom paths stay chosen', () => {
  const root = mkdtempSync(join(tmpdir(), 'lv-launch-'));
  const shipped = new URL('./local-verify-mcp.mjs', import.meta.url).pathname;
  for (const path of [shipped, '/chosen/connector.mjs']) {
    const mcp = { servers: { local_verify: { command: process.execPath, args: [path] } }, secrets: {} };
    const launch = prepareMcpLaunch({ mcp, privateDirectory: root, socket: join(root,'socket'), workspace: root,
      harness: { hookScript: '/installed/hooks/tool-admission-hook.mjs' } });
    expect(launch.launch.local_verify.args).toEqual([path === shipped ? '/installed/hooks/local-verify-mcp.mjs' : path]);
  }
});
