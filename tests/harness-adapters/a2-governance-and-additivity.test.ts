import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { checkP13A2Architecture, checkP13DependencyCitations, p13A2Dispositions, p13A2PathAllowed } from '../../scripts/check-p13-contract-map.mjs';

it('P13-A2-ADDITIVITY permanent main-vs-HEAD comparison keeps every touched owner legacy fixture byte-identical', async () => {
  const { createHash } = await import('node:crypto');
  // GRANT 45-B/45-E: pin exactly the two authorized production fixture rewires.
  const grantedContent = new Map([
    // GRANT PAR-Q3-BUDGET (astra-par-q3-ruling.md): exact fixture execution budgets only.
    ['tests/assembly/provider-response-evidence.test.ts', '7cdbe22f388a25071f4fd60c6f2620e1e189f5d100407f1d01e88a86fe47b2a4'],
    ['tests/rungraph/provider-answer-reply.test.ts', '94c81465fa9e2137becb8224fd4e9823f30d0074c6751f6bf2263e862dc297e6'],
    // GRANT M3-S (astra-m3-structural-adjudication.md section 3): exact additive Five early-guard tests.
    ['tests/rungraph/installed-governance.test.ts', '4741c9e14be82d3329fcee03e30ef6e661c95aba210ef0fa5cbd010f5c251737'],
    ['tests/assembly/production-grounding-inventory.json', '91bbdabbc85fcf571b9725b2304d568255db3f6bfd4873af7636a25d476af133'],
    // GRANT M3-C (Astra adjudication, 2026-09-20): the additive declaration baseline pin.
    ['tests/rungraph/closure-registration-additivity.test.ts', '8eb190dfdbf931c2a169967798c0165ccc59cc74b0f01c8393b4db52990f4744'],
    // GRANT M4-G6-N-T7: the two exhaustive P9 disposition counts 63 -> 66.
    ['tests/verification/coverage.test.ts', 'ad5a8cb698bb8a55366192d62f621bcc17395b6f8801189a58fab43ecbc4ef94'],
    ['tests/rungraph/production-grounding-scope.test.ts', '2c381217e8bdca174ae1ee4cd9f1be7df244e845f35a36c0aebd692730625dee'],
    ['tests/assembly/round10-regressions.test.ts', '74548e6d7fbc2eaaa01a786330dceb773d29f87f7687999501fcfc175f82d605'],
    ['tests/assembly/round12-regressions.test.ts', '6d0619c8c1340035ae6149101b19e5adaa012760688ec86e41560b195a037dc9'],
    // Settlement seam baseline: exact helper bytes for landed Eight 189b346.
    ['tests/transport/effect-pin.mjs', '19d668f4779b2057377de7daa64da59af7685277f59762f9f20ffae4d0081302'],
  ]);
  // GRANT BOOT-SPLIT (astra-boot-split-fence-ruling.md): retire only this exact path.
  // Keep these checks after landing; the exception below applies only while main lists it.
  const retiredBootTest = 'tests/assembly/production-boot-conversation.test.ts';
  const replacementBootTests = [
    'tests/assembly/production-boot-conversation-shard-0.test.ts',
    'tests/assembly/production-boot-conversation-shard-1.test.ts',
    'tests/assembly/production-boot-conversation-shard-2.test.ts',
    'tests/assembly/production-boot-conversation-shard-3.test.ts',
  ];
  expect(lstatSync(retiredBootTest, { throwIfNoEntry: false }), retiredBootTest).toBeUndefined();
  for (const path of replacementBootTests)
    expect(lstatSync(path, { throwIfNoEntry: false })?.isFile(), path).toBe(true);
  const prefixes = ['tests/rungraph/', 'tests/transport/', 'tests/effects/', 'tests/verification/', 'tests/assembly/'];
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' })
    .trim().split('\n').filter(path => prefixes.some(prefix => path.startsWith(prefix)));
  expect(paths.length).toBeGreaterThan(50);
  for (const path of paths) {
    if (path === retiredBootTest) continue; // Its absence was asserted above.
    const main = execFileSync('git', ['show', `main:${path}`]);
    if (grantedContent.has(path)) {
      expect(createHash('sha256').update(readFileSync(path)).digest('hex'), path).toBe(grantedContent.get(path));
    } else {
      expect(readFileSync(path), path).toEqual(main);
    }
  }
  expect(p13A2PathAllowed('src/rungraph/a2-stand-in.ts')).toBe(false);
  expect(p13A2PathAllowed('tests/verification/rewrite.test.ts')).toBe(false);
  expect(checkP13A2Architecture().sourceFiles).toEqual(expect.arrayContaining([
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
