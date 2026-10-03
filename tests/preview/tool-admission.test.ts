// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule: the mandatory admission hook. Every case of the w4-toolsreuse
// spike's layer A (scratch/w4-toolsreuse/hooktest.mjs at cab6b51d, 33/33) runs through the real executable
// hook, plus the effect-doorway refusal, the messaging-variable stripping (residual 6), the atomic per-step
// call slots under concurrent hooks, and the trace pairing. A shell command is admitted whatever words it
// contains: what it can reach is enforced by the sandbox (proven live in tests/integration/tool-turn-live.test.ts).
// The full tool set (w4-toolsfull): ordinary work is admitted (web reads of public hosts, one bounded subagent type, MCP
// reads the root lists) and every consequential effect goes to the effect doorway; both sides of each decision are here.
// Rule 36: the recorded tool calls of the spike's real harness runs (fixtures/tool-turn/spike-cab6b51d) and of the
// full-tool live runs (fixtures/tool-turn/full-2026-10-03), verbatim, replay through the same hook.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The hook and its decision stay plain JavaScript: the harness runs them without a loader.
import { admitToolCall, admitToolEffect, publicAddress, toolShellPrefix, toolTrace, webReadHost } from './tool-admission.mjs';
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
    // The full tool set: a web read of a public address and a search are ordinary work (an address literal keeps this
    // table free of name resolution; a named host is resolved by the hook, covered below); an MCP tool the root does not
    // list as a read goes to the doorway; a subagent of no registered type is refused.
    ['webfetch', 'allow', j('WebFetch', { url: 'https://1.1.1.1/', prompt: 'x' })],
    ['websearch', 'allow', j('WebSearch', { query: 'x' })],
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

it('sends every consequential tool to the effect doorway, which refuses: the installed profile registers no tool operation', () => {
  expect(SINGLE_MACHINE_PROFILE.operations.some((op: string) => op.startsWith('tool:'))).toBe(false);
  for (const kind of ['mcp', 'unsandboxed', 'send', 'network-write', 'schedule']) {
    const verdict = admitToolEffect(kind, SINGLE_MACHINE_PROFILE.operations);
    expect(verdict).toEqual({ admitted: false, reason: expect.stringContaining(`registers no tool:${kind} operation`) });
  }
  // The other side of the boundary: a profile that registered the exact operation would admit it.
  expect(admitToolEffect('network', ['tool:network']).admitted).toBe(true);
  const { ws, tmp } = turn();
  const fs = { exists: () => true, realpath: (p: string) => p };
  const config = { workspace: ws, tmp, maxCalls: 5, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations };
  const call = (tool_name: string, tool_input: object) => admitToolCall({ tool_name, tool_input }, config, 1, fs);
  expect(call('Bash', { command: 'ls', dangerouslyDisableSandbox: true }))
    .toMatchObject({ decision: 'deny', kind: 'unsandboxed', reason: expect.stringContaining('effect doorway') });
  expect(call('mcp__x__y', {})).toMatchObject({ decision: 'deny', kind: 'mcp', reason: expect.stringContaining('effect doorway') });
  expect(call('SendMessage', { to: 'x', message: 'y' })).toMatchObject({ decision: 'deny', kind: 'send', reason: expect.stringContaining('effect doorway') });
  expect(call('RemoteTrigger', {})).toMatchObject({ decision: 'deny', kind: 'network-write' });
  expect(call('CronCreate', {})).toMatchObject({ decision: 'deny', kind: 'schedule' });
  // The other side: a profile that registered the exact MCP operation would admit that write.
  expect(admitToolCall({ tool_name: 'mcp__x__y', tool_input: {} }, { ...config, operations: ['tool:mcp'] }, 1, fs))
    .toMatchObject({ decision: 'allow', kind: 'mcp' });
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
      // A web read resolves its host; the replay stands a public address in for the resolver, so it needs no network.
      const got = row.tool === 'WebFetch'
        ? admitToolCall({ tool_name: row.tool, tool_input: input }, JSON.parse(readFileSync(join(state, 'config.json'), 'utf8')), row.n,
          { exists: existsSync, realpath: realpathSync, addresses: () => ['93.184.215.14'] }).decision
        : /"permissionDecision":"(\w+)"/u.exec(spawnSync(process.execPath, [HOOK, 'pre', state], { input: JSON.stringify({ tool_name: row.tool,
          tool_input: input, tool_use_id: `toolu_${String(row.n)}` }), encoding: 'utf8' }).stdout)?.[1] ?? 'allow';
      // The spike's keyword refusal of a shell command (its two curl calls per run) is now the sandbox's to enforce, its
      // refusal of a web read (one WebFetch of example.org per hook run) is now ordinary work, and its refusal of ToolSearch
      // (an unclassified tool then) is now harness bookkeeping. Workflow stays refused, now for budget (its agents' turns
      // cannot be reserved), not for being unknown.
      const want = (row.tool === 'Bash' && row.decision === 'deny' && /admits network/u.test(row.reason)) || row.tool === 'WebFetch'
        || row.tool === 'ToolSearch' ? 'allow' : row.decision;
      expect([run, row.n, row.tool, got]).toEqual([run, row.n, row.tool, want]);
      if (want !== row.decision) rekeyed++;
      replayed++;
    }
  }
  expect(replayed).toBe(33);
  expect(rekeyed).toBe(9);
});

