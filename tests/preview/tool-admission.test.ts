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
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
// @ts-expect-error The hook and its decision stay plain JavaScript: the harness runs them without a loader.
import { admitEgress, admitToolCall, admitToolCallEffect, admitToolEffect, egressTarget, gitAdvertisement, gitFetchRequest, gitRepository, publicAddress, shellSandboxProfile, toolShellPrefix, toolTrace, webReadHost } from './tool-admission.mjs';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { startClearHeldCheck } from './held-check-stub.js';
// @ts-expect-error The doorway stays plain JavaScript, like the hook.
import { currentEffectPolicy } from './effect-doorway.mjs';
// @ts-expect-error The effect owner stays plain JavaScript, like the hook.
import { createToolEffectOwner } from './admission-gate.mjs';

const HOOK = join(__dirname, 'tool-admission-hook.mjs');
const SPIKE = join(__dirname, 'fixtures/tool-turn/spike-cab6b51d');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
// Plan #507: outward calls ask the runner's held-secret check first; a stand-in answers `clear` (held-check-stub.ts).
let HELD_CHECK = '';
let stopHeldCheck = () => {};
beforeAll(async () => { const stub = await startClearHeldCheck(); HELD_CHECK = stub.path; stopHeldCheck = stub.stop; });
afterAll(() => stopHeldCheck());

/** A turn laid out as the runner lays it out: `ws` and `state` side by side, the config in `state`. */
function turn(maxCalls = 50) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-admission-'))); roots.push(root);
  for (const dir of ['ws/sub', 'state', 'outside', 'tmp']) mkdirSync(join(root, dir), { recursive: true });
  const ws = join(root, 'ws'), outside = join(root, 'outside'), state = join(root, 'state'), tmp = join(root, 'tmp');
  writeFileSync(join(ws, 'in.txt'), 'hi\n'); writeFileSync(join(outside, 'canary.txt'), 'CANARY-DUMMY-0001\n');
  symlinkSync(outside, join(ws, 'link'));
  writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp, maxCalls, maxWriteBytes: 1048576,
    operations: [...SINGLE_MACHINE_PROFILE.operations], heldCheck: HELD_CHECK }));
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

