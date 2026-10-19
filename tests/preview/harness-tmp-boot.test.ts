import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical harness setup stays outside the pure core.
import { HARNESS_TMP_DENY } from './harness-user.mjs';

const script = 'scripts/install-harness-tmp-acl.sh';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// Exercise installer control flow without root or a shared-host mutation. Only
// the OS identity/service commands and the two installation paths are replaced;
// file creation, comparison, atomic rename and refused existing files are real.
function host(overrides: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'harness-tmp-boot-')); roots.push(root);
  const bin = join(root, 'bin'), daemons = join(root, 'daemons'), log = join(root, 'commands');
  mkdirSync(bin); mkdirSync(daemons);
  const commands: Record<string, string> = {
    uname: 'echo "${TEST_OS:-Darwin}"',
    id: 'if [ "$#" = 1 ]; then echo "${TEST_UID:-0}"; else [ "${TEST_USER:-present}" = present ] || exit 1; echo 498; fi',
    chown: ':', plutil: ':',
    launchctl: 'if [ "$1" = print ]; then [ "${TEST_LOADED:-no}" = yes ]; else echo "$*" >> "$TEST_LOG"; fi',
    chmod: 'if [ "$1" = +a ]; then echo "acl-applied" >> "$TEST_LOG"; else /bin/chmod "$@"; fi',
  };
  for (const [name, body] of Object.entries(commands))
    writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
  const copy = join(root, 'install.sh');
  writeFileSync(copy, readFileSync(script, 'utf8')
    .replace('PATH=/usr/bin:/bin:/usr/sbin:/sbin', `PATH='${bin}':/usr/bin:/bin:/usr/sbin:/sbin`)
    .replaceAll('/Library/LaunchDaemons', daemons).replaceAll('/private/tmp', join(root, 'tmp')));
  const plist = join(daemons, 'ai.instar.harness-tmp-acl.plist');
  return { plist, log, run: () => spawnSync('/bin/bash', [copy, 'install'], {
    encoding: 'utf8', env: { ...process.env, TEST_LOG: log, ...overrides },
  }) };
}

it('restores the existing isolation at boot using only system-owned executable and literal arguments', () => {
  const plist = execFileSync('/bin/bash', [script, 'print'], { encoding: 'utf8' });
  const args = [...plist.match(/<array>([\s\S]*?)<\/array>/u)![1]!.matchAll(/<string>(.*?)<\/string>/gu)]
    .map(match => match[1]);
  expect(args).toEqual(['/bin/chmod', '+a', HARNESS_TMP_DENY, '/private/tmp']);
  expect(plist).toContain('<key>RunAtLoad</key><true/>');
  expect(plist).toContain('<key>Label</key><string>ai.instar.harness-tmp-acl</string>');
  expect(plist).not.toMatch(/KeepAlive|StartInterval|\/Users\/|\/bin\/(?:ba)?sh/u);
  expect(execFileSync('/bin/bash', ['-n', script], { encoding: 'utf8' })).toBe('');
});

it('rejects unknown modes and extra arguments without installing anything', () => {
  for (const args of [[], ['apply'], ['print', 'extra'], ['install', 'extra']]) {
    const result = spawnSync('/bin/bash', [script, ...args], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
  }
});

it('installs and applies the boot job, and repeats safely for an already loaded identical job', () => {
  for (const loaded of ['no', 'yes']) {
    const h = host({ TEST_LOADED: loaded });
    expect(h.run().status).toBe(0);
    const first = readFileSync(h.plist, 'utf8');
    expect(h.run().status).toBe(0);
    expect(readFileSync(h.plist, 'utf8')).toBe(first);
    const calls = readFileSync(h.log, 'utf8');
    expect(calls).toContain(loaded === 'yes' ? 'kickstart system/ai.instar.harness-tmp-acl' : 'bootstrap system');
    expect(calls.match(/acl-applied/gu)).toHaveLength(2);
  }
});

it('refuses unsupported hosts, non-root installation and a missing harness account before writing a job', () => {
  for (const override of [{ TEST_OS: 'Linux' }, { TEST_UID: '501' }, { TEST_USER: 'missing' }]) {
    const h = host(override);
    expect(h.run().status).not.toBe(0);
    expect(() => readFileSync(h.plist)).toThrow();
    expect(() => readFileSync(h.log)).toThrow();
  }
});

it('preserves different existing jobs and refuses symlinks without touching the target or applying an ACL', () => {
  for (const link of [false, true]) {
    const h = host();
    const target = `${h.plist}.other`;
    writeFileSync(target, 'another administrator job');
    if (link) symlinkSync(target, h.plist); else writeFileSync(h.plist, 'another administrator job');
    expect(h.run().status).toBe(2);
    expect(readFileSync(h.plist, 'utf8')).toBe('another administrator job');
    expect(readFileSync(target, 'utf8')).toBe('another administrator job');
    expect(() => readFileSync(h.log)).toThrow();
  }
});
