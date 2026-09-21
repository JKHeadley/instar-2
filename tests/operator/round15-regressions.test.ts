import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { operatorSeams, resolveFailureTrace, validateSeamInventory } from '../../src/operator/index.js';
import type { FailureTraceInput, SeamRow } from '../../src/operator/index.js';
import { operatorFixture } from './fixture.js';

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

it('V79 the changed source paths stay inside the explicit Part Four, Part Ten and operator allowlist', () => {
  const root = process.cwd();
  let main = 'main';
  try { execFileSync('git', ['rev-parse', '--verify', main], { cwd: root, stdio: 'ignore' }); }
  catch { main = 'origin/main'; }
  const base = execFileSync('git', ['merge-base', main, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
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
  const outside = paths.filter(path => !liveInputGrant.includes(path) && !sealedIdentityGrant.includes(path)
    && !runAdmissionGrant.includes(path) && !storeProjectionGrant.includes(path) && !['src/intake/', 'src/assembly/', 'src/operator/', 'src/rungraph/'].some(prefix => path.startsWith(prefix)));
  expect(outside).toEqual([]);
  expect(readFileSync(join(root, 'src/index.ts'), 'utf8'))
    .toBe(execFileSync('git', ['show', `${base}:src/index.ts`], { cwd: root, encoding: 'utf8' }));
});