it('a checkpointed route sends consequential tools and delegations to its checkpoint; a route without one never does (cint-L45)', () => {
  // w4-sessiondriver's checkpointed route (a delegated session step or a Codex tool turn) beside cint-L43's doorway route.
  const { ws, tmp } = turn();
  const fs = { exists: () => true, realpath: (p: string) => p };
  const config = { workspace: ws, tmp, maxCalls: 5, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations };
  const call = (tool_name: string, tool_input: object, over: object = {}) => admitToolCall({ tool_name, tool_input }, { ...config, ...over }, 1, fs, 1, 0);
  // No checkpoint: a delegation of the session kind is refused (nothing could record its edge), Codex's web search is not
  // admitted, and a consequential tool reaches the effect doorway (never the checkpoint), which refuses it by default.
  expect(call('collaborationspawn_agent', { message: 'x' }, { delegation: true })).toMatchObject({ decision: 'deny', kind: 'delegation' });
  expect(call('webrun', { search_query: [] })).toMatchObject({ decision: 'deny' });
  expect(call('mcp__x__y', {})).toMatchObject({ decision: 'deny', kind: 'mcp', doorway: { disposition: 'refused' } });
  expect(call('TodoWrite', {})).toMatchObject({ decision: 'deny' });
  // The other side: with the checkpoint named, a consequential tool and a delegation are sent to it (never allowed by
  // category here), and a network read the route admits is allowed.
  const gated = { gate: 'http://127.0.0.1:4100/x/claim', delegation: true, networkReads: true };
  expect(call('mcp__x__y', {}, gated)).toMatchObject({ decision: 'gate', kind: 'effect' });
  expect(call('SendMessage', { to: 'x', message: 'y' }, gated)).toMatchObject({ decision: 'gate', kind: 'effect' });
  expect(call('Bash', { command: 'ls', dangerouslyDisableSandbox: true }, gated)).toMatchObject({ decision: 'gate', kind: 'effect' });
  expect(call('Agent', { prompt: 'x' }, gated)).toMatchObject({ decision: 'gate', kind: 'delegation' });
  expect(call('collaborationspawn_agent', { message: 'x' }, gated)).toMatchObject({ decision: 'gate', kind: 'delegation' });
  expect(call('webrun', { search_query: [] }, gated)).toMatchObject({ decision: 'allow', reason: 'network read' });
  expect(call('TodoWrite', {}, gated)).toMatchObject({ decision: 'allow', reason: 'harness bookkeeping' });
  // A web read keeps cint-L43's host rule on the checkpointed route too: this machine's own address is never a web read.
  expect(call('WebFetch', { url: 'http://127.0.0.1:4100/x/claim' }, gated)).toMatchObject({ decision: 'deny', kind: 'scope' });
  // A confined shell runs every command under the step's own profile, whatever the harness asked for.
  const confined = call('Bash', { command: 'ls', dangerouslyDisableSandbox: true }, { ...gated, shellProfile: `${ws}/shell.sb` });
  expect(confined).toMatchObject({ decision: 'allow', reason: 'confined command' });
  expect(confined.updatedInput.command).toContain(`/usr/bin/sandbox-exec -f ${ws}/shell.sb`);
  expect(call('apply_patch', { input: `*** Begin Patch\n*** Add File: ${ws}/a.txt\n+x\n*** End Patch` }, { maxWriteBytes: 1000 })).toMatchObject({ decision: 'allow', reason: 'ordinary in-workspace patch' });
  // cint-L45 repair (MF1): the checkpointed route's network reads keep the operator's effect policy. A Codex web call whose
  // opened host or search the policy marks policy-sensitive, or any under a policy that cannot be read, goes to the effect
  // owner (which refuses it without a grant), exactly as a WebFetch of it does; a public read the policy does not name is
  // still an ordinary network read.
  const sensitive = { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['1.1.1.1'], registered: [], grants: [] };
  const unavailable = { type: 'PreviewEffectPolicyUnavailable', reason: 'withdrawn' };
  const open = { open: [{ ref_id: 'https://1.1.1.1/' }] };
  expect(call('webrun', open, { ...gated, effectPolicy: sensitive })).toMatchObject({ decision: 'gate', kind: 'effect' });
  expect(call('webrun', open, { ...gated, effectPolicy: unavailable })).toMatchObject({ decision: 'gate', kind: 'effect' });
  expect(call('webrun', { search_query: [{ q: 'x' }] }, { ...gated, effectPolicy: unavailable })).toMatchObject({ decision: 'gate', kind: 'effect' });
  expect(call('webrun', { open: [{ ref_id: 'https://example.com/' }] }, { ...gated, effectPolicy: sensitive })).toMatchObject({ decision: 'allow', reason: 'network read' });
  expect(call('webrun', { search_query: [{ q: 'x' }], response_length: 'short' }, { ...gated, effectPolicy: sensitive })).toMatchObject({ decision: 'allow' });
  expect(call('WebFetch', { url: 'https://1.1.1.1/' }, { ...gated, effectPolicy: sensitive })).toMatchObject({ decision: 'gate', kind: 'effect' });
  // Without a checkpoint the same web call meets the doorway directly: refused, the decision on the record.
  expect(call('webrun', open, { networkReads: true, effectPolicy: sensitive })).toMatchObject({ decision: 'deny', kind: 'network',
    doorway: { effect: 'tool:network', target: '1.1.1.1', disposition: 'refused' } });
  expect(call('webrun', open, { networkReads: true, effectPolicy: unavailable })).toMatchObject({ decision: 'deny', kind: 'network' });
  // cint-L45 round 3 (MF1): an explicit URL keeps its host whatever operation carries it; a `find` in that page is a read of
  // it, decided exactly as its `open` is (and a search naming a URL proposes both its host and the search).
  const find = { find: [{ ref_id: 'https://1.1.1.1/', pattern: 'test' }] };
  expect(call('webrun', find, { ...gated, effectPolicy: sensitive })).toMatchObject({ decision: 'gate', kind: 'effect' });
  expect(call('webrun', find, { networkReads: true, effectPolicy: sensitive })).toMatchObject({ decision: 'deny', kind: 'network',
    doorway: { target: '1.1.1.1', disposition: 'refused' } });
  expect(call('webrun', { find: [{ ref_id: 'https://example.com/', pattern: 'test' }] }, { ...gated, effectPolicy: sensitive }))
    .toMatchObject({ decision: 'allow', reason: 'network read' });
  expect(call('webrun', { search_query: [{ q: 'https://1.1.1.1/x' }] }, { ...gated, effectPolicy: sensitive })).toMatchObject({ decision: 'gate' });
  // cint-L45 round 3 (MF2): several targets in one call keep their own decisions. A public read the policy does not name stays
  // ordinary beside a granted sensitive one; any refused target refuses the call; a consequential target makes the whole call
  // consequential, so the effect owner applies the never-twice identity to it.
  const grant = (target: string) => ({ id: `g-${target}`, effect: 'tool:network', target, approves: ['scope', 'policySensitive'],
    source: 'review-fixture', custodian: 'desk', recovery: 'remove grant' });
  const granted = { ...sensitive, grants: [grant('1.1.1.1')] };
  const mixed = { open: [{ ref_id: 'https://8.8.8.8/' }, { ref_id: 'https://1.1.1.1/' }] };
  expect(call('webrun', mixed, { networkReads: true, effectPolicy: granted })).toMatchObject({ decision: 'allow', kind: 'network',
    doorway: { disposition: 'granted', grant: 'g-1.1.1.1', tests: { policySensitive: true } } });
  expect(admitToolCallEffect('webrun', mixed, { effectPolicy: granted }, 0)).toMatchObject({ admitted: true, consequential: true,
    target: '8.8.8.8, 1.1.1.1', tests: { policySensitive: true, scope: false } });
  expect(admitToolCallEffect('webrun', mixed, { effectPolicy: sensitive }, 0)).toMatchObject({ admitted: false, target: '1.1.1.1' });
  expect(admitToolCallEffect('webrun', { open: [mixed.open[0]!] }, { effectPolicy: sensitive }, 0)).toMatchObject({ admitted: true, consequential: false });
  expect(admitToolCallEffect('webrun', { open: [mixed.open[0]!, { ref_id: 'https://9.9.9.9/' }] }, { effectPolicy: sensitive }, 0))
    .toMatchObject({ admitted: true, consequential: false, disposition: 'ordinary' });
  const both = { ...sensitive, grants: [grant('1.1.1.1'), grant('8.8.8.8')] }, rows: { id: string }[] = [];
  const owner = createToolEffectOwner({ decide: (tool: string, input: unknown) => admitToolCallEffect(tool, input, { effectPolicy: both }, 0),
    append: (row: { id: string }) => rows.push(row), prepared: (id: string) => rows.some(row => row.id === id), stopped: () => false, now: () => 0 });
  const parent = { id: 'edge', child: 'child' };
  expect(owner.admit({ parent, tool: 'webrun', input: mixed, call: 'c1' })).toMatchObject({ admitted: true, doorway: { disposition: 'granted' } });
  expect(owner.admit({ parent, tool: 'webrun', input: mixed, call: 'c2' })).toMatchObject({ admitted: false, reason: expect.stringContaining('never sent twice') });
  // The other side: an ordinary multi-target read repeats freely (its identity includes the call).
  const plain = { open: [{ ref_id: 'https://9.9.9.9/' }, { ref_id: 'https://8.8.4.4/' }] };
  expect(owner.admit({ parent, tool: 'webrun', input: plain, call: 'c3' })).toMatchObject({ admitted: true });
  expect(owner.admit({ parent, tool: 'webrun', input: plain, call: 'c4' })).toMatchObject({ admitted: true });
  // cint-L45 repair (MF3): with the step's network checkpoint attached, a confined command is pointed at it (its proxy,
  // trust root and HOME) and its profile allows exactly that loopback port.
  const egress = { port: 40003, ca: `${tmp}/egress-ca.pem`, home: `${tmp}/home`, path: '/usr/local/bin' };
  const networked = call('Bash', { command: 'curl -sS https://example.com' }, { ...gated, shellProfile: `${ws}/shell.sb`, egress });
  expect(networked.updatedInput.command).toContain(`/usr/bin/env -i HOME=${tmp}/home HTTPS_PROXY=http://127.0.0.1:40003 `);
  expect(networked.updatedInput.command).toContain(`SSL_CERT_FILE=${tmp}/egress-ca.pem `);
  expect(networked.updatedInput.command).toContain(' PATH=/usr/local/bin:/bin:');
  expect(confined.updatedInput.command).not.toContain('HTTPS_PROXY');
  const profile = shellSandboxProfile({ workspace: ws, tmp, egress: { port: 40003, reads: ['/usr/local/bin', `${tmp}/egress-ca.pem`], writes: [`${tmp}/home`] } });
  expect(profile).toContain('(deny network*)\n(allow network-outbound (remote ip "localhost:40003"))\n');
  // Both sides of the host configuration (the gate run of 2026-10-07: a confined shell with no readable /private/etc
  // reached its own checkpoint in neither profile). It is reopened as machinery, by both spellings, and the host's own
  // record is refused after it — last rule wins in SBPL, and the kernel decides on the resolved path, so every spelling
  // of the hosts file is one refused target.
  for (const text of [profile, shellSandboxProfile({ workspace: ws, tmp })] as string[]) {
    expect(text).toMatch(/\(allow file-read-data \(literal "\/"\).*\(subpath "\/private\/etc"\).*\(subpath "\/etc"\)/u);
    expect(text).toContain('(deny file-read-data (subpath "/private/etc/hosts"))');
    const lines = text.split('\n');
    expect(lines.findIndex(line => line.startsWith('(deny file-read-data (subpath "/private/etc/hosts")')))
      .toBeGreaterThan(lines.findIndex(line => line.startsWith('(allow file-read-data (literal "/")')));
  }
  expect(shellSandboxProfile({ workspace: ws, tmp })).not.toContain('network-outbound');
  expect(() => shellSandboxProfile({ workspace: ws, tmp, egress: { port: 0 } })).toThrow(/egress port/u);
  expect(() => shellSandboxProfile({ workspace: ws, tmp, egress: { port: 1, reads: ['relative'] } })).toThrow(/absolute and plain/u);
  expect(call('apply_patch', { input: '*** Begin Patch\n*** Add File: /etc/a.txt\n+x\n*** End Patch' })).toMatchObject({ decision: 'deny', kind: 'scope' });
});

it('sends every consequential tool to the effect doorway, which refuses it by the four tests under the default policy', () => {
  expect(SINGLE_MACHINE_PROFILE.operations.some((op: string) => op.startsWith('tool:'))).toBe(false);
  const defaults = { operations: SINGLE_MACHINE_PROFILE.operations };
  for (const effect of ['tool:network', 'tool:mcp', 'tool:unsandboxed', 'tool:send', 'tool:network-write', 'tool:schedule']) {
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
  expect(call('mcp__x__y', {})).toMatchObject({ decision: 'deny', kind: 'mcp', reason: expect.stringContaining('effect doorway') });
  expect(call('SendMessage', { to: 'x', message: 'y' })).toMatchObject({ decision: 'deny', kind: 'send', reason: expect.stringContaining('effect doorway') });
  expect(call('RemoteTrigger', {})).toMatchObject({ decision: 'deny', kind: 'network-write' });
  expect(call('CronCreate', {})).toMatchObject({ decision: 'deny', kind: 'schedule' });
  // The other side: an operator registration classifying that MCP write as reversible and free, plus a recorded scope
  // grant placing it in scope, leaves no test holding, so the doorway admits it as ordinary.
  expect(admitToolCall({ tool_name: 'mcp__x__y', tool_input: {} }, { ...config, effectPolicy: { type: 'PreviewEffectPolicy',
    resourceLevelUsd: 0, policySensitive: [], registered: [{ effect: 'tool:mcp', target: 'mcp__x__y', consequence: 'data',
      reversibility: 'reversible', reach: 'world', costUsd: 0, source: 'telegram:102965:121996' }],
    grants: [{ id: 'g-mcp', effect: 'tool:mcp', target: 'mcp__x__y', approves: ['scope'], source: 'telegram:102965:121996',
      custodian: 'desk', recovery: 'remove the grant' }] } }, 1, fs, 1, 0))
    .toMatchObject({ decision: 'allow', kind: 'mcp', doorway: { effect: 'tool:mcp', target: 'mcp__x__y', disposition: 'ordinary' } });
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
      operations: [...SINGLE_MACHINE_PROFILE.operations], heldCheck: HELD_CHECK }));
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
  // A web read is ordinary under the tools grant; when the operator's effect policy marks its host policy-sensitive, the
  // doorway decides it instead: refused without a grant approving that matter, admitted with one.
  const marked = (grants: object[]) => admitToolCall({ tool_name: 'WebFetch', tool_input: { url: 'https://example.com/x', prompt: 'x' } },
    { ...config, effectPolicy: { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['example.com'], registered: [], grants } }, 1,
    { exists: () => true, realpath: (p: string) => p, addresses: () => ['93.184.215.14'] }, 1, 0);
  expect(marked([])).toMatchObject({ decision: 'deny', kind: 'network',
    doorway: { effect: 'tool:network', target: 'example.com', disposition: 'refused', tests: { scope: true, policySensitive: true } } });
  expect(marked([{ id: 'g-web', effect: 'tool:network', target: 'example.com', approves: ['scope', 'policySensitive'],
    source: 'telegram:102965:121996', custodian: 'desk', recovery: 'remove the grant' }]))
    .toMatchObject({ decision: 'allow', kind: 'network', doorway: { disposition: 'granted', grant: 'g-web' } });
});

