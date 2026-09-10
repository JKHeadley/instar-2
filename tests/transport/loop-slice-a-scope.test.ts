import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('SLB-SLICE-A-75 excludes missed-member input validation and fixture schemas', () => {
  for (const path of ['src/transport/records.ts', 'tests/transport/loop-fixture.ts']) {
    const source = readFileSync(path, 'utf8');
    expect(source, path).not.toContain('transportScheduleBinding');
    expect(source, path).not.toContain('transportScheduleKind');
  }
});
