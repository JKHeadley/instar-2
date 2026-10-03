// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule: the mandatory admission hook. Every case of the w4-toolsreuse
// spike's layer A (scratch/w4-toolsreuse/hooktest.mjs at cab6b51d, 33/33) runs through the real executable
// hook, plus the effect-doorway refusal, the messaging-variable stripping (residual 6), the atomic per-step
// call slots under concurrent hooks, and the trace pairing. A shell command is admitted whatever words it
// contains: what it can reach is enforced by the sandbox (proven live in tests/integration/tool-turn-live.test.ts).
// Rule 36: the recorded tool calls of the spike's real harness runs (fixtures/tool-turn/spike-cab6b51d,
// verbatim) replay through the same hook and must reach the decision the spike's hook recorded, except the
// shell commands the spike judged by keyword, which this hook admits for the sandbox to bound.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The hook and its decision stay plain JavaScript: the harness runs them without a loader.
import { admitToolCall, admitToolEffect, toolShellPrefix, toolTrace } from './tool-admission.mjs';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';

const HOOK = join(__dirname, 'tool-admission-hook.mjs');
const SPIKE = join(__dirname, 'fixtures/tool-turn/spike-cab6b51d');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

/** A turn laid out as the runner lays it out: `ws` and `state` side by side, the config in `state`. */
function turn(maxCalls = 50) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-admission-'))); roots.push(root);
  for (const dir of ['ws/sub', 'state', 'outside', 'tmp']) mkdirSync(join(root, dir), { recursive: true });
  const ws = join(root, 'ws'), outside = join(root, 'outside'), state = join(root, 'state'), tmp = join(root, 'tmp');
  writeFileSync(join(ws, 'in.txt'), 'hi\n'); writeFileSync(join(outside, 'canary.txt'), 'CANARY-DUMMY-0001\n');
  symlinkSync(outside, join(ws, 'link'));
  writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp, maxCalls, maxWriteBytes: 1048576,
    operations: [...SINGLE_MACHINE_PROFILE.operations] }));
  return { root, ws, outside, state, tmp };
}
/** Marks the first `taken` call slots as already used (the state a step reaches after `taken` calls). */
const takeSlots = (state: string, taken: number) => {
  rmSync(join(state, 'slots'), { recursive: true, force: true }); mkdirSync(join(state, 'slots'));
  for (let slot = 1; slot <= taken; slot++) closeSync(openSync(join(state, 'slots', String(slot)), 'wx'));
};
const hook = (state: string, input: string, preset?: number, mode = 'pre') => {
  if (preset !== undefined) takeSlots(state, preset); else rmSync(join(state, 'slots'), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [HOOK, mode, state], { input, encoding: 'utf8' });
  const decision = r.status === 2 ? 'refuse' : /"permissionDecision":"(\w+)"/u.exec(r.stdout)?.[1] ?? 'allow';
  return { status: r.status, decision, stdout: r.stdout };
};
const j = (tool_name: string, tool_input: object) => JSON.stringify({ tool_name, tool_input, tool_use_id: `toolu_${tool_name}` });

