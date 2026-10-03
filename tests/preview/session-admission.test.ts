// Part fifteen §5 (docs/19-scheduled-work) and Rules 1, 30, 60, 114: a delegated session keeps the full tool set, and
// every tool call passes the same admission hook as the tool turn before dispatch. Both sides of each decision run
// through the real executable hook and the real host checkpoint (admission-gate.mjs): ordinary in-workspace work and
// network reads are admitted; a delegation is admitted only after its durable child edge is recorded; an MCP tool
// passes the effect owner by exact operation; every shell command is rewritten to run confined. Rule 106: the tool
// calls live Codex 0.156.1 sessions sent their hook (fixtures/codex-hook-probe-2026-10-03 and
// fixtures/codex-capabilities-2026-10-03, recorded 2026-10-03) replay through it too.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { SessionWorkEdge } from '../../src/assembly/production-session-work.js';
// @ts-expect-error The hook and its state stay plain JavaScript: the harness runs them without a loader.
import { prepareSessionAdmission, sessionAdmissionCommand } from './session-admission.mjs';
// @ts-expect-error see above
import { toolTrace } from './tool-admission.mjs';
// @ts-expect-error see above
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';

const HOOK = join(__dirname, 'tool-admission-hook.mjs');
const PROBE = join(__dirname, 'fixtures/codex-hook-probe-2026-10-03');
const CAPABILITIES = join(__dirname, 'fixtures/codex-capabilities-2026-10-03');
const roots: string[] = [];
const gates: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const gate of gates.splice(0)) await gate.stop();
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});
/** Whether this host can apply a sandbox profile at all (a host already inside a sandbox cannot). */
const sandboxWorks = spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)', '/usr/bin/true']).status === 0;
type Row = { type: string; id: string; state?: string; parent?: string; drawsOn?: string; operation?: string };

