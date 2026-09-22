import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error Build checker is JavaScript outside the pure core.
import { checkVerificationCoverage, inspectVerificationCore, verificationDispositions } from '../../scripts/check-verification-contracts.mjs';

it('P9-NF-01 P9-NF-02 P9-NF-60 P9-NF-63 owner inventory, declarations and executed-test mapper reject false certification', () => {
  const sources = Object.fromEntries(readdirSync('src/verification').filter(name => name.endsWith('.ts'))
    .map(name => [`src/verification/${name}`, readFileSync(`src/verification/${name}`, 'utf8')]));
  expect(inspectVerificationCore(sources)).toEqual([]);
  expect(verificationDispositions).toHaveLength(66);
  expect(verificationDispositions.every((row: { status: string; reason: string }) => row.status === 'partial' && row.reason.length > 0)).toBe(true);
  expect(() => checkVerificationCoverage({ success: false, testResults: [] })).toThrow('successful actual test run');
  expect(() => checkVerificationCoverage({ success: true, testResults: [] })).toThrow('missing executed passing fixture');
  const ids = verificationDispositions.map((row: { id: string }) => row.id).join(' ');
  expect(checkVerificationCoverage({ success: true, testResults: [{ name: 'mapper', assertionResults: [{ fullName: ids, status: 'passed' }] }] })).toHaveLength(66);
  const declarations = JSON.parse(readFileSync('src/verification/verification.declarations.json', 'utf8')) as { id: string; status: string; holds: unknown[] }[];
  expect(declarations.some(row => row.id === 'verification.core' || row.holds.length > 0)).toBe(false);
});
