import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical adapter stays plain JavaScript.
import { prepareSubscriptionInteractive } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
const fresh = () => { const root = mkdtempSync(join(tmpdir(), 'first-run-')); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('seeds only the selected profile and preserves existing preferences and account metadata', () => {
  const root = fresh(), selected = join(root, 'selected'), neighbour = join(root, 'neighbour');
  mkdirSync(selected); mkdirSync(neighbour);
  const file = join(selected, '.claude.json');
  const prior = { machineID: 'recorded-machine', oauthAccount: { emailAddress: 'test@example.invalid' },
    theme: 'light', hasCompletedOnboarding: false, projects: { '/work': { allowedTools: [] } } };
  writeFileSync(file, JSON.stringify(prior));
  writeFileSync(join(neighbour, '.claude.json'), 'untouched');
  expect(prepareSubscriptionInteractive(selected)).toBe(true);
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ ...prior, hasCompletedOnboarding: true });
  const before = statSync(file);
  expect(prepareSubscriptionInteractive(selected)).toBe(false);
  expect(statSync(file).mtimeMs).toBe(before.mtimeMs);
  expect(readFileSync(join(neighbour, '.claude.json'), 'utf8')).toBe('untouched');
});

it('a fresh profile gets a theme and no credential or fabricated account', () => {
  const root = fresh();
  expect(prepareSubscriptionInteractive(root)).toBe(true);
  expect(JSON.parse(readFileSync(join(root, '.claude.json'), 'utf8'))).toEqual({
    hasCompletedOnboarding: true, theme: 'dark',
  });
  expect(statSync(join(root, '.claude.json')).mode & 0o777).toBe(0o600);
  expect(JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8'))).toEqual({ skipDangerousModePermissionPrompt: true });
});

it('preserves user settings and refuses malformed settings before changing native config', () => {
  const root = fresh(), file = join(root, 'settings.json');
  writeFileSync(file, JSON.stringify({ hooks: { Stop: [] }, skipDangerousModePermissionPrompt: false }));
  expect(prepareSubscriptionInteractive(root)).toBe(true);
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ hooks: { Stop: [] }, skipDangerousModePermissionPrompt: true });
  const config = join(root, '.claude.json'); writeFileSync(config, '{}');
  writeFileSync(file, '{bad');
  expect(() => prepareSubscriptionInteractive(root)).toThrow();
  expect(readFileSync(config, 'utf8')).toBe('{}');
  expect(readFileSync(file, 'utf8')).toBe('{bad');
});

it('seeds native trust only for the exact admitted workspace and preserves other project settings', () => {
  const root = fresh(), work = realpathSync(fresh()), other = realpathSync(fresh());
  const file = join(root, '.claude.json');
  writeFileSync(file, JSON.stringify({ projects: { [work]: { allowedTools: [] },
    [other]: { hasTrustDialogAccepted: false } } }));
  expect(prepareSubscriptionInteractive(root, work)).toBe(true);
  expect(JSON.parse(readFileSync(file, 'utf8')).projects).toEqual({
    [work]: { allowedTools: [], hasTrustDialogAccepted: true }, [other]: { hasTrustDialogAccepted: false },
  });
  expect(prepareSubscriptionInteractive(root, work)).toBe(false);
  for (const projects of [[], false, { [work]: 'invalid' }]) {
    const bytes = JSON.stringify({ projects }); writeFileSync(file, bytes);
    expect(() => prepareSubscriptionInteractive(root, work)).toThrow();
    expect(readFileSync(file, 'utf8')).toBe(bytes);
  }
});

it.each(['{invalid', 'null', '[]', 'false'])('preserves unusable native state rather than overwriting it: %s', bytes => {
  const root = fresh(), file = join(root, '.claude.json'); writeFileSync(file, bytes);
  expect(() => prepareSubscriptionInteractive(root)).toThrow();
  expect(readFileSync(file, 'utf8')).toBe(bytes);
});

it('refuses missing directories and links without changing their targets', () => {
  const root = fresh(), target = join(root, 'target'); writeFileSync(target, '{}');
  symlinkSync(target, join(root, '.claude.json'));
  expect(() => prepareSubscriptionInteractive(root)).toThrow(/regular file/);
  expect(readFileSync(target, 'utf8')).toBe('{}');
  expect(() => prepareSubscriptionInteractive(join(root, 'absent'))).toThrow();
  const directoryLink = join(fresh(), 'link'); symlinkSync(root, directoryLink);
  expect(() => prepareSubscriptionInteractive(directoryLink)).toThrow(/config directory/);
});

it('refuses a config-to-secret symlink swap between the file check and its read', () => {
  const root = fresh(), file = join(root, '.claude.json'), secret = join(root, 'runner-custody');
  writeFileSync(file, '{}'); writeFileSync(secret, '{"token":"synthetic-custody-only"}');
  // Deterministic race at the OS read boundary. Old lstat-then-read followed the swapped link
  // and copied its token into worker-readable config; O_NOFOLLOW must refuse the same race.
  const script = `import fs from 'node:fs';
import assert from 'node:assert/strict';
import {syncBuiltinESMExports} from 'node:module';
import {prepareSubscriptionInteractive} from ${JSON.stringify(new URL('../../scripts/production-boot-io.mjs', import.meta.url).href)};
const file=${JSON.stringify(file)}, secret=${JSON.stringify(secret)}, root=${JSON.stringify(root)};
const read=fs.readFileSync;
fs.readFileSync=(path,...args)=>{
 if(path===file){fs.unlinkSync(file);fs.symlinkSync(secret,file);}
 return read(path,...args);
};
syncBuiltinESMExports();
assert.throws(()=>prepareSubscriptionInteractive(root),{code:'ELOOP'});
assert.equal(read(secret,'utf8'),'{'+'"token":"synthetic-custody-only"}');
assert.equal(fs.existsSync(root+'/settings.json'),false);
`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10000 });
  expect(result.status, result.stderr).toBe(0);
});
