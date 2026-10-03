// Part fifteen §5 (docs/19-scheduled-work) and Rules 1, 30, 60, 114: a delegated session keeps the full tool set, and
// every tool call passes the same admission hook as the tool turn before dispatch. Both sides of each decision run
// through the real executable hook: ordinary in-workspace work, delegation and network reads are admitted; MCP goes to
// the effect doorway, which admits only a registered operation; every shell command is rewritten to run confined; a
// call past the reserved ceiling stops the harness by exact PID. Rule 106: the tool calls a live Codex 0.156.1 session
// sent its hook (fixtures/codex-hook-probe-2026-10-03, recorded 2026-10-03) replay through it too.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The hook and its state stay plain JavaScript: the harness runs them without a loader.
import { prepareSessionAdmission, sessionAdmissionCeiling, sessionAdmissionCommand } from './session-admission.mjs';
// @ts-expect-error see above
import { toolTrace } from './tool-admission.mjs';

const HOOK = join(__dirname, 'tool-admission-hook.mjs');
const PROBE = join(__dirname, 'fixtures/codex-hook-probe-2026-10-03');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
/** Whether this host can apply a sandbox profile at all (a host already inside a sandbox cannot). */
const sandboxWorks = spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)', '/usr/bin/true']).status === 0;

function step(options: { maxCalls?: number; operations?: readonly string[]; harness?: string } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'session-admission-'))); roots.push(root);
  const ws = join(root, 'ws'), outside = join(root, 'outside'), base = join(root, 'admission');
  for (const dir of [ws, outside]) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(ws, 'in.txt'), 'hi\n'); writeFileSync(join(outside, 'canary.txt'), 'CANARY-DUMMY-0002\n');
  const claim = 'session-work-0123456789abcdef0123456789abcdef';
  const state = prepareSessionAdmission({ base, claim, workspace: ws, harness: options.harness ?? 'codex',
    maxCalls: options.maxCalls ?? 23, operations: options.operations ?? [] });
  return { root, ws, outside, base, claim, state };
}
const call = (tool_name: string, tool_input: object, id = `call_${tool_name}`) => JSON.stringify({ tool_name, tool_input, tool_use_id: id });
const hook = (state: string, input: string, mode = 'pre') => {
  const r = spawnSync(process.execPath, [HOOK, mode, state], { input, encoding: 'utf8' });
  const output = r.stdout ? JSON.parse(r.stdout) as { hookSpecificOutput: { permissionDecision: string; updatedInput?: { command: string } } } : null;
  return { status: r.status, decision: r.status === 2 ? 'refuse' : output?.hookSpecificOutput.permissionDecision ?? 'allow',
    command: output?.hookSpecificOutput.updatedInput?.command ?? null, stderr: r.stderr };
};
const slotsTaken = (state: string) => { try { return readFileSync(join(state, 'admission.jsonl'), 'utf8'); } catch { return ''; } };

it('lays out a fresh admission state per step: config, confined-shell profile, and no ceiling yet', () => {
  const s = step();
  const config = JSON.parse(readFileSync(join(s.state, 'config.json'), 'utf8'));
  expect(config).toMatchObject({ workspace: s.ws, tmp: join(s.ws, '.tmp'), maxCalls: 23, harness: 'codex', delegation: true,
    networkReads: true, operations: [], shellProfile: join(s.state, 'shell.sb') });
  expect(readFileSync(config.shellProfile, 'utf8')).toContain('(deny network*)');
  expect(sessionAdmissionCeiling(s.base, s.claim)).toBe(false);
  expect(sessionAdmissionCeiling(s.base, 'session-work-unprepared')).toBe(null);
  expect(sessionAdmissionCommand({ base: s.base, node: '/node' })(s.claim, 'pre')).toBe(`/node ${HOOK} pre ${s.state}`);
  // A new step for the same claim starts from nothing: slots, record and any marker are gone.
  writeFileSync(join(s.state, 'ceiling'), '{}');
  prepareSessionAdmission({ base: s.base, claim: s.claim, workspace: s.ws, harness: 'codex', maxCalls: 23, operations: [] });
  expect(sessionAdmissionCeiling(s.base, s.claim)).toBe(false);
});

