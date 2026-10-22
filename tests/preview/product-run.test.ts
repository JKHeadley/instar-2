import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error Product operator entry is JavaScript.
import { buildRunArgv } from '../../scripts/product-run.mjs';
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
    '--conversation-session', 'on', '--session-work-activation', l.sessionActivation,
    '--max-calls', '16', '--max-replies', '16', '--max-turns', '20', '--max-context-bytes', '32768']);
});
it.each(['run-config.json', 'model-setting.json', 'harness-logins.json', 'activation.json', 'authority.json', 'profile.json',
  'tools.json', 'session.json', 'yes.json', 'journal.encrypted'])('refuses missing %s before launch', name => {
  const { root } = fixture(); unlinkSync(join(root, name)); expect(() => buildRunArgv(root)).toThrow(/Run refused:/);
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
