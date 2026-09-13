import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('P12-NF-16 P12-NF-18 P12-NF-46 round16 commit-restart holds only the cross-process arm on the row 99 owner seam', () => {
  expect(existsSync('src/assembly/conformance-commit.ts')).toBe(false);
  for (const file of ['src/conversation/contracts.ts', 'src/conversation/telegram.ts',
    'tests/conversation/fixture.ts']) {
    expect(readFileSync(file, 'utf8'), file).not.toContain('conformanceCommit');
  }
  const map = readFileSync('scripts/check-p12-contract-map.mjs', 'utf8');
  for (const row of [16, 18, 46]) {
    expect(map, `P12-NF-${row}`).toMatch(new RegExp(
      `\\n\\s*${row}: [^\\n]+NON-EXECUTABLE-UNTIL-row-99-ten-conditional-append`));
  }
});