it('admits an MCP tool as ordinary work only when the root lists it as a read; every other MCP tool is the doorway\'s', () => {
  const { ws, tmp } = turn();
  const config = { workspace: ws, tmp, maxCalls: 50, maxWriteBytes: 10, operations: SINGLE_MACHINE_PROFILE.operations, mcpReads: ['mcp__dummy__lookup'] };
  const fs = { exists: () => true, realpath: (p: string) => p };
  expect(admitToolCall({ tool_name: 'mcp__dummy__lookup', tool_input: { key: 'a' } }, config, 1, fs)).toEqual({ decision: 'allow',
    reason: 'MCP read the root configuration lists', kind: 'mcp-read' });
  for (const tool of ['mcp__dummy__post_note', 'mcp__dummy__lookup_and_write', 'mcp__other__lookup'])
    expect([tool, admitToolCall({ tool_name: tool, tool_input: {} }, config, 1, fs)]).toMatchObject([tool, { decision: 'deny', kind: 'mcp',
      reason: expect.stringContaining('effect doorway refused tool:mcp') }]);
  // The other side of the read rule: when the operator's effect policy marks a listed read's target policy-sensitive, the
  // read goes to the doorway, which refuses it without a grant approving that matter.
  const sensitive = { ...config, effectPolicy: { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['mcp__dummy__lookup'],
    registered: [], grants: [] } };
  expect(admitToolCall({ tool_name: 'mcp__dummy__lookup', tool_input: { key: 'a' } }, sensitive, 1, fs, 1, 0)).toMatchObject({ decision: 'deny',
    kind: 'mcp', doorway: { disposition: 'refused', tests: { policySensitive: true } } });
  // A policy that names something else leaves the read ordinary.
  expect(admitToolCall({ tool_name: 'mcp__dummy__lookup', tool_input: { key: 'a' } }, { ...sensitive, effectPolicy: { ...sensitive.effectPolicy,
    policySensitive: ['mcp__other__lookup'] } }, 1, fs, 1, 0)).toEqual({ decision: 'allow', reason: 'MCP read the root configuration lists', kind: 'mcp-read' });
});

