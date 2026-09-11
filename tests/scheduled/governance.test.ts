import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Part Fifteen governance inventory', () => {
  it('P15-NF-01 owns no duplicate core type and imports other owners only through public indices', () => {
    const files = readdirSync('src/scheduled').filter(file => file.endsWith('.ts')).map(file => `src/scheduled/${file}`);
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
    expect(fixtures.size).toBe(52);
    const rules = body.split(/(?=^\*\*Rule —)/m).filter(block => block.startsWith('**Rule —'));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const checks = [...rule.slice(0, rule.indexOf('\n\n')).matchAll(/P15-NF-\d+/g)].map(match => match[0]);
      expect(checks.length, rule.split('\n')[0]).toBeGreaterThan(0);
      for (const check of checks) expect(fixtures.has(check), `${rule.split('\n')[0]} maps unknown ${check}`).toBe(true);
    }
    const map = readFileSync('scripts/check-p15-contract-map.mjs', 'utf8');
    for (let number = 1; number <= 52; number++) expect(map).toContain(`${number}:`);

    const inherited = readFileSync('docs/19-scheduled-work/10-inherited-duties-and-disposition.md', 'utf8');
    for (const duty of ['Part two —', 'Part four —', 'Part five —', 'Part six —', 'Part seven —', 'Part eight —', 'Part nine —',
      'Part ten —', 'Part eleven —', '1.x `perMachineIndependent`', '1.x completion learning', 'Rule 38 —', 'Rules 40 and 60 —',
      'Rules 41, 42 and 89 —', 'Rule 111 —']) expect(inherited).toContain(`| ${duty}`);

    const audit = readFileSync('docs/19-scheduled-work/07-what-instar-1-x-does-today-and-what-carries-forward.md', 'utf8');
    for (const module of ['JobScheduler', 'JobLoader', 'AgentMdJobLoader', 'AgentMdReconcile', 'AgentMdAtomicSave', 'AgentMdLockFile',
      'InstallBuiltinJobs', 'buildPerSlugManifest', 'JobClaimManager', 'JobLeaseClaimStore', 'JobLeaseCutoverGate', 'JobRunHistory',
      'SkipLedger', 'IntegrationGate', 'QuotaTracker', 'CrashLoopPauser', 'MigrationInvariants', 'MigrationLedger',
      'OutstandingPromptTracker', 'Mentor*', 'core/types', '.instar/jobs']) expect(audit).toContain(module);
  });
});
