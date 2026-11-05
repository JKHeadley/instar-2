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
import { admitToolCall, admitToolCallEffect } from './tool-admission.mjs';

const RECORDED = JSON.parse(readFileSync(join(__dirname, 'fixtures/model-gate-requests-2026-10-03.json'), 'utf8')) as Record<string,
  { modelCalls: number; requests: [string, string][] }>;
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });

async function world(options: { stopped?: () => boolean; held?: () => string } = {}) {
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
    ...(options.held ? { held: options.held } : {}),
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
  expect(w.gate.state('claim-a')).toMatchObject({ calls: 2, refused: true, refusalReason: 'calls' });
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

it('exposes unfinished effects and retains the prepared count after completion for context recovery', async () => {
  const w = await world({ held: () => 'clear' });
  w.gate.open('claim-effects', { framework: 'claude-code', allowance: 3, edge: w.edge });
  const url = `${w.gate.base('claim-effects')}/admit`;
  const call = { kind: 'effect', phase: 'pre', tool_name: 'webrun', tool_use_id: 'read-1', tool_input: { open: [{ ref_id: 'https://8.8.8.8/' }] } };
  expect(w.gate.state('claim-effects')).toMatchObject({ uncertainEffects: 0, toolPreparations: 0 });
  const admitted = JSON.parse((await w.send(url, 'POST', JSON.stringify(call))).body);
  expect(admitted, admitted.reason).toMatchObject({ decision: 'allow' });
  expect(w.gate.state('claim-effects')).toMatchObject({ uncertainEffects: 1, toolPreparations: 1 });
  expect(JSON.parse((await w.send(url, 'POST', JSON.stringify(call))).body).decision).toBe('deny');
  expect(w.gate.state('claim-effects')).toMatchObject({ uncertainEffects: 1, toolPreparations: 1 });
  expect(JSON.parse((await w.send(url, 'POST', JSON.stringify({ ...call, phase: 'post', result_bytes: 5 }))).body).decision).toBe('allow');
  expect(w.gate.state('claim-effects')).toMatchObject({ uncertainEffects: 0, toolPreparations: 1 });
  // Ordinary work has no consequential-effect receipt, but must still prevent packet replay.
  expect(JSON.parse((await w.send(url, 'POST', JSON.stringify({ kind: 'tool', tool_name: 'Write', tool_use_id: 'write-1' }))).body).decision).toBe('allow');
  expect(w.gate.state('claim-effects')).toMatchObject({ uncertainEffects: 0, toolPreparations: 2 });
});

it('persists conversation charges before forwarding and refuses a failed durable reservation', async () => {
  const w = await world(); const reserved: number[] = [];
  w.gate.open('claim-durable', { framework: 'claude-code', allowance: 3, edge: w.edge, reserveCall: (ordinal: number) => {
    expect(w.received).toHaveLength(ordinal - 1);
    if (ordinal === 2) throw Error('disk unavailable');
    reserved.push(ordinal);
  } });
  const url = `${w.gate.base('claim-durable')}/v1/messages`;
  expect((await w.send(url)).status).toBe(200);
  expect((await w.send(url)).status).toBe(400);
  expect(reserved).toEqual([1]); expect(w.received).toHaveLength(1);
  expect(w.gate.state('claim-durable')).toMatchObject({ calls: 1, refused: true, refusalReason: 'reservation-unavailable' });
});

it('routes a new wake to the installed checkpoint, which still refuses absent authority and closed claims', async () => {
  const w = await world({ held: () => 'clear' });
  w.gate.open('claim-wake', { framework: 'claude-code', allowance: 2, edge: w.edge });
  const gate = w.gate.base('claim-wake');
  const call = { tool_name: 'ScheduleWakeup', tool_use_id: 'wake-1',
    tool_input: { delaySeconds: 60, prompt: 'continue admitted work', reason: 'wait', noop: true } };
  const config = { gate, maxCalls: 50, operations: [] };
  const decision = admitToolCall(call, config, 1, {});
  expect(decision).toMatchObject({ decision: 'gate', kind: 'effect' });
  const ask = async () => JSON.parse((await w.send(`${gate}/admit`, 'POST', JSON.stringify({ ...call, kind: decision.kind, phase: 'pre' }))).body);
  expect(await ask()).toMatchObject({ decision: 'deny', doorway: { disposition: 'refused' } });
  expect(w.gate.state('claim-wake')).toMatchObject({ toolPreparations: 0 });
  w.gate.close('claim-wake');
  expect(await ask()).toMatchObject({ decision: 'deny', reason: expect.stringContaining('closed') });
  expect(admitToolCall(call, config, 51, {})).toMatchObject({ decision: 'deny', reason: expect.stringContaining('call cap') });
  expect(w.received).toEqual([]);
});

it('supervision consumes the same worker allowance before the remaining provider call', async () => {
  const w = await world(); const reserved: number[] = [];
  w.gate.open('claim-supervised', { framework: 'claude-code', allowance: 2, edge: w.edge,
    reserveCall: (ordinal: number) => reserved.push(ordinal) });
  w.gate.reserveSupervisor('claim-supervised');
  expect(w.gate.state('claim-supervised')).toMatchObject({ calls: 1 });
  expect(w.received).toEqual([]);
  const url = `${w.gate.base('claim-supervised')}/v1/messages`;
  expect((await w.send(url)).status).toBe(200);
  expect((await w.send(url)).status).toBe(400);
  expect(w.received).toHaveLength(1); expect(reserved).toEqual([1, 2]);
  expect(() => w.gate.reserveSupervisor('claim-supervised')).toThrow(/unavailable/);
  expect(() => w.gate.reserveSupervisor('absent')).toThrow(/unavailable/);
});

it('stop, closed claims and failed durable reservation never admit a supervisor call', async () => {
  let stopped = false;
  const w = await world({ stopped: () => stopped });
  w.gate.open('claim-supervised', { framework: 'claude-code', allowance: 2, edge: w.edge });
  stopped = true; expect(() => w.gate.reserveSupervisor('claim-supervised')).toThrow(/unavailable/);
  expect(w.gate.state('claim-supervised').calls).toBe(0);
  stopped = false; w.gate.close('claim-supervised');
  expect(() => w.gate.reserveSupervisor('claim-supervised')).toThrow(/unavailable/);
  w.gate.open('claim-failed', { framework: 'claude-code', allowance: 2, edge: w.edge,
    reserveCall: () => { throw Error('disk unavailable'); } });
  expect(() => w.gate.reserveSupervisor('claim-failed')).toThrow(/reservation unavailable/);
  expect(w.gate.state('claim-failed')).toMatchObject({ calls: 0, refused: true, refusalReason: 'reservation-unavailable' });
  expect(w.received).toEqual([]);
});

// Carryover 02 r4, admission continuity: a restored endpoint serves only the claim adopted under its secret.
it('restores an original endpoint only when its port is free, routes each claim under its own secret, and releases the port on stop', async () => {
  const effects = createToolEffectOwner({ decide: () => ({ decision: 'allow', reason: 'test' }), append: () => {}, prepared: () => false, stopped: () => false, now: Date.now });
  const edge = { id: 'session-work-edge:op:1', budget: { calls: 24, deadline: Date.now() + 60_000 } } as SessionWorkEdge;
  const original = await createAdmissionGate({ append: () => {}, effects, stopped: () => false, now: Date.now });
  closers.push(() => original.stop());
  const [, port, secret] = /^http:\/\/127\.0\.0\.1:([0-9]+)\/([0-9a-f]{32})\//u.exec(original.base('adopted'))!;
  const restorer = await createAdmissionGate({ append: () => {}, effects, stopped: () => false, now: Date.now });
  closers.push(() => restorer.stop());
  // The original host still holds the port: a busy bind refuses, and a bind is never owner proof by itself.
  await expect(restorer.restore({ port: Number(port), secret })).rejects.toThrow(/EADDRINUSE/u);
  await original.stop();
  await restorer.restore({ port: Number(port), secret });
  await expect(restorer.restore({ port: Number(port) + 1 === 65536 ? 1 : Number(port) + 1, secret })).rejects.toThrow('already restored on another port');
  await expect(restorer.restore({ port: Number(port), secret: restorer.base('x').split('/')[3]! })).rejects.toThrow('exact recorded loopback port and secret required');
  expect(() => restorer.open('adopted', { framework: 'claude-code', allowance: 24, edge, restored: { calls: 5, uncertainEffects: [], delegations: [], secret: 'f'.repeat(32) } })).toThrow('restored secret');
  expect(() => restorer.open('adopted', { framework: 'claude-code', allowance: 24, edge, restored: { calls: 25, uncertainEffects: [], delegations: [], secret } })).toThrow('restored claim state');
  restorer.open('adopted', { framework: 'claude-code', allowance: 24, edge, restored: { calls: 5, uncertainEffects: [{ id: 'sha256:' + '1'.repeat(64), operation: 'tool:x', digest: 'sha256:' + '2'.repeat(64) }], delegations: [], secret } });
  expect(() => restorer.open('adopted', { framework: 'claude-code', allowance: 24, edge })).toThrow('already open');
  restorer.open('fresh', { framework: 'claude-code', allowance: 2, edge: { ...edge, id: 'session-work-edge:fresh:1' } });
  expect(restorer.state('adopted')).toMatchObject({ calls: 5, uncertainEffects: 1, openDelegations: [] });
  const status = async (url: string) => (await fetch(url, { method: 'POST', body: '{}' })).status;
  const restored = `http://127.0.0.1:${port}/${secret}`;
  expect(await status(`${restored}/other/v1/messages`)).toBe(400);          // unadopted claim under the old secret: refused as closed, never forwarded
  expect(await status(`${restored}/fresh/v1/messages`)).toBe(404);          // this host's own claim under the old secret
  expect(await status(`${restorer.base('adopted')}/v1/messages`)).toBe(404); // the adopted claim under the fresh secret
  expect(restorer.state('adopted')).toMatchObject({ calls: 5, refused: false });
  expect(await status(`${restorer.base('fresh')}/v1/messages/count_tokens`)).not.toBe(404);
  await restorer.stop();
  // The restored port is released with the gate: a later owner can bind it again.
  const later = await createAdmissionGate({ append: () => {}, effects, stopped: () => false, now: Date.now });
  closers.push(() => later.stop());
  await later.restore({ port: Number(port), secret });
});
