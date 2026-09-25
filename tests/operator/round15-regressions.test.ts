import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { operatorSeams, resolveFailureTrace, validateSeamInventory } from '../../src/operator/index.js';
import type { FailureTraceInput, SeamRow } from '../../src/operator/index.js';
import { operatorFixture } from './fixture.js';
// @ts-expect-error The shared first-landing baseline checker is plain ESM.
import { firstLanding } from '../../scripts/first-landing.mjs';

type Outcome<T> = Readonly<{ accepted: true; value: T }> | Readonly<{ accepted: false; detail: string }>;
const outcome = <T>(result: Result<T>): Outcome<T> => consumeResult<T, Outcome<T>>(result, {
  Success: value => ({ accepted: true as const, value }),
  Refused: refusal => ({ accepted: false as const, detail: refusal.detail }),
});
const trace = (): FailureTraceInput => ({ trace: 'crash-after-effect', semanticIdentity: 'operation:1',
  digests: [hashBytes('payload')], applications: 1, stopCausallyPrior: false,
  owner: 'repair:1', outcome: 'happened', authorityCurrent: true });

it('V55 P11-NF-41 P11-NF-42 a complete consistent applied trace remains settled', () => {
  const f = operatorFixture();
  expect(outcome(resolveFailureTrace(trace(), f.f.c))).toMatchObject({ accepted: true, value: { state: 'settled' } });
});

it.each([
  ['V58', 'invalid digest', { digests: ['not-a-digest'] }],
  ['V59', 'unknown trace kind', { trace: 'unknown' }],
  ['V60', 'unknown outcome', { outcome: 'unknown' }],
] as const)('%s P11-NF-41 P11-NF-42 the total shared-trace decoder refuses an %s', (_id, _title, patch) => {
  const f = operatorFixture();
  expect(outcome(resolveFailureTrace({ ...trace(), ...patch } as FailureTraceInput, f.f.c))).toMatchObject({ accepted: false });
});

it.each([
  ['V61', 'stale authority', { outcome: 'did-not-happen', authorityCurrent: false }],
  ['V62', 'causally prior cancellation', { outcome: 'did-not-happen', trace: 'cancellation-race', stopCausallyPrior: true }],
] as const)('%s P11-NF-41 P11-NF-42 refuses contradictory non-occurrence before the %s return', (_id, _title, patch) => {
  const f = operatorFixture();
  expect(outcome(resolveFailureTrace({ ...trace(), ...patch } as FailureTraceInput, f.f.c))).toMatchObject({ accepted: false });
});

it('V63 P11-NF-40 P11-NF-41 the exact canonical seam inventory remains complete', () => {
  const f = operatorFixture();
  expect(outcome(validateSeamInventory(operatorSeams, f.f.c))).toEqual({ accepted: true, value: 'complete' });
});

it.each([
  ['V65', 'producer'],
  ['V66', 'consumer'],
  ['V67', 'record'],
  ['V68', 'failDirection'],
  ['V69', 'owner'],
] as const)('%s P11-NF-40 P11-NF-41 refuses a seam row with substituted %s', (_id, field) => {
  const f = operatorFixture();
  const rows = operatorSeams.map((row, index) => index === 0 ? { ...row, [field]: 'unrelated-owner-data' } : row);
  const result = outcome(validateSeamInventory(rows as readonly SeamRow[], f.f.c));
  expect(result).toMatchObject({ accepted: false });
  if (!result.accepted) expect(result.detail).toContain(`authorization-completion.${field}`);
});

it.each([
  ['V73', { digests: [hashBytes('another exact payload')] }, 'settled'],
  ['V74', { outcome: 'did-not-happen', applications: 0 }, 'settled'],
  ['V75', { outcome: 'did-not-happen', applications: 0, authorityCurrent: false }, 'authority-closed'],
  ['V76', { outcome: 'did-not-happen', applications: 0, trace: 'cancellation-race', stopCausallyPrior: true }, 'stopped'],
  ['V77', { outcome: 'uncertain', applications: 0 }, 'owned-uncertain'],
] as const)('%s P11-NF-41 P11-NF-42 preserves a consistent valid trace neighbor', (_id, patch, state) => {
  const f = operatorFixture();
  expect(outcome(resolveFailureTrace({ ...trace(), ...patch } as FailureTraceInput, f.f.c)))
    .toMatchObject({ accepted: true, value: { state } });
});

it('V78 P11-NF-40 P11-NF-41 accepts the exact seam rows in a different inventory order', () => {
  const f = operatorFixture();
  expect(outcome(validateSeamInventory([...operatorSeams].reverse(), f.f.c)))
    .toEqual({ accepted: true, value: 'complete' });
});