it('admits a web read only of a public host, resolved before the decision; a local, private or credentialed target is refused', () => {
  const { ws, tmp } = turn();
  const config = { workspace: ws, tmp, maxCalls: 50, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations };
  const fetch = (url: string, addresses: string[] | null = ['93.184.215.14']) => admitToolCall({ tool_name: 'WebFetch', tool_input: { url, prompt: 'x' } },
    config, 1, { exists: () => true, realpath: (p: string) => p, addresses: () => addresses });
  for (const url of ['https://example.com', 'http://example.com/a?b=c', 'https://1.1.1.1/', 'https://[2606:4700:4700::1111]/'])
    expect([url, fetch(url)]).toEqual([url, { decision: 'allow', reason: 'web read (GET) of a public host', kind: 'network-read' }]);
  for (const url of ['http://127.0.0.1:4042/health', 'http://localhost/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.20.0.1/',
    'http://169.254.169.254/latest', 'http://[::1]/', 'http://[fd00::1]/', 'http://printer.local/', 'http://intranet/', 'file:///etc/hosts',
    'https://user:pass@example.com/', 'not a url', 'http://100.64.1.1/'])
    expect([url, fetch(url)]).toMatchObject([url, { decision: 'deny', kind: 'scope' }]);
  // A public-looking name that resolves to this machine or its network (or does not resolve) is refused.
  expect(fetch('https://rebind.example', ['127.0.0.1'])).toMatchObject({ decision: 'deny', reason: expect.stringContaining('non-public') });
  expect(fetch('https://mixed.example', ['93.184.215.14', '10.1.2.3'])).toMatchObject({ decision: 'deny' });
  expect(fetch('https://nowhere.example', null)).toMatchObject({ decision: 'deny', reason: expect.stringContaining('did not resolve') });
  expect(webReadHost('https://Example.COM/x')).toEqual({ host: 'example.com' });
  expect([publicAddress('8.8.8.8'), publicAddress('::ffff:10.0.0.1'), publicAddress('224.0.0.1'), publicAddress('nonsense')]).toEqual([true, false, false, false]);
  // An IPv4-mapped or NAT64 address is classified by the IPv4 address it carries, however URL parsing writes it
  // (new URL turns [::ffff:127.0.0.1] into [::ffff:7f00:1]): this machine and its network are refused, the public internet is not.
  for (const url of ['http://[::ffff:127.0.0.1]:4042/health', 'http://[::ffff:10.0.0.1]/', 'http://[::ffff:169.254.169.254]/latest',
    'http://[0:0:0:0:0:ffff:7f00:1]/', 'http://[::ffff:192.168.1.1]/', 'http://[64:ff9b::7f00:1]/', 'http://[::7f00:1]/', 'http://[fe80::1]/'])
    expect([url, fetch(url)]).toMatchObject([url, { decision: 'deny', kind: 'scope' }]);
  for (const url of ['http://[::ffff:8.8.8.8]/', 'http://[64:ff9b::808:808]/'])
    expect([url, fetch(url)]).toEqual([url, { decision: 'allow', reason: 'web read (GET) of a public host', kind: 'network-read' }]);
  expect(fetch('https://mapped.example', ['::ffff:7f00:1'])).toMatchObject({ decision: 'deny', reason: expect.stringContaining('non-public') });
  expect([publicAddress('::ffff:7f00:1'), publicAddress('::ffff:a00:1'), publicAddress('::ffff:808:808'), publicAddress('fc0::1')])
    .toEqual([false, false, true, true]);
  // Web search is a read; it carries no target for this machine to protect.
  expect(admitToolCall({ tool_name: 'WebSearch', tool_input: { query: 'x' } }, config, 1, { exists: () => true, realpath: (p: string) => p }))
    .toEqual({ decision: 'allow', reason: 'web search', kind: 'network-read' });
});

