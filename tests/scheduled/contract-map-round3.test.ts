import { expect, it } from 'vitest';
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { checkP15Architecture, checkP15Coverage, p15Dispositions } from '../../scripts/check-p15-contract-map.mjs';

it('P15-CONTRACT-MAP rejects labels attributed to a nonexistent or non-executed test body', () => {
  const labels = p15Dispositions().filter((row: { executable: boolean }) => row.executable)
    .map((row: { id: string }) => row.id).join(' ');
  const report = { success: true, testResults: [{ name: '/definitely/not/a/real/p15-test.ts', assertionResults: [{
    fullName: labels, title: labels, status: 'passed',
  }] }] };
  expect(() => checkP15Coverage(report)).toThrow();
});

it('P15-CONTRACT-MAP rejects a held disposition naming an invented grant or ledger source', () => {
  const dispositions = p15Dispositions();
  const altered = dispositions.map((row: { number: number }) => row.number === 7 ? { ...row,
    held: 'NON-EXECUTABLE-UNTIL-invented-grant.md-row-999', status: 'NON-EXECUTABLE-UNTIL-invented-grant.md-row-999' } : row);
  expect(() => checkP15Architecture(altered)).toThrow(/(?:design-bound validation obligation|held disposition has no existing|unrecognized held disposition)/);
});

it('P15-CONTRACT-MAP rejects a real grant attached to the wrong validation obligation', () => {
  const dispositions = p15Dispositions();
  const wrong = 'NON-EXECUTABLE-UNTIL-seam-response-operator-followup.md-row-69';
  const altered = dispositions.map((row: { number: number }) => row.number === 4
    ? { ...row, held: wrong, status: wrong, reason: wrong } : row);
  expect(() => checkP15Architecture(altered)).toThrow(/design-bound validation obligation/);
});