it('admits the full tool set: ordinary work, delegation and network reads; scope and unregistered effects refuse', () => {
  const s = step();
  const decide = (tool: string, input: object) => hook(s.state, call(tool, input)).decision;
  expect(decide('Read', { file_path: join(s.ws, 'in.txt') })).toBe('allow');
  expect(decide('Read', { file_path: join(s.outside, 'canary.txt') })).toBe('deny');
  expect(decide('apply_patch', { command: `*** Begin Patch\n*** Add File: ${join(s.ws, 'n.txt')}\n+hi\n*** End Patch` })).toBe('allow');
  expect(decide('apply_patch', { command: `*** Begin Patch\n*** Add File: ${join(s.outside, 'n.txt')}\n+hi\n*** End Patch` })).toBe('deny');
  expect(decide('apply_patch', { command: 'not a patch' })).toBe('deny');
  expect(decide('Agent', { prompt: 'look into it' })).toBe('allow');
  expect(decide('spawn_agent', { message: 'look into it' })).toBe('allow');
  expect(decide('WebFetch', { url: 'https://example.com' })).toBe('allow');
  expect(decide('TodoWrite', { todos: [] })).toBe('allow');
  // MCP is a consequential tool: the effect doorway refuses it, since this profile registers no tool:mcp operation.
  expect(decide('mcp__threadline__threadline_send', { message: 'hi' })).toBe('deny');
  expect(decide('SomethingNew', {})).toBe('deny');
  // Delegation and a fetch each take two slots (the new thread's first call, the fetch's own summary call).
  const record = toolTrace(slotsTaken(s.state).split('\n').filter(Boolean));
  expect(record.calls.map((c: { n: number }) => c.n)).toEqual([1, 2, 3, 4, 5, 7, 9, 11, 12, 13, 14]);
});

it('admits a registered effect through the same doorway: the authorized side of the MCP decision', () => {
  const s = step({ operations: ['tool:mcp'] });
  expect(hook(s.state, call('mcp__threadline__threadline_send', { message: 'hi' })).decision).toBe('allow');
  expect(hook(s.state, call('WebSearch', { query: 'x' })).decision).toBe('allow');
});

it.skipIf(!sandboxWorks)('runs every admitted shell command confined: workspace work succeeds; secrets, network and other paths refuse', () => {
  const s = step();
  const run = (command: string) => {
    const admitted = hook(s.state, call('Bash', { command }));
    expect(admitted.decision).toBe('allow');
    expect(admitted.command).toMatch(/^\/usr\/bin\/sandbox-exec -f /u);
    return spawnSync('/bin/zsh', ['-c', admitted.command!], { cwd: s.ws, encoding: 'utf8' });
  };
  expect(run('echo made > made.txt && cat made.txt').stdout).toBe('made\n');
  expect(readFileSync(join(s.ws, 'made.txt'), 'utf8')).toBe('made\n');
  const leak = run(`cat ${join(s.outside, 'canary.txt')}`);
  expect(leak.stdout).not.toContain('CANARY'); expect(leak.stderr).toMatch(/Operation not permitted/u);
  const config = run(`cat ${join(s.state, 'config.json')}`);
  expect(config.status).not.toBe(0);
  expect(run(`echo x > ${join(s.outside, 'escape.txt')}`).status).not.toBe(0);
  expect(existsSync(join(s.outside, 'escape.txt'))).toBe(false);
  expect(run('curl -sS -m 4 https://example.com').stdout).toBe('');
  // The harness's environment never reaches the command.
  expect(spawnSync('/bin/zsh', ['-c', hook(s.state, call('Bash', { command: 'printenv SECRET_MARKER' })).command!],
    { cwd: s.ws, encoding: 'utf8', env: { ...process.env, SECRET_MARKER: 'leak' } }).stdout).toBe('');
});