it('admits an MCP tool as ordinary work only when the root lists it as a read; every other MCP tool is the doorway\'s', () => {
  const { ws, tmp } = turn();
  const config = { workspace: ws, tmp, maxCalls: 50, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations, mcpReads: ['mcp__dummy__lookup'] };
  const fs = { exists: () => true, realpath: (p: string) => p };
  expect(admitToolCall({ tool_name: 'mcp__dummy__lookup', tool_input: { key: 'a' } }, config, 1, fs)).toEqual({ decision: 'allow',
    reason: 'MCP read the root configuration lists', kind: 'mcp-read' });
  for (const tool of ['mcp__dummy__post_note', 'mcp__dummy__lookup_and_write', 'mcp__other__lookup'])
    expect([tool, admitToolCall({ tool_name: tool, tool_input: {} }, config, 1, fs)]).toMatchObject([tool, { decision: 'deny', kind: 'mcp',
      reason: expect.stringContaining('registers no tool:mcp operation') }]);
});

it('admits the registered subagent type per slot of one shared budget, from the turn or from a subagent (Rule 114), in the foreground, and records each start, stop and parent as an edge', () => {
  const { ws, state } = turn();
  writeFileSync(join(state, 'config.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(state, 'config.json'), 'utf8')),
    children: { max: 2, type: 'worker' } }));
  const agent = (input: object, extra: object = {}, id = 'toolu_agent') => JSON.stringify({ tool_name: 'Agent', tool_input: input, tool_use_id: id, ...extra });
  const run = (input: string, mode = 'pre') => spawnSync(process.execPath, [HOOK, mode, state], { input, encoding: 'utf8' });
  // A refused shape spends nothing: wrong type, default type, an empty prompt (from the turn or from a subagent alike).
  for (const [input, reason] of [[agent({ prompt: 'x', subagent_type: 'general-purpose' }), /not this turn's registered type worker/u],
    [agent({ prompt: 'x' }), /\(default\)/u], [agent({ prompt: ' ', subagent_type: 'worker' }), /empty subagent prompt/u],
    [agent({ prompt: 'x', subagent_type: 'Explore' }, { agent_id: 'a1' }), /not this turn's registered type worker/u]] as const) {
    const out = JSON.parse(run(input).stdout).hookSpecificOutput;
    expect([out.permissionDecision, reason.test(out.permissionDecisionReason)]).toEqual(['deny', true]);
  }
  expect(existsSync(join(state, 'children', '1'))).toBe(false);
  // The registered type is admitted, rewritten to exactly the registered fields and the foreground, so its result returns.
  const first = JSON.parse(run(agent({ description: 'd', prompt: 'p', subagent_type: 'worker', run_in_background: true, isolation: 'worktree',
    model: 'opus', team_name: 't' })).stdout).hookSpecificOutput;
  expect(first).toMatchObject({ permissionDecision: 'allow', updatedInput: { description: 'd', prompt: 'p', subagent_type: 'worker', run_in_background: false } });
  expect(Object.keys(first.updatedInput).sort()).toEqual(['description', 'prompt', 'run_in_background', 'subagent_type']);
  expect(run(JSON.stringify({ agent_id: 'a1', agent_type: 'worker' }), 'child-start').status).toBe(0);
  // That subagent delegates in turn: its own Agent call takes the second slot of the same budget.
  const nested = JSON.parse(run(agent({ description: 'n', prompt: 'q', subagent_type: 'worker' }, { agent_id: 'a1' }, 'toolu_nested')).stdout).hookSpecificOutput;
  expect(nested).toMatchObject({ permissionDecision: 'allow', permissionDecisionReason: 'subagent 2 of 2, worker, started by subagent a1',
    updatedInput: { prompt: 'q', subagent_type: 'worker', run_in_background: false } });
  expect(run(JSON.stringify({ agent_id: 'a2', agent_type: 'worker' }), 'child-start').status).toBe(0);
  // The budget is exhausted for the whole tree: the next admissible call is refused for budget, from the turn or any subagent.
  for (const extra of [{}, { agent_id: 'a1' }, { agent_id: 'a2' }])
    expect(JSON.parse(run(agent({ prompt: 'p', subagent_type: 'worker' }, extra, 'toolu_over')).stdout).hookSpecificOutput)
      .toMatchObject({ permissionDecision: 'deny', permissionDecisionReason: expect.stringMatching(/no subagent budget left/u) });
  // Start and stop are recorded (durably, synced) and never fail the turn, even on malformed input.
  expect(run(JSON.stringify({ agent_id: 'a2', agent_type: 'worker' }), 'child-stop').status).toBe(0);
  expect(run(JSON.stringify({ tool_name: 'Agent', tool_use_id: 'toolu_nested', tool_response: { status: 'completed', agentId: 'a2', content: [{ type: 'text', text: '6' }] } }), 'post').status).toBe(0);
  expect(run(JSON.stringify({ agent_id: 'a1', agent_type: 'worker' }), 'child-stop').status).toBe(0);
  expect(run('not json', 'child-stop').status).toBe(0);
  expect(run(JSON.stringify({ tool_name: 'Agent', tool_use_id: 'toolu_agent', tool_response: { status: 'completed', agentId: 'a1', content: [{ type: 'text', text: '42' }] } }), 'post').status).toBe(0);
  const trace = toolTrace(readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n'));
  expect(trace.consistent).toBe(true);
  expect(trace.children).toEqual([
    { toolUse: 'toolu_agent', slot: 1, agent: 'a1', parentAgent: null, started: true, stopped: true, state: 'returned', result: expect.stringContaining('42') },
    { toolUse: 'toolu_nested', slot: 2, agent: 'a2', parentAgent: 'a1', started: true, stopped: true, state: 'returned', result: expect.stringContaining('6') }]);
  // A child calls tools under its own agent id, through the same hook and the same per-step slots.
  run(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: join(ws, 'in.txt') }, tool_use_id: 'toolu_child_read', agent_id: 'a1' }));
  const rows = readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  expect(rows.at(-1)).toMatchObject({ phase: 'pre', tool: 'Read', decision: 'allow', agent: 'a1' });
});

