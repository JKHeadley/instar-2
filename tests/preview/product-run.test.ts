import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, unlinkSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error Product operator entry is JavaScript.
import { buildRunArgv } from '../../scripts/product-run.mjs';
// @ts-expect-error Installer JavaScript: the standing trust record `instar2 setup` writes.
import { configureTrust } from './trust-setup.mjs';
// @ts-expect-error The runner's effect doorway and its empty default.
import { DEFAULT_EFFECT_POLICY, UNAVAILABLE_EFFECT_POLICY, decodeEffectPolicy, currentEffectPolicy } from './effect-doorway.mjs';
// @ts-expect-error The shipped tool-call effect admission.
import { admitToolCall, admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error The owner GitHub read tool's name.
import { OWNER_BROWSER_TOOL } from './owner-browser-contract.mjs';
// @ts-expect-error The root MCP reader.
import { readRootMcp } from './tool-turn.mjs';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const save = (root: string, name: string, value: unknown) => writeFileSync(join(root, name), JSON.stringify(value));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'product-run-')); roots.push(root);
  // Shape and flag order captured from runner-group-run.sh on 2026-10-21; identities are fixtures.
  const options = { 'bot-id': '12345678', 'bot-username': '@fixture_bot', 'operator-sender-id': '12345',
    'chat-id': '-1001234567890', forum: true, 'grant-reference': 'preview-trial:fixture',
    'configuration-digest': `sha256:${'a'.repeat(64)}`, 'expires-at': '2026-11-12T21:40:00Z',
    'operator-records': root, 'explicit-yes-installation': join(root, 'yes.json'),
    'review-repository': 'fixture/repository', 'harness-user': '_instarharness', 'conversation-session': 'on' };
  save(root, 'run-config.json', { version: 1, options });
  save(root, 'model-setting.json', { model: 'claude-opus-4-6' });
  const login = { profile: join(root, 'profile.json'), activation: join(root, 'activation.json'),
    authority: join(root, 'authority.json'), toolsActivation: join(root, 'tools.json'), sessionActivation: join(root, 'session.json') };
  save(root, 'harness-logins.json', { version: 1, logins: [login] });
  for (const name of ['profile', 'activation', 'authority', 'tools', 'session', 'yes']) save(root, `${name}.json`, { fixture: true });
  // The standing trust `instar2 setup` records: one connected-account server with a listed read and a granted write.
  configureTrust(root, 'setup', { source: 'terminal-setup:agent:fixture', custodian: 'local-installer:uid:fixture',
    recovery: 'The installation owner can revise or revoke standing trust.', resourceLevelUsd: 0,
    effects: [{ effect: 'tool:mcp', target: 'mcp__fakeacct__post_note', recovery: 'delete the note',
      registration: { reversibility: 'reversible', consequence: 'data', costUsd: 0 } }],
    mcp: { mcpServers: { fakeacct: { command: '/usr/bin/true' } }, reads: ['mcp__fakeacct__lookup'] },
    role: { description: 'fixture', trust: 'fixture', accounts: [], channels: [] }, policySensitive: [] });
  writeFileSync(join(root, 'journal.encrypted'), 'fixture-only: never opened by argv builder');
  return { root, options, login };
}
it('reconstructs every launcher flag from root records and documented limits', () => {
  const { root, options: o, login: l } = fixture();
  expect(buildRunArgv(root)).toEqual(['run', '--root', root, '--bot-id', o['bot-id'], '--bot-username', o['bot-username'],
    '--operator-sender-id', o['operator-sender-id'], '--chat-id', o['chat-id'], '--forum', 'true',
    '--grant-reference', o['grant-reference'], '--configuration-digest', o['configuration-digest'], '--expires-at', o['expires-at'],
    '--activation-record', l.activation, '--authority-record', l.authority, '--operator-records', root,
    '--explicit-yes-installation', o['explicit-yes-installation'], '--review-repository', o['review-repository'],
    '--harness-user', '_instarharness', '--model', 'claude-opus-4-6', '--tools-activation', l.toolsActivation,
    '--conversation-session', 'on', '--session-work-activation', l.sessionActivation, '--effect-policy', join(root, 'effect-policy.json'),
    '--max-calls', '16', '--max-replies', '16', '--max-turns', '20', '--max-context-bytes', '32768']);
});
it.each(['run-config.json', 'model-setting.json', 'harness-logins.json', 'activation.json', 'authority.json', 'profile.json',
  'tools.json', 'session.json', 'yes.json', 'journal.encrypted'])('refuses missing %s before launch', name => {
  const { root } = fixture(); unlinkSync(join(root, name)); expect(() => buildRunArgv(root)).toThrow(/Run refused:/);
});
it('carries the installed standing trust to the runner: recorded grants decide connected-account effects in a copy', () => {
  const { root } = fixture();
  const argv = buildRunArgv(root);
  const policyPath = argv[argv.indexOf('--effect-policy') + 1];
  expect(policyPath).toBe(join(root, 'effect-policy.json'));
  // What the runner decides with (journal-agent.mjs: a policy is loaded only from --effect-policy, else the empty default).
  const installed = currentEffectPolicy(() => readFileSync(policyPath, 'utf8'));
  const mcpReads = readRootMcp(root).reads;
  const decide = (effectPolicy: unknown, tool: string, input: unknown) =>
    admitToolCallEffect(tool, input, { operations: [], effectPolicy, mcpReads }, 1000).admitted;
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  for (const row of [...recorded, { id: 'plain', raw: 'hello' }]) {
    // Listed connector reads are ordinary work under either policy; the recorded grant admits the account write only
    // when the installed file reaches the doorway; an ungranted write is refused under both.
    expect(decide(DEFAULT_EFFECT_POLICY, 'mcp__fakeacct__lookup', { key: row.raw }), row.id).toBe(true);
    expect(decide(installed, 'mcp__fakeacct__lookup', { key: row.raw }), row.id).toBe(true);
    expect(decide(DEFAULT_EFFECT_POLICY, 'mcp__fakeacct__post_note', { text: row.raw }), row.id).toBe(false);
    expect(decide(installed, 'mcp__fakeacct__post_note', { text: row.raw }), row.id).toBe(true);
    expect(decide(installed, 'mcp__fakeacct__delete_all', { text: row.raw }), row.id).toBe(false);
  }
  // The owner GitHub read grant as the desk recorded it in a live root (INSTANCE-ONLY row 16): the same seam.
  const ownerGithub = { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
    registered: [{ effect: 'tool:mcp', target: OWNER_BROWSER_TOOL, consequence: 'data', reversibility: 'reversible', reach: 'agent', costUsd: 0, source: 'operator:read' }],
    grants: [{ id: 'echo-owned-github-profile-read-1103', ownerBrowserPages: ['account-profile', 'account-repositories'], effect: 'tool:mcp',
      target: OWNER_BROWSER_TOOL, approves: ['scope'], source: 'operator:read', custodian: 'owner', recovery: 'withdraw the grant' }] };
  writeFileSync(policyPath, JSON.stringify(ownerGithub));
  expect(decide(DEFAULT_EFFECT_POLICY, OWNER_BROWSER_TOOL, { page: 'account-profile' })).toBe(false);
  expect(decide(currentEffectPolicy(() => readFileSync(policyPath, 'utf8')), OWNER_BROWSER_TOOL, { page: 'account-profile' })).toBe(true);
  // Withdrawn (expired) grant, and a file that no longer decodes: nothing outward, including the listed read while unreadable.
  writeFileSync(policyPath, JSON.stringify({ ...ownerGithub, grants: [{ ...ownerGithub.grants[0], expiresAt: 999 }] }));
  expect(decide(currentEffectPolicy(() => readFileSync(policyPath, 'utf8')), OWNER_BROWSER_TOOL, { page: 'account-profile' })).toBe(false);
  writeFileSync(policyPath, '{"type":"PreviewEffectPolicy"');
  const unreadable = currentEffectPolicy(() => readFileSync(policyPath, 'utf8'));
  expect(decide(unreadable, 'mcp__fakeacct__post_note', { text: 'x' })).toBe(false);
  expect(decide(unreadable, 'mcp__fakeacct__lookup', { key: 'x' })).toBe(false);
  expect(buildRunArgv(root)).toEqual(argv);
});
// Execute the actual startup composition so an eager decode before the reader is a regression,
// not hidden by a test that calls currentEffectPolicy directly. No provider or live account is used.
const runnerSource = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const policyStartup = runnerSource.slice(runnerSource.indexOf("    const effectPolicyPath = options['effect-policy'];"),
  runnerSource.indexOf('    // Rule 114: a tool turn a crash interrupted'));
