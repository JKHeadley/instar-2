// Rules 60, 75, 114 and Part fifteen §5 (docs/19-scheduled-work): the host's model-dispatch checkpoint. A stand-in
// provider sits behind the real checkpoint, so both sides of each decision are observed where it matters: what the
// provider actually received. Rule 106: the request shapes real Claude Code and Codex CLIs sent through a loopback
// forwarder (fixtures/model-gate-requests-2026-10-03.json) replay through it, each model call counted exactly once.
import { createServer, request, type IncomingMessage, type Server } from 'node:http';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { openPreviewJournal } from './journal.js';
import { makeTestCopy } from './test-copy.js';
import { checkPhaseTiming, MODEL_REQUEST_DIAGNOSTIC_LIMIT, type PhaseTiming } from './phase-timing.js';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { SessionWorkEdge } from '../../src/assembly/production-session-work.js';
import { modelGateLaunch } from '../../src/assembly/production-session-driver.js';
// @ts-expect-error the checkpoint stays plain JavaScript
import { canonical, createAdmissionGate, createToolEffectOwner, toolOperation, testCopyModelRequestObserver } from './admission-gate.mjs';
// @ts-expect-error the hook's decision stays plain JavaScript
import { admitToolCall, admitToolCallEffect } from './tool-admission.mjs';

const RECORDED = JSON.parse(readFileSync(join(__dirname, 'fixtures/model-gate-requests-2026-10-03.json'), 'utf8')) as Record<string,
  { modelCalls: number; requests: [string, string][] }>;
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });

async function world(options: { stopped?: () => boolean; held?: () => string; observeModelRequest?: ((row: PhaseTiming) => void) | null } = {}) {
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
  const gate = await createAdmissionGate({ observeModelRequest: options.observeModelRequest, append: (row: unknown) => rows.push(row), stopped, now: () => 5,
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


it('journals eight admitted requests and the ninth refusal in a real encrypted test copy, correlated to the answer attempt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'counted-requests-')), copy = root + '-copy';
  const key = new Uint8Array(32).fill(71), at = 1790000000000;
  const source = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: at + 86400000, maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  expect(testCopyModelRequestObserver(source)).toBeNull();
  source.close();
  const original = readFileSync(join(root, 'journal.encrypted'));
  makeTestCopy({ sourceRoot: root, root: copy, key, now: at,
    binding: { bot: '87654321', chat: '7654321' } });
  const path = join(copy, 'journal.encrypted');
  let journal = openPreviewJournal(path, key);
  try {
    const w = await world({ observeModelRequest: testCopyModelRequestObserver(journal) });
    w.gate.open('claim-copy', { framework: 'codex-cli', allowance: 8,
      edge: { ...w.edge, id: 'tool-turn:tg:46040751:answer:1', parent: 'tg:46040751:answer' } });
    const url = w.gate.base('claim-copy') + '/backend-api/codex/responses?token=PRIVATE-QUERY';
    for (let i = 1; i <= 9; i++) {
      const answer = await w.send(url, 'POST', '{"input":"PRIVATE-BODY /Users/private/profile"}');
      expect(answer.status).toBe(i <= 8 ? 200 : 400);
      if (i <= 8) expect(answer.body).toBe('data: one\n\ndata: two\n\n');
    }
    expect(w.received).toHaveLength(8);
    expect(w.gate.state('claim-copy')).toMatchObject({ calls: 8, refused: true, refusalReason: 'calls' });
    const rows = journal.view.phaseTimings!;
    expect(rows).toHaveLength(9);
    expect(rows.map(row => row.measurements.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rows.map(row => row.request?.result)).toEqual([...Array(8).fill('admitted'), 'allowance-exhausted']);
    expect(rows.every(row => row.id === 'tool-turn:tg:46040751:answer:1')).toBe(true);
    expect(rows[8]).toMatchObject({ request: { path: '/backend-api/codex/responses' }, measurements: { admittedCalls: 8, admitted: false } });
    const evidence = JSON.stringify(rows);
    for (const privateText of ['PRIVATE', '/Users/', 'authorization', 'DUMMY-NOT-A-TOKEN', 'data: one', w.gate.base('claim-copy')])
      expect(evidence).not.toContain(privateText);
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.phaseTimings).toEqual(rows);
    expect(readFileSync(path).includes(Buffer.from('tool-turn:tg:46040751:answer:1'))).toBe(false);
    expect(readFileSync(join(root, 'journal.encrypted'))).toEqual(original);
  } finally { journal.close(); rmSync(copy, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

it('replays captured CLI method/path shapes into diagnostics without counting probes or token counting', async () => {
  for (const framework of ['claude-code', 'codex-cli']) {
    const rows: PhaseTiming[] = [];
    const w = await world({ observeModelRequest: row => { checkPhaseTiming(row); rows.push(row); } });
    w.gate.open('recorded-copy', { framework, allowance: 8, edge: w.edge });
    const base = w.gate.base('recorded-copy');
    for (const [method, path] of RECORDED[framework]!.requests) await w.send(base + path, method);
    await w.send(base + '/v1/messages/count_tokens?beta=true');
    expect(rows).toHaveLength(RECORDED[framework]!.modelCalls);
    expect(rows[0]).toMatchObject({ measurements: { ordinal: 1, admittedCalls: 1, admitted: true },
      request: { path: framework === 'codex-cli' ? '/backend-api/codex/responses' : '/v1/messages', result: 'admitted' } });
  }
});

it('bounds observations, omits arbitrary path bytes, and distinguishes reservation, stop and closed refusals', async () => {
  const rows: PhaseTiming[] = []; let stop = false;
  const w = await world({ stopped: () => stop, observeModelRequest: row => { checkPhaseTiming(row); rows.push(row); } });
  w.gate.open('bounded-copy', { framework: 'codex-cli', allowance: 8, edge: w.edge,
    reserveCall: () => { throw Error('PRIVATE-RESERVATION-ERROR'); } });
  const url = w.gate.base('bounded-copy') + '/PRIVATE-PATH?secret=PRIVATE-QUERY';
  await w.send(url);
  stop = true; await w.send(url); stop = false;
  w.gate.close('bounded-copy');
  for (let i = 0; i < MODEL_REQUEST_DIAGNOSTIC_LIMIT + 10; i++) await w.send(url);
  expect(w.received).toHaveLength(0);
  expect(rows).toHaveLength(MODEL_REQUEST_DIAGNOSTIC_LIMIT);
  expect(rows.slice(0, 3).map(row => row.request?.result)).toEqual(['reservation-unavailable', 'closed-or-stopped', 'closed-or-stopped']);
  expect(rows.every(row => row.request?.path === '[omitted]')).toBe(true);
  expect(rows.at(-1)?.measurements).toMatchObject({ ordinal: 64, limitReached: true, admittedCalls: 0 });
  expect(JSON.stringify(rows)).not.toContain('PRIVATE');
});

it('default, disabled and failed diagnostics preserve admission and streamed bytes', async () => {
  for (const observeModelRequest of [undefined, null, () => { throw Error('disk full'); }]) {
    const w = await world(observeModelRequest === undefined ? {} : { observeModelRequest });
    w.gate.open('no-evidence', { framework: 'codex-cli', allowance: 1, edge: w.edge });
    const url = w.gate.base('no-evidence') + '/backend-api/codex/responses';
    expect(await w.send(url)).toEqual({ status: 200, body: 'data: one\n\ndata: two\n\n' });
    expect((await w.send(url)).status).toBe(400);
    expect(w.received).toHaveLength(1);
    expect(w.rows).toEqual([]);
  }
  const boot = readFileSync(join(__dirname, 'journal-agent.mjs'), 'utf8');
  expect(boot).toContain('createAdmissionGate({ observeModelRequest: testCopyModelRequestObserver(journal),');
});

it('rejects sensitive or malformed diagnostic fields at the journal schema boundary', () => {
  const row: PhaseTiming = { kind: 'phase-timing', id: 'tool-turn:answer:1', phase: 'model-request',
    measurements: { ordinal: 1, admittedCalls: 1, admitted: true, limitReached: false },
    request: { path: '/backend-api/codex/responses', result: 'admitted' }, at: 5,
    forward: { generation: 4, additive: true } };
  expect(() => checkPhaseTiming(row)).not.toThrow();
  for (const patch of [
    { request: { ...row.request, path: '/PRIVATE' } },
    { request: { ...row.request, headers: 'PRIVATE' } },
    { request: { ...row.request, result: 'PRIVATE' } },
    { request: undefined },
    { measurements: { ...row.measurements, ordinal: 65 } },
    { measurements: { ...row.measurements, ordinal: 0 } },
    { measurements: { ...row.measurements, admitted: false } },
    { measurements: { ...row.measurements, limitReached: true } },
    { measurements: { ...row.measurements, body: 'PRIVATE' } },
    { phase: 'auth' },
  ]) expect(() => checkPhaseTiming({ ...row, ...patch } as PhaseTiming)).toThrow();
});