it('keeps an installed policy\'s restrictions when the runner cannot reread it: the policy-sensitive reads stay refused, ordinary work stays admitted', () => {
  // The runner rereads its configured --effect-policy at each tool turn (currentEffectPolicy). A policy valid at launch that
  // is mid-rewrite, malformed or removed must not become "no policy": that admitted a marked read with no doorway decision.
  const { ws, state, root } = turn();
  const policyPath = join(root, 'effect-policy.json');
  writeFileSync(policyPath, JSON.stringify({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['1.1.1.1', 'mcp__dummy__lookup'],
    registered: [], grants: [] }));
  const base = JSON.parse(readFileSync(join(state, 'config.json'), 'utf8'));
  const install = () => writeFileSync(join(state, 'config.json'), JSON.stringify({ ...base, mcpReads: ['mcp__dummy__lookup'],
    effectPolicy: currentEffectPolicy(() => readFileSync(policyPath, 'utf8')) }));
  const calls = { web: j('WebFetch', { url: 'https://1.1.1.1/x', prompt: 'x' }), mcp: j('mcp__dummy__lookup', { key: 'a' }),
    read: j('Read', { file_path: `${ws}/in.txt` }) };
  const decide = () => Object.fromEntries(Object.entries(calls).map(([name, input]) => [name, hook(state, input).decision]));
  install();
  expect(decide()).toEqual({ web: 'deny', mcp: 'deny', read: 'allow' });
  for (const lose of [() => writeFileSync(policyPath, '{"type":"PreviewEffectPolicy",'), () => rmSync(policyPath)]) {
    lose(); install();
    expect(JSON.parse(readFileSync(join(state, 'config.json'), 'utf8')).effectPolicy).toMatchObject({ type: 'PreviewEffectPolicyUnavailable' });
    expect(decide()).toEqual({ web: 'deny', mcp: 'deny', read: 'allow' });
  }
  // Each refusal is a recorded doorway decision naming the unavailable policy.
  const rows = readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
    .filter(row => row.phase === 'pre' && row.tool !== 'Read').slice(-2);
  for (const row of rows) expect(row).toMatchObject({ decision: 'deny', doorway: { disposition: 'refused', tests: { policySensitive: true } },
    reason: expect.stringContaining('the installed effect policy is unavailable (it cannot be read (ENOENT))') });
  // The other side: with no policy configured at all, the listed MCP read and the public web read are ordinary work.
  writeFileSync(join(state, 'config.json'), JSON.stringify({ ...base, mcpReads: ['mcp__dummy__lookup'] }));
  expect(decide()).toEqual({ web: 'allow', mcp: 'allow', read: 'allow' });
  // And once the policy reads again, a grant in it admits the marked web read through the doorway.
  writeFileSync(policyPath, JSON.stringify({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['1.1.1.1'], registered: [],
    grants: [{ id: 'g-web', effect: 'tool:network', target: '1.1.1.1', approves: ['scope', 'policySensitive'], source: 'telegram:102965:121996',
      custodian: 'desk', recovery: 'remove the grant' }] }));
  install();
  expect(hook(state, calls.web).decision).toBe('allow');
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
    expect([tool, decide(tool, { command: 'x' })]).toMatchObject([tool, { decision: 'deny', kind,
      reason: expect.stringContaining(`effect doorway refused tool:${kind} (${tool})`),
      doorway: { effect: `tool:${kind}`, target: tool, disposition: 'refused' } }]);
  // The other side: the same doorway admits it when every held test is answered (the doorway, not the tool list, decides):
  // an irreversible send as an operation of the accepted closed set, its registered zero cost, and a scope grant (which
  // places it in scope, so the scope test no longer holds).
  expect(admitToolCall({ tool_name: 'SendMessage', tool_input: {} }, { ...config, operations: ['tool:send'], effectPolicy: { type: 'PreviewEffectPolicy',
    resourceLevelUsd: 0, policySensitive: [], registered: [{ effect: 'tool:send', target: 'SendMessage', consequence: 'attention',
      reversibility: 'irreversible', reach: 'world', costUsd: 0, source: 'telegram:102965:121996' }],
    grants: [{ id: 'g-send', effect: 'tool:send', approves: ['scope'], source: 'telegram:102965:121996', custodian: 'desk',
      recovery: 'remove the grant' }] } }, 1, fs, 1, 0))
    .toMatchObject({ decision: 'allow', kind: 'send', doorway: { disposition: 'closed-set', tests: { irreversible: true, scope: false } } });
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
      mcpReads: name === 'outward' ? ['mcp__dummy__lookup'] : [], heldCheck: HELD_CHECK }));
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

