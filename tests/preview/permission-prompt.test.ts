import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Host boundary modules run directly in the native hook process.
import { createAdmissionGate } from './admission-gate.mjs';
// @ts-expect-error Host boundary modules run directly in the native hook process.
import { hookOutput, permissionInputDigest, permissionPromptCandidate } from './tool-admission.mjs';

const captured = JSON.parse(readFileSync(new URL('../fixtures/permission-request-2.1.303.json', import.meta.url), 'utf8'));
const hookPath = new URL('./tool-admission-hook.mjs', import.meta.url).pathname;
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'permission-replay-')), workspace = join(root, 'work'), state = join(root, 'state');
  mkdirSync(workspace); mkdirSync(state);
  let stopped = false;
  const gate = await createAdmissionGate({ stopped: () => stopped, now: () => 1000,
    append: () => { throw Error('ordinary recovery must not prepare a second effect'); },
    effects: { admit: () => { throw Error('not an ordinary call'); } } });
  gate.open('claim', { framework: 'claude-code', allowance: 2, edge: { id: 'edge', child: 'claim' } });
  const config = { workspace, tmp: workspace, maxCalls: 2, maxWriteBytes: 1024, gate: gate.base('claim') };
  writeFileSync(join(state, 'config.json'), JSON.stringify(config));
  cleanups.push(async () => { await gate.stop(); rmSync(root, { recursive: true, force: true }); });
  const events = captured.events.map((row: Record<string, unknown>) => ({ ...row, cwd: workspace,
    tool_input: { ...(row.tool_input as object), file_path: join(workspace, 'answer.txt') } }));
  const invoke = (mode: string, call: unknown) => new Promise<{ code: number | null; output: Record<string, any>; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath, mode, state], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject); child.on('close', code => resolve({ code, output: stdout ? JSON.parse(stdout) : null, stderr }));
    child.stdin.end(JSON.stringify(call));
  });
  return { root, workspace, state, config, gate, events, invoke, stop: () => { stopped = true; },
    configure: (over: object) => writeFileSync(join(state, 'config.json'), JSON.stringify({ ...config, ...over })),
    rows: () => readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)) };
}

