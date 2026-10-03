// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule: the mandatory admission hook. Every case of the w4-toolsreuse
// spike's layer A (scratch/w4-toolsreuse/hooktest.mjs at cab6b51d, 33/33) runs through the real executable
// hook, plus the effect-doorway refusal, the messaging-variable stripping (residual 6) and the trace pairing.
// Rule 106: the recorded tool calls of the spike's real harness runs (fixtures/tool-turn/spike-cab6b51d,
// verbatim) replay through the same hook and must reach the decision the spike's hook recorded.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The hook and its decision stay plain JavaScript: the harness runs them without a loader.
import { admitToolCall, admitToolEffect, shellEffect, TOOL_SHELL_PREFIX, toolTrace } from './tool-admission.mjs';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';

const HOOK = join(__dirname, 'tool-admission-hook.mjs');
const SPIKE = join(__dirname, 'fixtures/tool-turn/spike-cab6b51d');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

/** A turn laid out as the runner lays it out: `ws` and `state` side by side, the config in `state`. */
function turn(maxCalls = 50) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-admission-'))); roots.push(root);
  for (const dir of ['ws/sub', 'state', 'outside']) mkdirSync(join(root, dir), { recursive: true });
  const ws = join(root, 'ws'), outside = join(root, 'outside'), state = join(root, 'state');
  writeFileSync(join(ws, 'in.txt'), 'hi\n'); writeFileSync(join(outside, 'canary.txt'), 'CANARY-DUMMY-0001\n');
  symlinkSync(outside, join(ws, 'link'));
  writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, maxCalls, maxWriteBytes: 1048576,
    operations: [...SINGLE_MACHINE_PROFILE.operations] }));
  return { root, ws, outside, state };
}
const hook = (state: string, input: string, preset?: number, mode = 'pre') => {
  if (preset !== undefined) writeFileSync(join(state, 'calls'), String(preset)); else rmSync(join(state, 'calls'), { force: true });
  const r = spawnSync(process.execPath, [HOOK, mode, state], { input, encoding: 'utf8' });
  const decision = r.status === 2 ? 'refuse' : /"permissionDecision":"(\w+)"/u.exec(r.stdout)?.[1] ?? 'allow';
  return { status: r.status, decision, stdout: r.stdout };
};
const j = (tool_name: string, tool_input: object) => JSON.stringify({ tool_name, tool_input, tool_use_id: `toolu_${tool_name}` });