const SHELLNET = join(__dirname, 'fixtures/tool-turn/shellnet-2026-10-03');

it('points every admitted shell command at the turn\'s network checkpoint: its proxy, its trust root, a scratch HOME, every range through it', () => {
  const { state, tmp, root } = turn();
  const egress = { port: 41234, ca: join(root, 'ca.pem'), home: join(root, 'home'), path: '/usr/local/bin', developer: '/Library/Developer/CommandLineTools' };
  const config = JSON.parse(readFileSync(join(state, 'config.json'), 'utf8'));
  writeFileSync(join(state, 'config.json'), JSON.stringify({ ...config, egress }));
  const out = JSON.parse(hook(state, j('Bash', { command: 'curl -sS https://example.com' })).stdout).hookSpecificOutput;
  expect(out.updatedInput.command).toBe(`${toolShellPrefix(tmp, egress)}curl -sS https://example.com`);
  const shell = spawnSync('/bin/sh', ['-c', `${toolShellPrefix(tmp, egress)}printf '%s|' "$HTTPS_PROXY" "$http_proxy" "x$NO_PROXY" "x$no_proxy" "$HOME" "$CURL_CA_BUNDLE" "$GIT_SSL_CAINFO" `
    + `"$NODE_EXTRA_CA_CERTS" "$npm_config_cafile" "$GIT_CONFIG_NOSYSTEM" "$DEVELOPER_DIR" "$PATH"`],
  { env: { PATH: '/usr/bin:/bin', NO_PROXY: 'localhost,127.0.0.1,10.0.0.0/8', no_proxy: 'localhost', HOME: '/Users/Shared/login' }, encoding: 'utf8' });
  expect(shell.stdout.split('|').slice(0, 12)).toEqual(['http://127.0.0.1:41234', 'http://127.0.0.1:41234', 'x', 'x', egress.home, egress.ca, egress.ca,
    egress.ca, egress.ca, '1', egress.developer, `${egress.developer}/usr/bin:/usr/local/bin:/usr/bin:/bin`]);
  // Without a checkpoint the prefix is exactly the earlier one (the shell has no network).
  expect(toolShellPrefix(tmp, null)).toBe(toolShellPrefix(tmp));
  for (const bad of [{ ...egress, port: 0 }, { ...egress, ca: 'rel/ca.pem' }, { ...egress, home: '/tmp/a b' }, { ...egress, path: '/x;rm' }, { ...egress, developer: '$(x)' }])
    expect(() => toolShellPrefix(tmp, bad)).toThrow(/egress checkpoint/u);
});