it.each(['missing', 'malformed', 'invalid', 'unreadable', 'directory', 'oversized'])(
  'keeps startup and local work reachable with %s trust, refuses connected effects, and recovers on reread', failure => {
    const { root } = fixture();
    const policyPath = join(root, 'effect-policy.json'), valid = readFileSync(policyPath, 'utf8');
    let unreadable = failure === 'unreadable';
    if (failure === 'missing' || failure === 'directory') unlinkSync(policyPath);
    if (failure === 'directory') mkdirSync(policyPath);
    if (failure === 'malformed') writeFileSync(policyPath, '{"private-fixture-value":');
    if (failure === 'invalid') writeFileSync(policyPath, '{}');
    // Valid JSON over the old launcher's bound must still be unavailable at the effect checkpoint.
    if (failure === 'oversized') writeFileSync(policyPath, valid + ' '.repeat(1024 * 1024));
    const argv = buildRunArgv(root);
    expect(argv[argv.indexOf('--effect-policy') + 1]).toBe(policyPath);
    let diagnostics = '';
    const read = (path: string, encoding: 'utf8') => {
      if (unreadable) throw Object.assign(new Error('private-fixture-value'), { code: 'EACCES' });
      return readFileSync(path, encoding);
    };
    const env = { options: { 'effect-policy': policyPath }, statSync, readFileSync: read,
      currentEffectPolicy, decodeEffectPolicy, UNAVAILABLE_EFFECT_POLICY, DEFAULT_EFFECT_POLICY,
      process: { stderr: { write: (text: string) => { diagnostics += text; } } } };
    const policyOf = Function(...Object.keys(env), `let effectPolicyOf = () => DEFAULT_EFFECT_POLICY;
      ${policyStartup}
return effectPolicyOf;`)(...Object.values(env));
    expect(policyOf()).toMatchObject({ type: UNAVAILABLE_EFFECT_POLICY });
    expect(diagnostics).toContain('effect policy unavailable');
    expect(diagnostics).toContain('affected effects refused until readable');
    expect(diagnostics).not.toContain('private-fixture-value');
    const config = () => ({ workspace: root, tmp: root, maxCalls: 10, maxWriteBytes: 4096,
      gate: 'fixture-checkpoint', delegation: true, operations: [], effectPolicy: policyOf(), mcpReads: readRootMcp(root).reads });
    const decide = (tool: string) => admitToolCallEffect(tool, { text: 'hello' }, config(), 1000);
    for (const tool of ['mcp__fakeacct__post_note', 'mcp__fakeacct__lookup']) {
      expect(decide(tool)).toMatchObject({ admitted: false, disposition: 'refused' });
      expect(decide(tool).reason).toContain('unavailable');
    }
    const fs = { exists: () => true, realpath: (path: string) => path };
    for (const [tool_name, tool_input] of [
      ['Read', { file_path: join(root, 'notes.txt') }], ['Grep', { path: root, pattern: 'hello' }],
      ['TodoWrite', { todos: [] }], ['Write', { file_path: join(root, 'notes.txt'), content: 'hello' }],
    ]) {
      const admission = admitToolCall({ tool_name, tool_input }, config(), 1, fs);
      expect(admission, `${tool_name}: ${admission.reason}`).toMatchObject({ decision: 'allow' });
    }
    unreadable = false;
    if (failure === 'directory') rmSync(policyPath, { recursive: true });
    writeFileSync(policyPath, valid);
    expect(policyOf()).toMatchObject({ type: 'PreviewEffectPolicy' });
    expect(decide('mcp__fakeacct__post_note').admitted).toBe(true);
    expect(decide('mcp__fakeacct__lookup').admitted).toBe(true);
    expect(decide('mcp__fakeacct__delete_all').admitted).toBe(false);
    unlinkSync(policyPath);
    expect(decide('mcp__fakeacct__lookup').admitted).toBe(false);
    writeFileSync(policyPath, valid);
    expect(decide('mcp__fakeacct__post_note').admitted).toBe(true);
  });
