import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'tests/register/normal-provider-fixture.ts',
  'tests/integration/register-workflow-evidence-round3.test.ts',
  'tests/integration/register-workflow-record-id-round5.test.ts',
  'tests/integration/register-reference-identity-round6.test.ts',
];

describe('round-eight public owner type boundary', () => {
  it('P3-NF-09 imports Validation only through the Part One public entry point', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain("from '../../src/decode/framework.js'");
      expect(source).toMatch(/import type \{[^}]*\bValidation\b[^}]*\} from '\.\.\/\.\.\/src\/index\.js';/s);
    }
  });
});