it('the checkpoint admits reads (GET, HEAD, a proven git fetch) and sends every write to the effect doorway, which admits only a registered and granted one', () => {
  const ops = { operations: [...SINGLE_MACHINE_PROFILE.operations] };
  const proven = { fetch: true, reason: 'git fetch' };
  for (const [method, path, gitFetch] of [['GET', '/', null], ['head', '/x', null], ['GET', '/r.git/info/refs?service=git-upload-pack', null], ['POST', '/r.git/git-upload-pack', proven]] as const)
    expect(admitEgress({ method, path, host: 'example.com', gitFetch }, ops, 0)).toMatchObject({ decision: 'allow', kind: 'network-read' });
  for (const [method, path, headers, gitFetch] of [['POST', '/post', {}, null], ['PUT', '/-/package', {}, null], ['PATCH', '/x', {}, null], ['DELETE', '/x', {}, null],
    ['OPTIONS', '/', {}, null], ['', '/', {}, null], ['GET', '/r.git/info/refs?service=git-receive-pack', {}, null], ['POST', '/r.git/git-receive-pack', {}, proven],
    ['POST', '/r.git/git-upload-pack-not', {}, proven], ['POST', '/messages/git-upload-pack', {}, null],
    ['POST', '/messages/git-upload-pack', {}, { fetch: false, reason: 'the repository did not advertise git upload-pack in this turn' }],
    ['GET', '/messages/1', { 'X-HTTP-Method-Override': 'DELETE' }, null], ['HEAD', '/messages/1', { 'x-http-method': 'PUT' }, null],
    ['POST', '/r.git/git-upload-pack', { 'x-method-override': 'DELETE' }, proven],
    // An override naming a read never downgrades the request line, and no override hides another's write.
    ['POST', '/messages', { 'X-HTTP-Method-Override': 'GET' }, null], ['DELETE', '/messages/1', { 'X-HTTP-Method-Override': 'HEAD' }, null],
    ['GET', '/messages/1', { 'X-HTTP-Method-Override': 'GET', 'X-Method-Override': 'DELETE' }, null],
    ['GET', '/messages/1', { 'X-HTTP-Method-Override': 'GET, DELETE' }, null], ['GET', '/messages/1', { 'X-HTTP-Method': '' }, null],
    ['POST', '/r.git/git-upload-pack', { 'X-HTTP-Method-Override': 'GET' }, proven]] as const) {
    const decided = admitEgress({ method, path, host: 'example.com', headers, gitFetch }, ops, 0);
    expect(decided).toMatchObject({ decision: 'deny', kind: 'network-write' });
    // Unregistered, a network write is classified at its worst on all four tests (L43's doorway), so it is refused.
    expect(decided.reason).toMatch(/effect doorway refused tool:network-write \(example\.com\): it is consequential because it cannot be undone/u);
  }
  // An override naming a read leaves a read a read.
  expect(admitEgress({ method: 'GET', path: '/x', headers: { 'X-HTTP-Method-Override': 'GET' } }, ops, 0)).toMatchObject({ decision: 'allow' });
  expect(admitEgress({ method: 'HEAD', path: '/x', headers: { 'X-HTTP-Method-Override': 'GET', 'x-method-override': 'HEAD' } }, ops, 0))
    .toEqual({ decision: 'allow', reason: 'HEAD read', kind: 'network-read' });
  expect(admitEgress({ method: 'POST', path: '/r.git/git-upload-pack', headers: { 'X-HTTP-Method-Override': 'POST' }, gitFetch: proven }, ops, 0))
    .toMatchObject({ decision: 'allow', reason: 'git fetch' });
  // The other side: the doorway admits a write the operator registered (reversible, zero cost) and granted into scope for
  // that host (the grant places it in scope, so no test holds), and only for that host; a lapsed grant refuses again.
  const grant = { id: 'g-post', effect: 'tool:network-write', target: 'httpbin.org', approves: ['scope'], source: 'telegram:102965:121996',
    custodian: 'desk', recovery: 'remove the grant', expiresAt: 100 };
  const writable = { ...ops, effectPolicy: { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
    registered: [{ effect: 'tool:network-write', target: 'httpbin.org', consequence: 'data', reversibility: 'reversible', reach: 'world', costUsd: 0,
      source: 'telegram:102965:121996' }], grants: [grant] } };
  expect(admitEgress({ method: 'POST', path: '/post', host: 'httpbin.org' }, writable, 0)).toMatchObject({ decision: 'allow', kind: 'network-write',
    reason: expect.stringContaining('tool:network-write is ordinary (none of the four consequential-effect tests holds); admitted') });
  expect(admitEgress({ method: 'POST', path: '/post', host: 'example.com' }, writable, 0)).toMatchObject({ decision: 'deny', kind: 'network-write' });
  expect(admitEgress({ method: 'POST', path: '/post', host: 'httpbin.org' }, writable, 100)).toMatchObject({ decision: 'deny', kind: 'network-write' });
  // A shell read of a host the policy marks policy-sensitive meets the doorway exactly as a WebFetch of it does: refused
  // without a grant approving that matter, admitted with one; an unmarked host stays an ordinary read.
  const marked = (grants: object[]) => admitEgress({ method: 'GET', path: '/x', host: 'example.com' },
    { ...ops, effectPolicy: { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['example.com'], registered: [], grants } }, 0);
  expect(marked([])).toMatchObject({ decision: 'deny', kind: 'network-read', reason: expect.stringContaining('effect doorway refused tool:network (example.com)') });
  expect(marked([{ id: 'g-web', effect: 'tool:network', target: 'example.com', approves: ['scope', 'policySensitive'],
    source: 'telegram:102965:121996', custodian: 'desk', recovery: 'remove the grant' }])).toMatchObject({ decision: 'allow', kind: 'network-read' });
  // cint-L43's policy-unavailable repair reaches the checkpoint too: a configured policy that cannot be read refuses every
  // shell request at the doorway (reads included), never lapsing to the empty default.
  const unavailable = { ...ops, effectPolicy: { type: 'PreviewEffectPolicyUnavailable', reason: 'it cannot be read (ENOENT)' } };
  for (const method of ['GET', 'POST'])
    expect(admitEgress({ method, path: '/x', host: 'example.org' }, unavailable, 0)).toMatchObject({ decision: 'deny',
      reason: expect.stringContaining('the installed effect policy is unavailable (it cannot be read (ENOENT))') });
  expect(admitEgress({ method: 'GET', path: '/x', host: 'example.org' },
    { ...ops, effectPolicy: { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['example.com'], registered: [], grants: [] } }, 0))
    .toEqual({ decision: 'allow', reason: 'GET read', kind: 'network-read' });
  expect(egressTarget('example.com:443')).toEqual({ host: 'example.com', port: 443 });
  expect(egressTarget('example.com', 'http:')).toEqual({ host: 'example.com', port: 80 });
  expect(egressTarget('registry.npmjs.org:8443')).toEqual({ host: 'registry.npmjs.org', port: 8443 });
  for (const bad of ['127.0.0.1:443', '[::1]:443', '[::ffff:7f00:1]:443', '10.0.0.1:443', '100.64.1.1:443', '169.254.169.254:80', 'localhost:443',
    'nas.local:443', 'user:pw@example.com:443', 'example.com/path', 'intranet:443'])
    expect(egressTarget(bad).host).toBeNull();
});