it('uses only the root model, never an environment setting or activation hint', () => {
  const { root } = fixture(); save(root, 'activation.json', { model: 'claude-other' });
  save(root, 'model-setting.json', { model: 'claude-sonnet-4-6' });
  const argv = buildRunArgv(root); expect(argv[argv.indexOf('--model') + 1]).toBe('claude-sonnet-4-6');
});
it.each([{ model: 'secret-value' }, { 'max-calls': -1 }, { 'max-turns': 0 }, { forum: 'maybe' }, { surprise: 'secret-value' }])(
  'refuses unknown or invalid config without echoing values %j', patch => {
    const { root, options } = fixture(); save(root, 'run-config.json', { version: 1, options: { ...options, ...patch } });
    expect(() => buildRunArgv(root)).toThrow(/Run refused:/);
    try { buildRunArgv(root); } catch (error) { expect(String(error)).not.toContain('secret-value'); }
  });
it('preserves optional tools derivation and explicit finite limits', () => {
  const { root, options, login } = fixture(); const { toolsActivation: _, ...withoutTools } = login;
  save(root, 'harness-logins.json', { version: 1, logins: [withoutTools] });
  save(root, 'run-config.json', { version: 1, options: { ...options, 'max-calls': 2 } });
  const argv = buildRunArgv(root); expect(argv).not.toContain('--tools-activation');
  expect(argv[argv.indexOf('--max-calls') + 1]).toBe('2');
});
it('the shipped CLI refuses missing records plainly without starting or writing a root', () => {
  const { root } = fixture(); unlinkSync(join(root, 'model-setting.json'));
  const before = readFileSync(join(root, 'journal.encrypted'));
  const result = spawnSync(process.execPath, ['bin/instar2.mjs', 'run', root], { encoding: 'utf8', timeout: 15000 });
  expect(result.status).toBe(1); expect(result.stderr).toContain('Run refused:');
  expect(result.stdout).toBe(''); expect(readFileSync(join(root, 'journal.encrypted'))).toEqual(before);
});
it.each([
  ['run-config.json', { version: 2, options: {} }],
  ['model-setting.json', { model: 'claude-opus-4-6', fallback: 'claude-sonnet-4-6' }],
  ['model-setting.json', { model: '--unsafe' }],
  ['harness-logins.json', { version: 1, logins: [] }],
  ['harness-logins.json', { version: 2, logins: [] }],
])('refuses unknown record formats in %s', (name, value) => {
  const { root } = fixture(); save(root, name, value); expect(() => buildRunArgv(root)).toThrow(/Run refused:/);
});
it('refuses malformed JSON without including its contents', () => {
  const { root } = fixture(); writeFileSync(join(root, 'model-setting.json'), '{"secret-value":');
  expect(() => buildRunArgv(root)).toThrow('model-setting.json is missing or unreadable');
});
it.each(['profile', 'activation', 'authority', 'toolsActivation', 'sessionActivation'] as const)(
  'hands off missing secondary %s without replacing or rewriting the installed pool', field => {
    const { root, login } = fixture();
    const expected = buildRunArgv(root);
    save(root, 'harness-logins.json', { version: 1, logins: [login, { ...login, [field]: join(root, 'missing.json') }] });
    const before = readFileSync(join(root, 'harness-logins.json'));
    expect(buildRunArgv(root)).toEqual(expected);
    expect(readFileSync(join(root, 'harness-logins.json'))).toEqual(before);
    save(root, 'missing.json', { fixture: true });
    expect(buildRunArgv(root)).toEqual(expected);
  });
