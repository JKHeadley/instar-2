// Rules 60, 75, 114 and Part fifteen §5 (docs/19-scheduled-work): the host's model-dispatch checkpoint. A stand-in
// provider sits behind the real checkpoint, so both sides of each decision are observed where it matters: what the
// provider actually received. Rule 106: the request shapes real Claude Code and Codex CLIs sent through a loopback
// forwarder (fixtures/model-gate-requests-2026-10-03.json) replay through it, each model call counted exactly once.
import { createServer, request, type IncomingMessage, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { SessionWorkEdge } from '../../src/assembly/production-session-work.js';
import { modelGateLaunch } from '../../src/assembly/production-session-driver.js';
// @ts-expect-error the checkpoint stays plain JavaScript
import { canonical, createAdmissionGate, createToolEffectOwner, toolOperation } from './admission-gate.mjs';
// @ts-expect-error the hook's decision stays plain JavaScript
import { admitToolCallEffect } from './tool-admission.mjs';

const RECORDED = JSON.parse(readFileSync(join(__dirname, 'fixtures/model-gate-requests-2026-10-03.json'), 'utf8')) as Record<string,
  { modelCalls: number; requests: [string, string][] }>;
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });

async function world(options: { stopped?: () => boolean } = {}) {
  // The stand-in provider: records what it received and answers with a small streamed body.
  const received: [string, string, string][] = [];
  const upstream: Server = createServer((req: IncomingMessage, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; });
    req.on('end', () => { received.push([req.method ?? '', req.url ?? '', body]); res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: one\n\n'); res.end('data: two\n\n'); });
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const port = (upstream.address() as { port: number }).port;
  closers.push(() => new Promise(resolve => upstream.close(() => resolve())));
  const rows: unknown[] = [];
  const stopped = options.stopped ?? (() => false);
  const gate = await createAdmissionGate({ append: (row: unknown) => rows.push(row), stopped, now: () => 5,
    effects: createToolEffectOwner({ decide: (tool: string, input: unknown) => admitToolCallEffect(tool, input, { operations: [] }, Date.now()),
      append: (row: unknown) => rows.push(row), stopped, now: () => 5, prepared: () => false }),
    upstreams: { 'claude-code': { host: '127.0.0.1', port, secure: false }, 'codex-cli': { host: '127.0.0.1', port, secure: false } } });
  closers.push(() => gate.stop());
  const edge = { id: 'session-work-edge:op:1', child: 'session-work-x' } as SessionWorkEdge;
  const send = (url: string, method = 'POST', body = '{"model":"m"}') => new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(url, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer DUMMY-NOT-A-TOKEN' } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }));
    });
    req.on('error', reject);
    req.end(method === 'GET' || method === 'HEAD' ? undefined : body);
  });
  return { gate, received, edge, send, rows };
}

it('takes the allowance before dispatch: a call past it is refused at the checkpoint and never reaches the provider', async () => {
  const w = await world();
  w.gate.open('claim-a', { framework: 'claude-code', allowance: 2, edge: w.edge });
  const base = w.gate.base('claim-a');
  expect(await w.send(`${base}/v1/messages?beta=true`)).toEqual({ status: 200, body: 'data: one\n\ndata: two\n\n' });
  expect((await w.send(`${base}/v1/messages?beta=true`)).status).toBe(200);
  const third = await w.send(`${base}/v1/messages?beta=true`);
  expect(third.status).toBe(400);
  expect(third.body).toContain('reserved model-call allowance (2) is used');
  // The provider saw exactly the two admitted calls, with the child's own credential header forwarded untouched.
  expect(w.received.map(row => row[1])).toEqual(['/v1/messages?beta=true', '/v1/messages?beta=true']);
  expect(w.gate.state('claim-a')).toMatchObject({ calls: 2, refused: true });
  // A request that starts no model call (token counting, a reachability probe) takes nothing.
  const tally = await world();
  tally.gate.open('claim-b', { framework: 'claude-code', allowance: 1, edge: tally.edge });
  expect((await tally.send(`${tally.gate.base('claim-b')}/v1/messages/count_tokens?beta=true`)).status).toBe(200);
  expect((await tally.send(`${tally.gate.base('claim-b')}/api/hello`, 'HEAD')).status).toBe(200);
  expect(tally.gate.state('claim-b')).toMatchObject({ calls: 0, refused: false });
});

it('a closed claim, a held stop, an unknown claim or a wrong secret dispatches nothing', async () => {
  let stop = false;
  const w = await world({ stopped: () => stop });
  w.gate.open('claim-a', { framework: 'codex-cli', allowance: 5, edge: w.edge });
  const base = w.gate.base('claim-a');
  expect((await w.send(`${base}/backend-api/codex/responses`)).status).toBe(200);
  stop = true;
  expect((await w.send(`${base}/backend-api/codex/responses`)).status).toBe(400);
  stop = false;
  w.gate.close('claim-a');
  expect((await w.send(`${base}/backend-api/codex/responses`)).status).toBe(400);
  expect((await w.send(`${w.gate.base('claim-unknown')}/backend-api/codex/responses`)).status).toBe(400);
  expect((await w.send(base.replace(/\/[0-9a-f]{32}\//u, `/${'0'.repeat(32)}/`) + '/backend-api/codex/responses')).status).toBe(404);
  expect(w.received).toHaveLength(1);
  expect(w.gate.state('claim-a')).toMatchObject({ calls: 1, closed: true });
});

it('replays the request shapes real Claude Code and Codex CLIs sent (Rule 106): each model call counted once, nothing else', async () => {
  for (const framework of ['claude-code', 'codex-cli'] as const) {
    const w = await world();
    const recorded = RECORDED[framework]!;
    w.gate.open('claim-r', { framework, allowance: recorded.modelCalls, edge: w.edge });
    for (const [method, path] of recorded.requests) expect((await w.send(`${w.gate.base('claim-r')}${path}`, method)).status, path).toBe(200);
    expect(w.gate.state('claim-r'), framework).toMatchObject({ calls: recorded.modelCalls, refused: false });
    expect(w.received.map(row => row[1])).toEqual(recorded.requests.map(row => row[1]));
  }
});

it('points each harness at the checkpoint: Claude through its model endpoint variable, Codex through a gated provider', () => {
  const base = `http://127.0.0.1:4100/${'a'.repeat(32)}/session-work-x`;
  expect(modelGateLaunch('claude-code', base)).toEqual({ env: [`ANTHROPIC_BASE_URL=${base}`], args: [] });
  const codex = modelGateLaunch('codex-cli', base);
  expect(codex.args).toEqual(['-c', 'model_provider=instar-gate', '-c',
    `model_providers.instar-gate={name="OpenAI",base_url="${base}/backend-api/codex",wire_api="responses",requires_openai_auth=true}`]);
  expect(() => modelGateLaunch('claude-code', 'https://api.anthropic.com')).toThrow(/loopback checkpoint/u);
});

it('names a consequential tool by its exact operation and renders its input canonically', () => {
  expect(toolOperation('mcp__threadline__threadline_send')).toBe('mcp:threadline:threadline_send');
  expect(toolOperation('Bash')).toBe('tool:Bash');
  expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonical({ a: [{ c: 3, d: 2 }], b: 1 }));
});
