import { afterEach, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error Physical host boundary, intentionally outside the pure core.
import { assertAgentPaths } from '../../scripts/agent-paths.mjs';

const roots: string[] = [];
const fixture = () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'agent-paths-')));
  roots.push(home);
  return home;
};
afterEach(() => roots.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
const folders = ['Documents', 'Desktop', 'Downloads', 'Library/Mobile Documents'];

it.each(folders)('refuses %s itself and absent descendants for every agent directory role', folder => {
  const home = fixture(), options = { platform: 'darwin', home };
  for (const role of ['root', 'workspace', 'state']) for (const suffix of ['', 'new/agent']) {
    const path = join(home, folder, suffix);
    expect(() => assertAgentPaths({ [role]: path }, options)).toThrow(`macOS protected folder ~/${folder}`);
    expect(() => assertAgentPaths({ [role]: path }, options)).toThrow('Use the agent home instead');
    expect(existsSync(path)).toBe(false);
  }
});
it('resolves existing and missing descendants through symlinks, including an aliased home', () => {
  const home = fixture(), target = join(home, 'Documents'); mkdirSync(target);
  const alias = join(home, 'innocent'); symlinkSync(target, alias);
  const options = { platform: 'darwin', home };
  for (const path of [alias, join(alias, 'new/state')])
    expect(() => assertAgentPaths({ root: path }, options)).toThrow('~/Documents');
  const homeAlias = join(fixture(), 'home'); symlinkSync(home, homeAlias);
  expect(() => assertAgentPaths({ workspace: join(homeAlias, 'Documents/agent') }, options)).toThrow('~/Documents');
  const downloadTarget = fixture(); symlinkSync(downloadTarget, join(home, 'Downloads'));
  expect(() => assertAgentPaths({ state: join(downloadTarget, 'new') }, options)).toThrow('~/Downloads');
});
it('accepts normal agent home and adjacent folder names, including safe symlinks', () => {
  const home = fixture(), options = { platform: 'darwin', home };
  const safe = join(home, '.instar/agents/echo'); mkdirSync(safe, { recursive: true });
  const alias = join(home, 'safe'); symlinkSync(safe, alias);
  for (const path of [safe, join(safe, 'new/state'), alias, join(home, 'Documents-backup/agent'), join(home, 'Library/Mobile Documents-other')])
    expect(() => assertAgentPaths({ root: path, workspace: path, state: path }, options)).not.toThrow();
  symlinkSync(join(home, 'missing'), join(home, 'Desktop'));
  expect(() => assertAgentPaths({ root: safe }, options)).not.toThrow();
  expect(() => assertAgentPaths({ root: join(home, 'Desktop/new') }, options)).toThrow('~/Desktop');
});
it('does not treat a dangling link or symlink cycle as a safe absent suffix', () => {
  const home = fixture(), link = join(home, 'broken'); symlinkSync(join(home, 'missing'), link);
  expect(() => assertAgentPaths({ state: join(link, 'state') }, { platform: 'darwin', home })).toThrow();
  const loop = join(home, 'loop'); symlinkSync(loop, loop);
  expect(() => assertAgentPaths({ workspace: loop }, { platform: 'darwin', home })).toThrow();
});
it.skipIf(process.getuid?.() === 0)('a protected folder that cannot be read does not block a safe agent home', () => {
  const home = fixture(), library = join(home, 'Library'); mkdirSync(join(library, 'Mobile Documents'), { recursive: true });
  chmodSync(library, 0);
  try {
    expect(() => assertAgentPaths({ root: join(home, '.instar/agents/test') }, { platform: 'darwin', home })).not.toThrow();
    expect(() => assertAgentPaths({ root: join(library, 'Mobile Documents/agent') }, { platform: 'darwin', home })).toThrow('~/Library/Mobile Documents');
  } finally { chmodSync(library, 0o700); }
});
it('leaves Linux unchanged, including protected spellings and dangling paths', () => {
  const home = fixture(), link = join(home, 'broken'); symlinkSync(join(home, 'missing'), link);
  for (const folder of [...folders, 'broken/state'])
    expect(() => assertAgentPaths({ root: join(home, folder), workspace: join(home, folder), state: join(home, folder) },
      { platform: 'linux', home })).not.toThrow();
});

const child = (home: string, args: string[], input = '') => spawnSync(process.execPath, args,
  { env: { ...process.env, HOME: home }, input, encoding: 'utf8', timeout: 30000 });
it.skipIf(process.platform !== 'darwin')('setup follows an innocently named link before creating an absent root', () => {
  const home = fixture(), target = join(home, 'Documents'); mkdirSync(target);
  const alias = join(home, 'innocent'); symlinkSync(target, alias);
  const setup = child(home, ['bin/instar2.mjs', 'setup', join(alias, 'new-agent')]);
  expect(setup.status, setup.stderr).toBe(1); expect(setup.stderr).toContain('~/Documents');
  expect(existsSync(join(target, 'new-agent'))).toBe(false);
});
it.skipIf(process.platform !== 'darwin')('keeps emergency stop reachable on an already misplaced journal root', () => {
  const home = fixture(), root = join(home, 'Documents/agent'); mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'journal.encrypted'), ''); // stop only checks existence; it never opens or replays the journal.
  const stopped = child(home, ['--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'stop', '--root', root]);
  expect(stopped.status, stopped.stderr).toBe(0);
  expect(existsSync(join(root, 'preview-stop.json'))).toBe(true);
});
it.skipIf(process.platform !== 'darwin').each(folders)('setup and both boot commands refuse %s before writes or host loading', folder => {
  const home = fixture(), root = join(home, folder, 'agent');
  const setup = child(home, ['bin/instar2.mjs', 'setup', root]);
  expect(setup.status, setup.stderr).toBe(1); expect(setup.stderr).toContain(`~/${folder}`);
  expect(existsSync(root)).toBe(false);
  const installation = join(home, 'installation.json'); writeFileSync(installation, JSON.stringify({ storageRoot: root }));
  const boot = child(home, ['bin/instar-production.mjs', installation, join(home, 'host-must-not-load.mjs')]);
  expect(boot.status, boot.stderr).toBe(1); expect(boot.stderr).toContain(`~/${folder}`);
  const live = child(home, ['--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'run', '--root', root]);
  expect(live.status, live.stderr).toBe(1); expect(live.stderr).toContain(`~/${folder}`);
  const legacy = child(home, ['--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/agent.mjs', 'run', '--root', root]);
  expect(legacy.status, legacy.stderr).toBe(1); expect(legacy.stderr).toContain(`~/${folder}`);
  const request = join(home, 'request.json'); writeFileSync(request, '{}');
  const trust = child(home, ['scripts/setup-standing-trust.mjs', 'setup', root, request]);
  expect(trust.status, trust.stderr).toBe(1); expect(trust.stderr).toContain(`~/${folder}`);
  const authority = child(home, ['--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/conversation-authority-server.mjs', '--path', join(root, 'authority.log')]);
  expect(authority.status, authority.stderr).toBe(1); expect(authority.stderr).toContain(`~/${folder}`);
  expect(existsSync(root)).toBe(false);
}, 60000);
it.skipIf(process.platform !== 'darwin')('physical storage, session and volume boundaries refuse independent unsafe paths', () => {
  const home = fixture(), safe = join(home, '.instar/agents/test'); mkdirSync(safe, { recursive: true });
  const dangerous = join(home, 'Documents/agent');
  const code = `
    import { createProductionSessionIO } from './scripts/production-session-io.mjs';
    import { productionStorageIO, createSubscriptionProviderIO } from './scripts/production-boot-io.mjs';
    import { attachSessionVolume, attachScratch } from './tests/preview/tool-turn.mjs';
    const safe = ${JSON.stringify(safe)}, bad = ${JSON.stringify(dangerous)};
    const calls = [
      () => productionStorageIO.mkdirSync(bad, { recursive: true }),
      ...['stateDirectory', 'home', 'configHome', 'cwd', 'lifecycleDirectory'].map(key => () => createProductionSessionIO({
        stateDirectory: safe + '/state', home: safe, configHome: safe, cwd: safe, [key]: bad })),
      () => attachSessionVolume(safe, { at: bad }),
      () => attachScratch(safe, 'itt-123456789abc', 1024, bad),
      () => createSubscriptionProviderIO({ repository: ${JSON.stringify(resolve('.'))}, stopped: () => false })
        .inspectSubscriptionProfile({ home: safe, configDirectory: safe, workingDirectory: bad })
    ];
    for (const call of calls) {
      try { call(); throw Error('MISSED GUARD'); }
      catch (error) { if (!error.message.includes('~/Documents')) throw error; }
    }
    console.log('all physical boundaries refused');
  `;
  const result = child(home, ['--loader', './scripts/slice-ts-loader.mjs', '--input-type=module', '-e', code]);
  expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain('all physical boundaries refused');
  expect(existsSync(dangerous)).toBe(false); expect(existsSync(join(safe, 'state'))).toBe(false);
});