it('decides every tool of the harness\'s built-in set by its class at the hook: none is refused for being left out', () => {
  const { ws, tmp } = turn();
  const config = { workspace: ws, tmp, maxCalls: 50, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations,
    children: { max: 1, type: 'worker' } };
  const fs = { exists: existsSync, realpath: realpathSync, addresses: () => ['93.184.215.14'] };
  const decide = (tool: string, input: object = {}) => admitToolCall({ tool_name: tool, tool_input: input }, config, 1, fs);
  // Ordinary: a notebook inside the workspace, the harness's bookkeeping, a worktree inside the workspace.
  expect(decide('NotebookEdit', { notebook_path: join(ws, 'n.ipynb'), new_source: 'x' })).toEqual({ decision: 'allow', reason: 'ordinary in-workspace file operation' });
  for (const tool of ['ToolSearch', 'ListAgents', 'CronList', 'ReportFindings', 'TaskStop'])
    expect([tool, decide(tool, { query: 'x' })]).toEqual([tool, { decision: 'allow', reason: 'harness bookkeeping' }]);
  expect(decide('EnterWorktree', { name: 'w' }).decision).toBe('allow');
  expect(decide('ExitWorktree', { action: 'keep' }).decision).toBe('allow');
  // The neighbours: the same tools reaching outside the workspace are refused for scope.
  expect(decide('NotebookEdit', { notebook_path: '/etc/n.ipynb', new_source: 'x' })).toMatchObject({ decision: 'deny', kind: 'scope' });
  expect(decide('EnterWorktree', { path: '/Users/x/repo' })).toMatchObject({ decision: 'deny', kind: 'scope' });
  // Consequential: each goes to the effect doorway by its kind, which the single-machine profile refuses.
  for (const [tool, kind] of [['SendMessage', 'send'], ['PushNotification', 'send'], ['RemoteTrigger', 'network-write'], ['DesignSync', 'network-write'],
    ['CronCreate', 'schedule'], ['CronDelete', 'schedule'], ['ScheduleWakeup', 'schedule'], ['Monitor', 'unsandboxed']] as const)
    expect([tool, decide(tool, { command: 'x' })]).toEqual([tool, { decision: 'deny', kind,
      reason: expect.stringMatching(new RegExp(`effect doorway: the installed profile registers no tool:${kind} operation`, 'u')) }]);
  // A profile that registers the operation admits it through the same doorway (the doorway, not the tool list, decides).
  expect(admitToolCall({ tool_name: 'SendMessage', tool_input: {} }, { ...config, operations: ['tool:send'] }, 1, fs))
    .toEqual({ decision: 'allow', reason: 'registered operation tool:send', kind: 'send' });
  // Budget: a workflow may start agents the turn cannot reserve before dispatch.
  expect(decide('Workflow', { script: 'x' })).toEqual({ decision: 'deny', kind: 'budget',
    reason: expect.stringMatching(/cannot reserve before dispatch \(the spend floor\); delegate through Agent instead/u) });
  // Skill: an inline skill is ordinary work; one that can run forked is refused for budget; an unverified name is refused.
  for (const skill of ['simplify', '/dataviz'])
    expect(decide('Skill', { skill })).toEqual({ decision: 'allow', reason: `inline skill ${skill.replace('/', '')}: its instructions join this turn, which starts nothing` });
  expect(decide('Skill', { skill: 'code-review' })).toEqual({ decision: 'deny', kind: 'budget',
    reason: expect.stringMatching(/^skill code-review can run in a forked agent, whose model turns this turn cannot reserve before dispatch/u) });
  for (const skill of ['plain-instructions', 'commit', ''])
    expect(decide('Skill', { skill })).toEqual({ decision: 'deny',
      reason: `skill ${skill || '(none)'} is not one this harness is known to run inline: refused by default` });
  // The same decisions through the real executable hook (each takes one of the step's call slots).
  const { state: hookState } = turn();
  expect(hook(hookState, j('Skill', { skill: 'simplify' })).decision).toBe('allow');
  expect(hook(hookState, j('Skill', { skill: 'code-review' })).decision).toBe('deny');
  // A tool this adapter has not classified (a newer harness) is refused, since nothing says what it does.
  expect(decide('FutureTool')).toEqual({ decision: 'deny', reason: 'unclassified tool FutureTool: refused by default' });
});