it.each([null, {}, { profile: 'relative.json' }, { authority: null }, { toolsActivation: '' }, { sessionActivation: 3 }])(
  'still refuses malformed secondary inventory %j', patch => {
    const { root, login } = fixture();
    const secondary = patch === null ? null : Object.keys(patch).length ? { ...login, ...patch } : {};
    save(root, 'harness-logins.json', { version: 1, logins: [login, secondary] });
    expect(() => buildRunArgv(root)).toThrow(/Run refused:/);
  });
it('requires a session grant only when sessions are requested', () => {
  const { root, login, options } = fixture(); const { sessionActivation: _, ...withoutSession } = login;
  save(root, 'harness-logins.json', { version: 1, logins: [withoutSession] });
  expect(() => buildRunArgv(root)).toThrow(/sessions need their installed activation/);
  save(root, 'run-config.json', { version: 1, options: { ...options, 'conversation-session': 'off' } });
  expect(buildRunArgv(root)).not.toContain('--session-work-activation');
});
it('the shipped command hands off the exact argv, package cwd and exit status to the existing entry', () => {
  const { root } = fixture();
  // Observe only the entry boundary, with no runner or provider call. The real CLI and loader run.
  const loader = join(root, 'observe-entry.mjs');
  writeFileSync(loader, `export async function load(url, context, next) {
    if (url.endsWith('/tests/preview/journal-agent.mjs')) return { format: 'module', shortCircuit: true,
      source: 'process.stdout.write(JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd()})); process.exitCode=7;' };
    return next(url, context);
  }`);
  const packageRoot = process.cwd();
  const result = spawnSync(process.execPath, ['--no-warnings', '--loader', loader, join(packageRoot, 'bin/instar2.mjs'), 'run', root],
    { cwd: root, encoding: 'utf8', timeout: 15000, env: { ...process.env, MODEL: 'claude-other' } });
  expect(result.stderr).toBe(''); expect(result.status).toBe(7);
  expect(JSON.parse(result.stdout)).toEqual({ argv: buildRunArgv(root), cwd: packageRoot });
});
it('valid configuration reaches the real runner, which still refuses absent custody', () => {
  const { root } = fixture();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('INSTAR_SECRET_')));
  const result = spawnSync(process.execPath, ['bin/instar2.mjs', 'run', root], { encoding: 'utf8', timeout: 30000, env });
  expect(result.status).toBe(1); expect(result.stderr).toContain('preview refused to start or continue; details suppressed');
  expect(readFileSync(join(root, 'journal.encrypted'), 'utf8')).toBe('fixture-only: never opened by argv builder');
});
