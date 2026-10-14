import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import setup from '../setup/test-tmp.js';
import { openPreviewJournal } from '../preview/journal.js';

it.each(['inherited', 'override'] as const)('canonicalizes a %s temp alias and restores it after the run', kind => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'redirect-alias-')));
  const alias = join(root, 'alias'), target = join(root, 'target');
  mkdirSync(target); symlinkSync(target, alias);
  const keys = ['TMPDIR', 'INSTAR_TEST_TMP', 'INSTAR_TEST_TMP_ROOT', 'INSTAR_TEST_TMP_KIND',
    'INSTAR_TEST_REAL_DISK', 'INSTAR_TEST_OUTER_TMPDIR'] as const;
  const saved = keys.map(key => [key, process.env[key]] as const);
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  try {
    for (const key of keys) delete process.env[key];
    process.env.TMPDIR = alias;
    if (kind === 'override') process.env.INSTAR_TEST_TMP = alias;
    // Exercise the inherited branch even on a host with a working default RAM volume.
    Object.defineProperty(process, 'platform', { ...platform, value: 'test-no-default-ram' });
    const teardown = setup();
    try {
      expect(tmpdir()).toBe(realpathSync(tmpdir()));
      expect(kind === 'inherited' ? tmpdir() === target : tmpdir().startsWith(`${target}/instar-test-`)).toBe(true);
      const dir = mkdtempSync(join(tmpdir(), 'journal-fixture-'));
      expect(dir).toBe(realpathSync(dir));
      rmSync(dir, { recursive: true });
      expect(lstatSync(alias).isSymbolicLink()).toBe(true);
      // Canonicalizing the fixture base does not admit a substituted journal directory.
      expect(() => openPreviewJournal(join(alias, 'journal.encrypted'), new Uint8Array(32)))
        .toThrow('preview journal: substituted directory');
    } finally { teardown(); }
    expect(process.env.TMPDIR).toBe(alias);
    expect(existsSync(target)).toBe(true);
  } finally {
    Object.defineProperty(process, 'platform', platform);
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