async function step(options: { maxCalls?: number; operations?: readonly string[]; stopped?: () => boolean } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'session-admission-'))); roots.push(root);
  const ws = join(root, 'ws'), outside = join(root, 'outside'), base = join(root, 'admission');
  for (const dir of [ws, outside]) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(ws, 'in.txt'), 'hi\n'); writeFileSync(join(outside, 'canary.txt'), 'CANARY-DUMMY-0002\n');
  const claim = 'session-work-0123456789abcdef0123456789abcdef';
  const rows: Row[] = [], prepared = new Set<string>();
  const append = (row: Row) => { rows.push(row); if (row.type === 'SessionWorkEffect' && row.state === 'prepared') prepared.add(row.id); };
  const gate = await createAdmissionGate({ append, stopped: options.stopped ?? (() => false), now: () => 1_000,
    effects: createToolEffectOwner({ operations: options.operations ?? [], append, stopped: () => false, now: () => 1_000,
      prepared: (id: string) => prepared.has(id) }) });
  gates.push(gate);
  const edge: SessionWorkEdge = { type: 'SessionWorkEdge', schemaVersion: 1, id: 'session-work-edge:obligation-1:1', parent: 'launch:1',
    child: claim, scope: ws, owner: 'machine-a', authority: 'a test grant', placement: 'machine:machine-a', transport: 'tmux',
    budget: { steps: 1, deadline: 9_999, maxResultBytes: 65536, calls: 24, tokens: null }, exitTest: 'x', resultDestination: join(ws, 'r.json'),
    openedAt: 1 };
  gate.open(claim, { framework: 'codex-cli', allowance: 24, edge });
  const state = prepareSessionAdmission({ base, claim, workspace: ws, maxCalls: options.maxCalls ?? 24, gate: gate.base(claim) });
  return { root, ws, outside, base, claim, state, gate, rows, edge };
}
const call = (tool_name: string, tool_input: object, id = `call_${tool_name}`) => JSON.stringify({ tool_name, tool_input, tool_use_id: id });
/** The real hook as the harness runs it: its own process, asking the checkpoint over loopback (so never spawnSync here). */
const hook = (state: string, input: string, mode = 'pre') => new Promise<{ status: number | null; decision: string;
  command: string | null; stderr: string }>(resolve => {
  const child = spawn(process.execPath, [HOOK, mode, state], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
  child.on('exit', status => {
    const output = out ? JSON.parse(out) as { hookSpecificOutput: { permissionDecision: string; updatedInput?: { command: string } } } : null;
    resolve({ status, decision: status === 2 ? 'refuse' : output?.hookSpecificOutput.permissionDecision ?? 'allow',
      command: output?.hookSpecificOutput.updatedInput?.command ?? null, stderr: err });
  });
  child.stdin.end(input);
});
const recordOf = (state: string) => { try { return readFileSync(join(state, 'admission.jsonl'), 'utf8'); } catch { return ''; } };

it('lays out a fresh admission state per step: config with the checkpoint address and the confined-shell profile', async () => {
  const s = await step();
  const config = JSON.parse(readFileSync(join(s.state, 'config.json'), 'utf8'));
  expect(config).toMatchObject({ workspace: s.ws, tmp: join(s.ws, '.tmp'), maxCalls: 24, delegation: true, networkReads: true,
    gate: s.gate.base(s.claim), shellProfile: join(s.state, 'shell.sb') });
  // No category list travels with the hook: authority for an effect is the effect owner's, by exact operation.
  expect(config.operations).toBeUndefined();
  expect(readFileSync(config.shellProfile, 'utf8')).toContain('(deny network*)');
  expect(sessionAdmissionCommand({ base: s.base, node: '/node' })(s.claim, 'pre')).toBe(`/node ${HOOK} pre ${s.state}`);
  expect(() => prepareSessionAdmission({ base: s.base, claim: s.claim, workspace: s.ws, maxCalls: 24 })).toThrow(/checkpoint address/u);
  expect(() => prepareSessionAdmission({ base: s.base, claim: s.claim, workspace: s.ws, maxCalls: 24, gate: 'http://example.com/x' }))
    .toThrow(/checkpoint address/u);
});

it('admits the full tool set: ordinary work, network reads, delegation as a child edge; scope and unregistered effects refuse', async () => {
  const s = await step();
  const decide = async (tool: string, input: object, id?: string) => (await hook(s.state, call(tool, input, id))).decision;
  expect(await decide('Read', { file_path: join(s.ws, 'in.txt') })).toBe('allow');
  expect(await decide('Read', { file_path: join(s.outside, 'canary.txt') })).toBe('deny');
  expect(await decide('apply_patch', { command: `*** Begin Patch\n*** Add File: ${join(s.ws, 'n.txt')}\n+hi\n*** End Patch` })).toBe('allow');
  expect(await decide('apply_patch', { command: `*** Begin Patch\n*** Add File: ${join(s.outside, 'n.txt')}\n+hi\n*** End Patch` })).toBe('deny');
  expect(await decide('apply_patch', { command: 'not a patch' })).toBe('deny');
  expect(await decide('WebFetch', { url: 'https://example.com' })).toBe('allow');
  expect(await decide('TodoWrite', { todos: [] })).toBe('allow');
  // A delegation is admitted only once its child edge is durable: the edge is in the record before the hook answered.
  expect(s.rows).toHaveLength(0);
  expect(await decide('Agent', { prompt: 'look into it' }, 'toolu_agent_1')).toBe('allow');
  expect(s.rows).toEqual([expect.objectContaining({ type: 'SessionWorkEdge', id: `${s.edge.id}:delegated:toolu_agent_1`,
    parent: s.edge.id, drawsOn: s.edge.id, child: 'delegated:toolu_agent_1' })]);
  // The same delegation is never admitted twice.
  expect(await decide('Agent', { prompt: 'look into it' }, 'toolu_agent_1')).toBe('deny');
  // MCP is consequential: the effect owner refuses an operation the profile does not register.
  expect(await decide('mcp__threadline__threadline_send', { message: 'hi' })).toBe('deny');
  expect(await decide('SomethingNew', {})).toBe('deny');
  // Each call takes one tool-call slot; the model-call ceiling is the checkpoint's.
  const record = toolTrace(recordOf(s.state).split('\n').filter(Boolean));
  expect(record.calls.map((c: { n: number }) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

it('a delegation whose return is interrupted keeps its open edge: the obligation survives for the parent to settle', async () => {
  const s = await step();
  expect((await hook(s.state, call('Agent', { prompt: 'x' }, 'toolu_returned'))).decision).toBe('allow');
  expect((await hook(s.state, call('Agent', { prompt: 'y' }, 'toolu_lost'))).decision).toBe('allow');
  // One returns: its edge closes complete. The other never reports back (its harness died mid-subagent).
  await hook(s.state, JSON.stringify({ tool_name: 'Agent', tool_use_id: 'toolu_returned', tool_response: { content: 'done' } }), 'post');
  expect(s.rows.filter(row => row.type === 'SessionWorkEdgeClose')).toEqual([expect.objectContaining({ state: 'complete',
    id: `${s.edge.id}:delegated:toolu_returned:close` })]);
  const left = s.gate.state(s.claim);
  expect(left.openDelegations.map((edge: SessionWorkEdge) => edge.id)).toEqual([`${s.edge.id}:delegated:toolu_lost`]);
  // The parent closes the claim: nothing more is admitted, and the open edge is still reported for the parent's close.
  expect(s.gate.close(s.claim).openDelegations).toHaveLength(1);
  expect((await hook(s.state, call('Agent', { prompt: 'z' }, 'toolu_after'))).decision).toBe('deny');
});

it('an asynchronous spawn acknowledgement is not completion: the edge stays open until the child\'s result', async () => {
  const spawned = JSON.parse(readFileSync(join(CAPABILITIES, 'hook-input.jsonl'), 'utf8').split('\n')
    .find(line => line.includes('"PostToolUse"') && line.includes('collaborationspawn_agent'))!);
  const post = (s: Awaited<ReturnType<typeof step>>, tool_name: string, id: string, tool_response: unknown, tool_input: object = {}) =>
    hook(s.state, JSON.stringify({ tool_name, tool_use_id: id, tool_input, tool_response }), 'post');
  // The recorded spawn handle, and then the parent ends with no wait: the child is still outstanding at its close.
  const lost = await step();
  expect((await hook(lost.state, call('collaborationspawn_agent', spawned.tool_input, 'call_spawn'))).decision).toBe('allow');
  await post(lost, 'collaborationspawn_agent', 'call_spawn', spawned.tool_response, spawned.tool_input);
  expect(lost.rows.filter(row => row.type === 'SessionWorkEdgeClose')).toEqual([]);
  expect(lost.gate.close(lost.claim).openDelegations.map((edge: SessionWorkEdge) => edge.id)).toEqual([`${lost.edge.id}:delegated:call_spawn`]);
  // A wait that returns is a wake-up, not a completion: a timeout, the bare "Wait completed." Codex 0.156.1 returns
  // (mailbox activity, a child's progress message included), a wait that merely names a child, and a child reported
  // still running or errored all leave every edge open. Only that child's own `completed` result closes it.
  const named = await step();
  for (const id of ['call_a', 'call_b']) {
    expect((await hook(named.state, call('collaborationspawn_agent', { task_name: id }, id))).decision).toBe('allow');
    await post(named, 'collaborationspawn_agent', id, JSON.stringify({ task_name: `/root/${id}` }), { task_name: id });
  }
  const wake = (id: string, result: object, input: object = { timeout_ms: 1 }) =>
    post(named, 'collaborationwait_agent', id, JSON.stringify(result), input);
  await wake('call_w1', { message: 'Wait timed out.', timed_out: true });
  await wake('call_w2', { message: 'Wait completed.', timed_out: false });
  await wake('call_w3', { message: 'Wait completed.', timed_out: false }, { targets: ['/root/call_b'] });
  await wake('call_w4', { status: { '/root/call_a': 'running', '/root/call_b': { errored: 'x' } }, timed_out: false });
  expect(named.gate.state(named.claim).openDelegations).toHaveLength(2);
  expect(named.rows.filter(row => row.type === 'SessionWorkEdgeClose')).toEqual([]);
  await wake('call_w5', { status: { '/root/call_a': 'running', '/root/call_b': { completed: 'the answer' } }, timed_out: false });
  expect(named.gate.state(named.claim).openDelegations.map((edge: SessionWorkEdge) => edge.child)).toEqual(['delegated:call_a']);
  expect(named.rows.filter(row => row.type === 'SessionWorkEdgeClose')).toEqual([expect.objectContaining({ state: 'complete',
    id: `${named.edge.id}:delegated:call_b:close`, resultBytes: 10 })]);
  // A synchronous delegation's return is its result and closes at once; a background one is only a launch.
  const claude = await step();
  expect((await hook(claude.state, call('Agent', { prompt: 'x' }, 'toolu_sync'))).decision).toBe('allow');
  expect((await hook(claude.state, call('Agent', { prompt: 'y', run_in_background: true }, 'toolu_bg'))).decision).toBe('allow');
  await post(claude, 'Agent', 'toolu_sync', { content: 'the answer' }, { prompt: 'x' });
  await post(claude, 'Agent', 'toolu_bg', { content: 'Async agent launched' }, { prompt: 'y', run_in_background: true });
  expect(claude.gate.state(claude.claim).openDelegations.map((edge: SessionWorkEdge) => edge.child)).toEqual(['delegated:toolu_bg']);
});

it('every tool, ordinary work included, runs only while the claim is open and no stop is held', async () => {
  const ordinary = (s: Awaited<ReturnType<typeof step>>) => [call('Write', { file_path: join(s.ws, 'w.txt'), content: 'x' }, 'w'),
    call('Bash', { command: 'ls' }, 'b'), call('webrun', { search_query: [{ q: 'x' }] }, 'n'), call('Read', { file_path: join(s.ws, 'in.txt') }, 'r')];
  const open = await step();
  for (const input of ordinary(open)) expect((await hook(open.state, input)).decision).toBe('allow');
  // The admitted shell keeps its confined rewrite.
  expect((await hook(open.state, call('Bash', { command: 'ls' }, 'b2'))).command).toMatch(/^\/usr\/bin\/sandbox-exec -f /u);
  open.gate.close(open.claim);
  for (const input of ordinary(open)) expect((await hook(open.state, input)).decision).toBe('deny');
  expect(recordOf(open.state)).toContain('this step is closed or a stop is held');
  // A held stop refuses the same ordinary work with the claim still open.
  let stop = false;
  const stopping = await step({ stopped: () => stop });
  expect((await hook(stopping.state, ordinary(stopping)[0]!)).decision).toBe('allow');
  stop = true;
  for (const input of [...ordinary(stopping), call('Agent', { prompt: 'x' }, 'a')]) expect((await hook(stopping.state, input)).decision).toBe('deny');
  // An unreachable checkpoint refuses rather than admits.
  const gone = await step();
  await gone.gate.stop(); gates.splice(gates.indexOf(gone.gate), 1);
  expect((await hook(gone.state, ordinary(gone)[3]!)).decision).toBe('deny');
});

it('authority is read again once the whole admission request has arrived: a close or stop mid-body refuses', async () => {
  for (const withdraw of ['close', 'stop'] as const) {
    let stop = false, checks = 0;
    const s = await step({ stopped: () => { checks += 1; return stop; } });
    const body = JSON.stringify({ kind: 'tool', tool_name: 'Write', tool_use_id: 'w' });
    const url = new URL(`${s.gate.base(s.claim)}/admit`);
    const answer = new Promise<string>((resolve, reject) => {
      const req = request({ host: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; }); res.on('end', () => resolve(text));
      });
      req.on('error', reject); req.flushHeaders();
      // Withdraw only after the checkpoint has read authority on the headers, then send the body.
      const send = () => { if (checks === 0) { setImmediate(send); return; }
        if (withdraw === 'close') s.gate.close(s.claim); else stop = true; req.end(body); };
      send();
    });
    expect(JSON.parse(await answer)).toMatchObject({ decision: 'deny' });
  }
  // The same request with the claim open and no stop is admitted.
  const open = await step();
  expect((await hook(open.state, call('Write', { file_path: join(open.ws, 'w.txt'), content: 'x' }, 'w'))).decision).toBe('allow');
});

it('the effect owner admits only the exact registered operation, records it before dispatch, and never prepares it twice', async () => {
  // A category is never authority: `tool:mcp` registers nothing for an MCP tool.
  const category = await step({ operations: ['tool:mcp'] });
  expect((await hook(category.state, call('mcp__threadline__threadline_agents', {}))).decision).toBe('deny');
  const s = await step({ operations: ['mcp:threadline:threadline_agents'] });
  expect(s.rows).toHaveLength(0);
  expect((await hook(s.state, call('mcp__threadline__threadline_agents', { includeOffline: false }, 'exec-1'))).decision).toBe('allow');
  // The prepared record is durable before the hook answered, with the call's stable identity.
  expect(s.rows).toEqual([expect.objectContaining({ type: 'SessionWorkEffect', state: 'prepared', operation: 'mcp:threadline:threadline_agents',
    edge: s.edge.id })]);
  await hook(s.state, JSON.stringify({ tool_name: 'mcp__threadline__threadline_agents', tool_use_id: 'exec-1', tool_response: { agents: [] } }), 'post');
  expect(s.rows.at(-1)).toMatchObject({ type: 'SessionWorkEffect', state: 'observed', id: s.rows[0]!.id });
  // The same exact operation and input again (a retry, a replayed step): refused, never sent twice.
  expect((await hook(s.state, call('mcp__threadline__threadline_agents', { includeOffline: false }, 'exec-2'))).decision).toBe('deny');
  // A different input is a different identity; an unregistered neighbour refuses.
  expect((await hook(s.state, call('mcp__threadline__threadline_agents', { includeOffline: true }, 'exec-3'))).decision).toBe('allow');
  expect((await hook(s.state, call('mcp__threadline__threadline_send', { agentId: 'x', message: 'y' }, 'exec-4'))).decision).toBe('deny');
  // A held stop refuses even a registered operation.
  const stopped = await step({ operations: ['mcp:threadline:threadline_agents'] });
  stopped.gate.close(stopped.claim);
  expect((await hook(stopped.state, call('mcp__threadline__threadline_agents', {}, 'exec-5'))).decision).toBe('deny');
});

it.skipIf(!sandboxWorks)('runs every admitted shell command confined: workspace work succeeds; secrets, network and other paths refuse', async () => {
  const s = await step();
  const run = async (command: string) => {
    const admitted = await hook(s.state, call('Bash', { command }));
    expect(admitted.decision).toBe('allow');
    expect(admitted.command).toMatch(/^\/usr\/bin\/sandbox-exec -f /u);
    return spawnSync('/bin/zsh', ['-c', admitted.command!], { cwd: s.ws, encoding: 'utf8' });
  };
  expect((await run('echo made > made.txt && cat made.txt')).stdout).toBe('made\n');
  expect(readFileSync(join(s.ws, 'made.txt'), 'utf8')).toBe('made\n');
  const leak = await run(`cat ${join(s.outside, 'canary.txt')}`);
  expect(leak.stdout).not.toContain('CANARY'); expect(leak.stderr).toMatch(/Operation not permitted/u);
  const config = await run(`cat ${join(s.state, 'config.json')}`);
  expect(config.status).not.toBe(0);
  expect((await run(`echo x > ${join(s.outside, 'escape.txt')}`)).status).not.toBe(0);
  expect(existsSync(join(s.outside, 'escape.txt'))).toBe(false);
  expect((await run('curl -sS -m 4 https://example.com')).stdout).toBe('');
  // The harness's environment never reaches the command.
  expect(spawnSync('/bin/zsh', ['-c', (await hook(s.state, call('Bash', { command: 'printenv SECRET_MARKER' }))).command!],
    { cwd: s.ws, encoding: 'utf8', env: { ...process.env, SECRET_MARKER: 'leak' } }).stdout).toBe('');
});

it('a tool call past the step\'s tool-call cap is a plain refusal; nothing is stopped', async () => {
  const s = await step({ maxCalls: 1 });
  expect((await hook(s.state, call('Read', { file_path: join(s.ws, 'in.txt') }, 'a'))).decision).toBe('allow');
  expect((await hook(s.state, call('Read', { file_path: join(s.ws, 'in.txt') }, 'b'))).decision).toBe('deny');
  expect(existsSync(join(s.state, 'ceiling'))).toBe(false);
});

it('replays the hook inputs live Codex 0.156.1 sessions sent (Rule 106): shell, patch, web search, subagents and MCP', async () => {
  const s = await step();
  const recorded = ['hook-input.jsonl', 'sandboxed-hook-input.jsonl'].flatMap(name =>
    readFileSync(join(PROBE, name), 'utf8').split('\n').filter(Boolean));
  expect(recorded.length).toBe(6);
  const decisions = [];
  for (const line of recorded) {
    const row = JSON.parse(line.replaceAll('/tmp/cxprobe/ws', s.ws));
    expect(row.hook_event_name).toBe('PreToolUse');
    const decided = await hook(s.state, JSON.stringify(row));
    decisions.push([row.tool_name, decided.decision, decided.command === null ? null : decided.command.startsWith('/usr/bin/sandbox-exec')]);
  }
  expect(decisions).toEqual([['Bash', 'allow', true], ['Bash', 'allow', true], ['apply_patch', 'allow', null],
    ['Bash', 'allow', true], ['Bash', 'allow', true], ['Bash', 'allow', true]]);
  // The capabilities a live Codex turn used, through the same hook and checkpoint, pre and post in recorded order.
  const capabilities = readFileSync(join(CAPABILITIES, 'hook-input.jsonl'), 'utf8').split('\n').filter(Boolean);
  const verdicts: [string, string][] = [], outstanding: [string, number][] = [];
  for (const line of capabilities) {
    const row = JSON.parse(line.replaceAll('/tmp/cxprobe2/ws', s.ws));
    if (row.hook_event_name === 'PreToolUse') verdicts.push([row.tool_name, (await hook(s.state, JSON.stringify(row))).decision]);
    // A refused call never runs, so the harness sends no PostToolUse for it (the recording admitted it).
    else if (verdicts.at(-1)?.[1] === 'allow') {
      await hook(s.state, JSON.stringify(row), 'post');
      outstanding.push([row.tool_name, s.gate.state(s.claim).openDelegations.length]);
    }
  }
  expect(verdicts).toEqual([['webrun', 'allow'], ['collaborationspawn_agent', 'allow'], ['collaborationwait_agent', 'allow'],
    ['mcp__threadline__threadline_agents', 'deny'], ['mcp__threadline__threadline_send', 'deny']]);
  // The recorded spawn's PostToolUse is only the child's handle ({"task_name":"/root/ok_reply"}): its edge stays open.
  // The recorded wait ({"message":"Wait completed.","timed_out":false}) names no child and carries no result, so it is a
  // wake-up, not completion: the edge stays open and the parent settles it as uncertain at its close.
  expect(outstanding).toEqual([['webrun', 0], ['collaborationspawn_agent', 1], ['collaborationwait_agent', 1]]);
  expect(s.rows.map(row => [row.type, row.state ?? null])).toEqual([['SessionWorkEdge', null]]);
  // The recorded PostToolUse inputs pair with their calls by the same id, so the trace is consistent.
  expect(toolTrace(recordOf(s.state).split('\n').filter(Boolean)).consistent).toBe(true);
});

it('a slot is taken atomically even when every call races for it', async () => {
  const s = await step({ maxCalls: 4 });
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => hook(s.state, call('Read', { file_path: join(s.ws, 'in.txt') }, `race${i}`))));
  expect(results.filter(r => r.decision === 'allow')).toHaveLength(4);
  expect(results.filter(r => r.decision === 'deny')).toHaveLength(4);
  for (let slot = 1; slot <= 4; slot++) expect(() => closeSync(openSync(join(s.state, 'slots', String(slot)), 'wx'))).toThrow();
});

it('keeps only the newest step directories, never the current one', async () => {
  const s = await step();
  for (let i = 0; i < 20; i++) prepareSessionAdmission({ base: s.base, claim: `session-work-${String(i).padStart(32, '0')}`,
    workspace: s.ws, maxCalls: 24, gate: s.gate.base(`session-work-${String(i).padStart(32, '0')}`) });
  const last = `session-work-${String(19).padStart(32, '0')}`;
  expect(existsSync(join(s.base, last, 'config.json'))).toBe(true);
  expect(readdirSync(s.base).length).toBe(16);
});