it('decides every layer-A case of the spike through the real executable hook; shell commands are admitted for the sandbox to bound', () => {
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
    // The spike refused these five by keyword. A word is not an effect: the sandbox refuses the network, writes and reads
    // outside the scratch volume and signals to other processes, so the hook admits them (live proof: tool-turn-live).
    ['bash-network-curl', 'allow', j('Bash', { command: 'curl -sI https://example.org' })],
    ['bash-network-git-push', 'allow', j('Bash', { command: 'git push origin main' })],
    ['bash-delete', 'allow', j('Bash', { command: 'rm -f in.txt' })],
    ['bash-host-control', 'allow', j('Bash', { command: 'launchctl list' })],
    ['bash-send', 'allow', j('Bash', { command: 'mail -s hi a@b.c < in.txt' })],
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

it('sends every consequential tool to the effect doorway, which refuses it by the four tests under the default policy', () => {
  expect(SINGLE_MACHINE_PROFILE.operations.some((op: string) => op.startsWith('tool:'))).toBe(false);
  const defaults = { operations: SINGLE_MACHINE_PROFILE.operations };
  for (const effect of ['tool:network', 'tool:mcp', 'tool:unsandboxed']) {
    const verdict = admitToolEffect({ effect }, defaults, 0);
    expect(verdict).toMatchObject({ admitted: false, disposition: 'refused', reason: expect.stringContaining(`effect doorway refused ${effect}`) });
  }
  // The other side of the boundary: a recorded scope grant places a web read in scope, so the doorway admits it as ordinary.
  expect(admitToolEffect({ effect: 'tool:network', target: 'example.com' }, { ...defaults, effectPolicy: { type: 'PreviewEffectPolicy',
    resourceLevelUsd: 0, policySensitive: [], registered: [], grants: [{ id: 'g', effect: 'tool:network', approves: ['scope'],
      source: 'telegram:102965:121996', custodian: 'desk', recovery: 'remove the grant' }] } }, 0)).toMatchObject({ admitted: true, disposition: 'ordinary' });
  const { ws, tmp } = turn();
  const fs = { exists: () => true, realpath: (p: string) => p };
  const config = { workspace: ws, tmp, maxCalls: 5, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations };
  const call = (tool_name: string, tool_input: object) => admitToolCall({ tool_name, tool_input }, config, 1, fs);
  expect(call('Bash', { command: 'ls', dangerouslyDisableSandbox: true }))
    .toMatchObject({ decision: 'deny', kind: 'unsandboxed', reason: expect.stringContaining('effect doorway') });
  expect(call('WebFetch', { url: 'https://example.com' })).toMatchObject({ decision: 'deny', kind: 'network' });
  expect(call('mcp__x__y', {})).toMatchObject({ decision: 'deny', kind: 'mcp' });
  // The other side: ordinary work is never refused for the words in its data (review round 1, finding 4). Each of these
  // was refused by the old keyword classifier although none sends, controls the host or reaches the network.
  for (const command of ['wc -c telegram.txt', 'printf "%s\\n" "open"', 'echo https://example.com', 'grep -c slack notes.txt', 'sh local-script.sh'])
    expect([command, call('Bash', { command })]).toEqual([command, { decision: 'allow', reason: 'sandboxed command',
      updatedInput: { command: toolShellPrefix(tmp) + command } }]);
});

it('never admits more calls than the step cap, however many hooks run at once', { timeout: 60000 }, async () => {
  const run = (state: string, count: number, input: string) => Promise.all(Array.from({ length: count }, () => new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [HOOK, 'pre', state], { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve(code === 2 ? 'refuse' : /"permissionDecision":"(\w+)"/u.exec(out)?.[1] ?? 'allow'));
    child.stdin.end(input);
  })));
  const read = (ws: string) => j('Read', { file_path: `${ws}/in.txt` });
  // 64 overlapping calls against a fresh 16-call step (the review's probe admitted 51): exactly 16 are admitted.
  const fresh = turn(16);
  const decisions = await run(fresh.state, 64, read(fresh.ws));
  expect(decisions.filter(d => d === 'allow')).toHaveLength(16);
  expect(decisions.filter(d => d === 'deny')).toHaveLength(48);
  expect(readdirSync(join(fresh.state, 'slots')).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  const rows = readFileSync(join(fresh.state, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  expect(rows.filter(row => row.decision === 'allow').map(row => row.n).sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  expect(rows.filter(row => row.decision === 'deny').every(row => row.n === 17 && /per-step call cap 16 reached/u.test(row.reason))).toBe(true);
  // One slot left, eight at once (the review's probe admitted 4, 7 and 1): exactly one, every trial.
  for (let trial = 0; trial < 3; trial++) {
    const nearly = turn(16); takeSlots(nearly.state, 15);
    expect((await run(nearly.state, 8, read(nearly.ws))).filter(d => d === 'allow')).toHaveLength(1);
  }
  // The sequential neighbour still works: the first call of a fresh step is call 1 and is admitted.
  const single = turn(16);
  expect(hook(single.state, read(single.ws)).decision).toBe('allow');
});

it('strips the harness messaging socket and token from every admitted shell command, and only from shell commands', () => {
  const { state } = turn();
  const { tmp } = JSON.parse(readFileSync(join(state, 'config.json'), 'utf8'));
  const out = hook(state, j('Bash', { command: 'wc -c in.txt', description: 'count' }));
  const parsed = JSON.parse(out.stdout).hookSpecificOutput;
  expect(parsed).toMatchObject({ permissionDecision: 'allow', updatedInput: { command: `${toolShellPrefix(tmp)}wc -c in.txt`, description: 'count' } });
  expect(toolShellPrefix(tmp)).toBe(`unset CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_MESSAGING_SOCKET; export TMPDIR=${tmp}; ulimit -f 65536; `);
  // A temporary directory that is not a plain absolute path is refused, so the prefix never needs quoting.
  for (const bad of ['relative/tmp', '/tmp/a b', '/tmp/$(x)', undefined]) expect(() => toolShellPrefix(bad)).toThrow(/temporary directory/u);
  // The prefix really removes both from the command's environment and points TMPDIR at the turn's own scratch.
  const shell = spawnSync('/bin/sh', ['-c', `${toolShellPrefix(tmp)}env | grep -c '^CLAUDE_CODE_MESSAGING_' || true; echo "$TMPDIR"`],
    { env: { PATH: '/usr/bin:/bin', CLAUDE_CODE_MESSAGING_TOKEN: 'dummy-not-a-secret', CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/none.sock', TMPDIR: '/tmp/claude' }, encoding: 'utf8' });
  expect(shell.stdout.trim().split('\n')).toEqual(['0', tmp]);
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
  let replayed = 0, rekeyed = 0;
  for (const [run, cap] of runs) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-replay-'))); roots.push(root);
    const ws = join(root, run, 'ws'), state = join(root, run, 'state');
    for (const dir of [ws, state, join(root, 'outside'), join(root, 'protected')]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp: join(root, run, 'tmp'), maxCalls: cap, maxWriteBytes: 1048576,
      operations: [...SINGLE_MACHINE_PROFILE.operations] }));
    const rows = readFileSync(join(SPIKE, run, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    for (const row of rows) {
      const input = JSON.parse(JSON.stringify(row.input).split(PREFIX).join(root));
      const r = spawnSync(process.execPath, [HOOK, 'pre', state], { input: JSON.stringify({ tool_name: row.tool, tool_input: input,
        tool_use_id: `toolu_${String(row.n)}` }), encoding: 'utf8' });
      const got = /"permissionDecision":"(\w+)"/u.exec(r.stdout)?.[1] ?? 'allow';
      // The spike's keyword refusal of a shell command (its two curl calls per run) is now the sandbox's to enforce.
      const want = row.tool === 'Bash' && row.decision === 'deny' && /admits network/u.test(row.reason) ? 'allow' : row.decision;
      expect([run, row.n, row.tool, got]).toEqual([run, row.n, row.tool, want]);
      if (want !== row.decision) rekeyed++;
      replayed++;
    }
  }
  expect(replayed).toBe(33);
  expect(rekeyed).toBe(4);
});