it('replays the native permission envelope through the executable hook and real checkpoint once', async () => {
  const f = await fixture();
  expect((await f.invoke('pre', f.events[0])).output.hookSpecificOutput.permissionDecision).toBe('allow');
  expect((await f.invoke('permission', f.events[1])).output).toEqual({ hookSpecificOutput: {
    hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
  expect(f.rows().map(row => row.phase)).toEqual(['pre', 'permission-response']);
  expect(readdirSync(join(f.state, 'slots'))).toHaveLength(1); // consumes the existing admission, no extra spend
  expect(readdirSync(join(f.state, 'permission-responses'))).toHaveLength(1);
  expect((await f.invoke('permission', f.events[1])).output.hookSpecificOutput.decision.behavior).toBe('deny');
  expect(f.gate.state('claim').calls).toBe(0);
});

it.each(['missing', 'changed-input', 'session', 'prompt', 'agent', 'tool', 'completed', 'failed', 'ambiguous', 'closed', 'stop', 'scope', 'cap', 'symlink', 'unreachable', 'crash-claim', 'record-write-fails'])(
  'refuses %s rather than answering a different, stale or ungranted call', async kind => {
    const f = await fixture();
    if (kind !== 'missing') await f.invoke('pre', f.events[0]);
    let request = f.events[1];
    if (kind === 'changed-input') request = { ...request, tool_input: { ...request.tool_input, content: 'different' } };
    if (kind === 'session') request = { ...request, session_id: 'restarted-worker' };
    if (kind === 'prompt') request = { ...request, prompt_id: 'next-turn' };
    if (kind === 'agent') request = { ...request, agent_id: 'other-agent' };
    if (kind === 'tool') request = { ...request, tool_name: 'Edit' };
    if (kind === 'completed') await f.invoke('post', f.events[2]);
    if (kind === 'failed') await f.invoke('post', { ...f.events[2], hook_event_name: 'PostToolUseFailure', error: 'failure' });
    if (kind === 'ambiguous') await f.invoke('pre', { ...f.events[0], tool_use_id: 'second-identical-call' });
    if (kind === 'closed') f.gate.close('claim');
    if (kind === 'stop') f.stop();
    if (kind === 'scope') f.configure({ workspace: join(f.root, 'different'), tmp: join(f.root, 'different') });
    if (kind === 'cap') f.configure({ maxCalls: 0 });
    if (kind === 'symlink') symlinkSync(join(f.root, 'outside.txt'), request.tool_input.file_path);
    if (kind === 'unreachable') await f.gate.stop();
    if (kind === 'crash-claim') {
      mkdirSync(join(f.state, 'permission-responses'));
      writeFileSync(join(f.state, 'permission-responses', permissionInputDigest(f.events[0].tool_use_id)), 'claimed\n');
    }
    if (kind === 'record-write-fails') writeFileSync(join(f.state, 'permission-responses'), 'not a directory');
    const answer = await f.invoke('permission', request);
    expect(answer.output.hookSpecificOutput.decision.behavior).toBe('deny');
    expect(JSON.stringify(answer.output)).not.toContain('permission-proof');
    expect(answer.stderr).toBe('');
  });

it('atomic one-use consumption survives simultaneous duplicate native requests', async () => {
  const f = await fixture(); await f.invoke('pre', f.events[0]);
  const outcomes = await Promise.all([f.invoke('permission', f.events[1]), f.invoke('permission', f.events[1])]);
  expect(outcomes.map(row => row.output.hookSpecificOutput.decision.behavior).sort()).toEqual(['allow', 'deny']);
});

it('a blanket permission suggestion never widens the response and a truncated input cannot match', async () => {
  const f = await fixture(); await f.invoke('pre', f.events[0]);
  const answer = await f.invoke('permission', { ...f.events[1], permission_suggestions: [{ type: 'setMode', mode: 'bypassPermissions', destination: 'userSettings' }] });
  expect(answer.output.hookSpecificOutput.decision).toEqual({ behavior: 'allow' });
  const row = f.rows()[0];
  expect(permissionPromptCandidate(f.events[1], [{ ...row, input: '{truncated' }])).toBeNull();
  expect(permissionPromptCandidate(f.events[1], [{ ...row, permission: { ...row.permission, original: 'wrong' } }])).toBeNull();
  expect(permissionPromptCandidate(f.events[1], [{ ...row, decision: 'deny' }])).toBeNull();
  expect(permissionPromptCandidate(f.events[1], [{ ...row, doorway: { admitted: true } }])).toBeNull();
});

it('unknown decisions never become allows and supplied rewrites never turn a deny into an allow', () => {
  expect(hookOutput({ decision: 'gate', updatedInput: {} })).toBeNull();
  expect(hookOutput({ decision: 'deny', reason: 'grant required', updatedInput: {} })).toEqual({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'grant required' } });
});

it('revalidates the exact confined shell rewrite instead of approving the unconfined original', async () => {
  const f = await fixture(); f.configure({ shellProfile: join(f.state, 'shell.sb') });
  const pre = { ...f.events[0], tool_name: 'Bash', tool_input: { command: 'printf fixture', description: 'test' } };
  const admitted = (await f.invoke('pre', pre)).output.hookSpecificOutput;
  expect(admitted.permissionDecision).toBe('allow');
  expect(admitted.updatedInput.command).toContain('/usr/bin/sandbox-exec');
  const request = { ...f.events[1], tool_name: 'Bash', tool_input: admitted.updatedInput };
  expect(permissionPromptCandidate({ ...request, tool_input: pre.tool_input }, f.rows())).toBeNull();
  expect((await f.invoke('permission', request)).output.hookSpecificOutput.decision).toEqual({ behavior: 'allow' });
  const other = await fixture(); other.configure({ shellProfile: join(other.state, 'shell.sb') });
  const original = { ...other.events[0], tool_name: 'Bash', tool_input: pre.tool_input };
  const rewritten = (await other.invoke('pre', original)).output.hookSpecificOutput.updatedInput;
  other.configure({ shellProfile: join(other.state, 'different.sb') });
  expect((await other.invoke('permission', { ...other.events[1], tool_name: 'Bash', tool_input: rewritten })).output.hookSpecificOutput.decision.behavior).toBe('deny');
});

it('recorded model judgments, uncertainty and empty replies can never supply call authority', () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  expect(recorded.otherShapes).toHaveLength(7);
  for (const shape of recorded.otherShapes) {
    let value;
    try { value = JSON.parse(shape.raw); } catch { value = shape.raw; }
    expect(permissionPromptCandidate(value, [])).toBeNull();
    expect(hookOutput({ decision: value?.verdict ?? 'unknown' })).toBeNull();
  }
});

it('a completed identical ordinary call does not consume the next call’s distinct authorization', async () => {
  const f = await fixture(); await f.invoke('pre', f.events[0]); await f.invoke('post', f.events[2]);
  await f.invoke('pre', { ...f.events[0], tool_use_id: 'second-distinct-call' });
  expect((await f.invoke('permission', f.events[1])).output.hookSpecificOutput.decision).toEqual({ behavior: 'allow' });
  expect(f.rows().at(-1).id).toBe('second-distinct-call');
});