function checkV79Scope(root = process.cwd()) {
  const scope = firstLanding(root, ['src/operator/seams.ts']);
  if (!scope.applicable) return scope;
  const base = scope.mergeBase;
  const paths = execFileSync('git', ['diff', '--name-only', base, '--', 'src'], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  // SEAM-LEDGER row 45 + GRANT 45-A (2026-09-16 18:25Z): exact additive Eight files.
  const liveInputGrant = ['src/effects/contracts.ts', 'src/effects/records.ts', 'src/effects/doorway.ts', 'src/effects/index.ts'];
  // GRANT U3-A/U3-B (2026-09-17): the one additive Part Twelve sealed-identity consumer arm, exact file.
  const sealedIdentityGrant = ['src/conversation/telegram.ts'];
  // GRANT U5-A: Six's two exact production run-admission paths.
  const runAdmissionGrant = ['src/transport/run-admission.ts', 'src/transport/index.ts'];
  // GRANT U5-E (2026-09-18): Part Two store projection reads (docs/06:55-58), exact file.
  const storeProjectionGrant = ['src/facts/store.ts', 'src/facts/historical.ts']; // GRANT M3-E: historical memo construction
  const providerResponseAssessmentGrant = [
    'src/facts/owned.ts',
    'src/verification/contracts.ts', 'src/verification/records.ts', 'src/verification/runtime.ts',
    'src/verification/effect-consumption.ts', 'src/verification/index.ts', 'src/verification/verification.declarations.json',
    'src/judgment/contracts.ts', 'src/judgment/model-adapter.ts', 'src/judgment/provider-path.ts', 'src/judgment/index.ts',
    'src/judgment/judgment.declarations.json', 'src/effects/provider-path.ts', 'src/effects/index.ts'];
  // GRANT SIX-PAIR (seam-six-reply-pair-grant.md): Six's fixed provider/reply Run pair, exact files.
  const runPairGrant = ['src/transport/contracts.ts', 'src/transport/records.ts', 'src/transport/authority.ts',
    'src/transport/run-pair.ts', 'src/transport/dispatch-invocation.ts', 'src/transport/README.md',
    'src/transport/slice-manifest.json', 'src/transport/transport.declarations.json',
    'src/effects/doorway.ts', 'src/effects/effect.declarations.json'];
  const outside = paths.filter(path => !liveInputGrant.includes(path) && !sealedIdentityGrant.includes(path)
    && !runAdmissionGrant.includes(path) && !storeProjectionGrant.includes(path) && !providerResponseAssessmentGrant.includes(path) && !runPairGrant.includes(path)
    && !['src/intake/', 'src/assembly/', 'src/operator/', 'src/rungraph/'].some(prefix => path.startsWith(prefix)));
  expect(outside).toEqual([]);
  expect(readFileSync(join(root, 'src/index.ts'), 'utf8'))
    .toBe(execFileSync('git', ['show', `${base}:src/index.ts`], { cwd: root, encoding: 'utf8' }));
  return scope;
}

it('V79 checks the operator unit first-landing source scope', () => {
  expect(checkV79Scope()).toMatchObject({ applicable: false });
});

it('V79 fixture accepts an additive owner file, rejects foreign source, and permits later integration', () => {
  const root = mkdtempSync(join(tmpdir(), 'v79-first-landing-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'v79-fixture@instar.local');
    git('config', 'user.name', 'V79 Fixture');
    mkdirSync(join(root, 'src', 'operator'), { recursive: true });
    writeFileSync(join(root, 'src', 'index.ts'), 'public root\n');
    git('add', '.'); git('commit', '-m', 'inherited root');
    git('switch', '-c', 'unlanded');
    writeFileSync(join(root, 'src', 'operator', 'seams.ts'), 'operator addition\n');
    git('add', '.'); git('commit', '-m', 'permitted operator addition');
    expect(checkV79Scope(root)).toMatchObject({ applicable: true });
    writeFileSync(join(root, 'src', 'foreign.ts'), 'violating mutation\n');
    git('add', '.'); git('commit', '-m', 'foreign mutation');
    expect(() => checkV79Scope(root)).toThrow();
    git('switch', 'main');
    mkdirSync(join(root, 'src', 'operator'), { recursive: true });
    writeFileSync(join(root, 'src', 'operator', 'seams.ts'), 'landed operator\n');
    git('add', '.'); git('commit', '-m', 'land operator');
    git('switch', '-c', 'later');
    writeFileSync(join(root, 'src', 'operator', 'seams.ts'), 'later owner edit\n');
    writeFileSync(join(root, 'src', 'foreign.ts'), 'later cross-owner edit\n');
    git('add', '.'); git('commit', '-m', 'later integration');
    expect(checkV79Scope(root)).toMatchObject({ applicable: false });
    const f = operatorFixture();
    const invalid = operatorSeams.map((row, index) => index === 0 ? { ...row, owner: 'wrong-owner' } : row);
    expect(outcome(validateSeamInventory(invalid as readonly SeamRow[], f.f.c))).toMatchObject({ accepted: false });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
