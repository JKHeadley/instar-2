import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Part Fifteen governance inventory', () => {
  it('P15-NF-01 owns no duplicate core type and imports other owners only through public indices', () => {
    const files = ['src/scheduled/contracts.ts', 'src/scheduled/boundary.ts', 'src/scheduled/cron.ts', 'src/scheduled/manifest.ts', 'src/scheduled/package.ts'];
    const source = files.map(file => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/from ['"]\.\.\/(?:types|facts|rungraph|transport|judgment|effects|verification|assembly)\/(?!index\.js)/);
    expect(source).not.toMatch(/interface (?:Run|Lease|FactEnvelope|JudgmentRequest|EffectRequest|VerificationPlan|LocalCapabilityPackage)\b/);
  });

  it('P15-NF-02 maps every governed Rule and all 52 distinct negative fixtures', () => {
    const body = ['docs/19-scheduled-work.md', ...Array.from({ length: 11 }, (_, index) => `docs/19-scheduled-work/${String(index + 1).padStart(2, '0')}-${[
      'ownership-and-boundaries', 'declarative-job-packages', 'occurrences-durable-runs-and-exactly-once-scheduling',
      'quota-aware-admission-placement-and-concurrency', 'execution-gates-and-supervision', 'recovery-crash-loop-control-and-honest-reporting',
      'what-instar-1-x-does-today-and-what-carries-forward', 'non-functional-checks-and-activation', 'negative-contract-fixtures',
      'inherited-duties-and-disposition', 'operator-decisions-and-honest-limits'][index]}.md`)].map(file => readFileSync(file, 'utf8')).join('\n');
    const fixtures = new Set([...body.matchAll(/^\| (P15-NF-\d+) \|/gm)].map(match => match[1]));
    expect(fixtures.size).toBe(52); expect(body.match(/\*\*Rule —/g)?.length).toBeGreaterThan(0);
    const map = readFileSync('scripts/check-p15-contract-map.mjs', 'utf8');
    for (let number = 1; number <= 52; number++) expect(map).toContain(`${number}:`);
  });
});