it('a git fetch is proven by its repository\'s discovery answer and an upload-pack body, never by its path or content type alone', () => {
  const advertisement = { 'content-type': 'application/x-git-upload-pack-advertisement' };
  expect(gitAdvertisement({ method: 'GET', path: '/r.git/info/refs?service=git-upload-pack', status: 200, headers: advertisement })).toBe('/r.git');
  for (const answer of [{ method: 'GET', path: '/r.git/info/refs?service=git-upload-pack', status: 200, headers: { 'content-type': 'text/plain' } },
    { method: 'GET', path: '/r.git/info/refs?service=git-upload-pack', status: 404, headers: advertisement },
    { method: 'GET', path: '/r.git/info/refs?service=git-receive-pack', status: 200, headers: advertisement },
    { method: 'POST', path: '/r.git/info/refs?service=git-upload-pack', status: 200, headers: advertisement }])
    expect(gitAdvertisement(answer)).toBeNull();
  const advertised = new Set(['example.test:443/r.git']);
  const type = { 'Content-Type': 'application/x-git-upload-pack-request' };
  const pkt = (...lines: string[]) => Buffer.from(lines.map(line => line === '' ? '0000' : `${(line.length + 4).toString(16).padStart(4, '0')}${line}`).join(''), 'latin1');
  const v0 = pkt('want 0123456789abcdef0123456789abcdef01234567 multi_ack_detailed side-band-64k ofs-delta agent=git/2.50.1\n', '', 'done\n');
  const v2 = pkt('command=fetch', 'agent=git/2.50.1', 'object-format=sha1', 'thin-pack', 'ofs-delta', 'want 0123456789abcdef0123456789abcdef01234567\n', 'done\n', '');
  const lsRefs = Buffer.concat([pkt('command=ls-refs', 'agent=git/2.50.1'), Buffer.from('0001'), pkt('peel', 'symrefs', 'unborn', 'ref-prefix HEAD\n', 'ref-prefix refs/heads/\n', '')]);
  for (const body of [v0, v2, lsRefs])
    expect(gitFetchRequest({ origin: 'example.test:443', path: '/r.git/git-upload-pack', headers: type, body, advertised })).toEqual({ fetch: true, reason: 'git fetch' });
  for (const [request, reason] of [
    [{ origin: 'example.test:443', path: '/r.git/git-upload-pack', headers: type, body: Buffer.from('send=hello') }, 'not git pkt-lines'],
    [{ origin: 'example.test:443', path: '/r.git/git-upload-pack', headers: type, body: pkt('send=hello') }, 'not a git fetch request'],
    [{ origin: 'example.test:443', path: '/r.git/git-upload-pack', headers: type, body: pkt('') }, 'empty git request'],
    [{ origin: 'example.test:443', path: '/r.git/git-upload-pack', headers: {}, body: v0 }, 'not typed as a git fetch request'],
    [{ origin: 'example.test:443', path: '/other.git/git-upload-pack', headers: type, body: v0 }, 'did not advertise'],
    [{ origin: 'elsewhere.test:443', path: '/r.git/git-upload-pack', headers: type, body: v0 }, 'did not advertise'],
    [{ origin: 'example.test:443', path: '/r.git/git-upload-pack', headers: type, body: null }, 'body unreadable']] as const)
    expect(gitFetchRequest({ ...request, advertised }).reason).toContain(reason);
});

