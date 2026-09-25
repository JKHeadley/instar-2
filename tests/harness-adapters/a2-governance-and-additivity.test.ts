import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { checkP13A2Architecture, checkP13DependencyCitations, p13A2Dispositions, p13A2PathAllowed } from '../../scripts/check-p13-contract-map.mjs';
// @ts-expect-error The shared first-landing baseline checker is plain ESM.
import { firstLanding } from '../../scripts/first-landing.mjs';

const retiredBootTest = 'tests/assembly/production-boot-conversation.test.ts';
const replacementBootTests = [
  'tests/assembly/production-boot-conversation-shard-0.test.ts',
  'tests/assembly/production-boot-conversation-shard-1.test.ts',
  'tests/assembly/production-boot-conversation-shard-2.test.ts',
  'tests/assembly/production-boot-conversation-shard-3.test.ts',
];
const inheritedPrefixes = ['tests/rungraph/', 'tests/transport/', 'tests/effects/', 'tests/verification/', 'tests/assembly/'];

function checkBootShardReplacement(root: string) {
  expect(lstatSync(join(root, retiredBootTest), { throwIfNoEntry: false }), retiredBootTest).toBeUndefined();
  for (const path of replacementBootTests)
    expect(lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile(), path).toBe(true);
}

function checkInheritedFixtures(root: string, mainTip: string, minimum: number) {
  const paths = execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', mainTip], { encoding: 'utf8' })
    .trim().split('\n').filter(path => inheritedPrefixes.some(prefix => path.startsWith(prefix)));
  expect(paths.length).toBeGreaterThan(minimum);
  for (const path of paths) {
    if (path === retiredBootTest) continue;
    expect(readFileSync(join(root, path)), path).toEqual(execFileSync('git', ['-C', root, 'show', `${mainTip}:${path}`]));
  }
}