it('links each subagent edge to its child, and leaves an edge without a result open for the runner to record cancelled or unknown', () => {
  const pre = (id: string, child: number) => JSON.stringify({ phase: 'pre', id, n: child, tool: 'Agent', decision: 'allow', reason: 'r', kind: 'subagent', child });
  const trace = toolTrace([pre('t1', 1), JSON.stringify({ phase: 'child-start', agent: 'a1' }), pre('t2', 2), JSON.stringify({ phase: 'child-start', agent: 'a2' }),
    JSON.stringify({ phase: 'child-stop', agent: 'a2' }), JSON.stringify({ phase: 'post', id: 't2', tool: 'Agent', result: '"r2"', agent: 'a2' })]);
  expect(trace.consistent).toBe(true);
  expect(trace.children.map((edge: { toolUse: string; agent: string; state: string; started: boolean; stopped: boolean }) =>
    [edge.toolUse, edge.agent, edge.state, edge.started, edge.stopped])).toEqual([['t1', 'a1', 'open', true, false], ['t2', 'a2', 'returned', true, true]]);
  // A refused subagent call is no edge.
  expect(toolTrace([JSON.stringify({ phase: 'pre', id: 't3', n: 1, tool: 'Agent', decision: 'deny', reason: 'r', kind: 'scope' })]).children).toEqual([]);
});