it('decides every layer-A case of the spike exactly as the spike did, through the real executable hook', () => {
  const { ws: WS, outside: OUT, state } = turn();
  const cases: [string, string, string, number?, number?][] = [
    ['read-inside', 'allow', j('Read', { file_path: `${WS}/in.txt` })],
    ['read-outside-abs', 'deny', j('Read', { file_path: `${OUT}/canary.txt` })],
    ['read-dotdot', 'deny', j('Read', { file_path: `${WS}/../outside/canary.txt` })],
    ['read-relative-dotdot', 'deny', j('Read', { file_path: '../outside/canary.txt' })],
    ['read-via-symlink', 'deny', j('Read', { file_path: `${WS}/link/canary.txt` })],
    ['read-missing-path', 'deny', j('Read', {})],
    ['write-inside-new', 'allow', j('Write', { file_path: `${WS}/sub/new.txt`, content: 'x' })],
    ['write-outside', 'deny', j('Write', { file_path: `${OUT}/x.txt`, content: 'x' })],
    ['write-via-symlink', 'deny', j('Write', { file_path: `${WS}/link/x.txt`, content: 'x' })],
    ['write-nonexistent-dotdot', 'deny', j('Write', { file_path: `${WS}/nope/../../outside/y.txt`, content: 'x' })],
    ['edit-inside', 'allow', j('Edit', { file_path: `${WS}/in.txt`, old_string: 'hi', new_string: 'ho' })],
    ['edit-dotdot', 'deny', j('Edit', { file_path: `${WS}/sub/../../outside/canary.txt`, old_string: 'a', new_string: 'b' })],
    ['glob-inside', 'allow', j('Glob', { pattern: '**/*.txt' })],
    ['glob-outside-path', 'deny', j('Glob', { pattern: '*', path: OUT })],
    ['glob-via-symlink-path', 'deny', j('Glob', { pattern: '*', path: `${WS}/link` })],
    ['glob-dotdot-pattern', 'deny', j('Glob', { pattern: '../outside/*' })],
    ['glob-abs-pattern', 'deny', j('Glob', { pattern: '/etc/*' })],
    ['bash-plain', 'allow', j('Bash', { command: 'wc -c in.txt' })],
    ['bash-network-curl', 'deny', j('Bash', { command: 'curl -sI https://example.org' })],
    ['bash-network-git-push', 'deny', j('Bash', { command: 'git push origin main' })],
    ['bash-delete', 'deny', j('Bash', { command: 'rm -f in.txt' })],
    ['bash-host-control', 'deny', j('Bash', { command: 'launchctl list' })],
    ['bash-send', 'deny', j('Bash', { command: 'mail -s hi a@b.c < in.txt' })],
    ['bash-unsandboxed-flag', 'deny', j('Bash', { command: 'ls', dangerouslyDisableSandbox: true })],
    ['webfetch', 'deny', j('WebFetch', { url: 'https://example.com', prompt: 'x' })],
    ['websearch', 'deny', j('WebSearch', { query: 'x' })],
    ['mcp', 'deny', j('mcp__threadline__threadline_send', { to: 'x' })],
    ['agent-tool', 'deny', j('Agent', { prompt: 'x' })],
    ['unknown-tool', 'deny', j('FooTool', {})],
    ['malformed-json', 'refuse', '{"tool_name":"Read",'],
    ['empty-input', 'refuse', ''],
    ['cap-3rd-of-3', 'allow', j('Bash', { command: 'wc -c in.txt' }), 3, 2],
    ['cap-4th-of-3', 'deny', j('Bash', { command: 'wc -c in.txt' }), 3, 3],
  ];
  expect(cases).toHaveLength(33);
  const results = cases.map(([label, , input, cap, preset]) => {
    if (cap !== undefined) writeFileSync(join(state, 'config.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(state, 'config.json'), 'utf8')), maxCalls: cap }));
    const got = hook(state, input, preset).decision;
    if (cap !== undefined) writeFileSync(join(state, 'config.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(state, 'config.json'), 'utf8')), maxCalls: 50 }));
    return [label, got];
  });
  expect(results).toEqual(cases.map(([label, want]) => [label, want]));
});

it('sends every consequential call to the effect doorway, which refuses: the installed profile registers no tool operation', () => {
  expect(SINGLE_MACHINE_PROFILE.operations.some((op: string) => op.startsWith('tool:'))).toBe(false);
  for (const kind of ['network', 'delete', 'host-control', 'send', 'mcp', 'unsandboxed']) {
    const verdict = admitToolEffect(kind, SINGLE_MACHINE_PROFILE.operations);
    expect(verdict).toEqual({ admitted: false, reason: expect.stringContaining(`registers no tool:${kind} operation`) });
  }
  // The other side of the boundary: a profile that registered the exact operation would admit it.
  expect(admitToolEffect('network', ['tool:network']).admitted).toBe(true);
  const { ws } = turn();
  const fs = { exists: () => true, realpath: (p: string) => p };
  expect(admitToolCall({ tool_name: 'Bash', tool_input: { command: 'curl https://example.com' } },
    { workspace: ws, maxCalls: 5, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations }, 1, fs))
    .toMatchObject({ decision: 'deny', kind: 'network', reason: expect.stringContaining('effect doorway') });
  expect(shellEffect('wc -c note.txt')).toBeNull();
  expect(shellEffect('perl -e 1 && rm x')).toBe('delete');
});

it('strips the harness messaging socket and token from every admitted shell command, and only from shell commands', () => {
  const { state } = turn();
  const out = hook(state, j('Bash', { command: 'wc -c in.txt', description: 'count' }));
  const parsed = JSON.parse(out.stdout).hookSpecificOutput;
  expect(parsed).toMatchObject({ permissionDecision: 'allow', updatedInput: { command: `${TOOL_SHELL_PREFIX}wc -c in.txt`, description: 'count' } });
  expect(TOOL_SHELL_PREFIX).toMatch(/^unset CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_MESSAGING_SOCKET; ulimit -f 65536; $/u);
  // The prefix really removes both from the command's environment (a plain shell stands in for the sandboxed one).
  const shell = spawnSync('/bin/sh', ['-c', `${TOOL_SHELL_PREFIX}env | grep -c '^CLAUDE_CODE_MESSAGING_' || true`],
    { env: { PATH: '/usr/bin:/bin', CLAUDE_CODE_MESSAGING_TOKEN: 'dummy-not-a-secret', CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/none.sock' }, encoding: 'utf8' });
  expect(shell.stdout.trim()).toBe('0');
  const unstripped = spawnSync('/bin/sh', ['-c', "env | grep -c '^CLAUDE_CODE_MESSAGING_'"],
    { env: { PATH: '/usr/bin:/bin', CLAUDE_CODE_MESSAGING_TOKEN: 'dummy-not-a-secret', CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/none.sock' }, encoding: 'utf8' });
  expect(unstripped.stdout.trim()).toBe('2');
  // A file tool is admitted unchanged: no rewritten input.
  const read = hook(state, j('Read', { file_path: join(state, '..', 'ws', 'in.txt') }));
  expect(read).toMatchObject({ status: 0, decision: 'allow', stdout: '' });
});

it('records each call and its result; a result with no admitted call before it makes the trace inconsistent', () => {
  const { ws, state } = turn();
  hook(state, j('Write', { file_path: `${ws}/note.txt`, content: 'hello reuse' }));
  hook(state, JSON.stringify({ tool_name: 'Write', tool_use_id: 'toolu_Write', tool_response: { type: 'create' } }), undefined, 'post');
  const lines = readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n');
  const trace = toolTrace(lines);
  expect(trace).toMatchObject({ consistent: true, admitted: 1, refused: 0, calls: [{ n: 1, tool: 'Write', decision: 'allow',
    result: expect.stringContaining('create') }] });
  // A tool that ran past the hook: a result line with no matching admitted call.
  const bypass = toolTrace([...lines, JSON.stringify({ phase: 'post', id: 'toolu_unseen', tool: 'Read', result: '"x"' })]);
  expect(bypass.consistent).toBe(false);
  // A refused call's result never pairs either.
  expect(toolTrace([JSON.stringify({ phase: 'pre', id: 'a', n: 1, tool: 'Read', decision: 'deny', reason: 'r' }),
    JSON.stringify({ phase: 'post', id: 'a', tool: 'Read', result: '"x"' })]).consistent).toBe(false);
  expect(toolTrace(['not json']).consistent).toBe(false);
});

it('replays every tool call the spike recorded under the real harness and reaches the recorded decision (Rule 106)', () => {
  const PREFIX = '/Users/dabombstudio/.instar/agents/echo/.worktrees/w4-toolsreuse/scratch/w4-toolsreuse-run';
  const runs: [string, number][] = [['b1-hook', 50], ['b3-hook-tight', 50], ['c1-task', 50], ['d1-turncap', 50],
    ['d2-callcap', 2], ['e2-workflow', 50]];
  let replayed = 0;
  for (const [run, cap] of runs) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-replay-'))); roots.push(root);
    const ws = join(root, run, 'ws'), state = join(root, run, 'state');
    for (const dir of [ws, state, join(root, 'outside'), join(root, 'protected')]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, maxCalls: cap, maxWriteBytes: 1048576,
      operations: [...SINGLE_MACHINE_PROFILE.operations] }));
    rmSync(join(state, 'calls'), { force: true });
    const rows = readFileSync(join(SPIKE, run, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    for (const row of rows) {
      const input = JSON.parse(JSON.stringify(row.input).split(PREFIX).join(root));
      const r = spawnSync(process.execPath, [HOOK, 'pre', state], { input: JSON.stringify({ tool_name: row.tool, tool_input: input,
        tool_use_id: `toolu_${String(row.n)}` }), encoding: 'utf8' });
      const got = /"permissionDecision":"(\w+)"/u.exec(r.stdout)?.[1] ?? 'allow';
      expect([run, row.n, row.tool, got]).toEqual([run, row.n, row.tool, row.decision]);
      replayed++;
    }
  }
  expect(replayed).toBe(33);
});