it('P13 A2 fixture bytes compare only before A2 lands, with boot-shard assertions retained separately', () => {
  const root = mkdtempSync(join(tmpdir(), 'p13-a2-byte-scope-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'p13-a2-fixture@instar.local');
    git('config', 'user.name', 'P13 A2 Fixture');
    mkdirSync(join(root, 'src', 'harness-adapters'), { recursive: true });
    mkdirSync(join(root, 'tests', 'rungraph'), { recursive: true });
    writeFileSync(join(root, 'src', 'harness-adapters', 'admission.ts'), 'landed A1\n');
    writeFileSync(join(root, 'tests', 'rungraph', 'owner.test.ts'), 'inherited fixture\n');
    git('add', '.'); git('commit', '-m', 'A1 and inherited owner fixture');
    git('switch', '-c', 'a2');
    writeFileSync(join(root, 'src', 'harness-adapters', 'adapter.ts'), 'permitted A2 addition\n');
    const before = firstLanding(root, ['src/harness-adapters/adapter.ts']);
    expect(before.applicable).toBe(true);
    expect(() => checkInheritedFixtures(root, before.mainTip, 0)).not.toThrow();
    writeFileSync(join(root, 'tests', 'rungraph', 'owner.test.ts'), 'violating fixture rewrite\n');
    expect(() => checkInheritedFixtures(root, before.mainTip, 0)).toThrow();
    writeFileSync(join(root, 'tests', 'rungraph', 'owner.test.ts'), 'inherited fixture\n');
    rmSync(join(root, 'src', 'harness-adapters', 'adapter.ts'));
    git('switch', 'main');
    writeFileSync(join(root, 'src', 'harness-adapters', 'adapter.ts'), 'landed A2\n');
    writeFileSync(join(root, 'src', 'harness-adapters', 'holder.ts'), 'landed A2 holder\n');
    mkdirSync(join(root, 'tests', 'assembly'), { recursive: true });
    for (const path of replacementBootTests) writeFileSync(join(root, path), 'replacement shard\n');
    git('add', '.'); git('commit', '-m', 'land A2');
    git('switch', '-c', 'later');
    writeFileSync(join(root, 'src', 'harness-adapters', 'adapter.ts'), 'later owner edit\n');
    writeFileSync(join(root, 'tests', 'rungraph', 'owner.test.ts'), 'later cross-owner edit\n');
    expect(firstLanding(root, ['src/harness-adapters/adapter.ts', 'src/harness-adapters/holder.ts']).applicable)
      .toBe(false);
    expect(() => checkBootShardReplacement(root)).not.toThrow();
    rmSync(join(root, replacementBootTests[0]!));
    expect(() => checkBootShardReplacement(root)).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('P13-A2-ADDITIVITY compares inherited fixtures on A2 first landing and always checks boot shards and architecture', () => {
  // GRANT BOOT-SPLIT (astra-boot-split-fence-ruling.md): retire only this exact path.
  // These replacement assertions remain permanent after the first-landing comparison ends.
  checkBootShardReplacement(process.cwd());
  const scope = firstLanding(process.cwd(), ['src/harness-adapters/adapter.ts', 'src/harness-adapters/holder.ts']);
  if (scope.applicable) {
    checkInheritedFixtures(process.cwd(), scope.mainTip, 50);
  } else {
    console.log(`P13 A2 inherited-fixture comparison inapplicable: adapter and holder units already present on current-main baseline ${scope.mainTip}.`);
  }
  expect(p13A2PathAllowed('src/rungraph/a2-stand-in.ts')).toBe(false);
  expect(p13A2PathAllowed('tests/verification/rewrite.test.ts')).toBe(false);
  const architecture = checkP13A2Architecture();
  expect(architecture.applicable).toBe(false);
  expect(architecture.sourceFiles).toEqual(expect.arrayContaining([
    'adapter.ts', 'holder.ts', 'regression-boundaries.ts',
  ]));
  const stateHost = readFileSync('scripts/slice-p13-state-storage.mjs', 'utf8');
  expect(stateHost).toContain('createFactStore(');
  expect(stateHost).toContain('createTransportFileStorage(');
  expect(stateHost).not.toMatch(/symlinkSync|readlinkSync|recoverDeadWriter|randomUUID/);
});

it('R2-F08 R2-F10 P13-A2-MAP all 52 rows retain exact real-owner dispositions and held remainders', () => {
  const rows = p13A2Dispositions() as Array<{ id: string; number: number; status: string; heldArms?: string }>;
  expect(rows).toHaveLength(52);
  expect(new Set(rows.map(row => row.id)).size).toBe(52);
  expect(rows.filter(row => row.status === 'EXECUTABLE')).toHaveLength(22);
  expect(rows.filter(row => row.heldArms)).toHaveLength(12);
  expect(rows.find(row => row.number === 3)?.status).toBe('NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md');
  expect(rows.find(row => row.number === 8)?.status).toBe('NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md');
  expect(rows.find(row => row.number === 46)?.heldArms).toContain('dated 07:10Z addenda');
  expect(rows.find(row => row.number === 46)?.heldArms).not.toContain('HELD-REMAINDER');
  expect(rows.find(row => row.number === 51)?.heldArms).toContain('seam-response-effects-followup.md');
  expect(rows.find(row => row.number === 21)?.status).toContain('dated 08:48Z addenda');
  expect(rows.find(row => row.number === 31)?.heldArms)
    .toContain('NON-EXECUTABLE-UNTIL-design-17-harness-adapters-seam-request-part-two-capture-read.md');
  expect(rows.find(row => row.number === 31)?.heldArms)
    .not.toContain('NON-EXECUTABLE-UNTIL-row-83-run-admission-production');
  expect(rows.find(row => row.number === 31)?.heldArms).toContain('SEAM-LEDGER.md row 38');
  expect(rows.find(row => row.number === 31)?.heldArms).toContain('SEAM-LEDGER.md row 45');
});

it('R2-F11 P13-A2-MAP dependency validation covers A2 held arms and refuses an invented grant', () => {
  const rows = p13A2Dispositions() as Array<{ id: string; number: number; status: string; heldArms?: string }>;
  expect(() => checkP13DependencyCitations(rows.map(row => row.number === 31
    ? { ...row, heldArms: 'NON-EXECUTABLE-UNTIL-seam-response-NO-SUCH-GRANT.md' }
    : row))).toThrow('seam-response-NO-SUCH-GRANT.md');
  for (const heldArms of ['NON-EXECUTABLE-UNTIL-not-a-grant', 'HELD-REMAINDER-unimplemented-check']) {
    expect(() => checkP13DependencyCitations(rows.map(row => row.number === 31 ? { ...row, heldArms } : row)), heldArms)
      .toThrow();
  }
  expect(checkP13DependencyCitations(rows).citations)
    .toContain('design-17-harness-adapters-seam-request-part-two-capture-read.md');
});