it('replays the full-tool live runs\' recorded calls to their recorded decisions, and their traces to their recorded edges (Rule 106)', () => {
  const FULL = join(__dirname, 'fixtures/tool-turn/full-2026-10-03');
  let replayed = 0;
  for (const name of ['full', 'outward', 'stop-child']) {
    const record = JSON.parse(readFileSync(join(FULL, `${name}.json`), 'utf8'));
    const lines = record.admission.trim().split('\n');
    const rows = lines.map((line: string) => JSON.parse(line));
    const { root, state } = turn();
    const workspace = /"(\/private\/tmp\/itt-[0-9a-f]+\/ws)/u.exec(record.admission)?.[1];
    const ws = join(root, 'live-ws'); mkdirSync(ws);
    writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp: join(root, 'tmp'), maxCalls: 32, maxWriteBytes: 1048576,
      operations: [...SINGLE_MACHINE_PROFILE.operations], children: { max: 2, type: 'worker' },
      mcpReads: name === 'outward' ? ['mcp__dummy__lookup'] : [] }));
    for (const row of rows.filter((r: { phase: string }) => r.phase === 'pre')) {
      const input = JSON.parse(workspace ? row.input.split(workspace).join(ws) : row.input);
      const config = JSON.parse(readFileSync(join(state, 'config.json'), 'utf8'));
      const got = admitToolCall({ tool_name: row.tool, tool_input: input, ...(row.agent ? { agent_id: row.agent } : {}) }, config, row.n,
        { exists: existsSync, realpath: realpathSync, addresses: () => ['93.184.215.14'] }, row.child ?? 1);
      expect([name, row.n, row.tool, got.decision, got.kind ?? null]).toEqual([name, row.n, row.tool, row.decision, row.kind ?? null]);
      replayed++;
    }
    // The recorded journal trace's edges are what the recorded admission rows give.
    const trace = toolTrace(lines);
    const journaled = record.journalRows.find((r: { phase: string }) => r.phase === 'trace');
    expect(trace.children.map((edge: { toolUse: string; agent: string }) => [edge.toolUse, edge.agent]))
      .toEqual(journaled.edges.map((edge: { child: string; agent: string }) => [edge.child, edge.agent]));
  }
  expect(replayed).toBe(15);
});