it('replays the shell-network live runs: their shell calls reach the recorded admission and their checkpoint requests the recorded decision (Rule 106)', () => {
  const ops = { operations: [...SINGLE_MACHINE_PROFILE.operations] };
  for (const name of ['shellnet-reads', 'shellnet-writes']) {
    const record = JSON.parse(readFileSync(join(SHELLNET, `${name}.json`), 'utf8'));
    const rows = String(record.admission).trim().split('\n').map(line => JSON.parse(line));
    const { state, tmp } = turn();
    for (const row of rows.filter(r => r.phase === 'pre')) {
      const decided = admitToolCall({ tool_name: row.tool, tool_input: JSON.parse(row.input) }, { ...JSON.parse(readFileSync(join(state, 'config.json'), 'utf8')), tmp }, row.n,
        { exists: existsSync, realpath: realpathSync });
      expect([row.tool, decided.decision]).toEqual([row.tool, row.decision]);
    }
    const requests = String(record.egress).trim().split('\n').map(line => JSON.parse(line)).filter(r => r.phase === 'request' && r.method !== 'CONNECT');
    expect(requests.length).toBeGreaterThan(0);
    // A recorded upload-pack POST was preceded, on its host, by its repository's discovery that answered 200 (the record
    // keeps no bodies or response types, so the replay supplies the exchange's proof from that answered discovery).
    const answered = new Set(String(record.egress).trim().split('\n').map(line => JSON.parse(line)).filter(r => r.phase === 'response' && r.status === 200).map(r => r.n));
    const discovered = new Set<string>();
    for (const request of requests) {
      if (request.kind === 'scope') { expect(egressTarget(`${String(request.host)}:80`, 'http:').host).toBeNull(); continue; }
      const repo = gitRepository(request.path, 'git-upload-pack');
      const gitFetch = repo === null ? null : { fetch: discovered.has(`${String(request.host)}${repo}`), reason: 'replayed' };
      expect(admitEgress({ method: request.method, path: request.path, host: request.host, gitFetch }, ops, 0)).toMatchObject({ decision: request.decision, kind: request.kind });
      const advertised = gitRepository(String(request.path).split('?')[0], 'info/refs');
      if (advertised !== null && String(request.path).endsWith('?service=git-upload-pack') && answered.has(request.n)) discovered.add(`${String(request.host)}${advertised}`);
    }
    if (name === 'shellnet-reads') expect(discovered.size).toBe(1);
  }
});