it('a call past the reserved ceiling stops the harness by exact PID and leaves the marker; within it nothing stops', async () => {
  const s = step({ maxCalls: 3 });
  // A stand-in harness: a node process whose executable name is `codex`, whose only child is the hook.
  const harness = join(s.root, 'codex');
  symlinkSync(process.execPath, harness);
  const runAsHarness = (input: string) => new Promise<{ signal: string | null; hookStatus: number | null }>(resolve => {
    const script = `const r = require('node:child_process').spawnSync(${JSON.stringify(process.execPath)}, [${JSON.stringify(HOOK)}, 'pre', `
      + `${JSON.stringify(s.state)}], { input: ${JSON.stringify(input)} }); process.stdout.write(String(r.status)); setTimeout(() => {}, 5000);`;
    const child = spawn(harness, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 4000);
    child.on('exit', (_code, signal) => { clearTimeout(timer); resolve({ signal, hookStatus: out ? Number(out) : null }); });
  });
  // Slot 1 by an ordinary call: the harness keeps running (it ends here only by the test's own timer).
  expect((await runAsHarness(call('Read', { file_path: join(s.ws, 'in.txt') }, 'c1'))).signal).toBe('SIGKILL');
  expect(sessionAdmissionCeiling(s.base, s.claim)).toBe(false);
  // A delegation takes the two remaining slots and is admitted; the next call finds none left: the harness is
  // signalled, the marker says why, and the hook refused the call.
  expect((await runAsHarness(call('Agent', { prompt: 'x' }, 'c2'))).signal).toBe('SIGKILL');
  const ceiling = await runAsHarness(call('Read', { file_path: join(s.ws, 'in.txt') }, 'c3'));
  expect(ceiling.signal).toBe('SIGTERM');
  expect(sessionAdmissionCeiling(s.base, s.claim)).toBe(true);
  const record = toolTrace(slotsTaken(s.state).split('\n').filter(Boolean));
  expect(record.calls.map((c: { decision: string }) => c.decision)).toEqual(['allow', 'allow', 'deny']);
});

it('the tool turn is unchanged: with no harness named, a call past its cap is a plain refusal and nothing is stopped', () => {
  const s = step({ maxCalls: 1 });
  const config = JSON.parse(readFileSync(join(s.state, 'config.json'), 'utf8'));
  writeFileSync(join(s.state, 'config.json'), JSON.stringify({ ...config, harness: undefined }));
  expect(hook(s.state, call('Read', { file_path: join(s.ws, 'in.txt') }, 'a')).decision).toBe('allow');
  expect(hook(s.state, call('Read', { file_path: join(s.ws, 'in.txt') }, 'b')).decision).toBe('deny');
  expect(sessionAdmissionCeiling(s.base, s.claim)).toBe(false);
});

it('replays the hook inputs a live Codex 0.156.1 session sent (Rule 106): its shell and patch calls reach the session decisions', () => {
  const s = step();
  const recorded = ['hook-input.jsonl', 'sandboxed-hook-input.jsonl'].flatMap(name =>
    readFileSync(join(PROBE, name), 'utf8').split('\n').filter(Boolean));
  expect(recorded.length).toBe(6);
  const decisions = recorded.map(line => {
    const row = JSON.parse(line.replaceAll('/tmp/cxprobe/ws', s.ws));
    expect(row.hook_event_name).toBe('PreToolUse');
    const decided = hook(s.state, JSON.stringify(row));
    return [row.tool_name, decided.decision, decided.command === null ? null : decided.command.startsWith('/usr/bin/sandbox-exec')];
  });
  expect(decisions).toEqual([['Bash', 'allow', true], ['Bash', 'allow', true], ['apply_patch', 'allow', null],
    ['Bash', 'allow', true], ['Bash', 'allow', true], ['Bash', 'allow', true]]);
  // The recorded PostToolUse input pairs with its call by the same id, so the trace is consistent.
  const post = readFileSync(join(PROBE, 'post-hook-input.jsonl'), 'utf8').split('\n').filter(Boolean).at(-1)!;
  const pre = JSON.parse(post); delete pre.tool_response; pre.hook_event_name = 'PreToolUse';
  const t = step();
  hook(t.state, JSON.stringify(pre)); hook(t.state, post, 'post');
  expect(toolTrace(slotsTaken(t.state).split('\n').filter(Boolean))).toMatchObject({ consistent: true, admitted: 1 });
});

it('a slot is taken atomically even when every call races for it', async () => {
  const s = step({ maxCalls: 4 });
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => new Promise<number | null>(resolve => {
    const child = spawn(process.execPath, [HOOK, 'pre', s.state], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.stdin.end(call('Read', { file_path: join(s.ws, 'in.txt') }, `race${i}`));
    child.on('exit', code => resolve(code));
  })));
  // No harness ancestor named `codex` exists here, so the four over the ceiling refuse (exit 2) after marking it.
  expect(results.filter(code => code === 0)).toHaveLength(4);
  expect(results.filter(code => code === 2)).toHaveLength(4);
  for (let slot = 1; slot <= 4; slot++) expect(() => closeSync(openSync(join(s.state, 'slots', String(slot)), 'wx'))).toThrow();
  expect(sessionAdmissionCeiling(s.base, s.claim)).toBe(true);
});
